import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing the route
vi.mock("@/lib/extract/anchors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/extract/anchors")>();
  return {
    ...actual,
    extractAnchors: vi.fn(),
  };
});

vi.mock("@/lib/guardrails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/guardrails")>();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
    checkAnchorQuality: vi.fn().mockReturnValue({ warnings: [], blocked: false }),
    checkContentSafety: vi.fn().mockResolvedValue({ blocked: false }),
  };
});

import { POST } from "@/app/api/extract/route";
import { extractAnchors } from "@/lib/extract/anchors";
import { checkRateLimit, checkAnchorQuality } from "@/lib/guardrails";

const mockExtract = vi.mocked(extractAnchors);
const mockRateLimit = vi.mocked(checkRateLimit);
const mockQuality = vi.mocked(checkAnchorQuality);

function makeRequest(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

// Read all SSE events from a streaming response
async function readSSE(res: Response): Promise<{ type: string; payload?: Record<string, unknown> }[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: { type: string; payload?: Record<string, unknown> }[] = [];
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

const VALID_MESSAGES = [
  { participantId: "p-a", participantName: "Alice", text: "I love Daft Punk", timestamp: "2026-01-01T00:00:00Z" },
];

const SAMPLE_ANCHOR = {
  participantId: "p-a",
  participantName: "Alice",
  anchorText: "Daft Punk",
  entityId: "qloo-123",
  entityType: "urn:entity:artist",
  vibeContext: "",
  confidence: 0.8,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockReturnValue({ allowed: true });
  mockQuality.mockReturnValue({ warnings: [], blocked: false });
  mockExtract.mockResolvedValue([SAMPLE_ANCHOR]);
});

describe("POST /api/extract", () => {
  describe("happy path", () => {
    it("streams extract_done with anchors, warnings, and blocked flag", async () => {
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      expect(res.status).toBe(200);
      const events = await readSSE(res);
      const done = events.find((e) => e.type === "extract_done");
      expect(done).toBeDefined();
      expect((done!.payload!.anchors as unknown[]).length).toBe(1);
      expect(done!.payload!.blocked).toBe(false);
      expect(done!.payload!.warnings).toEqual([]);
    });

    it("passes persist=false to extractAnchors when specified", async () => {
      const res = await POST(makeRequest({ messages: VALID_MESSAGES, persist: false }));
      await readSSE(res);
      expect(mockExtract).toHaveBeenCalledWith(VALID_MESSAGES, false);
    });

    it("defaults persist to true when not specified", async () => {
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      await readSSE(res);
      expect(mockExtract).toHaveBeenCalledWith(VALID_MESSAGES, true);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      mockRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 45000 });
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      expect(res.status).toBe(429);
    });

    it("sets Retry-After header in seconds when rate limited", async () => {
      mockRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 45000 });
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      expect(res.headers.get("Retry-After")).toBe("45");
    });

    it("uses the IP from x-forwarded-for as the rate limit key", async () => {
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }, "9.8.7.6"));
      await readSSE(res);
      expect(mockRateLimit).toHaveBeenCalledWith("9.8.7.6");
    });

    it("falls back to 'unknown' when no IP header present", async () => {
      const req = new Request("http://localhost/api/extract", {
        method: "POST",
        body: JSON.stringify({ messages: VALID_MESSAGES }),
      });
      const res = await POST(req);
      await readSSE(res);
      expect(mockRateLimit).toHaveBeenCalledWith("unknown");
    });
  });

  describe("request validation", () => {
    it("returns 400 for empty body", async () => {
      const req = new Request("http://localhost/api/extract", { method: "POST", body: "" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/api/extract", { method: "POST", body: "not-json" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid JSON");
    });

    it("returns 400 when messages array is missing", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 when messages is an empty array", async () => {
      const res = await POST(makeRequest({ messages: [] }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when messages is not an array", async () => {
      const res = await POST(makeRequest({ messages: "not an array" }));
      expect(res.status).toBe(400);
    });
  });

  describe("guardrail integration", () => {
    it("streams extract_done with blocked=true when checkAnchorQuality blocks", async () => {
      mockQuality.mockReturnValue({ warnings: [], blocked: true });
      mockExtract.mockResolvedValue([]);
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      const events = await readSSE(res);
      const done = events.find((e) => e.type === "extract_done");
      expect(done!.payload!.blocked).toBe(true);
    });

    it("streams extract_done with warnings when quality check produces them", async () => {
      const warning = { participantId: "p-b", participantName: "Bob", level: "no_signal" as const };
      mockQuality.mockReturnValue({ warnings: [warning], blocked: false });
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      const events = await readSSE(res);
      const done = events.find((e) => e.type === "extract_done");
      expect((done!.payload!.warnings as unknown[]).length).toBe(1);
    });
  });

  describe("error handling", () => {
    it("streams error event when extractAnchors throws", async () => {
      mockExtract.mockRejectedValue(new Error("Bedrock timeout"));
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      expect(res.status).toBe(200); // SSE always starts 200
      const events = await readSSE(res);
      const err = events.find((e) => e.type === "error");
      expect(err).toBeDefined();
      expect(err!.payload!.message).toBe("Bedrock timeout");
    });

    it("streams error event for non-Error throws", async () => {
      mockExtract.mockRejectedValue("string error");
      const res = await POST(makeRequest({ messages: VALID_MESSAGES }));
      const events = await readSSE(res);
      const err = events.find((e) => e.type === "error");
      expect(err).toBeDefined();
    });
  });
});
