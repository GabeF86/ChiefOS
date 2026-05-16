import { toFile } from "openai";
import { NextResponse, type NextRequest } from "next/server";

import { createOpenAIClient, hasOpenAIKey } from "@/lib/ai/openai";
import { withCostLogging } from "@/lib/cost/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasOpenAIKey()) {
    return NextResponse.json(
      {
        error:
          "Voice transcription is not configured. Set OPENAI_API_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const incoming = form.get("audio");
  if (!(incoming instanceof File)) {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }
  if (incoming.size === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }
  if (incoming.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio too large" }, { status: 413 });
  }

  const durationHint = Number(form.get("seconds") ?? 0) || 0;

  // Normalize MIME type — strip codec parameter (e.g. "audio/webm;codecs=opus"
  // → "audio/webm") because OpenAI's multipart parser sometimes chokes on it.
  const rawType = incoming.type || "audio/webm";
  const cleanType = rawType.split(";")[0].trim();
  const ext = extFor(cleanType);

  // Re-wrap via OpenAI's `toFile` helper so the SDK ships a properly-formed
  // multipart upload with a filename it can use to infer container type.
  const buffer = Buffer.from(await incoming.arrayBuffer());
  const uploadable = await toFile(buffer, `capture.${ext}`, {
    type: cleanType,
  });

  try {
    const openai = createOpenAIClient();
    const transcribed = await withCostLogging({
      kind: "whisper",
      model: "whisper-1",
      userId: user.id,
      requestRef: "quick-capture",
      run: async () => {
        const text = await openai.audio.transcriptions.create({
          file: uploadable,
          model: "whisper-1",
          response_format: "text",
          language: "en",
        });
        return { result: text, seconds: durationHint };
      },
    });
    return NextResponse.json({ text: transcribed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[whisper] transcription failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extFor(mime: string): string {
  if (mime === "audio/webm") return "webm";
  if (mime === "audio/ogg") return "ogg";
  // iOS Safari produces audio/mp4 — Whisper handles m4a more reliably than mp4.
  if (mime === "audio/mp4" || mime === "audio/aac") return "m4a";
  if (mime === "audio/wav" || mime === "audio/wave") return "wav";
  if (mime === "audio/mpeg") return "mp3";
  return "webm";
}
