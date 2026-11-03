-- Two privacy follow-ups.
--
-- 1. A teacher can delete their account. Everything goes: the teacher row
--    (email, sign-in time), their unused sign-in links, every class with its
--    members, recorded calls and runs (on delete cascade), the classes' and
--    students' daily counters, the teacher's publish counter, and every page
--    they published from their classes. Sessions are stateless signed
--    cookies, so once the row is gone get_teacher returns null and any open
--    session stops working.
--
-- 2. The daily call counters are deleted after 30 days. They hold no
--    prompts and no raw IPs, only opaque keyed hashes and counts, but there
--    is no reason to keep them longer than the limits need (a day) plus a
--    month to look back on. The 30 days live in the schedule below and in
--    lib/privacy.ts (USAGE_COUNTER_DAYS), which the privacy page shows; a
--    test keeps them equal.
--
-- Access: unchanged — RLS on, no policies. The server may call
-- delete_teacher_account; only the scheduled job calls purge_usage_counters.

-- --- 1. Delete a teacher's account -------------------------------------------------------

-- True if the teacher existed and is gone.
create or replace function public.delete_teacher_account(p_teacher_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_email   text;
  v_classes uuid[];
begin
  select email into v_email from teachers where id = p_teacher_id;
  if v_email is null then
    return false;
  end if;

  select coalesce(array_agg(id), '{}') into v_classes from classes where teacher_id = p_teacher_id;

  -- Published pages are linked with "on delete set null", so they'd outlive
  -- the classes. The teacher asked for everything to go.
  delete from shared_experiments where class_id = any (v_classes);

  -- Daily counters are keyed by id, not linked by a foreign key.
  delete from usage_daily
   where subject in (
     select 'c:' || id from unnest(v_classes) as id
     union all
     select 'm:' || m.id from class_members m where m.class_id = any (v_classes)
     union all
     select 'p:t:' || p_teacher_id
   );

  delete from teacher_login_tokens where email = v_email;

  -- Classes, members, recorded calls and runs go with the teacher (cascade).
  delete from teachers where id = p_teacher_id;
  return true;
end;
$$;

revoke all on function public.delete_teacher_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_teacher_account(uuid) to service_role;

-- Explicit server grants (see supabase/README.md): the function runs as the
-- caller, so the server needs to delete what it deletes. The cascades from
-- teachers run as the table owner.
grant delete on public.teachers, public.teacher_login_tokens, public.usage_daily to service_role;

-- --- 2. Daily counters expire ----------------------------------------------------------

-- Delete counters for days before the cutoff. Returns how many rows went.
create or replace function public.purge_usage_counters(p_before date)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from usage_daily where day < p_before;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only the scheduled job (running as the owner) calls this.
revoke all on function public.purge_usage_counters(date) from public, anon, authenticated, service_role;

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'shape-purge-usage-counters',
      '27 4 * * *',
      $job$select public.purge_usage_counters(current_date - 30)$job$
    );
  end if;
end
$do$;
