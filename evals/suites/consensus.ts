// Eval suite: does the multi-agent loop converge on a coherent, balanced proposal?
//
// Criteria checked per case:
//  1. At least one named anchor extracted per participant (no vibe-only signal)
//  2. Destination affinity >= minAffinity
//  3. Attribution balance: no single participant drives > 70% of anchor weight
//  4. At least one venue resolved (top venue affinity >= venueMinAffinity)
//  5. No error event emitted during the stream
//  6. Convergence within maxRounds critique rounds
//  7. Advocate and Skeptic both rendered a verdict
//  8. Venue city plausibly matches destination (spot-check by known city aliases)

import type { RawMessage } from "@/lib/extract/anchors";
import type { Participant } from "@/lib/schema/state";
import {
  WEEKENDWARRIORS_PARTICIPANTS,
  WEEKENDWARRIORS_MESSAGES,
  WEEKENDWARRIORS_TRIGGER,
  WEEKENDWARRIORS_ID,
} from "@/evals/fixtures/eval-weekendwarriors";
import {
  BOOKCLUB_PARTICIPANTS,
  BOOKCLUB_MESSAGES,
  BOOKCLUB_TRIGGER,
  BOOKCLUB_ID,
} from "@/evals/fixtures/eval-bookclub";

export interface AnchorCriteria {
  /** Every participant must have at least this many named anchors (non-vibe). */
  minNamedAnchorsPerParticipant: number;
  /** If true, allow a participant to have only vibe anchors without failing. */
  allowVibeOnly: boolean;
}

export interface AffinityCriteria {
  /** Qloo destination affinity of the winning entity (0–1). */
  minDestinationAffinity: number;
  /** Affinity of the top venue result (0–1). */
  minVenueAffinity: number;
}

export interface BalanceCriteria {
  /** No single participant's anchors should exceed this fraction of total anchor count. */
  maxSingleParticipantShare: number;
}

export interface ConvergenceCriteria {
  /** Loop must complete within this many Advocate+Skeptic rounds. */
  maxCritiqueRounds: number;
  /** Both Advocate and Skeptic must have rendered verdicts. */
  requireBothAgents: boolean;
}

export interface CityMatchCriteria {
  /**
   * Known aliases for the city this group should probably end up in.
   * Eval passes if the destination name OR any venue name contains one of these tokens.
   * Set to [] to skip the city-match check.
   */
  expectedCityAliases: string[];
}

export interface EvalCriteria {
  anchors: AnchorCriteria;
  affinity: AffinityCriteria;
  balance: BalanceCriteria;
  convergence: ConvergenceCriteria;
  cityMatch: CityMatchCriteria;
}

export interface EvalCase {
  id: string;
  description: string;
  participants: Participant[];
  messages: RawMessage[];
  trigger: RawMessage;
  /** Optional location hint passed to the negotiate API (same as UI does). */
  locationHint?: string;
  criteria: EvalCriteria;
}

const STRICT_CRITERIA: EvalCriteria = {
  anchors: {
    minNamedAnchorsPerParticipant: 1,
    allowVibeOnly: false,
  },
  affinity: {
    minDestinationAffinity: 0.60,
    minVenueAffinity: 0.55,
  },
  balance: {
    maxSingleParticipantShare: 0.70,
  },
  convergence: {
    maxCritiqueRounds: 2,
    requireBothAgents: true,
  },
  cityMatch: {
    expectedCityAliases: [],
  },
};

export const EVAL_CASES: EvalCase[] = [
  {
    id: WEEKENDWARRIORS_ID,
    description:
      "Weekend Warriors — 3 participants (Jordan, Maya, Kai) with strong cross-domain named anchors: " +
      "Daft Punk, Thundercat, Solange, Anthony Bourdain, Wes Anderson, craft beer. " +
      "Should converge on a city with nightlife, food culture, and contemporary arts.",
    participants: WEEKENDWARRIORS_PARTICIPANTS,
    messages: WEEKENDWARRIORS_MESSAGES,
    trigger: WEEKENDWARRIORS_TRIGGER,
    criteria: {
      ...STRICT_CRITERIA,
      affinity: {
        minDestinationAffinity: 0.60,
        minVenueAffinity: 0.50,
      },
      cityMatch: {
        // Expect a music/arts/food city — these are plausible targets given the taste profile
        expectedCityAliases: [],
      },
    },
  },
  {
    id: BOOKCLUB_ID,
    description:
      "Book Club — 4 participants (Priya, Tom, Aisha, Lena) with literary/cinematic/musical taste: " +
      "Murakami, Fela Kuti, Nick Cave, David Bowie, Tate Modern, Wong Kar-wai, Criterion Collection. " +
      "Should converge on a culturally dense city with bookshops, art, and interesting food.",
    participants: BOOKCLUB_PARTICIPANTS,
    messages: BOOKCLUB_MESSAGES,
    trigger: BOOKCLUB_TRIGGER,
    criteria: {
      ...STRICT_CRITERIA,
      anchors: {
        minNamedAnchorsPerParticipant: 1,
        allowVibeOnly: false,
      },
      affinity: {
        minDestinationAffinity: 0.58,
        minVenueAffinity: 0.50,
      },
      balance: {
        maxSingleParticipantShare: 0.60,
      },
      convergence: {
        maxCritiqueRounds: 2,
        requireBothAgents: true,
      },
      cityMatch: {
        expectedCityAliases: [],
      },
    },
  },
];
