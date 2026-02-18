# Delta Spec: 产物查询支持前驱节点范围

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-18
> **Change:** human-review-predecessor-artifact-scope

## 概述

扩展产物管理模块的查询能力，支持根据 human_review 节点的 `artifactScope` 配置，按不同范围查询产物：前驱节点（predecessor）、整个流程（flow）、仅自身（self）。

---

## 场景

### Scenario 1: 前驱节点产物查询（predecessor 模式）

```gherkin
Given human_review 节点配置 artifactScope: "predecessor"
  And 前端从 nodeRun.input 中提取到前驱节点 ID: "node_run_123"
When 前端加载产物
Then 调用 GET /api/artifacts?nodeRunId=node_run_123
  And 返回前驱节点关联的所有产物
  And 产物按 createdAt 升序排序
  And 在审核界面中使用 <ArtifactPreviewCard> 渲染
```

### Scenario 2: 多个前驱节点产物合并查询

```gherkin
Given human_review 节点配置 artifactScope: "predecessor"
  And 前端从 nodeRun.input 中提取到 2 个前驱节点 ID
When 前端加载产物
Then 分别调用 GET /api/artifacts?nodeRunId={id1}
  And 调用 GET /api/artifacts?nodeRunId={id2}
  And 合并两个查询结果（按 artifact.id 去重）
  And 按 createdAt 升序排序
  And 在审核界面中按来源节点分组展示
```

### Scenario 3: 整个流程产物查询（flow 模式）

```gherkin
Given human_review 节点配置 artifactScope: "flow"
When 前端加载产物
Then 调用 GET /api/artifacts?nodeRunId={currentNodeRunId}
  And 调用 GET /api/artifacts?flowRunId={flowRunId}
  And 按 artifact.id 去重合并（优先保留 nodeData）
  And 按 createdAt 升序排序
  And 在审核界面中按来源节点分组展示
```

### Scenario 4: 仅自身产物查询（self 模式）

```gherkin
Given human_review 节点配置 artifactScope: "self"
When 前端加载产物
Then 仅调用 GET /api/artifacts?nodeRunId={currentNodeRunId}
  And 返回当前节点自身关联的产物
  And 不查询上游节点或整个流程的产物
```

### Scenario 5: 产物按来源节点分组展示

```gherkin
Given 审核界面加载了多个节点的产物
  And 产物来自不同的上游节点（如 design_task、impl_task）
When 产物列表渲染
Then 产物按 sourceNodeId 分组
  And 每组显示节点名称作为分组标题（从 nodeRuns 数据中获取）
  And 组内产物按 createdAt 排序
  And 每个产物使用 <ArtifactPreviewCard> 渲染
```

### Scenario 6: 前驱节点产物为空时的展示

```gherkin
Given human_review 节点配置 artifactScope: "predecessor"
  And 前驱节点已完成但未生成任何产物
When 前端查询前驱节点产物
Then API 返回空数组 []
  And 审核界面不显示产物区域
  And 显示原有的 input JSON 和审核操作按钮
```

### Scenario 7: 产物编辑后刷新（所有模式通用）

```gherkin
Given 审核界面展示了产物列表（任意 artifactScope 模式）
  And 用户点击产物卡片的编辑按钮打开编辑器
When 用户在编辑器中修改产物内容并保存
Then 编辑器关闭
  And artifactRefreshKey 递增
  And 触发产物重新查询（按当前 artifactScope 模式）
  And 产物卡片显示更新后的内容
```

### Scenario 8: 产物全屏查看（所有模式通用）

```gherkin
Given 审核界面展示了产物列表（任意 artifactScope 模式）
  And 产物卡片处于折叠或展开状态
When 用户点击产物卡片的全屏按钮（Maximize2 图标）
Then 打开 <MarkdownFullscreenDialog>
  And Dialog 标题显示产物标题
  And Dialog 内容显示产物的完整 Markdown 内容
  And 关闭 Dialog 后回到审核界面
```

---

## API 使用规范

### 查询参数组合

| artifactScope | API 调用 | 说明 |
|--------------|---------|------|
| predecessor | GET /api/artifacts?nodeRunId={predecessorId} | 查询前驱节点产物（可能多次调用） |
| flow | GET /api/artifacts?nodeRunId={currentId} + GET /api/artifacts?flowRunId={flowId} | 双查询合并 |
| self | GET /api/artifacts?nodeRunId={currentId} | 仅查询当前节点 |

### 去重合并规则

当需要合并多个查询结果时（predecessor 多个前驱、flow 模式）：

1. 使用 `Map<artifact.id, Artifact>` 按 ID 去重
2. 后查询的结果覆盖先查询的结果（保证数据最新）
3. 合并后按 `createdAt` 升序排序

---

## UI 规格

### 产物分组展示（ArtifactsBySourceNode）

| 属性 | 值 |
|------|-----|
| 分组依据 | artifact.sourceNodeId（产物关联的节点 ID） |
| 分组标题 | 从 nodeRuns 数据中查找对应节点的 nodeName |
| 组内排序 | 按 artifact.createdAt 升序 |
| 编辑按钮 | 仅在 canEdit=true 时显示（waiting_human 状态） |

### 产物卡片（ArtifactPreviewCard）

| 属性 | 值 |
|------|-----|
| 刷新机制 | 接收 refreshKey prop，变化时清除内部缓存 |
| 全屏按钮 | 展开状态下显示 Maximize2 图标 |
| 编辑按钮 | 根据 onEdit 回调是否传入决定是否显示 |
| 最大高度 | 折叠时 0，展开时 300px（可滚动） |

---

## 性能优化

### 查询次数对比

| 场景 | 改进前（flow 模式） | 改进后（predecessor 模式） |
|------|-------------------|-------------------------|
| 单个前驱节点 | 2 次 API 调用 | 1 次 API 调用 |
| 两个前驱节点 | 2 次 API 调用 | 2 次 API 调用 |
| 长流程（5+ 节点） | 2 次调用，返回 15+ 产物 | 1-2 次调用，返回 3-6 产物 |

### 响应时间优化

- predecessor 模式：50-100ms（仅查询相关节点）
- flow 模式：150-300ms（查询整个流程）
- 减少前端渲染的产物数量，提升页面响应速度
