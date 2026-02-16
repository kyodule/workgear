# Delta Spec: Node Log Dialog 修复双重滚动和 Dark Mode 日志颜色

> **Type:** MODIFIED
> **Module:** kanban
> **Date:** 2026-02-16
> **Change:** fix-draggable-resizable-dialog

## 概述

修复 Node Log Dialog 中的两个问题：(1) 内容区域与 DraggableResizableDialog 的双重 `overflow-y-auto` 导致嵌套滚动；(2) LogEntry 组件硬编码浅色背景在 Dark Mode 下不可见。

---

## 场景

### Scenario 1: 日志内容单层滚动

```gherkin
Given Node Log Dialog 打开且包含大量日志条目
When 日志内容超出 Dialog 可视区域
Then 仅有一个滚动条（DraggableResizableDialog 内容区域的滚动条）
  And 不会出现嵌套的双层滚动条
  And 用户滚动时行为符合预期，不会出现"滚不动"的情况
```

### Scenario 2: 日志条目自动滚动不受影响

```gherkin
Given Node Log Dialog 打开且节点状态为 running
  And 用户未手动向上滚动（autoScroll 为 true）
When 新的日志事件通过 WebSocket 到达
Then 日志列表自动滚动到底部
  And 自动滚动行为在单层滚动结构下正常工作
```

### Scenario 3: Dark Mode 下助手消息可见

```gherkin
Given 系统处于 Dark Mode
  And Node Log Dialog 打开
When 日志中包含 type="assistant" 的消息
Then 消息卡片使用 dark mode 兼容的背景色（bg-blue-50 dark:bg-blue-950）
  And 文字内容在深色背景上清晰可见
```

### Scenario 4: Dark Mode 下工具调用可见

```gherkin
Given 系统处于 Dark Mode
  And Node Log Dialog 打开
When 日志中包含 type="tool_use" 的工具调用
Then 工具调用卡片使用 dark mode 兼容的背景色（bg-green-50 dark:bg-green-950）
  And JSON CodeBlock 内容在深色背景上清晰可见
```

### Scenario 5: Dark Mode 下工具结果和执行完成可见

```gherkin
Given 系统处于 Dark Mode
  And Node Log Dialog 打开
When 日志中包含 type="tool_result" 或 type="result" 的条目
Then 卡片使用 dark mode 兼容的背景色（bg-gray-50 dark:bg-gray-900）
  And 所有文字和图标在深色背景上清晰可见
```

### Scenario 6: 调整 Dialog 大小后日志区域自适应

```gherkin
Given Node Log Dialog 打开且包含日志内容
When 用户拖拽 Dialog 边缘调整大小
Then 日志内容区域高度自适应 Dialog 高度
  And 不会出现内容区域固定高度导致的空白或截断
  And 滚动条位置正确更新
```

---

## 变更规格

### Node Log Dialog 滚动结构

| 属性 | 修复前 | 修复后 |
|------|--------|--------|
| 外层（DraggableResizableDialog 内容区域） | `overflow-y-auto p-4` | `overflow-y-auto p-4`（不变） |
| 内层（日志容器） | `h-full overflow-y-auto pr-4` | `pr-4`（移除 h-full 和 overflow-y-auto） |
| 滚动层级 | 双层嵌套滚动 | 单层滚动 |
| scrollRef | 绑定在内层容器 | 改为绑定在 DraggableResizableDialog 内容区域（通过 ref 回调或 className 选择器） |

### LogEntry Dark Mode 颜色

| 日志类型 | 修复前 | 修复后 |
|----------|--------|--------|
| assistant | `bg-blue-50` | `bg-blue-50 dark:bg-blue-950` |
| tool_use | `bg-green-50` | `bg-green-50 dark:bg-green-950` |
| tool_result | `bg-gray-50` | `bg-gray-50 dark:bg-gray-900` |
| result | `bg-gray-50` | `bg-gray-50 dark:bg-gray-900` |
| default | `bg-gray-50` | `bg-gray-50 dark:bg-gray-900` |
