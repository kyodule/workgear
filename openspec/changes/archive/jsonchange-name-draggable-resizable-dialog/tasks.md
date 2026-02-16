# Tasks: Draggable Resizable Dialog — 可拖拽可调整大小的 Dialog 组件

## 模块：依赖管理

### 安装 react-rnd

- [x] 在 `packages/web/` 下执行 `npm install react-rnd` **[S]**
- [x] 确认 `package.json` 中已添加 `react-rnd` 依赖 **[S]**
- [x] 确认 TypeScript 类型正常（react-rnd 自带类型定义） **[S]**

## 模块：通用组件 (packages/web/src/components)

### 创建 DraggableResizableDialog 组件

- [x] 新建 `draggable-resizable-dialog.tsx` 文件 **[S]**
- [x] 定义 `DraggableResizableDialogProps` 接口（open、onOpenChange、title、children、defaultWidth、defaultHeight、minWidth、minHeight、className、containerClassName、overlay） **[S]**
- [x] 使用 `createPortal` 渲染到 `document.body`，open 为 false 时返回 null **[S]**
- [x] 实现遮罩层（`bg-black/80 fixed inset-0 z-50`），点击遮罩调用 `onOpenChange(false)` **[S]**
- [x] 使用 react-rnd 的 `<Rnd>` 组件作为 Dialog 容器，设置 `default` prop 为视口居中位置和默认尺寸 **[M]**
- [x] 配置 `dragHandleClassName="drag-handle"` 将拖拽限定在标题栏 **[S]**
- [x] 配置 `bounds="window"` 防止 Dialog 被拖出视口 **[S]**
- [x] 配置 `minWidth` / `minHeight` 传递尺寸约束 **[S]**
- [x] 实现标题栏（`className="drag-handle" border-b px-4 py-3 cursor-grab`），显示 title 和关闭按钮（X 图标） **[S]**
- [x] 实现内容区域（`flex-1 overflow-y-auto p-4`），渲染 children **[S]**
- [x] 设置 `style={{ display: 'flex' }}` 确保 Rnd 内部 flex 布局生效 **[S]**

### 实现关闭和重置

- [x] ESC 键监听：open 时 `addEventListener('keydown')`，ESC 触发 `onOpenChange(false)` **[S]**
- [x] 关闭按钮（X 图标）点击触发 `onOpenChange(false)` **[S]**
- [x] 使用 `key={String(open)}` 确保每次打开时重新挂载 `<Rnd>`，恢复初始位置和尺寸 **[S]**

### 可访问性（审查反馈修复）

- [x] 添加 `role="dialog"` 和 `aria-modal="true"` 到 Dialog 容器 **[S]**
- [x] 使用 `useId()` 生成标题 ID，通过 `aria-labelledby` 关联标题 **[S]**
- [x] 关闭按钮添加 `aria-label="关闭"` **[S]**
- [x] 实现焦点管理：打开时聚焦 Dialog，关闭时返回之前的焦点元素 **[M]**

### 小屏适配（审查反馈修复）

- [x] 初始坐标使用 `Math.max(0, (viewport - size) / 2)` 钳制到非负值 **[S]**
- [x] 打开时按视口动态限制 `defaultWidth/defaultHeight`，避免固定尺寸在窄屏溢出 **[S]**

### Props 语义对齐（审查反馈修复）

- [x] `className` 应用到内容区域（`flex-1 overflow-y-auto p-4` 节点） **[S]**
- [x] 新增 `containerClassName` 用于外层 `<Rnd>` 容器样式 **[S]**

## 模块：Node Log Dialog (packages/web/src/components)

### 改造 NodeLogDialog 使用 DraggableResizableDialog

- [x] 替换 import：移除 Shadcn Dialog 相关导入（Dialog、DialogContent、DialogHeader、DialogTitle），导入 `DraggableResizableDialog` **[S]**
- [x] 替换 JSX 容器：`<Dialog>` + `<DialogContent>` → `<DraggableResizableDialog>` **[S]**
- [x] 设置 `defaultWidth={896}` `defaultHeight={600}` `minWidth={480}` `minHeight={320}` **[S]**
- [x] 将标题内容（节点名称 + 状态 Badge）传入 `title` prop **[S]**
- [x] 移除日志内容区域的 `h-[60vh]` 固定高度，改为自适应父容器 **[S]**
- [x] 确认日志加载逻辑（useEffect + API 请求）不受影响 **[S]**
- [x] 确认 WebSocket 实时订阅（useNodeLogStream）不受影响 **[S]**
- [x] 确认自动滚动逻辑（scrollRef + autoScroll state）正常工作 **[S]**

