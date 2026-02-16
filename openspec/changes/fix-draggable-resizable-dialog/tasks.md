# Tasks: Fix DraggableResizableDialog — 修复可拖拽 Dialog 的可访问性、滚动和 Dark Mode 问题

## 模块：DraggableResizableDialog 核心修复 (packages/web/src/components)

### Focus Trap 实现

- [ ] 将现有 ESC keydown 监听扩展为统一的 keydown handler，同时处理 Tab 和 ESC **[M]**
- [ ] 实现 Tab focus trap：查询 Dialog 内所有可聚焦元素，最后一个 Tab 跳回第一个 **[M]**
- [ ] 实现 Shift+Tab 反向 focus trap：第一个元素 Shift+Tab 跳到最后一个 **[S]**
- [ ] 可聚焦元素选择器：`a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])` **[S]**

### ESC 键冒泡修复

- [ ] ESC handler 中添加 `e.stopPropagation()` 防止冒泡到外层组件 **[S]**

### Body Scroll Lock

- [ ] 实现模块级 `scrollLockCount` 引用计数器和 `originalOverflow` 缓存 **[S]**
- [ ] 实现 `lockScroll()` 函数：计数 +1，首次锁定时保存并设置 `body.style.overflow = 'hidden'` **[S]**
- [ ] 实现 `unlockScroll()` 函数：计数 -1，归零时恢复 `body.style.overflow` **[S]**
- [ ] 添加 `useEffect`：open 时调用 `lockScroll()`，cleanup 调用 `unlockScroll()` **[S]**

### 新增 Props

- [ ] 新增 `contentRef?: React.Ref<HTMLDivElement>` prop，暴露内容区域 DOM 引用 **[S]**
- [ ] 新增 `footer?: ReactNode` prop，渲染底部操作栏（border-t + flex justify-end） **[S]**
- [ ] 内容区域 `<div>` 绑定 `contentRef`（使用 callback ref 合并内部 ref 和外部 ref） **[S]**
- [ ] footer 区域渲染在内容区域下方、Dialog 底部 **[S]**

## 模块：Node Log Dialog 修复 (packages/web/src/components)

### 双重滚动修复

- [ ] 移除日志容器的 `h-full overflow-y-auto`，仅保留 `pr-4` **[S]**
- [ ] 使用 DraggableResizableDialog 的 `contentRef` prop 传入 `scrollRef` **[S]**
- [ ] 将 `onScroll` 自动滚动检测改为通过 `useEffect` 监听 `contentRef` 的 scroll 事件 **[M]**
- [ ] 确认自动滚动逻辑（scrollRef.scrollTop = scrollRef.scrollHeight）在新结构下正常工作 **[S]**

### Dark Mode 日志颜色修复

- [ ] assistant 类型：`bg-blue-50` → `bg-blue-50 dark:bg-blue-950` **[S]**
- [ ] tool_use 类型：`bg-green-50` → `bg-green-50 dark:bg-green-950` **[S]**
- [ ] tool_result 类型：`bg-gray-50` → `bg-gray-50 dark:bg-gray-900` **[S]**
- [ ] result 类型：`bg-gray-50` → `bg-gray-50 dark:bg-gray-900` **[S]**
- [ ] default 类型：`bg-gray-50` → `bg-gray-50 dark:bg-gray-900` **[S]**

## 模块：Artifact Editor Dialog 改造 (packages/web/src/components)

### 替换为 DraggableResizableDialog

- [ ] 替换 import：移除 Shadcn Dialog 相关导入，导入 `DraggableResizableDialog` **[S]**
- [ ] 替换 JSX 容器：`<Dialog>` + `<DialogContent>` → `<DraggableResizableDialog>` **[S]**
- [ ] 设置 `defaultWidth={768}` `defaultHeight={560}` `minWidth={480}` `minHeight={400}` **[S]**
- [ ] 将标题内容（类型 Badge + 标题 + 版本号）传入 `title` prop **[S]**
- [ ] 将底部按钮（取消 + 保存）传入 `footer` prop **[S]**
- [ ] Textarea 改为 `flex-1 min-h-[200px]` 自适应 Dialog 高度 **[S]**
- [ ] 确认保存逻辑（POST /artifacts/{id}/versions）不受影响 **[S]**
- [ ] 确认状态管理（content, changeSummary, saving）不受影响 **[S]**

## 模块：Flow Error Dialog 改造 (packages/web/src/components)

### 替换为 DraggableResizableDialog

- [ ] 替换 import：移除 Shadcn Dialog 相关导入，导入 `DraggableResizableDialog` **[S]**
- [ ] 替换 JSX 容器：`<Dialog>` + `<DialogContent>` → `<DraggableResizableDialog>` **[S]**
- [ ] 设置 `defaultWidth={1024}` `defaultHeight={560}` `minWidth={480}` `minHeight={320}` **[S]**
- [ ] 将标题「流程执行错误详情」传入 `title` prop **[S]**
- [ ] 将复制按钮传入 `footer` prop **[S]**
- [ ] Textarea 改为 `h-full` 自适应 Dialog 高度 **[S]**
- [ ] 确认复制逻辑（navigator.clipboard.writeText）不受影响 **[S]**

## 测试验证

### 自动化测试补充

- [ ] 测试：Tab 键在 Dialog 内循环（最后一个 → 第一个） **[M]**
- [ ] 测试：Shift+Tab 在 Dialog 内反向循环（第一个 → 最后一个） **[M]**
- [ ] 测试：ESC 键事件调用 stopPropagation **[S]**
- [ ] 测试：打开时 body.style.overflow 为 'hidden' **[S]**
- [ ] 测试：关闭时 body.style.overflow 恢复原始值 **[S]**
- [ ] 测试：多 Dialog 场景引用计数正确（两个打开 → 关一个 → overflow 仍 hidden → 关第二个 → 恢复） **[M]**
- [ ] 测试：footer prop 渲染底部操作栏 **[S]**
- [ ] 测试：footer 为 undefined 时不渲染底部区域 **[S]**
- [ ] 测试：contentRef 暴露内容区域 DOM 引用 **[S]**

### 手动验证

- [ ] DraggableResizableDialog：Tab 键不跳出 Dialog **[S]**
- [ ] DraggableResizableDialog：打开时底层页面不可滚动 **[S]**
- [ ] Node Log Dialog：无双重滚动条 **[S]**
- [ ] Node Log Dialog：Dark Mode 下各类型日志条目颜色正确 **[S]**
- [ ] Node Log Dialog：自动滚动在修复后正常工作 **[S]**
- [ ] Artifact Editor Dialog：可拖拽、可调整大小 **[S]**
- [ ] Artifact Editor Dialog：保存功能正常 **[S]**
- [ ] Flow Error Dialog：可拖拽、可调整大小 **[S]**
- [ ] Flow Error Dialog：复制功能正常 **[S]**
