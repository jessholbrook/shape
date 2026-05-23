# Shape — scaffold session

## Plan

- [x] Scaffold Next.js (TS, Tailwind v4, App Router, ESLint, Turbopack)
- [x] Fonts wired (Fraunces opsz+SOFT, Inter, Geist Mono)
- [x] Design tokens + Tailwind `@theme inline` aliases
- [x] Primitives: `<Shell>`, `<SectionNumber>`, `<ShapeMark>`
- [x] Homepage (hero / bridge / how-it-works)
- [x] Left sidebar nav (240px) replacing bottom pill nav
- [x] BYOK foundation: providers metadata, key CRUD, `useKeys`, KeySetupForm, /settings/keys, CostMeter
- [x] Diff Mode v0.1:
  - [x] `lib/providers/sse.ts` — small SSE reader over fetch streams
  - [x] `lib/providers/anthropic.ts` — direct browser fetch (with `anthropic-dangerous-direct-browser-access` header)
  - [x] `lib/providers/openai.ts` — proxied through `/api/proxy/openai`
  - [x] `lib/providers/index.ts` — `runChat()` dispatch + `testConnection()`
  - [x] `lib/usage.ts` — record + summarize calls in localStorage with pricing table
  - [x] `lib/hooks/use-usage.ts` — reactive hook
  - [x] CostMeter shows real `$X.XX` and per-provider activity bars
  - [x] Test connection button on KeySetupForm
  - [x] `components/play/config-panel.tsx`, `components/play/output-panel.tsx`
  - [x] `app/play/diff/page.tsx` + client `diff-mode.tsx`
  - [x] `app/api/proxy/openai/route.ts` — Edge proxy, no logging
- [x] End-to-end verification: fake keys → both providers surface 401s cleanly through the streaming pipeline.
- [x] BYOK reassurance copy updated to honestly reflect the OpenAI proxy.
- [x] SPEC.md updated with provider transport note.

## Review

Diff Mode v0.1 functional. Streams from both providers in parallel, records token usage + cost on `done` events, errors render in the output panel with clear messages, CostMeter updates live via custom events. Edge proxy for OpenAI is privacy-aligned with the BYOK promise — key forwarded in memory only, no logging.

Pivot mid-session: dropped the Anthropic/OpenAI SDKs in favor of direct `fetch()` + SSE because the Anthropic SDK pulls in Node-only `fs` modules that Turbopack can't bundle for the client. Net win — smaller bundle, fewer dependencies.

### Known follow-ups (non-blocking)

- Real key smoke-test (with a live key) to confirm streaming token deltas render correctly.
- Diff highlighting (word-level diff between A and B) once Diff Mode has multi-turn history.
- Save Diff Log as artifact → public URL → PDF export (needs Supabase wiring).
- Mobile drawer for the left nav (currently a top bar at <md).
- Hero italic "model" — final letterspacing pass.
- `.hatched` utility still unused; will land on empty-state surfaces.

## Tone Dial v0.1 (this session)

- [x] `lib/tone.ts` — 5 dimensions × 5 stops + `composeSystemPrompt`/`composeToneBlock`
- [x] `components/play/tone-dial-controls.tsx` — discrete-stop dial UI with chip labels
- [x] `app/play/tone/page.tsx` + `tone-dial.tsx` — brief + dials + composed-prompt preview + stream output
- [x] `app/play/page.tsx` — playground index (Diff Mode + Tone Dial open; Persona + Refusal as "soon")
- [x] Browser-verified: dials update the composed prompt live, no-key banner shows, all routes 200

### Review

The lesson — "style as a design token" — lands clearly because the dial → instruction-line mapping is visible in real time. Moving Warmth to Personal literally writes a new line under `Tone:` in the composed prompt; that's the whole pedagogical move. Five dimensions × five stops is enough to feel combinatorial without overwhelming.

Reused the existing `OutputPanel` and provider stack — the only new infrastructure is the tone composer. The playground index also unblocks the left-nav "Play" item, which would have 404'd.

### Known follow-ups (non-blocking)

- Save as Behavior Spec artifact — needs the Supabase wiring still pending from Diff Mode.
- "Sweep" mode: hold the brief constant, run all five stops of one dimension, render side-by-side. Would visualize the gradient.
- Custom dimensions: let advanced users add their own (e.g. "formality", "specificity-to-domain").
- Keyboard nav on the dial tracks (arrow keys).

## Onboarding polish (this session)

- [x] `app/start/page.tsx` + `start-flow.tsx` — Module 0 page with two reactive states (needs-key vs. has-key) driven by `useKeys()`
- [x] Needs-key state: provider picker (Anthropic recommended) → key input → Save & test (uses existing `testConnection`)
- [x] Has-key state: "Connected via X" pill + "You're ready to shape" + playground cards (Diff Mode, Tone Dial) + manage-keys link + optional "add the other provider" nudge
- [x] Homepage "Start shaping" CTA routed `/play/diff` → `/start`
- [x] Browser-verified: no-key picker switches Anthropic↔OpenAI live, invalid keys surface validation errors, injecting a key reactively swaps to the success state via `shape:keys-changed` event, all routes 200

### Review

The fix is small but load-bearing: before this, a first-time visitor clicking "Start shaping" landed on Diff Mode with a "missing key" banner — friction at the worst possible moment. Now they land on a page literally titled "Bring your key" with a one-step setup and an obvious next destination. Existing users skip straight to the playground picker because the page is state-aware.

Notable simplifications: the new page reuses `useKeys`, `validateKey`, and `testConnection` — no new infrastructure. The `/settings/keys` page remains as the deeper management surface; `/start` is the funnel.

### Known follow-ups (non-blocking)

- "Try a free sample" mode that uses a server-side pooled key for the first run — would let people experience Diff Mode before getting a key. (Spec §12.)
- Welcome step before provider picker, with a 30-second pitch on why BYOK. Currently the page assumes the visitor already understands the framing.
- Cookie/local flag to remember they've completed Module 0, so "Start shaping" can short-circuit to /play on subsequent visits.
- Mobile sticky CTA on long pages.

## Notebook + drafts (this session)

