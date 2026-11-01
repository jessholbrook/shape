-- Classrooms, part 2: students run the class's experiment, and their runs
-- are saved to the class.
--
-- Free-tier calls made inside a class draw on that class's daily allowance
-- (and a per-student cap) instead of the per-network ceiling, so a room of
-- students on one network isn't throttled as one person. The monthly spend
-- cap still applies to everything.
--
-- When a class call goes through Shape's free tier, the server keeps its own
-- copy of the answer and a fingerprint of the prompt it answered
-- (class_calls). On submission, a run whose answer — and every judge reply —
-- was recorded here, for exactly the class's prompt, is stored as
-- "recorded by Shape": its text and scores come from the server's record, not
-- the browser. Anything else (a student's own key, a mismatch) is stored as
-- "reported by the student".
--
-- Access: row-level security on with no policies, functions revoked from the
-- public roles. Only the server (secret key) reads or writes any of it.

create table if not exists public.class_calls (
  member_id     uuid        not null references public.class_members (id) on delete cascade,
  call_id       text        not null check (call_id ~ '^[A-Za-z0-9_:.-]{1,120}$'),
  class_id      uuid        not null references public.classes (id) on delete cascade,
  model         text        not null,
  prompt_hash   text        not null check (prompt_hash ~ '^[0-9a-f]{64}$'),
  text          text        not null check (char_length(text) <= 40000),
  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  created_at    timestamptz not null default now(),
  primary key (member_id, call_id)
);
create index if not exists class_calls_class on public.class_calls (class_id);

create table if not exists public.class_runs (
  id            uuid        primary key default gen_random_uuid(),
  class_id      uuid        not null references public.classes (id) on delete cascade,
  member_id     uuid        not null references public.class_members (id) on delete cascade,
  run_id        text        not null check (run_id ~ '^[A-Za-z0-9_:.-]{1,120}$'),
  condition_id  text        not null,
  item_id       text,
  idx           integer     not null check (idx >= 0),
  provider      text        not null,
  model         text        not null,
  status        text        not null check (status in ('done', 'error')),
  text          text        not null check (char_length(text) <= 40000),
  error         text,
  scores        jsonb       not null default '{}'::jsonb,
  judge_raw     jsonb,
  recorded      boolean     not null,
  latency_ms    integer,
  input_tokens  integer,
  output_tokens integer,
  submitted_at  timestamptz not null default now(),
  unique (member_id, run_id)
);
create index if not exists class_runs_class on public.class_runs (class_id);

alter table public.class_calls enable row level security;
alter table public.class_runs  enable row level security;

-- --- Metering -------------------------------------------------------------------------

-- Count one free-tier call against the class's day, the student's day, and the
-- month's budget. All three or none. Only for a member of an open class.
create or replace function public.consume_class_quota(
  p_code          text,
  p_member_hash   text,
  p_day           date,
  p_member_limit  integer,
  p_month         date,
  p_reserve_micro bigint,
  p_cap_micro     bigint
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_class_id  uuid;
  v_member_id uuid;
  v_status    text;
  v_limit     integer;
  v_class     integer;
  v_member    integer;
begin
  select c.id, m.id, c.status, c.daily_calls into v_class_id, v_member_id, v_status, v_limit
  from class_members m join classes c on c.id = m.class_id
  where c.code = p_code and m.token_hash = p_member_hash;
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  insert into spend_monthly (month) values (p_month) on conflict (month) do nothing;

  begin
    insert into usage_daily (day, subject, calls) values (p_day, 'c:' || v_class_id, 1)
      on conflict (day, subject) do update set calls = usage_daily.calls + 1
      where usage_daily.calls < v_limit
      returning calls into v_class;
    if v_class is null then raise exception 'quota:class_daily'; end if;

    insert into usage_daily (day, subject, calls) values (p_day, 'm:' || v_member_id, 1)
      on conflict (day, subject) do update set calls = usage_daily.calls + 1
      where usage_daily.calls < p_member_limit
      returning calls into v_member;
    if v_member is null then raise exception 'quota:member_daily'; end if;

    update spend_monthly
       set reserved_micro = reserved_micro + p_reserve_micro
     where month = p_month and reserved_micro + p_reserve_micro <= p_cap_micro;
    if not found then raise exception 'quota:monthly'; end if;

    return jsonb_build_object(
      'ok', true,
      'class_id', v_class_id,
      'member_id', v_member_id,
      'remaining', least(v_limit - v_class, p_member_limit - v_member)
    );
  exception when raise_exception then
    -- The inner block is a subtransaction: every increment above rolls back.
    return jsonb_build_object('ok', false, 'reason', split_part(sqlerrm, ':', 2));
  end;
end;
$$;

-- What a member has left today, for the class page's preflight.
create or replace function public.class_quota_status(p_code text, p_member_hash text, p_day date, p_member_limit integer)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'status', c.status,
    'class_remaining', greatest(0, c.daily_calls - coalesce((select calls from usage_daily where day = p_day and subject = 'c:' || c.id), 0)),
    'member_remaining', greatest(0, p_member_limit - coalesce((select calls from usage_daily where day = p_day and subject = 'm:' || m.id), 0))
  )
  from class_members m join classes c on c.id = m.class_id
  where c.code = p_code and m.token_hash = p_member_hash;
$$;

-- --- Recording -------------------------------------------------------------------------

-- The server's own copy of a class call's answer. A retried call replaces its earlier record.
create or replace function public.record_class_call(
  p_class_id    uuid,
  p_member_id   uuid,
  p_call_id     text,
  p_model       text,
  p_prompt_hash text,
  p_text        text,
  p_input       integer,
  p_output      integer
) returns void
language sql
set search_path = public
as $$
  insert into class_calls (member_id, call_id, class_id, model, prompt_hash, text, input_tokens, output_tokens)
  values (p_member_id, p_call_id, p_class_id, p_model, p_prompt_hash, left(p_text, 40000), p_input, p_output)
  on conflict (member_id, call_id) do update
    set model = excluded.model, prompt_hash = excluded.prompt_hash, text = excluded.text,
        input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens, created_at = now();
$$;

-- This member's recorded calls among the given ids, as {call_id: {text, model, prompt_hash}}.
create or replace function public.get_class_calls(p_code text, p_member_hash text, p_call_ids text[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(k.call_id, jsonb_build_object('text', k.text, 'model', k.model, 'prompt_hash', k.prompt_hash)), '{}'::jsonb)
  from class_calls k
  join class_members m on m.id = k.member_id
  join classes c on c.id = m.class_id
  where c.code = p_code and m.token_hash = p_member_hash and k.call_id = any (p_call_ids);
$$;

-- --- Submitting ------------------------------------------------------------------------

-- Replace this member's runs with a new set (a rerun replaces the last one).
create or replace function public.submit_class_runs(p_code text, p_member_hash text, p_runs jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_class_id  uuid;
  v_member_id uuid;
  v_status    text;
  v_count     integer;
begin
  select c.id, m.id, c.status into v_class_id, v_member_id, v_status
  from class_members m join classes c on c.id = m.class_id
  where c.code = p_code and m.token_hash = p_member_hash;
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  delete from class_runs where member_id = v_member_id;
  insert into class_runs (class_id, member_id, run_id, condition_id, item_id, idx, provider, model, status, text, error,
                          scores, judge_raw, recorded, latency_ms, input_tokens, output_tokens)
  select v_class_id, v_member_id, r.run_id, r.condition_id, r.item_id, r.idx, r.provider, r.model, r.status, r.text, r.error,
         coalesce(r.scores, '{}'::jsonb), r.judge_raw, r.recorded, r.latency_ms, r.input_tokens, r.output_tokens
  from jsonb_to_recordset(p_runs) as r(
    run_id text, condition_id text, item_id text, idx integer, provider text, model text, status text, text text,
    error text, scores jsonb, judge_raw jsonb, recorded boolean, latency_ms integer, input_tokens integer, output_tokens integer
  );
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'stored', v_count);
end;
$$;

-- The teacher's class view, now with each member's run counts.
create or replace function public.get_teacher_class(p_teacher_id uuid, p_code text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'code', c.code,
    'title', c.title,
    'status', c.status,
    'experiment', c.experiment,
    'daily_calls', c.daily_calls,
    'created_at', c.created_at,
    'closed_at', c.closed_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nickname', m.nickname,
        'joined_at', m.joined_at,
        'runs', (select count(*) from class_runs r where r.member_id = m.id),
        'recorded', (select count(*) from class_runs r where r.member_id = m.id and r.recorded)
      ) order by m.joined_at)
      from class_members m where m.class_id = c.id
    ), '[]'::jsonb)
  )
  from classes c
  where c.teacher_id = p_teacher_id and c.code = p_code;
