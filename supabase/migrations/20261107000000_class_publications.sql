-- Classrooms: a teacher publishes the class's pooled results as a shared
-- experiment — an unlisted /e/<slug> page anyone with the link can read,
-- check against its manifest, and rerun.
--
-- The snapshot is built on the server from the class's own records, never
-- sent by a browser: only runs recorded by Shape, for one answering model,
-- with no nicknames. So the page can say every run on it was answered
-- through Shape and checked, and nobody can tell who ran what.
--
-- A publication is linked to its class so the teacher can list and take it
-- down from the class page (no delete token to keep). When the class is
-- deleted (90 days after closing) the link to it is cleared but the page
-- stays up: it's anonymous, the teacher chose to publish it, and others may
-- have cited it. The teacher can take it down any time before then.
--
-- Access: unchanged — RLS on, no policies, server-only functions.

alter table public.shared_experiments
  add column if not exists class_id uuid references public.classes (id) on delete set null;
create index if not exists shared_experiments_class on public.shared_experiments (class_id) where class_id is not null;

-- Publish a snapshot of the teacher's own class. Counts against a daily
-- allowance per teacher. Null if the class isn't theirs.
create or replace function public.publish_class_results(
  p_teacher_id  uuid,
  p_code        text,
  p_slug        text,
  p_title       text,
  p_lens        text,
  p_experiment  jsonb,
  p_manifest    jsonb,
  p_hash        text,
  p_delete_hash text,
  p_day         date,
  p_limit       integer
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_class_id uuid;
  v_calls    integer;
begin
  select id into v_class_id from classes where teacher_id = p_teacher_id and code = p_code;
  if v_class_id is null then
    return null;
  end if;

  insert into usage_daily (day, subject, calls) values (p_day, 'p:t:' || p_teacher_id, 1)
    on conflict (day, subject) do update set calls = usage_daily.calls + 1
    where usage_daily.calls < p_limit
    returning calls into v_calls;
  if v_calls is null then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;

  insert into shared_experiments (slug, title, lens, experiment, manifest, manifest_hash, delete_token_hash, class_id)
  values (p_slug, p_title, p_lens, p_experiment, p_manifest, p_hash, p_delete_hash, v_class_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- The teacher's publications for a class, newest first. Null if not theirs.
create or replace function public.list_class_publications(p_teacher_id uuid, p_code text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when c.id is null then null else coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', s.slug,
      'title', s.title,
      'model', s.experiment -> 'base' -> 'model' ->> 'model',
      'runs', jsonb_array_length(s.experiment -> 'runs'),
      'created_at', s.created_at
    ) order by s.created_at desc)
    from shared_experiments s where s.class_id = c.id
  ), '[]'::jsonb) end
  from (select 1) one
  left join classes c on c.teacher_id = p_teacher_id and c.code = p_code;
$$;

-- Take one of the teacher's class publications down. True if it was theirs and is gone.
create or replace function public.unpublish_class_results(p_teacher_id uuid, p_code text, p_slug text)
returns boolean
language sql
set search_path = public
as $$
  with gone as (
    delete from shared_experiments s
     using classes c
     where s.slug = p_slug and s.class_id = c.id and c.teacher_id = p_teacher_id and c.code = p_code
    returning 1
  )
  select exists (select 1 from gone);
$$;

revoke all on function public.publish_class_results(uuid, text, text, text, text, jsonb, jsonb, text, text, date, integer) from public, anon, authenticated;
revoke all on function public.list_class_publications(uuid, text) from public, anon, authenticated;
revoke all on function public.unpublish_class_results(uuid, text, text) from public, anon, authenticated;

-- Explicit server grants (see supabase/README.md). shared_experiments already
-- has select, insert, delete and usage_daily select, insert, update (20261020160545).
grant execute on function public.publish_class_results(uuid, text, text, text, text, jsonb, jsonb, text, text, date, integer) to service_role;
grant execute on function public.list_class_publications(uuid, text) to service_role;
grant execute on function public.unpublish_class_results(uuid, text, text) to service_role;
