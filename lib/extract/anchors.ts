import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runStructuredCompletion } from "@/lib/bedrock/client";
import { searchEntity } from "@/lib/qloo/client";
import { putAnchor } from "@/lib/db/anchors";
import type { AnchorRecord } from "@/lib/db/schema";

export interface RawMessage {
  participantId: string;
  participantName: string;
  text: string;
  timestamp: string;
}

export interface ExtractedAnchor {
  participantId: string;
  participantName: string;
  anchorText: string;          // named entity extracted e.g. "Tame Impala"
  entityId: string;            // Qloo entity ID — empty if vibe-only
  entityType: string;          // urn:entity:artist etc., or "vibe"
  vibeContext: string;         // freeform vibe signal e.g. "rooftop, live music"
  confidence: number;
}

interface LLMExtractionOutput {
  anchors: Array<{
    participantId: string;
    anchorText: string;
    signalType: "named_entity" | "vibe";
    vibeContext: string;
  }>;
}

const EXTRACTION_SYSTEM_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/anchor-extractor.txt"), "utf-8");

// Priority order: taste-signal types first, then fallback
const TASTE_TYPES = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:place",
  "urn:entity:brand",
  "urn:entity:destination",
  "urn:entity:person",
];

async function resolveToQloo(
  anchorText: string,
): Promise<{ entityId: string; entityType: string } | null> {
  try {
    // Fetch more candidates so we can pick the best type match
    const results = await searchEntity(anchorText, undefined, 5);
    if (!results.length) return null;

    // Pick the result whose type appears earliest in TASTE_TYPES priority list
    // This avoids e.g. "Con Todo El Mundo" resolving to a TV show instead of artist
    let best = results[0];
    let bestPriority = TASTE_TYPES.indexOf(best.type);

    for (const r of results.slice(1)) {
      const p = TASTE_TYPES.indexOf(r.type);
      if (p !== -1 && (bestPriority === -1 || p < bestPriority)) {
        best = r;
        bestPriority = p;
      }
    }

    if (bestPriority === -1) return null; // no useful type found
    return { entityId: best.entityId, entityType: best.type };
  } catch {
    return null;
  }
}

export async function extractAnchors(
  messages: RawMessage[],
  persist = true,
): Promise<ExtractedAnchor[]> {
  if (!messages.length) return [];

  const messageBlock = messages
    .map((m) => `[${m.participantName} | ${m.participantId}]: ${m.text}`)
    .join("\n");

  const llmOutput = await runStructuredCompletion<LLMExtractionOutput>(
    EXTRACTION_SYSTEM_PROMPT,
    `Extract taste anchors from these messages:\n\n${messageBlock}`,
    [],
    { maxTokens: 800 },
  );

  const rawAnchors = llmOutput.anchors ?? [];

  // Resolve named entities to Qloo IDs in parallel
  const resolved = await Promise.all(
    rawAnchors.map(async (a) => {
      const now = new Date().toISOString();

      if (a.signalType === "vibe") {
        const anchor: ExtractedAnchor = {
          participantId: a.participantId,
          participantName: messages.find((m) => m.participantId === a.participantId)?.participantName ?? a.participantId,
          anchorText: a.anchorText,
          entityId: "",
          entityType: "vibe",
          vibeContext: a.vibeContext || a.anchorText,
          confidence: 0.5,
        };
        if (persist) {
          const record: AnchorRecord = {
            participantId: a.participantId,
            extractedAt: now,
            anchorText: a.anchorText,
            entityId: "",
            entityType: "vibe",
            vibeContext: anchor.vibeContext,
            confidence: 0.5,
            status: "active",
            firstSeen: now,
            lastSeen: now,
            lastReinforced: now,
          };
          await putAnchor(record).catch(() => {});
        }
        return anchor;
      }

      // Named entity — resolve to Qloo
      const qlooResult = await resolveToQloo(a.anchorText);
      if (!qlooResult) return null;

      const anchor: ExtractedAnchor = {
        participantId: a.participantId,
        participantName: messages.find((m) => m.participantId === a.participantId)?.participantName ?? a.participantId,
        anchorText: a.anchorText,
        entityId: qlooResult.entityId,
        entityType: qlooResult.entityType,
        vibeContext: "",
        confidence: 0.5,
      };

      if (persist) {
        const record: AnchorRecord = {
          participantId: a.participantId,
          extractedAt: now,
          anchorText: a.anchorText,
          entityId: qlooResult.entityId,
          entityType: qlooResult.entityType,
          vibeContext: "",
          confidence: 0.5,
          status: "active",
          firstSeen: now,
          lastSeen: now,
          lastReinforced: now,
        };
        await putAnchor(record).catch(() => {});
      }

      return anchor;
    }),
  );

  return resolved.filter((a): a is ExtractedAnchor => a !== null);
}

// Summarise extracted anchors into a human-readable taste profile line
// e.g. "indie cinema, psychedelic rock, Japanese food"
export function buildTasteProfile(anchors: ExtractedAnchor[]): string {
  const vibes = anchors
    .filter((a) => a.entityType === "vibe")
    .map((a) => a.vibeContext || a.anchorText);

  const named = anchors
    .filter((a) => a.entityType !== "vibe")
    .map((a) => a.anchorText);

  return [...named, ...vibes].slice(0, 5).join(", ");
}
