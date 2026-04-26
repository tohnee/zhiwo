import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("./lib/api", () => ({
  loadDashboardData: vi.fn().mockResolvedValue({
    sources: [
      {
        id: "telegram",
        name: "Telegram",
        kind: "telegram",
        status: "credentials_missing",
        mode: "degraded",
        detail: "Missing credentials",
        count: 12
      },
      {
        id: "pdf",
        name: "Board Memo",
        kind: "pdf",
        status: "indexed",
        mode: "live",
        detail: "Quarterly strategy memo",
        count: 1
      }
    ],
    workspace: {
      title: "Knowledge Graph",
      graphNodes: [
        {
          id: "a",
          label: "AI-native OS",
          type: "Concept",
          confidence: 0.96,
          summary: "系统核心定位",
          metadata: { storageMode: "memory", sourceIds: ["telegram"] }
        }
      ],
      editorBlocks: [
        { id: "block-1", type: "text", content: "Block one", sourceIds: ["telegram"] },
        { id: "block-2", type: "text", content: "Block two", sourceIds: ["pdf"] }
      ],
      chatMessages: [{ role: "assistant", content: "Ready to reason." }]
    },
    debug: {
      agentSteps: ["Planner -> Retriever -> Critic"],
      retrieval: ["Telegram summary"],
      reasoning: ["Evidence aligned"]
    }
  }),
  saveEditorBlock: vi.fn().mockImplementation(async (block) => block),
  sendChatPrompt: vi.fn().mockImplementation(async (prompt) => ({
    answer: `Grounded answer for ${prompt}`,
    mode: "live",
    citations: [
      {
        label: "Board Memo",
        sourceId: "pdf",
        excerptId: "excerpt-pdf-1",
        preview: "Memo excerpt"
      },
      {
        label: "Telegram",
        sourceId: "telegram",
        excerptId: "excerpt-telegram-1",
        preview: "Telegram excerpt"
      }
    ],
    steps: ["Planner -> scope", "Retriever -> evidence", "Critic -> validate"]
  })),
  loadSourceDocument: vi.fn().mockImplementation(async (sourceId) => ({
    id: sourceId,
    title: sourceId === "pdf" ? "Board Memo" : "Telegram",
    kind: sourceId,
    content: sourceId === "pdf" ? "Board memo content" : "Telegram source content",
    excerpts: [
      {
        id: sourceId === "pdf" ? "excerpt-pdf-1" : "excerpt-telegram-1",
        sourceId,
        title: sourceId === "pdf" ? "Memo excerpt" : "Telegram excerpt",
        text: sourceId === "pdf" ? "Highlighted excerpt" : "Telegram detail excerpt",
        order: 1
      }
    ]
  })),
  loadNoteTree: vi.fn().mockResolvedValue({
    id: "folder-root",
    name: "Workspace",
    path: "Workspace",
    children: [
      {
        id: "folder-research",
        name: "Research",
        path: "Workspace/Research",
        children: [
          {
            id: "folder-ideas",
            name: "Ideas",
            path: "Workspace/Research/Ideas",
            children: []
          }
        ]
      }
    ]
  }),
  createNoteFolder: vi.fn().mockImplementation(async ({ parentId, name }) => ({
    id: "folder-projects",
    name,
    path: parentId === "folder-root" ? `Workspace/${name}` : `Workspace/Research/${name}`,
    children: []
  })),
  moveNoteDocument: vi.fn().mockImplementation(async ({ noteId, folderId }) => ({
    id: noteId,
    title: "Saved answer",
    folderId,
    content: "Moved note body",
    citations: []
  })),
  saveAnswerToNote: vi.fn().mockImplementation(async ({ folderId, content, citations = [] }) => ({
    note: {
      id: "note-1",
      title: "Saved answer",
      folderId,
      content,
      citations
    }
  })),
  loadNoteDocument: vi.fn().mockImplementation(async (id) => ({
    id,
    title: "Saved answer",
    folderId: "folder-ideas",
    content: "Loaded note body",
    citations: [
      {
        label: "Board Memo",
        sourceId: "pdf",
        excerptId: "excerpt-pdf-1",
        preview: "Memo excerpt"
      }
    ]
  })),
  saveNoteDocument: vi.fn().mockImplementation(async (note) => note),
  loadNodeDetail: vi.fn().mockImplementation(async () => ({
    id: "a",
    label: "AI-native OS",
    type: "Concept",
    confidence: 0.96,
    summary: "系统核心定位",
    metadata: { storageMode: "neo4j", sourceIds: ["telegram"] }
  }))
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  async function openWorkspace() {
    await waitFor(() => expect(screen.getByText("精选笔记本")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Knowledge Graph Notebook" })[0]);
    await waitFor(() => expect(screen.getByText("Studio")).toBeInTheDocument());
  }

  it("renders a notebook library first and opens a notebook workspace from a card", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("精选笔记本")).toBeInTheDocument());
    expect(screen.getByText("zhiwo")).toBeInTheDocument();
    expect(screen.queryByText("NotebookLM")).not.toBeInTheDocument();
    expect(screen.getByText("最近打开的笔记本")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Knowledge Graph Notebook" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Knowledge Graph Notebook" })[0]);

    await waitFor(() => expect(screen.getByText("Studio")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByText(/KnowledgeOS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Obsidian/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Notion/i)).not.toBeInTheDocument();
  });

  it("renders a notebooklm-style source, studio, notes and advanced workflow", async () => {
    render(<App />);

    await openWorkspace();

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getAllByText("Board Memo").length).toBeGreaterThan(0);
    expect(screen.getByText("degraded")).toBeInTheDocument();
    expect(screen.getByText("Ready to reason.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Grounded answer for Summarize the memo")).toBeInTheDocument());
    expect(screen.getAllByText("Board Memo").length).toBeGreaterThan(0);

    const textbox = screen.getByRole("textbox", { name: "Current note" });
    fireEvent.change(textbox, { target: { value: "Updated block" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current note" }));
    expect(screen.getByDisplayValue("Updated block")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByText("Graph View")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI-native OS" }));
    expect(screen.getAllByText("系统核心定位").length).toBeGreaterThan(0);
    expect(screen.getByText("Planner -> Retriever -> Critic")).toBeInTheDocument();
  });

  it("opens source reader and jumps to an excerpt from a citation", async () => {
    render(<App />);

    await openWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Board Memo" }));
    expect(await screen.findByText("Source Reader")).toBeInTheDocument();
    expect(screen.getByText("Board memo content")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    const citationButton = await screen.findByRole("button", { name: "Memo excerpt" });
    fireEvent.click(citationButton);

    expect(await screen.findByText("Highlighted excerpt")).toBeInTheDocument();
  });

  it("saves an answer into a selected nested note folder", async () => {
    render(<App />);

    await openWorkspace();

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Grounded answer for Summarize the memo");
    const saveButtons = screen.getAllByRole("button", { name: "Save to Note" });
    fireEvent.click(saveButtons.at(-1)!);

    await waitFor(() => expect(screen.getAllByText("Workspace/Research/Ideas").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText("Saved answer").length).toBeGreaterThan(0));
  });

  it("switches between summary, timeline and briefing views", async () => {
    render(<App />);

    await openWorkspace();

    expect(screen.getByRole("button", { name: "音频概览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "源文导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "视频概览" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "思维导图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "报告" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "闪卡" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "测验" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "信息图" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "数据表格" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "报告" }));
    expect(screen.getByText("Report Studio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "思维导图" }));
    expect(screen.getByText("Mind Map Studio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "数据表格" }));
    expect(screen.getByText("Data Table Studio")).toBeInTheDocument();
  });

  it("opens a note document from the tree and saves edits through note APIs", async () => {
    render(<App />);

    await openWorkspace();

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Grounded answer for Summarize the memo");

    const saveButtons = screen.getAllByRole("button", { name: "Save to Note" });
    fireEvent.click(saveButtons.at(-1)!);

    fireEvent.click((await screen.findAllByRole("button", { name: "Saved answer" }))[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Current note" }), {
      target: { value: "Updated note body" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current note" }));

    expect(await screen.findByDisplayValue("Updated note body")).toBeInTheDocument();
  });

  it("creates a folder and lets save-to-note target a selected folder", async () => {
    render(<App />);

    await openWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "Projects" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));

    const folderPicker = screen.getByLabelText("Save folder");
    fireEvent.change(folderPicker, { target: { value: "folder-projects" } });

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Grounded answer for Summarize the memo");

    const message = screen
      .getByText("Grounded answer for Summarize the memo")
      .closest("article");
    const saveButton = within(message as HTMLElement).getByRole("button", { name: "Save to Note" });
    fireEvent.click(saveButton);

    await waitFor(() => expect(screen.getAllByText("Workspace/Projects").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Saved answer" }).length).toBeGreaterThan(0));
  });

  it("opens reader from a citation backlink inside the note editor", async () => {
    render(<App />);

    await openWorkspace();

    fireEvent.change(screen.getByPlaceholderText("Ask about your sources..."), {
      target: { value: "Summarize the memo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Grounded answer for Summarize the memo");

    const saveButtons = screen.getAllByRole("button", { name: "Save to Note" });
    fireEvent.click(saveButtons.at(-1)!);
    fireEvent.click((await screen.findAllByRole("button", { name: "Saved answer" }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Memo excerpt backlink" }));

    expect(await screen.findByText("Source Reader")).toBeInTheDocument();
    expect(await screen.findByText("Highlighted excerpt")).toBeInTheDocument();
  });
});
