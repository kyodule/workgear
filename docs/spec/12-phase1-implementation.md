# Phase 1 基础设施搭建方案（Monorepo + 最新技术栈）

> **文档路径**: `docs/spec/12-phase1-implementation.md`  
> **版本**: 1.0  
> **日期**: 2026-02-11

---

## 📦 最新版本技术栈（2026年2月）

### 基础设施
- **PostgreSQL**: 17.2（兼容 drizzle-kit beta 版本）
- **Redis**: 8.4.1（最新稳定版，2026年2月发布）
- **Node.js**: 22.22.0 LTS（Jod，Maintenance LTS 至 2027年4月）
- **pnpm**: 10.28.2（最新版，2026年2月发布）
- **TypeScript**: 5.9（最新稳定版，2025年8月发布）
- **Go**: 1.26（最新版，2026年2月发布）

### 前端 (packages/web)
- **React**: 19.2.1（最新稳定版，支持 Compiler、Activity 组件）
- **Vite**: 7.0（最新稳定版，2025年6月发布）
- **Tailwind CSS**: 4.1.18（最新版，CSS-first 配置，Rust 引擎）
- **Shadcn/ui**: 最新版（2026年2月，支持 Base UI + Radix UI）
- **Zustand**: 5.0.11（最新版）
- **React Router**: 7.13.0（最新版，包含安全补丁）
- **React Hook Form**: 7.x + **Zod**: 4.3.6（性能提升 14x）
- **ReactFlow**: 12.10.0（支持 React 19）
- **Monaco Editor**: @monaco-editor/react 4.7.0
- **ky**: 1.14.3（轻量 HTTP 客户端）

### API Server (packages/api)
- **Fastify**: 5.7.4（最新版，2026年2月）
- **Drizzle ORM**: 1.0.0-beta.15（即将 1.0 正式版）
- **Zod**: 4.3.6（最新版）
- **ws**: 8.x（WebSocket）
- **pino**: 10.1.0（高性能日志）
- **@grpc/grpc-js**: 1.12.0

### Orchestrator (packages/orchestrator)
- **Go**: 1.26（Green Tea GC、new() 表达式初始化）
- **gRPC**: google.golang.org/grpc v1.78.0
- **pgx**: v5.8.0（PostgreSQL 驱动）
- **go-redis**: v9.7.0
- **zap**: v1.27.1（结构化日志）
- **viper**: v1.19.0（配置管理）

---

## 🏗️ 项目结构

```
workgear/
├── packages/
│   ├── web/                    # React 19 前端
│   │   ├── src/
│   │   │   ├── components/     # Shadcn/ui 组件
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── types/
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts  # Tailwind 4 CSS-first
│   │
│   ├── api/                    # Fastify 5 API Server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts   # Drizzle Schema
│   │   │   │   └── migrations/
│   │   │   ├── websocket/
│   │   │   ├── grpc/
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── orchestrator/           # Go 1.26 调度服务
│   │   ├── cmd/server/
│   │   ├── internal/
│   │   │   ├── engine/
│   │   │   ├── executor/
│   │   │   ├── adapter/
│   │   │   ├── grpc/
│   │   │   └── db/
│   │   ├── proto/
│   │   ├── go.mod
│   │   └── Makefile
│   │
│   └── shared/
│       ├── types/              # 共享 TypeScript 类型
│       └── proto/              # Protobuf 定义
│
├── scripts/
│   ├── setup-db.sh
│   └── dev.sh
│
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.api
│
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 🎯 Phase 1 交付物清单

### 1. 基础设施
- ✅ Monorepo 结构（pnpm workspace）
- ✅ PostgreSQL 17.2 + Redis 8.4 Docker Compose
- ✅ 数据库 Schema（17 张核心表）+ Drizzle Migration

### 2. API Server
- ✅ Fastify 5 服务骨架
- ✅ Drizzle ORM 配置
- ✅ 基础 CRUD API（projects、boards、tasks）
- ✅ WebSocket 服务（ws 库）
- ✅ gRPC 客户端封装

### 3. Orchestrator
- ✅ Go 1.26 服务骨架
- ✅ gRPC 服务端实现
- ✅ pgx v5.8.0 数据库连接池
- ✅ go-redis v9 队列封装
- ✅ Mock 流程执行器

### 4. 前端
- ✅ Vite 7 + React 19 脚手架
- ✅ Tailwind CSS 4 + Shadcn/ui 配置
- ✅ 路由结构（React Router 7）
- ✅ 基础布局组件
- ✅ WebSocket 连接管理 Hook

### 5. 退出标准验证
- ✅ 可通过 API 创建项目
- ✅ 可创建 Task 并触发 FlowRun（mock 执行）
- ✅ WebSocket 可推送 mock 状态变化
- ✅ 前端可显示项目列表和看板

---

## 📋 核心数据库 Schema（17 张表）

基于 PRD 4.4 节，使用 PostgreSQL 17.2：

```sql
-- 项目表
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    git_repo_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 看板表
CREATE TABLE boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 看板列
CREATE TABLE board_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(board_id, position)
);

