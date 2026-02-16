# Design: Draggable Resizable Dialog — 可拖拽可调整大小的 Dialog 组件

## 技术方案

### 方案概述

创建通用 `<DraggableResizableDialog>` 组件，基于成熟的 [react-rnd](https://github.com/bokuweb/react-rnd) 库封装，利用其 `<Rnd>` 组件提供拖拽移动和调整大小能力。组件保持 Shadcn Dialog 的视觉风格，作为需要灵活窗口尺寸场景的基础组件。首个应用场景为 Node Log Dialog。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 拖拽 + Resize 实现 | react-rnd（`<Rnd>` 组件） | 成熟稳定的社区库，周下载量 100K+，内置拖拽和 8 方向 resize，避免自己造轮子 |
| 拖拽区域限定 | `dragHandleClassName` | react-rnd 原生支持，将拖拽限定在标题栏，不影响内容区域的交互 |
| 拖拽边界约束 | `bounds="window"` | react-rnd 原生支持，防止 Dialog 被拖出视口 |
| 尺寸约束 | `minWidth` / `minHeight` props | react-rnd 原生支持，无需手动计算 |
| 组件基础 | 不基于 Radix Dialog | Radix Dialog 的固定居中定位和 focus trap 与自由拖拽冲突，直接使用 Portal + react-rnd 更灵活 |
| 遮罩层 | 复用 Shadcn Dialog 的遮罩样式 | 保持视觉一致性，`bg-black/80` |
| 状态管理 | react-rnd 内部管理 + key 重置 | 利用 react-rnd 的非受控模式（`default` prop），通过 `key={open}` 在每次打开时重置位置和尺寸 |
| 焦点管理 | 手动实现 ESC 关闭 | 通过 onKeyDown 监听 ESC，不使用 Radix 的 focus trap（避免与拖拽交互冲突） |

### 为什么选择 react-rnd

| 对比维度 | react-rnd | 原生 Pointer Events 自实现 |
|----------|-----------|---------------------------|
| 代码量 | 封装组件 ~60 行 | 拖拽 + resize 逻辑 ~200 行 |
| 可靠性 | 社区验证，边界情况已处理 | 需自行处理各种边界（视口溢出、触摸设备、iframe 等） |
| 维护成本 | 库维护，bug 由社区修复 | 自行维护所有拖拽/resize 逻辑 |
| 功能完整度 | 内置 bounds、grid snap、axis lock 等 | 需要时逐个实现 |
| 包体积 | ~12KB gzipped（含 react-draggable + re-resizable） | 0KB（但代码量更多） |
| 触摸设备支持 | 内置支持 | 需额外实现 touch events |

结论：react-rnd 以极小的包体积代价，换来了显著的开发效率和可靠性提升，是更合理的选择。

### 备选方案（已排除）

- **原生 Pointer Events 自实现**：排除原因 — 需要自行处理拖拽、resize、边界约束、触摸设备等大量边界情况，造轮子成本高，可靠性不如成熟库。
- **改造 Shadcn Dialog 组件**：在现有 dialog.tsx 中增加拖拽能力。排除原因 — 会影响所有使用 Shadcn Dialog 的组件，风险高；且 Radix Dialog 的 Content 定位逻辑与自由拖拽冲突。
- **CSS resize 属性**：使用 `resize: both` CSS 属性。排除原因 — 仅支持右下角调整大小，不支持拖拽移动，且样式不可控。
- **@dnd-kit 实现拖拽**：复用项目已有的 @dnd-kit。排除原因 — @dnd-kit 设计用于列表/网格的拖放排序，不适合窗口自由拖拽场景，API 过于复杂。

---

## 数据流

### DraggableResizableDialog 组件内部状态

```
Props 输入
  │
  ├── open / onOpenChange → 控制显示/隐藏
  ├── title → 标题栏内容
  ├── children → 主体内容
  ├── defaultWidth / defaultHeight → 传递给 <Rnd> 的 default prop
  └── minWidth / minHeight → 传递给 <Rnd> 的 minWidth / minHeight prop
  │
  ▼
react-rnd <Rnd> 组件（非受控模式）
  │
  ├── default={{ x: centerX, y: centerY, width: defaultWidth, height: defaultHeight }}
  ├── minWidth / minHeight → 尺寸约束
  ├── bounds="window" → 拖拽边界
  ├── dragHandleClassName="drag-handle" → 拖拽区域限定
  └── 内部自动管理 position 和 size 状态
  │
  ▼
渲染输出
  │
  ├── Portal → document.body
  │     ├── Overlay（遮罩层，点击关闭）
  │     └── <Rnd> 容器（自动管理 left/top/width/height）
  │           ├── 标题栏（className="drag-handle"，cursor-grab）
  │           │     ├── title 内容
  │           │     └── 关闭按钮（X 图标）
  │           └── 内容区域（children，flex-1 overflow-y-auto）
  │
  ▼
交互处理
  │
  ├── 拖拽：react-rnd 内部处理，限定在标题栏（dragHandleClassName）
  ├── Resize：react-rnd 内部处理，8 方向 resize 手柄
  ├── 关闭：ESC keydown / X click / Overlay click → onOpenChange(false)
  └── 重置：open 变化时通过 key prop 重新挂载 <Rnd>，恢复初始位置和尺寸
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
    │     ├── minWidth={480} minHeight={320}
    │     └── children = 日志列表（保持现有逻辑不变）
    │
    ├── 历史日志加载（GET /node-runs/{id}/logs）→ 不变
    ├── WebSocket 实时订阅（running 状态）→ 不变
    └── 自动滚动逻辑 → 不变
    │
    ▼
用户拖拽/调整大小
    │  react-rnd 内部管理位置和尺寸状态
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
| `packages/web/src/components/draggable-resizable-dialog.tsx` | 基于 react-rnd 封装的可拖拽可调整大小 Dialog 通用组件 |

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/package.json` | MODIFY | 新增 `react-rnd` 依赖 |
| `packages/web/src/components/node-log-dialog.tsx` | MODIFY | 替换 Shadcn Dialog 为 DraggableResizableDialog |

### 删除文件

无

---

## 具体代码变更

### 0. 安装依赖

```bash
cd packages/web && npm install react-rnd
```

### 1. `packages/web/src/components/draggable-resizable-dialog.tsx`（新增）

```tsx
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
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
  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  // 计算视口居中位置
  const centerX = (window.innerWidth - defaultWidth) / 2
  const centerY = (window.innerHeight - defaultHeight) / 2

  return createPortal(
    <>
      {overlay && (
        <div
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => onOpenChange(false)}
        />
      )}
      <Rnd
        key={String(open)} // open 变化时重新挂载，重置位置和尺寸
        default={{
          x: centerX,
          y: centerY,
          width: defaultWidth,
          height: defaultHeight,
        }}
        minWidth={minWidth}
        minHeight={minHeight}
        bounds="window"
        dragHandleClassName="drag-handle"
        className={cn(
          'fixed z-50 flex flex-col rounded-lg border bg-background shadow-lg',
          className
        )}
        style={{ display: 'flex' }}
      >
        {/* 标题栏 - 拖拽区域 */}
        <div className="drag-handle flex items-center justify-between border-b px-4 py-3 cursor-grab active:cursor-grabbing select-none">
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
      </Rnd>
    </>,
    document.body
  )
}
```

说明：
- 使用 `createPortal` 渲染到 `document.body`，避免父组件 overflow 裁剪
- 使用 react-rnd 的 `<Rnd>` 组件，非受控模式（`default` prop），内部自动管理位置和尺寸
- `dragHandleClassName="drag-handle"` 将拖拽限定在标题栏
- `bounds="window"` 防止 Dialog 被拖出视口
- `key={String(open)}` 确保每次打开时重新挂载，恢复初始位置和尺寸
- 遮罩层、ESC 关闭、X 按钮关闭逻辑手动实现（不依赖 Radix）

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
- react-rnd 的 resize 手柄默认透明，仅通过 cursor 样式提示用户

---

## 测试策略

- 手动验证：DraggableResizableDialog → 打开 → 确认居中显示，尺寸正确
- 手动验证：拖拽标题栏 → 确认 Dialog 跟随移动，不超出视口（bounds="window"）
- 手动验证：拖拽四边和四角 → 确认尺寸正确调整，不小于最小值
- 手动验证：ESC / X / 遮罩 → 确认 Dialog 关闭
- 手动验证：关闭后重新打开 → 确认恢复到居中位置和默认尺寸（key 重置）
- 手动验证：Node Log Dialog → 打开 → 确认使用新组件，标题和内容正确
- 手动验证：Node Log Dialog → 拖拽到一侧 → 确认可以看到底层工作流图
- 手动验证：Node Log Dialog → 调整大小 → 确认日志内容自适应
- 手动验证：Node Log Dialog → running 状态 → 拖拽/resize 后 → 确认 WebSocket 日志正常追加
- 手动验证：Dark mode → 确认 Dialog 样式正确适配
