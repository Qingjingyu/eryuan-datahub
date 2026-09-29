# 二元空间 DataHub · 交接手册

- 版本：`v1.0 handover`
- 日期：`2026-09-24`
- 交付状态：第 1-6 期本地 / 生产骨架验收版
- 当前结论：可用于内部试运行、真实资料小批量试跑、客户演示；正式生产前需完成密钥轮换、服务器部署、备份演练和权限复核。

---

## 1. 一句话理解

DataHub 是“企业资料 → 受控资产 → 解析清洗 → 人工审核 → 索引服务 → 人 / Agent 调用”的统一数据与知识中台底座。

它解决五个问题：

1. 资料有唯一身份：`asset_id`。
2. 处理过程有状态：`raw → parsed → cleaned → waiting_review → approved → indexed → serving`。
3. 人审和审计不可跳过。
4. 检索、问答、Agent 只使用 Approved / Indexed / Serving 后的受控知识。
5. 图谱、BI、检索都能回到来源资产。

---

## 2. 交付包内容

```text
DataHub/
├── HANDOVER.md                         # 本交接手册
├── docs/                               # 架构、路线图、API、验收报告、设计原理
├── server/                             # FastAPI 后端、模型、服务、测试、Dockerfile、前端静态产物
├── web/                                # React 前端源码
├── infra/                              # Docker Compose、Nginx、MinIO / PostgreSQL / Worker 部署、备份恢复
└── 开发过程/                           # 每期功能决策、验收和迭代记录
```

交接包默认不包含：

- `node_modules/`
- 本地构建缓存
- Python 缓存
- 本地数据库
- 本地真实上传文件
- `.env.local`
- 旧 NocoBase 本地运行目录
- 日志、PID、临时文件

首次运行时按 `.env.example` 创建自己的 `.env.local` 或生产 `.env`。

---

## 3. 技术栈

### 后端

| 模块 | 技术 | 用途 |
|---|---|---|
| API | Python 3.12 / FastAPI | 资产、任务、审核、检索、Agent、图谱、BI API |
| ORM | SQLAlchemy 2 | 数据模型与持久化 |
| 数据库 | PostgreSQL 16 | 生产唯一业务事实源；本地可先用 SQLite |
| 对象存储 | 本地目录 / MinIO / S3 协议 | raw、staging、curated、index_input、agent_output、archive |
| 解析 | pypdf、openpyxl、标准库 zip/xml/csv | PDF、DOCX、XLSX、CSV、Markdown / TXT |
| 部署 | Docker Compose、Nginx、Uvicorn | API、Worker、数据库、对象存储、反向代理 |
| 安全 | PBKDF2、HMAC Token、角色权限、审计日志 | 登录、权限、调用审计 |

### 前端

| 模块 | 技术 | 用途 |
|---|---|---|
| 框架 | React 19 + TypeScript + Vite | 控制台前端 |
| UI | Tailwind CSS v4 | 统一蓝绿色企业风设计系统 |
| 数据 | TanStack Query | 后端状态、缓存、重试 |
| 图表 | Recharts | 趋势、状态分布、业务分析 |
| 图谱 | d3-force + SVG | Obsidian / G6 风格知识网络 |
| 图标 | Lucide Icons | 统一 icon 语言 |

---

## 4. 参考项目与设计来源

本项目不是直接复制某个产品，而是吸收这些项目的治理和交互方法：

