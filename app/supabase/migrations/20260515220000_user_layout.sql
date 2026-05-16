-- ChiefOS — initial migration
-- Tables: user_layout (card order per user)
-- Auth tables (auth.users) are managed by Supabase; we only reference auth.uid().
-- Other Phase-1 tables (todos, recurring_meetings, etc.) live in subsequent migrations.

create table if not exists public.user_layout (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  card_order   text[] not null default array[
    'todos','meetings','quick_capture','cost_tracker'
  ],
  updated_at   timestamptz not null default now()
);

alter table public.user_layout enable row level security;

create policy "user_layout: select own"
  on public.user_layout
  for select
  using (auth.uid() = user_id);

create policy "user_layout: insert own"
  on public.user_layout
  for insert
  with check (auth.uid() = user_id);

create policy "user_layout: update own"
  on public.user_layout
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_layout_set_updated_at
  before update on public.user_layout
  for each row execute function public.set_updated_at();
