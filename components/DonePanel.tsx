"use client";

import { useState } from "react";
import type { AcceptedEntity } from "@/app/page";

interface LogEntry {
  id: number;
  status: "pending" | "ok" | "err" | "agent-ok" | "agent-warn";
  text: string;
}

interface DonePanelProps {
  destination: AcceptedEntity;
  venue: AcceptedEntity;
  destinationReasoning?: string;
  venueReasoning?: string;
  destinationLog?: LogEntry[];
  venueLog?: LogEntry[];
  onRestart: () => void;
  onReset: () => void;
}

export function DonePanel({ destination, venue, destinationReasoning, venueReasoning, destinationLog, venueLog, onRestart, onReset }: DonePanelProps) {
  const [logOpen, setLogOpen] = useState(false);
  const destPct = destination.affinity !== undefined ? (destination.affinity * 100).toFixed(0) : null;
  const venuePct = venue.affinity !== undefined ? (venue.affinity * 100).toFixed(0) : null;
  const combinedLog = [...(destinationLog ?? []), ...(venueLog ?? [])];
  const whyText = venueReasoning ?? destinationReasoning;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "var(--bg-base)", position: "relative", overflow: "hidden" }}>
      {/* Gradient blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -140, left: -120, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.32) 0%, transparent 60%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.30) 0%, transparent 60%)", filter: "blur(44px)" }} />
        <div style={{ position: "absolute", top: "30%", right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", bottom: "25%", left: -40, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.16) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", top: "55%", left: "40%", transform: "translateX(-50%)", width: 500, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)", filter: "blur(60px)" }} />
      </div>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .done-card { animation: fadeUp 0.4s ease forwards; }
        .done-card-2 { animation: fadeUp 0.4s ease 0.15s forwards; opacity: 0; }
        .done-why { animation: fadeUp 0.4s ease 0.25s forwards; opacity: 0; }
        .done-actions { animation: fadeUp 0.4s ease 0.3s forwards; opacity: 0; }
        .affinity-bar-fill { animation: growBar 0.8s ease 0.5s forwards; transform-origin: left; transform: scaleX(0); }
        @keyframes growBar { to { transform: scaleX(1); } }
        .log-entry-ok { color: var(--text-tertiary); }
        .log-entry-warn { color: var(--coral); }
      `}</style>

      {/* Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }} className="done-card">
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal)", display: "inline-block", boxShadow: "0 0 0 3px var(--teal-dim)" }} />
        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--teal)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
          Consensus reached
        </span>
      </div>

      {/* Destination card */}
      <div className="done-card" style={{ width: "100%", maxWidth: 520, marginBottom: 12 }}>
        <div style={{
          background: "linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)",
          borderRadius: 16,
          padding: "28px 28px 24px",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -20, left: 20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

          <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>
            Your destination
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {destination.name}
            </h1>
            {destPct && (
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{destPct}%</div>
                <div style={{ fontSize: 10, opacity: 0.7, fontFamily: "var(--font-geist-mono)" }}>group match</div>
              </div>
            )}
          </div>
          {destPct && (
            <div style={{ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
              <div className="affinity-bar-fill" style={{ height: 4, width: `${destPct}%`, background: "#fff", borderRadius: 2 }} />
            </div>
          )}
        </div>
      </div>

      {/* Venue card */}
      <div className="done-card-2" style={{ width: "100%", maxWidth: 520, marginBottom: 12 }}>
        <div style={{
          background: "var(--bg-surface)",
          border: "1.5px solid var(--border)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 6 }}>
              Recommended activity
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
              {venue.name}
            </h2>
          </div>
          {venuePct && (
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--coral)", letterSpacing: "-0.03em", fontFamily: "var(--font-geist-mono)" }}>{venuePct}%</div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>group match</div>
            </div>
          )}
        </div>
      </div>

      {/* Feature 4: "Why this works for everyone" */}
      {whyText && (
        <div className="done-why" style={{ width: "100%", maxWidth: 520, marginBottom: 12 }}>
          <div style={{ padding: "14px 20px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Why this works for everyone
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
              "{whyText}"
            </p>
          </div>
        </div>
      )}

      {/* Feature 5: Collapsed "How we decided" log */}
      {combinedLog.length > 0 && (
        <div style={{ width: "100%", maxWidth: 520, marginBottom: 16 }}>
          <button
            onClick={() => setLogOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor: "pointer",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 11,
              color: "var(--text-tertiary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span>How we decided</span>
            <span style={{ transition: "transform 0.2s", display: "inline-block", transform: logOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </button>
          {logOpen && (
            <div style={{ marginTop: 4, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {combinedLog.map((entry) => (
                <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--font-geist-mono)", fontSize: 11, lineHeight: 1.6 }}>
                  <span style={{ flexShrink: 0 }}>
                    {entry.status === "ok" && <span style={{ color: "var(--green)" }}>✓</span>}
                    {entry.status === "agent-ok" && <span style={{ color: "var(--green)" }}>◆</span>}
                    {entry.status === "agent-warn" && <span style={{ color: "var(--coral)" }}>◆</span>}
                    {entry.status === "err" && <span style={{ color: "var(--red)" }}>✗</span>}
                    {entry.status === "pending" && <span style={{ color: "var(--text-tertiary)" }}>·</span>}
                  </span>
                  <span style={{ color: entry.status === "agent-warn" ? "var(--coral)" : "var(--text-tertiary)", wordBreak: "break-word" }}>
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trust badge */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>⚡</span>
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>Powered by Qloo taste intelligence</span>
      </div>

      {/* Actions */}
      <div className="done-actions" style={{ display: "flex", gap: 10, width: "100%", maxWidth: 520 }}>
        <button
          onClick={onReset}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: "1.5px solid var(--border-strong)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-geist-sans)",
            transition: "border-color 0.15s",
          }}
        >
          Start over
        </button>
        <button
          onClick={onRestart}
          style={{
            flex: 2,
            padding: "12px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: "var(--coral)",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "var(--font-geist-sans)",
            boxShadow: "0 2px 8px rgba(249,112,102,0.35)",
          }}
        >
          Re-run for same group →
        </button>
      </div>
    </div>
  );
}
