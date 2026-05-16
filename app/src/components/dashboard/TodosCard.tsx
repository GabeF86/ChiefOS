import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listTodos } from "@/lib/domain/todos/server";

import { TodosCardItems } from "./TodosCardItems";

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
        <TodosCardItems initial={todos} />
      </CardContent>
    </Card>
  );
}
