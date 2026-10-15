# Palatable

Alex wants somewhere with a good music scene and interesting food. Zara is done with tourist traps and needs natural wine somewhere. Marcus will go anywhere as long as there's hiking. Nina just sent a voice note saying she doesn't care but then vetoed the last four suggestions.

This is every group trip. Four people, four completely different ideas of a good time, and a group chat that's been going for three days without landing anywhere.

**Palatable solves this.** It reads what everyone is actually into — the artists they mention, the places they've been, the food they keep bringing up — maps those signals to Qloo's taste graph, and runs three AI agents (a Negotiator, an Advocate, and a Skeptic) to find the place the whole group can genuinely agree on. Not a compromise. An actual answer.

You can watch it work on a real group, or describe your own group and get a live recommendation.

Built for the **Qloo Hackathon · 2026**.

---

## The Vision

This hackathon demo solves travel planning for one group. The bigger product is something more fundamental.

**A group chat app where taste is a first-class citizen.** Not a plugin on top of WhatsApp or iMessage — a standalone chat app where every conversation quietly builds a taste profile for the group. Every artist someone mentions, every restaurant they loved, every place they vetoed — it all accumulates in the background without anyone filling out a form. When the group is ready to plan something, Palatable already knows everyone and negotiates on their behalf. The chat is the product.

**How it works at scale — incremental extraction, not batch processing.** The naive approach — dumping the entire chat history into an LLM when someone asks for a recommendation — doesn't scale. The real architecture runs extraction as a background job: messages land in a time-series store (PostgreSQL or Cassandra for high-write, time-ordered chat at scale), a scheduled worker periodically processes unprocessed messages in small batches, and the compressed taste graph is upserted into DynamoDB as structured anchor records. By the time the group asks "where should we go?", the taste graph is already built. The LLM never sees the full chat history at query time — only the anchors extracted from it.

**Any decision Qloo's taste graph supports.** Travel today. Restaurant tonight. Concert next week. The same extraction pipeline, the same agents, the same Qloo affinities — just different entity types. The demo is one use case. The architecture is general.

**A feedback loop that improves Qloo itself.** Every group accept and reject is a taste signal. When a group picks Lisbon over Barcelona, that tells Qloo something about how those specific taste anchors translate into real decisions. Routed back to the model, it makes Qloo smarter — not just for this group, but for every group with overlapping signals.

Most Qloo integrations query transiently — ask once, get an answer, forget the user. **Palatable accumulates signal. That's the moat.**

---

## Demo

Live app: **https://main.dxuglnvypubxp.amplifyapp.com**

Two experiences at the start screen:

**See it in action** — Three pre-built groups, each with a distinct taste profile (indie film + Japanese food, live music + street food + outdoor adventures, fine dining + contemporary art + design hotels). Pick a group, scroll through their real chat conversations, and ask Palatable where they should go. The Negotiator, Advocate, and Skeptic agents debate live over SSE — each working from Qloo affinity scores built from what the group actually talked about.

**Try it yourself** — Add each person in your group by name and describe them in a few sentences: what music they're into, food they love, places they've been, vibes they chase. Palatable extracts taste anchors from those descriptions — the same way it would from weeks of group chat, just faster — then runs the full Qloo → negotiation → synthesis pipeline to find where your group should go.

Both use the live Qloo Insights API. No mock data on the suggestion path.

---

## How It Works

Someone describes their group (or picks a seeded demo). The system extracts what each person is into, maps those signals to Qloo entities, and runs three agents that negotiate on everyone's behalf.

```
Participant descriptions (freeform text about tastes, artists, places, vibes)
      │
      ▼
  [01] Extraction Agent
      │  Reads descriptions, extracts taste anchors per participant
      │  Maps to Qloo entity IDs (artists, venues, cuisines, places)
      │  Assigns confidence 0–1; skips noise
      │
  [01a] Content Safety Guard
      │  Screens extracted anchors before they enter the pipeline
      │
      ▼
  [02] Qloo Insights API
      │  Resolves anchors to entity IDs via search
      │  Pulls destination affinities using the resolved signal set
      │  Returns scored candidates with per-participant attribution
      │
      ▼
  [03] Negotiation Loop (Negotiator + Advocate + Skeptic)
      │  Negotiator picks the best Qloo candidate with reasoning
      │  Advocate + Skeptic critique in parallel (fairness + structural)
      │  If either pushes back, Negotiator revises with critique context
      │  Loop repeats up to 2 rounds, then surfaces to user
      │
      ▼
  [04] Final Recommendation
        Synthesis — where to go, why each person will like it,
        honest trade-offs surfaced
```

