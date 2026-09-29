# DataHub Core API Contract v1

## Auth
```http
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

## Assets
```http
GET    /api/v1/assets
POST   /api/v1/assets
GET    /api/v1/assets/{asset_id}
PATCH  /api/v1/assets/{asset_id}
DELETE /api/v1/assets/{asset_id}

POST   /api/v1/assets/{asset_id}/files
GET    /api/v1/assets/{asset_id}/files
POST   /api/v1/assets/{asset_id}/process
POST   /api/v1/assets/{asset_id}/approve
POST   /api/v1/assets/{asset_id}/reject
POST   /api/v1/assets/{asset_id}/archive
POST   /api/v1/assets/{asset_id}/index
POST   /api/v1/assets/{asset_id}/serve
```

## Jobs / Reviews / Audit
```http
GET  /api/v1/jobs
POST /api/v1/jobs/{job_id}/retry
GET  /api/v1/reviews
GET  /api/v1/audit-logs
```

## Search / Ask
```http
POST /api/v1/search
POST /api/v1/ask
```

## Agent
```http
POST /api/v1/agent/search
POST /api/v1/agent/read
POST /api/v1/agent/report
POST /api/v1/agent/execute
GET  /api/v1/agent/logs
```

## Graph

Entity 与 Relationship 都支持 `asset_ids` 来源追溯；兼容字段 `asset_id` 会合并进 `asset_ids`。  
关系支持 `status`（confirmed / candidate / rejected / archived）与 `confidence`（0 到 1）。

```http
GET  /api/v1/graph
POST /api/v1/graph/entities
GET  /api/v1/graph/entities
GET  /api/v1/graph/entities/{entity_id}
PATCH /api/v1/graph/entities/{entity_id}
POST /api/v1/graph/relationships
GET  /api/v1/graph/relationships
PATCH /api/v1/graph/relationships/{relation_id}
GET  /api/v1/graph/query
```

`GET /api/v1/graph/query` 支持以下过滤条件：

```text
business_line    业务线
entity_type      实体类型
entity_id        实体 ID
entity_status    实体状态
relation_type    关系类型
relation_status  关系状态
asset_id         来源资产 ID
include_related  是否返回邻接实体，默认 true
```

Graph node response:

```json
{
  "entity_id": "ENT-001",
  "name": "产品",
  "entity_type": "产品",
  "business_line": "zhuangzhou",
  "status": "confirmed",
  "source_asset_id": "ZZ-DOC-000001",
  "asset_ids": ["ZZ-DOC-000001", "ZZ-DOC-000002"],
  "sources": [{"asset_id": "ZZ-DOC-000001", "evidence": "", "score": 0}]
}
```

Graph edge response:

```json
{
  "relation_id": "REL-001",
  "source_entity": "ENT-002",
  "relation_type": "生产",
  "target_entity": "ENT-001",
  "asset_id": "ZZ-DOC-000001",
  "asset_ids": ["ZZ-DOC-000001"],
  "confidence": 0.92,
  "status": "confirmed"
}
```

## BI

所有 BI API 均从业务表实时聚合，不写入演示数字。

```http
GET /api/v1/bi/overview
GET /api/v1/bi/metrics
GET /api/v1/bi/assets/trend
GET /api/v1/bi/assets/distribution
GET /api/v1/bi/processing
GET /api/v1/bi/review
GET /api/v1/bi/index
GET /api/v1/bi/search
GET /api/v1/bi/agent
```

指标定义：

```text
assets/trend    资产总量按天趋势和累计值，支持 days=1..365、business_line
assets/distribution  资产状态分布与业务线分布
processing      解析任务总数、成功/失败、解析成功率、平均耗时
review          待审数、通过/驳回数、通过率、平均审核时长
index           索引记录数、失败数、索引失败率、Chunk 总量
search          检索次数、命中次数、检索命中率、问答次数、引用覆盖率、越权访问次数
agent           Agent 使用次数、成功/失败率、平均延迟、按工具和用户分布
```

`overview` 返回以上全部指标的聚合结果。

## Compatibility Notes

- `/api/v1` 是正式前缀；`/api` 继续提供同一组路由给旧前端。
- `POST /api/v1/search` 返回 `results` 和同形状的 `citations` 别名。
- `POST /api/v1/agent/read` 支持 JSON body 的 `asset_id`，也兼容 query parameter。
- 附加追溯端点：
  - `GET /api/v1/assets/{asset_id}/files/{file_id}/download`
  - `GET /api/v1/assets/{asset_id}/versions`
  - `GET /api/v1/assets/{asset_id}/chunks`
  - `POST /api/v1/jobs/{job_id}/retry`
  - `GET /api/v1/audit-logs`

## Storage Layout

```text
01_raw          原始上传文件
02_staging      解析/清洗中间产物
03_curated      审核通过后的整理产物
04_index_input  索引输入
05_agent_output Agent 输出
90_archive      归档数据
```
