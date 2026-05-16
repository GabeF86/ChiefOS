import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client factory — never construct at module load so `next build`
 * can collect page data without env vars present.
 */
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  return new Anthropic({ apiKey });
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Default chat model for ChiefOS. PRD §3 notes "zero data retention enabled"
 * — that's an org-level setting on the Anthropic console, not a per-request
 * flag, so nothing extra to wire here.
 */
export const DEFAULT_CHAT_MODEL = "claude-sonnet-4-6";
