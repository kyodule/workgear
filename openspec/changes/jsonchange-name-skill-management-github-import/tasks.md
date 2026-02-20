# Tasks: Skill Management GitHub Import — 从 GitHub 仓库导入 Skill 定义

## 模块：数据库 Schema (packages/api/src/db)

### 新增 skills 表 source 字段

- [ ] 在 `schema.ts` 的 `skills` 表定义中新增 `sourceRepoUrl: varchar('source_repo_url', { length: 500 })` 列 **[S]**
- [ ] 在 `schema.ts` 的 `skills` 表定义中新增 `sourceCommitSha: varchar('source_commit_sha', { length: 100 })` 列 **[S]**
- [ ] 在 `schema.ts` 的 `skills` 表定义中新增 `sourceFilePath: varchar('source_file_path', { length: 500 })` 列 **[S]**
- [ ] 生成 Drizzle migration 文件：`ALTER TABLE skills ADD COLUMN source_repo_url varchar(500)` **[S]**
- [ ] 生成 Drizzle migration 文件：`ALTER TABLE skills ADD COLUMN source_commit_sha varchar(100)` **[S]**
- [ ] 生成 Drizzle migration 文件：`ALTER TABLE skills ADD COLUMN source_file_path varchar(500)` **[S]**
- [ ] 执行 migration 验证列已添加 **[S]**

### 新增 users 表 github_access_token 字段

- [ ] 在 `schema.ts` 的 `users` 表定义中新增 `githubAccessToken: text('github_access_token')` 列 **[S]**
- [ ] 在 `schema.ts` 的 `users` 表定义中新增 `githubTokenExpiresAt: timestamp('github_token_expires_at', { withTimezone: true })` 列 **[S]**
- [ ] 生成 Drizzle migration 文件：`ALTER TABLE users ADD COLUMN github_access_token text` **[S]**
- [ ] 生成 Drizzle migration 文件：`ALTER TABLE users ADD COLUMN github_token_expires_at timestamptz` **[S]**
- [ ] 执行 migration 验证列已添加 **[S]**

## 模块：GitHub 集成核心逻辑 (packages/api/src/lib)

### 创建 github-client.ts

- [ ] 创建 `github-client.ts` 文件 **[M]**
- [ ] 实现 `fetchGitHubFile(owner, repo, path, ref, accessToken?)` 函数 **[M]**
- [ ] 实现 `fetchGitHubFileTree(owner, repo, ref, accessToken?)` 函数 **[M]**
- [ ] 实现 `fetchLatestCommitSha(owner, repo, ref, accessToken?)` 函数 **[S]**
- [ ] 实现 GitHub API rate limit 检测和错误处理 **[M]**
- [ ] 实现 403/404 错误区分（rate limit vs 权限不足 vs 仓库不存在） **[S]**

### 创建 github-skill-importer.ts

- [ ] 创建 `github-skill-importer.ts` 文件 **[M]**
- [ ] 实现 `parseSkillFile(content, filePath)` 函数 **[M]**
- [ ] 实现 YAML frontmatter 检测和解析（使用 `yaml` 库） **[M]**
- [ ] 实现 Markdown 标题提取（正则匹配 `# Title`） **[S]**
- [ ] 实现 Markdown 注释提取（正则匹配 `<!-- Description: ... -->`） **[S]**
- [ ] 实现 `extractNameFromPath(filePath)` 降级逻辑（从文件名提取） **[S]**
- [ ] 实现文件大小限制检查（>1MB 拒绝） **[S]**

### 创建 crypto.ts

- [ ] 创建 `crypto.ts` 文件 **[S]**
- [ ] 实现 `encrypt(plaintext)` 函数（使用 AES-256-GCM） **[M]**
- [ ] 实现 `decrypt(ciphertext)` 函数 **[M]**
- [ ] 从环境变量读取加密密钥 `ENCRYPTION_KEY` **[S]**

## 模块：API 路由 (packages/api/src/routes)

### skills.ts 新增导入接口

- [ ] 在 `skills.ts` 中新增 `POST /api/skills/github-files` 接口 **[M]**
- [ ] 实现仓库 URL 解析（提取 owner 和 repo） **[S]**
- [ ] 调用 `fetchGitHubFileTree` 获取文件树 **[S]**
- [ ] 筛选 `.md`、`.txt`、`.yaml` 文件 **[S]**
- [ ] 过滤大文件（size > 1MB） **[S]**
- [ ] 返回 `{ files: [{ path, name, size, sha }] }` **[S]**

