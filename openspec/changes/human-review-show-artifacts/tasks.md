# Tasks: Human Review 节点展示关联产物

## 模块：前端 — flow-tab.tsx (packages/web/src/pages/kanban/task-detail)

### 产物查询逻辑扩展

- [x] 修改 `NodeRunItem` 的 `loadNodeArtifacts` 函数，当 human_review 节点自身无产物时，fallback 查询 `flowRunId` 下所有产物 **[S]**
- [x] 确保 `loadNodeArtifacts` 在 `expanded` 且 `nodeRun.id` 变化时正确触发 **[S]**

### 产物展示区域调整

- [x] 将产物展示区域移到 `waiting_human` 状态的 input JSON 之前 **[S]**
- [x] 当有产物时，隐藏 JSON 格式的 input 展示（避免信息冗余） **[S]**
- [x] 当无产物时，保持原有的 input JSON 展示（向后兼容） **[S]**

### 交互能力验证

- [x] 确认产物卡片的展开/折叠预览在审核界面中正常工作 **[S]**
- [x] 确认全屏查看按钮（Eye 图标）在审核界面中正常触发 onFullscreen 回调 **[S]**
- [x] 确认编辑按钮在审核界面中正常触发 onEditArtifact 回调 **[S]**
- [x] 确认编辑保存后 artifactRefreshKey 递增触发产物列表刷新 **[S]**

## 模块：前端 — 错误处理

### 静默错误处理

- [x] 确认产物 API 请求失败时不影响审核操作按钮 **[S]**
- [x] 确认产物加载失败时不显示错误提示给用户 **[S]**

## 模块：OpenSpec 文档

### Spec 归档

- [x] 归档完成后更新 `openspec/specs/flow-engine/2026-02-14-flow-execution.md` **[S]**
- [x] 归档完成后更新 `openspec/specs/artifact/2026-02-16-artifact-management.md` **[S]**

## 测试验证

### 端到端验证

- [x] 启动 agent_task → human_review 流程 → 确认审核界面展示上游产物 **[S]**
- [x] 在审核界面展开产物卡片 → 确认 Markdown 内容正确渲染 **[S]**
- [x] 点击全屏按钮 → 确认全屏 Dialog 正常打开 **[S]**
- [x] 点击编辑按钮 → 修改内容 → 保存 → 确认产物列表自动刷新 **[S]**
- [x] 上游节点无产物时 → 确认不显示产物区域，显示原有 input JSON **[S]**
- [x] 产物 API 请求失败时 → 确认审核操作按钮正常可用 **[S]**
