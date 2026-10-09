"use client";

import { useState } from "react";
import type { Participant } from "@/lib/schema/state";

const SAMPLE_SCENARIOS: { label: string; participants: Omit<Participant, "id">[] }[] = [
  {
    label: "Foodies & film fans",
    participants: [
      { name: "Zara", tasteAnchors: [{ query: "Nobu" }, { query: "Parasite" }] },
      { name: "Marcus", tasteAnchors: [{ query: "The Bear" }, { query: "Erewhon" }] },
      { name: "Suki", tasteAnchors: [{ query: "Bad Bunny" }, { query: "Le Bernardin" }] },
    ],
  },
  {
    label: "Music & culture",
    participants: [
      { name: "Diego", tasteAnchors: [{ query: "Kendrick Lamar" }, { query: "Supreme" }] },
      { name: "Priya", tasteAnchors: [{ query: "Mitski" }, { query: "Ace Hotel" }] },
      { name: "Kai", tasteAnchors: [{ query: "Frank Ocean" }, { query: "Aesop" }] },
    ],
  },
  {
    label: "Adventure crew",
    participants: [
      { name: "Alex", tasteAnchors: [{ query: "National Geographic" }, { query: "GoPro" }] },
      { name: "Jordan", tasteAnchors: [{ query: "Airbnb" }, { query: "Planet Earth" }] },
    ],
  },
];

const CHIPS = [
  // Food & drink
  "Nobu", "Carbone", "Le Bernardin", "Erewhon", "Blue Bottle Coffee",
  // Travel & stays
  "Ace Hotel", "Six Senses", "Soho House", "citizenM", "Tokyo",
  // Film & TV
  "Succession", "The Bear", "Parasite", "Everything Everywhere", "Chef's Table",
  // Fashion & lifestyle
  "Aesop", "Glossier", "Patagonia", "Maison Margiela", "Stone Island",
  // Music
  "Frank Ocean", "Kendrick Lamar", "Mitski", "Bad Bunny", "Bicep",
];

interface SetupPanelProps {
  participants: Participant[];
  setParticipants: (ps: Participant[]) => void;
  onStart: (ps?: Participant[]) => void;
}

