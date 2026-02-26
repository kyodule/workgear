# WorkGear 部署调试笔记

> 记录从项目部署到需求分析流程跑通的完整过程，包括遇到的所有问题及解决方案。

---

## 一、项目概述

WorkGear 是一个 AI Agent 工作流编排平台，核心能力是让 AI Agent（如 Claude Code / Droid）按预定义 YAML 流程执行任务，配合人工 Review 和看板管理。

### 架构

```
浏览器 → Vite(:3000) --/api代理-→ Fastify(:4000) --gRPC-→ Go Orchestrator(:50051)
                                       ↓
                                  PostgreSQL(:5432) + Redis(:6379)
```

### 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React + Vite + Tailwind CSS 4 + TypeScript |
| API | Fastify + Drizzle ORM + PostgreSQL |
| 调度 | Go + gRPC |
| Agent 执行 | Docker 容器（agent-droid 镜像） |
| 缓存 | Redis |

### 核心流程：需求分析（requirement-analysis）

```
输入需求(human_input) → Agent 分析需求(agent_task, spec mode)
  → Review PRD(human_review) → 拆解 User Story(agent_task, spec mode)
  → Review User Stories(human_review)
```

YAML 模板位置：`packages/api/src/seeds/templates/requirement-analysis.yaml`

### 关键数据流

1. 用户在前端创建 Task，选择流程模板，触发 flow run
2. Flow run 的 DSL 来源链：`workflow_templates.template` → `workflows.dsl` → `flow_runs.dsl_snapshot`
3. Orchestrator 的 worker loop 轮询 `node_runs` 表中 `status='queued'` 的记录，原子性地 acquire 并执行
4. Agent 在 Docker 容器中执行，通过 git worktree 操作代码仓库
5. 产物存储在 `artifacts` + `artifact_versions` 表，spec 模式下同时写入 git

### 数据库连接

```bash
docker exec -i workgear-postgres psql -U workgear -d workgear_dev -c "SQL"
```

宿主机未安装 psql，必须通过 docker exec。

---

## 二、问题清单与解决方案

### 1. Git Worktree Docker 挂载失败（exit code 128）

**现象**：Agent 执行失败，exit code 128，git 操作报错。

**根因**：Agent 容器内挂载的是 worktree 目录，但 worktree 的 `.git` 文件指向宿主机的 bare repo 绝对路径，容器内路径不存在。

**修复**：
- `adapter.go`：新增 `BareRepoPath` 字段
- `executor.go`：挂载 bare repo 到容器，添加 `rewriteWorktreeGitPaths` 函数重写 `.git` 文件中的路径
- `droid_adapter.go` / `claude_adapter.go` / `codex_adapter.go`：传递 `BareRepoPath`

**涉及文件**：
- `packages/orchestrator/internal/agent/adapter.go`
- `packages/orchestrator/internal/agent/executor.go`
- `packages/orchestrator/internal/agent/droid_adapter.go`
- `packages/orchestrator/internal/agent/claude_adapter.go`
- `packages/orchestrator/internal/agent/codex_adapter.go`

---

### 2. Agent 执行超时（5 分钟）

**现象**：`container execution timed out after 5m0s`

**根因**：YAML 模板中 `timeout: 300s`（5 分钟）对于 LLM 生成 PRD/User Story 不够用。

**修复**：YAML 中 `timeout: 300s` → `timeout: 15m`

**关键坑**：修改 YAML 文件后，需要同步更新三处数据库记录：
1. `workflow_templates.template` — 模板定义
2. `workflows.dsl` — 工作流实例的 DSL（**容易遗漏！flow 创建时从这里取 DSL，不是从 workflow_templates**）
3. `flow_runs.dsl_snapshot` — 已创建的 flow run 快照

```sql
-- 同步模板到所有位置
UPDATE workflow_templates SET template = $YAML WHERE slug = 'requirement-analysis';
UPDATE workflows SET dsl = $YAML WHERE template_id = '<template_id>';
UPDATE flow_runs SET dsl_snapshot = $YAML WHERE status NOT IN ('completed', 'cancelled', 'failed');
```

---

### 3. PRD 输出内容为空

**现象**：Agent 分析需求完成，但 Review PRD 节点看到的内容为空。

