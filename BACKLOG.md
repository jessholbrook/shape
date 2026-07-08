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

**Decision (updated 2026-06-16 → 2026-07-08):** ~~Park; hold off on a single
data point.~~ **Promoted to a real candidate for the next build cycle.** A
second, independent tester (launch day, `/play/evals`) landed on the *same*
inversion unprompted — "maybe rubric design is the experimental task, based on
evaluating a set of model outputs, rather than seeing how a given rubric can be
applied to varying outputs." That's the "revisit if the theme recurs" trigger
firing: two independent testers, pre-launch and at launch, same idea. Still not
a launch-week patch (it's a new mode, not a fix) — but it's earned a slot in the
next round rather than staying parked.

**Related meta-note — now also recurred (2 testers).** Both testers flagged the
same thing about the shared components (provider/model/temp row, save bar, the
mode-toggle pattern): they *like* the consistency for onboarding comfort, but
wonder whether it constrains each playground's "native" design — e.g. what would
Eval Lab be if it weren't shaped to match the others? Our read holds: the shared
levers are real and the coherence is intentional for a teaching tool. But with
two independent data points, treat it as a genuine north-star tension when
designing the next surface — the rubric-inversion mode above is the natural
place to test whether a more "native" playground shape earns its divergence.
