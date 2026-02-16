# PostgreSQL 版本降级说明

## 变更原因

`drizzle-kit@1.0.0-beta.15` 与 PostgreSQL 18.1 存在兼容性问题：

- **错误现象**：执行 `pnpm db:push` 时报错 `malformed array literal`
- **根本原因**：drizzle-kit 查询 `pg_catalog.pg_am` 表时使用了 `amtype` 字段，该字段在 PostgreSQL 18 中已被移除
- **相关 Issue**：https://github.com/drizzle-team/drizzle-orm/issues/4944

## 解决方案

将 PostgreSQL 从 18.1 降级到 17.2，该版本与 drizzle-kit beta 完全兼容。

## 变更文件

1. `docker/docker-compose.yml` - 开发环境
2. `docker/docker-compose.prod.yml` - 生产环境
3. `docs/spec/12-phase1-implementation.md` - 技术文档

## 重新初始化步骤

如果你已经运行过旧版本的容器，需要清理数据卷：

```bash
# 停止并删除容器和数据卷
docker compose -f docker/docker-compose.yml down -v

# 重新启动
docker compose -f docker/docker-compose.yml up -d

# 推送数据库 schema
pnpm db:push
```

## 后续计划

等待 drizzle-kit@1.0.0 正式版发布后，可考虑升级回 PostgreSQL 18。
