export function createRetriever({ graphService, ingestionService }) {
  return {
    async run(plan, parameters = {}) {
      const retrievalTopK = Number(parameters.retrievalTopK ?? 3);
      const [graphSummary, sources, sourceDocuments, timeline, conflicts, relations] = await Promise.all([
        graphService.getSummary(),
        ingestionService.listSources(),
        typeof graphService.listSourceDocuments === "function" ? graphService.listSourceDocuments() : [],
        typeof graphService.getTimeline === "function" ? graphService.getTimeline(retrievalTopK) : [],
        typeof graphService.getConflicts === "function" ? graphService.getConflicts() : [],
        typeof graphService.getRelations === "function" ? graphService.getRelations(retrievalTopK) : []
      ]);
      const citations =
        sourceDocuments.length > 0
          ? sourceDocuments.flatMap((document) =>
              document.excerpts.slice(0, 1).map((excerpt) => ({
                label: document.title,
                sourceId: document.id,
                excerptId: excerpt.id,
                preview: excerpt.text
              }))
            )
          : graphSummary.nodes.slice(0, 5).map((node) => ({
              label: node.label,
              sourceId: node.metadata?.sourceIds?.[0] ?? "graph",
              excerptId: `excerpt-${node.id}`,
              preview: node.summary
            }));

      return {
        agent: "Retriever",
        plan,
        graphSummary,
        sources,
        citations,
        timeline,
        conflicts,
        relations
      };
    }
  };
}
