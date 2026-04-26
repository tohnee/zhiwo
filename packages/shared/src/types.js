export function createSource({
  id,
  name,
  kind,
  status,
  mode,
  count,
  detail = ""
}) {
  return {
    id,
    name,
    kind,
    status,
    mode,
    count,
    detail
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

export function createChatMessage(role, content) {
  return { role, content };
}
