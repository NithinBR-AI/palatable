import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/qloo/client", () => ({
  searchEntity: vi.fn(),
  getInsights: vi.fn(),
}));
vi.mock("@/lib/bedrock/client", () => ({
  runStructuredCompletion: vi.fn(),
}));

import { runNegotiator } from "@/lib/agents/negotiator";
import { searchEntity, getInsights } from "@/lib/qloo/client";
import { runStructuredCompletion } from "@/lib/bedrock/client";
import type { InsightsResult } from "@/lib/qloo/client";
import type { Participant, RejectionRecord } from "@/lib/schema/state";

const mockSearch = vi.mocked(searchEntity);
const mockInsights = vi.mocked(getInsights);
const mockLLM = vi.mocked(runStructuredCompletion);

// ── fixtures ──────────────────────────────────────────────────────────────────

function candidate(name: string, entityId: string, affinity = 0.85): InsightsResult {
  return {
    entityId,
    name,
    affinity,
    explainability: [{ entityId: "resolved-anchor-1", score: 0.7, name: "Daft Punk" }],
    tags: [{ name: "music", score: 0.9 }],
  };
}

function participant(name: string, anchors: string[]): Participant {
  return {
    id: `p-${name.toLowerCase()}`,
    name,
    tasteAnchors: anchors.map((q) => ({ query: q, entityId: "" })),
  };
}

function baseInput(overrides = {}) {
  return {
    stage: "destination" as const,
    participants: [participant("Alice", ["Daft Punk"]), participant("Bob", ["Thundercat"])],
    rejections: [] as RejectionRecord[],
    history: [],
    ...overrides,
  };
}

