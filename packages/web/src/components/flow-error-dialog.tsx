import { useState } from 'react'
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface FlowErrorDialogProps {
  error: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FlowErrorDialog({ error, open, onOpenChange }: FlowErrorDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultWidth={1024}
      defaultHeight={560}
      minWidth={480}
      minHeight={320}
      title="流程执行错误详情"
      footer={
        <Button size="sm" variant="outline" onClick={handleCopy}>
          {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
          {copied ? '已复制' : '复制错误信息'}
        </Button>
      }
    >
      <Textarea
        readOnly
        value={error}
        className="h-full text-xs font-mono resize-none"
      />
    </DraggableResizableDialog>
  )
}