**根因**：模板表达式使用了 `.outputs` 而不是 `.outputs.result`。Agent 的输出结构是 `{"result": "..."}`, 需要用 `.outputs.result` 取值。

**修复**：所有模板中 `{{nodes.xxx.outputs}}` → `{{nodes.xxx.outputs.result}}`

---

### 4. 模板渲染显示 `<map[string]interface {} Value>`

**现象**：下游节点收到的上游输出显示为 Go 的 map 类型字符串。

**根因**：同问题 3，`.outputs` 返回整个 map 对象而非字符串字段。

**修复**：同上，使用 `.outputs.result`。

---

### 5. Human Input 表单数据未持久化

**现象**：用户提交需求后，数据丢失，下游节点拿不到输入。

**修复**：
- `node_handlers.go` 中 `executeHumanInput` 添加表单数据持久化逻辑
- 添加模板 fallback：`{% if nodes.input_requirement.outputs.requirement_text %}...{% else %}...{% endif %}`

---

### 6. Droid Agent 卡在 spec mode 思考循环

**现象**：User Story 节点输出为空，Agent 日志显示反复进入 `<thinking>` 循环尝试调用 `ExitSpecMode` 工具。

**根因**：`docker/agent-droid/entrypoint.sh` 中 `spec` 模式被映射为 `ACP_MODE="normal"`，导致 Droid agent 进入 spec 模式后无法正常输出。

**修复**：删除 `spec) ACP_MODE="normal"` case，让 spec 模式 fall through 到 `*) ACP_MODE="auto-high"`。

**注意**：修改后需要重新构建 Docker 镜像：
```bash
cd docker/agent-droid && docker build -t workgear/agent-droid:latest .
```

---

### 7. 复用历史产物后并行执行冲突

**现象**：跳过节点后，下游节点被调度器立即拾取执行，与用户操作产生竞争。

**修复**：`HandleSkipNode` 中添加上游依赖检查，确保所有上游节点已完成才允许跳过。`canSkip` 限制为 `queued` / `waiting_human` 状态。

---

### 8. 复用历史产物按钮不显示

**现象**：前端没有显示"复用历史产物"按钮。

**根因**：API 查询 previous-output 时只查了最近一个 flow，但那个 flow 可能没有完成的节点。

**修复**：API 改为 `innerJoin` 跨所有历史 flow 查询，取最新的 completed 节点输出。

---

### 9. Spec 模式产物未提交到 Git

**现象**：PRD 和 User Story 生成后只存在数据库中，没有推送到 Git 仓库。

**根因**：Git 集成代码只对 `execute` / `opsx_plan` / `opsx_apply` 模式生效，`spec` 模式被跳过。`handleArtifact` 只创建 DB 记录，不写文件。

**修复**：
1. `ArtifactConfigDef` 新增 `file_path` 字段（如 `docs/prd.md`）
2. `executeAgentTask` 中 spec 模式下，agent 返回后自动将产物写入 worktree 并 commit
3. `requiresCommit` 条件增加 `spec` 模式
4. `HandleSkipNode`（复用路径）中添加 `writeSkippedArtifactToGit`：创建临时 worktree → 写文件 → commit → integrate → push → cleanup

**涉及文件**：
- `packages/orchestrator/internal/engine/dsl_parser.go` — `FilePath` 字段
- `packages/orchestrator/internal/engine/node_handlers.go` — `writeArtifactToGit` 函数 + spec 模式写入逻辑
- `packages/orchestrator/internal/engine/dag.go` — `writeSkippedArtifactToGit` 方法

---

## 三、新增功能：产物复用（Artifact Reuse）

### 功能描述

当同一个 Task 多次运行流程时，如果之前的 flow 已经产出了有效的 PRD / User Story，用户可以选择复用历史产物跳过 Agent 执行，节省时间和 token。

### 实现架构

#### 后端（Go Orchestrator）

- `db/queries.go`：
  - `GetPreviousFlowCompletedNodes` — 获取前一个 flow 的所有已完成节点输出
  - `UpdateNodeRunOutputRaw` — 直接写入 output JSON
  - `HasPreviousFlowOutput` — 检查某节点是否有可复用的历史输出
