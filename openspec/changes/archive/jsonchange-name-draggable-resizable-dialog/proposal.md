# Proposal: Draggable Resizable Dialog — 可拖拽可调整大小的 Dialog 组件

## 背景（Why）

当前 WorkGear 中所有 Dialog 均基于 Shadcn/Radix UI Dialog 实现，采用固定居中定位（`left-[50%] top-[50%] translate`），尺寸由 `max-w-*` 和 `max-h-*` 硬编码控制。这在以下场景中造成了明显的体验问题：

1. **Node Log Dialog**（`node-log-dialog.tsx`）：执行日志中包含大量 JSON 格式的 `tool_input` 和 `tool_result`，在 `max-w-4xl max-h-[80vh]` 的固定容器中，用户无法根据 JSON 内容的复杂度自由调整窗口大小。
2. **Artifact Editor Dialog**（`artifact-editor-dialog.tsx`）：编辑产物内容时，固定尺寸的 Dialog 无法适应不同长度的文档。
3. **多 Dialog 并行查看**：用户在审阅工作流执行结果时，经常需要同时查看多个节点的日志或产物，但固定居中的 Dialog 会完全遮挡底层内容，无法拖拽到一侧进行对照。

### 用户痛点

- JSON 数据（tool_input / tool_result）结构复杂时，`max-h-[80vh]` 的容器需要大量滚动，无法一次性看到完整的数据结构
- Dialog 固定居中，遮挡了底层的 DAG 工作流图和其他面板，用户无法边看日志边查看工作流拓扑
- 无法调整 Dialog 宽度来适应不同宽度的 JSON 内容（窄 JSON vs 深层嵌套的宽 JSON）
- 当用户需要对比两个节点的输出时，无法将 Dialog 拖拽到屏幕两侧

### 根因分析

项目使用的 Shadcn Dialog 组件基于 Radix UI Dialog，设计为模态居中弹窗，不支持拖拽和调整大小。项目中缺少一个可拖拽、可调整大小的 Dialog 基础组件。

## 目标（What）

创建一个通用的可拖拽、可调整大小的 Dialog 组件，并将其应用到 JSON 内容查看场景，提升用户在查看复杂数据时的交互体验：

| 元素 | 当前状态 | 目标状态 |
|------|----------|----------|
| Dialog 基础组件 | 仅有固定居中的 Shadcn Dialog | 新增 `<DraggableResizableDialog>` 通用组件 |
| Node Log Dialog | 固定 max-w-4xl max-h-[80vh] | 可拖拽、可调整大小，支持自由定位 |
| JSON 内容展示 | CodeBlock 固定 max-h-[12rem] | 在可调整大小的 Dialog 中自适应展示 |
| 多窗口查看 | 不支持 | Dialog 可拖拽到任意位置，不遮挡底层内容 |

### 具体方案

1. 引入成熟的 [react-rnd](https://github.com/bokuweb/react-rnd) 库，基于其 `<Rnd>` 组件封装通用 `<DraggableResizableDialog>`
2. 组件支持：标题栏拖拽移动、四边和四角调整大小、最小/最大尺寸约束、ESC 关闭
3. 改造 `node-log-dialog.tsx`：使用新组件替换固定尺寸的 Shadcn Dialog
4. 保留 Shadcn Dialog 的视觉风格（边框、圆角、阴影、背景色），确保 UI 一致性

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| artifact (Components) | 新增文件 | 新增 `<DraggableResizableDialog>` 通用组件 |
| kanban (Node Log) | 代码变更 | `node-log-dialog.tsx` 改用可拖拽 Dialog |
| 依赖 | 新增 npm 包 | `react-rnd`（~12KB gzipped，成熟稳定，周下载量 100K+） |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/package.json` | MODIFY | 新增 `react-rnd` 依赖 |
| `packages/web/src/components/draggable-resizable-dialog.tsx` | ADD | 基于 react-rnd 封装的可拖拽可调整大小 Dialog 通用组件 |
| `packages/web/src/components/node-log-dialog.tsx` | MODIFY | 使用 DraggableResizableDialog 替换 Shadcn Dialog |

### 不涉及

- 数据库 schema 无变更
- API 层无变更（Dialog 使用已有数据，无需新增端点）
- Shadcn Dialog 基础组件不修改（保留给其他简单弹窗使用）
- Orchestrator / Go 服务无变更
- 不影响其他使用 Shadcn Dialog 的组件（create-task-dialog、start-flow-dialog 等）

## 非目标

- 不实现窗口最小化/最大化按钮（仅支持手动拖拽调整大小）
- 不实现多窗口层叠管理（z-index 管理）
- 不实现窗口吸附/对齐功能（snap to edge）
- 不改造所有现有 Dialog（仅改造 Node Log Dialog 作为首个应用场景）
- 不实现 JSON 树形折叠/展开查看器（仍使用 CodeBlock 渲染）
- 不实现 Dialog 位置/大小的持久化存储

## 风险评估

- **风险等级：低** — 变更集中在前端 UI 交互层，不影响数据模型和核心流程
- 使用成熟的 [react-rnd](https://github.com/bokuweb/react-rnd) 库，避免自己造轮子，拖拽和 resize 行为经过社区大量验证
- react-rnd 体积小（~12KB gzipped），依赖 react-draggable 和 re-resizable，均为成熟库
- DraggableResizableDialog 是独立新组件，不修改 Shadcn Dialog 基础组件，向后兼容
- Node Log Dialog 的数据加载逻辑和 WebSocket 订阅不受影响，仅替换外层容器
