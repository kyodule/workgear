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
  And 若当前节点无产物，fallback 查询 GET /api/artifacts?flowRunId={flowRunId}
  And 在审核操作区域上方展示产物列表
  And 每个产物使用 <ArtifactPreviewCard> 组件渲染
```

### Scenario 6: 审核界面产物为空时不显示产物区域

```gherkin
Given human_review 节点状态为 waiting_human
  And 上游节点未生成任何产物
When 用户展开该节点
Then 不显示产物区域
  And 仅显示原有的 input JSON 和审核操作按钮
  And 界面布局与改进前保持一致
```

### Scenario 7: 审核界面产物加载失败时静默处理

```gherkin
Given human_review 节点状态为 waiting_human
  And 产物 API 请求失败（网络错误或服务端错误）
When 前端尝试加载产物
Then 在 console 中记录错误日志
  And 不显示产物区域
  And 不影响审核操作按钮的正常使用
  And 不显示错误提示给用户
```

### Scenario 8: 产物编辑后审核界面自动刷新

```gherkin
Given human_review 节点状态为 waiting_human
  And 审核界面展示了关联产物
  And 用户点击产物卡片的编辑按钮打开编辑器
When 用户在编辑器中修改产物内容并保存
Then 编辑器关闭
  And 审核界面的产物列表自动刷新
  And 产物卡片显示更新后的内容
```
