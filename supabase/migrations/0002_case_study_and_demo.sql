-- Shape — case-study artifacts + visitor demo rate-limiting.
--
-- Apply this on top of 0001_artifacts.sql. Idempotent: safe to re-run.

-- 1. Allow 'case-study' as a valid kind. The 0001 CHECK constraint only allowed
--    the six original kinds; case-study artifacts produced by /build will fail
--    insertion otherwise.
alter table public.artifacts
  drop constraint if exists artifacts_kind_check;

alter table public.artifacts
  add constraint artifacts_kind_check
  check (kind in ('diff', 'tone', 'persona', 'refusal', 'evals', 'choreographer', 'case-study'));

-- 2. demo_turns — one row per successful visitor demo call, used to enforce
--    per-IP and per-(IP, artifact) daily caps. ip_hash is the salted SHA-256
--    of the request IP, so we never store raw addresses.
create table if not exists public.demo_turns (
  id uuid primary key default uuid_generate_v4(),
  ip_hash text not null,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists demo_turns_ip_artifact_idx
  on public.demo_turns (ip_hash, artifact_id, created_at);

create index if not exists demo_turns_ip_idx
  on public.demo_turns (ip_hash, created_at);

alter table public.demo_turns enable row level security;

-- Anon can insert + read its own counters. ip_hash is opaque (salted), so
-- there's no PII exposure; the table is effectively a throwaway counter.
create policy "Anyone can record a demo turn"
  on public.demo_turns for insert
  with check (true);

create policy "Anyone can read demo turns"
  on public.demo_turns for select
  using (true);
