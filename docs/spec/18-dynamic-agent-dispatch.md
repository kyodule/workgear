# 18. 动态 Agent 分发机制

> **文档版本**: v1.0
> **最后更新**: 2026-02-18
> **状态**: 设计完成，待实施
> **前置条件**: Agent 配置系统（spec-15）已完成

---

## 1. 概述

### 1.1 问题背景

复杂项目中，一个开发角色不够用。例如：
- 嵌入式项目有两种芯片（ARM / RISC-V），需要不同的开发专家
- 全栈项目需要前端、后端、移动端、DevOps 等多个角色
- 架构师分析完需求后，应能根据任务类型动态指派给最合适的 Agent

现有 `agent_task` 节点的 `agent.role` 虽然支持模板变量（如 `{{params.developer_role}}`），但只能在流程创建时静态绑定一个角色，无法在运行时根据任务内容动态选择。

### 1.2 解决方案

新增 `agent_dispatch` 节点类型：
- 和 `agent_task` 一样通过 `agent.role` 指定执行角色（复用现有 Agent 配置体系）
- 该角色的 Agent 作为 LLM 调度器，根据任务描述从 `agent_pool` 中选择最合适的下游 Agent
- `agent_pool`（可选 Agent 列表）作为流程模板参数，创建流程时配置默认值，启动时可覆盖

### 1.3 架构概览

```
上游节点（如需求分析）
  ↓ 输出任务描述
agent_dispatch 节点
  ├─ agent.role: 调度器角色（如 requirement-analyst）
  ├─ agent_pool: 来自流程参数 {{params.agent_pool}}
  ├─ dispatch_prompt_template: 调度 Prompt
  ↓ 调用 LLM，输出 selected_role
下游 agent_task 节点
  ├─ agent.role: "{{nodes.dispatch.outputs.selected_role}}"
  ↓ 使用选中的 Agent 执行
```

---

## 2. DSL 设计

### 2.1 流程模板参数定义

`agent_pool` 作为模板参数，类型为 `agent_pool`（新增参数类型）：

```yaml
# seed-templates.ts 中的参数定义
parameters:
  - name: dispatch_pool
    type: agent_pool          # 新增参数类型
    label: "可选 Agent 池"
    required: true
    default:
      - role: chip-a-developer
        description: "芯片A（ARM Cortex-M）嵌入式开发专家"
      - role: chip-b-developer
        description: "芯片B（RISC-V）嵌入式开发专家"
      - role: app-developer
        description: "移动应用开发工程师"
      - role: server-developer
        description: "后端服务开发工程师"
  
  - name: dispatcher_role
    type: text
    label: "调度器 Agent 角色"
    default: "requirement-analyst"
    required: true
```

### 2.2 agent_dispatch 节点 DSL

```yaml
- id: dispatch_agent
  name: "选择执行 Agent"
  type: agent_dispatch
  agent:
    role: "{{params.dispatcher_role}}"    # 复用现有 agent.role 机制
  config:
    # 引用流程参数中的 agent_pool
    agent_pool: "{{params.dispatch_pool}}"
    
    # 调度 Prompt 模板
    dispatch_prompt_template: |
      你是一个智能任务调度器。请根据任务描述选择最合适的 Agent 角色。
      
      任务信息：
      - 标题: {{task.title}}
      - 描述: {{task.description}}
      
      可选 Agent 列表：
      {{#each agent_pool}}
      - role: {{role}}
        description: {{description}}
      {{/each}}
      
      请严格输出以下 JSON 格式（不要输出其他内容）：
      {
        "selected_role": "选中的角色 slug",
        "reason": "选择理由（1-2句话）"
      }
    
    # 失败降级策略
    fallback:
      strategy: use_default    # use_default | human_select | fail
      default_role: general-developer
  
  timeout: 60s
```

### 2.3 完整流程示例：多芯片项目

