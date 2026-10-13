import { describe, it, expect } from "vitest";
import { encodeEvent, makeSSEStream } from "@/lib/stream";
import type { StreamEvent } from "@/lib/stream";

// ── helpers ───────────────────────────────────────────────────────────────────

async function collectSSE(res: Response): Promise<StreamEvent[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: StreamEvent[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split("\n")) {
      if (line.startsWith("data: ")) {
        events.push(JSON.parse(line.slice(6)));
      }
    }
    buffer = "";
  }
  return events;
}

// ── encodeEvent ───────────────────────────────────────────────────────────────

describe("encodeEvent", () => {
  it("produces a data: prefixed JSON line ending with double newline", () => {
    const encoded = encodeEvent({ type: "negotiator_thinking" });
    expect(encoded).toBe(`data: {"type":"negotiator_thinking"}\n\n`);
  });

  it("includes payload when provided", () => {
    const encoded = encodeEvent({ type: "error", payload: { message: "oops" } });
    expect(encoded).toContain('"payload":{"message":"oops"}');
  });

  it("omits payload key when not provided", () => {
    const encoded = encodeEvent({ type: "anchors_resolving" });
    expect(encoded).not.toContain("payload");
  });

  it("handles payload with nested objects", () => {
    const encoded = encodeEvent({ type: "round_complete", payload: { entity: { name: "Tokyo", affinity: 0.9 } } });
    const parsed = JSON.parse(encoded.slice(6));
    expect(parsed.payload.entity.affinity).toBe(0.9);
  });
});

// ── makeSSEStream ─────────────────────────────────────────────────────────────

describe("makeSSEStream", () => {
  it("returns a Response with text/event-stream content type", () => {
    const res = makeSSEStream(async () => {});
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("emits events in order", async () => {
    const res = makeSSEStream(async (emit) => {
      emit({ type: "anchors_resolving", payload: { count: 3 } });
      emit({ type: "negotiator_thinking" });
      emit({ type: "round_complete" });
    });
    const events = await collectSSE(res);
    expect(events.map((e) => e.type)).toEqual([
      "anchors_resolving",
      "negotiator_thinking",
      "round_complete",
    ]);
  });

  it("emits an error event when the handler throws", async () => {
    const res = makeSSEStream(async () => {
      throw new Error("something went wrong");
    });
    const events = await collectSSE(res);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect((events[0].payload as { message: string }).message).toBe("something went wrong");
  });

  it("closes the stream cleanly after handler completes", async () => {
    const res = makeSSEStream(async (emit) => {
      emit({ type: "negotiator_thinking" });
    });
    const events = await collectSSE(res);
    // stream ends without hanging
    expect(events).toHaveLength(1);
  });

  it("emits an error event and still closes when handler throws mid-stream", async () => {
    const res = makeSSEStream(async (emit) => {
      emit({ type: "anchors_resolving" });
      throw new Error("mid-stream failure");
    });
    const events = await collectSSE(res);
    expect(events[0].type).toBe("anchors_resolving");
    expect(events[1].type).toBe("error");
  });

  it("emits nothing and closes cleanly for a no-op handler", async () => {
    const res = makeSSEStream(async () => {});
    const events = await collectSSE(res);
    expect(events).toHaveLength(0);
  });
});
