export interface SourceFile {
  relPath: string;
  raw: string;
  mtimeMs?: number;
}
export interface Snapshot {
  files: SourceFile[];
  cancelledLog?: string;
  generatedAt: string;
  offline?: boolean;
  cachedAt?: string | null;
}
export interface Choice {
  id: string;
  text: string;
  constraint: string;
  provenance?: string;
}
/** A history record (scripts/pm/shared/history.mjs) — a receipt line, not a unique completed item. */
export interface Receipt {
  key: string;
  /** "" when the record states no date. */
  date: string;
  dateEnd: string | null;
  datePrecision: "day" | "range" | "unrecorded";
  dateNote: string | null;
  /** The bold lead in source spelling. */
  id: string | null;
  /** Set only when the lead names exactly one canonical ID. */
  workId: string | null;
  ids: string[];
  identity: "exact" | "referenced" | "unidentified";
  text: string;
  raw: string;
  campaign: string;
  file: string;
  line: number;
  status: string;
}
export interface Dependency {
  id: string;
  key?: string;
  campaign?: string;
  status: string;
  file?: string;
}
export interface Work {
  id: string;
  idChip: string | null;
  label: string;
  briefAnchor: string | null;
  key: string;
  title: string;
  text: string;
  module: string;
  file: string;
  cbidx: number;
  line: number;
  rawLine: string;
  section: string;
  state: string;
  effort: string | null;
  severity: string | null;
  outcome: string;
  contract: string;
  kind: string;
  blocked: boolean;
  dependencies: Dependency[];
  dependentIds: string[];
  relatedIds: string[];
  decisionIds: string[];
  topicIds: string[];
  topicEvidence: { id: string; evidence: string }[];
}
export interface Space {
  name: string;
  purpose: string;
  book: SourceFile | undefined;
  work: Work[];
  history: Receipt[];
}
export interface World {
  spaces: Space[];
  work: Work[];
  choices: Choice[];
  history: Receipt[];
  files: SourceFile[];
  sources?: SourceFile[];
  generatedAt: string;
  offline: boolean;
  cachedAt?: string | null;
}
export type Bucket = "now" | "next" | "waiting" | "later";
export interface RunItem {
  id?: string;
  text?: string;
  campaign?: string;
  pmFile?: string;
  cbidx?: number;
}
export interface Awaiting {
  gate: string;
  reason?: string;
  returnTo?: string;
  proposalReady?: boolean;
  questions?: { id?: string; text: string }[];
  scope?: {
    mismatch?: boolean;
    reason?: string;
    decomposition?: (string | { title?: string; outcome?: string })[];
  };
}
export interface Limits {
  maxUsd?: number | null;
  maxTokens?: number | null;
  warnPct?: number;
}
export interface Execution {
  provider?: string;
  model?: string;
  paused?: boolean;
  effort?: Record<string, string>;
}
export interface RunSummary {
  sessionId: string;
  item: RunItem;
  state: string;
  agent: string;
  awaiting?: Awaiting | null;
  execution?: Execution;
  runnerAlive?: boolean;
  updatedAt?: string;
  createdAt?: string;
  /** The session's running total as the V1 route reports it; costUsd is a provider estimate. */
  usageTotal?: {
    input?: number;
    output?: number;
    cachedRead?: number;
    cachedInput?: number;
    cacheCreation?: number;
    costUsd?: number | null;
    costEstUsd?: number | null;
  } | null;
}
export interface RunEvent {
  seq: number;
  type: string;
  phase?: string;
  ts?: string;
  at?: string;
  data?: Record<string, unknown>;
}
export interface Artifact {
  path: string;
  size: number;
  mtimeMs?: number;
}
export interface RunDetail {
  packet: {
    item: RunItem;
    agent: string;
    agentConfig?: { model?: string };
    budget?: Limits;
    lanePolicy?: { lane?: string; mergedDiscoveryPlan?: boolean };
    parentSession?: string;
  };
  state: {
    state: string;
    awaiting?: Awaiting | null;
    execution?: Execution;
    build?: { mode?: string; stepIndex?: number; totalSteps?: number };
    lastError?: { message?: string; phase?: string; resetsAt?: string };
    usage?: {
      total?: {
        input?: number;
        output?: number;
        cachedRead?: number;
        cachedInput?: number;
        cacheCreation?: number;
        costUsd?: number;
      };
    };
    workspace?: { changedFiles?: string[] };
    acceptance?: {
      id: string;
      text?: string;
      criterion?: string;
      status?: string;
    }[];
    budget?: { current?: Limits };
    forks?: string[];
  };
  runner: { alive: boolean; heartbeatAt?: string; logTail?: string };
  artifacts: Artifact[];
}
export interface Plan {
  riskFlags?: string[];
  steps?: {
    id: string;
    description?: string;
    title?: string;
    paths?: string[];
  }[];
}
export interface CheckReport {
  ok?: boolean;
  results?: Record<
    string,
    { ok?: boolean; skipped?: boolean; output?: string }
  >;
}
export interface Provider {
  models: { id: string; label?: string; tier?: string }[];
  defaultModel?: string;
  efforts?: string[];
  manifest?: { supportsAbort?: boolean };
}
export interface Capabilities {
  providers: Record<string, Provider>;
  config?: { budgets?: { laneDefaults?: Record<string, Limits> } };
}
export interface Preflight {
  preflightId: string;
  dirtyAtStart: boolean;
  changedFiles: string[];
  baselineValidation: {
    ok: boolean;
    results?: Record<string, { ok?: boolean }>;
  };
}
export interface Recommendation {
  recommendation?: {
    model: string;
    tier: string;
    estCostUsd?: number;
    estTokens: number;
    rationale: string[];
    effortByPhase?: Record<string, string>;
  };
  preview?: {
    item: { id?: string; text?: string; effort?: string; severity?: string };
    riskFlags: { name: string }[];
    recommendedLane: string;
    capabilities?: { name: string; reason?: string; why?: string }[];
    acceptanceCriteria?: { id: string; text: string }[];
    scopeHints?: {
      globs?: string[];
      keywords?: string[];
      modules?: string[];
      scopeSource?: string;
      locator?: {
        status?: string;
        confidence?: string;
        candidates?: { path: string; score?: number }[];
        hits?: { path: string }[];
      };
    };
    contextManifest?: { estimatedTokens?: number; entries?: unknown[] };
  };
}

