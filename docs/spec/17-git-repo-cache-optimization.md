# 17. Git 仓库缓存优化：项目级共享 Volume + Worktree

> **日期**: 2026-02-17
> **状态**: 设计中
> **前置条件**: Phase 4（真实 Agent 调用）已完成

---

## 1. 问题分析

### 1.1 现状

当前架构中，每个 Agent 任务执行时都会：

1. 启动新的 Docker 容器
2. 在容器内执行 `git clone --depth 50` 完整克隆项目
3. 执行 Agent 任务（claude / codex / droid）
4. `git commit && git push`
5. 销毁容器

### 1.2 问题

| 问题 | 影响 |
|------|------|
| 每次 clone 完整项目 | 大型项目（几百 MB）耗时 30-60 秒 |
| 网络带宽消耗 | 同一项目重复传输相同数据 |
| 依赖重复安装 | `pnpm install` / `npm install` 每次从零开始 |
| 同一 Task 多节点无法共享状态 | analyze → develop → review 每个节点独立 clone |

### 1.3 优化目标

- 大型项目的 Git 准备时间从 30-60s 降到 2-5s（减少 90%）
- 同一 Task 的多个串行节点共享工作目录和 Git 状态
- 依赖安装利用缓存，避免重复下载

---

## 2. 方案概述

采用 **项目级 bare repo + FlowRun 级 integration ref + NodeRun 级 worktree + 项目级依赖缓存** 四层架构：

```
宿主机:
  /var/lib/workgear/repos/
    ├── project-{uuid-1}/
    │   ├── bare.git/                    ← bare repo（共享 Git 对象库）
    │   ├── refs/
    │   │   └── flows/
    │   │       └── {flow-run-id}/
    │   │           └── integration      ← FlowRun 集成 ref（仅宿主机更新）
    │   ├── worktrees/
    │   │   └── flow-{run-id-1}/
    │   │       ├── node-{node-run-id-a}/ ← Node A 独立 worktree（读写）
    │   │       ├── node-{node-run-id-b}/ ← Node B 独立 worktree（可并行）
    │   │       └── ...
    │   │   └── ...
    │   └── deps/                        ← 项目依赖缓存
    │       ├── pnpm-store/
    │       ├── npm-cache/
    │       └── ...
    └── project-{uuid-2}/
        └── ...
```

### 2.1 四层职责

| 层 | 粒度 | 生命周期 | 说明 |
|----|------|---------|------|
| bare repo | 项目级 | 项目存在期间 | 共享 Git 对象库，所有 FlowRun 共用 |
| integration ref | FlowRun 级 | FlowRun 开始 → 结束 | FlowRun 的统一代码视图（提交集成目标） |
| worktree | NodeRun 级 | NodeRun 开始 → 结束 | 独立工作目录，支持同一 FlowRun 并行 agent_task |
| deps | 项目级 | 项目存在期间 | 依赖缓存，所有 FlowRun 共用 |

---

## 3. 核心问题与解决方案

### 3.1 Worktree 写入权限

**问题**：如果 bare repo 以只读方式挂载到容器，容器内无法执行 `git worktree add`（需要写入 bare repo 的 `.git/worktrees/` 目录）。

**解决方案**：宿主机侧预创建 worktree。

- RepoManager 在宿主机上执行 `git worktree add`，为每个 `node_run` 生成独立工作目录
- 将 worktree 目录以**读写**方式挂载到容器的 `/workspace`
- 容器内只做 `git add / commit`（worktree 包含完整工作树和 `.git` 文件）
- 集成与 push 由宿主机侧统一执行，避免并行节点抢写同一远端分支

```
宿主机 RepoManager:
  git -C bare.git worktree add ../worktrees/flow-xxx/node-yyy <base-sha>

Docker 容器:
  mount: worktrees/flow-xxx/node-yyy → /workspace (rw)
  容器内: cd /workspace && git add -A && git commit
```

### 3.2 多个 Agent 共享 PR 分支

**场景**：同一 Task 的多个 `agent_task` 节点可串行也可并行执行，最终都要汇聚到同一个 PR 分支。

**解决方案**：`NodeRun` 独立 worktree + `FlowRun` integration ref。

- 每个 `agent_task` 节点创建独立 worktree，互不干扰
- FlowRun 维护 `integration_head_sha`，作为节点启动时的基线
- 节点完成后只产出自己的 commit，不直接写共享目录
- Orchestrator 在 `flow` 级锁内将节点 commit 集成到 `integration ref`
- 仅 `integration ref` 对应的 feature branch 推送到远端（统一 PR 分支）

```
FlowRun flow-abc:
  Integration head: H0
  Node A: worktree(node-a, base=H0) → commit CA
  Node B: worktree(node-b, base=H0) → commit CB (可与 A 并行)
  Integrate: CA -> H1, CB -> H2 (flow 锁内串行集成)
  Push: integration(H2) -> origin/feature/xxx
  FlowRun 结束: 清理 node worktrees + integration ref
```

