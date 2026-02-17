import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '@/lib/api'
import type { Project, GitMergeMethod, GitProviderType } from '@/lib/types'
import { useProjectStore } from '@/stores/project-store'
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onSuccess?: () => void
}

interface EditProjectForm {
  name: string
  description: string
  gitRepoUrl: string
  gitBaseUrl: string
  gitAccessToken: string
  gitUsername: string
  gitPassword: string
}

function parseVisibility(value: string | null | undefined): 'private' | 'public' | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'public') return 'public'
  if (normalized === 'private') return 'private'
  return null
}

function normalizeVisibility(value: string | null | undefined): 'private' | 'public' {
  return parseVisibility(value) ?? 'private'
}

function parseGitProviderType(value: string | null | undefined): GitProviderType | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'gitlab') return 'gitlab'
  if (normalized === 'generic') return 'generic'
  if (normalized === 'github') return 'github'
  return null
}

function normalizeGitProviderType(value: string | null | undefined): GitProviderType {
  return parseGitProviderType(value) ?? 'github'
}

function parseGitMergeMethod(value: string | null | undefined): GitMergeMethod | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'squash') return 'squash'
  if (normalized === 'rebase') return 'rebase'
  if (normalized === 'merge') return 'merge'
  return null
}

function normalizeGitMergeMethod(value: string | null | undefined): GitMergeMethod {
  return parseGitMergeMethod(value) ?? 'merge'
}

