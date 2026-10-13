# Palatable

**Your group chat already knows what everyone likes. Nobody's doing anything with it.**

**Palatable is a persistent group chat app that owns taste data.** Every conversation builds a shared taste profile for the group — who likes what, how strongly, and how that changes over time. When the group is ready to plan anything — a trip, a restaurant, a night out, a concert — Palatable already knows everyone's taste and negotiates a recommendation the group can actually agree on.

**The vision: one app for every group decision Qloo's taste graph supports.** Travel today. Restaurant tonight. Concert next week. All powered by the same taste memory that accumulates with every message, every accept, every veto. Most Qloo integrations query transiently — ask once, get an answer, forget the user. **Palatable accumulates signal. That's the moat.**

**And every accept and reject feeds back to improve Qloo's taste graph itself.** The more groups use Palatable, the better Qloo gets at predicting taste across culture, context, and group dynamics. That feedback loop — group decisions improving the underlying taste model — is what makes this a platform, not a feature.

The hackathon demo is the proof-of-concept for that world.

---

**We've been in this group chat for three days and we still can't agree on a restaurant. Every suggestion starts an argument.**

Palatable solves group taste negotiation. Drop in a seeded chat between friends with real opinions, or start a fresh group and let the system learn your taste signals — then watch four AI agents negotiate, score trade-offs, and surface the destination everyone can actually agree on.

Built for the **Qloo Hackathon · 2026**.

---

## Demo

Live app: **https://main.dxuglnvypubxp.amplifyapp.com**

Two experiences at the start screen:

**Seeded Demo** — A pre-loaded chat between four friends planning a group trip. Taste anchors are already extracted. Hit "Get Suggestions" and watch the four-agent pipeline run live over SSE.

**Try It Yourself** — Start a fresh group, paste any group chat text (or type directly), and the system extracts taste anchors from the conversation before negotiating.

Both use the live Qloo Insights API. No mock data on the suggestion path.

---

## How It Works

Someone pastes a group chat. The system reads it, extracts what each person actually likes — artists they mention, places they've been, vibes they describe — and maps those signals to Qloo entities. Then four agents negotiate on everyone's behalf.

```
Group Chat Text
      │
      ▼
  [01] Extraction Agent
      │  Reads messages, extracts taste anchors per participant
      │  Maps to Qloo entity IDs (artists, venues, cuisines, places)
      │  Assigns confidence 0–1; skips noise ("haha ok")
      │
  [01a] Content Safety Guard
      │  Screens extracted anchors before they enter the pipeline
      │
      ▼
  [02] Qloo Insights API
      │  Pulls destination affinities for each participant's taste profile
      │  Returns scored candidates with cross-taste reasoning
      │
      ▼
  [03] Trade-off Negotiation Agent
      │  Scores each candidate against all participants
      │  Applies veto rules (hard dislikes eliminate a candidate)
      │  Produces ranked shortlist with per-person reasoning
      │
      ▼
  [04] Synthesis Agent
        Writes the final recommendation
        Explains why each person will like it
        Surfaces the honest trade-offs
```

Results stream live over SSE — each agent's output appears as it completes, not after the whole pipeline finishes.

---

## Architecture

```
Browser (Next.js SSR)
    │
    ├── /api/extract      — Extraction Agent (OpenAI-compatible via AWS Mantle)
    ├── /api/suggestions  — Qloo Insights API → Trade-off Agent → Synthesis Agent
    │       │
    │       └── SSE stream (one event per agent completion)
    │
    ├── DynamoDB
    │       ├── palatable-groups     — Group metadata, participant list
    │       ├── palatable-messages   — Raw chat messages, processed flag
    │       └── palatable-anchors    — Taste anchors per participant (confidence, lifecycle)
    │
    └── AWS Amplify (SSR deployment)
```

All LLM inference goes through AWS Mantle (`deepseek.v3.2` via OpenAI-compatible endpoint). Qloo Insights API provides the taste graph — destination affinities, cross-entity signals, and cultural resonance that a generic LLM can't match.

---

## Why Qloo

Generic LLMs suggest Paris, Tokyo, New York — the same ten cities for every group. Palatable knows this group would love Lisbon because two participants are on a fado kick, one keeps mentioning natural wine bars, and the fourth has been talking about Pessoa for months.

That specificity comes from Qloo's taste graph. When we call `/v2/insights/ql:type:destination` with each participant's extracted entity affinities, we get scored candidates that account for cultural taste signals — not just stated preferences. A group with a Khruangbin fan and an Hiatus Kaiyote listener gets different destination scores than a group whose taste anchors are entirely mainstream pop.

The negotiation layer is what surfaces the compromise: one agent per participant's interests, arbitrated by a trade-off scorer that applies group veto logic before the synthesis agent writes the final recommendation.

---

## Taste Anchor Extraction

Extraction is the core technical bet. A taste anchor is a stable signal about what someone likes — not a one-off comment, but a repeated or emphatic preference that predicts future choices.

Each anchor has:
- **Entity ID** — mapped to a Qloo entity (artist, venue, cuisine, place) when possible
- **Vibe context** — freeform signals that don't map to a Qloo entity ("really into brutalist architecture right now")
- **Confidence** — starts at 0.5, reinforced when the participant repeats the signal, reduced on contradiction
- **Lifecycle status** — `active`, `deprecated`, or `contradicted`

The extraction prompt classifies each message against five signal types:
- **No signal** — skip
- **New anchor** — add at confidence 0.5
- **Reinforced anchor** — bump confidence
- **Changed anchor** — deprecate old, add new
- **Contradicted anchor** — reduce confidence or mark contradicted

Only `active` anchors above confidence 0.6 enter the negotiation pipeline.

