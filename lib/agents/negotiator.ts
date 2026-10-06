// Negotiator agent: proposes a plan the group will accept, using Qloo cross-domain affinity.
// Goal/incentive: converge efficiently on a proposal.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { searchEntity, getInsights, type QlooEntityType, type InsightsResult } from "@/lib/qloo/client";
import { runAgentLoop, type AgentConfig, type HistoryMessage, type ToolDefinition } from "@/lib/bedrock/client";
import type { Participant, NegotiationStage, RejectionRecord } from "@/lib/schema/state";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/negotiator.txt"), "utf-8");

const TOOLS: ToolDefinition[] = [
  {
    name: "search_entity",
    description: "Resolve a free-text taste anchor (e.g. 'Radiohead', 'Nobu') to a Qloo entity ID.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The taste anchor text to resolve" },
        type: {
          type: "string",
          description: "Qloo entity type, e.g. urn:entity:artist, urn:entity:place, urn:entity:movie",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_insights",
    description:
      "Get cross-domain affinity recommendations for a target category, given a set of signal entity IDs. Use filterType=urn:entity:destination for trip destinations, urn:entity:place for restaurants/venues.",
    parameters: {
      type: "object",
      properties: {
        filterType: { type: "string", enum: ["urn:entity:destination", "urn:entity:place"] },
        signalEntityIds: { type: "array", items: { type: "string" } },
        excludeEntityIds: { type: "array", items: { type: "string" } },
        locationQuery: { type: "string", description: "Scope results to a location, e.g. a chosen destination name" },
      },
      required: ["filterType", "signalEntityIds"],
    },
  },
  {
    name: "propose",
    description:
      "Finalize your recommendation for this round. Call this once you have a confident pick backed by real Qloo affinity data.",
    parameters: {
      type: "object",
      properties: {
        entityId: { type: "string" },
        reasoning: {
          type: "string",
          description:
            "Plain-language explanation citing the real affinity score and per-person attribution. No generic filler.",
        },
      },
      required: ["entityId", "reasoning"],
    },
  },
];

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

/**
 * Runs the Negotiator's plan -> act -> observe -> replan loop for one round.
 * The LLM decides itself which tools to call and when - this is NOT a fixed
 * pipeline, the model chooses when to search, when to broaden, when to propose.
 */
export async function runNegotiator(input: NegotiatorInput): Promise<NegotiatorProposal> {
  // Captured across tool calls so we can resolve the final proposal's full entity data.
  const seenEntities = new Map<string, InsightsResult>();
  let finalProposal: NegotiatorProposal | null = null;

  const config: AgentConfig = {
    systemPrompt: SYSTEM_PROMPT,
    tools: TOOLS,
    executors: {
      search_entity: async (args) => {
        const { query, type } = args as { query: string; type?: QlooEntityType };
        const results = await searchEntity(query, type);
        return results[0] ?? { error: "No entity found" };
      },
      get_insights: async (args) => {
        const { filterType, signalEntityIds, excludeEntityIds, locationQuery } = args as {
          filterType: "urn:entity:destination" | "urn:entity:place";
          signalEntityIds: string[];
          excludeEntityIds?: string[];
          locationQuery?: string;
        };
        const results = await getInsights({
          filterType,
          signalEntityIds,
          excludeEntityIds,
          locationQuery,
          explainability: true,
          take: 5,
        });
        for (const r of results) seenEntities.set(r.entityId, r);
        return results;
      },
      propose: async (args) => {
        const { entityId, reasoning } = args as { entityId: string; reasoning: string };
        finalProposal = { entityId, reasoning, entity: seenEntities.get(entityId) };
        return { acknowledged: true };
      },
    },
  };

  const tasteAnchors = input.participants
    .map((p) => `${p.name}: ${p.tasteAnchors.map((a) => a.query).join(", ")}`)
    .join("\n");

  const rejectionSummary =
    input.rejections.length > 0
      ? `Previously rejected in this session: ${input.rejections
          .map((r) => `${r.entityName} (${r.stage})`)
          .join(", ")}. Do not propose these again - factor in WHY they may have been rejected when choosing your next signal weighting.`
      : "No rejections yet.";

  const userMessage = [
    `Stage: ${input.stage}`,
    input.locationQuery ? `Scoped to destination: ${input.locationQuery}` : "",
    `Participants and taste anchors:\n${tasteAnchors}`,
    rejectionSummary,
    "Resolve each participant's taste anchors, then get combined insights, then propose.",
  ]
    .filter(Boolean)
    .join("\n\n");

  await runAgentLoop(userMessage, config, input.history);

  if (!finalProposal) {
    throw new Error("Negotiator did not produce a proposal");
  }

  return finalProposal;
}
