"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface VoiceCaptureButtonProps {
  onTranscript: (text: string) => void;
}

type Phase = "idle" | "recording" | "uploading" | "error";

export function VoiceCaptureButton({ onTranscript }: VoiceCaptureButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | undefined>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const supportedRef = useRef<boolean>(false);

  useEffect(() => {
    supportedRef.current =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia);
  }, []);

  async function startRecording() {
    setError(undefined);
    if (!supportedRef.current) {
      setError("Voice not supported in this browser");
      setPhase("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        stream.getTracks().forEach((t) => t.stop());
        // Strip codec parameter from MIME (e.g. "audio/webm;codecs=opus"
        // → "audio/webm") so the upload Content-Type stays clean.
        const baseType = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: baseType });
        if (blob.size === 0) {
          setPhase("idle");
          return;
        }
        if (seconds < 0.3) {
          setError("Hold the mic a little longer");
          setPhase("error");
          window.setTimeout(() => {
            setPhase("idle");
            setError(undefined);
          }, 2000);
          return;
        }
        await upload(blob, seconds);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setPhase("recording");
    } catch (err) {
      const message = err instanceof Error ? err.message : "mic denied";
      setError(message);
      setPhase("error");
    }
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state !== "inactive") r.stop();
    setPhase("uploading");
  }

  async function upload(blob: Blob, seconds: number) {
    setError(undefined);
    setPhase("uploading");
    try {
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const file = new File([blob], `capture.${ext}`, { type: blob.type });
      const fd = new FormData();
      fd.set("audio", file);
      fd.set("seconds", String(seconds.toFixed(2)));
      const res = await fetch("/api/whisper", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: { text?: string } = await res.json();
      const text = (data.text ?? "").trim();
      if (text) onTranscript(text);
      setPhase("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "transcription failed";
      setError(message);
      setPhase("error");
      window.setTimeout(() => {
        setPhase("idle");
        setError(undefined);
      }, 4000);
    }
  }

  const isBusy = phase === "uploading";
  const isRecording = phase === "recording";

  return (
    <div className="flex items-center gap-2">
      {(error || phase === "error") && (
        <span className="text-xs text-red font-mono">
          {error ?? "Failed"}
        </span>
      )}
      <button
        type="button"
        onPointerDown={(e) => {
          if (phase !== "idle") return;
          e.preventDefault();
          startRecording();
        }}
        onPointerUp={(e) => {
          if (phase !== "recording") return;
          e.preventDefault();
          stopRecording();
        }}
        onPointerLeave={() => {
          if (phase === "recording") stopRecording();
        }}
        disabled={isBusy}
        aria-label={
          isRecording ? "Release to transcribe" : "Press and hold to record"
        }
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          isRecording
            ? "bg-red text-white animate-pulse scale-110"
            : isBusy
              ? "bg-cream-2 text-ink-3"
              : "bg-cream-2 text-ink-2 hover:bg-border hover:text-ink",
        )}
      >
        {isBusy ? (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
