// Advocate agent: represents whoever is least served by the current proposal.
// Goal/incentive: fairness over speed — pushes back when attribution is lopsided.
//
// Architecture: single LLM call per round. Entity tag profile and participant attribution
// are pre-fetched in code and passed in the prompt. The LLM reasons about fairness
// and returns a structured verdict — no tool-calling loop needed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getInsights, type InsightsResult } from "@/lib/qloo/client";
import { runStructuredCompletion, type HistoryMessage } from "@/lib/bedrock/client";
import type { Participant, NegotiationStage, RejectionRecord } from "@/lib/schema/state";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/advocate.txt"), "utf-8");

export type AdvocateVerdict = "approve" | "pushback";

export interface AdvocateResult {
  verdict: AdvocateVerdict;
  reasoning: string;
  underservedParticipant?: string;
}

export interface AdvocateInput {
  stage: NegotiationStage;
  participants: Participant[];
  proposal: InsightsResult;
  rejections: RejectionRecord[];
  history: HistoryMessage[];
  resolvedAnchors?: { participant: string; entityId: string }[];
}

/**
 * Runs the Advocate for one round.
 *
 * Data flow:
 * 1. Pre-fetch the proposed entity's tag profile from Qloo
 * 2. Single LLM call: given the proposal + attribution + tags, assess fairness
 *
 * One getInsights call + one LLM call = fast and predictable.
 */
export async function runAdvocate(input: AdvocateInput): Promise<AdvocateResult> {
  // Pre-fetch the entity's tag profile so the LLM has concrete attributes to reason from
  const tagProfile = await getInsights({
    filterType: input.stage === "venue" ? "urn:entity:place" : "urn:entity:destination",
    signalEntityIds: [input.proposal.entityId],
    explainability: false,
    take: 1,
  });

  const entityTags = tagProfile[0]?.tags?.map((t) => t.name).join(", ") ?? "no tags available";

  // Map attribution scores back to participant names via resolvedAnchors (entityId → participant)
  const anchorMap = new Map<string, string>(); // entityId → participant name
  for (const a of input.resolvedAnchors ?? []) anchorMap.set(a.entityId, a.participant);

  const attributionByParticipant = input.participants.map((p) => {
    const score = input.proposal.explainability
      ?.filter((a) => anchorMap.get(a.entityId) === p.name)
      .reduce((sum, a) => sum + a.score, 0) ?? 0;
    return { name: p.name, score };
  });

  const hasResolvedIds = attributionByParticipant.some((a) => a.score > 0);
  const attributionSummary = hasResolvedIds
    ? attributionByParticipant.map((a) => `${a.name}: ${a.score.toFixed(3)}`).join(", ")
    : input.proposal.explainability
        ?.map((a) => `${anchorMap.get(a.entityId) ?? a.entityId}: ${a.score.toFixed(3)}`)
        .join(", ") ?? "no attribution data";

  const scores = hasResolvedIds
    ? attributionByParticipant.map((a) => a.score)
    : input.proposal.explainability?.map((a) => a.score) ?? [];
  const gap = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;

  const participantSummary = input.participants
    .map((p) => `${p.name} (${p.tasteAnchors.length} anchors): ${p.tasteAnchors.map((a) => a.query).join(", ")}`)
    .join("\n");

  const anchorCounts = input.participants.map((p) => p.tasteAnchors.length);
  const expectedGap = (Math.max(...anchorCounts) - Math.min(...anchorCounts)) * 0.15;

  const userMessage = [
    `Stage: ${input.stage}`,
    `Proposed entity: ${input.proposal.name} (affinity: ${input.proposal.affinity?.toFixed(3)})`,
    `Entity tags: ${entityTags}`,
    `Attribution by participant: ${attributionSummary}`,
    `Attribution gap (max - min): ${gap.toFixed(3)}`,
    `Expected gap from anchor count imbalance: ${expectedGap.toFixed(3)} (gap within this range is structural, not unfair)`,
    `Participants and taste anchors:\n${participantSummary}`,
    `Respond with ONLY valid JSON (no markdown):
{
  "verdict": "approve" | "pushback",
  "reasoning": "<for approve: 1-2 sentences why it passes fairness review. For pushback: 2-3 sentences naming who is underserved, the specific tag mismatch, and what kind of entity would better serve them>",
  "underservedParticipant": "<name, only on pushback>"
}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await runStructuredCompletion<AdvocateResult>(
    SYSTEM_PROMPT,
    userMessage,
    input.history,
  );

  return {
    verdict: result.verdict,
    reasoning: result.reasoning,
    underservedParticipant: result.underservedParticipant,
  };
}
