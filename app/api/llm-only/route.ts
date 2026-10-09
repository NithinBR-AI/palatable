import { runPlainCompletion } from "@/lib/bedrock/client";
import { checkRateLimit } from "@/lib/guardrails";
import type { Participant } from "@/lib/schema/state";

interface RequestBody {
  participants: Participant[];
  stage: "destination" | "venue";
  chosenDestination?: string;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = checkRateLimit(ip);
  if (!allowed) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });

  const { participants, stage, chosenDestination }: RequestBody = await req.json();

  const anchorText = participants
    .map((p) => `${p.name} likes: ${p.tasteAnchors.map((a) => a.query).join(", ")}`)
    .join(". ");

  const prompt = stage === "venue" && chosenDestination
    ? `The group is visiting ${chosenDestination}. ${anchorText}. Based on their tastes, suggest one venue or restaurant in ${chosenDestination} they'd all enjoy. Answer in 2-3 sentences.`
    : `${anchorText}. Based on their tastes, where should this group go on a trip together? Answer in 2-3 sentences.`;

  const result = await runPlainCompletion(
    "You help groups of friends pick travel destinations and venues based on their cultural tastes. Give concrete, specific suggestions.",
    prompt,
  );

  return Response.json({ result });
}
