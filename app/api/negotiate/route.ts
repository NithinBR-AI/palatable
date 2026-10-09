import { makeSSEStream, type StreamEvent } from "@/lib/stream";
import { searchEntity, getInsights } from "@/lib/qloo/client";
import { runStructuredCompletion } from "@/lib/bedrock/client";
import { runAdvocate } from "@/lib/agents/advocate";
import { runSkeptic } from "@/lib/agents/skeptic";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Participant, NegotiationStage, RejectionRecord, ConsensusState } from "@/lib/schema/state";
import type { InsightsResult } from "@/lib/qloo/client";
import type { HistoryMessage } from "@/lib/bedrock/client";
import { checkRateLimit } from "@/lib/guardrails";

const NEGOTIATOR_PROMPT = readFileSync(join(process.cwd(), "lib/prompts/negotiator.txt"), "utf-8");
const MAX_CRITIQUE_ROUNDS = 2;

interface RequestBody {
  participants: Participant[];
  stage: NegotiationStage;
  state: ConsensusState;
}

function buildHistory(state: ConsensusState): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const round of state.rounds) {
    history.push({
      role: "assistant",
      content: `Proposed ${round.proposal.entity.name} (affinity ${round.proposal.entity.affinity?.toFixed(3)}): ${round.proposal.reasoning}`,
    });
    if (round.advocateResult) {
      history.push({ role: "user", content: `Advocate (${round.advocateResult.verdict}): ${round.advocateResult.reasoning}` });
    }
    if (round.skepticResult) {
      history.push({ role: "user", content: `Skeptic (${round.skepticResult.verdict}): ${round.skepticResult.reasoning}` });
    }
    history.push({ role: "user", content: round.accepted ? "Accepted." : `Rejected ${round.proposal.entity.name}.` });
  }
  return history;
}

// Entity types that carry meaningful cross-domain signal for destination/venue affinity.
// Books, podcasts, videogames resolve fine in Qloo search but contribute near-zero
// signal to destination affinity — Qloo's taste graph simply doesn't connect them.
const USEFUL_SIGNAL_TYPES = new Set([
  "urn:entity:artist", "urn:entity:movie", "urn:entity:tv_show",
  "urn:entity:place", "urn:entity:brand", "urn:entity:person",
  "urn:entity:destination", "urn:entity:locality",
]);

// Types confirmed to 400 when passed as signal.interests.entities for urn:entity:destination.
const DESTINATION_DEAD_TYPES = new Set([
  "urn:entity:author", "urn:entity:book", "urn:entity:podcast",
  "urn:entity:videogame", "urn:entity:album",
]);

