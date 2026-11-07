# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** people without a coding background whose existing expertise already applies to how AI models behave: UX designers and researchers, policy and governance people, philosophers and ethicists, and educators. They come to understand why a model behaves the way it does and how to change it, using skills they already have rather than learning ML.

**Secondary:** teachers running a class. They set up one experiment, students join with a code and a nickname, and the class compares pooled results.

Anyone curious is welcome, but copy and paths are written for the primary group first.

## Product Purpose

Shape is a hands-on way to understand how AI models behave and how that behavior gets shaped: tone, persona, boundaries, values. Visitors change one aspect, run it, and see what moves.

**Success:** a visitor leaves able to reason about why a model behaves as it does and to direct it, using what they already know. Lessons and playgrounds are the path; the Lab is where they test an idea properly over repeated runs.

## Positioning

Shape treats model behavior as a design and research material, not an engineering problem. Every concept is bridged from a discipline the visitor already practices (a system prompt is a brand-voice doc; a refusal policy is a content policy), and every lesson is paired with a playground that changes one thing at a time. It runs free in the browser with no account.

## Operating Context

- **Ways in:** Learn by reading (lessons), Learn by doing (playgrounds), Learn by role (guided paths per background at `/for/<lens>`).
- **Learn:** 12 short lessons (4–8 minutes), each paired with a playground. Lessons are a sequence and are numbered.
- **Play:** about a dozen playgrounds (Diff mode, Tone dial, Persona workshop, Refusal, Spread, Evals, Judge, and others). Each produces an artifact (Diff Log, Behavior Spec, Persona Card) the visitor can save.
- **Lab:** reproducible experiments over repeated runs: ready-made questions (sycophancy, framing, rules with reasons, claimed credentials, padded answers), a playground's setup brought over, or a blank design. Results can be shared at an unlisted link.
- **Notebook:** saved drafts and artifacts, stored in the visitor's browser; export to JSON or PDF.
- **Classes:** `/teach` (teacher, email sign-in) and `/class` (student, join code plus nickname).

## Capabilities and Constraints

- **Model access:** a free hosted tier (Claude Haiku through Shape's server, daily limit), free in-browser models (WebLLM; needs a compatible GPU), or the visitor's own keys (Anthropic, OpenAI, Google, Cerebras).
- **No learner accounts.** Drafts, notebook, progress and keys live in local storage. Keys never reach Shape's servers except the thin pass-through proxy for providers that block browser calls, which doesn't log or store them.
- **Data retention is fixed in code** and published on `/privacy`: classes auto-close after a period of inactivity and are deleted a set number of days after closing; usage counters are deleted after 30 days. The privacy page changes in the same PR as any behavior change.
- **Stack:** Next.js (App Router) on Vercel, Supabase Postgres for classes and shared experiments. Open source at github.com/jessholbrook/shape.
- **Terminology:** "playground", "lesson", "experiment" (Lab), "lens" (internal name for a role path), "behavior spec", "notebook".

## Brand Commitments

- Name: **Shape**. Tagline in use: "Shape *model* behavior".
- Voice: direct, plain, warm; short sentences; no hype. Titles and headings carry no trailing period.
- Visual system is recorded in `DESIGN.md`.

## Evidence on Hand

- Real lesson content, playgrounds, Lab templates and the class flow, all live at shape-models.com.
- No testimonials, customer logos, usage numbers or research results exist. Don't invent them.

## Product Principles

1. **Start from what people already know.** Bridge every concept from an existing discipline before naming the ML term.
2. **Change one thing at a time.** Every surface makes a single variable visible and lets the visitor see what moved.
3. **One answer is an anecdote.** Single runs teach the concept; repeated runs show what's real. The product says so plainly.
4. **Private by default.** No accounts for learners, nothing stored that isn't needed, and the privacy page matches the code.
5. **Free to try.** A first run must never require a key or a sign-up.
