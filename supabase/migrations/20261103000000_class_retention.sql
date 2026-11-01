-- Classrooms, part 4: a class's data is deleted 90 days after its teacher
-- closes it.
--
-- What goes: the class, its members (nicknames and cookie hashes), the
-- server's recorded calls, the submitted runs, and the class's and its
-- students' daily call counters. Nothing about the class is left. A class
-- that is reopened has its close time cleared, so its clock stops.
--
-- How: a daily pg_cron job inside the database calls purge_closed_classes.
-- Nothing outside the database can call it — no API, no server role — so
-- there is no endpoint to protect and no secret to hold. The 90 days live
-- in the schedule below and in lib/classroom.ts (CLASS_RETENTION_DAYS),
-- which tells teachers and students the date; a test keeps them equal.
--
-- The job is only scheduled where pg_cron is available (Supabase); a plain
-- PostgreSQL replay, such as the tests, gets the function without the job.

-- Delete every class closed before the cutoff, and everything that belongs
-- to it. Returns how many classes went.
create or replace function public.purge_closed_classes(p_closed_before timestamptz)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_classes uuid[];
  v_count   integer;
begin
  select coalesce(array_agg(id), '{}') into v_classes
  from classes
  where status = 'closed' and closed_at is not null and closed_at < p_closed_before;

  if cardinality(v_classes) = 0 then
    return 0;
  end if;

  -- The daily counters are keyed by id, not linked by a foreign key.
  delete from usage_daily
   where subject in (
     select 'c:' || id from unnest(v_classes) as id
     union all
     select 'm:' || m.id from class_members m where m.class_id = any (v_classes)
   );

  -- Members, recorded calls and runs go with the class (on delete cascade).
  delete from classes where id = any (v_classes);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only the scheduled job (running as the owner) calls this. Not the server,
-- not the browser.
revoke all on function public.purge_closed_classes(timestamptz) from public, anon, authenticated, service_role;

-- Students see when a closed class's data goes, so get_class now includes
-- the close time. Same signature; existing grants carry over.
create or replace function public.get_class(p_code text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', id, 'code', code, 'title', title, 'status', status, 'experiment', experiment, 'closed_at', closed_at)
  from classes where code = p_code;
$$;

-- The daily job. cron.schedule replaces a job of the same name, so
-- re-running this is harmless.
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    grant all privileges on all tables in schema cron to postgres;
    perform cron.schedule(
      'shape-purge-closed-classes',
      '17 4 * * *',
      $job$select public.purge_closed_classes(now() - interval '90 days')$job$
    );
  end if;
end
$do$;
