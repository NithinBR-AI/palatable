// Guardrail: negotiation signal floor checks.
// Runs during negotiation to surface weak results and handle empty Qloo responses
// gracefully instead of crashing.

import type { InsightsResult } from "@/lib/qloo/client";
import type { Participant } from "@/lib/schema/state";

export interface SignalFloorResult {
  /** Emit a low_signal_warning event with this message before surfacing the proposal. */
  warning?: string;
}

/** Minimum affinity below which we warn the user the result may not reflect group taste. */
const AFFINITY_WARN_FLOOR = 0.45;

/**
 * Checks whether the top candidate's affinity is too low to be confident.
 * Does not block — warns and lets the proposal surface anyway.
 * Only fires on the first critique pass to avoid duplicate warnings.
 */
export function checkAffinityFloor(
  entity: InsightsResult,
  critiquePass: number,
): SignalFloorResult {
  if (critiquePass === 0 && (entity.affinity ?? 1) < AFFINITY_WARN_FLOOR) {
    return {
      warning: "Affinity score is low — the taste signals may be too sparse or generic for a confident recommendation.",
    };
  }
  return {};
}

/**
 * Finds participants whose anchors contributed zero attribution score to the
 * proposed entity. These participants' preferences aren't reflected in the pick.
 * Returns their names for surfacing in the UI.
 */
export function findZeroAttributionParticipants(
  entity: InsightsResult,
  participants: Participant[],
  anchorsByParticipant: Map<string, { entityId: string }[]>,
): string[] {
  return participants
    .filter((p) => {
      const anchors = anchorsByParticipant.get(p.name) ?? [];
      if (anchors.length === 0) return false; // no anchors = already covered by anchorQuality
      const totalScore = entity.explainability
        ?.filter((a) => anchors.some((r) => r.entityId === a.entityId))
        .reduce((sum, a) => sum + a.score, 0) ?? 0;
      return totalScore === 0;
    })
    .map((p) => p.name);
}
