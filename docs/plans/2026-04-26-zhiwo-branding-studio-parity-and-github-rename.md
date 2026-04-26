# Zhiwo Branding Studio Parity And GitHub Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将产品统一改名为 `zhiwo`，移除首页与工作区中的竞品字眼，补齐更接近目标图的 Studio 能力入口，并将 GitHub 仓库从 `Almanack` 直接改名为 `zhiwo`。

**Architecture:** 保留现有 `NoteDocument-first` 和 `source -> studio -> note -> reader` 主链路，只在前端新增一个更完整的 Studio capability grid 与相关视图状态。品牌层统一替换为 `zhiwo`，文档与 README 同步更新；发布层通过 GitHub 仓库重命名和 remote 同步完成。

**Tech Stack:** React, Vite, TypeScript, Vitest, Node.js, GitHub CLI

---

### Task 1: 品牌文案统一为 zhiwo

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `README.md`

**Step 1: Write the failing test**

在 `apps/web/src/App.test.tsx` 增加断言：
- 首页出现 `zhiwo`
- 首页不再出现 `NotebookLM`
- workspace 不再出现 `KnowledgeOS`、`Obsidian`、`Notion`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because current UI still contains those labels.

**Step 3: Write minimal implementation**

- 首页头部改为仅显示 `zhiwo` 标识
- workspace 顶部、副标题与说明文字全部替换为中性产品文案
- `README.md` 标题与项目名改为 `zhiwo`

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 2: 补齐更完整的 Studio 能力矩阵

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

在 `apps/web/src/App.test.tsx` 增加失败测试，要求 workspace 中的 `Studio` 至少具备这些入口：
- `音频概览`
- `源文导航`
- `视频概览`
- `思维导图`
- `报告`
- `闪卡`
- `测验`
- `信息图`
- `数据表格`

并验证点击其中几个入口后会切换出对应的内容区。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL because current Studio 只有 `Summary/Timeline/Briefing` 三个入口。

**Step 3: Write minimal implementation**

- 把 `studioView` 扩展为 capability grid
- 保留原有 `Summary/Timeline/Briefing` 能力，但映射进更完整的 Studio 能力区
- 新增轻量内容面板：audio overview、source guide、video overview、mind map、report、flashcards、quiz、infographic、data table
- 不做真正音频/视频生成，只做真实 UI 能力入口和 grounded 内容展示

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 3: 对照现有链路补齐保存与回跳兼容

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

增加失败测试，要求：
- 在新的 Studio 布局下仍然可以提问、保存到 note、从 note backlink 回跳 reader
- `Save folder`、`New folder`、`Move current note` 仍然可用

**Step 2: Run test to verify it fails**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: FAIL if studio 重构破坏现有 phase-3 主链路。

**Step 3: Write minimal implementation**

- 保持 composer、conversation、save-to-note、folder picker、backlink 的位置与状态联动
- 如果布局变化导致按钮重复或不可见，做最小收敛

**Step 4: Run test to verify it passes**

Run: `pnpm --filter web test --run src/App.test.tsx`

Expected: PASS

### Task 4: 全量验证并准备发布

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/App.test.tsx`
- Verify: `README.md`

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

Expected:
- no newly introduced diagnostics

### Task 5: GitHub 仓库改名并上传

**Files:**
- Modify: `.git/config` via git remote update
- Modify: GitHub repository metadata

**Step 1: Verify git status**

Run: `git status --short`

Expected:
- changes understood before publishing

**Step 2: Rename repository on GitHub**

Run with `gh repo rename zhiwo`

Expected:
- GitHub repo changes from `Almanack` to `zhiwo`

**Step 3: Update remote URL**

Run:
- `git remote set-url origin https://github.com/tohnee/zhiwo.git`

**Step 4: Push current branch**

Run:
- `git push origin main`

Expected:
- latest local changes uploaded to renamed repo