- `engine/dag.go`：
  - `HandleSkipNode` — 跳过节点，注入历史输出，标记完成，触发 advanceDAG
  - `advanceDAG` 中增加级联复用检查：激活 `agent_task` 节点时，如果有历史输出，设为 `waiting_human` 而非 `queued`，防止调度器自动拾取
  - `writeSkippedArtifactToGit` — 复用时也写入 git
- `grpc/server.go`：`SkipNode` RPC 方法
- `grpc/pb/orchestrator_grpc.pb.go`：手动添加 `SkipNode` 方法（未用 protoc 生成）

#### API（Fastify）

- `routes/node-runs.ts`：
  - `GET /:id/previous-output` — 查询历史产物（innerJoin 所有历史 flow）
  - `POST /:id/skip` — 跳过节点（调用 gRPC SkipNode）
  - `POST /:id/proceed` — 继续执行（将 `waiting_human` 改为 `queued`，清除 `_reuse_available` 标记）
- `grpc/client.ts`：`skipNode` 函数

#### 前端（React）

- `flow-tab.tsx`：
  - 自动检查每个 `queued` / `waiting_human` 节点是否有可复用的历史输出
  - 蓝色"复用历史产物"按钮 — 调用 skip API
  - 绿色"继续执行"按钮 — 调用 proceed API（仅对被暂停的 agent_task 节点显示）

### 级联复用流程

```
用户跳过"输入需求" → advanceDAG 检查"Agent 分析需求"
  → 有历史输出 → 设为 waiting_human + _reuse_available
  → 前端显示"复用历史产物"+"继续执行"两个按钮
  → 用户选择复用 → HandleSkipNode → advanceDAG → "Review PRD" 正常进行
  → Review 通过 → advanceDAG 检查"拆解 User Story"
  → 有历史输出 → 同样暂停等待用户选择
```

---

## 四、YAML 模板变更记录

### 简化输入表单

原来 4 个字段（requirement_text, business_goal, target_users, deadline）→ 简化为 1 个 textarea（requirement_text）。

### 添加产物文件路径

```yaml
artifact:
  type: prd
  title: "..."
  file_path: "docs/prd.md"    # 新增：写入 git 的文件路径
```

### Prompt 模板简化

移除了对 business_goal / target_users / deadline 的引用，保留 `{% if %}` fallback 兼容旧数据。

---

## 五、注意事项

1. **修改 YAML 模板后必须同步三处 DB**：`workflow_templates.template`、`workflows.dsl`、活跃的 `flow_runs.dsl_snapshot`
2. **修改 Go 代码后需要重启 orchestrator**：`pnpm dev` 不会自动热重载 Go 服务
3. **修改 entrypoint.sh 后需要重建 Docker 镜像**：`cd docker/agent-droid && docker build -t workgear/agent-droid:latest .`
4. **清理坏的历史产物**：如果历史产物内容有误，需要手动清除 `node_runs.output`，否则复用功能会注入错误内容
5. **gRPC proto 变更**：当前 proto 变更是手动 patch pb 文件，未使用 protoc 生成。如果后续需要 protoc 生成，需要确保手动添加的方法不被覆盖
6. **Git 推送依赖项目配置**：项目需要配置 `git_repo_url` 和 `git_access_token`，否则产物无法推送到远端

---

## 六、当前未修改文件的变更清单（未提交）

```
docker/agent-droid/entrypoint.sh          — spec mode ACP_MODE 修复
packages/api/src/grpc/client.ts           — skipNode gRPC 客户端
packages/api/src/routes/node-runs.ts      — previous-output / skip / proceed API
packages/api/src/seeds/templates/requirement-analysis.yaml — 简化表单 + file_path
packages/orchestrator/internal/agent/*    — BareRepoPath + Docker 挂载
packages/orchestrator/internal/db/queries.go — 复用相关查询
packages/orchestrator/internal/engine/dag.go — HandleSkipNode + 级联复用 + git 写入
packages/orchestrator/internal/engine/dsl_parser.go — FilePath 字段
packages/orchestrator/internal/engine/node_handlers.go — spec 模式 git 写入
packages/orchestrator/internal/grpc/*     — SkipNode RPC
packages/shared/proto/orchestrator.proto  — SkipNode 定义
packages/web/src/pages/kanban/task-detail/flow-tab.tsx — 复用 UI
```
