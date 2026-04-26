import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "./server.js";

function createStubAgentService(mode = "fallback") {
  return {
    async run(prompt) {
      return {
        answer: `${mode === "live" ? "Live" : "Grounded"} summary for "${prompt}"`,
        mode,
        citations: [
          {
            label: "AI-native OS",
            sourceId: "rss",
            excerptId: "excerpt-rss-1",
            preview: "The team positions KnowledgeOS as an AI-native operating layer."
          }
        ],
        steps: [
          { agent: "Planner", intent: prompt },
          { agent: "Retriever" },
          { agent: "Critic" }
        ]
      };
    }
  };
}

async function withServer(run, options = {}) {
  const server = createServer({
    agentService: createStubAgentService(),
    ...options
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test("health endpoint returns ready status", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { status: "ok", service: "knowledgeos-api" });
  });
});

test("dashboard endpoint returns workspace and debug data", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/dashboard`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.workspace.title, "Knowledge Graph");
    assert.equal(payload.sources[0].name, "Telegram");
    assert.equal(payload.sources[0].kind, "telegram");
    assert.equal(payload.sources[0].mode, "degraded");
    assert.ok(payload.workspace.graphNodes[0].metadata);
    assert.ok(payload.workspace.graphNodes[0].metadata.storageMode);
    assert.ok(payload.workspace.editorBlocks[0].id);
    assert.ok(payload.debug.agentSteps[0].startsWith("Planner"));
  });
});

test("dashboard debug retrieval reports neo4j storage mode when summary omits top-level storageMode", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/dashboard`);
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.ok(payload.debug.retrieval.includes("Storage mode: neo4j"));
    },
    {
      graphService: {
        async getSummary() {
          return {
            title: "Knowledge Graph",
            nodes: [
              {
                id: "n1",
                label: "AI-native OS",
                type: "Concept",
                confidence: 0.96,
                summary: "系统核心定位",
                metadata: { storageMode: "neo4j", sourceIds: ["rss", "pdf"] }
              }
            ],
            editorBlocks: [
              {
                id: "block-1",
                type: "text",
                content: "Persisted block",
                sourceIds: ["rss"]
              }
            ]
          };
        },
        async saveEditorBlock(block) {
          return block;
        },
        async getNodeDetail(id) {
          return {
            id,
            label: "AI-native OS",
            type: "Concept",
            confidence: 0.96,
            summary: "系统核心定位",
            metadata: { storageMode: "neo4j", sourceIds: ["rss", "pdf"] }
          };
        }
      }
    }
  );
});

test("ingest endpoint appends a new source snapshot", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "wechat", items: 7 })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(payload.message, /^Synced wechat/);
    assert.equal(payload.dashboard.sources.at(-1).count, 7);
  });
});

test("chat endpoint returns a grounded answer", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Summarize today" })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(payload.answer, /Summarize today/);
    assert.ok(payload.steps[0].startsWith("Planner"));
    assert.equal(payload.citations[0].excerptId, "excerpt-rss-1");
  });
});

