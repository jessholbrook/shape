-- Keep Shape's server-only RPCs working when newly created public tables no
-- longer receive Supabase's automatic grants. Use a forward migration so it
-- covers both existing projects and a replay of the historical migrations.
--
-- These functions use SECURITY INVOKER: service_role bypasses RLS but still
-- needs ordinary table privileges. Do not switch them to SECURITY DEFINER.
-- No sequences are used, and the browser roles must not gain RPC access.
-- Existing grants, RLS, and function bodies are deliberately left unchanged.

grant select, insert, update
  on table public.usage_daily, public.spend_monthly
  to service_role;

grant select, insert, delete
  on table public.shared_experiments
  to service_role;

grant execute on function public.consume_quota(text, text, date, integer, integer, date, bigint, bigint)
  to service_role;
grant execute on function public.settle_spend(date, bigint, bigint)
  to service_role;
grant execute on function public.quota_status(text, date, date, bigint, bigint)
  to service_role;
grant execute on function public.publish_experiment(text, text, text, jsonb, jsonb, text, text, text, date, integer)
  to service_role;
grant execute on function public.get_shared_experiment(text)
  to service_role;
grant execute on function public.delete_shared_experiment(text, text)
  to service_role;