```yaml
name: "multi-agent-dev-pipeline"
version: "1.0"
description: "多角色开发流水线：需求分析 → 动态分发 → 并行执行 → Review"

variables:
  project_id: ""
  requirement_text: ""

nodes:
  # ─── 阶段 1：提交需求 ───
  - id: submit_requirement
    name: "提交需求"
    type: human_input
    config:
      form:
        - field: requirement_text
          type: textarea
          label: "需求描述"
          required: true

  # ─── 阶段 2：架构师分析需求并拆分子任务 ───
  - id: analyze_requirement
    name: "分析需求"
    type: agent_task
    agent:
      role: "{{params.analyst_role}}"
    config:
      mode: spec
      prompt_template: |
        分析以下需求，拆分为可独立执行的子任务：
        
        需求：{{nodes.submit_requirement.outputs.requirement_text}}
        
        请输出 JSON 格式：
        {
          "summary": "需求摘要",
          "sub_tasks": [
            {
              "id": "task-001",
              "title": "子任务标题",
              "description": "详细描述"
            }
          ]
        }
      output_schema:
        type: object
        properties:
          summary: { type: string }
          sub_tasks:
            type: array
            items:
              type: object
              properties:
                id: { type: string }
                title: { type: string }
                description: { type: string }

  # ─── 阶段 3：人工确认拆解 ───
  - id: confirm_tasks
    name: "确认任务拆解"
    type: human_review
    config:
      actions: ["approve", "reject"]
      artifact_scope: predecessor
    on_reject:
      goto: analyze_requirement
      max_loops: 3
      inject:
        feedback: "{{review.comment}}"

  # ─── 阶段 4：并行分发和执行 ───
  - id: parallel_dispatch_execute
    name: "并行分发执行"
    type: parallel_group
    config:
      foreach: "{{nodes.confirm_tasks.outputs.sub_tasks}}"
      as: "task"
      execution_mode: pipeline
      max_concurrency: 3
    children:
      # 4.1 动态分发
      - id: dispatch_agent
        name: "选择执行 Agent"
        type: agent_dispatch
        agent:
          role: "{{params.dispatcher_role}}"
        config:
          agent_pool: "{{params.dispatch_pool}}"
          dispatch_prompt_template: |
            你是一个智能任务调度器。请根据任务描述选择最合适的 Agent 角色。
            
            任务信息：
            - 标题: {{task.title}}
            - 描述: {{task.description}}
            
            可选 Agent 列表：
            {{#each agent_pool}}
            - role: {{role}}
              description: {{description}}
            {{/each}}
            
            请严格输出以下 JSON 格式：
            {
              "selected_role": "选中的角色 slug",
              "reason": "选择理由"
            }
          fallback:
            strategy: use_default
            default_role: general-developer
        timeout: 60s

      # 4.2 执行任务（使用分发结果）
      - id: execute_task
        name: "执行任务"
        type: agent_task
        agent:
          role: "{{nodes.dispatch_agent.outputs.selected_role}}"
        config:
          mode: execute
          prompt_template: |
            任务：{{task.title}}
            描述：{{task.description}}
            分配理由：{{nodes.dispatch_agent.outputs.reason}}
            
            请按要求完成开发。
          git:
            create_branch: true
            branch_pattern: "feat/task-{{task.id}}"
            auto_commit: true

      # 4.3 人工 Review
      - id: review_task
        name: "Review"
        type: human_review
        config:
          actions: ["approve", "reject"]
          artifact_scope: predecessor
        on_reject:
          goto: execute_task
          max_loops: 3
          inject:
            feedback: "{{review.comment}}"

edges:
  - from: submit_requirement
    to: analyze_requirement
  - from: analyze_requirement
    to: confirm_tasks
  - from: confirm_tasks
    to: parallel_dispatch_execute
```

---

## 3. 数据模型

### 3.1 node_type 扩展

现有 `node_runs` 表的 `node_type` 字段新增 `agent_dispatch` 值。

> 注：当前实际 schema（`packages/api/src/db/schema.ts`）中 `nodeType` 是普通 `varchar(50)`，没有 CHECK 约束，无需 DDL 变更。只需在引擎代码中支持新类型。

### 3.2 模板参数类型扩展

`TemplateParameter.type` 新增 `agent_pool` 类型：

```typescript
// packages/web/src/lib/types.ts
export interface TemplateParameter {
  name: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'agent_pool'  // 新增 agent_pool
  label: string
  default?: any
  options?: string[]
  min?: number
  max?: number
  required?: boolean
}
```

`agent_pool` 类型的参数值格式：

