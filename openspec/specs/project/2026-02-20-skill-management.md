# Delta Spec: Project 模块支持 Skill URL 导入管理

> **Type:** MODIFIED
> **Module:** project
> **Date:** 2026-02-20
> **Change:** jsonchange-name-skill-management-github-import

## 概述

修改 Project 模块的 Skill 管理规范，补充从 URL 导入 Skill 的行为定义和数据模型。

---

## 场景

### Scenario 1: Skill 记录包含导入来源信息

```gherkin
Given Skill 从 URL 导入
When 系统创建 Skill 记录
Then Skill 记录包含 sourceUrl 字段（如 "https://raw.githubusercontent.com/owner/repo/main/prompt.md"）
  And 手动创建的 Skill 的 sourceUrl 字段为 null
```

### Scenario 2: Skill 列表展示导入来源

```gherkin
Given Skill 从 URL 导入
When 用户查看 Settings → Skills 列表
Then Skill 卡片显示链接图标和来源 URL
  And 点击来源 URL 在新标签页打开原始文件
```

### Scenario 3: 导入的 Skill 可编辑

```gherkin
Given Skill 从 URL 导入
When 用户编辑 Skill 的 prompt 内容
Then 系统允许修改并保存
  And sourceUrl 字段保持不变（不清空）
  And 不自动同步回源 URL
```

### Scenario 4: 导入的 Skill 可删除

```gherkin
Given Skill 从 URL 导入
When 用户删除 Skill
Then 系统删除 Skill 记录
  And 不影响源 URL 的文件
```

---

## 数据模型

### Skill 表结构扩展

```typescript
interface Skill {
  id: string
  name: string
  description: string | null
  prompt: string
  createdAt: Date
  updatedAt: Date

  // 新增字段
  sourceUrl: string | null           // 导入来源 URL
}
```
