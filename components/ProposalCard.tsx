"use client";

interface ProposalCardProps {
  name: string;
  affinity: number;
  reasoning: string;
  tags?: string[];
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function ProposalCard({ name, affinity, reasoning, tags, onAccept, onReject, disabled }: ProposalCardProps) {
  const affinityPct = Math.round(affinity * 100);

  return (
    <div
      className="stream-event rounded-xl border p-5"
      style={{ background: "var(--bg-surface)", borderColor: "var(--accent)33" }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {name}
        </h2>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>
            {affinityPct}%
          </span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>group match</span>
        </div>
      </div>

      {/* Affinity bar */}
      <div className="h-1 rounded-full mb-3" style={{ background: "var(--bg-elevated)" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${affinityPct}%`, background: "var(--accent)" }}
        />
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
        {reasoning}
      </p>

      <div className="flex gap-3">
        <button
          onClick={onAccept}
          disabled={disabled}
          className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Accept
        </button>
        <button
          onClick={onReject}
          disabled={disabled}
          className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-opacity disabled:opacity-40"
          style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          Try another
        </button>
      </div>
    </div>
  );
}
