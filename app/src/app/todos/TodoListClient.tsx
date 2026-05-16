"use client";

import { formatDistanceToNow, format } from "date-fns";
import { useTransition } from "react";

import { cn } from "@/lib/utils";
import {
  completeTodo,
  deleteTodo,
  dropTodo,
  reopenTodo,
  snoozeTodo,
} from "@/lib/domain/todos/server";
import type { TodoRow } from "@/lib/schemas/todo";

export function TodoListClient({ todos }: { todos: TodoRow[] }) {
  return (
    <ul className="divide-y divide-border border border-border rounded-card overflow-hidden bg-surface">
      {todos.map((t) => (
        <TodoItem key={t.id} todo={t} />
      ))}
    </ul>
  );
}

function TodoItem({ todo }: { todo: TodoRow }) {
  const [pending, startTransition] = useTransition();

  const dueLabel = todo.due_at
    ? `Due ${format(new Date(todo.due_at), "MMM d")}`
    : todo.snoozed_until
      ? `Snoozed until ${format(new Date(todo.snoozed_until), "MMM d")}`
      : `Added ${formatDistanceToNow(new Date(todo.created_at), {
          addSuffix: true,
        })}`;

  const done = todo.status === "done";

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        onChange={() =>
          startTransition(async () => {
            if (done) await reopenTodo(todo.id);
            else await completeTodo(todo.id);
          })
        }
        className="mt-1 h-4 w-4 accent-[var(--teal)]"
        aria-label={done ? "Reopen" : "Complete"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <PriorityChip priority={todo.priority} />
          <p
            className={cn(
              "text-sm text-ink truncate",
              done && "line-through text-ink-3",
            )}
          >
            {todo.title}
          </p>
        </div>
        <p className="text-xs text-ink-3 font-mono mt-0.5">{dueLabel}</p>
        {todo.notes && (
          <p className="text-sm text-ink-2 mt-1 whitespace-pre-wrap">
            {todo.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {todo.status === "open" && (
          <button
            type="button"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(9, 0, 0, 0);
              startTransition(() => snoozeTodo(todo.id, tomorrow.toISOString()));
            }}
            disabled={pending}
            className="text-xs text-ink-3 hover:text-ink px-2 py-1"
            title="Snooze until tomorrow 9am"
          >
            Snooze
          </button>
        )}
        {todo.status === "snoozed" && (
          <button
            type="button"
            onClick={() => startTransition(() => reopenTodo(todo.id))}
            disabled={pending}
            className="text-xs text-ink-3 hover:text-ink px-2 py-1"
          >
            Reopen
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!confirm("Drop this todo?")) return;
            startTransition(() => dropTodo(todo.id));
          }}
          disabled={pending}
          className="text-xs text-ink-3 hover:text-red px-2 py-1"
          title="Drop"
        >
          Drop
        </button>
        {todo.status === "dropped" && (
          <button
            type="button"
            onClick={() => {
              if (!confirm("Delete permanently?")) return;
              startTransition(() => deleteTodo(todo.id));
            }}
            disabled={pending}
            className="text-xs text-red hover:underline px-2 py-1"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

function PriorityChip({ priority }: { priority: TodoRow["priority"] }) {
  const map = {
    high: "bg-[var(--gold-soft)] text-[var(--gold)]",
    med: "bg-cream-2 text-ink-2",
    low: "bg-cream-2 text-ink-3",
  } as const;
  const label = { high: "HI", med: "MED", low: "LO" }[priority];
  return (
    <span
      className={cn(
        "font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded-pill",
        map[priority],
      )}
    >
      {label}
    </span>
  );
}
