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
