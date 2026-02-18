# Delta Spec: Human Review 节点支持配置产物查询范围

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-18
> **Change:** human-review-predecessor-artifact-scope

## 概述

修改 human_review 节点的行为规范，增加 `artifactScope` 配置字段，支持三种产物查询范围：`predecessor`（仅前驱节点）、`flow`（整个流程）、`self`（仅自身）。默认使用 `predecessor` 模式，减少审核界面的信息过载。

---

## 场景

### Scenario 1: 默认查询前驱节点产物（predecessor 模式）

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点未配置 artifactScope 字段（或配置为 "predecessor"）
  And 该节点的上游存在一个 agent_task 节点（id: "design_task"）
  And design_task 节点已完成并生成了 3 个产物（proposal.md, design.md, tasks.md）
When human_review 节点状态变为 waiting_human
  And 用户在流程标签页中展开该节点
Then 前端从 nodeRun.input 中提取前驱节点的 nodeRunId
  And 调用 GET /api/artifacts?nodeRunId={predecessorNodeRunId} 查询前驱节点产物
  And 审核界面仅展示 design_task 节点的 3 个产物
  And 不展示更早的上游节点产物
```

### Scenario 2: 查询整个流程产物（flow 模式）

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "flow"
  And 该节点的上游存在多个 agent_task 节点（需求分析、技术设计、实施计划）
  And 这些节点共生成了 9 个产物
When human_review 节点状态变为 waiting_human
  And 用户在流程标签页中展开该节点
Then 前端调用 GET /api/artifacts?nodeRunId={currentNodeRunId} 查询当前节点产物
  And 同时调用 GET /api/artifacts?flowRunId={flowRunId} 查询整个流程产物
  And 按 artifact.id 去重合并，按 createdAt 排序
  And 审核界面展示所有 9 个产物（保持当前行为）
```

### Scenario 3: 仅查询自身产物（self 模式）

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "self"
  And 该节点本身生成了 1 个产物（review_summary.md）
When human_review 节点状态变为 waiting_human
  And 用户在流程标签页中展开该节点
Then 前端仅调用 GET /api/artifacts?nodeRunId={currentNodeRunId}
  And 审核界面仅展示当前节点自身的 1 个产物
  And 不查询上游节点或整个流程的产物
```

### Scenario 4: 前驱节点识别失败时降级到 self 模式

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "predecessor"（或未配置）
  And nodeRun.input 中不包含前驱节点的 nodeRunId 信息（数据结构异常）
When 前端尝试提取前驱节点 ID
Then 提取失败，记录 console.warn 日志
  And 降级到 self 模式，仅查询当前节点的产物
  And 审核界面正常渲染（可能为空产物列表）
```

### Scenario 5: 多个前驱节点的产物合并

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "predecessor"
  And 该节点的上游存在 2 个并行的 agent_task 节点（前端开发、后端开发）
  And nodeRun.input 中包含两个前驱节点的 nodeRunId
When 前端加载产物
Then 分别调用 GET /api/artifacts?nodeRunId={前端NodeRunId}
  And 调用 GET /api/artifacts?nodeRunId={后端NodeRunId}
  And 合并两个查询结果，按 artifact.id 去重
  And 按 createdAt 排序后展示
```

### Scenario 6: 前驱节点未生成产物时展示空列表

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "predecessor"
  And 前驱节点已完成但未生成任何产物
When 前端查询前驱节点产物
Then API 返回空数组 []
  And 审核界面不显示产物区域
  And 仅显示原有的 input JSON 和审核操作按钮
```

### Scenario 7: 已完成的 human_review 节点按配置展示产物

```gherkin
Given human_review 节点状态为 completed（已通过审核）
  And 该节点配置 artifactScope: "predecessor"
When 用户点击展开该节点查看历史
Then 按照 predecessor 模式查询并展示产物
  And 产物卡片支持展开预览和全屏查看
  And 产物卡片不显示编辑按钮（审核已完成）
```

### Scenario 8: 无效的 artifactScope 配置降级到 predecessor

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "invalid_value"（非法值）
When 前端解析 artifactScope 配置
Then 记录 console.warn 日志
  And 降级到默认的 predecessor 模式
  And 按前驱节点查询产物
```

---

## DSL 配置规范

### artifactScope 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| artifactScope | string | 否 | "predecessor" | 产物查询范围：predecessor / flow / self |

### 配置示例

```yaml
# 示例 1: 默认模式（仅查询前驱节点产物）
- id: review_design
  type: human_review
  # artifactScope 未配置，默认为 "predecessor"

# 示例 2: 查询整个流程产物
- id: final_review
  type: human_review
  artifactScope: flow

# 示例 3: 仅查询自身产物
- id: self_check
  type: human_review
  artifactScope: self
```

---

## 前驱节点识别规则

### nodeRun.input 数据结构

前端从 `nodeRun.input` 中提取前驱节点的 `nodeRunId`，支持以下数据结构：

```typescript
// 结构 1: 单个前驱节点
{
  "predecessorNodeRunId": "node_run_123"
}

// 结构 2: 多个前驱节点（数组）
{
  "predecessorNodeRunIds": ["node_run_123", "node_run_456"]
}

// 结构 3: 嵌套在上游节点输出中
{
  "upstream": {
    "nodeRunId": "node_run_123"
  }
}
```

### 提取优先级

1. 优先查找 `input.predecessorNodeRunIds`（数组）
2. 其次查找 `input.predecessorNodeRunId`（单个）
3. 最后查找 `input.upstream.nodeRunId`（嵌套）
4. 如果都不存在，降级到 `self` 模式

---

## 性能优化

| 模式 | API 调用次数 | 典型响应时间 | 适用场景 |
|------|-------------|-------------|----------|
| predecessor | 1-2 次 | 50-100ms | 大多数审核场景（推荐） |
| flow | 2 次（nodeRunId + flowRunId） | 150-300ms | 需要查看完整历史的最终审核 |
| self | 1 次 | 30-50ms | human_review 自己生成产物的场景 |
