"use client";

import { useState } from "react";
import type { Participant } from "@/lib/schema/state";

interface LLMToggleProps {
  participants: Participant[];
  stage: "destination" | "venue";
  chosenDestination?: { name: string };
}

export function LLMToggle({ participants, stage, chosenDestination }: LLMToggleProps) {
  const [llmResult, setLlmResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setLlmResult(null);
    try {
      const res = await fetch("/api/llm-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, stage, chosenDestination: chosenDestination?.name }),
      });
      if (!res.ok) throw new Error("LLM request failed");
      const data = await res.json();
      setLlmResult(data.result);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            LLM-only baseline
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            No Qloo data — raw language model guess
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-40"
          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {loading ? "Thinking…" : "Run"}
        </button>
      </div>

      {llmResult && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {llmResult}
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      {!llmResult && !loading && !error && (
        <p className="text-xs italic" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>
          Hit Run to see what the LLM suggests without taste signals.
        </p>
      )}
    </div>
  );
}
