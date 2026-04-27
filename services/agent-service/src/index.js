import { readRuntimeEnv } from "@knowledgeos/shared";

import { createDeepSeekClient } from "./deepseek.js";
import { createPlanner } from "./planner.js";
import { createRetriever } from "./retriever.js";
import { createCritic } from "./critic.js";

function createReplayToken(prompt, parameters) {
  return Buffer.from(JSON.stringify({ prompt, parameters, at: Date.now() })).toString("base64url");
}

function renderMarkdownTemplate(templateId, topic, answer, citations = []) {
  if (templateId === "investor-brief") {
    return [
      `# ${topic} Investor Brief`,
      "",
      "## Thesis",
      answer,
      "",
      "## Risks",
      "- Data quality variance across connectors",
      "- Conflict verification may require analyst review",
      "",
      "## Sources",
      ...citations.map((citation, index) => `- [${index + 1}] ${citation.label}: ${citation.preview}`)
    ].join("\n");
  }

  return [
    `# ${topic}`,
    "",
    "## Executive Summary",
    answer,
    "",
    "## Evidence",
    ...citations.map((citation, index) => `- ${index + 1}. **${citation.label}** (${citation.sourceId}) - ${citation.preview}`)
  ].join("\n");
}

function renderPptTemplate(templateId, topic, runResult, slideCount) {
  const baseTitle = templateId === "board" ? `${topic} · Board Deck` : `${topic} · Research Deck`;
  return Array.from({ length: slideCount }).map((_, index) => ({
    id: `slide-${index + 1}`,
    title: `${baseTitle} #${index + 1}`,
    layout: templateId,
    bullets: [
      runResult.citations[index]?.preview ?? runResult.answer,
      `Reference: ${runResult.citations[index]?.label ?? "Graph summary"}`
    ]
  }));
}

export function createAgentService({
  env = process.env,
  llm = createDeepSeekClient({ env }),
  graphService,
  ingestionService,
  memoryService = null
} = {}) {
  const planner = createPlanner();
  const retriever = createRetriever({ graphService, ingestionService });
  const critic = createCritic();
  const runtime = readRuntimeEnv(env);

  return {
    async run(prompt, options = {}) {
      const parameters = {
        retrievalTopK: Number(options.retrievalTopK ?? 3),
        temperature: Number(options.temperature ?? 0.2),
        forceLive: Boolean(options.forceLive ?? false),
        outputFormat: String(options.outputFormat ?? "chat"),
        maxIterations: Math.max(1, Number(options.maxIterations ?? 2))
      };

      const plan = planner.run(prompt);
      const iterations = [];
      let finalAnswer = "";
      let finalRetrieval = null;
      let finalMode = "fallback";

      for (let iteration = 1; iteration <= parameters.maxIterations; iteration += 1) {
        const retrieval = await retriever.run(plan, {
          ...parameters,
          retrievalTopK: parameters.retrievalTopK + (iteration - 1)
        });
        const citations = retrieval.citations.slice(0, parameters.retrievalTopK + (iteration - 1));
        const shouldUseLiveLlm = (llm && runtime.llmApiKey) || parameters.forceLive;
        const answer =
          shouldUseLiveLlm && llm
            ? await llm.generate(prompt, { ...retrieval, citations, parameters })
            : `Grounded summary for "${prompt}" using ${citations.map((citation) => citation.label).join(", ")} with topK=${parameters.retrievalTopK + (iteration - 1)}.`;

        const review = critic.run({ prompt, retrieval: { ...retrieval, citations }, answer });
        const autonomousDecision = review.valid || iteration >= parameters.maxIterations ? "accept" : "expand_retrieval";

        iterations.push({
          iteration,
          steps: [
            { agent: "Collector", intent: "Collect latest events, sources, and graph summary", output: { sources: retrieval.sources.length } },
            { agent: "Structuring", intent: "Map chunks into GraphRAG v2 entities/relations/timeline" },
            { agent: "Analyst", intent: "Analyze trend, conflict and timeline evolution", output: { conflicts: retrieval.conflicts.length } },
            { agent: "Planner", intent: plan.intent },
            { agent: "Creator", intent: "Create grounded answer and optional artifacts", output: { citations: citations.length } },
            { agent: "Critic", intent: "Validate fidelity and replayability", output: { decision: autonomousDecision } }
          ],
          citations,
          answer,
          review
        });

        finalAnswer = answer;
        finalRetrieval = { ...retrieval, citations };
        finalMode = shouldUseLiveLlm ? "live" : "fallback";

        if (autonomousDecision === "accept") {
          break;
        }
      }

      const replayToken = createReplayToken(prompt, parameters);
      if (memoryService?.saveEpisode) {
        await memoryService.saveEpisode({ prompt, answer: finalAnswer, replayToken, parameters });
      }

      return {
        answer: finalAnswer,
        citations: finalRetrieval?.citations ?? [],
        mode: finalMode,
        parameters,
        replayToken,
        iterations,
        steps: iterations.flatMap((iteration) => iteration.steps)
      };
    },

    async generateMarkdownReport({ topic, retrievalTopK = 4, templateId = "default" }) {
      const runResult = await this.run(topic, { retrievalTopK, outputFormat: "markdown-report" });
      return {
        format: "markdown",
        title: `${topic} Report`,
        templateId,
        content: renderMarkdownTemplate(templateId, topic, runResult.answer, runResult.citations),
        citations: runResult.citations,
        steps: runResult.steps,
        parameters: runResult.parameters
      };
    },

    async generatePpt({ topic, slideCount = 3, templateId = "board" }) {
      const runResult = await this.run(topic, {
        retrievalTopK: Math.max(3, slideCount),
        outputFormat: "ppt"
      });

      const slides = renderPptTemplate(templateId, topic, runResult, slideCount);

      return {
        format: "ppt",
        title: `${topic} Deck`,
        templateId,
        content: JSON.stringify({ topic, slides }, null, 2),
        slides,
        citations: runResult.citations,
        steps: runResult.steps,
        parameters: runResult.parameters
      };
    },

    exportArtifact({ format, artifact }) {
      if (format === "markdown") {
        return artifact.content;
      }

      if (format === "ppt") {
        return JSON.stringify({ exportedAt: new Date().toISOString(), payload: artifact }, null, 2);
      }

      throw new Error(`Unsupported export format: ${format}`);
    }
  };
}
