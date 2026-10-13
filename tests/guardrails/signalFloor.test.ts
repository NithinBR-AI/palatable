import { describe, it, expect } from "vitest";
import { checkAffinityFloor, findZeroAttributionParticipants } from "@/lib/guardrails/signalFloor";
import type { InsightsResult } from "@/lib/qloo/client";
import type { Participant } from "@/lib/schema/state";

// ── helpers ───────────────────────────────────────────────────────────────────

function entity(affinity: number, explainability: InsightsResult["explainability"] = []): InsightsResult {
  return {
    entityId: "eid-1",
    name: "Test Entity",
    affinity,
    explainability,
    tags: [],
  };
}

function participant(id: string, name: string): Participant {
  return { id, name, tasteAnchors: [] };
}

// ── checkAffinityFloor ────────────────────────────────────────────────────────

describe("checkAffinityFloor", () => {
  describe("fires a warning", () => {
    it("warns when affinity is below 0.45 on critiquePass 0", () => {
      const result = checkAffinityFloor(entity(0.44), 0);
      expect(result.warning).toBeTruthy();
    });

    it("warns when affinity is exactly 0 on critiquePass 0", () => {
      const result = checkAffinityFloor(entity(0), 0);
      expect(result.warning).toBeTruthy();
    });

    it("warns when affinity is 0.01 (just above zero) on critiquePass 0", () => {
      const result = checkAffinityFloor(entity(0.01), 0);
      expect(result.warning).toBeTruthy();
    });
  });

  describe("does not fire a warning", () => {
    it("no warning when affinity is exactly 0.45 (at the floor)", () => {
      const result = checkAffinityFloor(entity(0.45), 0);
      expect(result.warning).toBeUndefined();
    });

    it("no warning when affinity is above 0.45", () => {
      const result = checkAffinityFloor(entity(0.90), 0);
      expect(result.warning).toBeUndefined();
    });

    it("no warning on critiquePass 1 even if affinity is below floor", () => {
      const result = checkAffinityFloor(entity(0.20), 1);
      expect(result.warning).toBeUndefined();
    });

    it("no warning on critiquePass 2 even if affinity is zero", () => {
      const result = checkAffinityFloor(entity(0), 2);
      expect(result.warning).toBeUndefined();
    });

    it("no warning when affinity is undefined (treated as 1)", () => {
      const e = entity(0);
      // @ts-expect-error deliberately unset to test the fallback
      delete e.affinity;
      const result = checkAffinityFloor(e, 0);
      // undefined ?? 1 → 1, which is >= 0.45, so no warning
      expect(result.warning).toBeUndefined();
    });
  });
});

// ── findZeroAttributionParticipants ───────────────────────────────────────────

describe("findZeroAttributionParticipants", () => {
  it("returns participant whose anchors have zero explainability score", () => {
    const e = entity(0.8, [
      { entityId: "anchor-b", score: 0.9, name: "Anchor B" },
    ]);
    const participants = [participant("p-a", "Alice"), participant("p-b", "Bob")];
    const anchors = new Map([
      ["Alice", [{ entityId: "anchor-a" }]],
      ["Bob",   [{ entityId: "anchor-b" }]],
    ]);
    const result = findZeroAttributionParticipants(e, participants, anchors);
    expect(result).toContain("Alice");
    expect(result).not.toContain("Bob");
  });

  it("returns nobody when all participants have positive attribution", () => {
    const e = entity(0.8, [
      { entityId: "anchor-a", score: 0.5, name: "A" },
      { entityId: "anchor-b", score: 0.7, name: "B" },
    ]);
    const participants = [participant("p-a", "Alice"), participant("p-b", "Bob")];
    const anchors = new Map([
      ["Alice", [{ entityId: "anchor-a" }]],
      ["Bob",   [{ entityId: "anchor-b" }]],
    ]);
    const result = findZeroAttributionParticipants(e, participants, anchors);
    expect(result).toHaveLength(0);
  });

  it("skips participants with no anchors (already covered by anchorQuality guardrail)", () => {
    const e = entity(0.8, []);
    const participants = [participant("p-a", "Alice")];
    const anchors = new Map<string, { entityId: string }[]>([
      ["Alice", []],
    ]);
    const result = findZeroAttributionParticipants(e, participants, anchors);
    // Alice has no anchors → skipped, not flagged as zero attribution
    expect(result).toHaveLength(0);
  });

  it("returns all participants when explainability is empty and everyone has anchors", () => {
    const e = entity(0.8, []); // no explainability entries
    const participants = [participant("p-a", "Alice"), participant("p-b", "Bob")];
    const anchors = new Map([
      ["Alice", [{ entityId: "anchor-a" }]],
      ["Bob",   [{ entityId: "anchor-b" }]],
    ]);
    const result = findZeroAttributionParticipants(e, participants, anchors);
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
  });

  it("handles participant not in anchors map (treated as no anchors → skipped)", () => {
    const e = entity(0.8, []);
    const participants = [participant("p-a", "Alice")];
    const anchors = new Map<string, { entityId: string }[]>(); // Alice not in map
    const result = findZeroAttributionParticipants(e, participants, anchors);
    expect(result).toHaveLength(0);
  });

  it("sums scores across multiple anchors for the same participant", () => {
    // Alice has two anchors; one scores 0, the other scores 0.3 → total > 0 → not flagged
    const e = entity(0.8, [
      { entityId: "anchor-a1", score: 0, name: "A1" },
      { entityId: "anchor-a2", score: 0.3, name: "A2" },
    ]);
    const participants = [participant("p-a", "Alice")];
    const anchors = new Map([
      ["Alice", [{ entityId: "anchor-a1" }, { entityId: "anchor-a2" }]],
    ]);
    const result = findZeroAttributionParticipants(e, participants, anchors);
    expect(result).toHaveLength(0);
  });
});
