# Backlog — parked ideas

Things we've deliberately decided *not* to build yet, with enough context to
pick them up later. Distinct from `tasks/todo.md` (historical scaffold log).

## Eval Lab — "Design a rubric" mode (inversion)

**From:** beta feedback (Linear), `/play/evals`, 2026-06-16.

**The idea:** Eval Lab today is *rubric application* — you define a rubric, run
a system prompt, and score the varying outputs against your fixed rubric. The
instrument is fixed; the outputs vary.

A beta tester proposed the **inversion** as the more pedagogically potent task:
give the learner a *fixed* set of model outputs (some clearly strong, some
weak) and make the experiment **designing a rubric that actually separates
them** the way human judgment would. Outputs fixed; rubric varies.

**Why it's interesting:** in real eval work the hard part isn't scoring — it's
deciding *what to measure*. Current Eval Lab teaches "rubrics make quality
measurable"; the inversion teaches "choosing the right criteria is the skill."

**Shape if we build it:** an Eval Lab **mode toggle** — "Apply a rubric"
(current) vs "Design a rubric" (seeded good/bad outputs + a "does your rubric
rank these correctly?" check) — mirroring the Independent/Conversation toggle
shipped for Diff Mode. Roughly a day.

**Decision:** Park. Good idea but a meaningfully different mode, not a tweak;
hold off on a single data point. Revisit if the theme recurs in feedback.

**Related meta-note from the same tester:** the playgrounds share components
(provider/model/temp row, save bar, etc.), which they liked but wondered if
consistency was constraining each playground's "native" design. Our read: the
shared levers are real and the coherence is intentional for a teaching tool —
no action, but worth holding as a north star when designing new surfaces.

## Provider models — fetch dynamically instead of hardcoding

**From:** building the Gemini integration (issue #117), 2026-07-17.

**The problem:** provider model IDs and pricing are hardcoded in
`lib/providers.ts`. That's fine for Anthropic/OpenAI (slow-moving), but Gemini
churned hard during its launch — key format (`AIza…` → `AQ…`), model IDs
(`gemini-2.5-*` retired for `gemini-3.x` on a ~quarterly cadence), and pricing
all shifted out from under our Jan-2026 assumptions. Each drift is a silent
break (a 404 on a run) until someone reports it.

**The idea:** for providers that expose a model-list endpoint (Gemini has
`GET /v1beta/models`; OpenAI has `/v1/models`), fetch the available models at
runtime and populate the picker from that, so retired IDs never reach a user.
Keep a small hardcoded fallback for offline/first-paint and for pricing +
tier labels (the list endpoints don't return per-token pricing).

**Shape if we build it:** a cached client-side fetch on the settings/keys page
(and lazily in the model picker) that intersects the API's live model list
with our known pricing/tier metadata; unknown-but-live models still show
(without a cost estimate) rather than 404-ing. Anthropic/OpenAI can stay
static.

**Also park:** a recurring reminder to review provider pricing in
`lib/providers.ts` — the estimates drift and we currently only catch it by
eyeballing. The app already caveats "actual charges come from the provider,"
so this is polish, not correctness.

**Decision:** Park. The static IDs are correct as of 2026-07 and the "Save &
test" ping catches a bad key immediately; dynamic fetch is the durable fix but
a bigger change than the launch warranted. Revisit next time a model 404
surfaces in feedback.

## Custom OpenAI-compatible endpoints + aggregators (OpenRouter, endpoint selector)

**From:** beta feedback (Linear #122), `/play`, 2026-07-18 — "OpenRouter support
plus endpoint selector for allllll the models. Also Cerebras for speed."

**Shipped part:** Cerebras landed as a named provider (it's OpenAI-compatible,
small fixed model list, proxied like OpenAI) — that covers the "speed
comparison" ask directly, since Diff Mode's elapsed timer surfaces the
tokens/sec gap.

**Parked part — the general version:** OpenRouter and an arbitrary "endpoint
selector" are the same underlying feature: let the user point Shape's
OpenAI-compatible client at any base URL (OpenRouter, Groq, Together, a local
LM Studio, …) with their own key + model. The adapter is mostly reuse
(`openai-compatible.ts` already generalizes URL + key header).

**Why it's parked, not built:** OpenRouter's whole value is *breadth* —
hundreds of models — so hardcoding a model list is untenable. Doing it well
**requires the dynamic model-list fetch parked above** ("Provider models —
fetch dynamically"). They're one project: a custom-endpoint provider whose
model picker is populated from the endpoint's `/models` response, with pricing
unknown (aggregators pass through varied rates) so cost estimates degrade
gracefully to "—". Also needs per-endpoint CORS-vs-proxy handling and a UX for
entering base URL + key + model.

**Decision:** Park the general endpoint-selector/OpenRouter piece; build it
together with dynamic model fetching. Cerebras (the bounded, speed-focused
slice) shipped now.

## Part II — advanced curriculum (modules 08–11 + three demos)

**From:** design conversation, 2026-08-10 — "what would next-level lessons and
demos look like, for folks who understand what we already have on the site?"

**Numbering note:** this arc was first sketched as modules 09–12, assuming Part
I ran through a Module 08 capstone. That capstone went away with the Build /
Studio section (#75), so live Part I ends at 07 and Part II starts at **08**.

**Where the current ceiling is:** modules 01–08 all sit inside one frame —
*the model is a surface you style*. Write a system prompt, read an output,
judge it. Voice, persona, refusal, format, even multi-turn: the designer
controls the instruction, the model produces text, the designer evaluates
n=1. That frame is the right first course, and it's also the first thing that
breaks in real work.

**The Part II frame shift:** the model is a *system* you can't fully control,
that *acts*, *in time*, on *context you supplied without realizing it*. Every
module below should open by breaking something the reader already believes —
these are for people who finished Part I, so none of them should re-teach.

### Module 08 — Distributions, not outputs — **BUILT**

*You already know how to write a prompt and read the output. You've been
designing against n=1 the whole time.*

The real object isn't an output, it's a distribution. Run a Module 02 tone
spec ten times and watch which clauses hold and which are coin flips. Design
for the 10th-percentile response, not the one that got screenshotted for the
deck. Temperature stops being a mystery slider and becomes a spread control.

- **Playground: Spread** — shipped, see `SPEC.md` §14. Article shipped at
  `/learn/distributions-not-outputs`.
- **Artifact: Stability Report** — which lines of your Behavior Spec survive
  resampling.

### Module 09 — Context is the interface — **BUILT**

*You already know the system prompt is a design surface. It's maybe 10% of
what the model reads.*

Retrieved docs, tool results, prior turns, pasted user content, memory. The
designer's real job is composing what the model *sees* — an IA problem, not a
copywriting one. The demo that lands it: same question, three context payloads
(nothing / a good doc / a stale contradicting doc). The model confidently
repeats the stale doc in a perfect brand voice — a design failure wearing a
successful output's clothes. Prompt injection belongs here too: untrusted text
is just context you didn't author.

- **Playground: Context Lab** — shipped, see `SPEC.md` §17. Sources with trust
  tags and "tells", context sets, and a grounded / stale / injected /
  unsourced verdict per set.
- **Article** — shipped at `/learn/context-is-the-interface`.
- **Artifact: Context Map** — what's in the window, who authored it, how much
  to trust it.

### Module 10 — Designing agency — **BUILT**

*You already know how to shape what it says. Now it does things.*

The biggest genuine leap in the set. Tools, permission, initiative, repair.
When does it ask versus act? What happens when it's wrong halfway through? The
punchline designers rarely see coming: **a tool description is a prompt** —
you shape behavior by writing the docs the model reads about its own
capabilities.

- **Playground: Tool Bench** — shipped, see `SPEC.md` §18. Prompted tools with
  risk levels, per-scenario expectations, and seven outcomes ordered by who
  pays.
- **Article** — shipped at `/learn/designing-agency`.
- **Artifact: Agency Policy** — the ask/act boundary, written down.

### Module 11 — Judging at scale — **PLAYGROUND BUILT**

*You already built a rubric in Module 06. Now automate it, then discover your
judge is biased.*

LLM-as-judge, followed immediately by the calibration check: swap the order of
two answers, pad one with filler, watch the scores move. Teaching designers to
distrust the automation they just built is the most advanced idea on this list
and the one that transfers hardest back to non-AI work.

- **Playground: Judge Lab** — shipped, see `SPEC.md` §19. Built as its own
  playground rather than an Eval Lab mode: Eval Lab is a Part I module and
  shouldn't carry a calibration experiment for beginners. **Article still to
  write.**
- **Artifact: Calibrated Judge** — a judge prompt *plus* its known biases.

### Three demos (light, shareable, not full modules)

- **Race** — **BUILT**, see `SPEC.md` §15. Same prompt, two models, live, with
  time-to-first-token, throughput and cost. No paired article yet — it's a
  demo, not a module.
- **Portability** — **BUILT**, see `SPEC.md` §16. One spec across 2-4 models,
  with each clause classified portable / model-specific / unstable / not
  landing. No paired article yet — it shares Module 08 with Spread.
- **Reverse Tone Dial** — edit the output you want, model infers the dial
  positions. *Specification by demonstration*, and the natural Part II
  inversion of the whole curriculum: Part I writes a spec and reads an output;
  Part II writes an output and infers the spec. **Note the recurring theme** —
  this is the same move as the parked "Eval Lab — Design a rubric" inversion
  above. Inversion has now surfaced independently three times in feedback,
  which makes it the strongest single signal we have.

### Explicitly out of scope

Fine-tuning, RAG-as-a-technology, context-window trivia, agent frameworks. All
of it pulls the site toward "AI engineering tutorial" and away from what makes
it good. The designer's frame stays intact through every module above.

### Build cost, roughly

Race, Portability, and Spread are close to free — same provider layer, just
loop or fan out the existing call. Context Lab is a text-source panel plus
prompt assembly. Tool Bench is the only one needing real new plumbing
(tool-calling across the adapters, which differs meaningfully between
Anthropic, OpenAI, and Gemini).

**Decision:** Park as a set, don't commit to the whole arc yet. If we want a
cheap proof that Part II has legs, **Race** or **Spread** ships fastest and
demos hardest — build one, watch whether Part I readers actually come back for
it, and let that decide whether the four modules get written.


## Native tool-calling across providers

**From:** building Tool Bench (Module 10), 2026-08-11.

**What shipped instead:** Tool Bench describes tools in the prompt and parses a
one-line decision out of the reply. That was chosen deliberately — it makes
"a tool description is a prompt" visible and editable, and it works on every
provider including the in-browser models that keep Shape usable without a key.

**The parked piece:** real function calling through each provider's API.
Anthropic `tool_use` content blocks, OpenAI's `tool_calls` deltas (arguments
arrive fragmented across chunks), Gemini `functionDeclarations`, Cerebras via
the OpenAI-compatible path. Needs a new `ChatEvent` variant, a `tools` field
on `ChatCall`, and a multi-turn loop that feeds stubbed tool results back so
the model can continue.

**Why it's parked:** it's several days of adapter work, it can't run on WebLLM
at the sizes we ship, and it would *hide* the lesson rather than sharpen it —
the descriptions move from the prompt into an API parameter the designer can't
see. Worth doing once the playground's design has proven itself, and worth
bundling with the other provider work parked above.

**Would also unlock:** multi-turn repair, which Tool Bench v0.1 leaves out —
what the model does when an action fails or returns something unexpected.
