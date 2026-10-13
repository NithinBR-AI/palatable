"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant } from "@/lib/schema/state";
import type { StreamEvent } from "@/lib/stream";
import type { AcceptedEntity } from "@/app/page";

interface LogEntry {
  id: number;
  status: "pending" | "ok" | "err" | "agent-ok" | "agent-warn";
  text: string;
  tooltip?: string;
}

interface ResolvedAnchor {
  participant: string;
  query: string;
  resolved: string;
}

interface ProposalData {
  entityId: string;
  name: string;
  affinity?: number;
  tags?: string[];
  reasoning: string;
}

interface NegatiatePanelProps {
  participants: Participant[];
  stage: "destination" | "venue";
  chosenDestination?: AcceptedEntity;
  rejections: { entityId: string; entityName: string }[];
  onAccept: (entity: AcceptedEntity & { reasoning?: string; log?: LogEntry[] }) => void;
  onReject: (entity: { entityId: string; entityName: string }) => void;
  onReset: () => void;
}

function get<T>(payload: Record<string, unknown> | undefined, key: string): T {
  return ((payload ?? {})[key]) as T;
}

let idCounter = 0;
const nextId = () => ++idCounter;

const AVATAR_COLORS: Record<string, string> = {
  "0": "#6366f1", "1": "#f43f5e", "2": "#10b981", "3": "#f59e0b", "4": "#0ea5e9", "5": "#a855f7",
};

