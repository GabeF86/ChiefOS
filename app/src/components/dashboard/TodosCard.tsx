import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listTodos } from "@/lib/domain/todos/server";
import { cn } from "@/lib/utils";

export async function TodosCard() {
  const todos = await listTodos({ statuses: ["open"], limit: 5 });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Todos</CardTitle>
        <Link
          href="/todos"
          className="text-xs font-mono text-ink-3 hover:text-ink uppercase tracking-widest"
        >
          See all →
        </Link>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="text-sm text-ink-3">
            Nothing pending. <Link href="/todos" className="text-teal hover:underline">Add one</Link>.
          </p>
        ) : (
          <ul className="space-y-2">
            {todos.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    t.priority === "high"
                      ? "bg-[var(--gold)]"
                      : t.priority === "med"
                        ? "bg-ink-2"
                        : "bg-ink-3",
                  )}
                />
                <p className="text-sm text-ink truncate">{t.title}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
