"use client";

import { useState } from "react";
import { SetupPanel } from "@/components/SetupPanel";
import { NegotiatePanel } from "@/components/NegotiatePanel";
import { DonePanel } from "@/components/DonePanel";
import type { Participant, RejectionRecord } from "@/lib/schema/state";

export type AppStage = "setup" | "destination" | "venue" | "done";

export interface AcceptedEntity {
  entityId: string;
  name: string;
  affinity?: number;
}

export default function Home() {
  const [stage, setStage] = useState<AppStage>("setup");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [destination, setDestination] = useState<AcceptedEntity | null>(null);
  const [venue, setVenue] = useState<AcceptedEntity | null>(null);
  const [negotiationKey, setNegotiationKey] = useState(0);

  const startNegotiation = (ps?: Participant[]) => {
    const group = ps ?? participants;
    if (ps) setParticipants(ps);
    setRejections([]);
    setDestination(null);
    setVenue(null);
    setNegotiationKey((k) => k + 1);
    if (group.length > 0) setStage("destination");
  };

  const handleDestinationAccept = (entity: AcceptedEntity) => {
    setDestination(entity);
    setRejections([]);
    setNegotiationKey((k) => k + 1);
    setStage("venue");
  };

  const handleVenueAccept = (entity: AcceptedEntity) => {
    setVenue(entity);
    setStage("done");
  };

  const handleReject = (entity: { entityId: string; entityName: string }) => {
    setRejections((prev) => [
      ...prev,
      { stage: stage as "destination" | "venue", entityId: entity.entityId, entityName: entity.entityName },
    ]);
    setNegotiationKey((k) => k + 1);
  };

  const reset = () => {
    setStage("setup");
    setParticipants([]);
    setRejections([]);
    setDestination(null);
    setVenue(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Top bar */}
      <header style={{
        height: 40,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: 20,
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg-base)",
      }}>
        <span
          onClick={reset}
          style={{ fontFamily: "var(--font-geist-mono)", fontSize: 18, fontWeight: 800, letterSpacing: "0.12em", cursor: "pointer", textTransform: "uppercase" }}
        >
          <span style={{ color: "#4F46E5" }}>Pal</span><span style={{ color: "#F97066" }}>at</span><span style={{ color: "#4F46E5" }}>able</span>
        </span>
        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.05em" }}>
          v0.1 · Qloo × Bedrock
        </span>
      </header>

      {/* Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {stage === "setup" && (
          <SetupPanel
            participants={participants}
            setParticipants={setParticipants}
            onStart={startNegotiation}
          />
        )}

        {(stage === "destination" || stage === "venue") && (
          <NegotiatePanel
            key={negotiationKey}
            participants={participants}
            stage={stage as "destination" | "venue"}
            chosenDestination={destination ?? undefined}
            rejections={rejections}
            onAccept={stage === "destination" ? handleDestinationAccept : handleVenueAccept}
            onReject={handleReject}
            onReset={reset}
          />
        )}

        {stage === "done" && destination && venue && (
          <DonePanel
            destination={destination}
            venue={venue}
            onRestart={() => startNegotiation()}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}
