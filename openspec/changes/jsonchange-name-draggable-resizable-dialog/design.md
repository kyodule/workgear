# Design: Draggable Resizable Dialog — 可拖拽可调整大小的 Dialog 组件

## 技术方案

### 方案概述

创建通用 `<DraggableResizableDialog>` 组件，使用原生 Pointer Events API 实现拖拽移动和调整大小，不引入任何新依赖。组件保持 Shadcn Dialog 的视觉风格，作为需要灵活窗口尺寸场景的基础组件。首个应用场景为 Node Log Dialog。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拖拽实现 | 原生 Pointer Events | 项目已有 @dnd-kit 但它面向列表排序场景，不适合窗口拖拽；原生 pointer events 零依赖、性能好、代码量小 |
| 调整大小实现 | 原生 Pointer Events + 8 方向 resize 手柄 | 无需引入 react-rnd 或 react-resizable，保持依赖精简 |
| 组件基础 | 不基于 Radix Dialog | Radix Dialog 的固定居中定位和 focus trap 与自由拖拽冲突，直接使用 Portal + 自定义实现更灵活 |
| 遮罩层 | 复用 Shadcn Dialog 的遮罩样式 | 保持视觉一致性，`bg-black/80` + fade 动画 |
| 状态管理 | 组件内部 useState | 位置和尺寸是纯 UI 状态，无需 Zustand 全局管理 |
| 焦点管理 | 手动实现 ESC 关闭 | 通过 onKeyDown 监听 ESC，不使用 Radix 的 focus trap（避免与拖拽交互冲突） |
| 动画 | CSS transition（非拖拽时） | 打开/关闭时使用 fade + scale 动画，拖拽/resize 时禁用 transition 避免延迟感 |

### 备选方案（已排除）

- **react-rnd**：功能完善的拖拽+调整大小库。排除原因：引入新依赖（~15KB gzipped），且项目仅需基础拖拽能力，原生实现代码量可控（~150 行）。
- **改造 Shadcn Dialog 组件**：在现有 dialog.tsx 中增加拖拽能力。排除原因：会影响所有使用 Shadcn Dialog 的组件，风险高；且 Radix Dialog 的 Content 定位逻辑与自由拖拽冲突。
- **CSS resize 属性**：使用 `resize: both` CSS 属性。排除原因：仅支持右下角调整大小，不支持拖拽移动，且样式不可控。
- **@dnd-kit 实现拖拽**：复用项目已有的 @dnd-kit。排除原因：@dnd-kit 设计用于列表/网格的拖放排序，不适合窗口自由拖拽场景，API 过于复杂。

---

## 数据流

### DraggableResizableDialog 组件内部状态

```
Props 输入
  │
  ├── open / onOpenChange → 控制显示/隐藏
  ├── title → 标题栏内容
  ├── children → 主体内容
  ├── defaultWidth / defaultHeight → 初始尺寸
  └── minWidth / minHeight → 最小尺寸约束
  │
  ▼
组件内部 State
  │
  ├── position: { x, y } → Dialog 左上角坐标
  ├── size: { width, height } → Dialog 当前尺寸
  └── isDragging / isResizing → 交互状态标记
  │
  ▼
渲染输出
  │
  ├── Portal → document.body
  │     ├── Overlay（遮罩层，点击关闭）
  │     └── Dialog 容器（absolute 定位，style={{ left, top, width, height }}）
  │           ├── 标题栏（onPointerDown → 开始拖拽）
  │           ├── 内容区域（children，flex-1 overflow-y-auto）
  │           └── Resize 手柄 ×8（onPointerDown → 开始 resize）
  │
  ▼
交互处理
  │
  ├── 拖拽：pointerdown(标题栏) → pointermove(更新 position) → pointerup(结束)
  ├── Resize：pointerdown(手柄) → pointermove(更新 size + position) → pointerup(结束)
  └── 关闭：ESC keydown / X click / Overlay click → onOpenChange(false)
```

### Node Log Dialog 改造数据流

