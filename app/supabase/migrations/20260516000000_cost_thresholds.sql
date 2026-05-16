-- ChiefOS — cost alert thresholds (PRD §5.12)
-- Stored on user_layout for now; if settings grow we'll extract a table.

alter table public.user_layout
  add column if not exists soft_monthly_usd numeric(10, 2) not null default 40.00,
  add column if not exists hard_daily_usd   numeric(10, 2) not null default  5.00;
