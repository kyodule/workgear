# Tasks: 移动端响应式适配

## 模块：前端基础 — Hooks (packages/web/src/hooks)

### 移动端检测 Hook

- [x] 创建 `use-is-mobile.ts` 文件 **[S]**
- [x] 实现 `useIsMobile(breakpoint?: number)` Hook，默认断点 768px **[M]**
- [x] 实现 `useDeviceType()` Hook，返回 'mobile' | 'tablet' | 'desktop' **[M]**
- [x] 添加 `resize` 事件监听和清理逻辑 **[S]**
- [x] 添加防抖优化，避免频繁重渲染 **[M]**
- [x] 编写单元测试 `__tests__/use-is-mobile.test.ts` **[M]**

## 模块：前端布局 — 导航组件 (packages/web/src/components/layout)

### 侧边栏移动端抽屉模式

- [x] 修改 `sidebar.tsx`，增加移动端检测 **[S]**
- [x] 移动端默认隐藏侧边栏，使用 `useState` 管理显示状态 **[M]**
- [x] 实现抽屉式侧边栏，从左侧滑入/滑出动画 **[M]**
- [x] 侧边栏宽度在移动端设置为 `w-4/5 max-w-[300px]` **[S]**
- [x] 添加遮罩层，点击遮罩关闭侧边栏 **[S]**
- [x] 菜单项高度增加到 `h-11` (44px)，字体增大到 `text-base` **[S]**

### 顶部导航栏移动端优化

- [x] 修改 `header.tsx`，增加移动端检测 **[S]**
- [x] 移动端显示汉堡菜单按钮（☰），点击区域 `w-11 h-11` (44px) **[M]**
- [x] 汉堡菜单按钮点击时打开侧边栏抽屉 **[S]**
- [x] 移动端导航栏高度调整为 `h-14` (56px) **[S]**
- [x] 移动端标题字体调整为 `text-lg` (18px) **[S]**
- [x] 确保导航栏在移动端固定在顶部 `fixed top-0` **[S]**

### 移动端底部导航组件（可选）

- [x] 创建 `mobile-bottom-nav.tsx` 组件（如果需要） **[M]**
- [x] 实现底部固定导航，包含主要功能入口 **[M]**
- [x] 每个导航按钮高度 `h-14` (56px)，图标 + 文字布局 **[S]**

## 模块：看板 — 看板列表和任务卡片 (packages/web/src/pages/kanban)

### 看板列响应式布局

- [x] 修改 `index.tsx`，增加响应式布局类 **[M]**
- [x] 移动端 (< 768px)：单列垂直堆叠 `flex flex-col gap-4` **[S]**
- [x] 平板端 (768px - 1024px)：双列网格 `md:grid md:grid-cols-2` **[S]**
- [x] 桌面端 (>= 1024px)：水平滚动 `lg:flex lg:flex-row lg:overflow-x-auto` **[S]**
- [x] 看板列宽度：移动端 `w-full`，桌面端 `lg:w-[320px]` **[S]**

### 任务卡片移动端优化

- [x] 修改 `task-card.tsx`，增加移动端样式 **[M]**
- [x] 卡片内边距移动端增加到 `p-4` **[S]**
- [x] 卡片字体移动端增大到 `text-base` **[S]**
- [x] 卡片最小高度设置为 `min-h-[44px]` **[S]**
- [x] 将 `hover:` 效果替换为 `active:` 效果（移动端） **[S]**
- [x] 移动端禁用拖拽功能（条件判断） **[M]**

### 创建任务对话框移动端适配

- [x] 修改 `create-task-dialog.tsx`，增加移动端全屏模式 **[M]**
- [x] 输入框高度增加到 `h-11` (44px) **[S]**
- [x] 输入框字体增大到 `text-base` (16px) **[S]**
- [x] 按钮高度增加到 `h-11` (44px) **[S]**
- [x] 移动端按钮垂直堆叠布局 `flex flex-col gap-2` **[S]**

## 模块：看板 — 任务详情页 (packages/web/src/pages/kanban/task-detail)

### 任务详情对话框移动端全屏

