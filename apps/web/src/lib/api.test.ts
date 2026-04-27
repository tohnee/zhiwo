import { describe, expect, it, vi } from "vitest";

import {
  createNoteFolder,
  loadDashboardData,
  loadNodeDetail,
  loadNoteDocument,
  loadSourceDocument,
  moveNoteDocument,
  loadConnectorCatalog,
  syncConnectors,
  saveEditorBlock,
  saveNoteDocument,
  sendChatPrompt
} from "./api";
import { mockDashboardData } from "../data/mock";

describe("loadDashboardData", () => {
  it("returns mock data when the API request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await loadDashboardData();

    expect(result.workspace.title).toBe(mockDashboardData.workspace.title);
    expect(result.debug.agentSteps[0]).toContain("Planner");
  });

  it("returns API data when the request succeeds", async () => {
    const responsePayload = {
      sources: [{ id: "rss", name: "RSS Feed", kind: "rss", status: "connected", mode: "live", detail: "", count: 4 }],
      workspace: {
        title: "Live Graph",
        graphNodes: [
          {
            id: "n1",
            label: "OpenAI",
            type: "Concept",
            confidence: 0.9,
            summary: "Live summary",
            metadata: { storageMode: "neo4j", sourceIds: ["rss"] }
          }
        ],
        editorBlocks: [{ id: "block-1", type: "text", content: "Fresh block", sourceIds: ["rss"] }],
        chatMessages: [{ role: "assistant", content: "Hello" }]
      },
      debug: {
        agentSteps: ["Planner -> Retriever -> Critic"],
        retrieval: ["OpenAI memo"],
        reasoning: ["Conflict check complete"]
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => responsePayload
      })
    );

    const result = await loadDashboardData();

    expect(result).toEqual(responsePayload);
    expect(result.workspace.graphNodes[0].metadata.storageMode).toBe("neo4j");
  });

  it("saves an editor block through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          block: { id: "block-1", type: "text", content: "Saved block", sourceIds: ["rss"] }
        })
      })
    );

    const result = await saveEditorBlock({
      id: "block-1",
      type: "text",
      content: "Saved block",
      sourceIds: ["rss"]
    });

    expect(result.content).toBe("Saved block");
  });

  it("loads a node detail through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          node: {
            id: "n1",
            label: "OpenAI",
            type: "Concept",
            confidence: 0.9,
            summary: "Live summary",
            metadata: { storageMode: "neo4j", sourceIds: ["rss"] }
          }
        })
      })
    );

    const result = await loadNodeDetail("n1");

    expect(result?.id).toBe("n1");
    expect(result?.metadata.storageMode).toBe("neo4j");
  });

  it("submits a chat prompt and returns answer metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          answer: "Grounded answer",
          mode: "live",
          steps: ["Planner -> scope", "Retriever -> evidence"],
          citations: [
            {
              label: "Memo",
              sourceId: "rss",
              excerptId: "excerpt-rss-1",
              preview: "Memo excerpt"
            }
          ]
        })
      })
    );

    const result = await sendChatPrompt("Summarize the memo");

    expect(result.answer).toBe("Grounded answer");
    expect(result.mode).toBe("live");
    expect(result.citations[0].label).toBe("Memo");
  });

  it("loads a source document through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          source: {
            id: "rss",
            title: "Board Memo",
            kind: "rss",
            content: "Board memo content",
            excerpts: [
              {
                id: "excerpt-rss-1",
                sourceId: "rss",
                title: "Memo excerpt",
                text: "Highlighted excerpt",
                order: 1
              }
            ]
          }
        })
      })
    );

    const result = await loadSourceDocument("rss");

    expect(result?.id).toBe("rss");
    expect(result?.excerpts[0].id).toBe("excerpt-rss-1");
  });

  it("loads a note document through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          note: {
            id: "note-1",
            title: "Saved answer",
            folderId: "folder-ideas",
            content: "Loaded note body",
            citations: []
          }
        })
      })
    );

    const result = await loadNoteDocument("note-1");

    expect(result?.id).toBe("note-1");
    expect(result?.content).toBe("Loaded note body");
  });

  it("saves a note document through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          note: {
            id: "note-1",
            title: "Saved answer",
            folderId: "folder-ideas",
            content: "Updated note body",
            citations: []
          }
        })
      })
    );

    const result = await saveNoteDocument({
      id: "note-1",
      title: "Saved answer",
      folderId: "folder-ideas",
      content: "Updated note body",
      citations: []
    });

    expect(result.id).toBe("note-1");
    expect(result.content).toBe("Updated note body");
  });

  it("creates a note folder through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          folder: {
            id: "folder-projects",
            name: "Projects",
            path: "Workspace/Projects",
            children: []
          }
        })
      })
    );

    const result = await createNoteFolder({
      parentId: "folder-root",
      name: "Projects"
    });

    expect(result.id).toBe("folder-projects");
    expect(result.path).toBe("Workspace/Projects");
  });

  it("moves a note document through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          note: {
            id: "note-1",
            title: "Saved answer",
            folderId: "folder-projects",
            content: "Updated note body",
            citations: []
          }
        })
      })
    );

    const result = await moveNoteDocument({
      noteId: "note-1",
      folderId: "folder-projects"
    });

    expect(result.id).toBe("note-1");
    expect(result.folderId).toBe("folder-projects");
  });
});


  it("loads connector catalog through the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          connectors: [{ id: "feishu", name: "Feishu", kind: "feishu", syncMode: "polling", status: "needs_configuration" }]
        })
      })
    );

    const result = await loadConnectorCatalog();

    expect(result.connectors[0].kind).toBe("feishu");
  });

  it("syncs connectors with connector-specific options", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          snapshots: [{ kind: "feishu", mode: "dry_run", readiness: "blocked", cursor: "c2", items: [], lastSyncedAt: "2026-04-26T00:00:00.000Z" }],
          summary: {
            requested: { connector: "feishu", cursor: "c1", since: null, limit: 50, dryRun: true },
            total: 1,
            success: 1,
            degraded: 0,
            failed: 0,
            durationMs: 12
          }
        })
      })
    );

    const result = await syncConnectors({ connector: "feishu", cursor: "c1", dryRun: true });

    expect(result.summary.total).toBe(1);
    expect(result.summary.durationMs).toBe(12);
    expect(result.summary.requested?.dryRun).toBe(true);
    expect(result.snapshots[0].readiness).toBe("blocked");
    expect(result.snapshots[0].kind).toBe("feishu");
  });

  it("throws when connector sync returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400
      })
    );

    await expect(syncConnectors({ connector: "unknown" })).rejects.toThrow("Sync connectors failed: 400");
  });
