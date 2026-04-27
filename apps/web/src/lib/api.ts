import { mockDashboardData } from "../data/mock";

export interface ConnectorCatalogItem {
  id: string;
  name: string;
  kind: string;
  syncMode: string;
  status: string;
}

export interface ConnectorSyncSnapshot {
  kind: string;
  mode: string;
  readiness?: "ready" | "blocked";
  cursor: string | number | null;
  lastSyncedAt?: string | null;
  items: unknown[];
  reason?: string;
  error?: string | null;
  stats?: {
    count: number;
    durationMs: number;
  };
}

export interface SourceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  mode: string;
  detail: string;
  count: number;
  lastSyncedAt?: string;
  nextCursor?: string | number | null;
  error?: string | null;
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

export interface Citation {
  label: string;
  sourceId: string;
  excerptId: string;
  preview: string;
}

export interface SourceExcerpt {
  id: string;
  sourceId: string;
  title: string;
  text: string;
  order: number;
}

export interface SourceDocument {
  id: string;
  title: string;
  kind: string;
  content: string;
  excerpts: SourceExcerpt[];
}

export interface NoteFolder {
  id: string;
  name: string;
  path: string;
  children: NoteFolder[];
}

export interface NoteDocument {
  id: string;
  title: string;
  folderId: string;
  content: string;
  citations: Citation[];
}

export interface ChatResponse {
  answer: string;
  mode: string;
  steps: string[];
  citations: Citation[];
}


export interface AgentRunParameters {
  retrievalTopK: number;
  temperature: number;
  forceLive: boolean;
  outputFormat: string;
}

export interface ChatReplayResponse {
  answer: string;
  mode: string;
  parameters: AgentRunParameters;
  steps: Array<{ agent: string; intent?: string; output?: unknown }>;
  citations: Citation[];
}

export interface DebugRunRecord {
  id: string;
  prompt: string;
  answer: string;
  mode: string;
  createdAt: string;
  parameters: AgentRunParameters;
}

export interface GeneratedArtifactResponse {
  saved: {
    artifact: {
      id: string;
      format: string;
      title: string;
      content: string;
      citations: Citation[];
    };
  };
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

export async function loadSourceDocument(sourceId: string): Promise<SourceDocument | null> {
  const response = await fetch(`${API_BASE_URL}/api/source/${sourceId}`);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { source: SourceDocument };
  return payload.source;
}

export async function loadNoteTree(): Promise<NoteFolder | null> {
  const response = await fetch(`${API_BASE_URL}/api/notes/tree`);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { tree: NoteFolder };
  return payload.tree;
}

export async function saveAnswerToNote(input: {
  folderId: string;
  title: string;
  content: string;
  citations: Citation[];
}): Promise<{ note: NoteDocument }> {
  const response = await fetch(`${API_BASE_URL}/api/answer/save-to-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Save to note failed: ${response.status}`);
  }

  return (await response.json()) as { note: NoteDocument };
}

export async function loadNoteDocument(noteId: string): Promise<NoteDocument | null> {
  const response = await fetch(`${API_BASE_URL}/api/note/${noteId}`);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { note: NoteDocument };
  return payload.note;
}

export async function saveNoteDocument(note: NoteDocument): Promise<NoteDocument> {
  const response = await fetch(`${API_BASE_URL}/api/note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note)
  });

  if (!response.ok) {
    throw new Error(`Save note failed: ${response.status}`);
  }

  const payload = (await response.json()) as { note: NoteDocument };
  return payload.note;
}

export async function createNoteFolder(input: {
  parentId: string;
  name: string;
}): Promise<NoteFolder> {
  const response = await fetch(`${API_BASE_URL}/api/note/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Create folder failed: ${response.status}`);
  }

  const payload = (await response.json()) as { folder: NoteFolder };
  return payload.folder;
}

export async function moveNoteDocument(input: {
  noteId: string;
  folderId: string;
}): Promise<NoteDocument> {
  const response = await fetch(`${API_BASE_URL}/api/note/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Move note failed: ${response.status}`);
  }

  const payload = (await response.json()) as { note: NoteDocument };
  return payload.note;
}

export async function sendChatPrompt(prompt: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status}`);
  }

  return (await response.json()) as ChatResponse;
}


