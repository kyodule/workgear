# Proposal: Skill Management GitHub Import — 从 GitHub 仓库导入 Skill 定义

## 背景（Why）

当前系统的 Skill 管理功能仅支持手动创建和编辑 Skill，用户需要在 Web UI 中逐个填写 Skill 的名称、描述、提示词等信息。然而，许多团队已经在 GitHub 仓库中维护了大量的 Prompt 模板和 Agent 配置文件（如 `.md`、`.txt`、`.yaml` 格式），这些文件本质上就是 Skill 的定义。

### 用户痛点

- 无法复用已有的 GitHub 仓库中的 Prompt 资产，需要手动复制粘贴到 WorkGear
- 团队协作时，Skill 定义分散在 GitHub 和 WorkGear 两个地方，维护成本高
- 无法利用 Git 的版本控制能力管理 Skill 的演进历史
- 导入大量 Skill 时，手动创建效率低下，容易出错
- 无法从社区或开源项目快速导入优质的 Prompt 模板

### 根因分析

`packages/web/src/pages/settings/skills.tsx` 仅提供了「新建 Skill」按钮，调用 `POST /api/skills` 接口创建单个 Skill。系统缺少批量导入机制，也没有与 Git 仓库集成的能力。用户只能通过 Web 表单逐个录入 Skill 信息。

## 目标（What）

提供从 GitHub 仓库批量导入 Skill 的能力，支持自动解析仓库中的 Prompt 文件并创建对应的 Skill 记录：

| 元素 | 当前状态 | 目标状态 |
|------|----------|----------|
| Skill 创建方式 | 仅支持手动创建 | 支持从 GitHub 仓库导入 |
| 导入入口 | 不存在 | Settings → Skills 页面新增「从 GitHub 导入」按钮 |
| 支持的文件格式 | N/A | `.md`、`.txt`、`.yaml` 格式的 Prompt 文件 |
| 导入流程 | N/A | 输入仓库 URL → 选择文件 → 预览 → 确认导入 |
| 冲突处理 | N/A | 同名 Skill 提示覆盖或跳过 |
| 导入记录 | N/A | 记录导入来源（repo URL + commit SHA） |

### 具体方案

1. Settings → Skills 页面新增「从 GitHub 导入」按钮，打开导入对话框
2. 用户输入 GitHub 仓库 URL（支持 public 和 private 仓库）
3. 系统调用 GitHub API 获取仓库文件树，筛选出 `.md`、`.txt`、`.yaml` 文件
4. 用户勾选要导入的文件，系统预览文件内容并自动提取 Skill 元数据：
   - Skill 名称：从文件名或 YAML frontmatter 提取
   - Skill 描述：从文件首行注释或 frontmatter 提取
   - Prompt 内容：文件主体内容
5. 用户确认后，系统批量调用 `POST /api/skills` 创建 Skill
6. 导入成功后，在 Skill 记录中保存来源信息（`source_repo_url`、`source_commit_sha`）

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| api | 代码变更 + Spec 更新 | DB schema 新增 source 字段、GitHub API 集成、批量导入接口 |
| project | Spec 更新 | 补充 Skill 导入的行为规范 |
| auth | 代码变更 | 支持 GitHub OAuth 授权访问 private 仓库 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/api/src/db/schema.ts` | MODIFY | `skills` 表新增 `sourceRepoUrl`、`sourceCommitSha`、`sourceFilePath` 列 |
| `packages/api/src/routes/skills.ts` | MODIFY | 新增 `POST /api/skills/import-from-github` 接口 |
| `packages/api/src/lib/github-skill-importer.ts` | ADD | GitHub Skill 导入逻辑（文件解析、元数据提取） |
| `packages/api/src/db/migrations/` | ADD | 新增 migration 添加 source 相关列 |
| `packages/web/src/pages/settings/skills.tsx` | MODIFY | 新增「从 GitHub 导入」按钮和导入对话框 |
| `packages/web/src/components/skill-import-dialog.tsx` | ADD | GitHub 导入对话框组件 |
| `packages/web/src/lib/types.ts` | MODIFY | `Skill` 类型新增 source 字段 |

### 不涉及

- Orchestrator (Go) 无变更 — Skill 管理在 API Server (Node.js) 层执行
- Skill 执行逻辑不变 — 导入的 Skill 与手动创建的 Skill 行为一致
- 不实现自动同步功能 — 导入后的 Skill 与源仓库解耦，不自动更新
- 不支持 GitLab、Bitbucket 等其他 Git 平台（仅 GitHub）

## 非目标

- 不实现 Skill 的双向同步（导入后修改不会推送回 GitHub）
- 不实现 Skill 的版本管理（仅记录导入时的 commit SHA）
- 不支持导入整个仓库的目录结构（仅支持选择单个文件）
- 不实现 Skill 的依赖管理（如 Skill A 引用 Skill B）
- 不支持从 URL 直接导入单个文件（必须通过仓库导入）

## 风险评估

- **风险等级：中** — 涉及 GitHub API 集成和 OAuth 授权，需要处理 rate limit 和权限问题
- GitHub API rate limit：未认证请求 60 次/小时，认证请求 5000 次/小时（需引导用户授权）
- Private 仓库访问需要用户授权 GitHub OAuth，增加认证流程复杂度
- 文件解析逻辑需要处理多种格式（Markdown、YAML frontmatter、纯文本），容错性要求高
- 批量导入时需要处理同名 Skill 冲突，避免误覆盖用户数据
- 大文件（>1MB）可能导致解析超时，需要限制文件大小
