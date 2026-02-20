# Proposal: Skill Management URL Import — 从 URL 导入 Skill 定义

## 背景（Why）

当前系统的 Skill 管理功能仅支持手动创建和编辑 Skill，用户需要在 Web UI 中逐个填写 Skill 的名称、描述、提示词等信息。然而，许多团队已经在 GitHub 或其他平台上维护了大量的 Prompt 模板文件（如 `.md`、`.txt`、`.yaml` 格式），这些文件本质上就是 Skill 的定义。

### 用户痛点

- 无法复用已有的 Prompt 资产，需要手动复制粘贴到 WorkGear
- 从社区或开源项目导入优质 Prompt 模板时，操作繁琐
- 导入单个 Skill 时，手动创建效率低下

### 根因分析

`packages/web/src/pages/settings/skills.tsx` 仅提供了「新建 Skill」按钮，调用 `POST /api/skills` 接口创建单个 Skill。系统缺少从外部 URL 导入的机制，用户只能通过 Web 表单逐个录入 Skill 信息。

## 目标（What）

提供从 URL 一次性导入 Skill 的能力，支持粘贴 GitHub raw URL 或任意可访问的文件 URL，系统自动获取内容并解析为 Skill：

| 元素 | 当前状态 | 目标状态 |
|------|----------|----------|
| Skill 创建方式 | 仅支持手动创建 | 支持从 URL 导入 |
| 导入入口 | 不存在 | Settings → Skills 页面新增「从 URL 导入」按钮 |
| 支持的文件格式 | N/A | `.md`、`.txt`、`.yaml` 格式的 Prompt 文件 |
| 导入流程 | N/A | 粘贴 URL → 预览内容 → 确认导入 |
| 冲突处理 | N/A | 同名 Skill 提示覆盖或跳过 |
| 导入记录 | N/A | 记录导入来源 URL |

### 具体方案

1. Settings → Skills 页面新增「从 URL 导入」按钮，打开导入对话框
2. 用户粘贴文件 URL（支持 GitHub raw URL、任意公开可访问的文件 URL）
3. 系统后端 fetch 该 URL 获取文件内容
4. 系统自动解析文件内容提取 Skill 元数据：
   - Skill 名称：从 YAML frontmatter 或 Markdown 标题或文件名提取
   - Skill 描述：从 frontmatter 或注释提取
   - Prompt 内容：文件主体内容
5. 用户预览解析结果，确认后创建 Skill
6. 导入成功后，在 Skill 记录中保存来源 URL（`sourceUrl`）

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| api | 代码变更 + Spec 更新 | DB schema 新增 source 字段、URL fetch + 解析、导入接口 |
| project | Spec 更新 | 补充 Skill 导入的行为规范 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/api/src/db/schema.ts` | MODIFY | `skills` 表新增 `sourceUrl` 列 |
| `packages/api/src/routes/skills.ts` | MODIFY | 新增 `POST /api/skills/import-from-url` 接口 |
| `packages/api/src/lib/skill-file-parser.ts` | ADD | Skill 文件解析逻辑（YAML frontmatter、Markdown 标题提取） |
| `packages/api/src/db/migrations/` | ADD | 新增 migration 添加 source_url 列 |
| `packages/web/src/pages/settings/skills.tsx` | MODIFY | 新增「从 URL 导入」按钮和导入对话框 |
| `packages/web/src/components/skill-import-dialog.tsx` | ADD | URL 导入对话框组件 |
| `packages/web/src/lib/types.ts` | MODIFY | `Skill` 类型新增 sourceUrl 字段 |

### 不涉及

- Orchestrator (Go) 无变更 — Skill 管理在 API Server (Node.js) 层执行
- Skill 执行逻辑不变 — 导入的 Skill 与手动创建的 Skill 行为一致
- 不实现 GitHub OAuth 授权 — 仅支持公开可访问的 URL
- 不实现 Git clone 或仓库浏览 — 用户直接提供文件 URL
- 不实现自动同步/更新 — 导入后的 Skill 与源 URL 解耦
- Auth 模块无变更 — 不需要 GitHub OAuth 集成

## 非目标

- 不实现 Skill 的双向同步（导入后修改不会推送回源）
- 不实现 Skill 的版本管理或自动更新
- 不实现 GitHub 仓库浏览（用户需自行获取文件 URL）
- 不实现 GitHub OAuth 授权（仅支持公开 URL）
- 不实现批量导入（一次导入一个 URL）
- 不支持需要认证才能访问的 URL

## 风险评估

- **风险等级：低** — 仅涉及 HTTP fetch 和文件解析，无第三方 OAuth 集成
- URL 可能返回非预期内容（HTML 页面而非原始文件），需要校验 Content-Type
- 大文件（>1MB）可能导致解析超时，需要限制文件大小
- 部分 URL 可能有 CORS 或访问限制，后端 fetch 可规避前端 CORS 问题
