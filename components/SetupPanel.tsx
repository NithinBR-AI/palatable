"use client";

import { useState } from "react";
import type { Participant } from "@/lib/schema/state";

const EXAMPLE_DESCRIPTIONS = [
  `Into Khruangbin and Tame Impala, loves Japanese food and rooftop bars, watches arthouse films. Usually the one suggesting the cool spot nobody's heard of yet.`,
  `Bad Bunny on every run, obsessed with street food and outdoor adventures. Would rather eat tacos from a cart at midnight than a Michelin tasting menu.`,
  `Bon Iver and Brian Eno at home, Nobu for a client dinner, Aesop in every bathroom. Thinks about hotel lobby design more than is probably healthy.`,
];

const AVATAR_COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#0ea5e9", "#a855f7"];

interface SetupPanelProps {
  participants: Participant[];
  setParticipants: (ps: Participant[]) => void;
  onStart: (ps?: Participant[]) => void;
  onBack?: () => void;
}

export function SetupPanel({ participants, setParticipants, onStart, onBack }: SetupPanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exampleIdx] = useState(() => Math.floor(Math.random() * EXAMPLE_DESCRIPTIONS.length));

  const canAdd = name.trim().length > 0 && description.trim().length > 20;

  const addPerson = () => {
    if (!canAdd) return;
    setParticipants([
      ...participants,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        tasteAnchors: [{ query: description.trim() }],
      },
    ]);
    setName("");
    setDescription("");
    setAdding(false);
  };

  const removePerson = (id: string) => setParticipants(participants.filter((p) => p.id !== id));

  const handleStart = () => {
    if (participants.length === 0 || loading) return;
    setLoading(true);
    onStart();
  };

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-base)",
      position: "relative",
      overflow: "hidden",
      minHeight: "calc(100vh - 40px)",
      padding: "40px 20px",
    }}>
      <style>{`
        .setup-input:focus { border-color: var(--accent) !important; outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
        .add-btn:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
        .person-row:hover .remove-btn { opacity: 1 !important; }
      `}</style>

      {/* Blobs — indigo + coral mirrors the PALATABLE wordmark */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -140, left: -120, width: 580, height: 580, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.30) 0%, transparent 60%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 540, height: 540, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.28) 0%, transparent 60%)", filter: "blur(44px)" }} />
        <div style={{ position: "absolute", top: "25%", right: -60, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.16) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", bottom: "20%", left: -40, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.14) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", top: "50%", left: "45%", transform: "translate(-50%, -50%)", width: 440, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 65%)", filter: "blur(56px)" }} />
      </div>

      {/* Back */}
      {onBack && (
        <div style={{ position: "absolute", top: 12, left: 20, zIndex: 2 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-geist-mono)", display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
            ← Back
          </button>
        </div>
      )}

      {/* Main card */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Hero text */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, margin: "0 0 10px" }}>
            <span style={{ color: "var(--accent)" }}>Tell us</span>
            <span style={{ color: "var(--text-primary)" }}> about </span>
            <span style={{ color: "var(--coral)" }}>your group</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.65, maxWidth: 420, marginInline: "auto" }}>
            Describe each person in your own words. Palatable extracts their taste profile — the same way it would from weeks of group chat, just faster.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 99, background: "var(--bg-surface)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>
            <span style={{ color: "var(--teal)" }}>✦</span>
            Music · food · places · brands · vibes — anything works
          </div>
        </div>

        {/* People list */}
        {participants.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {participants.map((p, i) => (
              <div key={p.id} className="person-row" style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                    {p.tasteAnchors[0]?.query}
                  </div>
                </div>
                <button className="remove-btn" onClick={() => removePerson(p.id)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18, lineHeight: 1, opacity: 0.4, transition: "opacity 0.15s", padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {adding ? (
          <div style={{
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
            border: "1.5px solid var(--accent)", borderRadius: 14,
            padding: "22px", display: "flex", flexDirection: "column", gap: 14,
            boxShadow: "0 8px 32px rgba(79,70,229,0.12)",
            marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Add a person</span>
              <button onClick={() => { setAdding(false); setName(""); setDescription(""); }} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            <input
              type="text"
              placeholder="Their name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              className="setup-input"
              style={{
                width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 8,
                border: "1.5px solid var(--border-strong)", background: "#fff",
                color: "var(--text-primary)", fontFamily: "var(--font-geist-sans)",
                boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />

            <div>
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 2 }}>
                  Describe their taste — music, food, places, vibes
                </label>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                  In production, Palatable learns from months of real group chat. For this demo, 2–3 sentences is enough to run the full pipeline.
                </span>
              </div>
              <textarea
                placeholder={`e.g. "${EXAMPLE_DESCRIPTIONS[exampleIdx]}"`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) addPerson(); }}
                className="setup-input"
                rows={4}
                style={{
                  width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 8,
                  border: "1.5px solid var(--border-strong)", background: "#fff",
                  color: "var(--text-primary)", fontFamily: "var(--font-geist-sans)",
                  boxSizing: "border-box", resize: "none", lineHeight: 1.65,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
              {description.trim().length > 0 && !canAdd ? (
                <div style={{ margin: "6px 0 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>
                      Mention an artist, a cuisine, a place, or a vibe
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>
                      {description.trim().length} / 20
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: "var(--accent)",
                      width: `${Math.min(100, (description.trim().length / 20) * 100)}%`,
                      transition: "width 0.15s ease",
                    }} />
                  </div>
                </div>
              ) : !description.trim().length ? (
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "5px 0 0", fontFamily: "var(--font-geist-mono)" }}>
                  Mention an artist, a cuisine, a place, or a vibe · ⌘ + Enter to add
                </p>
              ) : null}
            </div>

            <button
              onClick={addPerson}
              disabled={!canAdd}
              style={{
                width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
                background: canAdd ? "var(--accent)" : "var(--bg-surface)",
                color: canAdd ? "#fff" : "var(--text-tertiary)",
                cursor: canAdd ? "pointer" : "default",
                fontFamily: "var(--font-geist-sans)",
                boxShadow: canAdd ? "0 2px 12px rgba(79,70,229,0.28)" : "none",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              {canAdd ? `+ Add ${name.trim() || "person"}` : "Add a name and describe their taste"}
            </button>
            {name.trim().length > 0 && description.trim().length > 0 && !canAdd && (
              <p style={{ fontSize: 12, color: "var(--coral, #F97066)", margin: "6px 0 0", textAlign: "center", fontFamily: "var(--font-geist-mono)" }}>
                A bit more detail — mention an artist, a place, or a food they love
              </p>
            )}
          </div>
        ) : (
          <button
            className="add-btn"
            onClick={() => setAdding(true)}
            style={{
              width: "100%", padding: "14px", fontSize: 14, fontWeight: 600,
              borderRadius: 10, border: "1.5px dashed var(--border-strong)",
              background: "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)",
              color: "var(--text-secondary)", cursor: "pointer",
              fontFamily: "var(--font-geist-sans)",
              transition: "border-color 0.15s, color 0.15s",
              marginBottom: participants.length > 0 ? 12 : 0,
            }}
          >
            + Add {participants.length === 0 ? "first person" : "another person"}
          </button>
        )}

        {/* CTA */}
        {participants.length >= 1 && !adding && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                width: "100%", padding: "16px", fontSize: 16, fontWeight: 700,
                borderRadius: 10, border: "none",
                background: loading ? "var(--bg-surface)" : "var(--coral)",
                color: loading ? "var(--text-tertiary)" : "#fff",
                cursor: loading ? "default" : "pointer",
                fontFamily: "var(--font-geist-sans)", letterSpacing: "0.01em",
                boxShadow: loading ? "none" : "0 4px 16px rgba(249,112,102,0.40)",
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              {loading
                ? "Analyzing taste profiles…"
                : `Find where ${participants.length === 1 ? participants[0].name : "your group"} should go →`}
            </button>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", margin: 0, fontFamily: "var(--font-geist-mono)" }}>
              ⚡ Qloo maps taste · AI agents negotiate · Real suggestions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
