好，这一版我不给你“泛 UI 描述”，而是按 **Figma 可直接落地的设计规格**来写（含页面结构、组件层级、交互状态、数据绑定）。你可以直接丢给设计师或让 Codex 生成前端。

---

# 🎯 产品 UI 总体理念（必须先定）

> **AI = 可调试的认知系统，而不是黑盒聊天框**

对标：

* NotebookLM：单一对话 + sources panel ❌
* Notion：结构化编辑 ✅
* 你的系统：
  👉 **Graph + Chat + Editor 三位一体**

---

# 🧠 UI 总体布局（核心画布）

## 主界面（Desktop）

```id="layout"
┌────────────────────────────────────────────┐
│ Top Bar (Search / Mode / Profile)          │
├──────────────┬──────────────┬──────────────┤
│ Left Panel   │ Center       │ Right Panel  │
│ (Sources)    │ (Workspace)  │ (AI Debug)   │
└──────────────┴──────────────┴──────────────┘
```

---

## 三栏核心定义

### 🟦 Left：数据源 / 知识入口

* IM（Telegram / 飞书）
* Documents
* Podcast
* Web clips

---

### 🟨 Center：主工作区（动态切换）

三种模式：

1️⃣ Graph View（默认）
2️⃣ Document Editor
3️⃣ Chat Workspace

---

### 🟥 Right：AI Debug Panel（杀手锏）

* 推理链
* 检索结果
* Agent步骤

👉 这是碾压 NotebookLM 的关键 UI

---

# 🧩 核心页面 1：Graph Workspace（最重要）

## 视觉结构

```id="graph-ui"
┌──────────────────────────────┐
│ Toolbar (filters / zoom)     │
├──────────────────────────────┤
│                              │
│     Interactive Graph        │
│                              │
└──────────────────────────────┘
```

---

## 节点设计（Figma组件）

### Node Component

```id="node"
[Avatar/Icon]
Title
Type tag (Person / Concept / Event)
Confidence score
```

---

## 交互

### 点击节点

→ 右侧展开：

```id="node-detail"
- Summary
- Source references
- Related nodes
- Timeline
```

---

### 拖拽

* 创建关系
* 重组知识

---

### Hover

* 高亮路径（graph traversal）

---

# 💬 核心页面 2：Chat + Agent Workspace

## 布局

```id="chat-ui"
┌──────────────────────────────┐
│ Chat History                 │
├──────────────────────────────┤
│ Input Box + Tool Selector    │
└──────────────────────────────┘
```

---

## 输入框增强（重点）

```id="input"
[Text Input....................]
[Mode: Ask | Analyze | Create]
[Attach: Graph / Docs / IM]
```

---

## AI回答结构（不是纯文本）

```id="answer"
Answer Block
├── Summary
├── Evidence (clickable)
├── Graph references
└── Actions
```

---

## Actions（关键差异）

* ➕ 保存为节点
* 🧠 加入知识库
* 📊 转为报告
* 🎞️ 生成PPT

---

# 🧾 核心页面 3：Document / Editor（生产内容）

## 结构（类似 Notion，但 AI-first）

```id="editor"
[Title]
[Blocks...]
  - Text
  - Graph embed
  - AI block
```

---

## Block 类型

### 1）AI Block

```id="ai-block"
Prompt: "Summarize investment thesis"

[Generate]
[Regenerate]
[Edit]
```

---

### 2）Graph Embed

```id="graph-embed"
Mini graph view
→ 点击展开全图
```

---

### 3）Source Block

```id="source"
- 引用来源
- 点击跳转原文
```

---

# 🧪 核心页面 4：AI Debug Panel（核心差异）

## 布局

```id="debug"
┌──────────────────────────────┐
│ Agent Steps                  │
├──────────────────────────────┤
│ Retrieval                    │
├──────────────────────────────┤
│ Reasoning                    │
└──────────────────────────────┘
```

---

## 内容

### Agent Steps

```id="steps"
1. Planner → 拆解问题
2. Retriever → 查询 graph
3. Reasoner → 生成答案
4. Critic → 校验
```

---

### Retrieval View

```id="retrieval"
- Top nodes
- Top documents
- Score
```

---

### Reasoning Chain

```id="chain"
Step 1 → Step 2 → Step 3
```

👉 用户可以：

* 修改检索
* 重跑推理

---

# 🔌 数据接入 UI（IM / Podcast）

## IM 接入界面

```id="im-ui"
Connected Sources:
- Telegram ✔
- Feishu ✔

[Import history]
[Auto-sync ON]
```

---

## 消息分析界面

```id="msg"
Message Thread
├── Key insights
├── Entities extracted
└── Actions
```

---

# 🎬 多模态生成 UI

## Generate Panel

```id="generate"
Select Output:
[Report] [PPT] [Mindmap] [Podcast] [Video]

Input:
- Topic
- Source scope
- Style
```

---

## PPT 生成结果

```id="ppt"
Slide 1
Slide 2
Slide 3

→ 可编辑
→ 可导出
```

---

# 🎨 设计系统（Design Tokens）

## 颜色

```id="colors"
Primary: #4F46E5
Background: #0F172A
Surface: #1E293B
Accent: #22C55E
Danger: #EF4444
```

---

## 字体

* Inter（UI）
* JetBrains Mono（代码 / debug）

---

## 圆角

* 2xl（卡片）
* xl（按钮）

---

# ⚡ 关键交互（必须做）

## 1）“Ask → Graph Update”

用户提问 → 系统：

* 回答
* 更新知识图谱

---

## 2）“Graph → Content”

选中节点 → 生成：

* 报告
* PPT
* 分析

---

## 3）“IM → Insight”

新消息 → 自动：

* 分析
* 更新 graph
* 推送 insight

---

# 🧠 UX 精髓（一定要坚持）

👉 三个原则：

### 1）所有 AI 输出必须：

* 可编辑
* 可追溯
* 可重算

---

### 2）所有知识必须：

* 可视化（graph）
* 可连接
* 可演化

---

### 3）所有推理必须：

* 可见（debug）
* 可控
* 可复现

---

# 最后一段（很关键）

👉 这个 UI 的本质不是：

“更好看的 NotebookLM”

👉 而是：

> **把 AI 从“回答工具”变成“认知界面”**

---

如果你下一步要继续，我可以直接帮你：

👉 把这套 UI 转成

* **React + Tailwind 组件代码（可直接跑）**
* 或生成 **Figma JSON / design spec（设计师直接导入）**
