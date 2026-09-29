# 004 Feature · DataHub 正式 Web 前端

## 背景

此前 DataHub 的展示层主要依赖静态页和 NocoBase 临时页面，存在四个问题：

1. 页面结构不统一，部分内容不是中文优先。
2. 生命周期、审核、索引、检索、Agent、图谱和 BI 分散在不同入口。
3. 组件、颜色、卡片、状态徽标和图表缺少统一设计系统。
4. 静态演示无法稳定对接 FastAPI 后端，也无法明确 Mock / Live 边界。

本次交付目标是建立正式前端工作区 `web/`，把第 1-6 期能力收敛到一个企业级控制台。

## 交付范围

- 新建 React 19 + Vite + TypeScript + Tailwind CSS v4 前端。
- 实现 13 个业务页面：登录、总览、数据目录、资产详情、原始数据、解析与清洗、审核中心、知识服务、知识检索、Agent 助手、知识图谱、数据分析、系统设置、关于 / 设计原理。
- 建立统一 App Shell：左侧分组导航、顶部模块上下文、用户区、全屏内容滚动区。
- 建立统一组件：Button、Card、Badge、StatusBadge、Table、Tabs、Modal、Field、StatCard、StageFlow、Loading / Empty / Error。
- 建立统一服务层：
  - `mock`：内置 22 个资产、任务、审核、图谱、BI 演示数据。
  - `auto`：优先请求 FastAPI，后端不可用时回退 Mock。
  - `live`：只请求真实后端，错误直接暴露。
- 对接当前 `server/app/main.py` 的 `/api/...` 路由，不修改后端代码。
- 图表使用 Recharts；图谱使用 SVG 拓扑；图标使用 Lucide Icons。

## 关键决策

### 1. 使用独立 `web/`，不继续把静态 HTML 塞进 NocoBase

NocoBase 适合作为低代码控制台参考或后续后台，但当前 DataHub 需要自定义生命周期、图表、图谱和 Agent 交互。独立前端更容易做统一设计系统和业务 API。

### 2. 不修改 `server/app`

后端已有资产、任务、审核、索引、检索、问答、Agent、图谱、BI、用户接口。前端只消费 API，避免把业务规则写到 UI。

### 3. API 使用 `/api` 而不是文档中的 `/api/v1`

当前后端实际注册的是 `/api/auth/login`、`/api/assets` 等路由。前端以 canonical `/api/v1` 为准；后端同时保留 `/api` 兼容旧入口，避免验收时出现 404。

### 4. Mock / Auto / Live 三种模式

演示和客户验收需要无后端可用；开发联调需要看到真实后端错误；生产必须关闭回退。三种模式都显式出现在 README 和系统设置里。

### 5. 设计系统沿用 Belliora 的暖色企业风格

保留浅暖背景、白色卡片、细边框、深酒红主色和柔和阴影；标题使用 Newsreader/Georgia，正文使用 Inter/PingFang SC。图表和状态色统一收敛到 plum / success / warning / info / danger / violet。

## 否掉的备选

- **继续手写 NocoBase Schema**：PageModel 结构调试成本高，复杂图表和图谱受限。
- **直接复制 Belliora 页面**：只借视觉语言，不复制业务页面；Belliora 是门店后台，不适合直接承载资产状态机。
- **只做静态原型**：无法验证上传、审核、检索、Agent、图谱和 BI 链路。
- **继续使用多套独立工具拼门户**：权限、状态和审计边界会继续割裂。

## 测试与验收

- `pnpm lint` 通过。
- `pnpm build` 通过 TypeScript 编译和 Vite production build。
- Playwright 实际访问 `/login`、`/`、`/catalog`、`/graph`、`/about`。
- 登录页可使用 `demo / demo123` 进入。
- 总览、目录、图谱、关于页均已截图检查，页面非空白。
- 后端未启动时，`auto` 模式自动进入演示数据，页面仍可完整演示。
- 当前开发入口：`http://127.0.0.1:5173`。

## 后续

1. 启动 FastAPI 后端后切 `VITE_API_MODE=live` 验证真实数据。
2. 把上传和导出从本地 storage 切到 MinIO / OSS / COS。
3. 增加 Dockerfile / nginx 静态部署配置。
4. 把更多提示词、解析器和抽取规则配置化。
5. 增加端到端验收脚本：上传 → 解析 → 审核 → 索引 → 检索 → 引用。