## 测试验证

### 自动化测试（审查反馈修复）

- [x] 安装 vitest、@testing-library/react、@testing-library/jest-dom、@testing-library/user-event、jsdom **[M]**
- [x] 创建 `vitest.config.ts` 和 `src/test/setup.ts` 测试基础设施 **[S]**
- [x] 在 `package.json` 中添加 `test` 和 `test:watch` 脚本 **[S]**
- [x] 创建 `src/components/__tests__/draggable-resizable-dialog.test.tsx` **[M]**
- [x] 测试：open=false 时不渲染 **[S]**
- [x] 测试：open=true 时渲染 dialog、title、children **[S]**
- [x] 测试：overlay 默认显示，overlay=false 时隐藏 **[S]**
- [x] 测试：role="dialog"、aria-modal="true"、aria-labelledby 关联 **[S]**
- [x] 测试：关闭按钮有 aria-label **[S]**
- [x] 测试：ESC 键触发 onOpenChange(false) **[S]**
- [x] 测试：点击关闭按钮触发 onOpenChange(false) **[S]**
- [x] 测试：点击遮罩触发 onOpenChange(false) **[S]**
- [x] 测试：关闭后重新打开恢复默认尺寸 **[S]**
- [x] 测试：自定义 defaultWidth/defaultHeight 传递给 Rnd **[S]**
- [x] 测试：minWidth/minHeight 传递给 Rnd **[S]**
- [x] 测试：bounds="window" 传递给 Rnd **[S]**
- [x] 测试：dragHandleClassName 传递给 Rnd **[S]**
- [x] 测试：className 应用到内容区域而非外层容器 **[S]**
- [x] 测试：containerClassName 应用到外层 Rnd 容器 **[S]**
- [x] 测试：小视口下初始位置钳制到非负值、尺寸不超出视口 **[S]**

### DraggableResizableDialog 基础功能（手动验证）

- [x] 打开 Dialog → 确认居中显示，尺寸为 defaultWidth × defaultHeight **[S]**
- [x] 拖拽标题栏 → 确认 Dialog 跟随移动 **[S]**
- [x] 确认 Dialog 不会被拖出视口（bounds="window"） **[S]**
- [x] 拖拽四边 → 确认单方向调整大小正确 **[S]**
- [x] 拖拽四角 → 确认双方向调整大小正确 **[S]**
- [x] 调整到最小尺寸 → 确认不小于 minWidth / minHeight **[S]**
- [x] 按 ESC → 确认 Dialog 关闭 **[S]**
- [x] 点击 X 按钮 → 确认 Dialog 关闭 **[S]**
- [x] 点击遮罩 → 确认 Dialog 关闭 **[S]**
- [x] 关闭后重新打开 → 确认恢复到居中位置和默认尺寸 **[S]**

### Node Log Dialog 改造验证

- [x] 打开 Node Log Dialog → 确认使用 DraggableResizableDialog 渲染 **[S]**
- [x] 确认标题显示「执行日志 - {nodeName}」和状态 Badge **[S]**
- [x] 拖拽 Dialog 到屏幕一侧 → 确认可以看到底层 DAG 工作流图 **[S]**
- [x] 调整 Dialog 大小 → 确认日志内容区域自适应 **[S]**
- [x] running 状态节点 → 拖拽/resize 后 → 确认 WebSocket 日志正常追加 **[S]**
- [x] 确认自动滚动在拖拽/resize 后仍正常工作 **[S]**
- [x] 确认 loading 状态和空日志状态正常显示 **[S]**
- [x] Dark mode → 确认 Dialog 样式正确适配 **[S]**

## 模块：OpenSpec 文档

- [x] 归档完成后更新 `openspec/specs/artifact/` 目录 **[S]**
- [x] 归档完成后更新 `openspec/specs/kanban/` 目录 **[S]**
