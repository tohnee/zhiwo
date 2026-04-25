# KnowledgeOS MVP

基于 `产品设计.md`、`monorepo拆解.md`、`UI设计参考.md` 构建的可运行 MVP。

## MVP 范围

- 三栏式工作台：`Sources`、`Workspace`、`AI Debug`
- `Workspace` 提供 `Graph`、`Editor`、`Chat` 三个视图
- `api-gateway` 提供 `health`、`dashboard`、`ingest`、`chat` 接口
- `services/*` 和 `packages/shared` 预留后续微服务拆分边界

## 目录

- `apps/web`: React + Vite 三栏工作台
- `apps/api-gateway`: Node API Gateway
- `services/*`: 未来拆分服务的职责边界
- `packages/shared`: 共享能力预留
- `infra/docker`: Docker Compose 配置

## 启动

### 安装依赖

```bash
pnpm install
```

### 配置环境

```bash
cp .env.example .env.local
```

- `DEEPSEEK_API_KEY`: 用于启用真实 DeepSeek Chat Completions。
- `DEEPSEEK_MODEL`: 默认是 `deepseek-v4-pro`。
- `NEO4J_URI`、`NEO4J_USERNAME`、`NEO4J_PASSWORD`: 用于启用 Neo4j 持久化。
- 未配置时：
  `agent-service` 会回退到 deterministic summary，
  `graph-service` 会回退到内存模式。

### 启动 API

```bash
pnpm dev:api
```

### 启动 Web

```bash
pnpm --filter web dev --host 0.0.0.0
```

## 验证

```bash
node --test services/ingestion-service/src/index.test.js
node --test services/graph-service/src/index.test.js
node --test services/agent-service/src/index.test.js
node --test apps/api-gateway/src/server.test.js
pnpm test:web
pnpm build:web
```

## 说明

- 当前 `api-gateway` 采用 Node 实现，是因为本机 `Python 3.14` 对 FastAPI 依赖链安装存在兼容阻塞；文档本身允许 `FastAPI / Node` 二选一，因此首版优先保证 MVP 可运行。
- `infra/docker/docker-compose.yml` 已提供编排文件，但当前机器未安装 `docker`，因此未执行容器级验证。
- `agent-service` 现已支持真实 DeepSeek live 模式；当 `DEEPSEEK_API_KEY` 存在时，会调用 DeepSeek Chat Completions API。
- `Editor` 的 block 保存与 `Graph` 节点详情查询现已通过 `api-gateway -> graph-service` 链路落到 Neo4j 适配层；若 Neo4j 不可用则回退到内存存储。
