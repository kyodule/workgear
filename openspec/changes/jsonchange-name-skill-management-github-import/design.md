# Design: Skill Management URL Import — 从 URL 导入 Skill 定义

## 技术方案

### 方案概述

在 Settings → Skills 页面新增「从 URL 导入」功能，用户粘贴文件 URL（如 GitHub raw URL），系统后端 fetch 获取文件内容，解析提取 Skill 元数据，用户预览确认后创建 Skill 记录。整个流程简洁直接，无需 OAuth 授权或仓库浏览。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| URL fetch 位置 | 后端 API Server | 规避前端 CORS 限制，统一处理错误和超时 |
| 导入流程 | 两步：解析预览 → 确认创建 | 让用户确认解析结果再创建，避免误导入 |
| 来源记录 | skills 表新增 source_url 列 | 单字段即可追溯来源，简洁够用 |
| 元数据提取策略 | 优先 YAML frontmatter，其次 Markdown 标题，最后文件名 | 渐进降级，兼容多种文件格式 |
| 同名冲突处理 | 前端检测 + 用户选择 skip/overwrite | 避免误覆盖，给用户控制权 |
| 认证支持 | 不支持，仅公开 URL | 大幅降低复杂度，满足核心需求 |

### 备选方案（已排除）

- **GitHub OAuth + 仓库浏览**：排除原因 — 复杂度高，需要 OAuth 流程、token 加密存储、GitHub API 集成；用户直接粘贴 raw URL 更简单直接。
- **Git clone 仓库**：排除原因 — 需要后端存储仓库文件，增加存储和计算成本；用户通常只需导入单个文件。
- **前端直接 fetch URL**：排除原因 — 受 CORS 限制，大部分跨域 URL 无法直接访问。
- **批量导入多个 URL**：排除原因 — 增加 UI 复杂度，单个导入已满足需求，后续可扩展。

---

## 数据流

### Skill 从 URL 导入流程

```
用户点击「从 URL 导入」按钮
    │
    ▼
打开 SkillImportDialog
    │
    ├── 用户粘贴文件 URL
    │   例：https://raw.githubusercontent.com/owner/repo/main/prompts/code-review.md
    │
    ▼
点击「解析」
    │
    ▼
POST /api/skills/import-from-url
    Body: { url: "https://raw.githubusercontent.com/..." }
    │
    ├── 校验 URL 格式
    │
    ├── 后端 fetch(url)，设置超时 10s
    │   │
    │   ├── 成功 → 获取文件内容
    │   │
    │   ├── 404/超时 → 返回 400 { error: "无法访问该 URL" }
    │   │
    │   └── Content-Type 检测
    │       │
    │       ├── text/* 或 application/octet-stream → 继续解析
    │       │
    │       └── 内容含大量 HTML 标签 → 返回 400 { error: "请使用 raw URL" }
    │
    ├── 文件大小检查（>1MB → 返回 400）
    │
    ├── 解析文件提取元数据（调用 parseSkillFile）
    │   │
    │   ├── 检测 YAML frontmatter（--- 开头）
    │   │   │
    │   │   ├── 有 frontmatter → 解析 name, description
    │   │   │   prompt = frontmatter 之后的内容
    │   │   │
    │   │   └── 无 frontmatter → 检测 Markdown 标题
    │   │       │
    │   │       ├── 有 # 标题 → name = 标题文本
    │   │       │
    │   │       └── 无标题 → name = URL 路径中的文件名
    │   │
    │   ▼
    │   返回 { name, description, prompt, sourceUrl }
    │
    ▼
前端显示预览（name, description, prompt 前 200 字符）
    │
    ├── 用户可编辑 name 和 description
    │
    ├── 前端检查同名 Skill 是否存在
    │   │
    │   ├── 存在 → 显示冲突提示，用户选择 skip 或 overwrite
    │   │
    │   └── 不存在 → 直接创建
    │
    ▼
用户点击「确认导入」
    │
    ▼
POST /api/skills
    Body: { name, description, prompt, sourceUrl, conflictStrategy? }
    │
    ├── conflictStrategy = "skip" → 返回 { skipped: true }
    │
    ├── conflictStrategy = "overwrite" → UPDATE skills SET ...
    │
    └── 无冲突 → INSERT INTO skills (...)
    │
    ▼
导入成功 → 关闭对话框 → 刷新 Skills 列表
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/api/src/db/schema.ts` | MODIFY | skills 表新增 source_url 列 |
| `packages/api/src/routes/skills.ts` | MODIFY | 新增 POST /api/skills/import-from-url 接口；扩展 POST /api/skills 支持 sourceUrl 和 conflictStrategy |
| `packages/web/src/pages/settings/skills.tsx` | MODIFY | 新增「从 URL 导入」按钮，集成 SkillImportDialog |
| `packages/web/src/lib/types.ts` | MODIFY | Skill 接口新增 sourceUrl 字段 |

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `packages/api/src/lib/skill-file-parser.ts` | Skill 文件解析逻辑（YAML frontmatter、Markdown 标题提取） |
| `packages/web/src/components/skill-import-dialog.tsx` | URL 导入对话框组件 |
| `packages/api/drizzle/migrations/XXXX_add_skill_source_url.sql` | Migration: 添加 skills 表 source_url 列 |

