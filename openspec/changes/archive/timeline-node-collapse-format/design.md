# Design: 统一 Timeline 和 Flow 节点的折叠展开格式

## 技术方案

### 方案概述

为 Timeline Tab 增加事件折叠/展开功能，重构 `timeline-tab.tsx` 组件，将事件渲染逻辑拆分为独立的 `TimelineEventItem` 子组件，使用 React 状态管理来控制每个事件的展开/折叠状态。所有变更均在前端，不涉及后端 API 或数据库。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 折叠状态管理 | 每个事件项独立管理 `expanded` 状态 | 与 Flow Tab 的 NodeRunItem 模式一致，简单直观 |
| 默认展开状态 | 默认折叠（`expanded = false`） | 提升大量事件的浏览体验，用户可按需展开 |
| 组件拆分 | 创建 `TimelineEventItem` 子组件 | 分离关注点，便于维护和测试 |
| 内容摘要截断 | 折叠时显示 1-2 行摘要 | 平衡信息密度和可读性 |
| 视觉样式 | 复用 Flow Tab 的样式（边框、hover 效果） | 保持 UI 一致性 |
| 点击区域 | 整个事件头部可点击 | 与 Flow Tab 交互模式一致 |

### 备选方案（已排除）

- **使用全局展开/折叠按钮**：排除原因：用户通常只关注部分事件，全局控制不够灵活
- **默认展开所有事件**：排除原因：与优化目标相悖，无法解决页面冗长问题
- **使用 Accordion 组件**：排除原因：Accordion 通常只允许一个项展开，不符合多事件同时查看的需求
- **虚拟滚动优化**：排除原因：当前事件数量不大，过度优化

---

## 数据流

### 组件结构变更

```
修复前:
  TimelineTab
    ├── 加载状态 (loading)
    ├── 空状态提示
    └── 事件列表 (直接渲染所有内容)
        └── 每个事件的完整内容

修复后:
  TimelineTab
    ├── 加载状态 (loading)
    ├── 空状态提示
    └── 事件列表
        └── TimelineEventItem (新增子组件)
            ├── expanded 状态 (默认 false)
            ├── 事件头部 (可点击)
            │   ├── 时间线圆点和连接线
            │   ├── Badge (事件类型)
            │   ├── 时间戳
            │   └── 折叠时的内容摘要
            └── 展开内容 (条件渲染)
                └── 完整事件内容
```

### 状态管理

```tsx
// TimelineEventItem 组件内部状态
const [expanded, setExpanded] = useState(false)

// 点击头部切换状态
const handleToggle = () => setExpanded(!expanded)

// 渲染逻辑
<div onClick={handleToggle} className="cursor-pointer hover:bg-muted/50">
  {/* 事件头部 */}
</div>
{expanded && (
  <div className="border-t px-3 py-3">
    {/* 完整内容 */}
  </div>
)}
```

### 内容摘要生成逻辑

```tsx
function getEventSummary(event: TimelineEvent): string {
  if (typeof event.content === 'string') {
    // 字符串内容：截断为 100 字符
    return event.content.length > 100
      ? event.content.slice(0, 100) + '...'
      : event.content
  }

  if (event.eventType === 'agent_dispatch_completed') {
    // 结构化事件：提取关键信息
    const content = event.content as Record<string, any>
    return `选中角色: ${content.selected_role}`
  }

  // 其他对象：显示 JSON 键数量
  const keys = Object.keys(event.content)
  return `包含 ${keys.length} 个字段`
}
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/pages/kanban/task-detail/timeline-tab.tsx` | MODIFY | 拆分 TimelineEventItem 子组件；增加折叠/展开状态管理；优化事件头部样式 |

### 新增文件

无（所有变更在现有文件中完成）

### 删除文件

无

---

## 具体代码变更

### 变更 1: `timeline-tab.tsx` — 拆分 TimelineEventItem 子组件

