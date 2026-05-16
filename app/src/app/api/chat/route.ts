import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_CHAT_MODEL,
  createAnthropicClient,
  hasAnthropicKey,
} from "@/lib/ai/anthropic";
import { logChatCost } from "@/lib/cost/logger";
import { searchVault, type RetrievedChunk } from "@/lib/rag/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  question?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface Source {
  file_path: string;
  chunk_indexes: number[];
  best_similarity: number;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set" },
      { status: 503 },
    );
  }

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "empty question" }, { status: 400 });
  }
  const history = (body.history ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0,
    )
    .slice(-10);

  // 1) Retrieve top-k chunks for the question.
  const chunks = await searchVault({
    userId: user.id,
    query: question,
    k: 8,
  });
  const sources = collapseSources(chunks);

  // 2) Stream the answer with citations.
  const encoder = new TextEncoder();
  const anthropic = createAnthropicClient();
  const userId = user.id;

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, encoder, "sources", { sources });

      if (chunks.length === 0) {
        send(controller, encoder, "delta", {
          text:
            "Nothing in the vault matched that question yet. Add notes to the Obsidian vault and they'll be searchable here once the GitHub webhook fires.",
        });
        send(controller, encoder, "done", {
          inputTokens: 0,
          outputTokens: 0,
        });
        controller.close();
        return;
      }

      const system = buildSystemPrompt(chunks);
      const messages = [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: question },
      ];

      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const msgStream = anthropic.messages.stream({
          model: DEFAULT_CHAT_MODEL,
          max_tokens: 1024,
          system,
          messages,
        });

        for await (const event of msgStream) {
          if (event.type === "message_start") {
            inputTokens = event.message.usage?.input_tokens ?? 0;
            outputTokens = event.message.usage?.output_tokens ?? 0;
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send(controller, encoder, "delta", { text: event.delta.text });
          } else if (event.type === "message_delta") {
            outputTokens = event.usage?.output_tokens ?? outputTokens;
          }
        }

        send(controller, encoder, "done", { inputTokens, outputTokens });
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream failed";
        send(controller, encoder, "error", { error: message });
      } finally {
        // Best-effort cost log; never throws.
        void logChatCost({
          userId,
          model: DEFAULT_CHAT_MODEL,
          inputTokens,
          outputTokens,
          requestRef: "vault-chat",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function send(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: string,
  data: unknown,
) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const numbered = chunks
    .map((c, i) => `[${i + 1}] ${c.file_path}\n${c.content}`)
    .join("\n\n---\n\n");

  return `You are ChiefOS, a personal command center for Dr. Gabe Farkas, Chief of Anesthesia at Paoli Hospital.

Answer questions strictly from the document excerpts below. The excerpts are from Gabe's personal knowledge vault. Cite by filename in square brackets at the end of every claim, like [10-policies/post-call.md].

Rules:
- If the excerpts don't contain enough to answer, say so plainly and suggest what to write in the vault.
- Never invent citations. Only use filenames present in the excerpts.
- Keep answers tight — Gabe reads these on his phone between cases.
- Markdown is fine.

Excerpts:
${numbered}`;
}

function collapseSources(chunks: RetrievedChunk[]): Source[] {
  const byFile = new Map<string, Source>();
  for (const c of chunks) {
    const cur = byFile.get(c.file_path);
    if (!cur) {
      byFile.set(c.file_path, {
        file_path: c.file_path,
        chunk_indexes: [c.chunk_index],
        best_similarity: c.similarity,
      });
    } else {
      cur.chunk_indexes.push(c.chunk_index);
      cur.best_similarity = Math.max(cur.best_similarity, c.similarity);
    }
  }
  return Array.from(byFile.values()).sort(
    (a, b) => b.best_similarity - a.best_similarity,
  );
}
