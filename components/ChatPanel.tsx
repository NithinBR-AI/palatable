"use client";

import { useEffect, useRef, useState } from "react";
import type { GroupId } from "@/components/LandingPanel";
import type { Participant } from "@/lib/schema/state";
import type { ExtractedAnchor } from "@/lib/extract/anchors";

import {
  SEED_GROUP, SEED_PARTICIPANTS,
  PRE_TRIGGER_MESSAGES, TRIGGER_MESSAGE,
} from "@/data/seed-chat";
import {
  ADVENTURE_GROUP, ADVENTURE_PARTICIPANTS,
  ADVENTURE_PRE_TRIGGER, ADVENTURE_TRIGGER,
} from "@/data/seed-chat-adventure";
import {
  LUXURY_GROUP, LUXURY_PARTICIPANTS,
  LUXURY_PRE_TRIGGER, LUXURY_TRIGGER,
} from "@/data/seed-chat-luxury";
import type { MessageRecord } from "@/lib/db/schema";

interface ChatPanelProps {
  groupId: GroupId;
  onStartNegotiation: (participants: Participant[]) => void;
  onBack: () => void;
}

type ChatMessage = MessageRecord & { isPalatable?: boolean; isUser?: boolean };

const GROUP_DATA: Record<GroupId, {
  group: typeof SEED_GROUP;
  participants: typeof SEED_PARTICIPANTS;
  preMessages: MessageRecord[];
  triggerMessage: MessageRecord;
}> = {
  "group-demo-001": {
    group: SEED_GROUP,
    participants: SEED_PARTICIPANTS,
    preMessages: PRE_TRIGGER_MESSAGES,
    triggerMessage: TRIGGER_MESSAGE,
  },
  "group-demo-002": {
    group: ADVENTURE_GROUP,
    participants: ADVENTURE_PARTICIPANTS,
    preMessages: ADVENTURE_PRE_TRIGGER,
    triggerMessage: ADVENTURE_TRIGGER,
  },
  "group-demo-003": {
    group: LUXURY_GROUP,
    participants: LUXURY_PARTICIPANTS,
    preMessages: LUXURY_PRE_TRIGGER,
    triggerMessage: LUXURY_TRIGGER,
  },
};

const INTENT_KEYWORDS = ["palatable", "where should we go", "where should the", "suggest", "plan a trip", "let's go", "lets go"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function shouldShowDate(messages: ChatMessage[], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].timestamp).toDateString();
  const curr = new Date(messages[index].timestamp).toDateString();
  return prev !== curr;
}

