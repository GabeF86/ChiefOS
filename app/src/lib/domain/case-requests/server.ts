"use server";

import { revalidatePath } from "next/cache";

import {
  CaseRequestCreateInput,
  CaseRequestStatus,
  CaseRequestUpdateInput,
  type CaseRequestRow,
} from "@/lib/schemas/case-request";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Lists upcoming case requests for the current user, soonest first. By
 * default returns the next 30 days; pass a larger `daysAhead` to look
 * further out.
 */
export async function listUpcomingCaseRequests(
  daysAhead = 30,
): Promise<CaseRequestRow[]> {
  const { supabase, user } = await requireUser();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(to.getDate() + daysAhead);

  const { data, error } = await supabase
    .from("case_requests")
    .select("*")
    .eq("user_id", user.id)
    .gte("case_date", ymd(today))
    .lte("case_date", ymd(to))
    .order("case_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseRequestRow[];
}

export async function listAllCaseRequests(): Promise<CaseRequestRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("case_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("case_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseRequestRow[];
}

function parseCreateForm(fd: FormData): CaseRequestCreateInput {
  const needsMd = fd.get("needs_md") === "on" || fd.get("needs_md") === "true";
  const needsCrna = fd.get("needs_crna") === "on" || fd.get("needs_crna") === "true";
  return CaseRequestCreateInput.parse({
    case_date: fd.get("case_date"),
    surgeon_name: fd.get("surgeon_name"),
    needs_md: needsMd,
    needs_crna: needsCrna,
    md_name: needsMd ? (fd.get("md_name") || null) : null,
    crna_name: needsCrna ? (fd.get("crna_name") || null) : null,
    notes: fd.get("notes") || null,
  });
}

export async function createCaseRequest(formData: FormData) {
  const parsed = parseCreateForm(formData);
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("case_requests").insert({
    user_id: user.id,
    case_date: parsed.case_date,
    surgeon_name: parsed.surgeon_name,
    needs_md: parsed.needs_md,
    needs_crna: parsed.needs_crna,
    md_name: parsed.md_name ?? null,
    crna_name: parsed.crna_name ?? null,
    notes: parsed.notes ?? null,
    source: "manual",
  });
  if (error) throw error;
  revalidatePath("/case-requests");
  revalidatePath("/dashboard");
}

export async function updateCaseRequest(formData: FormData) {
  const statusValue = formData.get("status");
  const needsMd = formData.get("needs_md") === "on" || formData.get("needs_md") === "true";
  const needsCrna = formData.get("needs_crna") === "on" || formData.get("needs_crna") === "true";
  const parsed = CaseRequestUpdateInput.parse({
    id: formData.get("id"),
    case_date: formData.get("case_date"),
    surgeon_name: formData.get("surgeon_name"),
    needs_md: needsMd,
    needs_crna: needsCrna,
    md_name: needsMd ? (formData.get("md_name") || null) : null,
    crna_name: needsCrna ? (formData.get("crna_name") || null) : null,
    notes: formData.get("notes") || null,
    status: statusValue ? CaseRequestStatus.parse(statusValue) : undefined,
  });
  const { supabase, user } = await requireUser();
  const update: Record<string, unknown> = {
    case_date: parsed.case_date,
    surgeon_name: parsed.surgeon_name,
    needs_md: parsed.needs_md,
    needs_crna: parsed.needs_crna,
    md_name: parsed.md_name ?? null,
    crna_name: parsed.crna_name ?? null,
    notes: parsed.notes ?? null,
  };
  if (parsed.status) update.status = parsed.status;
  const { error } = await supabase
    .from("case_requests")
    .update(update)
    .eq("id", parsed.id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/case-requests");
  revalidatePath("/dashboard");
}

export async function setCaseRequestStatus(
  id: string,
  status: CaseRequestStatus,
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("case_requests")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/case-requests");
  revalidatePath("/dashboard");
}

export async function deleteCaseRequest(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("case_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/case-requests");
  revalidatePath("/dashboard");
}
