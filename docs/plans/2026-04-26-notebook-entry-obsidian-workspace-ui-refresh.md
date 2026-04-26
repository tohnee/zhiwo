# Notebook Entry And Workspace UI Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前单页工作台升级为“NotebookLM 风格首页入口 + Obsidian 式组织 + Notion/Claude 风格视觉”的完整预览版。

**Architecture:** 保留现有 API 和 NoteDocument-first 数据流，在前端增加两层 UI：顶部是 Notebook Library 入口页，点击后进入 Notebook Workspace。Workspace 内部采用 Obsidian 风格左侧导航与目录组织，中央保留 NotebookLM 式问答 Studio，右侧保留 Source Reader / Current Note 双态，并统一到更轻、更温和的 Notion/Claude 风格。

**Tech Stack:** React, Vite, TypeScript, Vitest, existing API helpers

---

### Task 1: 为 Notebook 首页入口写失败测试

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

在 `apps/web/src/App.test.tsx` 增加失败测试，要求：
- 初始先看到 `精选笔记本`
- 看到 notebook 卡片和 `最近打开`
- 点击 notebook 卡片后进入 workspace
- workspace 中看到 `Studio` 与 `Notes`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because current app still lands directly in the workspace.

**Step 3: Write minimal implementation**

- `App.tsx` 增加 `viewMode = "library" | "workspace"`
- 从现有 source/note 数据派生 notebook 卡片数据
- 初始渲染 library，点击卡片进入 workspace

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 2: 重做 Workspace 壳层与视觉风格

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

增加失败测试，要求：
- workspace 左侧出现 Obsidian 风格的 `Library / Folders / Notes`
- 中间区保留 `Studio`
- 右侧区显示 `Reader / Current Note`
- 顶部出现 notebook 标题、返回首页入口

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because current layout is still the old three-column shell.

**Step 3: Write minimal implementation**

- 调整 `App.tsx` 页面结构：
  - 顶部更轻量 header
  - 左侧柔和浅色边栏
  - 中央内容卡片化
  - 右侧 reader/note 面板白卡化
- 用更接近 Notion/Claude 的浅底、柔边、低对比卡片替换原深色大面积背景

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 3: 把文件夹组织与 backlink 融入新界面

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

**Step 1: Write the failing test**

增加失败测试，要求：
- 左侧 sidebar 中能看到层级文件夹
- `New folder`、`Save folder`、`Move current note` 仍可用
- 打开 note 后能看到 backlink 区块并跳到 reader

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because the new shell does not yet preserve all phase-3 note interactions.

**Step 3: Write minimal implementation**

- 将现有 folder picker、new folder、move note、backlinks 搬入新 layout
- 用 sidebar tree + details panel 的方式重组
- 保持现有 API helper 不变或只做最小补充

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 4: 全量验证并启动预览

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/App.test.tsx`
- Verify: `apps/web/src/lib/api.ts`

**Step 1: Run web tests**

Run: `pnpm --filter web test --run`

Expected: PASS

**Step 2: Run API tests**

Run: `node --test apps/api-gateway/src/server.test.js`

Expected: PASS

**Step 3: Run web build**

Run: `pnpm build:web`

Expected: PASS

**Step 4: Check diagnostics**

Run:
- diagnostics on changed files

Expected:
- no newly introduced diagnostics

**Step 5: Start preview**

Run:
- `node apps/api-gateway/src/server.js`
- `pnpm --filter web dev --host 0.0.0.0`

Expected:
- local preview URL available for review
