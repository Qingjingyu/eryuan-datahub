# 009 · Graph UX 与产品化降噪

## 背景

上一版功能链路已经能跑通，但演示时仍有三个问题：

1. 知识图谱偏散点，业务对象之间的关联感不足。
2. 页面文字密度偏高，用户第一眼看到的是说明，而不是产品状态。
3. 组件和色彩跨页面不统一，生命周期页面缺少“当前有多少、卡在哪里、下一步做什么”的产品化摘要。

本轮目标不是新增后端能力，而是把已有数据、关系和状态用更好的交互表达出来。

## 关键决策

### 1. 知识图谱采用 Obsidian / G6 风格

- 保留现有 Graph API，不改实体和关系数据结构。
- 前端用 `d3-force` 做确定性力导向布局，按实体类型聚簇。
- 使用深色画布、发光节点、低透明度曲线边，形成 Obsidian 风格的网络感。
- 节点大小按连接度计算，边亮度和粗细按关系置信度呈现。
- 默认只显示高连接节点标签；悬停、点击或放大时展示邻域标签，避免文字噪声。

### 2. 图谱必须可探索，而不是静态展示

新增或强化：

- 实体搜索。
- 实体类型筛选。
- 业务线筛选。
- 关系类型筛选。
- 最低置信度筛选。
- 悬停高亮一跳邻域。
- 点击节点查看关系方向、置信度、来源资产。
- 支持节点拖拽、画布缩放、视图重置。
- 明细下沉到“关系台账”和“图谱洞察”两个 Tab。

### 3. 页面结构从“文档”改为“驾驶舱”

统一页面节奏：

```text
页头结论
→ 核心 KPI
→ 主流程 / 主图表
→ 阻塞点 / 操作区
→ 明细表格 / 明细 Tab
```

总览、数据分析、知识服务、检索、Agent 页面突出核心指标和主图表。  
原始数据、解析清洗、审核中心、处理后数据、数据目录突出生命周期状态和阻塞点。

### 4. 数据目录保持层级

数据目录按三层组织：

```text
业务线
→ 生命周期目录
→ 资产列表
```

默认业务线按资产数量排序，避免首次进入落在空目录。当前真实数据会默认进入「妆舟」。

### 5. 组件体系统一为蓝绿色产品风格

- 主色统一：`#0f766e`、`#0d9488`。
- KPI 卡增加渐变光斑、hover 位移和统一图标容器。
- Card、按钮、侧边栏、Tab、表格和图表风格统一。
- 侧边栏使用深蓝绿渐变，当前导航增加左侧指示条。
- 全站中文状态文案优先，Approved / Indexed / Serving 等技术标识只在必要位置保留。

## 否掉的备选

### 直接引入 Graphin

Graphin 对 React / Vite 版本兼容需要额外处理，而且当前只有 65 个节点、124 条关系。  
为了不把展示层问题变成依赖治理问题，本轮没有引入 Graphin，先基于现有 `d3-force` 做受控实现。

### 只调 Sigma 参数

只调参数不能解决标签噪声、类型聚簇、拖拽、筛选和右侧详情联动的问题。  
所以图谱层重写为可控制的 React / SVG 交互组件。

### 每页塞更多说明文字

产品演示需要先让人看懂“现在状态如何、哪里阻塞、下一步点什么”。  
长说明和背景依据继续保留在「关于 / 设计原理」，不在业务页面首屏展开。

## 改动范围

主要文件：

- `web/src/components/graph/KnowledgeGraphCanvas.tsx`
- `web/src/pages/KnowledgeGraphPage.tsx`
- `web/src/pages/OverviewPage.tsx`
- `web/src/pages/AnalyticsPage.tsx`
- `web/src/pages/KnowledgeServicePage.tsx`
- `web/src/pages/SearchPage.tsx`
- `web/src/pages/AgentAssistantPage.tsx`
- `web/src/pages/RawDataPage.tsx`
- `web/src/pages/ProcessingPage.tsx`
- `web/src/pages/ReviewCenterPage.tsx`
- `web/src/pages/ProcessedDataPage.tsx`
- `web/src/pages/DataCatalogPage.tsx`
- `web/src/components/layout/AppShell.tsx`
- `web/src/components/data/StatCard.tsx`
- `web/src/components/ui/Card.tsx`
- `web/src/components/ui/Button.tsx`
- `web/src/index.css`

## 验收证据

### 构建

```bash
npm run build
```

结果：通过。

### 静态检查

```bash
npm run lint
```

结果：0 warning，0 error。

### 真实浏览器验收

使用 `<管理员账号由密码管理器单独交付>` 登录本地前端：

```text
http://127.0.0.1:5173
```

逐页检查：

```text
/
/catalog
/raw
/processing
/review
/processed-data
/knowledge-service
/search
/agent
/graph
/analytics
/operations
/settings
/about
```

结果：

- 14 个页面均可打开。
- 页面运行错误为 0。
- 真实数据指标可读：184 项资产、65 个图谱节点、124 条关系、49 个证据资产。
- 图谱支持筛选、聚簇、悬停邻域、节点详情和来源资产追溯。
- 数据目录默认进入有数据的「妆舟」业务线。
- 390px 移动端抽查总览、图谱、数据目录无页面错误。

## 当前边界

- 本轮是前端产品化验收版，不新增后端写入接口。
- 图谱布局当前为确定性力导向静态布局；后续如超过几千节点，需要切换 WebGPU / Canvas / G6 渲染层。
- 数据目录的“失败”目录仍主要依赖 `index_status === failed`；如果任务失败但没有回写资产索引状态，该资产不会进入失败目录。
- “关于 / 设计原理”保留方法论与开源依据；业务页面继续降低文档感。
