#!/usr/bin/env tsx
import "dotenv/config";
// evals/runner.ts — end-to-end eval runner for the Palatable consensus pipeline.
//
// Usage:
//   npx tsx evals/runner.ts              # run all cases
//   npx tsx evals/runner.ts ww           # run only cases whose ID contains "ww"
//   npx tsx evals/runner.ts --json       # emit newline-delimited JSON results
//
// Each case:
//   1. Calls /api/extract with the fixture messages (skip DB persist)
//   2. Checks anchor extraction criteria
//   3. Calls /api/negotiate via SSE stream
//   4. Collects all stream events
//   5. Checks affinity, balance, convergence, city-match criteria
//   6. Prints a pass/fail report per criterion

import { extractAnchors } from "@/lib/extract/anchors";
import type { ExtractedAnchor } from "@/lib/extract/anchors";
import { EVAL_CASES } from "@/evals/suites/consensus";
import type { EvalCase, EvalCriteria } from "@/evals/suites/consensus";
import type { Participant } from "@/lib/schema/state";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface CriterionResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface CaseResult {
  caseId: string;
  description: string;
  passed: boolean;
  criteria: CriterionResult[];
  durationMs: number;
  /** Snapshot of key runtime values for debugging. */
  snapshot: {
    anchorsByParticipant: Record<string, string[]>;
    destinationAffinity?: number;
    destinationName?: string;
    venueAffinity?: number;
    venueName?: string;
    critiqueRoundsUsed: number;
    advocateVerdict?: string;
    skepticVerdict?: string;
    errorEventReceived: boolean;
  };
}

// --------------------------------------------------------------------------
// Negotiate via in-process function call (avoids needing a running dev server)
// --------------------------------------------------------------------------

interface StreamedResult {
  destinationName?: string;
  destinationAffinity?: number;
  destinationEntityId?: string;
  destinationGeocode?: unknown;
  venueName?: string;
  venueAffinity?: number;
  critiqueRounds: number;
  advocateVerdict?: string;
  skepticVerdict?: string;
  errorEventReceived: boolean;
  rawEvents: unknown[];
}

async function drainSSE(res: Response): Promise<{ type: string; payload?: unknown }[]> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const events: { type: string; payload?: unknown }[] = [];
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {
        // skip malformed lines
      }
    }
  }
  return events;
}

async function runNegotiateStream(
  participants: Participant[],
  locationHint?: string,
): Promise<StreamedResult> {
  const { POST } = await import("@/app/api/negotiate/route");

  const result: StreamedResult = {
    critiqueRounds: 0,
    errorEventReceived: false,
    rawEvents: [],
  };

  // --- Stage 1: destination ---
  const destReq = new Request("http://localhost:3000/api/negotiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participants,
      stage: "destination",
      state: { rounds: [], rejections: [], chosenDestination: null },
      ...(locationHint ? { locationHint } : {}),
    }),
  });

  const destEvents = await drainSSE(await POST(destReq));
  result.rawEvents.push(...destEvents);

  for (const event of destEvents) {
    if (event.type === "error") result.errorEventReceived = true;
    if (event.type === "advocate_verdict") {
      result.advocateVerdict = (event.payload as { verdict?: string }).verdict;
      result.critiqueRounds++;
    }
    if (event.type === "skeptic_verdict") {
      result.skepticVerdict = (event.payload as { verdict?: string }).verdict;
    }
    if (event.type === "round_complete") {
      const p = event.payload as { entity?: { name?: string; affinity?: number; entityId?: string; geocode?: unknown } };
      result.destinationName = p.entity?.name;
      result.destinationAffinity = p.entity?.affinity;
      result.destinationEntityId = p.entity?.entityId;
      result.destinationGeocode = p.entity?.geocode;
    }
  }

  // --- Stage 2: venue (only if destination resolved) ---
  if (result.destinationEntityId) {
    const venueReq = new Request("http://localhost:3000/api/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants,
        stage: "venue",
        state: {
          rounds: [],
          rejections: [],
          chosenDestination: {
            entityId: result.destinationEntityId,
            name: result.destinationName,
            geocode: result.destinationGeocode,
          },
        },
        ...(locationHint ? { locationHint } : {}),
      }),
    });

    const venueEvents = await drainSSE(await POST(venueReq));
    result.rawEvents.push(...venueEvents);

    for (const event of venueEvents) {
      if (event.type === "error") result.errorEventReceived = true;
      if (event.type === "round_complete") {
        const p = event.payload as { entity?: { name?: string; affinity?: number } };
        result.venueName = p.entity?.name;
        result.venueAffinity = p.entity?.affinity;
      }
    }
  }

  return result;
}

