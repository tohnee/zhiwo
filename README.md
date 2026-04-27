# zhiwo

`zhiwo` 是一个 **AI-native 知识工作台（KnowledgeOS）** 的可运行 monorepo。
它围绕“多源信息接入 -> 结构化图谱 -> 可调试推理 -> 报告产出”主链路构建，目标是让研究/决策过程可追溯、可重算、可复用。

---

## 1. 项目目标

- 建立一个本地可运行的知识操作系统 MVP。
- 提供三栏式工作台（Sources / Workspace / AI Debug）和 notebook 风格体验。
- 支持 connector 同步、图谱摘要、冲突与时间线、参数化 rerun、产物生成与导出。
- 为后续拆分微服务与生产部署保留边界（`apps/` + `services/` + `packages/`）。

---

## 2. 功能总览

### 2.1 前端工作台（`apps/web`）

- Notebook library 入口与 workspace 工作区。
- Workspace 内含：
  - `Graph`：图谱节点浏览与详情查询。
  - `Editor`：笔记块编辑、保存与回读。
  - `Chat`：基于图谱与来源的问答。
- 右侧 AI Debug 区可查看/调节参数，支持 rerun 与 diff 审计。
- 支持 connector sync、IM ingest、报告/PPT 生成触发。

### 2.2 API Gateway（`apps/api-gateway`）

- 提供统一 HTTP 接口，聚合 ingestion / graph / agent 三类服务。
- 支持 `x-request-id` 请求追踪和结构化日志。
- 核心接口覆盖：
  - `/health`
  - `/api/dashboard`
  - `/api/connectors/catalog`
  - `/api/connectors/sync`
  - `/api/ingest`、`/api/ingest/im-event`
  - `/api/chat`、`/api/chat/rerun`
  - `/api/debug/*`（runs / baseline / diff）
  - `/api/generate/*`（markdown / ppt / export）

### 2.3 服务层（`services/*`）

- `ingestion-service`
  - connector 框架与多 connector（feishu / youtube / wechat / web）
  - sync 编排、dry-run、ready/degraded 诊断
  - IM 队列与 ingestion event 处理
- `graph-service`
  - GraphRAG v2 schema
  - entities / relations / timeline / conflicts
  - 内存模式与 Neo4j 模式兼容
- `agent-service`
  - 参数化运行（retrievalTopK / temperature / forceLive 等）
  - rerun/replay、多轮检索-批判流程
  - markdown/ppt/export 产物生成

---

## 3. 仓库结构

```text
.
├─ apps/
│  ├─ web/                # React + Vite 前端
│  └─ api-gateway/        # Node HTTP API 网关
├─ services/
│  ├─ ingestion-service/
│  ├─ graph-service/
│  └─ agent-service/
├─ packages/
│  └─ shared/             # 共享类型与工厂
├─ scripts/               # bootstrap / check / release / health 等脚本
├─ docs/                  # 部署、评审、流程与运行文档
├─ artifacts/             # 本地生成的检查与发布产物
└─ infra/docker/          # compose 配置
```

---

## 4. 环境要求

- Node.js `22+`
- pnpm `10+`
- 可选：Docker / Docker Compose（容器化验证）
- 可选：Neo4j（启用持久化图存储）
- 可选：DeepSeek API Key（启用 live LLM）

---

## 5. 快速开始

### 5.1 一键初始化（推荐）

```bash
bash scripts/bootstrap.sh
# 或
make setup
```

### 5.2 安装依赖

```bash
pnpm install
```

### 5.3 配置环境变量

```bash
cp .env.example .env.local
```

关键变量说明：

- `DEEPSEEK_API_KEY`：启用 DeepSeek live 模式。
- `DEEPSEEK_MODEL`：模型名（默认 `deepseek-v4-pro`）。
- `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD`：启用 Neo4j 存储。

降级行为：

- 未配置 LLM key 时，`agent-service` 使用 deterministic fallback。
- Neo4j 不可用时，`graph-service` 回退到内存模式。

### 5.4 启动服务

```bash
# 启动 API（默认端口 3000）
pnpm dev:api

# 启动 Web（默认端口 5173）
pnpm --filter web dev --host 0.0.0.0
```

---

## 6. 常用命令

```bash
make check          # 服务测试 + Web 测试 + Web 构建
make env-validate   # 校验 .env.local
make env-report     # 生成 artifacts/env-report.{json,md}
make preflight      # 发布前检查，生成 artifacts/release-preflight-report.md
make release-drill  # 发布演练，生成 docs/reviews/release-drill-YYYY-MM-DD.md
make health         # 运行时健康检查（API/Web/Neo4j）
make up             # docker compose 启动（环境支持时）
make down           # docker compose 停止
```

---

## 7. 质量保障与测试

### 7.1 一体化校验

```bash
make check
```

执行内容：

1. Node 服务测试
   - `services/ingestion-service/src/index.test.js`
   - `services/graph-service/src/index.test.js`
   - `services/agent-service/src/index.test.js`
   - `apps/api-gateway/src/server.test.js`
2. Web 测试
   - `pnpm test:web`
3. Web 构建
   - `pnpm build:web`

### 7.2 发布与运行检查

```bash
make preflight
make release-drill
make health
```

产物位置：

- `artifacts/release-preflight-report.md`
- `docs/reviews/release-drill-YYYY-MM-DD.md`

---

## 8. API 快速示例

### 8.1 健康检查

```bash
curl -s http://127.0.0.1:3000/health | jq
```

### 8.2 获取 dashboard

```bash
curl -s http://127.0.0.1:3000/api/dashboard | jq
```

### 8.3 触发 connector 同步（dry-run）

```bash
curl -s -X POST http://127.0.0.1:3000/api/connectors/sync \
  -H 'content-type: application/json' \
  -d '{"connector":"web","limit":20,"dryRun":true}' | jq
```

### 8.4 参数化 rerun

```bash
curl -s -X POST http://127.0.0.1:3000/api/chat/rerun \
  -H 'content-type: application/json' \
  -d '{"prompt":"Summarize key conflicts","parameters":{"retrievalTopK":5,"temperature":0.1}}' | jq
```

---

## 9. 部署与生产最小建议

- 参见 `docs/production-minimum.md`。
- Nginx 反向代理示例见 `docs/deploy/nginx.conf.example`。
- 建议在生产启用：HTTPS、请求日志、访问控制、密钥轮换。

---

## 10. 文档导航

- 全量安装运行与 NotebookLM 对比：
  - `docs/knowledgeos-install-run-test-manual-and-notebooklm-comparison.md`
- 发布流程：
  - `RELEASE.md`
- 分支保护建议：
  - `docs/branch-protection.md`
- 近期评审记录：
  - `docs/reviews/`

---

## 11. 当前状态与已知说明

- API Gateway 当前采用 Node 实现（优先保证 MVP 可运行）。
- Neo4j / DeepSeek 都支持“可选接入 + 缺省降级”。
- 本仓库已包含 CI、测试、预发布检查和发布演练脚本，可作为后续 sprint 持续迭代基线。

