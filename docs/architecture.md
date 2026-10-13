# Palatable — Architecture

## Overview

Palatable is a group taste negotiation app. It takes each person's taste signals, maps them to Qloo's taste graph, and runs a three-agent negotiation pipeline to find where the group should go.

---

## System Architecture

```
Browser (Next.js 14 SSR)
    │
    ├── /api/extract      — Extraction Agent (AWS Mantle → deepseek.v3.2)
    ├── /api/negotiate    — Qloo → Negotiator + Advocate + Skeptic loop (SSE streaming)
    └── /api/llm-only     — Same negotiation without Qloo (side-by-side baseline)

Infrastructure
    ├── Amazon DynamoDB
    │       ├── palatable-groups     — Group metadata, participant list
    │       ├── palatable-messages   — Raw chat messages, processed flag
    │       └── palatable-anchors    — Taste anchors per participant (confidence, lifecycle)
    │
    └── AWS Amplify (SSR deployment)
```

All LLM inference goes through **AWS Mantle** (`deepseek.v3.2`, OpenAI-compatible endpoint). **Qloo Insights API** provides the taste graph — destination affinities, cross-entity signals, and cultural resonance a generic LLM cannot replicate.

---

## Pipeline

```
Participant descriptions (freeform text about tastes, artists, places, vibes)
      │
      ▼
  [01] Extraction Agent
      │  Reads descriptions, extracts taste anchors per participant
      │  Classifies each signal as named_entity or vibe
      │  Named entities resolved to Qloo entity IDs via type-priority search
      │  All anchors stored in DynamoDB with confidence=0.5, status=active
      │
  [01a] Content Safety Guard
      │  PII regex (SSN, credit card, email, phone, address)
      │  LLM topic scope check via AWS Mantle
      │
      ▼
  [02] Qloo Insights API (/v2/insights)
      │  Resolved entity IDs sent as signal.interests.entities
      │  Returns destination affinities with per-anchor explainability scores
      │  filterType: urn:entity:destination (stage 1) or urn:entity:place (stage 2)
      │
      ▼
  [03] Negotiation Loop
      │
      │  Negotiator
      │    - Fetches candidates from Qloo with full anchor signal set
      │    - Single structured LLM call: picks best candidate, writes reasoning
      │    - Passes candidate + attribution to Advocate and Skeptic
      │
      │  Advocate + Skeptic (run in parallel)
      │    - Each makes one Qloo call (entity tag profile) + one structured LLM call
      │    - Advocate: fairness check — per-participant attribution gap
      │    - Skeptic: structural check — pattern repetition, scope mismatch, near-duplicate
      │    - Both return approve | pushback
      │
      │  If either pushes back:
      │    - Critique assembled and passed back to Negotiator as context
      │    - Negotiator re-queries Qloo and proposes a different candidate
      │    - Max 2 critique rounds before surfacing to user regardless
      │
      ▼
  [04] Two-stage output
      │  Stage 1: destination (urn:entity:destination)
      │  Stage 2: venue within that destination (urn:entity:place)
      │  User accepts or rejects each; rejections excluded from all subsequent queries
      │
      ▼
  [05] Side-by-side comparison (automatic)
        /api/llm-only fires simultaneously — same anchors, plain LLM, no Qloo data
        Rendered alongside the Qloo result to show the taste graph's contribution
```

All negotiation events stream live over SSE. Each agent's output appears as it completes.

---

## Agent Architecture

Each agent makes a **single structured LLM call** per round. All data is pre-fetched in code and passed in the prompt — no tool-calling loop inside each agent. The intelligence is in the coordination layer.

| Agent | Input | Output |
|---|---|---|
| **Negotiator** | Resolved anchors, Qloo candidate list with attribution | `{ entityId, reasoning }` |
| **Advocate** | Entity tag profile (Qloo), per-participant attribution scores | `{ verdict, reasoning, underservedParticipant? }` |
| **Skeptic** | Entity tag profile (Qloo), full rejection history | `{ verdict, reasoning, failureMode?, negotiatorConstraint? }` |

**Coordination pattern** (`/api/negotiate/route.ts`):
```
for critiquePass in 0..MAX_CRITIQUE_ROUNDS:
    Negotiator proposes
    Advocate + Skeptic critique IN PARALLEL
    if both approve → surface to user
    if either pushes back → build critique context → continue loop
surface to user (max rounds reached)
```

