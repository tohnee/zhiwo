import { hasNeo4jConfig, readRuntimeEnv } from "@knowledgeos/shared";
import neo4j from "neo4j-driver";

export async function createNeo4jClient(env = process.env) {
  if (!hasNeo4jConfig(env)) {
    return null;
  }

  const runtime = readRuntimeEnv(env);
  const driver = neo4j.driver(runtime.neo4jUri, neo4j.auth.basic(runtime.neo4jUsername, runtime.neo4jPassword));

  await driver.verifyConnectivity();
  return driver;
}

export async function ensureNeo4jSeedData(driver) {
  const session = driver.session();

  try {
    await session.run(
      `
      MERGE (n1:KnowledgeNode {id: 'n1'})
      SET n1.label = 'AI-native OS', n1.type = 'Concept', n1.confidence = 0.96,
          n1.summary = '系统核心定位', n1.sourceIds = ['rss', 'pdf']
      MERGE (n2:KnowledgeNode {id: 'n2'})
      SET n2.label = 'RSS Signals', n2.type = 'Source', n2.confidence = 0.82,
          n2.summary = '来自订阅源的信息流', n2.sourceIds = ['rss']
      MERGE (n3:KnowledgeNode {id: 'n3'})
      SET n3.label = 'Document Evidence', n3.type = 'Evidence', n3.confidence = 0.74,
          n3.summary = '来自 PDF 的证据条目', n3.sourceIds = ['pdf']
      MERGE (b1:EditorBlock {id: 'block-1'})
      SET b1.type = 'text', b1.content = '持续吸收信息流并结构化为知识图谱。', b1.sourceIds = ['rss', 'pdf']
      MERGE (b2:EditorBlock {id: 'block-2'})
      SET b2.type = 'text', b2.content = 'RSS 与 PDF 已经纳入真实 connector 规划。', b2.sourceIds = ['rss', 'pdf']
      `
    );
  } finally {
    await session.close();
  }
}

export async function loadGraphSummaryFromNeo4j(driver) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const nodesResult = await session.run(
      `
      MATCH (n:KnowledgeNode)
      RETURN n.id AS id, n.label AS label, n.type AS type, n.confidence AS confidence,
             n.summary AS summary, n.sourceIds AS sourceIds
      ORDER BY id
      `
    );
    const blocksResult = await session.run(
      `
      MATCH (b:EditorBlock)
      RETURN b.id AS id, b.type AS type, b.content AS content, b.sourceIds AS sourceIds
      ORDER BY id
      `
    );

    return {
      title: "Knowledge Graph",
      nodes: nodesResult.records.map((record) => ({
        id: record.get("id"),
        label: record.get("label"),
        type: record.get("type"),
        confidence: Number(record.get("confidence")),
        summary: record.get("summary"),
        metadata: {
          storageMode: "neo4j",
          sourceIds: record.get("sourceIds") ?? []
        }
      })),
      editorBlocks: blocksResult.records.map((record) => ({
        id: record.get("id"),
        type: record.get("type"),
        content: record.get("content"),
        sourceIds: record.get("sourceIds") ?? []
      }))
    };
  } finally {
    await session.close();
  }
}

export async function saveEditorBlockToNeo4j(driver, block) {
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MERGE (b:EditorBlock {id: $id})
      SET b.type = $type, b.content = $content, b.sourceIds = $sourceIds
      RETURN b.id AS id, b.type AS type, b.content AS content, b.sourceIds AS sourceIds
      `,
      block
    );
    const record = result.records[0];

    return {
      id: record.get("id"),
      type: record.get("type"),
      content: record.get("content"),
      sourceIds: record.get("sourceIds") ?? []
    };
  } finally {
    await session.close();
  }
}

export async function getNodeDetailFromNeo4j(driver, id) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (n:KnowledgeNode {id: $id})
      RETURN n.id AS id, n.label AS label, n.type AS type, n.confidence AS confidence,
             n.summary AS summary, n.sourceIds AS sourceIds
      `,
      { id }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      id: record.get("id"),
      label: record.get("label"),
      type: record.get("type"),
      confidence: Number(record.get("confidence")),
      summary: record.get("summary"),
      metadata: {
        storageMode: "neo4j",
        sourceIds: record.get("sourceIds") ?? []
      }
    };
  } finally {
    await session.close();
  }
}
