import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock agent modules before importing loop
vi.mock("@/lib/agents/negotiator", () => ({
  runNegotiator: vi.fn(),
}));
vi.mock("@/lib/agents/advocate", () => ({
  runAdvocate: vi.fn(),
}));
vi.mock("@/lib/agents/skeptic", () => ({
  runSkeptic: vi.fn(),
}));

import {
  createConsensusState,
  acceptRound,
  rejectRound,
  runNegotiationRound,
} from "@/lib/agents/loop";
import { runNegotiator } from "@/lib/agents/negotiator";
import { runAdvocate } from "@/lib/agents/advocate";
import { runSkeptic } from "@/lib/agents/skeptic";
import type { ConsensusState, NegotiationRound } from "@/lib/schema/state";
import type { InsightsResult } from "@/lib/qloo/client";

const mockNegotiator = vi.mocked(runNegotiator);
const mockAdvocate = vi.mocked(runAdvocate);
const mockSkeptic = vi.mocked(runSkeptic);

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeEntity(name: string, affinity = 0.85, entityId = "eid-1"): InsightsResult {
  return {
    entityId,
    name,
    affinity,
    explainability: [{ entityId: "anchor-1", score: 0.5, name: "Anchor" }],
    tags: [{ name: "music", score: 0.9 }],
  };
}

function makeParticipants(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    name: `Person ${i}`,
    tasteAnchors: [{ query: "Daft Punk", entityId: "anchor-1" }],
  }));
}

function approveAll() {
  mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity: makeEntity("Tokyo"), reasoning: "Great match" });
  mockAdvocate.mockResolvedValue({ verdict: "approve", reasoning: "Fairness looks good" });
  mockSkeptic.mockResolvedValue({ verdict: "approve", reasoning: "Structural check passed" });
}

// ── createConsensusState ──────────────────────────────────────────────────────

describe("createConsensusState", () => {
  it("creates state with empty rounds and rejections", () => {
    const state = createConsensusState(makeParticipants());
    expect(state.rounds).toHaveLength(0);
    expect(state.rejections).toHaveLength(0);
  });

  it("stores the participants", () => {
    const participants = makeParticipants(3);
    const state = createConsensusState(participants);
    expect(state.participants).toHaveLength(3);
    expect(state.participants[0].name).toBe("Person 0");
  });
});

// ── acceptRound ───────────────────────────────────────────────────────────────

describe("acceptRound", () => {
  function stateWithRound(stage: "destination" | "venue" = "destination"): ConsensusState {
    const entity = makeEntity("Tokyo");
    const round: NegotiationRound = {
      stage,
      proposal: { stage, entity, reasoning: "Great" },
      accepted: false,
    };
    return { participants: makeParticipants(), rounds: [round], rejections: [] };
  }

  it("marks the last round as accepted", () => {
    const next = acceptRound(stateWithRound());
    expect(next.rounds[0].accepted).toBe(true);
  });

  it("promotes chosenDestination when the accepted stage is destination", () => {
    const next = acceptRound(stateWithRound("destination"));
    expect(next.chosenDestination?.name).toBe("Tokyo");
  });

  it("does not overwrite chosenDestination when accepting a venue round", () => {
    const base = stateWithRound("venue");
    const existingDest = makeEntity("Kyoto", 0.9, "eid-kyoto");
    const stateWithDest = { ...base, chosenDestination: existingDest };
    const next = acceptRound(stateWithDest);
    expect(next.chosenDestination?.name).toBe("Kyoto");
  });

  it("returns state unchanged when there are no rounds", () => {
    const state: ConsensusState = { participants: makeParticipants(), rounds: [], rejections: [] };
    const next = acceptRound(state);
    expect(next.rounds).toHaveLength(0);
  });

  it("does not mutate the original state", () => {
    const state = stateWithRound();
    acceptRound(state);
    expect(state.rounds[0].accepted).toBe(false);
  });
});

// ── rejectRound ───────────────────────────────────────────────────────────────

