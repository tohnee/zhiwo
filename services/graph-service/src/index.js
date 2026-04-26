import {
  createEditorBlock,
  createGraphNode,
  createNoteDocument,
  createNoteFolder,
  createSourceDocument,
  createSourceExcerpt,
  hasNeo4jConfig
} from "@knowledgeos/shared";

import {
  createNeo4jClient,
  createNoteFolderInNeo4j,
  getNoteDocumentFromNeo4j,
  getNoteTreeFromNeo4j,
  moveNoteDocumentInNeo4j,
  getSourceDocumentFromNeo4j,
  getNodeDetailFromNeo4j,
  loadGraphSummaryFromNeo4j,
  saveNoteDocumentToNeo4j,
  saveAnswerToNeo4j,
  loadSourceDocumentsFromNeo4j,
  saveEditorBlockToNeo4j
} from "./neo4j.js";

function buildMemorySourceDocuments() {
  return [
    createSourceDocument({
      id: "rss",
      title: "Board Memo",
      kind: "rss",
      content:
        "Board memo content. The team positions KnowledgeOS as an AI-native operating layer for personal research workflows.",
      excerpts: [
        createSourceExcerpt({
          id: "excerpt-rss-1",
          sourceId: "rss",
          title: "Memo excerpt",
          text: "The team positions KnowledgeOS as an AI-native operating layer for personal research workflows.",
          order: 1
        }),
        createSourceExcerpt({
          id: "excerpt-rss-2",
          sourceId: "rss",
          title: "Workflow excerpt",
          text: "Source ingestion, graph grounding and note capture should remain traceable end to end.",
          order: 2
        })
      ]
    }),
    createSourceDocument({
      id: "pdf",
      title: "Research Dossier",
      kind: "pdf",
      content:
        "Research dossier content. PDF evidence captures product principles, citations and durable references for later note synthesis.",
      excerpts: [
        createSourceExcerpt({
          id: "excerpt-pdf-1",
          sourceId: "pdf",
          title: "Dossier excerpt",
          text: "PDF evidence captures product principles, citations and durable references for later note synthesis.",
          order: 1
        })
      ]
    })
  ];
}

function buildMemoryNoteTree() {
  return createNoteFolder({
    id: "folder-root",
    name: "Workspace",
    path: "Workspace",
    children: [
      createNoteFolder({
        id: "folder-research",
        name: "Research",
        path: "Workspace/Research",
        children: [
          createNoteFolder({
            id: "folder-ideas",
            name: "Ideas",
            path: "Workspace/Research/Ideas",
            children: []
          })
        ]
      })
    ]
  });
}

function buildMemorySummary() {
  return {
    storageMode: "memory",
    title: "Knowledge Graph",
    nodes: [
      createGraphNode({
        id: "n1",
        label: "AI-native OS",
        type: "Concept",
        confidence: 0.96,
        summary: "系统核心定位",
        metadata: { storageMode: "memory", sourceIds: ["rss", "pdf"] }
      }),
      createGraphNode({
        id: "n2",
        label: "RSS Signals",
        type: "Source",
        confidence: 0.82,
        summary: "来自订阅源的信息流",
        metadata: { storageMode: "memory", sourceIds: ["rss"] }
      }),
      createGraphNode({
        id: "n3",
        label: "Document Evidence",
        type: "Evidence",
        confidence: 0.74,
        summary: "来自 PDF 的证据条目",
        metadata: { storageMode: "memory", sourceIds: ["pdf"] }
      })
    ],
    editorBlocks: [
      createEditorBlock({
        id: "block-1",
        content: "持续吸收信息流并结构化为知识图谱。",
        sourceIds: ["rss", "pdf"]
      }),
      createEditorBlock({
        id: "block-2",
        content: "RSS 与 PDF 已经纳入真实 connector 规划。",
        sourceIds: ["rss", "pdf"]
      })
    ]
  };
}