### 3.3 依赖缓存管理

**策略**：当前版本仅自动检测（后续可扩展项目级配置）。

**自动检测逻辑**（entrypoint.sh 根据 lock 文件判断）：

| Lock 文件 | 包管理器 | 缓存路径 |
|-----------|---------|---------|
| `pnpm-lock.yaml` | pnpm | `/deps/pnpm-store` |
| `package-lock.json` | npm | `/deps/npm-cache` |
| `yarn.lock` | yarn | `/deps/yarn-cache` |
| `requirements.txt` / `Pipfile.lock` | pip | `/deps/pip-cache` |
| `go.mod` | go modules | `/deps/go-mod` + `/deps/go-build-cache` |

当前版本先采用 lock 文件自动检测，不引入新的项目配置字段。

### 3.4 并发安全

**场景**：多个 Task 可能同时操作同一个项目。

| 操作 | 并发风险 | 解决方案 |
|------|---------|---------|
| `git fetch`（更新 bare repo） | 并发 fetch 可能冲突 | RepoManager 内存锁（`sync.Mutex` per project） |
| `git worktree add`（node 目录） | 需要写入 bare repo 的 worktrees 目录 | 由 RepoManager 串行执行（共享项目锁） |
| `integration ref` 更新 | 多个并行节点同时集成 | `sync.Mutex` per flow 串行化 |
| worktree 内的 git 操作 | 每个 NodeRun 独立 worktree | 无冲突 |
| 依赖缓存读写 | 多个容器可能同时写入 | pnpm/npm 等工具自身支持并发安全 |

```go
type RepoManager struct {
    baseDir      string
    projectLocks map[string]*sync.Mutex  // 每个项目一个锁
    flowLocks    map[string]*sync.Mutex  // 每个 flow 一个锁（集成提交）
    mu           sync.Mutex              // 保护 projectLocks map
}
```

---

## 4. 架构设计

### 4.1 数据流

```
executeAgentTask(nodeRun)
  ├─ RepoManager.EnsureBareRepo(projectID)
  ├─ RepoManager.EnsureFlowIntegration(projectID, flowRunID)
  ├─ RepoManager.EnsureNodeWorktree(projectID, flowRunID, nodeRunID, baseSHA)
  ├─ DockerExecutor(挂载 node worktree + deps)
  │   └─ 容器内执行 Agent -> 产出 node commit SHA（不直接 push 共享分支）
  ├─ RepoManager.IntegrateNodeCommit(projectID, flowRunID, nodeRunID, commitSHA) [flow lock]
  │   ├─ 成功：更新 integration_head_sha
  │   └─ 冲突：node 标记 failed_conflict，等待人工处理
  ├─ Push integration branch 到远端 feature branch（可立即推，也可 flow 结束统一推）
  └─ RepoManager.CleanupNodeWorktree(projectID, flowRunID, nodeRunID)
```

### 4.2 生命周期

```
项目创建
  │
  ▼
首次 Agent 执行 ──→ EnsureBareRepo() ──→ git clone --bare
  │                                          │
  ▼                                          ▼
FlowRun 启动                            bare.git 持久化
  │
  ▼
创建 integration ref (指向 base SHA)
  │
  ├─ Node A 启动 ──→ EnsureNodeWorktree(nodeA, base=integration head)
  ├─ Node B 启动 ──→ EnsureNodeWorktree(nodeB, base=integration head) (可并行)
  │
  ▼
Node 完成后集成 ──→ IntegrateNodeCommit() ──→ integration head 前进
  │
  ▼
FlowRun 结束 ──→ CleanupFlowState() ──→ 清理 node worktrees + integration ref
  │
  ▼
后续 FlowRun ──→ EnsureBareRepo() ──→ git fetch (增量更新)
  │
  ▼
项目删除 ──→ 清理整个 project-{uuid}/ 目录
```

### 4.3 同一 FlowRun 多节点并行示意

```
FlowRun flow-abc (Task: 实现用户登录)
  │
  ├─ Integration: refs/flows/flow-abc/integration = H0
  │
  ├─ Node 1: analyze (requirement-analyst)
  │   ├─ 创建 worktree: worktrees/flow-abc/node-1/ ← base H0
  │   ├─ 挂载到容器 /workspace
  │   ├─ Agent 分析需求，生成 spec 文件
  │   ├─ 产出 commit C1
  │   └─ IntegrateNodeCommit(C1) → integration = H1
  │
  ├─ Node 2: develop (general-developer)
  │   ├─ 创建 worktree: worktrees/flow-abc/node-2/ ← base H1
  │   ├─ 挂载到容器 /workspace
  │   ├─ Agent 开发代码，产出 commit C2
  │   └─ 等待集成
  │
  ├─ Node 3: security-fix (security-engineer)  // 与 Node2 并行
  │   ├─ 创建 worktree: worktrees/flow-abc/node-3/ ← base H1
  │   ├─ 挂载到容器 /workspace
  │   ├─ Agent 修复安全问题，产出 commit C3
  │   └─ 等待集成
  │
  ├─ 集成阶段（flow lock 串行）:
  │   ├─ 集成 C2 -> H2
  │   ├─ 集成 C3 -> H3 (冲突则标记 failed_conflict)
  │   └─ push H3 -> origin/feature/login
  │
  └─ FlowRun completed → CleanupFlowState("flow-abc")
```

