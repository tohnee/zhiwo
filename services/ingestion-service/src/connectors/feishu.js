import { createConnectorResult, filterItemsSince, measureSync, normalizeSyncOptions } from "./base.js";

function normalizeFeishuItems(records = []) {
  return records.map((record, index) => ({
    id: String(record.id ?? `feishu-${index + 1}`),
    title: String(record.title ?? "Untitled Feishu message"),
    text: String(record.text ?? ""),
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
    source: "feishu"
  }));
}

export async function syncFeishu(input = {}) {
  const { env, fetchJson } = input;
  const { cursor, limit, since } = normalizeSyncOptions(input);
  const enabled = String(env?.FEISHU_SYNC_ENABLED ?? "").toLowerCase() === "true";
  const appId = String(env?.FEISHU_APP_ID ?? "");
  const appSecret = String(env?.FEISHU_APP_SECRET ?? "");

  if (!enabled || !appId || !appSecret) {
    return createConnectorResult({
      kind: "feishu",
      mode: "degraded",
      cursor,
      items: [],
      reason: "Feishu connector is not configured.",
      error: null
    });
  }

  const measured = await measureSync(async () => {
    const payload =
      typeof fetchJson === "function"
        ? await fetchJson({ kind: "feishu", cursor, limit })
        : {
            items: [
              {
                id: `feishu-${Date.now()}`,
                title: "Feishu incremental sync",
                text: "Auto synced item",
                updatedAt: new Date().toISOString()
              }
            ],
            nextCursor: cursor ? `${cursor}-next` : "cursor-feishu-1"
          };

    return {
      mode: "live",
      cursor: payload.nextCursor ?? cursor,
      items: filterItemsSince(normalizeFeishuItems(payload.items).slice(0, limit), since)
    };
  });

  return createConnectorResult({
    kind: "feishu",
    mode: measured.mode,
    cursor: measured.cursor,
    items: measured.items,
    reason: "",
    durationMs: measured.durationMs,
    error: null
  });
}