-- 任务表
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES board_columns(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    position INT NOT NULL,
    git_branch VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 流程模板表
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    difficulty VARCHAR(20),
    estimated_time VARCHAR(50),
    parameters JSONB DEFAULT '[]',
    template TEXT NOT NULL,
    is_builtin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 项目流程表
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES workflow_templates(id),
    name VARCHAR(200) NOT NULL,
    dsl TEXT NOT NULL,
    template_params JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 流程实例表
CREATE TABLE flow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    status VARCHAR(50) NOT NULL,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 节点执行表
CREATE TABLE node_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    attempt INT DEFAULT 1,
    input JSONB,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    recovery_checkpoint JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 节点执行历史表
CREATE TABLE node_run_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_run_id UUID NOT NULL REFERENCES node_runs(id) ON DELETE CASCADE,
    attempt INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    input JSONB,
    output JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 产物表
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 产物版本表
CREATE TABLE artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(artifact_id, version)
);

-- 产物关联表
CREATE TABLE artifact_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 时间线事件表
CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    flow_run_id UUID REFERENCES flow_runs(id) ON DELETE CASCADE,
    node_run_id UUID REFERENCES node_runs(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 配置表
CREATE TABLE agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 角色模板表
CREATE TABLE agent_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_column_id ON tasks(column_id);
CREATE INDEX idx_flow_runs_task_id ON flow_runs(task_id);
CREATE INDEX idx_node_runs_flow_run_id ON node_runs(flow_run_id);
CREATE INDEX idx_timeline_events_task_id ON timeline_events(task_id);
CREATE INDEX idx_artifact_versions_artifact_id ON artifact_versions(artifact_id);
```

---

## 🔧 关键配置文件

### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
```

### packages/web/package.json
```json
{
  "name": "@workgear/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-router": "^7.13.0",
    "zustand": "^5.0.11",
    "zod": "^4.3.6",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.1",
    "ky": "^1.14.3",
    "@xyflow/react": "^12.10.0",
    "@monaco-editor/react": "^4.7.0"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "typescript": "^5.9.0",
    "tailwindcss": "^4.1.18",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

### packages/api/package.json
```json
{
  "name": "@workgear/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "fastify": "^5.7.4",
    "drizzle-orm": "1.0.0-beta.15-859cf75",
    "zod": "^4.3.6",
    "ws": "^8.18.0",
    "pino": "^10.1.0",
    "@grpc/grpc-js": "^1.12.0",
    "@grpc/proto-loader": "^0.7.13",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "tsx": "^4.19.0",
    "drizzle-kit": "^0.31.9",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.0"
  }
}
```

### packages/orchestrator/go.mod
```go
module github.com/sunshow/workgear/orchestrator

go 1.26

require (
    google.golang.org/grpc v1.78.0
    github.com/jackc/pgx/v5 v5.8.0
    github.com/redis/go-redis/v9 v9.7.0
    go.uber.org/zap v1.27.1
    github.com/spf13/viper v1.19.0
)
```

### docker/docker-compose.yml
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:17.2-alpine
    environment:
      POSTGRES_DB: workgear_dev
      POSTGRES_USER: workgear
      POSTGRES_PASSWORD: workgear_dev_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U workgear"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8.4.1-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
```

---

## ⚠️ 重要注意事项

### 1. Node.js 版本选择
- **使用 Node.js 22.22.0 LTS**（Maintenance LTS 至 2027年4月）
- Node.js 24 是 Active LTS，但考虑稳定性选择 22
- Node.js 25 是 Current 版本，不推荐生产使用

