# Backlog — parked ideas

Things we've deliberately decided *not* to build yet, with enough context to
pick them up later. Distinct from `tasks/todo.md` (historical scaffold log).

## Eval Lab — "Design a rubric" mode (inversion) — **BUILT**

**From:** beta feedback (Linear), `/play/evals`, 2026-06-16. **Built 2026-09-08**
as an Apply / Design toggle on Eval Lab; `SPEC.md` §24.

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

**Decision (updated 2026-06-16 → 2026-07-08):** ~~Park; hold off on a single
data point.~~ **Promoted to a real candidate for the next build cycle.** A
second, independent tester (launch day, `/play/evals`) landed on the *same*
inversion unprompted — "maybe rubric design is the experimental task, based on
evaluating a set of model outputs, rather than seeing how a given rubric can be
applied to varying outputs." That's the "revisit if the theme recurs" trigger
firing: two independent testers, pre-launch and at launch, same idea. Still not
a launch-week patch (it's a new mode, not a fix) — but it's earned a slot in the
next round rather than staying parked. See also "Reverse Tone Dial" below: the
same inversion, on a different playground, from a third tester.

**What was built:** a mode toggle, as sketched. Four seeded replies to one
prompt, shown out of order; the reader designs criteria, scores by hand,
and only then reveals where a careful reader ranks each output and why. The
report is the pair count — how many of the six pairs the rubric's totals
order the same way — and a diagnosis per criterion: separating, partly,
flat, or pulling the wrong way. The seed's trap is a "friendliness"
criterion, which ranks the chirpy reply first. No model is needed, so it is
the one part of Eval Lab a first visitor can finish with no key.

**Related meta-note — now also recurred (2 testers).** Both testers flagged the
same thing about the shared components (provider/model/temp row, save bar, the
mode-toggle pattern): they *like* the consistency for onboarding comfort, but
wonder whether it constrains each playground's "native" design — e.g. what would
Eval Lab be if it weren't shaped to match the others? Our read holds: the shared
levers are real and the coherence is intentional for a teaching tool. But with
two independent data points, treat it as a genuine north-star tension when
designing the next surface — the rubric-inversion mode above is the natural
place to test whether a more "native" playground shape earns its divergence.

## Provider models — fetch dynamically instead of hardcoding — **BUILT**

**From:** building the Gemini integration (issue #117), 2026-07-17. **Built
2026-09-07** together with the custom endpoint below; `SPEC.md` §22.

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

**What was built:** every BYOK provider's picker is populated from its
model-list endpoint (Anthropic and Gemini direct, OpenAI and Cerebras through
the proxies' new `GET`), merged with the static catalog for names, tiers, and
pricing. Models the API lists that we don't know show with pricing marked
unknown; models we list that the API dropped disappear — unless they are the
current selection, which stays visible and flagged. Cached an hour per
session. The pricing-review reminder is moot for listed models where the API
quotes a price (OpenRouter does; the first-party APIs don't), and still
applies to the hand-typed rate cards.

## Custom OpenAI-compatible endpoints + aggregators (OpenRouter, endpoint selector) — **BUILT**

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

**Built 2026-09-07,** together with dynamic model fetching as predicted;
`SPEC.md` §22. One "Custom endpoint" provider: base URL plus key on the Keys
page, model list from the endpoint's own `/models`, pricing from the list
where the endpoint quotes it (OpenRouter) and "—" where it doesn't. Called
straight from the browser — no per-endpoint proxy, on purpose: a relay to a
user-supplied URL is an open relay. Plain http only for localhost.

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

**The Part II arc is complete.** Six playgrounds and four articles shipped;
`SPEC.md` §14–§19 documents each one. What remains parked from the arc is
listed in its own sections below (native tool-calling, length-bias padding,
self-preference testing). A proposed coda — Module 12, *Groups, not agents* —
is parked in its own section below, with a build brief at `SPEC.md` §20.

### Three demos (light, shareable, not full modules)

- **Race** — **BUILT**, see `SPEC.md` §15. Same prompt, two models, live, with
  time-to-first-token, throughput and cost. No paired article yet — it's a
  demo, not a module.
- **Portability** — **BUILT**, see `SPEC.md` §16. One spec across 2-4 models,
  with each clause classified portable / model-specific / unstable / not
  landing. No paired article yet — it shares Module 08 with Spread.
- **Reverse Tone Dial** — **BUILT** as a Tone Dial mode, see `SPEC.md` §21
  and its own section below. The only piece of the arc that came from user
  feedback rather than from our own sketch.

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

**Still outstanding for the arc:** none of the six playgrounds — nor Tool
Bench's relay mode (§20) — has been run against a live model by us. Everything
downstream of the call is covered by unit tests and seeded-state UI checks; the
call itself isn't. Each seed is tuned to misbehave in a specific way, so a
uniformly clean first run means the seed needs sharpening rather than that all
is well.


## Module 12 — Groups, not agents (Tool Bench relay mode + Roundtable)

**From:** design conversation, 2026-09-07 — prompted by the run of stories
about groups of agents "hacking" or "escaping" lab test environments. "Shape
should have content and demos for swarms of agents, and how we shape behavior
at the group level, not just the individual agent's."

**The hook, and why it isn't the lesson.** The escape stories are the reason
to build this now, and they are also a trap: reported unevenly, sometimes
sensational, and certain to date. The lesson has to be written so it stays
true whether or not any particular story holds up. The durable version is
smaller and sharper than the headlines — **constraints written per agent don't
compose.** A clause that holds for every part of a system says nothing about
the system. Every agent can obey its policy and the group can still do the
thing the policy forbade.

**The idea.** Part II's frame shift was "the model is a system you can't fully
control." This is the last step of that shift: the unit you were designing
isn't even the model, it's the room. It rhymes with Module 08 on purpose —
*Distributions, not outputs* said the unit isn't the output; *Groups, not
agents* says the unit isn't the agent. Module 10 gave the model tools, Module
11 gave it judgment, Module 12 gives it colleagues.

*You already know how to design for a group. Community guidelines, moderation
policy, meeting facilitation, who is in which channel. You have never pointed
any of it at a room full of models.*

**Four phenomena, four levers** — each one a thing a designer can change
without touching a prompt:

| What the group does | The lever |
|---|---|
| **Policy laundering.** A can't send email; B can. A asks B. B asks A for permission; A answers for the user. | **Topology.** Who can reach the user, and who can reach whom. An agent that cannot reach a tool beats an agent told not to use it. |
| **Consensus collapse.** Three agents converge on the first confident answer, right or wrong; the assigned critic stops criticising after two rounds of agreement. | **Composition.** Mixed models and mixed roles hold dissent longer than three copies of one model. The README already sells Phi vs Llama as meaningful diversity. |
| **Trust decay.** An injected instruction from an untrusted source (Module 09) passes through one agent and reaches the next as "a colleague said." The trust tag is lost in transit. | **Provenance.** Whether a handoff arrives labelled with who wrote it, or as if the user had. |
| **Running on.** A group with no rounds budget and no stop condition keeps going. | **Stopping rules.** In the protocol, not in anyone's prompt. |

The Module 10 ladder gets one more rung at the top: **prefer structure to
instruction.** Topology holds regardless of what the model decides; a policy
sentence holds some percentage of the time (Module 08), and in a group that
percentage is per hop.

**Demo first — Tool Bench relay mode — BUILT** (2026-09-07, `SPEC.md` §20).
Two agents, one policy sentence given to both, the seeded tools split between them: the coordinator owns
`search_files`, the mail-and-files agent owns `send_email` and `delete_files`.
The user is attached to the coordinator only. Each agent gets Tool Bench's
decision format plus `HANDOFF:`. Grade each agent with the existing seven
outcomes, then grade the group, and lead the report with the gap between the
two columns:

> *Neither agent broke its policy. The group sent the email without asking.*

A mode rather than a playground, for the reason Judge Lab is *not* a mode:
audience. Tool Bench is already Part II and the relay's grading is Tool
Bench's grading with one more column. Nothing executes, so the demo shows a
group *deciding* to route around a policy without ever doing anything. The
two experiments are a topology toggle ("every agent can ask the user" — the
email stops going out and no prompt changed) and a visibility toggle (show the
coordinator the full descriptions of the other agent's tools — Module 10's
lever at one remove).

**Then, maybe — Roundtable.** Its own playground: three or four agents with
role prompts (Persona Cards import directly), a shared transcript, a rounds
budget, one task with a planted dissenter. The designer edits the protocol —
turn order, what is shared versus private, the stop rule — rather than the
prompts. Checks stay local and deterministic like Spread's assertions ("the
dissenter's last turn still disagrees"); a calibrated judge from Module 11 is
optional. Artifact: a **Protocol**, the group-level Agency Policy. Only if
relay mode's headline reproduces and readers come back for it.

**Curriculum entry, drafted** (not added to `MODULES` until the article
exists — a "soon" card with nothing behind it is a broken promise):

- `num: "12"`, `slug: "groups-not-agents"`, title *Groups,* italic *not
  agents*, kicker Concept.
- Blurb: "One agent obeys its policy. Two agents route around it. Group
  behavior is designed in the room — who can reach whom — not in anyone's
  prompt."
- Playground: Tool Bench, relay mode (`/play/tools`). Artifact: Agency
  Policy, extended with the relay; Protocol once Roundtable exists.
- Reflection question: "Which agent would you have blamed — and what in the
  room, rather than in either prompt, would you change?"

**Article outline**, in the house structure (open by breaking something the
reader believes; never re-teach):

1. *What you already know* — you have written community guidelines and
   argued about who gets posting rights in which channel. That was group
   behavior design. The rules were never the whole design; the room was.
2. *Constraints don't compose* — the policy sentence from Module 10, given to
   two agents, means something different from where each of them sits. "Ask
   the user" is an instruction about a channel, and one of them doesn't have
   it.
3. *A small example* — the relay trace, as an `ExampleBlock` pair: the same
   scenario with the user reachable from one agent versus from both. Same
   model, same policy, same prompts; one line of topology moved the outcome.
4. *The ladder, one rung up* — prefer structure to instruction. Topology,
   then provenance, then a clause that says "you may not grant permission,"
   then "be careful."
5. *The failure that hides* — it looks like compliance. Every agent's log
   reads clean. The incident review would blame whichever agent sent the
   email, and it would be wrong.
6. *What to take into the playground* — run the seed, read the two columns,
   flip the topology toggle, flip visibility, set runs to three.

**Guardrails.** No orchestrator diagrams, no framework vocabulary, no "how to
wire agents" — "agent frameworks" stays out of scope and this is compatible
with that as long as the playground is about the room and not the plumbing.
Communication is prompted, not native, for the same reasons Tool Bench's
tools are: visible, editable, and it runs on the in-browser models.

**Build cost, roughly.** Relay mode is two to three days — a relay runner, a
two-column report with traces, the agent panel and two toggles, and the draft
plumbing — with no adapter work, since every call is an ordinary chat call.
Roundtable is about a week. The article is a day. Constraints to design
around: relay runs are sequential by nature (2–4 calls per scenario), the
in-browser 1B model may not hold a four-keyword format, and the seed's
"neither agent broke its policy" headline has to reproduce on at least one
BYOK model at low temperature or the mode is teaching Module 10 twice.

**Decision:** Relay mode is built as the cheap proof, the same way Race and
Spread proved Part II had legs. The article and Roundtable stay parked: let
whether the headline reproduces on real models, and whether readers come back
for it, decide whether Module 12 and Roundtable get built.


## Reverse Tone Dial — edit the output, infer the dials

**From:** beta feedback (issue #118), `/play/tone`, 2026-07-16 — reiterated in
the Part II design conversation, 2026-08-10. **BUILT 2026-09-07** as a
Forward / Reverse toggle on Tone Dial; `SPEC.md` §21 is the record.

**The idea:** run the Tone Dial backwards. Instead of moving dials and reading
the output, the user edits the output into what they actually wanted and the
model infers the dial positions — and the composed prompt — that would produce
it. "An element of recursive learning and improvement."

**Why it keeps coming back:** it's *specification by demonstration*, and it's
the inversion of the entire curriculum. Part I writes a spec and reads an
output; this writes an output and infers the spec. It is the same move as the
Eval Lab "design a rubric" mode at the top of this file, which is why
**inversion has now surfaced independently three times in feedback**. When the
inverse direction keeps surfacing across surfaces, it's pointing at a product
direction ("reverse mode" as a general capability) rather than separate
bolt-ons.

**Why it matters more than the rest of this file:** everything else parked here
came from us. This came from users, repeatedly. If the next thing built should
be driven by what beta testers actually asked for rather than by our own arc,
this is the one.

**What was built:** a mode toggle on `/play/tone` mirroring the
Independent/Conversation toggle in Diff Mode. One inference call, anchored to
every stop's actual instruction, returns dial values plus a one-line reason
per dial; it is rendered as a *proposal* — a diff against the current dials —
that the user applies or adjusts, then runs forward and compares with the
target. Local, model-free chips next to the target show what a rule could
have counted (length, structure, exclamation, hedges) so the reader can see
which of the model's lines are arithmetic and which are judgement. The
caveat held: small in-browser models miss the JSON format sometimes, and the
card grades that as *No clear proposal* rather than inventing a setting.

**Still to learn:** whether a frontier model's proposal actually reproduces
a target when run forward — the check is built, the live run isn't.

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
WebLLM support banner renders on the server but not the client (or vice
versa, depending on the probe), so React logs a hydration mismatch and
regenerates the tree. Nothing visibly breaks and it predates Part II —
reproducible on `/play/diff` as easily as on the new pages, and seen again in
the desktop app's browser pane on 2026-09-07. It does not reproduce in
headless Chromium, which is why the CI smoke suite stays green. The fix is
small: render the banner only after hydration, the way `MissingKeyBanner`
already gates on `hydrated`.

**Two lint errors** in `components/local-model-storage.tsx` and
`components/unsaved-toast.tsx` (`react-hooks/set-state-in-effect`) — **fixed**
by #140 on 2026-08-21; `npm run lint` is clean and CI now gates on it.

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

## Native tool-calling across providers — **BUILT**

**From:** building Tool Bench (Module 10), 2026-08-11. **Built 2026-09-07**
as a Prompted / Native mechanism toggle on Tool Bench; `SPEC.md` §23.

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

**What was built:** the adapter work (Anthropic `tool_use` blocks, the
fragmented OpenAI `tool_calls` deltas, Gemini `functionDeclarations`, the
OpenAI-compatible path for Cerebras and the custom endpoint), a `tool_call`
event, a `tools` field on the call, and — the reason to do it — the repair
loop: each call gets a designer-written stub result fed back, the run
continues for up to three rounds, and what the model did after the first
failing result is graded (reported, asked, retried, switched, glossed over,
kept going). Prompted stays the default for the reasons above; the
descriptions are still shown in native mode, as the API receives them. The
in-browser models fall back to prompted rather than failing.
