# Proposal: Human Review 节点展示关联产物

## 背景（Why）

当前 human_review 节点在等待人工审核时，用户只能看到 JSON 格式的 `input` 数据，无法直观查看该节点生成的产物（如 Proposal、Design、Tasks 等 Markdown 文档）。用户必须切换到"产物"标签页才能找到相关内容，导致审核体验割裂。

### 用户痛点

- 审核时需要在"流程"和"产物"标签页之间反复切换
- 无法在审核界面直接预览产物内容
- JSON 格式的 input 数据不适合人类阅读，尤其是长文本内容
- 审核决策依赖的关键信息（如 OpenSpec 规划文档）被隐藏在产物列表中

### 根因分析

1. **前端展示逻辑缺失**：`flow-tab.tsx` 的 `NodeRunItem` 组件在 `waiting_human` 状态下只渲染 `input` 的 JSON，没有加载和展示关联的 artifacts
2. **产物关联未利用**：数据库中 `artifacts` 表已有 `node_run_id` 字段，但前端未在审核界面查询和展示
3. **交互设计不完整**：缺少产物预览卡片、全屏查看、编辑等交互入口

## 目标（What）

在 human_review 节点的审核界面中，自动展示该节点生成的所有产物，并提供预览、全屏查看、编辑功能。

### 具体方案

1. **产物自动加载**：当 `NodeRunItem` 展开且状态为 `waiting_human` 时，自动查询 `GET /api/artifacts?nodeRunId={nodeRunId}` 获取关联产物
2. **产物卡片展示**：复用现有的 `<ArtifactPreviewCard>` 组件，在审核界面中渲染产物列表
3. **交互能力**：支持展开/折叠预览、全屏查看、编辑产物（复用现有 `<ArtifactEditorDialog>`）
4. **实时刷新**：当产物被编辑后，通过 `artifactRefreshKey` 机制刷新审核界面的产物列表

### 用户体验改进

| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| 审核 OpenSpec 规划 | 切换到产物标签页查看 proposal.md | 审核界面直接展示产物卡片，点击展开预览 |
| 查看完整文档 | 在产物卡片中滚动查看 | 点击全屏按钮，沉浸式阅读 |
| 修改产物后重新审核 | 编辑后需手动刷新页面 | 编辑保存后自动刷新审核界面 |

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| flow-engine | Spec 更新 | 补充 human_review 节点展示产物的行为规范 |
| artifact | Spec 更新 | 补充产物在审核界面中的展示规范 |
| web (flow-tab) | 代码变更 | `NodeRunItem` 组件增加产物加载和展示逻辑 |
| api | 无变更 | 复用现有 `GET /api/artifacts?nodeRunId=` 接口 |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | `NodeRunItem` 增加产物加载和展示逻辑 |
| `openspec/specs/flow-engine/2026-02-14-flow-execution.md` | MODIFY | 补充 human_review 节点展示产物的规范 |
| `openspec/specs/artifact/2026-02-16-artifact-management.md` | MODIFY | 补充产物在审核界面中的展示规范 |

### 不涉及

- 后端 API 无变更（复用现有接口）
- 数据库 schema 无变更
- 产物编辑逻辑无变更（复用现有 `<ArtifactEditorDialog>`）
- 产物标签页无变更（保持独立的产物管理入口）

## 非目标

- 不实现产物的内联编辑（继续使用弹窗编辑器）
- 不实现产物的批量操作（如批量下载、批量删除）
- 不实现产物的版本对比功能（后续迭代）
- 不改变产物的创建逻辑（仍由 agent_task 节点自动创建）

## 风险评估

- **风险等级：低** — 纯前端展示逻辑变更，不涉及后端和数据库
- 复用现有组件和 API，代码变更量小
- 产物加载失败时静默处理，不影响审核流程
- 与现有产物标签页功能互补，不冲突
