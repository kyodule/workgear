import { useState } from 'react'
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

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface CreateProjectForm {
  name: string
  description?: string
  gitRepoUrl?: string
  gitProviderType: GitProviderType
  gitBaseUrl?: string
  gitAccessToken?: string
  gitUsername?: string
  gitPassword?: string
  autoMergePr: boolean
  gitMergeMethod: GitMergeMethod
  visibility: 'private' | 'public'
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess }: CreateProjectDialogProps) {
  const { addProject } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateProjectForm>({
    defaultValues: { visibility: 'private', autoMergePr: false, gitMergeMethod: 'merge', gitProviderType: 'github' }
  })

  const visibility = watch('visibility')
  const autoMergePr = watch('autoMergePr')
  const gitMergeMethod = watch('gitMergeMethod')
  const gitProviderType = watch('gitProviderType')

  // Auto-detect provider type from repo URL
  function handleRepoUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value.toLowerCase()
    if (url.includes('github.com')) {
      setValue('gitProviderType', 'github')
    } else if (url.includes('gitlab.com') || url.includes('gitlab')) {
      setValue('gitProviderType', 'gitlab')
    } else if (url.length > 10) {
      setValue('gitProviderType', 'generic')
    }
  }

  async function onSubmit(data: CreateProjectForm) {
    setLoading(true)
    try {
      const project = await api.post('projects', { json: data }).json<Project>()
      addProject(project)
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('创建项目失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableResizableDialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建项目"
      defaultWidth={600}
      defaultHeight={520}
      minWidth={480}
      minHeight={400}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" form="create-project-form" disabled={loading}>
            {loading ? '创建中...' : '创建'}
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">项目名称 *</Label>
          <Input
            id="name"
            placeholder="我的项目"
            {...register('name', { required: '项目名称不能为空' })}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="项目描述（可选）"
            {...register('description')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="visibility">可见性</Label>
          <Select value={visibility} onValueChange={(v) => setValue('visibility', v as 'private' | 'public')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">私有 — 仅成员可见</SelectItem>
              <SelectItem value="public">公开 — 所有人可查看</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gitRepoUrl">Git 仓库地址</Label>
          <Input
            id="gitRepoUrl"
            placeholder="https://github.com/user/repo.git"
            {...register('gitRepoUrl', { onChange: handleRepoUrlChange })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gitProviderType">Git 平台</Label>
          <Select value={gitProviderType} onValueChange={(v) => setValue('gitProviderType', v as GitProviderType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="github">GitHub</SelectItem>
              <SelectItem value="gitlab">GitLab</SelectItem>
              <SelectItem value="generic">通用 Git（用户名/密码）</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            根据仓库地址自动检测，也可手动选择
          </p>
        </div>
        {gitProviderType === 'gitlab' && (
          <div className="space-y-2">
            <Label htmlFor="gitBaseUrl">GitLab 地址</Label>
            <Input
              id="gitBaseUrl"
              placeholder="https://gitlab.com（自托管请填写实际地址）"
              {...register('gitBaseUrl')}
            />
          </div>
        )}
        {gitProviderType !== 'generic' ? (
          <div className="space-y-2">
            <Label htmlFor="gitAccessToken">Git Access Token</Label>
            <Input
              id="gitAccessToken"
              type="password"
              placeholder={gitProviderType === 'github' ? 'ghp_xxxx' : 'glpat-xxxx'}
              {...register('gitAccessToken')}
            />
            <p className="text-xs text-muted-foreground">
              用于 Agent 自动提交代码和创建 PR/MR，需要仓库写权限
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="gitUsername">Git 用户名</Label>
              <Input
                id="gitUsername"
                placeholder="用户名"
                {...register('gitUsername')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gitPassword">Git 密码</Label>
              <Input
                id="gitPassword"
                type="password"
                placeholder="密码或 Personal Access Token"
                {...register('gitPassword')}
              />
              <p className="text-xs text-muted-foreground">
                通用 Git 不支持自动创建 PR，仅支持 clone 和 push
              </p>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="autoMergePr">自动合并 PR</Label>
            <p className="text-xs text-muted-foreground">
              流程完成后自动合并 PR 到目标分支
            </p>
          </div>
          <Switch
            id="autoMergePr"
            checked={autoMergePr}
            onCheckedChange={(checked) => setValue('autoMergePr', checked)}
          />
        </div>
        {autoMergePr && (
          <div className="space-y-2">
            <Label htmlFor="gitMergeMethod">合并方式</Label>
            <Select value={gitMergeMethod} onValueChange={(v) => setValue('gitMergeMethod', v as GitMergeMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
