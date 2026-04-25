import { readRuntimeEnv } from "@knowledgeos/shared";

export function createDeepSeekClient({
  env = process.env,
  fetchImpl = fetch
} = {}) {
  return {
    async generate(prompt, retrieval) {
      const runtime = readRuntimeEnv(env);

      const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${runtime.llmApiKey}`
        },
        body: JSON.stringify({
          model: runtime.deepseekModel,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are a grounded research assistant. Use only provided evidence and be concise."
            },
            {
              role: "user",
              content: `Question: ${prompt}\nEvidence: ${retrieval.citations.join(", ")}`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API failed: ${response.status} ${errorText}`);
      }

      const payload = await response.json();
      return payload.choices?.[0]?.message?.content?.trim() ?? "";
    }
  };
}
