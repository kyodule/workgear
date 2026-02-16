# Delta Spec: MarkdownRenderer 代码块复制按钮 & CodeBlock 通用组件

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-15
> **Change:** result-syntax-highlight-copy

## 概述

修改产物管理模块中的 MarkdownRenderer 组件，为 Markdown 渲染的代码块注入复制按钮。同时新增通用 `<CodeBlock>` 组件，供 MarkdownRenderer 和其他场景复用。

---

## 场景

### Scenario 1: Markdown 代码块显示复制按钮

```gherkin
Given 用户查看包含代码块的 Markdown 内容（通过 MarkdownRenderer 渲染）
  And 代码块使用 ``` 语法标记（如 ```typescript、```json、```gherkin）
When 代码块渲染完成
Then 代码块右上角显示一个「复制」按钮（Copy 图标）
  And 代码块保持原有的语法高亮效果（rehype-highlight）
  And 复制按钮不遮挡代码内容
```

### Scenario 2: 点击复制按钮复制代码内容

```gherkin
Given Markdown 代码块右上角显示复制按钮
When 用户点击复制按钮
Then 代码块的纯文本内容（不含 HTML 标签）复制到系统剪贴板
  And 按钮图标从 Copy 切换为 Check（✓）表示复制成功
  And 2 秒后图标自动恢复为 Copy
```

### Scenario 3: 复制失败的降级处理

```gherkin
Given 浏览器不支持 Clipboard API 或用户拒绝了剪贴板权限
When 用户点击复制按钮
Then 复制操作静默失败
  And 按钮不切换为 Check 图标
  And 不弹出错误提示（避免干扰用户）
```

### Scenario 4: 行内代码不显示复制按钮

```gherkin
Given Markdown 内容包含行内代码（`code`）
When 行内代码渲染
Then 行内代码保持原有样式
  And 不显示复制按钮（仅代码块显示）
```

### Scenario 5: CodeBlock 组件独立使用

```gherkin
Given 开发者在非 Markdown 场景中使用 <CodeBlock> 组件
  And 传入 code（字符串）和 language（可选）props
When 组件渲染
Then 代码以指定语言的语法高亮展示
  And 右上角显示复制按钮
  And 点击复制可将 code 文本复制到剪贴板
```

### Scenario 6: CodeBlock 支持 dark mode

```gherkin
Given 用户切换到 dark mode
When CodeBlock 组件渲染
Then 代码高亮使用 dark 主题配色（与现有 .dark .hljs 样式一致）
  And 复制按钮颜色适配 dark mode
  And 代码块背景色适配 dark mode
```

---

## 变更: markdown-fullscreen-preview (2026-02-16)

### Scenario 7: 新增 MarkdownFullscreenDialog 全屏预览组件

```gherkin
Given 开发者在任意场景中需要全屏展示 Markdown 内容
  And 传入 open（布尔值）、onOpenChange（回调）、content（Markdown 字符串）和 title（可选标题）props
When 组件渲染且 open 为 true
Then 显示一个全屏 Dialog Overlay，覆盖整个视口
  And Dialog 内部使用 <MarkdownRenderer> 渲染 content
  And 内容区域无高度限制，可自由滚动
  And Dialog 顶部显示 title（若提供）和关闭按钮（X 图标）
```

### Scenario 8: 关闭全屏预览

```gherkin
Given 全屏预览 Dialog 处于打开状态
When 用户按下 ESC 键
  Or 用户点击 Dialog 右上角的关闭按钮（X 图标）
  Or 用户点击 Dialog 外部的遮罩层
Then Dialog 关闭
  And 调用 onOpenChange(false) 回调
  And 返回到之前的页面状态，不丢失任何数据
```

### Scenario 9: 全屏预览保持 Markdown 渲染能力

```gherkin
Given 全屏预览 Dialog 打开
  And content 包含 GFM 表格、代码块、任务列表、标题层级等 Markdown 元素
When 内容渲染
Then 所有 Markdown 元素正确渲染（与非全屏模式一致）
  And 代码块保持语法高亮和复制按钮
  And 支持 dark mode 下的样式适配
```

### Scenario 10: Artifact Preview Card 增加全屏按钮

```gherkin
Given 用户在 Artifact Preview Card 中展开了产物内容
  And 内容已加载完成（非 loading 状态）
When 内容区域渲染
Then 内容区域右上角显示一个「全屏」按钮（Maximize2 图标）
  And 按钮样式与现有编辑按钮风格一致
```

### Scenario 11: Artifact Preview Card 点击全屏按钮打开全屏预览

```gherkin
Given Artifact Preview Card 内容区域显示全屏按钮
When 用户点击全屏按钮
Then 打开 MarkdownFullscreenDialog
  And Dialog 标题显示产物的 title
  And Dialog 内容为当前产物的完整 Markdown 内容
  And 关闭 Dialog 后回到 Preview Card 的展开状态
```

### Scenario 12: 内容为空时不显示全屏按钮

```gherkin
Given Artifact Preview Card 展开后内容为空
When 显示「暂无内容」占位提示
Then 不显示全屏按钮
```
