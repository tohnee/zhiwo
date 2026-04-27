import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "./server.js";

function createStubAgentService(mode = "fallback") {
  return {
    async run(prompt, parameters = {}) {
      return {
        answer: `${mode === "live" ? "Live" : "Grounded"} summary for "${prompt}"`,
        mode,
        parameters,
        citations: [
          {
            label: "AI-native OS",
            sourceId: "rss",
            excerptId: "excerpt-rss-1",
            preview: "The team positions KnowledgeOS as an AI-native operating layer."
          }
        ],
        steps: [
          { agent: "Collector", intent: "collect" },
          { agent: "Structuring", intent: "structure" },
          { agent: "Analyst", intent: "analyze" },
          { agent: "Planner", intent: prompt },
          { agent: "Creator", intent: "create" },
          { agent: "Critic", intent: "validate" }
        ]
      };
    },
    async generateMarkdownReport({ topic }) {
      return {
        format: "markdown",
        title: `${topic} Report`,
        content: `# ${topic}`,
        citations: []
      };
    },
    async generatePpt({ topic }) {
      return {
        format: "ppt",
        title: `${topic} Deck`,
        content: JSON.stringify({ topic, slides: [] }),
        citations: []
      };
    },
    exportArtifact({ artifact }) {
      return artifact.content ?? "";
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
    const response = await fetch(`${baseUrl}/health`, {
      headers: { "x-request-id": "req-health-test" }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "req-health-test");
    assert.equal(payload.status, "ok");
    assert.equal(payload.service, "knowledgeos-api");
    assert.equal(payload.requestId, "req-health-test");
    assert.equal(typeof payload.dependencies.llm.configured, "boolean");
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
    assert.ok(payload.debug.agentSteps[0].startsWith("Collector"));
  });
});

test("chat rerun supports parameterized debug replay", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Summarize today",
        retrievalTopK: 5,
        outputFormat: "chat"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.parameters.retrievalTopK, 5);
    assert.equal(payload.steps[0].agent, "Collector");
  });
});

test("im ingestion endpoint parses queued messages into graph updates", async () => {
  const events = [];
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ingest/im-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "telegram",
          sender: "alice",
          text: "Apple roadmap decision not aligned with Tesla plan"
        })
      });
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.processed, 1);
      assert.equal(payload.latest.source, "telegram");
      assert.equal(events.length, 1);
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
        async getSourceDocument() {
          return null;
        },
        async saveEditorBlock(block) {
          return block;
        },
        async getNodeDetail() {
          return null;
        },
        async getNoteTree() {
          return { id: "folder-root", name: "Workspace", path: "Workspace", children: [] };
        },
        async getNoteDocument() {
          return null;
        },
        async saveNoteDocument(note) {
          return note;
        },
        async createNoteFolder(folder) {
          return { ...folder, id: "folder-id", path: "Workspace/Test", children: [] };
        },
        async moveNoteDocument() {
          return null;
        },
        async saveAnswerToNote(input) {
          return { note: { id: "note-1", ...input } };
        },
        async getTimeline() {
          return [];
        },
        async getConflicts() {
          return [];
        },
        getGraphRagSchema() {
          return { entities: [] };
        },
        async ingestEvent(event) {
          events.push(event);
          return { entities: event.entities };
        },
        async saveGeneratedArtifact(input) {
          return { artifact: { id: "a1", ...input } };
        }
      }
    }
  );
});

test("generation endpoints save markdown reports and ppt decks", async () => {
  await withServer(async (baseUrl) => {
    const reportResponse = await fetch(`${baseUrl}/api/generate/report-markdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Board strategy" })
    });
    const reportPayload = await reportResponse.json();

    const pptResponse = await fetch(`${baseUrl}/api/generate/ppt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "Board strategy", slideCount: 3 })
    });
    const pptPayload = await pptResponse.json();

    assert.equal(reportResponse.status, 200);
    assert.equal(reportPayload.report.format, "markdown");
    assert.equal(pptResponse.status, 200);
    assert.equal(pptPayload.deck.format, "ppt");
  });
});

test("debug run history supports baseline and diff endpoints", async () => {
  await withServer(async (baseUrl) => {
    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "First run", retrievalTopK: 2 })
    });
    const chatPayload = await chatResponse.json();

    const rerunResponse = await fetch(`${baseUrl}/api/chat/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Second run", retrievalTopK: 5 })
    });
    const rerunPayload = await rerunResponse.json();

    const baselineResponse = await fetch(`${baseUrl}/api/debug/baseline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: chatPayload.runId })
    });
    const baselinePayload = await baselineResponse.json();

    const diffResponse = await fetch(
      `${baseUrl}/api/debug/diff?from=${encodeURIComponent(chatPayload.runId)}&to=${encodeURIComponent(rerunPayload.runId)}`
    );
    const diffPayload = await diffResponse.json();

    assert.equal(chatResponse.status, 200);
    assert.equal(rerunResponse.status, 200);
    assert.equal(baselineResponse.status, 200);
    assert.equal(baselinePayload.baselineRunId, chatPayload.runId);
    assert.equal(diffResponse.status, 200);
    assert.equal(typeof diffPayload.diff.citationDelta, "number");
  });
});

test("connector sync and artifact export endpoints respond with payload", async () => {
  await withServer(async (baseUrl) => {
    const syncResponse = await fetch(`${baseUrl}/api/connectors/sync`, {
      method: "POST"
    });
    const syncPayload = await syncResponse.json();

    const exportResponse = await fetch(`${baseUrl}/api/generate/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "markdown",
        artifact: { content: "# hello" }
      })
    });
    const exportPayload = await exportResponse.json();

    assert.equal(syncResponse.status, 200);
    assert.equal(Array.isArray(syncPayload.snapshots), true);
    assert.equal(typeof syncPayload.summary.total, "number");
    assert.equal(typeof syncPayload.summary.durationMs, "number");
    assert.equal(typeof syncPayload.summary.startedAt, "string");
    assert.equal(exportResponse.status, 200);
    assert.equal(exportPayload.exported, "# hello");
  });
});


test("connectors catalog endpoint returns supported connectors", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/connectors/catalog`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(payload.connectors), true);
    assert.equal(payload.connectors.some((connector) => connector.kind === "feishu"), true);
  });
});

test("connector sync validates invalid params", async () => {
  await withServer(async (baseUrl) => {
    const invalidSince = await fetch(`${baseUrl}/api/connectors/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ since: "not-a-date" })
    });
    const invalidSincePayload = await invalidSince.json();

    const invalidConnector = await fetch(`${baseUrl}/api/connectors/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector: "unknown" })
    });
    const invalidConnectorPayload = await invalidConnector.json();

    assert.equal(invalidSince.status, 400);
    assert.match(invalidSincePayload.error, /Invalid since/i);
    assert.equal(invalidConnector.status, 400);
    assert.match(invalidConnectorPayload.error, /Unsupported connector kind/i);
  });
});

test("connector sync supports dry run passthrough", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/connectors/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector: "feishu", dryRun: true, cursor: "dry-cursor" })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.summary.requested.dryRun, true);
    assert.equal(payload.snapshots[0].mode, "dry_run");
    assert.equal(payload.snapshots[0].readiness, "blocked");
    assert.equal(payload.snapshots[0].cursor, "dry-cursor");
  });
});
