# Proposal: Fix DraggableResizableDialog — 修复可拖拽 Dialog 的可访问性、滚动和 Dark Mode 问题

## 背景（Why）

在 `jsonchange-name-draggable-resizable-dialog` 变更中，我们引入了基于 react-rnd 的 `<DraggableResizableDialog>` 通用组件，并将 Node Log Dialog 改造为可拖拽可调整大小。该组件已上线运行，但在实际使用中发现以下问题：

### 问题清单

1. **Focus Trap 缺失**：Dialog 设置了 `aria-modal="true"` 语义，但未实现 focus trap。用户按 Tab 键可以跳出 Dialog 聚焦到底层页面元素，违反 WAI-ARIA Dialog 模式规范。
2. **ESC 键冒泡未阻止**：ESC 监听在 `document` 级别，未调用 `e.stopPropagation()`。如果 Dialog 内有嵌套的可关闭组件（如 Tooltip、Dropdown），ESC 会同时关闭外层 Dialog。
3. **Body Scroll 未锁定**：Dialog 打开时底层页面仍可通过鼠标滚轮/触摸滚动，遮罩层仅阻止了点击但未阻止滚动穿透。
4. **Node Log Dialog 双重滚动**：`DraggableResizableDialog` 内容区域已设置 `overflow-y-auto`，而 `node-log-dialog.tsx` 的日志容器又设置了 `h-full overflow-y-auto`，造成嵌套滚动区域，用户体验混乱。
5. **Dark Mode 日志条目颜色硬编码**：`LogEntry` 组件使用 `bg-blue-50`、`bg-green-50`、`bg-gray-50` 等硬编码浅色背景，在 Dark Mode 下文字不可见或背景不协调。
6. **Artifact Editor Dialog 未改造**：原始 proposal 中提到 Artifact Editor Dialog 也有固定尺寸问题（`max-w-2xl max-h-[85vh]`），编辑长文档时空间不足，但未被改造为可拖拽 Dialog。
7. **Flow Error Dialog 未改造**：使用固定 `max-w-5xl max-h-[80vh]` 的 Shadcn Dialog，查看大段错误堆栈时无法自由调整窗口大小。

### 用户痛点

- 使用屏幕阅读器的用户在 Dialog 打开时可以 Tab 到底层元素，造成操作混乱
- 在 Dialog 内操作 Dropdown 或 Tooltip 时按 ESC，Dialog 意外关闭
- 在移动端或触摸板上，Dialog 打开时底层页面跟随滚动
- Node Log Dialog 中出现两层滚动条，不确定应该滚动哪一层
- Dark Mode 下日志条目几乎不可见（浅色背景 + 深色主题冲突）
- 编辑产物内容时 Artifact Editor Dialog 空间不足，无法拖拽调整
- 查看长错误堆栈时 Flow Error Dialog 空间不足，无法拖拽调整

## 目标（What）

修复 `DraggableResizableDialog` 组件的可访问性和交互问题，并将其应用到更多 Dialog 场景：

| 元素 | 当前状态 | 目标状态 |
|------|----------|----------|
| Focus Trap | 缺失，Tab 可跳出 | 实现 focus trap，Tab 循环在 Dialog 内 |
| ESC 键处理 | 冒泡未阻止 | `stopPropagation` 防止意外关闭 |
| Body Scroll | 未锁定 | 打开时锁定 body 滚动 |
| Node Log 滚动 | 双重 overflow-y-auto | 移除内层冗余滚动，统一由外层管理 |
| Dark Mode 日志 | 硬编码浅色背景 | 使用 Tailwind dark: 变体适配 |
| Artifact Editor | 固定 Shadcn Dialog | 改用 DraggableResizableDialog |
| Flow Error Dialog | 固定 Shadcn Dialog | 改用 DraggableResizableDialog |

## 影响范围（Scope）

### 涉及模块

| 模块 | 影响 | 说明 |
|------|------|------|
| artifact (Components) | 代码变更 | 修复 DraggableResizableDialog 可访问性和滚动问题 |
| artifact (Artifact Editor) | 代码变更 | 改造 ArtifactEditorDialog 使用 DraggableResizableDialog |
| kanban (Node Log) | 代码变更 | 修复双重滚动和 Dark Mode 日志颜色 |
| kanban (Flow Error) | 代码变更 | 改造 FlowErrorDialog 使用 DraggableResizableDialog |

### 涉及文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/draggable-resizable-dialog.tsx` | MODIFY | 添加 focus trap、ESC stopPropagation、body scroll lock |
| `packages/web/src/components/node-log-dialog.tsx` | MODIFY | 修复双重滚动、Dark Mode 日志颜色 |
| `packages/web/src/components/artifact-editor-dialog.tsx` | MODIFY | 改用 DraggableResizableDialog |
| `packages/web/src/components/flow-error-dialog.tsx` | MODIFY | 改用 DraggableResizableDialog |
| `packages/web/src/components/__tests__/draggable-resizable-dialog.test.tsx` | MODIFY | 补充 focus trap、scroll lock 测试 |

### 不涉及

- 不新增 npm 依赖（focus trap 手动实现，不引入 focus-trap-react）
- 数据库 schema 无变更
- API 层无变更
- Orchestrator / Go 服务无变更
- 不影响其他使用 Shadcn Dialog 的简单弹窗（create-task-dialog、start-flow-dialog 等）

## 非目标

- 不实现完整的 WAI-ARIA Dialog 焦点恢复栈（仅单层 Dialog）
- 不实现 Dialog 之间的 z-index 层叠管理
- 不改造所有 Dialog（仅改造内容密集型的 Artifact Editor 和 Flow Error）
- 不引入第三方 focus trap 库（手动实现轻量 focus trap）
- 不实现 Dialog 位置/大小的持久化存储

## 风险评估

- **风险等级：低** — 变更集中在前端 UI 交互层，不影响数据模型和核心流程
- Focus trap 实现为标准 DOM 操作，不依赖第三方库
- Body scroll lock 使用 `overflow: hidden` 方案，兼容性好
- Artifact Editor 和 Flow Error Dialog 的数据逻辑不变，仅替换外层容器
- 所有变更均有对应测试覆盖
