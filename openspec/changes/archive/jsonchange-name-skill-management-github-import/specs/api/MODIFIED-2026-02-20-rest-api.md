# Delta Spec: API 支持从 URL 导入 Skill

> **Type:** MODIFIED
> **Module:** api
> **Date:** 2026-02-20
> **Change:** jsonchange-name-skill-management-github-import

## 概述

修改 API 模块，在 skills 表新增 source_url 列，新增从 URL 导入 Skill 的接口，支持用户粘贴文件 URL 一次性导入 Skill 定义。

---

## 场景

### Scenario 1: skills 表新增 source_url 列

```gherkin
Given 数据库 skills 表已存在
When 执行 migration 添加 source_url 列
Then skills 表新增 source_url varchar(1000) 可空列
  And 现有数据的 source_url 字段值为 NULL
  And 不影响现有查询和写入操作
```

### Scenario 2: POST /api/skills/import-from-url 导入 Skill

```gherkin
Given 用户提供一个公开可访问的文件 URL
When 客户端请求 POST /api/skills/import-from-url
  And 请求体包含 { url: "https://raw.githubusercontent.com/owner/repo/main/prompts/code-review.md" }
Then 系统后端 fetch 该 URL 获取文件内容
  And 系统解析文件提取 Skill 元数据（name, description, prompt）
  And 系统返回解析结果供用户预览
  And 响应体返回 { name, description, prompt, sourceUrl }
```

### Scenario 3: POST /api/skills/import-from-url 确认创建

```gherkin
Given 用户已预览导入内容并确认
When 客户端请求 POST /api/skills
  And 请求体包含 { name, description, prompt, sourceUrl }
Then 系统创建 Skill 记录，填充 sourceUrl 字段
  And 响应体返回创建的 Skill 对象
```

### Scenario 4: 同名 Skill 冲突处理 — 跳过

```gherkin
Given 系统中已存在名为 "code-review" 的 Skill
When 用户导入解析出同名 Skill
  And 用户选择 conflictStrategy = "skip"
Then 系统不创建新记录
  And 前端提示「Skill 已存在，已跳过」
```

### Scenario 5: 同名 Skill 冲突处理 — 覆盖

```gherkin
Given 系统中已存在名为 "code-review" 的 Skill
When 用户导入解析出同名 Skill
  And 用户选择 conflictStrategy = "overwrite"
Then 系统更新现有 Skill 的 prompt、description 和 sourceUrl 字段
  And 保留原 Skill 的 id 和 createdAt
```

### Scenario 6: URL 不可访问

```gherkin
Given 用户提供的 URL 返回 404 或连接超时
When 系统后端 fetch 该 URL
Then 系统返回 400 Bad Request
  And 响应体包含 { error: "无法访问该 URL，请检查地址是否正确" }
```

### Scenario 7: URL 返回非文本内容

```gherkin
Given 用户提供的 URL 返回 HTML 页面或二进制文件
When 系统后端 fetch 该 URL
  And Content-Type 不是 text/plain、text/markdown、text/yaml 或 application/octet-stream
Then 系统尝试检测内容是否为有效文本
  And 如果内容包含大量 HTML 标签，返回错误提示「请使用文件的 raw URL」
```

### Scenario 8: 文件大小限制

```gherkin
Given URL 返回的文件内容超过 1MB
When 系统后端 fetch 该 URL
Then 系统返回 400 Bad Request
  And 响应体包含 { error: "文件大小超过 1MB 限制" }
```

### Scenario 9: Markdown 文件元数据提取

```gherkin
Given URL 返回的内容为 Markdown 格式
  And 文件首行为 "# Code Review Prompt"
  And 文件第二行为 "<!-- Description: Review code for best practices -->"
When 系统解析文件提取元数据
Then Skill name = "Code Review Prompt"
  And Skill description = "Review code for best practices"
  And Skill prompt = 文件主体内容（去除首行标题和注释）
```

### Scenario 10: YAML frontmatter 元数据提取

```gherkin
Given URL 返回的内容包含 YAML frontmatter
  And frontmatter 包含 name: "Code Review", description: "Review code"
When 系统解析文件提取元数据
Then Skill name = "Code Review"
  And Skill description = "Review code"
  And Skill prompt = frontmatter 之后的内容
```

### Scenario 11: 从 URL 路径提取文件名作为降级

```gherkin
Given URL 返回的内容为纯文本，无 frontmatter 和 Markdown 标题
When 系统解析文件提取元数据
Then Skill name 从 URL 路径的文件名提取（如 "code-review" 从 "code-review.md"）
  And Skill description 为 null
  And Skill prompt = 文件完整内容
```

---

## API Schema

### POST /api/skills/import-from-url 请求体

```typescript
interface ImportFromUrlRequest {
  url: string                        // 文件 URL（GitHub raw URL 或任意公开 URL）
}
```

### POST /api/skills/import-from-url 响应体

```typescript
interface ImportFromUrlResponse {
  name: string                       // 解析出的 Skill 名称
  description: string | null         // 解析出的 Skill 描述
  prompt: string                     // 解析出的 Prompt 内容
  sourceUrl: string                  // 来源 URL
}
```

### POST /api/skills 请求体（扩展）

```typescript
interface CreateSkillRequest {
  name: string
  description: string | null
  prompt: string
  sourceUrl?: string                 // 可选，导入来源 URL
  conflictStrategy?: 'skip' | 'overwrite'  // 可选，同名冲突处理策略
}
```
