import { NextResponse, type NextRequest } from "next/server";

import { createOpenAIClient, hasOpenAIKey } from "@/lib/ai/openai";
import { withCostLogging } from "@/lib/cost/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Audio uploads can be a few MB; bump the default body limit.
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

export async function POST(request: NextRequest) {
  // Auth check — only signed-in users can transcribe.
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
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "audio too large" },
      { status: 413 },
    );
  }

  const durationHint = Number(form.get("seconds") ?? 0) || 0;

  try {
    const openai = createOpenAIClient();
    const text = await withCostLogging({
      kind: "whisper",
      model: "whisper-1",
      userId: user.id,
      requestRef: "quick-capture",
      run: async () => {
        // response_format: "text" narrows the return type to string.
        const transcribed = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
          response_format: "text",
          language: "en",
        });
        return { result: transcribed, seconds: durationHint };
      },
    });
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