---

## 5. RepoManager 模块设计

### 5.1 接口定义

```go
// packages/orchestrator/internal/repo/manager.go
package repo

type RepoManager struct {
    baseDir      string                  // /var/lib/workgear/repos
    logger       *zap.SugaredLogger
    projectLocks map[string]*sync.Mutex  // 每个项目一个锁
    flowLocks    map[string]*sync.Mutex  // 每个 flow 一个锁（integration 提交）
    mu           sync.Mutex              // 保护 lock map
}

// NewRepoManager 创建 RepoManager 实例
func NewRepoManager(baseDir string, logger *zap.SugaredLogger) *RepoManager

// EnsureBareRepo 确保项目 bare repo 存在并完成增量更新
func (m *RepoManager) EnsureBareRepo(
    ctx context.Context,
    projectID, repoURL, accessToken string,
) (bareRepoPath string, err error)

// EnsureFlowIntegration 确保 flow integration ref 存在并返回当前 head
func (m *RepoManager) EnsureFlowIntegration(
    ctx context.Context,
    projectID, flowRunID, baseBranch, featureBranch string,
) (integrationRef string, headSHA string, err error)

// EnsureNodeWorktree 创建 node 独立 worktree（基于指定 base SHA）
func (m *RepoManager) EnsureNodeWorktree(
    ctx context.Context,
    projectID, flowRunID, nodeRunID, baseSHA string,
) (worktreePath string, err error)

// IntegrateNodeCommit 将 node commit 集成到 flow integration ref（flow 锁内串行）
func (m *RepoManager) IntegrateNodeCommit(
    ctx context.Context,
    projectID, flowRunID, nodeRunID, commitSHA string,
) (newHeadSHA string, err error)

// CleanupNodeWorktree 清理单个 node 的 worktree
func (m *RepoManager) CleanupNodeWorktree(
    ctx context.Context,
    projectID, flowRunID, nodeRunID string,
) error

// CleanupFlowState 清理 flow 级状态（integration ref + 空目录）
func (m *RepoManager) CleanupFlowState(
    ctx context.Context,
    projectID, flowRunID string,
) error

// GetDepsPath 返回项目的依赖缓存路径（自动创建目录）
func (m *RepoManager) GetDepsPath(projectID string) string

// CleanupProject 清理项目的所有缓存（项目删除时调用）
func (m *RepoManager) CleanupProject(ctx context.Context, projectID string) error
```

### 5.2 锁策略

```go
func (m *RepoManager) getProjectLock(projectID string) *sync.Mutex {
    m.mu.Lock()
    defer m.mu.Unlock()
    lock, ok := m.projectLocks[projectID]
    if !ok {
        lock = &sync.Mutex{}
        m.projectLocks[projectID] = lock
    }
    return lock
}

func (m *RepoManager) getFlowLock(flowRunID string) *sync.Mutex {
    m.mu.Lock()
    defer m.mu.Unlock()
    lock, ok := m.flowLocks[flowRunID]
    if !ok {
        lock = &sync.Mutex{}
        m.flowLocks[flowRunID] = lock
    }
    return lock
}

// 注意：project lock 只保护 bare repo 读写；flow lock 只保护 integration 提交
func (m *RepoManager) IntegrateNodeCommit(...) (string, error) {
    flowLock := m.getFlowLock(flowRunID)
    flowLock.Lock()
    defer flowLock.Unlock()
    // 1) checkout integration ref
    // 2) cherry-pick node commit
    // 3) 更新 integration_head_sha
    // 4) 按策略 push feature branch
}
```

### 5.3 Git Token 注入

Token 注入采用单点策略，避免重复注入：

- `repoURL` 在进入 RepoManager 前必须是“未注入 token 的原始 URL”
- RepoManager 内部统一构建认证 URL（仅用于 git 命令执行，不落库）
- 日志输出的 URL 必须脱敏（不包含 token）

### 5.4 Worktree 内的 Remote URL 处理

node worktree 创建后，其 `origin` 可能指向 bare repo 本地路径。容器内仍需将 `origin` 设置为远程仓库 URL：

```bash
# 容器内：将 remote 指向真实的远程仓库
if [ -n "$GIT_REPO_URL" ]; then
    git remote set-url origin "$GIT_REPO_URL"
fi
```

