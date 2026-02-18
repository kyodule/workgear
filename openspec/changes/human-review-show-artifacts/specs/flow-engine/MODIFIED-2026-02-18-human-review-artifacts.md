# Delta Spec: Human Review 节点展示关联产物

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-18
> **Change:** human-review-show-artifacts

## 概述

修改 human_review 节点的前端展示行为，在审核界面中自动加载并展示该节点关联的产物（Artifacts），让审核者无需切换标签页即可查看完整的产物内容。

---

## 场景

### Scenario 1: Human Review 节点展开时自动加载关联产物

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

### Scenario 2: Human Review 节点查询上游节点产物

```gherkin
Given human_review 节点本身不直接生成产物
  And 产物由上游 agent_task 节点生成，关联到上游节点的 node_run_id
  And human_review 节点的 input 中包含上游节点的输出数据
When 前端加载 human_review 节点的产物
Then 前端查询当前 human_review 节点自身的 nodeRunId 关联产物
  And 同时查询同一 flowRunId 下所有已完成节点的产物
  And 将所有相关产物合并展示在审核界面中
```

### Scenario 3: 审核界面产物为空时不显示产物区域

```gherkin
Given human_review 节点状态为 waiting_human
  And 上游节点未生成任何产物
When 用户展开该节点
Then 不显示产物区域
  And 仅显示原有的 input JSON 和审核操作按钮
  And 界面布局与改进前保持一致
```

### Scenario 4: 审核界面产物加载失败时静默处理

```gherkin
Given human_review 节点状态为 waiting_human
  And 产物 API 请求失败（网络错误或服务端错误）
When 前端尝试加载产物
Then 在 console 中记录错误日志
  And 不显示产物区域
  And 不影响审核操作按钮的正常使用
  And 不显示错误提示给用户
```

### Scenario 5: 已完成的 Human Review 节点展示产物

```gherkin
Given human_review 节点状态为 completed（已通过审核）
When 用户点击展开该节点查看历史
Then 同样展示关联产物列表
  And 产物卡片支持展开预览和全屏查看
  And 产物卡片不显示编辑按钮（审核已完成）
```

### Scenario 6: 产物编辑后审核界面自动刷新

```gherkin
Given human_review 节点状态为 waiting_human
  And 审核界面展示了关联产物
  And 用户点击产物卡片的编辑按钮打开编辑器
When 用户在编辑器中修改产物内容并保存
Then 编辑器关闭
  And 审核界面的产物列表自动刷新
  And 产物卡片显示更新后的内容
```
