import { createOpenAIClient } from "@/lib/ai/openai";
import { withCostLogging } from "@/lib/cost/logger";

export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMS = 1536;

/**
 * Embed a batch of texts in one API call. Cost-logged as a single embedding
 * event covering the whole batch's token count.
 */
export async function embedTexts(args: {
  userId: string;
  texts: string[];
  requestRef?: string;
}): Promise<number[][]> {
  if (args.texts.length === 0) return [];
  const openai = createOpenAIClient();
  const embeddings = await withCostLogging({
    kind: "embedding",
    model: EMBED_MODEL,
    userId: args.userId,
    requestRef: args.requestRef ?? "embed",
    run: async () => {
      const res = await openai.embeddings.create({
        model: EMBED_MODEL,
        input: args.texts,
      });
      const inputTokens = res.usage?.prompt_tokens ?? 0;
      return {
        result: res.data.map((d) => d.embedding),
        inputTokens,
      };
    },
  });
  return embeddings;
}

/** Single-text helper. */
export async function embedText(args: {
  userId: string;
  text: string;
  requestRef?: string;
}): Promise<number[]> {
  const [vec] = await embedTexts({
    userId: args.userId,
    texts: [args.text],
    requestRef: args.requestRef,
  });
  return vec;
}