Results stream live over SSE — each agent's output appears as it completes.

---

## Architecture

> Full architecture details — agent coordination pattern, data model, SSE events, guardrails, LLM inference patterns: [docs/architecture.md](docs/architecture.md)

```
Browser (Next.js SSR)
    │
    ├── /api/extract      — Extraction Agent (AWS Mantle → deepseek.v3.2)
    ├── /api/negotiate    — Qloo → Negotiator + Advocate + Skeptic loop (SSE)
    ├── /api/llm-only     — Side-by-side: same negotiation without Qloo (no taste graph)
    │
    ├── DynamoDB
    │       ├── palatable-groups     — Group metadata, participant list
    │       ├── palatable-messages   — Raw chat messages, processed flag
    │       └── palatable-anchors    — Taste anchors per participant (confidence, lifecycle)
    │
    └── AWS Amplify (SSR deployment)
```

All LLM inference goes through AWS Mantle (`deepseek.v3.2`, OpenAI-compatible endpoint). Qloo Insights API provides the taste graph — destination affinities, cross-entity signals, and cultural resonance a generic LLM cannot replicate.

---

## Why Qloo

Generic LLMs suggest Paris, Tokyo, New York — the same ten cities for every group. Palatable knows this group would love Lisbon because two participants are on a fado kick, one keeps mentioning natural wine bars, and the fourth has been talking about Pessoa for months.

That specificity comes from Qloo's taste graph. Every negotiation runs **two paths simultaneously**: the Qloo-powered recommendation on the right, and an **"AI ONLY" baseline on the left** — same group, same taste anchors, plain LLM with no Qloo data. Both fire automatically when the panel loads. You watch them arrive side by side: Qloo returns a culturally specific, affinity-scored pick with per-person attribution; the LLM-only path returns a generic guess with no scoring. Qloo is the product, not decoration — and the comparison proves it in real time.

---

## Agent Pipeline

Four agents in a structured negotiation loop. Each agent makes a single, focused LLM call with pre-assembled Qloo data — the complexity is in the coordination, not inside each agent.

| Agent | Role |
|---|---|
| **Negotiator** | Resolves taste anchors via Qloo search, fetches destination affinities, picks the best candidate and writes reasoning |
| **Advocate** | Pre-fetches the entity's tag profile from Qloo, computes per-participant attribution, assesses fairness in one structured call |
| **Skeptic** | Pre-fetches the entity's tag profile, checks rejection history and scope, vetoes or approves in one structured call |
| **Synthesis** | Writes the final recommendation with per-person reasoning and honest trade-offs |

The coordination pattern: Negotiator proposes → Advocate + Skeptic critique in parallel → if either pushes back, Negotiator gets the critique as context and revises → repeat up to 2 rounds before surfacing to the user.

The content safety guard runs after extraction, before the negotiation loop — anchor content is screened before it enters any agent.

---

## Taste Anchor Extraction

A taste anchor is a signal about what someone likes — an artist they mention, a food vibe they describe, a place they keep bringing up.

Each anchor has:
- **Entity ID** — mapped to a Qloo entity (artist, movie, TV show, brand, place) when possible, using priority-ordered type resolution to pick the best match
- **Vibe context** — freeform signals that don't map to a Qloo entity ("rooftop bars", "street food", "live music")
- **Confidence** — starts at 0.5; the data model supports reinforcement and contradiction updates (Stage 2 feature)
- **Lifecycle status** — `active`, `deprecated`, or `contradicted` — currently all extractions start as `active`

The extraction prompt classifies each mention as either a `named_entity` (artist, band, film, TV show, global brand, public figure) or a `vibe` (descriptive preference). Named entities are resolved to Qloo entity IDs via search; vibe signals enter the pipeline as freeform context. Only named-entity anchors that resolve to a Qloo ID with cross-domain taste signal contribute to destination affinities.

---

## Guardrails

Four defensive layers in `lib/guardrails/` that run before data enters the pipeline:

