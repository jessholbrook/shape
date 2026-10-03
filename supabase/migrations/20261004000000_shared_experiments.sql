-- Sharing: publish a lab experiment (design, results, manifest) to an
-- unlisted, read-only link at /e/<slug>.
--
-- A share is a snapshot. It can't be edited, only deleted, and only by
-- whoever holds its delete token — kept in the publisher's browser. The
-- database stores a SHA-256 of that token, never the token itself.
--
-- There are no accounts and nothing here identifies the publisher. Each
-- network gets a daily publish allowance, counted in usage_daily under an
-- HMAC subject ("p:…"), the same way the free tier counts calls.
--
-- Access: row-level security on with no policies, functions revoked from the
-- public roles. Only the server (secret key) reads or writes any of it.

create table if not exists public.shared_experiments (
  slug              text        primary key check (slug ~ '^[1-9A-HJ-NP-Za-km-z]{10}$'),
  title             text        not null check (char_length(title) between 1 and 200),
  lens              text,
  experiment        jsonb       not null,
  manifest          jsonb       not null,
  manifest_hash     text        not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  delete_token_hash text        not null check (delete_token_hash ~ '^[0-9a-f]{64}$'),
  created_at        timestamptz not null default now()
);

alter table public.shared_experiments enable row level security;

-- Count the publish against the network's daily allowance and store the
-- snapshot. Both happen or neither does.
create or replace function public.publish_experiment(
  p_slug        text,
  p_title       text,
  p_lens        text,
  p_experiment  jsonb,
  p_manifest    jsonb,
  p_hash        text,
  p_delete_hash text,
  p_network     text,
  p_day         date,
  p_limit       integer
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_calls integer;
begin
  insert into usage_daily (day, subject, calls) values (p_day, p_network, 1)
    on conflict (day, subject) do update set calls = usage_daily.calls + 1
    where usage_daily.calls < p_limit
    returning calls into v_calls;
  if v_calls is null then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;

  insert into shared_experiments (slug, title, lens, experiment, manifest, manifest_hash, delete_token_hash)
  values (p_slug, p_title, p_lens, p_experiment, p_manifest, p_hash, p_delete_hash);

  return jsonb_build_object('ok', true);
end;
$$;

-- One share, for the /e/<slug> page. Null when there's no such slug.
create or replace function public.get_shared_experiment(p_slug text) returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'slug', slug,
    'title', title,
    'lens', lens,
    'experiment', experiment,
    'manifest', manifest,
    'manifest_hash', manifest_hash,
    'created_at', created_at
  )
  from shared_experiments
  where slug = p_slug;
$$;

-- Delete a share if the token matches. True when something was deleted.
create or replace function public.delete_shared_experiment(p_slug text, p_delete_hash text) returns boolean
language plpgsql
set search_path = public
as $$
begin
  delete from shared_experiments where slug = p_slug and delete_token_hash = p_delete_hash;
  return found;
end;
$$;

revoke all on function public.publish_experiment(text, text, text, jsonb, jsonb, text, text, text, date, integer) from public, anon, authenticated;
revoke all on function public.get_shared_experiment(text) from public, anon, authenticated;
revoke all on function public.delete_shared_experiment(text, text) from public, anon, authenticated;
