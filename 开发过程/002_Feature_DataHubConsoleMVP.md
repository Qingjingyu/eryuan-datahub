# 002 Feature：DataHub Console MVP（第 1-3 期雏形）

## 背景

在完成设计总纲页后，进入正式功能开发第一阶段。今天先交付一个可演示的 DataHub Console MVP，让用户能在浏览器里看到从资料进入、处理、审核到入库服务的最小闭环。

## 已实现

### 数据模型

- `datahubAssets`：资产主表
- `datahubJobs`：解析 / 清洗 / 切块 / 索引任务
- `datahubReviews`：审核记录
- 关键字段：`assetId`、`title`、`businessLine`、`assetType`、`owner`、`status`、`progress`、`tags`、`sourceText`、`processedMarkdown`、`chunkCount`、`callCount`

### 用户功能

- 浏览资产总数、处理中、待审核、已通过、服务中、失败任务
- 查看处理流水线状态
- 上传文本类资料并登记为资产
- 批量选择资产并推进流程
- 单个资产 Process / Approve / Reject / Index / Serve
- 查看最近 Processing Jobs
- 对已入库资产做关键词检索并返回引用
- 查看资产状态分布和处理进度

### 页面入口

- NocoBase 菜单：`DataHub Console`
- 路由：`/admin/datahub-console-route`
- 独立页面：`/datahub-console.html`

## 已导入数据

- 妆舟模拟知识包 20 个资产
- 其中一部分已推进到 Serving，用于演示检索 / 问答引用
- 其余保留在 Raw / Parsed / Waiting Review，便于演示完整处理流程

## 技术边界

- 当前解析器是轻量解析：主要处理 Markdown / CSV / TXT，PDF / DOCX 解析后续接入 Worker。
- 当前检索是关键词 / 相关性检索，用于第 3 期演示；生产级向量检索、Rerank 和权限过滤后续接入。
- 当前文件内容保存在资产记录中，用于演示；生产版本要迁移到 MinIO / OSS。
- 当前不做 Agent 工具、知识图谱、完整 BI。

## 验收证据

- `/admin/datahub-console-route` 可打开。
- Console 内 KPI、Pipeline、状态分布、资产表、任务表可渲染。
- 可以 Process → Approve → Index → Serve。
- Ask the Knowledge Base 可返回答案和 `asset_id` 引用。
- 控制台无新增 JS 错误。

## 2026-09-23 深夜整改：产品壳与中文体验

### 问题

- Console 被 iframe 包裹后没有占满可视区，底部留白。
- 文案大量使用英文，不符合当前用户阅读习惯。
- 页面仍暴露 NocoBase 原生标题、Tab 和黑边，产品感弱。
- 顶部 logo、产品名、导航结构不符合正式产品形态。

### 已整改

1. 重写 Console 为完整产品壳：
   - 左侧导航：总览、资产中心、处理中心、审核中心、知识检索、Agent 助手、知识图谱、系统设置。
   - 顶部区域：产品名、当前视图、说明和核心操作。
   - 主内容区独立滚动，不再依赖固定高度。
2. 全站文案中文化，仅保留 `asset_id`、`Approved` 等必要技术标识。
3. 资产状态、任务状态、按钮、表头、筛选器、错误说明全部改为中文。
4. 新增自定义 logo，并将 NocoBase 系统标题改为“二元空间 DataHub”。
5. 通过 iframe 内同步样式，隐藏当前路由下的 NocoBase 原生页头 / Tab，让 Console 占满可视区。
6. 资产中心、处理中心、审核中心、知识检索拆成独立视图，导航和业务功能对齐。
7. 知识检索改为中文提示和中文引用说明，示例问题可直接一键填充。

### 新入口

- NocoBase 路由：`/admin/datahub-console-route`
- 独立全屏入口：`/datahub-console.html`

### 验收

- 路由打开后不再出现 NocoBase 原生页头和 Tab，界面占满可视区。
- 侧边栏、总览、资产中心、处理中心、审核中心、知识检索均可正常切换。
- 中文文案完整显示，无破坏性布局错误。
- Console 无新增 JS 错误。
