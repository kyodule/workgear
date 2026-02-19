# Design: 移动端响应式适配

## 技术方案

### 方案概述

为系统增加移动端响应式支持，使用 Tailwind CSS 的响应式断点（sm:、md:、lg:）来适配不同屏幕尺寸。所有变更均在前端，不涉及后端 API 或数据库。采用移动优先（Mobile First）的设计策略，从小屏幕开始设计，逐步增强到大屏幕。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 响应式策略 | 移动优先（Mobile First） | 确保核心功能在小屏幕上可用，逐步增强 |
| 断点定义 | Tailwind 默认断点（sm: 640px, md: 768px, lg: 1024px） | 符合行业标准，覆盖主流设备 |
| 对话框移动端模式 | 全屏模式 | 最大化内容可见区域，避免对话框超出视口 |
| 侧边栏移动端模式 | 抽屉式（默认隐藏） | 节省屏幕空间，通过汉堡菜单访问 |
| 触摸目标最小尺寸 | 44x44px | 符合 Apple HIG 和 Material Design 推荐标准 |
| 看板列移动端布局 | 单列垂直堆叠 | 避免横向滚动，提升浏览体验 |
| 任务详情标签页 | 底部固定导航 | 符合移动端导航习惯，易于触摸操作 |
| 输入框字体大小 | 至少 16px | 避免 iOS Safari 自动缩放页面 |

### 备选方案（已排除）

- **开发独立的移动端 App**：排除原因：开发成本高，维护复杂，响应式 Web 已能满足需求
- **使用第三方 UI 框架（如 Ant Design Mobile）**：排除原因：与现有 shadcn/ui 组件库不兼容，增加包体积
- **看板列横向滑动**：排除原因：用户反馈垂直滚动更符合移动端习惯
- **对话框底部抽屉模式**：排除原因：全屏模式提供更大的内容区域，适合复杂表单

---

## 数据流

### 响应式断点定义

```typescript
// Tailwind 默认断点
const breakpoints = {
  sm: '640px',   // 大屏手机（横屏）
  md: '768px',   // 平板（竖屏）
  lg: '1024px',  // 平板（横屏）、小屏笔记本
  xl: '1280px',  // 桌面显示器
  '2xl': '1536px' // 大屏显示器
}

// 移动端判断逻辑
const isMobile = window.innerWidth < 768 // < md
const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024 // md to lg
const isDesktop = window.innerWidth >= 1024 // >= lg
```

### 组件响应式适配模式

```tsx
// 模式 1: 使用 Tailwind 响应式类
<div className="
  w-full              // 移动端：全宽
  md:w-1/2            // 平板：半宽
  lg:w-1/3            // 桌面：三分之一宽
  p-4                 // 移动端：内边距 16px
  md:p-6              // 平板及以上：内边距 24px
">
  内容
</div>

// 模式 2: 使用 React Hook 检测屏幕尺寸
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

// 使用示例
function MyComponent() {
  const isMobile = useIsMobile()

  return (
    <Dialog fullScreen={isMobile}>
      {/* 移动端全屏，桌面端居中 */}
    </Dialog>
  )
}

// 模式 3: 条件渲染不同组件
function Navigation() {
  const isMobile = useIsMobile()

  return isMobile ? (
    <MobileDrawerNav />  // 移动端：抽屉式导航
  ) : (
    <DesktopSidebarNav /> // 桌面端：固定侧边栏
  )
}
```

### DraggableResizableDialog 响应式适配

```tsx
// 修改前
<DraggableResizableDialog
  title="任务详情"
  defaultWidth={800}
  defaultHeight={600}
>
  {content}
</DraggableResizableDialog>

// 修改后
function ResponsiveDialog({ title, children, ...props }) {
  const isMobile = useIsMobile()

  return (
    <DraggableResizableDialog
      title={title}
      fullScreen={isMobile}  // 移动端全屏
      draggable={!isMobile}  // 移动端禁用拖拽
      resizable={!isMobile}  // 移动端禁用调整大小
      className={cn(
        isMobile && "w-full h-full",  // 移动端全屏
        !isMobile && "w-[800px] h-[600px]"  // 桌面端固定尺寸
      )}
      {...props}
    >
      {children}
    </DraggableResizableDialog>
  )
}
```

---

