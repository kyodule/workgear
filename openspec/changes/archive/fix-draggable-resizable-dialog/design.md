# Design: Fix DraggableResizableDialog — 技术方案

## 技术方案

### 方案概述

修复 `<DraggableResizableDialog>` 组件的三个核心缺陷（focus trap、ESC 冒泡、body scroll lock），修复 Node Log Dialog 的双重滚动和 Dark Mode 颜色问题，并将 Artifact Editor Dialog 和 Flow Error Dialog 改造为可拖拽 Dialog。

### 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Focus Trap 实现 | 手动 DOM 查询 + keydown 拦截 | 不引入 focus-trap-react（~8KB），Dialog 内可聚焦元素有限，手动实现足够轻量 |
| Body Scroll Lock | `body.style.overflow = 'hidden'` | 最简方案，兼容性好；不使用 body-scroll-lock 库（过度设计） |
| Scroll Lock 引用计数 | 全局计数器 | 支持多 Dialog 同时打开场景，最后一个关闭时才恢复 scroll |
| ESC 处理 | `stopPropagation()` | 防止 ESC 冒泡到外层组件，同时保留 Dialog 自身的关闭行为 |
| Node Log 滚动修复 | 移除内层 overflow + 使用 contentRef | 统一由 DraggableResizableDialog 内容区域管理滚动，新增 `contentRef` prop 暴露内容区域 DOM 引用 |
| Dark Mode 颜色 | Tailwind `dark:` 变体 | 项目已使用 Tailwind dark mode，直接添加 `dark:bg-*` 类即可 |
| Artifact Editor 改造 | 替换为 DraggableResizableDialog + footer slot | 新增 `footer` prop 支持底部操作栏（保存/取消按钮） |
| Flow Error 改造 | 替换为 DraggableResizableDialog | 直接替换，错误内容放入 children |

### 备选方案（已排除）

- **focus-trap-react 库**：排除原因 — 增加 ~8KB 依赖，且与 react-rnd 的拖拽交互可能冲突（focus trap 会阻止拖拽手柄外的 mousedown）。
- **overscroll-behavior CSS**：排除原因 — 仅阻止滚动链（scroll chaining），不阻止遮罩层上的直接滚动。
- **body-scroll-lock 库**：排除原因 — 过度设计，`overflow: hidden` 已满足需求。
- **Radix Dialog 的 focus trap**：排除原因 — 与 react-rnd 的自由拖拽定位冲突，这正是最初选择不基于 Radix Dialog 的原因。

---

## 数据流

### Focus Trap 实现流程

```
Dialog 打开
  │
  ├── useEffect 注册 keydown 监听
  │     └── 监听 Tab / Shift+Tab
  │
  ▼
用户按 Tab
  │
  ├── 查询 Dialog 内所有可聚焦元素
  │     └── querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
  │
  ├── 计算当前焦点位置
  │     ├── 如果是最后一个元素 + Tab → 跳到第一个
  │     └── 如果是第一个元素 + Shift+Tab → 跳到最后一个
  │
  └── e.preventDefault() 阻止默认 Tab 行为
```

### Body Scroll Lock 引用计数

```
全局变量: scrollLockCount = 0, originalOverflow = ''

Dialog A 打开:
  scrollLockCount++ → 1
  if (scrollLockCount === 1):
    originalOverflow = body.style.overflow
    body.style.overflow = 'hidden'

Dialog B 打开:
  scrollLockCount++ → 2
  (不重复设置 overflow)

Dialog A 关闭:
  scrollLockCount-- → 1
  (不恢复 overflow，因为 B 仍打开)

Dialog B 关闭:
  scrollLockCount-- → 0
  if (scrollLockCount === 0):
    body.style.overflow = originalOverflow
```

### Node Log Dialog 滚动修复

```
修复前:
  DraggableResizableDialog
    └── 内容区域 (overflow-y-auto p-4)  ← 滚动层 1
          └── 日志容器 (h-full overflow-y-auto pr-4)  ← 滚动层 2（冗余）
                └── 日志条目列表

修复后:
  DraggableResizableDialog (contentRef={scrollRef})
    └── 内容区域 (overflow-y-auto p-4)  ← 唯一滚动层
          └── 日志容器 (pr-4)  ← 无滚动，纯布局
                └── 日志条目列表
```

### Artifact Editor Dialog 改造数据流

```
用户点击编辑产物
    │
    ▼
ArtifactEditorDialog 组件渲染
    │
    ├── open={true} → DraggableResizableDialog 打开
    │     ├── title = 产物类型 Badge + 标题 + 版本号
    │     ├── defaultWidth={768} defaultHeight={560}
    │     ├── minWidth={480} minHeight={400}
    │     ├── footer = 取消 + 保存按钮
    │     └── children = Textarea + 变更说明 Input
    │
    ├── 保存逻辑（POST /artifacts/{id}/versions）→ 不变
    └── 状态管理（content, changeSummary, saving）→ 不变
```

---

## 文件变更清单

### 修改文件

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `packages/web/src/components/draggable-resizable-dialog.tsx` | MODIFY | 添加 focus trap、ESC stopPropagation、body scroll lock、contentRef prop、footer prop |
| `packages/web/src/components/node-log-dialog.tsx` | MODIFY | 移除内层冗余滚动、使用 contentRef、修复 Dark Mode 颜色 |
| `packages/web/src/components/artifact-editor-dialog.tsx` | MODIFY | 改用 DraggableResizableDialog |
| `packages/web/src/components/flow-error-dialog.tsx` | MODIFY | 改用 DraggableResizableDialog |
| `packages/web/src/components/__tests__/draggable-resizable-dialog.test.tsx` | MODIFY | 补充 focus trap、scroll lock、footer 测试 |

