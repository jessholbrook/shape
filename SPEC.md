# Shape

**Tagline:** *Shape model behavior.*
**Subhead:** The behavior design playground for UX designers and researchers. Learn the craft. Build a portfolio.

---

## 1. What this is

Shape is a web playground that teaches people how to shape AI model behavior — and, while they learn, helps them produce real portfolio artifacts they can show employers.

The audience is **UX designers and UX researchers**, not engineers. Most existing AI playgrounds are built for ML engineers (token counters, raw API panels, JSON outputs). Shape is built for people who think in personas, interaction flows, copy, and research rubrics — and shows them that those skills *are* the foundation of behavior design.

## 2. Positioning

> Shape is to behavior design what Figma is to interface design: the place you go to learn the craft, practice it, and build a body of work.

Bridging frames we use throughout the site:

| What designers/researchers already do | What that becomes in Shape |
|---|---|
| Writing brand voice guidelines | Writing system prompts |
| Designing user personas | Designing AI personas |
| Usability testing with rubrics | Building model evaluations |
| A/B testing interfaces | Diffing prompts |
| Heuristic evaluation | Adversarial / red-team testing |
| Error-state design | Refusal design |
| Microcopy | Output formatting and tone |

## 3. Decisions locked

| Area | Decision |
|---|---|
| Name | **Shape** |
| Audience | UX designers + UX researchers |
| Key management | **BYOK** — bring your own key, stored in `localStorage` only |
| Providers | **Multi-provider** — Anthropic + OpenAI in v0.1, Google + local (Ollama) in v1.5 |
| Artifact visibility | **Public by default**, with private toggle |
| Learning structure | **Both** — guided curriculum *and* free-roam playgrounds |
| Community features | **Later** — no comments/leaderboards in v1 |
| First Studio project | **Research Interview Assistant** |
| First flagship playground | **Diff Mode** |
| Stack | Next.js + Tailwind + shadcn/ui on Vercel; Supabase for auth + artifact storage |
| Auth | Required from v0.1; magic-link email via Supabase |
| Handles | User picks at signup (validated, unique, editable later) |
| Visitor demo on public artifacts | Small server-side pooled key, rate-limited per IP + per artifact |
| Diff artifact name | **Diff Log** (kept) |

## 4. Site architecture

Four sections, surfaced from a persistent top nav:

1. **Learn** — Concept articles. Short illustrated explainers (5–8 min each) covering the levers: system prompts, few-shot, personas, tone, refusals, formatting, tools, evaluation.
2. **Play** — Playgrounds. Small, focused interactive tools. Free to enter from day one.
3. **Build** — Studios. Longer guided projects that produce a portfolio-grade case study.
4. **Gallery** — Public showcase of user artifacts + curated failure museum.

Plus per-user:
- **Notebook** — running log of everything you've made (artifacts, drafts, evals).
- **Profile** — `shape.app/u/<handle>` — public bio + curated case studies. The link they paste into job applications.

## 5. The portfolio system (the differentiator)

Every meaningful action in Shape produces an **artifact**. Artifacts are first-class objects with their own pages, URLs, and export formats.

**Artifact types (v1):**
- Persona Card
- Behavior Spec (system prompt + constraints + rationale)
- Diff Log (two prompts compared, with outputs and notes)
- Eval Rubric + Scorecard
- Refusal Scorecard
- Case Study (composed of the above)

**Each artifact has:**
- A public URL: `shape.app/p/<user>/<slug>`
- A live, embeddable chat demo (so a hiring manager can talk to it)
- PDF export (for traditional portfolio submission)
- A portable JSON download (provider-agnostic, transferable)
- A "fork this" button

**Case Study template** scaffolds the structure UX portfolios already use:
1. Brief — what problem were you solving?
2. Approach — persona, voice, constraints
3. Iteration log — what you tried, what failed, what you learned
4. Evaluation — rubric and scores
5. Final artifact — embedded live demo
6. Reflection

## 6. MVP roadmap

### v0.1 — *Prove the vision*
- Homepage with full pitch + curriculum preview
- BYOK setup flow (Anthropic + OpenAI), keys in `localStorage`
- Magic-link auth (Supabase)
- Cost dashboard in header (tokens used, est. $, per-provider)
- **Diff Mode playground**
- Artifact pages with public URLs
- Single Notebook page per user

### v0.2
- Tone Dial + Persona Workshop playgrounds
- First Studio: *Research Interview Assistant*
- Module 1 of curriculum
- PDF export for artifacts

