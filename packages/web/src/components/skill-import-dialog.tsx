import { useState } from 'react'
import { api } from '@/lib/api'
import type { Skill } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'

interface SkillImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
  existingSkills: Skill[]
}

interface SkillPreview {
  name: string
  description: string | null
  prompt: string
  sourceUrl: string
}

export function SkillImportDialog({ open, onOpenChange, onImported, existingSkills }: SkillImportDialogProps) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<SkillPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite'>('skip')

  const hasConflict = preview && existingSkills.some(s => s.name === preview.name)

  const handleParse = async () => {
    if (!url.trim()) {
      setError('请输入 URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.post('skills/import-from-url', {
        json: { url },
      }).json<SkillPreview>()

      setPreview(response)
    } catch (err: any) {
      setError(err.response?.data?.error || '解析失败，请检查 URL 是否正确')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return

    setImporting(true)
    setError(null)

    try {
      await api.post('skills', {
        json: {
          name: preview.name,
          description: preview.description,
          prompt: preview.prompt,
          sourceUrl: preview.sourceUrl,
          conflictStrategy: hasConflict ? conflictStrategy : undefined,
        },
      })

      onOpenChange(false)
      onImported?.()

      // Reset state
      setUrl('')
      setPreview(null)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const handleBack = () => {
    setPreview(null)
    setError(null)
  }

  const handleClose = () => {
    onOpenChange(false)
    setUrl('')
    setPreview(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>从 URL 导入 Skill</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">文件 URL</Label>
              <Input
                id="url"
                placeholder="https://raw.githubusercontent.com/owner/repo/main/prompt.md"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleParse()}
              />
              <p className="text-sm text-gray-500">
                支持 GitHub raw URL 或任意公开可访问的文件 URL
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleParse} disabled={loading || !url.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                解析
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={preview.name}
                onChange={(e) => setPreview({ ...preview, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={preview.description || ''}
                onChange={(e) => setPreview({ ...preview, description: e.target.value || null })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt 预览</Label>
              <Textarea
                id="prompt"
                value={preview.prompt.slice(0, 500) + (preview.prompt.length > 500 ? '...' : '')}
                readOnly
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-sm text-gray-500">
                完整内容共 {preview.prompt.length} 字符
              </p>
            </div>

            <div className="space-y-2">
              <Label>来源 URL</Label>
              <p className="text-sm text-gray-600 break-all">{preview.sourceUrl}</p>
            </div>

            {hasConflict && (
              <div className="space-y-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex items-start gap-2 text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>已存在同名 Skill，请选择处理方式：</span>
                </div>
                <div className="flex gap-2 ml-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict"
                      value="skip"
                      checked={conflictStrategy === 'skip'}
                      onChange={() => setConflictStrategy('skip')}
                    />
                    <span className="text-sm">跳过（保留现有）</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict"
                      value="overwrite"
                      checked={conflictStrategy === 'overwrite'}
                      onChange={() => setConflictStrategy('overwrite')}
                    />
                    <span className="text-sm">覆盖（更新现有）</span>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleBack} disabled={importing}>
                返回
              </Button>
              <Button onClick={handleConfirm} disabled={importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                确认导入
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