```typescript
interface AgentPoolItem {
  role: string        // agent_roles.slug
  description: string // 角色描述（供 LLM 调度器参考）
}

// 参数值示例
type AgentPoolValue = AgentPoolItem[]
```

### 3.3 agent_dispatch 节点输出格式

存储在 `node_runs.output` 中：

```json
{
  "selected_role": "chip-a-developer",
  "reason": "该任务涉及芯片A的驱动开发，需要ARM架构和RTOS经验",
  "agent_pool": [
    { "role": "chip-a-developer", "description": "..." },
    { "role": "chip-b-developer", "description": "..." }
  ],
  "dispatch_metrics": {
    "duration_ms": 1200,
    "token_input": 450,
    "token_output": 80
  },
  "fallback": false
}
```

---

## 4. 实现细节

### 4.1 Go 侧：节点处理器

```go
// internal/engine/node_handlers.go

func (e *FlowExecutor) executeAgentDispatch(ctx context.Context, nodeRun *NodeRun, dslNode *DslNode) error {
    config := dslNode.Config
    
    // 1. 解析 agent_pool（已由模板变量渲染为实际值）
    agentPool, err := e.parseAgentPool(config["agent_pool"])
    if err != nil {
        return fmt.Errorf("invalid agent_pool: %w", err)
    }
    if len(agentPool) < 2 {
        return fmt.Errorf("agent_pool must contain at least 2 roles, got %d", len(agentPool))
    }
    
    // 2. 渲染 dispatch_prompt_template
    promptTemplate := config["dispatch_prompt_template"].(string)
    prompt, err := e.renderTemplate(promptTemplate, map[string]any{
        "task":       nodeRun.Input,
        "agent_pool": agentPool,
    })
    if err != nil {
        return fmt.Errorf("render dispatch prompt failed: %w", err)
    }
    
    // 3. 获取调度器 Adapter（复用 agent.role 机制，和 agent_task 完全一致）
    role := dslNode.Agent.Role  // 已渲染模板变量
    adapter, registryModel, err := e.registry.GetAdapterForRole(role)
    if err != nil {
        return e.handleDispatchFallback(nodeRun, config, agentPool,
            fmt.Errorf("dispatcher role %q not found: %w", role, err))
    }
    
    // 4. 构建 AgentRequest
    agentReq := &agent.AgentRequest{
        TaskID:    nodeRun.FlowRunID,
        FlowRunID: nodeRun.FlowRunID,
        NodeID:    nodeRun.NodeID,
        Mode:      "execute",
        Prompt:    prompt,
        Model:     registryModel,
    }
    
    // 5. 调用 LLM 调度器
    agentResp, err := adapter.Execute(ctx, agentReq)
    if err != nil {
        return e.handleDispatchFallback(nodeRun, config, agentPool, err)
    }
    
    // 6. 解析 LLM 输出
    var result struct {
        SelectedRole string `json:"selected_role"`
        Reason       string `json:"reason"`
    }
    if err := e.parseJSONFromAgentOutput(agentResp, &result); err != nil {
        return e.handleDispatchFallback(nodeRun, config, agentPool,
            fmt.Errorf("parse dispatch result failed: %w", err))
    }
    
    // 7. 校验 selected_role 在 agent_pool 中
    if !isRoleInPool(result.SelectedRole, agentPool) {
        return e.handleDispatchFallback(nodeRun, config, agentPool,
            fmt.Errorf("selected role %q not in agent_pool", result.SelectedRole))
    }
    
    // 8. 保存输出
    nodeRun.Output = map[string]any{
        "selected_role": result.SelectedRole,
        "reason":        result.Reason,
        "agent_pool":    agentPool,
        "dispatch_metrics": map[string]any{
            "duration_ms":  agentResp.Metrics.DurationMs,
            "token_input":  agentResp.Metrics.TokenInput,
            "token_output": agentResp.Metrics.TokenOutput,
        },
        "fallback": false,
    }
    
    return nil
}
```

### 4.2 Go 侧：降级策略