describe("rejectRound", () => {
  function stateWithRound(extraRejections: ConsensusState["rejections"] = []): ConsensusState {
    const entity = makeEntity("Paris", 0.8, "eid-paris");
    const round: NegotiationRound = {
      stage: "destination",
      proposal: { stage: "destination", entity, reasoning: "Nice" },
      accepted: false,
    };
    return { participants: makeParticipants(), rounds: [round], rejections: extraRejections };
  }

  it("appends the rejected entity to the rejections list", () => {
    const next = rejectRound(stateWithRound());
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].entityName).toBe("Paris");
  });

  it("preserves existing rejections — all prior rejections survive", () => {
    const prior = [{ stage: "destination" as const, entityId: "eid-berlin", entityName: "Berlin" }];
    const next = rejectRound(stateWithRound(prior));
    expect(next.rejections).toHaveLength(2);
    expect(next.rejections.map((r) => r.entityName)).toContain("Berlin");
    expect(next.rejections.map((r) => r.entityName)).toContain("Paris");
  });

  it("records the correct entityId in the rejection", () => {
    const next = rejectRound(stateWithRound());
    expect(next.rejections[0].entityId).toBe("eid-paris");
  });

  it("records the correct stage in the rejection", () => {
    const next = rejectRound(stateWithRound());
    expect(next.rejections[0].stage).toBe("destination");
  });

  it("returns state unchanged when there are no rounds", () => {
    const state: ConsensusState = { participants: makeParticipants(), rounds: [], rejections: [] };
    const next = rejectRound(state);
    expect(next.rejections).toHaveLength(0);
  });

  it("does not mutate the original state", () => {
    const state = stateWithRound();
    rejectRound(state);
    expect(state.rejections).toHaveLength(0);
  });
});

// ── runNegotiationRound ───────────────────────────────────────────────────────