async function resolveAnchors(
  participants: Participant[],
  emit: (e: StreamEvent) => void,
): Promise<{ participant: string; query: string; entityId: string; name: string; type: string; weak?: boolean }[]> {
  emit({ type: "anchors_resolving", payload: { count: participants.reduce((n, p) => n + p.tasteAnchors.length, 0) } });

  const allAnchors = participants.flatMap((p) =>
    p.tasteAnchors.map((a) => ({ participant: p.name, query: a.query })),
  );

  type ResolvedAnchor = { participant: string; query: string; entityId: string; name: string; type: string; weak?: boolean };
  const resolved: ResolvedAnchor[] = [];
  const localityPending: { anchor: { participant: string; query: string }; localityQuery: string }[] = [];

  // First pass: resolve all non-locality anchors. Collect localities for second pass.
  for (const anchor of allAnchors) {
    const results = await searchEntity(anchor.query, undefined, 5);
    if (!results.length) continue;

    let best = results.find((r) => USEFUL_SIGNAL_TYPES.has(r.type));

    if (!best && results[0]?.type === "urn:entity:locality") {
      // Defer locality resolution to second pass where we have other signals available.
      localityPending.push({ anchor, localityQuery: anchor.query });
      continue;
    }

    if (!best && DESTINATION_DEAD_TYPES.has(results[0]?.type ?? "")) {
      const destResults = await searchEntity(anchor.query, "urn:entity:destination" as any, 1);
      if (destResults.length) best = destResults[0];
    }

    if (!best) best = results[0];
    const weak = DESTINATION_DEAD_TYPES.has(best.type) || !USEFUL_SIGNAL_TYPES.has(best.type);
    resolved.push({ participant: anchor.participant, query: anchor.query, entityId: best.entityId, name: best.name, type: best.type, weak });
  }

  // Second pass: resolve locality anchors (e.g. "Greece") using already-resolved strong
  // anchors as signals → finds most taste-relevant destination within that country.
  for (const { anchor, localityQuery } of localityPending) {
    const strongSignals = resolved.filter((r) => !r.weak).map((r) => r.entityId);
    // Need at least one signal entity — fall back to any resolved if no strong ones.
    const signalIds = strongSignals.length > 0 ? strongSignals : resolved.map((r) => r.entityId);
    let best: ResolvedAnchor | null = null;

    if (signalIds.length > 0) {
      const destResults = await getInsights({
        filterType: "urn:entity:destination",
        signalEntityIds: signalIds,
        filterLocationQuery: localityQuery,
        popularityMin: 0.3,
        explainability: false,
        take: 3,
      }).catch(() => [] as InsightsResult[]);
      const top = destResults.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
      if (top) best = { participant: anchor.participant, query: anchor.query, entityId: top.entityId, name: top.name, type: top.type, weak: false };
    }

    if (!best) {
      // Absolute fallback: use the locality entity itself, mark weak.
      const results = await searchEntity(localityQuery, undefined, 1);
      if (results.length) best = { participant: anchor.participant, query: anchor.query, entityId: results[0].entityId, name: results[0].name, type: results[0].type, weak: true };
    }

    if (best) resolved.push(best);
  }

  emit({
    type: "anchors_resolved",
    payload: {
      anchors: resolved.map((a) => ({
        participant: a.participant,
        query: a.query,
        resolved: a.weak
          ? `${a.name} ⚠ limited signal (${a.type.replace("urn:entity:", "")})`
          : a.name,
      })),
    },
  });
  return resolved;
}

