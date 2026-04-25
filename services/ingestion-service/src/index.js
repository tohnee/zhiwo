import { createSource, readRuntimeEnv } from "@knowledgeos/shared";

import { loadRssFeed } from "./rss.js";
import { loadPdfDirectory } from "./pdf.js";
import { getTelegramStatus as resolveTelegramStatus } from "./telegram.js";

export function createIngestionService({
  env = process.env,
  fetchFeed,
  rssFeedUrl,
  pdfDirectory
} = {}) {
  const runtimeEnv = { ...readRuntimeEnv(env), rssFeedUrl, pdfDirectory };

  return {
    async syncRss(feedUrl = runtimeEnv.rssFeedUrl) {
      if (!feedUrl) {
        return { mode: "degraded", items: [], reason: "No RSS feed URL configured." };
      }

      const items = await loadRssFeed(feedUrl, fetchFeed);
      return { mode: "live", items, reason: "" };
    },

    async syncPdfDirectory(directoryPath = runtimeEnv.pdfDirectory) {
      if (!directoryPath) {
        return { mode: "degraded", items: [], reason: "No PDF directory configured." };
      }

      const items = await loadPdfDirectory(directoryPath);
      return { mode: "live", items, reason: "" };
    },

    getTelegramStatus() {
      return resolveTelegramStatus(env);
    },

    async listSources() {
      const telegram = resolveTelegramStatus(env);
      const rss = runtimeEnv.rssFeedUrl
        ? await this.syncRss(runtimeEnv.rssFeedUrl)
        : { mode: "degraded", items: [], reason: "No RSS feed URL configured." };
      const pdf = runtimeEnv.pdfDirectory
        ? await this.syncPdfDirectory(runtimeEnv.pdfDirectory)
        : { mode: "degraded", items: [], reason: "No PDF directory configured." };

      return [
        createSource({
          id: "telegram",
          name: "Telegram",
          kind: "telegram",
          status: telegram.status,
          mode: telegram.mode,
          count: 0,
          detail: telegram.reason
        }),
        createSource({
          id: "rss",
          name: "RSS Feed",
          kind: "rss",
          status: rss.mode === "live" ? "connected" : "needs_configuration",
          mode: rss.mode,
          count: rss.items.length,
          detail: rss.reason
        }),
        createSource({
          id: "pdf",
          name: "PDF Library",
          kind: "pdf",
          status: pdf.mode === "live" ? "indexed" : "needs_configuration",
          mode: pdf.mode,
          count: pdf.items.length,
          detail: pdf.reason
        })
      ];
    }
  };
}