export function SetupPanel({ participants, setParticipants, onStart }: SetupPanelProps) {
  const [name, setName] = useState("");
  const [anchors, setAnchors] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);

  const addAnchor = (q: string) => {
    const t = q.trim();
    if (!t || anchors.includes(t) || anchors.length >= 4) return;
    setAnchors((p) => [...p, t]);
  };
  const removeAnchor = (q: string) => setAnchors((p) => p.filter((a) => a !== q));

  const addParticipant = () => {
    if (!name.trim() || anchors.length < 1) return;
    setParticipants([...participants, {
      id: crypto.randomUUID(),
      name: name.trim(),
      tasteAnchors: anchors.map((q) => ({ query: q })),
    }]);
    setName("");
    setAnchors([]);
    setCustom("");
  };

  const removeParticipant = (id: string) => setParticipants(participants.filter((p) => p.id !== id));

  const loadSample = (scenario: typeof SAMPLE_SCENARIOS[0], index: number) => {
    setSelectedScenario(index);
    const ps = scenario.participants.map((p) => ({ ...p, id: crypto.randomUUID() }));
    setParticipants(ps);
    onStart(ps);
  };

  const unusedChips = CHIPS.filter((c) => !anchors.includes(c));

  const SCENARIO_DESCRIPTIONS = [
    "A foodie group with a shared love of film and fine dining",
    "Tastemakers into music, streetwear, and cultural experiences",
    "Solo traveler looking for a vibe-matched destination",
  ];

  return (
    <div style={{ width: "100%", height: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <style>{`
      .scenario-card { transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s; }
      .scenario-card:hover { box-shadow: 0 6px 20px rgba(79,70,229,0.12); transform: translateY(-3px); }
      .chip-btn { transition: background 0.1s, border-color 0.1s, color 0.1s; }
      .chip-btn:hover:not(:disabled) { background: var(--accent-dim) !important; border-color: var(--accent) !important; color: var(--accent) !important; }
    `}</style>

      {/* Hero — full viewport, no scroll */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 40px 32px",
        textAlign: "center",
        background: "#fff",
        minHeight: 0,
      }}>
        {/* Gradient blobs — punchier */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{
            position: "absolute", top: -100, left: -80,
            width: 500, height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79,70,229,0.30) 0%, transparent 65%)",
            filter: "blur(48px)",
          }} />
          <div style={{
            position: "absolute", bottom: -80, right: -60,
            width: 460, height: 460,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,112,102,0.28) 0%, transparent 65%)",
            filter: "blur(48px)",
          }} />
          <div style={{
            position: "absolute", top: "20%", left: "50%",
            transform: "translateX(-50%)",
            width: 600, height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 65%)",
            filter: "blur(60px)",
          }} />
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
          One group.{" "}
          <span style={{ color: "var(--coral)" }}>Many tastes.</span>{" "}
          <span style={{ color: "var(--accent)" }}>One destination.</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: "0 0 14px", maxWidth: 440, marginInline: "auto", lineHeight: 1.6 }}>
          Group trips are hard. Palatable finds a destination and activity everyone will actually enjoy — powered by real taste data.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--teal)" }}>◆</span> Powered by Qloo taste intelligence
          </span>
          <span style={{ color: "var(--border-strong)", fontSize: 10 }}>·</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--accent)" }}>◆</span> AI agents debate every pick
          </span>
        </div>
        </div>

        {/* Scenario cards */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, maxWidth: 860, width: "100%", margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
          {SAMPLE_SCENARIOS.map((s, i) => {
            const isSelected = selectedScenario === i;
            const cardBorder = isSelected ? "2px solid var(--coral)" : "1.5px solid rgba(255,255,255,0.7)";
            const cardBg = isSelected ? "rgba(249,112,102,0.07)" : "rgba(255,255,255,0.6)";
            return (
            <button
              key={s.label}
              className="scenario-card"
              onClick={() => loadSample(s, i)}
              style={{
                flex: "1 1 220px",
                maxWidth: 260,
                padding: "20px 18px",
                borderRadius: 10,
                border: cardBorder,
                background: cardBg,
                backdropFilter: "blur(12px)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontFamily: "var(--font-geist-sans)",
                textAlign: "left",
              }}
            >
              <div style={{
                fontSize: 20, marginBottom: 10, width: 40, height: 40,
                borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: i === 0 ? "#FF6B6B" : i === 1 ? "#7C3AED" : "#2563EB",
                boxShadow: i === 0
                  ? "0 2px 8px rgba(255,107,107,0.35)"
                  : i === 1
                  ? "0 2px 8px rgba(124,58,237,0.35)"
                  : "0 2px 8px rgba(37,99,235,0.35)",
              }}>
                {i === 0 ? "🍽️" : i === 1 ? "🎵" : "🧳"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {SCENARIO_DESCRIPTIONS[i]}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, fontWeight: 600, color: "var(--coral)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.04em" }}>
                Try this →
              </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Builder section */}
      <div style={{ width: "100%", background: "#fff", borderTop: "1.5px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>

        {/* Left: how it works */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.02em" }}>How it works</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { n: "1", title: "Add your group", body: "Enter each person's name and a few things they love — a restaurant, artist, brand, or TV show." },
              { n: "2", title: "Qloo maps taste", body: "Qloo's taste graph connects what people like across categories — food, culture, travel, nightlife." },
              { n: "3", title: "Agents negotiate", body: "An advocate and skeptic AI debate the best pick until both agree it works for everyone." },
              { n: "4", title: "You get a match", body: "A destination and venue chosen for your group's collective taste — not just an average." },
            ].map(({ n, title, body }) => (
              <div key={n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{n}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: builder */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>✨ Build your group</h2>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "var(--accent-dim)", color: "var(--accent)", fontFamily: "var(--font-geist-mono)", letterSpacing: "0.04em" }}>STEP 1</span>
          </div>

      {/* Add participant */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px",
        background: "var(--bg-surface)",
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
          Add a person
        </p>

        <input
          type="text"
          placeholder="Name (e.g. Zara)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addParticipant()}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            borderRadius: 8,
            border: "1.5px solid var(--border-strong)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            outline: "none",
            marginBottom: 16,
            fontFamily: "var(--font-geist-sans)",
            boxSizing: "border-box",
          }}
        />
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          Pick up to 4 things they love — artists, shows, movies, brands, places:
        </p>

        {/* Selected anchors */}
        {anchors.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {anchors.map((a) => (
              <button
                key={a}
                onClick={() => removeAnchor(a)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 3,
                  border: "1px solid var(--accent-dim)",
                  background: "transparent",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontFamily: "var(--font-geist-mono)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {a} <span style={{ opacity: 0.6 }}>×</span>
              </button>
            ))}
          </div>
        )}

        {/* Chip suggestions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {unusedChips.slice(0, 10).map((chip) => (
            <button
              key={chip}
              className="chip-btn"
              onClick={() => addAnchor(chip)}
              disabled={anchors.length >= 4}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 3,
                border: "1px solid var(--border-strong)",
                background: "transparent",
                color: anchors.length >= 4 ? "var(--text-tertiary)" : "var(--text-secondary)",
                cursor: anchors.length >= 4 ? "default" : "pointer",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)", marginBottom: 6, marginTop: 2 }}>
          Works best with: artists · TV shows · movies · brands · cities
        </p>

        {/* Custom input */}
        <input
          type="text"
          placeholder="Type an artist, show, brand, city… and press Enter"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={anchors.length >= 4}
          onKeyDown={(e) => {
            if (e.key === "Enter") { addAnchor(custom); setCustom(""); }
          }}
          style={{
            width: "100%",
            padding: "9px 14px",
            fontSize: 13,
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            outline: "none",
            marginBottom: 16,
            fontFamily: "var(--font-geist-sans)",
            boxSizing: "border-box",
            opacity: anchors.length >= 4 ? 0.4 : 1,
          }}
        />

        <button
          onClick={addParticipant}
          disabled={!name.trim() || anchors.length < 1}
          style={{
            width: "100%",
            padding: "11px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            border: !name.trim() || anchors.length < 1 ? "1.5px dashed var(--border-strong)" : "none",
            background: !name.trim() || anchors.length < 1 ? "transparent" : "var(--accent)",
            color: !name.trim() || anchors.length < 1 ? "var(--text-tertiary)" : "#fff",
            cursor: !name.trim() || anchors.length < 1 ? "default" : "pointer",
            fontFamily: "var(--font-geist-sans)",
            transition: "background 0.15s, box-shadow 0.15s",
            boxShadow: !name.trim() || anchors.length < 1 ? "none" : "0 2px 8px rgba(79,70,229,0.28)",
          }}
        >
          {!name.trim() || anchors.length < 1 ? "Enter name + pick a taste to add" : `+ Add ${name.trim()}`}
        </button>
      </div>

      {/* Group list */}
      {participants.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Group · {participants.length}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {participants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 4,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>
                    {p.tasteAnchors.map((a) => a.query).join(" · ")}
                  </span>
                </div>
                <button
                  onClick={() => removeParticipant(p.id)}
                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {participants.length >= 1 && (
        <>
        <button
          onClick={() => onStart()}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: "var(--coral)",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "var(--font-geist-sans)",
            letterSpacing: "0.01em",
            boxShadow: "0 2px 8px rgba(249,112,102,0.35)",
          }}
        >
          Find where to go →
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>⚡</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-geist-mono)" }}>Powered by Qloo taste intelligence</span>
        </div>
        </>
      )}

        </div>
        </div>
      </div>
    </div>
  );
}
