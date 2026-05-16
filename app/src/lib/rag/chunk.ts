/**
 * ChiefOS — markdown chunker for vault ingestion (PRD §5.4).
 *
 * Strategy: walk paragraph-by-paragraph (blank-line separated), accumulating
 * words until we hit the target size. Carry an overlap window from the tail
 * of the last chunk so neighboring chunks share context. Whole-file embedding
 * for short files, per PRD.
 *
 * Word-count is a rough proxy for token count — for `text-embedding-3-small`
 * the ratio is close enough that we don't need tiktoken in the runtime.
 */

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number; // approximated as word count
}

interface ChunkOptions {
  /** Target words per chunk (~500 tokens for English prose). */
  targetWords?: number;
  /** Words of overlap between consecutive chunks. */
  overlapWords?: number;
  /** Files shorter than this skip chunking and become one chunk. */
  wholeFileWordThreshold?: number;
}

export function chunkMarkdown(text: string, opts: ChunkOptions = {}): Chunk[] {
  const targetWords = opts.targetWords ?? 500;
  const overlapWords = opts.overlapWords ?? 100;
  const wholeFileThreshold = opts.wholeFileWordThreshold ?? 500;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const totalWords = countWords(normalized);
  if (totalWords <= wholeFileThreshold) {
    return [{ index: 0, content: normalized, tokenCount: totalWords }];
  }

  // Split into paragraphs but treat headings as their own paragraph so a
  // chunk boundary doesn't decapitate a section.
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;
  let carryover: string[] = []; // tail words from the last chunk for overlap

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.join("\n\n").trim();
    if (!content) return;
    const words = countWords(content);
    chunks.push({
      index: chunks.length,
      content,
      tokenCount: words,
    });
    // Compute carryover from the last N words of this chunk.
    const allWords = content.split(/\s+/);
    carryover =
      overlapWords > 0 ? allWords.slice(-overlapWords) : [];
    buffer = [];
    bufferWords = 0;
  };

  for (const para of paragraphs) {
    const paraWords = countWords(para);

    // Start a new chunk with carryover seeded as a context prefix.
    if (buffer.length === 0 && carryover.length > 0) {
      buffer.push(`…${carryover.join(" ")}`);
      bufferWords += carryover.length;
    }

    // Oversized single paragraph — split it on word boundary.
    if (paraWords > targetWords) {
      // Flush whatever is currently buffered first.
      flush();
      const words = para.split(/\s+/);
      for (let i = 0; i < words.length; i += targetWords) {
        const slice = words.slice(i, i + targetWords).join(" ");
        chunks.push({
          index: chunks.length,
          content: slice,
          tokenCount: countWords(slice),
        });
        carryover =
          overlapWords > 0
            ? slice.split(/\s+/).slice(-overlapWords)
            : [];
      }
      continue;
    }

    if (bufferWords + paraWords > targetWords && buffer.length > 0) {
      flush();
      if (carryover.length > 0) {
        buffer.push(`…${carryover.join(" ")}`);
        bufferWords += carryover.length;
      }
    }

    buffer.push(para);
    bufferWords += paraWords;
  }

  flush();
  return chunks;
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
