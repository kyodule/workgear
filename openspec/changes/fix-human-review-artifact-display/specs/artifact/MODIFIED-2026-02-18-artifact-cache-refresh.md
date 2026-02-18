# Delta Spec: ArtifactPreviewCard 缓存刷新机制

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-18
> **Change:** fix-human-review-artifact-display

## 概述

修复 `<ArtifactPreviewCard>` 组件在产物被编辑后仍显示旧内容的问题。增加 `refreshKey` prop，当外部触发刷新时清除内部缓存并重新加载内容。

---

## 场景

### Scenario 1: refreshKey 变化时清除缓存并重新加载

```gherkin
Given ArtifactPreviewCard 已展开并加载了产物内容
  And 内部 content 状态已缓存当前版本的内容
  And 外部传入的 refreshKey 为 N
When refreshKey 变为 N+1（如产物被编辑保存后）
Then 组件清除内部缓存的 content 和 latestVersion 状态
  And 自动重新调用 loadContent() 加载最新版本内容
  And 加载期间显示 loading 状态（Loader2 动画）
  And 加载完成后显示更新后的产物内容
```

### Scenario 2: refreshKey 变化时卡片处于折叠状态

```gherkin
Given ArtifactPreviewCard 处于折叠状态
  And 内部 content 状态已缓存之前加载的内容
  And 外部传入的 refreshKey 为 N
When refreshKey 变为 N+1
Then 组件清除内部缓存的 content 和 latestVersion 状态
  And 不自动触发 loadContent()（因为卡片未展开）
When 用户随后点击展开卡片
Then 触发 loadContent() 加载最新版本内容
  And 显示更新后的产物内容（而非旧缓存）
```

### Scenario 3: refreshKey 未传入时保持原有行为

```gherkin
Given ArtifactPreviewCard 未传入 refreshKey prop（如在 artifacts-tab 中使用）
When 组件渲染和交互
Then 保持原有的缓存行为不变
  And loadContent() 仍使用 if (content) return content 的缓存逻辑
  And 不会因缺少 refreshKey 而报错或异常
```

### Scenario 4: 编辑产物后全屏查看显示最新内容

```gherkin
Given ArtifactPreviewCard 的产物已被编辑（refreshKey 已递增）
  And 内部缓存已被清除
When 用户点击 Eye 图标触发全屏查看
Then handleViewFullscreen 调用 loadContent() 获取最新内容
  And 全屏 Dialog 显示编辑后的最新内容
  And 不显示编辑前的旧内容
```
