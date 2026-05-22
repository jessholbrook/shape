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

## Next session

Pick one:
1. **Saveable artifacts (Supabase backend)** — Publish flow + `/p/<user>/<slug>` public pages + PDF export. Multi-session; the local draft shapes are stable and the round-trip is proven.
2. **Refusal Lab playground** — fourth playground; v0.3. Boundary design, over- vs under-refusal scorecard. First "evaluation" surface vs. generation.
3. **Hero/landing polish + featured playgrounds** — homepage currently still references `/persona`, `/system`, `/evals` chips that don't go anywhere. Wire the homepage to the three real playgrounds and update the "Real work, real portfolios" section to show seeded examples.
