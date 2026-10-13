// Guardrail: anchor signal quality checks.
// Runs after extraction to warn about participants whose preferences
// can't be meaningfully represented in the negotiation.

import type { ExtractedAnchor } from "@/lib/extract/anchors";
import type { RawMessage } from "@/lib/extract/anchors";

export interface AnchorWarning {
  participantId: string;
  participantName: string;
  level: "warn" | "no_signal";
}

export interface AnchorQualityResult {
  warnings: AnchorWarning[];
  /** True only when the entire group has zero anchors — hard block negotiation. */
  blocked: boolean;
}

/**
 * Checks per-participant signal quality after extraction.
 *
 * - no_signal: participant sent messages but nothing was extracted at all
 * - warn: anchors were extracted but all are vibe-only (no resolved Qloo entity)
 *
 * Hard-blocks only when the whole group has zero anchors combined —
 * loose enough that freetext demos still work even with partial signal.
 */
export function checkAnchorQuality(
  anchors: ExtractedAnchor[],
  messages: RawMessage[],
): AnchorQualityResult {
  // Exclude the trigger user ("p-user") — they typed the intent message, not a group member.
  const participantIds = [...new Set(messages.map((m) => m.participantId))].filter((id) => id !== "p-user");
  const warnings: AnchorWarning[] = [];

  for (const pid of participantIds) {
    const participantAnchors = anchors.filter((a) => a.participantId === pid);
    const name = messages.find((m) => m.participantId === pid)?.participantName ?? pid;

    if (participantAnchors.length === 0) {
      warnings.push({ participantId: pid, participantName: name, level: "no_signal" });
    } else if (participantAnchors.every((a) => a.entityType === "vibe")) {
      warnings.push({ participantId: pid, participantName: name, level: "warn" });
    }
  }

  return {
    warnings,
    blocked: anchors.length === 0,
  };
}
