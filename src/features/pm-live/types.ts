// src/features/pm-live/types.ts
// Shapes published by scripts/pm/bridge.mjs into `pm_live` — keep in sync with
// that file's buildTasksSnapshot / buildRollupsSnapshot / buildHistorySnapshot
// / buildSessionSnapshot / publishFleet.
//
// Six row kinds ride the same (id, kind, payload jsonb) table, so adding one
// never needs a migration. `id` is the stream key: "tasks" | "rollups" |
// "history" | "fleet" | "bridge" | "session:<sessionId>".

export type TaskSeverity = "blocker" | "friction" | "annoyance" | "parked" | null;
export type TaskLane = "Now" | "Next" | "Later";

export const LANES: readonly TaskLane[] = ["Now", "Next", "Later"] as const;
export const SEVERITIES = ["blocker", "friction", "annoyance", "parked"] as const;

export interface PmTask {
  idChip: string | null;
  text: string;
  severity: TaskSeverity;
  effort: string | null;
  state: "open" | "done";
  section: string;
  sectionRank: number;
  cbidx: number;
  file: string;
  module: string;
  textHash: string;
  lineText: string;
}

export interface TasksSnapshot {
  generatedAt: string;
  tasks: PmTask[];
}

// ---- rollups ---------------------------------------------------------------

/** Distributions count OPEN items only; `total`/`done` cover every item in a lane. */
export interface ChecklistRollup {
  total: number;
  done: number;
  open: number;
  byLane: Record<TaskLane, number>;
  bySeverity: Record<"blocker" | "friction" | "annoyance" | "parked" | "none", number>;
  byEffort: Record<"S" | "M" | "L" | "other", number>;
}

export interface CampaignRollup {
  campaign: string;
  prefix: string;
  checklist: ChecklistRollup;
  /** Emoji pain bullets in `1 - Feature State.md` — not every campaign uses them. */
  pain: Record<"blocker" | "friction" | "annoyance" | "parked", number>;
  updated: string | null;
  mtimeMs: number;
  lint: { errors: number; warnings: number };
}

export interface RollupsSnapshot {
  generatedAt: string;
  campaigns: CampaignRollup[];
  totals: {
    campaigns: number;
    total: number;
    done: number;
    open: number;
    blockers: number;
    painBlockers: number;
    lintErrors: number;
    lintWarnings: number;
  };
}

// ---- history ---------------------------------------------------------------

export interface Completion {
  date: string;
  campaign: string;
  idChip: string | null;
  text: string;
}

export interface CompletedDay {
  date: string;
  count: number;
  byCampaign: Record<string, number>;
}

export interface HistorySnapshot {
  generatedAt: string;
  completions: Completion[];
  completedByDay: CompletedDay[];
}

// ---- delivery --------------------------------------------------------------

export interface AwaitingQuestion {
  id?: string | null;
  text: string;
}

export interface DeliveryAwaiting {
  gate: "spec" | "plan" | "uat" | "question" | "blocked" | "budget" | "shipped" | null;
  reason?: string | null;
  returnTo?: string | null;
  /**
   * What the agent actually asked, when `gate === "question"`. The runner has
   * always written this and the bridge has always published `awaiting` verbatim —
   * it was dropped here, which is why the phone showed a reply box with no
   * question in it.
   */
  questions?: AwaitingQuestion[];
  /** Set when a budget pause suspended a phase gate; restored on an authorized raise. */
  priorAwaiting?: { gate?: string | null } | null;
}

export interface UsageTotal {
  input: number;
  cachedInput: number;
  output: number;
  /** Null when the provider reports tokens but does not expose a cost. */
  costUsd: number | null;
}

export interface BudgetEnvelope {
  maxUsd: number | null;
  maxTokens: number | null;
  warnPct: number;
  authorization: "capped" | "no-cap";
}

export interface DeliveryEvent {
  seq: number;
  type: string;
  phase?: string;
  data?: Record<string, unknown>;
  ts?: string;
}

export interface LedgerQuestion {
  id: string;
  text: string;
  kind: "blocking" | "advisory" | string | null;
  status: "open" | "answered" | "dismissed" | string | null;
  source: "agent" | "owner" | "runner" | string | null;
  phase: string | null;
  askedAt: string | null;
  answer: { text: string; at: string | null } | null;
}

