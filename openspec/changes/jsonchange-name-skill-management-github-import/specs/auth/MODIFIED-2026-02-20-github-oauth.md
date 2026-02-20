# Delta Spec: Auth 模块支持 GitHub OAuth 授权

> **Type:** MODIFIED
> **Module:** auth
> **Date:** 2026-02-20
> **Change:** jsonchange-name-skill-management-github-import

## 概述

修改 Auth 模块，支持 GitHub OAuth 授权流程，允许用户授权 WorkGear 访问其 GitHub private 仓库以导入 Skill。

---

## 场景

### Scenario 1: 用户授权 GitHub 访问

```gherkin
Given 用户点击「从 GitHub 导入」按钮
  And 用户选择导入 private 仓库
When 系统检测到需要 GitHub 授权
Then 系统重定向到 GitHub OAuth 授权页面
  And 请求 repo 权限（读取仓库内容）
  And 用户同意授权后，GitHub 回调到 /auth/github/callback
  And 系统保存 GitHub access token 到用户 session
```

### Scenario 2: GitHub access token 存储

```gherkin
Given 用户完成 GitHub OAuth 授权
When 系统接收到 GitHub access token
Then 系统将 token 加密存储到 users 表的 github_access_token 列
  And token 仅用于 Skill 导入功能
  And token 不暴露给前端（仅后端使用）
```

### Scenario 3: GitHub access token 刷新

```gherkin
Given 用户的 GitHub access token 已过期
When 系统调用 GitHub API 返回 401 Unauthorized
Then 系统提示用户重新授权
  And 用户重新完成 OAuth 流程
  And 系统更新 github_access_token
```

### Scenario 4: 用户撤销 GitHub 授权

```gherkin
Given 用户在 Settings → Integrations 页面
When 用户点击「撤销 GitHub 授权」按钮
Then 系统删除 users 表的 github_access_token
  And 系统调用 GitHub API 撤销 token
  And 用户无法再导入 private 仓库（public 仓库仍可导入）
```

### Scenario 5: Public 仓库无需授权

```gherkin
Given 用户导入 public GitHub 仓库
When 系统调用 GitHub API 获取文件内容
Then 系统使用未认证请求（无 access token）
  And 受 GitHub API rate limit 限制（60 次/小时）
  And 不要求用户授权 GitHub
```

### Scenario 6: GitHub OAuth 回调处理

```gherkin
Given GitHub OAuth 授权成功
When GitHub 重定向到 /auth/github/callback?code={code}
Then 系统用 code 换取 access token
  And 系统验证 token 有效性（调用 GET /user）
  And 系统保存 token 到数据库
  And 系统重定向用户回 Settings → Skills 页面
  And 前端显示「GitHub 已授权」状态
```

### Scenario 7: GitHub OAuth 授权失败

```gherkin
Given 用户拒绝 GitHub OAuth 授权
When GitHub 重定向到 /auth/github/callback?error=access_denied
Then 系统不保存 token
  And 系统重定向用户回 Settings → Skills 页面
  And 前端显示「授权失败」提示
  And 用户仍可导入 public 仓库
```

---

## 数据模型

### users 表扩展

```typescript
interface User {
  id: string
  email: string
  // ... 现有字段 ...

  // 新增字段
  githubAccessToken: string | null   // 加密存储的 GitHub access token
  githubTokenExpiresAt: Date | null  // Token 过期时间（如果 GitHub 返回）
}
```

### GitHub OAuth 配置

```typescript
interface GitHubOAuthConfig {
  clientId: string                   // GitHub OAuth App Client ID
  clientSecret: string               // GitHub OAuth App Client Secret
  redirectUri: string                // 回调 URL（如 https://workgear.app/auth/github/callback）
  scope: string                      // 请求权限（"repo" 或 "public_repo"）
}
```

---

## API Schema

### GET /auth/github/authorize 重定向到 GitHub

```gherkin
Given 用户点击「授权 GitHub」按钮
When 前端请求 GET /auth/github/authorize
Then 系统重定向到 GitHub OAuth 授权页面
  And URL 包含 client_id、redirect_uri、scope 参数
```

### GET /auth/github/callback 处理 GitHub 回调

```gherkin
Given GitHub OAuth 授权完成
When GitHub 重定向到 /auth/github/callback?code={code}
Then 系统用 code 换取 access token
  And 系统保存 token 到数据库
  And 系统重定向到 /settings/skills?github_authorized=true
```

### DELETE /auth/github/revoke 撤销授权

```gherkin
Given 用户已授权 GitHub
When 前端请求 DELETE /auth/github/revoke
Then 系统删除 github_access_token
  And 系统调用 GitHub API 撤销 token
  And 响应 { revoked: true }
```

### GET /auth/github/status 查询授权状态

```gherkin
Given 用户已登录
When 前端请求 GET /auth/github/status
Then 响应 { authorized: true, expiresAt: "2026-03-20T..." }
  Or 响应 { authorized: false }
```
