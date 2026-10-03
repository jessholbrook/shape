-- Free tier: per-visitor daily quota, per-network ceiling, and a hard monthly
-- spend cap for Shape's hosted Claude Haiku tier.
--
-- Privacy: nothing here identifies a person. `subject` is an HMAC of either a
-- random visitor cookie ("v:…") or the caller's IP salted with the day
-- ("n:…"), computed on the server with a secret the database never sees. No
-- prompts, outputs, or raw IPs are stored.
--
-- Access: row-level security is on with no policies, and the functions are
-- revoked from the public roles, so only the server (secret key) can touch
-- any of it. The browser never talks to this database.

create table if not exists public.usage_daily (
  day     date    not null,
  subject text    not null,
  calls   integer not null default 0,
  primary key (day, subject)
);

create table if not exists public.spend_monthly (
  month          date   primary key,
  -- Committed plus in-flight spend, in millionths of a dollar. A call reserves
  -- its worst case up front and settles to its actual cost when it finishes,
  -- so concurrent calls can never overshoot the cap.
  reserved_micro bigint not null default 0,
  actual_micro   bigint not null default 0,
  calls          bigint not null default 0
);

alter table public.usage_daily   enable row level security;
alter table public.spend_monthly enable row level security;

-- Atomically: count the call against the visitor and the network, and reserve
-- its worst-case cost against the month. All three succeed or none do.
create or replace function public.consume_quota(
  p_visitor        text,
  p_network        text,
  p_day            date,
  p_visitor_limit  integer,
  p_network_limit  integer,
  p_month          date,
  p_reserve_micro  bigint,
  p_cap_micro      bigint
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_calls integer;
  v_net   integer;
begin
  insert into spend_monthly (month) values (p_month) on conflict (month) do nothing;

  begin
    insert into usage_daily (day, subject, calls) values (p_day, p_visitor, 1)
      on conflict (day, subject) do update set calls = usage_daily.calls + 1
      where usage_daily.calls < p_visitor_limit
      returning calls into v_calls;
    if v_calls is null then raise exception 'quota:daily'; end if;

    insert into usage_daily (day, subject, calls) values (p_day, p_network, 1)
      on conflict (day, subject) do update set calls = usage_daily.calls + 1
      where usage_daily.calls < p_network_limit
      returning calls into v_net;
    if v_net is null then raise exception 'quota:network'; end if;

    update spend_monthly
       set reserved_micro = reserved_micro + p_reserve_micro
     where month = p_month and reserved_micro + p_reserve_micro <= p_cap_micro;
    if not found then raise exception 'quota:monthly'; end if;

    return jsonb_build_object('ok', true, 'remaining', p_visitor_limit - v_calls);
  exception when raise_exception then
    -- The inner block is a subtransaction: every increment above rolls back.
    return jsonb_build_object('ok', false, 'reason', split_part(sqlerrm, ':', 2));
  end;
end;
$$;

-- Replace a call's reservation with what it actually cost.
create or replace function public.settle_spend(
  p_month          date,
  p_reserved_micro bigint,
  p_actual_micro   bigint
) returns void
language sql
set search_path = public
as $$
  update spend_monthly
     set reserved_micro = greatest(0, reserved_micro - p_reserved_micro + p_actual_micro),
         actual_micro   = actual_micro + p_actual_micro,
         calls          = calls + 1
   where month = p_month;
$$;

-- Read-only: calls this visitor has used today, and whether the month still
-- has room for one more worst-case call.
create or replace function public.quota_status(
  p_visitor       text,
  p_day           date,
  p_month         date,
  p_reserve_micro bigint,
  p_cap_micro     bigint
) returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'used', coalesce((select calls from usage_daily where day = p_day and subject = p_visitor), 0),
    'month_open', coalesce((select reserved_micro + p_reserve_micro <= p_cap_micro from spend_monthly where month = p_month), true)
  );
$$;

revoke all on function public.consume_quota(text, text, date, integer, integer, date, bigint, bigint) from public, anon, authenticated;
revoke all on function public.settle_spend(date, bigint, bigint) from public, anon, authenticated;
revoke all on function public.quota_status(text, date, date, bigint, bigint) from public, anon, authenticated;