```go
func (e *FlowExecutor) handleDispatchFallback(
    nodeRun *NodeRun,
    config map[string]any,
    agentPool []AgentPoolItem,
    originalErr error,
) error {
    fallbackCfg, ok := config["fallback"].(map[string]any)
    if !ok {
        return originalErr
    }
    
    strategy, _ := fallbackCfg["strategy"].(string)
    
    switch strategy {
    case "use_default":
        defaultRole, _ := fallbackCfg["default_role"].(string)
        if defaultRole == "" {
            return fmt.Errorf("fallback default_role is empty, original error: %w", originalErr)
        }
        nodeRun.Output = map[string]any{
            "selected_role": defaultRole,
            "reason":        fmt.Sprintf("调度失败（%v），使用默认角色", originalErr),
            "agent_pool":    agentPool,
            "fallback":      true,
        }
        e.logger.Warnw("agent dispatch fallback to default",
            "node_id", nodeRun.NodeID, "default_role", defaultRole, "error", originalErr)
        return nil
        
    case "human_select":
        // 暂停流程，等待人工在界面上从 agent_pool 中选择
        nodeRun.Status = "waiting_human"
        nodeRun.Output = map[string]any{
            "agent_pool":    agentPool,
            "fallback":      true,
            "original_error": originalErr.Error(),
        }
        return nil
        
    case "fail":
        return originalErr
        
    default:
        return fmt.Errorf("unknown fallback strategy %q, original error: %w", strategy, originalErr)
    }
}

// AgentPoolItem 定义
type AgentPoolItem struct {
    Role        string `json:"role"`
    Description string `json:"description"`
}

func (e *FlowExecutor) parseAgentPool(raw any) ([]AgentPoolItem, error) {
    data, err := json.Marshal(raw)
    if err != nil {
        return nil, err
    }
    var pool []AgentPoolItem
    if err := json.Unmarshal(data, &pool); err != nil {
        return nil, err
    }
    return pool, nil
}

func isRoleInPool(role string, pool []AgentPoolItem) bool {
    for _, item := range pool {
        if item.Role == role {
            return true
        }
    }
    return false
}
```

### 4.3 前端：模板参数编辑器

新增 `agent_pool` 类型的参数编辑组件：

```typescript
// packages/web/src/components/workflow/agent-pool-param-editor.tsx

interface AgentPoolItem {
  role: string
  description: string
}

interface Props {
  value: AgentPoolItem[]
  onChange: (value: AgentPoolItem[]) => void
  agentRoles: AgentRole[]  // 从 /api/agent-roles 加载
}

export function AgentPoolParamEditor({ value, onChange, agentRoles }: Props) {
  // 渲染一个列表，每行：
  //   [Select: 角色选择（从 agentRoles 中选）] [Input: 描述] [删除按钮]
  // 底部：[+ 添加 Agent] 按钮
  // 角色选择后自动填充 description（取 agentRole.description）
}
```

### 4.4 前端：Timeline 展示

在 Timeline 中展示分发决策：

```typescript
// 在 timeline-event 组件中新增 agent_dispatch 事件渲染

function renderAgentDispatchEvent(output: Record<string, any>) {
  return (
    <div className="border-l-4 border-blue-500 pl-4">
      <div className="font-medium">Agent 分发决策</div>
      <div className="text-sm text-muted-foreground mt-1">
        选中角色: <Badge>{output.selected_role}</Badge>
      </div>
      <div className="text-sm mt-1">理由: {output.reason}</div>
      {output.fallback && (
        <div className="text-sm text-amber-600 mt-1">⚠️ 使用降级策略</div>
      )}
    </div>
  )
}
```

---

## 5. DSL 校验规则

```
agent_dispatch 规则：
  ✓ agent.role 必填（调度器角色）
  ✓ config.agent_pool 必填，解析后至少包含 2 个角色
  ✓ config.agent_pool 中每个 role 必须在 agent_roles 表中存在（运行时校验）
  ✓ config.dispatch_prompt_template 必填且非空
  ✓ config.fallback.strategy 必须是 use_default / human_select / fail 之一
  ✓ config.fallback.strategy = use_default 时，default_role 必填
  ✓ 下游节点通过 {{nodes.<dispatch_id>.outputs.selected_role}} 引用时，
    该下游节点的 agent.role 必须是此表达式（静态分析提示，非强制）
```

---

## 6. 使用场景

### 6.1 多芯片嵌入式项目

