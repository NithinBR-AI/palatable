// Server-sent event helpers for the negotiation streaming API.
// Each event is a JSON line prefixed with "data: " per the SSE spec.

export type StreamEventType =
  | "anchors_resolving"
  | "anchors_resolved"
  | "negotiator_thinking"
  | "negotiator_proposed"
  | "advocate_thinking"
  | "advocate_verdict"
  | "skeptic_thinking"
  | "skeptic_verdict"
  | "critique_revising"
  | "round_complete"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  payload?: Record<string, unknown>;
}

export function encodeEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function makeSSEStream(
  handler: (emit: (event: StreamEvent) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };
      try {
        await handler(emit);
      } catch (err) {
        emit({ type: "error", payload: { message: (err as Error).message } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