---

## 6. DockerExecutor 改动

### 6.1 ExecutorRequest 扩展

```go
// packages/orchestrator/internal/agent/adapter.go
type ExecutorRequest struct {
    Image          string
    Command        []string
    Env            map[string]string
    WorkDir        string
    Timeout        time.Duration
    OnLogEvent     LogEventCallback
    
    // 新增：volume 挂载
    WorktreePath   string // 宿主机 node worktree 路径（如 /var/lib/workgear/repos/project-xxx/worktrees/flow-yyy/node-zzz）
    DepsPath       string // 宿主机依赖缓存路径（如 /var/lib/workgear/repos/project-xxx/deps）
}
```

### 6.2 DockerExecutor.Execute 修改

```go
// packages/orchestrator/internal/agent/executor.go
func (e *DockerExecutor) Execute(ctx context.Context, req *ExecutorRequest) (*ExecutorResponse, error) {
    // ... 现有逻辑：构建 containerConfig、envList 等
    
    // 构建 volume 挂载
    binds := []string{}
    if req.WorktreePath != "" {
        binds = append(binds, req.WorktreePath+":/workspace:rw")
        req.Env["USE_WORKTREE"] = "true"
        e.logger.Debugw("Mounting worktree", "host_path", req.WorktreePath)
    }
    if req.DepsPath != "" {
        binds = append(binds, req.DepsPath+":/deps:rw")
        e.logger.Debugw("Mounting deps cache", "host_path", req.DepsPath)
    }
    
    hostConfig := &container.HostConfig{
        Binds: binds,
    }
    
    createResp, err := e.cli.ContainerCreate(execCtx, containerConfig, hostConfig, nil, nil, containerName)
    // ... 其余逻辑不变
}
```

### 6.3 Git Metadata 回传契约（必须包含 commit）

并行集成依赖容器返回 `nodeCommitSHA`，链路如下：

`entrypoint.sh` → `/output/git_metadata.json` → `DockerExecutor.extractGitMetadata()` → `AgentResponse.GitMetadata` → `executeAgentTask`。

约束：

- `git_metadata.json.commit` 为必填（当节点产生代码变更并执行 commit 时）
- Orchestrator 仅在拿到 `commit` 后调用 `IntegrateNodeCommit(...)`
- 若节点有代码变更但 `commit` 为空，节点应标记失败（数据不完整），不得进入集成流程

示例：

```json
{
  "branch": "feature/login",
  "commit": "a1b2c3d4e5f6",
  "commit_message": "feat: implement login",
  "changed_files": ["packages/api/src/routes/auth.ts"]
}
```

### 6.4 验收测试点（DockerExecutor.extractGitMetadata）

建议在 `packages/orchestrator/internal/agent/executor.go` 对 `extractGitMetadata()` 增加以下测试：

| 用例 | 容器内 `/output/git_metadata.json` | 期望结果 |
|------|-------------------------------------|----------|
| 正常提交 | `{"branch":"x","commit":"abc123"}` | 返回 `GitMetadata{Commit:"abc123"}` |
| 无 Git 操作 | `{}` | 返回 `nil`（跳过集成） |
| 仅 branch 无 commit | `{"branch":"x"}` | 返回 `GitMetadata`（但后续 `node_handlers` 必须判定为 metadata incomplete） |
| 文件不存在 | 无该文件 | 返回 `nil`，记录 debug 日志 |
| 非法 JSON | `"{invalid"` | 返回 `nil`，记录 warn 日志 |
| tar 读取失败 | CopyFromContainer 返回损坏流 | 返回 `nil`，记录 warn 日志 |

建议在 `packages/orchestrator/internal/engine/node_handlers.go` 增加契约测试：

| 用例 | AgentResponse.GitMetadata | 期望结果 |
|------|----------------------------|----------|
| 有变更且 commit 存在 | `commit="abc123"` | 调用 `IntegrateNodeCommit` |
| 有变更但 commit 缺失 | `commit=""` | 节点失败（`metadata incomplete`），不调用 `IntegrateNodeCommit` |
| 无变更 | `nil` 或空对象 | 跳过集成，流程继续 |

---

## 7. node_handlers.go 改动

### 7.1 executeAgentTask 集成 RepoManager

