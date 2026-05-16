"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";

import { completeTodo } from "@/lib/domain/todos/server";
import type { TodoRow } from "@/lib/schemas/todo";
import { cn } from "@/lib/utils";

export function TodosCardItems({ initial }: { initial: TodoRow[] }) {
  const [optimistic, applyOptimistic] = useOptimistic<TodoRow[], string>(
    initial,
    (state, completedId) =>
      state.map((t) =>
        t.id === completedId ? { ...t, status: "done" as const } : t,
      ),
  );
  const [pending, startTransition] = useTransition();

  // Drop completed items after the action settles so the list stays at top-5
  // open. Until then they show with strike-through.
  const visible = optimistic;

  if (initial.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        Nothing pending.{" "}
        <Link href="/todos" className="text-teal hover:underline">
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {visible.map((t) => {
        const done = t.status === "done";
        return (
          <li key={t.id} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  applyOptimistic(t.id);
                  await completeTodo(t.id);
                })
              }
              disabled={pending || done}
              className={cn(
                "h-4 w-4 rounded-full border shrink-0 transition-colors",
                done
                  ? "bg-[var(--teal)] border-[var(--teal)]"
                  : "border-border-2 hover:border-[var(--teal)] hover:bg-[var(--teal-soft)]",
              )}
              aria-label={done ? "Completed" : `Complete: ${t.title}`}
            >
              {done && (
                <svg
                  viewBox="0 0 14 14"
                  className="h-3 w-3 text-cream mx-auto"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7l3 3 5-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                t.priority === "high"
                  ? "bg-[var(--gold)]"
                  : t.priority === "med"
                    ? "bg-ink-2"
                    : "bg-ink-3",
              )}
              aria-hidden
            />
            <p
              className={cn(
                "text-sm text-ink truncate",
                done && "line-through text-ink-3",
              )}
            >
              {t.title}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
