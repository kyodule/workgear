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
