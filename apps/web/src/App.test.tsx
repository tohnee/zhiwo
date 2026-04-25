import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("./lib/api", () => ({
  loadDashboardData: vi.fn().mockResolvedValue({
    sources: [
      {
        id: "telegram",
        name: "Telegram",
        kind: "telegram",
        status: "credentials_missing",
        mode: "degraded",
        detail: "Missing credentials",
        count: 12
      }
    ],
    workspace: {
      title: "Knowledge Graph",
      graphNodes: [
        {
          id: "a",
          label: "AI-native OS",
          type: "Concept",
          confidence: 0.96,
          summary: "系统核心定位",
          metadata: { storageMode: "memory", sourceIds: ["telegram"] }
        }
      ],
      editorBlocks: [{ id: "block-1", type: "text", content: "Block one", sourceIds: ["telegram"] }],
      chatMessages: [{ role: "assistant", content: "Ready to reason." }]
    },
    debug: {
      agentSteps: ["Planner -> Retriever -> Critic"],
      retrieval: ["Telegram summary"],
      reasoning: ["Evidence aligned"]
    }
  }),
  saveEditorBlock: vi.fn().mockImplementation(async (block) => block),
  loadNodeDetail: vi.fn().mockImplementation(async () => ({
    id: "a",
    label: "AI-native OS",
    type: "Concept",
    confidence: 0.96,
    summary: "系统核心定位",
    metadata: { storageMode: "neo4j", sourceIds: ["telegram"] }
  }))
}));

describe("App", () => {
  it("renders the three-panel workspace and supports editor and graph interactions", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Knowledge Graph")).toBeInTheDocument());

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("AI Debug")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI-native OS" })).toBeInTheDocument();
    expect(screen.getByText("degraded")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByText("Ready to reason.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    const textbox = screen.getByRole("textbox", { name: "Block one" });
    fireEvent.change(textbox, { target: { value: "Updated block" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Blocks" }));
    expect(screen.getByDisplayValue("Updated block")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Graph" }));
    fireEvent.click(screen.getByRole("button", { name: "AI-native OS" }));
    expect(screen.getByText("系统核心定位")).toBeInTheDocument();
  });
});