const TOKYO = candidate("Tokyo", "eid-tokyo", 0.88);
const PARIS = candidate("Paris", "eid-paris", 0.75);

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockResolvedValue([{ entityId: "resolved-anchor-1", name: "Daft Punk", type: "urn:entity:artist" }]);
  mockInsights.mockResolvedValue([TOKYO, PARIS]);
  mockLLM.mockResolvedValue({ entityId: "eid-tokyo", reasoning: "Tokyo scores highest" });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runNegotiator", () => {
  describe("anchor resolution", () => {
    it("calls searchEntity for each taste anchor", async () => {
      await runNegotiator(baseInput());
      // 2 participants × 1 anchor each = 2 calls
      expect(mockSearch).toHaveBeenCalledTimes(2);
    });

    it("calls searchEntity with the anchor query text", async () => {
      await runNegotiator(baseInput());
      const queries = mockSearch.mock.calls.map((c) => c[0]);
      expect(queries).toContain("Daft Punk");
      expect(queries).toContain("Thundercat");
    });

    it("skips anchors whose search returns no results", async () => {
      mockSearch
        .mockResolvedValueOnce([]) // Daft Punk fails
        .mockResolvedValueOnce([{ entityId: "anchor-thundercat", name: "Thundercat", type: "urn:entity:artist" }]);

      await runNegotiator(baseInput());
      // getInsights should still be called — just with fewer signal IDs
      expect(mockInsights).toHaveBeenCalledTimes(1);
      const call = mockInsights.mock.calls[0][0];
      expect(call.signalEntityIds).not.toContain("resolved-anchor-daftpunk");
      expect(call.signalEntityIds).toContain("anchor-thundercat");
    });

    it("still calls getInsights even when all anchors fail to resolve", async () => {
      mockSearch.mockResolvedValue([]);
      await runNegotiator(baseInput());
      expect(mockInsights).toHaveBeenCalledTimes(1);
      expect(mockInsights.mock.calls[0][0].signalEntityIds).toHaveLength(0);
    });

    it("handles participants with multiple anchors", async () => {
      const input = baseInput({
        participants: [participant("Alice", ["Daft Punk", "Solange", "Thundercat"])],
      });
      await runNegotiator(input);
      expect(mockSearch).toHaveBeenCalledTimes(3);
    });
  });

  describe("insights query", () => {
    it("uses filterType urn:entity:destination for destination stage", async () => {
      await runNegotiator(baseInput({ stage: "destination" }));
      expect(mockInsights.mock.calls[0][0].filterType).toBe("urn:entity:destination");
    });

    it("uses filterType urn:entity:place for venue stage", async () => {
      await runNegotiator(baseInput({ stage: "venue" }));
      expect(mockInsights.mock.calls[0][0].filterType).toBe("urn:entity:place");
    });

    it("passes rejection entityIds as excludeEntityIds", async () => {
      const input = baseInput({
        rejections: [{ stage: "destination" as const, entityId: "eid-berlin", entityName: "Berlin" }],
      });
      await runNegotiator(input);
      expect(mockInsights.mock.calls[0][0].excludeEntityIds).toContain("eid-berlin");
    });

    it("passes locationQuery as filterLocationQuery when provided", async () => {
      await runNegotiator(baseInput({ stage: "venue", locationQuery: "Tokyo" }));
      expect(mockInsights.mock.calls[0][0].filterLocationQuery).toBe("Tokyo");
    });

    it("does not pass filterLocationQuery for destination stage", async () => {
      await runNegotiator(baseInput({ stage: "destination", locationQuery: undefined }));
      expect(mockInsights.mock.calls[0][0].filterLocationQuery).toBeUndefined();
    });

    it("requests explainability:true", async () => {
      await runNegotiator(baseInput());
      expect(mockInsights.mock.calls[0][0].explainability).toBe(true);
    });
  });

  describe("location fallback", () => {
    it("retries getInsights without locationQuery when first call returns < 2 candidates", async () => {
      // First call (scoped) returns only 1 result — should retry without scope
      mockInsights
        .mockResolvedValueOnce([TOKYO])
        .mockResolvedValueOnce([TOKYO, PARIS]);

      await runNegotiator(baseInput({ stage: "venue", locationQuery: "Tokyo" }));
      expect(mockInsights).toHaveBeenCalledTimes(2);
      // Second call should have no filterLocationQuery
      expect(mockInsights.mock.calls[1][0].filterLocationQuery).toBeUndefined();
    });

    it("does not retry when locationQuery is not provided", async () => {
      mockInsights.mockResolvedValueOnce([TOKYO]); // thin result but no locationQuery
      await runNegotiator(baseInput({ stage: "venue" }));
      expect(mockInsights).toHaveBeenCalledTimes(1);
    });

    it("does not retry when first call returns 2 or more candidates", async () => {
      mockInsights.mockResolvedValueOnce([TOKYO, PARIS]);
      await runNegotiator(baseInput({ stage: "venue", locationQuery: "Tokyo" }));
      expect(mockInsights).toHaveBeenCalledTimes(1);
    });
  });

  describe("error: no candidates", () => {
    it("throws when getInsights returns empty", async () => {
      mockInsights.mockResolvedValue([]);
      await expect(runNegotiator(baseInput())).rejects.toThrow("Qloo returned no candidates");
    });

    it("throws after fallback also returns empty", async () => {
      mockInsights.mockResolvedValue([]);
      await expect(runNegotiator(baseInput({ stage: "venue", locationQuery: "Tokyo" }))).rejects.toThrow("Qloo returned no candidates");
    });
  });

  describe("LLM call and entity matching", () => {
    it("returns the entity whose entityId the LLM picks", async () => {
      mockLLM.mockResolvedValue({ entityId: "eid-paris", reasoning: "Paris is better" });
      const result = await runNegotiator(baseInput());
      expect(result.entity?.name).toBe("Paris");
      expect(result.entityId).toBe("eid-paris");
    });

    it("returns entity=undefined when LLM picks an id not in candidates", async () => {
      mockLLM.mockResolvedValue({ entityId: "eid-nonexistent", reasoning: "Something weird" });
      const result = await runNegotiator(baseInput());
      expect(result.entity).toBeUndefined();
      expect(result.entityId).toBe("eid-nonexistent");
    });

    it("includes rejection summary in the prompt", async () => {
      const input = baseInput({
        rejections: [{ stage: "destination" as const, entityId: "eid-berlin", entityName: "Berlin" }],
      });
      await runNegotiator(input);
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Berlin");
    });

    it("says 'No rejections yet' in prompt when rejections list is empty", async () => {
      await runNegotiator(baseInput({ rejections: [] }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("No rejections yet");
    });

    it("includes locationNote in prompt for venue stage with locationQuery", async () => {
      await runNegotiator(baseInput({ stage: "venue", locationQuery: "Tokyo" }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).toContain("Only propose a venue in or near Tokyo");
    });

    it("does not include locationNote in prompt for destination stage", async () => {
      await runNegotiator(baseInput({ stage: "destination" }));
      const prompt = mockLLM.mock.calls[0][1] as string;
      expect(prompt).not.toContain("Only propose a venue in or near");
    });

    it("passes history to the LLM", async () => {
      const history = [{ role: "user" as const, content: "prior round context" }];
      await runNegotiator(baseInput({ history }));
      expect(mockLLM.mock.calls[0][2]).toEqual(history);
    });

    it("returns the reasoning string from the LLM", async () => {
      mockLLM.mockResolvedValue({ entityId: "eid-tokyo", reasoning: "Strong cross-domain signal" });
      const result = await runNegotiator(baseInput());
      expect(result.reasoning).toBe("Strong cross-domain signal");
    });
  });

  describe("error propagation", () => {
    it("throws when searchEntity fails", async () => {
      mockSearch.mockRejectedValue(new Error("Qloo search 503"));
      await expect(runNegotiator(baseInput())).rejects.toThrow("Qloo search 503");
    });

    it("throws when getInsights fails", async () => {
      mockInsights.mockRejectedValue(new Error("Qloo insights 503"));
      await expect(runNegotiator(baseInput())).rejects.toThrow("Qloo insights 503");
    });

    it("throws when LLM call fails", async () => {
      mockLLM.mockRejectedValue(new Error("Bedrock timeout"));
      await expect(runNegotiator(baseInput())).rejects.toThrow("Bedrock timeout");
    });
  });
});
