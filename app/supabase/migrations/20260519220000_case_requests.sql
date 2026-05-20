-- ChiefOS — case requests intake (PRD §5.6, manual + Gmail-intake-driven)
--
-- Surgeons or schedulers send a "Request Case" email to
-- paolianesthesia@gmail.com (or are entered by hand) asking for an MD,
-- CRNA, or both on a specific date. The dashboard surfaces upcoming
-- requests so the chief can confirm staffing.

create table if not exists public.case_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  case_date     date not null,
  surgeon_name  text not null check (char_length(surgeon_name) between 1 and 200),
  needs_md      boolean not null default false,
  needs_crna    boolean not null default false,
  notes         text check (notes is null or char_length(notes) <= 4000),
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  source        text not null default 'manual'
                check (source in ('manual', 'email')),
  source_ref    text,  -- email message id once Gmail intake is wired
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint case_requests_needs_one
    check (needs_md or needs_crna)
);

create index case_requests_user_date_idx
  on public.case_requests (user_id, case_date);

alter table public.case_requests enable row level security;

create policy "case_requests: select own"
  on public.case_requests for select using (auth.uid() = user_id);
create policy "case_requests: insert own"
  on public.case_requests for insert with check (auth.uid() = user_id);
create policy "case_requests: update own"
  on public.case_requests for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "case_requests: delete own"
  on public.case_requests for delete using (auth.uid() = user_id);

create trigger case_requests_set_updated_at
  before update on public.case_requests
  for each row execute function public.set_updated_at();
