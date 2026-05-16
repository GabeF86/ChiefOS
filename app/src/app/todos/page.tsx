import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listTodos } from "@/lib/domain/todos/server";

import { NewTodoForm } from "./NewTodoForm";
import { TodoListClient } from "./TodoListClient";

export const metadata = {
  title: "Todos · ChiefOS",
};

export const dynamic = "force-dynamic";

export default async function TodosPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter ?? "open";
  const statuses =
    filter === "all"
      ? undefined
      : filter === "done"
        ? (["done"] as const)
        : filter === "snoozed"
          ? (["snoozed"] as const)
          : (["open"] as const);

  const todos = await listTodos({
    statuses: statuses ? [...statuses] : undefined,
  });

  return (
    <main className="min-h-dvh px-6 py-10 max-w-3xl mx-auto">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="font-mono text-xs tracking-widest uppercase text-ink-3 hover:text-ink"
        >
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl text-ink mt-2">Todos</h1>
      </header>

      <NewTodoForm />

      <nav className="flex gap-2 mt-8 mb-4 text-sm">
        <FilterLink current={filter} value="open">Open</FilterLink>
        <FilterLink current={filter} value="snoozed">Snoozed</FilterLink>
        <FilterLink current={filter} value="done">Done</FilterLink>
        <FilterLink current={filter} value="all">All</FilterLink>
      </nav>

      <TodoListClient todos={todos} />

      {todos.length === 0 && (
        <p className="text-sm text-ink-3 mt-8 text-center">
          Nothing here. Add one above.
        </p>
      )}
    </main>
  );
}

function FilterLink({
  current,
  value,
  children,
}: {
  current: string;
  value: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      size="sm"
    >
      <Link href={`/todos?filter=${value}`}>{children}</Link>
    </Button>
  );
}