export function NegotiatePanel({
  participants, stage, chosenDestination, rejections, onAccept, onReject, onReset,
}: NegatiatePanelProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmResult, setLlmResult] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [resolvedAnchors, setResolvedAnchors] = useState<ResolvedAnchor[]>([]);
  const [conflictFlash, setConflictFlash] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (entry: Omit<LogEntry, "id">) =>
    setLog((prev) => [...prev, { ...entry, id: nextId() }]);

  const run = async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLog([]);
    setProposal(null);
    setDone(false);
    setAccepted(false);
    setError(null);
    setLlmResult(null);
    setResolvedAnchors([]);
    setConflictFlash(false);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants,
          stage,
          state: { rounds: [], rejections, chosenDestination },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: StreamEvent;
          try { event = JSON.parse(raw); } catch { continue; }

          switch (event.type) {
            case "anchors_resolving":
              addLog({ status: "pending", text: `Looking up what everyone likes…`, tooltip: "Qloo maps each person's taste anchors to real taste data." });
              break;
            case "anchors_resolved": {
              const anchors = get<ResolvedAnchor[]>(event.payload, "anchors");
              setResolvedAnchors(anchors);
              setLog((prev) => {
                const next = [...prev];
                const i = next.findLastIndex((l) => l.status === "pending");
                if (i >= 0) next[i] = { ...next[i], status: "ok", text: `Taste profiles loaded` };
                return next;
              });
              anchors.forEach((a) =>
                addLog({ status: "ok", text: `${a.participant}: "${a.query}" → ${a.resolved}`, tooltip: `Qloo matched "${a.query}" to a real entity in its taste graph for ${a.participant}.` })
              );
              break;
            }
            case "negotiator_thinking":
              addLog({ status: "pending", text: "Finding the best match for the group…", tooltip: "The negotiator scores candidates using Qloo affinity data across all participants." });
              break;
            case "negotiator_proposed": {
              const entity = get<{ name: string; affinity?: number; tags?: string[] }>(event.payload, "entity");
              setLog((prev) => {
                const next = [...prev];
                const i = next.findLastIndex((l) => l.status === "pending");
                if (i >= 0) next[i] = { ...next[i], status: "ok", text: `Top pick: ${entity.name}  ${entity.affinity !== undefined ? (entity.affinity * 100).toFixed(0) + "% group match" : ""}` };
                return next;
              });
              setProposal({
                entityId: get<string>(event.payload, "entityId"),
                name: entity.name,
                affinity: entity.affinity,
                tags: entity.tags,
                reasoning: get<string>(event.payload, "reasoning"),
              });
              break;
            }
            case "advocate_thinking":
              addLog({ status: "pending", text: "Checking: does this work for everyone?", tooltip: "The advocate agent looks for reasons this pick is a good fit." });
              break;
            case "skeptic_thinking":
              addLog({ status: "pending", text: "Checking: is there anything wrong with this?", tooltip: "The skeptic agent looks for problems — someone getting left out, or a mismatch with their tastes." });
              break;
            case "advocate_verdict": {
              const verdict = get<string>(event.payload, "verdict");
              const reasoning = get<string>(event.payload, "reasoning");
              setLog((prev) => {
                const next = [...prev];
                const i = next.findLastIndex((l) => l.status === "pending" && l.text.includes("everyone"));
                if (i >= 0) next[i] = { ...next[i], status: verdict === "approve" ? "agent-ok" : "agent-warn", text: `Advocate: ${verdict === "approve" ? "✓ Looks good" : "⚠ Has concerns"}  — ${reasoning.slice(0, 80)}${reasoning.length > 80 ? "…" : ""}`, tooltip: reasoning };
                return next;
              });
              break;
            }
            case "skeptic_verdict": {
              const verdict = get<string>(event.payload, "verdict");
              const reasoning = get<string>(event.payload, "reasoning");
              setLog((prev) => {
                const next = [...prev];
                const i = next.findLastIndex((l) => l.status === "pending" && l.text.includes("anything wrong"));
                if (i >= 0) next[i] = { ...next[i], status: verdict === "approve" ? "agent-ok" : "agent-warn", text: `Skeptic: ${verdict === "approve" ? "✓ No issues" : "⚠ Flagged concern"}  — ${reasoning.slice(0, 80)}${reasoning.length > 80 ? "…" : ""}`, tooltip: reasoning };
                return next;
              });
              // Feature 1: conflict flash when skeptic rejects
              if (verdict !== "approve") {
                setConflictFlash(true);
                setTimeout(() => setConflictFlash(false), 1200);
              }
              break;
            }
            case "anchor_warning": {
              const names = get<string[]>(event.payload, "participants") ?? [];
              const msg = get<string>(event.payload, "message") ?? "";
              addLog({ status: "agent-warn", text: `⚠ ${names.join(", ")}: taste signals didn't influence this pick`, tooltip: msg });
              break;
            }
            case "low_signal_warning": {
              const msg = get<string>(event.payload, "message") ?? "";
              addLog({ status: "agent-warn", text: `⚠ Low confidence: ${msg}`, tooltip: msg });
              break;
            }
            case "critique_revising":
              addLog({ status: "pending", text: "One agent disagreed — trying again…", tooltip: "When the skeptic or advocate flags a problem, the negotiator picks a new candidate." });
              break;
            case "round_complete":
              setDone(true);
              break;
            case "error":
              throw new Error(get<string>(event.payload, "message") ?? "Stream error");
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message ?? "Something went wrong");
    }
  };

  const runLlm = async () => {
    setLlmLoading(true);
    setLlmResult(null);
    try {
      const res = await fetch("/api/llm-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, stage, chosenDestination: chosenDestination?.name }),
      });
      const data = await res.json();
      setLlmResult(data.result);
    } catch {
      setLlmResult("Failed to fetch.");
    } finally {
      setLlmLoading(false);
    }
  };

  useEffect(() => {
    run();
    runLlm();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const handleAccept = () => {
    if (!proposal) return;
    setAccepted(true);
    onAccept({
      entityId: proposal.entityId,
      name: proposal.name,
      affinity: proposal.affinity,
      reasoning: proposal.reasoning,
      log,
    });
  };

  const handleReject = () => {
    if (!proposal) return;
    onReject({ entityId: proposal.entityId, entityName: proposal.name });
  };

  // Feature 3: group chemistry score (avg affinity across all resolved anchors ≈ proxy)
  const chemistryScore = proposal?.affinity !== undefined
    ? Math.min(100, Math.round(proposal.affinity * 100 + (participants.length > 2 ? 3 : 0)))
    : null;

  // Feature 2: per-person anchor map from resolved anchors
  const anchorsByPerson = resolvedAnchors.reduce<Record<string, string[]>>((acc, a) => {
    if (!acc[a.participant]) acc[a.participant] = [];
    if (acc[a.participant].length < 3) acc[a.participant].push(a.query);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: "var(--bg-base)" }}>
      {/* Gradient blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -140, left: -120, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.32) 0%, transparent 60%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.30) 0%, transparent 60%)", filter: "blur(44px)" }} />
        <div style={{ position: "absolute", top: "30%", right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", bottom: "25%", left: -40, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.16) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", top: "55%", left: "40%", transform: "translateX(-50%)", width: 500, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)", filter: "blur(60px)" }} />
      </div>
      <style>{`
        @keyframes conflictPulse {
          0%   { background: var(--bg-base); }
          20%  { background: rgba(249,112,102,0.10); }
          60%  { background: rgba(249,112,102,0.06); }
          100% { background: var(--bg-base); }
        }
        .conflict-flash { animation: conflictPulse 1.2s ease forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slideUp 0.3s ease forwards; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        .thinking-dot { animation: pulse 1.2s ease-in-out infinite; }
        .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* Stage breadcrumb */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 40, zIndex: 10, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {stage === "destination" ? "Step 1 of 2 · Finding a destination" : `Step 2 of 2 · Finding an activity in ${chosenDestination?.name ?? ""}`}
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {participants.map((p) => p.name).join(", ")}
          </span>
        </div>
        <button onClick={onReset} style={{ background: "none", border: "none", fontSize: 11, color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "var(--font-geist-mono)" }}>
          ← start over
        </button>
      </div>

      {/* Feature 3: Group chemistry score bar */}
      {chemistryScore !== null && (
        <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 20px", display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)", position: "sticky", top: 81, zIndex: 9 }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
            Group chemistry
          </span>
          <div style={{ flex: 1, height: 4, background: "var(--bg-elevated)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 4, width: `${chemistryScore}%`, background: "linear-gradient(90deg, var(--accent), var(--teal))", borderRadius: 2, transition: "width 0.8s ease" }} />
          </div>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
            {chemistryScore}%
          </span>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, maxWidth: 1100, width: "100%", margin: "0 auto", alignItems: "start", padding: "0 20px", position: "relative", zIndex: 1 }}>

        {/* LEFT — trace log */}
        <div
          className={conflictFlash ? "conflict-flash" : ""}
          style={{ borderRight: "1px solid var(--border)", padding: "20px 24px 20px 0", minHeight: 400 }}
        >
          <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
            How we decided
          </p>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>
            Watch the agents work in real time ↓
          </p>

          {/* Feature 2: per-person taste chips */}
          {Object.keys(anchorsByPerson).length > 0 && (
            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {participants.map((p, idx) => {
                const chips = anchorsByPerson[p.name] ?? [];
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: AVATAR_COLORS[String(idx % 6)], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {p.name[0]}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-geist-mono)", flexShrink: 0 }}>{p.name}</span>
                    {chips.length > 0 ? chips.map((chip) => (
                      <span key={chip} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>
                        {chip}
                      </span>
                    )) : (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--bg-elevated)", border: "1px dashed var(--border)", color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)", fontStyle: "italic" }}>
                        vibe signals only
                      </span>
                    )}
                  </div>
                );
              })}
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            </div>
          )}

          <div ref={logRef} style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {log.map((entry) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--font-geist-mono)", fontSize: 11.5, lineHeight: 1.6 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  {entry.status === "pending" && (
                    <span style={{ display: "inline-flex", gap: 2 }}>
                      <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                      <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                      <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                    </span>
                  )}
                  {entry.status === "ok" && <span style={{ color: "var(--green)" }}>✓</span>}
                  {entry.status === "agent-ok" && <span style={{ color: "var(--green)" }}>◆</span>}
                  {entry.status === "agent-warn" && <span style={{ color: "var(--coral)" }}>◆</span>}
                  {entry.status === "err" && <span style={{ color: "var(--red)" }}>✗</span>}
                </span>
                <span style={{
                  color: entry.status === "agent-warn" ? "var(--coral)" : entry.status === "err" ? "var(--red)" : "var(--text-secondary)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {entry.text}
                </span>
              </div>
            ))}
            {error && (
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
                ✗ {error}
                <button onClick={run} style={{ marginLeft: 8, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}>retry</button>
              </div>
            )}
          </div>

          {/* Without Qloo */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "#fef3c7", color: "#92400e", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.03em" }}>AI ONLY</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Without Qloo taste data</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>
              Generic LLM — no affinity scoring, no taste graph, just vibes.
            </p>
            {llmLoading && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 6, border: "1px solid var(--border)" }}>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-tertiary)", display: "inline-block" }} />
                  <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-tertiary)", display: "inline-block" }} />
                  <span className="thinking-dot" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-tertiary)", display: "inline-block" }} />
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontStyle: "italic" }}>Asking AI without taste data…</span>
              </div>
            )}
            {llmResult && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, background: "var(--bg-elevated)", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", fontStyle: "italic" }}>
                "{llmResult.replace(/\*\*([^*]+)\*\*/g, "$1")}"
              </p>
            )}
            {llmResult && (
              <p style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 6, fontFamily: "var(--font-geist-mono)" }}>
                ↑ No affinity score. No per-person attribution. Just a guess.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — proposal */}
        <div style={{ padding: "20px 0 20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.03em" }}>QLOO + AI</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Best match for your group</p>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>
            Taste affinity scored across all {participants.length} {participants.length === 1 ? "person" : "people"} · per-person attribution
          </p>

          {!proposal && !error && (
            <div>
              <div style={{ height: 32, width: "60%", background: "var(--bg-elevated)", borderRadius: 6, marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 2, marginBottom: 16 }} />
              <div style={{ height: 14, width: "40%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 14, width: "90%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 14, width: "75%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 14, width: "80%", background: "var(--bg-elevated)", borderRadius: 4 }} />
              <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                Agents are negotiating the best pick for your group…
              </p>
            </div>
          )}

          {proposal && !accepted && (
            <div className="slide-up">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
                  {proposal.name}
                </h2>
                {proposal.affinity !== undefined && (
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>
                    {(proposal.affinity * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {proposal.affinity !== undefined && (
                <div style={{ height: 2, background: "var(--bg-elevated)", borderRadius: 1, marginBottom: 12 }}>
                  <div style={{ height: 2, width: `${(proposal.affinity * 100).toFixed(0)}%`, background: "var(--accent)", borderRadius: 1, transition: "width 0.6s ease" }} />
                </div>
              )}

              {proposal.tags && proposal.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {proposal.tags.map((t, i) => (
                    <span key={`${t}-${i}`} style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", padding: "2px 6px", borderRadius: 2, border: "1px solid var(--border-strong)", color: "var(--text-tertiary)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 16 }}>
                {proposal.reasoning}
              </p>

              {done && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAccept} style={{ flex: 1, padding: "9px", fontSize: 12, fontWeight: 500, borderRadius: 4, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-geist-sans)", boxShadow: "0 2px 8px rgba(79,70,229,0.28)" }}>
                    ✓ Accept this pick
                  </button>
                  <button onClick={handleReject} style={{ flex: 1, padding: "9px", fontSize: 12, fontWeight: 500, borderRadius: 4, border: "1px solid var(--border-strong)", background: "none", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-geist-sans)" }}>
                    Try another
                  </button>
                </div>
              )}
            </div>
          )}

          {accepted && proposal && (
            <div className="slide-up" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--green)", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{proposal.name} accepted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
