# KnowledgeOS MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于现有产品、架构和 UI 文档，在仓库内从零搭建一个可运行的 `KnowledgeOS` MVP monorepo。

**Architecture:** 采用 monorepo 组织方式，用 `pnpm` 管理前端工作区，用 `FastAPI` 提供 API Gateway，用轻量 mock 服务模拟 ingestion、graph、agent 三条核心能力。前端实现三栏工作台，后端暴露 `ingest`、`graph`、`chat` 基础接口，整体通过 Docker Compose 和本地开发脚本串联。

**Tech Stack:** React、Vite、TypeScript、Tailwind CSS、FastAPI、Pydantic、pnpm、Docker Compose。

---

### Task 1: 初始化仓库与工作区

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/web/package.json`
- Create: `apps/api-gateway/requirements.txt`

**Step 1: 创建前端 workspace 定义**

- 定义 monorepo 根 `package.json`
- 增加 `dev:web`、`dev:api`、`build:web`、`lint:web` 脚本

**Step 2: 创建 `pnpm` workspace**

- 包含 `apps/*` 与 `packages/*`

**Step 3: 创建基础忽略规则与项目说明**

- 忽略 Node/Python 构建产物、环境文件、日志
- README 说明项目定位、目录和启动方式

**Step 4: 验证**

- 运行 `pnpm install` 不报 workspace 配置错误

### Task 2: 搭建前端应用骨架

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/data/mock.ts`

**Step 1: 写最小页面结构**

- 建立三栏布局：Sources、Workspace、Debug
- 在 Workspace 内实现 Graph/Editor/Chat 三个标签页

**Step 2: 写 API 访问层**

- 定义获取 graph、chat、ingest 状态的请求函数

**Step 3: 写前端降级策略**

- 当 API 不可用时回退到 mock 数据，保证界面可演示

**Step 4: 验证**

- 运行 `pnpm --filter web build`

### Task 3: 搭建 API Gateway

**Files:**
- Create: `apps/api-gateway/main.py`
- Create: `apps/api-gateway/app/__init__.py`
- Create: `apps/api-gateway/app/models.py`
- Create: `apps/api-gateway/app/data.py`
- Create: `apps/api-gateway/app/routes/__init__.py`
- Create: `apps/api-gateway/app/routes/health.py`
- Create: `apps/api-gateway/app/routes/graph.py`
- Create: `apps/api-gateway/app/routes/ingest.py`
- Create: `apps/api-gateway/app/routes/chat.py`

**Step 1: 建立 FastAPI 应用**

- 挂载 health、graph、ingest、chat 路由
- 配置 CORS 供前端开发使用

**Step 2: 建立共享数据模型**

- 使用 Pydantic 定义 sources、graph nodes、messages、agent steps

**Step 3: 建立 mock 数据和内存状态**

- ingest 写入内存状态
- graph/chat 从共享状态中组装返回

**Step 4: 验证**

- 运行 `python -m compileall apps/api-gateway`

### Task 4: 补齐服务边界与基础设施

**Files:**
- Create: `services/agent-service/README.md`
- Create: `services/graph-service/README.md`
- Create: `services/ingestion-service/README.md`
- Create: `packages/shared/README.md`
- Create: `infra/docker/docker-compose.yml`

**Step 1: 创建服务目录与职责说明**

- 为未来拆分预留目录边界
- 明确当前由 API Gateway 内嵌 mock 能力代理

**Step 2: 创建 Docker Compose**

- 编排 `web`、`api` 两个核心容器

**Step 3: 验证**

- `docker compose config` 通过

### Task 5: 文档与最终验收

**Files:**
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: 补充启动命令与架构说明**

- 写明依赖、启动方式、MVP 范围与下一步扩展点

**Step 2: 运行验证**

- `pnpm --filter web build`
- `python -m compileall apps/api-gateway`
- `docker compose -f infra/docker/docker-compose.yml config`

**Step 3: 记录结果**

- 将成功/失败与修正写入进度文件
