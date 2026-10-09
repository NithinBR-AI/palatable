"use client";

import { useEffect, useRef, useState } from "react";
import { AgentVerdict } from "./AgentVerdict";
import { ProposalCard } from "./ProposalCard";
import type { Participant } from "@/lib/schema/state";
import type { StreamEvent } from "@/lib/stream";

function get<T>(payload: Record<string, unknown> | undefined, key: string): T {
  return (payload ?? {})[key] as T;
}

interface NegotiationStreamProps {
  participants: Participant[];
  stage: "destination" | "venue";
  chosenDestination?: { entityId: string; name: string };
  rejections: { entityId: string; entityName: string }[];
  onAccept: (entity: { entityId: string; name: string; affinity?: number }) => void;
  onReject: (entity: { entityId: string; entityName: string }) => void;
  onReset: () => void;
}

interface AgentState {
  thinking: boolean;
  verdict?: "approve" | "pushback";
  reasoning?: string;
  detail?: string;
}

interface ProposalState {
  entityId: string;
  name: string;
  affinity?: number;
  tags?: string[];
  reasoning: string;
}

type PhaseLabel =
  | "idle"
  | "resolving"
  | "negotiator"
  | "agents"
  | "revising"
  | "done"
  | "error";

export function NegotiationStream({
  participants,
  stage,
  chosenDestination,
  rejections,
  onAccept,
  onReject,
  onReset,
}: NegotiationStreamProps) {
  const [phase, setPhase] = useState<PhaseLabel>("idle");
  const [statusLine, setStatusLine] = useState("");
  const [anchorsResolved, setAnchorsResolved] = useState<{ participant: string; query: string; resolved: string }[]>([]);
  const [negotiator, setNegotiator] = useState<AgentState>({ thinking: false });
  const [advocate, setAdvocate] = useState<AgentState>({ thinking: false });
  const [skeptic, setSkeptic] = useState<AgentState>({ thinking: false });
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("resolving");
    setStatusLine("Resolving taste anchors…");
    setError(null);
    setProposal(null);
    setAccepted(false);
    setNegotiator({ thinking: false });
    setAdvocate({ thinking: false });
    setSkeptic({ thinking: false });
    setAnchorsResolved([]);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants,
          stage,
          state: { rounds: [], rejections, chosenDestination },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
            case "anchors_resolving": {
              const count = get<number>(event.payload, "count");
              setStatusLine(`Resolving ${count} taste anchor${count !== 1 ? "s" : ""}…`);
              break;
            }
            case "anchors_resolved":
              setAnchorsResolved(get<{ participant: string; query: string; resolved: string }[]>(event.payload, "anchors"));
              setPhase("negotiator");
              setStatusLine("Negotiator selecting…");
              break;
            case "negotiator_thinking":
              setNegotiator({ thinking: true });
              break;
            case "negotiator_proposed": {
              const entity = get<{ name: string; affinity?: number; tags?: string[] }>(event.payload, "entity");
              setNegotiator({ thinking: false });
              setProposal({
                entityId: get<string>(event.payload, "entityId"),
                name: entity.name,
                affinity: entity.affinity,
                tags: entity.tags,
                reasoning: get<string>(event.payload, "reasoning"),
              });
              setPhase("agents");
              setStatusLine("Advocate & Skeptic reviewing…");
              break;
            }
            case "advocate_thinking":
              setAdvocate({ thinking: true });
              break;
            case "skeptic_thinking":
              setSkeptic({ thinking: true });
              break;
            case "advocate_verdict":
              setAdvocate({
                thinking: false,
                verdict: get<"approve" | "pushback">(event.payload, "verdict"),
                reasoning: get<string>(event.payload, "reasoning"),
                detail: get<string | undefined>(event.payload, "underservedParticipant"),
              });
              break;
            case "skeptic_verdict":
              setSkeptic({
                thinking: false,
                verdict: get<"approve" | "pushback">(event.payload, "verdict"),
                reasoning: get<string>(event.payload, "reasoning"),
                detail: get<string | undefined>(event.payload, "failureMode"),
              });
              break;
            case "critique_revising":
              setPhase("revising");
              setStatusLine("Agents pushed back — revising…");
              setNegotiator({ thinking: false });
              setAdvocate({ thinking: false });
              setSkeptic({ thinking: false });
              break;
            case "round_complete":
              setPhase("done");
              setStatusLine("Ready");
              break;
            case "error":
              throw new Error(get<string>(event.payload, "message") ?? "Stream error");
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message ?? "Something went wrong");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (participants.length >= 1) run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = () => {
    if (!proposal) return;
    setAccepted(true);
    onAccept({ entityId: proposal.entityId, name: proposal.name, affinity: proposal.affinity });
  };

  const handleReject = () => {
    if (!proposal) return;
    onReject({ entityId: proposal.entityId, entityName: proposal.name });
    run();
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        {phase !== "idle" && phase !== "done" && phase !== "error" && (
          <span className="flex gap-0.5">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
          </span>
        )}
        <span>{statusLine}</span>
      </div>

      {/* Anchors resolved */}
      {anchorsResolved.length > 0 && (
        <div className="text-xs rounded-lg p-3 space-y-0.5" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
          {anchorsResolved.map((a, i) => (
            <div key={i}>
              <span style={{ color: "var(--text-primary)" }}>{a.participant}</span>: {a.query} → <span style={{ color: "var(--accent)" }}>{a.resolved}</span>
            </div>
          ))}
        </div>
      )}

      {/* Negotiator */}
      {(negotiator.thinking || proposal) && (
        <AgentVerdict
          agent="Negotiator"
          verdict={proposal ? "approve" : "approve"}
          reasoning={proposal?.reasoning ?? ""}
          thinking={negotiator.thinking}
        />
      )}

      {/* Proposal card */}
      {proposal && phase === "done" && !accepted && (
        <ProposalCard
          name={proposal.name}
          affinity={proposal.affinity ?? 0}
          reasoning={proposal.reasoning}
          tags={proposal.tags}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/* Advocate */}
      {(advocate.thinking || advocate.verdict) && (
        <AgentVerdict
          agent="Advocate"
          verdict={advocate.verdict ?? "approve"}
          reasoning={advocate.reasoning ?? ""}
          detail={advocate.detail}
          thinking={advocate.thinking}
        />
      )}

      {/* Skeptic */}
      {(skeptic.thinking || skeptic.verdict) && (
        <AgentVerdict
          agent="Skeptic"
          verdict={skeptic.verdict ?? "approve"}
          reasoning={skeptic.reasoning ?? ""}
          detail={skeptic.detail}
          thinking={skeptic.thinking}
        />
      )}

      {/* Accepted state */}
      {accepted && proposal && (
        <div className="stream-event rounded-xl border p-5 text-center" style={{ borderColor: "#16a34a44", background: "#16a34a11" }}>
          <p className="text-lg font-semibold mb-1" style={{ color: "#4ade80" }}>
            {proposal.name}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Accepted by the group ✓
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg p-4 text-sm" style={{ background: "#dc262211", border: "1px solid #dc262244", color: "#f87171" }}>
          {error}
          <button onClick={run} className="block mt-2 underline text-xs" style={{ color: "var(--accent)" }}>
            Retry
          </button>
        </div>
      )}

      {/* Controls */}
      {(phase === "done" || phase === "error") && !accepted && (
        <button
          onClick={run}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          Try a different suggestion
        </button>
      )}
    </div>
  );
}
