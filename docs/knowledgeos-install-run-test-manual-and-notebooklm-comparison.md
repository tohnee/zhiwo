# KnowledgeOS 安装运行测试手册与 NotebookLM 深度对比

## 1. 文档目标

本文档面向两类读者：

- 开发者：需要在本地安装、启动、验证 `KnowledgeOS MVP`
- 产品/投资/协作方：需要快速理解它与 `NotebookLM` 的差异

本文档特别区分两层内容：

- `当前 MVP 已实现并已验证的能力`
- `产品设计文档中的目标能力`

如果不做这层区分，很容易把路线图误写成现状。本文档默认以代码仓库当前状态为准，并在对比部分明确说明哪些是现有能力，哪些是未来方向。

---

## 2. 项目概览

`KnowledgeOS MVP` 是一个围绕“信息采集 -> 知识结构化 -> 图谱/编辑器/调试工作台 -> AI 解释与生成”构建的本地可运行原型。

当前仓库的核心组成如下：

- `apps/web`：React + Vite 前端工作台
- `apps/api-gateway`：Node.js API Gateway
- `services/ingestion-service`：RSS / PDF / Telegram 接入层
- `services/graph-service`：Neo4j / 内存双模式图谱服务
- `services/agent-service`：Planner / Retriever / Critic 工作流
- `packages/shared`：共享 schema 与运行时环境读取

当前 MVP 的核心体验：

- 左侧 `Sources`：展示数据源状态
- 中间 `Workspace`：包含 `Graph`、`Editor`、`Chat`
- 右侧 `AI Debug`：展示 Agent 步骤、检索与推理摘要

当前已实现的重要真实链路：

- `DeepSeek` live 调用
- `Neo4j` 本地持久化
- `Editor block` 保存到 `Neo4j`
- `Graph node detail` 从 `Neo4j` 读取

---

## 3. 系统要求

建议本地环境：

- macOS
- Node.js `24.x` 或兼容版本
- `pnpm 10.x`
- Java `21`
- Neo4j Community `2026.04.0` 或兼容版本

当前仓库已验证的运行前提：

- `pnpm install` 可成功
- `node --test` 可运行各服务测试
- 本地 `Neo4j` 可通过 `bolt://localhost:7687` 连接
- 若未配置 `DeepSeek` 或 `Neo4j`，系统会按设计降级

---

## 4. 目录说明

关键目录如下：

```text
apps/
  api-gateway/   Node API 网关
  web/           React 工作台
services/
  agent-service/ Planner / Retriever / Critic
  graph-service/ Neo4j / memory graph store
  ingestion-service/ RSS / PDF / Telegram
packages/
  shared/        共享 schema 与 env 读取
infra/
  docker/        Docker Compose 草案
docs/
  ...            计划、手册与研究记录
```

---

## 5. 安装步骤

### 5.1 获取代码

```bash
git clone <your-repo-url>
cd zhizhi
```

如果代码已经在本地，可直接进入仓库目录。

### 5.2 安装 Node 依赖

```bash
pnpm install
```

### 5.3 初始化环境文件

```bash
cp .env.example .env.local
```

然后按需填写：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro

RSS_FEED_URL=
PDF_DIRECTORY=

TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_BOT_TOKEN=

NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=
```

环境变量含义：

- `DEEPSEEK_API_KEY`：启用真实大模型调用
- `DEEPSEEK_MODEL`：默认使用 `deepseek-v4-pro`
- `RSS_FEED_URL`：真实 RSS 源
- `PDF_DIRECTORY`：本地 PDF 目录
- `TELEGRAM_*`：Telegram 真实接入所需凭据
- `NEO4J_*`：图谱持久化所需配置

---

## 6. 本地 Neo4j 安装手册

这一节提供的是可复现的本地安装方法。当前环境中，`brew` 下载官方包时可能遇到 `403` 或锁冲突，因此推荐优先使用“手动下载 + 本地解压”的方式。

### 6.1 准备运行时目录

```bash
mkdir -p ~/Downloads/almanack-runtime
cd ~/Downloads/almanack-runtime
```

### 6.2 准备 JDK 21

如果本机没有可用的 `java 21`，需要先安装或手动下载 JDK。

校验方式：

```bash
java -version
```

若输出不是 `21.x`，可采用手动方式：

1. 下载 `Temurin JDK 21`
2. 解压到本地运行时目录
3. 配置 `JAVA_HOME`

示例：

```bash
export JAVA_HOME=~/Downloads/almanack-runtime/jdk-21.0.10+7/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

