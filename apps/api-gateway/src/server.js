import http from "node:http";
import { fileURLToPath } from "node:url";

import { createChatMessage, createSource } from "@knowledgeos/shared";
import { createAgentService } from "@knowledgeos/agent-service";
import { createGraphService } from "@knowledgeos/graph-service";
import { createIngestionService } from "@knowledgeos/ingestion-service";

function sendJson(response, statusCode, payload) {
  const requestId = response.getHeader("x-request-id");
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    ...(requestId ? { "x-request-id": requestId } : {})
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
  const debugRuns = [];
  let baselineRunId = null;
  let lastRunParameters = {
    retrievalTopK: 3,
    temperature: 0.2,
    forceLive: false,
    outputFormat: "chat"
  };

  function createRequestId(request) {
    const incoming = request.headers["x-request-id"];
    if (typeof incoming === "string" && incoming.trim()) {
      return incoming.trim();
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function buildHealthPayload(requestId) {
    const graphStatus = typeof graphService.getStorageStatus === "function" ? await graphService.getStorageStatus() : null;
    const telegram = typeof ingestionService.getTelegramStatus === "function" ? ingestionService.getTelegramStatus() : null;
    return {
      status: "ok",
      service: "knowledgeos-api",
      requestId,
      dependencies: {
        graph: graphStatus,
        llm: {
          configured: Boolean(process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? "")
        },
        ingestion: telegram ? { telegramMode: telegram.mode, telegramReason: telegram.reason } : null
      }
    };
  }


  function snapshotRun(prompt, result) {
    const run = {
      id: `run-${Date.now()}-${debugRuns.length + 1}`,
      prompt,
      answer: result.answer,
      citations: result.citations,
      parameters: result.parameters,
      mode: result.mode,
      createdAt: new Date().toISOString()
    };
    debugRuns.push(run);
    if (!baselineRunId) {
      baselineRunId = run.id;
    }

    return run;
  }

  function diffRuns(fromRun, toRun) {
    return {
      from: fromRun?.id ?? null,
      to: toRun?.id ?? null,
      citationDelta: (toRun?.citations?.length ?? 0) - (fromRun?.citations?.length ?? 0),
      answerLengthDelta: (toRun?.answer?.length ?? 0) - (fromRun?.answer?.length ?? 0),
      parameterChanges: {
        retrievalTopK: [fromRun?.parameters?.retrievalTopK ?? null, toRun?.parameters?.retrievalTopK ?? null],
        temperature: [fromRun?.parameters?.temperature ?? null, toRun?.parameters?.temperature ?? null],
        forceLive: [fromRun?.parameters?.forceLive ?? null, toRun?.parameters?.forceLive ?? null]
      }
    };
  }

  async function buildDashboard() {
    const [sources, graphSummary, conflicts, timeline] = await Promise.all([
      ingestionService.listSources(),
      graphService.getSummary(),
      typeof graphService.getConflicts === "function" ? graphService.getConflicts() : [],
      typeof graphService.getTimeline === "function" ? graphService.getTimeline(3) : []
    ]);
    const storageMode =
      graphSummary.storageMode ??
      graphSummary.nodes[0]?.metadata?.storageMode ??
      "memory";

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
          "Collector -> Gather sources/events",
          "Structuring -> Build GraphRAG v2 entities",
          "Analyst -> Track timeline and conflicts",
          "Planner -> Scope ask",
          "Creator -> Generate answer/artifact",
          "Critic -> Validate + replay"
        ],
        retrieval: [
          `RSS mode: ${sources.find((source) => source.kind === "rss")?.mode ?? "unknown"}`,
          `PDF mode: ${sources.find((source) => source.kind === "pdf")?.mode ?? "unknown"}`,
          `Storage mode: ${storageMode}`
        ],
        reasoning: [
          `Conflict count: ${conflicts.length}`,
          `Timeline points: ${timeline.length}`,
          "Sources traceable"
        ],
        parameters: lastRunParameters,
        baselineRunId,
        runCount: debugRuns.length
      }
    };
  }

  return http.createServer(async (request, response) => {
    const requestId = createRequestId(request);
    const startedAt = Date.now();
    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      console.log(
        JSON.stringify({
          event: "api_request",
          requestId,
          method: request.method,
          path: request.url,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        })
      );
    });

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
      sendJson(response, 200, await buildHealthPayload(requestId));
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

    if (request.method === "GET" && url.pathname === "/api/connectors/catalog") {
      sendJson(response, 200, {
        connectors: ingestionService.getConnectorCatalog()
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/connectors/sync") {
      const body = await readJsonBody(request);
      const connector = body.connector ? String(body.connector) : undefined;
      const since = body.since ? String(body.since) : undefined;
      if (since && Number.isNaN(new Date(since).getTime())) {
        sendJson(response, 400, { error: "Invalid since timestamp." });
        return;
      }
      if (body.limit !== undefined) {
        const limit = Number(body.limit);
        if (!Number.isFinite(limit) || limit < 1) {
          sendJson(response, 400, { error: "Invalid limit. Must be a positive number." });
          return;
        }
      }
      let result;
      try {
        result = await ingestionService.syncAllConnectors({
          connector,
          cursor: body.cursor ?? undefined,
          since,
          limit: body.limit ?? undefined,
          dryRun: Boolean(body.dryRun ?? false)
        });
      } catch (error) {
        if (/Unsupported connector kind/.test(error.message)) {
          sendJson(response, 400, { error: error.message });
          return;
        }
        throw error;
      }
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/ingest/im-event") {
      const body = await readJsonBody(request);
      const message = ingestionService.enqueueImMessage({
        source: String(body.source ?? "telegram"),
        threadId: String(body.threadId ?? "default"),
        sender: String(body.sender ?? "unknown"),
        text: String(body.text ?? ""),
        occurredAt: String(body.occurredAt ?? new Date().toISOString())
      });
      const processed = await ingestionService.processQueuedImMessages(async (event) => {
        await graphService.ingestEvent(event);
      });

      sendJson(response, 200, {
        queued: message.id,
        processed: processed.length,
        latest: processed.at(-1) ?? null
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(request);
      const prompt = String(body.prompt ?? "");
      lastRunParameters = {
        retrievalTopK: Number(body.retrievalTopK ?? 3),
        temperature: Number(body.temperature ?? 0.2),
        forceLive: Boolean(body.forceLive ?? false),
        outputFormat: "chat"
      };
      const result = await agentService.run(prompt, lastRunParameters);
      const run = snapshotRun(prompt, result);
      chatMessages.push(createChatMessage("user", prompt));
      chatMessages.push(createChatMessage("assistant", result.answer));

      sendJson(response, 200, {
        answer: result.answer,
        mode: result.mode,
        parameters: result.parameters,
        steps: result.steps.map((step) => `${step.agent}${step.intent ? ` -> ${step.intent}` : ""}`),
        citations: result.citations,
        runId: run.id
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat/rerun") {
      const body = await readJsonBody(request);
      const prompt = String(body.prompt ?? "");
      lastRunParameters = {
        retrievalTopK: Number(body.retrievalTopK ?? 3),
        temperature: Number(body.temperature ?? 0.2),
        forceLive: Boolean(body.forceLive ?? false),
        outputFormat: String(body.outputFormat ?? "chat")
      };

      const result = await agentService.run(prompt, lastRunParameters);
      const run = snapshotRun(prompt, result);
      sendJson(response, 200, {
        answer: result.answer,
        mode: result.mode,
        parameters: result.parameters,
        steps: result.steps,
        citations: result.citations,
        runId: run.id
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/generate/report-markdown") {
      const body = await readJsonBody(request);
      const topic = String(body.topic ?? "Untitled report");
      const report = await agentService.generateMarkdownReport({
        topic,
        retrievalTopK: Number(body.retrievalTopK ?? 4)
      });
      const saved = await graphService.saveGeneratedArtifact({
        format: "markdown",
        title: report.title,
        content: report.content,
        citations: report.citations,
        folderId: String(body.folderId ?? "folder-research")
      });

      sendJson(response, 200, { report, saved });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/generate/ppt") {
      const body = await readJsonBody(request);
      const topic = String(body.topic ?? "Untitled deck");
      const deck = await agentService.generatePpt({
        topic,
        slideCount: Number(body.slideCount ?? 3)
      });
      const saved = await graphService.saveGeneratedArtifact({
        format: "ppt",
        title: deck.title,
        content: deck.content,
        citations: deck.citations,
        folderId: String(body.folderId ?? "folder-research")
      });

      sendJson(response, 200, { deck, saved });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/generate/export") {
      const body = await readJsonBody(request);
      const exported = agentService.exportArtifact({
        format: String(body.format ?? "markdown"),
        artifact: body.artifact ?? {}
      });
      sendJson(response, 200, { exported });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/debug/runs") {
      sendJson(response, 200, {
        baselineRunId,
        runs: debugRuns
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/debug/baseline") {
      const body = await readJsonBody(request);
      baselineRunId = String(body.runId ?? baselineRunId ?? "");
      sendJson(response, 200, { baselineRunId });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/debug/diff") {
      const fromId = String(url.searchParams.get("from") ?? baselineRunId ?? "");
      const toId = String(url.searchParams.get("to") ?? debugRuns.at(-1)?.id ?? "");
      const fromRun = debugRuns.find((run) => run.id === fromId) ?? null;
      const toRun = debugRuns.find((run) => run.id === toId) ?? null;
      sendJson(response, 200, {
        diff: diffRuns(fromRun, toRun)
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/graph/schema") {
      sendJson(response, 200, {
        schema: graphService.getGraphRagSchema()
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/graph/timeline") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      sendJson(response, 200, {
        timeline: await graphService.getTimeline(limit)
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/graph/conflicts") {
      sendJson(response, 200, {
        conflicts: await graphService.getConflicts()
      });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/source/")) {
      const sourceId = url.pathname.split("/").at(-1);
      const source = await graphService.getSourceDocument(sourceId);

      if (!source) {
        sendJson(response, 404, { error: "Source not found" });
        return;
      }

      sendJson(response, 200, { source });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/notes/tree") {
      const tree = await graphService.getNoteTree();
      sendJson(response, 200, { tree });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/note/")) {
      const noteId = url.pathname.split("/").at(-1);
      const note = await graphService.getNoteDocument(noteId);

      if (!note) {
        sendJson(response, 404, { error: "Note not found" });
        return;
      }

      sendJson(response, 200, { note });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/note") {
      const body = await readJsonBody(request);
      const note = await graphService.saveNoteDocument({
        id: String(body.id ?? ""),
        title: String(body.title ?? "Untitled note"),
        folderId: String(body.folderId ?? "folder-root"),
        content: String(body.content ?? ""),
        citations: Array.isArray(body.citations) ? body.citations : []
      });

      sendJson(response, 200, { note });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/note/folder") {
      const body = await readJsonBody(request);
      const folder = await graphService.createNoteFolder({
        parentId: String(body.parentId ?? "folder-root"),
        name: String(body.name ?? "New folder")
      });

      sendJson(response, 200, { folder });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/note/move") {
      const body = await readJsonBody(request);
      const note = await graphService.moveNoteDocument({
        noteId: String(body.noteId ?? ""),
        folderId: String(body.folderId ?? "")
      });

      sendJson(response, 200, { note });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/answer/save-to-note") {
      const body = await readJsonBody(request);
      const result = await graphService.saveAnswerToNote({
        folderId: String(body.folderId ?? ""),
        title: String(body.title ?? "Saved answer"),
        content: String(body.content ?? ""),
        citations: Array.isArray(body.citations) ? body.citations : []
      });

      sendJson(response, 200, result);
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
