# Tasks: 修复 Human Review 产物展示的缓存与性能问题

## 模块：前端 — artifact-preview-card.tsx (packages/web/src/components)

### ArtifactPreviewCard 缓存刷新机制

- [ ] 增加 `refreshKey?: number` 可选 prop 到 `ArtifactPreviewCardProps` 接口 **[S]**
- [ ] 增加 `useEffect` 监听 `refreshKey` 变化，清除 `content` 和 `latestVersion` 状态 **[S]**
- [ ] 在 `refreshKey` 变化且卡片处于展开状态时，自动调用 `loadContent()` 重新加载 **[S]**
- [ ] 确保 `refreshKey` 为 `undefined` 或初始值 `0` 时不触发清除逻辑（向后兼容） **[S]**

## 模块：前端 — flow-tab.tsx (packages/web/src/pages/kanban/task-detail)

### ArtifactsBySourceNode 数据传递优化

- [ ] 将 `ArtifactsBySourceNode` 的 `flowRunId: string` prop 替换为 `nodeRuns: NodeRun[]` **[S]**
- [ ] 移除 `ArtifactsBySourceNode` 内部的 `nodeRunsMap` 状态和 `useEffect` API 调用 **[S]**
- [ ] 改为直接从 `props.nodeRuns` 构建 `nodeRunsMap`（同步计算，使用 `useMemo` 或直接构建） **[S]**
- [ ] 增加 `refreshKey?: number` prop，传递给每个 `ArtifactPreviewCard` **[S]**

### NodeRunItem 数据传递

- [ ] `NodeRunItem` 增加 `nodeRuns: NodeRun[]` prop **[S]**
- [ ] `FlowTab` 渲染 `NodeRunItem` 时传入 `nodeRuns={nodeRuns}` **[S]**  
- [ ] `NodeRunItem` 渲染 `ArtifactsBySourceNode` 时传入 `nodeRuns={nodeRuns}` 替代 `flowRunId` **[S]**
- [ ] `NodeRunItem` 渲染 `ArtifactsBySourceNode` 时传入 `refreshKey={artifactRefreshKey}` **[S]**

### 产物加载条件优化

- [ ] 修改 `loadNodeArtifacts` 的 `useEffect`，增加 `nodeType` 条件判断 **[S]**
- [ ] 仅在 `nodeType === 'human_review'` 或 `nodeType === 'agent_task'` 时触发加载 **[S]**
- [ ] 确保 `human_input` 等其他类型节点展开时不触发产物 API 请求 **[S]**

## 模块：前端 — 自动化测试

### 单元测试 (packages/web/src/pages/kanban/task-detail/__tests__/flow-tab-artifacts.test.tsx)

- [ ] 测试：ArtifactsBySourceNode 不再发起 `flow-runs/{id}/nodes` API 请求（验证 mockGet 调用中无此 URL） **[S]**
- [ ] 测试：human_input 类型节点展开时不触发 `artifacts?nodeRunId=` API 请求 **[M]**
- [ ] 确保现有 6 个测试用例全部通过（回归验证） **[S]**

## 测试验证

### 手动验证

- [ ] 审核界面编辑产物 → 保存 → 确认卡片内容自动刷新 **[S]**
- [ ] 审核界面展开 human_review → 确认分组标题与产物卡片同时出现（无闪烁） **[S]**
- [ ] 展开 human_input 节点 → 确认 Network 面板无 artifacts API 请求 **[S]**
- [ ] 展开 agent_task 节点 → 确认仅发起 nodeRunId 查询 **[S]**
- [ ] artifacts-tab 产物卡片 → 确认行为不受影响 **[S]**
