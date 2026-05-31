# Shape

**Shape model behavior.** A playground for people in UX to learn how to shape AI model behaviors. Learn by doing. Create artifacts you can use later.

Bring your own key. Everything stays in your browser.

![Home page](docs/screenshots/01-home.png)

## What it is

Shape is a small, opinionated web app for the design side of working with AI models. It's the difference between *using* an LLM and *shaping* one — writing personas, tuning voice, choreographing multi-turn flows, designing where the model says no, evaluating outputs against a rubric.

The audience is UX designers and researchers, not engineers. Token counters and JSON pretty-printers stay off-screen. Personas, microcopy, evaluation rubrics, and A/B comparisons come to the front.

## What's inside

- **`/learn`** — eight short concept articles ("modules"). Prompts as design, voice & tone, personas for AI, refusal & boundaries, output formatting, evaluation, multi-turn flows.
- **`/play`** — six focused playgrounds. Each one isolates a single design lever and produces an artifact you can save and export.
- **`/notebook`** — your local working copies. Save drafts from any playground, duplicate them, export to JSON.

(There's a `/build` section for longer Studio projects, currently behind a feature flag. See *Feature flags* below.)

![Left nav and home hero](docs/screenshots/02-nav.png)

## Playgrounds

| Playground | What it teaches | Artifact |
|---|---|---|
| **Diff Mode** | Iteration. Run one prompt through two configs side by side. | Diff Log |
| **Tone Dial** | Style as a design token. Move warmth, verbosity, directness as independent dials. | Behavior Spec |
| **Persona Workshop** | Character design for AI. Backstory, beliefs, voice, blind spots. | Persona Card |
| **Refusal Lab** | Boundary design. Where the model says no — and where it shouldn't. | Refusal Scorecard |
| **Eval Workshop** | Rubric-based evaluation. Define what good looks like, score against it. | Eval Rubric + Scorecard |
| **Conversation Choreographer** | Multi-turn flow design. Script user turns, run the conversation end-to-end. | Behavior Spec |

![Tone Dial in action](docs/screenshots/03-tone-dial.png)

Each playground includes:
- A composed system-prompt preview that updates as you tune controls
- Streaming output from the model you select (Anthropic or OpenAI)
- Save as draft → lands in the Notebook
- Export to portable JSON

## The Notebook

Drafts persist to `localStorage` — close the tab, come back, your work is still there. From the Notebook you can:

- **Open** to keep editing (URL becomes `?draft=<id>` so you can bookmark)
- **Duplicate** to fork
- **Export JSON** to download a portable artifact
- **Delete** (with a 6-second undo toast)

![Notebook with several drafts](docs/screenshots/04-notebook.png)

## Curriculum

Eight modules. Each pairs a short reading with a playground and a mini-project. Recommended path, never gated.

| # | Module | Pairs with |
|---|---|---|
| 01 | Prompts as design | Diff Mode |
| 02 | Voice & tone | Tone Dial |
| 03 | Personas for AI | Persona Workshop |
| 04 | Refusal & boundaries | Refusal Lab |
| 05 | Output formatting | — |
| 06 | Evaluation | Eval Workshop |
| 07 | Multi-turn flows | Conversation Choreographer |
| 08 | Putting it together | *(Studio project, behind a flag)* |

![Learn index showing modules](docs/screenshots/05-learn.png)

## Bring your own key

Shape is **BYOK** — bring your own Anthropic or OpenAI key. We never see it.

- **Anthropic** calls go directly browser → API, using Anthropic's `anthropic-dangerous-direct-browser-access` header. The key never leaves your machine.
- **OpenAI** is blocked from direct browser calls by Cloudflare bot management; we proxy through a Next.js edge route (`/api/proxy/openai`). The key flows through in memory only — never logged, persisted, or echoed. Same trust posture, one hop through Vercel Edge.
- All drafts live in `localStorage`. No server-side artifact storage.

Set keys at **Keys** (bottom of the sidebar) or during onboarding at `/start`.

![Key setup flow](docs/screenshots/06-keys.png)

## Running locally

```bash
git clone https://github.com/jessholbrook/shape.git
cd shape
npm install
npm run dev
# → http://localhost:3000
```

No env required for the app to work. The Feedback button (see below) requires two Linear env vars; without them it returns 503 gracefully.

### `.env.local` (optional)

```env
# In-product feedback → Linear tickets. Without these, /api/feedback
# returns 503 and the feedback modal shows a clear error.
LINEAR_API_KEY=        # Linear settings → API → Personal API keys
LINEAR_TEAM_ID=        # UUID of the team feedback should land in

# Override the metadataBase for OG/canonical URLs. Only needed when a
# custom domain points at the deployment.
NEXT_PUBLIC_SITE_URL=  # e.g. shape.example.com
```

## Feedback → Linear

A floating **Feedback** button in the bottom-right opens a modal (General / Bug / Idea + textarea). Submissions POST to `/api/feedback`, which calls Linear's `issueCreate` GraphQL mutation and returns the new ticket identifier.

Each submission auto-attaches the current URL, viewport, user-agent, and timestamp.

![Feedback modal](docs/screenshots/07-feedback.png)

Set `LINEAR_API_KEY` and `LINEAR_TEAM_ID` to wire it up.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4** with hand-rolled design tokens (`--canvas`, `--ink`, `--highlight`)
- **Fonts:** Fraunces (display) + Inter (body) + Geist Mono (code)
- **Routing:** App Router, all client/server boundaries explicit
- **State:** localStorage for drafts and keys; no server-side persistence
- **Streaming:** native `fetch` + SSE; no provider SDKs (smaller bundle)

## Architecture notes

- `lib/providers/` — thin adapters around Anthropic + OpenAI. One signature, `runChat(call): AsyncIterable<ChatEvent>`. Provider differences live here, not in the playgrounds.
- `lib/drafts.ts` — typed `Draft` union, `localStorage` CRUD, import/export.
- `lib/hooks/use-draft-editing.ts` — combined hydration + save state machine that every playground and the studio uses. One source of truth for the `?draft=<id>` URL ↔ state dance.
- `lib/flags.ts` — feature flags. Currently a single `BUILD_ENABLED` toggle.
- `components/play/*` — shared playground primitives (provider/model/temperature row, missing-key banner, draft-save bar, output panel).
- `components/feedback-button.tsx` — the floating Feedback widget; mounted once in `Shell`.
- `app/api/proxy/openai/route.ts` — edge proxy for browser → OpenAI.
- `app/api/feedback/route.ts` — edge route that forwards submissions to Linear.

## Feature flags

`lib/flags.ts` is the single source of truth. Currently:

```ts
export const BUILD_ENABLED = false;
```

When false, the `/build` section disappears from the nav, the `/start` onboarding cards, and the Notebook empty state. Routes still resolve so we can iterate internally; flip the constant and rebuild to expose it again.

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
  build/                     # Studios (flag-hidden)
  learn/                     # curriculum articles
  notebook/                  # local drafts
  play/                      # six playgrounds
  settings/keys/             # BYOK setup
  start/                     # onboarding
  layout.tsx
  page.tsx                   # home
components/
  feedback-button.tsx        # floating widget
  home/playground-previews.tsx  # animated home cards
  play/                      # shared playground primitives
  shell.tsx                  # left nav + chrome
lib/
  drafts.ts                  # Draft union + localStorage CRUD
  flags.ts                   # feature flags
  hooks/
    use-draft-editing.ts     # save + hydrate state machine
    use-keys.ts
    ...
  providers/
    anthropic.ts             # direct browser fetch
    openai.ts                # via /api/proxy/openai
    index.ts                 # runChat dispatch
  curriculum.ts              # module list
  ...
```

## Status

Active iteration. The product shape settled in a recent pivot away from hosted artifact pages — Shape is now keys-in-browser + portable artifact export, no public URLs, no profile pages. Studios (the longer guided projects) are paused behind a flag while the playground side stabilizes.

---

## Screenshots to capture

The placeholders above expect these files under `docs/screenshots/`. Each at 2× / Retina for crispness, JPEG or PNG, ideally cropped to the relevant area rather than the full window:

- **`01-home.png`** — Home hero with the H1 ("Shape model behavior.") and the three featured playground cards visible. The animated card previews should be mid-cycle if possible.
- **`02-nav.png`** — Left nav with all four sections visible (Home / Learn / Play / Notebook), one of them highlighted as active.
- **`03-tone-dial.png`** — Tone Dial playground with dials moved off-neutral and the composed system prompt visible on the right.
- **`04-notebook.png`** — Notebook with three or four drafts of mixed kinds, each row showing kind pill + title + relative time.
- **`05-learn.png`** — `/learn` page with the eight module rows visible.
- **`06-keys.png`** — `/settings/keys` (or the `/start` page) showing the key setup form.
- **`07-feedback.png`** — Feedback button open: the modal with the kind chips and textarea, ideally with a sample message typed.
