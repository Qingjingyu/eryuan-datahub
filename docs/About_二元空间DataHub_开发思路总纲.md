# About：二元空间 Data Hub 开发思路总纲

> 版本：v0.1  
> 日期：2026-09-23  
> 定位：产品总纲 / 方法说明 / 开发依据  
> 面向对象：产品、研发、实施、管理者，以及后续参与维护这套系统的人  

---

## 1. 一句话定义

**二元空间 Data Hub 是企业 Context Plane。**

它不是传统网盘，也不只是知识库，而是一个让企业资料、业务数据、AI 结果和关系资产能够被：

```text
登记
处理
确认
授权
检索
引用
复用
治理
```

的系统。

它要解决的问题不是“把文件放起来”，而是让企业数据变成：

```text
可信任
可追溯
可授权
可检索
可被 AI 使用
```

---

## 2. 这个产品为什么会出现？

在企业里，资料通常散落在很多地方：

```text
本地电脑
飞书 / 企业微信
会议纪要
产品文档
客户需求
ERP / CRM / U8
有赞 / 抖音
研发资料
AI 生成结果
```

这些数据常见问题是：

| 问题 | 后果 |
|---|---|
| 没有统一 ID | 同一份资料有多份，不知道哪份最新 |
| 没有负责人 | 资料没人维护，逐渐过期 |
| 没有状态 | 不知道哪些是草稿，哪些已确认 |
| 没有权限 | 敏感资料可能被错误授权 |
| 没有来源 | AI 回答无法追溯 |
| 没有生命周期 | 不知道哪些该更新、归档、删除 |
| 没有关系 | 无法回答“客户 / 项目 / 产品 / 决策”之间的关联 |

所以我们不是要做一个“更大的网盘”，也不是做一个单纯 RAG，而是做一个：

> **企业 Context Plane / 数据资产中台。**

---

## 3. 方法来自哪里？

这套思路不是凭空来的，而是参考了几类成熟体系。

### 3.1 Lakehouse / Data Platform 分层方法

参考了：

- Databricks Lakehouse
- Snowflake AI Data Cloud
- 阿里云 DataWorks
- 腾讯云 WeData
- 字节火山引擎 DataLeap
- Microsoft Fabric

它们都会把数据分成类似：

```text
Raw / 原始层
 ↓
Cleaned / 清洗层
 ↓
Business Ready / 业务可用层
 ↓
Serving / 服务层
```

我们把这个思想裁剪成：

```text
01_raw
 ↓
02_staging
 ↓
03_curated
 ↓
04_index_input
 ↓
05_agent_output
```

这样做的目的，是避免所有资料混在一起。

---

### 3.2 企业内容管理 / 数字资产管理

参考了企业内容管理（ECM）和数字资产管理（DAM）的实践。

企业里的资料不能只是“文件”，它还必须有：

```text
asset_id
title
owner
source
version
status
tags
visibility
created_at
updated_at
retention_policy
```

这部分解决的是：

> 企业资料如何变成有负责人、有版本、有权限、有生命周期的资产。

---

### 3.3 元数据治理 / 数据资产目录

参考了：

- OpenMetadata
- DataHub
- Apache Atlas
- Microsoft Purview
- Google Dataplex

这些系统回答的问题不是“文件存在哪里”，而是：

```text
这是什么？
从哪里来？
谁负责？
谁能用？
质量怎么样？
和哪些系统有关？
如何追踪血缘？
```

所以我们建立了 **Asset Registry / 资产注册中心**。

---

### 3.4 RAG 检索增强生成

参考了：

- RAGFlow
- LlamaIndex
- LangChain
- Haystack
- Dify Knowledge
- Microsoft GraphRAG
- LightRAG

RAG 的标准做法是：

```text
文档解析
 ↓
切分 Chunk
 ↓
生成 Embedding
 ↓
向量检索
 ↓
关键词检索
 ↓
重排
 ↓
LLM 生成答案
 ↓
返回引用
```

但企业场景不能只做这些。

还必须加：

```text
权限过滤
业务线过滤
资产状态过滤
版本过滤
审核状态过滤
asset_id 引用
```

否则 AI 可能引用：

```text
过期资料
未确认草稿
敏感文件
重复内容
无权内容
```

---

### 3.5 Agent Context Engineering

参考了：

- OpenAI Assistants / File Search / Tools
- Anthropic Claude Code
- Model Context Protocol，MCP
- LangGraph
- Google Vertex AI Agent Builder

