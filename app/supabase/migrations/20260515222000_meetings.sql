-- ChiefOS — recurring meetings (PRD §5.3, §6)

create table if not exists public.recurring_meetings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 200),
  rrule             text not null,
  location          text,
  attendees         text,
  prep_template_md  text,
  google_event_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index recurring_meetings_user_idx on public.recurring_meetings (user_id);

alter table public.recurring_meetings enable row level security;

create policy "recurring_meetings: select own"
  on public.recurring_meetings for select using (auth.uid() = user_id);
create policy "recurring_meetings: insert own"
  on public.recurring_meetings for insert with check (auth.uid() = user_id);
create policy "recurring_meetings: update own"
  on public.recurring_meetings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_meetings: delete own"
  on public.recurring_meetings for delete using (auth.uid() = user_id);

create trigger recurring_meetings_set_updated_at
  before update on public.recurring_meetings
  for each row execute function public.set_updated_at();


create table if not exists public.meeting_instances (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  recurring_meeting_id  uuid not null references public.recurring_meetings(id) on delete cascade,
  scheduled_at          timestamptz not null,
  notes_ref             text,  -- vault path
  attended              boolean,
  created_at            timestamptz not null default now()
);

create index meeting_instances_user_idx       on public.meeting_instances (user_id);
create index meeting_instances_scheduled_idx  on public.meeting_instances (user_id, scheduled_at);

alter table public.meeting_instances enable row level security;

create policy "meeting_instances: select own"
  on public.meeting_instances for select using (auth.uid() = user_id);
create policy "meeting_instances: insert own"
  on public.meeting_instances for insert with check (auth.uid() = user_id);
create policy "meeting_instances: update own"
  on public.meeting_instances for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meeting_instances: delete own"
  on public.meeting_instances for delete using (auth.uid() = user_id);
