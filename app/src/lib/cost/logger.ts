/**
 * ChiefOS — cost-logging wrapper (PRD §5.12)
 *
 * Records every Anthropic + OpenAI call to public.usage_events with the
 * computed USD cost. Use this from any server-side feature that calls an
 * LLM or embedding API.
 *
 * Inserts use the service-role client because usage_events has no INSERT
 * policy for authenticated users — only server code may write.
 */

import {
  costChat,
  costEmbedding,
  costWhisper,
  type Provider,
} from "@/lib/cost/pricing";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

interface LogBase {
  userId: string;
  requestRef?: string;
  occurredAt?: Date;
}

export interface ChatCall<T> extends LogBase {
  kind: "chat";
  model: string;
  run: () => Promise<{
    result: T;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  }>;
}

export interface EmbeddingCall<T> extends LogBase {
  kind: "embedding";
  model: string;
  run: () => Promise<{ result: T; inputTokens: number }>;
}

export interface WhisperCall<T> extends LogBase {
  kind: "whisper";
  model: string;
  run: () => Promise<{ result: T; seconds: number }>;
}

export type AnyCall<T> = ChatCall<T> | EmbeddingCall<T> | WhisperCall<T>;

/**
 * Wrap an LLM/embedding/whisper call so the result is returned and the
 * usage is logged out-of-band. If logging fails, we swallow the error —
 * the call's primary purpose is to return a result to the user, not to
 * record perfect accounting. A separate monthly self-audit (PRD §3) is
 * the safety net.
 */
export async function withCostLogging<T>(call: AnyCall<T>): Promise<T> {
  const { result, log } = await invoke(call);
  // Fire-and-forget; never block the caller on the audit row.
  void logUsage(log);
  return result;
}

async function invoke<T>(
  call: AnyCall<T>,
): Promise<{ result: T; log: UsageRow }> {
  switch (call.kind) {
    case "chat": {
      const out = await call.run();
      const cost_usd = costChat({
        model: call.model,
        inputTokens: out.inputTokens,
        outputTokens: out.outputTokens,
        cachedInputTokens: out.cachedInputTokens,
      });
      return {
        result: out.result,
        log: {
          user_id: call.userId,
          provider: providerFor(call.model),
          model: call.model,
          operation: "chat",
          input_tokens: out.inputTokens,
          output_tokens: out.outputTokens,
          input_units: null,
          unit_label: "tokens",
          cost_usd,
          request_ref: call.requestRef ?? null,
          occurred_at: (call.occurredAt ?? new Date()).toISOString(),
        },
      };
    }
    case "embedding": {
      const out = await call.run();
      const cost_usd = costEmbedding({
        model: call.model,
        inputTokens: out.inputTokens,
      });
      return {
        result: out.result,
        log: {
          user_id: call.userId,
          provider: providerFor(call.model),
          model: call.model,
          operation: "embedding",
          input_tokens: out.inputTokens,
          output_tokens: null,
          input_units: null,
          unit_label: "tokens",
          cost_usd,
          request_ref: call.requestRef ?? null,
          occurred_at: (call.occurredAt ?? new Date()).toISOString(),
        },
      };
    }
    case "whisper": {
      const out = await call.run();
      const cost_usd = costWhisper({ model: call.model, seconds: out.seconds });
      return {
        result: out.result,
        log: {
          user_id: call.userId,
          provider: providerFor(call.model),
          model: call.model,
          operation: "whisper",
          input_tokens: null,
          output_tokens: null,
          input_units: out.seconds,
          unit_label: "seconds",
          cost_usd,
          request_ref: call.requestRef ?? null,
          occurred_at: (call.occurredAt ?? new Date()).toISOString(),
        },
      };
    }
  }
}

interface UsageRow {
  user_id: string;
  provider: Provider;
  model: string;
  operation: "chat" | "embedding" | "whisper";
  input_tokens: number | null;
  output_tokens: number | null;
  input_units: number | null;
  unit_label: string;
  cost_usd: number;
  request_ref: string | null;
  occurred_at: string;
}

async function logUsage(row: UsageRow): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();
    await supabase.from("usage_events").insert(row);
  } catch {
    // Intentionally silent — cost logging is best-effort.
  }
}

function providerFor(model: string): Provider {
  if (model.startsWith("claude-")) return "anthropic";
  return "openai";
}
