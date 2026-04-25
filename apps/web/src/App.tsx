import { useEffect, useMemo, useState } from "react";

import {
  type DashboardData,
  type EditorBlock,
  type GraphNode,
  loadDashboardData,
  loadNodeDetail,
  saveEditorBlock
} from "./lib/api";
import { mockDashboardData } from "./data/mock";

type WorkspaceTab = "Graph" | "Editor" | "Chat";

function TabButton({
  current,
  label,
  onClick
}: {
  current: WorkspaceTab;
  label: WorkspaceTab;
  onClick: (tab: WorkspaceTab) => void;
}) {
  const active = current === label;

  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-indigo-500 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
      onClick={() => onClick(label)}
      type="button"
    >
      {label}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Graph");
  const [dashboard, setDashboard] = useState<DashboardData>(mockDashboardData);
  const [editorBlocks, setEditorBlocks] = useState<EditorBlock[]>(mockDashboardData.workspace.editorBlocks);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(mockDashboardData.workspace.graphNodes[0] ?? null);

  useEffect(() => {
    let cancelled = false;

    loadDashboardData().then((data) => {
      if (!cancelled) {
        setDashboard(data);
        setEditorBlocks(data.workspace.editorBlocks);
        setSelectedNode(data.workspace.graphNodes[0] ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveBlocks = async () => {
    const savedBlocks = await Promise.all(editorBlocks.map((block) => saveEditorBlock(block)));
    setEditorBlocks(savedBlocks);
    setDashboard((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        editorBlocks: savedBlocks
      }
    }));
  };

  const activePanel = useMemo(() => {
    if (activeTab === "Editor") {
      return (
        <div className="space-y-3">
          {editorBlocks.map((block) => (
            <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4" key={block.id}>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500" htmlFor={block.id}>
                {block.id}
              </label>
              <textarea
                aria-label={block.content}
                className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100"
                id={block.id}
                onChange={(event) =>
                  setEditorBlocks((current) =>
                    current.map((item) =>
                      item.id === block.id ? { ...item, content: event.target.value } : item
                    )
                  )
                }
                value={block.content}
              />
            </article>
          ))}
          <button
            className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-slate-950"
            onClick={saveBlocks}
            type="button"
          >
            Save Blocks
          </button>
        </div>
      );
    }

    if (activeTab === "Chat") {
      return (
        <div className="space-y-3">
          {dashboard.workspace.chatMessages.map((message, index) => (
            <article
              className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
              key={`${message.role}-${index}`}
            >
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">{message.role}</p>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.workspace.graphNodes.map((node) => (
            <button
              aria-label={node.label}
              className={`rounded-2xl border p-4 text-left ${
                selectedNode?.id === node.id
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-slate-700 bg-slate-900/70"
              }`}
              key={node.id}
              onClick={async () => {
                const detail = await loadNodeDetail(node.id);
                setSelectedNode(detail ?? node);
              }}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">{node.label}</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{node.type}</span>
              </div>
              <p className="mt-4 text-sm text-slate-400">Confidence: {(node.confidence * 100).toFixed(0)}%</p>
            </button>
          ))}
        </div>

        <aside className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
          <h3 className="text-sm uppercase tracking-[0.2em] text-slate-400">Node Detail</h3>
          {selectedNode ? (
            <div className="mt-3 space-y-3">
              <p className="text-lg font-semibold text-white">{selectedNode.label}</p>
              <p className="text-sm text-slate-300">{selectedNode.summary}</p>
              <p className="text-xs text-slate-500">Storage: {selectedNode.metadata.storageMode}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Select a node to inspect.</p>
          )}
        </aside>
      </div>
    );
  }, [activeTab, dashboard, editorBlocks, selectedNode]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">KnowledgeOS MVP</p>
        <h1 className="mt-2 text-3xl font-semibold">{dashboard.workspace.title}</h1>
      </header>

      <section className="grid min-h-[calc(100vh-92px)] gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-semibold text-white">Sources</h2>
          <p className="mt-2 text-sm text-slate-400">自动采集的知识源与同步状态。</p>
          <div className="mt-4 space-y-3">
            {dashboard.sources.map((source) => (
              <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={source.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{source.name}</h3>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                    {source.mode}
                  </span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{source.status}</p>
                <p className="mt-2 text-sm text-slate-400">{source.count} items</p>
                {source.detail ? <p className="mt-2 text-sm text-slate-500">{source.detail}</p> : null}
              </article>
            ))}
          </div>
        </aside>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Workspace</h2>
              <p className="mt-2 text-sm text-slate-400">Graph、Editor、Chat 三种主工作模式。</p>
            </div>
            <div className="flex gap-2">
              {(["Graph", "Editor", "Chat"] as WorkspaceTab[]).map((tab) => (
                <TabButton current={activeTab} key={tab} label={tab} onClick={setActiveTab} />
              ))}
            </div>
          </div>

          <div className="mt-5">{activePanel}</div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-semibold text-white">AI Debug</h2>
          <p className="mt-2 text-sm text-slate-400">展示 Agent 步骤、检索证据与推理结果。</p>

          <section className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Agent Steps</h3>
            <ul className="mt-3 space-y-2">
              {dashboard.debug.agentSteps.map((step) => (
                <li className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm" key={step}>
                  {step}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Retrieval</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {dashboard.debug.retrieval.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Reasoning</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {dashboard.debug.reasoning.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>
      </section>
    </main>
  );
}
