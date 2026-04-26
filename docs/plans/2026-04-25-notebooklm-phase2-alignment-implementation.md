# NotebookLM Phase 2 Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 KnowledgeOS 第二阶段对齐 NotebookLM 的核心阅读与笔记闭环，包括 source reader、citation 回跳、回答转笔记、Studio 视图切换和多级目录笔记体系。

**Architecture:** 基于现有 `apps/web + apps/api-gateway + services/graph-service` 架构扩展，不新引入独立存储层。用 `Neo4j` 统一建模 `SourceDocument / SourceExcerpt / NoteFolder / NoteDocument / AnswerSnapshot`，前端默认工作流继续保持 `Sources / Studio / Notes`，并把 `Reader` 与 `Notes` 做右侧联动切换。

**Tech Stack:** React, Vite, TypeScript, Node.js HTTP server, node:test, Vitest, Neo4j

---

### Task 1: 为 source reader 与 excerpt 建立图模型

**Files:**
- Modify: `services/graph-service/src/neo4j.js`
- Modify: `services/graph-service/src/index.js`
- Modify: `services/graph-service/src/index.test.js`
- Modify: `packages/shared/src/types.js`

**Step 1: Write the failing test**

在 `services/graph-service/src/index.test.js` 增加失败测试：

```js
test("returns source documents and excerpts for the reader", async () => {
  const graphService = createGraphService({ adapter: fakeAdapter });
  const sources = await graphService.listSourceDocuments();
  const reader = await graphService.getSourceDocument("rss");

  assert.equal(sources[0].id, "rss");
  assert.equal(reader.excerpts[0].id, "excerpt-rss-1");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test services/graph-service/src/index.test.js`

Expected: FAIL because `listSourceDocuments` / `getSourceDocument` do not exist.

**Step 3: Write minimal implementation**

- 在 `graph-service` 中新增：
  - `listSourceDocuments()`
  - `getSourceDocument(id)`
- 在 memory adapter 中返回静态 source + excerpt 数据
- 在 `neo4j.js` 中补：
  - `ensureNeo4jSourceData()`
  - `loadSourceDocumentsFromNeo4j()`
  - `getSourceDocumentFromNeo4j()`

**Step 4: Run test to verify it passes**

Run: `node --test services/graph-service/src/index.test.js`

Expected: PASS

### Task 2: 给 API 增加 reader 与 structured citations

**Files:**
- Modify: `apps/api-gateway/src/server.js`
- Modify: `apps/api-gateway/src/server.test.js`
- Modify: `services/agent-service/src/index.js`
- Modify: `services/agent-service/src/index.test.js`

**Step 1: Write the failing test**

在 `apps/api-gateway/src/server.test.js` 中增加：

```js
test("source reader endpoint returns source content and excerpts", async () => {
  const response = await fetch(`${baseUrl}/api/source/rss`);
  const payload = await response.json();
  assert.equal(payload.source.id, "rss");
  assert.equal(payload.source.excerpts[0].id, "excerpt-rss-1");
});
```

再为 chat 增加失败测试：

```js
test("chat endpoint returns structured citations", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, { ... });
  const payload = await response.json();
  assert.equal(payload.citations[0].excerptId, "excerpt-rss-1");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: FAIL because endpoint and structured citation payload are missing.

**Step 3: Write minimal implementation**

- 新增 `GET /api/source/:id`
- `POST /api/chat` 的 `citations` 从 `string[]` 升级为对象数组
- agent fallback / live 返回值补齐 `sourceId / excerptId / label / preview`

**Step 4: Run test to verify it passes**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: PASS

### Task 3: 前端补 source reader 与 citation 回跳

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

在 `apps/web/src/App.test.tsx` 中增加失败测试，覆盖：

```tsx
it("opens source reader and jumps to an excerpt from a citation", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Board Memo" }));
  expect(await screen.findByText("Source Reader")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Memo excerpt" }));
  expect(await screen.findByText("Highlighted excerpt")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because there is no reader state or citation click behavior.

**Step 3: Write minimal implementation**

- `api.ts` 新增 `loadSourceDocument(id)`
- `App.tsx` 增加：
  - `selectedSourceId`
  - `selectedExcerptId`
  - 右侧 `Reader / Notes` 切换
- 点击 source 卡片打开 reader
- 点击 citation chip 跳转到 reader 并高亮 excerpt

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 4: 回答一键转笔记与多级目录树

**Files:**
- Modify: `services/graph-service/src/neo4j.js`
- Modify: `services/graph-service/src/index.js`
- Modify: `services/graph-service/src/index.test.js`
- Modify: `apps/api-gateway/src/server.js`
- Modify: `apps/api-gateway/src/server.test.js`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

图服务测试：

```js
test("supports nested note folders and saving answer snapshots into notes", async () => {
  const tree = await graphService.getNoteTree();
  assert.equal(tree.children[0].children[0].name, "Research");
});
```

API 测试：

```js
test("save-to-note endpoint creates a note in a nested folder", async () => {
  const response = await fetch(`${baseUrl}/api/answer/save-to-note`, { ... });
  const payload = await response.json();
  assert.equal(payload.note.folderId, "folder-research");
});
```

前端测试：

```tsx
it("saves an answer into a selected nested note folder", async () => {
  fireEvent.click(screen.getByRole("button", { name: "Save to Note" }));
  expect(await screen.findByText("Research/Ideas")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run:
- `node --test services/graph-service/src/index.test.js`
- `node --test apps/api-gateway/src/server.test.js`
- `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because note folders and save-to-note behavior do not exist.

**Step 3: Write minimal implementation**

- 图模型新增：
  - `NoteFolder`
  - `NoteDocument`
  - `AnswerSnapshot`
- 图服务新增：
  - `getNoteTree()`
  - `getNoteDocument(id)`
  - `createNoteFolder()`
  - `saveAnswerToNote()`
  - `moveNoteDocument()`
- API 新增：
  - `GET /api/notes/tree`
  - `GET /api/note/:id`
  - `POST /api/note/folder`
  - `POST /api/answer/save-to-note`
- 前端右侧 `Notes` 改为目录树 + 选中文件编辑

**Step 4: Run test to verify it passes**

Run:
- `node --test services/graph-service/src/index.test.js`
- `node --test apps/api-gateway/src/server.test.js`
- `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 5: Studio 视图切换

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

```tsx
it("switches between summary, timeline and briefing views", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(screen.getByText("Timeline View")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because only one Studio view exists.

**Step 3: Write minimal implementation**

- `Studio` 顶部新增：
  - `Summary`
  - `Timeline`
  - `Briefing`
- 用现有 graph/chat/source 数据做 3 个视图映射

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 6: Full verification

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/lib/api.ts`
- Verify: `apps/api-gateway/src/server.js`
- Verify: `services/graph-service/src/index.js`
- Verify: `services/graph-service/src/neo4j.js`

**Step 1: Run graph-service tests**

Run: `node --test services/graph-service/src/index.test.js`

Expected: PASS

**Step 2: Run API tests**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: PASS

**Step 3: Run web tests**

Run: `pnpm --filter web test --run`

Expected: PASS

**Step 4: Run web build**

Run: `pnpm build:web`

Expected: PASS

**Step 5: Check diagnostics**

Run:
- diagnostics on changed files

Expected:
- no newly introduced diagnostics
