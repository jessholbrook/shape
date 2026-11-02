import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Classrooms against real PostgreSQL in a disposable in-memory database:
// every migration replayed in order, with no automatic API grants, and every
// classroom RPC run as a non-owner service_role. See supabase/README.md.
const migrations = new URL("../supabase/migrations/", import.meta.url);

const functions = [
  "public.request_teacher_login(text,text,timestamptz)",
  "public.verify_teacher_login(text)",
  "public.get_teacher(uuid)",
  "public.create_class(uuid,text,text,jsonb,integer)",
  "public.list_teacher_classes(uuid)",
  "public.get_teacher_class(uuid,text)",
  "public.get_class(text)",
  "public.join_class(text,text,text)",
  "public.get_member(text,text)",
  "public.consume_class_quota(text,text,date,integer,date,bigint,bigint)",
  "public.class_quota_status(text,text,date,integer)",
  "public.record_class_call(uuid,uuid,text,text,text,text,integer,integer)",
  "public.get_class_calls(text,text,text[])",
  "public.submit_class_runs(text,text,jsonb)",
  "public.get_class_results(text,text)",
  "public.get_teacher_class_runs(uuid,text)",
  "public.set_class_status(uuid,text,text)",
  "public.refund_calls(date,text[])",
];

const tables: Record<string, string[]> = {
  teacher_allowlist: ["SELECT"],
  teachers: ["SELECT", "INSERT", "UPDATE"],
  teacher_login_tokens: ["SELECT", "INSERT", "UPDATE"],
  classes: ["SELECT", "INSERT", "UPDATE"],
  class_members: ["SELECT", "INSERT"],
  class_calls: ["SELECT", "INSERT", "UPDATE"],
  class_runs: ["SELECT", "INSERT", "DELETE"],
};

const H = (c: string) => c.repeat(64);

async function value<T>(db: PGlite, sql: string, args: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ result: T }>(sql, args);
  return rows[0].result;
}

async function asService<T>(db: PGlite, action: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}

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

test("classroom tables and functions grant service_role exactly what it uses, and nothing to browser roles", async () => {
  const db = await fresh();
  try {
    for (const [table, required] of Object.entries(tables)) {
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        assert.equal(
          await value(db, "select has_table_privilege('service_role', $1, $2) as result", [`public.${table}`, p]),
          required.includes(p),
          `${table}: ${p}`,
        );
        for (const role of ["anon", "authenticated"]) {
          assert.equal(await value(db, "select has_table_privilege($1, $2, $3) as result", [role, `public.${table}`, p]), false);
        }
      }
      assert.equal(await value(db, "select relrowsecurity as result from pg_class where oid = $1::regclass", [`public.${table}`]), true);
    }
    for (const fn of functions) {
      assert.equal(await value(db, "select has_function_privilege('service_role', $1, 'EXECUTE') as result", [fn]), true, fn);
      assert.equal(await value(db, "select prosecdef as result from pg_proc where oid = $1::regprocedure", [fn]), false, `${fn}: SECURITY INVOKER`);
      for (const role of ["anon", "authenticated"]) {
        assert.equal(await value(db, "select has_function_privilege($1, $2, 'EXECUTE') as result", [role, fn]), false, `${role}: ${fn}`);
      }
    }
  } finally {
    await db.close();
  }
});