```go
// packages/orchestrator/internal/engine/node_handlers.go
func (e *FlowExecutor) executeAgentTask(ctx context.Context, nodeRun *db.NodeRun) error {
    // 0) 获取 task + project git 信息（需返回 projectID）
    // 1) EnsureBareRepo(projectID, repoURL, token)
    // 2) EnsureFlowIntegration(projectID, flowRunID, baseBranch, featureBranch) -> baseSHA
    // 3) EnsureNodeWorktree(projectID, flowRunID, nodeRunID, baseSHA) -> worktreePath
    // 4) 构建并执行 Agent（挂载 worktreePath + depsPath）
    // 5) 从执行结果提取 nodeCommitSHA（resp.GitMetadata.Commit）
    //    - commit 为空：节点失败，返回 metadata incomplete
    // 6) IntegrateNodeCommit(projectID, flowRunID, nodeRunID, nodeCommitSHA)
    // 7) 更新 node_runs.commit_sha / base_sha / flow_runs.integration_head_sha
    // 8) CleanupNodeWorktree(projectID, flowRunID, nodeRunID)
    // 9) 其余现有逻辑保持：产物、timeline、事件发布
}
```

### 7.2 FlowExecutor 初始化

```go
// packages/orchestrator/internal/engine/executor.go
type FlowExecutor struct {
    db          *db.Client
    eventBus    *event.Bus
    registry    *agent.Registry
    logger      *zap.SugaredLogger
    workerID    string
    repoManager *repo.RepoManager // 新增
    // ... 其他字段
}

func NewFlowExecutor(
    dbClient *db.Client,
    eventBus *event.Bus,
    registry *agent.Registry,
    logger *zap.SugaredLogger,
    maxConcurrency int,
    repoManager *repo.RepoManager, // 新增参数
) *FlowExecutor {
    // ...
    return &FlowExecutor{
        // ...
        repoManager: repoManager,
    }
}
```

### 7.3 FlowRun 结束时清理 flow state

```go
// packages/orchestrator/internal/engine/dag.go
func (e *FlowExecutor) advanceDAG(ctx context.Context, flowRunID string) error {
    // ... 现有逻辑：检测所有节点是否完成并写入最终状态

    if allTerminal {
        // 清理 flow 级状态（integration ref + 残留 node worktree）
        if e.repoManager != nil {
            // 注意：只有在该 flow 的容器全部退出后才触发 cleanup
            // 防止删除仍被容器使用的挂载目录
            go e.cleanupFlowStateWhenContainersStopped(flowRunID)
        }
    }

    return nil
}
```

### 7.4 CancelFlow 时清理策略

```go
// packages/orchestrator/internal/engine/dag.go
func (e *FlowExecutor) CancelFlow(ctx context.Context, flowRunID string) error {
    // 1) 先 cancel 所有运行中节点（让容器退出）
    // 2) 更新 flow 状态为 cancelled
    // 3) 容器退出后异步执行 CleanupFlowState（不要立即删目录）
    if e.repoManager != nil {
        go e.cleanupFlowStateWhenContainersStopped(flowRunID)
    }
    return nil
}
```

---

## 8. entrypoint.sh 改动

### 8.1 Worktree 模式支持

```bash
# docker/agent-claude/entrypoint.sh (同样适用于 agent-codex、agent-droid)

# ─── Step 1: Setup workspace ───
if [ "$USE_WORKTREE" = "true" ]; then
    echo "[agent] Using node worktree: /workspace"
    cd /workspace

    # worktree 已由宿主机创建，直接使用
    git config --global user.email "agent@workgear.dev"
    git config --global user.name "WorkGear Agent"

    # worktree 的 origin 可能指向 bare repo 本地路径，需重设为远端
    if [ -n "$GIT_REPO_URL" ]; then
        git remote set-url origin "$GIT_REPO_URL"
    fi

    # 不在容器内做共享分支同步；基线由宿主机创建 worktree 时固定
    echo "[agent] Node worktree ready: $(git rev-parse --short HEAD)"

elif [ -n "$GIT_REPO_URL" ]; then
    # 降级：传统 clone 方式（兼容旧逻辑）
    echo "[agent] Worktree not available, falling back to git clone"
    BRANCH="${GIT_BRANCH:-main}"
    git config --global user.email "agent@workgear.dev"
    git config --global user.name "WorkGear Agent"
    git clone "$GIT_REPO_URL" --branch "$BRANCH" --single-branch --depth 50 /workspace 2>&1 || {
        echo "[agent] Failed to clone branch $BRANCH, trying default branch..."
        git clone "$GIT_REPO_URL" --single-branch --depth 50 /workspace 2>&1
        cd /workspace
        git checkout -b "$BRANCH"
    }
    cd /workspace
else
    echo "[agent] No git repo configured"
    cd /workspace
fi
```

### 8.2 依赖缓存自动检测