// --- Delivery V2 projections (scripts/delivery-v2/journey.mjs) ---------------

export interface V2Session {
  paired: boolean;
  actor: string | null;
  csrf: string | null;
}
export interface V2Settings {
  executor: string | null;
  backend_id?: string | null;
  model: string | null;
  effort: string | null;
  work_profile?: string | null;
  qualification_ref?: string | null;
  history?: { backend_id: string; model: string | null; effort: string | null; until: string }[];
  recommendation?: {
    profile: string;
    reasons: string[];
    source: { words: number; risky: boolean; dependencyCount: number; scopeKnown: boolean };
    policy_revision: number;
    settings: { model: string | null; effort: string | null } | null;
    selected: { profile: string; model: string | null; effort: string | null };
    overridden: boolean;
  };
}
export interface V2RunSummary {
  run_id: string;
  engine: "v2";
  title: string;
  alias: string | null;
  file: string | null;
  campaign: string | null;
  lifecycle: string;
  closed_outcome: string | null;
  waiting_reason: string | null;
  executor: string | null;
  model: string | null;
  effort: string | null;
  stage: string;
  branch: string | null;
  active: boolean;
  ownerAction: string;
  ownerActionKind?: string;
  application?: { application_id: string; state: string } | null;
  coordination?: V2Coordination;
  /** Known usage in separate units; `unknown` counts readings with no amount. */
  resources?: {
    unit: string;
    settled: number;
    reserved: number;
    unknown: number;
    providerReportedUsd: number | null;
    measuredTokens: Record<string, number>;
  } | null;
  created_at: string;
  updated_at: string;
}
export interface V2Application {
  application_id: string;
  candidate_id: string;
  result_ref: string;
  state: string;
  revision: number;
  writes: number;
  ops: { path: string; kind: string; noop: boolean }[];
  conflicts: { path: string; kind: string; expected?: string | null; observed?: string | null }[];
  refusals: { code: string; path: string | null; detail: unknown }[];
  unrelatedDrift: string[];
  migrationPaths: string[];
  checks: {
    state: string;
    reason?: string;
    integrated_id?: string;
    generation?: string;
    evidence?: { criterion_id: string; state: string; reason: string | null }[];
  } | null;
  failed: { path: string; code: string } | null;
  rollback: { restored: string[]; deleted: string[]; recreated: string[]; foreign: { path: string }[] } | null;
  inspected: { applied: string[]; pending: string[]; foreign: { path: string }[] } | null;
  reassessment?: {
    state: string;
    generation?: string;
    reason?: string;
    evidence?: { criterion_id: string; state: string; reason: string | null }[];
  } | null;
  created_at: string;
  updated_at: string;
}
export interface V2Plan {
  plan_id: string;
  revision: number;
  status: string;
  malformed: boolean;
  body: {
    outcome: string | null;
    scope: string[];
    steps: { title: string }[];
    risks: string[];
    unknowns: string[];
    checks: string[];
    preparation?: { kind: "selected-item"; provenance: string; acceptance_fingerprint: string };
    acceptance?: string[];
    invariants?: string[];
    exclusions?: string[];
    questions: { text: string; blocking: boolean }[];
  };
  raw_text: string | null;
  digest: string;
  contract_revision: number;
  created_at: string;
}
export interface V2Question {
  question_id: string;
  plan_revision: number;
  stage: string;
  text: string;
  blocking: boolean;
  status: string;
  answer: string | null;
}
export interface V2Message {
  message_id: string;
  body: string;
  status: string;
  receipt: string;
  created_at: string;
  delivered_at: string | null;
}
export interface V2SettingCheck {
  state: string;
  requested: string | null;
  effective: string | null;
}
export interface V2Job {
  job_id: string;
  purpose: string;
  access: string;
  backend_id: string;
  status: string;
  outcome: string | null;
  dispatched: boolean;
  native_ref: string | null;
  stop: string | null;
  requested: { model: string | null; effort: string | null };
  effective: {
    model: string | null;
    effort: string | null;
    source: string | null;
    verification: { model: V2SettingCheck; effort: V2SettingCheck; mismatch: boolean; source: string | null } | null;
  } | null;
  /** `kind` says what the amount is: an admission-time estimate, not a live cap. */
  reservation: { unit: string; amount: number | null; open: boolean; kind?: string };
  /** Shared subscription-window readings bracketing the job; never per-job consumption. */
  subscription?: {
    before: SubscriptionObservation | null;
    after: SubscriptionObservation | null;
    comparison: { deltas: { id: string; before: number; after: number; delta_percent: number }[]; notes: string[]; basis: string };
  } | null;
  /** What the in-job token monitor observed for this job; null when no limit was in force. */
  budget?: V2Budget | null;
  reason: string | null;
  created_at: string;
}
/**
 * DLV-114. A count taken while the job ran, against the run's limit.
 *
 * `overshoot` is the part the crossing turn had already spent before the stop
 * could be asked for. It is reported, never netted off.
 */
