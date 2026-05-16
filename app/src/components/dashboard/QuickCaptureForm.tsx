"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createTodo } from "@/lib/domain/todos/server";

import { VoiceCaptureButton } from "./VoiceCaptureButton";

export function QuickCaptureForm() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("priority", "med");
      fd.set("source", "manual");
      await createTodo(fd);
      setValue("");
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
      textareaRef.current?.focus();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Capture a thought… (Enter to save, Shift+Enter for newline)"
          rows={2}
          maxLength={280}
          className="w-full resize-none rounded-input border border-border bg-surface px-3 py-2 pr-12 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <div className="absolute right-2 bottom-2">
          <VoiceCaptureButton
            onTranscript={(text) => {
              setValue((cur) => (cur ? `${cur} ${text}` : text));
              textareaRef.current?.focus();
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-3 font-mono">
          {justSaved ? "Saved" : pending ? "Saving…" : `${value.length}/280`}
        </p>
        <Button type="submit" size="sm" disabled={pending || !value.trim()}>
          Add todo
        </Button>
      </div>
    </form>
  );
}