```
用户点击节点查看日志
    │
    ▼
NodeLogDialog 组件渲染
    │
    ├── open={true} → DraggableResizableDialog 打开
    │     ├── title = "执行日志 - {nodeName}" + Status Badge
    │     ├── defaultWidth={896} defaultHeight={600}
    │     └── children = 日志列表（保持现有逻辑不变）
    │
    ├── 历史日志加载（GET /node-runs/{id}/logs）→ 不变
    ├── WebSocket 实时订阅（running 状态）→ 不变
    └── 自动滚动逻辑 → 不变
    │
    ▼
用户拖拽/调整大小
    │  仅影响 DraggableResizableDialog 内部 state
    │  不影响日志数据加载和 WebSocket 订阅
    │
    ▼
用户关闭 Dialog
    │
    ▼
onClose() → Dialog 关闭，WebSocket 清理（保持现有逻辑）
```

---

## 文件变更清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `packages/web/src/components/draggable-resizable-dialog.tsx` | 可拖拽可调整大小的 Dialog 通用组件 |

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/node-log-dialog.tsx` | MODIFY | 替换 Shadcn Dialog 为 DraggableResizableDialog |

### 删除文件

无

---

## 具体代码变更

### 1. `packages/web/src/components/draggable-resizable-dialog.tsx`（新增）

```tsx
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DraggableResizableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  children: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  className?: string
  overlay?: boolean
}

export function DraggableResizableDialog({
  open,
  onOpenChange,
  title,
  children,
  defaultWidth = 672,
  defaultHeight = 480,
  minWidth = 320,
  minHeight = 240,
  className,
  overlay = true,
}: DraggableResizableDialogProps) {
  // 内部状态：position（左上角坐标）、size（宽高）
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight })
  const dialogRef = useRef<HTMLDivElement>(null)

  // open 时重置到居中位置
  useEffect(() => {
    if (open) {
      setPosition({
        x: (window.innerWidth - defaultWidth) / 2,
        y: (window.innerHeight - defaultHeight) / 2,
      })
      setSize({ width: defaultWidth, height: defaultHeight })
    }
  }, [open, defaultWidth, defaultHeight])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // 拖拽逻辑：pointerdown on 标题栏 → pointermove → pointerup
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX - position.x
    const startY = e.clientY - position.y
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      setPosition({ x: ev.clientX - startX, y: ev.clientY - startY })
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }, [position])

  // Resize 逻辑：8 个方向的 resize 手柄
  const handleResizeStart = useCallback(
    (direction: string, e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startPos = { ...position }
      const startSize = { ...size }
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        let newX = startPos.x, newY = startPos.y
        let newW = startSize.width, newH = startSize.height

        if (direction.includes('e')) newW = Math.max(minWidth, startSize.width + dx)
        if (direction.includes('w')) {
          newW = Math.max(minWidth, startSize.width - dx)
          newX = startPos.x + startSize.width - newW
        }
        if (direction.includes('s')) newH = Math.max(minHeight, startSize.height + dy)
        if (direction.includes('n')) {
          newH = Math.max(minHeight, startSize.height - dy)
          newY = startPos.y + startSize.height - newH
        }
        setPosition({ x: newX, y: newY })
        setSize({ width: newW, height: newH })
      }
      const onUp = () => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
    },
    [position, size, minWidth, minHeight]
  )

  if (!open) return null

  return createPortal(
    <>
      {overlay && (
        <div
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => onOpenChange(false)}
        />
      )}
      <div
        ref={dialogRef}
        className={cn(
          'fixed z-50 flex flex-col rounded-lg border bg-background shadow-lg',
          className
        )}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* 标题栏 - 拖拽区域 */}
        <div
          className="flex items-center justify-between border-b px-4 py-3 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handleDragStart}
        >
          <div className="text-sm font-semibold">{title}</div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* 8 方向 Resize 手柄 */}
        {/* 上、下、左、右边缘 + 四角 */}
        {['n','s','e','w','ne','nw','se','sw'].map((dir) => (
          <div
            key={dir}
            className="absolute"
            style={getResizeHandleStyle(dir)}
            onPointerDown={(e) => handleResizeStart(dir, e)}
          />
        ))}
      </div>
    </>,
    document.body
  )
}

