export function createConnectorResult({
  kind,
  mode,
  cursor,
  items,
  reason = "",
  durationMs = 0,
  error = null
}) {
  return {
    kind,
    mode,
    cursor,
    items,
    stats: {
      count: items.length,
      durationMs
    },
    reason,
    error
  };
}

export async function measureSync(fn) {
  const startedAt = Date.now();
  const result = await fn();
  return {
    ...result,
    durationMs: Date.now() - startedAt
  };
}

export function normalizeSyncOptions(input = {}) {
  const rawLimit = Number(input.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 50;
  const since = input.since ? new Date(String(input.since)) : null;
  return {
    cursor: input.cursor ?? null,
    limit,
    since: since && !Number.isNaN(since.getTime()) ? since.toISOString() : null
  };
}

export function filterItemsSince(items = [], since = null) {
  if (!since) {
    return items;
  }
  const sinceTime = new Date(since).getTime();
  if (Number.isNaN(sinceTime)) {
    return items;
  }
  return items.filter((item) => {
    const candidate =
      item.updatedAt ??
      item.publishedAt ??
      item.savedAt ??
      item.occurredAt ??
      null;
    if (!candidate) {
      return true;
    }
    const value = new Date(candidate).getTime();
    if (Number.isNaN(value)) {
      return true;
    }
    return value >= sinceTime;
  });
}
