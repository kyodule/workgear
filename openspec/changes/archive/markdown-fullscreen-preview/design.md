# Design: Markdown Fullscreen Preview — Markdown 内容全屏预览

## 技术方案

### 方案概述

基于 Shadcn Dialog 组件创建通用 `<MarkdownFullscreenDialog>` 全屏预览组件，在 Spec Artifact Viewer 和 Artifact Preview Card 中增加全屏入口按钮，让用户可以在全屏 Overlay 中沉浸式阅读 Markdown 文档。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 全屏容器 | Shadcn Dialog | 项目已使用 Shadcn UI，Dialog 提供完整的 Overlay、动画、ESC 关闭、焦点管理能力，无需引入新依赖 |
| Dialog 尺寸 | `max-w-4xl h-[90vh]` | 4xl（896px）宽度适合 Markdown 阅读，90vh 高度保留上下边距，视觉上不完全遮挡 |
| 内容渲染 | 复用 `<MarkdownRenderer>` | 保持全屏与非全屏渲染效果一致，无需重复实现 |
| 全屏按钮图标 | `Maximize2` | lucide-react 中标准的全屏/放大图标，语义清晰 |
| 组件抽取 | 独立 `markdown-fullscreen-dialog.tsx` | 两处使用场景（Spec Viewer + Preview Card），抽取通用组件避免重复 |

### 备选方案（已排除）

- **浏览器原生 Fullscreen API**（`element.requestFullscreen()`）：排除原因：原生全屏会隐藏浏览器 UI，体验过于激进；且在某些浏览器中需要用户手势触发，兼容性不如 Dialog Overlay。
- **新开页面/路由**：排除原因：需要传递 Markdown 内容到新页面，增加路由和状态管理复杂度，且用户需要手动返回。
- **可拖拽调整高度的容器**：排除原因：实现复杂度高，且无法达到全屏阅读的沉浸感。

---

## 数据流

### Spec Artifact Viewer — 全屏预览

```
用户在 Spec Artifact Viewer 查看 artifact
    │
    ▼
ArtifactContent 组件渲染（查看模式）
    │
    ├── 工具栏显示「全屏」按钮（Maximize2 图标）
    │
    ▼
用户点击「全屏」按钮
    │
    ▼
setFullscreenOpen(true)
    │
    ▼
<MarkdownFullscreenDialog
  open={fullscreenOpen}
  onOpenChange={setFullscreenOpen}
  title={artifact.relativePath}
  content={artifact.content}        ← 使用已加载的内容，无需额外请求
/>
    │
    ▼
Dialog 内部：<MarkdownRenderer content={content} />
    │  无 max-h 限制，内容区域自由滚动
    │
    ▼
用户关闭 Dialog（ESC / X / 遮罩）
    │
    ▼
setFullscreenOpen(false) → 回到原始查看模式
```

### Artifact Preview Card — 全屏预览

```
用户在 Artifact Preview Card 展开产物内容
    │
    ▼
内容已加载（content 非空）
    │
    ├── 操作栏显示「全屏」按钮 + 「编辑」按钮
    │
    ▼
用户点击「全屏」按钮
    │
    ▼
setFullscreenOpen(true)
    │
    ▼
<MarkdownFullscreenDialog
  open={fullscreenOpen}
  onOpenChange={setFullscreenOpen}
  title={artifact.title}
  content={content}                  ← 使用已加载的内容，无需额外请求
/>
    │
    ▼
Dialog 内部：<MarkdownRenderer content={content} />
    │
    ▼
用户关闭 Dialog → 回到 Preview Card 展开状态
```

---

