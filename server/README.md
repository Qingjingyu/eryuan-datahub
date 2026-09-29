# DataHub Core API

DataHub Core 是数据中台的主业务后端，当前负责：

- 资产登记与文件管理
- 解析任务与状态机
- 审核中心
- 索引与检索
- 知识问答
- Agent 受控工具
- 知识图谱
- BI 指标
- 审计日志

## 本地启动

```bash
cd server
./run.sh
```

默认地址：

```text
http://127.0.0.1:13001
```

首次管理员用户名是 `admin`，初始密码来自环境变量 `DATAHUB_ADMIN_PASSWORD`。不要把真实密码写入文档；生产部署前必须修改 `DATAHUB_SECRET` 和 `DATAHUB_ADMIN_PASSWORD`。

## 当前数据源

本地数据源由 `DATAHUB_DB` 控制。默认可用 SQLite；生产使用 PostgreSQL。连接信息不要写入文档。

如果需要从旧 SQLite 迁移数据，可执行：

```bash
PYTHONPATH=. python3 migrate_sqlite_to_postgres.py
```

## 前端

Core API 自带前端：

```text
/static/index.html
```

访问根路径即可打开。

NocoBase 内的 DataHub 菜单现在通过 iframe 指向：

```text
http://127.0.0.1:13001/?v=20260924
```

## 主 API

```text
GET  /api/health
POST /api/auth/login
GET  /api/auth/me

GET  /api/assets
POST /api/assets
GET  /api/assets/{asset_id}
PATCH /api/assets/{asset_id}

POST /api/assets/{asset_id}/files
POST /api/assets/{asset_id}/process
POST /api/assets/{asset_id}/approve
POST /api/assets/{asset_id}/reject
POST /api/assets/{asset_id}/index
POST /api/assets/{asset_id}/serve

GET  /api/search
POST /api/ask
POST /api/agent/execute

GET  /api/graph
GET  /api/bi/metrics
GET  /api/audit-logs
```