```yaml
parameters:
  - name: dispatch_pool
    type: agent_pool
    label: "芯片开发 Agent 池"
    default:
      - role: chip-a-developer
        description: "芯片A（ARM Cortex-M）嵌入式开发，熟悉 FreeRTOS 和 HAL 库"
      - role: chip-b-developer
        description: "芯片B（RISC-V）嵌入式开发，熟悉 bare-metal 和 Rust embedded"
```

### 6.2 全栈 Web 项目

```yaml
parameters:
  - name: dispatch_pool
    type: agent_pool
    label: "全栈开发 Agent 池"
    default:
      - role: frontend-developer
        description: "前端开发（React + TypeScript + Tailwind）"
      - role: backend-developer
        description: "后端开发（Node.js + Fastify + PostgreSQL）"
      - role: devops-engineer
        description: "DevOps（Docker + CI/CD + 部署配置）"
```

### 6.3 多语言微服务项目

```yaml
parameters:
  - name: dispatch_pool
    type: agent_pool
    label: "微服务开发 Agent 池"
    default:
      - role: python-developer
        description: "Python 微服务（FastAPI + SQLAlchemy）"
      - role: go-developer
        description: "Go 微服务（高性能网关和中间件）"
      - role: java-developer
        description: "Java 微服务（Spring Boot + MyBatis）"
```

---

## 7. 优势与限制

### 7.1 优势

1. **复用现有体系**：`agent.role` 机制完全复用，无需新建调度器概念
2. **灵活配置**：`agent_pool` 作为流程参数，创建流程时配置默认值，启动时可覆盖
3. **智能调度**：LLM 理解任务语义，自动选择最合适的 Agent
4. **可追溯**：分发决策和理由记录在 NodeRun 输出中
5. **容错**：支持三种降级策略

### 7.2 限制

1. **调度成本**：每次分发需调用一次 LLM（约 500 tokens）
2. **准确性**：依赖调度器 LLM 的理解能力和 agent_pool 中描述的质量
3. **延迟**：增加一次 LLM 调用的延迟（通常 1-3 秒）

### 7.3 后续优化方向

1. **规则引擎**：简单场景（如 task_type 精确匹配）可跳过 LLM，直接用规则映射
2. **缓存**：相似任务的分发结果可缓存复用
3. **统计分析**：分发决策的准确率统计和优化建议

---

## 8. 实施计划

### Phase 1：核心功能
- [ ] Go 侧实现 `executeAgentDispatch` 节点处理器
- [ ] 实现 `AgentPoolItem` 解析和 `isRoleInPool` 校验
- [ ] 实现三种降级策略（use_default / human_select / fail）
- [ ] 前端 `TemplateParameter` 类型新增 `agent_pool`

### Phase 2：前端支持
- [ ] 实现 `AgentPoolParamEditor` 组件（角色选择 + 描述编辑）
- [ ] Workflow 编辑器支持 `agent_dispatch` 节点类型
- [ ] Timeline 展示分发决策事件

### Phase 3：模板和测试
- [ ] 创建示例流程模板（multi-agent-dev-pipeline）
- [ ] 单元测试：正常分发、降级、校验失败
- [ ] 集成测试：完整流程端到端

---

## 9. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/orchestrator/internal/engine/node_handlers.go` | 修改 | 新增 `executeAgentDispatch` 处理器 |
| `packages/orchestrator/internal/engine/flow_executor.go` | 修改 | 节点类型分发中新增 `agent_dispatch` |
| `packages/web/src/lib/types.ts` | 修改 | `TemplateParameter.type` 新增 `agent_pool` |
| `packages/web/src/components/workflow/agent-pool-param-editor.tsx` | 新增 | Agent Pool 参数编辑组件 |
| `packages/web/src/components/workflow/` | 修改 | 参数表单中集成 agent_pool 编辑器 |
| `packages/api/src/seeds/templates/multi-agent-dev-pipeline.yaml` | 新增 | 示例流程模板 |
| `packages/api/src/seeds/seed-templates.ts` | 修改 | 注册新模板 |
| `docs/spec/18-dynamic-agent-dispatch.md` | 新增 | 本文档 |

---

## 10. 相关文档

- [Agent 配置系统](./15-agent-config-system.md)
- [流程引擎设计](./03-flow-engine.md)
- [Agent 接入层](./04-agent-layer.md)
- [数据模型](./06-data-model.md)