- [ ] 在 `skills.ts` 中新增 `POST /api/skills/import-from-github` 接口 **[L]**
- [ ] 解析请求参数：`repoUrl`, `filePaths`, `conflictStrategy`, `ref` **[S]**
- [ ] 查询当前用户的 `github_access_token` 并解密 **[S]**
- [ ] 调用 `fetchLatestCommitSha` 获取当前 commit SHA **[S]**
- [ ] 并行获取所有文件内容（`Promise.all` + `fetchGitHubFile`） **[M]**
- [ ] 对每个文件调用 `parseSkillFile` 提取元数据 **[S]**
- [ ] 检查同名 Skill（`SELECT * FROM skills WHERE name = ?`） **[S]**
- [ ] 实现 `conflictStrategy = "skip"` 逻辑（跳过，记录到 skipped） **[S]**
- [ ] 实现 `conflictStrategy = "overwrite"` 逻辑（UPDATE skills） **[M]**
- [ ] 实现新 Skill 创建逻辑（INSERT INTO skills） **[M]**
- [ ] 收集错误信息（文件解析失败、API 错误等） **[S]**
- [ ] 返回 `{ imported, skipped, errors }` **[S]**

### auth.ts 新增 GitHub OAuth 接口

- [ ] 在 `auth.ts` 中新增 `GET /auth/github/authorize` 接口 **[M]**
- [ ] 构造 GitHub OAuth URL（client_id, redirect_uri, scope=repo） **[S]**
- [ ] 重定向到 GitHub 授权页面 **[S]**

- [ ] 在 `auth.ts` 中新增 `GET /auth/github/callback` 接口 **[M]**
- [ ] 从 query 参数提取 `code` 或 `error` **[S]**
- [ ] 如果 `error` 存在，重定向到 `/settings/skills?github_error={error}` **[S]**
- [ ] 调用 GitHub API 用 code 换取 access_token **[M]**
- [ ] 调用 `GET https://api.github.com/user` 验证 token 有效性 **[S]**
- [ ] 加密 access_token 并保存到 `users.github_access_token` **[M]**
- [ ] 重定向到 `/settings/skills?github_authorized=true` **[S]**

- [ ] 在 `auth.ts` 中新增 `DELETE /auth/github/revoke` 接口 **[S]**
- [ ] 查询当前用户的 `github_access_token` 并解密 **[S]**
- [ ] 调用 GitHub API 撤销 token（`DELETE /applications/{client_id}/token`） **[M]**
- [ ] 删除 `users.github_access_token`（UPDATE users SET github_access_token = NULL） **[S]**
- [ ] 返回 `{ revoked: true }` **[S]**

- [ ] 在 `auth.ts` 中新增 `GET /auth/github/status` 接口 **[S]**
- [ ] 查询当前用户的 `github_access_token` 是否存在 **[S]**
- [ ] 返回 `{ authorized: boolean, expiresAt?: string }` **[S]**

## 模块：前端类型定义 (packages/web/src/lib)

### types.ts 扩展 Skill 类型

- [ ] 在 `types.ts` 的 `Skill` 接口中新增 `sourceRepoUrl: string | null` 字段 **[S]**
- [ ] 在 `types.ts` 的 `Skill` 接口中新增 `sourceCommitSha: string | null` 字段 **[S]**
- [ ] 在 `types.ts` 的 `Skill` 接口中新增 `sourceFilePath: string | null` 字段 **[S]**

## 模块：前端 Skills 页面 (packages/web/src/pages/settings)

### skills.tsx 新增导入按钮

- [ ] 在 `skills.tsx` 页面标题旁新增「从 GitHub 导入」按钮 **[S]**
- [ ] 点击按钮打开 `SkillImportDialog` 组件 **[S]**
- [ ] 导入成功后刷新 Skills 列表（调用 `refetch()`） **[S]**

### Skill 卡片展示导入来源

- [ ] 在 Skill 卡片中检查 `sourceRepoUrl` 是否存在 **[S]**
- [ ] 如果存在，显示 GitHub 图标（`<GitHubIcon />`） **[S]**
- [ ] 显示仓库名称（从 `sourceRepoUrl` 提取 `owner/repo`） **[S]**
- [ ] 渲染为可点击链接，指向 `{sourceRepoUrl}/blob/{sourceCommitSha}/{sourceFilePath}` **[M]**
- [ ] 显示 commit SHA 短 hash（`sourceCommitSha.slice(0, 7)`） **[S]**

## 模块：前端导入对话框 (packages/web/src/components)