这些系统的共同点是：

> Agent 不直接拥有所有数据，而是通过受控工具访问上下文。

所以我们不让 Agent 直接连数据库，而是给它受控 API：

```text
search_assets()
read_asset()
create_asset()
update_asset()
propose_delete_asset()
generate_report()
```

每个动作都必须经过：

```text
权限检查
资产状态检查
来源过滤
审计日志
```

---

### 3.6 知识图谱 / Ontology

参考了：

- Palantir Foundry Ontology
- Microsoft GraphRAG
- LightRAG
- Neo4j
- 企业知识图谱实践

知识图谱不是一开始让 AI 乱抽实体和关系，而是先定义核心对象：

```text
业务线
模块
负责人
客户
产品
需求
会议
决策
文档
风险
```

再定义关系：

```text
客户 — 提出 → 需求
需求 — 来自 → 会议
会议 — 产出 → 决策
决策 — 影响 → 项目
项目 — 包含 → 产品
产品 — 拥有 → 卖点
产品 — 禁止 → 风险表述
文档 — 描述 → 产品
```

图谱应该建立在整理后的可信数据上，而不是从所有原始数据里硬抽。

---

## 4. 我们的总体架构

### 4.1 总体视图

```text
数据源
飞书 / 企业微信 / 本地文件 / 业务系统 / Agent 产物
        ↓
原始区 Raw
        ↓
处理区 Staging
        ↓
整理区 Curated
        ↓
资产注册中心 Asset Registry
        ↓
索引区 Index
 ├─ 向量索引
 ├─ 全文索引
 └─ 图谱索引
        ↓
Context API / Retrieval API
        ↓
NocoBase / 门户 / Agent
        ↓
审计 / 治理 / 反馈
```

---

### 4.2 核心模块

| 模块 | 职责 |
|---|---|
| 原始数据区 | 保存原始文件，不做修改 |
| 处理区 | 解析、OCR、清洗、结构化 |
| 整理区 | 人工确认后的可信知识 |
| 资产注册中心 | 统一 asset_id、状态、负责人、标签、权限 |
| 知识索引区 | 向量、全文、图谱索引 |
| Context API | 给 Agent 和门户提供受控访问 |
| Agent 层 | 基于授权资料完成任务 |
| 审计层 | 记录访问、修改、删除、引用 |
| 图谱层 | 表达实体、关系、业务对象 |

---

### 4.3 技术组件映射

| 能力 | 推荐组件 |
|---|---|
| 控制台 / 页面 | NocoBase，后期可换 Next.js 自建门户 |
| 资产元数据 | PostgreSQL |
| 文件存储 | MinIO / OSS / COS |
| 文档解析 | Docling / MinerU / Apache Tika / Unstructured |
| OCR | PaddleOCR / RapidOCR |
| 音频转写 | Whisper / faster-whisper |
| 异步任务 | Celery / RQ / BullMQ / Temporal |
| 向量检索 | PostgreSQL + pgvector，后期 Qdrant |
| 全文检索 | Meilisearch / OpenSearch |
| RAG 引擎 | RAGFlow 或自研检索服务 |
| LLM | DeepSeek |
| Embedding | BAAI/bge-m3 |
| 图谱 | PostgreSQL 关系表，后期 Neo4j |
| BI | Superset / Metabase |
| 可观测 | Langfuse / OpenTelemetry |

---

## 5. 数据生命周期

每份资产都会经历状态流转：

```text
Raw
 ↓
Parsed
 ↓
Cleaned
 ↓
Reviewed
 ↓
Approved
 ↓
Indexed
 ↓
Serving
 ↓
Deprecated / Archived
```

### 状态含义

| 状态 | 含义 | 是否可入知识库 |
|---|---|---|
| Raw | 原始资料刚上传 | 否 |
| Parsed | 已解析 / OCR / 转文本 | 否 |
| Cleaned | 已清洗、去噪、结构化 | 否 |
| Reviewed | 人工已检查 | 可选 |
| Approved | 已确认可作为正式知识 | 是 |
| Indexed | 已生成向量 / 全文索引 | 是 |
| Serving | 正在给 Agent / 检索使用 | 是 |
| Deprecated | 已过时，不再推荐 | 否 |
| Archived | 已归档 | 否 |

---

## 6. 存储分层

系统按生命周期分区：

