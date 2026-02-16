# Delta Spec: MarkdownFullscreenDialog 全屏预览组件 & Artifact Preview Card 全屏入口

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-16
> **Change:** markdown-fullscreen-preview

## 概述

修改产物管理模块，新增通用 `<MarkdownFullscreenDialog>` 全屏预览组件，并在 `<ArtifactPreviewCard>` 中增加全屏预览入口，让用户可以在全屏 Overlay 中沉浸式阅读 Markdown 内容。

---

## 场景

### Scenario 1: 新增 MarkdownFullscreenDialog 全屏预览组件

```gherkin
Given 开发者在任意场景中需要全屏展示 Markdown 内容
  And 传入 open（布尔值）、onOpenChange（回调）、content（Markdown 字符串）和 title（可选标题）props
When 组件渲染且 open 为 true
Then 显示一个全屏 Dialog Overlay，覆盖整个视口
  And Dialog 内部使用 <MarkdownRenderer> 渲染 content
  And 内容区域无高度限制，可自由滚动
  And Dialog 顶部显示 title（若提供）和关闭按钮（X 图标）
```

### Scenario 2: 关闭全屏预览

```gherkin
Given 全屏预览 Dialog 处于打开状态
When 用户按下 ESC 键
  Or 用户点击 Dialog 右上角的关闭按钮（X 图标）
  Or 用户点击 Dialog 外部的遮罩层
Then Dialog 关闭
  And 调用 onOpenChange(false) 回调
  And 返回到之前的页面状态，不丢失任何数据
```

### Scenario 3: 全屏预览保持 Markdown 渲染能力

```gherkin
Given 全屏预览 Dialog 打开
  And content 包含 GFM 表格、代码块、任务列表、标题层级等 Markdown 元素
When 内容渲染
Then 所有 Markdown 元素正确渲染（与非全屏模式一致）
  And 代码块保持语法高亮和复制按钮
  And 支持 dark mode 下的样式适配
```

### Scenario 4: Artifact Preview Card 增加全屏按钮

```gherkin
Given 用户在 Artifact Preview Card 中展开了产物内容
  And 内容已加载完成（非 loading 状态）
When 内容区域渲染
Then 内容区域右上角显示一个「全屏」按钮（Maximize2 图标）
  And 按钮样式与现有编辑按钮风格一致
```

### Scenario 5: Artifact Preview Card 点击全屏按钮打开全屏预览

```gherkin
Given Artifact Preview Card 内容区域显示全屏按钮
When 用户点击全屏按钮
Then 打开 MarkdownFullscreenDialog
  And Dialog 标题显示产物的 title
  And Dialog 内容为当前产物的完整 Markdown 内容
  And 关闭 Dialog 后回到 Preview Card 的展开状态
```

### Scenario 6: 内容为空时不显示全屏按钮

```gherkin
Given Artifact Preview Card 展开后内容为空
When 显示「暂无内容」占位提示
Then 不显示全屏按钮
```

---

## UI 规格

### MarkdownFullscreenDialog

| 属性 | 值 |
|------|-----|
| 容器 | Shadcn Dialog，DialogContent 使用 `max-w-4xl w-full h-[90vh]` |
| 标题栏 | DialogHeader，显示 title + 关闭按钮 |
| 内容区域 | `overflow-y-auto flex-1`，内部使用 `<MarkdownRenderer>` |
| 关闭方式 | ESC 键 / 关闭按钮 / 点击遮罩 |
| 动画 | 使用 Shadcn Dialog 默认的 fade + scale 动画 |

### 全屏按钮（Artifact Preview Card）

| 属性 | 值 |
|------|-----|
| 图标 | `Maximize2`（lucide-react） |
| 大小 | `h-6 text-xs`（与编辑按钮一致） |
| 位置 | 编辑按钮左侧 |
| 变体 | `variant="outline"` |