export function createGraphService({
  env = process.env,
  connectNeo4j = createNeo4jClient,
  adapter = null
} = {}) {
  let memorySummary = buildMemorySummary();
  const memorySourceDocuments = buildMemorySourceDocuments();
  const memoryNoteTree = buildMemoryNoteTree();
  let memoryNotes = [
    createNoteDocument({
      id: "note-block-1",
      title: "Block one",
      folderId: "folder-ideas",
      content: memorySummary.editorBlocks[0]?.content ?? "",
      citations: []
    })
  ];

  function createDefaultAdapter() {
    return {
      async loadGraphSummary(storageMode) {
        return {
          ...memorySummary,
          storageMode,
          nodes: memorySummary.nodes.map((node) => ({
            ...node,
            metadata: { ...node.metadata, storageMode }
          }))
        };
      },
      async saveEditorBlock(block) {
        const existing = memorySummary.editorBlocks.find((item) => item.id === block.id);
        memorySummary = {
          ...memorySummary,
          editorBlocks: existing
            ? memorySummary.editorBlocks.map((item) => (item.id === block.id ? block : item))
            : [...memorySummary.editorBlocks, block]
        };
        return block;
      },
      async getNodeDetail(id) {
        return memorySummary.nodes.find((node) => node.id === id) ?? null;
      },
      async listSourceDocuments() {
        return memorySourceDocuments;
      },
      async getSourceDocument(id) {
        return memorySourceDocuments.find((source) => source.id === id) ?? null;
      },
      async getNoteTree() {
        return memoryNoteTree;
      },
      async saveAnswerToNote({ folderId, title, content, citations = [] }) {
        const note = createNoteDocument({
          id: `note-${memoryNotes.length + 1}`,
          title,
          folderId,
          content,
          citations
        });
        memoryNotes = [...memoryNotes, note];
        return { note };
      },
      async getNoteDocument(id) {
        return memoryNotes.find((note) => note.id === id) ?? null;
      },
      async saveNoteDocument(note) {
        const saved = createNoteDocument(note);
        memoryNotes = memoryNotes.map((item) => (item.id === saved.id ? saved : item));
        return saved;
      },
      async createNoteFolder({ parentId, name }) {
        const parent = parentId === "folder-root" ? memoryNoteTree : memoryNoteTree.children.find((child) => child.id === parentId);
        return createNoteFolder({
          id: `folder-${name.toLowerCase()}`,
          name,
          path: `${parent?.path ?? "Workspace"}/${name}`,
          children: []
        });
      },
      async moveNoteDocument({ noteId, folderId }) {
        const existing = memoryNotes.find((note) => note.id === noteId);
        if (!existing) {
          return null;
        }

        const moved = createNoteDocument({ ...existing, folderId });
        memoryNotes = memoryNotes.map((note) => (note.id === noteId ? moved : note));
        return moved;
      }
    };
  }

  const activeAdapter = adapter ?? createDefaultAdapter();

  return {
    async getStorageStatus() {
      if (!hasNeo4jConfig(env)) {
        return { mode: "memory", connected: false, reason: "Neo4j env is missing." };
      }

      try {
        const client = await connectNeo4j(env);

        if (!client) {
          return { mode: "memory", connected: false, reason: "Neo4j driver unavailable." };
        }

        if (typeof client.close === "function") {
          await client.close();
        }

        return { mode: "neo4j", connected: true, reason: "" };
      } catch (error) {
        return { mode: "memory", connected: false, reason: error.message };
      }
    },

    async getSummary() {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await loadGraphSummaryFromNeo4j(driver);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.loadGraphSummary(storage.mode);
    },

    async saveEditorBlock(block) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await saveEditorBlockToNeo4j(driver, block);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.saveEditorBlock(block);
    },

    async getNodeDetail(id) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await getNodeDetailFromNeo4j(driver, id);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.getNodeDetail(id);
    },

    async listSourceDocuments() {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await loadSourceDocumentsFromNeo4j(driver);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.listSourceDocuments(storage.mode);
    },

    async getSourceDocument(id) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await getSourceDocumentFromNeo4j(driver, id);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.getSourceDocument(id, storage.mode);
    },

    async getNoteTree() {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await getNoteTreeFromNeo4j(driver);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.getNoteTree(storage.mode);
    },

    async saveAnswerToNote(input) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await saveAnswerToNeo4j(driver, input);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.saveAnswerToNote(input, storage.mode);
    },

    async getNoteDocument(id) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await getNoteDocumentFromNeo4j(driver, id);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.getNoteDocument(id, storage.mode);
    },

    async saveNoteDocument(note) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await saveNoteDocumentToNeo4j(driver, note);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.saveNoteDocument(note, storage.mode);
    },

    async createNoteFolder(input) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await createNoteFolderInNeo4j(driver, input);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.createNoteFolder(input, storage.mode);
    },

    async moveNoteDocument(input) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await moveNoteDocumentInNeo4j(driver, input);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.moveNoteDocument(input, storage.mode);
    }
  };
}
