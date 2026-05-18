"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SpinfusionAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  provider_name: string;
  role: string;
  site: string;
  assignment_text: string;
  notes: string | null;
}

export interface DayAssignments {
  date: string;
  mds: SpinfusionAssignment[];
  crnas: SpinfusionAssignment[];
  other: SpinfusionAssignment[];
}

export interface SpinfusionView {
  days: DayAssignments[];
  lastPulledAt: string | null; // ISO
  lastRunStatus: "success" | "partial" | "failed" | "running" | "never";
  lastRunError: string | null;
}

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
 * Returns assignments for the next `daysAhead` days starting today (local),
 * along with metadata about the most recent scraper run.
 */
export async function getSpinfusionView(
  daysAhead = 2,
): Promise<SpinfusionView> {
  const { supabase, user } = await requireUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + daysAhead - 1);
  const fromYmd = ymd(today);
  const toYmd = ymd(end);

  const { data: rows, error: rowsErr } = await supabase
    .from("spinfusion_assignments")
    .select("id, date, provider_name, role, site, assignment_text, notes")
    .eq("user_id", user.id)
    .gte("date", fromYmd)
    .lte("date", toYmd)
    .order("date", { ascending: true })
    .order("role", { ascending: true })
    .order("provider_name", { ascending: true });
  if (rowsErr) throw rowsErr;

  const { data: lastRun, error: runErr } = await supabase
    .from("spinfusion_runs")
    .select("started_at, finished_at, status, error")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runErr && runErr.code !== "PGRST116") throw runErr;

  const grouped = new Map<string, DayAssignments>();
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = ymd(d);
    grouped.set(key, { date: key, mds: [], crnas: [], other: [] });
  }
  for (const r of (rows ?? []) as SpinfusionAssignment[]) {
    const bucket = grouped.get(r.date);
    if (!bucket) continue;
    const role = r.role.toUpperCase();
    if (role === "MD") bucket.mds.push(r);
    else if (role === "CRNA") bucket.crnas.push(r);
    else bucket.other.push(r);
  }

  const lastPulledAt =
    lastRun?.finished_at ?? lastRun?.started_at ?? null;
  const lastRunStatus = (lastRun?.status as SpinfusionView["lastRunStatus"]) ??
    "never";
  const lastRunError = (lastRun?.error as string | null) ?? null;

  return {
    days: Array.from(grouped.values()),
    lastPulledAt,
    lastRunStatus,
    lastRunError,
  };
}
