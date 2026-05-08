-- Run once in Supabase SQL editor.
-- Creates the feedback table for in-app submissions and the policies that let
-- the admin dashboard (admin.html) read + delete with the public anon key.

create extension if not exists "uuid-ossp";

create table if not exists public.feedback (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid,
  body text not null,
  user_agent text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone with the anon key can submit (the regular app uses this).
drop policy if exists "anon insert feedback" on public.feedback;
create policy "anon insert feedback"
  on public.feedback for insert
  to anon
  with check (true);

-- Anyone with the anon key can read + delete (the admin.html dashboard uses this).
-- Tighten later if you ever expose another anon-keyed surface.
drop policy if exists "anon read feedback" on public.feedback;
create policy "anon read feedback"
  on public.feedback for select
  to anon
  using (true);

drop policy if exists "anon delete feedback" on public.feedback;
create policy "anon delete feedback"
  on public.feedback for delete
  to anon
  using (true);

-- Helpful index for "newest first" queries.
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
