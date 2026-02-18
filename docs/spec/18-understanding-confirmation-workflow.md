# 18. 优化 Spec 驱动开发流水线：增加需求理解与确认环节

> **日期**: 2026-02-18
> **状态**: 实施中
> **前置条件**: Phase 4（真实 Agent 调用）已完成

---

## 1. 背景与问题

### 1.1 当前问题

通过分析实际执行数据（FlowRun `3c59dc0e-1797-4ead-9f3f-a8c745018a11`），发现：

| 维度 | 第一次执行（成功） | 第二次执行（超时） | 差异 |
|------|------------------|------------------|------|
| **耗时** | 397 秒（6.6 分钟） | 600 秒（10 分钟超时） | **+51%** |
| **输出长度** | 10,550 字符 | 0（未完成） | 无输出 |
| **状态** | completed | failed (timeout) | - |
| **Feedback** | 无 | 有（113 字的需求澄清） | **关键差异** |

### 1.2 根本原因

**需求理解偏差导致的"推翻重来"成本**：

1. **第一次执行（6.6 分钟）**：Agent 基于初始需求生成 Spec
2. **人工打回**：指出 Agent 理解错了需求（"你理解的痛点和我说的原始需求都不是一回事"）
3. **第二次执行（10 分钟超时）**：Agent 收到 feedback 后：
   - 意识到之前的理解完全错误
   - 需要**重新理解整个需求**
   - 需要**重新分析代码库**（因为之前分析的方向错了）
   - 陷入"推翻重来"的困境
   - 最终超时

### 1.3 交互式 vs 非交互式的本质差异

**交互式执行（1-5 轮，每轮 20-60 秒）**：
```
你: "人工审核环节会看到所有的产物"
Agent: [分析代码] "是 ArtifactsBySourceNode 的问题吗？"
你: "不对，我说的是流程完成后点回 human review 环节看"
Agent: "明白了，是历史查看的过滤逻辑" [快速调整方向]
你: "对"
Agent: [生成方案] 完成
```

**关键**：人类可以**实时纠偏**，Agent 不会在错误方向上浪费时间。

**非交互式执行（单次，10 分钟）**：
```
Agent: [分析代码 2 分钟]
Agent: [生成方案 4 分钟]
Agent: [输出 Spec] 完成（第一次）

[人工打回]

Agent: [读取 feedback] "我理解错了..."
Agent: [重新理解需求 3 分钟] "原来是历史查看的问题"
Agent: [推翻之前的分析 2 分钟]
Agent: [重新分析代码 3 分钟]
Agent: [生成新方案...] [超时]
```

**关键**：Agent 在错误方向上已经投入了 6 分钟，收到 feedback 后需要**推翻重来**，时间不够。

---

## 2. 解决方案概述

### 2.1 核心思路

在提交需求后增加两个环节：
1. **需求理解（Agent）**：Agent 快速输出对需求的理解（Markdown 格式，10 分钟）
2. **需求确认（Human）**：人工审核，可编辑或打回（10 分钟）

### 2.2 优势

- ✅ **早期纠偏**：在投入大量时间前（10 分钟 vs 30 分钟），先确认理解正确
- ✅ **避免推翻重来**：理解错误时只需重新理解（10 分钟），而不是重新生成 Spec（30 分钟）
- ✅ **人工可编辑**：无需打回，直接编辑后确认（节省 1 轮）
- ✅ **上下文增强**：后续环节有明确的需求理解，减少探索时间

### 2.3 性能预期

| 场景 | 当前流程 | 优化后流程 | 节省时间 |
|------|---------|-----------|---------|
| **理解正确** | 30 分钟（直接生成 Spec） | 10 分钟（理解）+ 30 分钟（生成 Spec）= 40 分钟 | -10 分钟（但质量更高） |
| **理解错误（1次）** | 30 分钟 + 30 分钟（重试）= 60 分钟 | 10 + 10（重新理解）+ 30 = 50 分钟 | **-10 分钟（-17%）** |
| **理解错误（2次）** | 30 + 30 + 30 = 90 分钟 | 10 + 10 + 10 + 30 = 60 分钟 | **-30 分钟（-33%）** |

---

## 3. 架构设计

### 3.1 使用 `agent_task` + `transient` 配置

