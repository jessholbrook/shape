import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The live project predates Supabase dropping automatic grants: its default
// privileges give the browser roles everything on every new table, function
// and sequence. This replays every migration under exactly those defaults and
// checks 20261102010000_revoke_browser_table_grants.sql leaves the browser
// roles nothing, while the server keeps what it needs.
const migrations = new URL("../supabase/migrations/", import.meta.url);
const FIX = "20261102010000_revoke_browser_table_grants.sql";
const BROWSER = ["anon", "authenticated"] as const;
const ALL_TABLE_PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];

async function value<T>(db: PGlite, sql: string, args: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ result: T }>(sql, args);
  return rows[0].result;
}

/** A database configured like the live project, with every migration up to (not including) `stopBefore`. */
async function liveLike(stopBefore?: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    -- The live project's pg_default_acl for objects postgres creates in public.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  const files = (await readdir(migrations)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (f === stopBefore) break;
    await db.exec(await readFile(new URL(f, migrations), "utf8"));
  }
  return db;
}

async function publicTables(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ name: string }>(
    "select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1",
  );
  return rows.map((r) => r.name);
}

async function browserTablePrivileges(db: PGlite): Promise<string[]> {
  const held: string[] = [];
  for (const table of await publicTables(db)) {
    for (const role of BROWSER) {
      for (const p of ALL_TABLE_PRIVILEGES) {
        if (await value<boolean>(db, "select has_table_privilege($1, $2, $3) as result", [role, `public.${table}`, p])) held.push(`${role} ${p} ${table}`);
      }
    }
  }
  return held;
}

async function browserCallableFunctions(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ fn: string }>(`
    select p.oid::regprocedure::text as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    order by 1`);
  return rows.map((r) => r.fn);
}

test("before the fix, live-like defaults hand the browser roles every server table (RLS is the only wall)", async () => {
  const db = await liveLike(FIX);
  try {
    const held = await browserTablePrivileges(db);
    assert.ok(held.includes("anon TRUNCATE classes"), "reproduces the live state");
    assert.ok(held.includes("authenticated DELETE usage_daily"));
  } finally {
    await db.close();
  }
});

test("after the fix, the browser roles hold nothing on any table or function, now or for new ones", async () => {
  const db = await liveLike();
  try {
    assert.deepEqual(await browserTablePrivileges(db), [], "no table privilege of any kind");
    assert.deepEqual(await browserCallableFunctions(db), [], "no callable function");
    for (const table of await publicTables(db)) {
      assert.equal(await value(db, "select relrowsecurity as result from pg_class where oid = $1::regclass", [`public.${table}`]), true, `${table}: RLS still on`);
    }

    // The next migration's table and function start with nothing for the browser.
    await db.exec(`
      create table public.later (id int);
      create function public.later_fn() returns int language sql as 'select 1';
      create sequence public.later_seq;
    `);
    for (const role of BROWSER) {
      assert.equal(await value(db, "select has_table_privilege($1, 'public.later', 'SELECT') as result", [role]), false);
      assert.equal(await value(db, "select has_function_privilege($1, 'public.later_fn()', 'EXECUTE') as result", [role]), false);
      assert.equal(await value(db, "select has_sequence_privilege($1, 'public.later_seq', 'USAGE') as result", [role]), false);
    }
    assert.equal(await value(db, "select has_table_privilege('service_role', 'public.later', 'SELECT') as result"), true, "service_role keeps its defaults");

    // A browser role is refused outright now, not just shown zero rows.
    for (const role of BROWSER) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(() => db.query("select * from public.classes"), { code: "42501" });
        await assert.rejects(() => db.query("truncate public.usage_daily"), { code: "42501" });
      } finally {
        await db.exec("reset role");
      }
    }

    // And the server still works: a teacher signs in, makes a class, a student joins and is metered.
    await db.exec("insert into public.teacher_allowlist (email) values ('prof@uni.edu')");
    await db.exec("set role service_role");
    try {
      await db.query("select public.request_teacher_login('prof@uni.edu', $1, now() + interval '15 min')", ["a".repeat(64)]);
      const teacher = await value<{ id: string }>(db, "select public.verify_teacher_login($1) as result", ["a".repeat(64)]);
      assert.equal((await value<{ ok: boolean }>(db, "select public.create_class($1, 'KQ7M3P', 'Week 3', '{}', 3) as result", [teacher.id])).ok, true);
      assert.deepEqual(await value(db, "select public.join_class('KQ7M3P', 'Ada', $1) as result", ["1".repeat(64)]), { ok: true });
      const q = await value<{ ok: boolean }>(db, "select public.consume_class_quota('KQ7M3P', $1, '2026-11-02', 2, '2026-11-01', 100, 1000) as result", ["1".repeat(64)]);
      assert.equal(q.ok, true);
      assert.equal((await value<{ status: string }>(db, "select public.set_class_status($1, 'KQ7M3P', 'closed') as result", [teacher.id])).status, "closed");
    } finally {
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
