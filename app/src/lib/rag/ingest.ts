import { createHash } from "node:crypto";

import { chunkMarkdown } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Ingestion pipeline for one vault file. Service-role only — invoked from
 * webhooks and admin tools that already authenticated the user out-of-band.
 *
 * Idempotent: same content hash → no-op. New content → delete old chunks,
 * insert new chunks atomically (best-effort; pgvector single-table writes
 * don't need a transaction at our scale, but we still re-run the upsert in
 * the right order to avoid an empty window).
 */

export interface IngestResult {
  path: string;
  status: "unchanged" | "indexed" | "removed";
  chunkCount?: number;
  fileId?: string;
}

export async function ingestFile(args: {
  userId: string;
  path: string;
  content: string;
}): Promise<IngestResult> {
  const supabase = createSupabaseServiceClient();
  const content = args.content.replace(/\r\n/g, "\n").trim();
  const byteSize = Buffer.byteLength(content, "utf-8");
  const hash = sha256(content);

  // Upsert the file row first so we have an id even for short docs.
  const { data: existing } = await supabase
    .from("note_files")
    .select("id, content_hash")
    .eq("user_id", args.userId)
    .eq("path", args.path)
    .maybeSingle();

  if (existing && existing.content_hash === hash) {
    return { path: args.path, status: "unchanged", fileId: existing.id };
  }

  const { data: upserted, error: upsertErr } = await supabase
    .from("note_files")
    .upsert(
      {
        user_id: args.userId,
        path: args.path,
        content_hash: hash,
        byte_size: byteSize,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,path" },
    )
    .select("id")
    .single();
  if (upsertErr) throw upsertErr;
  const fileId = upserted.id as string;

  // Clear old chunks before re-embedding so we don't accumulate stale ones.
  await supabase.from("note_chunks").delete().eq("file_id", fileId);

  if (!content) {
    return { path: args.path, status: "indexed", chunkCount: 0, fileId };
  }

  const chunks = chunkMarkdown(content);
  if (chunks.length === 0) {
    return { path: args.path, status: "indexed", chunkCount: 0, fileId };
  }

  const embeddings = await embedTexts({
    userId: args.userId,
    texts: chunks.map((c) => c.content),
    requestRef: `ingest:${args.path}`,
  });
  if (embeddings.length !== chunks.length) {
    throw new Error(
      `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`,
    );
  }

  const rows = chunks.map((c, i) => ({
    user_id: args.userId,
    file_id: fileId,
    chunk_index: c.index,
    content: c.content,
    token_count: c.tokenCount,
    embedding: embeddings[i],
  }));

  // Insert in batches to keep payloads small.
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("note_chunks").insert(slice);
    if (error) throw error;
  }

  return {
    path: args.path,
    status: "indexed",
    chunkCount: chunks.length,
    fileId,
  };
}

export async function deleteFile(args: {
  userId: string;
  path: string;
}): Promise<IngestResult> {
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("note_files")
    .select("id")
    .eq("user_id", args.userId)
    .eq("path", args.path)
    .maybeSingle();
  if (!existing) {
    return { path: args.path, status: "removed", chunkCount: 0 };
  }
  // chunks cascade via FK ON DELETE
  await supabase.from("note_files").delete().eq("id", existing.id);
  return { path: args.path, status: "removed", fileId: existing.id };
}

export async function listIndexedFiles(userId: string): Promise<
  Array<{
    id: string;
    path: string;
    byte_size: number;
    updated_at: string;
  }>
> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("note_files")
    .select("id, path, byte_size, updated_at")
    .eq("user_id", userId)
    .order("path", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf-8").digest("hex");
}