### v0.3
- Refusal Lab + Eval Workshop
- Curriculum modules 2–4
- Public profile pages
- "Fork this" on artifacts

### v1.0
- Full 8 playgrounds
- Curriculum modules 5–8
- Google + Ollama providers
- Gallery with curation
- Failure Museum

## 7. Playground catalog

| Playground | Teaches | Artifact produced |
|---|---|---|
| **Diff Mode** | Iteration; prompts as design variables | Diff Log |
| **Tone Dial** | Style as a design token | Behavior Spec |
| **Persona Workshop** | Character design for AI | Persona Card |
| **Refusal Lab** | Boundary design; over-/under-refusal | Refusal Scorecard |
| **Eval Workshop** | Rubric-based evaluation | Eval Rubric + Scorecard |
| **System Prompt Surgery** | Diagnosing prompt failures | (Exercise, not artifact) |
| **Failure Museum** | Pattern recognition | (Browsable gallery) |
| **Conversation Choreographer** | Multi-turn flow design | Behavior Spec |

## 8. Curriculum sketch — "Behavior Designer 101 → 301"

Eight modules. Each = concept reading + 1 playground + 1 mini-project + 1 artifact. Recommended path, never gated.

| # | Module | Playground | Mini-project |
|---|---|---|---|
| 0 | Setup: get your key | (BYOK walkthrough) | First successful call |
| 1 | Prompts as design | Diff Mode | Diff two onboarding messages |
| 2 | Voice & tone | Tone Dial | Tune a brand voice |
| 3 | Personas for AI | Persona Workshop | Build a persona card |
| 4 | Refusal & boundaries | Refusal Lab | Design refusal guidelines |
| 5 | Output formatting | (lightweight studio) | Structured output design |
| 6 | Evaluation | Eval Workshop | Build a rubric |
| 7 | Multi-turn flows | Conversation Choreographer | Choreograph a conversation |
| 8 | Putting it together | Studio project | Full case study |

---

## 9. Homepage draft

### Hero
> # Shape model behavior.
> **The behavior design playground for UX designers and researchers.**
> Learn the craft. Build a portfolio. Bring your own key.
>
> `[ Start shaping → ]`   `[ See the gallery ]`

### Section: You already think like a behavior designer
> Three-column layout. Each column has an icon and short copy:
>
> **You define personas.** *Now design one for the model itself.*
> **You write microcopy.** *Now write the system prompt that produces it.*
> **You run usability studies.** *Now run evaluations on AI behavior.*

### Section: How it works
> **1. Bring your key.** Plug in an Anthropic or OpenAI key. It stays in your browser — we never see it.
> **2. Shape something.** Open a playground. Tune a tone, design a persona, diff two prompts, or run a refusal test.
> **3. Publish a case study.** Every artifact gets a public URL, a live demo, and a PDF export. Add it to your portfolio.

### Section: Featured playgrounds
> Cards for Diff Mode (with a 3s looping demo), Tone Dial, Persona Workshop. "More playgrounds →" link to /play.

### Section: Learn the craft
> Pitch the curriculum. Show modules 0–8 as a path with progress dots. CTA: "Start Module 0 →"

### Section: Real work, real portfolios
> Pull 3 featured public artifacts from the gallery. Each is a clickable case study card.

### Footer
> About · Manifesto · Privacy (we never see your key) · GitHub

---

## 10. Diff Mode — v0.1 spec

### Purpose
Run the same prompt through two different configurations side-by-side. The configurations can differ in any of: system prompt, model, provider, temperature, or few-shot examples. Outputs render side-by-side with diff highlighting. The whole session can be saved as a public **Diff Log** artifact.

### User flow
1. User lands on `/play/diff`.
2. Two configuration panels (A and B) stack on the left. Each panel has:
   - Provider + model dropdown
   - System prompt textarea
   - Optional few-shot examples (add/remove)
   - Temperature slider
3. Shared user-message input at the bottom.
4. Hitting "Run" fires both configs in parallel. Outputs stream into A and B output panels.
5. Diff highlighting toggle: word-level diff between A and B.
6. User can run multiple turns; the session log builds up.
7. User adds notes/annotations to individual diffs.
8. "Publish as Diff Log" → opens a metadata form (title, summary, tags, visibility) → generates a public URL.

