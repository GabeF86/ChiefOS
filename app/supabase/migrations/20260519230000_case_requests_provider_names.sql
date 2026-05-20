-- Requested provider names when the surgeon asks for a specific MD or CRNA.

alter table public.case_requests
  add column if not exists md_name text
    check (md_name is null or char_length(md_name) <= 200),
  add column if not exists crna_name text
    check (crna_name is null or char_length(crna_name) <= 200);
