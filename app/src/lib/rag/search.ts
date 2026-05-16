import { embedText } from "@/lib/rag/embed";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface RetrievedChunk {
  chunk_id: string;
  file_id: string;
  file_path: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

const DEFAULT_K = 8;

export async function searchVault(args: {
  userId: string;
  query: string;
  k?: number;
}): Promise<RetrievedChunk[]> {
  const query = args.query.trim();
  if (!query) return [];
  const k = args.k ?? DEFAULT_K;
  const queryEmbedding = await embedText({
    userId: args.userId,
    text: query,
    requestRef: "chat-query",
  });
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("match_note_chunks", {
    query_embedding: queryEmbedding,
    match_count: k,
    user_id_arg: args.userId,
  });
  if (error) throw error;
  return (data ?? []) as RetrievedChunk[];
}
