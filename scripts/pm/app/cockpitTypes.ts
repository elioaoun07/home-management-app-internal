// Wire projections of the existing os/*@1 contracts, never another persistence model.
import type { Session, Record as FlightRecord } from "../../os/types";
import type {
  sessionScorecard,
  deliveryScorecard,
} from "../../os/scorecard.mjs";
export type Scorecard = ReturnType<typeof sessionScorecard>;
export type Flight = Omit<FlightRecord, "session"> & {
  session: Omit<Session, "scorecard" | "setup"> & {
    scorecard?: Scorecard;
    setup?: {
      fingerprint?: string;
      counts?: Record<string, number>;
      sources?: { path: string; sha256?: string; hash?: string }[];
    } | null;
    outcome?: string;
    intent?: string;
    runId?: string;
  };
};
export interface Entity {
  id: string;
  kind: string;
  name?: string;
  title?: string;
  source?: string;
  agent?: string;
  agents?: string[];
  entities?: string[];
  level?: string;
  baseline?: number;
  enforcedBy?: string[];
  retired?: boolean;
  definition?: unknown;
  moduleType?: string;
  paths?: string[];
  alias?: string;
  selector?: string;
  defaultEffort?: string | null;
  efforts?: string;
  disabled?: boolean;
  blocking?: boolean;
  conditional?: boolean;
  enforces?: string[] | string;
  fixtures?: string[];
  rule?: string;
  type?: string;
  review?: {
    required: boolean;
    reason: string;
    verify: string;
    source: string;
  };
}
export interface Setup {
  schema: string;
  fingerprint: string;
  generatedAt: string;
  entities: Entity[];
  relations: { type: string; from: string; to: string }[];
  sources: { path: string; hash?: string; sha256?: string }[];
}
export interface Cockpit {
  recorder?: { state: "recording" | "unavailable"; since: string | null };
  skillUsage?: {
    available: boolean;
    recordedSessions: number;
    skills: { name: string; lastUsed: string | null; sessions: number }[];
  };
  pending?: boolean;
  stale?: boolean;
  filed: { id: string; file: string; filedAt: string | null }[];
  setup: Setup | null;
  conflicts: {
    code: string;
    severity: string;
    source: string;
    related?: string;
    message: string;
    resolution?: string;
  }[];
  records: Flight[];
  deliveries: ReturnType<typeof deliveryScorecard>[];
  groups: {
    group: (string | boolean | null)[];
    n: number;
    statisticsEligible: boolean;
    raw: {
      id: string;
      itemId: string | null;
      rules: string;
      checks: string;
      process: string;
      setup: string | null;
    }[];
    rates: { clean: number | null; processComplete: number | null } | null;
    trend: {
      at: string;
      sessionId: string;
      n: number;
      rates: { clean: number | null; processComplete: number | null } | null;
    }[];
    medianTokensPerShippedItem: number | null;
    escapes: number | null;
  }[];
  warnings: string[];
}
