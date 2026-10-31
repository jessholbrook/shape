# Server database permissions

Shape's server calls six PostgREST RPCs with a Supabase secret/service-role key.
The functions run as `SECURITY INVOKER`: `service_role` needs both `EXECUTE` on
each function and privileges on the tables it uses. Its `BYPASSRLS` attribute
does not replace those table grants.

`20261020160545_explicit_server_grants.sql` makes those grants explicit for
existing projects and fresh migration replays:

- `usage_daily`, `spend_monthly`: `SELECT`, `INSERT`, `UPDATE`.
- `shared_experiments`: `SELECT`, `INSERT`, `DELETE`.
- The six quota and sharing RPCs: `EXECUTE` for `service_role` only.

This is additive. It does not revoke older table grants, alter RLS, change
function security, or grant anything to `anon` or `authenticated`. Existing
function revokes and RLS-with-no-policies remain in place. Normal Supabase
setup supplies `USAGE` on the `public` schema. There are no sequences to grant.

Classrooms follow the same rules. `20261031000000_explicit_classroom_grants.sql`
adds forward grants for the part-1 classroom tables and nine RPCs (written
before automatic grants stopped), and `20261101000000_class_runs.sql` grants
exactly what its own functions use:

- `teacher_allowlist`: `SELECT` (rows are managed by the site owner, not the server).
- `teachers`, `teacher_login_tokens`, `class_calls`: `SELECT`, `INSERT`, `UPDATE`.
- `classes`, `class_members`: `SELECT`, `INSERT`.
- `class_runs`: `SELECT`, `INSERT`, `DELETE` (a resubmission replaces a student's runs).
- Every classroom RPC: `EXECUTE` for `service_role` only.

`tests/database-classrooms.test.ts` replays every migration on a fresh
database with no automatic grants and runs the whole classroom flow as a
non-owner `service_role`: sign-in, make a class, join, class metering,
recording, submitting, and the teacher's view.

For future migrations, include explicit grants for only the roles and
operations actually used. Do not restore automatic grants for all new objects
or change functions to `SECURITY DEFINER` to work around a permission error.

## Regression tests

Run `npm test`, or only the database tests:

```sh
node --import tsx --test tests/database-permissions.test.ts
```

The tests execute the SQL in disposable, in-memory PostgreSQL via the pinned
PGlite development dependency. They require no Supabase credentials, network
connection, or Docker. They reproduce the original permission errors, test
fresh and legacy-default migrations, execute every RPC as a non-owner
`service_role`, and verify browser-role restrictions and RLS.

These tests cover database ACLs and function behavior, not the hosted
PostgREST/key gateway. Before an approved deployment, also smoke-test quota
status, a hosted request/settlement, and publish/read/delete on a disposable
Supabase project. Do not reset a production database for testing.

Reference: [Supabase's automatic-grants change](https://github.com/orgs/supabase/discussions/45329).
