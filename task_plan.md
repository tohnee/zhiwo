# 项目任务计划

## 目标

- 基于 `产品设计.md`、`monorepo拆解.md`、`UI设计参考.md`，构建一个可运行的 `KnowledgeOS` 首版 monorepo。
- 优先交付能体现核心产品价值的 MVP：知识源接入、图谱/工作台式 UI、可解释的 AI 工作流、可本地启动的开发环境。
- 第二阶段目标：逐步完成真实 connector、真实 graph store、services 拆分、可编辑文档和真实工作流适配层。

## 当前理解

- 产品定位：AI-native personal operating system，核心是“吸收信息流 -> 结构化知识 -> 生成洞察/内容”。
- 系统能力：数据接入、知识处理、Agent 编排、多模态生成、可调试工作台。
- 技术方向：前端 React + Tailwind，API Gateway 首版使用 Node，基础设施采用 Docker Compose，monorepo 管理多应用与共享包。
- 本阶段策略：`RSS + PDF + Neo4j` 走真实链路，`Telegram + Planner/Retriever/Critic` 支持真实接口但允许环境缺失时优雅降级。

## 建设原则

- 先做 local-first 的可运行首版，再为多服务化预留边界。
- 先打通端到端主链路，再补齐更多 connector 与生成能力。
- 保持 monorepo 清晰分层：`apps`、`services`、`packages`、`infra`、`docs`。

## 阶段

### Phase 1 - 理解与定界

- [complete] 归纳 PRD、架构、UI 设计
- [complete] 明确首版交付范围和默认技术实现

### Phase 2 - 工程初始化

- [complete] 创建 monorepo 根结构
- [complete] 配置 workspace、共享 TypeScript 配置、Node API 服务
- [complete] 配置 Docker Compose 与开发说明

### Phase 3 - 首版功能骨架

- [complete] 实现 `apps/web` 三栏工作台基础界面
- [complete] 实现 `apps/api-gateway` 基础接口
- [complete] 实现 `services/ingestion-service` mock ingestion pipeline
- [complete] 实现 `services/graph-service` mock graph query
- [complete] 实现 `services/agent-service` mock orchestrator

### Phase 4 - 验证与交付

- [complete] 运行前端与后端基础校验
- [complete] 检查诊断问题
- [complete] 补充 README 与项目说明

### Phase 5 - 第二阶段重构与真实集成

- [complete] 制定第二阶段实施计划
- [complete] 建立共享 schema 与配置层
- [complete] 拆分 `services/ingestion-service` 并接入 RSS/PDF/Telegram 适配层
- [complete] 拆分 `services/graph-service` 并接入 Neo4j
- [complete] 拆分 `services/agent-service` 并接入 Planner/Retriever/Critic
- [complete] 增强前端 editor 与 graph 交互
- [complete] 运行第二阶段验证并更新文档

### Phase 6 - Live LLM、持久化与发布

- [complete] 配置 DeepSeek live 模式并完成真实调用验证
- [complete] 将 Editor / Graph 持久化链路接入 `graph-service` 与 `api-gateway`
- [in_progress] 初始化本地 Neo4j 环境并做真实持久化验证
- [in_progress] 初始化 git、验证并发布公开仓库 `Almanack`

## 风险与开放问题

- 当前目录仅有设计文档，无现有代码，需要从零搭建。
- 某些外部系统（Telegram、Neo4j、Qdrant、LLM）首版应以 mock 或占位实现代替，以保证项目可本地跑通。
- 本机未安装 `docker`，因此只能交付 Compose 配置，不能完成容器级验证。
- 第二阶段仍受真实凭据与本地 Neo4j 实例可用性影响，需要提供降级模式。
- 当前 `DeepSeek` live 已验证可用；本地 `Neo4j` 真实连通验证仍受 Homebrew 安装耗时影响。

## 错误记录

| 错误 | 尝试 | 处理 |
| --- | --- | --- |
| `session-catchup.py` 路径不可用 | 1 | 改为手动初始化规划文件，并在后续通过文件记录上下文 |
| `FastAPI` 依赖在 `Python 3.14` 环境安装受阻 | 1 | 切换到文档允许的 Node API Gateway 方案，优先保证 MVP 可运行 |
| API Gateway 无法解析 workspace 包 | 1 | 为 `services/*` 添加 `exports`，为 `apps/api-gateway` 显式声明 workspace 依赖后重新安装 |
| `brew install` 卡在自动更新与残留锁文件 | 1 | 关闭 `HOMEBREW_NO_AUTO_UPDATE` 重试，清理 `.incomplete` 文件并按单包安装排查 |
