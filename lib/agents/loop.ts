// Orchestrates the plan -> act -> observe -> replan cycle across Negotiator, Advocate,
// and Skeptic agents. Tracks rejection history, consensus score, and termination condition.
//
// Coordination pattern:
//   Negotiator proposes -> Advocate + Skeptic critique IN PARALLEL ->
//   if either pushes back, Negotiator gets critique as new context and revises ->
//   repeat up to MAX_CRITIQUE_ROUNDS before surfacing to user regardless.

import { runNegotiator } from "@/lib/agents/negotiator";
import { runAdvocate, type AdvocateResult } from "@/lib/agents/advocate";
import { runSkeptic, type SkepticResult } from "@/lib/agents/skeptic";
import type { HistoryMessage } from "@/lib/bedrock/client";
import type {
  ConsensusState,
  Participant,
  NegotiationStage,
  NegotiationRound,
  RejectionRecord,
} from "@/lib/schema/state";

const MAX_CRITIQUE_ROUNDS = 2;

/**
 * Builds the full negotiation history as chat messages so every agent call reasons
 * with real accumulated context, not a blind snapshot. Required per project decision
 * 2026-10-06: history includes taste anchors, prior proposals, rejections, agent critiques.
 */
function buildHistory(state: ConsensusState): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const round of state.rounds) {
    history.push({
      role: "assistant",
      content: `Proposed ${round.proposal.entity.name} (affinity ${round.proposal.entity.affinity?.toFixed(3)}): ${round.proposal.reasoning}`,
    });
    if (round.advocateResult) {
      history.push({
        role: "user",
        content: `Advocate (${round.advocateResult.verdict}): ${round.advocateResult.reasoning}`,
      });
    }
    if (round.skepticResult) {
      history.push({
        role: "user",
        content: `Skeptic (${round.skepticResult.verdict}): ${round.skepticResult.reasoning}`,
      });
    }
    history.push({
      role: "user",
      content: round.accepted
        ? "Accepted."
        : `Rejected ${round.proposal.entity.name}.`,
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
 * Runs one full negotiation round for the given stage, including the internal
 * Advocate + Skeptic critique loop. The caller (API route / UI) sees only the
 * final surface-ready proposal — the internal revision passes are opaque.
 *
 * Does not auto-advance stages — the caller decides when to accept and move from
 * "destination" to "venue".
 */
export async function runNegotiationRound(
  state: ConsensusState,
  stage: NegotiationStage,
): Promise<RunRoundResult> {
  let history = buildHistory(state);

  // Internal critique context accumulates across revision passes within one round.
  // This is separate from session history — it's within-round Negotiator context only.
  let critiqueContext = "";
  let lastAdvocateResult: AdvocateResult | undefined;
  let lastSkepticResult: SkepticResult | undefined;

  for (let critiquePass = 0; critiquePass <= MAX_CRITIQUE_ROUNDS; critiquePass++) {
    const negotiatorHistory: HistoryMessage[] = [
      ...history,
      ...(critiqueContext
        ? [{ role: "user" as const, content: critiqueContext }]
        : []),
    ];

    const result = await runNegotiator({
      stage,
      participants: state.participants,
      rejections: state.rejections,
      locationQuery: stage === "venue" ? state.chosenDestination?.name : undefined,
      history: negotiatorHistory,
    });

    if (!result.entity) {
      throw new Error(
        `Negotiator proposed an entity (${result.entityId}) it never fetched via get_insights`,
      );
    }

    // Fast-path: skip full agent loops when the proposal is clearly clean.
    // Thresholds chosen to match the Advocate/Skeptic prompt logic — gap < 0.15
    // is below investigation threshold, affinity > 0.80 is a strong result.
    const attributionScores = result.entity.explainability?.map((a) => a.score) ?? [];
    const attributionGap =
      attributionScores.length > 1
        ? Math.max(...attributionScores) - Math.min(...attributionScores)
        : 0;
    const isCleanProposal =
      (result.entity.affinity ?? 0) >= 0.80 &&
      attributionGap < 0.15 &&
      state.rejections.length === 0;

    // Run Advocate and Skeptic in parallel — they have independent concerns and do not
    // need to wait on each other. Skip full agent loops on clean proposals to save latency.
    const [advocateResult, skepticResult] = await Promise.all([
      isCleanProposal
        ? Promise.resolve<AdvocateResult>({
            verdict: "approve",
            reasoning: `Fast-path approved: affinity ${result.entity.affinity?.toFixed(3)}, attribution gap ${attributionGap.toFixed(3)} — within thresholds.`,
          })
        : runAdvocate({
            stage,
            participants: state.participants,
            proposal: result.entity,
            rejections: state.rejections,
            history,
          }),
      isCleanProposal
        ? Promise.resolve<SkepticResult>({
            verdict: "approve",
            reasoning: `Fast-path approved: no rejection history, proposal is structurally sound.`,
          })
        : runSkeptic({
            stage,
            proposal: result.entity,
            rejections: state.rejections,
            chosenDestination: state.chosenDestination,
            history,
          }),
    ]);

    lastAdvocateResult = advocateResult;
    lastSkepticResult = skepticResult;

    const bothApprove =
      advocateResult.verdict === "approve" && skepticResult.verdict === "approve";

    // If both agents approve, or we've exhausted critique passes, surface the proposal.
    if (bothApprove || critiquePass === MAX_CRITIQUE_ROUNDS) {
      const round: NegotiationRound = {
        stage,
        proposal: { stage, entity: result.entity, reasoning: result.reasoning },
        accepted: false,
        advocateResult,
        skepticResult,
      };

      const nextState: ConsensusState = {
        ...state,
        rounds: [...state.rounds, round],
        consensusScore: result.entity.affinity,
      };

      return { state: nextState, round };
    }

    // One or both agents pushed back — build critique context for the Negotiator's
    // next pass so it reasons with the specific concerns, not blindly retrying.
    const critiqueParts: string[] = [
      `Your proposal (${result.entity.name}) was reviewed and needs revision:`,
    ];

    if (advocateResult.verdict === "pushback") {
      critiqueParts.push(
        `Fairness concern (Advocate): ${advocateResult.reasoning}` +
          (advocateResult.underservedParticipant
            ? ` (least served: ${advocateResult.underservedParticipant})`
            : ""),
      );
    }

    if (skepticResult.verdict === "pushback") {
      critiqueParts.push(`Structural concern (Skeptic): ${skepticResult.reasoning}`);
      if (skepticResult.negotiatorConstraint) {
        critiqueParts.push(`Apply this constraint in your next query: ${skepticResult.negotiatorConstraint}`);
      }
    }

    critiqueParts.push(
      "Re-query Qloo with these concerns in mind and propose a different entity. Do not re-propose the same entity.",
    );

    critiqueContext = critiqueParts.join("\n");
  }

  // Unreachable — the loop always returns inside the for body — but TypeScript needs this.
  throw new Error("runNegotiationRound: exhausted critique passes without returning");
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
 * rejection into the full session-wide list so ALL subsequent Qloo queries
 * exclude everything rejected so far — not just the immediately preceding rejection.
 * Per project decision 2026-10-06.
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