// --------------------------------------------------------------------------
// Criterion checks
// --------------------------------------------------------------------------

function checkAnchors(
  anchors: ExtractedAnchor[],
  participants: Participant[],
  criteria: EvalCriteria["anchors"],
): CriterionResult[] {
  const results: CriterionResult[] = [];
  const participantIds = participants.map((p) => p.id);

  for (const pid of participantIds) {
    const pName = participants.find((p) => p.id === pid)?.name ?? pid;
    const pAnchors = anchors.filter((a) => a.participantId === pid);
    const namedCount = pAnchors.filter((a) => a.entityType !== "vibe").length;
    const vibeCount = pAnchors.filter((a) => a.entityType === "vibe").length;

    if (pAnchors.length === 0) {
      results.push({
        name: `anchors:${pName}:has_signal`,
        passed: false,
        detail: `${pName} has zero anchors extracted`,
      });
      continue;
    }

    if (!criteria.allowVibeOnly && namedCount < criteria.minNamedAnchorsPerParticipant) {
      results.push({
        name: `anchors:${pName}:named_min`,
        passed: false,
        detail: `${pName} has ${namedCount} named anchors (min ${criteria.minNamedAnchorsPerParticipant}), ${vibeCount} vibe-only`,
      });
    } else {
      results.push({
        name: `anchors:${pName}:named_min`,
        passed: true,
        detail: `${pName}: ${namedCount} named, ${vibeCount} vibe`,
      });
    }
  }

  return results;
}

function checkBalance(
  anchors: ExtractedAnchor[],
  participants: Participant[],
  criteria: EvalCriteria["balance"],
): CriterionResult {
  if (anchors.length === 0) {
    return { name: "balance:anchor_share", passed: false, detail: "No anchors to measure balance" };
  }

  const counts: Record<string, number> = {};
  for (const a of anchors) {
    counts[a.participantId] = (counts[a.participantId] ?? 0) + 1;
  }

  let maxShare = 0;
  let maxName = "";
  for (const [pid, count] of Object.entries(counts)) {
    const share = count / anchors.length;
    if (share > maxShare) {
      maxShare = share;
      maxName = participants.find((p) => p.id === pid)?.name ?? pid;
    }
  }

  const passed = maxShare <= criteria.maxSingleParticipantShare;
  return {
    name: "balance:anchor_share",
    passed,
    detail: `${maxName} has ${(maxShare * 100).toFixed(0)}% of anchors (max ${(criteria.maxSingleParticipantShare * 100).toFixed(0)}%)`,
  };
}

function checkAffinity(streamed: StreamedResult, criteria: EvalCriteria["affinity"]): CriterionResult[] {
  const destPassed = (streamed.destinationAffinity ?? 0) >= criteria.minDestinationAffinity;
  const venuePassed = Number(streamed.venueAffinity ?? 0) >= criteria.minVenueAffinity;

  return [
    {
      name: "affinity:destination",
      passed: destPassed,
      detail: streamed.destinationName
        ? `${streamed.destinationName} affinity=${streamed.destinationAffinity?.toFixed(3)} (min ${criteria.minDestinationAffinity})`
        : "No destination proposed",
    },
    {
      name: "affinity:venue",
      passed: venuePassed,
      detail: streamed.venueName
        ? `${streamed.venueName} affinity=${streamed.venueAffinity?.toFixed(3)} (min ${criteria.minVenueAffinity})`
        : "No venue resolved",
    },
  ];
}

