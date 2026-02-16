# Delta Spec: Node Log Dialog 改用可拖拽可调整大小的 Dialog

> **Type:** MODIFIED
> **Module:** kanban
> **Date:** 2026-02-16
> **Change:** jsonchange-name-draggable-resizable-dialog

## 概述

修改看板模块中的 Node Log Dialog，将固定尺寸的 Shadcn Dialog 替换为 `<DraggableResizableDialog>`，让用户在查看节点执行日志（包含大量 JSON 格式的 tool_input / tool_result）时可以自由拖拽和调整窗口大小。

---

## 场景

### Scenario 1: Node Log Dialog 使用可拖拽可调整大小的容器

```gherkin
Given 用户在工作流执行页面点击某个节点查看日志
When Node Log Dialog 打开
Then Dialog 使用 DraggableResizableDialog 组件渲染
  And 初始尺寸为 896×600（原 max-w-4xl max-h-[80vh] 的近似值）
  And Dialog 初始位置为视口居中
  And 标题栏显示「执行日志 - {nodeName}」和运行状态 Badge
```

### Scenario 2: 拖拽 Node Log Dialog 查看底层工作流

```gherkin
Given Node Log Dialog 处于打开状态
  And 底层显示 DAG 工作流图
When 用户拖拽 Dialog 标题栏将窗口移到屏幕一侧
Then Dialog 移动到目标位置
  And 用户可以同时看到 Dialog 内的日志和底层的工作流图
  And 不影响日志内容的滚动和 WebSocket 实时更新
```

### Scenario 3: 调整 Dialog 大小以查看完整 JSON

```gherkin
Given Node Log Dialog 显示包含复杂 JSON 的 tool_input 或 tool_result
  And JSON 内容在当前 Dialog 尺寸下需要滚动查看
When 用户拖拽 Dialog 边缘扩大窗口
Then Dialog 尺寸增大
  And 日志内容区域自动扩展，显示更多 JSON 内容
  And CodeBlock 组件的 max-height 自适应 Dialog 高度
```

### Scenario 4: 关闭 Node Log Dialog

```gherkin
Given Node Log Dialog 处于打开状态（可能已被拖拽或调整大小）
When 用户按下 ESC 键
  Or 用户点击关闭按钮
  Or 用户点击遮罩层
Then Dialog 关闭
  And WebSocket 日志订阅正常清理
  And 下次打开时 Dialog 恢复到初始居中位置和默认尺寸
```

### Scenario 5: 实时日志流在拖拽/调整大小后正常工作

```gherkin
Given Node Log Dialog 打开且节点状态为 running
  And 用户已将 Dialog 拖拽到非居中位置并调整了大小
When 新的日志事件通过 WebSocket 到达
Then 日志内容正常追加到列表末尾
  And 自动滚动行为不受 Dialog 位置/大小变化影响
  And Dialog 位置和大小保持用户调整后的状态
```

### Scenario 6: Dialog 内日志条目布局自适应

```gherkin
Given Node Log Dialog 已被用户调整为较宽的尺寸（如 1200px 宽）
When 日志中的 JSON CodeBlock 渲染
Then CodeBlock 宽度自适应 Dialog 内容区域宽度
  And 较短的 JSON 不会出现不必要的水平滚动
  And 较长的 JSON 行仍可水平滚动查看
```

---

## UI 规格

### Node Log Dialog（改造后）

| 属性 | 改造前 | 改造后 |
|------|--------|--------|
| 容器组件 | Shadcn Dialog | DraggableResizableDialog |
| 初始宽度 | `max-w-4xl`（896px） | `defaultWidth={896}` |
| 初始高度 | `max-h-[80vh]` | `defaultHeight={600}` |
| 位置 | 固定居中 | 初始居中，可拖拽 |
| 大小 | 固定 | 可调整，minWidth=480, minHeight=320 |
| 标题栏 | DialogHeader | DraggableResizableDialog title prop |
| 内容滚动 | `h-[60vh] overflow-y-auto` | `flex-1 overflow-y-auto`（自适应） |
| 关闭方式 | ESC / X / 遮罩 | ESC / X / 遮罩（保持不变） |