export interface SessionQa {
  open: LedgerQuestion[];
  answered: LedgerQuestion[];
  dismissedCount: number;
  total: number;
}

export interface SessionTurn {
  turnId: string;
  phase: string | null;
  role: string | null;
  provider: string | null;
  model: string | null;
  effort: string | null;
  startedAt: string | null;
  durationMs: number | null;
  costUsd: number | null;
  result: string | null;
  records: number | null;
  /** Present only on the most recent turns — the rest carry metadata alone. */
  excerpt: string | null;
  excerptKind: "text" | "reasoning" | null;
}

export interface SessionArtifact {
  key: string;
  label: string;
  exists: boolean;
  bytes: number;
  excerpt: string | null;
  truncated: boolean;
}

export interface SessionCostDetail {
  byPhase: { key: string; costUsd: number; turns: number }[];
  byModel: { key: string; costUsd: number; turns: number }[];
  perTurn: { turnId: string; phase: string | null; costUsd: number }[];
  context: { occupancyTokens: number | null; windowTokens: number | null; pctUsed: number | null } | null;
}

export interface SessionSnapshot {
  sessionId: string;
  state: string;
  awaiting: DeliveryAwaiting | null;
  agent: "claude" | "codex";
  item: { text: string; id: string | null; campaign: string | null };
  usageTotal: UsageTotal | null;
  budgetCurrent: BudgetEnvelope | null;
  build: { mode: string; stepIndex: number; totalSteps: number } | null;
  lastError: { phase?: string; message: string } | null;
  updatedAt: string;
  runner: { alive: boolean; heartbeatAt: string | null };
  eventsTail: DeliveryEvent[];
  // ---- session detail. All optional: a laptop running an older bridge simply
  // publishes a row without them, and the detail view degrades to what it has.
  lane?: string | null;
  qa?: SessionQa | null;
  turnsTail?: SessionTurn[];
  turnsTotal?: number;
  artifacts?: SessionArtifact[];
  costDetail?: SessionCostDetail | null;
  /** Names of the things the size cap dropped, so the UI can say so out loud. */
  truncated?: string[];
}

export interface FleetSessionRow {
  sessionId: string;
  state: string;
  awaiting: DeliveryAwaiting | null;
  agent: "claude" | "codex";
  item: { text: string; id: string | null; campaign: string | null; pmFile: string; cbidx: number };
  updatedAt: string;
  usageTotal: UsageTotal | null;
  runnerAlive: boolean;
}

export interface SpendDay {
  date: string;
  costUsd: number;
  sessions: number;
}

/** Envelope prefills, shipped from scripts/delivery/config.mjs so the phone never hand-copies them. */
export interface LaneDefault {
  maxUsd: number;
  maxTokens: number;
  warnPct: number;
}

export interface FleetSnapshot {
  sessions: FleetSessionRow[];
  buildLockActive: boolean;
  totalSpendUsd: number;
  byState: Record<string, number>;
  generatedAt: string;
  /** Absent until the laptop runs a bridge new enough to publish them. */
  spendByDay?: SpendDay[];
  laneDefaults?: Record<"fast" | "standard" | "deep", LaneDefault>;
}

// ---- bridge ----------------------------------------------------------------

/** A journaled bridge write that can still be reverted (newest un-undone one), or null. */
export interface UndoableWrite {
  id: string;
  ts: string;
  label: string;
  file: string;
}

export interface BridgeHeartbeat {
  pid: number;
  startedAt: string;
  seenAt: string;
  undoable?: UndoableWrite | null;
}

// ---- commands --------------------------------------------------------------

export type CommandType =
  | "capture"
  | "undo"
  | "preflight"
  | "launch"
  | "pause"
  | "abort-turn"
  | "resume"
  | "cancel"
  | "answer"
  | "ask";

export interface CommandOutcome {
  ok: boolean;
  error?: string;
  result?: Record<string, unknown>;
}

export type SendCommand = (
  type: CommandType,
  payload: Record<string, unknown>,
  opts?: { timeoutMs?: number },
) => Promise<CommandOutcome>;
