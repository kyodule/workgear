# Delta Spec: DraggableResizableDialog 可拖拽可调整大小的 Dialog 通用组件

> **Type:** ADDED
> **Module:** artifact
> **Date:** 2026-02-16
> **Change:** jsonchange-name-draggable-resizable-dialog

## 概述

新增通用 `<DraggableResizableDialog>` 组件，基于成熟的 [react-rnd](https://github.com/bokuweb/react-rnd) 库（`<Rnd>` 组件）封装，提供拖拽移动和调整大小能力，保持 Shadcn Dialog 的视觉风格，为 JSON 内容查看等需要灵活窗口尺寸的场景提供基础组件。

---

## 场景

### Scenario 1: 渲染可拖拽可调整大小的 Dialog

```gherkin
Given 开发者使用 <DraggableResizableDialog> 组件
  And 传入 open（布尔值）、onOpenChange（回调）、title（标题）和 children（内容）
When open 为 true
Then 显示一个 Dialog 窗口，覆盖在页面内容之上
  And Dialog 初始位置为视口居中
  And Dialog 初始尺寸为 defaultWidth（默认 672px）× defaultHeight（默认 480px）
  And Dialog 具有与 Shadcn Dialog 一致的视觉风格（边框、圆角、阴影、背景色）
  And Dialog 背后显示半透明遮罩层
  And 底层使用 react-rnd 的 <Rnd> 组件提供拖拽和 resize 能力
```

### Scenario 2: 通过标题栏拖拽移动 Dialog

```gherkin
Given DraggableResizableDialog 处于打开状态
When 用户在标题栏区域按下鼠标并拖动
Then Dialog 跟随鼠标移动，实时更新位置
  And 拖拽过程中鼠标光标变为 grab/grabbing
  And Dialog 不会被拖出视口边界（通过 react-rnd 的 bounds="window" 约束）
  And 释放鼠标后 Dialog 停留在当前位置
  And 拖拽通过 react-rnd 的 dragHandleClassName 限定在标题栏区域
```

### Scenario 3: 通过边缘和角落调整 Dialog 大小

```gherkin
Given DraggableResizableDialog 处于打开状态
When 用户将鼠标移动到 Dialog 的边缘或角落
Then 鼠标光标变为对应的 resize 光标（n-resize、e-resize、nw-resize 等）
When 用户按下鼠标并拖动
Then Dialog 尺寸跟随鼠标实时调整
  And 宽度不小于 minWidth（默认 320px），通过 react-rnd 的 minWidth prop 约束
  And 高度不小于 minHeight（默认 240px），通过 react-rnd 的 minHeight prop 约束
  And 释放鼠标后 Dialog 保持调整后的尺寸
  And 内容区域自动填充剩余空间（flex 布局）
```

### Scenario 4: 关闭 Dialog

```gherkin
Given DraggableResizableDialog 处于打开状态
When 用户按下 ESC 键
  Or 用户点击标题栏右侧的关闭按钮（X 图标）
  Or 用户点击遮罩层
Then Dialog 关闭
  And 调用 onOpenChange(false) 回调
  And 下次打开时 Dialog 恢复到初始居中位置和默认尺寸
```

### Scenario 5: Dialog 内容区域自适应

```gherkin
Given DraggableResizableDialog 打开且包含子内容
When 用户调整 Dialog 大小
Then 标题栏高度固定不变
  And 内容区域（children）自动填充剩余空间（flex-1）
  And 内容区域支持 overflow-y-auto 滚动（当内容超出时）
  And react-rnd 的 onResize 回调触发 React 状态更新，内容区域实时响应
```

### Scenario 6: 自定义初始尺寸和约束

```gherkin
Given 开发者传入 defaultWidth=896、defaultHeight=600、minWidth=400、minHeight=300
When Dialog 打开
Then 初始尺寸为 896×600（通过 react-rnd 的 default prop 设置）
  And 调整大小时宽度不小于 400、高度不小于 300
```

---

## Props 规格

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `open` | `boolean` | — | 控制 Dialog 显示/隐藏 |
| `onOpenChange` | `(open: boolean) => void` | — | 状态变更回调 |
| `title` | `ReactNode` | — | 标题栏内容 |
| `children` | `ReactNode` | — | Dialog 主体内容 |
| `defaultWidth` | `number` | `672` | 初始宽度（px） |
| `defaultHeight` | `number` | `480` | 初始高度（px） |
| `minWidth` | `number` | `320` | 最小宽度（px），传递给 react-rnd minWidth |
| `minHeight` | `number` | `240` | 最小高度（px），传递给 react-rnd minHeight |
| `className` | `string` | — | 内容区域（`flex-1 overflow-y-auto p-4` 节点）额外 className |
| `containerClassName` | `string` | — | 外层 `<Rnd>` 容器额外 className |
| `overlay` | `boolean` | `true` | 是否显示遮罩层 |

## UI 规格

### Dialog 窗口

| 属性 | 值 |
|------|-----|
| 底层实现 | react-rnd `<Rnd>` 组件 |
| 边框 | `border`（与 Shadcn Dialog 一致） |
| 圆角 | `rounded-lg` |
| 阴影 | `shadow-lg` |
| 背景 | `bg-background` |
| z-index | `z-50` |
| 拖拽区域 | 标题栏（通过 `dragHandleClassName` 指定） |
| 拖拽边界 | `bounds="window"`（不超出视口） |
| 标题栏 | `cursor-grab`，拖拽时 `cursor-grabbing` |
| 关闭按钮 | 右上角 X 图标，与 Shadcn Dialog 一致 |

### 遮罩层

| 属性 | 值 |
|------|-----|
| 背景 | `bg-black/80`（与 Shadcn Dialog 一致） |
| z-index | `z-50`（Dialog 之下） |
| 点击行为 | 点击遮罩关闭 Dialog |

### Resize 手柄

| 属性 | 值 |
|------|-----|
| 实现 | react-rnd 内置 resize 手柄（enableResizing 全方向开启） |
| 方向 | 四边 + 四角，共 8 个方向 |
| 视觉 | 透明（不可见），仅改变光标样式 |
| 光标 | react-rnd 自动管理（`n-resize`、`e-resize`、`ne-resize` 等） |