```text
datahub/
  01_raw/
  02_staging/
  03_curated/
  04_index_input/
  05_agent_output/
  90_archive/
```

### `01_raw/`

放：

```text
原始 PDF
原始 Word
原始 Excel
图片
音频
视频
系统导出文件
```

特点：

- 不轻易修改。
- 是 Source of Truth。
- 保留 checksum、上传人、来源。

---

### `02_staging/`

放：

```text
解析后的 Markdown
OCR 结果
JSON 结构化数据
临时摘要
```

特点：

- 可以重新生成。
- 失败可以删除重跑。
- 不作为最终可信数据。

---

### `03_curated/`

放：

```text
已清洗产品资料
已确认会议纪要
已审核 SOP
已打标签客户需求
已结构化决策记录
```

特点：

- 人工确认或 AI 生成 + 人工确认。
- 有 Owner。
- 有标签。
- 可进入知识库。

---

### `04_index_input/`

放即将进入 RAG / 搜索索引的数据。

特点：

- 来自 `03_curated/`。
- 状态必须是 `Approved`。
- 可以删除后重建。

---

### `05_agent_output/`

放 Agent 生成的结果：

```text
报告
摘要
方案
知识卡片
图谱抽取草稿
```

特点：

- 先进入输出区。
- 人工确认后才能升级为正式资产。
- 不能直接覆盖原始资料。

---

## 7. 核心资产模型

### 7.1 `assets`

| 字段 | 说明 |
|---|---|
| `asset_id` | 全局唯一 ID |
| `title` | 名称 |
| `asset_type` | 文档 / 表格 / 图片 / 音频 / 视频等 |
| `business_line` | 所属业务线 |
| `project` | 所属项目 |
| `source_type` | 上传 / API / 同步 / Agent 生成 |
| `source_system` | 来源系统 |
| `source_uri` | 原始来源 |
| `raw_uri` | 原始文件位置 |
| `processed_uri` | 解析后位置 |
| `owner` | 负责人 |
| `tags` | 标签 |
| `status` | 生命周期状态 |
| `visibility` | 私有 / 团队 / 公司 |
| `review_status` | 待审核 / 已审核 / 驳回 |
| `index_status` | 未索引 / 索引中 / 已索引 / 失败 |
| `graph_status` | 未生成 / 生成中 / 已生成 |
| `version` | 版本 |
| `checksum` | 文件指纹 |
| `created_by` | 创建人 |
| `created_at` | 创建时间 |
| `updated_by` | 更新人 |
| `updated_at` | 更新时间 |
| `retention_policy` | 保留策略 |
| `deleted_at` | 删除时间 |

### 7.2 `files`

| 字段 | 说明 |
|---|---|
| `file_id` | 文件 ID |
| `asset_id` | 所属资产 |
| `file_name` | 文件名 |
| `file_type` | 类型 |
| `zone` | raw / staging / curated / output |
| `storage_path` | 存储路径 |
| `checksum` | 指纹 |
| `uploaded_by` | 上传人 |
| `uploaded_at` | 上传时间 |

### 7.3 `chunks`

| 字段 | 说明 |
|---|---|
| `chunk_id` | 切片 ID |
| `asset_id` | 所属资产 |
| `asset_version` | 资产版本 |
| `chunk_index` | 切片序号 |
| `text` | 原文 |
| `summary` | 摘要 |
| `embedding` | 向量 |
| `page` | 页码 |
| `section` | 章节 |
| `token_count` | Token 数 |

### 7.4 `relationships`

| 字段 | 说明 |
|---|---|
| `relation_id` | 关系 ID |
| `source_entity` | 起点 |
| `relation_type` | 关系类型 |
| `target_entity` | 终点 |
| `asset_id` | 依据资产 |
| `confidence` | 置信度 |
| `status` | 待确认 / 已确认 / 驳回 |

### 7.5 `audit_logs`

| 字段 | 说明 |
|---|---|
| `log_id` | 日志 ID |
| `asset_id` | 资产 ID |
| `actor` | 操作人 / Agent |
| `action` | read / update / delete / index / search |
| `before_state` | 操作前状态 |
| `after_state` | 操作后状态 |
| `reason` | 原因 |
| `created_at` | 时间 |

---

## 8. 权限与治理

### 8.1 基础角色

| 角色 | 权限 |
|---|---|
| 管理员 | 管理所有资产、用户、配置 |
| 业务负责人 | 管理本业务线资产 |
| 普通成员 | 查看被授权资产 |
| 审核员 | 审核、驳回、标记资料 |
| Agent | 只能访问被授权资产 |

