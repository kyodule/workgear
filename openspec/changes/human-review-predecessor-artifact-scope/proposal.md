# Proposal: Human Review 节点支持配置产物查询范围

## 背景（Why）

在 `human-review-show-artifacts` 和 `fix-human-review-artifact-display` 变更上线后，human_review 节点的审核界面已能展示关联产物。当前实现采用"双查询合并"策略：同时查询当前节点的 `nodeRunId` 和整个 `flowRunId` 下的所有产物，然后去重合并展示。

### 用户痛点

1. **产物范围过大**：在复杂流程中（如多个 agent_task 串联），human_review 节点会展示所有上游节点的产物，包括与当前审核无关的中间产物，导致审核界面信息过载。
2. **缺少精确控制**：用户无法指定只查看直接前驱节点的产物，必须在大量产物中手动筛选相关内容。
3. **性能浪费**：查询整个 flowRunId 的产物在长流程中会返回大量数据，但实际审核只需要关注最近一步的输出。

### 典型场景

```
agent_task(需求分析) → agent_task(技术设计) → human_review(设计审核)
```

当前行为：human_review 展示"需求分析"和"技术设计"两个节点的所有产物（6-8 个文件）。
期望行为：human_review 只展示"技术设计"节点的产物（3-4 个文件），因为审核的是设计方案，不需要回看需求分析。

### 根因分析

1. **查询策略固定**：`loadNodeArtifacts` 函数硬编码了"查询整个 flowRunId"的逻辑，无法根据节点配置调整范围
2. **缺少前驱节点追踪**：前端没有利用 `nodeRun.input` 中的上游节点信息来精确查询前驱产物
3. **配置能力缺失**：human_review 节点的 DSL 配置中没有 `artifactScope` 字段来声明产物查询范围

## 目标（What）

为 human_review 节点增加产物查询范围配置能力，支持三种模式：
1. **predecessor**（默认）：仅查询直接前驱节点的产物
2. **flow**：查询整个 flowRun 的所有产物（保持当前行为）
3. **self**：仅查询当前节点自身的产物（适用于 human_review 自己生成产物的场景）

### 具体方案

1. **DSL 扩展**：在 human_review 节点配置中增加 `artifactScope` 字段（可选，默认 `predecessor`）
2. **前端查询逻辑优化**：
   - `predecessor` 模式：从 `nodeRun.input` 中提取前驱节点的 `nodeRunId`，查询这些节点的产物
   - `flow` 模式：保持当前的双查询合并逻辑
   - `self` 模式：仅查询当前 `nodeRunId` 的产物
3. **向后兼容**：未配置 `artifactScope` 的节点默认使用 `predecessor` 模式（更符合实际审核需求）

### 用户体验改进

| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| 审核技术设计 | 展示需求分析 + 技术设计的所有产物（8 个文件） | 仅展示技术设计的产物（4 个文件） |
| 审核最终交付 | 展示所有中间步骤的产物（12+ 个文件） | 配置 `artifactScope: flow` 查看完整历史 |
| 产物加载时间 | 查询整个 flowRun（200ms） | 仅查询前驱节点（50ms） |

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| flow-engine | Spec 更新 + 代码变更 | DSL 增加 artifactScope 字段；前端查询逻辑优化 |
| artifact | Spec 更新 | 补充产物查询范围的行为规范 |
| web (flow-tab) | 代码变更 | loadNodeArtifacts 函数支持三种查询模式 |
| api | 无变更 | 复用现有 GET /api/artifacts 接口 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | loadNodeArtifacts 函数增加 artifactScope 逻辑分支 |
| `openspec/specs/flow-engine/2026-02-14-flow-execution.md` | MODIFY | 补充 artifactScope 配置规范 |
| `openspec/specs/artifact/2026-02-16-artifact-management.md` | MODIFY | 补充产物查询范围的行为规范 |

### 不涉及

- 后端 API 无变更（复用现有接口）
- 数据库 schema 无变更
- Go Orchestrator 无变更（artifactScope 仅影响前端展示）
- 已有流程的行为变更：未配置 artifactScope 的节点默认使用 `predecessor` 模式，可能与当前的 `flow` 模式不同

## 非目标

- 不支持自定义查询表达式（如"查询最近 2 个节点的产物"）
- 不支持运行时动态切换查询范围（需要修改 DSL 并重新执行流程）
- 不实现产物的手动筛选 UI（如复选框选择要展示的产物）
- 不改变产物的创建逻辑（仍由 agent_task 节点自动创建）

## 风险评估

- **风险等级：中** — 涉及默认行为变更，可能影响现有流程的审核体验
- **向后兼容性**：未配置 `artifactScope` 的节点默认使用 `predecessor` 模式，与当前的 `flow` 模式不同。需要在文档中说明迁移方案。
- **前驱节点识别**：依赖 `nodeRun.input` 中的数据结构，如果上游节点未正确传递 `nodeRunId`，可能导致产物查询失败（降级到 `self` 模式）
- **测试覆盖**：需要补充三种模式的单元测试和集成测试

## 迁移方案

对于已有流程，如果希望保持当前的"查看所有产物"行为，需要在 human_review 节点配置中显式声明：

```yaml
- id: review_design
  type: human_review
  artifactScope: flow  # 显式声明查询整个 flowRun 的产物
```

未配置的节点将自动使用 `predecessor` 模式（更符合实际审核需求）。