```tsx
// 修改前: 直接渲染所有事件内容
export function TimelineTab({ taskId }: TimelineTabProps) {
  // ... 状态和加载逻辑 ...

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <div className="flex-1 border-l border-border" />
          </div>
          <div className="flex-1 pb-4">
            {/* 直接显示所有内容 */}
            <div className="flex items-center gap-2">
              <Badge>{eventTypeLabels[event.eventType]}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="mt-1 text-sm">
              {/* 完整内容 */}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// 修改后: 使用 TimelineEventItem 子组件
export function TimelineTab({ taskId }: TimelineTabProps) {
  // ... 状态和加载逻辑不变 ...

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <TimelineEventItem key={event.id} event={event} />
      ))}
    </div>
  )
}

// 新增子组件
function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)

  const eventLabel = eventTypeLabels[event.eventType] || event.eventType
  const eventColor = eventTypeColors[event.eventType] || 'outline'

  // 生成内容摘要
  const summary = getEventSummary(event)

  return (
    <div className="flex gap-3">
      {/* 时间线视觉元素 */}
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <div className="flex-1 border-l border-border" />
      </div>

      {/* 事件内容 */}
      <div className="flex-1 pb-4">
        {/* 可点击的事件头部 */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
          onClick={() => setExpanded(!expanded)}
        >
          <Badge variant={eventColor}>{eventLabel}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleString('zh-CN')}
          </span>
          {!expanded && (
            <span className="text-sm text-muted-foreground truncate flex-1">
              {summary}
            </span>
          )}
        </div>

        {/* 展开的完整内容 */}
        {expanded && (
          <div className="mt-2 text-sm">
            {renderEventContent(event)}
          </div>
        )}
      </div>
    </div>
  )
}

// 辅助函数：生成内容摘要
function getEventSummary(event: TimelineEvent): string {
  if (typeof event.content === 'string') {
    return event.content.length > 100
      ? event.content.slice(0, 100) + '...'
      : event.content
  }

  if (event.eventType === 'agent_dispatch_completed') {
    const content = event.content as Record<string, any>
    return `选中角色: ${content.selected_role}`
  }

  return `包含 ${Object.keys(event.content).length} 个字段`
}

// 辅助函数：渲染事件内容（保持现有逻辑）
function renderEventContent(event: TimelineEvent) {
  if (event.eventType === 'agent_dispatch_completed' && typeof event.content === 'object') {
    return (
      <div className="space-y-1">
        <div>
          选中角色: <Badge variant="secondary">{(event.content as Record<string, any>).selected_role}</Badge>
          {(event.content as Record<string, any>).fallback && (
            <span className="ml-2 text-xs text-amber-600">⚠️ 降级策略</span>
          )}
        </div>
        {(event.content as Record<string, any>).reason && (
          <div className="text-muted-foreground">{(event.content as Record<string, any>).reason}</div>
        )}
      </div>
    )
  }

  if (typeof event.content === 'string') {
    return event.content
  }

  return JSON.stringify(event.content, null, 2)
}
```

### 关键变更点

1. **组件拆分**：将事件渲染逻辑从 `TimelineTab` 主组件中提取到 `TimelineEventItem` 子组件
2. **状态管理**：每个 `TimelineEventItem` 独立管理 `expanded` 状态
3. **交互优化**：事件头部增加 `cursor-pointer` 和 `hover:bg-muted/50` 样式，提供点击反馈
4. **内容摘要**：折叠状态下显示 `getEventSummary()` 生成的摘要文本
5. **条件渲染**：使用 `{expanded && ...}` 控制完整内容的显示
6. **保持兼容**：`renderEventContent()` 保持现有的内容格式化逻辑不变

---

## 测试策略

### 自动化测试

- 单元测试：`packages/web/src/pages/kanban/task-detail/__tests__/timeline-tab.test.tsx`（新增）
  - 测试：默认折叠状态下，事件显示摘要而非完整内容
  - 测试：点击事件头部后，事件展开显示完整内容
  - 测试：再次点击事件头部后，事件折叠回摘要状态
  - 测试：agent_dispatch_completed 事件的结构化内容正确渲染
  - 测试：空事件列表显示正确的空状态提示
  - 测试：加载状态显示 "加载中..." 提示

### 手动验证

- 打开任务详情页 Timeline Tab → 确认所有事件默认折叠，显示摘要
- 点击任意事件头部 → 确认事件展开，显示完整内容
- 再次点击已展开的事件头部 → 确认事件折叠回摘要状态
- 同时展开多个事件 → 确认多个事件可以同时处于展开状态
- 对比 Flow Tab 的节点展示 → 确认交互模式和视觉样式一致
- 测试不同事件类型（agent_message、status_change、agent_dispatch_completed 等）→ 确认摘要和完整内容正确显示
- 测试长内容事件 → 确认摘要正确截断，展开后显示完整内容

---

## 性能考虑

- **状态管理开销**：每个事件独立管理状态，对于大量事件（100+ 个）可能有轻微性能影响，但当前场景下事件数量通常在 10-50 个，性能影响可忽略
- **渲染优化**：折叠状态下仅渲染摘要文本，减少 DOM 节点数量
- **未来优化**：如果事件数量显著增加（500+ 个），可考虑引入虚拟滚动（react-window）

---

## 向后兼容性

- Timeline 数据结构不变，现有 API 无需修改
- 如果需要保持某些事件默认展开（如最新的 waiting_human 事件），可在 `TimelineEventItem` 中增加条件判断：
  ```tsx
  const [expanded, setExpanded] = useState(
    event.eventType === 'review_action' // 示例：review_action 默认展开
  )
  ```
