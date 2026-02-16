# Delta Spec: DraggableResizableDialog 可访问性与交互修复

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-16
> **Change:** fix-draggable-resizable-dialog

## 概述

修复 `<DraggableResizableDialog>` 组件的三个核心问题：缺失 focus trap、ESC 键冒泡未阻止、body scroll 未锁定。这些问题影响可访问性和交互体验。

---

## 场景

### Scenario 1: Focus Trap — Tab 键循环在 Dialog 内

```gherkin
Given DraggableResizableDialog 处于打开状态
  And Dialog 内有多个可聚焦元素（关闭按钮、内容区域的链接/按钮等）
When 用户按下 Tab 键
Then 焦点在 Dialog 内的可聚焦元素之间循环
  And 焦点不会跳出 Dialog 到底层页面元素
When 用户按下 Shift+Tab 键
Then 焦点在 Dialog 内反向循环
  And 焦点不会跳出 Dialog
```

### Scenario 2: Focus Trap — 最后一个元素 Tab 回到第一个

```gherkin
Given DraggableResizableDialog 处于打开状态
  And 焦点在 Dialog 内最后一个可聚焦元素上
When 用户按下 Tab 键
Then 焦点跳回 Dialog 内第一个可聚焦元素
  And 不会聚焦到 Dialog 外部
```

### Scenario 3: ESC 键不冒泡到外层

```gherkin
Given DraggableResizableDialog 处于打开状态
  And Dialog 内有一个打开的 Dropdown 或 Tooltip
When 用户按下 ESC 键
Then ESC 事件被 Dialog 捕获并调用 stopPropagation
  And Dialog 关闭
  And ESC 事件不会继续冒泡到外层组件
```

### Scenario 4: Body Scroll 锁定

```gherkin
Given 页面内容超出视口高度（可滚动）
When DraggableResizableDialog 打开
Then document.body 的 overflow 被设置为 hidden
  And 底层页面无法通过鼠标滚轮或触摸滚动
  And Dialog 内容区域仍可正常滚动
When DraggableResizableDialog 关闭
Then document.body 的 overflow 恢复为原始值
  And 底层页面恢复可滚动
```

### Scenario 5: Body Scroll 锁定 — 多 Dialog 场景

```gherkin
Given 有两个 DraggableResizableDialog 实例（overlay=false 模式）
  And 第一个 Dialog 已打开（body scroll 已锁定）
When 第二个 Dialog 也打开
Then body scroll 仍然锁定
When 第一个 Dialog 关闭
Then body scroll 仍然锁定（因为第二个 Dialog 仍打开）
When 第二个 Dialog 也关闭
Then body scroll 恢复
```

### Scenario 6: Artifact Editor Dialog 改用可拖拽 Dialog

```gherkin
Given 用户在产物详情页点击编辑按钮
When Artifact Editor Dialog 打开
Then Dialog 使用 DraggableResizableDialog 组件渲染
  And 初始尺寸为 768×560（原 max-w-2xl 的近似值）
  And Dialog 初始位置为视口居中
  And 标题栏显示产物类型 Badge 和标题
  And 用户可以拖拽标题栏移动 Dialog
  And 用户可以拖拽边缘调整 Dialog 大小
  And 编辑区域（Textarea）自适应 Dialog 高度
```

### Scenario 7: Flow Error Dialog 改用可拖拽 Dialog

```gherkin
Given 用户在工作流执行页面点击查看错误详情
When Flow Error Dialog 打开
Then Dialog 使用 DraggableResizableDialog 组件渲染
  And 初始尺寸为 1024×560（原 max-w-5xl 的近似值）
  And Dialog 初始位置为视口居中
  And 标题栏显示「流程执行错误详情」
  And 用户可以拖拽标题栏移动 Dialog
  And 用户可以拖拽边缘调整 Dialog 大小
  And 错误内容 Textarea 自适应 Dialog 高度
```

---

## 变更规格

### DraggableResizableDialog 组件变更

| 属性 | 修复前 | 修复后 |
|------|--------|--------|
| Focus Trap | 无 | Tab/Shift+Tab 循环在 Dialog 内 |
| ESC 处理 | `document.addEventListener` 无 stopPropagation | 添加 `e.stopPropagation()` |
| Body Scroll | 未锁定 | 打开时 `body.style.overflow = 'hidden'`，关闭时恢复 |
| Props | 无变化 | 无新增 Props，行为修复 |
