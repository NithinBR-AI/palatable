export const TABLES = {
  GROUPS: "palatable-groups",
  MESSAGES: "palatable-messages",
  ANCHORS: "palatable-anchors",
} as const;

// palatable-groups
// PK: groupId (String)
export interface GroupRecord {
  groupId: string;
  name: string;
  participants: string[]; // participant IDs
  createdAt: string;      // ISO timestamp
}

// palatable-messages
// PK: groupId (String), SK: sortKey = `${timestamp}#${messageId}` (String)
export interface MessageRecord {
  groupId: string;
  sortKey: string;        // `${timestamp}#${messageId}`
  participantId: string;
  participantName: string;
  text: string;
  timestamp: string;      // ISO timestamp
  processed: boolean;     // whether anchor extraction has run on this message
}

// palatable-anchors
// PK: participantId (String), SK: extractedAt (String ISO timestamp)
export type AnchorStatus = "active" | "deprecated" | "contradicted";

export interface AnchorRecord {
  participantId: string;
  extractedAt: string;    // ISO timestamp — sort key
  anchorText: string;     // raw extracted text e.g. "Tame Impala"
  entityId: string;       // Qloo entity ID (empty string if vibe-only)
  entityType: string;     // urn:entity:artist, urn:entity:place, etc. ("vibe" if no entity)
  vibeContext: string;    // freeform vibe that doesn't map to a Qloo entity (may be empty)
  confidence: number;     // 0–1, starts at 0.5, bumped on reinforcement, lowered on contradiction
  status: AnchorStatus;
  firstSeen: string;      // ISO timestamp
  lastSeen: string;       // ISO timestamp
  lastReinforced: string; // ISO timestamp
}
