# Design: Skill Management GitHub Import — 从 GitHub 仓库导入 Skill 定义

## 技术方案

### 方案概述

在 Settings → Skills 页面新增「从 GitHub 导入」功能，用户输入 GitHub 仓库 URL 后，系统调用 GitHub API 获取仓库文件树，用户选择要导入的 Prompt 文件，系统解析文件内容提取 Skill 元数据，批量创建 Skill 记录并保存导入来源信息。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| GitHub API 调用位置 | 后端 API Server | 避免暴露 GitHub token 到前端，统一处理 rate limit 和错误 |
| Access token 存储 | users 表 github_access_token 列（加密） | 与用户账号绑定，支持 private 仓库访问 |
| 文件解析逻辑 | 后端独立模块 github-skill-importer.ts | 解耦业务逻辑，便于单元测试和扩展新格式 |
| 元数据提取策略 | 优先 YAML frontmatter，其次 Markdown 标题 | YAML frontmatter 是标准格式，Markdown 标题作为降级方案 |
| 同名冲突处理 | 用户选择 skip 或 overwrite | 避免误覆盖，给用户控制权 |
| 导入来源记录 | skills 表新增 source_* 列 | 便于追溯来源，支持未来的重新导入功能 |
| Public 仓库访问 | 无需授权，使用未认证请求 | 降低使用门槛，rate limit 60 次/小时通常足够 |
| Private 仓库访问 | GitHub OAuth 授权，scope=repo | 标准 OAuth 流程，安全可靠 |

### 备选方案（已排除）

- **前端直接调用 GitHub API**：排除原因 — 需要暴露 token 到前端，安全风险高；无法统一处理 rate limit。
- **使用 GitHub App 而非 OAuth**：排除原因 — GitHub App 需要用户安装到仓库，流程复杂；OAuth 更轻量。
- **支持 Git clone 整个仓库**：排除原因 — 需要后端存储仓库文件，增加存储成本；用户通常只需要导入部分文件。
- **实现双向同步**：排除原因 — 复杂度高，需要处理冲突合并；用户需求不明确。

---

## 数据流

### GitHub OAuth 授权流程

```
用户点击「授权 GitHub」
    │
    ▼
GET /auth/github/authorize
    │
    ├── 重定向到 GitHub OAuth 页面
    │   URL: https://github.com/login/oauth/authorize
    │   参数: client_id, redirect_uri, scope=repo
    │
    ▼
用户同意授权
    │
    ▼
GitHub 重定向到 /auth/github/callback?code={code}
    │
    ├── POST https://github.com/login/oauth/access_token
    │   Body: { client_id, client_secret, code }
    │   │
    │   ▼
    │   Response: { access_token, scope, token_type }
    │
    ├── 验证 token：GET https://api.github.com/user
    │   Header: Authorization: Bearer {access_token}
    │
    ├── UPDATE users SET github_access_token = encrypt(access_token)
    │   WHERE id = currentUserId
    │
    ▼
重定向到 /settings/skills?github_authorized=true
```

### GitHub 文件列表获取流程

```
用户输入仓库 URL（如 https://github.com/owner/repo）
    │
    ▼
POST /api/skills/github-files
    Body: { repoUrl, ref: "main" }
    │
    ├── 解析 repoUrl → owner, repo
    │
    ├── 查询 users.github_access_token
    │   │
    │   ├── token 存在 → 使用认证请求（5000 次/小时）
    │   └── token 不存在 → 使用未认证请求（60 次/小时）
    │
    ├── GET https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}?recursive=1
    │   Header: Authorization: Bearer {access_token}（如果有）
    │   │
    │   ▼
    │   Response: { tree: [{ path, type, size, sha }] }
    │
    ├── 筛选文件：type === "blob" && (path.endsWith(".md") || path.endsWith(".txt") || path.endsWith(".yaml"))
    │
    ├── 过滤大文件：size <= 1MB
    │
    ▼
返回 { files: [{ path, name, size, sha }] }
```

### Skill 导入流程