```yaml
# 使用 agent_task 节点类型 + transient 配置标志
# 特点：
# - 输出为 Markdown 文档（非 Git 产物）
# - 存储在 node_runs.transient_artifacts 中
# - 可被后续节点通过 {{upstream.xxx}} 引用

- id: understand_requirement
  name: "理解需求"
  type: agent_task
  agent:
    role: "requirement-analyst"
  config:
    mode: understand
    transient: true  # 标记为瞬态产物
  timeout: 10m
```

### 3.2 新增产物类型：`transient_artifact`

| 字段 | 说明 |
|------|------|
| `type` | `transient` |
| `storage` | 存储在 `node_runs.transient_artifacts` 中，不提交到 Git |
| `lifecycle` | 持久化到数据库，可在历史记录中查看 |
| `editable` | 人工审核时可编辑 |

### 3.3 数据流

```
submit_requirement (human_input)
  ↓ output: {requirement_text, priority, ...}
  
understand_requirement (agent_task + transient: true)
  ↓ input: {{upstream.submit_requirement}}
  ↓ output: {understanding_md: "# 需求理解\n..."}
  ↓ transient_artifacts: {understanding: {type: "markdown", content: "..."}}
  
confirm_understanding (human_review)
  ↓ input: {{upstream.understand_requirement.understanding_md}}
  ↓ action: approve (可编辑) / reject (打回)
  ↓ output: {confirmed_understanding: "..."}
  
generate_spec (agent_task)
  ↓ input: {{upstream.confirm_understanding.confirmed_understanding}}
  ↓ prompt: "基于以下需求理解，生成 OpenSpec..."
  ↓ output: OpenSpec 产物（Git 提交）
```

---

## 4. 数据库设计

### 4.1 Schema 扩展

```typescript
// packages/api/src/db/schema.ts

export const nodeRuns = pgTable('node_runs', {
  // ... 现有字段
  
  // 新增：瞬态产物（非 Git 提交内容）
  transientArtifacts: jsonb('transient_artifacts').$type<{
    [key: string]: {
      type: 'markdown' | 'json' | 'text';
      content: string;
      editedBy?: string;  // 如果人工编辑过，记录编辑者
      editedAt?: string;
    };
  }>(),
});
```

### 4.2 数据库迁移

```sql
-- packages/api/src/db/migrations/XXXX_add_transient_artifacts/migration.sql

ALTER TABLE node_runs ADD COLUMN transient_artifacts JSONB;

COMMENT ON COLUMN node_runs.transient_artifacts IS 
  '瞬态产物：流程执行过程中的中间产物（如需求理解），不提交到 Git，但持久化到数据库供后续环节使用';

CREATE INDEX idx_node_runs_transient_artifacts 
  ON node_runs USING gin(transient_artifacts) 
  WHERE transient_artifacts IS NOT NULL;
```

---

## 5. 默认超时配置

### 5.1 各环节默认时长

| 环节类型 | 默认时长 | 说明 |
|---------|---------|------|
| **需求理解** | 10 分钟 | Agent 快速理解需求，输出 Markdown |
| **需求确认** | 10 分钟 | 人工审核，可编辑或打回 |
| **Spec 生成** | 30 分钟 | Agent 生成完整 OpenSpec 产物 |
| **Spec 审核** | 30 分钟 | 人工审核 Spec |
| **代码实施** | 60 分钟 | Agent 实施代码 |
| **代码审核** | 30 分钟 | 人工审核代码 |
| **最终审核** | 30 分钟 | 最终确认 |

### 5.2 配置位置

```go
// packages/orchestrator/internal/agent/adapter.go

const (
    DefaultUnderstandingTimeout = 10 * time.Minute  // 需求理解
    DefaultSpecTimeout          = 30 * time.Minute  // Spec 生成
    DefaultImplementTimeout     = 60 * time.Minute  // 代码实施
    DefaultReviewTimeout        = 30 * time.Minute  // 审核环节
)

// GetDefaultTimeout 根据节点类型和模式返回默认超时
func GetDefaultTimeout(nodeType, mode string) time.Duration {
    switch {
    case nodeType == "understanding_task":
        return DefaultUnderstandingTimeout
    case nodeType == "agent_task" && mode == "understand":
        return DefaultUnderstandingTimeout
    case nodeType == "agent_task" && (mode == "spec" || mode == "opsx_plan"):
        return DefaultSpecTimeout
    case nodeType == "agent_task" && (mode == "execute" || mode == "opsx_apply"):
        return DefaultImplementTimeout
    case nodeType == "human_review":
        return DefaultReviewTimeout
    default:
        return 10 * time.Minute
    }
}
```

