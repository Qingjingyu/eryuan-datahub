# DataHub 第 1-6 期总执行 Spec

## 目标
一次性交付第 1-6 期验收版 DataHub，形成统一前端、统一 Core API、统一 PostgreSQL 数据源、统一文件存储、统一解析/审核/检索/问答/Agent/图谱/BI/审计链路。

## 总体架构
```text
Web Frontend
  ↓
DataHub Core API
  ↓
PostgreSQL + Object Storage
  ↓
Parser Worker + Indexer + Retrieval + Graph + Agent
  ↓
BI / Audit / Settings
```

## 产品原则
- 中文优先，技术术语保留英文。
- 状态、颜色、图标、组件统一。
- 所有资产有 asset_id、版本、状态、负责人、业务线、标签。
- 只有 Approved 资产可索引。
- 所有 AI 答案必须带引用。
- Agent 只能使用受控 API，不直连数据库。
- 每个关键动作必须审计。

## 页面结构
1. 总览
2. 数据目录
3. 原始数据
4. 解析与清洗
5. 审核中心
6. 知识服务
7. 知识检索
8. Agent 助手
9. 知识图谱
10. 数据分析
11. 系统设置
12. 关于 / 设计原理

## 核心状态
Raw → Parsed → Cleaned → Waiting Review → Approved → Indexed → Serving → Deprecated / Archived

## 验收
- 20 个资产可上传/登记/处理/审核/索引。
- 解析成功率 ≥ 90%。
- 检索 Top5 命中率 ≥ 90%。
- 回答引用覆盖率 100%。
- 未授权访问 0 次。
- 关键操作审计覆盖率 100%。
