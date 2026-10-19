const chunkSize = 1200;
const chunkOverlap = 150;

export type ParsedChunk = {
  chunkIndex: number;
  contentText: string;
  startOffset: number;
  endOffset: number;
};

function normalizeText(text: string, extension: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!normalized) throw new Error("เอกสารไม่มีข้อความที่สามารถวิเคราะห์ได้");
  if (extension === "json") {
    try {
      return `${JSON.stringify(JSON.parse(normalized), null, 2)}\n`;
    } catch {
      throw new Error("ไฟล์ JSON ไม่ถูกต้อง");
    }
  }
  return normalized;
}

export function parseDocument(text: string, extension: string): ParsedChunk[] {
  const normalized = normalizeText(text, extension);
  const chunks: ParsedChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const contentText = normalized.slice(start, end);
    chunks.push({ chunkIndex: index, contentText, startOffset: start, endOffset: end });
    if (end === normalized.length) break;
    start = end - chunkOverlap;
    index += 1;
  }
  return chunks;
}
