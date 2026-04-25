import { readRuntimeEnv } from "@knowledgeos/shared";

import { createDeepSeekClient } from "./deepseek.js";
import { createPlanner } from "./planner.js";
import { createRetriever } from "./retriever.js";
import { createCritic } from "./critic.js";

export function createAgentService({
  env = process.env,
  llm = createDeepSeekClient({ env }),
  graphService,
  ingestionService
} = {}) {
  const planner = createPlanner();
  const retriever = createRetriever({ graphService, ingestionService });
  const critic = createCritic();
  const runtime = readRuntimeEnv(env);

  return {
    async run(prompt) {
      const plan = planner.run(prompt);
      const retrieval = await retriever.run(plan);
      const answer =
        llm && runtime.llmApiKey
          ? await llm.generate(prompt, retrieval)
          : `Grounded summary for "${prompt}" using ${retrieval.citations.join(", ")}.`;
      const review = critic.run({ prompt, retrieval, answer });

      return {
        answer,
        citations: retrieval.citations,
        mode: llm && runtime.llmApiKey ? "live" : "fallback",
        steps: [plan, retrieval, review]
      };
    }
  };
}