### 删除文件

无

---

## 具体代码变更

### 1. `packages/api/src/db/schema.ts`

skills 表新增列：

```typescript
export const skills = pgTable('skills', {
  // ... 现有列 ...
  sourceUrl: varchar('source_url', { length: 1000 }),
})
```

### 2. `packages/api/src/lib/skill-file-parser.ts`

```typescript
import yaml from 'yaml'

interface SkillMetadata {
  name: string
  description: string | null
  prompt: string
}

export function parseSkillFile(content: string, url: string): SkillMetadata {
  // 检测 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)

  if (frontmatterMatch) {
    const frontmatter = yaml.parse(frontmatterMatch[1])
    return {
      name: frontmatter.name || extractNameFromUrl(url),
      description: frontmatter.description || null,
      prompt: frontmatterMatch[2].trim(),
    }
  }

  // 降级：从 Markdown 标题提取
  const lines = content.split('\n')
  const titleMatch = lines[0]?.match(/^#\s+(.+)$/)
  const descMatch = lines[1]?.match(/<!--\s*Description:\s*(.+?)\s*-->/)

  return {
    name: titleMatch?.[1] || extractNameFromUrl(url),
    description: descMatch?.[1] || null,
    prompt: lines.slice(titleMatch ? 1 : 0).join('\n').trim(),
  }
}

function extractNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const fileName = pathname.split('/').pop() || 'Untitled'
    return fileName.replace(/\.(md|txt|yaml|yml)$/, '').replace(/[-_]/g, ' ')
  } catch {
    return 'Untitled'
  }
}
```

### 3. `packages/api/src/routes/skills.ts`

新增解析接口：

```typescript
app.post('/api/skills/import-from-url', async (req, res) => {
  const { url } = req.body

  // 校验 URL 格式
  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: '无效的 URL 格式' })
  }

  // 后端 fetch 文件内容
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.status(400).json({ error: `无法访问该 URL（HTTP ${response.status}）` })
    }

    const content = await response.text()

    // 文件大小检查
    if (content.length > 1024 * 1024) {
      return res.status(400).json({ error: '文件大小超过 1MB 限制' })
    }

    // 检测是否为 HTML 页面
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      return res.status(400).json({ error: '该 URL 返回的是 HTML 页面，请使用文件的 raw URL' })
    }

    // 解析文件
    const metadata = parseSkillFile(content, url)

    res.json({
      name: metadata.name,
      description: metadata.description,
      prompt: metadata.prompt,
      sourceUrl: url,
    })
  } catch (error) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      return res.status(400).json({ error: 'URL 请求超时（10s）' })
    }
    return res.status(400).json({ error: `无法访问该 URL: ${error.message}` })
  }
})
```

### 4. `packages/web/src/components/skill-import-dialog.tsx`

```tsx
export function SkillImportDialog({ open, onOpenChange, onImported }: Props) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<SkillPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParse = async () => {
    setLoading(true)
    setError(null)

    const response = await fetch('/api/skills/import-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error)
      return
    }

    setPreview(data)
  }

  const handleConfirm = async () => {
    // 调用 POST /api/skills 创建 Skill
    const response = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: preview.name,
        description: preview.description,
        prompt: preview.prompt,
        sourceUrl: preview.sourceUrl,
      }),
    })

    if (response.ok) {
      onImported()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!preview ? (
        <StepInputUrl url={url} onChange={setUrl} onParse={handleParse} loading={loading} error={error} />
      ) : (
        <StepPreview preview={preview} onConfirm={handleConfirm} onBack={() => setPreview(null)} />
      )}
    </Dialog>
  )
}
```

---

## Migration SQL

### 添加 skills 表 source_url 列

```sql
ALTER TABLE skills ADD COLUMN source_url varchar(1000);
```

---

## 测试策略

- 手动验证：粘贴 GitHub raw URL → 成功解析并导入
- 手动验证：粘贴普通 HTTPS 文件 URL → 成功解析并导入
- 手动验证：粘贴 GitHub 非 raw URL（HTML 页面）→ 提示使用 raw URL
- 手动验证：粘贴不存在的 URL → 提示无法访问
- 手动验证：同名 Skill + skip → 跳过不覆盖
- 手动验证：同名 Skill + overwrite → 更新 prompt 和 sourceUrl
- 手动验证：YAML frontmatter 文件 → 正确提取 name 和 description
- 手动验证：Markdown 文件 → 从标题提取 name
- 手动验证：纯文本文件 → 从 URL 文件名提取 name
- 手动验证：大文件（>1MB）→ 提示错误，不导入
- 手动验证：导入后的 Skill 在列表中显示来源链接
- 手动验证：点击来源链接 → 在新标签页打开原始文件