describe("runNegotiationRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseState = (): ConsensusState => ({
    participants: makeParticipants(),
    rounds: [],
    rejections: [],
  });

  describe("fast path", () => {
    it("skips advocate and skeptic when proposal is clean (high affinity, low gap, no rejections)", async () => {
      // affinity=0.90 > 0.80, explainability scores near-equal → gap < 0.15
      const entity = { ...makeEntity("Tokyo", 0.90), explainability: [{ entityId: "a", score: 0.5, name: "A" }, { entityId: "b", score: 0.52, name: "B" }] };
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity, reasoning: "Strong match" });

      const result = await runNegotiationRound(baseState(), "destination");

      expect(mockAdvocate).not.toHaveBeenCalled();
      expect(mockSkeptic).not.toHaveBeenCalled();
      expect(result.round.advocateResult?.verdict).toBe("approve");
      expect(result.round.skepticResult?.verdict).toBe("approve");
    });
  });

  describe("both agents approve", () => {
    it("returns the round after one pass when both approve", async () => {
      approveAll();
      // low affinity forces real agent calls
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity: makeEntity("Tokyo", 0.60), reasoning: "ok" });

      const result = await runNegotiationRound(baseState(), "destination");

      expect(mockNegotiator).toHaveBeenCalledTimes(1);
      expect(result.round.advocateResult?.verdict).toBe("approve");
      expect(result.round.skepticResult?.verdict).toBe("approve");
    });

    it("adds the round to state", async () => {
      approveAll();
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity: makeEntity("Tokyo", 0.60), reasoning: "ok" });

      const result = await runNegotiationRound(baseState(), "destination");
      expect(result.state.rounds).toHaveLength(1);
    });

    it("sets consensusScore to the entity's affinity", async () => {
      approveAll();
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity: makeEntity("Tokyo", 0.72), reasoning: "ok" });

      const result = await runNegotiationRound(baseState(), "destination");
      expect(result.state.consensusScore).toBeCloseTo(0.72);
    });
  });

  describe("advocate pushback then approve", () => {
    it("calls negotiator twice when advocate pushes back on first pass", async () => {
      const entity = makeEntity("Tokyo", 0.60);
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity, reasoning: "ok" });
      mockAdvocate
        .mockResolvedValueOnce({ verdict: "pushback", reasoning: "Unfair to Person 1", underservedParticipant: "Person 1" })
        .mockResolvedValueOnce({ verdict: "approve", reasoning: "Now balanced" });
      mockSkeptic.mockResolvedValue({ verdict: "approve", reasoning: "Structural ok" });

      await runNegotiationRound(baseState(), "destination");

      expect(mockNegotiator).toHaveBeenCalledTimes(2);
    });

    it("surfaces approve after pushback revision", async () => {
      const entity = makeEntity("Tokyo", 0.60);
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity, reasoning: "ok" });
      mockAdvocate
        .mockResolvedValueOnce({ verdict: "pushback", reasoning: "Unfair", underservedParticipant: "Person 1" })
        .mockResolvedValueOnce({ verdict: "approve", reasoning: "Good now" });
      mockSkeptic.mockResolvedValue({ verdict: "approve", reasoning: "Fine" });

      const result = await runNegotiationRound(baseState(), "destination");
      expect(result.round.advocateResult?.verdict).toBe("approve");
    });
  });

  describe("skeptic pushback then approve", () => {
    it("calls negotiator twice when skeptic pushes back on first pass", async () => {
      const entity = makeEntity("Tokyo", 0.60);
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity, reasoning: "ok" });
      mockAdvocate.mockResolvedValue({ verdict: "approve", reasoning: "Fair" });
      mockSkeptic
        .mockResolvedValueOnce({ verdict: "pushback", reasoning: "Scope mismatch", failureMode: "scope_mismatch", negotiatorConstraint: "Must be in Europe" })
        .mockResolvedValueOnce({ verdict: "approve", reasoning: "Now valid" });

      await runNegotiationRound(baseState(), "destination");

      expect(mockNegotiator).toHaveBeenCalledTimes(2);
    });
  });

  describe("max critique rounds reached", () => {
    it("surfaces the proposal after 2 critique passes even if agents keep pushing back", async () => {
      const entity = makeEntity("Tokyo", 0.60);
      mockNegotiator.mockResolvedValue({ entityId: "eid-1", entity, reasoning: "ok" });
      mockAdvocate.mockResolvedValue({ verdict: "pushback", reasoning: "Still unfair", underservedParticipant: "Person 1" });
      mockSkeptic.mockResolvedValue({ verdict: "pushback", reasoning: "Still wrong", failureMode: "scope_mismatch" });

      const result = await runNegotiationRound(baseState(), "destination");

      // negotiator called for pass 0, 1, 2 (MAX_CRITIQUE_ROUNDS=2, loop is <=)
      expect(mockNegotiator).toHaveBeenCalledTimes(3);
      // result is still surfaced — does not throw
      expect(result.round).toBeDefined();
    });
  });

  describe("history carries prior rounds", () => {
    it("passes prior round history to the negotiator on a second negotiation round", async () => {
      const entity = makeEntity("Tokyo", 0.90, "eid-tokyo");
      const round: NegotiationRound = {
        stage: "destination",
        proposal: { stage: "destination", entity, reasoning: "First pick" },
        accepted: true,
      };
      const stateWithHistory: ConsensusState = {
        participants: makeParticipants(),
        rounds: [round],
        rejections: [],
      };

      mockNegotiator.mockResolvedValue({ entityId: "eid-2", entity: makeEntity("Kyoto", 0.85, "eid-kyoto"), reasoning: "Second pick" });
      mockAdvocate.mockResolvedValue({ verdict: "approve", reasoning: "ok" });
      mockSkeptic.mockResolvedValue({ verdict: "approve", reasoning: "ok" });

      await runNegotiationRound(stateWithHistory, "venue");

      const callArg = mockNegotiator.mock.calls[0][0];
      expect(callArg.history.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("throws when negotiator returns a proposal with no entity", async () => {
      mockNegotiator.mockResolvedValue({ entityId: "eid-missing", entity: undefined as never, reasoning: "bad" });

      await expect(runNegotiationRound(baseState(), "destination")).rejects.toThrow(
        "Negotiator proposed an entity",
      );
    });
  });
});
