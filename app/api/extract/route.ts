import { extractAnchors, type RawMessage } from "@/lib/extract/anchors";
import { checkRateLimit, checkAnchorQuality, checkContentSafety } from "@/lib/guardrails";
import { makeSSEStream } from "@/lib/stream";

interface RequestBody {
  messages: RawMessage[];
  persist?: boolean;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((retryAfterMs ?? 60000) / 1000)) },
    });
  }

  const rawText = await req.text();
  if (!rawText) {
    return new Response(JSON.stringify({ error: "Empty request body" }), { status: 400 });
  }

  let body: RequestBody;
  try {
    body = JSON.parse(rawText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required and must not be empty" }), { status: 400 });
  }

  return makeSSEStream(async (emit) => {
    const safetyCheck = await checkContentSafety(body.messages);
    if (safetyCheck.blocked) {
      emit({ type: "error", payload: { message: safetyCheck.reason, code: "blocked" } });
      return;
    }

    // Emit a heartbeat so the connection stays alive during the LLM + Qloo calls
    emit({ type: "anchors_resolving", payload: { count: body.messages.length } });

    const anchors = await extractAnchors(body.messages, body.persist ?? true);
    const { warnings, blocked } = checkAnchorQuality(anchors, body.messages);

    emit({
      type: "extract_done",
      payload: {
        anchors,
        warnings,
        blocked,
      },
    });
  });
}
