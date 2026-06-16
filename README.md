# Shape

Live at **[shape-models.com](https://shape-models.com)**.

**Shape model behavior.** A playground for people in UX — designers, researchers, writers, prototypers — to learn how to shape AI model behaviors. Learn by doing. Create artifacts you can use later.

Free in your browser — no key needed to start. Bring your own Anthropic or OpenAI key when you want bigger models.

![Shape — home page](docs/screenshots/home.png)

## What it is

Shape is a small, opinionated web app for the design side of working with AI models. It's the difference between *using* an LLM and *shaping* one — writing personas, tuning voice, choreographing multi-turn flows, designing where the model says no, evaluating outputs against a rubric.

The audience is people in UX — designers, researchers, writers, prototypers — not engineers. Token counters and JSON pretty-printers stay off-screen. Personas, microcopy, evaluation rubrics, and A/B comparisons come to the front.

## What's inside

- **`/learn`** — seven short concept lessons. Prompts as design, voice & tone, personas for AI, refusal & boundaries, output formatting, evaluation, multi-turn flows.
- **`/play`** — six focused playgrounds. Each one isolates a single design lever and produces an artifact you can save and export.
- **`/notebook`** — your local working copies. Save drafts from any playground, duplicate them, export to JSON.

![Featured playgrounds and the three-step onboarding pitch on the home page](docs/screenshots/play-and-learn.png)

## Playgrounds

| Playground | What it teaches | Artifact |
|---|---|---|
| **Diff Mode** | Iteration. Compare two configs side by side — fresh each run, or as a running conversation. Starter example pairs included. | Diff Log |
| **Tone Dial** | Style as a design token. Move warmth, verbosity, directness as independent dials. | Behavior Spec |
| **Persona Lab** | Character design for AI. Backstory, beliefs, voice, blind spots. | Persona Card |
| **Refusal Lab** | Boundary design. Where the model says no — and where it shouldn't. | Refusal Scorecard |
| **Eval Lab** | Rubric-based evaluation. Define what good looks like, score against it. | Eval Rubric + Scorecard |
| **Conversation Choreographer** | Multi-turn flow design. Script user turns, run the conversation end-to-end. | Behavior Spec |

Each playground includes a composed system-prompt preview, streaming output from the selected model, save-to-Notebook as a draft, and export to portable JSON.

**Diff Mode** — two configurations, output streamed side by side:

![Diff Mode playground with two provider/model configurations](docs/screenshots/diff-mode.png)

Diff Mode runs in two modes. **Independent** fires a fresh single-shot prompt through both configs each run (no memory) — the classic A/B compare. **Conversation** gives each side its own history, so the two configs accumulate context and drift apart over a multi-turn chat. A row of one-click example pairs (Warm vs Blunt, Terse vs Expansive, Prose vs Bullets, Temp 0.1 vs 1.0) seeds meaningful variance for newcomers.

**Refusal Lab** — design the boundary, then test it against a panel of probes:

![Refusal Lab with refusal guidelines and a probe panel](docs/screenshots/refusal-lab.png)

## Free in your browser

Shape ships four small open models that run **entirely in your browser** via [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU. No keys, no server, no per-token costs. The first run downloads the model once and caches it in IndexedDB; later runs are instant.

| Model | Size | Family | Best for |
|---|---|---|---|
| **Qwen 2.5 0.5B** | ~280MB | Alibaba | Fastest first download. See something happen now. |
| **Llama 3.2 1B** ⭐ | ~1GB | Meta | Balanced default. Recommended. |
| **Llama 3.2 3B** | ~2GB | Meta | Best free-tier quality. |
| **Phi 3.5 Mini** | ~2.2GB | Microsoft | Different family — meaningful diversity for Diff Mode. |

**Caveats:**
- **WebGPU required.** Chrome and Edge work fully. Safari has partial support; Firefox is behind a flag. Without WebGPU you'll see a fallback message and need a BYOK key.
- **Quality is real but lower** than frontier models — fine for "feel the playgrounds," but tone/persona/eval responses will read clunkier than Claude or GPT.
- **First-run download is real.** ~280MB to 2.2GB depending on the model. The status banner shows progress.

## Bring your own key (optional)

For better output quality, bring your own Anthropic or OpenAI key. We never see it.

- **Anthropic** calls go directly browser → API, using Anthropic's `anthropic-dangerous-direct-browser-access` header. The key never leaves your machine.
- **OpenAI** is blocked from direct browser calls by Cloudflare bot management; we proxy through a Next.js edge route (`/api/proxy/openai`). The key flows through in memory only — never logged, persisted, or echoed. Same trust posture, one hop through Vercel Edge.
- All drafts live in `localStorage`. No server-side artifact storage.

Set keys at **Keys** (bottom of the sidebar) or during onboarding at `/start`.

## The Notebook

Drafts persist to `localStorage` — close the tab, come back, your work is still there. From the Notebook you can:

- **Open** to keep editing (URL becomes `?draft=<id>` so you can bookmark)
- **Duplicate** to fork
- **Export JSON** to download a portable artifact
- **Save as PDF** — a print-friendly view of the draft (`/print/draft?id=<id>`) with a one-click **Save as PDF** button; uses the browser's print dialog, no PDF library
- **Delete** (with a 6-second undo toast)

## Curriculum

Seven micro-lessons. Each pairs a short reading with a playground. Recommended path, never gated.

| # | Lesson | Pairs with |
|---|---|---|
| 01 | Prompts as design | Diff Mode |
| 02 | Voice & tone | Tone Dial |
| 03 | Personas for AI | Persona Lab |
| 04 | Refusal & boundaries | Refusal Lab |
| 05 | Output formatting | — |
| 06 | Evaluation | Eval Lab |
| 07 | Multi-turn flows | Conversation Choreographer |

## Running locally

```bash
git clone https://github.com/jessholbrook/shape.git
cd shape
npm install
npm run dev
# → http://localhost:3000
```

No env required for the app to work. The Feedback button requires two Linear env vars; without them it returns 503 gracefully.

A modern Chromium-based browser (Chrome, Edge, Brave, Arc) is recommended for the in-browser free models — they need WebGPU.

### `.env.local` (optional)

```env
# In-product feedback → Linear tickets. Without these, /api/feedback
# returns 503 and the feedback modal shows a clear error.
LINEAR_API_KEY=        # Linear settings → API → Personal API keys
LINEAR_TEAM_ID=        # UUID of the team feedback should land in

# Override the metadataBase for OG/canonical URLs. Only needed when a
# custom domain points at the deployment.
NEXT_PUBLIC_SITE_URL=  # e.g. shape-models.com
```

## Feedback → Linear

A floating **Feedback** button in the bottom-right opens a modal (General / Bug / Idea + textarea). Submissions POST to `/api/feedback`, which calls Linear's `issueCreate` GraphQL mutation and returns the new ticket identifier.

Each submission auto-attaches the current URL, viewport, user-agent, and timestamp.

Set `LINEAR_API_KEY` and `LINEAR_TEAM_ID` to wire it up.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4** with hand-rolled design tokens (`--canvas`, `--ink`, `--highlight`)
- **Fonts:** Fraunces (display) + Inter (body) + Geist Mono (code)
- **In-browser inference:** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) via WebGPU
- **Routing:** App Router, all client/server boundaries explicit
- **State:** localStorage for drafts and keys; no server-side persistence
- **Streaming:** native `fetch` + SSE; no provider SDKs (smaller bundle)
- **Analytics:** [Vercel Web Analytics](https://vercel.com/docs/analytics) — cookieless pageviews only, no user tracking

## Architecture notes

- `lib/providers/` — thin adapters around Anthropic, OpenAI, and WebLLM. One signature, `runChat(call): AsyncIterable<ChatEvent>`. Provider differences live here, not in the playgrounds.
- `lib/providers/webllm.ts` — dynamic import of `@mlc-ai/web-llm` so the 14MB package is only shipped to users running the in-browser model.
- `lib/webllm-engine.ts` — singleton MLCEngine with `reload(modelId)` for switching between the four free models. Exposes a subscribable status (idle / loading / ready / error / unsupported) consumed by the global status banner.
- `lib/drafts.ts` — typed `Draft` union, `localStorage` CRUD, import/export.
- `lib/hooks/use-draft-editing.ts` — combined hydration + save state machine that every playground uses. One source of truth for the `?draft=<id>` URL ↔ state dance.
- `lib/providers.ts` — `BYOK_PROVIDERS` filters webllm out of BYOK-specific surfaces (key setup, cost meter, `/start`); `providerNeedsKey(id)` gates the "missing key" banner per playground.
- `components/play/*` — shared playground primitives (provider/model/temperature row, missing-key banner, draft-save bar, output panel).
- `components/webllm-status-banner.tsx` — bottom-pinned global banner with model-download progress.
- `components/feedback-button.tsx` — the floating Feedback widget; mounted once in `Shell`.
- `app/api/proxy/openai/route.ts` — edge proxy for browser → OpenAI.
- `app/api/feedback/route.ts` — edge route that forwards submissions to Linear.

## Deploying to Vercel

The repo is already wired to a Vercel project. Push to `main` to deploy to prod; PRs get preview URLs automatically.

For a fresh project:

1. **vercel.com → Add New → Project** → import the repo
2. Vercel auto-detects Next.js; leave defaults
3. **Environment Variables** (Production scope):
   - `LINEAR_API_KEY` (optional, for the Feedback button)
   - `LINEAR_TEAM_ID` (optional, for the Feedback button)
   - `NEXT_PUBLIC_SITE_URL` (optional, only with a custom domain)
4. Deploy

## Project structure

```
app/
  api/
    feedback/route.ts        # → Linear
    proxy/openai/route.ts    # browser → OpenAI shim
  learn/                     # curriculum lessons
  notebook/                  # local drafts
  play/                      # six playgrounds
  print/draft/               # print-friendly draft view (Save as PDF)
  settings/keys/             # BYOK setup
  start/                     # onboarding
  layout.tsx
  page.tsx                   # home
components/
  feedback-button.tsx        # floating widget
  home/playground-previews.tsx  # animated home cards
  play/                      # shared playground primitives
  shell.tsx                  # left nav + chrome
  webllm-status-banner.tsx   # in-browser model download banner
lib/
  drafts.ts                  # Draft union + localStorage CRUD
  hooks/
    use-draft-editing.ts     # save + hydrate state machine
    use-keys.ts
    use-webllm-status.ts     # subscribe to in-browser engine state
    ...
  providers.ts               # PROVIDERS / BYOK_PROVIDERS / providerNeedsKey
  providers/
    anthropic.ts             # direct browser fetch
    openai.ts                # via /api/proxy/openai
    webllm.ts                # in-browser via @mlc-ai/web-llm
    index.ts                 # runChat dispatch
  webllm-engine.ts           # singleton MLCEngine + status state
  curriculum.ts              # lesson list
  ...
```

## Status

Active iteration. Recent pivots:

1. Shape moved away from hosted artifact pages — no public URLs, no profile pages. Artifacts now export as portable JSON from the Notebook.
2. In-browser models became the default entrance via WebLLM. BYOK is the upgrade path for bigger models.
3. The Build/Studio section (longer guided projects) was removed — the playgrounds and the Learn curriculum are the product.
