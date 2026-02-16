# Proposal: Markdown Fullscreen Preview — Markdown 内容全屏预览

## 背景（Why）

当前 WorkGear 中所有 Markdown 内容的预览区域都受限于固定高度的容器：

1. **Spec Artifact Viewer**（`spec-artifact-viewer.tsx`）：OpenSpec 文档（proposal.md、design.md、tasks.md、delta specs）在 `max-h-[600px]` 的容器中渲染，长文档需要频繁滚动，无法获得完整的阅读体验。
2. **Artifact Preview Card**（`artifact-preview-card.tsx`）：产物预览卡片的内容区域限制为 `max-h-[300px]`，对于较长的 PRD、Design 文档几乎无法有效阅读。

### 用户痛点

- OpenSpec 的 proposal.md 和 design.md 通常包含大量表格、数据流图、代码示例，在 600px 高度的容器中需要反复滚动，阅读体验割裂
- Artifact Preview Card 的 300px 限制更为严苛，用户只能看到文档开头的一小部分
- 用户在审阅 Spec 文档时需要对照多个章节（如对照 proposal 的影响范围和 design 的文件变更清单），受限容器无法同时看到足够多的内容
- 当前没有任何方式可以将 Markdown 内容放大到全屏查看，用户只能在狭小的预览窗口中阅读

### 根因分析

项目前端的 Markdown 渲染场景均嵌套在 Card / Tab 等容器组件内，使用固定 `max-h` 限制高度。缺少一个全屏预览的交互入口和对应的全屏 Overlay 组件。

## 目标（What）

为 Markdown 内容预览区域增加「全屏预览」能力，让用户可以在全屏 Overlay 中沉浸式阅读 Markdown 文档：

| 元素 | 当前状态 | 目标状态 |
|------|----------|----------|
| Spec Artifact Viewer | max-h-[600px] 滚动容器 | 增加「全屏」按钮，点击后全屏 Overlay 展示 |
| Artifact Preview Card | max-h-[300px] 滚动容器 | 增加「全屏」按钮，点击后全屏 Overlay 展示 |
| 全屏 Overlay | 不存在 | 新增全屏 Overlay 组件，支持 ESC 关闭 |
| MarkdownRenderer | 无全屏能力 | 可选的全屏触发按钮（由调用方控制） |

### 具体方案

1. 创建通用 `<MarkdownFullscreenDialog>` 组件，基于 Shadcn Dialog 实现全屏 Overlay
2. 改造 `spec-artifact-viewer.tsx`：在 ArtifactContent 查看模式的工具栏增加「全屏」按钮（Maximize2 图标）
3. 改造 `artifact-preview-card.tsx`：在内容展开区域增加「全屏」按钮
4. 全屏 Overlay 内使用 `<MarkdownRenderer>` 渲染完整内容，无高度限制
5. 支持 ESC 键和点击关闭按钮退出全屏

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| artifact (Components) | 新增文件 | 新增 `<MarkdownFullscreenDialog>` 通用组件 |
| artifact (Spec Viewer) | 代码变更 | `spec-artifact-viewer.tsx` 增加全屏按钮 |
| artifact (Preview Card) | 代码变更 | `artifact-preview-card.tsx` 增加全屏按钮 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/markdown-fullscreen-dialog.tsx` | ADD | 全屏预览 Dialog 组件 |
| `packages/web/src/components/spec-artifact-viewer.tsx` | MODIFY | ArtifactContent 增加全屏按钮 |
| `packages/web/src/components/artifact-preview-card.tsx` | MODIFY | 展开内容区域增加全屏按钮 |

### 不涉及

- 数据库 schema 无变更
- API 层无变更（全屏预览使用已加载的内容，无需新增端点）
- MarkdownRenderer 组件本身无变更（全屏 Dialog 直接引用它）
- Orchestrator / Go 服务无变更
- 不影响编辑模式（编辑仍使用 Textarea）

## 非目标

- 不实现分屏对比预览（左右对照两个文档）
- 不实现全屏编辑模式（全屏仅用于只读预览）
- 不实现 Markdown 内容的导出/打印功能
- 不实现键盘快捷键导航（如 Page Up/Down 翻页）
- 不修改 MarkdownRenderer 的渲染逻辑或样式

## 风险评估

- **风险等级：低** — 变更集中在前端 UI 交互层，不影响数据模型和核心流程
- Shadcn Dialog 组件已在项目中使用，无需引入新依赖
- 全屏 Overlay 是纯展示层，不涉及状态管理或数据请求
- 向后兼容：现有的非全屏预览行为完全保留，全屏是增量功能