### 8.2 Agent 访问原则

Agent 不直接访问数据库。

Agent 只能通过受控 API：

```text
search_assets()
read_asset()
create_asset()
update_asset()
propose_delete_asset()
generate_report()
```

第一阶段只开放：

```text
search_assets()
read_asset()
generate_report()
```

### 8.3 审计要求

所有关键动作必须记录：

```text
谁
什么时候
做了什么
依据是什么
状态从什么变成什么
结果是什么
```

---

## 9. 核心流程

### 9.1 上传流程

```text
用户上传文件
 ↓
写入 MinIO / 文件存储
 ↓
生成 checksum
 ↓
创建 asset_id
 ↓
状态：Raw
 ↓
投递解析任务
```

---

### 9.2 解析流程

```text
读取 raw 文件
 ↓
判断文件类型
 ↓
分发解析器
 ↓
生成 Markdown / JSON
 ↓
保存到 staging
 ↓
状态：Parsed
```

---

### 9.3 审核流程

```text
Cleaned 资产进入审核列表
 ↓
审核人检查标题、内容、标签、权限
 ↓
通过：Reviewed
 ↓
补充业务信息
 ↓
状态：Approved
 ↓
允许进入索引
```

---

### 9.4 索引流程

```text
Approved 资产
 ↓
切片
 ↓
调用 Embedding
 ↓
写入向量库
 ↓
写入全文索引
 ↓
更新状态：Indexed
```

---

### 9.5 检索流程

```text
用户提问
 ↓
权限检查
 ↓
Query 改写
 ↓
向量检索
 ↓
关键词检索
 ↓
结构化过滤
 ↓
Rerank
 ↓
返回 Top K
 ↓
LLM 根据引用生成答案
 ↓
返回答案 + asset_id + 文件名 + 更新时间
```

---

### 9.6 Agent 产出回流

```text
Agent 生成报告 / 摘要 / 方案
 ↓
进入 05_agent_output/
 ↓
人工审核
 ↓
确认后升级为正式资产
 ↓
必要时进入知识库
```

---

## 10. Context API

第一阶段只需要这些 API。

### 10.1 资产检索

```http
POST /api/v1/assets/search
```

输入：

```json
{
  "query": "妆舟有哪些业务线？",
  "filters": {
    "business_line": "妆舟",
    "status": ["Approved", "Indexed"]
  },
  "top_k": 10
}
```

输出：

```json
{
  "results": [
    {
      "asset_id": "ZZ-DOC-000001",
      "title": "妆舟核心业务线总览",
      "score": 0.86,
      "snippet": "妆舟包含公域内容、渠道分销、私域会员..."
    }
  ]
}
```

### 10.2 读取资产

```http
GET /api/v1/assets/{asset_id}
```

### 10.3 创建资产

```http
POST /api/v1/assets
```

### 10.4 更新状态

```http
PATCH /api/v1/assets/{asset_id}/status
```

### 10.5 同步到知识库

```http
POST /api/v1/assets/{asset_id}/sync/ragflow
```

### 10.6 检索问答

```http
POST /api/v1/ask
```

输出必须包含：

```json
{
  "answer": "...",
  "citations": [
    {
      "asset_id": "ZZ-DOC-000001",
      "title": "妆舟核心业务线总览",
      "snippet": "..."
    }
  ]
}
```

---

## 11. 为什么这样做更有效？

### 11.1 对人的价值

#### 11.1.1 找资料更快

以前：

```text
翻飞书群
问同事
找旧文件夹
打开多个版本
```

以后：

```text
搜索 / 提问
 ↓
返回答案
 ↓
看到来源文件
 ↓
确认 asset_id 和更新时间
```

#### 11.1.2 知道资料是否可信

每份资料有：

```text
负责人
状态
版本
审核记录
```

不再靠猜。

#### 11.1.3 管理员更容易治理

管理员可以看到：

```text
资产总数
未分类资料
过期资料
失败资料
权限异常
重复资产
```

#### 11.1.4 关键操作可审计

系统能回答：

```text
这份资料谁改过？
这个答案为什么引用它？
这个 Agent 是否有权访问？
这份文件什么时候变成 Approved？
```

---

### 11.2 对 AI 的价值

#### 11.2.1 减少幻觉

AI 不再靠模型记忆回答公司问题，而是先检索：

