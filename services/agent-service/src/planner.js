export function createPlanner() {
  return {
    run(prompt) {
      const normalizedPrompt = prompt.trim() || "Untitled request";
      return {
        agent: "Planner",
        intent: normalizedPrompt,
        tasks: ["identify question", "collect evidence", "validate answer"]
      };
    }
  };
}
