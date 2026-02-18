# Delta Spec: Timeline 事件折叠展开功能

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-18
> **Change:** timeline-node-collapse-format

## 概述

为 Timeline Tab 增加事件折叠/展开功能，使其与 Flow Tab 的节点展示格式保持一致。用户可以点击事件头部来切换展开/折叠状态，提升大量事件的浏览体验。

---

## 场景

### Scenario 1: 默认折叠状态下浏览事件列表

```gherkin
Given 用户打开任务详情页的 Timeline Tab
  And Timeline 包含 10 个事件
When 页面加载完成
Then 所有事件默认处于折叠状态
  And 每个事件显示事件类型 Badge、时间戳和简短摘要（1-2 行）
  And 事件头部显示可点击的视觉提示（如 hover 效果）
  And 页面高度紧凑，用户可以快速浏览所有事件
```

### Scenario 2: 点击事件头部展开查看详细内容

```gherkin
Given Timeline 中有一个折叠状态的 agent_message 事件
When 用户点击该事件的头部区域
Then 事件展开，显示完整的事件内容
  And 如果内容是 JSON 对象，保持格式化展示
  And 如果是 agent_dispatch_completed 事件，显示角色选择、降级标识、原因等结构化信息
  And 事件头部保持可点击状态
```

### Scenario 3: 点击已展开的事件头部折叠内容

```gherkin
Given Timeline 中有一个已展开的事件
  And 事件内容完整显示
When 用户再次点击该事件的头部区域
Then 事件折叠，仅显示事件类型、时间戳和简短摘要
  And 页面高度减少，其他事件位置上移
  And 折叠/展开动画平滑过渡
```

### Scenario 4: 折叠状态下显示内容摘要

```gherkin
Given Timeline 中有一个 status_change 事件，内容为 "任务状态从 pending 变更为 in_progress"
  And 该事件处于折叠状态
When 用户查看该事件
Then 事件头部显示事件类型 Badge "状态变更" 和时间戳
  And 显示内容摘要："任务状态从 pending 变更为 in_progress"（截断为 1-2 行）
  And 如果内容超过 2 行，显示省略号 "..."
```

### Scenario 5: agent_dispatch_completed 事件的结构化展示

```gherkin
Given Timeline 中有一个 agent_dispatch_completed 事件
  And 事件内容包含 selected_role、fallback、reason 字段
  And 该事件处于折叠状态
When 用户点击展开该事件
Then 显示结构化内容：
  - 选中角色: <Badge>selected_role</Badge>
  - 如果 fallback 为 true，显示 "⚠️ 降级策略"
  - 显示原因: reason 字段内容
  And 格式与当前实现保持一致
```

### Scenario 6: 空事件列表的展示

```gherkin
Given 用户打开任务详情页的 Timeline Tab
  And 该任务尚未启动流程，没有任何事件
When 页面加载完成
Then 显示空状态提示："暂无时间线事件"
  And 显示辅助文字："启动流程后，事件将在此显示"
  And 不显示任何事件项
```

### Scenario 7: 与 Flow Tab 节点格式保持一致

```gherkin
Given 用户在 Flow Tab 中查看节点列表
  And 节点支持折叠/展开，点击头部切换状态
When 用户切换到 Timeline Tab
Then Timeline 事件的交互模式与 Flow 节点一致
  And 事件头部的视觉样式（边框、间距、hover 效果）与 Flow 节点相似
  And 折叠/展开的动画效果保持一致
  And 用户无需学习新的交互模式
```

### Scenario 8: 加载状态的展示

```gherkin
Given 用户打开任务详情页的 Timeline Tab
  And Timeline 数据正在从后端加载
When 页面处于加载状态
Then 显示加载提示："加载中..."
  And 加载提示居中显示
  And 不显示任何事件项
When 数据加载完成
Then 隐藏加载提示，显示事件列表
```
