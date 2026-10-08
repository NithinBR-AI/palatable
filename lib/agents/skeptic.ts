// Skeptic agent: catches proposals that score well on Qloo affinity but fail for
// reasons the score cannot see — pattern repetition, scope mismatch, near-duplicates.
// Goal/incentive: structural viability and non-redundancy over fast convergence.
//
// Architecture: single LLM call per round. Entity tag profile and rejection history
// are pre-fetched/assembled in code and passed in the prompt. The LLM reasons about
// structural concerns and returns a structured verdict — no tool-calling loop needed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getInsights, type InsightsResult } from "@/lib/qloo/client";
import { runStructuredCompletion, type HistoryMessage } from "@/lib/bedrock/client";
import type { NegotiationStage, RejectionRecord } from "@/lib/schema/state";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/skeptic.txt"), "utf-8");

export type SkepticVerdict = "approve" | "pushback";
export type FailureMode = "pattern_repetition" | "scope_mismatch" | "near_duplicate" | "implausibility";

export interface SkepticResult {
  verdict: SkepticVerdict;
  reasoning: string;
  failureMode?: FailureMode;
  negotiatorConstraint?: string;
}

export interface SkepticInput {
  stage: NegotiationStage;
  proposal: InsightsResult;
  rejections: RejectionRecord[];
  chosenDestination?: InsightsResult;
  history: HistoryMessage[];
}

/**
 * Runs the Skeptic for one round.
 *
 * Data flow:
 * 1. Pre-fetch the proposed entity's tag profile from Qloo
 * 2. Single LLM call: given the proposal + tags + rejection history, assess structural viability
 *
 * One getInsights call + one LLM call = fast and predictable.
 */
export async function runSkeptic(input: SkepticInput): Promise<SkepticResult> {
  // Pre-fetch the entity's tag profile so the LLM has concrete attributes to reason from
  const tagProfile = await getInsights({
    filterType: input.stage === "venue" ? "urn:entity:place" : "urn:entity:destination",
    signalEntityIds: [input.proposal.entityId],
    explainability: false,
    take: 1,
  });

  const entityTags = tagProfile[0]?.tags?.map((t) => t.name).join(", ") ?? "no tags available";

  const rejectionHistory =
    input.rejections.length > 0
      ? input.rejections.map((r) => `- ${r.entityName} (${r.stage})`).join("\n")
      : "None yet.";

  const destinationContext =
    input.stage === "venue" && input.chosenDestination
      ? `Confirmed destination: ${input.chosenDestination.name}. The venue MUST be in or near this destination.`
      : "Destination stage — no confirmed destination yet.";

  const userMessage = [
    `Stage: ${input.stage}`,
    destinationContext,
    `Proposed entity: ${input.proposal.name} (affinity: ${input.proposal.affinity?.toFixed(3)})`,
    `Entity tags: ${entityTags}`,
    `Full rejection history this session:\n${rejectionHistory}`,
    `Respond with ONLY valid JSON (no markdown):
{
  "verdict": "approve" | "pushback",
  "reasoning": "<for approve: 1 sentence confirming structural review passed. For pushback: 2-3 sentences naming the failure mode, the evidence from the data, and the constraint for the next query>",
  "failureMode": "pattern_repetition" | "scope_mismatch" | "near_duplicate" | "implausibility" | null,
  "negotiatorConstraint": "<concrete instruction for the next query, only on pushback>"
}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await runStructuredCompletion<SkepticResult>(
    SYSTEM_PROMPT,
    userMessage,
    input.history,
  );

  return {
    verdict: result.verdict,
    reasoning: result.reasoning,
    failureMode: result.failureMode,
    negotiatorConstraint: result.negotiatorConstraint,
  };
}
