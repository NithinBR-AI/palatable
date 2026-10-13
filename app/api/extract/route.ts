import { extractAnchors, type RawMessage } from "@/lib/extract/anchors";
import { checkRateLimit, checkAnchorQuality, checkContentSafety } from "@/lib/guardrails";

interface RequestBody {
  messages: RawMessage[];
  persist?: boolean; // default true — set false for try-it-yourself (no DB write needed)
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

  const safetyCheck = await checkContentSafety(body.messages);
  if (safetyCheck.blocked) {
    return new Response(JSON.stringify({ error: safetyCheck.reason }), { status: 422 });
  }

  try {
    const anchors = await extractAnchors(body.messages, body.persist ?? true);

    const { warnings, blocked } = checkAnchorQuality(anchors, body.messages);

    return new Response(JSON.stringify({ anchors, warnings, blocked }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