| Guardrail | File | What it does |
|---|---|---|
| **Content safety** | `contentSafety.ts` | Screens extracted anchor text for harmful content before Qloo query |
| **Anchor quality** | `anchorQuality.ts` | Filters low-signal anchors — too short, too vague, or noise |
| **Signal floor** | `signalFloor.ts` | Rejects participant profiles with too few anchors to negotiate meaningfully |
| **Rate limiting** | `rateLimit.ts` | Per-IP rate limiting on API routes — prevents runaway LLM spend |

---

## Data Layer

Three DynamoDB tables:

| Table | Key | Purpose |
|---|---|---|
| `palatable-groups` | `groupId` | Group metadata, participant list, created timestamp |
| `palatable-messages` | `groupId` + `timestamp#messageId` | Raw messages, sender, processed flag |
| `palatable-anchors` | `participantId` + `extractedAt` | Taste anchors — entity ID, type, vibe context, confidence, lifecycle |

Anchors accumulate over time. Each extraction run adds new anchors and updates confidence on existing ones — the table is the group's taste memory.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend + SSR** | Next.js 14, TypeScript, Tailwind CSS |
| **Inference** | AWS Mantle gateway (`deepseek.v3.2`, OpenAI-compatible) |
| **Taste graph** | Qloo Insights API |
| **Database** | Amazon DynamoDB (3 tables) |
| **Streaming** | Server-Sent Events (SSE) |
| **Deployment** | AWS Amplify (SSR) |

---

## Project Structure

```
palatable/
├── app/
│   ├── api/
│   │   ├── extract/route.ts         # Extraction agent — taste anchor parsing from chat
│   │   ├── negotiate/route.ts       # Negotiator + Advocate + Skeptic loop (SSE)
│   │   └── llm-only/route.ts        # Side-by-side: negotiation without Qloo
│   ├── globals.css                  # Design system — Palatable light theme tokens
│   ├── layout.tsx
│   └── page.tsx                     # Landing — seeded demo + try-it-yourself
├── components/
│   ├── AgentVerdict.tsx             # Individual agent output card
│   ├── ChatPanel.tsx                # Group chat display and message input
│   ├── DonePanel.tsx                # Final recommendation display
│   ├── LandingPanel.tsx             # Entry point — demo selection, group setup
│   ├── LLMToggle.tsx                # Qloo vs LLM-only side-by-side toggle
│   ├── NegotiatePanel.tsx           # Negotiation phase UI
│   ├── NegotiationStream.tsx        # SSE stream consumer — live agent output
│   ├── ParticipantEntry.tsx         # Per-participant taste anchor display
│   ├── ProposalCard.tsx             # Destination proposal card
│   ├── SampleScenarioButton.tsx     # Loads a seeded chat scenario
│   └── SetupPanel.tsx               # Group setup — participants, chat input
├── data/
│   ├── seed-chat.ts                 # Seeded demo chat — mixed tastes group
│   ├── seed-chat-adventure.ts       # Seeded demo — adventure/outdoor group
│   └── seed-chat-luxury.ts          # Seeded demo — luxury travel group
├── lib/
│   ├── agents/
│   │   ├── advocate.ts              # Advocate agent — argues for best-fit candidates
│   │   ├── loop.ts                  # Shared agentic tool-use loop engine
│   │   ├── negotiator.ts            # Negotiator agent — proposes based on Qloo scores
│   │   └── skeptic.ts               # Skeptic agent — vetoes, challenges, stress-tests
│   ├── bedrock/
│   │   └── client.ts                # AWS Mantle client — LLM inference, retry logic
│   ├── db/
│   │   ├── anchors.ts               # DynamoDB read/write for taste anchors
│   │   ├── client.ts                # DynamoDB client setup
│   │   └── schema.ts                # Table definitions
│   ├── extract/
│   │   └── anchors.ts               # Anchor extraction logic — LLM prompt + classification
│   ├── guardrails/
│   │   ├── anchorQuality.ts         # Filters low-signal anchors
│   │   ├── contentSafety.ts         # Content safety screening
│   │   ├── index.ts                 # Barrel export
│   │   ├── rateLimit.ts             # Per-IP rate limiting
│   │   └── signalFloor.ts           # Minimum signal threshold guard
│   ├── prompts/
│   │   ├── advocate.txt             # Advocate agent system prompt
│   │   ├── anchor-extractor.txt     # Extraction agent system prompt
│   │   ├── content-safety.txt       # Content safety classifier prompt
│   │   ├── negotiator.txt           # Negotiator agent system prompt
│   │   └── skeptic.txt              # Skeptic agent system prompt
│   ├── qloo/
│   │   └── client.ts                # Qloo Insights API client
│   ├── schema/
│   │   └── state.ts                 # Shared type definitions — anchors, proposals, state
│   └── stream.ts                    # SSE stream helpers
├── scripts/
│   ├── seed-db.ts                   # Seeds DynamoDB with demo group data
│   ├── smoke-test.ts                # End-to-end smoke test — DB, extraction, negotiation
│   └── smoke-test-agent.ts          # Agent-level smoke test
├── evals/
│   ├── runner.ts                    # Eval runner — executes all suites, prints pass/fail
│   ├── fixtures/
│   │   ├── eval-bookclub.ts         # Book club group fixture
│   │   └── eval-weekendwarriors.ts  # Weekend warriors group fixture
│   └── suites/
│       ├── consensus.ts             # Negotiation consensus correctness
│       └── content-safety.ts        # Content safety guardrail behavioral tests
├── tests/
│   ├── agents/                      # Unit tests — advocate, loop, negotiator, skeptic
│   ├── api/                         # API route tests — extract
│   ├── guardrails/                  # Guardrail tests — anchorQuality, contentSafety, rateLimit, signalFloor
│   └── lib/                         # Library tests — buildTasteProfile, stream
├── amplify.yml                      # Amplify build config — registry override, SSR artifacts
├── .npmrc                           # Public npm registry override
├── .env.example                     # Required environment variables
└── vitest.config.ts                 # Test runner config
```