### 6.3 下载并解压 Neo4j

下载 `Neo4j Community` 的 `unix.tar.gz` 包并解压到本地目录。

解压后目录形如：

```text
~/Downloads/almanack-runtime/neo4j-community-2026.04.0
```

### 6.4 设置初始密码

第一次启动前执行：

```bash
export JAVA_HOME=~/Downloads/almanack-runtime/jdk-21.0.10+7/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
cd ~/Downloads/almanack-runtime/neo4j-community-2026.04.0
bin/neo4j-admin dbms set-initial-password 'YourNeo4jPassword'
```

### 6.5 启动 Neo4j

推荐后台启动：

```bash
export JAVA_HOME=~/Downloads/almanack-runtime/jdk-21.0.10+7/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
cd ~/Downloads/almanack-runtime/neo4j-community-2026.04.0
bin/neo4j start
```

### 6.6 校验 Neo4j 是否可用

```bash
lsof -nP -iTCP:7474 -iTCP:7687 -sTCP:LISTEN
```

期望结果：

- `7474` 在监听
- `7687` 在监听

也可进一步验证：

```bash
bin/cypher-shell -a bolt://localhost:7687 -u neo4j -p 'YourNeo4jPassword' "RETURN 1"
```

---

## 7. 启动项目

### 7.1 启动 API Gateway

在仓库根目录执行：

```bash
pnpm dev:api
```

默认监听：

```text
http://0.0.0.0:8787
```

### 7.2 启动 Web 前端

新开一个终端：

```bash
pnpm dev:web
```

或：

```bash
pnpm --filter web dev --host 0.0.0.0
```

### 7.3 访问界面

前端启动后，打开 Vite 输出的本地地址即可。

---

## 8. 运行模式说明

系统目前存在两种主要降级路径：

### 8.1 LLM 模式

- 配置 `DEEPSEEK_API_KEY`：进入 `live`
- 未配置：回退到 deterministic summary

### 8.2 Graph 存储模式

- 配置且连接成功 `Neo4j`：进入 `neo4j`
- 未配置或连接失败：回退到 `memory`

这意味着项目即使在外部依赖缺失时仍然可以启动，但体验会从“真实接入”退回到“演示模式”。

---

## 9. 完整测试手册

本节分为三类：

- 单元/服务测试
- 构建测试
- 真实链路测试

### 9.1 自动化测试

在仓库根目录执行：

```bash
node --test services/ingestion-service/src/index.test.js
node --test services/graph-service/src/index.test.js
node --test services/agent-service/src/index.test.js
node --test apps/api-gateway/src/server.test.js
pnpm test:web
pnpm build:web
```

建议最小验收命令：

```bash
node --test apps/api-gateway/src/server.test.js
pnpm build:web
```

### 9.2 健康检查

启动 API 后执行：

```bash
curl http://127.0.0.1:8787/health
```

期望输出：

```json
{"status":"ok","service":"knowledgeos-api"}
```

### 9.3 Dashboard 验证

```bash
node --input-type=module -e "const r=await fetch('http://127.0.0.1:8787/api/dashboard'); const j=await r.json(); console.log(JSON.stringify({retrieval:j.debug.retrieval,blocks:j.workspace.editorBlocks.map((b)=>b.id)}, null, 2));"
```

若 Neo4j 正常，期望看到：

- `Storage mode: neo4j`
- `graphNodes[*].metadata.storageMode = neo4j`

### 9.4 节点详情验证

```bash
curl http://127.0.0.1:8787/api/graph/node/n1
```

期望返回：

- 节点 `n1`
- `metadata.storageMode: neo4j`

### 9.5 Editor 持久化验证

#### 第一步：通过 API 写入 block

```bash
curl -X POST http://127.0.0.1:8787/api/editor/block \
  -H 'Content-Type: application/json' \
  -d '{"id":"block-api-manual","content":"Manual API persistence verification."}'
```

#### 第二步：通过 Cypher 读回

