# NoteDocument Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 KnowledgeOS 第三阶段切换到 `NoteDocument` 主模型，补齐目录选择器、文件夹操作、真实 note 打开编辑和 note 中的 citation 回链。

**Architecture:** 保留现有 `source reader / structured citations / note tree` 基础设施，但把右侧 `Notes` 从 `EditorBlock + savedNotes` 过渡到统一的 `NoteDocument` 数据流。后端以 `graph-service` 为中心扩展 `NoteFolder / NoteDocument / AnswerSnapshot / REFERENCES` 图模型，前端右侧区域改为“目录树 + 当前 note 编辑器 + citation back-links”三段式结构。

**Tech Stack:** React, Vite, TypeScript, Node.js HTTP server, node:test, Vitest, Neo4j

---

### Task 1: 为 NoteDocument 主模型补齐 graph-service 查询与编辑接口

**Files:**
- Modify: `services/graph-service/src/index.js`
- Modify: `services/graph-service/src/neo4j.js`
- Modify: `services/graph-service/src/index.test.js`
- Modify: `packages/shared/src/types.js`

**Step 1: Write the failing test**

在 `services/graph-service/src/index.test.js` 增加失败测试：

```js
test("loads note documents, updates note content and creates folders", async () => {
  const note = await service.getNoteDocument("note-1");
  const updated = await service.saveNoteDocument({ id: "note-1", title: "Ideas", content: "Updated" });
  const folder = await service.createNoteFolder({ parentId: "folder-root", name: "Projects" });

  assert.equal(note.id, "note-1");
  assert.equal(updated.content, "Updated");
  assert.equal(folder.name, "Projects");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test services/graph-service/src/index.test.js`

Expected: FAIL because `getNoteDocument/saveNoteDocument/createNoteFolder` do not exist.

**Step 3: Write minimal implementation**

- `graph-service` 新增：
  - `getNoteDocument(id)`
  - `saveNoteDocument(note)`
  - `createNoteFolder({ parentId, name })`
  - `moveNoteDocument({ noteId, folderId })`
- `neo4j.js` 新增相应 Cypher 读写
- memory adapter 同步补最小实现

**Step 4: Run test to verify it passes**

Run: `node --test services/graph-service/src/index.test.js`

Expected: PASS

### Task 2: 扩展 API 为 NoteDocument-first

**Files:**
- Modify: `apps/api-gateway/src/server.js`
- Modify: `apps/api-gateway/src/server.test.js`

**Step 1: Write the failing test**

在 `apps/api-gateway/src/server.test.js` 增加失败测试：

```js
test("note endpoints load, update and create folders", async () => {
  const note = await fetch(`${baseUrl}/api/note/note-1`);
  const tree = await fetch(`${baseUrl}/api/notes/tree`);
  const folder = await fetch(`${baseUrl}/api/note/folder`, { method: "POST", ... });
  const saved = await fetch(`${baseUrl}/api/note`, { method: "POST", ... });

  assert.equal(note.status, 200);
  assert.equal(folder.status, 200);
  assert.equal(saved.status, 200);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: FAIL because note CRUD routes are missing.

**Step 3: Write minimal implementation**

- 新增：
  - `GET /api/note/:id`
  - `POST /api/note`
  - `POST /api/note/folder`
  - `POST /api/note/move`
- 让 `save-to-note` 返回可直接打开的 `NoteDocument`

**Step 4: Run test to verify it passes**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: PASS

### Task 3: 前端切到 NoteDocument 主模型

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

在 `apps/web/src/App.test.tsx` 增加失败测试：

```tsx
it("opens a note document from the tree and saves edits through note APIs", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Saved answer" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Current note" }), {
    target: { value: "Updated note body" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save current note" }));
  expect(await screen.findByDisplayValue("Updated note body")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because the UI still edits `EditorBlock`, not `NoteDocument`.

**Step 3: Write minimal implementation**

- `api.ts` 新增：
  - `loadNoteDocument(id)`
  - `saveNoteDocument(note)`
  - `createNoteFolder(input)`
  - `moveNoteDocument(input)`
- `App.tsx`：
  - 右侧状态改为 `selectedNoteDocument`
  - 左侧目录树点击后打开 note
  - 编辑器改用 `Current note`
  - `EditorBlock` 只保留 fallback/兼容显示，不再是主编辑模型

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 4: 目录选择器与文件夹操作

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

**Step 1: Write the failing test**

```tsx
it("creates a folder and lets save-to-note target a selected folder", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "New folder" }));
  fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Projects" } });
  fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Save to Note" }).at(-1)!);
  expect(await screen.findByText("Workspace/Projects")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because there is no folder creation UI or folder picker.

**Step 3: Write minimal implementation**

- 右侧目录树增加：
  - `New folder`
  - `Folder name` input
  - `Create folder`
- `Save to Note` 旁边增加当前目标目录选择器
- 目录选择默认沿用当前选中的 folder

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 5: Note 中的 citation back-links

**Files:**
- Modify: `services/graph-service/src/neo4j.js`
- Modify: `services/graph-service/src/index.js`
- Modify: `services/graph-service/src/index.test.js`
- Modify: `apps/api-gateway/src/server.js`
- Modify: `apps/api-gateway/src/server.test.js`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

```tsx
it("opens reader from a citation backlink inside the note editor", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Saved answer" }));
  fireEvent.click(await screen.findByRole("button", { name: "Memo excerpt backlink" }));
  expect(await screen.findByText("Source Reader")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because note documents do not yet expose citation references.

**Step 3: Write minimal implementation**

- `saveAnswerToNote` 写入 note 与 excerpt 引用关系
- `getNoteDocument` 返回 `citations[]`
- note 编辑区渲染 backlink buttons
- 点击 backlink 调用现有 `openSourceReader(sourceId, excerptId)`

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

**Step 2: Run agent-service tests**

Run: `node --test services/agent-service/src/index.test.js`

Expected: PASS

**Step 3: Run API tests**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: PASS

**Step 4: Run web tests**

Run: `pnpm --filter web test --run`

Expected: PASS

**Step 5: Run web build**

Run: `pnpm build:web`

Expected: PASS

**Step 6: Check diagnostics**

Run:
- diagnostics on changed files

Expected:
- no newly introduced diagnostics