```bash
# ─── Step 1.5: Setup dependency cache ───
if [ -d "/deps" ]; then
    echo "[agent] Configuring dependency cache: /deps"
    
    # 自动检测项目类型
    if [ -f "pnpm-lock.yaml" ]; then
        echo "[agent] Detected pnpm project"
        export PNPM_HOME="/deps/pnpm"
        mkdir -p "$PNPM_HOME"
        pnpm config set store-dir "/deps/pnpm-store"
        echo "[agent] pnpm store: /deps/pnpm-store"
        
    elif [ -f "package-lock.json" ]; then
        echo "[agent] Detected npm project"
        npm config set cache "/deps/npm-cache"
        echo "[agent] npm cache: /deps/npm-cache"
        
    elif [ -f "yarn.lock" ]; then
        echo "[agent] Detected yarn project"
        export YARN_CACHE_FOLDER="/deps/yarn-cache"
        mkdir -p "$YARN_CACHE_FOLDER"
        echo "[agent] yarn cache: /deps/yarn-cache"
        
    elif [ -f "requirements.txt" ] || [ -f "Pipfile.lock" ]; then
        echo "[agent] Detected Python project"
        export PIP_CACHE_DIR="/deps/pip-cache"
        mkdir -p "$PIP_CACHE_DIR"
        echo "[agent] pip cache: /deps/pip-cache"
        
    elif [ -f "go.mod" ]; then
        echo "[agent] Detected Go project"
        export GOMODCACHE="/deps/go-mod"
        export GOCACHE="/deps/go-build-cache"
        mkdir -p "$GOMODCACHE" "$GOCACHE"
        echo "[agent] GOMODCACHE: /deps/go-mod"
        echo "[agent] GOCACHE: /deps/go-build-cache"
    else
        echo "[agent] No recognized lock file, skipping dependency cache setup"
    fi
fi
```

### 8.3 Git Push 逻辑调整

```bash
# ─── Step 3: Git commit & push (execute / opsx modes) ───
# 并行模式建议：
# 1) 容器内默认只 commit（设置 GIT_PUSH_DISABLED=true）
# 2) 由 orchestrator 在 IntegrateNodeCommit 后统一 push integration 分支
```

### 8.4 git_metadata.json 字段要求

容器在完成 commit 后必须写入 `/output/git_metadata.json`，至少包含：

- `commit`: 当前 node worktree 的最新提交 SHA（必填）
- `branch`: 节点工作分支（建议填）
- `commit_message`: 提交信息（建议填）
- `changed_files`: 变更文件列表（可选）

如果节点未产生变更，可保留空对象 `{}`，Orchestrator 将跳过集成。

---

## 9. 数据库扩展

### 9.1 Schema 修改

```typescript
// packages/api/src/db/schema.ts

export const projects = pgTable('projects', {
  // ... 现有字段
  bareRepoPath: varchar('bare_repo_path', { length: 500 }), // 新增
})

export const flowRuns = pgTable('flow_runs', {
  // ... 现有字段
  integrationRef: varchar('integration_ref', { length: 500 }),    // 新增
  integrationHeadSha: varchar('integration_head_sha', { length: 100 }), // 新增
})

export const nodeRuns = pgTable('node_runs', {
  // ... 现有字段
  baseSha: varchar('base_sha', { length: 100 }),       // 新增：节点基线
  commitSha: varchar('commit_sha', { length: 100 }),   // 新增：节点产出提交
  worktreePath: varchar('worktree_path', { length: 500 }), // 新增：节点 worktree 路径
})
```

### 9.2 数据库迁移

```sql
-- packages/api/src/db/migrations/XXXX_add_repo_cache/migration.sql

-- 项目表新增 bare_repo_path
ALTER TABLE projects ADD COLUMN bare_repo_path VARCHAR(500);

-- flow_runs 表新增 integration 字段
ALTER TABLE flow_runs ADD COLUMN integration_ref VARCHAR(500);
ALTER TABLE flow_runs ADD COLUMN integration_head_sha VARCHAR(100);

-- node_runs 表新增节点 git 运行时字段
ALTER TABLE node_runs ADD COLUMN base_sha VARCHAR(100);
ALTER TABLE node_runs ADD COLUMN commit_sha VARCHAR(100);
ALTER TABLE node_runs ADD COLUMN worktree_path VARCHAR(500);

-- 索引（可选，用于清理查询）
CREATE INDEX idx_node_runs_worktree_path ON node_runs(worktree_path) WHERE worktree_path IS NOT NULL;
CREATE INDEX idx_node_runs_commit_sha ON node_runs(commit_sha) WHERE commit_sha IS NOT NULL;
```

### 9.3 DB Client 新增方法

```go
// packages/orchestrator/internal/db/queries.go

// UpdateFlowRunIntegration 更新 FlowRun integration 状态
func (c *Client) UpdateFlowRunIntegration(ctx context.Context, flowRunID, integrationRef, headSHA string) error {
    _, err := c.pool.Exec(ctx, `
        UPDATE flow_runs
        SET integration_ref = $1, integration_head_sha = $2
        WHERE id = $3
    `, integrationRef, headSHA, flowRunID)
    return err
}

// UpdateNodeRunGitState 更新 node git 执行状态
func (c *Client) UpdateNodeRunGitState(ctx context.Context, nodeRunID, baseSHA, commitSHA, worktreePath string) error {
    _, err := c.pool.Exec(ctx, `
        UPDATE node_runs
        SET base_sha = $1, commit_sha = $2, worktree_path = $3
        WHERE id = $4
    `, baseSHA, commitSHA, worktreePath, nodeRunID)
    return err
}
```

