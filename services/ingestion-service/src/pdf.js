import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function extractPrintableText(buffer) {
  return buffer
    .toString("latin1")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadPdfDirectory(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const pdfEntries = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"));

  const items = [];

  for (const entry of pdfEntries) {
    const fullPath = path.join(directoryPath, entry.name);
    const content = await readFile(fullPath);
    const text = extractPrintableText(content);

    items.push({
      id: `pdf-${entry.name}`,
      fileName: entry.name,
      path: fullPath,
      snippet: text.slice(0, 160)
    });
  }

  return items;
}
