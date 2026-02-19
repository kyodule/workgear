import { useState, useCallback } from 'react'
import { Pencil, Trash2, Play, ArrowLeft, Clock, Workflow as WorkflowIcon, FileText, GitBranch } from 'lucide-react'
import { api } from '@/lib/api'
import type { Task } from '@/lib/types'
import { useKanbanStore } from '@/stores/kanban-store'
import { useIsMobile } from '@/hooks/use-is-mobile'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownFullscreenPreview } from '@/components/markdown-fullscreen-preview'
import { cn } from '@/lib/utils'
import { TimelineTab } from './timeline-tab'
import { FlowTab } from './flow-tab'
import { ArtifactsTab } from './artifacts-tab'
import { GitTab } from './git-tab'
import { StartFlowDialog } from './start-flow-dialog'

interface TaskDetailProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function TaskDetail({ task, open, onOpenChange, onDeleted }: TaskDetailProps) {
  const isMobile = useIsMobile()
  const { updateTask, removeTask } = useKanbanStore()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startFlowOpen, setStartFlowOpen] = useState(false)
  const [flowRefreshKey, setFlowRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('flow')
  const [fullscreenPreview, setFullscreenPreview] = useState<{
    title: string
    content: string
  } | null>(null)

  const handleFullscreen = useCallback((previewTitle: string, previewContent: string) => {
    if (fullscreenPreview && fullscreenPreview.title === previewTitle && fullscreenPreview.content === previewContent) {
      setFullscreenPreview(null)
    } else {
      setFullscreenPreview({ title: previewTitle, content: previewContent })
    }
  }, [fullscreenPreview])

  function startEditing() {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description || '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!task) return
    try {
      await api.put(`tasks/${task.id}`, {
        json: { title, description },
      })
      updateTask(task.id, { title, description })
      setEditing(false)
    } catch (error) {
      console.error('Failed to update task:', error)
      alert('更新任务失败')
    }
  }

  async function handleDelete() {
    if (!task) return
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await api.delete(`tasks/${task.id}`)
      removeTask(task.id)
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert('删除任务失败')
    }
  }

  if (!task) return null

  // Mobile fullscreen layout
  if (isMobile) {
    return (
      <>
        {open && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <MarkdownFullscreenPreview
              open={!!fullscreenPreview}
              onOpenChange={(isOpen) => { if (!isOpen) setFullscreenPreview(null) }}
              title={fullscreenPreview?.title ?? ''}
              content={fullscreenPreview?.content ?? ''}
            />

            {/* Mobile header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-11 w-11 items-center justify-center rounded-sm"
                aria-label="返回"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold truncate flex-1 mx-2">任务详情</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={startEditing}>
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={handleDelete}>
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto">
              {editing ? (
                <div className="p-4 space-y-3">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg font-semibold h-11 text-base"
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="任务描述"
                    rows={3}
                    className="text-base"
                  />
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={saveEdit} className="h-11 text-base">保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="h-11 text-base">取消</Button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-2">{task.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{task.description || '暂无描述'}</p>
                  <Button variant="outline" size="sm" onClick={() => setStartFlowOpen(true)} className="h-11 text-base w-full mb-4">
                    <Play className="mr-2 h-5 w-5" />
                    启动流程
                  </Button>
                </div>
              )}

              {/* Tab content */}
              <div className="px-4 pb-20">
                {activeTab === 'timeline' && <TimelineTab taskId={task.id} />}
                {activeTab === 'flow' && <FlowTab taskId={task.id} refreshKey={flowRefreshKey} onFullscreen={handleFullscreen} />}
                {activeTab === 'artifacts' && <ArtifactsTab taskId={task.id} onFullscreen={handleFullscreen} />}
                {activeTab === 'git' && <GitTab taskId={task.id} gitBranch={task.gitBranch} />}
              </div>
            </div>

            {/* Bottom navigation */}
            <div className="fixed bottom-0 left-0 right-0 flex border-t bg-background" role="tablist" aria-label="任务详情标签页">
              <button
                onClick={() => setActiveTab('timeline')}
                role="tab"
                aria-selected={activeTab === 'timeline'}
                aria-label="时间线"
                className={cn(
                  'flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors',
                  activeTab === 'timeline' ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Clock className="h-5 w-5" />
                <span className="text-xs">时间线</span>
              </button>
              <button
                onClick={() => setActiveTab('flow')}
                role="tab"
                aria-selected={activeTab === 'flow'}
                aria-label="流程"
                className={cn(
                  'flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors',
                  activeTab === 'flow' ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <WorkflowIcon className="h-5 w-5" />
                <span className="text-xs">流程</span>
              </button>
              <button
                onClick={() => setActiveTab('artifacts')}
                role="tab"
                aria-selected={activeTab === 'artifacts'}
                aria-label="产物"
                className={cn(
                  'flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors',
                  activeTab === 'artifacts' ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <FileText className="h-5 w-5" />
                <span className="text-xs">产物</span>
              </button>
              <button
                onClick={() => setActiveTab('git')}
                role="tab"
                aria-selected={activeTab === 'git'}
                aria-label="Git"
                className={cn(
                  'flex-1 h-14 flex flex-col items-center justify-center gap-1 transition-colors',
                  activeTab === 'git' ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <GitBranch className="h-5 w-5" />
                <span className="text-xs">Git</span>
              </button>
            </div>

            <StartFlowDialog
              taskId={task.id}
              projectId={task.projectId}
              open={startFlowOpen}
              onOpenChange={setStartFlowOpen}
              onSuccess={() => setFlowRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </>
    )
  }

  // Desktop layout (original Sheet)
  return (
    <>
      <Sheet modal={false} open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setFullscreenPreview(null)
        onOpenChange(isOpen)
      }}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (
            target?.closest('[data-draggable-dialog-surface="true"]') ||
            target?.closest('[data-draggable-dialog-overlay="true"]')
          ) {
            event.preventDefault()
          }
        }}
      >
        <MarkdownFullscreenPreview
          open={!!fullscreenPreview}
          onOpenChange={(isOpen) => { if (!isOpen) setFullscreenPreview(null) }}
          title={fullscreenPreview?.title ?? ''}
          content={fullscreenPreview?.content ?? ''}
        />
        <SheetHeader>
          {editing ? (
            <div className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="任务描述"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>保存</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <SheetTitle className="text-xl">{task.title}</SheetTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setStartFlowOpen(true)}>
                    <Play className="mr-1 h-4 w-4" />
                    启动流程
                  </Button>
                  <Button variant="ghost" size="icon" onClick={startEditing}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <SheetDescription>{task.description || '暂无描述'}</SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="flow">
            <TabsList className="w-full">
              <TabsTrigger value="timeline" className="flex-1">时间线</TabsTrigger>
              <TabsTrigger value="flow" className="flex-1">流程</TabsTrigger>
              <TabsTrigger value="artifacts" className="flex-1">产物</TabsTrigger>
              <TabsTrigger value="git" className="flex-1">Git</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <TimelineTab taskId={task.id} />
            </TabsContent>
            <TabsContent value="flow">
              <FlowTab taskId={task.id} refreshKey={flowRefreshKey} onFullscreen={handleFullscreen} />
            </TabsContent>
            <TabsContent value="artifacts">
              <ArtifactsTab taskId={task.id} onFullscreen={handleFullscreen} />
            </TabsContent>
            <TabsContent value="git">
              <GitTab taskId={task.id} gitBranch={task.gitBranch} />
            </TabsContent>
          </Tabs>
        </div>

        <StartFlowDialog
          taskId={task.id}
          projectId={task.projectId}
          open={startFlowOpen}
          onOpenChange={setStartFlowOpen}
          onSuccess={() => setFlowRefreshKey((k) => k + 1)}
        />
      </SheetContent>
    </Sheet>
    </>
  )
}
