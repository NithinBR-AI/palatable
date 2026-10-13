import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Rate limiter uses module-level Map — isolate by re-importing fresh each test
// by mocking Date.now to control time.

describe("checkRateLimit", () => {
  let checkRateLimit: (key: string) => { allowed: boolean; retryAfterMs?: number };
  let now: number;

  beforeEach(async () => {
    now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    // Re-import to get a fresh module-level Map each describe block is fine
    // because vitest isolates modules per test file by default.
    ({ checkRateLimit } = await import("@/lib/guardrails/rateLimit"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the first request", () => {
    const result = checkRateLimit("ip-1");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("allows up to 20 requests within a window", () => {
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit("ip-20").allowed).toBe(true);
    }
  });

  it("blocks the 21st request in the same window", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-21");
    const result = checkRateLimit("ip-21");
    expect(result.allowed).toBe(false);
  });

  it("returns a positive retryAfterMs when blocked", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-retry");
    const result = checkRateLimit("ip-retry");
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows requests again after the window resets", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-reset");
    expect(checkRateLimit("ip-reset").allowed).toBe(false);

    // advance time past the 60s window
    now += 61_000;
    expect(checkRateLimit("ip-reset").allowed).toBe(true);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-a");
    const resultA = checkRateLimit("ip-a");
    const resultB = checkRateLimit("ip-b");
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("resets exactly at window boundary (resetAt === now)", () => {
    checkRateLimit("ip-boundary");
    // advance to exactly the reset time (1 minute later)
    now += 60_000;
    // should create a fresh window
    expect(checkRateLimit("ip-boundary").allowed).toBe(true);
  });

  it("does not reset one millisecond before the window expires", () => {
    for (let i = 0; i < 20; i++) checkRateLimit("ip-before");
    now += 59_999; // one ms before reset
    expect(checkRateLimit("ip-before").allowed).toBe(false);
  });
});
