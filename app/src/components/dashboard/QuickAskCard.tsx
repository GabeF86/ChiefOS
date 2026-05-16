"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VoiceCaptureButton } from "./VoiceCaptureButton";

export function QuickAskCard() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit() {
    const q = value.trim();
    if (!q) {
      router.push("/chat");
      return;
    }
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Ask</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2"
        >
          <div className="relative">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ask the vault… (e.g. policy on OB call coverage)"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-input border border-border bg-surface px-3 py-2 pr-12 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-cream"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="absolute right-2 bottom-2">
              <VoiceCaptureButton
                onTranscript={(text) =>
                  setValue((cur) => (cur ? `${cur} ${text}` : text))
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-3 font-mono">
              Answers cite vault notes
            </p>
            <Button type="submit" size="sm">
              Ask
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
