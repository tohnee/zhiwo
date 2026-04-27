import {
  createConflict,
  createEditorBlock,
  createEntity,
  createGraphNode,
  createGraphRagSchema,
  createNoteDocument,
  createNoteFolder,
  createRelation,
  createSourceDocument,
  createSourceExcerpt,
  createTimelineEvent,
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
  const schema = createGraphRagSchema();
  const memoryEntities = [
    createEntity({ id: "entity-ai-native-os", label: "AI-native OS", type: "Concept" })
  ];
  const memoryRelations = [];
  const memoryTimeline = [];
  const memoryConflicts = [];
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
        const existing = memoryNotes.find((item) => item.id === saved.id);
        memoryNotes = existing
          ? memoryNotes.map((item) => (item.id === saved.id ? saved : item))
          : [...memoryNotes, saved];
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
          const summary = await loadGraphSummaryFromNeo4j(driver);
          return { ...summary, storageMode: "neo4j" };
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

      return activeAdapter.listSourceDocuments();
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

      return activeAdapter.getSourceDocument(id);
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

      return activeAdapter.getNoteTree();
    },

    async saveAnswerToNote(payload) {
      const storage = await this.getStorageStatus();
      if (!adapter && storage.mode === "neo4j") {
        const driver = await connectNeo4j(env);
        try {
          return await saveAnswerToNeo4j(driver, payload);
        } finally {
          await driver.close();
        }
      }

      return activeAdapter.saveAnswerToNote(payload);
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

      return activeAdapter.getNoteDocument(id);
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

      return activeAdapter.saveNoteDocument(note);
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

      return activeAdapter.createNoteFolder(input);
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

      return activeAdapter.moveNoteDocument(input);
    },

    getGraphRagSchema() {
      return schema;
    },

    async ingestEvent(event) {
      const entities =
        event.entities?.map((entity) =>
          createEntity({
            ...entity,
            attributes: {
              ...(entity.attributes ?? {}),
              confidence: Number(entity.confidence ?? 0.7),
              source: event.source
            }
          })
        ) ?? [];
      for (const entity of entities) {
        const existing = memoryEntities.find((item) => item.id === entity.id);
        if (!existing) {
          memoryEntities.push(entity);
        }

        const nodeExists = memorySummary.nodes.some((node) => node.id === entity.id);
        if (!nodeExists) {
          memorySummary.nodes.push(
            createGraphNode({
              id: entity.id,
              label: entity.label,
              type: entity.type,
              confidence: Number(entity.attributes?.confidence ?? 0.7),
              summary: `Extracted from ${event.source}`,
              metadata: { storageMode: "memory", sourceIds: [event.source], extraction: "semantic-chunk" }
            })
          );
        }
      }

      if (entities.length >= 2) {
        const relationConfidence = Math.min(0.95, 0.6 + entities.length * 0.1);
        memoryRelations.push(
          createRelation({
            id: `rel-${Date.now()}`,
            from: entities[0].id,
            to: entities[1].id,
            type: /causes|because/i.test(event.text) ? "causes" : "references",
            evidence: JSON.stringify({ text: event.text, confidence: relationConfidence })
          })
        );
      }

      for (const entity of entities) {
        memoryTimeline.push(
          createTimelineEvent({
            id: `timeline-${Date.now()}-${entity.id}`,
            entityId: entity.id,
            occurredAt: event.occurredAt,
            summary: event.text,
            sourceId: event.source
          })
        );
      }

      if (/not|contradict|however|conflict/i.test(event.text) && entities.length >= 2) {
        memoryConflicts.push(
          createConflict({
            id: `conflict-${Date.now()}`,
            leftEntityId: entities[0].id,
            rightEntityId: entities[1].id,
            reason: `Potential contradiction in message: ${event.text.slice(0, 120)}`,
            status: "open"
          })
        );
      }

      return {
        entities,
        relationCount: memoryRelations.length,
        timelineCount: memoryTimeline.length,
        conflictCount: memoryConflicts.length
      };
    },

    async getTimeline(limit = 20) {
      return memoryTimeline
        .slice()
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, limit);
    },

    async getConflicts() {
      return memoryConflicts;
    },

    async getRelations(limit = 20) {
      return memoryRelations.slice(-limit);
    },

    async explainConflict(conflictId) {
      const conflict = memoryConflicts.find((item) => item.id === conflictId) ?? null;
      if (!conflict) {
        return null;
      }

      const left = memoryEntities.find((entity) => entity.id === conflict.leftEntityId);
      const right = memoryEntities.find((entity) => entity.id === conflict.rightEntityId);
      return {
        conflict,
        explanation: `${left?.label ?? conflict.leftEntityId} and ${right?.label ?? conflict.rightEntityId} are flagged because opposite claims appeared in adjacent timeline events.`,
        strategy: "rule+agent",
        confidence: 0.72
      };
    },

    async saveGeneratedArtifact({ format, title, content, citations = [], folderId = "folder-research" }) {
      const note = await this.saveNoteDocument({
        id: `artifact-${Date.now()}`,
        title,
        folderId,
        content,
        citations
      });

      return {
        artifact: {
          id: note.id,
          format,
          title,
          content,
          citations
        },
        note
      };
    }
  };
}
