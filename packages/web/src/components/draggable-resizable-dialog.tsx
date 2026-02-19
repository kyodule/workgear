import { useEffect, useRef, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'

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
  /** 内容区域 DOM 引用，用于外部控制滚动 */
  contentRef?: React.Ref<HTMLDivElement>
  /** 底部操作栏（如保存/取消按钮） */
  footer?: ReactNode
  /** 强制全屏模式 */
  fullScreen?: boolean
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

// Body scroll lock with reference counting for multiple dialogs
let scrollLockCount = 0
let originalOverflow = ''

function lockScroll() {
  scrollLockCount++
  if (scrollLockCount === 1) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = originalOverflow
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
  contentRef,
  footer,
  fullScreen: forcedFullScreen,
}: DraggableResizableDialogProps) {
  const isMobile = useIsMobile()
  const fullScreen = forcedFullScreen ?? isMobile
  const dialogRef = useRef<HTMLDivElement>(null)
  const internalContentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Focus trap + ESC handler (attached to dialog element via onKeyDown, not document)
  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      onOpenChange(false)
      return
    }

    if (e.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

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

  // Body scroll lock
  useEffect(() => {
    if (open) {
      lockScroll()
      return () => unlockScroll()
    }
  }, [open])

  if (!open) return null

  // Fullscreen mode for mobile
  if (fullScreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-200"
        data-draggable-dialog-surface="true"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="flex h-full flex-col outline-none"
          data-testid="draggable-resizable-dialog"
          onKeyDown={handleDialogKeyDown}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between border-b px-4 py-3 select-none">
            <div id={titleId} className="text-base font-semibold">
              {title}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-11 w-11 items-center justify-center rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              aria-label="关闭"
              data-testid="dialog-close-button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div
            ref={(node) => {
              internalContentRef.current = node
              if (typeof contentRef === 'function') {
                contentRef(node)
              } else if (contentRef) {
                ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
              }
            }}
            className={cn('flex-1 overflow-y-auto p-4', className)}
          >
            {children}
          </div>

          {/* 底部操作栏 */}
          {footer && (
            <div className="flex flex-col gap-2 border-t px-4 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body,
    )
  }

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
          data-draggable-dialog-overlay="true"
        />
      )}
      <Rnd
        data-draggable-dialog-surface="true"
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
        style={{ display: 'flex', pointerEvents: 'auto' }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="flex h-full flex-col outline-none"
          data-testid="draggable-resizable-dialog"
          onKeyDown={handleDialogKeyDown}
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
          <div
            ref={(node) => {
              internalContentRef.current = node
              if (typeof contentRef === 'function') {
                contentRef(node)
              } else if (contentRef) {
                ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
              }
            }}
            className={cn('flex-1 overflow-y-auto p-4', className)}
          >
            {children}
          </div>

          {/* 底部操作栏 */}
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              {footer}
            </div>
          )}
        </div>
      </Rnd>
    </>,
    document.body,
  )
}