$$;

revoke all on function public.consume_class_quota(text, text, date, integer, date, bigint, bigint) from public, anon, authenticated;
revoke all on function public.class_quota_status(text, text, date, integer) from public, anon, authenticated;
revoke all on function public.record_class_call(uuid, uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_class_calls(text, text, text[]) from public, anon, authenticated;
revoke all on function public.submit_class_runs(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_teacher_class(uuid, text) from public, anon, authenticated;

-- Explicit server grants (see supabase/README.md): only what these functions do.
-- class_calls: record_class_call upserts; get_class_calls reads.
grant select, insert, update on table public.class_calls to service_role;
-- class_runs: submit_class_runs replaces a member's runs (delete, then insert);
-- get_teacher_class counts them.
grant select, insert, delete on table public.class_runs to service_role;

grant execute on function public.consume_class_quota(text, text, date, integer, date, bigint, bigint) to service_role;
grant execute on function public.class_quota_status(text, text, date, integer) to service_role;
grant execute on function public.record_class_call(uuid, uuid, text, text, text, text, integer, integer) to service_role;
grant execute on function public.get_class_calls(text, text, text[]) to service_role;
grant execute on function public.submit_class_runs(text, text, jsonb) to service_role;
grant execute on function public.get_teacher_class(uuid, text) to service_role;