```bash
export JAVA_HOME=~/Downloads/almanack-runtime/jdk-21.0.10+7/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
~/Downloads/almanack-runtime/neo4j-community-2026.04.0/bin/cypher-shell \
  -a bolt://localhost:7687 \
  -u neo4j \
  -p 'YourNeo4jPassword' \
  "MATCH (b:EditorBlock {id: 'block-api-manual'}) RETURN b.id AS id, b.content AS content, b.sourceIds AS sourceIds"
```

若返回该 block，说明：

- API 写入成功
- `graph-service` 持久化成功
- Neo4j 数据落库成功

---

## 10. 故障排查手册

### 10.1 `Storage mode: memory`

原因通常是：

- `.env.local` 未配置 `NEO4J_*`
- Neo4j 未启动
- 密码错误
- `bolt://localhost:7687` 不可连

排查顺序：

```bash
lsof -nP -iTCP:7687 -sTCP:LISTEN
```

```bash
cat .env.local
```

```bash
bin/cypher-shell -a bolt://localhost:7687 -u neo4j -p 'YourNeo4jPassword' "RETURN 1"
```

### 10.2 `java -version` 不可用

说明本机缺少 JDK，或 `JAVA_HOME` / `PATH` 未指向正确位置。

优先检查：

```bash
echo $JAVA_HOME
java -version
```

### 10.3 Neo4j 可以启动但 API 卡住

优先检查：

- API 是否仍在旧进程上运行
- Neo4j 是否被前台终端中断
- 当前 API 请求是否落到了内存态缓存

建议：

- Neo4j 使用 `bin/neo4j start`
- API 在修改后重启
- 对持久化验证以 `Cypher` 回读为准

### 10.4 DeepSeek 无法调用

检查：

- `.env.local` 是否包含 `DEEPSEEK_API_KEY`
- 模型名是否正确
- 测试时是否误用了 fallback stub

---

## 11. 当前 MVP 与 NotebookLM 的深度对比

这部分只对比“当前仓库已实现的 MVP”，不把产品路线图混入现状。

### 11.1 定位差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 核心定位 | 本地可运行的知识工作台原型 | 云端文档理解与问答产品 |
| 组织方式 | Source + Graph + Editor + Chat + Debug | Notebook + Source + 问答/摘要 |
| 主要目标 | 打通知识结构化与可追溯工作流 | 提升个人资料阅读、问答和总结效率 |
| 运行方式 | 本地开发环境可部署 | Google 托管服务 |

结论：

- `NotebookLM` 更像“文档理解产品”
- `KnowledgeOS MVP` 更像“知识操作系统雏形”

### 11.2 数据输入方式差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 输入方式 | RSS / PDF / Telegram 适配层 + API ingest | 以用户上传资料为主 |
| 自动采集 | 部分支持，当前 RSS/PDF 更接近真实，Telegram 可降级 | 偏手动 |
| 持续同步 | 有服务层边界，但调度能力仍轻量 | 更偏资料集导入 |

核心差异：

- NotebookLM 的输入模型是“把材料放进去”
- KnowledgeOS 的方向是“持续吸收外部信息流”

即使当前 MVP 还没把所有 connector 做满，它的服务边界已经朝“持续 ingestion”设计，而不是一次性上传。

### 11.3 知识结构差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 知识组织 | Graph nodes + editor blocks + source metadata | 文档/笔记本级组织 |
| 存储模式 | `memory` / `neo4j` 双模式 | 平台内部存储，用户不可控 |
| 结构可见性 | 节点、块、来源、调试信息可见 | 用户主要看到摘要与回答 |

核心差异：

- NotebookLM 的知识组织中心是“文档集合”
- KnowledgeOS 的中心是“图谱 + 编辑块 + 推理轨迹”

这会带来更强的结构化能力，也带来更高的工程复杂度。

### 11.4 交互模式差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 主工作区 | Graph / Editor / Chat 多视图切换 | 对话 + 源资料浏览 |
| 编辑能力 | Block 级编辑与保存 | 偏阅读与总结，不强调结构化块编辑 |
| 调试透明度 | 显式展示 Agent Steps / Retrieval / Reasoning | 用户侧通常不暴露完整推理链路 |

核心差异：

- NotebookLM 更强在“快速得到总结和问答”
- KnowledgeOS 更强调“编辑、追溯、调试、重构知识”

