import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The free tier's concurrency slots (20261106000000_hosted_slots.sql) on real
// PostgreSQL: every migration replayed, the functions run as service_role.
const migrations = new URL("../supabase/migrations/", import.meta.url);

async function fresh(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  const files = (await readdir(migrations)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await db.exec(await readFile(new URL(f, migrations), "utf8"));
  return db;
}

async function value<T>(db: PGlite, sql: string, args: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ result: T }>(sql, args);
  return rows[0].result;
}

test("slots: at most N at once; releasing or expiring frees one; only the server can take them", async () => {
  const db = await fresh();
  try {
    const acquire = (max: number) => value<string | null>(db, "select public.acquire_hosted_slot($1, 75) as result", [max]);
    await db.exec("set role service_role");
    try {
      const a = await acquire(2);
      const b = await acquire(2);
      assert.ok(a && b && a !== b);
      assert.equal(await acquire(2), null, "both taken: busy");
      await db.query("select public.release_hosted_slot($1)", [a]);
      const c = await acquire(2);
      assert.ok(c, "a released slot can be taken again");
      assert.equal(await acquire(2), null);
      await db.query("select public.release_hosted_slot($1)", [a]); // releasing twice is harmless
      assert.equal(await acquire(3) !== null, true, "a higher limit admits more");
    } finally {
      await db.exec("reset role");
    }

    // A slot whose server died mid-call expires instead of being lost.
    await db.exec("update public.hosted_slots set expires_at = now() - interval '1 second'");
    await db.exec("set role service_role");
    try {
      assert.ok(await acquire(1), "expired leases don't count");
      assert.equal(await value(db, "select count(*)::int as result from public.hosted_slots"), 1, "and are cleared");
    } finally {
      await db.exec("reset role");
    }

    assert.equal(await value(db, "select relrowsecurity as result from pg_class where oid = 'public.hosted_slots'::regclass"), true);
    for (const role of ["anon", "authenticated"]) {
      for (const fn of ["public.acquire_hosted_slot(integer,integer)", "public.release_hosted_slot(uuid)"]) {
        assert.equal(await value(db, "select has_function_privilege($1, $2, 'EXECUTE') as result", [role, fn]), false, `${role}: ${fn}`);
      }
      assert.equal(await value(db, "select has_table_privilege($1, 'public.hosted_slots', 'SELECT') as result", [role]), false);
    }
  } finally {
    await db.close();
  }
});
