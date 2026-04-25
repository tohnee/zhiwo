# 项目研究记录

## 产品设计结论

- 核心产品形态是“知识操作系统”，不是单纯聊天产品。
- 差异化能力来自自动 ingestion、知识图谱、时间维度、冲突检测、多 Agent、自带调试面板。
- 首批高价值场景包括投资研究、团队决策、个人学习。

## monorepo 结论

- 设计文档推荐的生产级结构适合作为长期目标。
- 若从零开始，首版应该采用“单仓多应用 + 伪微服务边界”的方式，避免一次性引入过多复杂度。
- 建议保留 `apps/web`、`apps/api-gateway`、`services/*`、`packages/*`、`infra/*` 目录，以支持未来拆分。

## UI 结论

- 工作台是三栏布局：左侧数据源、中间动态工作区、右侧 AI Debug Panel。
- 中间核心模式至少包含 `Graph View`、`Document Editor`、`Chat Workspace`。
- UI 的关键原则是：可编辑、可追溯、可重算。

## 实施建议

- 推荐首版先做可运行 MVP。
- Web 提供 dashboard + graph workspace + editor + chat + debug panel。
- API 提供 `health`、`dashboard`、`ingest`、`chat` 四类接口。
- 服务层先用 mock 数据和内存存储演示完整链路。
- Docker Compose 提供前端与 API 的一键启动入口。

## 环境发现

- 当前机器 `node` 与 `pnpm` 可用，适合快速落地前端和 Node API。
- 当前机器未安装 `docker`，所以只能验证 Compose 文件静态正确性或在最终说明中标注未执行。
- `Python 3.14` 下安装 FastAPI 依赖链存在阻塞，因此首版 API Gateway 改为 Node 实现更稳妥。

## 第二阶段策略

- 采用“半真实半模拟”推进。
- `RSS + PDF + Neo4j` 优先走真实接入，尽快打通 ingestion -> graph 主链路。
- `Telegram` 与 `Planner/Retriever/Critic` 优先做真实接口兼容与优雅降级，避免被凭据和模型阻塞。
- 由于当前 API 仍是单文件实现，拆服务前需要先抽出共享 schema 和状态结构，避免前后端 payload 再次变化。

## 第二阶段实现发现

- `agent-service` 采用可组合的 `Planner -> Retriever -> Critic` 三段式设计，当前在无 LLM key 时走 deterministic grounded summary，便于本地验证。
- `api-gateway` 已新增 editor block 更新与 graph node detail 接口，开始承载工作台交互状态。
- 前端 `Graph` 视图已从静态卡片升级为可选中节点的按钮式交互；`Editor` 视图已支持 block 级编辑与保存。
- 共享数据结构升级后，前端和 API 都依赖 `source.kind/mode/detail`、`graphNode.metadata`、`editorBlock.id/content` 等字段，后续新服务应继续复用这一约定。

## 第三阶段发现

- `.env.local` 已接入运行时读取，`DEEPSEEK_API_KEY` 可直接驱动 `agent-service` 切换到 live 模式。
- `DeepSeek` 真实调用已成功返回结果，因此 live LLM 链路不是理论接入，而是已被实际验证。
- `graph-service` 现已具备 Neo4j seed、summary 读取、editor block 保存、node detail 查询四类真实适配函数。
- 前端 `Save Blocks` 与 graph node 点击现在通过 API 调用后端，而不再只是本地状态变更。
- 当前未完成项主要是本地 Neo4j 安装与真实连通验证，不是代码结构缺失。
