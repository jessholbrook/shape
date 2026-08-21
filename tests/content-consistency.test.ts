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
