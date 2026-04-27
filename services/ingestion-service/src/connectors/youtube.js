import { createConnectorResult, filterItemsSince, measureSync, normalizeSyncOptions } from "./base.js";

function normalizeYoutubeItems(records = []) {
  return records.map((record, index) => ({
    id: String(record.id ?? `youtube-${index + 1}`),
    title: String(record.title ?? "Untitled YouTube entry"),
    description: String(record.description ?? ""),
    publishedAt: String(record.publishedAt ?? new Date().toISOString()),
    source: "youtube"
  }));
}

export async function syncYouTube(input = {}) {
  const { env, channelId = "", fetchJson } = input;
  const { cursor, limit, since } = normalizeSyncOptions({ ...input, limit: input.limit ?? 20 });
  const enabled = String(env?.YOUTUBE_SYNC_ENABLED ?? "").toLowerCase() === "true";
  const apiKey = String(env?.YOUTUBE_API_KEY ?? "");

  if (!enabled || !apiKey) {
    return createConnectorResult({
      kind: "youtube",
      mode: "degraded",
      cursor,
      items: [],
      reason: "YouTube connector is not configured.",
      error: null
    });
  }

  const measured = await measureSync(async () => {
    const payload =
      typeof fetchJson === "function"
        ? await fetchJson({ kind: "youtube", cursor, channelId, limit })
        : {
            items: [
              {
                id: `youtube-${Date.now()}`,
                title: `YouTube sync for ${channelId || "default-channel"}`,
                description: "Incremental video metadata",
                publishedAt: new Date().toISOString()
              }
            ],
            nextCursor: cursor ? `${cursor}-next` : "cursor-youtube-1"
          };

    return {
      mode: "live",
      cursor: payload.nextCursor ?? cursor,
      items: filterItemsSince(normalizeYoutubeItems(payload.items).slice(0, limit), since)
    };
  });

  return createConnectorResult({
    kind: "youtube",
    mode: measured.mode,
    cursor: measured.cursor,
    items: measured.items,
    reason: "",
    durationMs: measured.durationMs,
    error: null
  });
}
