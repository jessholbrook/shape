-- Classrooms, part 3: pooled results, closing a class, and refunds for calls
-- that failed upstream.
--
-- Who sees what:
--   * A member sees every run in the class, pooled and anonymous — no
--     nicknames — with the answer text only for runs recorded by Shape. A
--     reported run's text came from a student's browser, and showing it to
--     the room would let anyone put anything on their classmates' screens.
--     Its scores still count; the teacher sees its text.
--   * The teacher sees every run with the student's nickname, and can close
--     or reopen the class. A closed class takes no new calls or runs, and its
--     results stay readable.
--
-- Access: unchanged — row-level security on with no policies, functions
-- revoked from the public roles. Only the server (secret key) calls these.

-- --- Results ----------------------------------------------------------------------------

-- The class's runs for one of its members, anonymous. Null if not a member.
create or replace function public.get_class_results(p_code text, p_member_hash text)
returns jsonb
language sql
stable
set search_path = public
as $$
  with me as (
    select m.id as member_id, c.id as class_id
    from class_members m join classes c on c.id = m.class_id
    where c.code = p_code and m.token_hash = p_member_hash
  )
  select case when not exists (select 1 from me) then null else coalesce((
    select jsonb_agg(jsonb_build_object(
      'run_id', r.run_id,
      'condition_id', r.condition_id,
      'item_id', r.item_id,
      'idx', r.idx,
      'provider', r.provider,
      'model', r.model,
      'status', r.status,
      'scores', r.scores,
      'recorded', r.recorded,
      'mine', r.member_id = me.member_id,
      'text', case when r.recorded or r.member_id = me.member_id then r.text end
    ) order by r.submitted_at, r.member_id, r.idx, r.run_id)
    from class_runs r, me
    where r.class_id = me.class_id
  ), '[]'::jsonb) end;
$$;

-- Every run in the teacher's class, with who submitted it. Null if not theirs.
create or replace function public.get_teacher_class_runs(p_teacher_id uuid, p_code text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when c.id is null then null else coalesce((
    select jsonb_agg(jsonb_build_object(
      'nickname', m.nickname,
      'run_id', r.run_id,
      'condition_id', r.condition_id,
      'item_id', r.item_id,
      'idx', r.idx,
      'provider', r.provider,
      'model', r.model,
      'status', r.status,
      'text', r.text,
      'error', r.error,
      'scores', r.scores,
      'judge_raw', r.judge_raw,
      'recorded', r.recorded,
      'latency_ms', r.latency_ms,
      'input_tokens', r.input_tokens,
      'output_tokens', r.output_tokens,
      'submitted_at', r.submitted_at
    ) order by m.joined_at, r.idx, r.run_id)
    from class_runs r join class_members m on m.id = r.member_id
    where r.class_id = c.id
  ), '[]'::jsonb) end
  from (select 1) one
  left join classes c on c.teacher_id = p_teacher_id and c.code = p_code;
$$;

-- --- Closing ----------------------------------------------------------------------------

-- Close or reopen the teacher's own class. Null if it isn't theirs.
create or replace function public.set_class_status(p_teacher_id uuid, p_code text, p_status text)
returns jsonb
language sql
set search_path = public
as $$
  update classes
     set status = p_status,
         closed_at = case when p_status = 'closed' then coalesce(closed_at, now()) else null end
   where teacher_id = p_teacher_id and code = p_code and p_status in ('open', 'closed')
  returning jsonb_build_object('status', status, 'closed_at', closed_at);
$$;

-- --- Refunds ----------------------------------------------------------------------------

-- Give back one counted call per subject, for a call the model never
-- answered. Never below zero. The money side is already settled at the
-- call's real cost; this is the daily call count.
create or replace function public.refund_calls(p_day date, p_subjects text[])
returns void
language sql
set search_path = public
as $$
  update usage_daily set calls = calls - 1
   where day = p_day and subject = any (p_subjects) and calls > 0;
$$;

revoke all on function public.get_class_results(text, text) from public, anon, authenticated;
revoke all on function public.get_teacher_class_runs(uuid, text) from public, anon, authenticated;
revoke all on function public.set_class_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.refund_calls(date, text[]) from public, anon, authenticated;

-- Explicit server grants (see supabase/README.md): only what these functions do.
-- classes: set_class_status updates status and closed_at.
grant update on table public.classes to service_role;
-- usage_daily already has select, insert, update (20261020160545).

grant execute on function public.get_class_results(text, text) to service_role;
grant execute on function public.get_teacher_class_runs(uuid, text) to service_role;
grant execute on function public.set_class_status(uuid, text, text) to service_role;
grant execute on function public.refund_calls(date, text[]) to service_role;
