# Proposal: 修复 Human Review 产物展示的缓存与性能问题

## 背景（Why）

在 `human-review-show-artifacts` 变更上线后，human_review 节点的审核界面已能展示关联产物。但在实际使用中发现以下问题：

### 用户痛点

1. **编辑产物后内容不刷新**：用户在审核界面编辑产物并保存后，产物卡片仍显示旧内容，需要手动折叠再展开才能看到更新。这是因为 `ArtifactPreviewCard` 内部的 `loadContent()` 使用了 `if (content) return content` 的缓存逻辑，但没有在 `artifactRefreshKey` 变化时清除缓存。
2. **分组标题延迟闪烁**：`ArtifactsBySourceNode` 组件内部重新请求 `GET /flow-runs/{flowRunId}/nodes` 获取节点名称用于分组标题，但父组件 `FlowTab` 已持有 `nodeRuns` 数据。这导致产物卡片先渲染、分组标题后出现的闪烁体验。
3. **不必要的 API 请求**：所有展开的节点（包括 `agent_task` 类型的已完成节点）都会触发 `loadNodeArtifacts`，但只有 `human_review` 节点需要双查询合并逻辑，其他节点的产物查询大多返回空结果。

### 根因分析

1. **ArtifactPreviewCard 缺少刷新机制**：组件没有接收外部刷新信号的 prop，内部缓存一旦填充就不会失效
2. **ArtifactsBySourceNode 数据传递断层**：父组件已有节点数据，但子组件重新请求，违反了 React 单向数据流原则
3. **产物加载条件过于宽泛**：`useEffect` 依赖 `expanded` 但未区分节点类型，导致不必要的网络请求

## 目标（What）

修复 human_review 审核界面中产物展示的三个问题：缓存不失效、冗余 API 调用、不必要的请求。

### 具体方案

1. **ArtifactPreviewCard 增加 refreshKey prop**：当 `refreshKey` 变化时清除内部缓存的 `content` 和 `latestVersion`，触发重新加载
2. **ArtifactsBySourceNode 接收 nodeRuns 数据**：从父组件传入已有的 `nodeRuns` 数据，移除内部的 API 调用，消除分组标题闪烁
3. **优化产物加载条件**：仅在节点有产物关联可能性时（`human_review` 或 `agent_task`）才触发加载

### 用户体验改进

| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| 编辑产物后 | 卡片显示旧内容，需手动折叠/展开 | 保存后卡片自动刷新显示新内容 |
| 产物分组标题 | 先显示产物卡片，标题延迟出现 | 产物和分组标题同时渲染 |
| 展开已完成的 agent_task | 触发无意义的产物 API 请求 | 仅查询自身 nodeRunId 的产物 |

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| artifact | Spec 更新 + 代码变更 | ArtifactPreviewCard 增加 refreshKey prop |
| flow-engine | Spec 更新 + 代码变更 | ArtifactsBySourceNode 优化数据传递、产物加载条件优化 |
| web (flow-tab) | 代码变更 | 传递 refreshKey 和 nodeRuns 到子组件 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/artifact-preview-card.tsx` | MODIFY | 增加 refreshKey prop，监听变化清除缓存 |
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | ArtifactsBySourceNode 改为接收 nodeRuns prop；优化产物加载条件；传递 refreshKey |
| `packages/web/src/pages/kanban/task-detail/__tests__/flow-tab-artifacts.test.tsx` | MODIFY | 补充缓存刷新相关测试 |

### 不涉及

- 后端 API 无变更
- 数据库 schema 无变更
- artifacts-tab.tsx 无变更（独立的产物标签页不受影响）
- ArtifactEditorDialog 无变更

## 非目标

- 不重构 ArtifactPreviewCard 的整体架构（仅增加刷新机制）
- 不改变产物的双查询合并策略（仅优化触发条件）
- 不引入全局状态管理（如 Zustand）来管理产物缓存
- 不修改 artifacts-tab.tsx 中的 FlowArtifactsByNode 组件（虽然有类似的分组逻辑，但该组件已正确接收 nodeRuns prop）

## 风险评估

- **风险等级：低** — 纯前端展示逻辑修复，不涉及后端和数据库
- ArtifactPreviewCard 的 refreshKey 是可选 prop，不影响其他使用场景
- ArtifactsBySourceNode 是 flow-tab.tsx 内部组件，变更范围可控
- 产物加载条件优化是减少请求，不会遗漏数据
