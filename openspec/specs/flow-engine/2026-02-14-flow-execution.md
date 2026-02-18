# Delta Spec: Flow Run 记录 Merge Commit SHA

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-14
> **Change:** add-pr-merge-commit-record

## 概述

修改 flow 执行模块的行为规范，在 PR 合并成功后将 merge commit SHA 记录到 flow_runs 表。

---

## 场景

### Scenario 1: 自动合并成功后记录 merge commit SHA

```gherkin
Given FlowRun 状态为 COMPLETED
  And FlowRun 关联的 PR 存在（prNumber 不为空）
  And 项目配置 autoMergePr = true
When handleFlowCompletedAutoMerge 调用 GitHub Merge API 成功
  And mergeResult.merged = true
  And mergeResult.sha 包含 merge commit 的完整 SHA
Then flow_runs.merge_commit_sha 更新为 mergeResult.sha
  And flow_runs.pr_merged_at 更新为当前时间
  And 两个字段在同一次 UPDATE 中写入
```

### Scenario 2: 手动合并成功后记录 merge commit SHA

```gherkin
Given 用户调用 PUT /flow-runs/:id/merge-pr
  And FlowRun 关联的 PR 存在且未合并
When GitHub Merge API 返回成功
  And mergeResult.sha 包含 merge commit 的完整 SHA
Then flow_runs.merge_commit_sha 更新为 mergeResult.sha
  And flow_runs.pr_merged_at 更新为当前时间
  And 返回 { merged: true, mergeCommitSha: mergeResult.sha }
```

### Scenario 3: 合并失败时不记录 merge commit SHA

```gherkin
Given FlowRun 关联的 PR 存在
When GitHub Merge API 返回失败（mergeResult.merged = false）
Then flow_runs.merge_commit_sha 保持为 NULL
  And flow_runs.pr_merged_at 保持为 NULL
  And 记录 pr_merge_failed timeline 事件
```

### Scenario 4: 历史已合并 PR 的 merge_commit_sha 为 NULL

```gherkin
Given 在此功能上线前已合并的 FlowRun
  And flow_runs.pr_merged_at 已有值
When 前端查询 FlowRun 数据
Then flow_runs.merge_commit_sha 为 NULL
  And 前端优雅降级，不显示 merge commit 链接
```

---

## Human Review 节点展示关联产物 (2026-02-18, human-review-show-artifacts)

### Scenario 5: Human Review 节点展开时自动加载关联产物

```gherkin
Given 流程中存在一个 human_review 节点
  And 该节点的上游 agent_task 节点已生成产物（如 proposal.md、design.md）
  And 产物记录的 node_run_id 指向上游节点的 NodeRun ID
When human_review 节点状态变为 waiting_human
  And 用户在流程标签页中展开该节点
Then 前端自动调用 GET /api/artifacts?nodeRunId={nodeRunId} 查询关联产物
  And 在审核操作区域上方展示产物列表
  And 每个产物使用 <ArtifactPreviewCard> 组件渲染
```

### Scenario 6: Human Review 节点查询上游节点产物（双查询合并）

```gherkin
Given human_review 节点本身不直接生成产物
  And 产物由上游 agent_task 节点生成，关联到上游节点的 node_run_id
  And human_review 节点的 input 中包含上游节点的输出数据
When 前端加载 human_review 节点的产物
Then 前端查询当前 human_review 节点自身的 nodeRunId 关联产物
  And 同时查询同一 flowRunId 下所有已完成节点的产物
  And 将所有相关产物合并展示在审核界面中
```

### Scenario 7: 审核界面产物为空时不显示产物区域

```gherkin
Given human_review 节点状态为 waiting_human
  And 上游节点未生成任何产物
When 用户展开该节点
Then 不显示产物区域
  And 仅显示原有的 input JSON 和审核操作按钮
  And 界面布局与改进前保持一致
```

### Scenario 8: 审核界面产物加载失败时静默处理

```gherkin
Given human_review 节点状态为 waiting_human
  And 产物 API 请求失败（网络错误或服务端错误）
When 前端尝试加载产物
Then 在 console 中记录错误日志
  And 不显示产物区域
  And 不影响审核操作按钮的正常使用
  And 不显示错误提示给用户
```

### Scenario 9: 已完成的 Human Review 节点展示产物

```gherkin
Given human_review 节点状态为 completed（已通过审核）
When 用户点击展开该节点查看历史
Then 同样展示关联产物列表
  And 产物卡片支持展开预览和全屏查看
  And 产物卡片不显示编辑按钮（审核已完成）
```

### Scenario 10: 产物编辑后审核界面自动刷新

```gherkin
Given human_review 节点状态为 waiting_human
  And 审核界面展示了关联产物
  And 用户点击产物卡片的编辑按钮打开编辑器
When 用户在编辑器中修改产物内容并保存
Then 编辑器关闭
  And 审核界面的产物列表自动刷新
  And 产物卡片显示更新后的内容
```

---

## Human Review 节点支持配置产物查询范围 (2026-02-18, human-review-predecessor-artifact-scope)

### Scenario 11: 默认查询前驱节点产物（predecessor 模式）

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

### Scenario 12: 查询整个流程产物（flow 模式）

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

### Scenario 13: 仅查询自身产物（self 模式）

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

### Scenario 14: 前驱节点识别失败时降级到 self 模式

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "predecessor"（或未配置）
  And nodeRun.input 中不包含前驱节点的 nodeRunId 信息（数据结构异常）
When 前端尝试提取前驱节点 ID
Then 提取失败，记录 console.warn 日志
  And 降级到 self 模式，仅查询当前节点的产物
  And 审核界面正常渲染（可能为空产物列表）
```

### Scenario 15: 多个前驱节点的产物合并

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

### Scenario 16: 前驱节点未生成产物时展示空列表

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "predecessor"
  And 前驱节点已完成但未生成任何产物
When 前端查询前驱节点产物
Then API 返回空数组 []
  And 审核界面不显示产物区域
  And 仅显示原有的 input JSON 和审核操作按钮
```

### Scenario 17: 已完成的 human_review 节点按配置展示产物

```gherkin
Given human_review 节点状态为 completed（已通过审核）
  And 该节点配置 artifactScope: "predecessor"
When 用户点击展开该节点查看历史
Then 按照 predecessor 模式查询并展示产物
  And 产物卡片支持展开预览和全屏查看
  And 产物卡片不显示编辑按钮（审核已完成）
```

### Scenario 18: 无效的 artifactScope 配置降级到 predecessor

```gherkin
Given 流程定义中存在 human_review 节点
  And 该节点配置 artifactScope: "invalid_value"（非法值）
When 前端解析 artifactScope 配置
Then 记录 console.warn 日志
  And 降级到默认的 predecessor 模式
  And 按前驱节点查询产物
```
