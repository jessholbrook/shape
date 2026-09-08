/**
 * Content-consistency checks.
 *
 * These assert that the hand-maintained content data agrees with what is
 * actually on disk. Every failure this file can produce has already shipped to
 * production at least once: a sitemap that listed half the playgrounds, two
 * pages numbered 07, a lesson count in prose that nobody updated when lessons
 * landed. None of it is caught by lint, types, or a build — the code is
 * perfectly valid, it just says something untrue.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { MODULES, moduleTitle } from "../lib/curriculum";
import { PLAYGROUNDS } from "../lib/playgrounds";
import sitemap from "../app/sitemap";

const ROOT = join(import.meta.dirname, "..");
const dirsIn = (p: string) =>
  readdirSync(join(ROOT, p), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

/** Lessons are every module except the setup entry, which lives at /start. */
const LESSONS = MODULES.filter((m) => m.slug !== "start");

test("every ready lesson has a page on disk", () => {
  for (const m of LESSONS.filter((m) => m.status === "ready")) {
    assert.ok(
      existsSync(join(ROOT, "app", m.href, "page.tsx")),
      `${m.slug}: curriculum says ready but app${m.href}/page.tsx is missing`,
    );
  }
});

test("every lesson page on disk has a curriculum entry", () => {
  for (const dir of dirsIn("app/learn")) {
    assert.ok(
      MODULES.some((m) => m.slug === dir),
      `app/learn/${dir} has no entry in MODULES`,
    );
  }
});

test("every playground href resolves to a route", () => {
  for (const p of PLAYGROUNDS) {
    const dir = p.href.replace(/^\/play\//, "");
    assert.ok(
      existsSync(join(ROOT, "app/play", dir, "page.tsx")),
      `${p.href} has no page at app/play/${dir}/page.tsx`,
    );
  }
});

test("every play route on disk is listed on the index", () => {
  for (const dir of dirsIn("app/play")) {
    assert.ok(
      PLAYGROUNDS.some((p) => p.href === `/play/${dir}`),
      `app/play/${dir} exists but is not in PLAYGROUNDS — it is unreachable from /play and absent from the sitemap`,
    );
  }
});

test("every module's paired playground exists", () => {
  for (const m of MODULES) {
    if (!m.playground) continue;
    const href = m.playground.href;
    if (!href.startsWith("/play/")) continue;
    assert.ok(
      PLAYGROUNDS.some((p) => p.href === href),
      `${m.slug} pairs with ${href}, which is not a registered playground`,
    );
  }
});

test("playground numbers are unique and sequential", () => {
  const nums = PLAYGROUNDS.map((p) => p.num);
  assert.deepEqual(
    nums,
    PLAYGROUNDS.map((_, i) => String(i + 1).padStart(2, "0")),
    "PLAYGROUNDS nums should run 01..N in list order",
  );
});

test("each play page's section number matches its index card", () => {
  for (const p of PLAYGROUNDS) {
    const dir = p.href.replace(/^\/play\//, "");
    const src = readFileSync(join(ROOT, "app/play", dir, "page.tsx"), "utf8");
    const found = src.match(/<SectionNumber>(\d+)<\/SectionNumber>/);
    assert.ok(found, `${p.href}: no <SectionNumber> on the page`);
    assert.equal(
      found[1],
      p.num,
      `${p.href}: page shows ${found[1]}, index card says ${p.num}`,
    );
  }
});

test("sitemap covers every ready lesson and playground", () => {
  const urls = new Set(sitemap().map((e) => new URL(e.url).pathname));
  for (const m of LESSONS.filter((m) => m.status === "ready")) {
    assert.ok(urls.has(m.href), `sitemap is missing ${m.href}`);
  }
  for (const p of PLAYGROUNDS.filter((p) => p.status === "ready")) {
    assert.ok(urls.has(p.href), `sitemap is missing ${p.href}`);
  }
});

test("lesson pages derive their metadata from the curriculum", () => {
  // Hand-written title/description strings drift from the curriculum entry the
  // moment either is edited; three of eleven had already diverged.
  for (const dir of dirsIn("app/learn")) {
    const src = readFileSync(join(ROOT, "app/learn", dir, "page.tsx"), "utf8");
    assert.match(
      src,
      /export const metadata = moduleMetadata\(SLUG\);/,
      `app/learn/${dir}: metadata should be moduleMetadata(SLUG), not a hand-written literal`,
    );
  }
});

test("the /learn blurb states the real lesson count", () => {
  const WORDS = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  ];
  const readable = LESSONS.filter((m) => m.status === "ready").length;
  const src = readFileSync(join(ROOT, "app/learn/page.tsx"), "utf8");
  const stated = src.match(/(\w+) micro-lessons/);
  assert.ok(stated, "/learn no longer states a lesson count");
  assert.equal(
    stated[1],
    WORDS[readable],
    `/learn says "${stated[1]} micro-lessons" but ${readable} are live`,
  );
});

test("module titles round-trip to their display form", () => {
  assert.equal(moduleTitle(MODULES.find((m) => m.slug === "voice-and-tone")!), "Voice & tone");
  assert.equal(moduleTitle(MODULES.find((m) => m.slug === "evaluation")!), "Evaluation");
});

// --- README ----------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

const readme = () => readFileSync(join(ROOT, "README.md"), "utf8");

test("README's lesson and playground counts match the registries", () => {
  // The intro said "seven lessons" and "six playgrounds" for months after
  // there were eleven and twelve. Prose counts drift exactly like the
  // hand-kept lists this file already checks.
  const src = readme();
  const lessons = src.match(/`\/learn`\*\* — (\w+) short concept lessons/);
  const plays = src.match(/`\/play`\*\* — (\w+) focused playgrounds/);
  assert.ok(lessons, "README intro: no '/learn — <n> short concept lessons' line");
  assert.ok(plays, "README intro: no '/play — <n> focused playgrounds' line");
  assert.equal(NUMBER_WORDS[lessons[1]], LESSONS.length, `README says ${lessons[1]} lessons`);
  assert.equal(NUMBER_WORDS[plays[1]], PLAYGROUNDS.length, `README says ${plays[1]} playgrounds`);
});

test("README's playground table has one row per registered playground", () => {
  const src = readme();
  const table = src.match(/\| Playground \| What it teaches \| Artifact \|\n\|---\|---\|---\|\n((?:\|.*\|\n)+)/);
  assert.ok(table, "README: playground table not found");
  const titles = [...table[1].matchAll(/^\| \*\*(.+?)\*\* \|/gm)].map((m) => m[1]);
  const expected = PLAYGROUNDS.map((p) => `${p.title} ${p.italic}`.replace(/\s+/g, " ").trim());
  assert.deepEqual(titles, expected);
});

test("README's curriculum table has one row per lesson", () => {
  const src = readme();
  const table = src.match(/\| # \| Lesson \| Pairs with \|\n\|---\|---\|---\|\n((?:\|.*\|\n)+)/);
  assert.ok(table, "README: curriculum table not found");
  const nums = [...table[1].matchAll(/^\| (\d+) \|/gm)].map((m) => m[1]);
  assert.deepEqual(nums, LESSONS.map((m) => m.num));
});
