import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createConnectorResult, filterItemsSince, measureSync, normalizeSyncOptions } from "./connectors/base.js";
import { syncFeishu } from "./connectors/feishu.js";
import { syncYouTube } from "./connectors/youtube.js";
import { syncWeChat } from "./connectors/wechat.js";
import { syncWebClip } from "./connectors/web.js";
import { createIngestionService } from "./index.js";

test("base connector result includes stats and duration", () => {
  const result = createConnectorResult({
    kind: "feishu",
    mode: "live",
    cursor: "c1",
    items: [{ id: "1" }],
    durationMs: 12
  });

  assert.equal(result.stats.count, 1);
  assert.equal(result.stats.durationMs, 12);
});

test("measureSync wraps async sync with duration", async () => {
  const result = await measureSync(async () => ({ mode: "live", cursor: "x", items: [] }));
  assert.equal(typeof result.durationMs, "number");
});

test("normalizeSyncOptions sanitizes limit and since", () => {
  const options = normalizeSyncOptions({
    cursor: "c1",
    limit: 9999,
    since: "2026-04-25T00:00:00.000Z"
  });
  assert.equal(options.cursor, "c1");
  assert.equal(options.limit, 200);
  assert.equal(options.since, "2026-04-25T00:00:00.000Z");
});

test("filterItemsSince keeps records newer than since", () => {
  const items = [
    { id: "1", updatedAt: "2026-04-24T00:00:00.000Z" },
    { id: "2", updatedAt: "2026-04-26T00:00:00.000Z" }
  ];
  const filtered = filterItemsSince(items, "2026-04-25T00:00:00.000Z");
  assert.deepEqual(filtered.map((item) => item.id), ["2"]);
});

test("feishu sync returns degraded when credentials missing", async () => {
  const result = await syncFeishu({ env: {} });
  assert.equal(result.mode, "degraded");
});

test("feishu sync returns cursor and normalized items when enabled", async () => {
  const result = await syncFeishu({
    env: {
      FEISHU_SYNC_ENABLED: "true",
      FEISHU_APP_ID: "id",
      FEISHU_APP_SECRET: "secret"
    },
    fetchJson: async () => ({
      items: [{ id: "feishu-1", title: "Title", text: "Body" }],
      nextCursor: "cursor-feishu-next"
    })
  });

  assert.equal(result.mode, "live");
  assert.equal(result.cursor, "cursor-feishu-next");
  assert.equal(result.items[0].source, "feishu");
});

test("youtube sync returns degraded when api key missing", async () => {
  const result = await syncYouTube({ env: {} });
  assert.equal(result.mode, "degraded");
});

test("youtube sync normalizes records with next cursor", async () => {
  const result = await syncYouTube({
    env: {
      YOUTUBE_SYNC_ENABLED: "true",
      YOUTUBE_API_KEY: "token"
    },
    fetchJson: async () => ({
      items: [{ id: "yt-1", title: "Video", description: "Desc" }],
      nextCursor: "cursor-yt-next"
    })
  });

  assert.equal(result.mode, "live");
  assert.equal(result.cursor, "cursor-yt-next");
  assert.equal(result.items[0].source, "youtube");
});

test("wechat sync reads export file when provided", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "knowledgeos-wechat-"));
  const filePath = path.join(directory, "wechat.json");
  await writeFile(filePath, JSON.stringify({ items: [{ id: "wx-1", title: "Msg", text: "Text" }], nextCursor: "wx-next" }), "utf8");

  const result = await syncWeChat({
    env: {
      WECHAT_SYNC_ENABLED: "true",
      WECHAT_EXPORT_PATH: filePath
    }
  });

  assert.equal(result.mode, "live");
  assert.equal(result.cursor, "wx-next");
  assert.equal(result.items[0].source, "wechat");
});

test("web clip sync degraded without feed", async () => {
  const result = await syncWebClip({ env: {} });
  assert.equal(result.mode, "degraded");
});