export interface V2Budget {
  mode: string;
  unit: string;
  limit: number | null;
  warnAtPercent: number;
  banked: number;
  observed: number;
  used: number;
  percent: number | null;
  level: string;
  readings: number;
  warned: boolean;
  stopRequested: boolean;
  overshoot: number;
  basis: string;
  stopped?: boolean;
}
export interface SubscriptionObservation {
  status: string;
  observed_at: string;
  plan: string | null;
  windows: { id: string; used_percent: number; window_minutes: number | null; resets_at: string | null }[];
  error?: string | null;
}
export interface V2Agent {
  role: string;
  id: string | null;
  executor: string | null;
  model: string | null;
  lastAction: string | null;
  lastAt: string | null;
}
export interface V2Activity {
  job_id: string;
  at: string | null;
  kind: string;
  agent: { role: string; id?: string | null; executor?: string; model?: string | null };
  summary: string | null;
}
export interface V2Evidence {
  criterion_id: string;
  title?: string;
  criterion_revision: number;
  state: string;
  reason: string | null;
  label: string;
  counts: { selected: number | null; executed: number | null; skipped: number | null } | null;
  exitCode: number | null;
  runner: string | null;
  command: string[] | null;
  /**
   * The checker's bounded, redacted output (DLV-120), or — when nothing was
   * retained — the receipt's note explaining the evidence gap.
   */
  output: string;
  /** Which shape this execution was: runner-missing / output-unreadable / no-tests-selected / tests-failed / passed. */
  outcome?: string | null;
  outcomeDetail?: string | null;
  /** Where a typecheck verdict was produced (DLV-133); null for ordinary checks. */
  environment?: { producer: string; isolated: boolean; detail: string } | null;
  created_at: string;
}
export interface V2Result {
  result_id: string;
  result_version: number;
  candidateVerified: boolean;
  workComplete: boolean;
  observedDisposition: string;
  requestedDisposition: string;
  closed_outcome: string | null;
  remaining_obligations: { kind: string; detail: unknown }[];
  next_safe_action: string;
  projection_status: string;
  projection_reason: string | null;
}
export interface V2Resources {
  unit: string;
  settled: number;
  reserved: number;
  unknown: { job_id: string; reason: string }[];
  openReservations: number;
  provenance: {
    providerReportedUsd: number | null;
    /** Normalized: what these jobs spent, after a resumed thread's restatement is removed. */
    measuredTokens: Record<string, number>;
    /** What the provider's counters said, restatement included. Never the settled figure. */
    rawProviderTokens?: Record<string, number | string>;
    /** Whether every reading could be normalized, and what was flagged if not. */
    normalization?: {
      complete: boolean;
      legacyRows: number;
      flagged: { status: string; count: number; basis: string | null }[];
    };
    tokenNormalizationVersion?: string;
    reconciledBilled: number | null;
    subscriptionUsage: unknown;
    availableQuota: unknown;
  };
  allowance: number | null;
  strict: boolean;
  thresholdUsd: number | null;
  /** What the allowance is permitted to do: `advisory`, `threshold` or `hard-cap`. */
  enforcement?: string;
  warnAtPercent?: number | null;
  /** The most recent job's in-job observation, readable while a stream is open. */
  budget?: V2Budget | null;
}
export interface V2RunDetail {
  ok: true;
  truncated?: string[];
  engine: "v2";
  run: { run_id: string; lifecycle: string; closed_outcome: string | null; waiting_reason: string | null; created_at: string; updated_at: string };
  work: { title: string; alias: string | null; file: string | null; campaign: string | null };
  contract: { contract_id: string; revision: number; requestedDisposition: string };
  settings: V2Settings;
  stage: { stages: string[]; current: number; branch: string | null };
  plans: V2Plan[];
  questions: V2Question[];
  messages: V2Message[];
  jobs: V2Job[];
  agents: V2Agent[];
  activity: V2Activity[];
  candidate: { candidate_id: string; generation: string; changed: V2ChangedFile[]; refusals: { path: string; reason: string }[] } | null;
  candidates: { candidate_id: string; generation: string; changed: { path: string; kind: string }[]; created_at: string }[];
  applications?: V2Application[];
  evidence: V2Evidence[];
  result: V2Result | null;
  resources: V2Resources | null;
  ownerAction: { kind: string; label: string };
  coordination?: V2Coordination & { holding?: string[] };
  events: { seq: number; kind: string; at: string; data: unknown }[];
}
export interface V2ChangedFile {
  path: string;
  kind: string;
  review?: { state: string; reason?: string; diff?: string; beforeHash: string | null; afterHash: string | null };
}
// --- Parallel items (Command Center Phase 5, scripts/delivery-v2/coordination.mjs) ---
export type V2Verdict = "together" | "follow" | "scope";
export interface V2Reason {
  code: string;
  with: string | null;
  first?: string | null;
  paths?: string[];
  resources?: string[];
  unknown?: string[];
  used?: number;
  max?: number;
  refusals?: { code: string; detail: unknown }[];
}
export interface V2Coordination {
  state: string | null;
  verdict: V2Verdict | null;
  label: string | null;
  reasons: V2Reason[];
  since: string | null;
  grew: string[];
  released: boolean;
  sourceChanged: { by: string; paths: string[]; at: string } | null;
}
export interface V2QueueItem {
  run_id: string;
  alias: string | null;
  title: string;
  campaign: string | null;
  executor: string | null;
  model: string | null;
  effort: string | null;
}
export interface V2Pair {
  a: string;
  b: string;
  verdict: V2Verdict;
  label: string;
  reasons: V2Reason[];
}
export interface V2Queue {
  limits: { maxWriters: number; maxJobs: number; fleetAllowance: number | null; unit: string };
  writers: { used: number; max: number };
  jobs: { used: number; max: number };
  running: (V2QueueItem & { job_id: string | null; access: string; purpose: string; status: string; writer: boolean; nativeAgents: number })[];
  waiting: (V2QueueItem & V2Coordination)[];
  decisions: (V2QueueItem & { kind: string; label: string })[];
  candidates: (V2QueueItem & { sourceChanged: V2Coordination["sourceChanged"] })[];
  applying: (V2QueueItem & { application_id: string; state: string }) | null;
  pairs: V2Pair[];
  unknown: { jobs: { run_id: string; job_id: string }[]; reservationsWithoutAmount: number };
  nativeAgents: number;
}
export interface V2Assessment {
  ok: boolean;
  alias: string;
  verdict: V2Verdict;
  label: string;
  reasons: V2Reason[];
  startable: boolean;
  declared: string[] | null;
  recommendation?: {
    profile: string;
    reasons: string[];
    contract: { label: string; investigation: string; maxPlanJobs: number | null; maxImplementationJobs: number | null; repairDispatchLimit: number | null };
    source: { words: number; risky: boolean; dependencyCount: number; scopeKnown: boolean };
    settings: { model: string | null; effort: string | null } | null;
  };
}
export interface V2Executor {
  id: string;
  backend_id: string;
  label: string;
  summary: string;
  supportedEfforts: string[];
  available: boolean | null;
  permitted: boolean;
  qualified: boolean;
  refusals: { code: string; detail: unknown; action?: string }[];
  qualification: { ref: string | null; refusals: { code: string; detail: unknown }[] };
  models: { id: string; label: string | null; efforts: string[] | null }[];
  suggestions: Record<string, { model: string | null; effort: string | null; reason: string | null } | null>;
}
export interface V2Catalogue {
  executors: V2Executor[];
  policy: { policy_revision: number; runtime: { kind: string; image: string; network: string } | null; thresholdUsd: number | null } | null;
  refusals: { code: string; detail: unknown }[];
}

/** Owner allowance settings (GET /api/delivery/v2/allowances). */
export interface V2AllowanceRun {
  run_id: string;
  alias: string | null;
  title: string;
  campaign: string | null;
  lifecycle: string;
  running: boolean;
  base: number | null;
  extra: number;
  allowance: number | null;
  used: number;
  reserved: number;
}
export interface V2Allowances {
  ok: boolean;
  readable: boolean;
  error: string | null;
  unit: string;
  fleet: { limit: number | null; source: "settings" | "policy" | null; period: "day" | "reset"; since: string | null; policyLimit: number | null; used: number; reserved: number };
  task: { limit: number | null; policyLimit: number | null };
  runs: V2AllowanceRun[];
  history: { at: string; actor: string; action: string; detail: Record<string, unknown> | null; command_id: string | null }[];
}

/** Owner test gate (GET /api/delivery/v2/test-gate). */
export interface V2TestGate {
  locked: boolean;
  application: { application_id: string; run_id: string; state: string; at: string } | null;
  record: { result: "passed" | "failed"; proceed: boolean; at: string; note: string | null } | null;
}
