import { describe, expect, it, vi } from "vitest";

import {
  createNoteFolder,
  loadDashboardData,
  loadNodeDetail,
  loadNoteDocument,
  loadSourceDocument,
  moveNoteDocument,
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