```
用户勾选文件 → 点击「导入」
    │
    ▼
POST /api/skills/import-from-github
    Body: {
      repoUrl: "https://github.com/owner/repo",
      filePaths: ["prompts/code-review.md", "prompts/test-gen.yaml"],
      conflictStrategy: "skip",
      ref: "main"
    }
    │
    ├── 查询 users.github_access_token
    │
    ├── 并行获取文件内容（Promise.all）
    │   │
    │   ├── GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}
    │   │   Header: Authorization: Bearer {access_token}
    │   │   │
    │   │   ▼
    │   │   Response: { content: base64_encoded_content, sha }
    │   │
    │   ├── Base64 解码 → 文件原始内容
    │   │
    │   ▼
    │   解析文件提取元数据（调用 parseSkillFile）
    │       │
    │       ├── 检测 YAML frontmatter（--- 开头）
    │       │   │
    │       │   ├── 有 frontmatter → 解析 name, description
    │       │   │   prompt = frontmatter 之后的内容
    │       │   │
    │       │   └── 无 frontmatter → 从 Markdown 标题提取
    │       │       name = 首行 # 标题
    │       │       description = 首行 <!-- Description: ... --> 注释
    │       │       prompt = 去除标题和注释后的内容
    │       │
    │       ▼
    │       返回 { name, description, prompt, sourceFilePath }
    │
    ├── 检查同名 Skill（SELECT * FROM skills WHERE name = ?)
    │   │
    │   ├── 存在 + conflictStrategy = "skip" → 跳过，记录到 skipped
    │   │
    │   ├── 存在 + conflictStrategy = "overwrite" → 更新
    │   │   UPDATE skills SET
    │   │     prompt = ?,
    │   │     description = ?,
    │   │     source_repo_url = ?,
    │   │     source_commit_sha = ?,
    │   │     source_file_path = ?,
    │   │     updated_at = NOW()
    │   │   WHERE name = ?
    │   │
    │   └── 不存在 → 创建
    │       INSERT INTO skills (
    │         id, name, description, prompt,
    │         source_repo_url, source_commit_sha, source_file_path,
    │         created_at, updated_at
    │       ) VALUES (...)
    │
    ▼
返回 { imported: 2, skipped: 0, errors: [] }
```

### 前端导入对话框交互流程

```
用户点击「从 GitHub 导入」按钮
    │
    ▼
打开 SkillImportDialog
    │
    ├── 步骤 1：输入仓库 URL
    │   │
    │   ├── 用户输入 https://github.com/owner/repo
    │   ├── 用户选择 branch/tag（默认 main）
    │   │
    │   ▼
    │   点击「下一步」
    │
    ├── 步骤 2：选择文件
    │   │
    │   ├── 调用 POST /api/skills/github-files
    │   │   │
    │   │   ├── 成功 → 显示文件列表（带复选框）
    │   │   │
    │   │   └── 失败（404/403）→ 提示「仓库不存在或需要授权」
    │   │       显示「授权 GitHub」按钮
    │   │
    │   ├── 用户勾选文件
    │   │
    │   ▼
    │   点击「下一步」
    │
    ├── 步骤 3：预览和配置
    │   │
    │   ├── 显示每个文件的预览（name, description, prompt 前 200 字符）
    │   ├── 用户选择冲突策略（skip / overwrite）
    │   │
    │   ▼
    │   点击「导入」
    │
    ├── 步骤 4：导入中
    │   │
    │   ├── 调用 POST /api/skills/import-from-github
    │   ├── 显示进度条（已导入 / 总数）
    │   │
    │   ▼
    │   导入完成
    │
    └── 步骤 5：结果展示
        │
        ├── 显示「成功导入 3 个 Skill」
        ├── 显示「跳过 1 个 Skill（已存在）」
        ├── 显示错误列表（如果有）
        │
        ▼
        点击「完成」→ 关闭对话框 → 刷新 Skills 列表
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/api/src/db/schema.ts` | MODIFY | skills 表新增 source_repo_url, source_commit_sha, source_file_path 列；users 表新增 github_access_token 列 |
| `packages/api/src/routes/skills.ts` | MODIFY | 新增 POST /skills/import-from-github 和 POST /skills/github-files 接口 |
| `packages/api/src/routes/auth.ts` | MODIFY | 新增 GET /auth/github/authorize, GET /auth/github/callback, DELETE /auth/github/revoke, GET /auth/github/status 接口 |
| `packages/web/src/pages/settings/skills.tsx` | MODIFY | 新增「从 GitHub 导入」按钮，集成 SkillImportDialog |
| `packages/web/src/lib/types.ts` | MODIFY | Skill 接口新增 source 字段 |

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `packages/api/src/lib/github-skill-importer.ts` | GitHub Skill 导入核心逻辑（文件解析、元数据提取） |
| `packages/api/src/lib/github-client.ts` | GitHub API 客户端封装（rate limit 处理、错误重试） |
| `packages/api/src/lib/crypto.ts` | Token 加密/解密工具函数 |
| `packages/web/src/components/skill-import-dialog.tsx` | GitHub 导入对话框组件（多步骤表单） |
| `packages/web/src/components/skill-import-file-list.tsx` | 文件选择列表组件 |
| `packages/web/src/components/skill-import-preview.tsx` | Skill 预览组件 |
| `packages/api/drizzle/migrations/XXXX_add_skill_source_fields.sql` | Migration: 添加 skills 表 source 字段 |
| `packages/api/drizzle/migrations/XXXX_add_github_access_token.sql` | Migration: 添加 users 表 github_access_token 字段 |

