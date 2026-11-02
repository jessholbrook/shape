-- Classrooms: a class nobody has used for 60 days closes on its own, which
-- starts its 90-day deletion clock (20261103000000_class_retention.sql).
-- Without this, a class its teacher forgot about would be kept forever.
--
-- Activity is the latest of: the class being made, a student joining, a
-- free-tier call, a submitted run, or the teacher reopening it. Reopening
-- counts, so a teacher who reopens an old class to keep it gets another 60
-- days rather than being closed again the next night.
--
-- Like the purge, only a daily pg_cron job inside the database calls this —
-- no role can. The 60 days also live in lib/classroom.ts (CLASS_IDLE_DAYS),
-- which tells teachers; a test keeps them equal.

alter table public.classes add column if not exists reopened_at timestamptz;

-- set_class_status (20261102000000) now also records when a class is reopened.
-- Same signature; existing grants carry over.
create or replace function public.set_class_status(p_teacher_id uuid, p_code text, p_status text)
returns jsonb
language sql
set search_path = public
as $$
  update classes
     set status = p_status,
         closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) else null end,
         reopened_at = case when p_status = 'open' and status = 'closed' then now() else reopened_at end
   where teacher_id = p_teacher_id and code = p_code and p_status in ('open', 'closed')
  returning jsonb_build_object('status', status, 'closed_at', closed_at);
$$;

-- Close every open class with no activity since the cutoff. Returns how many.
create or replace function public.close_idle_classes(p_idle_before timestamptz)
returns integer
language sql
set search_path = public
as $$
  with idle as (
    select c.id
    from classes c
    where c.status = 'open'
      and greatest(
        c.created_at,
        coalesce(c.reopened_at, c.created_at),
        coalesce((select max(m.joined_at) from class_members m where m.class_id = c.id), c.created_at),
        coalesce((select max(k.created_at) from class_calls k where k.class_id = c.id), c.created_at),
        coalesce((select max(r.submitted_at) from class_runs r where r.class_id = c.id), c.created_at)
      ) < p_idle_before
  ), closed as (
    update classes set status = 'closed', closed_at = now()
     where id in (select id from idle)
    returning 1
  )
  select count(*)::integer from closed;
$$;

revoke all on function public.close_idle_classes(timestamptz) from public, anon, authenticated, service_role;

-- The daily job, ten minutes before the purge. Harmless to re-run.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'shape-close-idle-classes',
      '7 4 * * *',
      $job$select public.close_idle_classes(now() - interval '60 days')$job$
    );
  end if;
end
$do$;
