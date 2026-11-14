export interface Change {
  hunks?: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
  }[];
  file: string;
  before?: string | null;
  after?: string | null;
  beforeFile?: string;
  added?: number | null;
  removed?: number | null;
}
export interface Skill {
  name: string;
  order?: number;
  via?: string;
  at?: string | null;
}
export interface Read {
  path: string;
  order?: number;
  beforeFirstEdit: boolean;
}
export interface Tool {
  id?: string;
  tool?: string;
  target?: string | null;
  order?: number;
  edit?: boolean;
  completed?: boolean;
  failed?: boolean | null;
  signals?: {
    productionWrite?: boolean;
    paidApi?: boolean;
    question?: boolean;
    approval?: boolean;
  };
}
export interface Session {
  arena?: {
    caseId: string;
    caseFingerprint: string;
    start: string;
    oracleHash: string;
    oracleVerdict: "pass" | "fail" | "unknown";
    isolation: "protected" | "unverified";
  };
  base?: string | null;
  head?: string | null;
  scorecard?: { cost?: { totalTokens?: number | null } };
  id: string;
  agent: string;
  source?: string;
  itemId?: string | null;
  tier?: string | null;
  effort?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  doneAt?: string | null;
  setup?: { fingerprint?: string | null } | null;
  coverage?: string;
  visibilityBug?: boolean;
  mobileEvidence?: { width: number };
  skills: Skill[];
  reads: Read[];
  timeline: Tool[];
  usage: Record<string, number | null>;
  turns: number | null;
  item?: { touches?: string[] | null };
  changeFacts?: Change[] | null;
}
export interface Check {
  schema?: string;
  id: string;
  name: string;
  source: string;
  exitCode: number | null;
  durationMs?: number | null;
  metrics?: Record<string, number | null> | null;
}
export interface Event {
  source?: string;
  blocked?: boolean;
}
export interface Rule {
  schema?: string;
  rule: string;
  version?: number;
  level?: string;
  verdict: string;
  added?: number;
  removed?: number;
  findings?: { message?: string }[];
}
export interface Record {
  session: Session;
  events: Event[];
  checks: Check[];
  verdicts: Rule[];
}
export interface Item {
  id?: string;
  touches?: string[] | null;
  module?: string | null;
  kind?: string | null;
  risk?: boolean | null;
  effort?: string | null;
  filedAt?: string | null;
  references?: string[];
}
export interface Uat {
  handover_id: string;
  revision: number;
  acceptance?: { state: string };
  stale?: boolean;
  scenarios?: { id: string; result?: string }[];
}
export interface Revert {
  itemId: string;
  commit: string;
  at: string;
}
