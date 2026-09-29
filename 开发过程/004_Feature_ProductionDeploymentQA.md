# 004 · 生产部署与 QA 骨架

## 背景

第 1-6 期业务链路已有可演示版本，但需要给客户统一验收：资产、解析、审核、索引、检索、问答、Agent、图谱、BI、权限、部署和备份都要能说明边界。

## 关键决策

1. **PostgreSQL 继续作为治理源**：资产状态、审核、图谱、审计必须有事务和关系约束。
2. **MinIO / OSS 使用 S3 兼容 adapter**：本地演示用 MinIO，生产可切 OSS / COS，避免绑定云厂商。
3. **API 与 Worker 分离部署**：小文件演示仍可同步解析；生产 Worker 承担失败任务重试，后续再替换为完整队列。
4. **Nginx 只暴露一个入口**：HTTP / HTTPS、上传体积、代理头和安全响应头集中治理。
5. **生产 secret 不给默认值**：Compose 使用 required 变量，Backend 启动时再次拒绝弱密码。
6. **备份覆盖两类状态**：PostgreSQL 保存元数据，对象存储保存原始与处理文件，二者必须一起备份。
7. **测试覆盖拒绝路径**：不只测“能跑通”，也测 Member 越权、跨业务线访问、未审核 Agent 读取被拒绝。

## 否掉的备选

- **只用 SQLite 交付**：无法满足生产并发、权限治理和备份恢复要求。
- **继续把 RAGFlow 当主底座**：解析强但控制和业务模型不足，当前只适合后续作为检索 / 解析引擎接入。
- **使用默认 admin 密码**：演示方便但会进入客户环境，风险过高。
- **只写部署文档不写测试**：无法防止后续 UI / API 改动破坏状态机。

## 测试结果

```text
python3 -m pytest -q server/tests
9 passed

docker compose config
PASS

nginx -t（HTTP / HTTPS）
PASS

bash -n backup.sh restore.sh
PASS

docker build -t datahub-core:acceptance server
PASS
```

详细 curl 与验收标准见 `docs/2026-09-24_DataHub_1-6期验收报告.md`。

## 当前边界

- Worker 还不是分布式任务队列。
- 对象存储 adapter 已实现，但未做外部云 bucket 端到端演练。
- HTTPS 配置已验证，正式域名证书待部署。
- 检索仍以内置词法索引为主。
- 图谱是 PostgreSQL 治理模型，不是图数据库生产形态。