---

## 10. 文件清单

### 10.1 新增文件

| 文件 | 说明 |
|------|------|
| `packages/orchestrator/internal/repo/manager.go` | RepoManager 实现 |
| `packages/orchestrator/internal/repo/manager_test.go` | 单元测试 |
| `packages/api/src/db/migrations/XXXX_add_repo_cache/migration.sql` | 数据库迁移 |

### 10.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `packages/api/src/db/schema.ts` | 新增 `bareRepoPath`、`integrationRef`、`integrationHeadSha`、`nodeRuns` Git 字段 |
| `packages/orchestrator/internal/agent/adapter.go` | ExecutorRequest 新增 `WorktreePath` 和 `DepsPath` 字段 |
| `packages/orchestrator/internal/agent/executor.go` | DockerExecutor 支持 volume 挂载 |
| `packages/orchestrator/internal/engine/executor.go` | FlowExecutor 新增 `repoManager` 字段，初始化逻辑 |
| `packages/orchestrator/internal/engine/node_handlers.go` | executeAgentTask 调用 RepoManager，节点完成后集成提交 |
| `packages/orchestrator/internal/engine/dag.go` | FlowRun 结束后清理 flow state |
| `packages/orchestrator/internal/db/queries.go` | 新增 `UpdateFlowRunIntegration` / `UpdateNodeRunGitState` |
| `packages/orchestrator/cmd/server/main.go` | 初始化 RepoManager 并传递给 FlowExecutor |
| `docker/agent-claude/entrypoint.sh` | 支持 worktree 模式 + 依赖缓存自动检测 |
| `docker/agent-codex/entrypoint.sh` | 同上 |
| `docker/agent-droid/entrypoint.sh` | 同上 |

---

## 11. 兼容性与降级策略

### 11.1 向后兼容

- **环境变量控制**：如果 `USE_WORKTREE` 未设置，entrypoint.sh 自动降级到传统 `git clone` 方式
- **RepoManager 可选**：如果 `FlowExecutor.repoManager` 为 nil，跳过优化逻辑，使用原有流程
- **渐进式迁移**：现有项目首次执行时自动创建 bare repo；并行集成能力逐步灰度启用

### 11.2 降级场景

| 场景 | 降级行为 |
|------|---------|
| RepoManager 初始化失败 | FlowExecutor.repoManager = nil，所有 Agent 使用传统 clone |
| EnsureBareRepo 失败 | 记录 warn 日志，worktreePath 为空，容器内 clone |
| EnsureNodeWorktree 失败 | 记录 warn 日志，worktreePath 为空，容器内 clone |
| IntegrateNodeCommit 失败 | 节点标记 `failed_conflict` 或 `failed`，停止自动集成，等待人工处理 |
| 容器内未检测到 USE_WORKTREE | 执行传统 git clone 逻辑 |

### 11.3 无需前端改动

- 对用户完全透明
- API 接口不变
- 前端无需感知 worktree 机制

---

## 12. 风险与限制

### 12.1 磁盘空间

- **bare repo**：每个项目约等于项目大小（一次性）
- **worktree**：每个活跃 NodeRun 一份工作树（临时，节点完成后优先清理）
- **依赖缓存**：每个项目一份（持久化，节省后续安装时间）

**预估**：100 个项目，平均 500MB，同时 10 个活跃 FlowRun、每个平均 2 个并行节点：
- bare repo: 100 × 500MB = 50GB
- worktree: 20 × 500MB = 10GB
- deps: 100 × 200MB = 20GB
- **总计**: ~80GB

### 12.2 并发安全

- **已解决**：project lock 保护 fetch/worktree add，flow lock 保护 integration 提交
- **依赖缓存**：pnpm/npm 等工具自身支持并发安全

### 12.3 权限管理

- **宿主机目录权限**：`/var/lib/workgear/repos` 需要 Orchestrator 进程有读写权限
- **容器内权限**：agent 用户（非 root）需要对挂载的 worktree 和 deps 目录有读写权限
- **解决方案**：宿主机创建目录时使用固定 UID/GID + 最小权限（如 `0750/0770`），避免 `chmod 777`

### 12.4 Worktree 泄漏

**场景**：Orchestrator 异常退出（如 SIGKILL），NodeRun/FlowRun 未正常结束，worktree 或 integration ref 未清理。

**解决方案**：
- 定时清理任务：扫描 `worktrees/` 目录，删除超过 N 天未使用的 node worktree
- 启动时恢复：检查 DB 中已结束的 FlowRun，清理对应的 node worktree 与 integration ref