### 创建 skill-import-dialog.tsx

- [ ] 创建 `skill-import-dialog.tsx` 文件 **[L]**
- [ ] 实现多步骤表单状态管理（useState: step, repoUrl, files, selectedFiles, conflictStrategy） **[M]**
- [ ] 实现步骤 1：输入仓库 URL 和 ref（branch/tag） **[M]**
- [ ] 实现步骤 2：调用 `/api/skills/github-files` 获取文件列表 **[M]**
- [ ] 实现步骤 2：显示文件列表（带复选框） **[M]**
- [ ] 实现步骤 2：处理 403 错误，显示「授权 GitHub」按钮 **[M]**
- [ ] 实现步骤 3：显示选中文件的预览（name, description, prompt 前 200 字符） **[M]**
- [ ] 实现步骤 3：冲突策略选择（Radio: skip / overwrite） **[S]**
- [ ] 实现步骤 4：调用 `/api/skills/import-from-github` 执行导入 **[M]**
- [ ] 实现步骤 4：显示进度条（已导入 / 总数） **[M]**
- [ ] 实现步骤 5：显示导入结果（imported, skipped, errors） **[M]**
- [ ] 实现步骤 5：点击「完成」关闭对话框并刷新列表 **[S]**

### 创建 skill-import-file-list.tsx

- [ ] 创建 `skill-import-file-list.tsx` 文件 **[M]**
- [ ] 实现文件列表渲染（Checkbox + 文件名 + 文件大小） **[M]**
- [ ] 实现全选/取消全选功能 **[S]**
- [ ] 实现文件筛选（按文件名搜索） **[M]**

### 创建 skill-import-preview.tsx

- [ ] 创建 `skill-import-preview.tsx` 文件 **[M]**
- [ ] 实现 Skill 预览卡片（name, description, prompt 前 200 字符） **[M]**
- [ ] 实现展开/收起完整 prompt 功能 **[S]**

## 模块：环境变量配置

### 配置 GitHub OAuth App

- [ ] 在 GitHub 创建 OAuth App（Settings → Developer settings → OAuth Apps） **[Manual]**
- [ ] 配置 Authorization callback URL 为 `https://workgear.app/auth/github/callback` **[Manual]**
- [ ] 获取 Client ID 和 Client Secret **[Manual]**
- [ ] 在 `.env` 中添加 `GITHUB_OAUTH_CLIENT_ID` **[Manual]**
- [ ] 在 `.env` 中添加 `GITHUB_OAUTH_CLIENT_SECRET` **[Manual]**
- [ ] 在 `.env` 中添加 `ENCRYPTION_KEY`（生成 32 字节随机密钥） **[Manual]**

## 测试验证

### 端到端验证

- [ ] Public 仓库导入 → 无需授权 → 成功导入 **[M]**
- [ ] Private 仓库导入 → 提示授权 → 完成 OAuth → 成功导入 **[M]**
- [ ] 同名 Skill + skip → 确认跳过，不覆盖 **[S]**
- [ ] 同名 Skill + overwrite → 确认更新 prompt 和 source 字段 **[S]**
- [ ] YAML frontmatter 文件 → 确认正确提取 name 和 description **[S]**
- [ ] Markdown 文件 → 确认从标题提取 name **[S]**
- [ ] 纯文本文件 → 确认从文件名提取 name **[S]**
- [ ] 大文件（>1MB）→ 确认提示错误，不导入 **[S]**
- [ ] GitHub API rate limit → 确认提示错误，显示 retryAfter **[M]**
- [ ] 导入后的 Skill 在列表中显示 GitHub 图标和仓库链接 **[S]**
- [ ] 点击仓库链接 → 确认跳转到 GitHub 文件页面 **[S]**
- [ ] 编辑导入的 Skill → 确认可以修改并保存 **[S]**
- [ ] 删除导入的 Skill → 确认删除成功，不影响 GitHub 仓库 **[S]**
- [ ] 撤销 GitHub 授权 → 确认无法访问 private 仓库 **[S]**
- [ ] 重新授权 GitHub → 确认可以再次访问 private 仓库 **[S]**

## 模块：OpenSpec 文档

- [ ] 归档完成后更新 `openspec/specs/project/2026-02-20-skill-management.md` **[S]**
- [ ] 归档完成后更新 `openspec/specs/api/2026-02-14-rest-api.md` **[S]**
- [ ] 归档完成后更新 `openspec/specs/auth/2026-02-20-github-oauth.md` **[S]**
