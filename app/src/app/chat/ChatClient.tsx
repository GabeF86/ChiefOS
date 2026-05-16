"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { VoiceCaptureButton } from "@/components/dashboard/VoiceCaptureButton";
import { cn } from "@/lib/utils";

interface Source {
  file_path: string;
  chunk_indexes: number[];
  best_similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  pending?: boolean;
  error?: string;
}

interface Props {
  initialQuestion: string;
  vaultName: string;
}

export function ChatClient({ initialQuestion, vaultName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const submittedInitial = useRef(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submittedInitial.current) return;
    if (initialQuestion.trim()) {
      submittedInitial.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    // Auto-scroll on new content.
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const placeholder: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, placeholder]);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text();
        finalizeError(placeholder.id, errBody || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleFrame(frame, placeholder.id);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      finalizeError(
        placeholder.id,
        err instanceof Error ? err.message : "request failed",
      );
    } finally {
      setBusy(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholder.id ? { ...m, pending: false } : m,
        ),
      );
      abortRef.current = null;
    }
  }

  function handleFrame(frame: string, assistantId: string) {
    const lines = frame.split("\n");
    let event = "message";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    try {
      const payload = JSON.parse(data);
      if (event === "sources") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, sources: payload.sources as Source[] }
              : m,
          ),
        );
      } else if (event === "delta") {
        const text = payload.text as string;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + text } : m,
          ),
        );
      } else if (event === "error") {
        finalizeError(assistantId, payload.error ?? "error");
      } else if (event === "done") {
        // noop — content already accumulated, sources already set
      }
    } catch {
      // Ignore parse errors on malformed frames.
    }
  }

  function finalizeError(id: string, message: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, pending: false, error: message }
          : m,
      ),
    );
  }

  function cancel() {
    abortRef.current?.abort();
    setBusy(false);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div
        ref={threadRef}
        className="flex-1 min-h-[40dvh] max-h-[60dvh] overflow-y-auto space-y-4 rounded-card border border-border bg-surface p-5"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => (
            <Bubble key={m.id} message={m} vaultName={vaultName} />
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-start gap-2"
      >
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="What's our policy on residents covering OB call?"
            className="w-full resize-none rounded-input border border-border bg-surface px-3 py-2 pr-12 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <div className="absolute right-2 bottom-2">
            <VoiceCaptureButton
              onTranscript={(text) =>
                setInput((cur) => (cur ? `${cur} ${text}` : text))
              }
            />
          </div>
        </div>
        {busy ? (
          <Button type="button" variant="outline" onClick={cancel}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            Ask
          </Button>
        )}
      </form>
    </div>
  );
}

function Bubble({
  message,
  vaultName,
}: {
  message: Message;
  vaultName: string;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser && "items-end")}>
      <p
        className={cn(
          "text-[10px] font-mono uppercase tracking-widest",
          isUser ? "text-teal" : "text-ink-3",
        )}
      >
        {isUser ? "You" : "ChiefOS"}
      </p>
      <div
        className={cn(
          "rounded-card px-4 py-2.5 text-sm leading-relaxed max-w-[88%] whitespace-pre-wrap",
          isUser
            ? "bg-teal-soft/60 text-ink"
            : "bg-cream-2 text-ink",
        )}
      >
        {message.content || (message.pending ? <Typing /> : null)}
        {message.error && (
          <p className="text-red text-xs mt-2 font-mono">{message.error}</p>
        )}
      </div>
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {message.sources.map((s) => (
            <CitationChip
              key={s.file_path}
              filePath={s.file_path}
              vaultName={vaultName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CitationChip({
  filePath,
  vaultName,
}: {
  filePath: string;
  vaultName: string;
}) {
  const fileNoExt = filePath.replace(/\.md$/i, "");
  const obsidianHref = vaultName
    ? `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(
        fileNoExt,
      )}`
    : undefined;

  const content = (
    <>
      <span className="text-ink-3 font-mono">¶</span>
      <span className="truncate max-w-[16ch] sm:max-w-[28ch]">{filePath}</span>
    </>
  );

  const className =
    "inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-pill border border-border bg-surface text-ink-2 hover:border-border-2 hover:text-ink transition-colors";

  return obsidianHref ? (
    <a href={obsidianHref} className={className} title={filePath}>
      {content}
    </a>
  ) : (
    <span className={className} title={filePath}>
      {content}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-ink-3 py-12">
      <p className="font-serif text-xl text-ink-2">
        Ask anything answerable from your vault
      </p>
      <p className="text-sm max-w-md">
        Answers cite the source notes. Nothing is invented. If the vault doesn&apos;t
        cover it, ChiefOS will say so.
      </p>
    </div>
  );
}

function Typing() {
  return (
    <span className="inline-flex items-center gap-1 text-ink-3">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce" />
    </span>
  );
}
