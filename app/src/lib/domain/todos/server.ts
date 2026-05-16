"use server";

import { revalidatePath } from "next/cache";

import {
  TodoCreateInput,
  TodoUpdateInput,
  type TodoRow,
} from "@/lib/schemas/todo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function listTodos(opts?: {
  statuses?: TodoRow["status"][];
  limit?: number;
}): Promise<TodoRow[]> {
  const { supabase, user } = await requireUser();
  let query = supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.id);

  if (opts?.statuses && opts.statuses.length > 0) {
    query = query.in("status", opts.statuses);
  }

  query = query
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TodoRow[];
}

export async function createTodo(formData: FormData) {
  const parsed = TodoCreateInput.parse({
    title: formData.get("title"),
    notes: formData.get("notes") || null,
    priority: formData.get("priority") || "med",
    due_at: formData.get("due_at") || "",
    source: formData.get("source") || "manual",
    source_ref: formData.get("source_ref") || null,
  });
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    ...parsed,
  });
  if (error) throw error;
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function updateTodo(input: unknown) {
  const parsed = TodoUpdateInput.parse(input);
  const { supabase, user } = await requireUser();
  const { id, ...rest } = parsed;
  const patch: Record<string, unknown> = { ...rest };
  if (rest.status === "done") patch.completed_at = new Date().toISOString();
  if (rest.status === "open") patch.completed_at = null;
  const { error } = await supabase
    .from("todos")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function completeTodo(id: string) {
  await updateTodo({ id, status: "done" });
}

export async function reopenTodo(id: string) {
  await updateTodo({ id, status: "open" });
}

export async function snoozeTodo(id: string, untilISO: string) {
  await updateTodo({ id, status: "snoozed", snoozed_until: untilISO });
}

export async function dropTodo(id: string) {
  await updateTodo({ id, status: "dropped" });
}

export async function deleteTodo(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}
