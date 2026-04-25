import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const entries = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

export function readRuntimeEnv(env = process.env) {
  const cwd = env.KNOWLEDGEOS_ROOT ?? process.cwd();
  const fileEnv = loadDotEnvFile(path.join(cwd, ".env.local"));
  const mergedEnv = { ...fileEnv, ...env };

  return {
    rssFeedUrl: mergedEnv.RSS_FEED_URL ?? "",
    pdfDirectory: mergedEnv.PDF_DIRECTORY ?? "",
    telegramApiId: mergedEnv.TELEGRAM_API_ID ?? "",
    telegramApiHash: mergedEnv.TELEGRAM_API_HASH ?? "",
    telegramBotToken: mergedEnv.TELEGRAM_BOT_TOKEN ?? "",
    neo4jUri: mergedEnv.NEO4J_URI ?? "",
    neo4jUsername: mergedEnv.NEO4J_USERNAME ?? "",
    neo4jPassword: mergedEnv.NEO4J_PASSWORD ?? "",
    llmApiKey: mergedEnv.LLM_API_KEY ?? mergedEnv.DEEPSEEK_API_KEY ?? "",
    deepseekModel: mergedEnv.DEEPSEEK_MODEL ?? "deepseek-chat"
  };
}

export function hasNeo4jConfig(env = process.env) {
  const runtime = readRuntimeEnv(env);
  return Boolean(runtime.neo4jUri && runtime.neo4jUsername && runtime.neo4jPassword);
}

export function hasTelegramConfig(env = process.env) {
  const runtime = readRuntimeEnv(env);
  return Boolean(runtime.telegramApiId && runtime.telegramApiHash && runtime.telegramBotToken);
}