```text
用户问题
 ↓
检索相关 chunk
 ↓
LLM 根据 chunk 回答
 ↓
返回来源
```

---

#### 11.2.2 提高检索准确率

因为有：

```text
asset_id
业务线
标签
类型
状态
负责人
```

检索时可以过滤：

```text
业务线 = 妆舟
类型 = 产品资料
status = Approved
```

这比“把所有资料混在一起搜索”精准得多。

---

#### 11.2.3 避免 Agent 使用过期或未确认资料

只有：

```text
status = Approved
index_status = Indexed
```

的资产才会进入 AI 上下文。

这样 AI 不会引用：

```text
草稿
废弃文件
未审核记录
已归档旧版本
```

---

#### 11.2.4 Agent 可以安全扩展能力

第一阶段 Agent 只能：

```text
search_assets()
read_asset()
generate_report()
```

以后可以增加：

```text
create_asset()
update_asset()
propose_delete_asset()
generate_graph()
```

但因为每个动作都有：

```text
权限
状态
审计
人工确认
```

所以不会失控。

---

#### 11.2.5 AI 回答可以解释

每个回答都能带：

```json
{
  "answer": "...",
  "citations": [
    {
      "asset_id": "ZZ-DOC-000001",
      "title": "妆舟核心业务线总览",
      "source": "01_raw/妆舟核心业务线总览.md",
      "updated_at": "2026-09-23"
    }
  ]
}
```

这就是企业 AI 和普通聊天的区别。

---

## 12. 分阶段落地

### Phase 1：Asset Registry

目标：

```text
每份资料都有 asset_id。
```

工作：

1. 建 PostgreSQL 资产表。
2. 建 MinIO 存储结构。
3. 登记第一批资产。
4. 每个资产记录来源、负责人、状态、标签。

验收：

```text
能列出所有资产。
能根据 asset_id 查询资产。
能知道资产负责人和状态。
```

---

### Phase 2：解析 Worker

目标：

```text
自动解析常见资料。
```

支持：

```text
Markdown
Word
PDF
CSV
Excel
简单图片 OCR
```

输出：

```text
Markdown
JSON
Chunk
```

验收：

```text
20 个资产中至少 90% 解析成功。
解析结果可读。
失败资产有明确错误。
```

---

### Phase 3：人工审核

目标：

```text
确保进入知识库的资料可信。
```

工作：

1. 建审核页面。
2. 人工检查解析结果。
3. 补充标题、标签、业务线。
4. 状态变为 Approved。

验收：

```text
所有 Approved 资产都有 Owner。
所有 Approved 资产都有标签。
所有 Approved 资产都有审核记录。
```

---

### Phase 4：索引和检索

目标：

```text
Approved 资产可被语义 / 关键词检索。
```

工作：

1. Chunk 切分。
2. Embedding。
3. 写入向量库。
4. 写入全文索引。
5. 提供 search API。

验收：

```text
20 个真实问题能返回相关结果。
结果包含 asset_id 和标题。
无权限资产不会返回。
```

---

### Phase 5：Agent 接入

目标：

```text
Agent 基于授权资料回答。
```

工作：

1. 建 Context API。
2. Agent 通过 API 检索资产。
3. 回答带引用。
4. 记录 Agent 查询日志。

验收：

```text
Agent 不能访问未授权资产。
回答必须带来源。
问答链路稳定。
```

---

### Phase 6：图谱和治理

目标：

```text
建立核心实体关系。
```

工作：

1. 定义实体：业务线、模块、负责人、产品、客户、文档、决策。
2. 定义关系：包含、负责、提出、影响、描述、来源。
3. 人工整理第一版关系。
4. 后续再用 AI 抽取。

验收：

```text
能回答关系型问题：
这个决策来自哪次会议？
这个客户关联哪些项目？
这个产品由谁负责？
```

---

## 13. 第一版不要做的事

第一阶段明确不做：

```text
1. 不接全公司所有数据源。
2. 不做完整数据仓库。
3. 不做字段级权限。
4. 不做复杂血缘。
5. 不做大规模 BI。
6. 不做自动知识图谱。
7. 不做垂直模型。
8. 不做复杂审批流。
9. 不让 Agent 直接写业务数据库。
10. 不把所有资料无脑塞进 RAG。
```

---

## 14. 与 RAGFlow 的关系

RAGFlow 可以继续使用，但定位要清楚。