- [x] `lib/drafts.ts` — Draft union (DiffDraft + ToneDraft), localStorage CRUD, event bus, suggestTitle helper
- [x] `lib/hooks/use-drafts.ts` — reactive hook on `shape:drafts-changed`
- [x] `components/play/draft-save-bar.tsx` — shared Save bar with title input, status, "Editing draft" indicator, link to Notebook
- [x] Diff Mode: wired Save draft + `?draft=<id>` hydration on mount
- [x] Tone Dial: same pattern (brief + tone values + provider/model/temperature + last output)
- [x] `app/notebook/page.tsx` + `notebook.tsx` — grouped lists (Diff sessions / Tone setups), Open + Delete actions, hatched empty state with CTAs into both playgrounds
- [x] Browser-verified: save → reopen hydrates state correctly, "Save changes" updates in-place (no duplicate), delete reactively removes from notebook, all 7 routes return 200

### Review

This was the spec's missing v0.1 piece. Before, every playground run was ephemeral — close the tab and you lost the prompt you'd been tuning. Now anything worth keeping has a Save action; the Notebook reads localStorage and groups drafts by type. The "Editing draft" indicator and URL `?draft=<id>` round-trip make it feel like real persistence, not a one-shot save.

Architecturally it sets up cleanly for Supabase: the Draft schema is roughly what Supabase rows will store; the Notebook view is roughly what `/u/<handle>` will look like. The only meaningful new dependency was a shared `DraftSaveBar` — keeps both playgrounds tidy without abstracting too early.

Caught one real bug while wiring this: setState calls fired synchronously in JS-driven tests share a stale closure (clicking two tone dials in one IIFE only applies the second). Not a real-user bug — sequential clicks process through React's render cycle normally — but worth remembering for future automation.

### Known follow-ups (non-blocking)

- Diff Mode currently saves the last user message + last outputs — could store a full multi-turn history once Diff Mode supports it.
- No undo for delete. Could swap `confirm()` for a soft-delete with an in-page undo toast.
- Notebook could surface usage cost per draft (we already record usage; just need to join by timestamp).
- "Duplicate draft" action — useful for forking.
- Export draft to JSON — small step, sets up the portable JSON export from the spec.

## Diff Mode multi-turn (this session)

- [x] `lib/drafts.ts` — DiffDraft schema now carries `turns: DiffTurn[]`, with per-turn outputs that retain text + status + token counts + cost + timing. Legacy single-shot drafts (`lastUserMessage`/`lastOutputA`/`lastOutputB`) migrated on read.
- [x] `components/play/turn-row.tsx` — compact session-log row with user-message header, side-by-side outputs, status dot, token/cost/elapsed summary, per-turn Delete
- [x] `app/play/diff/diff-mode.tsx` — refactored to multi-turn: Run appends a new turn instead of replacing output; streaming targets a turn by id; "Clear session" / per-turn Delete; input label flips to "Next turn" after the first run
- [x] `app/notebook/notebook.tsx` — diff summary now shows "N turns" + last message instead of a single message
- [x] Browser-verified: empty state, seeded 2-turn draft hydrates with both turns and all token/cost metadata, "Editing draft" indicator visible, "Run next turn" label correct, legacy draft migration produces a clean single-turn session log, all 7 routes 200

### Review

Diff Mode is now actually a *diff session* — keep iterating on the same configs, watch the log build up, then save the whole thing. This closes the gap with the SPEC §10 acceptance criteria (the artifact spec calls for a multi-turn `turns[]` array, which is exactly what we now store).

The TurnRow component is intentionally lighter than OutputPanel — when you have 4+ turns on screen, full-height OutputPanels would dominate. Each turn is dense but readable. Status dot + truncated user message in the row header keeps the log scannable.

The single tricky bit was making sure streaming updates the right turn. Solved with a `(turnId, which, updater) → setTurns(...)` helper that finds the turn by id and updates only the targeted output. Updates by id rather than index, so per-turn Delete during a stream wouldn't desync the writer (though in practice Delete is disabled while running).

### Known follow-ups (non-blocking)

- Per-turn notes/annotations — SPEC §10 mentions notes; would slot cleanly into `DiffTurn.note?: string`.
- Word-level diff highlighting between A and B outputs (mentioned in original SPEC §10).
- Streaming token deltas to the live turn need a real-key smoke test — pattern is identical to the single-shot version, just targeting nested state.
- Optional: a "fork from turn N" action that creates a new draft branching from a specific turn.
- Auto-scroll to the latest turn after Run.

## Per-turn notes + word-level diff highlighting (this session)

- [x] `DiffTurn.note?: string` added to schema (lib/drafts.ts)
- [x] `lib/diff-words.ts` — LCS-based word-level diff utility; no deps; returns paired left/right segments with `same | removed | added` kinds
- [x] `components/play/turn-row.tsx` — per-turn note editor (Add → textarea with Save/Cancel/Clear; rendered note with Edit affordance) and `highlightDiff` mode that renders outputs as colored segments
- [x] `app/play/diff/diff-mode.tsx` — "Highlight diffs" checkbox in the session-log header; `updateTurnNote` wiring per turn
- [x] `app/notebook/notebook.tsx` — diff summary shows "N notes" alongside turn count when any turn has a note
- [x] Browser-verified: seeded 2-turn draft, added a note to turn 1 (renders + Edit), toggled highlight on (25 highlighted spans, both A-only and B-only words colored), saved → note persists in localStorage → reloaded → note hydrates back, notebook summary shows "2 turns · 1 note"

### Review

This closes the Diff Log spec from §10 — the artifact data model now has every piece the spec asked for: configs, turns, notes, diff toggle. With this PR landed, "save as Diff Log" can become "save as artifact and publish" without any further data-model changes; Supabase just persists the same `DiffDraft` shape (renamed to `DiffLog`).

The diff-words utility is intentionally small (LCS over word/whitespace tokens, ~75 lines) — no external dependency needed for this size of completion. The visual treatment uses the same `bg-highlight-soft` token as model name pills, which keeps the language of "highlight = look here" consistent across the UI.

Notes were the trickier UX call. Three states (no-note, editing, has-note) without any global notes-mode toggle keeps each turn self-contained. The note placeholder ("What did you learn from this turn?") nudges toward reflection rather than just transcription.

### Known follow-ups (non-blocking)

