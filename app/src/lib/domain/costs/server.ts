"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DailySpend {
  date: string; // YYYY-MM-DD (local)
  variable_usd: number;
}

export interface CategoryTotal {
  category: "anthropic" | "openai" | "fixed";
  total_usd: number;
}

export interface TopOperation {
  provider: string;
  model: string;
  operation: string;
  total_usd: number;
  call_count: number;
}

export interface CostSummary {
  monthVariableUsd: number;          // current month variable spend so far
  monthFixedUsd: number;             // active fixed costs (pro-rated to date)
  monthFixedMonthlyUsd: number;      // full month of active fixed costs
  monthProjectedUsd: number;         // linear projection of variable + full fixed
  monthCapUsd: number;               // soft alert threshold
  lastMonthVariableUsd: number;
  lastMonthFixedUsd: number;
  dailySpend: DailySpend[];          // last 30 days
  categoryBreakdown: CategoryTotal[];
  topOperations: TopOperation[];
}

interface FixedCostRow {
  id: string;
  service: string;
  monthly_usd: number;
  active: boolean;
  notes: string | null;
}

interface UsageEventRow {
  cost_usd: number;
  occurred_at: string;
  provider: string;
  model: string;
  operation: string;
}

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function getCostSummary(): Promise<CostSummary> {
  const { supabase, user } = await requireUser();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThisMonth = startOfMonth.toISOString();
  const startOfLast = startOfLastMonth.toISOString();
  const startOf30DaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Pull this month's events + last month's events + a 30-day window in one go.
  // Last month and this month combined are the widest range we need.
  const earliest = [startOfLast, startOf30DaysAgo].sort()[0];

  const { data: usage, error: usageErr } = await supabase
    .from("usage_events")
    .select("cost_usd, occurred_at, provider, model, operation")
    .eq("user_id", user.id)
    .gte("occurred_at", earliest)
    .order("occurred_at", { ascending: true })
    .limit(20_000);
  if (usageErr) throw usageErr;

  const { data: thresholds } = await supabase
    .from("user_layout")
    .select("soft_monthly_usd")
    .eq("user_id", user.id)
    .maybeSingle();
  const monthCapUsd = Number(thresholds?.soft_monthly_usd ?? 40);

  const { data: fixed, error: fixedErr } = await supabase
    .from("fixed_costs")
    .select("id, service, monthly_usd, active, notes")
    .eq("user_id", user.id);
  if (fixedErr) throw fixedErr;

  const rows = (usage ?? []) as UsageEventRow[];

  const thisMonth = rows.filter((r) => r.occurred_at >= startOfThisMonth);
  const lastMonth = rows.filter(
    (r) => r.occurred_at >= startOfLast && r.occurred_at < startOfThisMonth,
  );

  const monthVariableUsd = sum(thisMonth.map((r) => r.cost_usd));
  const lastMonthVariableUsd = sum(lastMonth.map((r) => r.cost_usd));

  const activeFixed = ((fixed ?? []) as FixedCostRow[]).filter((f) => f.active);
  const monthFixedMonthlyUsd = sum(activeFixed.map((f) => Number(f.monthly_usd)));

  // Pro-rate fixed costs to date in current month.
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const dayOfMonth = now.getDate();
  const monthFixedUsd = round2(
    monthFixedMonthlyUsd * (dayOfMonth / daysInMonth),
  );
  const lastMonthFixedUsd = monthFixedMonthlyUsd; // full month assumed

  // Linear projection: variable spend / day_of_month * days_in_month, plus
  // full month of fixed.
  const dailyVariableRunRate = dayOfMonth > 0 ? monthVariableUsd / dayOfMonth : 0;
  const monthProjectedUsd = round2(
    dailyVariableRunRate * daysInMonth + monthFixedMonthlyUsd,
  );

  const dailySpend = aggregateDaily(rows, 30);
  const categoryBreakdown = buildCategoryBreakdown(thisMonth, monthFixedUsd);
  const topOperations = buildTopOperations(thisMonth, 10);

  return {
    monthVariableUsd: round2(monthVariableUsd),
    monthFixedUsd,
    monthFixedMonthlyUsd: round2(monthFixedMonthlyUsd),
    monthProjectedUsd,
    monthCapUsd,
    lastMonthVariableUsd: round2(lastMonthVariableUsd),
    lastMonthFixedUsd: round2(lastMonthFixedUsd),
    dailySpend,
    categoryBreakdown,
    topOperations,
  };
}