## 文件变更清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `packages/web/src/components/markdown-fullscreen-dialog.tsx` | 通用 Markdown 全屏预览 Dialog 组件 |

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/spec-artifact-viewer.tsx` | MODIFY | ArtifactContent 增加全屏按钮和 Dialog |
| `packages/web/src/components/artifact-preview-card.tsx` | MODIFY | 展开内容区域增加全屏按钮和 Dialog |

### 删除文件

无

---

## 具体代码变更

### 1. `packages/web/src/components/markdown-fullscreen-dialog.tsx`（新增）

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MarkdownRenderer } from '@/components/markdown-renderer'

interface MarkdownFullscreenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  content: string
}

export function MarkdownFullscreenDialog({
  open,
  onOpenChange,
  title,
  content,
}: MarkdownFullscreenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col">
        {title && (
          <DialogHeader>
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          </DialogHeader>
        )}
        <div className="flex-1 overflow-y-auto pr-2">
          <MarkdownRenderer content={content} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

说明：
- 基于 Shadcn Dialog，`max-w-4xl`（896px）宽度适合 Markdown 阅读
- `h-[90vh]` 高度保留上下边距
- `flex flex-col` + `flex-1 overflow-y-auto` 让内容区域自适应并可滚动
- `pr-2` 为滚动条预留空间，避免内容被遮挡

### 2. `packages/web/src/components/spec-artifact-viewer.tsx`（修改）

在 ArtifactContent 组件中增加全屏功能：

```tsx
// 新增 import
import { Maximize2 } from 'lucide-react'
import { MarkdownFullscreenDialog } from '@/components/markdown-fullscreen-dialog'

// ArtifactContent 内部新增 state
const [fullscreenOpen, setFullscreenOpen] = useState(false)

// 工具栏修改：在编辑按钮左侧增加全屏按钮
<div className="flex items-center gap-2">
  {!isEditing && (
    <Button variant="outline" size="sm" onClick={() => setFullscreenOpen(true)}>
      <Maximize2 className="mr-1 h-3 w-3" />
      全屏
    </Button>
  )}
  {editable && !isEditing && (
    <Button variant="outline" size="sm" onClick={onEdit}>
      <Edit className="mr-1 h-3 w-3" />
      编辑
    </Button>
  )}
  {/* ... 编辑模式按钮保持不变 */}
</div>

// 在组件末尾增加 Dialog
<MarkdownFullscreenDialog
  open={fullscreenOpen}
  onOpenChange={setFullscreenOpen}
  title={artifact.relativePath}
  content={artifact.content}
/>
```

### 3. `packages/web/src/components/artifact-preview-card.tsx`（修改）

在展开内容区域增加全屏功能：

```tsx
// 新增 import
import { Maximize2 } from 'lucide-react'
import { MarkdownFullscreenDialog } from '@/components/markdown-fullscreen-dialog'

// 组件内部新增 state
const [fullscreenOpen, setFullscreenOpen] = useState(false)

// 操作栏修改：在编辑按钮左侧增加全屏按钮
<div className="flex justify-end gap-1.5">
  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setFullscreenOpen(true)}>
    <Maximize2 className="mr-1 h-3 w-3" />
    全屏
  </Button>
  {onEdit && latestVersion && (
    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleEdit}>
      <Pencil className="mr-1 h-3 w-3" />
      编辑
    </Button>
  )}
</div>

// 在组件末尾增加 Dialog
<MarkdownFullscreenDialog
  open={fullscreenOpen}
  onOpenChange={setFullscreenOpen}
  title={artifact.title}
  content={content}
/>
```

---

## 样式方案

全屏 Dialog 使用 Shadcn Dialog 默认样式，无需额外 CSS：

- Dialog Overlay：半透明黑色遮罩（Shadcn 默认）
- DialogContent：居中定位，圆角边框，白色背景
- 内容区域：复用 MarkdownRenderer 的 `prose` 排版样式
- Dark mode：Shadcn Dialog 和 MarkdownRenderer 均已支持 dark mode，无需额外处理

---

## 测试策略

- 手动验证：Spec Artifact Viewer → 查看 proposal.md → 点击全屏 → 确认 Dialog 打开，内容完整渲染
- 手动验证：全屏 Dialog 中 → 确认表格、代码块、标题层级正确渲染
- 手动验证：全屏 Dialog → 按 ESC → 确认 Dialog 关闭，回到查看模式
- 手动验证：全屏 Dialog → 点击关闭按钮 → 确认 Dialog 关闭
- 手动验证：Spec Artifact Viewer → 编辑模式 → 确认不显示全屏按钮
- 手动验证：Artifact Preview Card → 展开内容 → 点击全屏 → 确认 Dialog 打开
- 手动验证：Artifact Preview Card → 内容为空 → 确认不显示全屏按钮
- 手动验证：Dark mode 下 → 确认全屏 Dialog 样式正确