### 删除文件

无

---

## 具体代码变更

### 1. `packages/api/src/db/schema.ts`

skills 表新增列：

```typescript
export const skills = pgTable('skills', {
  // ... 现有列 ...
  sourceRepoUrl: varchar('source_repo_url', { length: 500 }),
  sourceCommitSha: varchar('source_commit_sha', { length: 100 }),
  sourceFilePath: varchar('source_file_path', { length: 500 }),
})
```

users 表新增列：

```typescript
export const users = pgTable('users', {
  // ... 现有列 ...
  githubAccessToken: text('github_access_token'),  // 加密存储
  githubTokenExpiresAt: timestamp('github_token_expires_at', { withTimezone: true }),
})
```

### 2. `packages/api/src/lib/github-skill-importer.ts`

```typescript
import yaml from 'yaml'

interface SkillMetadata {
  name: string
  description: string | null
  prompt: string
}

export function parseSkillFile(content: string, filePath: string): SkillMetadata {
  // 检测 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/)

  if (frontmatterMatch) {
    const frontmatter = yaml.parse(frontmatterMatch[1])
    return {
      name: frontmatter.name || extractNameFromPath(filePath),
      description: frontmatter.description || null,
      prompt: frontmatterMatch[2].trim(),
    }
  }

  // 降级：从 Markdown 标题提取
  const lines = content.split('\n')
  const titleMatch = lines[0]?.match(/^#\s+(.+)$/)
  const descMatch = lines[1]?.match(/<!--\s*Description:\s*(.+?)\s*-->/)

  return {
    name: titleMatch?.[1] || extractNameFromPath(filePath),
    description: descMatch?.[1] || null,
    prompt: lines.slice(titleMatch ? 1 : 0).join('\n').trim(),
  }
}

function extractNameFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || 'Untitled'
  return fileName.replace(/\.(md|txt|yaml)$/, '').replace(/[-_]/g, ' ')
}

export async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  accessToken?: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    if (response.status === 403) {
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      if (rateLimitRemaining === '0') {
        throw new Error('GitHub API rate limit exceeded')
      }
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()
  return Buffer.from(data.content, 'base64').toString('utf-8')
}
```

### 3. `packages/api/src/routes/skills.ts`

新增导入接口：

