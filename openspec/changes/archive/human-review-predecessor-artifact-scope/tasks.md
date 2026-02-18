# Tasks: Human Review 节点支持配置产物查询范围

## 前端实现 (packages/web)

### 核心逻辑 (flow-tab.tsx)

- [x] 新增 `getArtifactScope` 辅助函数，从 nodeRun.config 中解析 artifactScope 配置，默认返回 "predecessor" **[S]**
- [x] 新增 `extractPredecessorNodeRunIds` 辅助函数，从 nodeRun.input 中提取前驱节点 ID（支持三种数据结构） **[S]**
- [x] 重构 `loadNodeArtifacts` 函数，增加 artifactScope 逻辑分支：
  - [x] predecessor 模式：提取前驱节点 ID，并行查询产物，合并去重 **[M]**
  - [x] flow 模式：保持当前的双查询合并逻辑（nodeRunId + flowRunId） **[S]**
  - [x] self 模式：仅查询当前节点的产物 **[S]**
- [x] 处理前驱节点 ID 提取失败的降级逻辑（降级到 self 模式，记录 console.warn） **[S]**
- [x] 处理非法 artifactScope 配置的降级逻辑（降级到 predecessor 模式，记录 console.warn） **[S]**

### 单元测试 (flow-tab-artifacts.test.tsx)

- [x] 测试：predecessor 模式查询单个前驱节点产物 **[S]**
- [x] 测试：predecessor 模式查询多个前驱节点产物并合并 **[S]**
- [x] 测试：predecessor 模式前驱节点 ID 缺失时降级到 self 模式 **[S]**
- [x] 测试：flow 模式双查询并合并产物（验证 nodeRunId 和 flowRunId 均被调用） **[S]**
- [x] 测试：self 模式仅查询当前节点产物 **[S]**
- [x] 测试：非法 artifactScope 配置降级到 predecessor 模式 **[S]**
- [x] 测试：前驱节点未生成产物时展示空列表 **[S]**

## Spec 更新 (openspec/specs)

### flow-engine 模块

- [x] 归档 `MODIFIED-2026-02-18-human-review-artifact-scope.md` 到 `openspec/specs/flow-engine/2026-02-14-flow-execution.md`（追加到文件末尾） **[S]**

### artifact 模块

- [x] 归档 `MODIFIED-2026-02-18-artifact-scope-query.md` 到 `openspec/specs/artifact/2026-02-16-artifact-management.md`（追加到文件末尾） **[S]**

## 集成测试

- [ ] 启动 agent_task → human_review 流程（未配置 artifactScope） → 确认审核界面仅展示前驱节点产物 **[M]**
- [ ] 配置 artifactScope: "flow" → 确认审核界面展示所有节点产物 **[S]**
- [ ] 配置 artifactScope: "self" → 确认审核界面仅展示当前节点产物 **[S]**
- [ ] 前驱节点未生成产物 → 确认审核界面显示空产物列表，不影响审核操作 **[S]**
- [ ] 多个前驱节点并行执行 → 确认审核界面合并展示所有前驱节点产物 **[M]**
- [ ] 已完成的 human_review 节点 → 确认按配置的 artifactScope 展示产物 **[S]**

## 文档更新

- [ ] 更新用户文档，说明 artifactScope 配置字段的用法和三种模式的区别 **[S]**
- [ ] 提供迁移指南，说明如何保持当前的 flow 模式行为（显式配置 artifactScope: "flow"） **[S]**
- [ ] 补充配置示例（predecessor / flow / self 三种模式） **[S]**

## 性能验证

- [ ] 使用 Chrome DevTools Network 面板验证 predecessor 模式的 API 调用次数（应为 1-2 次） **[S]**
- [ ] 对比 predecessor 模式和 flow 模式的响应时间（predecessor 应快 50-100ms） **[S]**
- [ ] 验证长流程（5+ 节点）中 predecessor 模式的产物数量减少效果 **[S]**

## 代码审查与合并

- [ ] 代码审查：确认 artifactScope 解析逻辑正确，降级策略合理 **[S]**
- [ ] 代码审查：确认前驱节点 ID 提取逻辑覆盖三种数据结构 **[S]**
- [ ] 代码审查：确认单元测试覆盖所有分支逻辑 **[S]**
- [ ] 合并到主分支，更新 CHANGELOG **[S]**
