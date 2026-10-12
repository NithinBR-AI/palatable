"use client";

import { SEED_GROUP, SEED_PARTICIPANTS } from "@/data/seed-chat";
import { ADVENTURE_GROUP, ADVENTURE_PARTICIPANTS } from "@/data/seed-chat-adventure";
import { LUXURY_GROUP, LUXURY_PARTICIPANTS } from "@/data/seed-chat-luxury";

export type GroupId = "group-demo-001" | "group-demo-002" | "group-demo-003";

interface LandingPanelProps {
  onSelectGroup: (groupId: GroupId) => void;
  onTryYourself: () => void;
}

const GROUPS = [
  {
    group: SEED_GROUP,
    participants: SEED_PARTICIPANTS,
    tagline: "Indie film, Japanese food & rooftop bars",
    emoji: "🎬",
  },
  {
    group: ADVENTURE_GROUP,
    participants: ADVENTURE_PARTICIPANTS,
    tagline: "Live music, street food & outdoor adventures",
    emoji: "🧗",
  },
  {
    group: LUXURY_GROUP,
    participants: LUXURY_PARTICIPANTS,
    tagline: "Fine dining, contemporary art & design hotels",
    emoji: "🎨",
  },
];

export function LandingPanel({ onSelectGroup, onTryYourself }: LandingPanelProps) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "48px 20px 40px",
      background: "var(--bg-base)",
      minHeight: "calc(100vh - 40px)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Gradient blobs — indigo + coral mirrors the PALATABLE wordmark */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: -140, left: -120,
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.32) 0%, transparent 60%)",
          filter: "blur(48px)",
        }} />
        <div style={{
          position: "absolute", bottom: -100, right: -100,
          width: 560, height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,112,102,0.30) 0%, transparent 60%)",
          filter: "blur(44px)",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: -60,
          width: 380, height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 60%)",
          filter: "blur(52px)",
        }} />
        <div style={{
          position: "absolute", bottom: "25%", left: -40,
          width: 340, height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,112,102,0.16) 0%, transparent 60%)",
          filter: "blur(52px)",
        }} />
        <div style={{
          position: "absolute", top: "55%", left: "40%",
          transform: "translateX(-50%)",
          width: 500, height: 240,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)",
          filter: "blur(60px)",
        }} />
      </div>

      {/* Hero */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 48, maxWidth: 560 }}>
        <h1 style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.15,
          margin: "0 0 14px",
        }}>
          <span style={{ color: "var(--text-primary)" }}>One group.{" "}</span>
          <span style={{ color: "var(--coral)" }}>Many tastes.</span>
          <br />
          <span style={{ color: "var(--accent)" }}>One perfect trip.</span>
        </h1>
        <p style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          lineHeight: 1.65,
          margin: "0 0 10px",
        }}>
          Pick a group below to watch Palatable decode their taste from real conversations —
          or tell us about your own group and get a live recommendation.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--teal)" }}>◆</span> Qloo taste intelligence
          </span>
          <span style={{ color: "var(--border-strong)", fontSize: 10 }}>·</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--accent)" }}>◆</span> AI agents negotiate every pick
          </span>
        </div>
      </div>

      {/* Section 1 — See it in action */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 720, marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}>
            See it in action
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, textAlign: "center" }}>
          Pick a group. Scroll through their chat. Ask Palatable where they should go.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {GROUPS.map(({ group, participants, tagline, emoji }) => (
            <button
              key={group.groupId}
              onClick={() => onSelectGroup(group.groupId as GroupId)}
              style={{
                background: "var(--bg-surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 12,
                padding: "20px 18px",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(79,70,229,0.10)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              {/* Emoji + name */}
              <div>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {group.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.4 }}>
                  {tagline}
                </div>
              </div>

              {/* Avatars */}
              <div style={{ display: "flex", gap: -4 }}>
                {participants.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: p.color,
                      border: "2px solid var(--bg-surface)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      marginLeft: i === 0 ? 0 : -8,
                      zIndex: participants.length - i,
                      position: "relative",
                    }}
                  >
                    {p.avatar}
                  </div>
                ))}
                <span style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginLeft: 10,
                  alignSelf: "center",
                  fontFamily: "var(--font-geist-mono)",
                }}>
                  {participants.length} people
                </span>
              </div>

              {/* CTA */}
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent)",
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "0.05em",
              }}>
                Enter chat →
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 2 — Try it yourself */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          <span style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}>
            Try it yourself
          </span>
          <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        </div>

        <button
          onClick={onTryYourself}
          style={{
            width: "100%",
            background: "var(--accent)",
            border: "none",
            borderRadius: 12,
            padding: "20px 24px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.92"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Try it with your actual group
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Describe each person in a sentence — Palatable finds where you should go
            </div>
          </div>
          <div style={{
            fontSize: 22,
            color: "#fff",
            marginLeft: 16,
            fontFamily: "var(--font-geist-mono)",
            opacity: 0.8,
          }}>→</div>
        </button>

        <p style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          textAlign: "center",
          marginTop: 16,
          fontFamily: "var(--font-geist-mono)",
        }}>
          ⚡ Powered by Qloo taste intelligence × AWS Bedrock
        </p>
      </div>
    </div>
  );
}
