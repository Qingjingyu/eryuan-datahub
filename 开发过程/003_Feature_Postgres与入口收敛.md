# 003 Feature：Postgres 数据源与入口收敛

## 背景

此前 DataHub 同时存在两套状态：

1. NocoBase + PostgreSQL。
2. DataHub Core API + SQLite。

这导致资产、任务、审核、索引和前端入口分裂，用户无法判断哪边是正式数据。

## 本次完成

### 1. PostgreSQL 数据源接入

- 本地 PostgreSQL 暴露端口：`127.0.0.1:5433`
- 新建数据库：`datahub`
- 新建账号：`datahub`
- Core API 已切换到 PostgreSQL。
- SQLite 中的 20 个资产、20 个任务、21 个 Chunk、审核记录、审计日志等已迁移到 PostgreSQL。

迁移命令：

```bash
cd server
PYTHONPATH=. python3 migrate_sqlite_to_postgres.py
```

### 2. Core API 运行在 PostgreSQL

启动配置：

```text
DATAHUB_DB=postgresql+psycopg2://<database-user>:<database-password>@<database-host>:<database-port>/<database-name>
```

验证结果：

```text
assets = 20
chunks = 21
processing_jobs = 20
graph nodes = 5
graph edges = 4
```

### 3. NocoBase 入口收敛

NocoBase 菜单里的 `数据中台控制台` 不再加载旧 NocoBase 前端数据。

现在 iframe 指向：

```text
http://127.0.0.1:13001/?v=20260924
```

也就是新的 DataHub Core 前端。

### 4. 旧 NocoBase 数据冻结

旧数据已导出为快照：

```text
docs/legacy_snapshot/datahubAssets.json
docs/legacy_snapshot/datahubJobs.json
docs/legacy_snapshot/datahubReviews.json
```

旧表保留为历史快照，不再作为主数据源。

### 5. 自动登录容错修复

Core 前端在 token 失效时会重新执行 `/api/auth/me` / `/api/auth/login`，避免 iframe 中出现 token 失效后页面空白。

## 当前主入口

```text
http://127.0.0.1:13001/
```

NocoBase 内嵌入口：

```text
http://127.0.0.1:13000/admin/datahub-console-route
```

## 后续收敛

1. 移除 SQLite 作为默认主数据源。
2. 生产环境切换 PostgreSQL + 对象存储。
3. 下线或进一步隔离 NocoBase 旧资产表。
4. 将资产、任务、审核、索引的页面全部只绑定 Core API。
