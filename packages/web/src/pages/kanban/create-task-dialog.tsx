import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import type { CreateTaskDto, Task } from '@/lib/types'
import { useKanbanStore } from '@/stores/kanban-store'
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-is-mobile'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  columnId: string
  onSuccess?: () => void
}

export function CreateTaskDialog({ open, onOpenChange, projectId, columnId, onSuccess }: CreateTaskDialogProps) {
  const isMobile = useIsMobile()
  const { addTask } = useKanbanStore()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateTaskDto>()

  async function onSubmit(data: CreateTaskDto) {
    setLoading(true)
    try {
      const task = await api.post('tasks', {
        json: {
          ...data,
          projectId,
          columnId,
        },
      }).json<Task>()
      addTask(task)
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to create task:', error)
      alert('创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建任务"
      defaultWidth={480}
      defaultHeight={360}
      minWidth={400}
      minHeight={280}
      footer={
        <div className={isMobile ? 'flex flex-col gap-2 w-full' : 'flex gap-2'}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={isMobile ? 'h-11 text-base w-full' : ''}
          >
            取消
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            disabled={loading}
            className={isMobile ? 'h-11 text-base w-full' : ''}
          >
            {loading ? '创建中...' : '创建'}
          </Button>
        </div>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className={isMobile ? 'text-sm' : ''}>任务标题 *</Label>
          <Input
            id="title"
            placeholder="任务标题"
            className={isMobile ? 'h-11 text-base' : ''}
            {...register('title', { required: '任务标题不能为空' })}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description" className={isMobile ? 'text-sm' : ''}>描述</Label>
          <Textarea
            id="description"
            placeholder="任务描述（可选）"
            rows={4}
            className={isMobile ? 'text-base' : ''}
            {...register('description')}
          />
        </div>
      </form>
    </DraggableResizableDialog>
  )
}
