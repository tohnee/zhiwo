import test from "node:test";
import assert from "node:assert/strict";

import { createGraphService } from "./index.js";

test("returns graph summary with memory storage fallback when Neo4j is unavailable", async () => {
  const service = createGraphService({
    connectNeo4j: async () => {
      throw new Error("Neo4j unavailable");
    }
  });

  const summary = await service.getSummary();

  assert.equal(summary.storageMode, "memory");
  assert.equal(summary.nodes.length > 0, true);
  assert.equal(summary.nodes[0].metadata.storageMode, "memory");
});

test("returns neo4j storage mode when a live client can be created", async () => {
  const service = createGraphService({
    env: {
      NEO4J_URI: "bolt://localhost:7687",
      NEO4J_USERNAME: "neo4j",
      NEO4J_PASSWORD: "password"
    },
    connectNeo4j: async () => ({
      async verifyConnectivity() {
        return true;
      },
      async close() {
        return true;
      }
    })
  });

  const status = await service.getStorageStatus();

  assert.equal(status.mode, "neo4j");
  assert.equal(status.connected, true);
});

test("persists editor blocks and reads node detail through the graph store", async () => {
  const state = {
    blocks: [],
    nodes: [
      {
        id: "n1",
        label: "AI-native OS",
        type: "Concept",
        confidence: 0.96,
        summary: "系统核心定位",
        metadata: { storageMode: "neo4j", sourceIds: ["rss"] }
      }
    ]
  };

  const service = createGraphService({
    env: {
      NEO4J_URI: "bolt://localhost:7687",
      NEO4J_USERNAME: "neo4j",
      NEO4J_PASSWORD: "password"
    },
    connectNeo4j: async () => ({
      async verifyConnectivity() {
        return true;
      },
      async close() {
        return true;
      }
    }),
    adapter: {
      async loadGraphSummary() {
        return {
          title: "Knowledge Graph",
          nodes: state.nodes,
          editorBlocks: state.blocks
        };
      },
      async saveEditorBlock(block) {
        state.blocks = [block];
        return block;
      },
      async getNodeDetail(id) {
        return state.nodes.find((node) => node.id === id) ?? null;
      }
    }
  });

  const saved = await service.saveEditorBlock({
    id: "block-1",
    type: "text",
    content: "Persisted block",
    sourceIds: ["rss"]
  });
  const detail = await service.getNodeDetail("n1");

  assert.equal(saved.content, "Persisted block");
  assert.equal(detail.id, "n1");
});

test("returns source documents and excerpts for the reader", async () => {
  const state = {
    sources: [
      {
        id: "rss",
        title: "Board Memo",
        kind: "rss",
        content: "Board memo content",
        excerpts: [
          {
            id: "excerpt-rss-1",
            title: "Memo excerpt",
            text: "Key insight from the memo",
            sourceId: "rss"
          }
        ]
      }
    ]
  };

  const service = createGraphService({
    adapter: {
      async loadGraphSummary() {
        return { title: "Knowledge Graph", nodes: [], editorBlocks: [] };
      },
      async saveEditorBlock(block) {
        return block;
      },
      async getNodeDetail() {
        return null;
      },
      async listSourceDocuments() {
        return state.sources;
      },
      async getSourceDocument(id) {
        return state.sources.find((source) => source.id === id) ?? null;
      }
    }
  });

  const sources = await service.listSourceDocuments();
  const reader = await service.getSourceDocument("rss");

  assert.equal(sources[0].id, "rss");
  assert.equal(reader.excerpts[0].id, "excerpt-rss-1");
});

test("supports nested note folders and saving answer snapshots into notes", async () => {
  const state = {
    tree: {
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
    }
  };

  const service = createGraphService({
    adapter: {
      async loadGraphSummary() {
        return { title: "Knowledge Graph", nodes: [], editorBlocks: [] };
      },
      async saveEditorBlock(block) {
        return block;
      },
      async getNodeDetail() {
        return null;
      },
      async listSourceDocuments() {
        return [];
      },
      async getSourceDocument() {
        return null;
      },
      async getNoteTree() {
        return state.tree;
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
  });

  const tree = await service.getNoteTree();
  const result = await service.saveAnswerToNote({
    folderId: "folder-ideas",
    title: "Saved answer",
    content: "Answer body",
    citations: []
  });

  assert.equal(tree.children[0].children[0].name, "Ideas");
  assert.equal(result.note.folderId, "folder-ideas");
});

test("loads note documents, updates note content, creates folders and moves notes", async () => {
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

  const service = createGraphService({
    adapter: {
      async loadGraphSummary() {
        return { title: "Knowledge Graph", nodes: [], editorBlocks: [] };
      },
      async saveEditorBlock(block) {
        return block;
      },
      async getNodeDetail() {
        return null;
      },
      async listSourceDocuments() {
        return [];
      },
      async getSourceDocument() {
        return null;
      },
      async getNoteTree() {
        return state.tree;
      },
      async saveAnswerToNote(input) {
        return { note: { id: "note-x", title: input.title, folderId: input.folderId, content: input.content } };
      },
      async getNoteDocument(id) {
        return state.notes.find((note) => note.id === id) ?? null;
      },
      async saveNoteDocument(note) {
        state.notes = state.notes.map((item) => (item.id === note.id ? note : item));
        return note;
      },
      async createNoteFolder(folder) {
        return {
          id: "folder-projects",
          name: folder.name,
          path: `Workspace/${folder.name}`,
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
  });

  const note = await service.getNoteDocument("note-1");
  const updated = await service.saveNoteDocument({
    id: "note-1",
    title: "Ideas",
    folderId: "folder-root",
    content: "Updated",
    citations: []
  });
  const folder = await service.createNoteFolder({ parentId: "folder-root", name: "Projects" });
  const moved = await service.moveNoteDocument({ noteId: "note-1", folderId: "folder-projects" });

  assert.equal(note.id, "note-1");
  assert.equal(updated.content, "Updated");
  assert.equal(folder.name, "Projects");
  assert.equal(moved.folderId, "folder-projects");
});

test("exposes GraphRAG v2 schema with timeline and conflict sections", () => {
  const service = createGraphService();
  const schema = service.getGraphRagSchema();

  assert.ok(schema.entities.includes("Decision"));
  assert.ok(schema.relations.includes("contradicts"));
  assert.equal(schema.timeline.key, "occurredAt");
  assert.equal(schema.conflict.strategy, "rule+agent");
});

test("ingests async event into entities timeline and conflicts", async () => {
  const service = createGraphService();

  const result = await service.ingestEvent({
    id: "im-1",
    source: "telegram",
    occurredAt: "2026-04-26T10:00:00.000Z",
    text: "Apple plan not aligned with Tesla roadmap",
    entities: [
      { id: "entity-apple", label: "Apple", type: "Concept" },
      { id: "entity-tesla", label: "Tesla", type: "Concept" }
    ]
  });

  const timeline = await service.getTimeline(5);
  const conflicts = await service.getConflicts();

  assert.equal(result.entities.length, 2);
  assert.equal(timeline.length > 0, true);
  assert.equal(conflicts.length > 0, true);
});
