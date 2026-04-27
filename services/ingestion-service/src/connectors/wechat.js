import { readFile } from "node:fs/promises";

import { createConnectorResult, filterItemsSince, measureSync, normalizeSyncOptions } from "./base.js";

export async function syncWeChat(input = {}) {
  const { env } = input;
  const { cursor, limit, since } = normalizeSyncOptions(input);
  const enabled = String(env?.WECHAT_SYNC_ENABLED ?? "").toLowerCase() === "true";
  const exportPath = String(env?.WECHAT_EXPORT_PATH ?? "");

  if (!enabled || !exportPath) {
    return createConnectorResult({
      kind: "wechat",
      mode: "degraded",
      cursor,
      items: [],
      reason: "WeChat export path is missing.",
      error: null
    });
  }

  try {
    const measured = await measureSync(async () => {
      const content = await readFile(exportPath, "utf8");
      const payload = JSON.parse(content);
      const items = Array.isArray(payload.items) ? payload.items : [];
      return {
        mode: "live",
        cursor: payload.nextCursor ?? cursor ?? "cursor-wechat-1",
        items: filterItemsSince(
          items
            .map((item, index) => ({
              id: String(item.id ?? `wechat-${index + 1}`),
              title: String(item.title ?? "WeChat export message"),
              text: String(item.text ?? ""),
              updatedAt: String(item.updatedAt ?? new Date().toISOString()),
              source: "wechat"
            }))
            .slice(0, limit),
          since
        )
      };
    });

    return createConnectorResult({
      kind: "wechat",
      mode: measured.mode,
      cursor: measured.cursor,
      items: measured.items,
      reason: "",
      durationMs: measured.durationMs,
      error: null
    });
  } catch (error) {
    return createConnectorResult({
      kind: "wechat",
      mode: "degraded",
      cursor,
      items: [],
      reason: "Failed to parse WeChat export.",
      error: error.message
    });
  }
}
