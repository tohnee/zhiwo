export function createRetriever({ graphService, ingestionService }) {
  return {
    async run(plan) {
      const [graphSummary, sources] = await Promise.all([
        graphService.getSummary(),
        ingestionService.listSources()
      ]);

      return {
        agent: "Retriever",
        plan,
        graphSummary,
        sources,
        citations: graphSummary.nodes.slice(0, 3).map((node) => node.label)
      };
    }
  };
}
