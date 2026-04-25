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
