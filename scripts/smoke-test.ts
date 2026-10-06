// Quick end-to-end smoke test: Qloo search -> insights -> proposal reasoning.
// Reproduces the live curl tests from 2026-10-05/06 through the real client.
// Run with: npm run smoke-test

import "dotenv/config";
import { searchEntity, getInsights } from "../lib/qloo/client";
import { runPlainCompletion } from "../lib/bedrock/client";

async function main() {
  console.log("--- Resolving taste anchors ---");

  const radiohead = await searchEntity("Radiohead", "urn:entity:artist");
  const nobu = await searchEntity("Nobu", "urn:entity:place");
  const katsuya = await searchEntity("Katsuya", "urn:entity:place");

  const resolved = [radiohead[0], nobu[0], katsuya[0]];
  for (const r of resolved) {
    console.log(`  ${r.name} -> ${r.entityId} (${r.type})`);
  }

  console.log("\n--- Round 1: destination negotiation (cross-domain signals) ---");
  const destinations = await getInsights({
    filterType: "urn:entity:destination",
    signalEntityIds: resolved.map((r) => r.entityId),
    explainability: true,
    take: 3,
  });

  for (const d of destinations) {
    console.log(`  ${d.name} - affinity ${d.affinity?.toFixed(3)}`);
    if (d.explainability) {
      for (const attr of d.explainability) {
        const who = resolved.find((r) => r.entityId === attr.entityId)?.name ?? attr.entityId;
        console.log(`    contribution from ${who}: ${attr.score.toFixed(3)}`);
      }
    }
  }

  if (destinations.length === 0) {
    console.log("No destinations returned - stopping.");
    return;
  }

  const chosen = destinations[0];
  console.log(`\n--- Round 2: venue negotiation, scoped to ${chosen.name} ---`);
  const venues = await getInsights({
    filterType: "urn:entity:place",
    signalEntityIds: [nobu[0].entityId, katsuya[0].entityId],
    locationQuery: chosen.name,
    explainability: true,
    take: 3,
  });

  for (const v of venues) {
    console.log(`  ${v.name} - affinity ${v.affinity?.toFixed(3)}`);
  }

  console.log("\n--- Bedrock (Mantle) plain completion test - LLM-only mode ---");
  const llmOnlyGuess = await runPlainCompletion(
    "You help a group of friends pick a trip destination based on their tastes. Answer in 1-2 sentences.",
    "Maya likes Radiohead and the restaurant Nobu. Jordan likes Katsuya. Where should they go on a trip?",
  );
  console.log(`  ${llmOnlyGuess}`);

  console.log("\nSmoke test complete.");
}

main().catch((err) => {
  console.error("Smoke test failed:", err.message);
  process.exit(1);
});