test("the classroom flow runs end to end as service_role on a fresh replay", async () => {
  const db = await fresh();
  try {
    // The site owner approves a teacher in the dashboard (as the table owner).
    await db.exec("insert into public.teacher_allowlist (email) values ('prof@uni.edu')");

    await asService(db, async () => {
      // Sign in.
      assert.deepEqual(
        await value(db, "select public.request_teacher_login('prof@uni.edu', $1, now() + interval '15 min') as result", [H("a")]),
        { send: true },
      );
      const teacher = await value<{ id: string; email: string }>(db, "select public.verify_teacher_login($1) as result", [H("a")]);
      assert.equal(teacher.email, "prof@uni.edu");
      assert.equal(await value(db, "select public.verify_teacher_login($1) as result", [H("a")]), null, "single use");

      // Make a class with a 3-call daily allowance, and join two students.
      const made = await value<{ ok: boolean }>(db, "select public.create_class($1, 'KQ7M3P', 'Week 3', '{\"q\":1}', 3) as result", [teacher.id]);
      assert.equal(made.ok, true);
      assert.deepEqual(await value(db, "select public.join_class('KQ7M3P', 'Ada', $1) as result", [H("1")]), { ok: true });
      assert.deepEqual(await value(db, "select public.join_class('KQ7M3P', 'Bo', $1) as result", [H("2")]), { ok: true });

      // Metering: the class's 3 calls are shared; Ada's own cap is 2.
      const consume = (member: string) =>
        value<Record<string, unknown>>(
          db,
          "select public.consume_class_quota('KQ7M3P', $1, '2026-11-01', 2, '2026-11-01', 100, 1000) as result",
          [member],
        );
      const first = await consume(H("1"));
      assert.equal(first.ok, true);
      assert.equal(first.remaining, 1);
      assert.equal((await consume(H("1"))).ok, true);
      assert.deepEqual(await consume(H("1")), { ok: false, reason: "member_daily" });
      assert.equal((await consume(H("2"))).ok, true);
      assert.deepEqual(await consume(H("2")), { ok: false, reason: "class_daily" });
      assert.deepEqual(await consume(H("9")), { ok: false, reason: "not_member" });
      assert.equal(
        await value(db, "select calls as result from public.usage_daily where subject = $1", [`m:${first.member_id}`]),
        2,
        "a refused call doesn't count",
      );
      assert.deepEqual(await value(db, "select public.class_quota_status('KQ7M3P', $1, '2026-11-01', 2) as result", [H("1")]), {
        status: "open",
        class_remaining: 0,
        member_remaining: 0,
      });

      // Recording: a retried call replaces its record; only the member's own calls come back.
      const rec = (call: string, text: string, member = first.member_id) =>
        db.query("select public.record_class_call($1, $2, $3, 'claude-haiku-4-5', $4, $5, 10, 5)", [first.class_id, member, call, H("f"), text]);
      await rec("run_1", "first try");
      await rec("run_1", "the answer");
      await rec("run_1:m1", "declines");
      const calls = await value<Record<string, { text: string }>>(
        db,
        "select public.get_class_calls('KQ7M3P', $1, array['run_1', 'run_1:m1', 'nope']) as result",
        [H("1")],
      );
      assert.deepEqual(Object.keys(calls).sort(), ["run_1", "run_1:m1"]);
      assert.equal(calls.run_1.text, "the answer");
      assert.deepEqual(await value(db, "select public.get_class_calls('KQ7M3P', $1, array['run_1']) as result", [H("2")]), {}, "Bo can't read Ada's calls");

      // Submitting replaces the member's earlier runs; the teacher sees counts.
      const run = (id: string, recorded: boolean) => ({
        run_id: id, condition_id: "c0", item_id: null, idx: 0, provider: "shape-free", model: "claude-haiku-4-5",
        status: "done", text: "x", scores: { m1: true }, recorded,
      });
      const submit = (runs: unknown[]) =>
        value(db, "select public.submit_class_runs('KQ7M3P', $1, $2) as result", [H("1"), JSON.stringify(runs)]);
      assert.deepEqual(await submit([run("a", true), run("b", false), run("c", true)]), { ok: true, stored: 3 });
      assert.deepEqual(await submit([run("d", true), run("e", false)]), { ok: true, stored: 2 });
      const view = await value<{ members: { nickname: string; runs: number; recorded: number }[] }>(
        db,
        "select public.get_teacher_class($1, 'KQ7M3P') as result",
        [teacher.id],
      );
      assert.deepEqual(
        view.members.map((m) => [m.nickname, m.runs, m.recorded]),
        [["Ada", 2, 1], ["Bo", 0, 0]],
      );
      assert.deepEqual(await value(db, "select public.submit_class_runs('KQ7M3P', $1, '[]') as result", [H("9")]), { ok: false, reason: "not_member" });

      // Pooled results: members see every run, anonymous, with text only for
      // recorded runs (and their own); the teacher sees everything, by name.
      await value(db, "select public.submit_class_runs('KQ7M3P', $1, $2) as result", [H("2"), JSON.stringify([{ ...run("f", false), text: "Bo's own words" }])]);
      type Row = { run_id: string; text: string | null; mine: boolean; recorded: boolean; nickname?: string };
      const forBo = await value<Row[]>(db, "select public.get_class_results('KQ7M3P', $1) as result", [H("2")]);
      assert.deepEqual(forBo.map((r) => [r.run_id, r.recorded, r.mine, r.text]), [
        ["d", true, false, "x"],
        ["e", false, false, null],
        ["f", false, true, "Bo's own words"],
      ]);
      assert.ok(forBo.every((r) => !("nickname" in r)), "members never see who submitted what");
      assert.equal(await value(db, "select public.get_class_results('KQ7M3P', $1) as result", [H("9")]), null, "not a member");
      const all = await value<Row[]>(db, "select public.get_teacher_class_runs($1, 'KQ7M3P') as result", [teacher.id]);
      assert.deepEqual(all.map((r) => [r.nickname, r.run_id, r.text]), [["Ada", "d", "x"], ["Ada", "e", "x"], ["Bo", "f", "Bo's own words"]]);
      assert.equal(await value(db, "select public.get_teacher_class_runs($1, 'KQ7M3P') as result", ["00000000-0000-0000-0000-000000000000"]), null, "not their class");

      // Refunds give back one counted call, never below zero.
      await db.query("select public.refund_calls('2026-11-01', array[$1, $2, 'v:nobody'])", [`c:${first.class_id}`, `m:${first.member_id}`]);
      assert.equal(await value(db, "select calls as result from public.usage_daily where subject = $1", [`m:${first.member_id}`]), 1);
      assert.equal(await value(db, "select calls as result from public.usage_daily where subject = $1", [`c:${first.class_id}`]), 2);
      for (let i = 0; i < 3; i++) await db.query("select public.refund_calls('2026-11-01', array[$1])", [`m:${first.member_id}`]);
      assert.equal(await value(db, "select calls as result from public.usage_daily where subject = $1", [`m:${first.member_id}`]), 0);

      // Only the class's own teacher can close it, and only to open or closed.
      assert.equal(await value(db, "select public.set_class_status($1, 'KQ7M3P', 'closed') as result", ["00000000-0000-0000-0000-000000000000"]), null);
      assert.equal(await value(db, "select public.set_class_status($1, 'KQ7M3P', 'archived') as result", [teacher.id]), null);
      const closed = await value<{ status: string; closed_at: string | null }>(db, "select public.set_class_status($1, 'KQ7M3P', 'closed') as result", [teacher.id]);
      assert.equal(closed.status, "closed");
      assert.ok(closed.closed_at);
      const again = await value<{ closed_at: string }>(db, "select public.set_class_status($1, 'KQ7M3P', 'closed') as result", [teacher.id]);
      assert.equal(again.closed_at, closed.closed_at, "closing twice keeps the first close time");
      assert.deepEqual(await value(db, "select public.set_class_status($1, 'KQ7M3P', 'open') as result", [teacher.id]), { status: "open", closed_at: null });
      await value(db, "select public.set_class_status($1, 'KQ7M3P', 'closed') as result", [teacher.id]);
      assert.equal((await value<Row[]>(db, "select public.get_class_results('KQ7M3P', $1) as result", [H("2")])).length, 3, "results stay readable once closed");
    });

    // A closed class takes no more calls or runs.
    await asService(db, async () => {
      assert.deepEqual(
        await value(db, "select public.consume_class_quota('KQ7M3P', $1, '2026-11-02', 2, '2026-11-01', 100, 1000) as result", [H("2")]),
        { ok: false, reason: "closed" },
      );
      assert.deepEqual(await value(db, "select public.submit_class_runs('KQ7M3P', $1, '[]') as result", [H("2")]), { ok: false, reason: "closed" });
    });

    // Browser roles can't call any of it, or see a row.
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(() => db.query("select public.get_class('KQ7M3P')"), { code: "42501" });
        await assert.rejects(() => db.query("select * from public.class_runs"), { code: "42501" });
      } finally {
        await db.exec("reset role");
      }
    }
  } finally {
    await db.close();
  }
});

