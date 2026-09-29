# 二元空间 DataHub Web

正式数据中台前端。目标是用一个统一、现代、企业级的控制台，替换散落的静态页面。

## 技术栈

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- React Router
- TanStack Query
- Recharts
- Lucide Icons
- 组件化 UI（Button / Card / Table / Modal / Tabs / Badge / State）

## 页面

| 分组 | 页面 | 路由 |
|---|---|---|
| 工作台 | 总览 | `/` |
| 工作台 | 数据目录 | `/catalog` |
| 资产详情 | 数据目录详情 | `/catalog/:assetId` |
| 数据生命周期 | 原始数据 | `/raw` |
| 数据生命周期 | 解析与清洗 | `/processing` |
| 数据生命周期 | 审核中心 | `/review` |
| 数据生命周期 | 知识服务 | `/knowledge-service` |
| 智能服务 | 知识检索 | `/search` |
| 智能服务 | Agent 助手 | `/agent` |
| 智能服务 | 知识图谱 | `/graph` |
| 分析 | 数据分析 | `/analytics` |
| 系统 | 系统设置 | `/settings` |
| 系统 | 关于 / 设计原理 | `/about` |
| 认证 | 登录 | `/login` |

## 运行

```bash
pnpm install
pnpm dev --host 0.0.0.0 --port 5173
```

访问：

```text
http://127.0.0.1:5173
```

本地演示账号可使用 `demo / demo123`；真实 `admin` 账号由后端 `DATAHUB_ADMIN_PASSWORD` 初始化，密码不写入文档。

## API 模式

复制环境变量文件：

```bash
cp .env.example .env.local
```

| 模式 | 行为 |
|---|---|
| `VITE_API_MODE=mock` | 全部使用内置演示数据，不需要后端。 |
| `VITE_API_MODE=auto` | 优先请求 FastAPI；网络异常或后端 5xx 时回退 Mock。 |
| `VITE_API_MODE=live` | 只请求真实后端，失败直接显示错误。 |

后端默认代理：

```bash
VITE_PROXY_TARGET=http://127.0.0.1:13001
```

如果后端跨域或部署在其他地址，可设置：

```bash
VITE_API_BASE_URL=https://datahub.example.com
```

当前后端 API 前缀为 `/api/v1`，并保留 `/api` 兼容。前端使用 canonical `/api/v1`：

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/assets`
- `POST /api/v1/assets`
- `PATCH /api/v1/assets/:asset_id`
- `POST /api/v1/assets/:asset_id/files`
- `POST /api/v1/assets/:asset_id/process`
- `POST /api/v1/assets/:asset_id/approve`
- `POST /api/v1/assets/:asset_id/reject`
- `POST /api/v1/assets/:asset_id/index`
- `POST /api/v1/assets/:asset_id/serve`
- `GET /api/v1/jobs`
- `GET /api/v1/reviews`
- `GET /api/v1/search`
- `POST /api/v1/ask`
- `POST /api/v1/agent/search` / `POST /api/v1/agent/read` / `POST /api/v1/agent/report`
- `GET /api/v1/graph`
- `POST /api/v1/graph/entities`
- `POST /api/v1/graph/relationships`
- `GET /api/v1/bi/metrics`
- `GET /api/v1/admin/users`

## 构建

```bash
pnpm build
```

## 设计系统

- 背景：`#f4f2ef`
- 卡片：`#ffffff`
- 边框：`#ebe9e6`
- 主色：`#3f1f2c`
- 主色浅：`#5a2e3f`
- 成功：`#54b878`
- 警示：`#d97706`
- 信息：`#5b86d1`
- 危险：`#d1568a`
- 紫色：`#8377d6`
- 标题字体：Newsreader / Georgia
- 正文字体：Inter / PingFang SC

所有页面必须有 loading、empty、error 状态。技术术语保留 `asset_id`、`Approved`、`Indexed`、`Serving`、`Agent` 等必要英文。
