"use client";

import type { Participant } from "@/lib/schema/state";

const SCENARIOS: { label: string; participants: Omit<Participant, "id">[] }[] = [
  {
    label: "Weekend trip: foodies & film fans",
    participants: [
      { name: "Zara", tasteAnchors: [{ query: "Nobu" }, { query: "Parasite" }] },
      { name: "Marcus", tasteAnchors: [{ query: "The Bear" }, { query: "Erewhon" }] },
      { name: "Suki", tasteAnchors: [{ query: "Bad Bunny" }, { query: "Le Bernardin" }] },
    ],
  },
  {
    label: "Music & culture crew",
    participants: [
      { name: "Diego", tasteAnchors: [{ query: "Kendrick Lamar" }, { query: "Supreme" }] },
      { name: "Priya", tasteAnchors: [{ query: "Mitski" }, { query: "Ace Hotel" }] },
      { name: "Kai", tasteAnchors: [{ query: "Frank Ocean" }, { query: "Aesop" }] },
    ],
  },
  {
    label: "Solo traveler",
    participants: [
      { name: "Alex", tasteAnchors: [{ query: "Taylor Swift" }, { query: "SoulCycle" }, { query: "Succession" }] },
    ],
  },
];

interface SampleScenarioButtonProps {
  onLoad: (participants: Participant[]) => void;
}

export function SampleScenarioButton({ onLoad }: SampleScenarioButtonProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCENARIOS.map((s) => (
        <button
          key={s.label}
          onClick={() =>
            onLoad(s.participants.map((p) => ({ ...p, id: crypto.randomUUID() })))
          }
          className="text-xs px-3 py-1.5 rounded-full transition-colors"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
