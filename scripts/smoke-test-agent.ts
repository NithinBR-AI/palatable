// End-to-end smoke test for the real Negotiator agent + loop orchestration.
// Exercises: propose -> reject -> re-propose (the live negotiate/adapt mechanic).
// Run with: npm run smoke-test-agent

import "dotenv/config";
import { createConsensusState, runNegotiationRound, rejectRound, acceptRound } from "../lib/agents/loop";
import type { Participant } from "../lib/schema/state";

async function main() {
  const participants: Participant[] = [
    { id: "1", name: "Maya", tasteAnchors: [{ query: "Radiohead", type: "urn:entity:artist" }] },
    { id: "2", name: "Jordan", tasteAnchors: [{ query: "Nobu", type: "urn:entity:place" }] },
    { id: "3", name: "Sam", tasteAnchors: [{ query: "Katsuya", type: "urn:entity:place" }] },
  ];

  let state = createConsensusState(participants);

  console.log("--- Round 1: destination negotiation ---");
  let result = await runNegotiationRound(state, "destination");
  state = result.state;
  console.log(`Proposed: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);

  console.log("\n--- Rejecting it, re-negotiating ---");
  state = rejectRound(state);
  result = await runNegotiationRound(state, "destination");
  state = result.state;
  console.log(`New proposal: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);
  console.log(`(Excluded from this round: ${state.rejections.map((r) => r.entityName).join(", ")})`);

  console.log("\n--- Accepting it ---");
  state = acceptRound(state);
  console.log(`Locked destination: ${state.chosenDestination?.name}`);

  console.log("\n--- Round 2: venue negotiation, scoped to chosen destination ---");
  result = await runNegotiationRound(state, "venue");
  state = result.state;
  console.log(`Proposed: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);

  console.log("\nAgent smoke test complete.");
}

main().catch((err) => {
  console.error("Agent smoke test failed:", err);
  process.exit(1);
});
