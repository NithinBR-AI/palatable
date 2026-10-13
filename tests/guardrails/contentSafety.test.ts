import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM so topic-scope tests don't make real API calls
vi.mock("@/lib/bedrock/client", () => ({
  runPlainCompletion: vi.fn(),
}));

import { checkContentSafety } from "@/lib/guardrails/contentSafety";
import { runPlainCompletion } from "@/lib/bedrock/client";

const mockLLM = vi.mocked(runPlainCompletion);

function msg(text: string, participantId = "p-1") {
  return [{ participantId, text }];
}

describe("checkContentSafety — PII (regex, no LLM)", () => {
  beforeEach(() => {
    // PII blocks before LLM is called — LLM should never fire in these tests
    mockLLM.mockResolvedValue('{"safe":true}');
  });

  it("blocks SSN pattern", async () => {
    const result = await checkContentSafety(msg("my SSN is 123-45-6789"));
    expect(result.blocked).toBe(true);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("blocks email address", async () => {
    const result = await checkContentSafety(msg("contact me at alice@example.com"));
    expect(result.blocked).toBe(true);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("blocks US phone number", async () => {
    const result = await checkContentSafety(msg("call me at 415-555-1234"));
    expect(result.blocked).toBe(true);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("blocks 16-digit credit card number", async () => {
    const result = await checkContentSafety(msg("card is 4111111111111111"));
    expect(result.blocked).toBe(true);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("blocks street address", async () => {
    const result = await checkContentSafety(msg("I live at 42 Maple Street"));
    expect(result.blocked).toBe(true);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("returns participantId of the offending message", async () => {
    const result = await checkContentSafety(msg("my email is foo@bar.com", "p-alice"));
    expect(result.participantId).toBe("p-alice");
  });

  it("allows normal food preference messages", async () => {
    const result = await checkContentSafety(msg("I love sushi and craft beer"));
    expect(result.blocked).toBe(false);
  });

  it("allows dietary preferences without medical context", async () => {
    const result = await checkContentSafety(msg("I'm vegetarian and avoid shellfish"));
    expect(result.blocked).toBe(false);
  });
});

describe("checkContentSafety — topic scope (LLM)", () => {
  it("blocks when LLM returns unsafe", async () => {
    mockLLM.mockResolvedValue('{"safe":false,"reason":"This is medical advice."}');
    const result = await checkContentSafety(msg("recommend a diet plan for my diabetes"));
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("This is medical advice.");
  });

  it("passes when LLM returns safe", async () => {
    mockLLM.mockResolvedValue('{"safe":true}');
    const result = await checkContentSafety(msg("where should we eat in NYC this weekend?"));
    expect(result.blocked).toBe(false);
  });

  it("fails open when LLM call throws", async () => {
    mockLLM.mockRejectedValue(new Error("Mantle HTTP 500"));
    const result = await checkContentSafety(msg("some message"));
    expect(result.blocked).toBe(false);
  });

  it("fails open when LLM returns unparseable response", async () => {
    mockLLM.mockResolvedValue("I cannot determine this.");
    const result = await checkContentSafety(msg("some message"));
    expect(result.blocked).toBe(false);
  });

  it("calls LLM with combined text from all messages", async () => {
    mockLLM.mockResolvedValue('{"safe":true}');
    await checkContentSafety([
      { participantId: "p-1", text: "I like ramen" },
      { participantId: "p-2", text: "I prefer Italian" },
    ]);
    expect(mockLLM).toHaveBeenCalledWith(
      expect.any(String),
      "I like ramen\nI prefer Italian",
    );
  });
});
