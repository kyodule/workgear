# Delta Spec: Human Review 产物展示性能与数据传递优化

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-18
> **Change:** fix-human-review-artifact-display

## 概述

修复 human_review 审核界面中产物展示的两个问题：`ArtifactsBySourceNode` 冗余 API 调用导致分组标题闪烁、所有展开节点无差别触发产物加载导致不必要的网络请求。

---

## 场景

### Scenario 1: ArtifactsBySourceNode 使用父组件传入的 nodeRuns 数据

```gherkin
Given FlowTab 已加载 nodeRuns 数据（通过 GET /flow-runs/{flowRunId}/nodes）
  And human_review 节点展开并加载了关联产物
When ArtifactsBySourceNode 组件渲染产物分组
Then 使用父组件传入的 nodeRuns 数据获取节点名称和类型
  And 不再内部发起 GET /flow-runs/{flowRunId}/nodes 请求
  And 分组标题（节点名称）与产物卡片同时渲染，无延迟闪烁
```

### Scenario 2: 分组标题在首次渲染时即可见

```gherkin
Given human_review 节点展开
  And 产物列表来自多个上游 agent_task 节点
When 产物区域首次渲染
Then 每个分组的节点名称标题立即显示（无需等待额外 API 响应）
  And 分组内的产物卡片同步渲染
  And 不出现「先显示卡片、后显示标题」的闪烁现象
```

### Scenario 3: 仅 human_review 和 agent_task 节点触发产物加载

```gherkin
Given 流程中包含多种类型的节点（agent_task、human_review、human_input 等）
  And 用户展开了一个 human_input 类型的已完成节点
When 节点展开
Then 不触发产物加载 API 请求
  And 仅显示节点的 output 数据
```

### Scenario 4: agent_task 节点展开时仅查询自身产物

```gherkin
Given 流程中有一个已完成的 agent_task 节点
  And 该节点生成了产物（nodeRunId 指向该节点）
When 用户点击展开该节点
Then 仅调用 GET /api/artifacts?nodeRunId={nodeRunId} 查询自身产物
  And 不调用 GET /api/artifacts?flowRunId={flowRunId}（双查询仅限 human_review）
  And 展示该节点自身生成的产物列表
```

### Scenario 5: ArtifactsBySourceNode 接收 refreshKey 并传递给子组件

```gherkin
Given human_review 节点展开并展示了产物列表
  And 用户编辑了某个产物并保存
When artifactRefreshKey 递增
Then ArtifactsBySourceNode 将 refreshKey 传递给每个 ArtifactPreviewCard
  And 每个 ArtifactPreviewCard 清除内部缓存
  And 已展开的卡片自动重新加载最新内容
```

### Scenario 6: nodeRuns 数据更新时分组标题同步更新

```gherkin
Given human_review 节点展开并展示了产物分组
  And 父组件的 nodeRuns 数据因 WebSocket 事件而更新（如上游节点状态变化）
When ArtifactsBySourceNode 接收到新的 nodeRuns prop
Then 分组标题中的节点名称和状态同步更新
  And 不触发额外的 API 请求
```
