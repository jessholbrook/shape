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

## Next session

Pick one:
1. **Saveable artifacts (Diff Logs + Behavior Specs)** — Supabase setup + auth + `/p/<user>/<slug>` public pages + PDF export. Lands the portfolio loop on top of the draft model. With multi-turn now in place, the Diff Log schema is essentially what we publish.
2. **Persona Workshop playground** — third playground; character design (backstory, beliefs, blind spots) → Persona Card.
3. **Per-turn notes + word-level diff highlighting** — finish the Diff Log spec from §10 before going to Supabase. Adds notes to each `DiffTurn` and a diff-highlight toggle that shows word-level diff between A and B.
