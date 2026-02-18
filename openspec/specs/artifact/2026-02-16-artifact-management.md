# Delta Spec: MarkdownFullscreenDialog 全屏预览组件 & Artifact Preview Card 全屏入口

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-16
> **Change:** markdown-fullscreen-preview

## 概述

修改产物管理模块，新增通用 `<MarkdownFullscreenDialog>` 全屏预览组件，并在 `<ArtifactPreviewCard>` 中增加全屏预览入口，让用户可以在全屏 Overlay 中沉浸式阅读 Markdown 内容。

---

## 场景

### Scenario 1: 新增 MarkdownFullscreenDialog 全屏预览组件

```gherkin
Given 开发者在任意场景中需要全屏展示 Markdown 内容
  And 传入 open（布尔值）、onOpenChange（回调）、content（Markdown 字符串）和 title（可选标题）props
When 组件渲染且 open 为 true
Then 显示一个全屏 Dialog Overlay，覆盖整个视口
  And Dialog 内部使用 <MarkdownRenderer> 渲染 content
  And 内容区域无高度限制，可自由滚动
  And Dialog 顶部显示 title（若提供）和关闭按钮（X 图标）
```

### Scenario 2: 关闭全屏预览

```gherkin
Given 全屏预览 Dialog 处于打开状态
When 用户按下 ESC 键
  Or 用户点击 Dialog 右上角的关闭按钮（X 图标）
  Or 用户点击 Dialog 外部的遮罩层
Then Dialog 关闭
  And 调用 onOpenChange(false) 回调
  And 返回到之前的页面状态，不丢失任何数据
```

### Scenario 3: 全屏预览保持 Markdown 渲染能力

```gherkin
Given 全屏预览 Dialog 打开
  And content 包含 GFM 表格、代码块、任务列表、标题层级等 Markdown 元素
When 内容渲染
Then 所有 Markdown 元素正确渲染（与非全屏模式一致）
  And 代码块保持语法高亮和复制按钮
  And 支持 dark mode 下的样式适配
```

### Scenario 4: Artifact Preview Card 增加全屏按钮

```gherkin
Given 用户在 Artifact Preview Card 中展开了产物内容
  And 内容已加载完成（非 loading 状态）
When 内容区域渲染
Then 内容区域右上角显示一个「全屏」按钮（Maximize2 图标）
  And 按钮样式与现有编辑按钮风格一致
```

### Scenario 5: Artifact Preview Card 点击全屏按钮打开全屏预览

```gherkin
Given Artifact Preview Card 内容区域显示全屏按钮
When 用户点击全屏按钮
Then 打开 MarkdownFullscreenDialog
  And Dialog 标题显示产物的 title
  And Dialog 内容为当前产物的完整 Markdown 内容
  And 关闭 Dialog 后回到 Preview Card 的展开状态
```

### Scenario 6: 内容为空时不显示全屏按钮

```gherkin
Given Artifact Preview Card 展开后内容为空
When 显示「暂无内容」占位提示
Then 不显示全屏按钮
```

---

## 产物在审核界面中的展示能力 (2026-02-18, human-review-show-artifacts)

### Scenario 7: ArtifactPreviewCard 在审核界面中渲染

```gherkin
Given 审核界面加载了关联产物列表
  And 产物列表包含多个不同类型的产物（proposal、design、tasks、spec）
When 产物列表渲染
Then 每个产物使用 <ArtifactPreviewCard> 组件渲染
  And 卡片显示产物类型标签（如 Proposal、Design、Tasks）
  And 卡片显示产物标题
  And 卡片支持点击展开/折叠预览
  And 展开后显示 Markdown 渲染的产物内容（最大高度 300px，可滚动）
```

### Scenario 8: 审核界面中的产物全屏查看

```gherkin
Given 审核界面中展示了产物卡片
  And 产物卡片处于折叠状态
When 用户点击产物卡片右侧的眼睛图标（Eye）
Then 触发全屏查看回调
  And 在全屏 Dialog 中展示产物的完整 Markdown 内容
  And 全屏 Dialog 标题显示产物标题
```

### Scenario 9: 审核界面中的产物编辑

```gherkin
Given 审核界面中展示了产物卡片
  And 产物卡片已展开且内容已加载
  And 节点状态为 waiting_human（审核进行中）
When 用户点击产物卡片的编辑按钮（Pencil 图标）
Then 打开 <ArtifactEditorDialog> 编辑器
  And 编辑器显示当前产物内容
  And 编辑器标题显示产物类型和标题
  And 用户可以修改内容并保存为新版本
```

### Scenario 10: 有产物时隐藏 JSON 格式的 input 展示

```gherkin
Given human_review 节点状态为 waiting_human
  And 审核界面已加载到关联产物（nodeArtifacts.length > 0）
When 产物区域渲染
Then 不显示 JSON 格式的 input 待审核内容
  And 仅展示格式化的产物卡片列表
  And 审核操作按钮正常显示
```

### Scenario 11: 产物按来源节点分组展示

```gherkin
Given 审核界面加载了多个节点的产物
  And 产物来自不同的上游 agent_task 节点
When 产物列表渲染
Then 产物按来源节点分组展示
  And 每组显示节点名称作为分组标题
  And 组内产物按创建时间排序
```

---

## UI 规格

### MarkdownFullscreenDialog

| 属性 | 值 |
|------|-----|
| 容器 | Shadcn Dialog，DialogContent 使用 `max-w-4xl w-full h-[90vh]` |
| 标题栏 | DialogHeader，显示 title + 关闭按钮 |
| 内容区域 | `overflow-y-auto flex-1`，内部使用 `<MarkdownRenderer>` |
| 关闭方式 | ESC 键 / 关闭按钮 / 点击遮罩 |
| 动画 | 使用 Shadcn Dialog 默认的 fade + scale 动画 |

### 全屏按钮（Artifact Preview Card）

| 属性 | 值 |
|------|-----|
| 图标 | `Maximize2`（lucide-react） |
| 大小 | `h-6 text-xs`（与编辑按钮一致） |
| 位置 | 编辑按钮左侧 |
| 变体 | `variant="outline"` |