---

## 6. 实施计划

### Phase 1: 数据库与 DSL（2-3 天）

**任务清单**：
1. 数据库迁移：新增 `transient_artifacts` 字段
2. 更新 Schema 定义：`packages/api/src/db/schema.ts`
3. DSL 解析：支持 `agent_task` + `transient` 配置
4. DSL 解析：支持 `human_review.editable` 配置
5. 创建新 Workflow：`spec-driven-dev-v2.yaml`
6. 更新默认超时配置常量

**验收标准**：
- 数据库迁移成功执行
- DSL 解析器能正确识别新节点类型
- Workflow YAML 通过验证

### Phase 2: Orchestrator 实现（3-4 天）

**任务清单**：
1. 新增 Agent 模式：`understand`（`prompt_builder.go`）
2. 扩展 `executeAgentTask`：支持 `transient` 配置标志（`node_handlers.go`）
3. 扩展 `executeHumanReview`：支持编辑并存储 output
4. 实现 `GetDefaultTimeout` 函数（`adapter.go`）
5. DB 查询：`UpdateNodeRunTransientArtifacts`（`queries.go`）
6. 扩展 `RenderTemplate`：支持引用瞬态产物（`template.go`）

**验收标准**：
- `understanding_task` 节点能正常执行
- Agent 输出存储到 `transient_artifacts`
- Human Review 能编辑并保存修改
- 后续节点能通过 `{{upstream.xxx}}` 引用瞬态产物

### Phase 3: API 实现（1-2 天）

**任务清单**：
1. 新增 API：`GET /api/node-runs/:id/transient-artifacts`
2. 扩展 API：`POST /api/node-runs/:id/review` 支持 output 参数
3. 扩展 API：`GET /api/node-runs/:id` 返回 transient_artifacts
4. 更新 TypeScript 类型定义

**验收标准**：
- API 能正确返回瞬态产物
- Human Review 提交时能保存编辑后的内容
- API 响应包含完整的瞬态产物数据

### Phase 4: 前端实现（3-4 天）

**任务清单**：
1. 扩展 `HumanReviewDialog`：支持编辑瞬态产物
2. 新增 `TransientArtifactViewer` 组件
3. 扩展 `NodeRunDetail`：显示瞬态产物
4. 更新 TypeScript 类型定义

**验收标准**：
- Human Review 对话框能显示和编辑 Markdown
- 编辑后的内容能正确提交
- 历史记录中能查看瞬态产物
- UI 交互流畅，无明显 bug

### Phase 5: 测试与优化（2-3 天）

**任务清单**：
1. 单元测试
2. 集成测试
3. 性能测试
4. 用户体验优化

**验收标准**：
- 所有单元测试通过
- 集成测试覆盖主要场景
- 性能测试验证预期效果
- 用户体验良好

**总计**：11-16 天

---

## 7. 文件清单

### 7.1 新增文件

| 文件 | 说明 |
|------|------|
| `packages/api/src/db/migrations/XXXX_add_transient_artifacts/migration.sql` | 数据库迁移 |
| `packages/orchestrator/workflows/spec-driven-dev-v2.yaml` | 新版 Workflow |
| `packages/web/src/components/transient-artifact-viewer.tsx` | 瞬态产物查看器组件 |

### 7.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `packages/api/src/db/schema.ts` | 新增 `transientArtifacts` 字段 |
| `packages/api/src/routes/node-runs.ts` | 新增瞬态产物 API |
| `packages/orchestrator/internal/agent/prompt_builder.go` | 新增 `understand` 模式 |
| `packages/orchestrator/internal/agent/adapter.go` | 新增 `GetDefaultTimeout` 函数 |
| `packages/orchestrator/internal/engine/node_handlers.go` | 新增 `executeUnderstandingTask`，扩展 `executeHumanReview` |
| `packages/orchestrator/internal/engine/dsl_parser.go` | 支持 `understanding_task` 节点类型 |
| `packages/orchestrator/internal/db/queries.go` | 新增 `UpdateNodeRunTransientArtifacts` |
| `packages/web/src/pages/tasks/human-review-dialog.tsx` | 支持编辑瞬态产物 |
| `packages/web/src/pages/tasks/node-run-detail.tsx` | 显示瞬态产物 |
| `packages/web/src/lib/types.ts` | 新增瞬态产物类型定义 |