test("web clip sync normalizes records from feed", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "knowledgeos-webclip-"));
  const filePath = path.join(directory, "clips.json");
  await writeFile(filePath, JSON.stringify({ items: [{ id: "clip-1", url: "https://example.com", title: "Clip" }], nextCursor: "web-next" }), "utf8");

  const result = await syncWebClip({
    env: {
      WEB_SYNC_ENABLED: "true",
      WEB_CLIP_FEED_PATH: filePath
    }
  });

  assert.equal(result.mode, "live");
  assert.equal(result.cursor, "web-next");
  assert.equal(result.items[0].source, "web");
});

test("loads RSS entries from a real feed response", async () => {
  const service = createIngestionService({
    fetchFeed: async () => `<?xml version="1.0"?>
      <rss><channel>
      <item><title>First signal</title><link>https://example.com/1</link><pubDate>Sat, 25 Apr 2026 00:00:00 GMT</pubDate></item>
      <item><title>Second signal</title><link>https://example.com/2</link><pubDate>Sat, 25 Apr 2026 01:00:00 GMT</pubDate></item>
      </channel></rss>`
  });

  const result = await service.syncRss("https://example.com/feed.xml");

  assert.equal(result.mode, "live");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].title, "First signal");
});

test("scans a local PDF directory and returns parsed documents", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "knowledgeos-pdf-"));
  const filePath = path.join(directory, "memo.pdf");
  await writeFile(
    filePath,
    Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nstream\nInvestment Memo For KnowledgeOS\nendstream\nendobj\n%%EOF")
  );

  const service = createIngestionService();
  const result = await service.syncPdfDirectory(directory);

  assert.equal(result.mode, "live");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].fileName, "memo.pdf");
});

test("returns degraded Telegram status when credentials are missing", async () => {
  const service = createIngestionService({
    env: {
      TELEGRAM_API_ID: "",
      TELEGRAM_API_HASH: "",
      TELEGRAM_BOT_TOKEN: ""
    }
  });

  const result = await service.getTelegramStatus();

  assert.equal(result.mode, "degraded");
  assert.match(result.reason, /credentials/i);
});

test("queues IM messages and processes async ingestion events", async () => {
  const service = createIngestionService();
  const message = service.enqueueImMessage({
    source: "telegram",
    sender: "alice",
    text: "OpenAI roadmap Decision"
  });

  const events = await service.processQueuedImMessages();

  assert.match(message.id, /^im-/);
  assert.equal(events.length, 1);
  assert.equal(events[0].entities.length > 0, true);
  assert.equal(events[0].source, "telegram");
});

test("syncAllConnectors supports single connector mode and summary", async () => {
  const service = createIngestionService({
    env: {
      FEISHU_SYNC_ENABLED: "true",
      FEISHU_APP_ID: "id",
      FEISHU_APP_SECRET: "secret"
    },
    fetchConnectorPayload: async () => ({
      items: [{ id: "feishu-1", title: "Feishu Item" }],
      nextCursor: "f2"
    })
  });

  const result = await service.syncAllConnectors({ connector: "feishu", cursor: "f1" });

  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.success, 1);
  assert.equal(result.summary.requested.connector, "feishu");
  assert.equal(typeof result.summary.durationMs, "number");
  assert.equal(result.snapshots[0].kind, "feishu");
  assert.equal(result.snapshots[0].cursor, "f2");
  assert.equal(typeof result.snapshots[0].lastSyncedAt, "string");
});

test("syncAllConnectors throws on unsupported connector kind", async () => {
  const service = createIngestionService();
  await assert.rejects(() => service.syncAllConnectors({ connector: "unknown" }), /Unsupported connector kind/);
});

test("syncAllConnectors supports dry run mode", async () => {
  const service = createIngestionService();
  const result = await service.syncAllConnectors({ connector: "feishu", dryRun: true, cursor: "dry-cursor" });

  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.requested.dryRun, true);
  assert.equal(result.snapshots[0].mode, "dry_run");
  assert.equal(result.snapshots[0].readiness, "blocked");
  assert.equal(result.snapshots[0].cursor, "dry-cursor");
  assert.match(result.snapshots[0].reason, /Feishu connector is not configured/i);
});
