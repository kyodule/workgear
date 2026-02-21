import { useState } from 'react'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'

interface SkillCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

export function SkillCreateDialog({ open, onOpenChange, onCreated }: SkillCreateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Skill 名称不能为空')
      return
    }

    if (!prompt.trim()) {
      setError('Prompt 内容不能为空')
      return
    }

    setCreating(true)
    setError(null)

    try {
      await api.post('skills', {
        json: {
          name: name.trim(),
          description: description.trim() || null,
          prompt: prompt.trim(),
        },
      })

      onOpenChange(false)
      onCreated?.()

      // Reset form
      setName('')
      setDescription('')
      setPrompt('')
      setError(null)
    } catch (err: any) {
      setError(err?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setName('')
    setDescription('')
    setPrompt('')
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建 Skill</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="请输入 Skill 名称"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              {name.length}/200 字符
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述（可选）</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入 Skill 描述"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt 内容 *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="请输入 Prompt 内容，支持 Markdown 格式"
            />
            <p className="text-xs text-gray-500">
              共 {prompt.split('\n').length} 行，{prompt.length} 字符
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={creating}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !prompt.trim()}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
