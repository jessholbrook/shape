-- Explicit server grants for the classroom tables and functions
-- (20261005000000_classrooms.sql), which were written before newly created
-- public tables stopped receiving Supabase's automatic grants. Same rules as
-- 20261020160545_explicit_server_grants.sql: forward-only and additive, only
-- the operations the functions actually perform, service_role only, functions
-- stay SECURITY INVOKER, RLS and existing revokes untouched.

-- Read by request_teacher_login, verify_teacher_login and get_teacher. Rows
-- are added and removed by the site owner in the dashboard, not the server.
grant select on table public.teacher_allowlist to service_role;

-- verify_teacher_login upserts the teacher (insert … on conflict do update).
grant select, insert, update on table public.teachers to service_role;

-- request_teacher_login counts and inserts; verify_teacher_login marks used.
grant select, insert, update on table public.teacher_login_tokens to service_role;

grant select, insert on table public.classes to service_role;
grant select, insert on table public.class_members to service_role;

grant execute on function public.request_teacher_login(text, text, timestamptz) to service_role;
grant execute on function public.verify_teacher_login(text) to service_role;
grant execute on function public.get_teacher(uuid) to service_role;
grant execute on function public.create_class(uuid, text, text, jsonb, integer) to service_role;
grant execute on function public.list_teacher_classes(uuid) to service_role;
grant execute on function public.get_teacher_class(uuid, text) to service_role;
grant execute on function public.get_class(text) to service_role;
grant execute on function public.join_class(text, text, text) to service_role;
grant execute on function public.get_member(text, text) to service_role;
