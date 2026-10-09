"use client";

interface AgentVerdictProps {
  agent: "Negotiator" | "Advocate" | "Skeptic";
  verdict: "approve" | "pushback";
  reasoning: string;
  detail?: string; // underservedParticipant or failureMode
  thinking?: boolean;
}

const AGENT_META = {
  Negotiator: { icon: "⚖", goal: "converge efficiently" },
  Advocate:   { icon: "🛡", goal: "fairness over speed" },
  Skeptic:    { icon: "🔍", goal: "structural viability" },
};

export function AgentVerdict({ agent, verdict, reasoning, detail, thinking }: AgentVerdictProps) {
  const meta = AGENT_META[agent];
  const isApprove = verdict === "approve";

  return (
    <div
      className="stream-event rounded-lg border p-4 text-sm"
      style={{
        background: "var(--bg-elevated)",
        borderColor: thinking ? "var(--border)" : isApprove ? "#16a34a33" : "#dc262633",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span style={{ color: "var(--text-primary)" }} className="font-semibold">{agent}</span>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{meta.goal}</span>
        </div>
        {thinking ? (
          <div className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-secondary)" }} />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-secondary)" }} />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--text-secondary)" }} />
          </div>
        ) : (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: isApprove ? "#16a34a22" : "#dc262622",
              color: isApprove ? "#4ade80" : "#f87171",
            }}
          >
            {isApprove ? "approved" : "pushback"}
          </span>
        )}
      </div>
      {!thinking && (
        <p style={{ color: "var(--text-secondary)" }} className="leading-relaxed">
          {reasoning}
          {detail && (
            <span className="ml-1 font-medium" style={{ color: "var(--accent)" }}>
              ({detail})
            </span>
          )}
        </p>
      )}
    </div>
  );
}