async function fetchCandidates(
  stage: NegotiationStage,
  signalEntityIds: string[],
  excludeEntityIds: string[],
  locationQuery: string | undefined,
  excludeLocationQuery: string | undefined,
  diversify = false,
): Promise<InsightsResult[]> {
  const isVenue = stage === "venue";
  const diversifyBy = (diversify && !isVenue) ? "properties.geocode.city" as const : undefined;
  const diversifyTake = diversifyBy ? 2 : undefined;

  if (isVenue) {
    // Venue stage: urn:entity:place with attraction tag bias.
    // Live test: attraction tag reranks results toward Hollywood Sign (0.767),
    // Warner Bros. Studio Tour (0.723), Venice Beach (0.709) — real activities.
    // Without it: Kavkaz, In-N-Out, hotels dominate at 0.60-0.63.
    const ATTRACTION_TAGS = "urn:tag:category:place:attraction,urn:tag:category:place:entertainment";
    const candidates = await getInsights({
      filterType: "urn:entity:place",
      signalEntityIds, excludeEntityIds,
      filterLocationQuery: locationQuery,
      filterTagIds: ATTRACTION_TAGS,
      backfillCrossDomain: 5, backfillContentBased: 3,
      explainability: true, take: 20,
    });
    return candidates;
  }

  // Destination stage
  const candidates = await getInsights({
    filterType: "urn:entity:destination",
    signalEntityIds, excludeEntityIds,
    excludeLocationQuery, popularityMin: 0.3,
    diversifyBy, diversifyTake,
    backfillCrossDomain: 5, backfillContentBased: 3,
    explainability: true, take: 20,
  });
  return candidates;
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
  const body: RequestBody = JSON.parse(rawText);
  const { participants, stage, state } = body;

  return makeSSEStream(async (emit) => {
    const history = buildHistory(state);
    const rejections: RejectionRecord[] = state.rejections ?? [];
    const locationQuery = stage === "venue" ? state.chosenDestination?.name : undefined;

    const resolvedAnchors = await resolveAnchors(participants, emit);
    // Only send non-weak anchors as signals — weak types (author, book, etc.) 400 the API.
    // If ALL are weak, fall back to sending all of them so we get some result rather than crashing.
    const strongAnchors = resolvedAnchors.filter((a) => !a.weak);
    const signalEntityIds = (strongAnchors.length > 0 ? strongAnchors : resolvedAnchors).map((a) => a.entityId);
    const excludeEntityIds = rejections.map((r) => r.entityId);

    // filter.exclude.location.query excludes specific locality areas from results.
    // We pass each rejected destination name individually so Qloo fuzzy-resolves them
    // and excludes their city/region. This won't exclude an entire country, but it removes
    // the specific cities that have already been rejected.
    const excludeLocationQuery = stage === "destination" && rejections.length > 0
      ? rejections.map((r) => r.entityName).join(",")
      : undefined;

    // Detect if rejections cluster around a single country (e.g., all Brazil).
    // Used to trigger a diversified fetch that avoids the dominant country entirely.
    function extractCountryTokens(name: string): string[] {
      // Common country/region names appearing in destination names or tags
      const KNOWN_COUNTRIES = ["brazil", "brasil", "argentina", "mexico", "france", "germany",
        "italy", "spain", "japan", "china", "india", "australia", "canada", "thailand",
        "portugal", "colombia", "chile", "peru", "indonesia", "turkey", "vietnam", "netherlands"];
      const lower = name.toLowerCase();
      return KNOWN_COUNTRIES.filter((c) => lower.includes(c));
    }
    const rejectedCountries = new Set(
      rejections.flatMap((r) => {
        const fromName = extractCountryTokens(r.entityName);
        const fromTags = (r as any).tags?.flatMap((t: any) => extractCountryTokens(t.name ?? "")) ?? [];
        return [...fromName, ...fromTags];
      })
    );

    let critiqueContext = "";

    for (let critiquePass = 0; critiquePass <= MAX_CRITIQUE_ROUNDS; critiquePass++) {
      // Negotiator
      emit({ type: "negotiator_thinking" });

      // Enable diversify when we have rejections — forces Qloo to spread results across cities.
      const shouldDiversify = rejections.length > 0 && stage === "destination";
      let candidates = await fetchCandidates(stage, signalEntityIds, excludeEntityIds, locationQuery, excludeLocationQuery, shouldDiversify);

      // Post-filter: remove candidates whose name/tags contain tokens from rejected destinations.
      if (rejections.length > 0 && stage === "destination") {
        const rejectedTokens = rejections.flatMap((r) =>
          r.entityName.toLowerCase().split(/[\s,]+/).filter((t) => t.length > 3)
        );
        // Also add detected country names as exclusion tokens
        rejectedCountries.forEach((c) => rejectedTokens.push(c));

        const isRejected = (c: InsightsResult) => {
          const cNameLower = c.name.toLowerCase();
          const cTagNames = c.tags.map((t) => t.name.toLowerCase()).join(" ");
          return rejectedTokens.some((token) => cNameLower.includes(token) || cTagNames.includes(token));
        };

        const filtered = candidates.filter((c) => !isRejected(c));
        if (filtered.length >= 2) {
          candidates = filtered;
        } else {
          // All candidates are from rejected regions.
          // Fetch with diversify.by=properties.geocode.city to force geographic spread.
          const altCandidates = await fetchCandidates(stage, signalEntityIds, excludeEntityIds, undefined, excludeLocationQuery, true);
          const altFiltered = altCandidates.filter((c) => !isRejected(c));
          if (altFiltered.length >= 1) candidates = altFiltered;
          // else: let the LLM apply the hard constraint in the prompt
        }
      }

      if (candidates.length === 0) throw new Error("No candidates returned from Qloo");

      const candidateSummary = candidates.map((c) => {
        const attribution = c.explainability?.map((a) => {
          const anchor = resolvedAnchors.find((r) => r.entityId === a.entityId);
          return `${anchor?.participant ?? a.entityId} (${anchor?.query ?? ""}): ${a.score.toFixed(3)}`;
        }).join(", ");
        return `- ${c.name} (id: ${c.entityId}, affinity: ${c.affinity?.toFixed(3)}, attribution: [${attribution}])`;
      }).join("\n");

      const anchorSummary = resolvedAnchors.map((a) => `${a.participant}: "${a.query}" → ${a.name} (${a.type})`).join("\n");
      const rejectionSummary = rejections.length > 0
        ? `HARD CONSTRAINT: Do NOT propose any of the following — they were explicitly rejected: ${rejections.map((r) => r.entityName).join(", ")}. Also avoid destinations in the same country or region as any rejected destination.`
        : "No rejections yet.";
      const locationNote = stage === "venue" && locationQuery
        ? `IMPORTANT: Only propose a venue in or near ${locationQuery}. Do not propose venues in other cities.`
        : "";

      const negotiatorHistory: HistoryMessage[] = [
        ...history,
        ...(critiqueContext ? [{ role: "user" as const, content: critiqueContext }] : []),
      ];

      const userMessage = [
        `Stage: ${stage}`,
        locationNote,
        `Resolved taste anchors:\n${anchorSummary}`,
        `Qloo candidates:\n${candidateSummary}`,
        rejectionSummary,
        `Pick the best candidate and respond with ONLY valid JSON (no markdown):\n{"entityId": "<id>", "reasoning": "<2-3 sentences>"}`,
      ].filter(Boolean).join("\n\n");

      const llmResponse = await runStructuredCompletion<{ entityId: string; reasoning: string }>(
        NEGOTIATOR_PROMPT, userMessage, negotiatorHistory,
      );

      const entity = candidates.find((c) => c.entityId === llmResponse.entityId) ?? candidates[0];

      emit({
        type: "negotiator_proposed",
        payload: {
          entity: { name: entity.name, affinity: entity.affinity, tags: entity.tags?.slice(0, 5).map((t) => t.name) },
          reasoning: llmResponse.reasoning,
          entityId: entity.entityId,
        },
      });

      // Fast-path check
      // Compute per-participant attribution by summing their anchors' scores.
      const anchorsByParticipant = new Map(
        participants.map((p) => [p.name, resolvedAnchors.filter((a) => a.participant === p.name)])
      );
      const participantScores = participants.map((p) => {
        const anchors = anchorsByParticipant.get(p.name) ?? [];
        return entity.explainability
          ?.filter((a) => anchors.some((r) => r.entityId === a.entityId))
          .reduce((sum, a) => sum + a.score, 0) ?? 0;
      });
      const attributionGap = participantScores.length > 1
        ? Math.max(...participantScores) - Math.min(...participantScores)
        : 0;
      // Expected gap scales with anchor count imbalance — a participant with 4 anchors vs 2
      // will naturally dominate even with equal per-person signal. Allow up to 0.15 per extra
      // anchor difference so the advocate doesn't loop on structural imbalance.
      const maxAnchorCount = Math.max(...participants.map((p) => (anchorsByParticipant.get(p.name) ?? []).length));
      const minAnchorCount = Math.min(...participants.map((p) => (anchorsByParticipant.get(p.name) ?? []).length));
      const gapAllowance = 0.15 + (maxAnchorCount - minAnchorCount) * 0.15;
      // Structural fairness check — deterministic, no LLM. If affinity is strong and the
      // attribution gap is within the expected range given anchor count imbalance, the advocate
      // has nothing meaningful to add. Skip it. Rejection history is a skeptic concern, not
      // an advocate concern.
      // Venue stage affinity is structurally lower (~0.60) because cross-domain signal
      // from movies/music to local places is weaker than destination signal. Use 0.55 floor.
      const affinityFloor = stage === "venue" ? 0.55 : 0.75;
      const fairnessOk = (entity.affinity ?? 0) >= affinityFloor && attributionGap < gapAllowance;
      const isCleanProposal = fairnessOk && rejections.length === 0;

      // Weak-anchor bypass: if every participant with zero attribution has only weak anchors,
      // advocate looping won't help — Qloo has no cross-domain signal for their input type.
      const zeroAttributionParticipants = participants.filter((p) =>
        (anchorsByParticipant.get(p.name) ?? []).every((a) => a.weak)
      );
      const allZeroHaveWeakAnchors = zeroAttributionParticipants.length > 0;

      // Advocate + Skeptic in parallel
      emit({ type: "advocate_thinking" });
      emit({ type: "skeptic_thinking" });

      const getAdvocateResult = () => {
        // Venue stage: fairness advocacy doesn't apply — we're picking a shared activity,
        // not dividing a resource. Cross-domain signal from taste to local places is weak
        // by nature; gap-based fairness checks cause false loops. Skip LLM entirely.
        if (stage === "venue") {
          return Promise.resolve({ verdict: "approve" as const, reasoning: `Venue stage: fairness pre-approved. Picking the highest-affinity group activity venue.` });
        }
        if (fairnessOk) {
          return Promise.resolve({ verdict: "approve" as const, reasoning: `Fairness approved: affinity ${entity.affinity?.toFixed(3)}, attribution gap ${attributionGap.toFixed(3)} is within the ${gapAllowance.toFixed(3)} allowance for ${maxAnchorCount - minAnchorCount} anchor count difference.` });
        }
        if (allZeroHaveWeakAnchors) {
          return Promise.resolve({ verdict: "approve" as const, reasoning: `Approved with caveat: ${zeroAttributionParticipants.map(p => p.name).join(", ")}'s taste input couldn't be resolved to a Qloo entity with destination signal — try an artist, movie, brand, or TV show instead.` });
        }
        return runAdvocate({ stage, participants, proposal: entity, rejections, history, resolvedAnchors });
      };

      const getSkepticResult = () => {
        if (isCleanProposal || allZeroHaveWeakAnchors) {
          return Promise.resolve({ verdict: "approve" as const, reasoning: allZeroHaveWeakAnchors ? `Approved: weak-anchor bypass active.` : `Fast-path approved: structurally sound.` });
        }
        // Venue stage: scope is enforced by filter.location.query at the API level.
        // The skeptic's scope mismatch check causes false positives (flagging LA neighborhoods
        // as "outside LA") and pattern repetition isn't meaningful with a 20-candidate pool.
        // Skip the skeptic entirely for venue stage.
        if (stage === "venue") {
          return Promise.resolve({ verdict: "approve" as const, reasoning: `Scope pre-validated: API filtered venues to ${locationQuery}. Structural check passed.` });
        }
        return runSkeptic({ stage, proposal: entity, rejections, chosenDestination: state.chosenDestination, history });
      };

      const [advocateResult, skepticResult] = await Promise.all([getAdvocateResult(), getSkepticResult()]);

      emit({ type: "advocate_verdict", payload: { verdict: advocateResult.verdict, reasoning: advocateResult.reasoning, underservedParticipant: (advocateResult as any).underservedParticipant } });
      emit({ type: "skeptic_verdict", payload: { verdict: skepticResult.verdict, reasoning: skepticResult.reasoning, failureMode: (skepticResult as any).failureMode } });

      const bothApprove = advocateResult.verdict === "approve" && skepticResult.verdict === "approve";

      if (bothApprove || critiquePass === MAX_CRITIQUE_ROUNDS) {
        emit({
          type: "round_complete",
          payload: {
            entity,
            reasoning: llmResponse.reasoning,
            advocateResult,
            skepticResult,
            fastPath: isCleanProposal,
          },
        });
        return;
      }

      // Build critique for next pass
      const critiqueParts = [`Your proposal (${entity.name}) was reviewed and needs revision:`];
      if (advocateResult.verdict === "pushback") {
        critiqueParts.push(`Fairness concern (Advocate): ${advocateResult.reasoning}` + ((advocateResult as any).underservedParticipant ? ` (least served: ${(advocateResult as any).underservedParticipant})` : ""));
      }
      if (skepticResult.verdict === "pushback") {
        critiqueParts.push(`Structural concern (Skeptic): ${skepticResult.reasoning}`);
        if ((skepticResult as any).negotiatorConstraint) critiqueParts.push(`Apply this constraint: ${(skepticResult as any).negotiatorConstraint}`);
      }
      critiqueParts.push("Re-query Qloo with these concerns in mind and propose a different entity.");
      critiqueContext = critiqueParts.join("\n");

      emit({ type: "critique_revising", payload: { reason: critiqueContext } });
    }
  });
}