### 2. React Router 7 安全补丁
- **必须使用 7.12.0+**（修复 6 个 CVE 漏洞）
- 包括 CSRF、XSS、Open Redirect 等安全问题

### 3. Tailwind CSS 4 迁移
- 使用 CSS-first 配置（`@theme` 指令）
- Rust 引擎带来显著性能提升
- 可选保留 JS 配置文件

### 4. Drizzle ORM Beta
- 当前使用 1.0.0-beta.15
- 正式 1.0 版本即将发布（94% 完成）
- 生产环境建议等待 1.0 正式版或使用 0.31.x 稳定版

### 5. Go 1.26 新特性
- Green Tea GC 默认启用（性能提升）
- `new()` 支持表达式初始化
- 泛型类型自引用支持

### 6. Zod 4 性能提升
- 字符串解析快 14x
- 数组解析快 7x
- 对象解析快 6.5x

---

## 🚀 开发环境启动

### 1. 安装依赖
```bash
# 确保使用 Node.js 22
node --version  # 应显示 v22.x.x

# 安装 pnpm（如果未安装）
npm install -g pnpm@10.28.2

# 安装项目依赖
pnpm install
```

### 2. 启动数据库
```bash
cd docker
docker-compose up -d

# 等待健康检查通过
docker-compose ps
```

### 3. 运行数据库迁移
```bash
cd packages/api
pnpm db:push
```

### 4. 启动开发服务器
```bash
# 在项目根目录
pnpm dev  # 并行启动所有服务

# 或分别启动
pnpm --filter @workgear/web dev
pnpm --filter @workgear/api dev
cd packages/orchestrator && go run cmd/server/main.go
```

---

## ✅ 验收标准

### 功能验收
1. ✅ 可通过 API 创建项目（POST /api/projects）
2. ✅ 可创建 Task 并触发 FlowRun（mock 返回成功）
3. ✅ WebSocket 可推送 mock 状态变化
4. ✅ 前端可显示项目列表和看板
5. ✅ 所有服务可正常启动且无报错

### 技术验收
1. ✅ TypeScript 编译无错误
2. ✅ Go 编译无错误
3. ✅ 数据库连接正常
4. ✅ gRPC 通信正常
5. ✅ WebSocket 连接稳定

---

## 📝 文件清单（约 60+ 个文件）

### Root 级别（5 个）
- pnpm-workspace.yaml
- package.json
- .gitignore
- README.md
- tsconfig.json

### packages/web（约 20 个）
- package.json, vite.config.ts, tailwind.config.ts
- src/main.tsx, src/App.tsx
- src/components/（布局组件）
- src/pages/（页面组件）
- src/hooks/（自定义 Hooks）
- src/lib/（工具函数）
- src/types/（类型定义）

### packages/api（约 25 个）
- package.json, tsconfig.json
- src/server.ts
- src/routes/（API 路由）
- src/services/（业务逻辑）
- src/db/schema.ts
- src/db/migrations/（迁移文件）
- src/websocket/（WebSocket 处理）
- src/grpc/（gRPC 客户端）

### packages/orchestrator（约 15 个）
- go.mod, go.sum, Makefile
- cmd/server/main.go
- internal/engine/（流程引擎）
- internal/executor/（执行器）
- internal/adapter/（Agent 适配器）
- internal/grpc/（gRPC 服务端）
- internal/db/（数据库访问）
- proto/（Protobuf 定义）

### docker（2 个）
- docker-compose.yml
- Dockerfile.api

### scripts（2 个）
- setup-db.sh
- dev.sh

---

## 🎯 下一步（Phase 2）

- 看板拖拽功能（@dnd-kit/core）
- 流程模板库（4 个内置模板）
- YAML 编辑器（Monaco Editor）+ DAG 预览（ReactFlow）
- Task 详情面板（Shadcn/ui Sheet）

**预计时间**: Phase 1 需要 2 周完成

---

## 📚 参考文档

- [PRD MVP 文档](../PRD/MVP/)
- [技术架构设计](./02-architecture.md)
- [数据模型设计](./06-data-model.md)
- [流程引擎设计](./03-flow-engine.md)