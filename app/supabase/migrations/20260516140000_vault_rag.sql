-- ChiefOS — document vault + RAG storage (PRD §5.4, §6)
-- Enables pgvector and creates note_files / note_chunks plus a match RPC.

create extension if not exists vector;

create table if not exists public.note_files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  path          text not null,                 -- e.g. "20-workflows/handoff.md"
  content_hash  text not null,                 -- sha256 of source text
  byte_size     integer not null default 0,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, path)
);

create index note_files_user_idx on public.note_files (user_id);

alter table public.note_files enable row level security;

create policy "note_files: select own"
  on public.note_files for select using (auth.uid() = user_id);
create policy "note_files: insert own"
  on public.note_files for insert with check (auth.uid() = user_id);
create policy "note_files: update own"
  on public.note_files for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "note_files: delete own"
  on public.note_files for delete using (auth.uid() = user_id);

create trigger note_files_set_updated_at
  before update on public.note_files
  for each row execute function public.set_updated_at();


create table if not exists public.note_chunks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  file_id       uuid not null references public.note_files(id) on delete cascade,
  chunk_index   integer not null,
  content       text not null,
  token_count   integer not null default 0,
  embedding     vector(1536) not null,
  created_at    timestamptz not null default now()
);

create index note_chunks_user_idx on public.note_chunks (user_id);
create index note_chunks_file_idx on public.note_chunks (file_id);
-- HNSW for fast cosine search at modest scale (single user, thousands of chunks).
create index if not exists note_chunks_embedding_hnsw
  on public.note_chunks using hnsw (embedding vector_cosine_ops);

alter table public.note_chunks enable row level security;

create policy "note_chunks: select own"
  on public.note_chunks for select using (auth.uid() = user_id);
-- Inserts come from server-side ingestion (service role bypasses RLS).
-- Deletes cascade from note_files; explicit user delete also allowed.
create policy "note_chunks: delete own"
  on public.note_chunks for delete using (auth.uid() = user_id);


-- RPC: top-k nearest chunks for an embedded query, restricted to a user.
-- Returns chunks with their cosine distance and the file's path so the chat
-- response can cite by filename without a second query.
create or replace function public.match_note_chunks(
  query_embedding vector(1536),
  match_count     int,
  user_id_arg     uuid
)
returns table (
  chunk_id     uuid,
  file_id      uuid,
  file_path    text,
  chunk_index  int,
  content      text,
  similarity   float
)
language sql stable as $$
  select
    c.id           as chunk_id,
    c.file_id      as file_id,
    f.path         as file_path,
    c.chunk_index  as chunk_index,
    c.content      as content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.note_chunks c
  join public.note_files  f on f.id = c.file_id
  where c.user_id = user_id_arg
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_note_chunks(vector, int, uuid) from public;
grant execute on function public.match_note_chunks(vector, int, uuid) to authenticated, service_role;