export function EditProjectDialog({ open, onOpenChange, project, onSuccess }: EditProjectDialogProps) {
  const { updateProject } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [gitProviderType, setGitProviderType] = useState<GitProviderType>('github')
  const [autoMergePr, setAutoMergePr] = useState(false)
  const [gitMergeMethod, setGitMergeMethod] = useState<GitMergeMethod>('merge')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditProjectForm>({
    defaultValues: {
      name: '',
      description: '',
      gitRepoUrl: '',
      gitBaseUrl: '',
      gitAccessToken: '',
      gitUsername: '',
      gitPassword: '',
    },
  })
  // Auto-detect provider type from repo URL
  function handleRepoUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value.toLowerCase()
    if (url.includes('github.com')) {
      setGitProviderType('github')
    } else if (url.includes('gitlab.com') || url.includes('gitlab')) {
      setGitProviderType('gitlab')
    } else if (url.length > 10) {
      setGitProviderType('generic')
    }
  }

  useEffect(() => {
    if (!open) return

    const normalizedVisibility = normalizeVisibility(project.visibility)
    const normalizedGitProviderType = normalizeGitProviderType(project.gitProviderType)
    const normalizedGitMergeMethod = normalizeGitMergeMethod(project.gitMergeMethod)

    reset({
      name: project.name,
      description: project.description || '',
      gitRepoUrl: project.gitRepoUrl || '',
      gitBaseUrl: project.gitBaseUrl || '',
      gitAccessToken: '',
      gitUsername: '',
      gitPassword: '',
    })
    setVisibility(normalizedVisibility)
    setGitProviderType(normalizedGitProviderType)
    setAutoMergePr(project.autoMergePr ?? false)
    setGitMergeMethod(normalizedGitMergeMethod)
  }, [open, project.id])

  async function onSubmit(data: EditProjectForm) {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || null,
        gitRepoUrl: data.gitRepoUrl || null,
        gitProviderType: normalizeGitProviderType(gitProviderType),
        gitBaseUrl: data.gitBaseUrl || null,
        autoMergePr,
        gitMergeMethod: normalizeGitMergeMethod(gitMergeMethod),
        visibility: normalizeVisibility(visibility),
      }
      // 只在用户实际输入了新值时才提交敏感字段
      if (data.gitAccessToken) {
        payload.gitAccessToken = data.gitAccessToken
      }
      if (data.gitUsername) {
        payload.gitUsername = data.gitUsername
      }
      if (data.gitPassword) {
        payload.gitPassword = data.gitPassword
      }

      const updated = await api.put(`projects/${project.id}`, { json: payload }).json<Project>()
      updateProject(project.id, updated)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to update project:', error)
      alert('更新项目失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={onOpenChange}
      title="编辑项目"
      defaultWidth={600}
      defaultHeight={520}
      minWidth={480}
      minHeight={400}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" form="edit-project-form" disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </>
      }
    >
      <form id="edit-project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">项目名称 *</Label>
          <Input
            id="edit-name"
            placeholder="我的项目"
            {...register('name', { required: '项目名称不能为空' })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-description">描述</Label>
          <Textarea
            id="edit-description"
            placeholder="项目描述（可选）"
            {...register('description')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-visibility">可见性</Label>
          <Select
            value={visibility}
            onValueChange={(v) => {
              const next = parseVisibility(v)
              if (!next) {
                return
              }
              setVisibility(next)
            }}
          >
            <SelectTrigger id="edit-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent withPortal={false}>
              <SelectItem value="private">私有 — 仅成员可见</SelectItem>
              <SelectItem value="public">公开 — 所有人可查看</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-gitRepoUrl">Git 仓库地址</Label>
          <Input
            id="edit-gitRepoUrl"
            placeholder="https://github.com/user/repo.git"
            {...register('gitRepoUrl', { onChange: handleRepoUrlChange })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-gitProviderType">Git 平台</Label>
          <Select
            value={gitProviderType}
            onValueChange={(v) => {
              const next = parseGitProviderType(v)
              if (!next) {
                return
              }
              setGitProviderType(next)
            }}
          >
            <SelectTrigger id="edit-gitProviderType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent withPortal={false}>
              <SelectItem value="github">GitHub</SelectItem>
              <SelectItem value="gitlab">GitLab</SelectItem>
              <SelectItem value="generic">通用 Git（用户名/密码）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {gitProviderType === 'gitlab' && (
          <div className="space-y-2">
            <Label htmlFor="edit-gitBaseUrl">GitLab 地址</Label>
            <Input
              id="edit-gitBaseUrl"
              placeholder="https://gitlab.com（自托管请填写实际地址）"
              {...register('gitBaseUrl')}
            />
          </div>
        )}
        {gitProviderType !== 'generic' ? (
          <div className="space-y-2">
            <Label htmlFor="edit-gitAccessToken">Git Access Token</Label>
            <Input
              id="edit-gitAccessToken"
              type="password"
              placeholder="留空则不修改"
              {...register('gitAccessToken')}
            />
            {project.gitAccessToken && (
              <p className="text-xs text-muted-foreground">
                当前 Token：{project.gitAccessToken}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="edit-gitUsername">Git 用户名</Label>
              <Input
                id="edit-gitUsername"
                placeholder="留空则不修改"
                {...register('gitUsername')}
              />
              {project.gitUsername && (
                <p className="text-xs text-muted-foreground">
                  当前用户名：{project.gitUsername}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gitPassword">Git 密码</Label>
              <Input
                id="edit-gitPassword"
                type="password"
                placeholder="留空则不修改"
                {...register('gitPassword')}
              />
              {project.gitPassword && (
                <p className="text-xs text-muted-foreground">
                  当前密码：{project.gitPassword}
                </p>
              )}
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="edit-autoMergePr">自动合并 PR</Label>
            <p className="text-xs text-muted-foreground">
              流程完成后自动合并 PR 到目标分支
            </p>
          </div>
          <Switch
            id="edit-autoMergePr"
            checked={autoMergePr}
            onCheckedChange={setAutoMergePr}
          />
        </div>
        {autoMergePr && (
          <div className="space-y-2">
            <Label htmlFor="edit-gitMergeMethod">合并方式</Label>
            <Select
              value={gitMergeMethod}
              onValueChange={(v) => {
                const next = parseGitMergeMethod(v)
                if (!next) {
                  return
                }
                setGitMergeMethod(next)
              }}
            >
              <SelectTrigger id="edit-gitMergeMethod">
                <SelectValue />
              </SelectTrigger>
              <SelectContent withPortal={false}>
                <SelectItem value="merge">Merge — 创建合并提交（推荐）</SelectItem>
                <SelectItem value="squash">Squash — 压缩为单个提交</SelectItem>
                <SelectItem value="rebase">Rebase — 线性合并</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form>
    </DraggableResizableDialog>
  )
}