### UI sketch
```
+--------------------------------------+--------------------------------------+
|  CONFIG A                            |  CONFIG B                            |
|  Provider: Anthropic  Model: Opus   |  Provider: OpenAI  Model: GPT-4o    |
|  System prompt:                      |  System prompt:                      |
|  [ textarea ]                        |  [ textarea ]                        |
|  Temp: 0.7  [---o-----]              |  Temp: 0.7  [---o-----]              |
+--------------------------------------+--------------------------------------+
|  OUTPUT A                            |  OUTPUT B                            |
|  ...                                 |  ...                                 |
|  ...                                 |  ...                                 |
+--------------------------------------+--------------------------------------+
|  User message: [ ____________________________________________ ] [ Run ]    |
+----------------------------------------------------------------------------+
|  [ Toggle diff highlighting ]   [ Add note ]   [ Publish as Diff Log ]    |
+----------------------------------------------------------------------------+
```

### Provider transport (note)

- **Anthropic** supports direct browser calls via the `anthropic-dangerous-direct-browser-access: true` header; we call the API straight from the client.
- **OpenAI** is blocked by Cloudflare bot management for direct browser calls (preflight succeeds, POST returns `net::ERR_FAILED`). We proxy through a Next.js edge route at `/api/proxy/openai`. The user's key flows through in memory only — never logged or persisted. Same trust posture as the BYOK promise; one hop through Vercel Edge in between.

### Provider abstraction
A thin `providers/` module exposes one signature:

```ts
type ChatCall = {
  provider: 'anthropic' | 'openai';
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature: number;
  stream: true;
};

async function* runChat(call: ChatCall): AsyncIterable<string> { ... }
```

Provider-specific request shape lives inside each adapter. All calls happen client-side (the key is in `localStorage`); no server proxy. CORS is fine for both providers.

### Diff Log artifact (data model)

```ts
type DiffLog = {
  id: string;                // uuid
  owner: string;             // user id
  slug: string;              // url-safe
  title: string;
  summary: string;
  tags: string[];
  visibility: 'public' | 'private';
  configA: Config;
  configB: Config;
  turns: {
    userMessage: string;
    outputA: string;
    outputB: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

type Config = {
  provider: string;
  model: string;
  systemPrompt: string;
  fewShot: { role: string; content: string }[];
  temperature: number;
};
```

Stored in Supabase. Public URL: `shape.app/p/<user>/<slug>`. PDF export composed from the same data.

### Acceptance criteria
- A user with valid Anthropic + OpenAI keys can run a prompt through both, see streamed outputs in parallel, toggle word-level diff, save the session as a public Diff Log, and share the URL.
- The Diff Log page renders without auth and includes an embedded "try it yourself" mode (uses *visitor's* key, not author's).
- PDF export of a Diff Log is legible enough to drop into a portfolio.

---

## 11. Technical sketch

- **Framework:** Next.js (App Router) on Vercel.
- **Styling:** Tailwind + shadcn/ui.
- **Auth + DB:** Supabase. Lazy `getSupabase()` initialization to avoid SSR crashes.
- **Storage:** Supabase Postgres for artifacts. Supabase Storage for any uploaded media.
- **Keys:** `localStorage` only. Never sent to our server.
- **Streaming:** SSE / `fetch` streams direct to provider from the browser.
- **PDF export:** `html-to-image` (handles modern CSS that `html2canvas` chokes on) + jsPDF.
- **Public artifact pages:** SSG with on-demand revalidation; metadata + first response prerendered for OG previews.

## 12. Visitor demo (server-side pooled key)

Non-authors visiting a public artifact get **one-shot interactive demos** powered by a small server-side pooled key. This is the *only* place Shape uses a server key — it never touches authored work.

Constraints:
- Hard rate limits: 5 turns / artifact / IP / day; 50 turns / IP / day across the site.
- Single cheap model only (e.g. Claude Haiku or GPT-4o-mini) regardless of what the author used. Banner reads: *"Demo mode — running on Haiku. Bring your own key to use the original model."*
- Hard monthly $ cap with auto-shutoff. Visitors hit a "Demo limit reached — bring your own key →" CTA.
- Per-request server-side prompt budget cap (e.g. system + history truncated to N tokens) to prevent abuse.

Implementation: a single Next.js Route Handler `/api/demo` that proxies to whichever provider serves the cheap model, with IP-keyed rate limiting via Supabase or Upstash.

---

## 13. Next steps

- [ ] Lock answers to §12 open questions.
- [ ] Visual identity: pick a couple of font + color directions for Shape.
- [ ] Scaffold the Next.js project, Supabase project, and Vercel deployment.
- [ ] Build the BYOK flow + cost dashboard.
- [ ] Build Diff Mode end-to-end.
- [ ] Ship v0.1 to a friendly group of 5–10 designer/researcher beta users.
