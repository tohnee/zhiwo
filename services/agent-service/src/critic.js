export function createCritic() {
  return {
    run({ prompt, retrieval, answer }) {
      return {
        agent: "Critic",
        valid: Boolean(answer && retrieval.citations.length > 0),
        notes: `Validated answer for "${prompt}" with ${retrieval.citations.length} citation(s).`
      };
    }
  };
}
