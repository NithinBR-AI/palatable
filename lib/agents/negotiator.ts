// Negotiator agent: proposes a plan the group will accept, using Qloo cross-domain affinity.
// Goal/incentive: converge efficiently on a proposal.
//
// Architecture: single LLM call per round. All Qloo data (anchor resolution + insights)
// is pre-fetched in code and passed directly in the prompt. The LLM picks the best
// result and writes plain-language reasoning — no tool-calling loop needed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { searchEntity, getInsights, type InsightsResult } from "@/lib/qloo/client";
import { runStructuredCompletion, type HistoryMessage } from "@/lib/bedrock/client";
import type { Participant, NegotiationStage, RejectionRecord } from "@/lib/schema/state";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/negotiator.txt"), "utf-8");

export interface NegotiatorProposal {
  entityId: string;
  entity?: InsightsResult;
  reasoning: string;
}

export interface NegotiatorInput {
  stage: NegotiationStage;
  participants: Participant[];
  rejections: RejectionRecord[];
  locationQuery?: string;
  history: HistoryMessage[];
}

interface NegotiatorLLMResponse {
  entityId: string;
  reasoning: string;
}

/**
 * Runs the Negotiator for one round.
 *
 * Data flow:
 * 1. Resolve all taste anchors sequentially (rate-limit safe, no type hint = non-deterministic)
 * 2. Fetch Qloo insights with all resolved IDs
 * 3. Single LLM call: given the candidates + attribution, pick the best and explain why
 *
 * One Qloo search per anchor + one getInsights + one LLM call = fast and predictable.
 */
export async function runNegotiator(input: NegotiatorInput): Promise<NegotiatorProposal> {
  // Step 1: resolve taste anchors sequentially (avoid 429 from parallel burst)
  // No type hint — Qloo disambiguates any free-text input non-deterministically
  const allAnchors = input.participants.flatMap((p) =>
    p.tasteAnchors.map((anchor) => ({ participant: p.name, query: anchor.query })),
  );

  const resolvedAnchors: { participant: string; query: string; entityId: string; name: string; type: string }[] = [];
  for (const anchor of allAnchors) {
    const results = await searchEntity(anchor.query);
    if (results[0]) {
      resolvedAnchors.push({
        participant: anchor.participant,
        query: anchor.query,
        entityId: results[0].entityId,
        name: results[0].name,
        type: results[0].type,
      });
    }
  }

  const signalEntityIds = resolvedAnchors.map((a) => a.entityId);
  const excludeEntityIds = input.rejections.map((r) => r.entityId);

  // Step 2: fetch insights — scoped by location for venue stage
  const filterType = input.stage === "venue" ? "urn:entity:place" : "urn:entity:destination";
  let candidates = await getInsights({
    filterType,
    signalEntityIds,
    excludeEntityIds,
    locationQuery: input.locationQuery,
    explainability: true,
    take: 5,
  });

  // Fallback: if scoped query returns thin results, broaden (limited Qloo coverage)
  if (candidates.length < 2 && input.locationQuery) {
    candidates = await getInsights({
      filterType,
      signalEntityIds,
      excludeEntityIds,
      explainability: true,
      take: 5,
    });
  }

  if (candidates.length === 0) {
    throw new Error("Negotiator: Qloo returned no candidates");
  }

  // Step 3: single LLM call — pick the best candidate and write reasoning
  const candidateSummary = candidates
    .map((c) => {
      const attribution = c.explainability
        ?.map((a) => {
          const anchor = resolvedAnchors.find((r) => r.entityId === a.entityId);
          return `${anchor?.participant ?? a.entityId} (${anchor?.query ?? ""}): ${a.score.toFixed(3)}`;
        })
        .join(", ");
      return `- ${c.name} (id: ${c.entityId}, affinity: ${c.affinity?.toFixed(3)}, attribution: [${attribution}])`;
    })
    .join("\n");

  const anchorSummary = resolvedAnchors
    .map((a) => `${a.participant}: "${a.query}" → ${a.name} (${a.type})`)
    .join("\n");

  const rejectionSummary =
    input.rejections.length > 0
      ? `Previously rejected: ${input.rejections.map((r) => r.entityName).join(", ")}. Shift weighting away from those patterns.`
      : "No rejections yet.";

  const locationNote =
    input.stage === "venue" && input.locationQuery
      ? `IMPORTANT: Only propose a venue in or near ${input.locationQuery}. Do not propose venues in other cities.`
      : "";

  const userMessage = [
    `Stage: ${input.stage}`,
    locationNote,
    `Resolved taste anchors:\n${anchorSummary}`,
    `Qloo candidates:\n${candidateSummary}`,
    rejectionSummary,
    `Pick the best candidate and respond with ONLY valid JSON (no markdown):
{
  "entityId": "<id of chosen candidate>",
  "reasoning": "<2-3 sentences: cite the real affinity score, name which participant's taste contributed most using the attribution data, be honest about any lopsided attribution>"
}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const llmResponse = await runStructuredCompletion<NegotiatorLLMResponse>(
    SYSTEM_PROMPT,
    userMessage,
    input.history,
  );

  const entity = candidates.find((c) => c.entityId === llmResponse.entityId);

  return {
    entityId: llmResponse.entityId,
    entity,
    reasoning: llmResponse.reasoning,
  };
}