function aggregateDaily(
  rows: UsageEventRow[],
  days: number,
): DailySpend[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = r.occurred_at.slice(0, 10);
    if (map.has(key)) {
      map.set(key, (map.get(key) ?? 0) + r.cost_usd);
    }
  }
  return Array.from(map.entries()).map(([date, variable_usd]) => ({
    date,
    variable_usd: round4(variable_usd),
  }));
}

function buildCategoryBreakdown(
  thisMonth: UsageEventRow[],
  fixedUsd: number,
): CategoryTotal[] {
  let anthropic = 0;
  let openai = 0;
  for (const r of thisMonth) {
    if (r.provider === "anthropic") anthropic += r.cost_usd;
    else if (r.provider === "openai") openai += r.cost_usd;
  }
  return [
    { category: "anthropic", total_usd: round2(anthropic) },
    { category: "openai", total_usd: round2(openai) },
    { category: "fixed", total_usd: fixedUsd },
  ];
}

function buildTopOperations(
  rows: UsageEventRow[],
  limit: number,
): TopOperation[] {
  const buckets = new Map<
    string,
    { provider: string; model: string; operation: string; total_usd: number; call_count: number }
  >();
  for (const r of rows) {
    const key = `${r.provider}|${r.model}|${r.operation}`;
    const cur = buckets.get(key) ?? {
      provider: r.provider,
      model: r.model,
      operation: r.operation,
      total_usd: 0,
      call_count: 0,
    };
    cur.total_usd += r.cost_usd;
    cur.call_count += 1;
    buckets.set(key, cur);
  }
  return Array.from(buckets.values())
    .map((b) => ({ ...b, total_usd: round4(b.total_usd) }))
    .sort((a, b) => b.total_usd - a.total_usd)
    .slice(0, limit);
}

// --- Fixed costs CRUD ---

export async function listFixedCosts(): Promise<FixedCostRow[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("fixed_costs")
    .select("id, service, monthly_usd, active, notes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FixedCostRow[];
}

export async function addFixedCost(formData: FormData) {
  const service = String(formData.get("service") ?? "").trim();
  const monthly = Number(formData.get("monthly_usd") ?? 0);
  if (!service || !Number.isFinite(monthly) || monthly < 0) {
    throw new Error("Service and a non-negative monthly amount are required");
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("fixed_costs").insert({
    user_id: user.id,
    service,
    monthly_usd: monthly,
    active: true,
    notes: String(formData.get("notes") ?? "") || null,
  });
  if (error) throw error;
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export async function updateFixedCost(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const monthly = Number(formData.get("monthly_usd") ?? 0);
  const active = formData.get("active") === "on";
  const service = String(formData.get("service") ?? "").trim();
  if (!id || !service || !Number.isFinite(monthly) || monthly < 0) {
    throw new Error("Invalid input");
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("fixed_costs")
    .update({ service, monthly_usd: monthly, active })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

export async function deleteFixedCost(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("fixed_costs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/costs");
  revalidatePath("/dashboard");
}

// --- Thresholds ---

export async function getThresholds(): Promise<{
  softMonthlyUsd: number;
  hardDailyUsd: number;
}> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_layout")
    .select("soft_monthly_usd, hard_daily_usd")
    .eq("user_id", user.id)
    .maybeSingle();
  return {
    softMonthlyUsd: Number(data?.soft_monthly_usd ?? 40),
    hardDailyUsd: Number(data?.hard_daily_usd ?? 5),
  };
}

export async function updateThresholds(formData: FormData) {
  const soft = Number(formData.get("soft_monthly_usd") ?? 40);
  const hard = Number(formData.get("hard_daily_usd") ?? 5);
  if (!Number.isFinite(soft) || soft < 0 || !Number.isFinite(hard) || hard < 0) {
    throw new Error("Thresholds must be non-negative numbers");
  }
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("user_layout")
    .upsert(
      {
        user_id: user.id,
        soft_monthly_usd: soft,
        hard_daily_usd: hard,
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  revalidatePath("/costs");
  revalidatePath("/dashboard");
  revalidatePath("/settings/costs");
}

// --- helpers ---

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + Number(b ?? 0), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