```typescript
app.post('/api/skills/import-from-github', async (req, res) => {
  const { repoUrl, filePaths, conflictStrategy, ref = 'main' } = req.body
  const userId = req.session.userId

  // 解析仓库 URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match) {
    return res.status(400).json({ error: 'Invalid GitHub repository URL' })
  }
  const [, owner, repo] = match

  // 获取 access token
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  const accessToken = user?.githubAccessToken ? decrypt(user.githubAccessToken) : undefined

  // 获取当前 commit SHA
  const commitSha = await fetchLatestCommitSha(owner, repo, ref, accessToken)

  let imported = 0, skipped = 0
  const errors: Array<{ file: string; reason: string }> = []

  // 并行获取文件内容
  await Promise.all(filePaths.map(async (filePath) => {
    try {
      const content = await fetchGitHubFile(owner, repo, filePath, ref, accessToken)

      if (content.length > 1024 * 1024) {
        errors.push({ file: filePath, reason: 'File size exceeds 1MB limit' })
        return
      }

      const metadata = parseSkillFile(content, filePath)

      // 检查同名 Skill
      const existing = await db.query.skills.findFirst({
        where: eq(skills.name, metadata.name),
      })

      if (existing) {
        if (conflictStrategy === 'skip') {
          skipped++
          errors.push({ file: filePath, reason: 'Skill already exists' })
          return
        } else {
          // overwrite
          await db.update(skills).set({
            prompt: metadata.prompt,
            description: metadata.description,
            sourceRepoUrl: repoUrl,
            sourceCommitSha: commitSha,
            sourceFilePath: filePath,
            updatedAt: new Date(),
          }).where(eq(skills.id, existing.id))
          imported++
        }
      } else {
        // 创建新 Skill
        await db.insert(skills).values({
          id: generateId(),
          name: metadata.name,
          description: metadata.description,
          prompt: metadata.prompt,
          sourceRepoUrl: repoUrl,
          sourceCommitSha: commitSha,
          sourceFilePath: filePath,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        imported++
      }
    } catch (error) {
      errors.push({ file: filePath, reason: error.message })
    }
  }))

  res.json({ imported, skipped, errors })
})
```

### 4. `packages/web/src/components/skill-import-dialog.tsx`

```tsx
export function SkillImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(1)
  const [repoUrl, setRepoUrl] = useState('')
  const [files, setFiles] = useState<GitHubFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite'>('skip')

  const handleFetchFiles = async () => {
    const response = await fetch('/api/skills/github-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    })

    if (response.status === 403) {
      // 需要授权
      window.location.href = '/auth/github/authorize'
      return
    }

    const data = await response.json()
    setFiles(data.files)
    setStep(2)
  }

  const handleImport = async () => {
    setStep(4) // 显示进度

    const response = await fetch('/api/skills/import-from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl,
        filePaths: selectedFiles,
        conflictStrategy,
      }),
    })

    const result = await response.json()
    setStep(5) // 显示结果
    // ... 显示 result.imported, result.skipped, result.errors
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {step === 1 && <StepRepoUrl onNext={handleFetchFiles} />}
      {step === 2 && <StepSelectFiles files={files} onNext={() => setStep(3)} />}
      {step === 3 && <StepPreview onImport={handleImport} />}
      {step === 4 && <StepImporting />}
      {step === 5 && <StepResult />}
    </Dialog>
  )
}
```

---

## Migration SQL

### 添加 skills 表 source 字段

```sql
ALTER TABLE skills ADD COLUMN source_repo_url varchar(500);
ALTER TABLE skills ADD COLUMN source_commit_sha varchar(100);
ALTER TABLE skills ADD COLUMN source_file_path varchar(500);
```

### 添加 users 表 github_access_token 字段

```sql
ALTER TABLE users ADD COLUMN github_access_token text;
ALTER TABLE users ADD COLUMN github_token_expires_at timestamptz;
```

---

## 测试策略

- 手动验证：导入 public 仓库 → 无需授权 → 成功导入
- 手动验证：导入 private 仓库 → 提示授权 → 完成 OAuth → 成功导入
- 手动验证：同名 Skill + skip → 跳过不覆盖
- 手动验证：同名 Skill + overwrite → 更新 prompt 和 source 字段
- 手动验证：YAML frontmatter 文件 → 正确提取 name 和 description
- 手动验证：Markdown 文件 → 从标题提取 name
- 手动验证：大文件（>1MB）→ 提示错误，不导入
- 手动验证：GitHub API rate limit → 提示错误，显示 retryAfter
- 手动验证：导入后的 Skill 在列表中显示 GitHub 图标和仓库链接
- 手动验证：点击仓库链接 → 跳转到 GitHub 文件页面