- [x] 修改 `index.tsx`，增加移动端检测 **[S]**
- [x] 移动端使用全屏模式 `fullScreen={isMobile}` **[S]**
- [x] 移动端实现自定义顶部头部（返回按钮 + 标题） **[M]**
- [x] 返回按钮点击区域 `w-11 h-11` (44px) **[S]**
- [x] 移动端实现底部固定标签导航 **[M]**
- [x] 标签按钮高度 `h-14` (56px)，图标 + 文字垂直布局 **[S]**
- [x] 内容区域占据剩余空间 `flex-1 overflow-y-auto` **[S]**

### Timeline Tab 移动端优化

- [x] 修改 `timeline-tab.tsx`，增加移动端样式 **[M]**
- [x] 事件头部最小高度 `min-h-[44px]` **[S]**
- [x] 事件 Badge 字体移动端增大到 `text-sm` **[S]**
- [x] 事件内容字体移动端增大到 `text-base` **[S]**
- [x] 代码块字体移动端增大到 `text-sm` **[S]**
- [x] 确保长文本自动换行 `break-words` **[S]**

### Flow Tab 移动端优化

- [x] 修改 `flow-tab.tsx`，增加移动端样式 **[M]**
- [x] 节点卡片内边距移动端增加到 `p-4` **[S]**
- [x] 节点头部最小高度 `min-h-[44px]` **[S]**
- [x] 节点字体移动端增大到 `text-base` **[S]**
- [x] 节点间距移动端增加到 `space-y-4` **[S]**

## 模块：产物 — 对话框组件 (packages/web/src/components/artifact)

### DraggableResizableDialog 移动端全屏

- [x] 修改 `draggable-resizable-dialog.tsx`，增加 `fullScreen` prop **[M]**
- [x] 移动端自动启用全屏模式 `fullScreen={isMobile}` **[S]**
- [x] 全屏模式下样式：`w-full h-full max-w-full max-h-full m-0 rounded-none` **[S]**
- [x] 移动端禁用拖拽功能 `draggable={!fullScreen}` **[S]**
- [x] 移动端禁用调整大小功能 `resizable={!fullScreen}` **[S]**
- [x] 关闭按钮点击区域增加到 `w-11 h-11` (44px) **[S]**

### Markdown 预览对话框移动端适配

- [x] 修改 `markdown-preview-dialog.tsx`，增加移动端全屏模式 **[M]**
- [x] Markdown 内容自适应屏幕宽度 `max-w-full` **[S]**
- [x] 代码块支持横向滚动 `overflow-x-auto` **[S]**
- [x] 图片自适应屏幕宽度 `max-w-full h-auto` **[S]**
- [x] 移动端内边距调整为 `p-4` **[S]**

### Node Log Dialog 移动端优化

- [x] 确保 Node Log Dialog 在移动端全屏显示 **[S]**
- [x] 日志条目字体移动端增大到 `text-base` **[S]**
- [x] 代码块支持横向滚动 **[S]**
- [x] 确保自动滚动功能在移动端正常工作 **[M]**

## 模块：认证 — 登录页面 (packages/web/src/pages/auth)

### 登录页面移动端适配

- [x] 修改 `login.tsx`，增加移动端响应式样式 **[M]**
- [x] 表单宽度移动端设置为 `w-[90%] max-w-[400px]` **[S]**
- [x] 表单内边距移动端调整为 `p-6` **[S]**
- [x] 输入框高度增加到 `h-11` (44px) **[S]**
- [x] 输入框字体增大到 `text-base` (16px) **[S]**
- [x] 按钮高度增加到 `h-11` (44px) **[S]**
- [x] 按钮字体增大到 `text-base` (16px) **[S]**
- [x] "忘记密码"链接点击区域增加到 `min-h-[44px]` **[S]**

## 模块：项目 — 项目列表和导航 (packages/web/src/pages/projects)

### 项目列表响应式布局

- [x] 修改 `index.tsx`，增加响应式网格布局 **[M]**
- [x] 移动端 (< 768px)：单列布局 `grid-cols-1` **[S]**
- [x] 平板端 (768px - 1024px)：双列布局 `md:grid-cols-2` **[S]**
- [x] 桌面端 (>= 1024px)：三列布局 `lg:grid-cols-3` **[S]**
- [x] 项目卡片内边距保持 `p-4` **[S]**

