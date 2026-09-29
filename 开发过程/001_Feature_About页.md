# 001 Feature：关于 / 开发思路页

## 背景

- 数据中台主体选择 NocoBase 作为控制台底座。
- 需要一个面向老板和后续开发者的总纲页，说清产品定位、方法依据、架构、价值和阶段目标。
- 前一版把 `desktopRoutes.schemaUid` 直接指向 `Markdown.Void`，缺少 Page → Tab → Grid → Markdown 的完整 FlowModel 链，导致页面空白。

## 关键决策

1. 使用 NocoBase v2 `flowPage` 的原生 FlowModel 结构：
   `RouteModel → RootPageModel → RootPageTabModel → BlockGridModel → MarkdownBlockModel`。
2. Markdown 区块内使用受控 HTML + 内联样式，保证无需改主题也能呈现国际化视觉。
3. 页面内容强调“企业 Context Plane”，并把参考体系、验收目标和证据边界分开。
4. 隐藏旧的手工 Markdown 路由，只保留一个菜单项“关于 / 开发思路”。

## 否掉的备选

- 外部静态 `/about.html`：能展示，但不是 NocoBase 原生 Tab，不符合正式门户要求。
- 继续手写旧版 `uiSchemas` 页面结构：不符合 NocoBase v2 FlowPage 渲染链，风险高。
- 把 23KB 总纲全文原样塞入页面：老板首屏理解成本高，改为高密度图文页，原文档继续留档。

## 交付证据

- 本地地址：`http://127.0.0.1:13000/admin/xe2pyz6hbqa`
- 菜单标题：`关于 / 开发思路`
- 已在浏览器验收：
  - 页面非空白。
  - HTML 卡片、生命周期、指标图、参考链接渲染正常。
  - 刷新后内容仍存在。
  - UI Editor 关闭后不显示编辑控件。

## 图表与数据说明

- 指标条展示的是 Phase 1-4 验收目标，不是生产实测结果。
- 当前证据等级是“本地功能验证”：NocoBase 已部署；RAGFlow 本地上传、解析、索引、问答链路已试跑。
- 生产性能、并发、权限隔离和稳定性必须在服务器环境复测。

## 参考链接

- NocoBase：https://github.com/nocobase/nocobase
- Databricks Medallion：https://learn.microsoft.com/en-us/azure/databricks/lakehouse/medallion
- OpenMetadata：https://open-metadata.org/
- DataHub：https://datahubproject.io/
- RAGFlow：https://github.com/infiniflow/ragflow
- Model Context Protocol：https://modelcontextprotocol.io/
- Microsoft GraphRAG：https://github.com/microsoft/graphrag
- Neo4j：https://neo4j.com/

## 2026-09-23 v0.3 视觉升级

- 参考 Belliora Dashboard 设计语言：浅暖底色、白卡、圆角、细边框、柔阴影、衬线标题、低饱和彩色标签。
- 参考源码已保留在：`02_产品项目/07_DataHub/local/reference/belliora/`。
- 借用组件形式：
  - Welcome Stats：顶部概览卡片。
  - Revenue Chart：SVG 渐变面积曲线 + 虚线基线。
  - Top Services：能力栈表格。
  - Top Performing Branches：阶段优先级柱状图。
  - Day Schedule：生命周期胶囊与图例表达。
- 图表口径：
  - “Governed Context Value”为规划示意曲线，不表示实测收益。
  - “Delivery Focus”为阶段优先级权重，不表示完成度。
  - 生产指标上线后必须替换为真实命中、引用和权限审计数据。
- NocoBase Markdown 会过滤 `<style>`，因此本次继续使用内联样式；后续如需 Chart.js 交互，应使用 NocoBase 自定义组件或 JS Block，而不是外部脚本。

## 2026-09-23 v0.4 内容密度升级

- 参考 `~/Downloads/二元空间_DataHub_设计原理.html`，把页面从视觉封面升级成完整设计基线。
- 保留 Belliora 式组件语言，同时补齐 12 个论证模块：
  1. 为什么需要；
  2. 不只是 RAG；
  3. 总体架构；
  4. 方法来源；
  5. 资料生命周期；
  6. Source of Truth；
  7. 人 / AI 价值；
  8. AI 回答链路；
  9. 验收指标；
  10. 落地路线；
  11. MVP 边界；
  12. North Star 与参考依据。
- 新增明确证据口径：当前是本地功能验证；验收指标是 Phase 1-4 目标，不是生产实测结果。
- 归档页面源码：
  - `docs/About_二元空间DataHub_设计原理_v0.4.html`
  - `~/Downloads/二元空间_DataHub_设计原理_v0.4.html`
- 浏览器验收：长页可滚动，各模块无空白、无 HTML 转义泄漏；图表说明和参考链接正常显示。

## 2026-09-23 v0.5 可视架构升级

- 新增“系统拓扑”SVG：表达数据源、Context Control Plane、Storage & Index、Serving 与 Feedback Loop。
- 新增“处理流程”SVG：表达主链路、人工闸口、失败链路和重试任务。
- 新增“处理效果”：能力提升目标图、20 个试点资产状态分布、Before / After 效果卡。
- 新增“组件与图表升级路线”：列出 React Flow、AntV X6、Mermaid、ECharts、Chart.js、Tremor、Lucide、Iconify、AntV G6、Cytoscape.js、shadcn/ui 等开源选型方向。
- 当前 NocoBase Markdown 环境继续使用内联 SVG，保证稳定渲染；后续用 NocoBase 自定义组件替换为可交互图表。
- 页面源码归档：
  - `docs/About_二元空间DataHub_设计原理_v0.5.html`
  - `~/Downloads/二元空间_DataHub_设计原理_v0.5.html`
- 浏览器验收：拓扑图、流程图、效果图、组件路线均正常渲染，控制台无新增错误。