| 项目 | 参考点 | 地址 |
|---|---|---|
| FastAPI | 后端 API / Pydantic / OpenAPI 结构 | https://github.com/fastapi/fastapi |
| SQLAlchemy | ORM 与数据模型 | https://github.com/sqlalchemy/sqlalchemy |
| PostgreSQL | 唯一事实源、事务、审计 | https://www.postgresql.org/ |
| MinIO | S3 协议对象存储 | https://github.com/minio/minio |
| React / Vite | 前端工程化 | https://vitejs.dev/ |
| Tailwind CSS | 设计系统 | https://tailwindcss.com/ |
| TanStack Query | 服务端状态管理 | https://tanstack.com/query |
| Recharts | BI 图表 | https://recharts.org/ |
| d3-force | 知识图谱力导向布局 | https://github.com/d3/d3-force |
| Obsidian Graph | 网状图谱交互形态 | https://obsidian.md/ |
| AntV G6 / Graphin | 企业图分析与图谱交互参考 | https://g6.antv.antgroup.com/ , https://graphin.antv.antgroup.com/ |
| RAGFlow | RAG、切片、引用和检索链路参考 | https://github.com/infiniflow/ragflow |
| NocoBase | 低代码后台和资产录入思路参考 | https://github.com/nocobase/nocobase |
| OpenMetadata / DataHub | 元数据、数据资产、血缘和治理参考 | https://open-metadata.org/ , https://datahubproject.io/ |

---

## 5. 系统架构

```text
Web Console / Nginx
        ↓
DataHub Core API
        ↓
PostgreSQL           Object Storage
资产账本               01_raw
处理任务               02_staging
审核记录               03_curated
索引记录               04_index_input
审计日志               05_agent_output
图谱实体 / 关系         90_archive
        ↓
Worker / Parse Pipeline
        ↓
Search / Ask / Agent / Graph / BI
```

核心原则：

1. PostgreSQL 是唯一业务事实源。
2. 对象存储只放文件与处理产物，不替代账本。
3. 未审核资料不能进入索引和 Agent。
4. Agent 只能走受控工具，不直连数据库。
5. 每次关键动作写审计日志。

---

## 6. 核心数据模型

主要表：

| 表 | 作用 |
|---|---|
| `users` | 用户、角色、业务线 |
| `business_lines` | 业务线 |
| `assets` | 资产主账本 |
| `asset_versions` | 资产版本与内容快照 |
| `asset_files` | 原始文件、checksum、存储路径 |
| `processing_jobs` | 解析、清洗、切分、索引任务 |
| `review_logs` | 人审通过 / 驳回记录 |
| `chunks` | 知识切片 |
| `index_records` | 索引和服务记录 |
| `audit_logs` | 操作审计 |
| `entities` | 图谱实体 |
| `relationships` | 图谱关系 |
| `graph_asset_links` | 实体 / 关系回溯来源资产 |
| `agent_logs` | Agent 工具调用 |
| `asset_events` / `processing_runs` | 资产生命周期和处理历史 |

---

## 7. 本地启动

### 7.1 启动后端

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
# 修改 DATAHUB_ADMIN_PASSWORD，生产前必须修改 DATAHUB_SECRET
./run.sh
```

默认后端：

```text
http://127.0.0.1:13001
```

健康检查：

```bash
curl http://127.0.0.1:13001/api/health
```

首次管理员账号来自：

```text
DATAHUB_ADMIN_PASSWORD
```

用户名固定为 `admin`。密码不要写入交接文档或压缩包，单独通过密码管理器交接。

### 7.2 启动前端开发模式

```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev --host 0.0.0.0 --port 5173
```

前端：

```text
http://127.0.0.1:5173
```

### 7.3 使用后端自带静态前端

交接包里的 `server/static/` 已经包含当前构建产物，后端启动后可直接访问：

```text
http://127.0.0.1:13001
```

### 7.4 初始化演示数据

如需初始化妆舟业务演示数据：

```bash
cd server
source .venv/bin/activate
PYTHONPATH=. python3 scripts/seed_zhuangzhou_operations.py
```

演示数据包含主播、直播、投流、订单、售后、内容、供应商、SOP 等模拟业务资产。

---

## 8. 生产部署

### 8.1 环境准备

进入：

```bash
cd infra
cp .env.example .env
```

必须修改：

- `DATAHUB_SECRET`
- `DATAHUB_ADMIN_PASSWORD`
- `POSTGRES_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `DATAHUB_S3_ACCESS_KEY`
- `DATAHUB_S3_SECRET_KEY`
- `DATAHUB_CORS_ORIGINS`

