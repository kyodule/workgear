# Tasks: Human Review 节点展示关联产物

## 模块：前端 — flow-tab.tsx (packages/web/src/pages/kanban/task-detail)

### 产物查询逻辑扩展

- [x] 修改 `NodeRunItem` 的 `loadNodeArtifacts` 函数，对 human_review 节点同时查询 `nodeRunId` 和 `flowRunId` 下的产物，按 artifact.id 去重合并，按 createdAt 排序 **[S]**
- [x] 确保 `loadNodeArtifacts` 在 `expanded` 且 `nodeRun.id` 变化时正确触发 **[S]**

### 产物展示区域调整

- [x] 将产物展示区域移到 `waiting_human` 状态的 input JSON 之前 **[S]**
- [x] 当有产物时，隐藏 JSON 格式的 input 展示（避免信息冗余） **[S]**
- [x] 当无产物时，保持原有的 input JSON 展示（向后兼容） **[S]**
- [x] 产物按来源节点分组展示，每组显示节点名称和类型作为分组标题 **[S]**
- [x] 仅在 `waiting_human` 状态的 `human_review` 节点中传入 `onEdit`，已完成节点不显示编辑按钮 **[S]**

### 交互能力验证

- [x] 确认产物卡片的展开/折叠预览在审核界面中正常工作 **[S]**
- [x] 确认全屏查看按钮（Eye 图标）在审核界面中正常触发 onFullscreen 回调 **[S]**
- [x] 确认编辑按钮在审核界面中正常触发 onEditArtifact 回调（仅 waiting_human 状态） **[S]**
- [x] 确认编辑保存后 artifactRefreshKey 递增触发产物列表刷新 **[S]**

## 模块：前端 — 错误处理

### 静默错误处理

- [x] 确认产物 API 请求失败时不影响审核操作按钮 **[S]**
- [x] 确认产物加载失败时不显示错误提示给用户 **[S]**

## 模块：前端 — 自动化测试

### 单元测试 (packages/web/src/pages/kanban/task-detail/__tests__/flow-tab-artifacts.test.tsx)

- [x] 测试：有产物时隐藏 input JSON **[S]**
- [x] 测试：无产物时展示 input JSON **[S]**
- [x] 测试：human_review 节点双查询并合并产物（验证 nodeRunId 和 flowRunId 均被调用） **[S]**
- [x] 测试：completed 状态下不显示编辑按钮 **[S]**
- [x] 测试：waiting_human 状态下显示编辑按钮 **[S]**
- [x] 测试：产物按来源节点分组展示 **[S]**

## 模块：OpenSpec 文档

### Spec 归档

- [x] 归档完成后更新 `openspec/specs/flow-engine/2026-02-14-flow-execution.md` **[S]**
- [x] 归档完成后更新 `openspec/specs/artifact/2026-02-16-artifact-management.md` **[S]**
- [x] 对齐 design.md / tasks.md / specs 三者语义（双查询合并 vs fallback） **[S]**

## 测试验证

### 端到端验证

- [x] 启动 agent_task → human_review 流程 → 确认审核界面展示上游产物 **[S]**
- [x] 在审核界面展开产物卡片 → 确认 Markdown 内容正确渲染 **[S]**
- [x] 点击全屏按钮 → 确认全屏 Dialog 正常打开 **[S]**
- [x] 点击编辑按钮 → 修改内容 → 保存 → 确认产物列表自动刷新 **[S]**
- [x] 上游节点无产物时 → 确认不显示产物区域，显示原有 input JSON **[S]**
- [x] 产物 API 请求失败时 → 确认审核操作按钮正常可用 **[S]**
- [x] 已完成的 human_review 节点 → 确认产物可查看但无编辑按钮 **[S]**