function checkConvergence(streamed: StreamedResult, criteria: EvalCriteria["convergence"]): CriterionResult[] {
  const roundsPassed = streamed.critiqueRounds <= criteria.maxCritiqueRounds;
  const agentsPassed = !criteria.requireBothAgents ||
    (!!streamed.advocateVerdict && !!streamed.skepticVerdict);

  return [
    {
      name: "convergence:rounds",
      passed: roundsPassed,
      detail: `${streamed.critiqueRounds} critique round(s) used (max ${criteria.maxCritiqueRounds})`,
    },
    {
      name: "convergence:agents",
      passed: agentsPassed,
      detail: `advocate=${streamed.advocateVerdict ?? "none"}, skeptic=${streamed.skepticVerdict ?? "none"}`,
    },
    {
      name: "convergence:no_error",
      passed: !streamed.errorEventReceived,
      detail: streamed.errorEventReceived ? "Error event emitted during stream" : "No error events",
    },
  ];
}

function checkCityMatch(streamed: StreamedResult, criteria: EvalCriteria["cityMatch"]): CriterionResult | null {
  if (!criteria.expectedCityAliases.length) return null;

  const haystack = [
    streamed.destinationName ?? "",
    streamed.venueName ?? "",
    streamed.venueCity ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const matched = criteria.expectedCityAliases.some((alias) => haystack.includes(alias.toLowerCase()));
  return {
    name: "city_match",
    passed: matched,
    detail: matched
      ? `Matched alias in: "${streamed.destinationName ?? "unknown"}"`
      : `None of [${criteria.expectedCityAliases.join(", ")}] found in: "${streamed.destinationName ?? "?"}" / "${streamed.venueName ?? "?"}"`,
  };
}

// --------------------------------------------------------------------------
// Run a single eval case
// --------------------------------------------------------------------------

async function runCase(evalCase: EvalCase): Promise<CaseResult> {
  const start = Date.now();
  const allMessages = [...evalCase.messages, evalCase.trigger];

  // Step 1: extract anchors (no DB persist in evals)
  const anchors = await extractAnchors(allMessages, false);

  // Build participants with resolved anchors for the negotiate call
  const participantsWithAnchors: Participant[] = evalCase.participants.map((p) => ({
    ...p,
    tasteAnchors: anchors
      .filter((a) => a.participantId === p.id && a.entityType !== "vibe")
      .map((a) => ({ query: a.anchorText, entityId: a.entityId })),
  }));

  // Step 2: run negotiate stream
  const streamed = await runNegotiateStream(participantsWithAnchors, evalCase.locationHint);

  // Step 3: evaluate criteria
  const criteriaResults: CriterionResult[] = [
    ...checkAnchors(anchors, evalCase.participants, evalCase.criteria.anchors),
    checkBalance(anchors, evalCase.participants, evalCase.criteria.balance),
    ...checkAffinity(streamed, evalCase.criteria.affinity),
    ...checkConvergence(streamed, evalCase.criteria.convergence),
  ];

  const cityCheck = checkCityMatch(streamed, evalCase.criteria.cityMatch);
  if (cityCheck) criteriaResults.push(cityCheck);

  const allPassed = criteriaResults.every((c) => c.passed);

  // Build participant → anchor names snapshot
  const anchorsByParticipant: Record<string, string[]> = {};
  for (const p of evalCase.participants) {
    anchorsByParticipant[p.name] = anchors
      .filter((a) => a.participantId === p.id)
      .map((a) => `${a.anchorText} (${a.entityType})`);
  }

  return {
    caseId: evalCase.id,
    description: evalCase.description,
    passed: allPassed,
    criteria: criteriaResults,
    durationMs: Date.now() - start,
    snapshot: {
      anchorsByParticipant,
      destinationAffinity: streamed.destinationAffinity,
      destinationName: streamed.destinationName,
      venueAffinity: streamed.venueAffinity,
      venueName: streamed.venueName,
      critiqueRoundsUsed: streamed.critiqueRounds,
      advocateVerdict: streamed.advocateVerdict,
      skepticVerdict: streamed.skepticVerdict,
      errorEventReceived: streamed.errorEventReceived,
    },
  };
}

// --------------------------------------------------------------------------
// Reporting
// --------------------------------------------------------------------------

function printReport(results: CaseResult[], jsonMode: boolean): void {
  if (jsonMode) {
    for (const r of results) {
      process.stdout.write(JSON.stringify(r) + "\n");
    }
    return;
  }

  const PASS = "\x1b[32m✓\x1b[0m";
  const FAIL = "\x1b[31m✗\x1b[0m";
  const BOLD = "\x1b[1m";
  const RESET = "\x1b[0m";

  for (const result of results) {
    const badge = result.passed ? `${PASS} PASS` : `${FAIL} FAIL`;
    console.log(`\n${BOLD}[${result.caseId}]${RESET} ${badge} — ${result.durationMs}ms`);
    console.log(`  ${result.description}`);

    console.log("\n  Anchors extracted:");
    for (const [name, list] of Object.entries(result.snapshot.anchorsByParticipant)) {
      console.log(`    ${name}: ${list.length ? list.join(", ") : "none"}`);
    }

    if (result.snapshot.destinationName) {
      console.log(`\n  Destination: ${result.snapshot.destinationName} (affinity ${result.snapshot.destinationAffinity?.toFixed(3) ?? "?"})`);
    }
    if (result.snapshot.venueName) {
      console.log(`  Top Venue:   ${result.snapshot.venueName} (affinity ${result.snapshot.venueAffinity?.toFixed(3)})`);
    }
    console.log(`  Advocate:    ${result.snapshot.advocateVerdict ?? "none"}`);
    console.log(`  Skeptic:     ${result.snapshot.skepticVerdict ?? "none"}`);
    console.log(`  Rounds used: ${result.snapshot.critiqueRoundsUsed}`);

    console.log("\n  Criteria:");
    for (const c of result.criteria) {
      const icon = c.passed ? PASS : FAIL;
      console.log(`    ${icon} ${c.name}: ${c.detail}`);
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${BOLD}Results: ${passed}/${total} cases passed${RESET}`);
  if (passed < total) process.exit(1);
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const filter = args.find((a) => !a.startsWith("--"));

  const cases = filter
    ? EVAL_CASES.filter((c) => c.id.includes(filter) || c.description.toLowerCase().includes(filter.toLowerCase()))
    : EVAL_CASES;

  if (!cases.length) {
    console.error(`No eval cases match filter: "${filter}"`);
    process.exit(1);
  }

  if (!jsonMode) {
    console.log(`\nPalatable Evals — running ${cases.length} case(s)\n${"─".repeat(60)}`);
  }

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    if (!jsonMode) process.stdout.write(`Running ${evalCase.id}... `);
    try {
      const result = await runCase(evalCase);
      results.push(result);
      if (!jsonMode) console.log(result.passed ? "done" : "done (FAILED)");
    } catch (err) {
      const errResult: CaseResult = {
        caseId: evalCase.id,
        description: evalCase.description,
        passed: false,
        criteria: [{ name: "runner:no_crash", passed: false, detail: String(err) }],
        durationMs: 0,
        snapshot: {
          anchorsByParticipant: {},
          critiqueRoundsUsed: 0,
          errorEventReceived: false,
        },
      };
      results.push(errResult);
      if (!jsonMode) console.log(`ERROR: ${err}`);
    }
  }

  printReport(results, jsonMode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
