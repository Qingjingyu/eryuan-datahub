# 010 · DataHub 生产部署：<production-host>

## 背景

将 DataHub 第 1-6 期验收版部署到腾讯云轻量服务器 `<production-host>`。服务器实例为：

- 区域：`ap-guangzhou`
- 实例：`<production-instance-id>`
- 名称：`<production-instance-name>`
- 系统：Ubuntu Server 24.04 LTS
- 规格：2C4G / 60G SSD
- 已有服务：宿主机 Nginx 占用 `80 / 443`，不能复用或覆盖

## 部署原则

1. 不影响已有 `<production-instance-name>` 服务。
2. 不占用宿主机 `80 / 443`。
3. DataHub Compose Nginx 独立监听 `13001`。
4. PostgreSQL、MinIO、API、Worker、DataHub Nginx 全部由 Docker 管理。
5. 生产密钥只在服务器 `/opt/datahub/infra/.env`，不写入压缩包。

## 关键操作

1. 通过腾讯云 API 确认实例。
2. 通过腾讯云自动化助手追加专用部署公钥。
3. 腾讯防火墙放行 `TCP/13001`。
4. 安装 Docker 与 Docker Compose v2。
5. 上传干净部署文件到 `/opt/datahub`。
6. 生成强随机 `DATAHUB_SECRET`、管理员密码、PostgreSQL 密码、MinIO 凭据。
7. 配置 Docker Registry 镜像加速和腾讯 PyPI 镜像。
8. 启动：

```bash
cd /opt/datahub/infra
docker compose -f docker-compose.prod.yml up -d
```

## 部署中修复的问题

### 1. Docker Hub 超时

腾讯云访问 Docker Hub 初始超时。已在服务器 `/etc/docker/daemon.json` 配置镜像加速：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
```

### 2. `minio/mc` 旧标签 403

`minio/mc:RELEASE.2024-11-05T11-29-47Z` 在当前镜像源不可拉取。  
服务器环境使用 `MINIO_MC_IMAGE=minio/mc:latest`。  
Compose 已改为：

```yaml
image: ${MINIO_MC_IMAGE:-minio/mc:RELEASE.2024-11-05T11-29-47Z}
```

### 3. PyPI 下载慢

Dockerfile 增加：

```dockerfile
ARG PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
```

生产 `.env` 使用：

```text
PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
```

### 4. 存储后端别名

生产模板使用 `DATAHUB_STORAGE_BACKEND=s3`，但代码原先只接受 `local / minio / oss / cos`。  
已修改 `server/app/services/storage.py`，将 `s3` 加入合法后端别名，语义仍走 S3-compatible adapter。

### 5. MinIO 应用凭据

MinIO 初始只有 root 凭据，应用使用独立随机 key 会报 `InvalidAccessKeyId`。  
当前生产配置中，`DATAHUB_S3_ACCESS_KEY` / `DATAHUB_S3_SECRET_KEY` 已与 MinIO root 凭据对齐。  
后续如需最小权限，应创建独立 MinIO service account，再替换应用密钥。

## 访问信息

- 控制台：`http://<production-host>:13001`
- 健康检查：`http://<production-host>:13001/api/health`
- 就绪检查：`http://<production-host>:13001/api/health/ready`
- 初始账号：`admin`
- 初始密码：本次部署时已单独交付，不在本文档明文展示。

服务器路径：

```text
/opt/datahub
/opt/datahub/infra/.env
```

## 验收结果

公网验收：

```text
GET /api/health        -> 200 OK
GET /api/health/ready  -> 200 OK
GET /                  -> 200 OK
POST /api/v1/auth/login -> 200 OK
GET /api/v1/bi/metrics  -> 200 OK
GET /api/v1/assets      -> 200 OK
```

容器状态：

```text
postgres   healthy
minio      healthy
backend    healthy
worker     healthy
nginx      running
```

真实浏览器验收：

- 登录成功。
- 总览页打开。
- 知识图谱页打开。
- 初始种子图谱显示 5 个实体、4 条关系。
- 浏览器 page error / console error 均为 0。

## 当前数据状态

部署完成后已导入历史模拟演示数据：

- 资产总数：184
- 知识片段：185
- 早期文档资产：20
- 妆舟业务模拟资产：164
- 图谱实体：53
- 图谱关系：64
- 图谱来源资产：48
- 检索测试：查询“妆舟”返回 10 条结果
- 真实上传文件：早期 20 份原始文档均已通过 API 写入 MinIO

当前数据仍定位为演示数据，不含真实客户个人信息、合同、价格条款或账号凭证。

## 后续待办

1. 绑定域名并配置 HTTPS。
2. 开启备份 cron，并做一次恢复演练。
3. 建立最小权限业务账号。
4. 上传第一批真实资料。
5. 调整服务器监控和告警。
6. 如对外开放，建议增加 IP 白名单、WAF 或 VPN。
