import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL in a disposable in-memory database. No network, project
// credentials, Docker, or hosted database is used by these tests.
const migrations = new URL("../supabase/migrations/", import.meta.url);
const grantsFile = "20261020160545_explicit_server_grants.sql";
const functions = [
  "public.consume_quota(text,text,date,integer,integer,date,bigint,bigint)",
  "public.settle_spend(date,bigint,bigint)",
  "public.quota_status(text,date,date,bigint,bigint)",
  "public.publish_experiment(text,text,text,jsonb,jsonb,text,text,text,date,integer)",
  "public.get_shared_experiment(text)",
  "public.delete_shared_experiment(text,text)",
];
const tablePrivileges: Record<string, string[]> = {
  usage_daily: ["SELECT", "INSERT", "UPDATE"],
  spend_monthly: ["SELECT", "INSERT", "UPDATE"],
  shared_experiments: ["SELECT", "INSERT", "DELETE"],
};
const consume = `select public.consume_quota(
  'v:test', 'n:test', '2026-10-20', 2, 10, '2026-10-01', 100, 1000) as result`;
const status = `select public.quota_status(
  'v:test', '2026-10-20', '2026-10-01', 100, 1000) as result`;
const publish = `select public.publish_experiment(
  '123456789A', 'Test share', null, '{"test": true}', '{}',
  repeat('a', 64), repeat('b', 64), 'p:test', '2026-10-20', 1) as result`;

async function migrate(db: PGlite, file: string) {
  await db.exec(await readFile(new URL(file, migrations), "utf8"));
}

async function value<T>(db: PGlite, sql: string, args: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ result: T }>(sql, args);
  return rows[0].result;
}

async function asRole<T>(
  db: PGlite,
  role: "service_role" | "anon" | "authenticated",
  action: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}

async function setup(legacyDefaults: boolean): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  if (legacyDefaults) {
    await db.exec(`
      alter default privileges in schema public
        grant select, insert, update, delete on tables to anon, authenticated, service_role;
      alter default privileges in schema public
        grant execute on functions to anon, authenticated, service_role;
    `);
  }
  // Without the above defaults, new tables have no API-role grants.
  // The historical migrations also revoke PostgreSQL's PUBLIC function grant.
  await migrate(db, "20261003000000_free_tier_quota.sql");
  await migrate(db, "20261004000000_shared_experiments.sql");
  return db;
}

async function checkPermissions(db: PGlite, legacyDefaults: boolean) {
  for (const [table, required] of Object.entries(tablePrivileges)) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
      const expected = required.includes(privilege) ||
        (legacyDefaults && ["SELECT", "INSERT", "UPDATE", "DELETE"].includes(privilege));
      assert.equal(await value(db,
        "select has_table_privilege('service_role', $1, $2) as result",
        [`public.${table}`, privilege]), expected, `${table}: ${privilege}`);
    }
    assert.equal(await value(db,
      "select relrowsecurity as result from pg_class where oid = $1::regclass",
      [`public.${table}`]), true, `${table}: RLS remains enabled`);
  }
  for (const fn of functions) {
    assert.equal(await value(db,
      "select has_function_privilege('service_role', $1, 'EXECUTE') as result",
      [fn]), true, fn);
    assert.equal(await value(db,
      "select prosecdef as result from pg_proc where oid = $1::regprocedure",
      [fn]), false, `${fn}: remains SECURITY INVOKER`);
    for (const role of ["anon", "authenticated"]) {
      assert.equal(await value(db,
        "select has_function_privilege($1, $2, 'EXECUTE') as result",
        [role, fn]), false, `${role}: cannot execute ${fn}`);
    }
  }

  for (const role of ["anon", "authenticated"] as const) {
    await asRole(db, role, async () => {
      await assert.rejects(() => db.query(status), { code: "42501" });
      await assert.rejects(() => db.query(
        "select public.get_shared_experiment('123456789A')"), { code: "42501" });
      // Legacy projects keep their table grants, but RLS still hides all rows.
      for (const table of Object.keys(tablePrivileges)) {
        if (legacyDefaults) {
          assert.equal(await value(db, `select count(*)::int as result from public.${table}`), 0);
        } else {
          await assert.rejects(() => db.query(`select * from public.${table}`), { code: "42501" });
        }
      }
      await assert.rejects(() => db.query(
        "insert into public.usage_daily values ('2026-10-20', 'blocked', 1)"), { code: "42501" });
    });
  }
}

async function checkRpcFlows(db: PGlite) {
  await asRole(db, "service_role", async () => {
    assert.deepEqual(await value(db, status), { used: 0, month_open: true });
    assert.deepEqual(await value(db, consume), { ok: true, remaining: 1 });
    assert.deepEqual(await value(db, consume), { ok: true, remaining: 0 });
    assert.deepEqual(await value(db, consume), { ok: false, reason: "daily" });
    assert.deepEqual(await value(db, status), { used: 2, month_open: true });
    assert.equal(await value(db,
      "select calls as result from public.usage_daily where subject = 'n:test'"), 2,
    "denied quota does not increment the network");

    await db.query("select public.settle_spend('2026-10-01', 100, 40)");
    assert.deepEqual(await value(db, `select jsonb_build_object(
      'reserved', reserved_micro, 'actual', actual_micro, 'calls', calls) as result
      from public.spend_monthly where month = '2026-10-01'`),
    { reserved: 140, actual: 40, calls: 1 });

    assert.deepEqual(await value(db, publish), { ok: true });
    assert.deepEqual(await value(db, publish), { ok: false, reason: "limit" });
    const shared = await value<Record<string, unknown>>(db,
      "select public.get_shared_experiment('123456789A') as result");
    assert.equal(shared.title, "Test share");
    assert.deepEqual(shared.experiment, { test: true });
    assert.equal("delete_token_hash" in shared, false);
    assert.equal(await value(db,
      "select public.delete_shared_experiment('123456789A', repeat('c', 64)) as result"), false);
    assert.equal(await value(db,
      "select public.delete_shared_experiment('123456789A', repeat('b', 64)) as result"), true);
    assert.equal(await value(db,
      "select public.get_shared_experiment('123456789A') as result"), null);
    // Leave a real share for the later browser-role checks: an empty table
    // alone would not demonstrate that RLS hides existing snapshots.
    assert.deepEqual(await value(db,
      publish.replace("'123456789A'", "'123456789B'").replace("'p:test'", "'p:retained'")),
    { ok: true });
  });
}

test("server RPCs work after a fresh replay without automatic API grants", async () => {
  const db = await setup(false);
  try {
    // Reproduce both permission layers independently before applying the fix.
    await asRole(db, "service_role", async () => {
      await assert.rejects(() => db.query(consume),
        { code: "42501", message: /permission denied for function consume_quota/ });
    });
    await db.exec(`grant execute on function ${functions[0]} to service_role`);
    await asRole(db, "service_role", async () => {
      await assert.rejects(() => db.query(consume),
        { code: "42501", message: /permission denied for table spend_monthly/ });
    });
    await migrate(db, grantsFile);
    await migrate(db, grantsFile); // Repeated application is harmless.
    await checkRpcFlows(db);
    await checkPermissions(db, false);
  } finally {
    await db.close();
  }
});

test("forward grants preserve existing projects and browser-role restrictions", async () => {
  const db = await setup(true);
  try {
    await migrate(db, grantsFile);
    await checkRpcFlows(db);
    await checkPermissions(db, true);
  } finally {
    await db.close();
  }
});