### 新增文件

无

### 删除文件

无

---

## 具体代码变更

### 1. `draggable-resizable-dialog.tsx` — 核心修复

#### 1a. 新增 Props

```tsx
interface DraggableResizableDialogProps {
  // ... 现有 props ...
  /** 内容区域 DOM 引用，用于外部控制滚动 */
  contentRef?: React.Ref<HTMLDivElement>
  /** 底部操作栏（如保存/取消按钮） */
  footer?: ReactNode
}
```

#### 1b. Body Scroll Lock（模块级引用计数）

```tsx
let scrollLockCount = 0
let originalOverflow = ''

function lockScroll() {
  scrollLockCount++
  if (scrollLockCount === 1) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = originalOverflow
  }
}
```

#### 1c. Focus Trap

```tsx
useEffect(() => {
  if (!open) return

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onOpenChange(false)
      return
    }

    if (e.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [open, onOpenChange])
```

#### 1d. Scroll Lock useEffect

```tsx
useEffect(() => {
  if (open) {
    lockScroll()
    return () => unlockScroll()
  }
}, [open])
```

#### 1e. Footer 渲染

```tsx
{/* 内容区域 */}
<div ref={contentRef} className={cn('flex-1 overflow-y-auto p-4', className)}>
  {children}
</div>

{/* 底部操作栏 */}
{footer && (
  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
    {footer}
  </div>
)}
```

### 2. `node-log-dialog.tsx` — 滚动修复 + Dark Mode

```tsx
// 使用 contentRef 替代内部 scrollRef
<DraggableResizableDialog
  open={open}
  onOpenChange={onClose}
  contentRef={scrollRef}
  // ... 其他 props
>
  {/* 移除 h-full overflow-y-auto，仅保留 pr-4 */}
  <div ref={undefined} className="pr-4" onScroll={undefined}>
    <div className="space-y-2">
      {logs.map((log, i) => (
        <LogEntry key={i} event={log} />
      ))}
    </div>
  </div>
</DraggableResizableDialog>
```

注意：`onScroll` 需要改为监听 DraggableResizableDialog 的内容区域。通过 `contentRef` 获取 DOM 引用后，在 useEffect 中添加 scroll 事件监听。

Dark Mode 颜色修复：
```tsx
// assistant
<div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3">

// tool_use
<div className="rounded-lg border bg-green-50 dark:bg-green-950 p-3">

// tool_result / result / default
<div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3">
```

### 3. `artifact-editor-dialog.tsx` — 改造

```tsx
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'

// 替换 <Dialog> + <DialogContent> 为 <DraggableResizableDialog>
<DraggableResizableDialog
  open={open}
  onOpenChange={handleOpenChange}
  defaultWidth={768}
  defaultHeight={560}
  minWidth={480}
  minHeight={400}
  title={
    <span className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">
        {typeLabels[artifact.type] || artifact.type}
      </Badge>
      <span>{artifact.title}</span>
      <span className="text-sm text-muted-foreground font-normal">
        v{currentVersion} → v{currentVersion + 1}
      </span>
    </span>
  }
  footer={
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
        取消
      </Button>
      <Button onClick={handleSave} disabled={saving || !content.trim()}>
        {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        保存新版本
      </Button>
    </>
  }
>
  <div className="space-y-3 h-full flex flex-col">
    <Textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      className="flex-1 min-h-[200px] font-mono text-sm resize-y"
      placeholder="输入产物内容..."
    />
    <Input
      value={changeSummary}
      onChange={(e) => setChangeSummary(e.target.value)}
      placeholder="变更说明（可选）"
      className="text-sm"
    />
  </div>
</DraggableResizableDialog>
```

### 4. `flow-error-dialog.tsx` — 改造

```tsx
import { DraggableResizableDialog } from '@/components/draggable-resizable-dialog'

<DraggableResizableDialog
  open={open}
  onOpenChange={onOpenChange}
  defaultWidth={1024}
  defaultHeight={560}
  minWidth={480}
  minHeight={320}
  title="流程执行错误详情"
  footer={
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
      {copied ? '已复制' : '复制错误信息'}
    </Button>
  }
>
  <Textarea
    readOnly
    value={error}
    className="h-full text-xs font-mono resize-none"
  />
</DraggableResizableDialog>
```

---

## 测试策略

### 自动化测试（补充）

- 测试：Tab 键在 Dialog 内循环，不跳出
- 测试：Shift+Tab 在 Dialog 内反向循环
- 测试：ESC 键调用 stopPropagation
- 测试：打开时 body.style.overflow 为 hidden
- 测试：关闭时 body.style.overflow 恢复
- 测试：footer prop 渲染底部操作栏
- 测试：contentRef 暴露内容区域 DOM 引用

### 手动验证

- Dark Mode 下 Node Log Dialog 各类型日志条目颜色正确
- Node Log Dialog 无双重滚动条
- Artifact Editor Dialog 可拖拽、可调整大小
- Flow Error Dialog 可拖拽、可调整大小
- 多 Dialog 场景下 body scroll lock 正确