test("retention: a class closed over 90 days ago is purged with everything of its; nothing else is touched", async () => {
  const db = await fresh();
  try {
    await db.exec("insert into public.teacher_allowlist (email) values ('prof@uni.edu')");
    const ids: Record<string, { class_id: string; member_id: string }> = {};
    let teacherId = "";
    await asService(db, async () => {
      await db.query("select public.request_teacher_login('prof@uni.edu', $1, now() + interval '15 min')", [H("a")]);
      teacherId = (await value<{ id: string }>(db, "select public.verify_teacher_login($1) as result", [H("a")])).id;
      // Three classes, one student each, each with a metered call, a recorded call and a run.
      for (const [code, member] of [["KQ7M3P", H("1")], ["AC3479", H("2")], ["DEFHJK", H("3")]]) {
        await value(db, "select public.create_class($1, $2, 'A class', '{}', 100) as result", [teacherId, code]);
        await value(db, "select public.join_class($1, 'Ada', $2) as result", [code, member]);
        const q = await value<{ class_id: string; member_id: string }>(
          db,
          "select public.consume_class_quota($1, $2, '2026-11-02', 10, '2026-11-01', 100, 100000) as result",
          [code, member],
        );
        ids[code] = q;
        await db.query("select public.record_class_call($1, $2, 'run_1', 'm', $3, 'answer', 1, 1)", [q.class_id, q.member_id, H("f")]);
        await value(db, "select public.submit_class_runs($1, $2, $3) as result", [
          code,
          member,
          JSON.stringify([{ run_id: "run_1", condition_id: "c0", item_id: null, idx: 0, provider: "shape-free", model: "m", status: "done", text: "answer", scores: {}, recorded: true }]),
        ]);
      }
    });
    // KQ7M3P closed 91 days ago, AC3479 closed 89 days ago, DEFHJK still open. A visitor's counter too.
    await db.exec(`
      update public.classes set status = 'closed', closed_at = now() - interval '91 days' where code = 'KQ7M3P';
      update public.classes set status = 'closed', closed_at = now() - interval '89 days' where code = 'AC3479';
      insert into public.usage_daily (day, subject, calls) values ('2026-11-02', 'v:visitor', 4);
    `);

    assert.equal(await value(db, "select public.purge_closed_classes(now() - interval '90 days') as result"), 1);
    const count = (sql: string, args: unknown[] = []) => value<number>(db, `select count(*)::int as result from ${sql}`, args);
    assert.deepEqual((await db.query<{ code: string }>("select code from public.classes order by code")).rows.map((r) => r.code), ["AC3479", "DEFHJK"]);
    const gone = ids.KQ7M3P;
    assert.equal(await count("public.class_members where class_id = $1", [gone.class_id]), 0, "members cascade");
    assert.equal(await count("public.class_calls where class_id = $1", [gone.class_id]), 0, "recorded calls cascade");
    assert.equal(await count("public.class_runs where class_id = $1", [gone.class_id]), 0, "runs cascade");
    assert.equal(await count("public.usage_daily where subject in ($1, $2)", [`c:${gone.class_id}`, `m:${gone.member_id}`]), 0, "its counters go");
    for (const kept of [ids.AC3479, ids.DEFHJK]) {
      assert.equal(await count("public.class_runs where class_id = $1", [kept.class_id]), 1);
      assert.equal(await count("public.usage_daily where subject in ($1, $2)", [`c:${kept.class_id}`, `m:${kept.member_id}`]), 2);
    }
    assert.equal(await count("public.usage_daily where subject = 'v:visitor'"), 1, "other counters untouched");
    assert.equal(await value(db, "select public.purge_closed_classes(now() - interval '90 days') as result"), 0, "nothing left to purge");

    // Reopening clears the close time, so a reopened class is never purged.
    await asService(db, async () => {
      await value(db, "select public.set_class_status($1, 'AC3479', 'open') as result", [teacherId]);
    });
    assert.equal(await value(db, "select public.purge_closed_classes(now() + interval '1 year') as result"), 0);

    // Students can see when a closed class goes: get_class carries the close time.
    await asService(db, async () => {
      await value(db, "select public.set_class_status($1, 'DEFHJK', 'closed') as result", [teacherId]);
      const c = await value<{ status: string; closed_at: string | null }>(db, "select public.get_class('DEFHJK') as result");
      assert.equal(c.status, "closed");
      assert.ok(c.closed_at);
    });

    // Only the database's own job may purge: not the server, not the browser.
    for (const role of ["service_role", "anon", "authenticated"]) {
      assert.equal(
        await value(db, "select has_function_privilege($1, 'public.purge_closed_classes(timestamptz)', 'EXECUTE') as result", [role]),
        false,
        `${role} cannot purge`,
      );
    }
  } finally {
    await db.close();
  }
});
