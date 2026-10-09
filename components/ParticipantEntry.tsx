"use client";

import { useState } from "react";
import type { Participant } from "@/lib/schema/state";

const TASTE_CHIPS = [
  "Taylor Swift", "Kendrick Lamar", "Bad Bunny", "Mitski", "Frank Ocean",
  "Nobu", "Carbone", "Erewhon", "Le Bernardin", "Momofuku",
  "Succession", "The Bear", "Breaking Bad", "Parasite", "Dune",
  "Supreme", "Aesop", "Glossier", "Ace Hotel", "SoulCycle",
];

interface ParticipantEntryProps {
  onAdd: (participant: Participant) => void;
}

export function ParticipantEntry({ onAdd }: ParticipantEntryProps) {
  const [name, setName] = useState("");
  const [anchors, setAnchors] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

  const addAnchor = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || anchors.includes(trimmed) || anchors.length >= 4) return;
    setAnchors((prev) => [...prev, trimmed]);
  };

  const removeAnchor = (query: string) => setAnchors((prev) => prev.filter((a) => a !== query));

  const handleCustom = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAnchor(customInput);
      setCustomInput("");
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || anchors.length < 1) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      tasteAnchors: anchors.map((q) => ({ query: q })),
    });
    setName("");
    setAnchors([]);
    setCustomInput("");
  };

  const unusedChips = TASTE_CHIPS.filter((c) => !anchors.includes(c));

  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        Add a participant
      </h3>

      <input
        type="text"
        placeholder="Their name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm mb-3 outline-none"
        style={{
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />

      {anchors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {anchors.map((a) => (
            <button
              key={a}
              onClick={() => removeAnchor(a)}
              className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent)44" }}
            >
              {a} <span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
        Pick taste anchors (up to 4) or type your own:
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {unusedChips.slice(0, 12).map((chip) => (
          <button
            key={chip}
            onClick={() => addAnchor(chip)}
            disabled={anchors.length >= 4}
            className="text-xs px-2.5 py-1 rounded-full transition-opacity disabled:opacity-30"
            style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {chip}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Type an artist, show, restaurant… ↵"
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        onKeyDown={handleCustom}
        disabled={anchors.length >= 4}
        className="w-full rounded-lg px-3 py-2 text-sm mb-3 outline-none disabled:opacity-40"
        style={{
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={!name.trim() || anchors.length < 1}
        className="w-full py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        Add {name.trim() || "participant"}
      </button>
    </div>
  );
}
