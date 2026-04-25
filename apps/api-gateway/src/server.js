import http from "node:http";
import { fileURLToPath } from "node:url";

import { createChatMessage, createSource } from "@knowledgeos/shared";
import { createAgentService } from "@knowledgeos/agent-service";
import { createGraphService } from "@knowledgeos/graph-service";
import { createIngestionService } from "@knowledgeos/ingestion-service";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createServer({
  ingestionService = createIngestionService(),
  graphService = createGraphService(),
  agentService = createAgentService({ graphService, ingestionService })
} = {}) {
  const manualSources = [];
  const chatMessages = [createChatMessage("assistant", "Ready to reason over your latest knowledge graph.")];
  let editorBlocks = null;

  async function buildDashboard() {
    const [sources, graphSummary] = await Promise.all([
      ingestionService.listSources(),
      graphService.getSummary()
    ]);

    return {
      sources: [...sources, ...manualSources],
      workspace: {
        title: graphSummary.title,
        graphNodes: graphSummary.nodes,
        editorBlocks: editorBlocks ?? graphSummary.editorBlocks,
        chatMessages
      },
      debug: {
        agentSteps: [
          "Planner -> Scope the question",
          "Retriever -> Pull graph nodes and source evidence",
          "Critic -> Check conflicts before response"
        ],
        retrieval: [
          `RSS mode: ${sources.find((source) => source.kind === "rss")?.mode ?? "unknown"}`,
          `PDF mode: ${sources.find((source) => source.kind === "pdf")?.mode ?? "unknown"}`,
          `Storage mode: ${graphSummary.storageMode}`
        ],
        reasoning: ["Conflict check complete", "Timeline aligned", "Sources traceable"]
      }
    };
  }

  return http.createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { error: "Missing URL" });
      return;
    }

    const url = new URL(request.url, "http://localhost");

    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "knowledgeos-api" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      sendJson(response, 200, await buildDashboard());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ingest") {
      const body = await readJsonBody(request);
      const source = String(body.source ?? "manual");
      const items = Number(body.items ?? 0);

      manualSources.push(
        createSource({
        id: `${source}-${Date.now()}`,
        name: source.charAt(0).toUpperCase() + source.slice(1),
        kind: source,
        status: "indexed",
        mode: "manual",
        count: items,
        detail: "Added from API ingest endpoint."
        })
      );

      sendJson(response, 200, {
        message: `Synced ${source} with ${items} items`,
        dashboard: await buildDashboard()
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(request);
      const prompt = String(body.prompt ?? "");
      const result = await agentService.run(prompt);
      chatMessages.push(createChatMessage("user", prompt));
      chatMessages.push(createChatMessage("assistant", result.answer));

      sendJson(response, 200, {
        answer: result.answer,
        mode: result.mode,
        steps: result.steps.map((step) => `${step.agent}${step.intent ? ` -> ${step.intent}` : ""}`),
        citations: result.citations
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/editor/block") {
      const body = await readJsonBody(request);
      const blockId = String(body.id ?? "");
      const content = String(body.content ?? "");
      const dashboard = await buildDashboard();
      const existing =
        dashboard.workspace.editorBlocks.find((block) => block.id === blockId) ?? {
          id: blockId,
          type: "text",
          content: "",
          sourceIds: []
        };
      const block = await graphService.saveEditorBlock({ ...existing, content });

      editorBlocks = dashboard.workspace.editorBlocks.map((item) => (item.id === blockId ? block : item));
      if (!editorBlocks.some((item) => item.id === blockId)) {
        editorBlocks.push(block);
      }

      sendJson(response, 200, { block });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/graph/node/")) {
      const nodeId = url.pathname.split("/").at(-1);
      const node = await graphService.getNodeDetail(nodeId);

      if (!node) {
        sendJson(response, 404, { error: "Node not found" });
        return;
      }

      sendJson(response, 200, { node });
      return;
    }

    sendJson(response, 404, { error: "Not Found" });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const server = createServer();

  server.listen(port, "0.0.0.0", () => {
    console.log(`KnowledgeOS API Gateway listening on http://0.0.0.0:${port}`);
  });
}