---

## Setup

### Prerequisites

- Node.js 20+
- AWS account with DynamoDB access
- Qloo API key
- AWS Mantle API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `QLOO_API_KEY` | Qloo Insights API key |
| `QLOO_API_BASE_URL` | Qloo base URL |
| `MANTLE_API_KEY` | AWS Mantle gateway API key |
| `MANTLE_BASE_URL` | `https://bedrock-mantle.us-east-1.api.aws/v1` |
| `MANTLE_MODEL` | `deepseek.v3.2` |
| `DB_REGION` | AWS region for DynamoDB |
| `DB_ACCESS_KEY_ID` | AWS access key with DynamoDB read/write |
| `DB_SECRET_ACCESS_KEY` | AWS secret key |

### 3. Seed demo data

```bash
npx tsx scripts/seed-db.ts
```

### 4. Start the dev server

```bash
npm run dev
```

### 5. Run unit tests

```bash
npm test
```

### 6. Run smoke test

```bash
npx tsx scripts/smoke-test.ts
```

### 7. Run evals

```bash
npm run eval
```

Requires live Qloo API and DynamoDB. Runs consensus and content safety behavioral suites against fixture data.

---

## Roadmap

### Stage 1 — Today (Hackathon Demo)
The current build. Three seeded groups with real taste profiles, a try-it-yourself flow where you describe your group in natural language, and a live four-agent negotiation pipeline (Extraction → Qloo → Negotiator + Advocate + Skeptic → Synthesis) streaming over SSE. Taste anchors persist in DynamoDB across sessions.

### Stage 2 — Persistent Taste Memory
- Taste anchors accumulate across conversations, not just one session
- Confidence scoring evolves over time — reinforced signals strengthen, contradicted signals decay
- Anchor lifecycle management: `active`, `deprecated`, `contradicted` states update automatically as the group keeps talking
- Per-group taste graph that gets sharper with every interaction

### Stage 3 — Any Decision Type
- Restaurant negotiation (tonight → Qloo venue affinities)
- Concert and event planning (this weekend → cultural event affinities)
- Group activity suggestions (outdoor, nightlife, cultural)
- Same extraction pipeline, same agents, same Qloo integration — just different entity types and negotiation weights

### Stage 4 — Feedback Loop to Qloo
- The accept/reject flow is already built — every decision is captured in the negotiation state
- An accept reinforces the anchors that drove the recommendation; a reject weakens them
- Per-group anchor weights improve over time based on real decisions, not just stated preferences
- Aggregate signal across groups improves Qloo's taste graph for everyone

### Stage 5 — The Full Product
- A persistent group chat app where taste data accumulates naturally over months of conversation
- Planning intent detection triggers the negotiation pipeline automatically — no explicit prompt needed
- Any group decision Qloo supports, handled by the same system that already knows the group
- The moat: a taste graph built from real group behavior that gets harder to replicate every day

---

## License

MIT
