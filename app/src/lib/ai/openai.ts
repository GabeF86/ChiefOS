import OpenAI from "openai";

/**
 * Lazy OpenAI client factory — never construct at module load so `next build`
 * can collect page data without env vars present (per memory note).
 */
export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }
  return new OpenAI({ apiKey });
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
