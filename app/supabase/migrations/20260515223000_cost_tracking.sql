-- ChiefOS — cost tracking (PRD §5.12, §6)

create table if not exists public.usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,        -- 'anthropic' | 'openai'
  model           text not null,        -- e.g. 'claude-opus-4-7', 'text-embedding-3-small', 'whisper-1'
  operation       text not null,        -- 'chat' | 'embedding' | 'whisper' | etc.
  input_tokens    integer,              -- null for whisper (use input_units)
  output_tokens   integer,
  input_units     numeric,              -- e.g. seconds for whisper, characters for tts
  unit_label      text,                 -- 'tokens' | 'seconds' | 'characters'
  cost_usd        numeric(12, 6) not null,
  request_ref     text,                 -- caller-defined string for traceback
  occurred_at     timestamptz not null default now()
);

create index usage_events_user_time_idx on public.usage_events (user_id, occurred_at desc);

alter table public.usage_events enable row level security;

create policy "usage_events: select own"
  on public.usage_events for select using (auth.uid() = user_id);
-- Inserts only from server-side code (service role bypasses RLS).
-- Authenticated users may not insert directly.

create table if not exists public.fixed_costs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  service      text not null,            -- 'Supabase', 'Vercel', 'Railway', 'Domain', ...
  monthly_usd  numeric(12, 2) not null check (monthly_usd >= 0),
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index fixed_costs_user_idx on public.fixed_costs (user_id, active);

alter table public.fixed_costs enable row level security;

create policy "fixed_costs: select own"
  on public.fixed_costs for select using (auth.uid() = user_id);
create policy "fixed_costs: insert own"
  on public.fixed_costs for insert with check (auth.uid() = user_id);
create policy "fixed_costs: update own"
  on public.fixed_costs for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fixed_costs: delete own"
  on public.fixed_costs for delete using (auth.uid() = user_id);

create trigger fixed_costs_set_updated_at
  before update on public.fixed_costs
  for each row execute function public.set_updated_at();
