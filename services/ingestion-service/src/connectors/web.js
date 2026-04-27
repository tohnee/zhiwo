import { readFile } from "node:fs/promises";

import { createConnectorResult, filterItemsSince, measureSync, normalizeSyncOptions } from "./base.js";

export async function syncWebClip(input = {}) {
  const { env, fetchJson } = input;
  const { cursor, limit, since } = normalizeSyncOptions(input);
  const enabled = String(env?.WEB_SYNC_ENABLED ?? "").toLowerCase() === "true";
  const feedPath = String(env?.WEB_CLIP_FEED_PATH ?? "");

  if (!enabled || !feedPath) {
    return createConnectorResult({
      kind: "web",
      mode: "degraded",
      cursor,
      items: [],
      reason: "Web clip feed is missing.",
      error: null
    });
  }

  try {
    const measured = await measureSync(async () => {
      const payload =
        typeof fetchJson === "function"
          ? await fetchJson({ kind: "web", cursor, limit, feedPath })
          : JSON.parse(await readFile(feedPath, "utf8"));
      const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, limit);
      return {
        mode: "live",
        cursor: payload.nextCursor ?? cursor ?? "cursor-web-1",
        items: filterItemsSince(
          items.map((item, index) => ({
            id: String(item.id ?? `web-${index + 1}`),
            url: String(item.url ?? ""),
            title: String(item.title ?? "Untitled clip"),
            text: String(item.text ?? ""),
            savedAt: String(item.savedAt ?? new Date().toISOString()),
            source: "web"
          })),
          since
        )
      };
    });

    return createConnectorResult({
      kind: "web",
      mode: measured.mode,
      cursor: measured.cursor,
      items: measured.items,
      reason: "",
      durationMs: measured.durationMs,
      error: null
    });
  } catch (error) {
    return createConnectorResult({
      kind: "web",
      mode: "degraded",
      cursor,
      items: [],
      reason: "Failed to read web clip feed.",
      error: error.message
    });
  }
}
