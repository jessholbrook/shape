-- Take away the browser roles' table privileges on Shape's server-only tables,
-- and stop new tables and functions from getting them by default.
--
-- Why: projects created before Supabase stopped automatic grants still have
-- default privileges that give anon and authenticated everything (select,
-- insert, update, delete, truncate, …) on every new table, function and
-- sequence in public. Row-level security with no policies blocks every row
-- for those roles, so nothing has been reachable through the API — but that
-- left one layer of protection where there should be two, and the live
-- database differed from the one the tests check. Shape's browser code never
-- talks to Supabase; only the server does, as service_role, with its own
-- explicit grants (20261020160545, 20261031000000 and later).
--
-- Forward-only and narrow:
--   * The ten server-only tables lose every anon/authenticated privilege.
--     service_role's grants are untouched.
--   * `artifacts` (the original table, with its own RLS policies) is left as
--     it is — its future is a separate decision.
--   * Default privileges for objects that `postgres` creates in public no
--     longer include anon/authenticated. Migrations run as postgres, so every
--     later table, function and sequence must be granted explicitly — which
--     supabase/README.md already requires. service_role keeps its defaults.

revoke all on table
  public.usage_daily,
  public.spend_monthly,
  public.shared_experiments,
  public.teacher_allowlist,
  public.teachers,
  public.teacher_login_tokens,
  public.classes,
  public.class_members,
  public.class_calls,
  public.class_runs
  from anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- PostgreSQL itself lets PUBLIC (every role) execute a new function, and a
-- per-schema default can't take that away — only a global one can. Every
-- migration here already revokes it function by function; this makes it the
-- default for functions postgres creates from now on. Supabase's own schemas
-- are created by supabase_admin and aren't affected.
alter default privileges for role postgres revoke execute on functions from public;
