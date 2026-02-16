import { useEffect, useRef, useId, type ReactNode } from 'react'
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
  /** 内容区域额外 className */
  className?: string
  /** 外层 Rnd 容器额外 className */
  containerClassName?: string
  overlay?: boolean
}

/**
 * Clamp a value so the dialog never starts off-screen.
 * Returns Math.max(0, (viewport - size) / 2) and also caps size to viewport.
 */
function clampedCenter(
  viewportSize: number,
  dialogSize: number,
): { offset: number; size: number } {
  const clamped = Math.min(dialogSize, viewportSize)
  return {
    offset: Math.max(0, (viewportSize - clamped) / 2),
    size: clamped,
  }
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
  containerClassName,
  overlay = true,
}: DraggableResizableDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // 焦点管理：打开时聚焦 dialog，关闭时返回之前的焦点
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      // 延迟聚焦，等待 portal 渲染完成
      requestAnimationFrame(() => {
        dialogRef.current?.focus()
      })
    } else {
      // 返回之前的焦点
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  if (!open) return null

  // 计算视口居中位置，钳制到边界内
  const { offset: centerX, size: actualWidth } = clampedCenter(
    window.innerWidth,
    defaultWidth,
  )
  const { offset: centerY, size: actualHeight } = clampedCenter(
    window.innerHeight,
    defaultHeight,
  )

  return createPortal(
    <>
      {overlay && (
        <div
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => onOpenChange(false)}
          data-testid="dialog-overlay"
        />
      )}
      <Rnd
        key={String(open)} // open 变化时重新挂载，重置位置和尺寸
        default={{
          x: centerX,
          y: centerY,
          width: actualWidth,
          height: actualHeight,
        }}
        minWidth={minWidth}
        minHeight={minHeight}
        bounds="window"
        dragHandleClassName="drag-handle"
        className={cn(
          'fixed z-50 flex flex-col rounded-lg border bg-background shadow-lg',
          containerClassName,
        )}
        style={{ display: 'flex' }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="flex h-full flex-col outline-none"
          data-testid="draggable-resizable-dialog"
        >
          {/* 标题栏 - 拖拽区域 */}
          <div className="drag-handle flex items-center justify-between border-b px-4 py-3 cursor-grab active:cursor-grabbing select-none">
            <div id={titleId} className="text-sm font-semibold">
              {title}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              aria-label="关闭"
              data-testid="dialog-close-button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 内容区域 */}
          <div className={cn('flex-1 overflow-y-auto p-4', className)}>
            {children}
          </div>
        </div>
      </Rnd>
    </>,
    document.body,
  )
}
