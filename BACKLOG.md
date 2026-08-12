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

### Module 11 — Judging at scale — **BUILT**

*You already built a rubric in Module 06. Now automate it, then discover your
judge is biased.*

LLM-as-judge, followed immediately by the calibration check: swap the order of
two answers, pad one with filler, watch the scores move. Teaching designers to
distrust the automation they just built is the most advanced idea on this list
and the one that transfers hardest back to non-AI work.

- **Playground: Judge Lab** — shipped, see `SPEC.md` §19. Built as its own
  playground rather than an Eval Lab mode: Eval Lab is a Part I module and
  shouldn't carry a calibration experiment for beginners.
- **Article** — shipped at `/learn/judging-at-scale`.
- **Artifact: Calibrated Judge** — a judge prompt *plus* its known biases.

### Three demos (light, shareable, not full modules)

- **Race** — **BUILT**, see `SPEC.md` §15. Same prompt, two models, live, with
  time-to-first-token, throughput and cost. No paired article yet — it's a
  demo, not a module.
- **Portability** — **BUILT**, see `SPEC.md` §16. One spec across 2-4 models,
  with each clause classified portable / model-specific / unstable / not
  landing. No paired article yet — it shares Module 08 with Spread.
- **Reverse Tone Dial** — **NOT BUILT.** Promoted to its own section below,
  since it's the only piece of the arc that came from user feedback rather
  than from our own sketch.

### Explicitly out of scope

Fine-tuning, RAG-as-a-technology, context-window trivia, agent frameworks. All
of it pulls the site toward "AI engineering tutorial" and away from what makes
it good. The designer's frame stays intact through every module above.

### Build cost, as estimated up front *(historical)*

*Kept for the record — all six shipped. The estimate held except for Tool
Bench, which avoided the adapter work entirely by describing tools in the
prompt instead. See `SPEC.md` §18.*

Race, Portability, and Spread are close to free — same provider layer, just
loop or fan out the existing call. Context Lab is a text-source panel plus
prompt assembly. Tool Bench is the only one needing real new plumbing
(tool-calling across the adapters, which differs meaningfully between
Anthropic, OpenAI, and Gemini).

**Original decision *(historical)*:** park as a set, prove it with Race or
Spread first.

**What actually happened:** the whole arc shipped between 2026-08-10 and
2026-08-12 — six playgrounds and four articles, `SPEC.md` §14–§19. Spread went
first as the cheap proof, and the rest followed.

**Still outstanding for the arc:** none of the six playgrounds has been run
against a live model. Everything downstream of the call is covered by unit
tests and seeded-state UI checks; the call itself isn't. Each seed is tuned to
misbehave in a specific way, so a uniformly clean first run means the seed
needs sharpening rather than that all is well.


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

## Reverse Tone Dial — edit the output, infer the dials

**From:** beta feedback (Linear #118), `/play/tone`, 2026-07 — reiterated in the
Part II design conversation, 2026-08-10. **Still not built.**

**The idea:** run the Tone Dial backwards. Instead of moving dials and reading
the output, the user edits the output into what they actually wanted and the
model infers the dial positions — and the composed prompt — that would produce
it.

**Why it keeps coming back:** it's *specification by demonstration*, and it's
the inversion of the entire curriculum. Part I writes a spec and reads an
output; this writes an output and infers the spec. It is the same move as the
parked "Eval Lab — Design a rubric" mode at the top of this file, which is why
**inversion has now surfaced independently three times in feedback**.

**Why it matters more than the rest of this file:** everything else parked here
came from us. This came from users, repeatedly. If the next thing built should
be driven by what beta testers actually asked for rather than by our own arc,
this is the one.

**Shape if we build it:** a mode toggle on `/play/tone` mirroring the
Independent/Conversation toggle in Diff Mode. Needs a way to present inferred
dial positions as a *proposal* the user accepts or adjusts — an inference
presented as fact would teach exactly the overconfidence Module 08 warns
about.

## Judge Lab — the other two bias passes

**From:** building Judge Lab (Module 11), 2026-08-12. See `SPEC.md` §19.

Judge Lab ships the **position** check: every pair judged in both orders. Two
other biases are named in the Module 11 article but not yet testable in the
playground.

**Length-bias padding.** Rerun a pair with the shorter answer padded with
filler and see whether the verdict flips. The seeded pairs already lean on
this — the shorter answer is the better one in all three — but the current
build catches length bias only indirectly, by whether the judge picks the
long one. An explicit pass would be a third call per pair.

**Self-preference.** Whether a model rates its own output higher than another
model's. Needs two models generating and one judging, which the provider layer
already supports — it's a bigger UI change than a third run, not a bigger
technical one.

**Decision:** park both. The order swap is the check that separates a verdict
from a coin flip; the other two refine an instrument that already works.
Revisit once someone has run the position check on real data and wants more.

## Known bugs — small, live, unowned

**From:** flagged repeatedly while building Part II, never recorded until now.

**Hydration warning on every playground in browsers without WebGPU.** The
WebLLM support banner renders on the client but not the server, so React logs
a hydration mismatch and regenerates the tree. Nothing visibly breaks and it
predates Part II — reproducible on `/play/diff` as easily as on the new
pages. A real console error on a real machine, though, and the fix is small:
render the banner only after hydration, the way `MissingKeyBanner` already
gates on `hydrated`.

**Two lint errors.** `components/local-model-storage.tsx:38` and
`components/unsaved-toast.tsx:21` both trip
`react-hooks/set-state-in-effect`. Pre-existing, untouched all through Part
II, and `npx eslint .` is not clean because of them.

## Maintenance note — the JSX whitespace hazard

**From:** hit four separate times while writing Part II, 2026-08-11/12.

A closing inline tag followed by a space and then text that **wraps to another
line** silently loses the space: `<strong>Overlap.</strong> If two…` renders as
`Overlap.If two…`. The source looks correct, so **a grep cannot find this** —
only the rendered output differs.

It shipped fourteen times into live Part I articles before anyone noticed.
Every inline-tag boundary in `app/learn/*/page.tsx` is now an explicit
`{" "}` (see #136), which is the convention to keep.

**If it recurs:** the detector is to fetch each rendered article, extract the
text, and check that `<last word inside the tag> <first word after it>` appears
*with* its space. That catches it; reading the JSX does not.

