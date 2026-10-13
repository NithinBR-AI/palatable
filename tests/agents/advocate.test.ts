import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/qloo/client", () => ({
  getInsights: vi.fn(),
}));
vi.mock("@/lib/bedrock/client", () => ({
  runStructuredCompletion: vi.fn(),
}));

import { runAdvocate } from "@/lib/agents/advocate";
import { getInsights } from "@/lib/qloo/client";
import { runStructuredCompletion } from "@/lib/bedrock/client";
import type { InsightsResult } from "@/lib/qloo/client";
import type { Participant } from "@/lib/schema/state";

const mockGetInsights = vi.mocked(getInsights);
const mockLLM = vi.mocked(runStructuredCompletion);

// ── fixtures ──────────────────────────────────────────────────────────────────

function entity(overrides: Partial<InsightsResult> = {}): InsightsResult {
  return {
    entityId: "eid-tokyo",
    name: "Tokyo",
    affinity: 0.85,
    explainability: [
      { entityId: "anchor-a", score: 0.6, name: "Daft Punk" },
      { entityId: "anchor-b", score: 0.4, name: "Thundercat" },
    ],
    tags: [{ name: "music", score: 0.9 }],
    ...overrides,
  };
}

function participants(count = 2): Participant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    name: `Person ${i}`,
    tasteAnchors: [{ query: "Daft Punk", entityId: `anchor-${String.fromCharCode(97 + i)}` }],
  }));
}

function baseInput(overrides = {}) {
  return {
    stage: "destination" as const,
    participants: participants(),
    proposal: entity(),
    rejections: [],
    history: [],
    resolvedAnchors: [
      { participant: "Person 0", entityId: "anchor-a" },
      { participant: "Person 1", entityId: "anchor-b" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInsights.mockResolvedValue([entity({ tags: [{ name: "nightlife", score: 0.8 }] })]);
  mockLLM.mockResolvedValue({ verdict: "approve", reasoning: "Fairness looks good" });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runAdvocate", () => {
  describe("happy path — approve", () => {
    it("returns approve verdict from the LLM", async () => {
      const result = await runAdvocate(baseInput());
      expect(result.verdict).toBe("approve");
      expect(result.reasoning).toBeTruthy();
    });

    it("calls getInsights with the proposal's entityId", async () => {
      await runAdvocate(baseInput());
      const call = mockGetInsights.mock.calls[0][0];
      expect(call.signalEntityIds).toContain("eid-tokyo");
    });

    it("uses filterType urn:entity:destination for destination stage", async () => {
      await runAdvocate(baseInput({ stage: "destination" }));
      expect(mockGetInsights.mock.calls[0][0].filterType).toBe("urn:entity:destination");
    });

    it("uses filterType urn:entity:place for venue stage", async () => {
      await runAdvocate(baseInput({ stage: "venue" }));
      expect(mockGetInsights.mock.calls[0][0].filterType).toBe("urn:entity:place");
    });
  });

  describe("pushback path", () => {
    it("returns pushback verdict and underservedParticipant from the LLM", async () => {
      mockLLM.mockResolvedValue({
        verdict: "pushback",
        reasoning: "Person 1 is underserved — no tags match their anchors",
        underservedParticipant: "Person 1",
      });

      const result = await runAdvocate(baseInput());
      expect(result.verdict).toBe("pushback");
      expect(result.underservedParticipant).toBe("Person 1");
    });

    it("passes underservedParticipant through even if undefined on approve", async () => {
      mockLLM.mockResolvedValue({ verdict: "approve", reasoning: "All good" });
      const result = await runAdvocate(baseInput());
      expect(result.underservedParticipant).toBeUndefined();
    });
  });

  describe("attribution calculation", () => {
    it("sends attributions to LLM even when resolvedAnchors is empty", async () => {
      await runAdvocate(baseInput({ resolvedAnchors: [] }));
      // LLM should still be called — attribution summary falls back to raw explainability
      expect(mockLLM).toHaveBeenCalledTimes(1);
    });

    it("works when proposal has no explainability data", async () => {
      const noExplain = entity({ explainability: [] });
      await runAdvocate(baseInput({ proposal: noExplain }));
      expect(mockLLM).toHaveBeenCalledTimes(1);
    });

    it("handles a single participant with no attribution gap", async () => {
      const solo = [{ id: "p-0", name: "Solo", tasteAnchors: [{ query: "Daft Punk", entityId: "anchor-a" }] }];
      await runAdvocate(baseInput({ participants: solo }));
      expect(mockLLM).toHaveBeenCalledTimes(1);
    });
  });

  describe("tag fallback", () => {
    it("falls back to 'no tags available' when getInsights returns empty", async () => {
      mockGetInsights.mockResolvedValue([]);
      await runAdvocate(baseInput());
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("no tags available");
    });

    it("uses the first result's tags when getInsights returns data", async () => {
      mockGetInsights.mockResolvedValue([entity({ tags: [{ name: "jazz", score: 0.9 }] })]);
      await runAdvocate(baseInput());
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("jazz");
    });
  });

  describe("error propagation", () => {
    it("throws when getInsights fails", async () => {
      mockGetInsights.mockRejectedValue(new Error("Qloo 503"));
      await expect(runAdvocate(baseInput())).rejects.toThrow("Qloo 503");
    });

    it("throws when LLM call fails", async () => {
      mockLLM.mockRejectedValue(new Error("Bedrock timeout"));
      await expect(runAdvocate(baseInput())).rejects.toThrow("Bedrock timeout");
    });
  });
});
