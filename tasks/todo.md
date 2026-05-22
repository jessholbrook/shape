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

## Next session

Pick one:
1. **Saveable artifacts (Diff Logs + Behavior Specs)** — Supabase setup + `/p/<user>/<slug>` public pages + PDF export. Lands the portfolio loop for both playgrounds at once.
2. **Persona Workshop playground** — third playground; character design (backstory, beliefs, blind spots) → Persona Card.
3. **Notebook page** — `/notebook` lists everything you've made (drafts, Diff sessions, tone setups) in localStorage. Lightweight precursor to artifact persistence — no Supabase needed yet.
