// Guardrail: content safety checks on raw participant messages.
// PII: regex (fast, deterministic).
// Topic scope: LLM via Mantle (accurate, avoids false positives from regex).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runPlainCompletion } from "@/lib/bedrock/client";

const SAFETY_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/content-safety.txt"), "utf-8");

const PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/,                                                    // SSN
  /\b\d{16}\b/,                                                                 // credit card
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i,                        // email
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,                     // phone
  /\b\d{1,3}\s+[A-Za-z0-9\s,\.]+\b(street|st|avenue|ave|road|rd|blvd|lane|ln|drive|dr)\b/i, // street address
];

export interface ContentSafetyResult {
  blocked: boolean;
  reason?: string;
  participantId?: string;
}

function checkPII(messages: { participantId: string; text: string }[]): ContentSafetyResult {
  for (const msg of messages) {
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(msg.text)) {
        return {
          blocked: true,
          reason: "Message contains personal information (PII). Please don't share private details.",
          participantId: msg.participantId,
        };
      }
    }
  }
  return { blocked: false };
}

async function checkTopicScope(messages: { participantId: string; text: string }[]): Promise<ContentSafetyResult> {
  const combined = messages.map((m) => m.text).join("\n");

  let raw: string;
  try {
    raw = await runPlainCompletion(SAFETY_PROMPT, combined);
  } catch {
    // If the safety LLM call fails, fail open — don't block the user
    return { blocked: false };
  }

  try {
    const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(json) as { safe: boolean; reason?: string };
    if (!result.safe) {
      return { blocked: true, reason: result.reason ?? "This topic is outside Palatable's scope." };
    }
  } catch {
    // Unparseable response — fail open
  }

  return { blocked: false };
}

export async function checkContentSafety(
  messages: { participantId: string; text: string }[],
): Promise<ContentSafetyResult> {
  const pii = checkPII(messages);
  if (pii.blocked) return pii;

  return checkTopicScope(messages);
}
