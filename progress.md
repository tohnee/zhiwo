# 项目进度日志

## 2026-04-25

### 已完成

- 阅读 `产品设计.md`
- 阅读 `monorepo拆解.md`
- 阅读 `UI设计参考.md`
- 提炼产品定位、monorepo 分层、UI 主工作台结构
- 初始化 `task_plan.md`、`findings.md`、`progress.md`
- 确认首版按“可运行 MVP”构建
- 创建 monorepo 根配置、workspace 与基础文档
- 实现 `apps/web` 三栏工作台与 mock fallback 数据链路
- 实现 `apps/api-gateway` Node 版 `health`、`dashboard`、`ingest`、`chat` 接口
- 为 `services/*` 与 `packages/shared` 补充职责说明
- 编写并通过前端与 API 自动化测试
- 生成第二阶段实施计划
- 建立 `packages/shared` 共享 schema/env 层
- 实现 `services/ingestion-service` 的 RSS、PDF、Telegram 降级适配
- 实现 `services/graph-service` 的 Neo4j/内存双模式图服务
- 将 `apps/api-gateway` 改造成聚合 services 的入口
- 通过 ingestion、graph、api 三层测试
- 实现 `services/agent-service` 的 Planner / Retriever / Critic 工作流
- 为 `api-gateway` 新增 editor block 更新与 graph node detail 接口
- 实现前端 editor block 编辑保存与 graph 节点详情交互
- 通过 agent、api、web 相关测试
- 配置 `.env.local` 并完成 DeepSeek live 调用验证
- 为 `graph-service` 增加 Neo4j summary / block save / node detail 适配层
- 将前端 block 保存与 node detail 查询接到真实 API
- 初始化 git 仓库并准备 GitHub 发布
- 手动下载并解压 JDK 21 与 Neo4j 社区版到 `Downloads/almanack-runtime`
- 启动本地 Neo4j，确认 `7474/7687` 监听并设置初始密码
- 完成真实持久化验证：服务层写入 `block-live-1`、API 写入 `block-api-1`，Cypher 可直接查询回读
- 修复 dashboard `Storage mode: undefined` 问题，并通过 API 测试验证 `Storage mode: neo4j`

### 当前进行中

- GitHub 发布

### 下一步

- 创建公开仓库 `Almanack` 并上传代码
- 汇总第三阶段结果与剩余发布事项

## 2026-04-27

### 已完成

- 确认全部现有代码已在 `work` 分支（本地仅存在 `work` 分支）。
- 对 `work` 分支完成一次 Sprint/Phase 1~5 深度复盘，并输出评审文档 `docs/reviews/work-deep-review-2026-04-27.md`。
- 重新执行 `make check`，服务测试 + Web 测试 + Web 构建全部通过。
- 完成 `work` 分支 UI demo 渲染检查（Vite dev server + HTTP 可达性），并输出 `docs/reviews/ui-demo-2026-04-27.md`。
- 新建总分支 `total-prs`（指向与 `work` 相同的最新提交），并输出合并报告 `docs/reviews/pr-consolidation-2026-04-27.md`。
- 已配置远程仓库 `https://github.com/tohnee/zhiwo` 并尝试 push/ls-remote，但受网络隧道 403 限制无法直连 GitHub；阻塞与后续命令已更新到 `docs/reviews/github-pr-publish-2026-04-27.md`。
- 按“全量汇总”要求新建分支 `all-history-rollup-2026-04-27`（从 `work` 头部创建），并输出核对报告 `docs/reviews/history-rollup-2026-04-27.md`。
