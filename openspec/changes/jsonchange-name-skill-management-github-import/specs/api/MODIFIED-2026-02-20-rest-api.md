# Delta Spec: API 支持 Skill GitHub 导入

> **Type:** MODIFIED
> **Module:** api
> **Date:** 2026-02-20
> **Change:** jsonchange-name-skill-management-github-import

## 概述

修改 API 模块，在 skills 表新增 source 相关列，新增 GitHub 导入接口，支持从 GitHub 仓库批量导入 Skill 定义。

---

## 场景

### Scenario 1: skills 表新增 source 相关列

```gherkin
Given 数据库 skills 表已存在
When 执行 migration 添加 source 相关列
Then skills 表新增 source_repo_url varchar(500) 可空列
  And skills 表新增 source_commit_sha varchar(100) 可空列
  And skills 表新增 source_file_path varchar(500) 可空列
  And 现有数据的 source 字段值为 NULL
  And 不影响现有查询和写入操作
```

### Scenario 2: POST /api/skills/import-from-github 接口

```gherkin
Given 用户提供 GitHub 仓库 URL 和访问 token
When 客户端请求 POST /api/skills/import-from-github
  And 请求体包含 { repoUrl, accessToken, filePaths: ["prompts/code-review.md"] }
Then 系统调用 GitHub API 获取文件内容
  And 系统解析文件提取 Skill 元数据（name, description, prompt）
  And 系统批量创建 Skill 记录，填充 source 字段
  And 响应体返回 { imported: 3, skipped: 1, errors: [] }
```

### Scenario 3: GET /api/skills/github-files 获取仓库文件列表

```gherkin
Given 用户提供 GitHub 仓库 URL 和访问 token
When 客户端请求 GET /api/skills/github-files?repoUrl={url}&accessToken={token}
Then 系统调用 GitHub API 获取仓库文件树
  And 系统筛选出 .md、.txt、.yaml 文件
  And 响应体返回 { files: [{ path, name, size, sha }] }
```

### Scenario 4: 同名 Skill 冲突处理

```gherkin
Given 系统中已存在名为 "code-review" 的 Skill
When 用户导入包含同名 Skill 的文件
  And 请求参数 conflictStrategy = "skip"
Then 系统跳过该 Skill，不创建新记录
  And 响应中 skipped 计数 +1
  And 响应中 errors 数组包含 { file: "code-review.md", reason: "Skill already exists" }
```

### Scenario 5: 同名 Skill 覆盖处理

```gherkin
Given 系统中已存在名为 "code-review" 的 Skill
When 用户导入包含同名 Skill 的文件
  And 请求参数 conflictStrategy = "overwrite"
Then 系统更新现有 Skill 的 prompt 和 source 字段
  And 响应中 imported 计数 +1
  And 保留原 Skill 的 id 和 createdAt
```

### Scenario 6: GitHub API rate limit 处理

```gherkin
Given GitHub API 返回 403 Forbidden (rate limit exceeded)
When 系统调用 GitHub API 获取文件内容
Then 系统返回 429 Too Many Requests
  And 响应体包含 { error: "GitHub API rate limit exceeded", retryAfter: 3600 }
```

### Scenario 7: Private 仓库访问权限验证

```gherkin
Given 用户提供的 accessToken 无权限访问 private 仓库
When 系统调用 GitHub API 获取文件内容
Then GitHub API 返回 404 Not Found
  And 系统返回 403 Forbidden
  And 响应体包含 { error: "Repository not found or access denied" }
```

### Scenario 8: Markdown 文件元数据提取

```gherkin
Given 文件内容为 Markdown 格式
  And 文件首行为 "# Code Review Prompt"
  And 文件第二行为 "<!-- Description: Review code for best practices -->"
When 系统解析文件提取元数据
Then Skill name = "Code Review Prompt"
  And Skill description = "Review code for best practices"
  And Skill prompt = 文件主体内容（去除首行标题和注释）
```

### Scenario 9: YAML frontmatter 元数据提取

```gherkin
Given 文件内容包含 YAML frontmatter
  And frontmatter 包含 name: "Code Review", description: "Review code"
When 系统解析文件提取元数据
Then Skill name = "Code Review"
  And Skill description = "Review code"
  And Skill prompt = frontmatter 之后的内容
```

### Scenario 10: 文件大小限制

```gherkin
Given 文件大小超过 1MB
When 系统尝试导入该文件
Then 系统返回错误
  And 响应中 errors 数组包含 { file: "large-prompt.md", reason: "File size exceeds 1MB limit" }
  And 该文件不被导入
```

---

## API Schema

### POST /api/skills/import-from-github 请求体

```typescript
interface ImportFromGitHubRequest {
  repoUrl: string                    // GitHub 仓库 URL（如 https://github.com/owner/repo）
  accessToken?: string               // GitHub Personal Access Token（访问 private 仓库时必需）
  filePaths: string[]                // 要导入的文件路径列表（相对仓库根目录）
  conflictStrategy: 'skip' | 'overwrite'  // 同名 Skill 冲突处理策略
  ref?: string                       // Git ref（branch/tag/commit），默认为 main
}
```

### POST /api/skills/import-from-github 响应体

```typescript
interface ImportFromGitHubResponse {
  imported: number                   // 成功导入的 Skill 数量
  skipped: number                    // 跳过的 Skill 数量（冲突或已存在）
  errors: Array<{                    // 导入失败的文件
    file: string                     // 文件路径
    reason: string                   // 失败原因
  }>
}
```

### GET /api/skills/github-files 响应体

```typescript
interface GitHubFilesResponse {
  files: Array<{
    path: string                     // 文件路径（相对仓库根目录）
    name: string                     // 文件名
    size: number                     // 文件大小（字节）
    sha: string                      // Git blob SHA
  }>
}
```
