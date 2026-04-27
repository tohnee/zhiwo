import { createSource, readRuntimeEnv } from "@knowledgeos/shared";

import { loadRssFeed } from "./rss.js";
import { loadPdfDirectory } from "./pdf.js";
import { getTelegramStatus as resolveTelegramStatus } from "./telegram.js";
import { syncFeishu } from "./connectors/feishu.js";
import { syncYouTube } from "./connectors/youtube.js";
import { syncWeChat } from "./connectors/wechat.js";
import { syncWebClip } from "./connectors/web.js";
import { normalizeSyncOptions } from "./connectors/base.js";

function splitChunks(text) {
  return String(text)
    .split(/[\n.!?]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function extractEntities(chunks = []) {
  const entities = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const matches = chunk.match(/\b[A-Z][a-zA-Z0-9-]{2,}\b/g) ?? [];

    for (const label of matches) {
      if (seen.has(label)) {
        continue;
      }

      seen.add(label);
      entities.push({
        id: `entity-${label.toLowerCase()}`,
        label,
        type: /plan|decision|roadmap/i.test(label) ? "Decision" : "Concept",
        confidence: Math.min(0.95, 0.55 + label.length / 20)
      });
    }
  }

  return entities;
}

function toIngestionEvent(message) {
  const chunks = splitChunks(message.text);
  const entities = extractEntities(chunks);

  return {
    id: message.id,
    source: message.source,
    threadId: message.threadId,
    sender: message.sender,
    text: message.text,
    occurredAt: message.occurredAt,
    chunks,
    entities
  };
}

function createStaticConnector(kind, name) {
  return {
    id: kind,
    name,
    kind,
    syncMode: "polling",
    status: "needs_configuration"
  };
}

function resolveDryRunReadiness(kind, env, runtimeEnv) {
  if (kind === "telegram") {
    const status = resolveTelegramStatus(env);
    return {
      ready: status.mode === "live",
      reason: status.mode === "live" ? "Telegram credentials are configured." : status.reason
    };
  }
  if (kind === "rss") {
    return {
      ready: Boolean(runtimeEnv.rssFeedUrl),
      reason: runtimeEnv.rssFeedUrl ? "RSS feed URL configured." : "No RSS feed URL configured."
    };
  }
  if (kind === "pdf") {
    return {
      ready: Boolean(runtimeEnv.pdfDirectory),
      reason: runtimeEnv.pdfDirectory ? "PDF directory configured." : "No PDF directory configured."
    };
  }
  if (kind === "feishu") {
    const enabled = String(env?.FEISHU_SYNC_ENABLED ?? "").toLowerCase() === "true";
    const ready = enabled && Boolean(env?.FEISHU_APP_ID) && Boolean(env?.FEISHU_APP_SECRET);
    return { ready, reason: ready ? "Feishu credentials are configured." : "Feishu connector is not configured." };
  }
  if (kind === "youtube") {
    const enabled = String(env?.YOUTUBE_SYNC_ENABLED ?? "").toLowerCase() === "true";
    const ready = enabled && Boolean(env?.YOUTUBE_API_KEY);
    return { ready, reason: ready ? "YouTube API key is configured." : "YouTube connector is not configured." };
  }
  if (kind === "wechat") {
    const enabled = String(env?.WECHAT_SYNC_ENABLED ?? "").toLowerCase() === "true";
    const ready = enabled && Boolean(env?.WECHAT_EXPORT_PATH);
    return { ready, reason: ready ? "WeChat export path is configured." : "WeChat export path is missing." };
  }
  if (kind === "web") {
    const enabled = String(env?.WEB_SYNC_ENABLED ?? "").toLowerCase() === "true";
    const ready = enabled && Boolean(env?.WEB_CLIP_FEED_PATH);
    return { ready, reason: ready ? "Web clip feed path is configured." : "Web clip feed is missing." };
  }
  return { ready: false, reason: "Unknown connector kind." };
}

export function createIngestionService({
  env = process.env,
  fetchFeed,
  fetchConnectorPayload,
  rssFeedUrl,
  pdfDirectory
} = {}) {
  const runtimeEnv = { ...readRuntimeEnv(env), rssFeedUrl, pdfDirectory };
  const queue = [];
  const connectorCursor = new Map();
  const lastSyncAt = new Map();
  const supportedConnectorKinds = new Set(["telegram", "wechat", "feishu", "youtube", "web", "rss", "pdf"]);

  function getConnectorCatalog() {
    return [
      createStaticConnector("telegram", "Telegram"),
      createStaticConnector("wechat", "WeChat"),
      createStaticConnector("feishu", "Feishu"),
      createStaticConnector("youtube", "YouTube"),
      createStaticConnector("web", "Web Clipper"),
      createStaticConnector("rss", "RSS Feed"),
      createStaticConnector("pdf", "PDF Library")
    ];
  }

  async function syncConnectorByKind(kind, options = {}) {
    const normalized = normalizeSyncOptions({
      ...options,
      cursor: options.cursor ?? connectorCursor.get(kind) ?? null
    });
    const { cursor, limit, since } = normalized;

    if (kind === "rss") {
      const items = runtimeEnv.rssFeedUrl
        ? await loadRssFeed(runtimeEnv.rssFeedUrl, fetchFeed)
        : [];
      const result = {
        kind,
        mode: runtimeEnv.rssFeedUrl ? "live" : "degraded",
        cursor: cursor ?? 1,
        items,
        stats: {
          count: items.length,
          durationMs: 0
        },
        reason: runtimeEnv.rssFeedUrl ? "" : "No RSS feed URL configured.",
        error: null
      };
      connectorCursor.set(kind, result.cursor);
      lastSyncAt.set(kind, new Date().toISOString());
      return result;
    }

    if (kind === "pdf") {
      const items = runtimeEnv.pdfDirectory
        ? await loadPdfDirectory(runtimeEnv.pdfDirectory)
        : [];
      const result = {
        kind,
        mode: runtimeEnv.pdfDirectory ? "live" : "degraded",
        cursor: cursor ?? 1,
        items,
        stats: {
          count: items.length,
          durationMs: 0
        },
        reason: runtimeEnv.pdfDirectory ? "" : "No PDF directory configured.",
        error: null
      };
      connectorCursor.set(kind, result.cursor);
      lastSyncAt.set(kind, new Date().toISOString());
      return result;
    }

    if (kind === "telegram") {
      const status = resolveTelegramStatus(env);
      const nextCursor = typeof cursor === "number" ? cursor + 1 : 1;
      const result = {
        kind,
        mode: status.mode,
        cursor: nextCursor,
        items: status.mode === "live" ? [{ id: `telegram-${nextCursor}`, text: "telegram incremental sync" }] : [],
        stats: {
          count: status.mode === "live" ? 1 : 0,
          durationMs: 0
        },
        reason: status.reason,
        error: null
      };
      connectorCursor.set(kind, nextCursor);
      lastSyncAt.set(kind, new Date().toISOString());
      return result;
    }

    const connectorOptions = {
      env,
      cursor,
      limit,
      since,
      fetchJson: fetchConnectorPayload
    };

    let result;
    if (kind === "feishu") {
      result = await syncFeishu(connectorOptions);
    } else if (kind === "youtube") {
      result = await syncYouTube(connectorOptions);
    } else if (kind === "wechat") {
      result = await syncWeChat(connectorOptions);
    } else if (kind === "web") {
      result = await syncWebClip(connectorOptions);
    } else {
      result = {
        kind,
        mode: "degraded",
        cursor,
        items: [],
        stats: { count: 0, durationMs: 0 },
        reason: "Unknown connector",
        error: null
      };
    }

    connectorCursor.set(kind, result.cursor ?? cursor ?? null);
    lastSyncAt.set(kind, new Date().toISOString());
    return result;
  }

  return {
    getConnectorCatalog,

    async syncConnectorByKind(kind, options = {}) {
      return syncConnectorByKind(kind, options);
    },

    async syncAllConnectors(options = {}) {
      if (options.connector && !supportedConnectorKinds.has(options.connector)) {
        throw new Error(`Unsupported connector kind: ${options.connector}`);
      }
      const startedAt = Date.now();
      const connectors = getConnectorCatalog();
      const targetKinds = options.connector
        ? connectors.filter((connector) => connector.kind === options.connector).map((connector) => connector.kind)
        : connectors.map((connector) => connector.kind);
      const snapshots = options.dryRun
        ? targetKinds.map((kind) => {
            const readiness = resolveDryRunReadiness(kind, env, runtimeEnv);
            return {
              kind,
              mode: "dry_run",
              readiness: readiness.ready ? "ready" : "blocked",
              cursor: options.cursor ?? connectorCursor.get(kind) ?? null,
              items: [],
              stats: { count: 0, durationMs: 0 },
              reason: `Dry run mode: ${readiness.reason}`,
              error: null
            };
          })
        : await Promise.all(targetKinds.map((kind) => syncConnectorByKind(kind, options)));
      const completedAt = Date.now();
      const summary = {
        requested: {
          connector: options.connector ?? null,
          cursor: options.cursor ?? null,
          since: options.since ?? null,
          limit: options.limit ?? null,
          dryRun: Boolean(options.dryRun ?? false)
        },
        total: snapshots.length,
        success: snapshots.filter((snapshot) => snapshot.mode === "live").length,
        degraded: snapshots.filter((snapshot) => snapshot.mode === "degraded").length,
        failed: snapshots.filter((snapshot) => Boolean(snapshot.error)).length,
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date(completedAt).toISOString(),
        durationMs: completedAt - startedAt
      };

      return {
        snapshots: snapshots.map((snapshot) => ({
          ...snapshot,
          lastSyncedAt: lastSyncAt.get(snapshot.kind) ?? null
        })),
        summary
      };
    },

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

    enqueueImMessage({ source = "telegram", threadId = "default", sender = "unknown", text = "", occurredAt = new Date().toISOString() }) {
      const message = {
        id: `im-${Date.now()}-${queue.length + 1}`,
        source,
        threadId,
        sender,
        text,
        occurredAt
      };
      queue.push(message);
      return message;
    },

    async processQueuedImMessages(handler) {
      const processed = [];

      while (queue.length > 0) {
        const message = queue.shift();
        const event = toIngestionEvent(message);
        if (typeof handler === "function") {
          await handler(event);
        }

        processed.push(event);
      }

      return processed;
    },

    async listSources() {
      const telegram = resolveTelegramStatus(env);
      const { snapshots } = await this.syncAllConnectors();
      const byKind = new Map(snapshots.map((snapshot) => [snapshot.kind, snapshot]));
      const rss = byKind.get("rss") ?? { mode: "degraded", items: [], cursor: null };
      const pdf = byKind.get("pdf") ?? { mode: "degraded", items: [], cursor: null };

      return [
        createSource({
          id: "telegram",
          name: "Telegram",
          kind: "telegram",
          status: telegram.status,
          mode: telegram.mode,
          count: byKind.get("telegram")?.items.length ?? 0,
          detail: telegram.reason,
          lastSyncedAt: lastSyncAt.get("telegram") ?? "",
          nextCursor: byKind.get("telegram")?.cursor ?? null,
          error: byKind.get("telegram")?.error ?? null
        }),
        ...["wechat", "feishu", "youtube", "web"].map((kind) => {
          const snapshot = byKind.get(kind) ?? { mode: "degraded", items: [], cursor: null, error: null };
          return createSource({
            id: kind,
            name: kind === "web" ? "Web Clipper" : kind.charAt(0).toUpperCase() + kind.slice(1),
            kind,
            status: snapshot.mode === "live" ? "connected" : "needs_configuration",
            mode: snapshot.mode,
            count: snapshot.items.length,
            detail: snapshot.reason || (snapshot.mode === "live" ? `cursor=${snapshot.cursor}` : "Connector disabled"),
            lastSyncedAt: lastSyncAt.get(kind) ?? "",
            nextCursor: snapshot.cursor,
            error: snapshot.error
          });
        }),
        createSource({
          id: "rss",
          name: "RSS Feed",
          kind: "rss",
          status: rss.mode === "live" ? "connected" : "needs_configuration",
          mode: rss.mode,
          count: rss.items.length,
          detail: rss.mode === "live" ? `cursor=${rss.cursor}` : "No RSS feed URL configured.",
          lastSyncedAt: lastSyncAt.get("rss") ?? "",
          nextCursor: rss.cursor,
          error: rss.error ?? null
        }),
        createSource({
          id: "pdf",
          name: "PDF Library",
          kind: "pdf",
          status: pdf.mode === "live" ? "indexed" : "needs_configuration",
          mode: pdf.mode,
          count: pdf.items.length,
          detail: pdf.mode === "live" ? `cursor=${pdf.cursor}` : "No PDF directory configured.",
          lastSyncedAt: lastSyncAt.get("pdf") ?? "",
          nextCursor: pdf.cursor,
          error: pdf.error ?? null
        })
      ];
    }
  };
}
