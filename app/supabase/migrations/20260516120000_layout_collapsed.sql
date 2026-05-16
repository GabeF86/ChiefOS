-- ChiefOS — dashboard collapsed-state + expanded default card order (PRD §5.1).
-- Adds collapsed_cards column for per-user collapsed state, and bumps the
-- default card_order to include all seven PRD cards.

alter table public.user_layout
  add column if not exists collapsed_cards text[] not null default array[]::text[];

alter table public.user_layout
  alter column card_order set default array[
    'spinfusion',
    'todos',
    'meetings',
    'inbox',
    'quick_capture',
    'quick_ask',
    'cost_tracker'
  ];