## 文件变更清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `packages/web/src/hooks/use-is-mobile.ts` | 移动端检测 Hook |
| `packages/web/src/components/layout/mobile-drawer-nav.tsx` | 移动端抽屉式导航 |
| `packages/web/src/components/layout/mobile-bottom-nav.tsx` | 移动端底部导航 |

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/pages/kanban/index.tsx` | MODIFY | 看板列响应式布局（单列/双列/多列） |
| `packages/web/src/pages/kanban/task-card.tsx` | MODIFY | 任务卡片移动端样式（内边距、字体、触摸区域） |
| `packages/web/src/pages/kanban/task-detail/index.tsx` | MODIFY | 任务详情页全屏模式、底部标签导航 |
| `packages/web/src/pages/kanban/task-detail/timeline-tab.tsx` | MODIFY | Timeline Tab 移动端布局优化 |
| `packages/web/src/pages/kanban/task-detail/flow-tab.tsx` | MODIFY | Flow Tab 移动端布局优化 |
| `packages/web/src/pages/kanban/create-task-dialog.tsx` | MODIFY | 创建任务对话框移动端全屏 |
| `packages/web/src/components/artifact/draggable-resizable-dialog.tsx` | MODIFY | 对话框移动端全屏模式、禁用拖拽/调整大小 |
| `packages/web/src/components/artifact/markdown-preview-dialog.tsx` | MODIFY | Markdown 预览移动端全屏、内容自适应 |
| `packages/web/src/components/layout/sidebar.tsx` | MODIFY | 侧边栏移动端抽屉模式 |
| `packages/web/src/components/layout/header.tsx` | MODIFY | 顶部导航栏移动端优化（汉堡菜单、标题） |
| `packages/web/src/pages/auth/login.tsx` | MODIFY | 登录页面响应式适配 |
| `packages/web/src/pages/projects/index.tsx` | MODIFY | 项目列表移动端布局（单列/双列/三列） |
| `packages/web/tailwind.config.js` | MODIFY | 确保响应式断点配置正确 |

### 删除文件

无

---

## 具体代码变更

### 变更 1: 新增 `use-is-mobile.ts` Hook

```typescript
// packages/web/src/hooks/use-is-mobile.ts
import { useState, useEffect } from 'react'

/**
 * 检测当前设备是否为移动端
 * @param breakpoint 断点宽度（默认 768px）
 * @returns 是否为移动端
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // 初始检测
    checkMobile()

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

/**
 * 检测当前设备类型
 * @returns 设备类型：mobile | tablet | desktop
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth
      if (width < 768) {
        setDeviceType('mobile')
      } else if (width < 1024) {
        setDeviceType('tablet')
      } else {
        setDeviceType('desktop')
      }
    }

    checkDeviceType()
    window.addEventListener('resize', checkDeviceType)
    return () => window.removeEventListener('resize', checkDeviceType)
  }, [])

  return deviceType
}
```

### 变更 2: 修改 `draggable-resizable-dialog.tsx` 增加移动端全屏模式

```tsx
// packages/web/src/components/artifact/draggable-resizable-dialog.tsx
import { useIsMobile } from '@/hooks/use-is-mobile'

interface DraggableResizableDialogProps {
  // ... 现有 props
  fullScreen?: boolean  // 新增：强制全屏模式
}

export function DraggableResizableDialog({
  fullScreen: forcedFullScreen,
  ...props
}: DraggableResizableDialogProps) {
  const isMobile = useIsMobile()
  const fullScreen = forcedFullScreen ?? isMobile  // 移动端默认全屏

  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          // 移动端全屏样式
          fullScreen && "w-full h-full max-w-full max-h-full m-0 rounded-none",
          // 桌面端居中样式
          !fullScreen && "w-[800px] max-w-[90vw] max-h-[90vh]",
          // 禁用拖拽和调整大小
          fullScreen && "pointer-events-auto"
        )}
        // 移动端禁用拖拽
        draggable={!fullScreen}
        resizable={!fullScreen}
      >
        {/* 对话框内容 */}
      </DialogContent>
    </Dialog>
  )
}
```

### 变更 3: 修改 `kanban/index.tsx` 看板列响应式布局

```tsx
// packages/web/src/pages/kanban/index.tsx
export function KanbanBoard() {
  const { columns } = useKanbanStore()

  return (
    <div className="
      flex flex-col gap-4        // 移动端：垂直堆叠
      md:grid md:grid-cols-2     // 平板：双列网格
      lg:flex lg:flex-row        // 桌面：水平滚动
      lg:overflow-x-auto
      p-4 md:p-6
    ">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          className="
            w-full                 // 移动端：全宽
            md:w-auto              // 平板：自适应
            lg:w-[320px] lg:flex-shrink-0  // 桌面：固定宽度
          "
        />
      ))}
    </div>
  )
}
```

### 变更 4: 修改 `task-detail/index.tsx` 任务详情页移动端全屏

```tsx
// packages/web/src/pages/kanban/task-detail/index.tsx
import { useIsMobile } from '@/hooks/use-is-mobile'

