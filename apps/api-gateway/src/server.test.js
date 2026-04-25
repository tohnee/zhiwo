import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "./server.js";

function createStubAgentService(mode = "fallback") {
  return {
    async run(prompt) {
      return {
        answer: `${mode === "live" ? "Live" : "Grounded"} summary for "${prompt}"`,
        mode,
        citations: ["AI-native OS"],
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
  });
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
