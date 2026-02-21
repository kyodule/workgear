import { useState, useEffect } from 'react'
import { FileText, Trash2, ExternalLink, Download } from 'lucide-react'
import { api } from '@/lib/api'
import type { Skill } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkillImportDialog } from '@/components/skill-import-dialog'

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportDialog, setShowImportDialog] = useState(false)

  useEffect(() => {
    loadSkills()
  }, [])

  async function loadSkills() {
    setLoading(true)
    try {
      const data = await api.get('skills').json<Skill[]>()
      setSkills(data)
    } catch (error) {
      console.error('Failed to load skills:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(skill: Skill) {
    if (!confirm(`确定要删除 Skill "${skill.name}" 吗？\n\n此操作不可恢复。`)) return
    try {
      await api.delete(`skills/${skill.id}`)
      await loadSkills()
    } catch (error: any) {
      console.error('Failed to delete skill:', error)
      const errorMessage = error?.response?.json?.error || error?.message || '删除失败'
      alert(`删除失败：${errorMessage}`)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Skills 管理</h1>
          <span className="text-sm text-muted-foreground">
            管理可复用的 Prompt 定义
          </span>
        </div>
        <Button size="sm" onClick={() => setShowImportDialog(true)}>
          <Download className="mr-1 h-4 w-4" />
          从 URL 导入
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">暂无 Skills</p>
            <p className="text-sm text-gray-400 mb-4 max-w-md">
              Skills 是可复用的 Prompt 定义，可以从 GitHub 或其他 URL 导入
            </p>
            <Button size="sm" onClick={() => setShowImportDialog(true)}>
              <Download className="mr-1 h-4 w-4" />
              从 URL 导入第一个 Skill
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onDelete={() => handleDelete(skill)}
              />
            ))}
          </div>
        )}
      </div>

      <SkillImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={loadSkills}
        existingSkills={skills}
      />
    </div>
  )
}

interface SkillCardProps {
  skill: Skill
  onDelete: () => void
}

function SkillCard({ skill, onDelete }: SkillCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{skill.name}</h3>
            {skill.sourceUrl && (
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
                title="查看来源文件"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {skill.description && (
            <p className="text-sm text-gray-600 mb-2">{skill.description}</p>
          )}

          {skill.sourceUrl && (
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                从 URL 导入
              </Badge>
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 truncate max-w-md hover:underline"
                title={skill.sourceUrl}
              >
                {skill.sourceUrl}
              </a>
            </div>
          )}

          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expanded ? '收起' : '查看'} Prompt
            </button>
          </div>

          {expanded && (
            <div className="mt-3 p-3 bg-gray-50 rounded border">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {skill.prompt}
              </pre>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-400">
            创建于 {new Date(skill.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
