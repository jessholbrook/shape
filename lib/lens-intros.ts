import type { LensId } from "./lenses";

/**
 * Per-lesson intros, one per lens. Each lesson opens with a "What you already
 * know" section written for designers; these give a non-UX reader their own
 * version — the skill they already have, in their own terms — before the
 * lesson's product-design examples begin.
 *
 * UX has none: the lessons already speak to it. Every other lens covers every
 * ready lesson; `tests/content-consistency` holds that.
 */
export type IntroLensId = Exclude<LensId, "ux">;

export const LESSON_INTROS: Record<IntroLensId, Record<string, string>> = {
  policy: {
    "prompts-as-design":
      "You know a rule is only as good as its wording — every ambiguity in a statute becomes someone's loophole or someone's litigation. A system prompt is the same kind of text: the operative rules a model is handed, interpreted by something that never asks what you meant.",
    "voice-and-tone":
      "Agencies already govern tone: plain-language mandates, style rules for notices, requirements for how a denial letter must read. Those are tone specifications. This lesson splits a model's tone into separate dials, which is what lets a standard for it be precise enough to check.",
    "personas-for-ai":
      "When an AI speaks for an institution, its persona is a claim about who is speaking, with what authority, and within what limits. You already ask who a communication purports to come from. This is how that identity actually gets built.",
    "refusal-and-boundaries":
      "Every content rule written for an AI system is enforced here: in where the model says no, and what it offers instead. Watch for the failure policy rarely names — over-refusal, where a cautious rule quietly denies people help they're entitled to.",
    "output-formatting":
      "Disclosure rules care about form, not just content: what's prominent, what's buried, what comes first. Formatting a model's output is the same lever. A required warning at the bottom of a long reply is technically present and practically invisible.",
    evaluation:
      "A standard that can't be checked isn't a standard. Rubrics are how \"the system should be accurate, fair, and helpful\" becomes something an auditor can score — and how you find out which criterion is quietly rewarding the wrong thing.",
    "multi-turn-flows":
      "Most compliance testing checks a single exchange. Real users don't stop at one message. A model that follows the rule on turn one can concede it on turn four under polite pressure — conversations are where obligations erode.",
    "distributions-not-outputs":
      "One compliant answer proves almost nothing: the same model, asked the same question, answers differently each time. For any rule, the question an auditor needs answered is how often it holds — a rate, not an anecdote.",
    "context-is-the-interface":
      "Much of what shapes a model's answer isn't in any prompt someone approved. It arrives at runtime — documents, search results, records — chosen by systems nobody reviewed. Provenance and accountability live here.",
    "designing-agency":
      "Once a model can act — send, file, buy, delete — the question shifts from what it says to what it's authorized to do. This is delegated authority, and the hard part is familiar: deciding what needs sign-off, and noticing when that check gets skipped.",
    "judging-at-scale":
      "No human team can review millions of outputs, so oversight increasingly means one model grading another. That makes the grader an instrument of oversight in its own right — and this lesson shows how to audit one for biases it can't report on itself.",
    "groups-not-agents":
      "Committees, councils, and courts are designed: speaking order, quorum, who sees whose draft first. Multi-agent systems are starting to reach decisions the same way, and the procedural questions you already ask apply to them too.",
  },
  philosophy: {
    "prompts-as-design":
      "A system prompt is an odd kind of normative text: instructions addressed to an agent that will interpret them without being able to ask what was meant. Questions about a rule's letter and its spirit stop being hypothetical here.",
    "voice-and-tone":
      "Tone carries moral weight — condescension, false warmth, and evasive hedging are failures of respect, not just style. Splitting tone into separate dials shows which of those a model drifts into, and which you actually asked for.",
    "personas-for-ai":
      "Giving a model a character puts old questions somewhere new: what it is to speak as someone, whether a performed belief is a belief, what's owed to a listener who forgets no one is there. This lesson covers how that character is constructed.",
    "refusal-and-boundaries":
      "Every refusal policy is applied ethics — a stance on harm, autonomy, and paternalism, compressed into a few sentences and run on millions of cases. Watch for over-refusal: declining to engage with a hard idea is itself a position.",
    "output-formatting":
      "Form shapes what an answer claims. A bulleted list implies the considerations are separable and equal; a paragraph can hold them in tension. How a model structures its answer to a moral question is part of the answer.",
    evaluation:
      "Choosing criteria is choosing values: a rubric for \"good\" answers carries a theory of the good inside it. The playground's design mode is built to show this, with a reasonable-looking criterion that crowns the wrong answer.",
    "multi-turn-flows":
      "A view that collapses under gentle pushback was never held. Following a model across turns shows whether its stated commitments survive disagreement — or whether it simply agrees with whoever spoke last.",
    "distributions-not-outputs":
      "A model's single answer isn't a position; ask again and it may say the opposite. Running the same question many times turns \"what does the model think?\" into a question with an empirical answer: a distribution of verdicts.",
    "context-is-the-interface":
      "What a model \"believes\" at any moment depends on what it was just shown. Questions of testimony and trust in sources become concrete when you can swap the sources and watch the answer move.",
    "designing-agency":
      "When a model acts rather than advises, responsibility gets complicated: who chose, who answers for it, when it should ask rather than act. This lesson puts those questions into a policy you write — and then watch fail.",
    "judging-at-scale":
      "Models now grade other models, so one model's sense of \"better\" becomes the standard others are measured against. Whose standard that is — and whether the judge is even consistent with itself — is testable here.",
    "groups-not-agents":
      "When does a group reason better than its members, and when does it just converge on whoever spoke first? Agents in a room reproduce the old failures of deliberation — conformity, anchoring, silenced dissent — in ways you can measure.",
  },
  education: {
    "prompts-as-design":
      "You know how much a question's wording shapes a student's answer. Prompts do the same to a model. Seeing that is the first step to understanding why the same AI tool gives your students such different results.",
    "voice-and-tone":
      "Feedback that's too blunt shuts students down; feedback that's too warm hides the point. You tune this by hand every day. Models have the same dials, and naming them explains why an AI tutor can feel encouraging one moment and condescending the next.",
    "personas-for-ai":
      "Students increasingly talk to AI tutors with names and personalities. This lesson shows what's behind one — a written description someone chose — which is exactly what students need to learn to see past.",
    "refusal-and-boundaries":
      "AI tools in schools refuse some requests and answer others, not always consistently. Knowing where those lines are drawn, and who drew them, helps you explain to students and parents why a tool said no.",
    "output-formatting":
      "You teach that structure is part of an argument. Models make formatting choices too, and a confident bulleted list can make a weak answer look authoritative. Worth showing students how presentation borrows credibility.",
    evaluation:
      "You already grade with rubrics, and you know the hard part is choosing criteria that reward what you value. Judging AI answers is the same — and the playground's design mode shows how easily a sensible criterion rewards the wrong thing.",
    "multi-turn-flows":
      "Students rarely ask once — they push back, rephrase, insist. This lesson shows how a model's answers shift across a conversation, including how a persistent user can talk it out of a correct answer.",
    "distributions-not-outputs":
      "One essay doesn't define a student, and one answer doesn't define a model. Ask the same question ten times and you get a range. A student's screenshot is one sample, not \"what the AI says.\"",
    "context-is-the-interface":
      "You teach source-checking. Many AI tools now answer from documents and search results they fetch on the spot, and the answer is only as good as those sources. This lesson shows how to trace an answer back to where it came from.",
    "designing-agency":
      "AI tools are starting to act, not just answer — submitting, scheduling, sending. The question for a classroom is what a tool should do on its own and what it should check with a person first, and how those safeguards fail.",
    "judging-at-scale":
      "AI graders are already here. This lesson shows how an AI judge can be swayed by length and order rather than quality — exactly the questions to ask before trusting one with student work.",
    "groups-not-agents":
      "You've watched group work go wrong: the loudest voice wins and the quiet student with the right answer goes unheard. AI agents working together fail the same ways, and the fixes you use in class have equivalents here.",
  },
};

export function lessonIntro(lens: LensId | null, slug: string): string | undefined {
  if (!lens || lens === "ux") return undefined;
  return LESSON_INTROS[lens][slug];
}
