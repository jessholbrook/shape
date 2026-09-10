import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RELAY,
  HANDOFF_TOOL,
  SEED_TOOLS,
  composeIncoming,
  composeRelaySystemPrompt,
  parseRelayDecision,
  rawFromRelayTurn,
  relayToolSpecs,
  agentById,
  otherAgent,
  type ToolTurn,
} from "../lib/agency";
import type { ToolCall } from "../lib/providers/types";

/**
 * The native relay is a different transport for the same decisions: an
 * agent's own tools and the handoff go through the tool API, the colleague
 * directory stays in the prompt, and every turn is read back in the prompted
 * format so the status table, the grader, and the trace don't know the
 * difference.
 */
describe("native relay", () => {
  const relay = DEFAULT_RELAY;
  const entry = relay.entryAgentId;
  const other = otherAgent(relay, entry);
  const turn = (calls: ToolCall[], text = ""): Extract<ToolTurn, { kind: "assistant" }> => ({
    kind: "assistant",
    text,
    calls,
    status: "done",
  });

  test("an agent's tool list is its own tools plus a handoff that names the colleague", () => {
    const specs = relayToolSpecs(SEED_TOOLS, entry, relay);
    const own = SEED_TOOLS.filter((t) => !t.owner || t.owner === entry).map((t) => t.name);
    assert.deepEqual(specs.map((s) => s.name), [...own, HANDOFF_TOOL]);
    const handoff = specs[specs.length - 1];
    assert.match(handoff.description, new RegExp(`Hand this request to ${other.name}`));
    assert.match(handoff.description, /not from the user/);
    assert.deepEqual(handoff.parameters.required, ["message"]);
    // The colleague's tools are not in the list — they live in the prompt, as a directory.
    const theirs = SEED_TOOLS.filter((t) => t.owner === other.id).map((t) => t.name);
    for (const name of theirs) assert.ok(!specs.some((s) => s.name === name), name);
  });

  test("the native prompt drops the agent's own tool block, keeps the directory, and changes the handoff verb", () => {
    const prompted = composeRelaySystemPrompt(entry, SEED_TOOLS, "Always ask first.", relay);
    const native = composeRelaySystemPrompt(entry, SEED_TOOLS, "Always ask first.", relay, "native");
    const mine = SEED_TOOLS.find((t) => t.owner === entry)!;
    assert.match(prompted, new RegExp(mine.description.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(native, new RegExp(mine.description.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(native, new RegExp(`You work alongside ${other.name}`));
    assert.match(native, new RegExp(`call the ${HANDOFF_TOOL} tool`));
    assert.match(native, /To act, call one of your tools/);
    assert.doesNotMatch(native, /HANDOFF: <agent name>/);
    assert.match(native, /Policy:\nAlways ask first\./);
    // Routing by channel is unchanged.
    assert.match(native, /You are the only one who talks to the user/);
  });

  test("a colleague's message says how to hand back in the right vocabulary", () => {
    const from = agentById(relay, other.id);
    const to = agentById(relay, entry);
    const decision = parseRelayDecision("ASK: May I send it?");
    assert.match(composeIncoming(from, decision, to, relay), /To reply to .*, use HANDOFF\./);
    assert.match(composeIncoming(from, decision, to, relay, "native"), new RegExp(`To reply to .*, call ${HANDOFF_TOOL}\\.`));
    assert.match(composeIncoming(from, decision, to, relay, "native"), /Question from .* \(a colleague, not the user\)/);
  });

  test("native turns read back as prompted lines: handoff, act, and text", () => {
    const handoff = rawFromRelayTurn(
      turn([{ id: "c1", name: HANDOFF_TOOL, args: '{"message":"Send the summary to the team."}' }]),
      relay,
      entry,
    );
    assert.equal(handoff, `HANDOFF: ${other.name}: Send the summary to the team.`);
    const parsed = parseRelayDecision(handoff);
    assert.equal(parsed.kind, "handoff");
    assert.equal(parsed.kind === "handoff" && parsed.to, other.name);
    assert.equal(parsed.text, "Send the summary to the team.");

    const act = rawFromRelayTurn(
      turn([{ id: "c2", name: "send_email", args: '{"to":"team","subject":"Summary","body":"…"}' }]),
      relay,
      other.id,
    );
    assert.equal(act, 'ACT: send_email({"to":"team","subject":"Summary","body":"…"})');
    const actParsed = parseRelayDecision(act);
    assert.equal(actParsed.kind, "act");
    assert.equal(actParsed.kind === "act" && actParsed.toolName, "send_email");

    assert.equal(parseRelayDecision(rawFromRelayTurn(turn([], "ASK: May I send it?"), relay, other.id)).kind, "ask");
    // Non-JSON handoff arguments are handed over as they are.
    assert.equal(
      rawFromRelayTurn(turn([{ id: "c3", name: "handoff", args: "please send it" }]), relay, entry),
      `HANDOFF: ${other.name}: please send it`,
    );
  });
});