test("source reader endpoint returns source content and excerpts", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/source/rss`);
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.source.id, "rss");
      assert.equal(payload.source.excerpts[0].id, "excerpt-rss-1");
    },
    {
      graphService: {
        async getSummary() {
          return {
            title: "Knowledge Graph",
            nodes: [],
            editorBlocks: []
          };
        },
        async saveEditorBlock(block) {
          return block;
        },
        async getNodeDetail() {
          return null;
        },
        async getSourceDocument(id) {
          return {
            id,
            title: "Board Memo",
            kind: "rss",
            content: "Board memo content",
            excerpts: [
              {
                id: "excerpt-rss-1",
                sourceId: "rss",
                title: "Memo excerpt",
                text: "Key insight from the memo",
                order: 1
              }
            ]
          };
        }
      }
    }
  );
});

test("save-to-note endpoint creates a note in a nested folder", async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/answer/save-to-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: "folder-research",
          title: "Saved answer",
          content: "Answer body",
          citations: []
        })
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.note.folderId, "folder-research");
    },
    {
      graphService: {
        async getSummary() {
          return { title: "Knowledge Graph", nodes: [], editorBlocks: [] };
        },
        async saveEditorBlock(block) {
          return block;
        },
        async getNodeDetail() {
          return null;
        },
        async getSourceDocument() {
          return null;
        },
        async saveAnswerToNote(input) {
          return {
            note: {
              id: "note-1",
              title: input.title,
              folderId: input.folderId,
              content: input.content
            }
          };
        }
      }
    }
  );
});

test("note endpoints load, update, move and create folders", async () => {
  const state = {
    tree: {
      id: "folder-root",
      name: "Workspace",
      path: "Workspace",
      children: []
    },
    notes: [
      {
        id: "note-1",
        title: "Ideas",
        folderId: "folder-root",
        content: "Original content",
        citations: []
      }
    ]
  };

  await withServer(
    async (baseUrl) => {
      const noteResponse = await fetch(`${baseUrl}/api/note/note-1`);
      const notePayload = await noteResponse.json();

      const folderResponse = await fetch(`${baseUrl}/api/note/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: "folder-root",
          name: "Projects"
        })
      });
      const folderPayload = await folderResponse.json();

      const saveResponse = await fetch(`${baseUrl}/api/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "note-1",
          title: "Ideas",
          folderId: "folder-root",
          content: "Updated content",
          citations: []
        })
      });
      const savePayload = await saveResponse.json();

      const moveResponse = await fetch(`${baseUrl}/api/note/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteId: "note-1",
          folderId: "folder-projects"
        })
      });
      const movePayload = await moveResponse.json();

      assert.equal(noteResponse.status, 200);
      assert.equal(notePayload.note.id, "note-1");
      assert.equal(folderResponse.status, 200);
      assert.equal(folderPayload.folder.id, "folder-projects");
      assert.equal(saveResponse.status, 200);
      assert.equal(savePayload.note.content, "Updated content");
      assert.equal(moveResponse.status, 200);
      assert.equal(movePayload.note.folderId, "folder-projects");
    },
    {
      graphService: {
        async getSummary() {
          return { title: "Knowledge Graph", nodes: [], editorBlocks: [] };
        },
        async saveEditorBlock(block) {
          return block;
        },
        async getNodeDetail() {
          return null;
        },
        async getSourceDocument() {
          return null;
        },
        async getNoteTree() {
          return state.tree;
        },
        async getNoteDocument(id) {
          return state.notes.find((note) => note.id === id) ?? null;
        },
        async saveNoteDocument(note) {
          state.notes = state.notes.map((item) => (item.id === note.id ? note : item));
          return note;
        },
        async createNoteFolder(input) {
          return {
            id: "folder-projects",
            name: input.name,
            path: "Workspace/Projects",
            children: []
          };
        },
        async moveNoteDocument({ noteId, folderId }) {
          const existing = state.notes.find((note) => note.id === noteId);
          const moved = { ...existing, folderId };
          state.notes = state.notes.map((note) => (note.id === noteId ? moved : note));
          return moved;
        }
      }
    }
  );
});

test("editor update and graph node detail endpoints return persisted workspace changes", async () => {
  await withServer(async (baseUrl) => {
    const updateResponse = await fetch(`${baseUrl}/api/editor/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "block-1", content: "Updated thesis block" })
    });
    const updatePayload = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updatePayload.block.content, "Updated thesis block");

    const detailResponse = await fetch(`${baseUrl}/api/graph/node/n1`);
    const detailPayload = await detailResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.equal(detailPayload.node.id, "n1");
    assert.ok(detailPayload.node.summary);
  });
});

test("chat endpoint reports live mode when llm is configured", async () => {
  await withServer(
    async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Run live mode" })
    });
    const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.mode, "live");
    },
    { agentService: createStubAgentService("live") }
  );
});
