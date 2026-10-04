-- Classrooms, part 1: teachers sign in, make a class from a lab experiment,
-- and students join it with a code and a nickname.
--
-- Teachers are invite-only: an email has to be on teacher_allowlist (rows the
-- site owner adds in the dashboard) to get a sign-in link, and removing it
-- revokes access on the next request. Sign-in links are single-use and
-- short-lived; only their SHA-256 is stored.
--
-- Students have no accounts. A member is a nickname in one class plus a
-- random token in a cookie; only the token's SHA-256 is stored. No student
-- email, name, or IP is kept.
--
-- Access: row-level security on with no policies, functions revoked from the
-- public roles. Only the server (secret key) reads or writes any of it.

create table if not exists public.teacher_allowlist (
  email    text        primary key check (email = lower(email) and email like '%_@_%'),
  note     text,
  added_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id                uuid        primary key default gen_random_uuid(),
  email             text        not null unique check (email = lower(email)),
  created_at        timestamptz not null default now(),
  last_signed_in_at timestamptz
);

create table if not exists public.teacher_login_tokens (
  token_hash text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  email      text        not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists teacher_login_tokens_email on public.teacher_login_tokens (email, created_at);

create table if not exists public.classes (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique check (code ~ '^[ACDEFHJKMNPQRTUVWXY3479]{6}$'),
  teacher_id  uuid        not null references public.teachers (id) on delete cascade,
  title       text        not null check (char_length(title) between 1 and 200),
  experiment  jsonb       not null,
  daily_calls integer     not null check (daily_calls > 0),
  status      text        not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists classes_teacher on public.classes (teacher_id, created_at desc);

create table if not exists public.class_members (
  id         uuid        primary key default gen_random_uuid(),
  class_id   uuid        not null references public.classes (id) on delete cascade,
  nickname   text        not null check (char_length(nickname) between 1 and 24),
  token_hash text        not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  joined_at  timestamptz not null default now()
);
create unique index if not exists class_members_nickname on public.class_members (class_id, lower(nickname));

alter table public.teacher_allowlist    enable row level security;
alter table public.teachers             enable row level security;
alter table public.teacher_login_tokens enable row level security;
alter table public.classes              enable row level security;
alter table public.class_members        enable row level security;

-- --- Teacher sign-in -----------------------------------------------------------

-- Store a sign-in token for an allowlisted email. Says whether to send the
-- email: not for unknown addresses, and not past 5 links an hour per address.
create or replace function public.request_teacher_login(p_email text, p_token_hash text, p_expires_at timestamptz)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from teacher_allowlist where email = p_email) then
    return jsonb_build_object('send', false, 'reason', 'not_allowed');
  end if;
  if (select count(*) from teacher_login_tokens where email = p_email and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('send', false, 'reason', 'throttled');
  end if;
  insert into teacher_login_tokens (token_hash, email, expires_at) values (p_token_hash, p_email, p_expires_at);
  return jsonb_build_object('send', true);
end;
$$;

-- Use a sign-in token once. Returns the teacher, or null if the token is
-- unknown, used, expired, or its email has left the allowlist.
create or replace function public.verify_teacher_login(p_token_hash text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_email   text;
  v_teacher teachers;
begin
  update teacher_login_tokens set used_at = now()
   where token_hash = p_token_hash and used_at is null and expires_at > now()
  returning email into v_email;
  if v_email is null or not exists (select 1 from teacher_allowlist where email = v_email) then
    return null;
  end if;
  insert into teachers (email, last_signed_in_at) values (v_email, now())
    on conflict (email) do update set last_signed_in_at = now()
  returning * into v_teacher;
  return jsonb_build_object('id', v_teacher.id, 'email', v_teacher.email);
end;
$$;

-- The teacher behind a session, if they're still allowed. Checked on every
-- request, so removing an email from the allowlist signs that teacher out.
create or replace function public.get_teacher(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', t.id, 'email', t.email)
  from teachers t join teacher_allowlist a on a.email = t.email
  where t.id = p_id;
$$;

-- --- Classes -----------------------------------------------------------------------

create or replace function public.create_class(p_teacher_id uuid, p_code text, p_title text, p_experiment jsonb, p_daily_calls integer)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from classes where code = p_code) then
    return jsonb_build_object('ok', false, 'reason', 'code_taken');
  end if;
  insert into classes (code, teacher_id, title, experiment, daily_calls)
  values (p_code, p_teacher_id, p_title, p_experiment, p_daily_calls)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'code', p_code);
end;
$$;

create or replace function public.list_teacher_classes(p_teacher_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', c.code,
    'title', c.title,
    'status', c.status,
    'created_at', c.created_at,
    'members', (select count(*) from class_members m where m.class_id = c.id)
  ) order by c.created_at desc), '[]'::jsonb)
  from classes c
  where c.teacher_id = p_teacher_id;
$$;

-- A class as its teacher sees it, with the member list. Null if it isn't theirs.
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
      select jsonb_agg(jsonb_build_object('nickname', m.nickname, 'joined_at', m.joined_at) order by m.joined_at)
      from class_members m where m.class_id = c.id
    ), '[]'::jsonb)
  )
  from classes c
  where c.teacher_id = p_teacher_id and c.code = p_code;
$$;

-- A class as a student sees it: no teacher identity, no member list.
create or replace function public.get_class(p_code text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('id', id, 'code', code, 'title', title, 'status', status, 'experiment', experiment)
  from classes where code = p_code;
$$;

-- --- Members -----------------------------------------------------------------------

create or replace function public.join_class(p_code text, p_nickname text, p_token_hash text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_class classes;
begin
  select * into v_class from classes where code = p_code;
  if v_class.id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if v_class.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if exists (select 1 from class_members where class_id = v_class.id and lower(nickname) = lower(p_nickname)) then
    return jsonb_build_object('ok', false, 'reason', 'nickname_taken');
  end if;
  insert into class_members (class_id, nickname, token_hash) values (v_class.id, p_nickname, p_token_hash);
  return jsonb_build_object('ok', true);
end;
$$;

-- Who a member cookie belongs to, in this class. Null if no one.
create or replace function public.get_member(p_code text, p_token_hash text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object('nickname', m.nickname, 'joined_at', m.joined_at)
  from class_members m join classes c on c.id = m.class_id
  where c.code = p_code and m.token_hash = p_token_hash;
$$;

revoke all on function public.request_teacher_login(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.verify_teacher_login(text) from public, anon, authenticated;
revoke all on function public.get_teacher(uuid) from public, anon, authenticated;
revoke all on function public.create_class(uuid, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.list_teacher_classes(uuid) from public, anon, authenticated;
revoke all on function public.get_teacher_class(uuid, text) from public, anon, authenticated;
revoke all on function public.get_class(text) from public, anon, authenticated;
revoke all on function public.join_class(text, text, text) from public, anon, authenticated;
revoke all on function public.get_member(text, text) from public, anon, authenticated;
