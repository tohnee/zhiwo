# Ingestion Service

负责连接外部数据源并将原始内容转为结构化知识。

## MVP 状态

- 当前通过 `apps/api-gateway` 的 `/api/ingest` 模拟同步
- 后续可拆分 Telegram、RSS、PDF 等 connector pipeline

## 未来职责

- Source connector scheduling
- Parsing / chunking / entity extraction
- Sync status tracking
