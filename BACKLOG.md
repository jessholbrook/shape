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
