import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { AgentRole, AgentPoolItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AgentPoolParamEditorProps {
  value: AgentPoolItem[]
  onChange: (value: AgentPoolItem[]) => void
}

export function AgentPoolParamEditor({ value, onChange }: AgentPoolParamEditorProps) {
  const [roles, setRoles] = useState<AgentRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('agent-roles').json<AgentRole[]>()
      .then(setRoles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleAdd() {
    onChange([...value, { role: '', description: '' }])
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function handleRoleChange(index: number, roleSlug: string) {
    const updated = [...value]
    const matchedRole = roles.find((r) => r.slug === roleSlug)
    updated[index] = {
      role: roleSlug,
      description: matchedRole?.description || updated[index].description,
    }
    onChange(updated)
  }

  function handleDescriptionChange(index: number, description: string) {
    const updated = [...value]
    updated[index] = { ...updated[index], description }
    onChange(updated)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载角色列表...</div>
  }

  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div key={index} className="flex items-start gap-2 rounded-md border p-3">
          <div className="flex-1 space-y-2">
            <div>
              <Label className="text-xs">角色</Label>
              <Select
                value={item.role || undefined}
                onValueChange={(v) => handleRoleChange(index, v)}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.slug} value={r.slug}>
                      {r.name} ({r.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">描述（供调度器参考）</Label>
              <Input
                value={item.description}
                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                placeholder="描述该角色的能力和适用场景"
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mt-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
        <Plus className="mr-1 h-4 w-4" />
        添加 Agent
      </Button>
    </div>
  )
}