建议生成强随机值：

```bash
openssl rand -hex 32
openssl rand -base64 24
```

### 8.2 启动

```bash
cd infra
docker compose -f docker-compose.prod.yml up -d --build
```

包含服务：

- PostgreSQL 16
- MinIO
- DataHub backend
- DataHub worker
- Nginx

### 8.3 健康检查

```bash
curl http://127.0.0.1:13001/api/health
curl http://127.0.0.1:13001/api/health/ready
```

### 8.4 备份

```bash
cd infra
./scripts/backup.sh
```

备份内容包括：

- PostgreSQL dump
- 对象存储镜像
- SHA256 校验文件

### 8.5 恢复

```bash
cd infra
./scripts/restore.sh /absolute/path/to/backup-dir
```

恢复前应先确认备份目录校验通过，并通知使用方停写。

---

## 9. 真实数据接入流程

推荐先接入 10～30 份有代表性资料，不要第一次就全量导入。

### 9.1 页面操作流程

1. 登录 DataHub。
2. 进入 **原始数据**。
3. 点击 **登记资料**。
4. 填写：
   - 标题
   - 业务线
   - 负责人
   - 资产类型
   - 可见范围
   - 摘要
   - 标签
5. 上传源文件。
6. 进入 **解析与清洗**，触发处理。
7. 检查解析状态、失败原因和生成片段。
8. 进入 **审核中心**。
9. 审核人填写审核意见，执行通过 / 驳回。
10. 通过后进入 **处理后数据 / 知识服务**。
11. 执行索引。
12. 索引成功后发布 Serving。
13. 在 **知识检索** 测试能否查到。
14. 检查引用是否带 `asset_id`、版本、时间和来源。

### 9.2 API 流程

登录：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<password>"}'
```

创建资产：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"妆舟直播 SOP",
    "asset_type":"document",
    "business_line":"zhuangzhou",
    "owner":"运营组",
    "visibility":"business",
    "description":"直播开场、产品讲解、促单和售后响应 SOP",
    "tags":["妆舟","SOP","直播"]
  }'
```

上传文件：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets/<asset_id>/files \
  -H "Authorization: Bearer <token>" \
  -F 'file=@./妆舟直播SOP.docx'
```

解析：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets/<asset_id>/process \
  -H "Authorization: Bearer <token>"
```

审核通过：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets/<asset_id>/approve \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"comment":"业务口径、合规表述和负责人已确认"}'
```

索引：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets/<asset_id>/index \
  -H "Authorization: Bearer <token>"
```

服务化：

```bash
curl -X POST http://127.0.0.1:13001/api/v1/assets/<asset_id>/serve \
  -H "Authorization: Bearer <token>"
```

检索：

```bash
curl -G http://127.0.0.1:13001/api/v1/search \
  -H "Authorization: Bearer <token>" \
  --data-urlencode 'q=妆舟 直播 SOP'
```

---

## 10. 文件解析边界

| 文件类型 | 当前能力 |
|---|---|
| `.txt` / `.md` / `.markdown` | 支持，效果最稳定 |
| `.csv` | 支持并转成 Markdown 表格 |
| `.pdf` | 支持有文字层的 PDF |
| 扫描版 PDF / 图片 PDF | 当前没有可靠 OCR，不建议第一批接入 |
| `.docx` | 支持普通段落文本 |
| `.xlsx` / `.xlsm` | 支持读取；当前每个 Sheet 只读前 200 行 |
| 图片 / 音频 / 视频 | 可作为文件存档，但无法生成可检索文本 |

后续如果要处理扫描件、图片、音视频，需要新增：

