-- ChiefOS — Spinfusion assignment cache (PRD §5.5, §6, Phase 3)
--
-- Writes come from the Railway scraper using the service-role key (bypasses
-- RLS). Users only read their own rows. The scraper is currently single-user;
-- the user_id column keeps the data model multi-tenant ready.

create table if not exists public.spinfusion_assignments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  provider_name      text not null,
  role               text not null,            -- "MD" | "CRNA" | other free text
  site               text not null default 'Paoli',
  assignment_text    text not null,            -- the raw slot, asterisks preserved
  notes              text,
  pulled_at          timestamptz not null default now(),
  source_html_ref    text,                     -- storage path to raw HTML, optional
  unique (user_id, date, provider_name, site, assignment_text)
);

create index spinfusion_assignments_user_date_idx
  on public.spinfusion_assignments (user_id, date);

alter table public.spinfusion_assignments enable row level security;

create policy "spinfusion_assignments: select own"
  on public.spinfusion_assignments for select using (auth.uid() = user_id);
-- inserts/updates/deletes via service role only.


-- Track each scraper run so the dashboard can show "last refreshed" and a
-- failure indicator without grepping logs.
create table if not exists public.spinfusion_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running'
                check (status in ('running', 'success', 'partial', 'failed')),
  rows_written  integer not null default 0,
  error         text
);

create index spinfusion_runs_user_started_idx
  on public.spinfusion_runs (user_id, started_at desc);

alter table public.spinfusion_runs enable row level security;

create policy "spinfusion_runs: select own"
  on public.spinfusion_runs for select using (auth.uid() = user_id);
