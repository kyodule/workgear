import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'

interface MarkdownFullscreenPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  content: string
}

export function MarkdownFullscreenPreview({
  open,
  onOpenChange,
  title,
  content,
}: MarkdownFullscreenPreviewProps) {
  const isMobile = useIsMobile()
  const [transitionState, setTransitionState] = useState<'entering' | 'entered' | 'exiting'>('entering')
  const [displayContent, setDisplayContent] = useState(content)
  const [displayTitle, setDisplayTitle] = useState(title)

  // Handle content switching with fade transition
  useEffect(() => {
    if (!open) return

    if (content !== displayContent || title !== displayTitle) {
      // Start fade out
      setTransitionState('exiting')

      // After fade out, update content and fade in
      const timer = setTimeout(() => {
        setDisplayContent(content)
        setDisplayTitle(title)
        setTransitionState('entering')

        // Trigger fade in on next frame
        requestAnimationFrame(() => {
          setTransitionState('entered')
        })
      }, 300)

      return () => clearTimeout(timer)
    } else if (transitionState === 'entering') {
      // Initial mount - fade in immediately
      requestAnimationFrame(() => {
        setTransitionState('entered')
      })
    }
  }, [content, title, displayContent, displayTitle, open, transitionState])

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setTransitionState('entering')
      setDisplayContent(content)
      setDisplayTitle(title)
    }
  }, [open, content, title])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-background border-r border-border shadow-lg',
        isMobile ? 'right-0' : 'right-0 sm:right-[32rem]', // Leave space for Sheet on desktop
        'transition-opacity duration-300 ease-in-out',
        transitionState === 'entered' ? 'opacity-100' : 'opacity-0'
      )}
      data-state={transitionState}
    >
      {/* Toolbar */}
      <div className={cn(
        "border-b border-border flex items-center justify-between px-4 shrink-0 h-14"
      )}>
        <h2 className="text-lg font-semibold truncate">{displayTitle}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="关闭全屏预览"
          className={isMobile ? "h-11 w-11" : ""}
        >
          <X className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
        </Button>
      </div>

      {/* Content area */}
      <div className={cn(
        "overflow-y-auto",
        isMobile ? "px-4 py-4" : "px-6 py-6"
      )} style={{ height: 'calc(100vh - 3.5rem)' }}>
        <div className="max-w-4xl mx-auto prose prose-sm md:prose-base max-w-full">
          <MarkdownRenderer content={displayContent} key={displayContent} />
        </div>
      </div>
    </div>
  )
}
