# Delta Spec: Spec Artifact Viewer 全屏预览入口

> **Type:** MODIFIED
> **Module:** kanban
> **Date:** 2026-02-16
> **Change:** markdown-fullscreen-preview

## 概述

修改看板模块中 Spec Artifact Viewer 的 ArtifactContent 组件，在查看模式下增加「全屏」按钮，让用户可以在全屏 Overlay 中阅读 OpenSpec 文档。

---

## 场景

### Scenario 1: ArtifactContent 查看模式显示全屏按钮

```gherkin
Given 用户在 Spec Artifact Viewer 中查看某个 artifact（proposal / spec / design / tasks）
  And 当前处于查看模式（非编辑模式）
When ArtifactContent 组件渲染
Then 工具栏中「编辑」按钮左侧显示一个「全屏」按钮（Maximize2 图标）
  And 按钮文字为「全屏」
  And 按钮样式为 variant="outline" size="sm"
```

### Scenario 2: 点击全屏按钮打开全屏预览

```gherkin
Given ArtifactContent 查看模式显示全屏按钮
When 用户点击「全屏」按钮
Then 打开 MarkdownFullscreenDialog
  And Dialog 标题显示当前 artifact 的 relativePath（如 "proposal.md"、"specs/kanban/MODIFIED-2026-02-16-kanban-board.md"）
  And Dialog 内容为当前 artifact 的完整 Markdown 内容
```

### Scenario 3: 全屏预览关闭后回到查看模式

```gherkin
Given 用户通过 Spec Artifact Viewer 打开了全屏预览
When 用户关闭全屏 Dialog（ESC / 关闭按钮 / 点击遮罩）
Then 回到 Spec Artifact Viewer 的查看模式
  And Tab 选中状态和滚动位置保持不变
  And 不触发数据重新加载
```

### Scenario 4: 编辑模式下不显示全屏按钮

```gherkin
Given 用户在 Spec Artifact Viewer 中编辑某个 artifact
  And 当前处于编辑模式（显示 Textarea）
When ArtifactContent 组件渲染
Then 不显示「全屏」按钮
  And 仅显示「取消」和「保存」按钮（保持当前行为）
```

### Scenario 5: 不可编辑模式下仅显示全屏按钮

```gherkin
Given Spec Artifact Viewer 的 editable prop 为 false
When ArtifactContent 查看模式渲染
Then 工具栏仅显示「全屏」按钮
  And 不显示「编辑」按钮
```

---

## UI 规格

### 全屏按钮（Spec Artifact Viewer）

| 属性 | 值 |
|------|-----|
| 图标 | `Maximize2`（lucide-react） |
| 文字 | 「全屏」 |
| 大小 | `size="sm"`（与编辑按钮一致） |
| 位置 | 编辑按钮左侧，使用 `flex gap-2` 排列 |
| 变体 | `variant="outline"` |
| 可见条件 | 查看模式下始终可见（不受 editable prop 影响） |
