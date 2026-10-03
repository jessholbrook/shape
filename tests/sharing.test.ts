/**
 * Sharing a lab experiment. Publishing, reading and deleting are tested
 * against a fake database: no network, no Supabase.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest, manifestHash, ranAtOf, starterExperiment, type Experiment } from "../lib/experiment";
import {
  SLUG_LENGTH,
  forkExperiment,
  isDeleteToken,
  isSlug,
  newDeleteToken,
  newSlug,
  prepareForSharing,
  readShareConfig,
  sha256Hex,
  shareUrl,
  validateShareRequest,
  type ShareConfig,
} from "../lib/sharing";
import { createDeleteHandler, createPublishHandler, createShareStatusHandler, loadShared } from "../lib/server/share-handler";
import type { Rpc } from "../lib/server/supabase";

const ENV = {
  SHAPE_SHARING: "on",
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  QUOTA_HASH_SECRET: "pepper",
};
const ON = readShareConfig(ENV) as Extract<ShareConfig, { enabled: true }>;
const OFF = readShareConfig({});
const ORIGIN = "https://shape-models.com";
const NOW = () => new Date("2026-10-04T12:00:00Z");

let ipCounter = 0;
/** Each request from its own address, so the per-instance burst limit stays out of the way. */
function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ipCounter}`, ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeRpc(answers: Record<string, unknown | Error>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return a as T;
  };
  return { rpc, calls };
}

function experiment(): Experiment {
  const e = starterExperiment({ provider: "anthropic", model: "claude-haiku-4-5" }, 1_700_000_000_000);
  const [c0] = e.conditions;
  return {
    ...e,
    title: "Does it agree with me?",
    hypothesisLockedAt: 1_700_000_000_500,
    runs: [
      { id: "r1", conditionId: c0.id, itemId: e.items[0]?.id ?? null, index: 0, status: "done", text: "An answer.", requestedModel: "claude-haiku-4-5", scores: {}, startedAt: 1_700_000_001_000 },
      { id: "r2", conditionId: c0.id, itemId: e.items[0]?.id ?? null, index: 1, status: "running", text: "Half an", requestedModel: "claude-haiku-4-5", scores: {} },
    ],
  };
}

// --- Config, links -------------------------------------------------------------------

test("config: off unless switched on with the database settings; daily limit defaults to 20", () => {
  assert.equal(OFF.enabled, false);
  assert.equal(readShareConfig({ ...ENV, SHAPE_SHARING: "true" }).enabled, false);
  const missing = readShareConfig({ ...ENV, QUOTA_HASH_SECRET: "" });
  assert.ok(!missing.enabled && missing.reason === "missing QUOTA_HASH_SECRET");
  assert.ok(ON.enabled);
  assert.equal(ON.dailyPublishes, 20);
  assert.equal(ON.supabaseUrl, "https://example.supabase.co");
  const custom = readShareConfig({ ...ENV, SHAPE_SHARING: " On ", SHARE_DAILY_LIMIT: "5" });
  assert.ok(custom.enabled && custom.dailyPublishes === 5);
});

test("links: slugs are 10 unambiguous base58 characters, tokens 32 hex; both validated", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const s = newSlug();
    assert.equal(s.length, SLUG_LENGTH);
    assert.ok(isSlug(s), s);
    assert.ok(!/[0OIl]/.test(s));
    seen.add(s);
  }
  assert.equal(seen.size, 200);
  // Bytes at or above 232 are rejected, not folded onto the start of the alphabet.
  let calls = 0;
  const skewed = (n: number) => new Uint8Array(n).fill(calls++ === 0 ? 255 : 0);
  assert.equal(newSlug(skewed), "1111111111");
  assert.ok(isDeleteToken(newDeleteToken()));
  for (const bad of ["", "abc", "1111111111/", "0000000000", "../../etc", 42]) assert.ok(!isSlug(bad), String(bad));
  assert.equal(shareUrl("https://shape-models.com/", "abcDEF2345"), "https://shape-models.com/e/abcDEF2345");
});

// --- What gets published ----------------------------------------------------------------

test("publish request: only finished runs go out; title and question are required", () => {
  const e = experiment();
  assert.deepEqual(prepareForSharing(e).runs.map((r) => r.id), ["r1"]);
  const ok = validateShareRequest({ experiment: e, runner: "byok" });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.request.experiment.runs.length, 1);
  assert.ok(!validateShareRequest({ experiment: e, runner: "magic" }).ok);
  assert.ok(!validateShareRequest({ experiment: { ...e, title: "  " }, runner: "byok" }).ok);
  assert.ok(!validateShareRequest({ experiment: { ...e, question: "" }, runner: "byok" }).ok);
  assert.ok(!validateShareRequest({ experiment: { ...e, lens: "astrology" }, runner: "byok" }).ok);
  assert.ok(!validateShareRequest({ experiment: { title: "x" }, runner: "byok" }).ok);
  // A design with no runs can be shared.
  assert.ok(validateShareRequest({ experiment: { ...e, runs: [] }, runner: "webllm" }).ok);
});

test("fork: same design, no runs, hypothesis open again, pointer to the original", () => {
  const e = experiment();
  const f = forkExperiment({ slug: "abcDEF2345", manifestHash: "f".repeat(64), experiment: e }, 1_800_000_000_000);
  assert.notEqual(f.id, e.id);
  assert.equal(f.title, "Does it agree with me? (rerun)");
  assert.deepEqual(f.runs, []);
  assert.equal(f.hypothesisLockedAt, undefined);
  assert.deepEqual(f.forkedFrom, { slug: "abcDEF2345", manifestHash: "f".repeat(64) });
  assert.deepEqual(f.conditions, e.conditions);
  assert.deepEqual(f.measures, e.measures);
  assert.equal(forkExperiment({ slug: "abcDEF2345", manifestHash: "x", experiment: f }, 1).title, f.title);
});

// --- Publish handler ---------------------------------------------------------------------

test("publish: off, cross-origin, oversized and invalid requests are refused before the database", async () => {
  const { rpc, calls } = fakeRpc({ publish_experiment: { ok: true } });
  const off = await createPublishHandler({ config: OFF, rpc: null })(req("POST", "/api/share", { experiment: experiment(), runner: "byok" }));
  assert.equal(off.status, 503);
  const h = createPublishHandler({ config: ON, rpc, now: NOW });
  assert.equal((await h(req("POST", "/api/share", { experiment: experiment(), runner: "byok" }, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await h(req("POST", "/api/share", "x".repeat(1_000_001)))).status, 413);
  assert.equal((await h(req("POST", "/api/share", "{nope"))).status, 400);
  const bad = await h(req("POST", "/api/share", { experiment: { ...experiment(), title: "" }, runner: "byok" }));
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error.message, /title/);
  assert.equal(calls.length, 0);
});

test("publish: stores a server-built manifest, a hashed delete token and a hashed network; returns the token once", async () => {
  const { rpc, calls } = fakeRpc({ publish_experiment: { ok: true } });
  const res = await createPublishHandler({ config: ON, rpc, now: NOW, appVersion: "abc123" })(
    req("POST", "/api/share", { experiment: experiment(), runner: "hosted" }),
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(isSlug(body.slug));
  assert.ok(isDeleteToken(body.deleteToken));

  assert.equal(calls.length, 1);
  const a = calls[0].args;
  assert.equal(a.p_slug, body.slug);
  assert.equal(a.p_title, "Does it agree with me?");
  assert.equal(a.p_delete_hash, await sha256Hex(body.deleteToken));
  assert.notEqual(a.p_delete_hash, body.deleteToken);
  assert.match(String(a.p_network), /^p:[0-9a-f]{64}$/);
  assert.ok(!String(a.p_network).includes("198.51.100"));
  assert.equal(a.p_day, "2026-10-04");
  assert.equal(a.p_limit, 20);

  // The stored experiment is the prepared one; the manifest is rebuilt from it, not taken from the client.
  const stored = a.p_experiment as Experiment;
  assert.deepEqual(stored.runs.map((r) => r.id), ["r1"]);
  const expected = buildManifest(stored, { appVersion: "abc123", ranAt: ranAtOf(stored), runner: "hosted" });
  assert.deepEqual(a.p_manifest, expected);
  assert.equal(a.p_hash, await manifestHash(expected));
  assert.equal(body.manifestHash, a.p_hash);
});

test("publish: the daily network limit is a 429; an unreachable database is a 503", async () => {
  const limited = await createPublishHandler({ config: ON, rpc: fakeRpc({ publish_experiment: { ok: false, reason: "limit" } }).rpc, now: NOW })(
    req("POST", "/api/share", { experiment: experiment(), runner: "byok" }),
  );
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error.message, /20 experiments today/);

  const down = await createPublishHandler({ config: ON, rpc: fakeRpc({ publish_experiment: new Error("paused") }).rpc, now: NOW })(
    req("POST", "/api/share", { experiment: experiment(), runner: "byok" }),
  );
  assert.equal(down.status, 503);
});

// --- Delete, load, status --------------------------------------------------------------------

test("delete: needs the token; sends only its hash; 204 when deleted, 404 when not", async () => {
  const token = newDeleteToken();
  const { rpc, calls } = fakeRpc({ delete_shared_experiment: true });
  const del = createDeleteHandler({ config: ON, rpc });
  const ok = await del(req("DELETE", "/api/share/abcDEF2345", undefined, { "x-delete-token": token }), "abcDEF2345");
  assert.equal(ok.status, 204);
  assert.deepEqual(calls[0].args, { p_slug: "abcDEF2345", p_delete_hash: await sha256Hex(token) });

  assert.equal((await del(req("DELETE", "/api/share/abcDEF2345"), "abcDEF2345")).status, 404);
  assert.equal((await del(req("DELETE", "/api/share/x", undefined, { "x-delete-token": token }), "../x")).status, 404);
  assert.equal(calls.length, 1);

  const gone = createDeleteHandler({ config: ON, rpc: fakeRpc({ delete_shared_experiment: false }).rpc });
  assert.equal((await gone(req("DELETE", "/api/share/abcDEF2345", undefined, { "x-delete-token": token }), "abcDEF2345")).status, 404);
  const cross = await del(req("DELETE", "/api/share/abcDEF2345", undefined, { "x-delete-token": token, origin: "https://evil.example" }), "abcDEF2345");
  assert.equal(cross.status, 403);
});

test("load: tells missing from unavailable, and re-validates what's stored", async () => {
  const e = prepareForSharing(experiment());
  const manifest = buildManifest(e, { appVersion: "x", ranAt: ranAtOf(e), runner: "byok" });
  const row = { slug: "abcDEF2345", title: e.title, lens: "policy", experiment: e, manifest, manifest_hash: "a".repeat(64), created_at: "2026-10-04T12:00:00Z" };

  const ok = await loadShared({ config: ON, rpc: fakeRpc({ get_shared_experiment: row }).rpc }, "abcDEF2345");
  assert.equal(ok.status, "ok");
  if (ok.status === "ok") {
    assert.equal(ok.shared.title, e.title);
    assert.equal(ok.shared.lens, "policy");
    assert.equal(ok.shared.manifestHash, "a".repeat(64));
  }
  assert.equal((await loadShared({ config: ON, rpc: fakeRpc({ get_shared_experiment: null }).rpc }, "abcDEF2345")).status, "missing");
  assert.equal((await loadShared({ config: ON, rpc: fakeRpc({}).rpc }, "not-a-slug")).status, "missing");
  assert.equal((await loadShared({ config: ON, rpc: fakeRpc({ get_shared_experiment: new Error("paused") }).rpc }, "abcDEF2345")).status, "unavailable");
  assert.equal((await loadShared({ config: OFF, rpc: null }, "abcDEF2345")).status, "unavailable");
  const corrupt = await loadShared({ config: ON, rpc: fakeRpc({ get_shared_experiment: { ...row, experiment: { title: 1 } } }).rpc }, "abcDEF2345");
  assert.equal(corrupt.status, "missing");
});

test("status: reports whether sharing is on", async () => {
  assert.deepEqual(await (await createShareStatusHandler({ config: ON })()).json(), { enabled: true });
  assert.deepEqual(await (await createShareStatusHandler({ config: OFF })()).json(), { enabled: false });
});