```go
// 启动时清理孤儿状态
func (m *RepoManager) CleanupOrphanFlowState(ctx context.Context, db *db.Client) error {
    // 1. 扫描所有 worktree 目录
    // 2. 查询 DB 中对应的 FlowRun / NodeRun 状态
    // 3. Flow 已结束则清理 node worktree + integration ref
}
```

### 12.5 Git 冲突

**场景**：同一 FlowRun 的多个节点并行开发，集成时可能发生冲突。

**解决方案**：
- 在 `IntegrateNodeCommit` 阶段（flow lock 内）执行 `cherry-pick` / `merge`
- 冲突时节点标记 `failed_conflict`，记录冲突详情并触发人工处理
- 未冲突的节点继续集成，不影响整个 flow 的可观测性

---

## 13. 后续优化方向（不在本次范围）

### 13.1 定时清理孤儿 worktree

```go
// 定时任务：每小时扫描一次
func (m *RepoManager) CleanupStaleWorktrees(ctx context.Context, maxAge time.Duration) error {
    // 扫描 node worktree 目录，删除超过 maxAge 未修改的目录
    // 同步清理无效 integration ref
}
```

### 13.2 支持 Sparse Checkout

对于超大型项目（如 monorepo），只检出 Agent 需要的子目录：

```yaml
# DSL 中配置
agent_task:
  sparse_checkout:
    - packages/web
    - packages/api
```

### 13.3 持久化 Agent 容器

避免每次启动容器的开销（~1-2 秒）：

- 为每个项目维护一个长期运行的 Agent 容器
- 通过 exec 方式执行任务，而非每次创建新容器

### 13.4 跨项目共享 Git 对象池

通过 `git alternates` 机制，多个项目共享同一个对象存储：

```
/var/lib/workgear/repos/
  ├── shared-objects/          ← 共享对象池
  └── project-xxx/
      └── bare.git/
          └── objects/info/alternates → ../../shared-objects
```

---

## 14. 实施步骤

### Phase 1: 基础设施（1-2 天）

1. 创建 `repo/manager.go` 模块
2. 数据库迁移（新增字段）
3. 单元测试

### Phase 2: Orchestrator 集成（2-3 天）

1. 修改 `DockerExecutor` 支持 volume 挂载
2. 修改 `node_handlers.go` 调用 RepoManager
3. 实现 `IntegrateNodeCommit`（flow 锁内串行集成）
4. 修改 `dag.go` 在 FlowRun 结束后清理 flow state
5. 初始化逻辑

### Phase 3: 容器镜像更新（1 天）

1. 修改 `entrypoint.sh`（三个 Agent 镜像）
2. 重新构建镜像
3. 测试降级逻辑

### Phase 4: 测试与验证（2-3 天）

1. 单元测试
2. 集成测试（真实项目）
3. Git metadata 契约测试（`extractGitMetadata` + `nodeCommitSHA` 校验）
4. 性能对比测试
5. 并发安全测试

### Phase 5: 文档与部署（1 天）

1. 更新部署文档
2. 更新 DEVELOPMENT.md
3. 生产环境部署

**总计**: 7-10 天

---

## 15. 性能预期

### 15.1 首次执行（冷启动）

| 阶段 | 当前耗时 | 优化后耗时 | 说明 |
|------|---------|-----------|------|
| Git clone | 30-60s | 30-60s | 首次需要 clone bare repo |
| 依赖安装 | 60-120s | 60-120s | 首次需要完整安装 |
| **总计** | **90-180s** | **90-180s** | 无优化 |

### 15.2 后续执行（热启动）

| 阶段 | 当前耗时 | 优化后耗时 | 说明 |
|------|---------|-----------|------|
| Git clone | 30-60s | 2-5s | git fetch + node worktree add |
| 依赖安装 | 60-120s | 5-10s | 利用缓存，只装增量 |
| **总计** | **90-180s** | **7-15s** | **减少 85-92%** |

### 15.3 同一 FlowRun 多节点

| 阶段 | 当前耗时 | 优化后耗时 | 说明 |
|------|---------|-----------|------|
| 并行节点准备 | 90-180s × N | 2-5s × N | 每个节点独立 worktree，互不阻塞 |
| 节点执行 | 串行累计 | 并行执行 | 由 DAG 决定可并行节点 |
| 集成提交 | N/A | 1-3s / 节点 | flow 锁内串行集成 |
| **3 节点（2 并行）总计** | **270-540s** | **12-30s** | **减少 89-95%** |

---

## 16. 参考资料

- [Git Worktree 官方文档](https://git-scm.com/docs/git-worktree)
- [Docker Volume 挂载](https://docs.docker.com/storage/volumes/)
- [pnpm Store 配置](https://pnpm.io/npmrc#store-dir)
- [Go sync.Mutex 并发控制](https://pkg.go.dev/sync#Mutex)
