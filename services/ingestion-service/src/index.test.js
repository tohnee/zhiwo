import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createIngestionService } from "./index.js";

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
