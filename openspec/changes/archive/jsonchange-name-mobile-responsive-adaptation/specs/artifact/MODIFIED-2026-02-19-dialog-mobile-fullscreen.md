# Delta Spec: 对话框移动端全屏适配

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-19
> **Change:** jsonchange-name-mobile-responsive-adaptation

## 概述

为 DraggableResizableDialog、Markdown 预览对话框等组件增加移动端全屏模式支持，确保对话框在小屏幕设备上完整显示且易于操作。

---

## 场景

### Scenario 1: DraggableResizableDialog 移动端全屏模式

```gherkin
Given 用户在移动设备（屏幕宽度 < 768px）上打开任意对话框
  And 对话框使用 DraggableResizableDialog 组件
When 对话框显示
Then 对话框以全屏模式显示（占据整个视口）
  And 拖拽和调整大小功能在移动端自动禁用
  And 对话框内容区域占据全屏，可垂直滚动
  And 顶部显示标题和关闭按钮
```

### Scenario 2: 移动端对话框关闭交互

```gherkin
Given 用户在移动设备上打开全屏对话框
When 用户想要关闭对话框
Then 用户可以点击顶部的关闭按钮（X）
  And 关闭按钮的点击区域至少为 44x44px
  And 或者用户可以向下滑动对话框来关闭（可选）
  And 点击对话框外部区域不会关闭对话框（避免误触）
```

### Scenario 3: Markdown 预览对话框移动端适配

```gherkin
Given 用户在移动设备上点击 Markdown 文件查看预览
When Markdown 预览对话框打开
Then 对话框以全屏模式显示
  And Markdown 内容自适应屏幕宽度
  And 代码块支持横向滚动（不超出屏幕）
  And 图片自适应屏幕宽度（max-w-full）
  And 用户可以垂直滚动查看完整内容
```

### Scenario 4: 移动端对话框内表单输入优化

```gherkin
Given 对话框内包含表单输入框（如创建任务、编辑工作流）
  And 用户在移动设备上打开对话框
When 用户点击输入框
Then 输入框高度至少为 44px
  And 输入框字体大小至少为 16px（避免 iOS 自动缩放）
  And 输入框获得焦点时，页面自动滚动到输入框位置
  And 虚拟键盘弹出时，对话框内容区域自动调整高度
```

### Scenario 5: Node Log Dialog 移动端全屏显示

```gherkin
Given 用户在移动设备上点击 Flow 节点查看日志
When Node Log Dialog 打开
Then 对话框以全屏模式显示
  And 日志内容区域占据全屏，可垂直滚动
  And 日志条目的字体大小适配移动端（至少 14px）
  And 代码块和 JSON 内容支持横向滚动
  And 自动滚动到底部功能在移动端正常工作
```

### Scenario 6: 平板端对话框半屏模式

```gherkin
Given 用户在平板设备（屏幕宽度 768px - 1024px）上打开对话框
When 对话框显示
Then 对话框以半屏模式显示（宽度 80%，最大 600px）
  And 对话框居中显示，背景显示遮罩
  And 拖拽和调整大小功能在平板端保持启用
  And 用户可以点击遮罩或关闭按钮关闭对话框
```

### Scenario 7: 移动端对话框内按钮布局

```gherkin
Given 对话框底部包含操作按钮（如确认、取消）
  And 用户在移动设备上打开对话框
When 用户查看对话框底部
Then 按钮以垂直堆叠方式显示（每个按钮占据一行）
  And 每个按钮高度至少为 44px
  And 按钮之间的间距至少为 8px
  And 主要操作按钮（如确认）显示在顶部
```

### Scenario 8: 移动端对话框过渡动画

```gherkin
Given 用户在移动设备上打开或关闭对话框
When 对话框显示或隐藏
Then 对话框从底部滑入（打开时）
  And 对话框向底部滑出（关闭时）
  And 过渡动画时长为 200-300ms
  And 动画流畅，不卡顿
```

---

## 变更规格

### DraggableResizableDialog 响应式模式

| 屏幕宽度 | 显示模式 | 宽度 | 高度 | 拖拽/调整大小 |
|----------|----------|------|------|---------------|
| < 768px (移动端) | 全屏 | `w-full` | `h-full` | 禁用 |
| 768px - 1024px (平板) | 半屏 | `w-4/5 max-w-[600px]` | 自适应 | 启用 |
| > 1024px (桌面端) | 居中对话框 | 自定义（如 800px） | 自适应 | 启用 |

### 对话框内元素移动端样式

| 元素 | 桌面端 | 移动端 |
|------|--------|--------|
| 标题字体 | `text-lg` | `text-xl` |
| 关闭按钮大小 | `w-8 h-8` | `w-11 h-11` (44px) |
| 内容内边距 | `p-4` | `p-6` |
| 按钮高度 | `h-9` | `h-11` (44px) |
| 输入框高度 | `h-9` | `h-11` (44px) |
| 输入框字体 | `text-sm` | `text-base` (16px) |

### Markdown 预览移动端样式

| 元素 | 桌面端 | 移动端 |
|------|--------|--------|
| 对话框宽度 | 固定宽度 | `w-full` |
| 对话框高度 | 自适应 | `h-full` |
| 内容内边距 | `p-6` | `p-4` |
| 代码块 | 固定宽度 | `overflow-x-auto max-w-full` |
| 图片 | 原始尺寸 | `max-w-full h-auto` |
| 字体大小 | `text-base` | `text-base` (保持不变) |
