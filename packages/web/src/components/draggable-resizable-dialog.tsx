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
