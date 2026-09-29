# 二元空间 DataHub Roadmap

## 当前阶段：Phase 0 / 本地闭环

- 已部署 NocoBase + PostgreSQL 本地底座。
- 已验证 RAGFlow 本地上传、解析、索引、问答链路；服务暂停，数据保留。
- 已交付“关于 / 开发思路”原生页面，作为产品总纲入口。

## Phase 1：Asset Registry

- 在 NocoBase / PostgreSQL 建资产、文件、标签、审核记录模型。
- 导入妆舟 20 个模拟资产。
- 每份资产补齐 asset_id、Owner、Status、Tags、Visibility。

## Phase 2：解析与审核

- 打通解析 Worker，输出 Markdown / JSON。
- 建审核中心，Approved 资产才允许入索引。

## Phase 3：索引 / 检索 / Agent

- 打通向量与关键词检索。
- 提供带 asset_id 引用的问答 API。
- Agent 只开放 search / read / report。

## Phase 4：图谱 / BI / 生产化

- 建业务对象和关系图谱。
- 接入 BI。
- 迁移服务器，完成权限、审计、备份、性能和稳定性验收。

## 2026-09-23 更新：进入正式功能开发

详细执行路线图见：

`docs/2026-09-23_DataHub正式功能开发路线图.md`

当前开发主线：

1. Phase 1：Asset Registry MVP
2. Phase 2：解析 Worker
3. Phase 3：审核中心
4. Phase 4：索引与检索
5. Phase 5：问答与 Agent Context API
6. Phase 6：生产化部署
7. Phase 7：图谱 / BI / 高级中台能力

第一优先级不再是继续美化 About 页面，而是完成 Asset Registry MVP，并导入妆舟 20 个模拟资产。

## 2026-09-23 晚间交付：DataHub Console MVP

- 新增 `datahubAssets` / `datahubJobs` / `datahubReviews` 数据模型。
- 新增 DataHub Console 页面，入口：`/admin/datahub-console-route`。
- 已导入 20 个妆舟模拟资产。
- 已实现资产状态演示流程：Raw → Parsed → Cleaned → Waiting Review → Approved → Indexed → Serving。
- 已实现处理任务记录、审核记录、基础 KPI、状态分布和处理进度展示。
- 已实现轻量检索问答 Demo：答案返回 asset_id 和来源引用。
- 对应功能范围相当于第 1-3 期雏形，可用于内部和早期客户演示。

## 2026-09-24 更新：第 1-6 期验收可用版本

- 已新增 DataHub Core API：`server/`
- 已接入资产、文件、解析、审核、索引、检索、问答、Agent、图谱、BI、审计。
- 已提供生产部署骨架：Dockerfile、Docker Compose、Nginx、PostgreSQL。
- 已提供自动化测试：`server/tests/test_api.py`。
- 第 1-6 期进入统一验收阶段，验收说明见 `docs/2026-09-24_DataHub_第1-6期验收说明.md`。

## 2026-09-24 更新：产品与架构收敛

- 停止继续发散功能。
- 确定 DataHub Core API 为主后端，NocoBase 降级为后台工具。
- 确定 13001 为当前开发主入口，生产环境后续统一到 HTTPS 域名。
- 确定唯一业务数据源迁移到 PostgreSQL DataHub DB。
- 确定正式页面结构：总览、资产中心、处理中心、审核中心、知识检索、Agent、图谱、数据分析、系统设置。
- 收敛方案见 `docs/2026-09-24_DataHub产品与架构收敛方案.md`。

## 2026-09-24 更新：Postgres 与入口收敛第一阶段

- DataHub Core 已从 SQLite 切换到 PostgreSQL。
- 已迁移 20 个资产、20 个处理任务、21 个 Chunk、审核记录和审计日志。
- NocoBase 的 DataHub 控制台入口已指向 Core 前端 `13001`。
- 旧 NocoBase datahub 表已导出冻结快照，不再作为主数据源。

## 2026-09-24 更新：Graph / BI Analytics API v1

- 新增多来源图谱追溯模型 `graph_asset_links`。
- 新增图谱查询过滤：业务线、实体类型、关系类型、关系状态、资产 ID。
- 新增关系状态与置信度更新 API。
- 新增 BI 实时读模型：资产趋势、状态/业务线分布、解析成功率、审核效率、索引失败率、检索命中率、问答次数、Agent 使用次数、引用覆盖率、越权访问次数。
- 自动化测试：`server/tests/test_graph_bi.py`。
- 详细交付记录见 `开发过程/006_Feature_Graph_BI_Analytics.md`。
- [x] 2026-09-24 Retrieval / Ask / Agent API：混合检索、权限过滤、引用完整性、Agent 工具与日志（pytest 6 passed）

