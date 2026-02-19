import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-is-mobile'

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const isMobile = useIsMobile()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isMobile })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(isMobile ? {} : listeners)}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md active:shadow-md min-h-[44px]" onClick={onClick}>
        <CardHeader className="p-4 md:p-3">
          <CardTitle className="text-base md:text-sm font-medium">{task.title}</CardTitle>
        </CardHeader>
        {task.description && (
          <CardContent className="p-4 pt-0 md:p-3 md:pt-0">
            <p className="line-clamp-2 text-sm md:text-xs text-muted-foreground">{task.description}</p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
