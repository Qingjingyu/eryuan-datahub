# 007 Feature / Core Backend Architecture Hardening

## 背景

DataHub Core 最初把资产、解析、审核、检索、问答、Agent、图谱和 BI 逻辑集中在一个 `app/main.py` 里。功能可演示，但状态机、权限、版本、存储抽象和 API 路径不容易继续扩展，也无法稳定支撑第 1-6 期统一验收。

## 关键决策及理由

1. 统一 API 前缀为 `/api/v1`，同时保留 `/api` 兼容旧前端。
   - 新前端和新 Agent 只依赖 `/api/v1`。
   - 原型前端不用一次性重写，降低迁移风险。
2. Router / Service 分层。
   - `app/routers` 只处理协议、鉴权、参数和状态码。
   - `app/services` 承载资产生命周期、解析、审核、索引、检索、图谱、BI 和存储规则。
   - 后续替换解析器、索引器或对象存储时，不需要改全部接口。
3. 补齐完整资产域模型。
   - 新增 `asset_versions`，保留原始内容、清洗结果、版本号、校验值和变更原因。
   - `assets` 补充 `raw_uri`，让原始文件、staging 输出和资产状态可追溯。
   - `processing_jobs` 记录发起人，避免失败任务无法定位责任人。
   - 资产文件、任务、切片、审核、索引记录通过资产 ID 关联。
4. 对象存储先使用 local adapter。
   - 目录固定为 `01_raw`、`02_staging`、`03_curated`、`04_index_input`、`05_agent_output`、`90_archive`。
   - 统一写入校验值、大小、zone 和真实路径。
   - 保留 MinIO / OSS / COS adapter 接口；远程后端在凭证和内网访问验收前不启用。
5. 审核与检索边界收紧。
   - Approved 状态和 `review_status=approved` 都满足后才能进入检索。
   - Agent 只能读取已审核且可服务资产。
   - 业务线可见性、owner 可见性和 admin 权限在检索、读取和 Agent 工具中统一生效。
6. 认证安全增强。
   - 新用户口令使用 PBKDF2。
   - 旧 prototype 的 SHA-256 口令在登录成功后自动 rehash。
   - token 增加 HMAC 和过期时间。

## 否掉的备选

- 继续手写 `main.py` 单文件：短期快，但生命周期规则会和协议代码继续耦合。
- 直接切 MinIO：本机验收没有必要引入额外凭证和网络故障面。
- 只用前端隐藏未审核资产：前端过滤不能保护 API，Agent 和检索必须后端过滤。
- 手写底层页面模型：与本后端任务无关，且可维护性差。

## API 交付范围

- `/api/v1/auth/*`：登录、当前用户、用户列表。
- `/api/v1/assets`：登记、列表、详情、更新、软删除。
- `/api/v1/assets/{id}/files`：上传、列表、下载。
- `/api/v1/assets/{id}/versions`、`chunks`：版本与切片追溯。
- `/api/v1/assets/{id}/process|approve|reject|archive|index|serve`：完整生命周期。
- `/api/v1/jobs`：任务列表和失败重试。
- `/api/v1/search|ask`：检索与带引用问答。
- `/api/v1/agent/*`：受控 search/read/report 工具和日志。
- `/api/v1/graph/*`：实体、关系、来源追溯与查询。
- `/api/v1/bi/*`：处理、审核、索引、检索、Agent、总览读模型。
- `/api/v1/audit-logs`：关键操作审计。

## 验证结果

```bash
cd server
python3 -m pytest -q
```

结果：

```text
6 passed in <1s
```

本地服务重启后额外验证：

```text
GET  http://127.0.0.1:13001/api/health      -> 200
GET  http://127.0.0.1:13001/                -> 200
POST http://127.0.0.1:13001/api/v1/auth/login -> 200
```

## 边界

- 当前运行环境仍是本地 PostgreSQL 和本地存储，不是生产部署验收。
- 远程对象存储 adapter 只保留接口，未启用真实云端凭证。
- 解析 Worker 当前在 API 请求内同步执行；长文档和高并发仍需要拆到独立队列。