// 辅助函数：根据方向返回 resize 手柄的定位样式和光标
function getResizeHandleStyle(direction: string): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute' }
  const edge = 4
  const corner = 8

  switch (direction) {
    case 'n':  return { ...base, top: -edge/2, left: corner, right: corner, height: edge, cursor: 'n-resize' }
    case 's':  return { ...base, bottom: -edge/2, left: corner, right: corner, height: edge, cursor: 's-resize' }
    case 'e':  return { ...base, right: -edge/2, top: corner, bottom: corner, width: edge, cursor: 'e-resize' }
    case 'w':  return { ...base, left: -edge/2, top: corner, bottom: corner, width: edge, cursor: 'w-resize' }
    case 'ne': return { ...base, top: -edge/2, right: -edge/2, width: corner, height: corner, cursor: 'ne-resize' }
    case 'nw': return { ...base, top: -edge/2, left: -edge/2, width: corner, height: corner, cursor: 'nw-resize' }
    case 'se': return { ...base, bottom: -edge/2, right: -edge/2, width: corner, height: corner, cursor: 'se-resize' }
    case 'sw': return { ...base, bottom: -edge/2, left: -edge/2, width: corner, height: corner, cursor: 'sw-resize' }
    default:   return base
  }
}
```

说明：
- 使用 `createPortal` 渲染到 `document.body`，避免父组件 overflow 裁剪
- 拖拽使用 `setPointerCapture` 确保鼠标移出窗口时仍能跟踪
- Resize 手柄透明不可见，仅通过 cursor 样式提示用户
- 打开时重置位置和尺寸，关闭后不保留状态

### 2. `packages/web/src/components/node-log-dialog.tsx`（修改）

主要变更：

```tsx
// 替换 import
- import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
+ import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'

// 替换 JSX 容器
- <Dialog open={open} onOpenChange={onClose}>
-   <DialogContent className="max-w-4xl max-h-[80vh]">
-     <DialogHeader>
-       <DialogTitle className="flex items-center gap-2">
-         执行日志 - {nodeRun.nodeName || nodeRun.id}
-         {/* ... Badge ... */}
-       </DialogTitle>
-     </DialogHeader>
-     {/* ... 日志内容 ... */}
-   </DialogContent>
- </Dialog>

+ <DraggableResizableDialog
+   open={open}
+   onOpenChange={onClose}
+   defaultWidth={896}
+   defaultHeight={600}
+   minWidth={480}
+   minHeight={320}
+   title={
+     <span className="flex items-center gap-2">
+       执行日志 - {nodeRun.nodeName || nodeRun.id}
+       {nodeRun.status === 'running' && (
+         <Badge variant="default">
+           <Loader2 className="mr-1 h-3 w-3 animate-spin" />
+           执行中
+         </Badge>
+       )}
+     </span>
+   }
+ >
+   {/* 日志内容保持不变，移除固定 h-[60vh]，改为自适应 */}
+ </DraggableResizableDialog>
```

内容区域变更：
- 移除 `h-[60vh]` 固定高度，改为由 DraggableResizableDialog 的 `flex-1 overflow-y-auto` 自适应
- 日志加载逻辑、WebSocket 订阅、自动滚动逻辑完全不变

---

## 样式方案

- Dialog 窗口复用 Shadcn 的 `border bg-background shadow-lg rounded-lg` 样式 token
- 遮罩层使用 `bg-black/80`（与 Shadcn Dialog Overlay 一致）
- 标题栏使用 `border-b` 分隔，与 DialogHeader 视觉一致
- Dark mode：使用 Tailwind CSS 的 `bg-background` / `border` 等语义 token，自动适配
- 拖拽/resize 时不使用 CSS transition，避免延迟感

---

## 测试策略

- 手动验证：DraggableResizableDialog → 打开 → 确认居中显示，尺寸正确
- 手动验证：拖拽标题栏 → 确认 Dialog 跟随移动，不超出视口
- 手动验证：拖拽四边和四角 → 确认尺寸正确调整，不小于最小值
- 手动验证：ESC / X / 遮罩 → 确认 Dialog 关闭
- 手动验证：Node Log Dialog → 打开 → 确认使用新组件，标题和内容正确
- 手动验证：Node Log Dialog → 拖拽到一侧 → 确认可以看到底层工作流图
- 手动验证：Node Log Dialog → 调整大小 → 确认日志内容自适应
- 手动验证：Node Log Dialog → running 状态 → 拖拽/resize 后 → 确认 WebSocket 日志正常追加
- 手动验证：Dark mode → 确认 Dialog 样式正确适配
