import { describe, expect, it, vi } from "vitest";

import { loadDashboardData, loadNodeDetail, saveEditorBlock } from "./api";
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
});
