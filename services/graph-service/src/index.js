import { createEditorBlock, createGraphNode, hasNeo4jConfig } from "@knowledgeos/shared";

import {
  createNeo4jClient,
  getNodeDetailFromNeo4j,
  loadGraphSummaryFromNeo4j,
  saveEditorBlockToNeo4j
} from "./neo4j.js";

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
    }
  };
}
