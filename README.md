# Eryuan DataHub

二元空间 DataHub 是一个企业数据与知识中台底座，把分散资料变成可治理、可审核、可检索、可引用、可被 Agent 调用的受控知识资产。

核心链路：

```text
Raw Data
→ Asset Registry
→ Parse / Clean / Chunk
→ Human Review
→ Index / Serving
→ Search / Ask / Agent / Graph / BI
```

## 功能

- 资产登记、版本、标签、负责人、可见范围和唯一 `asset_id`
- 文件上传、解析、清洗、切分和任务状态跟踪
- 人工审核、通过 / 驳回记录和审计日志
- 关键词与可选语义向量检索
- 带引用的知识问答
- Agent 受控工具：搜索、读取、报告
- 实体关系图谱与来源资产回溯
- BI 指标、业务运营分析、生命周期看板
- PostgreSQL / FastAPI / React / Docker 生产部署骨架

## 技术栈

| 层 | 技术 |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Recharts, d3-force |
| API | Python, FastAPI, SQLAlchemy, Pydantic |
| Storage | PostgreSQL 16, MinIO / S3-compatible object storage |
| Security | PBKDF2, signed tokens, role-based access, audit logs |
| Deployment | Docker Compose, Nginx, Uvicorn worker |

## 快速开始

### 1. 启动后端

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local
# 修改 DATAHUB_ADMIN_PASSWORD
./run.sh
```

后端地址：

```text
http://127.0.0.1:13001
```

### 2. 启动前端开发服务

```bash
cd web
pnpm install
cp .env.example .env.local
pnpm dev --host 0.0.0.0 --port 5173
```

前端地址：

```text
http://127.0.0.1:5173
```

### 3. 生产部署

```bash
cd infra
cp .env.example .env
# 设置强随机密钥、数据库密码、MinIO 凭据和管理员密码
docker compose -f docker-compose.prod.yml up -d --build
```

更完整的交接说明见 [`HANDOVER.md`](./HANDOVER.md)。

## 测试与检查

### 后端

```bash
cd server
python3 -m pytest -q
```

### 前端

```bash
cd web
pnpm install
pnpm lint
pnpm build
```

## 目录结构

```text
server/       FastAPI Core API、Worker、模型、测试、静态前端产物
web/          React 控制台源码
infra/        Docker Compose、Nginx、备份与恢复脚本
docs/         API 契约、架构与验收文档
开发过程/      功能决策、路线图和交付记录
HANDOVER.md   交接手册
```

## 数据边界

仓库只包含代码、配置模板和文档，不包含真实业务数据、生产数据库、上传文件或生产密钥。

`.env`、`.env.local`、数据库、日志和 `server/storage/` 已被 Git 忽略。

首次运行时请从 `.env.example` 复制并替换所有默认值。

## License

[MIT](./LICENSE)