**Fast-path bypass**: If affinity is strong and attribution gap is within expected range for anchor count imbalance, Advocate and Skeptic are skipped entirely — deterministic check, no LLM call.

---

## Taste Anchor Data Model

```typescript
AnchorRecord {
  participantId: string       // DynamoDB hash key
  extractedAt: string         // DynamoDB range key (ISO timestamp)
  anchorText: string          // "Tame Impala", "rooftop bars"
  entityId: string            // Qloo entity ID (empty for vibe signals)
  entityType: string          // urn:entity:artist | vibe | etc.
  vibeContext: string         // freeform description for vibe signals
  confidence: number          // 0–1, starts at 0.5
  status: "active" | "deprecated" | "contradicted"
  firstSeen: string
  lastSeen: string
  lastReinforced: string
}
```

Signal types:
- **named_entity** — artist, band, movie, TV show, global brand, public figure → resolved to Qloo entity ID
- **vibe** — descriptive preferences ("live music", "street food", "rooftop bars") → enter pipeline as freeform context

Type-priority resolution order for named entities:
`artist → movie → tv_show → place → brand → destination → person`

Dead types for destination affinity (excluded as signal):
`author, book, podcast, videogame, album`

---

## Guardrails

| Guardrail | File | Trigger |
|---|---|---|
| **Content safety** | `lib/guardrails/contentSafety.ts` | PII regex + LLM topic scope check before pipeline entry |
| **Anchor quality** | `lib/guardrails/anchorQuality.ts` | Filters anchors too short, too vague, or noise |
| **Signal floor** | `lib/guardrails/signalFloor.ts` | Rejects profiles with too few anchors to negotiate meaningfully |
| **Rate limiting** | `lib/guardrails/rateLimit.ts` | Per-IP rate limiting on all API routes |
| **Affinity floor** | `negotiate/route.ts` | Low-affinity warning emitted over SSE if proposal scores below threshold |
| **Zero attribution** | `negotiate/route.ts` | Warning emitted if a participant's anchors contributed zero signal to the pick |

---

## DynamoDB Tables

| Table | Hash Key | Range Key | Purpose |
|---|---|---|---|
| `palatable-groups` | `groupId` | — | Group metadata, participant list |
| `palatable-messages` | `groupId` | `timestamp#messageId` | Raw messages, sender, processed flag |
| `palatable-anchors` | `participantId` | `extractedAt` | Taste anchors — entity ID, type, vibe context, confidence, lifecycle |

---

## LLM Inference

All inference via **AWS Mantle** (`https://bedrock-mantle.us-east-1.api.aws/v1`, OpenAI-compatible).

Three call patterns in `lib/bedrock/client.ts`:

| Function | Used by | Pattern |
|---|---|---|
| `runStructuredCompletion` | Negotiator, Advocate, Skeptic, Extraction | Single call, returns parsed JSON, retries on truncation |
| `runPlainCompletion` | LLM-only baseline (`/api/llm-only`) | Single call, returns plain text, no Qloo data |
| `runAgentLoop` | Available but not used in current negotiation path | Tool-calling loop, plan→act→observe→replan |

Retry logic: exponential backoff on ECONNRESET, ETIMEDOUT, 429, 5xx, and truncated/non-JSON responses. Max 3 retries.

---

## Streaming

All negotiation events stream via SSE from `/api/negotiate`. Event types:

| Event | Payload |
|---|---|
| `anchors_resolving` | `{ count }` |
| `anchors_resolved` | `{ anchors: [{ participant, query, resolved }] }` |
| `negotiator_thinking` | — |
| `negotiator_proposed` | `{ entity, reasoning, entityId }` |
| `advocate_thinking` | — |
| `advocate_verdict` | `{ verdict, reasoning, underservedParticipant? }` |
| `skeptic_thinking` | — |
| `skeptic_verdict` | `{ verdict, reasoning, failureMode? }` |
| `critique_revising` | `{ reason }` |
| `low_signal_warning` | `{ message }` |
| `anchor_warning` | `{ participants, message }` |
| `round_complete` | `{ entity, reasoning, advocateResult, skepticResult, fastPath }` |
| `error` | `{ message }` |
