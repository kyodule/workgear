# Tasks: 统一 Timeline 和 Flow 节点的折叠展开格式

## 模块：前端 — timeline-tab.tsx (packages/web/src/pages/kanban/task-detail)

### TimelineEventItem 子组件创建

- [ ] 在 `timeline-tab.tsx` 中创建 `TimelineEventItem` 子组件 **[M]**
- [ ] 为 `TimelineEventItem` 增加 `event: TimelineEvent` prop **[S]**
- [ ] 增加 `expanded` 状态，默认值为 `false` **[S]**
- [ ] 实现 `handleToggle` 函数切换 `expanded` 状态 **[S]**

### 事件头部交互优化

- [ ] 将事件头部包裹在可点击的 `div` 中，绑定 `onClick={handleToggle}` **[S]**
- [ ] 增加 `cursor-pointer` 和 `hover:bg-muted/50` 样式到事件头部 **[S]**
- [ ] 保持现有的 Badge（事件类型）和时间戳显示 **[S]**
- [ ] 在折叠状态下，事件头部显示内容摘要（调用 `getEventSummary()`） **[M]**

### 内容摘要生成逻辑

- [ ] 创建 `getEventSummary(event: TimelineEvent): string` 辅助函数 **[M]**
- [ ] 处理字符串类型内容：截断为 100 字符，超出部分显示 "..." **[S]**
- [ ] 处理 `agent_dispatch_completed` 事件：提取 `selected_role` 字段作为摘要 **[S]**
- [ ] 处理其他对象类型内容：显示 "包含 N 个字段" **[S]**

### 展开内容渲染

- [ ] 使用条件渲染 `{expanded && ...}` 控制完整内容的显示 **[S]**
- [ ] 创建 `renderEventContent(event: TimelineEvent)` 辅助函数 **[M]**
- [ ] 保持 `agent_dispatch_completed` 事件的结构化展示逻辑（角色 Badge、降级标识、原因） **[S]**
- [ ] 保持字符串内容的直接显示 **[S]**
- [ ] 保持其他对象内容的 JSON 格式化显示 **[S]**

### TimelineTab 主组件重构

- [ ] 修改 `TimelineTab` 的事件列表渲染，使用 `<TimelineEventItem>` 替代内联渲染 **[S]**
- [ ] 确保时间线视觉元素（圆点、连接线）保持不变 **[S]**
- [ ] 保持加载状态和空状态提示的现有逻辑 **[S]**

### 视觉样式优化

- [ ] 确保事件头部的 hover 效果与 Flow Tab 的 NodeRunItem 一致 **[S]**
- [ ] 调整折叠状态下的内容摘要样式（`text-muted-foreground`、`truncate`） **[S]**
- [ ] 确保展开内容的间距和边框与 Flow Tab 保持一致 **[S]**

## 模块：前端 — 自动化测试

### 单元测试 (packages/web/src/pages/kanban/task-detail/__tests__/timeline-tab.test.tsx)

- [ ] 创建测试文件（如果不存在） **[S]**
- [ ] 测试：默认折叠状态下，事件显示摘要而非完整内容 **[M]**
- [ ] 测试：点击事件头部后，事件展开显示完整内容 **[M]**
- [ ] 测试：再次点击事件头部后，事件折叠回摘要状态 **[M]**
- [ ] 测试：`agent_dispatch_completed` 事件的结构化内容正确渲染 **[M]**
- [ ] 测试：空事件列表显示正确的空状态提示 **[S]**
- [ ] 测试：加载状态显示 "加载中..." 提示 **[S]**

## 测试验证

### 手动验证

- [ ] 打开任务详情页 Timeline Tab → 确认所有事件默认折叠 **[S]**
- [ ] 点击任意事件头部 → 确认事件展开显示完整内容 **[S]**
- [ ] 再次点击已展开的事件头部 → 确认事件折叠 **[S]**
- [ ] 同时展开多个事件 → 确认多个事件可以同时展开 **[S]**
- [ ] 对比 Flow Tab 的节点展示 → 确认交互模式和视觉样式一致 **[S]**
- [ ] 测试不同事件类型（agent_message、status_change、agent_dispatch_completed 等） **[M]**
- [ ] 测试长内容事件 → 确认摘要正确截断，展开后显示完整内容 **[S]**
- [ ] 测试空事件列表 → 确认显示空状态提示 **[S]**
