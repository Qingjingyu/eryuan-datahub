# 004 Feature：Retrieval / Ask / Agent API

## 背景

DataHub 需要给前端、BI、知识图谱和外部 Agent 提供统一的知识检索入口。检索入口必须先做权限和审核状态过滤，再进入排序和回答生成，避免未审核、无权限或已归档内容泄漏到业务上下文。

## 关键决策

1. **统一走 `search_service`**
   - `/api/v1/search`、`/api/v1/ask`、Agent 工具全部复用同一套可见资产查询和排序逻辑。
   - 收益是权限边界、审核边界和引用格式不会因为入口不同而分叉。

2. **混合检索，语义能力可选**
   - 默认使用关键词倒排式评分、标题加权、片段定位和 lexical rerank。
   - 配置 `DATAHUB_EMBEDDING_API_KEY` 后，可接入 OpenAI-compatible Embedding 服务，当前按 `lexical 72% + semantic 28%` rerank。
   - Embedding 服务不可用时自动降级为 lexical，不影响检索可用性。

3. **强制审核与权限门槛**
   - 只有 `review_status = approved`、`status ∈ {approved, indexed, serving}` 且未软删除的资产可进入检索。
   - 非 admin 用户只能访问 public、自己 owner 的资产，或同业务线 business 资产。
   - Agent `read_asset` 复用同一权限规则。

4. **引用完整性**
   - Ask 和 Agent 检索类结果的 citation 必须包含：
     - `asset_id`
     - `title`
     - `snippet`
     - `version`
     - `updated_at`
   - Ask 首条命中会累计 `call_count`，便于后续统计资产被调用价值。

5. **Agent 调用留痕**
   - `search_assets`、`read_asset`、`generate_report` 的成功与失败都写 `agent_logs`。
   - 普通 Agent 用户只能查看自己的调用日志，admin 可查看全部。

## 接口

- `POST /api/v1/search`
- `POST /api/v1/ask`
- `POST /api/v1/agent/search`
- `POST /api/v1/agent/read`
- `POST /api/v1/agent/report`
- `POST /api/v1/agent/execute`
- `GET  /api/v1/agent/logs`

为兼容旧前端，同一批 router 也挂在 `/api` 前缀下。

## 否掉的备选

- **Ask 内单独实现一套检索**：否决。会造成审核、权限、引用字段和排序逻辑漂移。
- **无 Embedding 时返回错误**：否决。关键词检索应始终可用，语义只作为可选增强。
- **Agent 失败不写日志**：否决。失败调用对安全和排查同样重要。

## 测试结果

```bash
cd server
pytest -q
# 6 passed
```

专项覆盖：

- `tests/test_retrieval_agent.py::test_v1_search_permissions_and_citation_integrity`
  - 同业务线已审核资产可见。
  - 其他业务线资产不可见。
  - 未审核、已归档资产不可见。
  - citation 必填字段完整。

- `tests/test_retrieval_agent.py::test_v1_ask_requires_complete_citations`
  - Ask 返回完整 citation。
  - 未审核和已归档资产不进入回答上下文。

- `tests/test_retrieval_agent.py::test_agent_read_filters_unapproved_and_unauthorized_assets`
  - 已审核且有权访问的资产可读。
  - 无权限资产返回 403。
  - 未审核资产返回 403。
  - 调用记录写入 agent logs。
