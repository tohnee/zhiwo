export function createRetriever({ graphService, ingestionService }) {
  return {
    async run(plan) {
      const [graphSummary, sources, sourceDocuments] = await Promise.all([
        graphService.getSummary(),
        ingestionService.listSources(),
        typeof graphService.listSourceDocuments === "function" ? graphService.listSourceDocuments() : []
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
          : graphSummary.nodes.slice(0, 3).map((node) => ({
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
        citations
      };
    }
  };
}
