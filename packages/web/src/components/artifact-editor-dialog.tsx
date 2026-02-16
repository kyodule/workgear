import { useState } from 'react'
import { api } from '@/lib/api'
import type { Artifact } from '@/lib/types'
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface ArtifactEditorDialogProps {
  artifact: Artifact | null
  initialContent: string
  currentVersion: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

const typeLabels: Record<string, string> = {
  requirement: '需求',
  prd: 'PRD',
  user_story: 'User Story',
  code: '代码',
  proposal: 'Proposal',
  design: 'Design',
  tasks: 'Tasks',
  spec: 'Spec',
}

export function ArtifactEditorDialog({
  artifact,
  initialContent,
  currentVersion,
  open,
  onOpenChange,
  onSaved,
}: ArtifactEditorDialogProps) {
  const [content, setContent] = useState(initialContent)
  const [changeSummary, setChangeSummary] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset state when dialog opens with new content
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      setContent(initialContent)
      setChangeSummary('')
    }
    onOpenChange(isOpen)
  }

  async function handleSave() {
    if (!artifact || !content.trim()) return

    setSaving(true)
    try {
      await api.post(`artifacts/${artifact.id}/versions`, {
        json: {
          content,
          changeSummary: changeSummary || undefined,
        },
      })
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      console.error('Failed to save artifact version:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!artifact) return null

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={handleOpenChange}
      defaultWidth={768}
      defaultHeight={560}
      minWidth={480}
      minHeight={400}
      title={
        <span className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {typeLabels[artifact.type] || artifact.type}
          </Badge>
          <span>{artifact.title}</span>
          <span className="text-sm text-muted-foreground font-normal">
            v{currentVersion} → v{currentVersion + 1}
          </span>
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存新版本
          </Button>
        </>
      }
    >
      <div className="space-y-3 h-full flex flex-col">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[200px] font-mono text-sm resize-y"
          placeholder="输入产物内容..."
        />
        <Input
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="变更说明（可选）"
          className="text-sm"
        />
      </div>
    </DraggableResizableDialog>
  )
}