---

## Agent Pipeline

Each agent runs a real agentic tool-use loop. The LLM receives tool definitions, decides which to call, receives results, and continues until it produces a final response. No hardcoded function chains.

| Agent | Input | Output |
|---|---|---|
| **Extraction** | Raw chat text + participant list | Taste anchors per participant with entity IDs and confidence scores |
| **Qloo Query** | Participant anchor sets | Destination affinities from Qloo Insights API |
| **Trade-off Negotiation** | Qloo scores + anchor weights | Ranked shortlist with per-person reasoning and veto flags |
| **Synthesis** | Shortlist + reasoning | Final recommendation with honest trade-off narrative |

The content safety guard runs after extraction, before Qloo queries — it screens anchor content before anything enters the negotiation pipeline.

---

## Data Layer

Three DynamoDB tables:

| Table | Key | Purpose |
|---|---|---|
| `palatable-groups` | `groupId` | Group metadata, participant list, created timestamp |
| `palatable-messages` | `groupId` + `timestamp#messageId` | Raw messages, sender, processed flag |
| `palatable-anchors` | `participantId` + `extractedAt` | Taste anchors — entity ID, entity type, vibe context, confidence, lifecycle status |

Anchors accumulate over time. Each extraction run adds new anchors and updates confidence on existing ones. The table is the group's taste memory — it persists across sessions.

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
| **Content safety** | AWS Bedrock Guardrails |

---

## Project Structure

```
palatable/
├── app/
│   ├── api/
│   │   ├── extract/route.ts        # Extraction agent — taste anchor parsing
│   │   └── suggestions/route.ts    # Qloo → trade-off → synthesis pipeline (SSE)
│   ├── globals.css                 # Design system — Palatable light theme tokens
│   └── page.tsx                    # Landing page — seeded demo + try-it-yourself entry points
├── components/
│   ├── ChatPanel.tsx               # Group chat display, message input
│   ├── LandingPanel.tsx            # Entry point — demo selection, group setup
│   ├── ResultsPanel.tsx            # SSE stream consumer — live agent output display
│   └── TastePanel.tsx              # Extracted anchor visualization per participant
├── lib/
│   ├── db.ts                       # DynamoDB client — read/write anchors, groups, messages
│   ├── extraction.ts               # Extraction agent — LLM prompt + anchor classification
│   ├── qloo.ts                     # Qloo Insights API client
│   └── agents/
│       ├── tradeoff.ts             # Trade-off negotiation agent
│       └── synthesis.ts            # Synthesis agent — final recommendation writer
├── evals/                          # Behavioral eval suites (excluded from prod build)
├── tests/                          # Unit tests (excluded from prod build)
├── amplify.yml                     # Amplify build config — registry override, SSR artifacts
├── .npmrc                          # Public npm registry (overrides Intuit internal)
└── .env.example                    # Required environment variables
```

---

## Setup

### Prerequisites

- Node.js 20+
- AWS account with DynamoDB access
- AWS credentials configured locally
- Qloo API key — [request access](https://qloo.com)
- AWS Mantle API key — for LLM inference

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in every value:

| Variable | Description |
|---|---|
| `QLOO_API_KEY` | Qloo Insights API key |
| `QLOO_API_BASE_URL` | Qloo base URL (e.g. `https://api.qloo.com`) |
| `MANTLE_API_KEY` | AWS Mantle gateway API key |
| `MANTLE_BASE_URL` | `https://bedrock-mantle.us-east-1.api.aws/v1` |
| `MANTLE_MODEL` | `deepseek.v3.2` |
| `DB_REGION` | AWS region for DynamoDB (e.g. `us-east-1`) |
| `DB_ACCESS_KEY_ID` | AWS access key with DynamoDB read/write |
| `DB_SECRET_ACCESS_KEY` | AWS secret key |

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run unit tests

```bash
npm test
```

### 5. Run evals

```bash
npm run eval
```

Requires live Qloo API and DynamoDB. Tests extraction accuracy, negotiation correctness, and end-to-end pipeline behavior against seeded chat fixtures.

---

## Product Vision

Palatable is a proof-of-concept for a bigger idea: a native extension inside WhatsApp, Telegram, or Slack group chats that listens passively, builds each member's taste profile over time, and activates when planning intent is detected.

No forms. No setup. No "what are your preferences?" friction. The chat already contains the signal — who talks about going to jazz bars, who keeps mentioning they're off meat, who always suggests the most expensive option and whose suggestions always get shot down.

Every group decision Qloo's taste graph supports — destinations, restaurants, concerts, activities — becomes negotiable: not by asking everyone to fill out a form, but by reading what they've already said to each other.

The demo is seeded travel planning. The vision is taste-aware group intelligence at the layer where groups already live.

---

## What's Next

### Stage 2 — Persistent Taste Profiles

- Real-time chat ingestion via webhook (WhatsApp Business API, Slack Events API)
- Taste anchor evolution across sessions — confidence scoring, reinforcement, contradiction detection
- Per-group taste graph that grows with every conversation
- Anchor-to-Qloo entity mapping for deeper affinities (not just top-level entity types)

### Stage 3 — Any Decision Type

- Restaurant negotiation (tonight → venue affinities)
- Concert / event planning (this weekend → cultural event affinities)
- Group activity suggestions (outdoor, nightlife, cultural)
- All from the same taste graph, same negotiation pipeline

### Stage 4 — Feedback Loop

- Every group accept/reject feeds back signal to improve per-group taste weights
- "We went to Lisbon — it was perfect" reinforces the anchors that drove the recommendation
- "We ended up in Barcelona — Lisbon was too expensive" flags price sensitivity as a weight

---

## License

MIT
