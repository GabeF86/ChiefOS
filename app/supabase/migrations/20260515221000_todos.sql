-- ChiefOS — todos (PRD §5.2, §6)

create type public.todo_priority as enum ('low', 'med', 'high');
create type public.todo_status   as enum ('open', 'done', 'snoozed', 'dropped');
create type public.todo_source   as enum ('manual', 'email', 'meeting', 'recurring', 'suggested');

create table if not exists public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 280),
  notes         text,
  priority      public.todo_priority not null default 'med',
  due_at        timestamptz,
  source        public.todo_source not null default 'manual',
  source_ref    text,
  status        public.todo_status not null default 'open',
  snoozed_until timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index todos_user_status_idx on public.todos (user_id, status);
create index todos_user_due_idx    on public.todos (user_id, due_at);

alter table public.todos enable row level security;

create policy "todos: select own"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "todos: insert own"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "todos: update own"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "todos: delete own"
  on public.todos for delete
  using (auth.uid() = user_id);

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();
