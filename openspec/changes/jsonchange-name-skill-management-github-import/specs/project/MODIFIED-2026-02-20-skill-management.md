# Delta Spec: Project 模块支持 Skill 导入管理

> **Type:** MODIFIED
> **Module:** project
> **Date:** 2026-02-20
> **Change:** jsonchange-name-skill-management-github-import

## 概述

修改 Project 模块的 Skill 管理规范，补充从 GitHub 导入 Skill 的行为定义和数据模型。

---

## 场景

### Scenario 1: Skill 记录包含导入来源信息

```gherkin
Given Skill 从 GitHub 仓库导入
When 系统创建 Skill 记录
Then Skill 记录包含 sourceRepoUrl 字段（如 "https://github.com/owner/repo"）
  And Skill 记录包含 sourceCommitSha 字段（导入时的 commit SHA）
  And Skill 记录包含 sourceFilePath 字段（文件在仓库中的路径）
  And 手动创建的 Skill 的 source 字段为 null
```

### Scenario 2: Skill 列表展示导入来源

```gherkin
Given Skill 从 GitHub 导入
When 用户查看 Settings → Skills 列表
Then Skill 卡片显示 GitHub 图标和仓库名称
  And 点击仓库名称跳转到 GitHub 文件页面
  And 显示导入时间和 commit SHA 短 hash
```

### Scenario 3: 导入的 Skill 可编辑

```gherkin
Given Skill 从 GitHub 导入
When 用户编辑 Skill 的 prompt 内容
Then 系统允许修改并保存
  And source 字段保持不变（不清空）
  And 不自动同步回 GitHub 仓库
```

### Scenario 4: 导入的 Skill 可删除

```gherkin
Given Skill 从 GitHub 导入
When 用户删除 Skill
Then 系统删除 Skill 记录
  And 不影响 GitHub 仓库中的源文件
```

### Scenario 5: 重新导入更新 Skill

```gherkin
Given Skill "code-review" 已从 GitHub 导入
  And GitHub 仓库中该文件已更新
When 用户重新导入该文件，conflictStrategy = "overwrite"
Then 系统更新 Skill 的 prompt 内容
  And 系统更新 sourceCommitSha 为最新 commit
  And 保留 Skill 的 id 和 createdAt
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
  sourceRepoUrl: string | null       // GitHub 仓库 URL
  sourceCommitSha: string | null     // 导入时的 commit SHA
  sourceFilePath: string | null      // 文件在仓库中的路径
}
```

### Skill 来源类型

```typescript
type SkillSource =
  | { type: 'manual' }                                    // 手动创建
  | { type: 'github', repoUrl: string, commitSha: string, filePath: string }  // GitHub 导入
```
