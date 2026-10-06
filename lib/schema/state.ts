// Shared session state types: participants, taste profiles, rejection history, consensus score.

import type { QlooEntityType, InsightsResult } from "@/lib/qloo/client";

export interface TasteAnchor {
  /** What the person typed, e.g. "Radiohead". */
  query: string;
  type?: QlooEntityType;
  /** Resolved via searchEntity() once the session starts. */
  entityId?: string;
  entityName?: string;
}

export interface Participant {
  id: string;
  name: string;
  tasteAnchors: TasteAnchor[];
}

export type NegotiationStage = "destination" | "venue";

export interface Proposal {
  stage: NegotiationStage;
  entity: InsightsResult;
  /** Human-readable explanation generated from entity.explainability. */
  reasoning: string;
}

export interface RejectionRecord {
  stage: NegotiationStage;
  entityId: string;
  entityName: string;
}

export interface NegotiationRound {
  stage: NegotiationStage;
  proposal: Proposal;
  accepted: boolean;
}

export interface ConsensusState {
  participants: Participant[];
  rounds: NegotiationRound[];
  rejections: RejectionRecord[];
  /** Locked destination, needed to scope the venue-stage query. */
  chosenDestination?: InsightsResult;
  /** 0-1, derived from the current proposal's affinity score. Termination signal. */
  consensusScore?: number;
}
