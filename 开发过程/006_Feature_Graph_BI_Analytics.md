# 006 Feature / Graph BI Analytics

## 背景

DataHub 第 1-6 期已经有资产、解析、审核、检索与 Agent 基础链路。第 7 阶段要把散落在文档里的业务对象、关系和运行指标变成可查询的图谱与 BI 读模型，供总览、图谱和数据分析页面使用。

## 关键决策及理由

1. 图谱来源追溯使用独立的 `graph_asset_links` 表，而不是只在关系表上保留一个 `asset_id`。
   - 一个实体或关系通常来自多份资产。
   - 独立链接表可以保存多个来源、顺序、证据文本和评分。
   - 旧字段 `Relationship.asset_id` 继续保留，用于兼容原型数据和旧前端。
2. 实体保留 `source_asset_id` 作为首个主来源，同时接口返回完整 `asset_ids`。
   - 兼容只关心“主来源”的页面。
   - Agent 和审计仍可追溯完整来源。
3. 关系状态与置信度保留在 `relationships` 表。
   - `status` 表示人审/治理状态：confirmed、candidate、rejected、archived。
   - `confidence` 表示机器抽取或人工评分的置信度，范围限定 0 到 1。
4. BI 做实时读模型，不额外造一套演示表。
   - 数据直接来自 Asset、ProcessingJob、ReviewLog、IndexRecord、AgentLog、AuditLog。
   - 空库返回 0；比例类指标在分母为 0 时返回 `null`，避免误导。
5. 代码收敛到 `app/routers` 与 `app/services`。
   - Router 只负责协议、鉴权、状态码。
   - Service 负责业务规则、过滤、追溯和聚合。
   - 前端可以继续按 API contract 演进，不耦合底层表。

## 否掉的备选

- 只扩展一个 `asset_id` 字段：无法表达多来源证据，后续治理会再次改表。
- BI 预先写日报表：当前演示与内测数据量小，实时聚合更简单；后续数据量上来再加物化表。
- 用假数据填充指标：不可验收，也会让客户误判系统状态。

## 交付范围

- `GET /api/v1/graph/query`
- 实体与关系 CRUD 子集：创建、列表、详情、状态/置信度/来源更新
- 多来源追溯：`asset_ids`、`sources`
- BI：总量趋势、状态分布、业务线分布、解析成功率、审核效率、索引失败率、检索命中率、问答次数、Agent 使用次数、引用覆盖率、越权访问次数
- Graph / BI OpenAPI 挂载到 `/api/v1` 和兼容的 `/api`

## 测试结果

```text
cd server
python3 -m pytest -q
......
6 passed in <1s
```

覆盖：

- 来源资产校验、实体创建、关系创建。
- 多来源追溯、关系状态更新、置信度更新。
- 业务线、实体类型、关系状态、资产 ID 查询。
- BI 趋势、分布、解析、审核、索引、检索、Agent、总览 API。
- 非法来源资产与非法置信度拒绝。
