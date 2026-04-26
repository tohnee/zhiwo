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
      MERGE (s1:SourceDocument {id: 'rss'})
      SET s1.title = 'Board Memo', s1.kind = 'rss',
          s1.content = 'Board memo content. The team positions KnowledgeOS as an AI-native operating layer for personal research workflows.'
      MERGE (s2:SourceDocument {id: 'pdf'})
      SET s2.title = 'Research Dossier', s2.kind = 'pdf',
          s2.content = 'Research dossier content. PDF evidence captures product principles, citations and durable references for later note synthesis.'
      MERGE (e1:SourceExcerpt {id: 'excerpt-rss-1'})
      SET e1.title = 'Memo excerpt', e1.text = 'The team positions KnowledgeOS as an AI-native operating layer for personal research workflows.', e1.order = 1
      MERGE (e2:SourceExcerpt {id: 'excerpt-rss-2'})
      SET e2.title = 'Workflow excerpt', e2.text = 'Source ingestion, graph grounding and note capture should remain traceable end to end.', e2.order = 2
      MERGE (e3:SourceExcerpt {id: 'excerpt-pdf-1'})
      SET e3.title = 'Dossier excerpt', e3.text = 'PDF evidence captures product principles, citations and durable references for later note synthesis.', e3.order = 1
      MERGE (s1)-[:HAS_EXCERPT]->(e1)
      MERGE (s1)-[:HAS_EXCERPT]->(e2)
      MERGE (s2)-[:HAS_EXCERPT]->(e3)
      MERGE (f1:NoteFolder {id: 'folder-root'})
      SET f1.name = 'Workspace', f1.path = 'Workspace'
      MERGE (f2:NoteFolder {id: 'folder-research'})
      SET f2.name = 'Research', f2.path = 'Workspace/Research'
      MERGE (f3:NoteFolder {id: 'folder-ideas'})
      SET f3.name = 'Ideas', f3.path = 'Workspace/Research/Ideas'
      MERGE (f1)-[:HAS_CHILD]->(f2)
      MERGE (f2)-[:HAS_CHILD]->(f3)
      `
    );
  } finally {
    await session.close();
  }
}

function mapSourceDocumentRecord(record) {
  return {
    id: record.get("id"),
    title: record.get("title"),
    kind: record.get("kind"),
    content: record.get("content"),
    excerpts: record.get("excerpts") ?? []
  };
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

export async function loadSourceDocumentsFromNeo4j(driver) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (s:SourceDocument)
      OPTIONAL MATCH (s)-[:HAS_EXCERPT]->(e:SourceExcerpt)
      WITH s, e ORDER BY e.order ASC
      RETURN s.id AS id,
             s.title AS title,
             s.kind AS kind,
             s.content AS content,
             collect(
               CASE
                 WHEN e IS NULL THEN NULL
                 ELSE {
                   id: e.id,
                   sourceId: s.id,
                   title: e.title,
                   text: e.text,
                   order: e.order
                 }
               END
             ) AS rawExcerpts
      ORDER BY id
      `
    );

    return result.records.map((record) => ({
      ...mapSourceDocumentRecord({
        get(key) {
          if (key !== "excerpts") {
            return record.get(key);
          }

          return (record.get("rawExcerpts") ?? []).filter(Boolean);
        }
      })
    }));
  } finally {
    await session.close();
  }
}

export async function getSourceDocumentFromNeo4j(driver, id) {
  const sources = await loadSourceDocumentsFromNeo4j(driver);
  return sources.find((source) => source.id === id) ?? null;
}

function mapFolder(records, id) {
  const record = records.find((item) => item.id === id);
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    path: record.path,
    children: records
      .filter((item) => item.parentId === id)
      .map((item) => mapFolder(records, item.id))
      .filter(Boolean)
  };
}

export async function getNoteTreeFromNeo4j(driver) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (f:NoteFolder)
      OPTIONAL MATCH (parent:NoteFolder)-[:HAS_CHILD]->(f)
      RETURN f.id AS id, f.name AS name, f.path AS path, parent.id AS parentId
      ORDER BY f.path
      `
    );
    const records = result.records.map((record) => ({
      id: record.get("id"),
      name: record.get("name"),
      path: record.get("path"),
      parentId: record.get("parentId")
    }));

    return mapFolder(records, "folder-root");
  } finally {
    await session.close();
  }
}

export async function getNoteDocumentFromNeo4j(driver, id) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (n:NoteDocument {id: $id})
      RETURN n.id AS id, n.title AS title, n.folderId AS folderId, n.content AS content
      `,
      { id }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      id: record.get("id"),
      title: record.get("title"),
      folderId: record.get("folderId"),
      content: record.get("content"),
      citations: []
    };
  } finally {
    await session.close();
  }
}

export async function saveNoteDocumentToNeo4j(driver, note) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MERGE (n:NoteDocument {id: $id})
      SET n.title = $title, n.folderId = $folderId, n.content = $content
      RETURN n.id AS id, n.title AS title, n.folderId AS folderId, n.content AS content
      `,
      note
    );
    const record = result.records[0];

    return {
      id: record.get("id"),
      title: record.get("title"),
      folderId: record.get("folderId"),
      content: record.get("content"),
      citations: note.citations ?? []
    };
  } finally {
    await session.close();
  }
}

export async function createNoteFolderInNeo4j(driver, input) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (parent:NoteFolder {id: $parentId})
      CREATE (folder:NoteFolder {
        id: $id,
        name: $name,
        path: parent.path + '/' + $name
      })
      MERGE (parent)-[:HAS_CHILD]->(folder)
      RETURN folder.id AS id, folder.name AS name, folder.path AS path
      `,
      {
        id: `folder-${input.name.toLowerCase()}`,
        parentId: input.parentId,
        name: input.name
      }
    );
    const record = result.records[0];

    return {
      id: record.get("id"),
      name: record.get("name"),
      path: record.get("path"),
      children: []
    };
  } finally {
    await session.close();
  }
}

export async function moveNoteDocumentInNeo4j(driver, input) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (n:NoteDocument {id: $noteId})
      SET n.folderId = $folderId
      RETURN n.id AS id, n.title AS title, n.folderId AS folderId, n.content AS content
      `,
      input
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      id: record.get("id"),
      title: record.get("title"),
      folderId: record.get("folderId"),
      content: record.get("content"),
      citations: []
    };
  } finally {
    await session.close();
  }
}

export async function saveAnswerToNeo4j(driver, input) {
  await ensureNeo4jSeedData(driver);
  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (f:NoteFolder {id: $folderId})
      CREATE (n:NoteDocument {
        id: $id,
        title: $title,
        folderId: $folderId,
        content: $content
      })
      MERGE (f)-[:HAS_NOTE]->(n)
      RETURN n.id AS id, n.title AS title, n.folderId AS folderId, n.content AS content
      `,
      {
        id: `note-${Date.now()}`,
        folderId: input.folderId,
        title: input.title,
        content: input.content
      }
    );
    const record = result.records[0];

    return {
      note: {
        id: record.get("id"),
        title: record.get("title"),
        folderId: record.get("folderId"),
        content: record.get("content")
      }
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
