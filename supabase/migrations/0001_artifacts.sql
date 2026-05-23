-- Shape artifacts schema — initial migration.
--
-- Apply to your Supabase project to enable cloud-backed publishing:
--   1. supabase init && supabase link --project-ref <ref>
--   2. supabase db push
-- or paste this into the SQL editor under Project → Database.

create extension if not exists "uuid-ossp";

create table if not exists public.artifacts (
  id uuid primary key default uuid_generate_v4(),
  handle text not null,
  slug text not null,
  title text not null,
  summary text not null default '',
  visibility text not null check (visibility in ('public', 'private')),
  kind text not null check (kind in ('diff', 'tone', 'persona', 'refusal', 'evals', 'choreographer')),
  -- Snapshot of the draft at publish time. JSONB so we can index per-kind
  -- fields later if we need to (e.g. tone dial values for browsing).
  draft jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One artifact per (handle, slug). Republishing the same slug updates the row.
  unique (handle, slug)
);

create index if not exists artifacts_handle_idx on public.artifacts (handle);
create index if not exists artifacts_published_at_idx on public.artifacts (published_at desc);

-- Row Level Security: public read for public artifacts, owner-only otherwise.
alter table public.artifacts enable row level security;

create policy "Public artifacts are readable by anyone"
  on public.artifacts for select
  using (visibility = 'public');

-- Anonymous publish is allowed for v1 (no auth yet). Tightens to auth.uid() = owner_id
-- once the auth wiring lands.
create policy "Anyone can publish for now"
  on public.artifacts for insert
  with check (true);

create policy "Anyone can update for now"
  on public.artifacts for update
  using (true);

-- Keep updated_at fresh on update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists artifacts_set_updated_at on public.artifacts;
create trigger artifacts_set_updated_at
  before update on public.artifacts
  for each row execute function public.set_updated_at();
