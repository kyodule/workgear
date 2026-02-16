# Tasks: Markdown Fullscreen Preview — Markdown 内容全屏预览

## 模块：通用组件 (packages/web/src/components)

### 创建 MarkdownFullscreenDialog 组件

- [x] 新建 `markdown-fullscreen-dialog.tsx` 文件 **[S]**
- [x] 实现 `<MarkdownFullscreenDialog>` 组件，接收 `open`、`onOpenChange`、`title`、`content` props **[S]**
- [x] 基于 Shadcn Dialog 实现全屏 Overlay（`max-w-4xl w-full h-[90vh]`） **[S]**
- [x] DialogHeader 显示 title 和关闭按钮 **[S]**
- [x] 内容区域使用 `<MarkdownRenderer>` 渲染，`flex-1 overflow-y-auto` 自适应滚动 **[S]**
- [x] 确认 ESC 键 / 关闭按钮 / 点击遮罩均可关闭 Dialog **[S]**

## 模块：Spec Artifact Viewer (packages/web/src/components)

### ArtifactContent 增加全屏预览入口

- [x] 在 `spec-artifact-viewer.tsx` 中导入 `Maximize2` 图标和 `MarkdownFullscreenDialog` 组件 **[S]**
- [x] ArtifactContent 组件新增 `fullscreenOpen` state **[S]**
- [x] 查看模式工具栏增加「全屏」按钮（Maximize2 图标，variant="outline" size="sm"） **[S]**
- [x] 编辑模式下隐藏全屏按钮 **[S]**
- [x] 在组件末尾渲染 `<MarkdownFullscreenDialog>`，传入 `artifact.relativePath` 作为 title **[S]**
- [x] 验证全屏打开/关闭后 Tab 选中状态和滚动位置不变 **[S]**

## 模块：Artifact Preview Card (packages/web/src/components)

### 展开内容区域增加全屏预览入口

- [x] 在 `artifact-preview-card.tsx` 中导入 `Maximize2` 图标和 `MarkdownFullscreenDialog` 组件 **[S]**
- [x] 组件新增 `fullscreenOpen` state **[S]**
- [x] 内容加载完成后，操作栏增加「全屏」按钮（编辑按钮左侧） **[S]**
- [x] 内容为空时不显示全屏按钮 **[S]**
- [x] 在组件末尾渲染 `<MarkdownFullscreenDialog>`，传入 `artifact.title` 作为 title **[S]**

## 测试验证

### 端到端验证

- [x] Spec Artifact Viewer → 查看 proposal.md → 点击全屏 → 确认 Dialog 打开，内容完整渲染 **[S]**
- [x] 全屏 Dialog → 确认表格、代码块、标题层级、GFM 元素正确渲染 **[S]**
- [x] 全屏 Dialog → 按 ESC → 确认关闭，回到查看模式 **[S]**
- [x] 全屏 Dialog → 点击关闭按钮 → 确认关闭 **[S]**
- [x] 全屏 Dialog → 点击遮罩 → 确认关闭 **[S]**
- [x] Spec Artifact Viewer → 编辑模式 → 确认不显示全屏按钮 **[S]**
- [x] Spec Artifact Viewer → editable=false → 确认仅显示全屏按钮，不显示编辑按钮 **[S]**
- [x] Artifact Preview Card → 展开内容 → 点击全屏 → 确认 Dialog 打开 **[S]**
- [x] Artifact Preview Card → 内容为空 → 确认不显示全屏按钮 **[S]**
- [x] Dark mode → 确认全屏 Dialog 样式正确适配 **[S]**

## 模块：OpenSpec 文档

- [x] 归档完成后更新 `openspec/specs/kanban/2026-02-15-kanban-board.md` **[S]**
- [x] 归档完成后更新 `openspec/specs/artifact/2026-02-15-artifact-management.md` **[S]**