1. OCR 服务；
2. ASR 转写服务；
3. 图片描述 / Vision 抽取服务；
4. 多模态索引和引用回溯。

---

## 11. 知识图谱当前逻辑

图谱数据模型是：

```text
Entity  实体
Relationship  关系
GraphAssetLink  来源证据
```

当前能力：

- 实体类型：业务线、模块、主播、直播场次、产品、流程、风险、系统、组织。
- 关系有类型、置信度、状态、来源资产。
- 前端按实体类型聚簇。
- 节点大小表示连接度。
- 关系线亮度表示置信度。
- 支持搜索、筛选、悬停邻域、节点详情、拖拽、缩放和视图重置。
- 点击节点可以看关系方向、置信度和来源资产。

当前边界：

- 上传普通文件不会自动抽取出全部实体和关系。
- 业务演示数据由 `seed_zhuangzhou_operations.py` 生成图谱。
- 后续应增加 LLM 抽取任务：文件 Approved 后触发实体 / 关系抽取，并写 `graph_asset_links` 保留证据。

---

## 12. Agent 与安全边界

Agent 当前只开放受控工具：

```text
search_assets
read_asset
generate_report
```

规则：

1. 未审核资产不能进入 Agent 上下文。
2. 非 admin 只能访问有权限的资产。
3. Agent 调用写 `agent_logs`。
4. Agent 不直连 PostgreSQL，只能走 API 工具。
5. 对外交付时应关闭演示账号，只保留企业账号。

---

## 13. 交接验收清单

### 必须通过

```bash
cd web
pnpm install
npm run build
npm run lint
```

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m pytest -q
```

当前交接前验证结果：

```text
web build：通过
web lint：通过，0 warning，0 error
server pytest：10 passed
```

### 浏览器验收

本地登录后检查：

```text
总览                     /
数据目录                 /catalog
原始数据                 /raw
解析与清洗               /processing
审核中心                 /review
处理后数据               /processed-data
知识服务                 /knowledge-service
知识检索                 /search
Agent 助手               /agent
知识图谱                 /graph
数据分析                 /analytics
妆舟业务运营             /operations
系统设置                 /settings
关于 / 设计原理          /about
```

交接前已验证 14 个页面可打开且无页面运行错误。

---

## 14. 已知限制与下一步

### 当前限制

1. 生产 Worker 仍是轻量后台进程，不是 Celery / RQ / Kafka 级别队列。
2. 索引当前是内置关键词 / 相关性索引，还不是 pgvector 或专用向量库。
3. 扫描 PDF、图片、音频、视频缺少 OCR / ASR / Vision 抽取。
4. 普通文档还不能全自动抽取知识图谱。
5. 数据血缘和字段级影响分析还未实现。
6. 多租户、细粒度审批流、保留删除策略还需要下一期加强。
7. 生产 HTTPS 证书、域名、服务器安全组、备份目标需要部署时配置。

### 建议下一期

1. 文件解析规模化和异步队列化。
2. pgvector / Elasticsearch / RAGFlow 检索适配层。
3. LLM 图谱抽取与人工确认工作流。
4. OCR / ASR / Vision 接入。
5. 字段级血缘和数据质量规则。
6. 多租户权限、审批流、保留删除策略。
7. 服务器生产部署、域名、HTTPS、监控告警和备份恢复演练。

---

## 15. 交接密钥与账号

不要把生产密码、API Key、数据库密码放在压缩包或 Markdown 里。

应单独交接：

1. 管理员初始密码。
2. PostgreSQL 密码。
3. MinIO / S3 Access Key。
4. DeepSeek API Key。
5. Embedding API Key。
6. 域名、DNS、HTTPS 证书配置。

接收人第一次部署后应立即：

1. 修改 admin 密码。
2. 轮换 `DATAHUB_SECRET`。
3. 轮换数据库和对象存储密钥。
4. 关闭演示模式。
5. 配置最小权限业务账号。
