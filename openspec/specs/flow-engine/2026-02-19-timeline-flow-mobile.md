# Delta Spec: Timeline 和 Flow Tab 移动端布局优化

> **Type:** MODIFIED
> **Module:** flow-engine
> **Date:** 2026-02-19
> **Change:** jsonchange-name-mobile-responsive-adaptation

## 概述

为 Timeline Tab 和 Flow Tab 增加移动端响应式支持，优化时间线事件、Flow 节点的显示和交互，确保在小屏幕设备上内容清晰可读且易于操作。

---

## 场景

### Scenario 1: 移动端 Timeline 事件布局优化

```gherkin
Given 用户在移动设备（屏幕宽度 < 768px）上查看任务详情的 Timeline Tab
  And Timeline 包含多个事件
When 页面加载完成
Then 时间线事件以垂直方式显示
  And 事件卡片宽度占据全屏（减去左侧时间线圆点和连接线）
  And 事件内容自适应屏幕宽度，不会横向溢出
  And 事件头部的 Badge 和时间戳在移动端清晰可见
  And 事件内容字体大小至少为 14px
```

### Scenario 2: 移动端 Timeline 事件折叠/展开交互

```gherkin
Given 用户在移动设备上查看 Timeline Tab
  And 事件支持折叠/展开功能
When 用户点击事件头部
Then 事件头部的点击区域至少为 44x44px
  And 点击后事件展开或折叠
  And 展开动画流畅，不卡顿
  And 折叠状态下的摘要文本在移动端完整显示（不被截断）
```

### Scenario 3: 移动端 Flow Tab 节点列表优化

```gherkin
Given 用户在移动设备上查看任务详情的 Flow Tab
  And Flow 包含多个节点运行记录
When 页面加载完成
Then 节点列表以垂直方式显示
  And 节点卡片宽度占据全屏
  And 节点头部（节点名称、状态 Badge）在移动端清晰可见
  And 节点内容（日志、输出）自适应屏幕宽度
  And 节点之间的间距在移动端适当增加
```

### Scenario 4: 移动端 Flow 节点日志查看

```gherkin
Given 用户在移动设备上点击 Flow 节点查看日志
When Node Log Dialog 打开
Then 对话框以全屏模式显示
  And 日志条目的字体大小至少为 14px
  And 代码块和 JSON 内容支持横向滚动
  And 日志条目的背景色在移动端清晰可见（支持 Dark Mode）
  And 用户可以垂直滚动查看所有日志
```

### Scenario 5: 移动端 Timeline 事件内容格式化

```gherkin
Given Timeline 事件包含 JSON 对象或代码块
  And 用户在移动设备上查看该事件
When 用户展开事件
Then JSON 内容以格式化方式显示
  And 代码块支持横向滚动（不超出屏幕）
  And 代码块字体大小至少为 12px（等宽字体）
  And 长文本内容自动换行，不会横向溢出
```

### Scenario 6: 移动端 agent_dispatch_completed 事件显示

```gherkin
Given Timeline 包含 agent_dispatch_completed 事件
  And 事件内容包含 selected_role、fallback、reason 字段
  And 用户在移动设备上查看该事件
When 用户展开事件
Then 角色 Badge 在移动端清晰可见
  And 降级标识（⚠️ 降级策略）在移动端显示完整
  And 原因文本自动换行，不会被截断
  And 所有内容在移动端保持可读性
```

### Scenario 7: 移动端 Flow Tab 空状态提示

```gherkin
Given 用户在移动设备上查看 Flow Tab
  And 任务尚未启动流程，没有节点运行记录
When 页面加载完成
Then 显示空状态提示："暂无流程运行记录"
  And 提示文字和图标在移动端清晰可见
  And 提示文字字体大小至少为 14px
```

### Scenario 8: 移动端 Timeline 和 Flow Tab 切换

```gherkin
Given 用户在移动设备上查看任务详情
  And 任务详情页包含 Timeline、Flow、Artifacts 三个标签页
When 用户在标签页之间切换
Then 标签页导航在移动端显示为底部固定导航
  And 每个标签按钮的点击区域至少为 44x44px
  And 当前激活的标签页有明显的视觉标识
  And 切换标签页时内容区域平滑过渡
```

---

## 变更规格

### Timeline 事件移动端样式

| 属性 | 桌面端 | 移动端 |
|------|--------|--------|
| 事件卡片内边距 | `p-3` | `p-4` |
| 事件头部字体 | `text-sm` | `text-base` |
| 事件内容字体 | `text-sm` | `text-base` |
| Badge 字体 | `text-xs` | `text-sm` |
| 时间戳字体 | `text-xs` | `text-sm` |
| 事件头部最小高度 | 无限制 | `min-h-[44px]` |
| 代码块字体 | `text-xs` | `text-sm` |

### Flow 节点移动端样式

| 属性 | 桌面端 | 移动端 |
|------|--------|--------|
| 节点卡片内边距 | `p-3` | `p-4` |
| 节点头部字体 | `text-sm` | `text-base` |
| 节点状态 Badge | `text-xs` | `text-sm` |
| 节点内容字体 | `text-sm` | `text-base` |
| 节点头部最小高度 | 无限制 | `min-h-[44px]` |
| 节点间距 | `space-y-2` | `space-y-4` |

### 标签页导航移动端布局

| 屏幕宽度 | 导航位置 | 导航样式 | 说明 |
|----------|----------|----------|------|
| < 768px (移动端) | 底部固定 | `fixed bottom-0 left-0 right-0` | 三个标签按钮水平排列 |
| 768px - 1024px (平板) | 顶部 | 保持现有布局 | 标签按钮水平排列 |
| > 1024px (桌面端) | 顶部 | 保持现有布局 | 标签按钮水平排列 |

### 移动端代码块和 JSON 显示

| 元素 | 桌面端 | 移动端 |
|------|--------|--------|
| 代码块容器 | `overflow-x-auto` | `overflow-x-auto max-w-full` |
| 代码块字体 | `text-xs font-mono` | `text-sm font-mono` |
| JSON 格式化 | 2 空格缩进 | 2 空格缩进（保持不变） |
| 长文本换行 | `whitespace-pre-wrap` | `whitespace-pre-wrap break-words` |
