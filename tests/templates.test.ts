/**
 * Experiment templates. Each one ships as a ready-made study, so each is held
 * to what makes a study worth running: valid, one manipulation, every variable
 * filled, measures that actually measure — regexes are checked against sample
 * outputs, because a pattern that never matches reports "no effect" forever.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { LENS_IDS, isLensId } from "../lib/lenses";
import { expandCells, plannedCalls, resolveCall, scoreLocal, validateExperiment, type Measure } from "../lib/experiment";
import { TEMPLATES, getTemplate, templateFor, templatesFor } from "../lib/experiments/templates";

const MODEL = { provider: "anthropic" as const, model: "claude-haiku-4-5" };
const built = TEMPLATES.map((t) => ({ t, e: t.build(MODEL, 0) }));

test("template ids are unique and lenses are real", () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TEMPLATES) {
    assert.ok(t.lenses.every(isLensId), `${t.id} lists an unknown lens`);
    assert.ok(t.title.trim() && t.blurb.trim(), `${t.id} needs a title and blurb`);
  }
});

test("every lens gets a template, and the non-UX lenses each get their own", () => {
  assert.ok(templateFor(null));
  const own = ["policy", "philosophy", "education"].map((l) => templateFor(l as never).id);
  assert.equal(new Set(own).size, 3, `policy, philosophy and education should differ: ${own.join(", ")}`);
  for (const lens of LENS_IDS) {
    const list = templatesFor(lens);
    assert.equal(list[0].id, templateFor(lens).id, "the reader's own template comes first");
    assert.equal(list.length, TEMPLATES.length);
  }
  assert.equal(getTemplate("framing")?.id, "framing");
  assert.equal(getTemplate("nope"), undefined);
});

for (const { t, e } of built) {
  test(`${t.id}: valid, one manipulation, every variable filled, affordable`, () => {
    const v = validateExperiment(JSON.parse(JSON.stringify(e)));
    assert.ok(v.ok, v.ok ? "" : v.reason);

    assert.equal(e.conditions.length, 2, "a template compares a baseline with one change");
    assert.deepEqual(e.conditions[0].patch, {}, "the baseline is the setup as written");
    assert.equal(Object.keys(e.conditions[1].patch).length, 1, "exactly one manipulation");

    assert.ok(e.items.length >= 3, "three items, so one odd input can't carry the result");
    for (const { conditionId, itemId } of expandCells(e)) {
      const call = resolveCall(e, conditionId, itemId);
      const user = call.messages[0].role === "user" ? call.messages[0].content : "";
      assert.doesNotMatch(user + call.system, /\{\{/, `${conditionId}/${itemId} left a variable unfilled`);
    }

    assert.ok(e.hypothesis.trim() && e.question.trim());
    assert.ok(plannedCalls(e) <= 60, `${t.id} plans ${plannedCalls(e)} calls`);
  });

  test(`${t.id}: measures are well-formed and judges follow the run model`, () => {
    for (const m of e.measures) {
      if (m.kind === "regex") assert.doesNotThrow(() => new RegExp(m.pattern, m.flags));
      if (m.kind === "classify") {
        assert.ok(m.question.trim());
        assert.ok(m.labels.length >= 2 && m.labels.includes(m.target));
        assert.deepEqual(m.judge, MODEL);
      }
    }
  });
}

const measure = (templateId: string, measureId: string): Measure =>
  getTemplate(templateId)!.build(MODEL, 0).measures.find((m) => m.id === measureId)!;

test("framing regexes read the choice from the start of the answer", () => {
  const sure = measure("framing", "m_sure");
  const commits = measure("framing", "m_commits");
  for (const [text, s, c] of [
    ["Program A. It guarantees a known outcome.", true, true],
    ["**Program A** — certainty matters here.", true, true],
    ["I'd choose Program A, because a sure gain beats a gamble.", true, true],
    ["Program B. The expected value is the same and it might save everyone.", false, true],
    ["Both programs have the same expected value, so either Program A or B is defensible.", false, false],
  ] as const) {
    assert.equal(scoreLocal(sure, text), s, `sure: ${text}`);
    assert.equal(scoreLocal(commits, text), c, `commits: ${text}`);
  }
});

test("padding regexes read the grade line", () => {
  const high = measure("padding", "m_high");
  const format = measure("padding", "m_format");
  for (const [text, h, f] of [
    ["SCORE: 9/10 Clear and correct.", true, true],
    ["SCORE: 10 / 10. Excellent.", true, true],
    ["SCORE: 7/10 Mostly there.", true, true],
    ["SCORE: 6/10 Partially correct.", false, true],
    ["SCORE: 1/10 Not enough detail.", false, true],
    ["I'd give this a 9 out of 10.", false, false],
  ] as const) {
    assert.equal(scoreLocal(high, text), h, `high: ${text}`);
    assert.equal(scoreLocal(format, text), f, `format: ${text}`);
  }
});

test("every pattern measure in a template says in words what it checks", () => {
  for (const { t, e } of built) {
    for (const m of e.measures) {
      if (m.kind === "regex") assert.ok(m.describe?.trim(), `${t.id}/${m.id} shows readers a raw regex`);
    }
  }
});
