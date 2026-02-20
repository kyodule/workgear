# Tasks: Skill Management URL Import — 从 URL 导入 Skill 定义

## 模块：数据库 Schema (packages/api/src/db)

### 新增 skills 表 source_url 字段

- [x] 在 `schema.ts` 的 `skills` 表定义中新增 `sourceUrl: varchar('source_url', { length: 1000 })` 列 **[S]**
- [x] 生成 Drizzle migration 文件：`ALTER TABLE skills ADD COLUMN source_url varchar(1000)` **[S]**
- [x] 执行 migration 验证列已添加 **[S]**

## 模块：文件解析核心逻辑 (packages/api/src/lib)

### 创建 skill-file-parser.ts

- [x] 创建 `skill-file-parser.ts` 文件 **[S]**
- [x] 实现 `parseSkillFile(content, url)` 函数 **[M]**
- [x] 实现 YAML frontmatter 检测和解析（使用 `yaml` 库） **[M]**
- [x] 实现 Markdown 标题提取（正则匹配 `# Title`） **[S]**
- [x] 实现 Markdown 注释提取（正则匹配 `<!-- Description: ... -->`） **[S]**
- [x] 实现 `extractNameFromUrl(url)` 降级逻辑（从 URL 路径文件名提取） **[S]**

## 模块：API 路由 (packages/api/src/routes)

### skills.ts 新增导入接口

- [x] 在 `skills.ts` 中新增 `POST /api/skills/import-from-url` 接口 **[M]**
- [x] 实现 URL 格式校验 **[S]**
- [x] 实现后端 fetch URL 内容，设置 10s 超时 **[M]**
- [x] 实现 HTTP 错误处理（404、超时等） **[S]**
- [x] 实现 HTML 内容检测（提示用户使用 raw URL） **[S]**
- [x] 实现文件大小限制检查（>1MB 拒绝） **[S]**
- [x] 调用 `parseSkillFile` 解析文件内容 **[S]**
- [x] 返回 `{ name, description, prompt, sourceUrl }` **[S]**

### skills.ts 扩展创建接口

- [x] 扩展 `POST /api/skills` 接口，支持 `sourceUrl` 参数 **[S]**
- [x] 扩展 `POST /api/skills` 接口，支持 `conflictStrategy` 参数 **[M]**
- [x] 实现 `conflictStrategy = "skip"` 逻辑（跳过，返回 skipped 标记） **[S]**
- [x] 实现 `conflictStrategy = "overwrite"` 逻辑（UPDATE skills） **[M]**

## 模块：前端类型定义 (packages/web/src/lib)

### types.ts 扩展 Skill 类型

- [x] 在 `types.ts` 的 `Skill` 接口中新增 `sourceUrl: string | null` 字段 **[S]**

## 模块：前端 Skills 页面 (packages/web/src/pages/settings)

### skills.tsx 新增导入按钮

- [x] 在 `skills.tsx` 页面标题旁新增「从 URL 导入」按钮 **[S]**
- [x] 点击按钮打开 `SkillImportDialog` 组件 **[S]**
- [x] 导入成功后刷新 Skills 列表（调用 `refetch()`） **[S]**

### Skill 卡片展示导入来源

- [x] 在 Skill 卡片中检查 `sourceUrl` 是否存在 **[S]**
- [x] 如果存在，显示链接图标和来源 URL **[S]**
- [x] 渲染为可点击链接，在新标签页打开原始文件 **[S]**

## 模块：前端导入对话框 (packages/web/src/components)

### 创建 skill-import-dialog.tsx

- [x] 创建 `skill-import-dialog.tsx` 文件 **[M]**
- [x] 实现 URL 输入表单（输入框 + 解析按钮） **[S]**
- [x] 实现调用 `POST /api/skills/import-from-url` 解析 URL **[M]**
- [x] 实现错误提示（URL 不可访问、HTML 页面、文件过大等） **[S]**
- [x] 实现解析结果预览（name、description、prompt 前 200 字符） **[M]**
- [x] 实现 name 和 description 可编辑 **[S]**
- [x] 实现同名 Skill 冲突检测和策略选择（skip / overwrite） **[M]**
- [x] 实现确认导入（调用 `POST /api/skills`） **[S]**
- [x] 实现导入成功后关闭对话框并刷新列表 **[S]**

## 模块：代码审查修复 (Review Fixes)

### 安全性修复

- [x] 修复 SSRF 漏洞：创建 `url-validator.ts` 添加内网 IP 黑名单校验 **[M]**
- [x] 修复内存安全：在 `response.text()` 前通过 Content-Length 限制响应体大小 **[S]**

### 代码质量改进

- [x] 为 `parseSkillFile` 添加单元测试（`skill-file-parser.test.ts`），覆盖 YAML/Markdown/纯文本/异常输入场景 **[M]**
- [x] 前端增加对 409 冲突响应的处理逻辑 **[S]**
- [x] 提取 UUID 校验为共享函数（`uuid-validator.ts`） **[S]**
- [x] HTML 检测改用 `toLowerCase()` 后统一匹配 **[S]**
- [x] 确认前端 HTTP 客户端的错误处理方式（ky beforeError hook 已正确提取 error message） **[S]**

## 测试验证

### 端到端验证

- [ ] GitHub raw URL 导入 → 成功解析并创建 Skill **[S]**
- [ ] 普通 HTTPS 文件 URL 导入 → 成功解析并创建 Skill **[S]**
- [ ] GitHub 非 raw URL → 提示使用 raw URL **[S]**
- [ ] 不存在的 URL → 提示无法访问 **[S]**
- [ ] 同名 Skill + skip → 确认跳过，不覆盖 **[S]**
- [ ] 同名 Skill + overwrite → 确认更新 prompt 和 sourceUrl **[S]**
- [ ] YAML frontmatter 文件 → 确认正确提取 name 和 description **[S]**
- [ ] Markdown 文件 → 确认从标题提取 name **[S]**
- [ ] 纯文本文件 → 确认从 URL 文件名提取 name **[S]**
- [ ] 大文件（>1MB）→ 确认提示错误，不导入 **[S]**
- [ ] 导入后的 Skill 在列表中显示来源链接 **[S]**
- [ ] 点击来源链接 → 确认在新标签页打开原始文件 **[S]**
