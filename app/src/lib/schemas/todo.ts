import { z } from "zod";

/**
 * Todo schemas — source of truth for types (per CLAUDE-style convention).
 * DB columns map 1:1; row type is derived via `TodoRow` after select.
 */

export const TodoPriority = z.enum(["low", "med", "high"]);
export type TodoPriority = z.infer<typeof TodoPriority>;

export const TodoStatus = z.enum(["open", "done", "snoozed", "dropped"]);
export type TodoStatus = z.infer<typeof TodoStatus>;

export const TodoSource = z.enum([
  "manual",
  "email",
  "meeting",
  "recurring",
  "suggested",
]);
export type TodoSource = z.infer<typeof TodoSource>;

export const TodoCreateInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(280, "Keep it under 280 characters"),
  notes: z.string().trim().max(10_000).optional().nullable(),
  priority: TodoPriority.default("med"),
  due_at: z
    .union([z.string().datetime(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  source: TodoSource.default("manual"),
  source_ref: z.string().max(500).optional().nullable(),
});
export type TodoCreateInput = z.infer<typeof TodoCreateInput>;

export const TodoUpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(280).optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  priority: TodoPriority.optional(),
  due_at: z
    .union([z.string().datetime(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  status: TodoStatus.optional(),
  snoozed_until: z
    .union([z.string().datetime(), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type TodoUpdateInput = z.infer<typeof TodoUpdateInput>;

// Row shape returned by Supabase select on public.todos
export interface TodoRow {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  priority: TodoPriority;
  due_at: string | null;
  source: TodoSource;
  source_ref: string | null;
  status: TodoStatus;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
