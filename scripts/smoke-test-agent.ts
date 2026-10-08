// End-to-end smoke test for the full 3-agent loop (Negotiator + Advocate + Skeptic).
// Exercises: propose -> critique -> revise (internal) -> reject -> re-propose -> accept -> venue round.
// Run with: npm run smoke-test-agent

import "dotenv/config";
import { createConsensusState, runNegotiationRound, rejectRound, acceptRound } from "../lib/agents/loop";
import type { Participant } from "../lib/schema/state";

async function main() {
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const participants: Participant[] = [
    { id: "1", name: "Diego", tasteAnchors: [{ query: "Coltrane", type: "urn:entity:artist" }, { query: "Le Bernardin", type: "urn:entity:place" }] },
    { id: "2", name: "Priya", tasteAnchors: [{ query: "Parasite", type: "urn:entity:film" }, { query: "Supreme", type: "urn:entity:brand" }] },
    { id: "3", name: "Kai", tasteAnchors: [{ query: "Solange", type: "urn:entity:artist" }, { query: "Nobu", type: "urn:entity:place" }] },
  ];

  let state = createConsensusState(participants);

  console.log("--- Round 1: destination negotiation ---");
  let t1 = Date.now();
  let result = await runNegotiationRound(state, "destination");
  state = result.state;
  console.log(`[${elapsed()} | round: ${((Date.now() - t1) / 1000).toFixed(1)}s]`);
  console.log(`Proposed: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);
  console.log(`Advocate: [${result.round.advocateResult?.verdict}] ${result.round.advocateResult?.reasoning}`);
  console.log(`Skeptic:  [${result.round.skepticResult?.verdict}] ${result.round.skepticResult?.reasoning}`);

  console.log("\n--- Rejecting it, re-negotiating ---");
  state = rejectRound(state);
  t1 = Date.now();
  result = await runNegotiationRound(state, "destination");
  state = result.state;
  console.log(`[${elapsed()} | round: ${((Date.now() - t1) / 1000).toFixed(1)}s]`);
  console.log(`New proposal: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);
  console.log(`Advocate: [${result.round.advocateResult?.verdict}] ${result.round.advocateResult?.reasoning}`);
  console.log(`Skeptic:  [${result.round.skepticResult?.verdict}] ${result.round.skepticResult?.reasoning}`);
  console.log(`(Excluded from this round: ${state.rejections.map((r) => r.entityName).join(", ")})`);

  console.log("\n--- Accepting it ---");
  state = acceptRound(state);
  console.log(`Locked destination: ${state.chosenDestination?.name}`);

  console.log("\n--- Round 2: venue negotiation, scoped to chosen destination ---");
  t1 = Date.now();
  result = await runNegotiationRound(state, "venue");
  state = result.state;
  console.log(`[${elapsed()} | round: ${((Date.now() - t1) / 1000).toFixed(1)}s]`);
  console.log(`Proposed: ${result.round.proposal.entity.name} (affinity ${result.round.proposal.entity.affinity?.toFixed(3)})`);
  console.log(`Reasoning: ${result.round.proposal.reasoning}`);
  console.log(`Advocate: [${result.round.advocateResult?.verdict}] ${result.round.advocateResult?.reasoning}`);
  console.log(`Skeptic:  [${result.round.skepticResult?.verdict}] ${result.round.skepticResult?.reasoning}`);

  console.log(`\nAgent smoke test complete. Total time: ${elapsed()}`);
}

main().catch((err) => {
  console.error("Agent smoke test failed:", err);
  process.exit(1);
});
