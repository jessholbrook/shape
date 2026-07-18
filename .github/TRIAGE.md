# Feedback triage — a "software factory" first step

A sketch of the **triage stage** from the [cloud-factory](https://github.com/warpdotdev-demos/cloud-factory-demo)
pattern, scaled down for a solo-maintained repo. It is deliberately the *only*
stage we automate for now: the highest-leverage, lowest-risk slice.

## What it does

When a new feedback issue lands (in-app Feedback button → Linear → synced to a
GitHub issue titled `[Feedback] / [Bug] / [Idea] …`), a GitHub Action runs a
Claude agent that **reads, classifies, and comments — nothing else**. Concretely:

1. **Classify** the issue — kind (bug / idea / question / praise), the surface
   it's about (from the `URL:` line in the body), and rough severity.
2. **Apply labels** from a small fixed set (below).
3. **Check for recurrence** — read `BACKLOG.md` and search open/recent issues.
   If it echoes a parked theme (e.g. the "reverse mode" or "readability" threads)
   or duplicates an open issue, apply `recurring` and say so.
4. **Post one triage comment** — a 3–4 line summary: classification, recurrence,
   and a *suggested* disposition (build / park / needs-info / skip). The human
   still decides.

## What it must NOT do (safety rails)

- Never modify code, open PRs, or push commits.
- Never close, edit, or reassign issues.
- Never post more than one comment per run.

Triage is advisory. Every build/park/merge decision stays with a human — exactly
where it's stayed all along; this just does the "read every screenshot, is this
new?" pre-sort automatically.

## Label taxonomy (create these once)

**Kind:** `bug` · `idea` · `question` · `praise`
**Surface:** `area:home` · `area:learn` · `area:play` · `area:keys` · `area:notebook` · `area:infra`
**Signal:** `recurring` · `needs-info` · `good-first-build`

Keep it lean — resist adding labels the human won't filter on.

## Why only triage (and not the full 6-stage factory)

The factory (triage → spec → implement → review → verify → monitor) earns its
keep at team scale and high issue volume. Shape is one maintainer and a trickle
of feedback, and this session showed the hard parts — live-key testing of
provider integrations, taste calls on copy/design — are the human-gated bits a
factory keeps manual anyway. Automating the glue around a mostly-manual core is
low ROI. Triage is the exception: it's the one stage that scales with volume and
removes real load, as a single skill rather than a pipeline.

The natural next piece — if volume ever justifies it — is the factory's **outer
loop**: a weekly digest that re-reads accumulated feedback, surfaces recurring
themes, and nominates `BACKLOG.md` promotions. That's where patterns like
"inversion mode, three times" would pop automatically.

## Setup (before enabling)

1. Create the labels above (once).
2. Add repo secret `ANTHROPIC_API_KEY`.
3. Confirm the action version + input names in
   `.github/workflows/triage-feedback.yml` against the current
   `anthropics/claude-code-action` docs — the workflow encodes the *design*
   (trigger, permissions, prompt, rails); the exact input surface for that
   action drifts and should be verified before first run.
4. The workflow only reacts to titles starting with `[Feedback]` / `[Bug]` /
   `[Idea]`, so it won't touch normal engineering issues.

This is a proposal to review, not an enabled pipeline — without the secret the
workflow is inert.
