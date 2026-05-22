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

## Next session

Pick one:
1. **Saveable Diff Logs** — Supabase setup + `/p/<user>/<slug>` public artifact pages + PDF export. Lands the portfolio loop.
2. **Tone Dial playground** — second playground; lighter than Diff Mode; produces a Behavior Spec artifact.
3. **Onboarding polish** — Module 0 flow ("Get your key") with success screen, plus the "Start shaping" CTA on the homepage routing into something productive when there's no key yet.