- Diff highlight is per-pair-of-outputs only; doesn't yet diff *across turns* (e.g., "how did A change between turn 1 and turn 2"). That's a bigger info-design question — defer.
- Real-key smoke test for the highlight toggle during streaming. Currently `canDiff` requires both outputs to be `done`, so live streaming runs ignore highlight until complete — that may be surprising. Could show a partial diff against the in-progress text. Defer.
- Notes don't appear in the Notebook summary text itself; just the count. Could show the first note as a preview if the use case warrants.
- The diff algorithm is O(n·m) memory — fine for prose completions; could hit issues at 10k-token long outputs. Add a length guard if/when we extend Diff to long-form content.

## Persona Workshop (this session)

- [x] `lib/persona.ts` — `PersonaValues` (name, role, backstory, beliefs, voice, won't-discuss, strengths), `PERSONA_FIELDS` metadata (label + hint + rows + required), `composePersonaPrompt` that turns values into a structured system prompt skipping empty optional sections, `DEFAULT_PERSONA` seed
- [x] `lib/drafts.ts` — added `PersonaDraft` to the `Draft` union (provider/model/temperature + persona values + lastUserMessage/lastOutput); extended `DraftInput`
- [x] `components/play/persona-form.tsx` — structured form, each field labeled with a one-line hint about its purpose for character design
- [x] `app/play/persona/{page,persona-workshop}.tsx` — single-page playground (form on left, composed system prompt on right, shared run row + output panel below); draft save + `?draft=` hydration
- [x] `app/play/page.tsx` — Persona Workshop card flipped from "soon" to "open" with `/play/persona` href
- [x] `app/notebook/notebook.tsx` — `Personas` section, `Persona` pill, summary line shows `Model — Name, Role`
- [x] Browser-verified: form fields seeded with Iris; editing name to "Maya" updates composed prompt live; save persists `persona` object → URL rewrites with draft id → reopen via /notebook hydrates all fields and "Editing draft" indicator; /play index shows all 3 playgrounds as Open and Refusal Lab as Soon; all 8 routes 200

### Review

Persona Workshop completes Module 3 in the curriculum sketch. Same pattern as Tone Dial — structured inputs compose into a system prompt that's visible side-by-side — but tuned for character design instead of style. The labeled hints under each field ("Backstory: where they come from. Shapes vocabulary and frame of reference.") teach the lesson by making explicit why each input matters, not just what to fill in.

Two design calls worth flagging:
- **Single-turn for now.** A persona naturally wants follow-up questions, but the Diff Mode multi-turn pattern is heavier than Tone Dial-style single-shot. Defer chat-style multi-turn until we know if users actually want it for personas vs. a series of independent test asks.
- **Required fields = name + role only.** Everything else is optional. `composePersonaPrompt` skips empty sections so the model isn't told about blank slots. Users can land on a minimal "You are X, [role]" prompt and grow it organically.

`PersonaDraft` mirrors `ToneDraft` shape, so the Supabase publish flow will need essentially zero new code for it.

### Known follow-ups (non-blocking)

- Multi-turn chat with the persona (Diff Mode-style turns array, single config).
- Persona library — preset cards (interviewer, editor, debugger, mentor) you can clone and modify.
- "Persona Card" artifact polish for public pages: large name/role hero, body for traits, embedded chat.
- Roleplay guardrail toggle (refuse to break character vs. allow breaking).
- Strength tags as chips rather than free-text once we know what people write.

## Notebook polish + JSON export (this session)

- [x] `lib/drafts.ts` — added `duplicateDraft(id)` (new id + new timestamps + " (copy)" suffix), `restoreDraft(draft)` (writes a snapshot back preserving id/timestamps; used by undo), `exportDraftJson(draft)` (returns portable JSON with `$schema: "shape.draft.v1"` + `exportedAt` + draft)
- [x] `lib/download.ts` — `downloadBlob(filename, mime, content)` browser-only helper that creates blob URL → temp anchor click → revoke; `slugify(title, fallback)` for filenames. Reusable for future PDF export.
- [x] `app/notebook/notebook.tsx` — Duplicate / Export / Delete actions per row. Delete is optimistic + reversible: row removes immediately, a centered floating toast appears at the bottom with title, countdown, and Undo button. Cleanup on unmount cancels any pending timers.
- [x] Browser-verified: Duplicate creates "Welcome copy (copy)" and `router.push`es to its playground URL; Export downloads `welcome-copy-copy.shape.json` with the right schema header; Delete → undo toast appears with 6s countdown → Undo restores the row to its original position; all 8 routes 200

### Review

This is the missing layer between "drafts that exist" and "artifacts you can move around." Duplicate enables the fork-this workflow; JSON export gives users a real ownership story (you can copy the file out, version it in git, share it); soft-delete fixes the most jarring UX wart in the notebook (a destructive `confirm()` modal that interrupts a glance-and-clean workflow).

The portable JSON intentionally includes a `$schema` field. Future Supabase publish will use the same shape on the wire, and an "Import draft" action could read these files back. The `exportedAt` timestamp is provenance — gets useful if these files get shared.

One thing I noticed mid-build: an early test of Undo failed because my eval-based test was operating against a DOM that HMR had partially replaced. Reproduced cleanly after a hard reload. Real-user clicks were never affected. Worth remembering for future eval-driven verification.

### Known follow-ups (non-blocking)

- Import flow — paste/upload a `shape.draft.v1` JSON file and it lands in the notebook. Closes the round-trip.
- Bulk actions on the notebook: select multiple → delete / export all.
- "Export all drafts as one JSON" for backup.
- Pin the most-recent draft in /start as a "Resume" card so the round-trip from Notebook isn't the only way back.
- Toast UI nice-to-haves: pause countdown on hover, dismiss on click-outside, keyboard `u` to undo most recent.

## Import draft from JSON (this session)

- [x] `lib/drafts.ts` — `importDraftJson(json)` parses, validates `$schema === "shape.draft.v1"`, validates draft kind + required per-kind fields, generates a fresh id + timestamps + " (imported)" title suffix so imports never collide with existing local drafts. Returns `{ ok, draft }` or `{ ok: false, reason }`.
- [x] `components/notebook/import-panel.tsx` — file picker (.json) + paste textarea + Import button. Inline error and success states; calls `onImported` and shows "Imported …" confirmation.
- [x] `app/notebook/notebook.tsx` — header row above the list with draft count + Import toggle; expandable ImportPanel above the sections; visible on both populated and empty states.
- [x] Browser-verified: header shows `2 DRAFTS / CANCEL IMPORT` when open, invalid JSON surfaces "Not valid JSON.", wrong schema surfaces `Expected $schema "shape.draft.v1", got "other.format".`, valid round-trip from a seeded draft creates a second entry with a UUID and "(imported)" suffix while preserving kind + values, all 8 routes 200

### Review

This closes the round-trip. Together with export, the notebook now supports the "save the file, share it, edit it elsewhere, drop it back in" workflow. The validation is intentionally permissive on optional fields (most subfields aren't checked) — the goal is to reject obvious garbage, not to gatekeep minor schema drift while v0.x ships.

The import deliberately rewrites the id rather than preserving it, because two browsers re-importing the same export must not collide. Same reason the title gets a " (imported)" suffix — visible provenance in the notebook. The `$schema` field gives us a clean versioning hook for any future migration.

Notable: this and the previous export PR together are roughly what we'll lift into Supabase. `exportDraftJson` ≈ POST body; `importDraftJson` ≈ what we'd run on a `/p/<user>/<slug>` fork-this page.

### Known follow-ups (non-blocking)

- Drag-and-drop onto the notebook page (currently file picker only).
- Multi-draft import (paste/upload a wrapper `{ drafts: [...] }`).
- Round-trip end-to-end test that exports a draft, imports the same blob, and asserts deep equality on the payload minus id/timestamps.
- "Import overrides existing" toggle for when users *do* want to overwrite by id.

## Homepage polish (this session)

- [x] Bridge cards turned into `<Link>`s with chips/hrefs that match real routes (`/play/persona`, `/play/tone`, `/play/diff`). Third card reframed from "usability studies → run evaluations" to "A/B tests → diff two prompts" so it actually matches what Diff Mode does.
- [x] New "Playgrounds" section (numbered 03) between bridge and how-it-works, with cards for Diff Mode / Tone Dial / Persona Workshop showing the artifact each produces, plus a "See all →" link to `/play`.
- [x] Replaced the dead "See the gallery → /gallery" CTA with "Browse playgrounds → /play".
- [x] How-it-works step 03 updated from "Publish a case study" (not yet shipped) to "Save it to your notebook" with a note that publish lands next — keeps the copy honest with what's actually built.
- [x] Browse-verified: bridge cards now scroll to real route chips; featured playground cards render with artifact names; all 8 routes 200.

### Review

Small polish pass that cleaned up an embarrassing thing — the homepage was selling artifact publishing and pointing to chips that 404. With this change every link from the front door goes somewhere real, and the value proposition is now honest about what's shipped (local drafts in Notebook) vs. what's coming (publish).

Reframing the third bridge card from "evaluations" to "A/B tests" was a small but useful copy fix — the original framing implied a Refusal Lab/Eval Workshop that doesn't exist yet. "A/B tests → diff two prompts" maps cleanly onto Diff Mode and reads naturally to a UX researcher.

### Known follow-ups (non-blocking)

- "Real work, real portfolios" section from SPEC §9 still unbuilt — needs seeded sample artifacts, which needs Supabase.
- Hero animation / "live demo" embed of Diff Mode (per SPEC §9 featured-playgrounds bullet).
- Mobile nav for the homepage CTA pair — the buttons stack but the secondary loses prominence; could tighten.
- Bridge card chips could become subtle hover states rather than always-on chips.

## Curriculum entry — Module 1 + /learn index (this session)

- [x] `lib/curriculum.ts` — `CurriculumModule` type + seeded array of all 9 modules (Module 0 setup + 8 concept modules per SPEC §8). Each carries num, slug, kicker, blurb, paired playground, artifact, status, read minutes. `getModule` / `nextModule` helpers for article navigation.
- [x] `app/learn/page.tsx` — curriculum index. Hero ("Behavior designer 101 → 301"), live-count line ("2 of 9 modules live"), single-column module rows with status pills (Open / Soon), per-module paired-playground + artifact line. Ready modules click through; Soon modules render but don't link.
- [x] `app/learn/prompts-as-design/page.tsx` — Module 1 article. 5 sections: "The familiar move" (brand voice → system prompt), "The lesson, stated plainly" (every word is a design decision), "A small example" (two side-by-side prompt+output cards), "Why this is the foundation" (small iteration loops), "What to take into the playground" (3-bullet rubric). Inline Diff Mode CTA. Next-module footer.
- [x] Browser-verified: /learn renders 8 module rows with 2 Open + 7 Soon (Module 0 + Module 1), article scrolls through cleanly with example block and CTA, left-nav "04 Learn" now routes correctly, all 10 routes 200.

### Review

Closes the third homepage-implied 404 (after `/play` and the bridge cards). The Learn surface is now real, has a real piece of content, and has visible runway for the next 7 modules without faking it — each entry shows its Soon status and what it'll pair with.

The article writes for the audience the spec calls out — UX designers and researchers — by leading with familiar work (brand voice docs, microcopy, A/B variants) and re-framing the model as the call site. The "Try it in Diff Mode" CTA sits roughly mid-article rather than at the end, because the lesson lands faster when the playground catches the reader between the abstract claim and the rubric.

The curriculum module data lives in one file so future articles only need: a route, a slug entry's `href` change to point at it, and the article page. No notebook-style schema to migrate, no Supabase migration.

### Known follow-ups (non-blocking)

- Modules 2–8 don't exist yet. The data scaffolding makes adding them cheap, but each is its own writing pass.
- "Continue reading" cross-link from playground pages back to the relevant module (e.g. Diff Mode → Module 1).
- Progress tracking — which modules has this browser read? localStorage flag + ✓ on the index. Pre-Supabase.
- MDX or a tiny renderer would be nicer than hand-built React for the article body. Worth it once we have 3+ articles.
- The "9 modules live" copy in the index will need to shift the moment we ship Module 2. Easy automatic from the data.

## Refusal Lab (this session)

- [x] `lib/refusal.ts` — `Probe` + `ProbeVerdict` + `ProbeResult` + `ExpectedBehavior` types; `SEED_PROBES` panel of 6 designer-framed edge cases (privacy boundary, vulnerability signal, borderline integrity, expertise scope, values question, fully legitimate request) with `why` notes that teach the lesson behind each case; `DEFAULT_REFUSAL_GUIDELINES` opinionated 5-rule starter system prompt; `evaluateMatch(expected, verdict)` → `match | mismatch | pending`.
- [x] `lib/drafts.ts` — added `RefusalDraft` to the Draft union with provider/model/temp + guidelines (system prompt) + probes panel + per-probe results map. Updated `DraftInput` + the `importDraftJson` validator to recognize `kind: "refusal"`.
- [x] `components/play/probe-row.tsx` — one probe card: numbered label, expected-behavior pill, match indicator, streamed output, manual verdict selector (Refused / Engaged / Partial / Unclear) as pill buttons. Verdict buttons disabled while idle to force a run before scoring.
- [x] `app/play/refusal/{page,refusal-lab.tsx}` — full playground: provider/model/temp row, refusal guidelines editor (multiline system prompt), Run-all + Reset + live scorecard (X/Y match · unscored count), probe panel rendered as ProbeRows, draft save + `?draft=` hydration. Runs all probes in parallel against the configured guidelines.
- [x] `app/play/page.tsx` — Refusal Lab flipped from Soon to Open. /play index now shows 4 Open cards, 0 Soon.
- [x] `lib/curriculum.ts` — Module 4 (Refusal & boundaries) now pairs with `/play/refusal`. Status stays Soon since the article isn't written yet, but the playground link is wired.
- [x] `app/notebook/notebook.tsx` — new "Refusal labs" section with type pill + summary line (`Model · X/Y match · Z unscored`).
- [x] Browser-verified: 6 probes render with correct expected pills, scorecard updates from seeded draft state (3/4 match including the deliberate mismatch on the fake-review probe — output complied when refusal was expected), notebook surfaces the lab with the match count, all 11 routes 200.

### Review

First "evaluation" surface in Shape — every other playground generates, this one tests. The whole pedagogical move is making refusal *visible* as a design surface: the user writes guidelines, fires them at 6 cases they probably haven't pre-considered, then reads each output and judges whether the model actually did the right thing. The MISMATCH on the fake-review probe in the seeded screenshot lands the lesson without needing any prose explanation — the model said yes to writing a deceptive review because the guideline about "deception" didn't generalize to that phrasing.

A few design calls worth flagging:
- **Manual verdicts, not auto.** Auto-classification would need an LLM judge, which would muddy the pedagogy. The whole point is teaching the designer to *recognize* subtle refusal failure — partial compliance with a disclaimer can look like a "refusal" at a glance.
- **6-probe seed is fixed, not editable.** Editing the panel is real product surface (case library, custom probes, sharing) and not session-scoped. Defer.
- **Designer-framed probes only.** No adversarial jailbreak content. The audience is UX folks designing boundaries, not red-teamers.
- **Hydration ran into a real bug.** Initial implementation kept `probes` immutable as `SEED_PROBES`, so reopening a saved draft with a different probe set would mismatch `results[probe.id]` and crash. Fixed by lifting probes into state and reloading them from the draft, plus a defensive `?? EMPTY_RESULT` fallback on the renderer. Reminder for future kinds: hydrate every saved field that affects rendering.

### Known follow-ups (non-blocking)

- Module 4 article (Refusal & boundaries) — the matching curriculum entry. Cheap once we want it.
- Per-probe notes (mirror the per-turn notes in Diff Mode). Would slot cleanly into `ProbeResult.note`.
- Add-your-own-probe UI; eventually a shared probe library.
- "Compare two guidelines" mode — run the same panel against guidelines A vs guidelines B and diff the scorecards. The natural Diff-Mode-style extension of this playground.
- Auto-judge mode with a clearly-labeled LLM classifier as a *suggestion* layer, not a replacement for manual review.

## Module 4 article — Refusal & boundaries (this session)

- [x] `app/learn/refusal-and-boundaries/page.tsx` — full article mirroring Module 1's structure: lede ("a refusal is a design surface"), 5 H2 sections (familiar move → lesson → example → why foundation → rubric), an A/B refusal example with per-card "Read" notes that name what each output is doing, mid-article "Open Refusal Lab" CTA, next-module footer.
- [x] `lib/curriculum.ts` — Module 4 flipped status soon → ready, href `/learn/refusal-and-boundaries`, title split into "Refusal & boundaries" with italic on the "& boundaries" half to match the other live article's display style.
- [x] Browser-verified: /learn shows 3 of 9 modules live, Module 4 row open and clickable, article renders with all 5 sections + example + CTA + next-module footer, all 12 routes 200.

### Review

Pairs the Refusal Lab playground with its concept article. The A/B example earns the lesson by hand — same input, two refusals, one with one-line "Read" annotation pointing out exactly what each does (one walls, one redirects). That's the trick the rest of the article hangs on; without it, the "refusal is a design surface" claim is just an assertion.

The four-shape rubric (harm to third party / vulnerability / scope / contested values) maps 1:1 to the Refusal Lab's seeded probes. Read the article, run the lab, you'll see the same four categories show up — and now you know what you're looking at.

Caught two bugs while writing:
- **JSX attribute parser:** `aPrompt='...\'...'` doesn't work because JSX attribute strings don't honor `\` escapes. The `\` is literal and the next `'` closes the string. Fix: use the expression form `aPrompt={\`...\`}` so it's a real JS template literal.
- **JSX whitespace collapse:** `<em>one rule</em>\n in the guidelines` renders as "one rulein the guidelines" because JSX strips the newline + leading indent. Fix: `<em>one rule</em>{" "}` to force the space.

Both are JSX gotchas worth remembering for future article work.

### Known follow-ups (non-blocking)

- Modules 2, 3, 5, 6, 7, 8 still Soon — each is its own writing pass but the scaffolding is now well-proven (two articles in, the structure is settling: lede + 5 sections + A/B example + CTA + next).
- Pull the inline article components (Lede, H2, P, UL, LI, ExampleBlock, ExampleCard, TryItCTA, next-module footer) into a shared `components/learn/` set so future articles import instead of copy. The current duplication between Module 1 and Module 4 is fine for two articles, would be a smell at four.
- "Continue to the next concept" link from each playground header back to the matching module article. Currently the article links to the playground but not the reverse.
- Reading progress dots on /learn — localStorage flag set on article visit, ✓ on the index. Pre-Supabase.

## Eval Workshop (this session)

- [x] `lib/evals.ts` — `Criterion`, `EvalCase`, `Score` (1-5 with labeled levels), `CaseResult` (output + per-criterion scores + note); `SEED_CRITERIA` (Clarity / Tone / Completeness / Actionability / Conciseness), `SEED_CASES` (3 UX-writing prompts: empty state / payment error / welcome), `DEFAULT_EVAL_SYSTEM_PROMPT`. `caseScore` and `aggregateScore` helpers.
- [x] `lib/drafts.ts` — `EvalsDraft` added with rubric + cases + per-case results. DraftInput extended and the `importDraftJson` validator now recognizes `kind: "evals"`.
- [x] `components/play/rubric-editor.tsx` — editable list of criteria (add / edit name / edit description / remove); min 1 / max 8.
- [x] `components/play/eval-case-row.tsx` — one case with user message + streamed output + per-criterion 1-5 pill scorer + reviewer note. Per-case total displayed in the header.
- [x] `app/play/evals/{page,evals-workshop}.tsx` — full playground: provider/model/temp + system prompt + rubric editor + Run-all/Reset + live aggregate scorecard ("avg X/Y · N of M fully scored") + case panel. Draft save + `?draft=` hydration with the same defensive fallback we applied to Refusal Lab.
- [x] `app/play/page.tsx` — fifth playground card added (Eval workshop, /play/evals, "Eval Rubric + Scorecard"). /play index now has 5 Open / 0 Soon.
- [x] `lib/curriculum.ts` — Module 6 (Evaluation) paired with /play/evals. Article still Soon.
- [x] `app/notebook/notebook.tsx` — new "Evaluations" section with summary line: model · cases × criteria · avg score.
- [x] Browser-verified: seeded eval draft hydrates fully (3 criteria × 2 cases × scores), aggregate computed to "13.0/15" with "2 of 2 fully scored", notebook surfaces matching summary, all 13 routes 200.

### Review

Closes the v1.0 playground catalog from SPEC §7 except for Conversation Choreographer. Five distinct mechanics now live: paired generation (Diff), compositional style (Tone), structured authoring (Persona), categorical evaluation (Refusal), and rubric-based evaluation (Evals). The two eval surfaces — Refusal Lab and Eval Workshop — sit at different points on a spectrum: Refusal scores against a binary-ish "did the model do the expected thing" with 4 verdicts per probe; Evals scores along a 1-5 continuum across multiple criteria per case. Together they cover the two patterns the spec calls out: refusal scorecard + eval rubric.

Two design decisions worth flagging:
- **Editable rubric, static cases.** The pedagogical move is "build a rubric" — that's the *user's* surface to author. Cases are the *world's* — pre-seeded so the user can compare against a fixed bench. Add-your-own-case can land later, paired with a case library.
- **1-5 scale, not pass/fail.** UX folks know rubric numbers; pass/fail erases the gradient where the design work actually lives. The center-three scores (Weak / OK / Good) are where most outputs sit, and that's where the conversation gets useful.

Per-case fully-scored gating keeps the aggregate honest: a single missing slot in one case means that case is *not* counted in the average, and the "X of N fully scored" line makes that visible. No false confidence from partial scoring.

### Known follow-ups (non-blocking)

- Editable case list (mirror the rubric editor for cases) — natural next step once we know the use cases.
- Saveable case libraries — let users build and share reusable case sets per domain (UX writing, support, research interviews, etc.).
- LLM judge mode as a *suggestion* layer on top of manual scoring — pre-fills the pills with a rationale; reviewer can accept or override.
- Per-criterion average across cases (currently we show case totals + aggregate avg; per-criterion would help diagnose specific weaknesses).
- Module 6 article (Evaluation) — pair the article with the playground we just shipped, same cadence as #11.
- Drag-to-reorder criteria. Drag-to-reorder cases when those become editable.

## Module 6 article — Evaluation (this session)

- [x] `app/learn/evaluation/page.tsx` — article mirroring Module 1 / Module 4 structure. Lede ("a rubric makes good behavior something you can build"), 5 sections (familiar move → lesson → example → why foundation → rubric), A/B example contrasting a vague rubric ("write good copy") with a specific one (Clarity / Tone / Actionability scored 1-5) and naming the design surface the specific one exposes, mid-article Eval Workshop CTA, next-module footer to Module 7 (Soon).
- [x] `lib/curriculum.ts` — Module 6 status soon → ready, href `/learn/evaluation`.
- [x] Browser-verified: /learn now shows 4 of 9 modules live, Module 6 row clickable, article hero renders cleanly ("Evaluation." with italic), all 14 routes 200.

### Review

Third paired playground+article in the curriculum (after Modules 1 and 4). The lesson here is the *least* explored in UX literature applied to AI — most designers haven't carried a usability-study rubric over to system prompts and watched the same shape work. The article leads with that bridge explicitly: task scenarios → rubric → grading is exactly the move, just applied to a different surface.

The A/B example pulls its weight by showing the *conversation* a rubric enables, not just the rubric itself. Vague rubric ends in a shrug; specific rubric ends in "tone dropped to 3 — that's where to push next." That's the move from squinting to designing.

Worth noting: the rubric-design rubric at the end (criteria that aren't criteria / overlap / boring middle) is opinionated and short on purpose. With three failure modes named, you can mostly tell when a rubric is going to fall apart before you run anything against it. The Module 6 → Eval Workshop loop closes neatly: read the article, see the rubric-quality failure modes; open the playground, edit the rubric, see them in your own work.

### Known follow-ups (non-blocking)

- Per-criterion average across cases in Eval Workshop — would directly support the article's claim that you can diagnose specific weaknesses. (Followup from PR #12.)
- Modules 2, 3, 5, 7, 8 still Soon. Pattern is now well-proven; each is just a writing pass.
- Article kit extraction (Lede/H2/P/UL/LI/ExampleBlock/TryItCTA/next-module footer) is now overdue — three articles in, the duplication is real. Worth pulling into `components/learn/` before article 4.

## Shared article components (this session)

- [x] `components/learn/article.tsx` — extracted Lede, H2, P, UL, LI, ExampleBlock, ExampleCard, TryItCTA, NextModuleFooter. ExampleCard takes optional `promptLabel` / `outputLabel` / `noteLabel` (with sensible defaults), and `note` only renders when provided. TryItCTA takes JSX `children` for the title + a `buttonLabel` prop so each article can compose its own copy.
- [x] Refactored `app/learn/prompts-as-design/page.tsx` — was 282 lines, now 158. Two ExampleCards with default "System prompt" / "Output" labels (no note).
- [x] Refactored `app/learn/refusal-and-boundaries/page.tsx` — overrides labels to "Input" / "Output" / "Read" + note.
- [x] Refactored `app/learn/evaluation/page.tsx` — overrides labels to "Rubric" / "What you can say" / "Read" + note.
- [x] Browser-verified: all three articles still render with their distinct label vocabularies, all 5 sections, correct CTA + next-module footer.

### Review

Net effect: ~370 lines of duplicated component code collapsed into one shared module. Future article work now consists of: write the prose, configure the ExampleCard labels for whatever domain you're writing about, pick a TryItCTA button label. The three articles now read as variations on the same template rather than three independent files that happen to look alike.

The API choices that turned out to matter:
- **Configurable labels with sensible defaults.** Without this, every article would need 3 label props even when the defaults are fine. With it, Module 1 (the most generic) needed none of the override props.
- **JSX children for the TryItCTA title.** The italic-in-the-middle pattern ("Open Diff Mode and *change one variable*") is core to the visual rhythm; a string prop would lose that. Children with a separate `buttonLabel` keeps both flexible.
- **NextModuleFooter takes the `next` value directly**, not the slug. Keeps the helper colocated with `nextModule()` in the article and avoids a circular knowledge of the curriculum inside the component.

### Known follow-ups (non-blocking)

- Optional H3 for sub-sections (one article might want it later; not yet).
- Inline `Em` and `Strong` helpers if we want non-default emphasis styling — currently the articles just use raw `<em>` / `<strong>`.
- A long-form variant of ExampleBlock (3+ cards) if a future module wants three examples instead of two.
- Article meta header (← Learn link + section number + h1 + read time line) is still inline in each article. It's only 4 elements but if we add a 4th article, lifting it makes sense.

## Module 2 article — Voice & tone (this session)

- [x] `app/learn/voice-and-tone/page.tsx` — first article written *with* the shared kit from PR #14 rather than retrofitted. Lede framing tone as multi-dimensional, 5 H2 sections (familiar move → lesson → example → why foundation → rubric), A/B example showing one dial moved (Energy: Composed vs Playful) with everything else equal — same warmth, different feel — to make composability legible. Mid-article Tone Dial CTA. Next-module footer to Module 3 (Soon).
- [x] `lib/curriculum.ts` — Module 2 status soon → ready, href set, title split as "Voice" + italic "& tone" to mirror Module 4's display style.
- [x] Browser-verified: /learn shows 5 of 9 modules live, Module 2 row clickable, article hero renders ("Voice & tone." with italic), all 5 sections + A/B with custom "Dials" label + Tone Dial CTA + next-module footer, all 5 learn routes 200.

### Review

First article written end-to-end on the extracted kit (PR #14). The experience was clean — the file is ~190 lines of essentially just prose + structure; no inline component definitions, no duplication of typography helpers, no copy-pasted CTAs. The custom "Dials" label override slots in via one prop, same way Module 6 used "Rubric" and "What you can say." The kit is shaped right.

The article's load-bearing move is the A/B example. Same brief, same warmth, same brevity, same directness — only Energy differs (Composed → Playful). The two outputs show a real qualitative shift ("Take your time getting set up…" vs "Hey, glad you made it!…") that demonstrates the lesson without explanation. "Tone is composable" is asserted in prose, but the example is what makes it stick.

This brings the curriculum to 5 of 9 modules live. The remaining four (Personas, Output formatting, Multi-turn flows, Putting it together) each pair with surface that exists or doesn't:
- Module 3 (Personas) pairs with Persona Workshop — playground exists, article cheap.
- Module 5 (Output formatting) has no paired playground in the spec — independent article.
- Module 7 (Multi-turn flows) pairs with Conversation Choreographer — neither exists yet.
- Module 8 (Putting it together) is a studio project — different surface entirely.

### Known follow-ups (non-blocking)

- Module 3 article — cheap follow-up; Persona Workshop already exists.
- Standalone Module 5 article (no playground pairing in spec) — would be the first article without a Try-it CTA.
- Article meta header (← Learn link + section number + h1 + read-time line) is still inline in each article. Four articles in, lifting it is overdue.
- Cross-link from each playground header back to the matching article ("Read the concept →"). One-line addition per playground; not yet done.

## Module 3 article — Personas for AI (this session)

- [x] `app/learn/personas-for-ai/page.tsx` — built on the shared kit. Lede framing personas as character (not job title), 5 H2 sections (familiar move → lesson → example → why foundation → rubric), A/B example contrasting "Job title" ("You are a helpful research assistant.") with "Character" (Iris with 10-year backstory + opinionated belief + voice texture). Per-card "Read" annotations name what each output is doing. Mid-article Persona Workshop CTA. Next-module footer points to Module 4 — which is *ready*, so it links through to the article instead of /learn for the first time in this curriculum.
- [x] `lib/curriculum.ts` — Module 3 status soon → ready, href set, title split into "Personas" + italic "for AI".
- [x] Browser-verified: /learn shows 6 of 9 modules live, Module 3 row clickable, article hero renders ("Personas *for AI*."), A/B example uses custom "Persona" label override (new vocabulary, no shared-kit changes), next-module footer correctly links to `/learn/refusal-and-boundaries` since Module 4 is ready, all 6 learn routes 200.

### Review

First time a next-module footer actually walks the reader into another live article. The curriculum is starting to feel like a path instead of a directory.

The A/B example carries more weight in this article than usual. Personas are the most "mystified" lever in AI work — designers feel like the model is doing something they can't see. Showing a job title vs. a character (same task, two outputs, the difference legible) demystifies it without much prose effort. The "Read" annotations on each card make the implicit critique explicit ("vending machine" vs. "someone with a perspective").

This brings the curriculum to **6 of 9 live**. Remaining:
- Module 5 (Output formatting) — no playground pairing in spec; first article without a Try-it CTA. Could use a different terminal structure or just skip the CTA section.
- Module 7 (Multi-turn flows) pairs with Conversation Choreographer — neither exists yet.
- Module 8 (Putting it together) — studio project, different surface.

### Known follow-ups (non-blocking)

- Article meta header (← Learn + SectionNumber + h1 + read-time) is still inline in five articles now. Lifting is overdue.
- Cross-link from each playground back to the matching article ("Read the concept →"). Five articles now have paired playgrounds; one-line change per playground.
- Article TOC component (jump to sections within the article) once any article passes ~10 minutes.

## Module 5 article — Output formatting (this session)

- [x] `app/learn/output-formatting/page.tsx` — first article without a paired playground. Establishes the no-Try-it-CTA variant of the article structure. Lede framing format as part of voice (not neutral), 4 H2 sections matching the standard shape (familiar move → lesson → example → why foundation), plus a custom 5th section "Try it in your own work" that points to Diff Mode inline as the closest fit but doesn't pretend a dedicated playground exists. A/B example: "Bulleted default" vs "Prose, on purpose" — same content, two formats, different reading experiences. Next-module footer.
- [x] `lib/curriculum.ts` — Module 5 status soon → ready, href set, title split into "Output" + italic "formatting".
- [x] Browser-verified: /learn shows 7 of 9 modules live, Module 5 row clickable, article renders with "4 MIN READ" meta (no "pairs with" suffix), all sections + A/B example + inline Diff Mode link in the closing section, all 7 learn routes 200.

### Review

Resolves a structural question the curriculum had been ducking: what does an article look like when there's no paired playground? SPEC §8 lists Module 5 paired with "lightweight studio" but doesn't define one. Two options — invent a playground, or write the article as standalone. Picked standalone because format choices show up in *every* playground; a dedicated one would teach less than already-existing tools used with intent.

The structural change is small: the standard Try-it card is replaced with a "Try it in your own work" paragraph that links inline to Diff Mode as the closest existing surface. The meta line drops the "pairs with" suffix since there's no pairing. Same kit, two prop differences. Future no-playground articles can follow the same pattern.

Curriculum now **7 of 9 live**. Remaining gaps are exactly the two surfaces that don't exist yet — Module 7 needs Conversation Choreographer first, Module 8 is a Studio project.

### Known follow-ups (non-blocking)

- Module 7 + Conversation Choreographer playground — biggest remaining piece.
- Module 8 / Studio project — different surface entirely.
- Article meta header (← Learn + section number + h1 + read-time) is inline in six articles now. Lifting is overdue.
- Cross-link from playground headers back to matching articles. One-line change per playground.

## Conversation Choreographer + Module 7 article (this session)

- [x] `lib/choreographer.ts` — `ChoreographedTurn` + `AssistantResult` types; `SEED_TURNS` (4-turn flow exercising multi-turn coherence: context-setter → context-dependent follow-up → exploratory follow-up → contradiction check); `DEFAULT_CHOREOGRAPHER_PROMPT` with explicit coherence rules; `buildHistoryUpTo` helper that constructs the conversation history for each turn; `completedTurnCount` aggregator.
- [x] `lib/drafts.ts` — `ChoreographerDraft` added to the union; DraftInput extended; importDraftJson validator recognizes `kind: "choreographer"`.
- [x] `components/play/choreographer-turn-row.tsx` — one turn row: numbered, editable user textarea, streamed assistant response, per-turn note editor (three states: no-note / editing / has-note), per-turn delete with `canDelete` gating.
- [x] `app/play/choreographer/{page,choreographer-page.tsx}` — full playground. Sequential run-all that builds history into each subsequent turn (the choreography), stops on error, supports add/remove turns (max 10), draft save + `?draft=` hydration. The streaming pattern intentionally mirrors Diff Mode's per-turn update logic.
- [x] `app/play/page.tsx` — 6th card added. /play now 6 Open / 0 Soon.
- [x] `lib/curriculum.ts` — Module 7 status soon → ready, paired with /play/choreographer, title split as "Multi-turn" + italic "flows".
- [x] `app/notebook/notebook.tsx` — "Conversations" section, "Flow" pill, summary line "model · X/Y turns run".
- [x] `app/learn/multi-turn-flows/page.tsx` — Module 7 article. Lede framing multi-turn as its own design surface, 5 standard sections, A/B example showing a tone/coherence failure at turn 4 vs. how 2 sentences of coherence rules fix it, Choreographer CTA. Names three multi-turn failure modes by name (tone drift / forgetting / backpedaling).
- [x] Browser-verified: empty state shows 4 seeded turns + Run flow + Add turn (capped at 10), seeded draft hydrates with title + "Editing draft" indicator + "2 of 2 turns complete" + per-turn note rendered with Edit affordance, notebook shows "Conversations" section with "Flow" pill + "Claude Sonnet 4.6 · 2/2 turns run" summary, /play has 6 Open / 0 Soon, /learn has **8 of 9 modules live**, all 19 routes 200.

### Review

Closes the v1.0 playground catalog from SPEC §7 — Conversation Choreographer was the last missing one. Closes Module 7 from SPEC §8. Curriculum now has 8 of 9 modules live; only Module 8 (Studio) remains, and that's a different surface entirely (an end-to-end guided project, not a module).

The Choreographer is the third "evaluation-shaped" playground, alongside Refusal Lab and Eval Workshop. Each makes a different lever visible:
- Refusal Lab: did the model handle a specific edge case as expected?
- Eval Workshop: how does the model score against an explicit rubric?
- Choreographer: does the model hold the thread across turns?

The pedagogical move that ties all three together is the same — *evaluate a flow, not a moment.* That theme is now strong enough that v1.0 of the product feels like a coherent story rather than a set of disconnected tools.

A design decision worth flagging: the choreographer fires turns sequentially (not in parallel) because each turn depends on the assistant's actual response to the previous one. Stops on error to avoid noisy downstream turns — the working-copy pattern (mutating a local array while React state updates render) is the cleanest way to maintain that invariant without race conditions.

### Known follow-ups (non-blocking)

- "Improvise" mode in Choreographer — let the user add a turn live after running the scripted flow. The current MVP is fully scripted, no live conversation.
- Cross-turn scoring on the same axis as Eval Workshop (per-turn rubric scores → flow average). Would unify the eval surfaces.
- Module 8 (Putting it together) — last remaining curriculum entry. Studio-shaped project, not an article.
- Article meta header (← Learn + section number + h1 + read-time) inline in seven articles. Way overdue.
- Cross-link from playground headers back to matching articles. Six playgrounds with paired articles now; would round out the loop.

## Next session

Pick one:
1. **Saveable artifacts (Supabase backend)** — Publish flow + `/p/<user>/<slug>` public pages + PDF export. The five draft shapes are stable; this is the portfolio-loop work.
2. **Lift article meta header into shared kit** — seven articles in, identical inline header. ~30-line refactor that pays off the next time anyone writes an article.
3. **Module 8 / Studio scaffold** — last curriculum entry. Different shape (guided multi-step project, not concept article). Larger scope.
