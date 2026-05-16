"use client";

import { useRef, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTodo } from "@/lib/domain/todos/server";

export function NewTodoForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createTodo(formData);
          formRef.current?.reset();
        })
      }
      className="flex gap-2"
    >
      <Input
        name="title"
        placeholder="New todo…"
        required
        maxLength={280}
        autoComplete="off"
      />
      <select
        name="priority"
        defaultValue="med"
        className="rounded-input border border-border bg-surface px-3 text-sm text-ink"
      >
        <option value="low">Low</option>
        <option value="med">Med</option>
        <option value="high">High</option>
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
