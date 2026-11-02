-- A queue for the free tier: at most N model calls in flight at once, across
-- every server instance.
--
-- Why: the free tier runs on one Anthropic key, and that key has a limit on
-- concurrent connections. A room of students each sending a couple of calls
-- at once hits it, and Anthropic answers 429. Vercel runs the endpoint on many
-- short-lived instances, so a counter in memory can't see the others' calls —
-- the count has to live here.
--
-- How: before calling Anthropic the server takes a slot; when the call ends it
-- gives it back. If every slot is taken, the server tells the browser "busy,
-- try again in a moment" without calling Anthropic, and the browser waits and
-- retries. A slot is a lease: if a server instance dies mid-call, its slot
-- expires on its own rather than being lost.
--
-- Access: RLS on, no policies; only the server (service_role) calls these.

create table if not exists public.hosted_slots (
  id         uuid        primary key default gen_random_uuid(),
  expires_at timestamptz not null
);
alter table public.hosted_slots enable row level security;

-- Take a slot if fewer than p_max are in use. Returns its id, or null when
-- every slot is taken. One caller at a time (advisory lock), so two servers
-- can't both take the last slot.
create or replace function public.acquire_hosted_slot(p_max integer, p_lease_seconds integer)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('shape.hosted_slots'));
  delete from hosted_slots where expires_at <= now();
  if (select count(*) from hosted_slots) >= p_max then
    return null;
  end if;
  insert into hosted_slots (expires_at)
  values (now() + make_interval(secs => greatest(p_lease_seconds, 1)))
  returning id into v_id;
  return v_id;
end;
$$;

-- Give a slot back. Releasing one that already expired is harmless.
create or replace function public.release_hosted_slot(p_id uuid)
returns void
language sql
set search_path = public
as $$
  delete from hosted_slots where id = p_id;
$$;

revoke all on function public.acquire_hosted_slot(integer, integer) from public, anon, authenticated;
revoke all on function public.release_hosted_slot(uuid) from public, anon, authenticated;
revoke all on table public.hosted_slots from anon, authenticated;

-- Explicit server grants (see supabase/README.md): only what these functions do.
grant select, insert, delete on table public.hosted_slots to service_role;
grant execute on function public.acquire_hosted_slot(integer, integer) to service_role;
grant execute on function public.release_hosted_slot(uuid) to service_role;
