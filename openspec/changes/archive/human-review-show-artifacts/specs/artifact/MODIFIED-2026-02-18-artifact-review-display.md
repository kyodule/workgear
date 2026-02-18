# Delta Spec: 产物在审核界面中的展示能力

> **Type:** MODIFIED
> **Module:** artifact
> **Date:** 2026-02-18
> **Change:** human-review-show-artifacts

## 概述

扩展产物管理模块的展示能力，使产物可以在 human_review 审核界面中被加载和展示，复用现有的 `<ArtifactPreviewCard>` 和 `<ArtifactEditorDialog>` 组件。

---

## 场景

### Scenario 1: ArtifactPreviewCard 在审核界面中渲染

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

### Scenario 2: 审核界面中的产物全屏查看

```gherkin
Given 审核界面中展示了产物卡片
  And 产物卡片处于折叠状态
When 用户点击产物卡片右侧的眼睛图标（Eye）
Then 触发全屏查看回调
  And 在全屏 Dialog 中展示产物的完整 Markdown 内容
  And 全屏 Dialog 标题显示产物标题
```

### Scenario 3: 审核界面中的产物编辑

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

### Scenario 4: 产物按节点分组展示

```gherkin
Given 审核界面加载了多个节点的产物
  And 产物来自不同的上游 agent_task 节点
When 产物列表渲染
Then 产物按来源节点分组展示
  And 每组显示节点名称作为分组标题
  And 组内产物按创建时间排序
```
