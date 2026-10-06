// Orchestrates the plan -> act -> observe -> replan cycle across Negotiator, Advocate,
// and Skeptic agents. Tracks rejection history, consensus score, and termination condition.
//
// NOTE (2026-10-06): Advocate and Skeptic are not wired in yet - this currently runs
// the Negotiator alone (Phase 2). Phase 3 adds Advocate/Skeptic critique before a
// proposal is shown to the user.

import { runNegotiator } from "@/lib/agents/negotiator";
import type { HistoryMessage } from "@/lib/bedrock/client";
import type {
  ConsensusState,
  Participant,
  NegotiationStage,
  NegotiationRound,
  RejectionRecord,
} from "@/lib/schema/state";

/**
 * Builds the full negotiation history as chat messages so each agent call reasons
 * with real context across rounds, not a blind snapshot. Required per project
 * decision 2026-10-06.
 */
function buildHistory(state: ConsensusState): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const round of state.rounds) {
    history.push({
      role: "assistant",
      content: `Proposed ${round.proposal.entity.name} (affinity ${round.proposal.entity.affinity?.toFixed(3)}): ${round.proposal.reasoning}`,
    });
    history.push({
      role: "user",
      content: round.accepted ? "Accepted." : `Rejected ${round.proposal.entity.name}.`,
    });
  }
  return history;
}

export function createConsensusState(participants: Participant[]): ConsensusState {
  return { participants, rounds: [], rejections: [] };
}

export interface RunRoundResult {
  state: ConsensusState;
  round: NegotiationRound;
}

/**
 * Runs one negotiation round for the given stage. Does not auto-advance stages -
 * the caller (API route / UI) decides when a proposal is accepted and when to
 * move from "destination" to "venue".
 */
export async function runNegotiationRound(
  state: ConsensusState,
  stage: NegotiationStage,
): Promise<RunRoundResult> {
  const history = buildHistory(state);

  const result = await runNegotiator({
    stage,
    participants: state.participants,
    rejections: state.rejections,
    locationQuery: stage === "venue" ? state.chosenDestination?.name : undefined,
    history,
  });

  if (!result.entity) {
    throw new Error(`Negotiator proposed an entity (${result.entityId}) it never fetched via get_insights`);
  }

  const round: NegotiationRound = {
    stage,
    proposal: { stage, entity: result.entity, reasoning: result.reasoning },
    accepted: false,
  };

  const nextState: ConsensusState = {
    ...state,
    rounds: [...state.rounds, round],
    consensusScore: result.entity.affinity,
  };

  return { state: nextState, round };
}

/**
 * Called when the user accepts the current round's proposal.
 */
export function acceptRound(state: ConsensusState): ConsensusState {
  const rounds = [...state.rounds];
  const last = rounds[rounds.length - 1];
  if (!last) return state;

  rounds[rounds.length - 1] = { ...last, accepted: true };

  return {
    ...state,
    rounds,
    chosenDestination: last.stage === "destination" ? last.proposal.entity : state.chosenDestination,
  };
}

/**
 * Called when the user rejects the current round's proposal. Accumulates the
 * rejection into the full session-wide list (not just the last round) so the
 * NEXT Qloo query excludes everything rejected so far, per project decision
 * 2026-10-06.
 */
export function rejectRound(state: ConsensusState): ConsensusState {
  const rounds = [...state.rounds];
  const last = rounds[rounds.length - 1];
  if (!last) return state;

  const rejection: RejectionRecord = {
    stage: last.stage,
    entityId: last.proposal.entity.entityId,
    entityName: last.proposal.entity.name,
  };

  return {
    ...state,
    rounds,
    rejections: [...state.rejections, rejection],
  };
}
