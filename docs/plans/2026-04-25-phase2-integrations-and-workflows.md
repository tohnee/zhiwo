# Phase 2 Integrations And Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前 MVP 从单文件 mock 演进为带真实 RSS/PDF/Neo4j 链路、可拆分服务边界、可编辑文档与真实工作流适配层的第二阶段版本。

**Architecture:** 保持 `apps/api-gateway` 作为统一入口，但把业务逻辑下沉到 `services/ingestion-service`、`services/graph-service`、`services/agent-service` 与 `packages/shared`。其中 `RSS + PDF + Neo4j` 走真实接入，`Telegram + Planner/Retriever/Critic` 提供真实接口兼容的实现，并在缺失凭据或模型时自动降级。

**Tech Stack:** Node.js、React、Vite、Vitest、Neo4j JavaScript Driver、原生 `fetch`、本地文件解析、环境变量配置。

---

### Task 1: 建立共享 schema 与配置层

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/types.js`
- Create: `packages/shared/src/env.js`
- Create: `packages/shared/src/index.js`
- Modify: `pnpm-workspace.yaml`
- Test: `apps/api-gateway/src/server.test.js`

**Step 1: Write the failing test**

- 在 `server.test.js` 中添加对结构化 dashboard 数据字段的更严格断言，要求响应包含 source type、node metadata、editor block id 等共享字段。

**Step 2: Run test to verify it fails**

Run: `node --test apps/api-gateway/src/server.test.js`
Expected: FAIL because current payload shape is too loose and missing new fields.

**Step 3: Write minimal implementation**

- 创建 `packages/shared` 导出的 schema helper 与环境变量读取函数。
- 让 API 与前端统一消费这些字段。

**Step 4: Run test to verify it passes**

Run: `node --test apps/api-gateway/src/server.test.js`
Expected: PASS

### Task 2: 拆分 ingestion service 并接入真实 RSS/PDF

**Files:**
- Create: `services/ingestion-service/package.json`
- Create: `services/ingestion-service/src/rss.js`
- Create: `services/ingestion-service/src/pdf.js`
- Create: `services/ingestion-service/src/telegram.js`
- Create: `services/ingestion-service/src/index.js`
- Modify: `apps/api-gateway/src/server.js`
- Test: `services/ingestion-service/src/index.test.js`

**Step 1: Write the failing test**

- 为 RSS feed 拉取、PDF 本地解析、Telegram 降级状态编写测试。

**Step 2: Run test to verify it fails**

Run: `node --test services/ingestion-service/src/index.test.js`
Expected: FAIL because service does not exist.

**Step 3: Write minimal implementation**

- RSS: 支持真实 URL 拉取并解析基础条目。
- PDF: 支持扫描本地目录中的 `.pdf` 文件并生成文档摘要元数据。
- Telegram: 支持读取环境变量；缺失时返回 `degraded` 状态与说明。

**Step 4: Run test to verify it passes**

Run: `node --test services/ingestion-service/src/index.test.js`
Expected: PASS

### Task 3: 落 graph service 并接入 Neo4j

**Files:**
- Create: `services/graph-service/package.json`
- Create: `services/graph-service/src/neo4j.js`
- Create: `services/graph-service/src/index.js`
- Modify: `apps/api-gateway/src/server.js`
- Test: `services/graph-service/src/index.test.js`

**Step 1: Write the failing test**

- 编写测试覆盖 graph summary 构建、Neo4j 不可用时的降级、内存 fallback。

**Step 2: Run test to verify it fails**

Run: `node --test services/graph-service/src/index.test.js`
Expected: FAIL because graph service does not exist.

**Step 3: Write minimal implementation**

- 若 `NEO4J_URI` 等环境变量存在则尝试真实连接。
- 若连接不可用则保留内存 graph store，并明确返回 `storageMode`。

**Step 4: Run test to verify it passes**

Run: `node --test services/graph-service/src/index.test.js`
Expected: PASS

### Task 4: 拆分 agent service 并实现 Planner/Retriever/Critic

**Files:**
- Create: `services/agent-service/package.json`
- Create: `services/agent-service/src/planner.js`
- Create: `services/agent-service/src/retriever.js`
- Create: `services/agent-service/src/critic.js`
- Create: `services/agent-service/src/index.js`
- Modify: `apps/api-gateway/src/server.js`
- Test: `services/agent-service/src/index.test.js`

**Step 1: Write the failing test**

- 为工作流步骤顺序、引用 graph 证据、无 LLM 时降级响应编写测试。

**Step 2: Run test to verify it fails**

Run: `node --test services/agent-service/src/index.test.js`
Expected: FAIL because agent workflow service does not exist.

**Step 3: Write minimal implementation**

- Planner: 拆解 prompt 与意图。
- Retriever: 调 graph service 和 ingestion 结果。
- Critic: 检查证据与响应完整性。
- 若无真实 LLM 配置，则返回 deterministic grounded summary。

**Step 4: Run test to verify it passes**

Run: `node --test services/agent-service/src/index.test.js`
Expected: PASS

### Task 5: 增强 API Gateway 并完成服务编排

**Files:**
- Modify: `apps/api-gateway/src/server.js`
- Test: `apps/api-gateway/src/server.test.js`

**Step 1: Write the failing test**

- 为 dashboard 聚合、ingest refresh、chat workflow、editor update、graph node select 增加集成测试。

**Step 2: Run test to verify it fails**

Run: `node --test apps/api-gateway/src/server.test.js`
Expected: FAIL because the routes and payloads are not wired to services yet.

**Step 3: Write minimal implementation**

- 让 API Gateway 调用 ingestion/graph/agent services。
- 新增 editor 与 graph interaction 相关接口。

**Step 4: Run test to verify it passes**

Run: `node --test apps/api-gateway/src/server.test.js`
Expected: PASS

### Task 6: 增强前端 Document Editor 与 Graph 交互

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/data/mock.ts`
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/web/src/lib/api.test.ts`

**Step 1: Write the failing test**

- 为 editor block 编辑、保存、graph node 选中详情、source 状态展示增加测试。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run`
Expected: FAIL because UI is read-only.

**Step 3: Write minimal implementation**

- editor block 支持新增、编辑、保存。
- graph node 支持选中后在右侧或中部展示详情。
- UI 显示 source connector 的真实/降级状态。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run`
Expected: PASS

### Task 7: 文档、验证与交付

**Files:**
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: Update docs**

- 写清楚 `.env`、RSS、PDF、Telegram、Neo4j 的配置方式与降级行为。

**Step 2: Run verification**

Run:
- `node --test services/ingestion-service/src/index.test.js`
- `node --test services/graph-service/src/index.test.js`
- `node --test services/agent-service/src/index.test.js`
- `node --test apps/api-gateway/src/server.test.js`
- `pnpm --filter web test --run`
- `pnpm build:web`

Expected: all pass

**Step 3: Record results**

- 更新规划文件中的完成状态、发现与风险。