### 11.5 AI 工作流差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 工作流形态 | Planner / Retriever / Critic 三段式 | 面向最终体验的一体化生成 |
| 可解释性 | 有 Debug Panel | 用户看到的是结果导向体验 |
| 可替换性 | LLM、graph、ingestion 均有边界 | 更强产品整合，弱本地替换 |

KnowledgeOS 的优势：

- 更适合做工程化演进
- 更适合做本地化、私有化、可审计系统

NotebookLM 的优势：

- 现成体验更成熟
- 产品打磨与使用门槛更低

### 11.6 持久化与本地控制能力差异

| 维度 | KnowledgeOS MVP | NotebookLM |
| --- | --- | --- |
| 存储控制 | 本地 Neo4j 可控 | 平台托管 |
| 部署控制 | 可本地运行 | 不提供本地私有部署 |
| 数据可验证性 | 可用 Cypher 直接核对落库 | 用户无法直接验证内部存储结构 |

这是两者最本质的差异之一：

- NotebookLM 优先“可用即服务”
- KnowledgeOS 优先“可控的知识基础设施”

### 11.7 当前 MVP 相对 NotebookLM 的短板

当前 MVP 仍明显弱于 NotebookLM 的地方：

- 产品完成度还低
- 资料导入体验还不够顺滑
- 多模态输出能力尚未真正实现
- 音频摘要、播客式输出尚未落地
- 协作、分享、权限控制仍未成型
- 内容质量与交互细节还没有 NotebookLM 成熟

也就是说，当前仓库并不是“已经全面超越 NotebookLM 的成品”，而是“在某条更可控、更结构化、更工程化的方向上，已经建立了与 NotebookLM 不同的系统骨架”。

---

## 12. 目标产品路线图与 NotebookLM 的差异

这部分不是现状，而是基于 `产品设计.md` 中的方向。

目标产品相对 NotebookLM 的潜在超越点：

- 自动 ingestion：IM / Podcast / Web / PDF 持续接入
- GraphRAG：从文档级检索升级为图谱级知识网络
- 时间维度：观点演化、事件时间线
- 冲突检测：发现相互矛盾的信息
- Agent 协同：Collector / Structuring / Analyst / Planner / Creator / Critic
- 多模态输出：文档、PPT、脑图、图片、视频、播客
- 可编辑与可回溯：所有输出都能回链到来源

如果这些能力全部落地，那么它与 NotebookLM 的关系将不是“同类替代”，而是：

- NotebookLM：知识材料理解助手
- KnowledgeOS：个人认知基础设施与生产系统

---

## 13. 一句话总结

如果只看当前 MVP：

> `KnowledgeOS` 还不是 NotebookLM 那样成熟的终端产品，但它已经具备了 NotebookLM 不强调的三种系统级能力：本地可控部署、Neo4j 持久化知识结构、Agent 调试与编辑式工作台。

如果看目标路线：

> `KnowledgeOS` 的目标不是做“另一个 NotebookLM”，而是从“文档问答工具”升级为“持续吸收信息流、结构化知识、驱动内容与决策生成的 AI 操作系统”。

---

## 14. 推荐使用方式

如果你的目标是：

- 快速体验成熟产品：优先选 `NotebookLM`
- 做本地可控、可审计、可演进的知识系统：优先继续推进 `KnowledgeOS`
- 做研究型、可私有化、可接图数据库的 AI 工作台：`KnowledgeOS` 的路线更有扩展潜力

---

## 15. 附录：当前仓库建议验收清单

最低验收标准：

- `pnpm install` 成功
- `node --test apps/api-gateway/src/server.test.js` 通过
- `pnpm build:web` 通过
- `Neo4j` 监听 `7474/7687`
- `GET /api/graph/node/n1` 返回 `storageMode: neo4j`
- `POST /api/editor/block` 后可用 `Cypher` 查回

建议演示顺序：

1. 启动 Neo4j
2. 启动 API
3. 启动 Web
4. 打开 Dashboard
5. 保存一个 Editor Block
6. 查询 `Node Detail`
7. 用 `cypher-shell` 回读落库结果

这样能最直观地证明：

- 系统不是纯 mock
- 图谱有真实持久化
- UI、API、服务、数据库已经打通
