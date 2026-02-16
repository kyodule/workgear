# Tasks: Draggable Resizable Dialog — 可拖拽可调整大小的 Dialog 组件

## 模块：依赖管理

### 安装 react-rnd

- [ ] 在 `packages/web/` 下执行 `npm install react-rnd` **[S]**
- [ ] 确认 `package.json` 中已添加 `react-rnd` 依赖 **[S]**
- [ ] 确认 TypeScript 类型正常（react-rnd 自带类型定义） **[S]**

## 模块：通用组件 (packages/web/src/components)

### 创建 DraggableResizableDialog 组件

- [ ] 新建 `draggable-resizable-dialog.tsx` 文件 **[S]**
- [ ] 定义 `DraggableResizableDialogProps` 接口（open、onOpenChange、title、children、defaultWidth、defaultHeight、minWidth、minHeight、className、overlay） **[S]**
- [ ] 使用 `createPortal` 渲染到 `document.body`，open 为 false 时返回 null **[S]**
- [ ] 实现遮罩层（`bg-black/80 fixed inset-0 z-50`），点击遮罩调用 `onOpenChange(false)` **[S]**
- [ ] 使用 react-rnd 的 `<Rnd>` 组件作为 Dialog 容器，设置 `default` prop 为视口居中位置和默认尺寸 **[M]**
- [ ] 配置 `dragHandleClassName="drag-handle"` 将拖拽限定在标题栏 **[S]**
- [ ] 配置 `bounds="window"` 防止 Dialog 被拖出视口 **[S]**
- [ ] 配置 `minWidth` / `minHeight` 传递尺寸约束 **[S]**
- [ ] 实现标题栏（`className="drag-handle" border-b px-4 py-3 cursor-grab`），显示 title 和关闭按钮（X 图标） **[S]**
- [ ] 实现内容区域（`flex-1 overflow-y-auto p-4`），渲染 children **[S]**
- [ ] 设置 `style={{ display: 'flex' }}` 确保 Rnd 内部 flex 布局生效 **[S]**

### 实现关闭和重置

- [ ] ESC 键监听：open 时 `addEventListener('keydown')`，ESC 触发 `onOpenChange(false)` **[S]**
- [ ] 关闭按钮（X 图标）点击触发 `onOpenChange(false)` **[S]**
- [ ] 使用 `key={String(open)}` 确保每次打开时重新挂载 `<Rnd>`，恢复初始位置和尺寸 **[S]**

## 模块：Node Log Dialog (packages/web/src/components)

### 改造 NodeLogDialog 使用 DraggableResizableDialog

- [ ] 替换 import：移除 Shadcn Dialog 相关导入（Dialog、DialogContent、DialogHeader、DialogTitle），导入 `DraggableResizableDialog` **[S]**
- [ ] 替换 JSX 容器：`<Dialog>` + `<DialogContent>` → `<DraggableResizableDialog>` **[S]**
- [ ] 设置 `defaultWidth={896}` `defaultHeight={600}` `minWidth={480}` `minHeight={320}` **[S]**
- [ ] 将标题内容（节点名称 + 状态 Badge）传入 `title` prop **[S]**
- [ ] 移除日志内容区域的 `h-[60vh]` 固定高度，改为自适应父容器 **[S]**
- [ ] 确认日志加载逻辑（useEffect + API 请求）不受影响 **[S]**
- [ ] 确认 WebSocket 实时订阅（useNodeLogStream）不受影响 **[S]**
- [ ] 确认自动滚动逻辑（scrollRef + autoScroll state）正常工作 **[S]**

## 测试验证

### DraggableResizableDialog 基础功能

- [ ] 打开 Dialog → 确认居中显示，尺寸为 defaultWidth × defaultHeight **[S]**
- [ ] 拖拽标题栏 → 确认 Dialog 跟随移动 **[S]**
- [ ] 确认 Dialog 不会被拖出视口（bounds="window"） **[S]**
- [ ] 拖拽四边 → 确认单方向调整大小正确 **[S]**
- [ ] 拖拽四角 → 确认双方向调整大小正确 **[S]**
- [ ] 调整到最小尺寸 → 确认不小于 minWidth / minHeight **[S]**
- [ ] 按 ESC → 确认 Dialog 关闭 **[S]**
- [ ] 点击 X 按钮 → 确认 Dialog 关闭 **[S]**
- [ ] 点击遮罩 → 确认 Dialog 关闭 **[S]**
- [ ] 关闭后重新打开 → 确认恢复到居中位置和默认尺寸 **[S]**

### Node Log Dialog 改造验证

- [ ] 打开 Node Log Dialog → 确认使用 DraggableResizableDialog 渲染 **[S]**
- [ ] 确认标题显示「执行日志 - {nodeName}」和状态 Badge **[S]**
- [ ] 拖拽 Dialog 到屏幕一侧 → 确认可以看到底层 DAG 工作流图 **[S]**
- [ ] 调整 Dialog 大小 → 确认日志内容区域自适应 **[S]**
- [ ] running 状态节点 → 拖拽/resize 后 → 确认 WebSocket 日志正常追加 **[S]**
- [ ] 确认自动滚动在拖拽/resize 后仍正常工作 **[S]**
- [ ] 确认 loading 状态和空日志状态正常显示 **[S]**
- [ ] Dark mode → 确认 Dialog 样式正确适配 **[S]**

## 模块：OpenSpec 文档

- [ ] 归档完成后更新 `openspec/specs/artifact/` 目录 **[S]**
- [ ] 归档完成后更新 `openspec/specs/kanban/` 目录 **[S]**
