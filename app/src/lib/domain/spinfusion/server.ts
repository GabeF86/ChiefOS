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
  // Counts displayed in headers. Exclude post-call (pPaoliPC) for MDs and
  // post-call + trauma-beeper for CRNAs so the number reflects "doctors
  // actually staffing the OR today."
  mdCount: number;
  crnaCount: number;
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

type SortKey = [number, number];

function compareSortKey(a: SortKey, b: SortKey): number {
  return a[0] - b[0] || a[1] - b[1];
}

// MD reading order: Call → Late → outlist 1..9 → Day → (other) → PC.
function mdSortKey(slot: string): SortKey {
  if (slot === "pPaoliCall") return [0, 0];
  if (slot === "pPaoliLate") return [1, 0];
  const numbered = slot.match(/^pPaoli(\d+)$/);
  if (numbered) return [2, parseInt(numbered[1], 10)];
  if (slot === "pPaoliDay") return [3, 0];
  if (slot === "pPaoliPC") return [5, 0];
  return [4, 0]; // pPaoliNeuro, pPaoli_LDay, anything else
}

// CRNA reading order: by shift length ascending (8h → 10h → 12h → 24h Call),
// then trauma beeper (sorted within by shift start), then post-call. The
// numeric digit in the slot label (cPaoli8 / cPaoli10 / cPaoli12) is the
// shift length in hours.
function crnaSortKey(slot: string): SortKey {
  if (slot === "cPaoliCall") return [24, 0];
  if (slot === "cPaoliPC") return [999, 0];
  if (slot.startsWith("cPaoliTrBeep")) return [998, trBeepStartHour(slot)];
  if (slot === "cPaoli7p-7a") return [12, 1]; // night 12h — after day 12h
  const numbered = slot.match(/^cPaoli(\d+)$/);
  if (numbered) return [parseInt(numbered[1], 10), 0];
  return [997, 0]; // cPaoliOrient and other
}

// Parse the start hour from a TrBeep label like "cPaoliTrBeep 7a-3p" → 7.
// Plain "cPaoliTrBeep" with no shift suffix returns -1 so it sorts first
// within the TrBeep group.
function trBeepStartHour(slot: string): number {
  const m = slot.match(/cPaoliTrBeep\s+(\d{1,2})([ap])-/);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  if (m[2] === "p" && h !== 12) h += 12;
  if (m[2] === "a" && h === 12) h = 0;
  return h;
}

function isMdExcludedFromCount(slot: string): boolean {
  return slot === "pPaoliPC";
}

function isCrnaExcludedFromCount(slot: string): boolean {
  return slot === "cPaoliPC" || slot.startsWith("cPaoliTrBeep");
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
    .order("date", { ascending: true });
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
    grouped.set(key, {
      date: key,
      mds: [],
      crnas: [],
      other: [],
      mdCount: 0,
      crnaCount: 0,
    });
  }
  for (const r of (rows ?? []) as SpinfusionAssignment[]) {
    const bucket = grouped.get(r.date);
    if (!bucket) continue;
    const role = r.role.toUpperCase();
    if (role === "MD") bucket.mds.push(r);
    else if (role === "CRNA") bucket.crnas.push(r);
    else bucket.other.push(r);
  }

  // Sort each bucket in the order the chief actually reads them, and
  // compute the staffed-doctor counts (excluding post-call / trauma beeper).
  const buckets = Array.from(grouped.values());
  for (const bucket of buckets) {
    bucket.mds.sort((a: SpinfusionAssignment, b: SpinfusionAssignment) =>
      compareSortKey(mdSortKey(a.assignment_text), mdSortKey(b.assignment_text)) ||
      a.provider_name.localeCompare(b.provider_name),
    );
    bucket.crnas.sort((a: SpinfusionAssignment, b: SpinfusionAssignment) =>
      compareSortKey(crnaSortKey(a.assignment_text), crnaSortKey(b.assignment_text)) ||
      a.provider_name.localeCompare(b.provider_name),
    );
    bucket.mdCount = bucket.mds.filter(
      (r: SpinfusionAssignment) => !isMdExcludedFromCount(r.assignment_text),
    ).length;
    bucket.crnaCount = bucket.crnas.filter(
      (r: SpinfusionAssignment) => !isCrnaExcludedFromCount(r.assignment_text),
    ).length;
  }

  const lastPulledAt =
    lastRun?.finished_at ?? lastRun?.started_at ?? null;
  const lastRunStatus = (lastRun?.status as SpinfusionView["lastRunStatus"]) ??
    "never";
  const lastRunError = (lastRun?.error as string | null) ?? null;

  return {
    days: buckets,
    lastPulledAt,
    lastRunStatus,
    lastRunError,
  };
}
