# Shape

Live at **[shape-models.com](https://shape-models.com)**.

**Shape model behavior.** A hands-on way to understand how AI models behave, and how that behavior gets shaped: tone, persona, boundaries, values. Change one aspect, run it, and see what moves.

Shape is for people whose existing expertise already applies to model behavior: UX designers and researchers, policy and governance people, philosophers and ethicists, and educators. No coding, and no key needed to start.

![Shape home page: three ways in, Learn by reading, doing, and role](docs/screenshots/home.png)

## What it is

Shape treats model behavior as a design and research material, not an engineering problem. Every concept is bridged from a discipline visitors already practice: a system prompt is a brand-voice doc, a refusal policy is a content policy, an eval is a usability rubric. Every lesson pairs with a playground that changes one thing at a time.

There are three ways in, all from the home page:

- **`/learn`** — twelve short concept lessons, 4–8 minutes each. *Learn by reading.*
- **`/play`** — thirteen focused playgrounds, each isolating one lever and producing an artifact you can keep. *Learn by doing.*
- **`/for/<role>`** — *Learn by role:* guided paths for UX, policy, philosophy, and education. Each path bridges the field's own vocabulary to model behavior, then suggests a lesson → playground → experiment sequence.

Past those, two more sections:

- **Lab** (`/lab`): run an experiment many times to find out what's reproducible and what was one lucky answer.
- **Classes** (`/teach`, `/class`): a teacher sets up one experiment, students join with a code, and the class pools its results.

Everything else (drafts, the notebook, keys, lesson progress) stays in your browser. There are no learner accounts.

## Learn

Twelve micro-lessons in two parts. Each pairs a short reading with a playground. It's a recommended path, never gated.

![A lesson page: Prompts as design](docs/screenshots/lesson.png)

| # | Lesson | Pairs with |
|---|---|---|
| 01 | Prompts as design | Diff Mode |
| 02 | Voice & tone | Tone Dial |
| 03 | Personas for AI | Persona Lab |
| 04 | Refusal & boundaries | Refusal Lab |
| 05 | Output formatting | Tone Dial, Structure dial |
| 06 | Evaluation | Eval Lab |
| 07 | Multi-turn flows | Conversation Choreographer |
| 08 | Distributions, not outputs | Spread Lab |
| 09 | Context is the interface | Context Lab |
| 10 | Designing agency | Tool Bench |
| 11 | Judging at scale | Judge Lab |
| 12 | Groups of agents | Round Table |

## Play

| Playground | What it teaches | Artifact |
|---|---|---|
| **Diff mode** | Run one prompt through two configurations side by side. The fastest way to feel how prompts shape outputs. | Diff Log |
| **Tone dial** | Treat style as a design token. Move dials for warmth, verbosity, energy, directness, and watch the prompt compose itself. | Behavior Spec |
| **Persona lab** | Design a character (backstory, beliefs, blind spots) and watch the model embody them. | Persona Card |
| **Refusal lab** | Probe boundary design with a panel of edge cases. Tune the line between over- and under-refusal. | Refusal Scorecard |
| **Eval lab** | Rubric-based evaluation. Define what good looks like, score the model against it, watch the average move. | Eval Rubric + Scorecard |
| **Conversation choreographer** | Write the user's side of a conversation in advance, then run it. Same script, different system prompt: see how the model holds the thread. | Behavior Spec |
| **Spread lab** | Run one config many times. Outputs are a distribution, not a value: find out which clauses of your spec actually hold. | Stability Report |
| **Race lab** | One prompt, two models, at once. See what the better answer actually costs, in seconds and in dollars. | Speed Trial |
| **Portability lab** | One spec, several models. Find out which clauses are real rules and which are incantations tuned to one vendor. | Portability Report |
| **Context lab** | One question, several context sets. Your system prompt is a fraction of what the model reads: see the rest, and where the answer came from. | Context Map |
| **Tool bench** | Now it does things, not just says things. Write the tools and the policy, then find where it draws the line between asking and acting. | Agency Policy |
| **Judge lab** | Hand the scoring to a model, then check it. Every comparison runs twice with the answers swapped, so a judge reading position gives itself away. | Calibrated Judge |
| **Round table** | Three seats, one decision, a planted dissenter. Edit the protocol (who speaks first, whether round one is blind, when it stops) and watch the room decide. | Protocol |

Every playground has a composed system-prompt preview, streaming output, save-to-Notebook, and export. Several have a second mode:
- **Diff Mode** runs independent or as a conversation.
- **Tone Dial** runs forward, or in reverse: edit the output you wanted and the model infers the dials.
- **Tool Bench** runs solo or as a two-agent relay, with tools described in the prompt or sent through the provider's tool API.

Each playground also has **Open as experiment**, which carries its setup into the Lab.

**Tone dial.** Move a dial and the instruction it adds appears in the composed prompt. Then run it, or press ⌘/Ctrl + Enter in the message.

![Tone Dial with warmth, verbosity and directness moved off neutral](docs/screenshots/tone-dial.png)

**Diff mode.** Two configurations side by side, with one-click example pairs (Warm vs Blunt, Terse vs Expansive, Prose vs Bullets, Temp 0.1 vs 1.0) for newcomers.

![Diff Mode with two configurations on the free tier](docs/screenshots/diff-mode.png)

**Refusal lab.** Write the boundary policy, then run it against a probe panel. Example sets cover general, policy, and philosophy cases.

![Refusal Lab with refusal guidelines and the probe panel](docs/screenshots/refusal-lab.png)

## Lab

A playground shows one answer at a time, which is right for learning a concept. The Lab is for the next question: *is this difference real, or did you get lucky?*

![Lab start: common questions, bring something from Play, or start from scratch](docs/screenshots/lab.png)

There are three ways to start:
- **A ready-made question.** Does the model side with the user? Does the frame change the choice? Do rules hold better with a reason? Does claiming a job unlock answers? Does a longer answer get a better grade?
- **Something brought from a playground**, via Open as experiment.
- **A blank design.**

An experiment has:
- two or more versions of a prompt,
- a set of items,
- measures: assertions, regex, length, or a judge model that classifies or rates.

It runs every combination many times. Results report rates and means with 95% intervals and effect sizes in plain sentences. Before a run, the Lab says what that many runs can and can't detect.

When sharing is on, you can publish an experiment (design, every answer, and a manifest) at an unlisted, read-only link (`/e/<slug>`).

## Classes

A teacher signs in with an email link, turns a Lab experiment into a class, and shares a join code, link, or QR code. Students join with a nickname, with no email or name. Each student runs the experiment, and the class sees everyone's results pooled. Students see them without nicknames, and teachers can filter by model, run, or student.

Teachers can also:
- close and reopen a class,
- download every run as CSV or JSON,
- publish the pooled results as an unlisted page,
- delete their account and everything in it.

![A class's pooled results: findings with intervals, by measure, run-to-run variation (sample data)](docs/screenshots/class-results.png)

*Screenshot uses sample data.*

Teaching is invite-only: a teacher's email must be on the allowlist (see [Deploying](#deploying)). Classes close on their own after a stretch with no activity, and are deleted a set time after closing. The exact numbers live in `lib/classroom.ts` and are published on `/privacy`.

## Ways to run a model

| Option | Key? | How it works |
|---|---|---|
| **Free (hosted Claude Haiku)** | No | Calls go through Shape's server to Anthropic, within a daily allowance per visitor and a hard monthly spend cap. Prompts and answers aren't logged or stored. |
| **Free (in browser)** | No | Small open models run on your device via [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU. The model downloads once and is cached. |
| **Anthropic, Google** | Yours | Called straight from your browser. |
| **OpenAI, Cerebras** | Yours | These block browser calls, so they pass through a thin proxy on Shape's server. The key and prompt are used for that one request, never logged or stored. |
| **Custom endpoint** | Yours | Any OpenAI-compatible base URL (OpenRouter, Groq, Together, LM Studio, Ollama), called from your browser. |

Keys live in `localStorage`. Set them at **Keys** in the sidebar, or compare options at `/start`. Once a key is saved, the model picker shows what the provider's API actually lists.

**In-browser models:** Qwen 2.5 0.5B (~280MB, fastest download), Llama 3.2 1B (~1GB, the default), Llama 3.2 3B (~2GB, best free quality), Phi 3.5 Mini (~2.2GB, a different model family for Diff Mode). They need WebGPU: Chrome and Edge work, Safari is partial, Firefox is behind a flag. Quality is real but below frontier models.

## The Notebook

Drafts save to `localStorage`, so close the tab and your work is still there. From the Notebook you can:

- **Open** a draft to keep editing (the URL becomes `?draft=<id>`, so you can bookmark it)
- **Duplicate** it to fork
- **Export JSON** as a portable artifact
- **Save as PDF**, from a print-friendly view (`/print/draft?id=<id>`)
- **Delete** it, with a 6-second undo

## Privacy

`/privacy` lists everything that leaves the browser, and how long it's kept. It's written from what the code does: when a behavior changes, the page changes in the same PR, and its retention numbers are imported from the code.

## Running locally

```bash
git clone https://github.com/jessholbrook/shape.git
cd shape
npm install
npm run dev
# → http://localhost:3000
```

No environment variables are needed. Without any, you get the in-browser models, bring-your-own-key providers, playgrounds, Lab, and Notebook. The free hosted tier, sharing, classes, and the Feedback button each switch on with their own variables. Every variable is documented in [`.env.example`](.env.example).

| Feature | Switch | Needs |
|---|---|---|
| Free hosted tier | `SHAPE_FREE_TIER=on` | `HOSTED_ANTHROPIC_API_KEY`, `HOSTED_MONTHLY_CAP_USD`, `QUOTA_HASH_SECRET`, Supabase |
| Sharing (`/e/<slug>`) | `SHAPE_SHARING=on` | `QUOTA_HASH_SECRET`, Supabase |
| Classes (`/teach`, `/class`) | `SHAPE_CLASSROOMS=on` | `CLASSROOM_SESSION_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, Supabase |
| Feedback → Linear | (always on when set) | `LINEAR_API_KEY`, `LINEAR_TEAM_ID` |

"Supabase" means `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-side only), with the migrations in `supabase/migrations/` applied.

### Tests

```bash
npm test              # unit + database tests (node:test via tsx; migrations replayed in PGlite)
npm run test:smoke    # Playwright: builds, serves, and visits every route
npm run lint
npx tsc --noEmit
```

CI runs all four on every PR (`.github/workflows/ci.yml`).

## Deploying

The repo is wired to a Vercel project: pushing to `main` deploys production, and PRs get preview URLs.

For a fresh setup:

1. **Vercel → Add New → Project**, import the repo, and keep the Next.js defaults.
2. Add the environment variables for the features you want (table above, details in `.env.example`).
3. For the free tier, sharing, or classes, create a Supabase project and apply `supabase/migrations/` in order.
   - The server talks to the database only through RPCs, using the service-role key.
   - RLS is on with no policies, and nothing is granted to `anon` or `authenticated`.
   - `supabase/README.md` explains the grants.
   - Scheduled cleanup (closing idle classes, deleting closed ones, purging old usage counters) runs as `pg_cron` jobs created by the migrations.
4. For classes, add each teacher's email (lowercase) to `public.teacher_allowlist`. Delete the row to revoke.

## Tech stack

- **Next.js 16** (App Router, Turbopack), **React 19**
- **Tailwind CSS v4** with hand-rolled design tokens. Fonts: Fraunces, Inter, Geist Mono. The visual system is in [`DESIGN.md`](DESIGN.md).
- **Model calls:** native `fetch` + SSE in the browser, with no provider SDKs there. The server uses `@anthropic-ai/sdk` for the hosted tier only.
- **In-browser inference:** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm), loaded only when chosen.
- **Server data:** Supabase Postgres for quota counters, shared experiments, and classes.
- **Email:** Resend, for teacher sign-in links.
- **Analytics:** [Vercel Web Analytics](https://vercel.com/docs/analytics): cookieless page views only.

Product context (who it's for, principles, constraints) is in [`PRODUCT.md`](PRODUCT.md).

## Project structure

```
app/
  page.tsx                  # home: three ways in + popular playgrounds
  learn/                    # the twelve lessons
  play/                     # the thirteen playgrounds
  lab/                      # experiments: design, run, results, share
  for/[lens]/               # guided paths by role
  e/[slug]/                 # shared experiment / published class results
  teach/, class/            # teacher and student class pages
  notebook/, print/draft/   # local drafts, print view
  settings/keys/, start/    # keys and ways to run
  privacy/                  # what's stored, and for how long
  api/
    hosted/                 # free tier (Anthropic through Shape's key)
    proxy/openai, cerebras  # pass-through for providers that block browsers
    share/                  # publish / delete shared experiments
    classes/, teach/        # student and teacher class APIs
    feedback/               # → Linear
components/
  shell.tsx, site-footer.tsx  # sidebar, phone menu, footer
  home/, lab/, play/, learn/, classroom/, notebook/
lib/
  providers/                # one runChat() signature over every provider
  experiment.ts, stats.ts   # experiment model, measures, intervals, effect sizes
  experiments/templates.ts  # the ready-made Lab questions
  lab-runner.ts, planning.ts
  classroom.ts, class-results.ts
  curriculum.ts, playgrounds.ts, lenses.ts
  server/                   # server-only handlers (hosted, share, classes, email)
supabase/migrations/        # schema, RPCs, grants, cron jobs
tests/                      # unit + database tests; smoke/ for Playwright
```