### RAGFlow 适合做

```text
PDF / Word / PPT / Excel 解析
Chunk 切分
Embedding 编排
向量 / 全文检索
引用回答
知识库问答
```

### RAGFlow 不适合作为

```text
唯一原始数据存储
企业权限中心
资产生命周期中心
最终门户
数据中台本体
```

### 正确关系

```text
NocoBase / Context API = 资产控制台
PostgreSQL = 资产账本
MinIO = 文件中心
RAGFlow = 知识索引引擎
DeepSeek = 回答生成
BAAI/bge-m3 = Embedding
```

---

## 15. 与国际主流平台的对应关系

| 行业体系 | 我们对应的能力 |
|---|---|
| Databricks Lakehouse | Raw / Curated / Serving 分层 |
| Microsoft Fabric + OneLake | 统一数据存储与工作负载 |
| Microsoft Purview | 权限、治理、血缘 |
| Google Dataplex | 数据资产目录 |
| Google Vertex AI Search | 权限感知 RAG / 检索 |
| Palantir Foundry Ontology | 业务对象、关系、决策、行动 |
| Glean | 企业搜索 + Work AI |
| OpenMetadata / DataHub | 资产目录、Owner、Tag、Lineage |
| RAGFlow | 文档解析、RAG、引用回答 |
| Neo4j | 图谱层 |
| Superset | BI 层 |

---

## 16. 产品页面规划

### 16.1 总览

显示：

```text
资产总数
待处理
已审核
已入知识库
失败数量
最近上传
最近异常
```

### 16.2 资产列表

支持筛选：

```text
业务线
类型
标签
负责人
状态
是否已入知识库
```

### 16.3 资产详情

显示：

```text
基本信息
原始文件
处理文件
标签
权限
状态
版本
审核记录
索引记录
引用关系
操作日志
```

### 16.4 知识库状态

显示：

```text
未同步
同步中
已同步
同步失败
Chunk 数量
最近索引时间
```

### 16.5 审核中心

显示：

```text
待审核资产
已通过资产
已驳回资产
审核意见
```

### 16.6 检索测试

支持输入问题，返回：

```text
答案
命中 chunk
asset_id
文件名
score
```

---

## 17. 当前状态

### 已完成

```text
NocoBase 本地底座已部署。
PostgreSQL 已配置。
RAGFlow 已完成第一轮试验。
妆舟模拟资料包已生成。
数据中台架构文档已整理。
```

### 当前状态

```text
RAGFlow：已停止，配置和数据保留。
NocoBase：本地运行中。
妆舟知识包：已生成，待导入。
Asset Registry：待在 NocoBase 中建模。
```

---

## 18. 下一步

### 第一步：初始化 NocoBase

打开：

```text
http://127.0.0.1:13000
```

初始化管理员账号。

---

### 第二步：创建核心表

先建：

```text
business_lines
tags
assets
files
review_logs
ragflow_documents
```

---

### 第三步：创建基础页面

页面：

```text
总览
资产列表
资产详情
文件中心
知识库状态
审核记录
设置
```

---

### 第四步：导入妆舟模拟资产

先把 20 个模拟文件登记成资产。

---

### 第五步：接入 RAGFlow

只同步状态为 `Approved` 的资产。

---

### 第六步：做检索测试

用这些问题测：

```text
妆舟是做什么的？
妆舟有哪些业务线？
草沐知摇摇水的核心卖点是什么？
哪些功效不能随便说？
内容生产流程是什么？
渠道分销第一版怎么处理订单？
私域发送客户前要注意什么？
库存看板应该有哪些字段？
AI 不能直接做什么？
```

---

## 19. 风险与原则

### 不要一开始接全部数据

先选一个业务线 / 项目。

---

### 不要把敏感资料直接给云模型

客户个人信息、财务数据、合同条款需要先脱敏或单独权限处理。

---

### 不要让 Agent 直接写业务库

Agent 产物先进入输出区，人工确认后再升级。

---

### 不要频繁更换 Embedding 模型

Embedding 模型变化通常需要重新向量化。

---

### 不要只看答案，不看引用

没有引用的答案不能作为企业决策依据。

---

## 20. 一句话总结

> 我们要做的不是“一个更大的 RAGFlow”，而是企业级 Context Plane。  
> 先用最小闭环管理资产、权限、状态、来源和检索，  
> 再逐步长出知识图谱、Agent、BI 和完整数据中台。
