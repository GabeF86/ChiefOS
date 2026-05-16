"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_CARD_ORDER,
  VALID_CARD_KEYS,
  type CardKey,
  type DashboardLayout,
} from "@/lib/domain/layout/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/**
 * Returns the dashboard layout for the current user. Merges any persisted
 * card_order with the canonical default — unknown keys are dropped, missing
 * keys are appended in default order so newly-added cards still appear.
 */
export async function getDashboardLayout(): Promise<DashboardLayout> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_layout")
    .select("card_order, collapsed_cards")
    .eq("user_id", user.id)
    .maybeSingle();

  const stored: string[] = data?.card_order ?? [];
  const collapsedRaw: string[] = data?.collapsed_cards ?? [];

  const ordered: CardKey[] = [];
  for (const k of stored) if (VALID_CARD_KEYS.has(k)) ordered.push(k as CardKey);
  for (const k of DEFAULT_CARD_ORDER) if (!ordered.includes(k)) ordered.push(k);

  const collapsed = new Set<CardKey>();
  for (const k of collapsedRaw) if (VALID_CARD_KEYS.has(k)) collapsed.add(k as CardKey);

  return { cardOrder: ordered, collapsed };
}

export async function setCardOrder(order: string[]): Promise<void> {
  const cleaned = order.filter((k) => VALID_CARD_KEYS.has(k));
  for (const k of DEFAULT_CARD_ORDER) if (!cleaned.includes(k)) cleaned.push(k);

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("user_layout").upsert(
    { user_id: user.id, card_order: cleaned },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function setCollapsed(
  key: string,
  collapsed: boolean,
): Promise<void> {
  if (!VALID_CARD_KEYS.has(key)) return;
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("user_layout")
    .select("collapsed_cards")
    .eq("user_id", user.id)
    .maybeSingle();

  const cur = new Set<string>((data?.collapsed_cards as string[]) ?? []);
  if (collapsed) cur.add(key);
  else cur.delete(key);

  const { error } = await supabase.from("user_layout").upsert(
    {
      user_id: user.id,
      collapsed_cards: Array.from(cur),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  revalidatePath("/dashboard");
}
