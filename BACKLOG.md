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

## Tone Dial — reverse mode (edit the output, infer the dials)

**From:** beta feedback (Linear #118), `/play/tone`, 2026-07-16.

**The idea:** the Tone Dial runs forward today — set dials → compose a system
prompt → generate output. A tester proposed running it **backwards**: let the
user edit the output to read how they want, then have the model infer which
dial weights (warmth, verbosity, energy, directness, concreteness, structure)
and composed system prompt would produce that. "An element of recursive
learning and improvement."

**Why it's interesting — and why it's parked with a theme, not alone:** this
is the *same meta-pattern* as the Eval Lab "design a rubric" inversion above:
work from the desired result back to the configuration, instead of config →
result. Two different playgrounds, one recurring request. When the inverse
direction keeps surfacing across surfaces, it's pointing at a product
direction ("reverse mode" as a general capability) rather than three separate
bolt-ons.

**Shape if we build it:** the core is an inference loop — meta-prompt the model
to emit structured dial values (JSON matching `ToneValues`) that best match
the user's edited target, then snap the dials + composed prompt to them.
Real caveats: small in-browser (WebLLM) models are unreliable at structured
inference, so this likely needs a BYOK model to feel good; and the reverse-flow
UX (edit target → "infer settings" → review the diff the model proposes) needs
its own design. No clean surgical slice — the inference loop *is* the feature.

**Decision:** Park. Genuine v2 feature, not a launch patch. Third data point on
the "run the playground backwards" theme (Eval rubric inversion + this) —
worth a deliberate cross-playground design pass on "reverse mode" rather than
building it once per playground. Revisit alongside the Eval inversion.