export async function rerunChatWithParameters(input: {
  prompt: string;
  retrievalTopK?: number;
  temperature?: number;
  forceLive?: boolean;
  outputFormat?: string;
}): Promise<ChatReplayResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Chat rerun failed: ${response.status}`);
  }

  return (await response.json()) as ChatReplayResponse;
}

export async function ingestImEvent(input: {
  source: string;
  threadId?: string;
  sender?: string;
  text: string;
  occurredAt?: string;
}): Promise<{ queued: string; processed: number }> {
  const response = await fetch(`${API_BASE_URL}/api/ingest/im-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`IM ingest failed: ${response.status}`);
  }

  return (await response.json()) as { queued: string; processed: number };
}

export async function generateMarkdownReport(topic: string): Promise<GeneratedArtifactResponse> {
  const response = await fetch(`${API_BASE_URL}/api/generate/report-markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  });

  if (!response.ok) {
    throw new Error(`Report generation failed: ${response.status}`);
  }

  return (await response.json()) as GeneratedArtifactResponse;
}

export async function generatePptDeck(topic: string): Promise<GeneratedArtifactResponse> {
  const response = await fetch(`${API_BASE_URL}/api/generate/ppt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  });

  if (!response.ok) {
    throw new Error(`PPT generation failed: ${response.status}`);
  }

  return (await response.json()) as GeneratedArtifactResponse;
}


export async function loadDebugRuns(): Promise<{ baselineRunId: string | null; runs: DebugRunRecord[] }> {
  const response = await fetch(`${API_BASE_URL}/api/debug/runs`);

  if (!response.ok) {
    throw new Error(`Load debug runs failed: ${response.status}`);
  }

  return (await response.json()) as { baselineRunId: string | null; runs: DebugRunRecord[] };
}

export async function loadDebugDiff(from: string, to: string): Promise<{
  diff: {
    from: string | null;
    to: string | null;
    citationDelta: number;
    answerLengthDelta: number;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/api/debug/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

  if (!response.ok) {
    throw new Error(`Load debug diff failed: ${response.status}`);
  }

  return (await response.json()) as {
    diff: {
      from: string | null;
      to: string | null;
      citationDelta: number;
      answerLengthDelta: number;
    };
  };
}

export async function setDebugBaseline(runId: string): Promise<{ baselineRunId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/debug/baseline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId })
  });

  if (!response.ok) {
    throw new Error(`Set debug baseline failed: ${response.status}`);
  }

  return (await response.json()) as { baselineRunId: string };
}


export async function loadConnectorCatalog(): Promise<{ connectors: ConnectorCatalogItem[] }> {
  const response = await fetch(`${API_BASE_URL}/api/connectors/catalog`);

  if (!response.ok) {
    throw new Error(`Load connector catalog failed: ${response.status}`);
  }

  return (await response.json()) as { connectors: ConnectorCatalogItem[] };
}

export async function syncConnectors(input: {
  connector?: string;
  cursor?: string | number | null;
  since?: string;
  limit?: number;
  dryRun?: boolean;
} = {}): Promise<{
  snapshots: ConnectorSyncSnapshot[];
  summary: {
    requested?: {
      connector: string | null;
      cursor: string | number | null;
      since: string | null;
      limit: number | null;
      dryRun: boolean;
    };
    total: number;
    success: number;
    degraded: number;
    failed: number;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/api/connectors/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Sync connectors failed: ${response.status}`);
  }

  return (await response.json()) as {
    snapshots: ConnectorSyncSnapshot[];
    summary: {
      requested?: {
        connector: string | null;
        cursor: string | number | null;
        since: string | null;
        limit: number | null;
        dryRun: boolean;
      };
      total: number;
      success: number;
      degraded: number;
      failed: number;
      startedAt?: string;
      completedAt?: string;
      durationMs?: number;
    };
  };
}