export function ChatPanel({ groupId, onStartNegotiation, onBack }: ChatPanelProps) {
  const data = GROUP_DATA[groupId];
  const { group, participants, preMessages, triggerMessage } = data;

  const participantMap = Object.fromEntries(participants.map((p) => [p.id, p]));

  const [messages, setMessages] = useState<ChatMessage[]>(preMessages);
  const [inputText, setInputText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [tasteProfiles, setTasteProfiles] = useState<Record<string, string>>({});
  const [anchorsReady, setAnchorsReady] = useState(false);
  const [extractedAnchors, setExtractedAnchors] = useState<ExtractedAnchor[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runExtraction = async (allMessages: ChatMessage[]) => {
    setIsExtracting(true);

    // Add Palatable "thinking" message
    const thinkingMsg: ChatMessage = {
      groupId,
      sortKey: `thinking`,
      participantId: "palatable",
      participantName: "Palatable",
      text: "Analysing your group's taste profile...",
      timestamp: new Date().toISOString(),
      processed: true,
      isPalatable: true,
    };
    setMessages((prev) => [...prev, thinkingMsg]);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            participantId: m.participantId,
            participantName: m.participantName,
            text: m.text,
            timestamp: m.timestamp,
          })),
          persist: false,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Extract failed: ${res.status}`);
      }

      // Read SSE stream until extract_done or error event
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let anchors: ExtractedAnchor[] = [];
      let warnings: { participantId: string; participantName: string; level: "warn" | "no_signal" }[] = [];
      let blocked = false;
      let buf = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as { type: string; payload?: Record<string, unknown> };
          if (event.type === "extract_done") {
            anchors = (event.payload?.anchors as ExtractedAnchor[]) ?? [];
            warnings = (event.payload?.warnings as typeof warnings) ?? [];
            blocked = (event.payload?.blocked as boolean) ?? false;
            break outer;
          }
          if (event.type === "error") {
            const code = event.payload?.code as string | undefined;
            if (code === "blocked") {
              blocked = true;
            } else {
              throw new Error((event.payload?.message as string) ?? "Extraction error");
            }
            break outer;
          }
        }
      }

      setExtractedAnchors(anchors);

      // Build taste profile per participant
      const profiles: Record<string, string[]> = {};
      for (const a of anchors) {
        if (!profiles[a.participantId]) profiles[a.participantId] = [];
        profiles[a.participantId].push(a.anchorText);
      }
      const profileStrings: Record<string, string> = {};
      for (const [pid, items] of Object.entries(profiles)) {
        profileStrings[pid] = items.slice(0, 4).join(", ");
      }
      setTasteProfiles(profileStrings);

      // Build warning lines for participants with weak/missing signal
      const warningLines = warnings.map((w) =>
        w.level === "no_signal"
          ? `⚠ ${w.participantName}: no taste signals found — their preferences won't be reflected`
          : `⚠ ${w.participantName}: only general preferences found — results may not fully reflect their taste`
      );

      if (blocked) {
        // Hard block: zero anchors from entire group
        setMessages((prev) => [...prev.filter((m) => m.sortKey !== "thinking"), {
          groupId,
          sortKey: `palatable-blocked`,
          participantId: "palatable",
          participantName: "Palatable",
          text: `I couldn't pick up any taste signals from your group's chat.\n\nTry sharing more about what you're into — music, films, brands, activities — and ask again.`,
          timestamp: new Date().toISOString(),
          processed: true,
          isPalatable: true,
        }]);
        return;
      }

      setAnchorsReady(true);

      // Replace thinking message with taste summary + any warnings
      const summaryLines = participants
        .map((p) => profileStrings[p.id] ? `${p.name}: ${profileStrings[p.id]}` : null)
        .filter(Boolean)
        .join("\n");

      const warningSection = warningLines.length > 0 ? `\n\n${warningLines.join("\n")}` : "";

      const summaryMsg: ChatMessage = {
        groupId,
        sortKey: `palatable-summary`,
        participantId: "palatable",
        participantName: "Palatable",
        text: `I've been listening 👂\n\nHere's what I know about your group:\n${summaryLines}${warningSection}\n\nReady to find where you should go. Tap "Plan our trip" to start.`,
        timestamp: new Date().toISOString(),
        processed: true,
        isPalatable: true,
      };

      setMessages((prev) => [...prev.filter((m) => m.sortKey !== "thinking"), summaryMsg]);
    } catch {
      setMessages((prev) => [...prev.filter((m) => m.sortKey !== "thinking"), {
        groupId,
        sortKey: `palatable-error`,
        participantId: "palatable",
        participantName: "Palatable",
        text: "Something went wrong analysing your group. Try again?",
        timestamp: new Date().toISOString(),
        processed: true,
        isPalatable: true,
      }]);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      groupId,
      sortKey: `user-${Date.now()}`,
      participantId: "p-user",
      participantName: "You",
      text,
      timestamp: new Date().toISOString(),
      processed: false,
      isUser: true,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");

    const lower = text.toLowerCase();
    const isIntent = INTENT_KEYWORDS.some((k) => lower.includes(k));
    if (isIntent && !anchorsReady) {
      // Add trigger message first then extract
      const trigMsg: ChatMessage = { ...triggerMessage, isUser: false };
      const withTrigger = [...newMessages, trigMsg];
      setMessages(withTrigger);
      await runExtraction(withTrigger);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePlanTrip = () => {
    // Convert extracted anchors to Participant[] for negotiation engine
    const participantList: Participant[] = participants.map((p) => {
      const anchors = extractedAnchors
        .filter((a) => a.participantId === p.id && a.entityId)
        .map((a) => ({ query: a.anchorText, entityId: a.entityId, entityName: a.anchorText }));
      return { id: p.id, name: p.name, tasteAnchors: anchors };
    });
    onStartNegotiation(participantList);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", background: "var(--bg-base)", position: "relative", overflow: "hidden" }}>
      {/* Gradient blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -140, left: -120, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.32) 0%, transparent 60%)", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.30) 0%, transparent 60%)", filter: "blur(44px)" }} />
        <div style={{ position: "absolute", top: "30%", right: -60, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", bottom: "25%", left: -40, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(249,112,102,0.16) 0%, transparent 60%)", filter: "blur(52px)" }} />
        <div style={{ position: "absolute", top: "55%", left: "40%", transform: "translateX(-50%)", width: 500, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)", filter: "blur(60px)" }} />
      </div>

      {/* Chat header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 12,
            padding: "4px 10px",
            lineHeight: 1,
            fontFamily: "var(--font-geist-mono)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >← Back</button>

        {/* Group avatar stack */}
        <div style={{ display: "flex" }}>
          {participants.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: p.color,
              border: "2px solid var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              marginLeft: i === 0 ? 0 : -10,
              zIndex: 3 - i,
              position: "relative",
            }}>{p.avatar}</div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{group.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{participants.length} members · 3 weeks of chat</div>
        </div>

        {/* Palatable badge */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", boxShadow: "0 0 0 2px var(--teal-dim)" }} />
          <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--teal)", fontWeight: 600 }}>
            Palatable listening
          </span>
        </div>
      </div>

      {/* Judge hint banner — sticky, dismisses once extraction starts */}
      {!anchorsReady && !isExtracting && (
        <div style={{
          padding: "8px 16px",
          background: "rgba(79,70,229,0.09)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(79,70,229,0.18)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          position: "sticky",
          top: 57,
          zIndex: 9,
        }}>
          <span style={{ fontSize: 13 }}>💡</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            Scroll through the chat to see how the group talks — then type{" "}
            <strong style={{ color: "var(--accent)" }}>"where should we go?"</strong>{" "}
            to trigger Palatable
          </span>
        </div>
      )}

      {/* Taste profiles sidebar strip — sticky after extraction */}
      {anchorsReady && (
        <div style={{
          padding: "10px 16px",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: 16,
          overflowX: "auto",
          flexShrink: 0,
          position: "sticky",
          top: 57,
          zIndex: 9,
        }}>
          {participants.map((p) => tasteProfiles[p.id] && (
            <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: p.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
                marginTop: 1,
              }}>{p.avatar}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", maxWidth: 160, lineHeight: 1.3 }}>{tasteProfiles[p.id]}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.map((msg, i) => {
          const participant = participantMap[msg.participantId];
          const isPalatable = msg.isPalatable;
          const isUser = msg.isUser;
          const showDate = shouldShowDate(messages, i);

          return (
            <div key={msg.sortKey}>
              {showDate && (
                <div style={{
                  textAlign: "center",
                  margin: "12px 0 8px",
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-geist-mono)",
                }}>
                  {formatDate(msg.timestamp)}
                </div>
              )}

              {isPalatable ? (
                // Palatable message — special styled bubble
                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent), var(--teal))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    flexShrink: 0,
                  }}>✦</div>
                  <div style={{ maxWidth: "75%" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--teal)", marginBottom: 3, fontFamily: "var(--font-geist-mono)" }}>
                      Palatable
                    </div>
                    <div style={{
                      background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(20,184,166,0.08))",
                      border: "1.5px solid var(--border)",
                      borderRadius: "4px 12px 12px 12px",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ) : isUser ? (
                // User's own message — right aligned
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                  <div style={{
                    background: "var(--accent)",
                    borderRadius: "12px 4px 12px 12px",
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#fff",
                    maxWidth: "70%",
                    lineHeight: 1.5,
                  }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                // Group member message
                <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-end" }}>
                  {participant && (
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: participant.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}>{participant.avatar}</div>
                  )}
                  <div style={{ maxWidth: "70%" }}>
                    {(i === 0 || messages[i - 1].participantId !== msg.participantId) && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: participant?.color ?? "var(--text-tertiary)", marginBottom: 2 }}>
                        {msg.participantName}
                      </div>
                    )}
                    <div style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "4px 12px 12px 12px",
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-geist-mono)" }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Plan trip CTA — appears after extraction */}
        {anchorsReady && (
          <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
            <button
              onClick={handlePlanTrip}
              style={{
                background: "var(--coral)",
                border: "none",
                borderRadius: 10,
                padding: "12px 28px",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 2px 12px rgba(249,112,102,0.35)",
                fontFamily: "var(--font-geist-sans)",
              }}
            >
              Plan our trip →
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 16px 14px",
        borderTop: "1px solid var(--border)",
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
      }}>
        {/* Quick-reply chip — one-tap trigger */}
        {!anchorsReady && !isExtracting && (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={async () => {
                const text = "Where should we go for our next trip?";
                const userMsg: ChatMessage = {
                  groupId,
                  sortKey: `user-${Date.now()}`,
                  participantId: "p-user",
                  participantName: "You",
                  text,
                  timestamp: new Date().toISOString(),
                  processed: false,
                  isUser: true,
                };
                const newMessages = [...messages, userMsg];
                setMessages(newMessages);
                const trigMsg: ChatMessage = { ...triggerMessage, isUser: false };
                const withTrigger = [...newMessages, trigMsg];
                setMessages(withTrigger);
                await runExtraction(withTrigger);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                border: "1.5px solid var(--accent)",
                background: "rgba(79,70,229,0.07)",
                color: "var(--accent)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-geist-sans)",
                whiteSpace: "nowrap",
              }}
            >
              ✦ Ask Palatable where we should go →
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isExtracting ? "Palatable is thinking..." : "Type a message... or ask Palatable where you should go"}
          disabled={isExtracting}
          style={{
            flex: 1,
            background: "var(--bg-elevated)",
            border: "1.5px solid var(--border)",
            borderRadius: 20,
            padding: "8px 14px",
            fontSize: 12,
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "var(--font-geist-sans)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isExtracting || !inputText.trim()}
          style={{
            background: inputText.trim() && !isExtracting ? "var(--accent)" : "var(--border)",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            cursor: inputText.trim() && !isExtracting ? "pointer" : "default",
            color: "#fff",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >↑</button>
      </div>
    </div>
  );
}
