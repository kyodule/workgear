import { useEffect, useState, useCallback, useRef } from 'react'
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, Wrench, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useNodeLogStream, type LogStreamEvent } from '@/hooks/use-websocket'
import { CodeBlock } from '@/components/code-block'

interface NodeLogDialogProps {
  nodeRun: { id: string; nodeName?: string | null; status: string } | null
  open: boolean
  onClose: () => void
}

export function NodeLogDialog({ nodeRun, open, onClose }: NodeLogDialogProps) {
  const [logs, setLogs] = useState<LogStreamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Load historical logs when dialog opens
  useEffect(() => {
    if (!nodeRun?.id || !open) {
      setLogs([])
      return
    }

    setLoading(true)
    api
      .get(`node-runs/${nodeRun.id}/logs`)
      .json<{ logs: LogStreamEvent[] }>()
      .then((data) => {
        setLogs(data.logs || [])
      })
      .catch((err) => {
        console.error('Failed to load logs:', err)
        setLogs([])
      })
      .finally(() => setLoading(false))
  }, [nodeRun?.id, open])

  // Real-time subscription for running nodes
  const handleNewLog = useCallback((event: LogStreamEvent) => {
    setLogs((prev) => [...prev, event])
  }, [])

  useNodeLogStream(nodeRun?.status === 'running' ? nodeRun.id : undefined, handleNewLog)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Monitor scroll position for auto-scroll detection
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const isAtBottom = scrollElement.scrollHeight - scrollElement.scrollTop <= scrollElement.clientHeight + 50
      setAutoScroll(isAtBottom)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [scrollRef])

  if (!nodeRun) return null

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={onClose}
      defaultWidth={896}
      defaultHeight={600}
      minWidth={480}
      minHeight={320}
      contentRef={scrollRef}
      title={
        <span className="flex items-center gap-2">
          执行日志 - {nodeRun.nodeName || nodeRun.id}
          {nodeRun.status === 'running' && (
            <Badge variant="default">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              执行中
            </Badge>
          )}
        </span>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">暂无日志</div>
      ) : (
        <div className="pr-4">
          <div className="space-y-2">
            {logs.map((log, i) => (
              <LogEntry key={i} event={log} />
            ))}
          </div>
        </div>
      )}
    </DraggableResizableDialog>
  )
}

function LogEntry({ event }: { event: LogStreamEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString()

  switch (event.type) {
    case 'assistant':
      return (
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Brain className="h-3 w-3" />
            <span>助手</span>
            <span className="ml-auto">{time}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{event.content}</div>
        </div>
      )

    case 'tool_use':
      return (
        <div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3" />
            <span>工具调用: {event.tool_name}</span>
            <span className="ml-auto">{time}</span>
          </div>
          {event.tool_input && (
            <CodeBlock
              code={JSON.stringify(event.tool_input, null, 2)}
              language="json"
              maxHeight="none"
              className="mt-2"
            />
          )}
        </div>
      )

    case 'tool_result':
      return (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3" />
            <span>工具结果</span>
            <span className="ml-auto">{time}</span>
          </div>
          <CodeBlock
            code={event.content || ''}
            maxHeight="none"
            className="mt-1"
          />
        </div>
      )

    case 'result':
      return (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>执行完成</span>
            <span className="ml-auto text-xs text-muted-foreground">{time}</span>
          </div>
        </div>
      )

    default:
      return (
        <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3">
          <div className="text-xs text-muted-foreground">{time}</div>
          <CodeBlock
            code={JSON.stringify(event, null, 2)}
            language="json"
            maxHeight="none"
            className="mt-1"
          />
        </div>
      )
  }
}