export function TaskDetailDialog({ taskId, open, onClose }: TaskDetailDialogProps) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('timeline')

  return (
    <DraggableResizableDialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      title={isMobile ? undefined : "任务详情"}  // 移动端不显示标题（使用自定义头部）
    >
      {isMobile ? (
        // 移动端布局：顶部头部 + 内容 + 底部导航
        <div className="flex flex-col h-full">
          {/* 顶部头部 */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-11 h-11 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">任务详情</h2>
            <div className="w-11" /> {/* 占位 */}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'timeline' && <TimelineTab taskId={taskId} />}
            {activeTab === 'flow' && <FlowTab taskId={taskId} />}
            {activeTab === 'artifacts' && <ArtifactsTab taskId={taskId} />}
          </div>

          {/* 底部标签导航 */}
          <div className="flex border-t bg-background">
            <button
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "flex-1 h-14 flex flex-col items-center justify-center gap-1",
                activeTab === 'timeline' && "text-primary"
              )}
            >
              <Clock className="w-5 h-5" />
              <span className="text-xs">时间线</span>
            </button>
            <button
              onClick={() => setActiveTab('flow')}
              className={cn(
                "flex-1 h-14 flex flex-col items-center justify-center gap-1",
                activeTab === 'flow' && "text-primary"
              )}
            >
              <Workflow className="w-5 h-5" />
              <span className="text-xs">流程</span>
            </button>
            <button
              onClick={() => setActiveTab('artifacts')}
              className={cn(
                "flex-1 h-14 flex flex-col items-center justify-center gap-1",
                activeTab === 'artifacts' && "text-primary"
              )}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs">产物</span>
            </button>
          </div>
        </div>
      ) : (
        // 桌面端布局：保持现有的标签页布局
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline">时间线</TabsTrigger>
            <TabsTrigger value="flow">流程</TabsTrigger>
            <TabsTrigger value="artifacts">产物</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline"><TimelineTab taskId={taskId} /></TabsContent>
          <TabsContent value="flow"><FlowTab taskId={taskId} /></TabsContent>
          <TabsContent value="artifacts"><ArtifactsTab taskId={taskId} /></TabsContent>
        </Tabs>
      )}
    </DraggableResizableDialog>
  )
}
```

### 变更 5: 修改 `timeline-tab.tsx` 移动端样式优化

```tsx
// packages/web/src/pages/kanban/task-detail/timeline-tab.tsx
function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex gap-3">
      {/* 时间线视觉元素 */}
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <div className="flex-1 border-l border-border" />
      </div>

      {/* 事件内容 */}
      <div className="flex-1 pb-4">
        {/* 事件头部 */}
        <div
          className="
            flex items-center gap-2 cursor-pointer rounded px-2 py-1 -mx-2
            hover:bg-muted/50 active:bg-muted/50
            min-h-[44px]  // 移动端最小触摸区域
          "
          onClick={() => setExpanded(!expanded)}
        >
          <Badge variant={eventColor} className="text-sm md:text-xs">
            {eventLabel}
          </Badge>
          <span className="text-sm md:text-xs text-muted-foreground">
            {new Date(event.createdAt).toLocaleString('zh-CN')}
          </span>
          {!expanded && (
            <span className="text-base md:text-sm text-muted-foreground truncate flex-1">
              {summary}
            </span>
          )}
        </div>

        {/* 展开的完整内容 */}
        {expanded && (
          <div className="mt-2 text-base md:text-sm">
            {renderEventContent(event)}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## 测试策略

### 自动化测试

- 单元测试：`packages/web/src/hooks/__tests__/use-is-mobile.test.ts`
  - 测试：窗口宽度 < 768px 时返回 true
  - 测试：窗口宽度 >= 768px 时返回 false
  - 测试：窗口大小变化时正确更新状态

- 组件测试：各页面和组件的响应式行为
  - 测试：移动端对话框以全屏模式显示
  - 测试：移动端看板列以单列布局显示
  - 测试：移动端侧边栏默认隐藏
  - 测试：移动端按钮点击区域至少 44x44px

### 手动验证

- 使用 Chrome DevTools 的设备模拟器测试不同屏幕尺寸：
  - iPhone SE (375x667)
  - iPhone 12 Pro (390x844)
  - iPad (768x1024)
  - iPad Pro (1024x1366)

- 测试真实设备：
  - iOS Safari（iPhone、iPad）
  - Android Chrome（手机、平板）

- 测试场景：
  - 浏览看板列表
  - 查看任务详情
  - 创建和编辑任务
  - 查看 Timeline 和 Flow
  - 登录和导航

---

## 性能考虑

- **响应式检测开销**：使用 `useIsMobile` Hook 监听 `resize` 事件，需要防抖优化以避免频繁重渲染
- **条件渲染优化**：移动端和桌面端组件分别渲染，避免加载不必要的代码
- **图片和资源优化**：移动端加载较小尺寸的图片，减少流量消耗
- **虚拟滚动**：如果列表项过多（100+ 个），考虑引入虚拟滚动优化性能

---

## 向后兼容性

- 桌面端布局和交互保持不变
- 响应式适配仅在移动端和平板端生效
- 现有 API 和数据结构无变更
- 用户在桌面端的使用习惯不受影响
