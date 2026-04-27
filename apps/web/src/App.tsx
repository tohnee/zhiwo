import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  createNoteFolder,
  type Citation,
  type ChatMessage,
  type DashboardData,
  type GraphNode,
  moveNoteDocument,
  type NoteDocument,
  type NoteFolder,
  type SourceDocument,
  loadDashboardData,
  loadNoteDocument,
  loadNoteTree,
  loadNodeDetail,
  loadSourceDocument,
  saveAnswerToNote,
  saveNoteDocument,
  sendChatPrompt,
  rerunChatWithParameters,
  generateMarkdownReport,
  generatePptDeck,
  ingestImEvent,
  loadDebugRuns,
  loadDebugDiff,
  setDebugBaseline,
  syncConnectors
} from "./lib/api";
import { mockDashboardData } from "./data/mock";

type ConversationEntry = ChatMessage & {
  citations?: Citation[];
};

function ActionButton({
  active = false,
  label,
  onClick
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-indigo-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function notePreview(note: NoteDocument) {
  return note.content.slice(0, 56) || note.id;
}

function insertFolder(tree: NoteFolder, parentId: string, folder: NoteFolder): NoteFolder {
  if (tree.id === parentId) {
    return {
      ...tree,
      children: [...tree.children, folder]
    };
  }

  return {
    ...tree,
    children: tree.children.map((child) => insertFolder(child, parentId, folder))
  };
}

function getFolderName(folderId: string, folders: NoteFolder[]) {
  return folders.find((folder) => folder.id === folderId)?.name ?? "Inbox";
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
        <div className="h-5 w-5 rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
      <span className="text-2xl font-semibold tracking-tight text-slate-900">zhiwo</span>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData>(mockDashboardData);
  const [viewMode, setViewMode] = useState<"library" | "workspace">("library");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(mockDashboardData.workspace.graphNodes[0] ?? null);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(mockDashboardData.workspace.editorBlocks[0]?.id ?? "");
  const [conversation, setConversation] = useState<ConversationEntry[]>(
    mockDashboardData.workspace.chatMessages.map((message) => ({ ...message }))
  );
  const [composerValue, setComposerValue] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<"notes" | "reader">("notes");
  const [selectedSource, setSelectedSource] = useState<SourceDocument | null>(null);
  const [selectedExcerptId, setSelectedExcerptId] = useState<string>("");
  const [noteTree, setNoteTree] = useState<NoteFolder | null>(null);
  const [noteDocuments, setNoteDocuments] = useState<NoteDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("folder-root");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [studioMode, setStudioMode] = useState<
    | "audio-overview"
    | "source-guide"
    | "video-overview"
    | "mind-map"
    | "report"
    | "flashcards"
    | "quiz"
    | "infographic"
    | "data-table"
  >("audio-overview");
  const [debugParams, setDebugParams] = useState({ retrievalTopK: 3, temperature: 0.2, forceLive: false });
  const [debugAudit, setDebugAudit] = useState<{ baselineRunId: string | null; runCount: number; diffSummary: string }>({
    baselineRunId: null,
    runCount: 0,
    diffSummary: "No diff loaded"
  });
  const [syncingConnector, setSyncingConnector] = useState<string>("");
  const [syncSummary, setSyncSummary] = useState<string>("");
  const [syncSince, setSyncSince] = useState<string>("");
  const [syncLimit, setSyncLimit] = useState<string>("50");
  const [syncDryRun, setSyncDryRun] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    loadDashboardData().then((data) => {
      if (!cancelled) {
        setDashboard(data);
        setSelectedNode(data.workspace.graphNodes[0] ?? null);
        setSelectedNoteId(data.workspace.editorBlocks[0]?.id ?? "");
        setConversation(data.workspace.chatMessages.map((message) => ({ ...message })));
      }
    });
    loadNoteTree().then((tree) => {
      if (!cancelled) {
        setNoteTree(tree);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackNotes = useMemo(
    () =>
      dashboard.workspace.editorBlocks.map((block) => ({
        id: block.id,
        title: block.id,
        folderId: "folder-root",
        content: block.content,
        citations: []
      })),
    [dashboard.workspace.editorBlocks]
  );

  const notes = useMemo(() => {
    const byId = new Map<string, NoteDocument>();

    fallbackNotes.forEach((note) => {
      byId.set(note.id, note);
    });
    noteDocuments.forEach((note) => {
      byId.set(note.id, note);
    });

    return [...byId.values()];
  }, [fallbackNotes, noteDocuments]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  );

  const briefing = useMemo(() => {
    const primaryNode = dashboard.workspace.graphNodes[0];
    return primaryNode?.summary ?? "Build a grounded answer from your latest sources.";
  }, [dashboard.workspace.graphNodes]);

  const suggestedPrompts = useMemo(
    () => [
      "Summarize the latest signals",
      "What are the key conflicts?",
      "Turn this into an executive brief"
    ],
    []
  );

  const timelineItems = useMemo(
    () =>
      dashboard.sources.map((source) => ({
        id: source.id,
        label: `${source.name} -> ${source.status}`,
        detail: source.detail || `${source.count} items`
      })),
    [dashboard.sources]
  );

  const summaryItems = useMemo(
    () =>
      dashboard.workspace.graphNodes.map((node) => ({
        id: node.id,
        label: node.label,
        detail: node.summary
      })),
    [dashboard.workspace.graphNodes]
  );

  const studioCards = useMemo(
    () => [
      { id: "audio-overview", label: "音频概览", tone: "bg-[#eef2ff]" },
      { id: "source-guide", label: "源文导航", tone: "bg-[#f6f0dc]" },
      { id: "video-overview", label: "视频概览", tone: "bg-[#e8f5e9]" },
      { id: "mind-map", label: "思维导图", tone: "bg-[#f7ebff]" },
      { id: "report", label: "报告", tone: "bg-[#f5f1e8]" },
      { id: "flashcards", label: "闪卡", tone: "bg-[#fff1ec]" },
      { id: "quiz", label: "测验", tone: "bg-[#e8f4ff]" },
      { id: "infographic", label: "信息图", tone: "bg-[#f4ecff]" },
      { id: "data-table", label: "数据表格", tone: "bg-[#eef1ff]" }
    ],
    []
  );

  const notebookCards = useMemo(
    () => [
      {
        id: "knowledge-graph",
        title: "Knowledge Graph Notebook",
        subtitle: "把多源资料整理成可追溯的研究笔记本",
        meta: `${dashboard.sources.length} 个来源`,
        accent: "from-zinc-700 to-zinc-500"
      },
      {
        id: "board-memo",
        title: "Board Memo Briefing",
        subtitle: "围绕董事会 memo 的问答与沉淀",
        meta: "1 个核心资料",
        accent: "from-stone-700 to-stone-500"
      }
    ],
    [dashboard.sources.length]
  );

  const updateSelectedNote = (content: string) => {
    if (!selectedNote) {
      return;
    }

    const updated = { ...selectedNote, content };
    setNoteDocuments((current) => {
      const existing = current.find((item) => item.id === updated.id);
      return existing
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : [...current, updated];
    });
  };

  const saveSelectedNote = async () => {
    if (!selectedNote) {
      return;
    }

    const saved = await saveNoteDocument(selectedNote);
    setNoteDocuments((current) => {
      const existing = current.find((item) => item.id === saved.id);
      return existing
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
    });
  };

  const openNote = async (noteId: string) => {
    const note = await loadNoteDocument(noteId);

    if (note) {
      setNoteDocuments((current) => {
        const existing = current.find((item) => item.id === note.id);
        return existing
          ? current.map((item) => (item.id === note.id ? note : item))
          : [...current, note];
      });
    }

    setSelectedNoteId(noteId);
    setRightPanel("notes");
  };

  const openSourceReader = async (sourceId: string, excerptId = "") => {
    const source = await loadSourceDocument(sourceId);

    if (!source) {
      return;
    }

    setSelectedSource(source);
    setSelectedExcerptId(excerptId);
    setRightPanel("reader");
  };


  const syncSources = async (connector?: string) => {
    setSyncingConnector(connector ?? "all");
    try {
      const parsedLimit = Number(syncLimit);
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : undefined;
      const result = await syncConnectors({ connector, since: syncSince || undefined, limit, dryRun: syncDryRun });
      const blocked = result.snapshots.filter((snapshot) => snapshot.readiness === "blocked").length;
      setSyncSummary(
        `Sync done: total=${result.summary.total}, success=${result.summary.success}, degraded=${result.summary.degraded}, dryRun=${result.summary.requested?.dryRun ? "yes" : "no"}, blocked=${blocked}, duration=${result.summary.durationMs ?? 0}ms`
      );
      const data = await loadDashboardData();
      setDashboard(data);
    } catch (error) {
      setSyncSummary(error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed");
    } finally {
      setSyncingConnector("");
    }
  };

  const submitPrompt = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const prompt = composerValue.trim();

    if (!prompt) {
      return;
    }

    setConversation((current) => [...current, { role: "user", content: prompt }]);
    setComposerValue("");

    const result = await sendChatPrompt(prompt);
    setConversation((current) => [
      ...current,
      {
        role: "assistant",
        content: result.answer,
        citations: result.citations
      }
    ]);
  };


  const rerunWithDebugParams = async () => {
    const prompt = composerValue.trim() || conversation.at(-1)?.content || "Summarize latest signals";
    const result = await rerunChatWithParameters({
      prompt,
      retrievalTopK: debugParams.retrievalTopK,
      temperature: debugParams.temperature,
      forceLive: debugParams.forceLive,
      outputFormat: "chat"
    });

    setConversation((current) => [
      ...current,
      {
        role: "assistant",
        content: result.answer,
        citations: result.citations
      }
    ]);
  };

  const runImIngestionDemo = async () => {
    await ingestImEvent({
      source: "telegram",
      sender: "demo-user",
      text: "Board Decision not aligned with Revenue Forecast"
    });
    const data = await loadDashboardData();
    setDashboard(data);
  };

  const generateReportToNotes = async () => {
    const topic = composerValue.trim() || "KnowledgeOS board report";
    await generateMarkdownReport(topic);
    const data = await loadDashboardData();
    setDashboard(data);
  };

  const generatePptToNotes = async () => {
    const topic = composerValue.trim() || "KnowledgeOS board deck";
    await generatePptDeck(topic);
    const data = await loadDashboardData();
    setDashboard(data);
  };


  const refreshDebugAudit = async () => {
    const runs = await loadDebugRuns();
    const latest = runs.runs.at(-1);
    const baseline = runs.runs.find((run) => run.id === runs.baselineRunId) ?? runs.runs[0];

    let diffSummary = "No comparable runs";
    if (baseline?.id && latest?.id && baseline.id !== latest.id) {
      const diff = await loadDebugDiff(baseline.id, latest.id);
      diffSummary = `Δcitations ${diff.diff.citationDelta}, Δanswer ${diff.diff.answerLengthDelta}`;
    }

    setDebugAudit({
      baselineRunId: runs.baselineRunId,
      runCount: runs.runs.length,
      diffSummary
    });
  };

  const setLatestAsBaseline = async () => {
    const runs = await loadDebugRuns();
    const latest = runs.runs.at(-1);
    if (!latest) {
      return;
    }

    await setDebugBaseline(latest.id);
    await refreshDebugAudit();
  };

  const flattenedFolders = useMemo(() => {
    if (!noteTree) {
      return [];
    }

    const visit = (folder: NoteFolder): NoteFolder[] => [
      folder,
      ...folder.children.flatMap((child) => visit(child))
    ];

    return visit(noteTree);
  }, [noteTree]);

  const defaultLeafFolder = useMemo(
    () =>
      [...flattenedFolders].reverse().find((folder) => folder.children.length === 0) ??
      flattenedFolders[0] ??
      null,
    [flattenedFolders]
  );

  const selectedFolder = useMemo(
    () => flattenedFolders.find((folder) => folder.id === selectedFolderId) ?? defaultLeafFolder,
    [defaultLeafFolder, flattenedFolders, selectedFolderId]
  );

  useEffect(() => {
    if (!selectedFolderId && defaultLeafFolder) {
      setSelectedFolderId(defaultLeafFolder.id);
      return;
    }

    if (selectedFolderId && !flattenedFolders.some((folder) => folder.id === selectedFolderId) && defaultLeafFolder) {
      setSelectedFolderId(defaultLeafFolder.id);
    }
  }, [defaultLeafFolder, flattenedFolders, selectedFolderId]);

  const saveConversationToNote = async (entry: ConversationEntry) => {
    const result = await saveAnswerToNote({
      folderId: selectedFolder?.id ?? defaultLeafFolder?.id ?? "folder-root",
      title: "Saved answer",
      content: entry.content,
      citations: entry.citations ?? []
    });
    setNoteDocuments((current) => [...current, result.note]);
    setSelectedNoteId(result.note.id);
    setRightPanel("notes");
  };

  const createFolderInTree = async () => {
    const name = newFolderName.trim();
    const parentId = selectedFolder?.id ?? "folder-root";

    if (!name) {
      return;
    }

    const folder = await createNoteFolder({ parentId, name });
    setNoteTree((current) => (current ? insertFolder(current, parentId, folder) : current));
    setSelectedFolderId(folder.id);
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const moveCurrentNoteToFolder = async () => {
    if (!selectedNote || !selectedFolder || selectedNote.folderId === selectedFolder.id) {
      return;
    }

    const moved = await moveNoteDocument({
      noteId: selectedNote.id,
      folderId: selectedFolder.id
    });
    setNoteDocuments((current) => {
      const existing = current.find((item) => item.id === moved.id);
      return existing
        ? current.map((item) => (item.id === moved.id ? moved : item))
        : [...current, moved];
    });
  };

  if (viewMode === "library") {
    return (
      <main className="min-h-screen bg-[#f6f3ee] text-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="flex items-center justify-between">
            <div>
              <Logo />
            </div>
            <div className="rounded-full border border-black/5 bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm">
              {notes.length} notes
            </div>
          </header>

          <section className="mt-12">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">精选笔记本</h1>
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {notebookCards.map((card) => (
                <button
                  aria-label={card.title}
                  className={`overflow-hidden rounded-[28px] bg-gradient-to-br ${card.accent} p-0 text-left text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5`}
                  key={card.id}
                  onClick={() => setViewMode("workspace")}
                  type="button"
                >
                  <div className="flex min-h-64 flex-col justify-end p-6">
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <div className="h-10 w-10 rounded-full border border-white/25 bg-white/10" />
                      <span>{card.subtitle}</span>
                    </div>
                    <p className="mt-4 text-3xl font-semibold leading-tight">{card.title}</p>
                    <div className="mt-5 flex items-center justify-between text-sm text-white/75">
                      <span>{card.meta}</span>
                      <span className="rounded-full border border-white/20 px-3 py-1">Open</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">最近打开的笔记本</h2>
              <button
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm"
                onClick={() => setViewMode("workspace")}
                type="button"
              >
                Continue
              </button>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[...notebookCards, ...notebookCards.slice(0, 1)].map((card, index) => (
                <button
                  aria-label={index === 0 ? card.title : `${card.title} recent ${index}`}
                  className="rounded-[24px] border border-black/5 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
                  key={`${card.id}-${index}`}
                  onClick={() => setViewMode("workspace")}
                  type="button"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-xl">+</div>
                    <span className="text-slate-300">⋮</span>
                  </div>
                  <p className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">{card.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.subtitle}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ee] text-slate-900">
      <header className="border-b border-black/5 bg-[#f6f3ee]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500 shadow-sm"
              onClick={() => setViewMode("library")}
              type="button"
            >
              All notebooks
            </button>
            <div className="mt-3">
              <Logo />
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Knowledge Graph Notebook</h1>
            <p className="mt-2 text-sm text-slate-500">一个围绕来源、对话、工作台与笔记回写组织起来的个人知识工作区。</p>
          </div>
          <div className="flex gap-2">
            <ActionButton active label="Ask" />
            <ActionButton label="Notes" />
            <ActionButton label="Advanced" onClick={() => setIsAdvancedOpen((current) => !current)} />
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl gap-5 p-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="rounded-[28px] border border-black/5 bg-[#fbfaf8] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Library</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">Workspace</span>
          </div>
          <div className="mt-4 rounded-[24px] border border-black/5 bg-white p-4 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Sources</p>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-500"><span>{dashboard.sources.length} loaded</span><button className="rounded-full border border-black/10 bg-[#faf8f4] px-3 py-1 text-xs" onClick={() => { void syncSources(); }} type="button">{syncingConnector === "all" ? "Syncing..." : "Sync All"}</button></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <label className="flex flex-col gap-1">
                <span>Since (ISO)</span>
                <input className="rounded-lg border border-black/10 px-2 py-1" onChange={(event) => setSyncSince(event.target.value)} placeholder="2026-04-26T00:00:00.000Z" value={syncSince} />
              </label>
              <label className="flex flex-col gap-1">
                <span>Limit</span>
                <input className="rounded-lg border border-black/10 px-2 py-1" min={1} onChange={(event) => setSyncLimit(event.target.value)} type="number" value={syncLimit} />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input checked={syncDryRun} onChange={(event) => setSyncDryRun(event.target.checked)} type="checkbox" />
              Dry run (validate only)
            </label>
            <div className="mt-4 space-y-3">
              {dashboard.sources.map((source) => (
                <div
                  aria-label={source.name}
                  className="w-full rounded-2xl border border-black/5 bg-[#faf8f4] p-4 text-left transition hover:bg-white"
                  key={source.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium text-slate-900">{source.name}</h3>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{source.mode}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{source.status}</p>
                  <p className="mt-2 text-sm text-slate-500">{source.count} items</p>
                  <p className="mt-1 text-xs text-slate-400">{source.detail}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-slate-600" onClick={() => { void syncSources(source.kind); }} type="button">{syncingConnector === source.kind ? "Syncing..." : "Sync"}</button>
                    <button aria-label={source.name} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-slate-600" onClick={() => { void openSourceReader(source.id); }} type="button">Open</button>
                    <span className="text-xs text-slate-400">cursor: {source.nextCursor ?? "-"}</span>
                  </div>
                </div>
              ))}
            </div>
            {syncSummary ? <p className="mt-3 text-xs text-slate-500">{syncSummary}</p> : null}
          </div>

          <div className="mt-5 rounded-[24px] border border-black/5 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Folders</h3>
            <div className="mt-3 space-y-2">
              {flattenedFolders.map((folder) => (
                <button
                  className={`w-full rounded-2xl px-3 py-2 text-left text-sm ${
                    selectedFolder?.id === folder.id ? "bg-[#eef2ff] text-slate-900" : "bg-[#faf8f4] text-slate-600"
                  }`}
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  type="button"
                >
                  {folder.path}
                </button>
              ))}
            </div>
            {syncSummary ? <p className="mt-3 text-xs text-slate-500">{syncSummary}</p> : null}
          </div>

          <div className="mt-5 rounded-[24px] border border-black/5 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Files</h3>
            <div className="mt-3 space-y-2">
              {notes.map((note) => (
                <button
                  aria-label={note.title}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selectedNote?.id === note.id
                      ? "border-[#c7d2fe] bg-[#eef2ff]"
                      : "border-black/5 bg-[#faf8f4]"
                  }`}
                  key={note.id}
                  onClick={() => {
                    void openNote(note.id);
                  }}
                  type="button"
                >
                  <p className="text-sm font-medium text-slate-900">{note.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{getFolderName(note.folderId, flattenedFolders)}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-sm">
          <div className="border-b border-black/5 pb-4">
            <h2 className="text-xl font-semibold text-slate-900">Studio</h2>
            <p className="mt-2 text-sm text-slate-500">围绕当前来源进行提问、整理、生成与沉淀的工作台。</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {studioCards.map((card) => (
                <button
                  aria-label={card.label}
                  className={`flex items-center justify-between rounded-2xl border border-black/5 p-4 text-left transition ${
                    studioMode === card.id ? `${card.tone} shadow-sm` : "bg-[#faf8f4]"
                  }`}
                  key={card.id}
                  onClick={() => setStudioMode(card.id as typeof studioMode)}
                  type="button"
                >
                  <span className="text-sm font-medium text-slate-800">{card.label}</span>
                  <span className="text-slate-400">›</span>
                </button>
              ))}
            </div>
          </div>

          <section className="mt-5 rounded-[28px] border border-black/5 bg-[#faf8f4] p-5">
            {studioMode === "audio-overview" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Audio Overview Studio</p>
                <p className="mt-3 text-lg text-slate-900">{briefing}</p>
                <p className="mt-3 text-sm text-slate-500">把当前工作区的核心观点整理为可播报的音频脚本。</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-600 hover:border-indigo-200 hover:text-slate-900"
                      key={prompt}
                      onClick={() => setComposerValue(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {studioMode === "source-guide" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Source Guide Studio</p>
                <div className="mt-4 space-y-3">
                  {dashboard.sources.map((source) => (
                    <div className="rounded-2xl border border-black/5 bg-white p-4" key={source.id}>
                      <p className="text-sm font-medium text-slate-900">{source.name}</p>
                      <p className="mt-2 text-sm text-slate-500">{source.detail || `${source.count} items`}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {studioMode === "video-overview" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Video Overview Studio</p>
                <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">视频分镜建议</p>
                  <p className="mt-2 text-sm text-slate-500">开场概览、关键证据、冲突点、结论与待行动项。</p>
                </div>
              </>
            ) : null}
            {studioMode === "mind-map" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mind Map Studio</p>
                <div className="mt-4 space-y-3">
                  {summaryItems.map((item) => (
                    <div className="rounded-2xl border border-black/5 bg-white p-4" key={item.id}>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {studioMode === "report" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Report Studio</p>
                <div className="mt-4 space-y-3">
                  {timelineItems.map((item) => (
                    <div className="rounded-2xl border border-black/5 bg-white p-4" key={item.id}>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-700" onClick={() => { void runImIngestionDemo(); }} type="button">
                    IM Event → Graph
                  </button>
                  <button className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-700" onClick={() => { void generateReportToNotes(); }} type="button">
                    Generate Markdown Report
                  </button>
                  <button className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-700" onClick={() => { void generatePptToNotes(); }} type="button">
                    Generate PPT Deck
                  </button>
                </div>
              </>
            ) : null}
            {studioMode === "flashcards" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Flashcards Studio</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {summaryItems.map((item) => (
                    <div className="rounded-2xl border border-black/5 bg-white p-4" key={item.id}>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Front</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">Back</p>
                      <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {studioMode === "quiz" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quiz Studio</p>
                <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">问题 1</p>
                  <p className="mt-2 text-sm text-slate-500">当前资料中最关键的概念冲突是什么？</p>
                </div>
              </>
            ) : null}
            {studioMode === "infographic" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Infographic Studio</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sources</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.sources.length}</p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Notes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{notes.length}</p>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Nodes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dashboard.workspace.graphNodes.length}</p>
                  </div>
                </div>
              </>
            ) : null}
            {studioMode === "data-table" ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Data Table Studio</p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-black/5 bg-white">
                  <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] border-b border-black/5 bg-[#faf8f4] px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Source</span>
                    <span>Status</span>
                    <span>Count</span>
                  </div>
                  {dashboard.sources.map((source) => (
                    <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] px-4 py-3 text-sm text-slate-600" key={source.id}>
                      <span>{source.name}</span>
                      <span>{source.status}</span>
                      <span>{source.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="mt-5 space-y-3">
            {conversation.map((message, index) => (
              <article
                className={`rounded-3xl border p-4 ${
                  message.role === "assistant"
                    ? "border-black/5 bg-[#faf8f4]"
                    : "border-indigo-100 bg-[#eef2ff]/60"
                }`}
                key={`${message.role}-${index}-${message.content}`}
              >
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-400">{message.role}</p>
                <p className="text-sm text-slate-800">{message.content}</p>
                {message.citations?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.citations.map((citation) => (
                      <button
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-slate-600"
                        key={citation.excerptId}
                        onClick={() => {
                          void openSourceReader(citation.sourceId, citation.excerptId);
                        }}
                        type="button"
                      >
                        {citation.preview}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.role === "assistant" ? (
                  <button
                    className="mt-3 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700"
                    onClick={() => {
                      void saveConversationToNote(message);
                    }}
                    type="button"
                  >
                    Save to Note
                  </button>
                ) : null}
              </article>
            ))}
          </section>

          <form className="mt-5 rounded-[28px] border border-black/5 bg-[#faf8f4] p-4" onSubmit={submitPrompt}>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="composer">
              Ask from your notebook
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-slate-900"
                id="composer"
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder="Ask about your sources..."
                value={composerValue}
              />
              <button
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white"
                type="submit"
              >
                Send
              </button>
              <button
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-slate-700"
                onClick={() => {
                  void rerunWithDebugParams();
                }}
                type="button"
              >
                Rerun
              </button>
              <button
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-slate-700"
                onClick={() => {
                  void refreshDebugAudit();
                }}
                type="button"
              >
                Load Diff
              </button>
            </div>
          </form>
        </section>

        <aside className="rounded-[28px] border border-black/5 bg-[#fbfaf8] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">{rightPanel === "reader" ? "Source Reader" : "Notes"}</h2>
            <div className="flex gap-2">
              <ActionButton active={rightPanel === "notes"} label="Notes" onClick={() => setRightPanel("notes")} />
              <ActionButton active={rightPanel === "reader"} label="Reader" onClick={() => setRightPanel("reader")} />
            </div>
          </div>
          {rightPanel === "reader" ? (
            <div className="mt-4 space-y-4">
              {selectedSource ? (
                <>
                  <div className="rounded-2xl border border-black/5 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{selectedSource.title}</p>
                    <p className="mt-2 text-sm text-slate-500">{selectedSource.content}</p>
                  </div>
                  <div className="space-y-2">
                    {selectedSource.excerpts.map((excerpt) => (
                      <button
                        className={`w-full rounded-2xl border p-3 text-left ${
                          selectedExcerptId === excerpt.id
                            ? "border-indigo-200 bg-[#eef2ff]"
                            : "border-black/5 bg-white"
                        }`}
                        key={excerpt.id}
                        onClick={() => setSelectedExcerptId(excerpt.id)}
                        type="button"
                      >
                        <p className="text-sm font-medium text-slate-900">{excerpt.title}</p>
                        <p className="mt-2 text-sm text-slate-500">{excerpt.text}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Select a source or citation to open the reader.</p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">右侧保持可编辑笔记流，支持把阅读中的内容持续沉淀到当前笔记。</p>
              {flattenedFolders.length ? (
                <div className="mt-4 space-y-2">
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="save-folder">
                    Save folder
                  </label>
                  <select
                    aria-label="Save folder"
                    className="w-full rounded-2xl border border-black/10 bg-white p-3 text-sm text-slate-900"
                    id="save-folder"
                    onChange={(event) => setSelectedFolderId(event.target.value)}
                    value={selectedFolder?.id ?? ""}
                  >
                    {flattenedFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.path}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-700"
                      onClick={() => setIsCreatingFolder((current) => !current)}
                      type="button"
                    >
                      New folder
                    </button>
                    {selectedNote ? (
                      <button
                        className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-700"
                        onClick={() => {
                          void moveCurrentNoteToFolder();
                        }}
                        type="button"
                      >
                        Move current note
                      </button>
                    ) : null}
                  </div>
                  {isCreatingFolder ? (
                    <div className="space-y-2 rounded-2xl border border-black/5 bg-white p-3">
                      <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="folder-name">
                        Folder name
                      </label>
                      <input
                        aria-label="Folder name"
                        className="w-full rounded-2xl border border-black/10 bg-[#faf8f4] px-3 py-2 text-sm text-slate-900"
                        id="folder-name"
                        onChange={(event) => setNewFolderName(event.target.value)}
                        value={newFolderName}
                      />
                      <button
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        onClick={() => {
                          void createFolderInTree();
                        }}
                        type="button"
                      >
                        Create folder
                      </button>
                    </div>
                  ) : null}
                  {flattenedFolders.map((folder) => (
                    <p className="rounded-2xl border border-black/5 bg-white p-3 text-sm text-slate-600" key={folder.id}>
                      {folder.path}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 space-y-2">
                {notes.map((note) => (
                  <button
                    aria-label={note.title}
                    className={`w-full rounded-2xl border p-3 text-left ${
                      selectedNote?.id === note.id
                        ? "border-indigo-400 bg-indigo-500/10"
                        : "border-slate-800 bg-slate-950/70"
                    }`}
                    key={note.id}
                    onClick={() => {
                      void openNote(note.id);
                    }}
                    type="button"
                  >
                    <p className="text-sm font-medium text-white">{note.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{notePreview(note)}</p>
                  </button>
                ))}
              </div>
              {selectedNote ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="selected-note">
                    Current note
                  </label>
                  <textarea
                    aria-label="Current note"
                    className="min-h-48 w-full rounded-2xl border border-black/10 bg-white p-3 text-sm text-slate-900"
                    id="selected-note"
                    onChange={(event) => updateSelectedNote(event.target.value)}
                    value={selectedNote.content}
                  />
                  <button
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    onClick={saveSelectedNote}
                    type="button"
                  >
                    Save current note
                  </button>
                  {selectedNote.citations.length ? (
                    <div className="space-y-2 rounded-2xl border border-black/5 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Backlinks</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNote.citations.map((citation) => (
                          <button
                            className="rounded-full border border-black/10 bg-[#faf8f4] px-3 py-1 text-xs text-slate-600"
                            key={`${selectedNote.id}-${citation.excerptId}`}
                            onClick={() => {
                              void openSourceReader(citation.sourceId, citation.excerptId);
                            }}
                            type="button"
                          >
                            {citation.preview} backlink
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </aside>
      </section>

      {isAdvancedOpen ? (
        <aside className="fixed inset-y-0 right-0 z-10 w-full max-w-xl overflow-y-auto border-l border-black/5 bg-[#fbfaf8]/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Advanced</h2>
              <p className="mt-2 text-sm text-slate-500">保留 KnowledgeOS 的图谱与可解释调试能力，但不再占主界面。</p>
            </div>
            <button
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-600"
              onClick={() => setIsAdvancedOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Graph View</h3>
            <div className="mt-3 grid gap-3">
              {dashboard.workspace.graphNodes.map((node) => (
                <button
                  aria-label={node.label}
                  className={`rounded-2xl border p-4 text-left ${
                    selectedNode?.id === node.id
                      ? "border-indigo-200 bg-[#eef2ff]"
                      : "border-black/5 bg-white"
                  }`}
                  key={node.id}
                  onClick={async () => {
                    const detail = await loadNodeDetail(node.id);
                    setSelectedNode(detail ?? node);
                  }}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-slate-900">{node.label}</span>
                    <span className="rounded-full bg-[#faf8f4] px-3 py-1 text-xs text-slate-500">{node.type}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Confidence: {(node.confidence * 100).toFixed(0)}%</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400">Node Detail</h3>
            {selectedNode ? (
              <div className="mt-3 space-y-3">
                <p className="text-lg font-semibold text-slate-900">{selectedNode.label}</p>
                <p className="text-sm text-slate-600">{selectedNode.summary}</p>
                <p className="text-xs text-slate-500">Storage: {selectedNode.metadata.storageMode}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a node to inspect.</p>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-black/5 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">AI Debug</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <label className="space-y-1 text-slate-500">
                <span>TopK</span>
                <input className="w-full rounded-xl border border-black/10 px-2 py-1" type="number" min={1} value={debugParams.retrievalTopK} onChange={(event) => setDebugParams((current) => ({ ...current, retrievalTopK: Number(event.target.value) }))} />
              </label>
              <label className="space-y-1 text-slate-500">
                <span>Temp</span>
                <input className="w-full rounded-xl border border-black/10 px-2 py-1" type="number" step="0.1" min={0} max={1} value={debugParams.temperature} onChange={(event) => setDebugParams((current) => ({ ...current, temperature: Number(event.target.value) }))} />
              </label>
              <label className="flex items-end gap-2 rounded-xl border border-black/10 bg-[#faf8f4] px-2 py-1 text-slate-500">
                <input type="checkbox" checked={debugParams.forceLive} onChange={(event) => setDebugParams((current) => ({ ...current, forceLive: event.target.checked }))} />
                <span>Force Live</span>
              </label>
            </div>
            <ul className="mt-3 space-y-2">
              {dashboard.debug.agentSteps.map((step) => (
                <li className="rounded-2xl border border-black/5 bg-[#faf8f4] p-3 text-sm text-slate-700" key={step}>
                  {step}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {dashboard.debug.retrieval.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {dashboard.debug.reasoning.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-black/5 bg-[#faf8f4] p-3 text-xs text-slate-600">
              <p>Baseline: {debugAudit.baselineRunId ?? "none"}</p>
              <p>Runs: {debugAudit.runCount}</p>
              <p>{debugAudit.diffSummary}</p>
              <button className="mt-2 rounded-full border border-black/10 bg-white px-3 py-1" onClick={() => { void setLatestAsBaseline(); }} type="button">
                Set latest as baseline
              </button>
            </div>
          </section>
        </aside>
      ) : null}
    </main>
  );
}
