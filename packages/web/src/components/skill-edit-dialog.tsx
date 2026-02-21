import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Skill } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'

interface SkillEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill: Skill | null
  onUpdated?: () => void
}

export function SkillEditDialog({ open, onOpenChange, skill, onUpdated }: SkillEditDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (skill && open) {
      setName(skill.name)
      setDescription(skill.description || '')
      setPrompt(skill.prompt)
      setError(null)
    }
  }, [skill, open])

  const handleSave = async () => {
    if (!skill) return

    if (!name.trim()) {
      setError('Skill 名称不能为空')
      return
    }

    if (!prompt.trim()) {
      setError('Prompt 内容不能为空')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await api.put(`skills/${skill.id}`, {
        json: {
          name: name.trim(),
          description: description.trim() || null,
          prompt: prompt.trim(),
        },
      })

      onOpenChange(false)
      onUpdated?.()
    } catch (err: any) {
      setError(err?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑 Skill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">名称 *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="请输入 Skill 名称"
            />
            <p className="text-xs text-gray-500">
              {name.length}/200 字符
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">描述（可选）</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入 Skill 描述"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Prompt 内容 *</Label>
            <Textarea
              id="edit-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="请输入 Prompt 内容"
            />
            <p className="text-xs text-gray-500">
              共 {prompt.split('\n').length} 行，{prompt.length} 字符
            </p>
          </div>

          {skill?.sourceUrl && (
            <div className="space-y-2">
              <Label>来源 URL</Label>
              <p className="text-sm text-gray-600 break-all">{skill.sourceUrl}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || !prompt.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
