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
