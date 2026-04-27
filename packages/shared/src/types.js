export function createSource({
  id,
  name,
  kind,
  status,
  mode,
  count,
  detail = "",
  ...extra
}) {
  return {
    id,
    name,
    kind,
    status,
    mode,
    count,
    detail,
    ...extra
  };
}

export function createSourceExcerpt({
  id,
  sourceId,
  title,
  text,
  order = 0
}) {
  return {
    id,
    sourceId,
    title,
    text,
    order
  };
}

export function createSourceDocument({
  id,
  title,
  kind,
  content,
  excerpts = []
}) {
  return {
    id,
    title,
    kind,
    content,
    excerpts
  };
}

export function createNoteFolder({
  id,
  name,
  path,
  children = []
}) {
  return {
    id,
    name,
    path,
    children
  };
}

export function createNoteDocument({
  id,
  title,
  folderId,
  content,
  citations = []
}) {
  return {
    id,
    title,
    folderId,
    content,
    citations
  };
}

export function createGraphNode({
  id,
  label,
  type,
  confidence,
  summary,
  metadata = {}
}) {
  return {
    id,
    label,
    type,
    confidence,
    summary,
    metadata
  };
}

export function createEditorBlock({
  id,
  type = "text",
  content,
  sourceIds = []
}) {
  return {
    id,
    type,
    content,
    sourceIds
  };
}

export function createEntity({ id, label, type = "Concept", attributes = {} }) {
  return {
    id,
    label,
    type,
    attributes
  };
}

export function createRelation({ id, from, to, type, evidence = "" }) {
  return {
    id,
    from,
    to,
    type,
    evidence
  };
}

export function createTimelineEvent({ id, entityId, occurredAt, summary, sourceId }) {
  return {
    id,
    entityId,
    occurredAt,
    summary,
    sourceId
  };
}

export function createConflict({ id, leftEntityId, rightEntityId, reason, status = "open" }) {
  return {
    id,
    leftEntityId,
    rightEntityId,
    reason,
    status
  };
}

export function createGraphRagSchema() {
  return {
    entities: ["Person", "Concept", "Event", "Decision"],
    relations: ["says", "references", "contradicts", "causes"],
    timeline: {
      key: "occurredAt",
      mode: "append_only"
    },
    conflict: {
      strategy: "rule+agent",
      statuses: ["open", "validated", "dismissed"]
    }
  };
}

export function createChatMessage(role, content) {
  return { role, content };
}