## 2026-09-24 更新：Core 后端架构收敛

- API 收敛为 `/api/v1`，`/api` 继续兼容旧前端。
- Router / Service 分层完成，补齐资产版本、文件下载、任务重试、审计和存储目录抽象。
- 登录口令升级为 PBKDF2，旧口令登录后自动 rehash；token 增加 HMAC 过期签名。
- 自动化测试 `6 passed`；本地 13001 健康检查、首页和 `/api/v1/auth/login` 已复验。
- 详见 `开发过程/007_Feature_CoreBackendArchitectureHardening.md`。

## 2026-09-24 · 004 生产部署与 QA 骨架

- 完成 PostgreSQL / FastAPI / Worker / MinIO / Nginx / HTTPS / 备份恢复部署骨架。
- 补齐 9 个 API 自动化测试，覆盖 1-6 期主链路与权限拒绝路径。
- 生成 `docs/2026-09-24_DataHub_1-6期验收报告.md`。

## 2026-09-24 更新：正式 Web 前端收敛

- 新增 `web/` React + Vite + TypeScript + Tailwind 控制台。
- 收敛总览、数据目录、原始数据、解析清洗、审核、知识服务、检索、Agent、图谱、BI、设置和关于页。
- 统一 Belliora 风格设计系统、状态徽标、卡片、表格、弹窗、空态/加载态/错误态。
- 服务层支持 Mock / Auto / Live，canonical API 使用 `/api/v1`。
- 已完成 lint、production build、真实登录、总览、目录、图谱、检索和关于页浏览器验证。
- 本地入口：`http://127.0.0.1:5173`；开发代理默认指向 Core API `13001`。
- 交付记录见 `开发过程/004_Feature_DataHub正式Web前端.md`。

## 2026-09-24 更新：妆舟业务数据中台深化

- 新增资产生命周期历史和处理运行记录。
- 新增 lifecycle / timeline / business APIs。
- 新增妆舟业务数据 164 条，覆盖主播、直播、投流、订单、售后、内容、供应商、SOP、风险和复盘。
- 新增 `/operations` 妆舟业务运营页。
- 资产详情新增完整生命周期历史。
- 当前系统资产总数达到 184 条，业务 GMV / ROI / 订单 / 主播指标可查询。
- 自动化测试更新至 10 passed。


## 2026-09-24 更新：Graph UX 与产品化降噪

- 知识图谱重写为 Obsidian / G6 风格网络：按实体类型聚簇，节点大小表示连接度，关系线表示置信度。
- 图谱新增搜索、实体类型、业务线、关系类型、置信度筛选，支持悬停邻域、节点详情、拖拽、缩放和视图重置。
- 关系台账与图谱洞察拆成独立 Tab，降低单页信息密度。
- 总览、分析、知识服务、检索、Agent 页面改为 KPI + 主图表 + 明细 Tab 的产品结构。
- 原始数据、解析清洗、审核中心、处理后数据、数据目录补充生命周期状态摘要、进度条、阻塞点和快捷操作。
- 数据目录保持“业务线 → 生命周期目录 → 资产列表”三级结构，并默认进入资产最多的业务线。
- 统一蓝绿色系、KPI 卡、Card、按钮、侧边栏导航和图表样式。
- 验收：`npm run build` 通过，`npm run lint` 0 warning / 0 error；14 个页面真实浏览器打开无运行错误。
- 详见 `开发过程/009_Feature_GraphUX与产品化降噪.md`。


## 2026-09-29 更新：生产部署到生产服务器

- DataHub 已部署到腾讯云轻量服务器 `<production-host>:13001`。
- 部署 PostgreSQL、MinIO、Core API、Worker、DataHub Nginx。
- 未占用宿主机 `80 / 443`，已有 <production-instance-name> 服务保持运行。
- 已放行 `TCP/13001`，完成健康检查、登录、BI、资产 API 和真实浏览器验收。
- 修复 `DATAHUB_STORAGE_BACKEND=s3` 后端别名支持。
- 增加 Docker Registry 镜像加速、腾讯 PyPI 镜像和 `MINIO_MC_IMAGE` 可配置项。
- 部署记录见 `开发过程/010_Feature_ProductionDeployment.md`。
