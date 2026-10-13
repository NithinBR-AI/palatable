import { describe, it, expect } from "vitest";
import { checkAnchorQuality } from "@/lib/guardrails/anchorQuality";
import type { ExtractedAnchor } from "@/lib/extract/anchors";
import type { RawMessage } from "@/lib/extract/anchors";

// ── helpers ──────────────────────────────────────────────────────────────────

function anchor(participantId: string, entityType: string): ExtractedAnchor {
  return {
    participantId,
    participantName: participantId,
    anchorText: "test anchor",
    entityId: entityType === "vibe" ? "" : "qloo-id-123",
    entityType,
    vibeContext: entityType === "vibe" ? "some vibe" : "",
    confidence: 0.8,
  };
}

function msg(participantId: string, participantName = participantId): RawMessage {
  return { participantId, participantName, text: "hi", timestamp: "2026-01-01T00:00:00Z" };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("checkAnchorQuality", () => {
  describe("blocked flag", () => {
    it("blocks when group has zero anchors", () => {
      const result = checkAnchorQuality([], [msg("p-a"), msg("p-b")]);
      expect(result.blocked).toBe(true);
    });

    it("does not block when at least one anchor exists", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist")],
        [msg("p-a"), msg("p-b")],
      );
      expect(result.blocked).toBe(false);
    });

    it("does not block when only vibe anchors exist — vibes still allow negotiation", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "vibe")],
        [msg("p-a"), msg("p-b")],
      );
      expect(result.blocked).toBe(false);
    });
  });

  describe("no_signal warning", () => {
    it("warns no_signal for a participant with zero anchors extracted", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist")],
        [msg("p-a"), msg("p-b")],
      );
      const w = result.warnings.find((w) => w.participantId === "p-b");
      expect(w?.level).toBe("no_signal");
    });

    it("warns no_signal for all participants when anchors belong to none of them", () => {
      // anchors list is non-empty but belongs to a participant not in messages
      const result = checkAnchorQuality(
        [anchor("p-ghost", "urn:entity:artist")],
        [msg("p-a"), msg("p-b")],
      );
      const ids = result.warnings.map((w) => w.participantId);
      expect(ids).toContain("p-a");
      expect(ids).toContain("p-b");
    });

    it("produces no warnings when every participant has at least one named anchor", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist"), anchor("p-b", "urn:entity:movie")],
        [msg("p-a"), msg("p-b")],
      );
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("warn (vibe-only) warning", () => {
    it("warns when all of a participant's anchors are vibe type", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist"), anchor("p-b", "vibe")],
        [msg("p-a"), msg("p-b")],
      );
      const w = result.warnings.find((w) => w.participantId === "p-b");
      expect(w?.level).toBe("warn");
    });

    it("does not warn when participant has mixed vibe and named anchors", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "vibe"), anchor("p-a", "urn:entity:artist")],
        [msg("p-a")],
      );
      expect(result.warnings).toHaveLength(0);
    });

    it("warns correct level for multiple vibe-only participants", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "vibe"), anchor("p-b", "vibe")],
        [msg("p-a"), msg("p-b")],
      );
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings.every((w) => w.level === "warn")).toBe(true);
    });
  });

  describe("p-user exclusion", () => {
    it("does not warn or flag p-user even when they have no anchors", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist")],
        [msg("p-a"), msg("p-user", "You")],
      );
      const userWarning = result.warnings.find((w) => w.participantId === "p-user");
      expect(userWarning).toBeUndefined();
    });

    it("does not block when p-user is the only participant with no anchors", () => {
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist")],
        [msg("p-a"), msg("p-user", "You")],
      );
      expect(result.blocked).toBe(false);
    });
  });

  describe("participantName in warnings", () => {
    it("uses the name from messages, not the participant ID", () => {
      const result = checkAnchorQuality(
        [],
        [msg("p-xyz", "Jordan")],
      );
      expect(result.warnings[0].participantName).toBe("Jordan");
    });

    it("falls back to participantId when no message found", () => {
      // edge case: anchor exists but no message for that id
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist")],
        [], // no messages at all
      );
      // no participants derived from empty messages → no warnings
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("deduplication of participant IDs from messages", () => {
    it("counts a participant once even if they sent many messages", () => {
      const messages = [
        msg("p-a"), msg("p-a"), msg("p-a"), msg("p-b"),
      ];
      const result = checkAnchorQuality(
        [anchor("p-a", "urn:entity:artist"), anchor("p-b", "urn:entity:movie")],
        messages,
      );
      expect(result.warnings).toHaveLength(0);
    });
  });
});
