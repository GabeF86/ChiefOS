/**
 * ChiefOS — model pricing config (PRD §5.12)
 *
 * Update this file when providers change prices. Every Anthropic/OpenAI
 * call routes through the cost-logging wrapper, which looks up costs here.
 *
 * Prices in USD per 1M tokens (chat) or per unit (whisper).
 * Source of truth: provider docs as of 2026-05-15.
 */

export type Provider = "anthropic" | "openai";

export interface ChatPricing {
  kind: "chat";
  provider: Provider;
  model: string;
  inputPerMTokens: number;
  outputPerMTokens: number;
  cachedInputPerMTokens?: number; // optional cache-read price
}

export interface EmbeddingPricing {
  kind: "embedding";
  provider: Provider;
  model: string;
  inputPerMTokens: number;
}

export interface WhisperPricing {
  kind: "whisper";
  provider: Provider;
  model: string;
  perMinute: number;
}

export type ModelPricing = ChatPricing | EmbeddingPricing | WhisperPricing;

const PRICING: Record<string, ModelPricing> = {
  // --- Anthropic (chat) — prices in USD per 1M tokens
  "claude-opus-4-7": {
    kind: "chat",
    provider: "anthropic",
    model: "claude-opus-4-7",
    inputPerMTokens: 15,
    outputPerMTokens: 75,
    cachedInputPerMTokens: 1.5,
  },
  "claude-sonnet-4-6": {
    kind: "chat",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputPerMTokens: 3,
    outputPerMTokens: 15,
    cachedInputPerMTokens: 0.3,
  },
  "claude-haiku-4-5": {
    kind: "chat",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    inputPerMTokens: 1,
    outputPerMTokens: 5,
    cachedInputPerMTokens: 0.1,
  },

  // --- OpenAI embeddings
  "text-embedding-3-small": {
    kind: "embedding",
    provider: "openai",
    model: "text-embedding-3-small",
    inputPerMTokens: 0.02,
  },

  // --- OpenAI Whisper
  "whisper-1": {
    kind: "whisper",
    provider: "openai",
    model: "whisper-1",
    perMinute: 0.006,
  },
};

export function getPricing(model: string): ModelPricing | undefined {
  return PRICING[model];
}

export function listPricing(): ModelPricing[] {
  return Object.values(PRICING);
}

/**
 * Compute USD cost for a chat call. `cachedInputTokens` is optional and only
 * counted if the model has a prompt-cache price; otherwise those tokens are
 * billed at the standard input rate.
 */
export function costChat(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): number {
  const p = getPricing(args.model);
  if (!p || p.kind !== "chat") {
    return 0; // unknown model — refuse to guess
  }
  const cached = args.cachedInputTokens ?? 0;
  const fresh = Math.max(0, args.inputTokens - cached);
  const inputCost = (fresh / 1_000_000) * p.inputPerMTokens;
  const cachedCost =
    p.cachedInputPerMTokens !== undefined
      ? (cached / 1_000_000) * p.cachedInputPerMTokens
      : (cached / 1_000_000) * p.inputPerMTokens;
  const outputCost = (args.outputTokens / 1_000_000) * p.outputPerMTokens;
  return round6(inputCost + cachedCost + outputCost);
}

export function costEmbedding(args: {
  model: string;
  inputTokens: number;
}): number {
  const p = getPricing(args.model);
  if (!p || p.kind !== "embedding") return 0;
  return round6((args.inputTokens / 1_000_000) * p.inputPerMTokens);
}

export function costWhisper(args: { model: string; seconds: number }): number {
  const p = getPricing(args.model);
  if (!p || p.kind !== "whisper") return 0;
  const minutes = args.seconds / 60;
  return round6(minutes * p.perMinute);
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
