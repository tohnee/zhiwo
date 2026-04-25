import type { DashboardData } from "../lib/api";

export const mockDashboardData: DashboardData = {
  sources: [
    {
      id: "telegram",
      name: "Telegram",
      kind: "telegram",
      status: "credentials_missing",
      mode: "degraded",
      detail: "Telegram credentials are missing from the environment.",
      count: 0
    },
    {
      id: "rss",
      name: "RSS Feed",
      kind: "rss",
      status: "connected",
      mode: "live",
      detail: "",
      count: 5
    },
    {
      id: "pdf",
      name: "PDF Library",
      kind: "pdf",
      status: "indexed",
      mode: "live",
      detail: "",
      count: 1
    }
  ],
  workspace: {
    title: "Knowledge Graph",
    graphNodes: [
      {
        id: "n1",
        label: "AI-native OS",
        type: "Concept",
        confidence: 0.96,
        summary: "系统核心定位",
        metadata: { storageMode: "memory", sourceIds: ["rss", "pdf"] }
      },
      {
        id: "n2",
        label: "Graph Workspace",
        type: "Feature",
        confidence: 0.89,
        summary: "可视化知识交互界面",
        metadata: { storageMode: "memory", sourceIds: ["rss"] }
      },
      {
        id: "n3",
        label: "Decision Engine",
        type: "Agent",
        confidence: 0.83,
        summary: "驱动 Planner / Retriever / Critic",
        metadata: { storageMode: "memory", sourceIds: ["pdf"] }
      }
    ],
    editorBlocks: [
      { id: "block-1", type: "text", content: "Graph + Chat + Editor 三位一体。", sourceIds: ["rss"] },
      { id: "block-2", type: "text", content: "所有输出都支持回溯与重算。", sourceIds: ["pdf"] },
      {
        id: "block-3",
        type: "text",
        content: "MVP 阶段使用本地 mock data 保证演示完整链路。",
        sourceIds: ["rss", "pdf"]
      }
    ],
    chatMessages: [
      { role: "assistant", content: "Ready to reason." },
      { role: "user", content: "Summarize the latest signals." }
    ]
  },
  debug: {
    agentSteps: [
      "Planner -> Scope the request",
      "Retriever -> Pull graph evidence",
      "Critic -> Validate the narrative"
    ],
    retrieval: ["Telegram summary", "Podcast digest", "Document citations"],
    reasoning: ["Evidence aligned", "Timeline merged", "Conflicts flagged"]
  }
};
