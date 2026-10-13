import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/qloo/client", () => ({
  getInsights: vi.fn(),
}));
vi.mock("@/lib/bedrock/client", () => ({
  runStructuredCompletion: vi.fn(),
}));

import { runSkeptic } from "@/lib/agents/skeptic";
import { getInsights } from "@/lib/qloo/client";
import { runStructuredCompletion } from "@/lib/bedrock/client";
import type { InsightsResult } from "@/lib/qloo/client";

const mockGetInsights = vi.mocked(getInsights);
const mockLLM = vi.mocked(runStructuredCompletion);

// ── fixtures ──────────────────────────────────────────────────────────────────

function entity(overrides: Partial<InsightsResult> = {}): InsightsResult {
  return {
    entityId: "eid-paris",
    name: "Paris",
    affinity: 0.82,
    explainability: [],
    tags: [{ name: "art", score: 0.9 }],
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    stage: "destination" as const,
    proposal: entity(),
    rejections: [],
    history: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInsights.mockResolvedValue([entity({ tags: [{ name: "culture", score: 0.8 }] })]);
  mockLLM.mockResolvedValue({ verdict: "approve", reasoning: "Structural check passed", failureMode: null });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runSkeptic", () => {
  describe("happy path — approve", () => {
    it("returns approve verdict", async () => {
      const result = await runSkeptic(baseInput());
      expect(result.verdict).toBe("approve");
    });

    it("calls getInsights with the proposal entityId", async () => {
      await runSkeptic(baseInput());
      expect(mockGetInsights.mock.calls[0][0].signalEntityIds).toContain("eid-paris");
    });

    it("uses filterType urn:entity:destination for destination stage", async () => {
      await runSkeptic(baseInput({ stage: "destination" }));
      expect(mockGetInsights.mock.calls[0][0].filterType).toBe("urn:entity:destination");
    });

    it("uses filterType urn:entity:place for venue stage", async () => {
      await runSkeptic(baseInput({ stage: "venue" }));
      expect(mockGetInsights.mock.calls[0][0].filterType).toBe("urn:entity:place");
    });
  });

  describe("pushback path", () => {
    it("returns pushback with failureMode and negotiatorConstraint", async () => {
      mockLLM.mockResolvedValue({
        verdict: "pushback",
        reasoning: "Proposed venue is outside the confirmed destination",
        failureMode: "scope_mismatch",
        negotiatorConstraint: "Only propose venues in Paris city centre",
      });

      const result = await runSkeptic(baseInput());
      expect(result.verdict).toBe("pushback");
      expect(result.failureMode).toBe("scope_mismatch");
      expect(result.negotiatorConstraint).toBe("Only propose venues in Paris city centre");
    });

    it("returns all 4 failure modes correctly", async () => {
      const modes = ["pattern_repetition", "scope_mismatch", "near_duplicate", "implausibility"] as const;
      for (const mode of modes) {
        mockLLM.mockResolvedValueOnce({ verdict: "pushback", reasoning: "Bad", failureMode: mode });
        const result = await runSkeptic(baseInput());
        expect(result.failureMode).toBe(mode);
      }
    });
  });

  describe("rejection history in prompt", () => {
    it("includes rejection names in the prompt when rejections exist", async () => {
      const input = baseInput({
        rejections: [
          { stage: "destination", entityId: "eid-berlin", entityName: "Berlin" },
          { stage: "destination", entityId: "eid-rome", entityName: "Rome" },
        ],
      });
      await runSkeptic(input);
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Berlin");
      expect(prompt).toContain("Rome");
    });

    it("says 'None yet' when there are no rejections", async () => {
      await runSkeptic(baseInput({ rejections: [] }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("None yet");
    });
  });

  describe("destination context in prompt", () => {
    it("includes chosen destination when stage is venue", async () => {
      const dest = entity({ name: "Tokyo", entityId: "eid-tokyo", geocode: { country_code: "JP", admin1_region: "" } });
      await runSkeptic(baseInput({ stage: "venue", chosenDestination: dest }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Tokyo");
      expect(prompt).toContain("MUST be in or near");
    });

    it("appends US region to location when country_code is US", async () => {
      const dest = entity({ name: "Los Angeles", entityId: "eid-la", geocode: { country_code: "US", admin1_region: "California" } });
      await runSkeptic(baseInput({ stage: "venue", chosenDestination: dest }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Los Angeles, California");
    });

    it("does not append region for non-US/CA countries", async () => {
      const dest = entity({ name: "Paris", entityId: "eid-paris", geocode: { country_code: "FR", admin1_region: "Île-de-France" } });
      await runSkeptic(baseInput({ stage: "venue", chosenDestination: dest }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      // should just say "Paris", not "Paris, Île-de-France"
      expect(prompt).not.toContain("Île-de-France");
    });

    it("shows destination stage message when stage is destination", async () => {
      await runSkeptic(baseInput({ stage: "destination" }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Destination stage");
    });
  });

  describe("tag fallback", () => {
    it("falls back to 'no tags available' when getInsights returns empty", async () => {
      mockGetInsights.mockResolvedValue([]);
      await runSkeptic(baseInput());
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("no tags available");
    });
  });

  describe("error propagation", () => {
    it("throws when getInsights fails", async () => {
      mockGetInsights.mockRejectedValue(new Error("Qloo down"));
      await expect(runSkeptic(baseInput())).rejects.toThrow("Qloo down");
    });

    it("throws when LLM call fails", async () => {
      mockLLM.mockRejectedValue(new Error("Bedrock timeout"));
      await expect(runSkeptic(baseInput())).rejects.toThrow("Bedrock timeout");
    });
  });
});