### 项目卡片移动端优化

- [x] 项目名称字体保持 `text-lg` (18px) **[S]**
- [x] 项目描述字体保持 `text-sm` (14px) **[S]**
- [x] 操作按钮点击区域增加到 `w-11 h-11` (44px) **[S]**
- [x] 卡片最小高度设置为 `min-h-[120px]` **[S]**

### 创建项目按钮移动端优化

- [x] 移动端显示为浮动操作按钮（FAB）`fixed bottom-4 right-4` **[M]**
- [x] FAB 大小设置为 `w-14 h-14` (56px) **[S]**
- [x] FAB 显示"+"图标，圆形 `rounded-full` **[S]**
- [x] FAB 添加阴影 `shadow-lg` **[S]**

## 模块：样式配置 — Tailwind Config

### Tailwind 配置检查

- [x] 检查 `tailwind.config.js`，确保响应式断点配置正确 **[S]**
- [x] 确认默认断点：sm: 640px, md: 768px, lg: 1024px **[S]**
- [x] 如需自定义断点，添加到 `theme.screens` **[S]**

## 测试验证

### 自动化测试

- [x] 编写 `use-is-mobile.test.ts` 单元测试 **[M]**
- [x] 测试：窗口宽度 < 768px 时返回 true **[S]**
- [x] 测试：窗口宽度 >= 768px 时返回 false **[S]**
- [x] 测试：窗口大小变化时正确更新状态 **[M]**

### 手动验证 — Chrome DevTools 设备模拟

- [ ] 测试 iPhone SE (375x667) 布局 **[M]**
- [ ] 测试 iPhone 12 Pro (390x844) 布局 **[M]**
- [ ] 测试 iPad (768x1024) 布局 **[M]**
- [ ] 测试 iPad Pro (1024x1366) 布局 **[M]**

### 手动验证 — 真实设备

- [ ] 在 iOS Safari (iPhone) 上测试 **[L]**
- [ ] 在 iOS Safari (iPad) 上测试 **[L]**
- [ ] 在 Android Chrome (手机) 上测试 **[L]**
- [ ] 在 Android Chrome (平板) 上测试 **[L]**

### 手动验证 — 功能场景

- [ ] 浏览看板列表，确认单列/双列/多列布局正确 **[M]**
- [ ] 点击任务卡片，确认详情页全屏显示 **[M]**
- [ ] 切换 Timeline/Flow/Artifacts 标签，确认底部导航工作正常 **[M]**
- [ ] 创建任务，确认对话框全屏显示，输入框易于操作 **[M]**
- [ ] 查看 Timeline 事件，确认折叠/展开交互正常 **[M]**
- [ ] 查看 Flow 节点日志，确认对话框全屏显示 **[M]**
- [ ] 打开侧边栏，确认抽屉式导航工作正常 **[M]**
- [ ] 登录页面，确认表单布局和输入框大小正确 **[M]**
- [ ] 浏览项目列表，确认网格布局正确 **[M]**
- [ ] 测试横屏模式，确认布局自适应 **[M]**
- [ ] 测试 Dark Mode，确认所有颜色在移动端清晰可见 **[M]**

### 性能验证

- [x] 使用 Chrome DevTools Performance 分析移动端性能 **[L]**
- [x] 确认 `resize` 事件监听有防抖优化 **[M]**
- [ ] 确认移动端资源加载时间在可接受范围内 **[M]**
- [ ] 确认滚动性能流畅，无卡顿 **[M]**

## 文档更新

### 开发文档

- [ ] 更新 `DEVELOPMENT.md`，添加移动端开发指南 **[M]**
- [ ] 添加响应式设计最佳实践说明 **[M]**
- [ ] 添加触摸目标最小尺寸规范（44x44px） **[S]**
- [ ] 添加移动端测试指南 **[M]**

### 用户文档

- [ ] 更新 `README.md`，说明系统支持移动端访问 **[S]**
- [ ] 添加移动端使用说明（如果需要） **[M]**
