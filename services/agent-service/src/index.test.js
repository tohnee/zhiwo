import test from "node:test";
import assert from "node:assert/strict";

import { createAgentService } from "./index.js";

test("runs planner, retriever, critic in order and returns grounded fallback answer", async () => {
  const service = createAgentService({
    llm: null,
    graphService: {
      async getSummary() {
        return {
          storageMode: "memory",
          nodes: [
            {
              id: "n1",
              label: "AI-native OS",
              type: "Concept",
              confidence: 0.96,
              summary: "系统核心定位",
              metadata: { sourceIds: ["rss"] }
            }
          ]
        };
      }
    },
    ingestionService: {
      async listSources() {
        return [{ id: "rss", kind: "rss", name: "RSS Feed", mode: "live", status: "connected", count: 2 }];
      }
    }
  });

  const result = await service.run("Summarize latest thesis");

  assert.deepEqual(result.steps.map((step) => step.agent), ["Planner", "Retriever", "Critic"]);
  assert.match(result.answer, /Summarize latest thesis/);
  assert.equal(result.citations[0].label, "AI-native OS");
  assert.equal(result.citations[0].sourceId, "rss");
  assert.equal(result.mode, "fallback");
});

test("uses live llm when an api key is configured", async () => {
  const service = createAgentService({
    env: {
      LLM_API_KEY: "token",
      DEEPSEEK_MODEL: "deepseek-v4-pro"
    },
    llm: {
      async generate(prompt) {
        return `Live answer for ${prompt}`;
      }
    },
    graphService: {
      async getSummary() {
        return {
          storageMode: "neo4j",
          nodes: [{ id: "n1", label: "AI-native OS", type: "Concept", confidence: 0.96, summary: "系统核心定位" }]
        };
      }
    },
    ingestionService: {
      async listSources() {
        return [{ id: "rss", kind: "rss", name: "RSS Feed", mode: "live", status: "connected", count: 2 }];
      }
    }
  });

  const result = await service.run("Test live mode");

  assert.equal(result.mode, "live");
  assert.equal(result.answer, "Live answer for Test live mode");
});
