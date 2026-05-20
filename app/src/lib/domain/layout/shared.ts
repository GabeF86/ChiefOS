/**
 * Shared types + constants for the dashboard layout. Lives outside the
 * "use server" module because that file can only export async functions.
 */

export const DEFAULT_CARD_ORDER = [
  "spinfusion",
  "case_requests",
  "todos",
  "meetings",
  "inbox",
  "quick_capture",
  "quick_ask",
  "cost_tracker",
] as const;

export type CardKey = (typeof DEFAULT_CARD_ORDER)[number];

export const VALID_CARD_KEYS = new Set<string>(DEFAULT_CARD_ORDER);

export interface DashboardLayout {
  cardOrder: CardKey[];
  collapsed: Set<CardKey>;
}
