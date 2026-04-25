import { mockDashboardData } from "../data/mock";

export interface SourceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  mode: string;
  detail: string;
  count: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  summary: string;
  metadata: {
    storageMode: string;
    sourceIds: string[];
  };
}

export interface EditorBlock {
  id: string;
  type: string;
  content: string;
  sourceIds: string[];
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface DashboardData {
  sources: SourceItem[];
  workspace: {
    title: string;
    graphNodes: GraphNode[];
    editorBlocks: EditorBlock[];
    chatMessages: ChatMessage[];
  };
  debug: {
    agentSteps: string[];
    retrieval: string[];
    reasoning: string[];
  };
}

const API_BASE_URL = "http://localhost:8787";

export async function loadDashboardData(): Promise<DashboardData> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/dashboard`);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as DashboardData;
  } catch {
    return mockDashboardData;
  }
}

export async function saveEditorBlock(block: EditorBlock): Promise<EditorBlock> {
  const response = await fetch(`${API_BASE_URL}/api/editor/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block)
  });

  if (!response.ok) {
    throw new Error(`Save failed: ${response.status}`);
  }

  const payload = (await response.json()) as { block: EditorBlock };
  return payload.block;
}

export async function loadNodeDetail(nodeId: string): Promise<GraphNode | null> {
  const response = await fetch(`${API_BASE_URL}/api/graph/node/${nodeId}`);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { node: GraphNode };
  return payload.node;
}
