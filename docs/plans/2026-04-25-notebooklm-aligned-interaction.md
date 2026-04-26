# NotebookLM-Aligned Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 KnowledgeOS 当前三栏工程工作台重构为更接近 NotebookLM 的核心使用习惯，同时保留 Graph / AI Debug 作为高级入口。

**Architecture:** 前端主界面从 `Sources + Workspace + AI Debug` 改为“资料列表 + 主工作区 + 高级入口”的使用模型。API 继续以 `dashboard` 为主聚合接口，但补充更贴近 NotebookLM 的工作区语义字段，让前端能渲染资料卡片、问答主区、笔记流、引用区和高级面板切换。Graph 与 Debug 不再占主视觉，而是收纳到 `Advanced` 面板中。

**Tech Stack:** React, Vite, TypeScript, Node.js HTTP server, Vitest, node:test

---

### Task 1: 定义新的工作区数据形状

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/data/mock.ts`
- Test: `apps/web/src/App.test.tsx`

**Step 1: 写失败测试**

- 为前端增加对“资料列表、主摘要、建议问题、笔记流、引用片段、高级面板入口”的渲染断言。
- 让现有测试在新 UI 文案和结构下失败。

**Step 2: 运行测试确认失败**

Run: `pnpm --filter web test --run`

Expected:
- 旧 UI 文案查找失败
- 新的 NotebookLM 风格区域尚不存在

**Step 3: 最小实现类型与 mock**

- 在 `api.ts` 中扩展 `DashboardData` 的工作区类型，增加：
  - `workspace.summary`
  - `workspace.suggestedPrompts`
  - `workspace.notes`
  - `workspace.sources`
  - `workspace.activeNoteId`
  - `workspace.highlights`
- 在 `mock.ts` 中生成一套对应的静态数据。

**Step 4: 再跑测试**

Run: `pnpm --filter web test --run`

Expected:
- 仍失败，但从“数据缺失”进入“UI 尚未实现”

### Task 2: 重构主界面外壳

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Step 1: 写失败测试**

- 测试主界面存在：
  - 左侧资料列表
  - 中间问答/摘要主区
  - 右侧笔记或引用区
  - `Advanced` 入口

**Step 2: 运行测试确认失败**

Run: `pnpm --filter web test --run`

Expected:
- 仍找不到新的布局区域

**Step 3: 最小实现**

- 把 `Graph / Editor / Chat` tab 主入口移除。
- 改为：
  - 左侧 `Sources`
  - 中间 `Studio`
  - 右侧 `Notes`
  - 顶部操作入口 `Ask`, `Notes`, `Advanced`
- 默认视图优先展示“摘要 + 建议问题 + 问答流”，更接近 NotebookLM 的主工作区。

**Step 4: 再跑测试**

Run: `pnpm --filter web test --run`

Expected:
- 新布局相关断言通过

### Task 3: 补聊天输入与引用阅读体验

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/api-gateway/src/server.js`
- Test: `apps/web/src/App.test.tsx`
- Test: `apps/api-gateway/src/server.test.js`

**Step 1: 写失败测试**

- 前端测试：
  - 用户可输入问题并提交
  - 新回答会追加到问答流
  - 回答旁边出现引用来源标签
- API 测试：
  - `POST /api/chat` 后 dashboard 或返回体能支持前端显示引用信息

**Step 2: 运行测试确认失败**

Run:
- `pnpm --filter web test --run`
- `node --test apps/api-gateway/src/server.test.js`

Expected:
- 输入框、提交行为、引用区都不存在或不完整

**Step 3: 最小实现**

- 前端新增问答输入框与提交按钮。
- 本地状态管理问答流。
- API 保持当前 `/api/chat`，但让前端更显式渲染 `citations`。
- 回答 UI 展示“来源标签/引用 chips”。

**Step 4: 再跑测试**

Run:
- `pnpm --filter web test --run`
- `node --test apps/api-gateway/src/server.test.js`

Expected:
- 问答提交与引用展示通过

### Task 4: 把 Editor 改造成更像 NotebookLM 的笔记流

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/App.test.tsx`

**Step 1: 写失败测试**

- 测试右侧 `Notes` 区能：
  - 展示笔记列表
  - 选中单条笔记
  - 编辑并保存

**Step 2: 运行测试确认失败**

Run: `pnpm --filter web test --run`

Expected:
- 目前只有旧的 `Editor` 视图，无法满足新断言

**Step 3: 最小实现**

- 将 `EditorBlock` 映射为笔记流。
- 默认右侧显示“笔记卡片 + 当前编辑内容”。
- 保留现有 `saveEditorBlock()` 接口，不扩大 API 面。

**Step 4: 再跑测试**

Run: `pnpm --filter web test --run`

Expected:
- 笔记流交互通过

### Task 5: 收纳 Graph / Debug 到高级入口

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Step 1: 写失败测试**

- 测试 `Advanced` 被打开后才显示：
  - 图谱节点列表
  - 节点详情
  - Agent Steps / Retrieval / Reasoning

**Step 2: 运行测试确认失败**

Run: `pnpm --filter web test --run`

Expected:
- 高级面板不存在

**Step 3: 最小实现**

- 增加 `Advanced` 抽屉或侧面板。
- 将当前图谱与 Debug 内容迁移进去。
- 维持已有 `loadNodeDetail()` 行为。

**Step 4: 再跑测试**

Run: `pnpm --filter web test --run`

Expected:
- 高级入口行为通过

### Task 6: 完整验证

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/App.test.tsx`
- Verify: `apps/api-gateway/src/server.js`
- Verify: `apps/api-gateway/src/server.test.js`

**Step 1: 运行前端测试**

Run: `pnpm --filter web test --run`

Expected:
- 全绿

**Step 2: 运行 API 测试**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected:
- 全绿

**Step 3: 运行前端构建**

Run: `pnpm build:web`

Expected:
- 构建通过

**Step 4: 检查诊断**

Run:
- VS Code diagnostics on changed files

Expected:
- 无新增可归因于本次改动的错误
