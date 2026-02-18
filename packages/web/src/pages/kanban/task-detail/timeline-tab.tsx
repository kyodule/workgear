import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { TimelineEvent } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface TimelineTabProps {
  taskId: string
}

const eventTypeLabels: Record<string, string> = {
  agent_message: 'Agent 消息',
  human_message: '人工消息',
  status_change: '状态变更',
  review_action: 'Review 操作',
  git_event: 'Git 事件',
  system_event: '系统事件',
  agent_dispatch_completed: 'Agent 分发',
}

const eventTypeColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  agent_message: 'default',
  human_message: 'secondary',
  status_change: 'outline',
  review_action: 'destructive',
  git_event: 'secondary',
  system_event: 'outline',
  agent_dispatch_completed: 'default',
}

// 辅助函数：生成内容摘要
function getEventSummary(event: TimelineEvent): string {
  if (typeof event.content === 'string') {
    return event.content.length > 100
      ? event.content.slice(0, 100) + '...'
      : event.content
  }

  if (event.eventType === 'agent_dispatch_completed' && typeof event.content === 'object' && event.content !== null) {
    const content = event.content as Record<string, any>
    return content.selected_role ? `选中角色: ${content.selected_role}` : '选中角色: 未知'
  }

  if (typeof event.content === 'object' && event.content !== null) {
    return `包含 ${Object.keys(event.content).length} 个字段`
  }

  return '无内容'
}

// 辅助函数：渲染事件完整内容
function renderEventContent(event: TimelineEvent) {
  if (event.eventType === 'agent_dispatch_completed' && typeof event.content === 'object' && event.content !== null) {
    const content = event.content as Record<string, any>
    return (
      <div className="space-y-1">
        <div>
          选中角色: <Badge variant="secondary">{content.selected_role || '未知'}</Badge>
          {content.fallback && (
            <span className="ml-2 text-xs text-amber-600">⚠️ 降级策略</span>
          )}
        </div>
        {content.reason && (
          <div className="text-muted-foreground">{content.reason}</div>
        )}
      </div>
    )
  }

  if (typeof event.content === 'string') {
    return event.content
  }

  if (typeof event.content === 'object' && event.content !== null) {
    return <pre className="whitespace-pre-wrap">{JSON.stringify(event.content, null, 2)}</pre>
  }

  return '无内容'
}

// 子组件：单个时间线事件项
function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)

  const eventLabel = eventTypeLabels[event.eventType] || event.eventType
  const eventColor = eventTypeColors[event.eventType] || 'outline'

  // 生成内容摘要
  const summary = getEventSummary(event)

  return (
    <div className="flex gap-3">
      {/* 时间线视觉元素 */}
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <div className="flex-1 border-l border-border" />
      </div>

      {/* 事件内容 */}
      <div className="flex-1 pb-4">
        {/* 可点击的事件头部 */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
          onClick={() => setExpanded(!expanded)}
        >
          <Badge variant={eventColor}>{eventLabel}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleString('zh-CN')}
          </span>
          {!expanded && (
            <span className="text-sm text-muted-foreground truncate flex-1">
              {summary}
            </span>
          )}
        </div>

        {/* 展开的完整内容 */}
        {expanded && (
          <div className="mt-2 text-sm">
            {renderEventContent(event)}
          </div>
        )}
      </div>
    </div>
  )
}

export function TimelineTab({ taskId }: TimelineTabProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true)
        const data = await api.get(`tasks/${taskId}/timeline`).json<TimelineEvent[]>()
        setEvents(data)
      } catch (error) {
        console.error('Failed to load timeline:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTimeline()
  }, [taskId])

  if (loading) {
    return <p className="py-4 text-center text-sm text-muted-foreground">加载中...</p>
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">暂无时间线事件</p>
        <p className="mt-1 text-xs text-muted-foreground">启动流程后，事件将在此显示</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <TimelineEventItem key={event.id} event={event} />
      ))}
    </div>
  )
}
