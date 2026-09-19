// The Command Center metric contract (Plans/Command Center.md Phase 6, PM Tooling R62).
//
// Pure derivations shared by the local app and the relay-mounted phone views. Each
// view keeps its own unit and never borrows another's denominator:
//   - open work        distinct open WorkRefs by campaign and priority; blocked is separate
//   - work outcomes    distinct exact IDs, completed and cancelled apart; other receipts
//                      stay "historical records"
//   - bugs             explicit `**Kind:** bug` only, grouped by severity
//   - sprint progress  unavailable until a planning file exists (R61)
//   - delivery         attempts (sessions/runs) with their outcome, and observed
//                      dispositions as reached levels — never work outcomes
//   - resources        known usage per executor and run, estimates, tokens and settled
//                      amounts in separate units, with coverage
import { normalizeWorkId } from "./work-id.mjs";
import { CANCELLED_LOG_FILE, parseHistory } from "./history.mjs";

export const PRIORITIES = ["Now", "Next", "Later"];
export const SEVERITIES = ["blocker", "friction", "annoyance", "parked", "none"];
export const HISTORY_CATEGORIES = ["completed", "cancelled", "historical"];
export const ATTEMPT_OUTCOMES = ["verified_candidate", "useful_partial", "accepted", "failed", "cancelled", "in_progress", "unrecorded"];
const V2_CLOSED = new Set(["verified_candidate", "useful_partial", "failed", "cancelled"]);

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const count = (value) => (finite(value) ? value : 0);
const workKey = (item) => (item.idChip ? normalizeWorkId(item.idChip) : item.key);
/** The Board's lane rule, so a drilldown to the Board shows the same rows. */
const laneOf = (item) => (PRIORITIES.includes(item.section) ? item.section : "Later");

// ---------------------------------------------------------------------------
// Open work
// ---------------------------------------------------------------------------

/**
 * @param {any[]} [work]
 * @param {{campaign?: string | null, order?: string[]}} [options]
 */
export function openWork(work = [], { campaign = null, order = [] } = {}) {
  const seen = new Map();
  /** @type {any[]} */
  const duplicates = [];
  for (const item of work) {
    if (item.state !== "open" || (campaign && item.module !== campaign)) continue;
    const key = workKey(item);
    if (seen.has(key)) duplicates.push(item);
    else seen.set(key, item);
  }
  const items = [...seen.values()];
  const names = [...new Set([...order.filter((name) => !campaign || name === campaign), ...items.map((item) => item.module)])];
  const rows = names.map((name) => {
    const own = items.filter((item) => item.module === name);
    return {
      campaign: name,
      lanes: Object.fromEntries(PRIORITIES.map((lane) => [lane, own.filter((item) => laneOf(item) === lane)])),
      total: own.length,
      blocked: own.filter((item) => item.blocked),
    };
  });
  return { total: items.length, items, rows, duplicates, blocked: items.filter((item) => item.blocked) };
}

// ---------------------------------------------------------------------------
// Work outcomes
// ---------------------------------------------------------------------------

/**
 * One outcome per exact ID: the latest dated receipt decides it, repeats are kept
 * as receipts, an ID that is open again is a conflict rather than a completion,
 * and a ticked-but-unswept row is a completion with no date.
 *
 * @param {{history?: any[], work?: any[]}} [world]
 * @param {{campaign?: string | null}} [options]
 */
export function workOutcomes({ history = [], work = [] } = {}, { campaign = null } = {}) {
  const records = history.filter((record) => !campaign || record.campaign === campaign);
  const open = new Set(work.filter((item) => item.state === "open" && item.idChip).map((item) => normalizeWorkId(item.idChip)));
  const groups = new Map();
  for (const record of records) {
    if (record.workId) groups.set(record.workId, [...(groups.get(record.workId) || []), record]);
  }
  /** @type {any[]} */
  const outcomes = [];
  /** @type {any[]} */
  const conflicts = [];
  for (const [workId, receipts] of groups) {
    const ordered = [...receipts].sort((a, b) => a.date.localeCompare(b.date));
    const current = ordered[ordered.length - 1];
    if (open.has(workId)) {
      conflicts.push({ workId, campaign: current.campaign, receipts: ordered, reason: "open" });
      continue;
    }
    outcomes.push({
      workId,
      campaign: current.campaign,
      status: current.status,
      date: current.date,
      dateEnd: current.dateEnd,
      datePrecision: current.datePrecision,
      source: "receipt",
      record: current,
      item: null,
      receipts: ordered,
      repeated: ordered.length - 1,
    });
  }
  const counted = new Set(groups.keys());
  for (const item of work) {
    if (item.state !== "done" || !item.idChip || (campaign && item.module !== campaign)) continue;
    const workId = normalizeWorkId(item.idChip);
    if (counted.has(workId)) continue;
    counted.add(workId);
    outcomes.push({ workId, campaign: item.module, status: "Shipped", date: "", dateEnd: null, datePrecision: "unrecorded", source: "checklist", record: null, item, receipts: [], repeated: 0 });
  }
  return {
    completed: outcomes.filter((outcome) => outcome.status === "Shipped"),
    cancelled: outcomes.filter((outcome) => outcome.status === "Cancelled"),
    historical: records.filter((record) => !record.workId),
    conflicts,
    records,
  };
}

const DAY_MS = 86400000;
const dayMs = (key) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Monday of a calendar date's week; date-only arithmetic, no time zone involved. */
export function weekOf(key) {
  const ms = dayMs(key);
  return dayKey(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS);
}

/** Today's calendar date where the owner is. */
export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** A week only when the record's stated date fits in one; otherwise undated. */
export function weekOfEntry(entry) {
  if (!entry.date || entry.datePrecision === "unrecorded") return null;
  const week = weekOf(entry.date);
  if (entry.datePrecision === "range" && (!entry.dateEnd || weekOf(entry.dateEnd) !== week)) return null;
  return week;
}

/**
 * Weekly buckets. For every category, buckets + undated + before + after equal
 * the total, so a chart always reconciles to its drilldown lists.
 *
 * @param {{completed:any[], cancelled:any[], historical:any[]}} outcomes
 * @param {{weeks?: number, today?: string}} options  weeks 0 = from the first dated record
 */
export function outcomeSeries(outcomes, { weeks = 12, today = localDayKey() } = {}) {
  const lists = { completed: outcomes.completed, cancelled: outcomes.cancelled, historical: outcomes.historical };
  const end = weekOf(today);
  const first = HISTORY_CATEGORIES.flatMap((category) => lists[category].map(weekOfEntry)).filter(Boolean).sort()[0];
  const start = weeks ? dayKey(dayMs(end) - (weeks - 1) * 7 * DAY_MS) : first && first < end ? first : end;
  /** @type {{week: string, completed: any[], cancelled: any[], historical: any[]}[]} */
  const buckets = [];
  for (let ms = dayMs(start); ms <= dayMs(end); ms += 7 * DAY_MS) buckets.push({ week: dayKey(ms), completed: [], cancelled: [], historical: [] });
  const index = new Map(buckets.map((bucket) => [bucket.week, bucket]));
  /** @returns {{completed: any[], cancelled: any[], historical: any[]}} */
  const empty = () => ({ completed: [], cancelled: [], historical: [] });
  const undated = empty();
  const before = empty();
  const after = empty();
  for (const category of HISTORY_CATEGORIES) {
    for (const entry of lists[category]) {
      const week = weekOfEntry(entry);
      if (!week) undated[category].push(entry);
      else if (week < start) before[category].push(entry);
      else if (week > end) after[category].push(entry);
      else index.get(week)[category].push(entry);
    }
  }
  const totals = Object.fromEntries(HISTORY_CATEGORIES.map((category) => [category, lists[category].length]));
  return { start, end, buckets, undated, before, after, totals };
}

// ---------------------------------------------------------------------------
// Bugs and sprints
// ---------------------------------------------------------------------------

/**
 * @param {any[]} [work]
 * @param {{campaign?: string | null}} [options]
 */
export function bugs(work = [], { campaign = null } = {}) {
  const open = openWork(work, { campaign }).items;
  const found = open.filter((item) => item.kind === "bug");
  return {
    total: found.length,
    open: open.length,
    declared: open.filter((item) => item.kind && item.kind !== "unclassified").length,
    rows: SEVERITIES.map((severity) => ({ severity, items: found.filter((item) => (item.severity || "none") === severity) })),
  };
}

/** Sprint scope needs committed planning facts; none exist before R61. */
/** @param {unknown} [planning] */
export function sprintProgress(planning = null) {
  return planning ? { available: false, reason: "unsupported-planning-schema" } : { available: false, reason: "no-planning-file" };
}

// ---------------------------------------------------------------------------
// Delivery attempts and resources
// ---------------------------------------------------------------------------

/** A V1 session state as an attempt outcome. V1 records no candidate or disposition. */
export function v1Outcome(state) {
  if (state === "SHIPPED") return "accepted";
  if (state === "CANCELLED") return "cancelled";
  if (state === "FAILED") return "failed";
  return "in_progress";
}

export function v2Outcome(run) {
  if (run.lifecycle !== "CLOSED") return "in_progress";
  return V2_CLOSED.has(run.closed_outcome) ? run.closed_outcome : "unrecorded";
}

/** Highest observed disposition; null while the run is open and nothing was applied. */
export function v2Disposition(run) {
  if (run.application?.state === "applied") return "applied_change";
  if (run.lifecycle !== "CLOSED") return null;
  return run.closed_outcome === "verified_candidate" ? "verified_candidate" : "none";
}

function v1Usage(total) {
  if (!total) return { estimatedUsd: null, tokens: null, settled: null, unknownReadings: null };
  const estimatedUsd = finite(total.costUsd) ? total.costUsd : finite(total.costEstUsd) ? total.costEstUsd : null;
  const measured = finite(total.input) || finite(total.output);
  return {
    estimatedUsd,
    tokens: measured ? { input: count(total.input), output: count(total.output), cache: count(total.cachedRead ?? total.cachedInput) + count(total.cacheCreation) } : null,
    settled: null,
    unknownReadings: null,
  };
}

function v2Usage(resources) {
  if (!resources) return { estimatedUsd: null, tokens: null, settled: null, unknownReadings: null };
  const tokens = resources.measuredTokens || {};
  return {
    estimatedUsd: finite(resources.providerReportedUsd) ? resources.providerReportedUsd : null,
    // V2's cache and reasoning fields are subsets of input/output.  Keep the
    // dashboard total aligned with the normalized resource authority.
    tokens: { input: count(tokens.input), output: count(tokens.output), cache: 0 },
    settled: resources.unit ? { unit: resources.unit, amount: count(resources.settled) } : null,
    unknownReadings: count(resources.unknown),
  };
}

/**
 * @param {{v1?: any[], v2?: any[]}} [runs]
 * @param {{campaign?: string | null}} [options]
 */
export function deliveryAttempts({ v1 = [], v2 = [] } = {}, { campaign = null } = {}) {
  const attempts = [
    ...v1.map((session) => ({
      engine: "v1",
      id: session.sessionId,
      workId: normalizeWorkId(session.item?.id),
      campaign: session.item?.campaign ?? null,
      title: session.item?.text || session.sessionId,
      executor: session.agent || null,
      state: session.state,
      outcome: v1Outcome(session.state),
      disposition: null,
      at: session.updatedAt || null,
      usage: v1Usage(session.usageTotal),
    })),
    ...v2.map((run) => ({
      engine: "v2",
      id: run.run_id,
      workId: normalizeWorkId(run.alias),
      campaign: run.campaign ?? null,
      title: run.title || run.run_id,
      executor: run.executor || null,
      state: run.lifecycle,
      outcome: v2Outcome(run),
      disposition: v2Disposition(run),
      at: run.updated_at || null,
      usage: v2Usage(run.resources),
    })),
  ]
    .filter((attempt) => !campaign || attempt.campaign === campaign)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const byEngine = (engine) => ATTEMPT_OUTCOMES.map((outcome) => ({ outcome, attempts: attempts.filter((attempt) => attempt.engine === engine && attempt.outcome === outcome) }));
  const v2Attempts = attempts.filter((attempt) => attempt.engine === "v2");
  return {
    attempts,
    total: attempts.length,
    v1: byEngine("v1"),
    v2: byEngine("v2"),
    // Reached levels, not slices: an applied change is also a verified candidate.
    dispositions: {
      verifiedCandidate: v2Attempts.filter((attempt) => attempt.disposition === "verified_candidate" || attempt.disposition === "applied_change"),
      appliedChange: v2Attempts.filter((attempt) => attempt.disposition === "applied_change"),
      verifiedDeployment: [],
      unrecorded: attempts.filter((attempt) => attempt.engine === "v1"),
    },
  };
}

/** @param {any[]} [attempts] */
export function resourceRows(attempts = []) {
  const rows = new Map();
  for (const attempt of attempts) {
    const key = `${attempt.engine}:${attempt.executor || "unknown"}`;
    const row = rows.get(key) || {
      key,
      engine: attempt.engine,
      executor: attempt.executor,
      runs: [],
      estimatedUsd: { sum: 0, known: 0 },
      tokens: { input: 0, output: 0, cache: 0, known: 0 },
      settled: {},
      unknownReadings: 0,
    };
    row.runs.push(attempt);
    if (attempt.usage.estimatedUsd != null) {
      row.estimatedUsd.sum += attempt.usage.estimatedUsd;
      row.estimatedUsd.known += 1;
    }
    if (attempt.usage.tokens) {
      row.tokens.input += attempt.usage.tokens.input;
      row.tokens.output += attempt.usage.tokens.output;
      row.tokens.cache += attempt.usage.tokens.cache;
      row.tokens.known += 1;
    }
    if (attempt.usage.settled) row.settled[attempt.usage.settled.unit] = (row.settled[attempt.usage.settled.unit] || 0) + attempt.usage.settled.amount;
    row.unknownReadings += attempt.usage.unknownReadings || 0;
    rows.set(key, row);
  }
  return [...rows.values()];
}

// ---------------------------------------------------------------------------
// History coverage
// ---------------------------------------------------------------------------

/**
 * @param {{spaces?: any[], sources?: any[]}} [world]
 * @param {{campaign?: string | null}} [options]
 */
export function historyCoverage({ spaces = [], sources = [] } = {}, { campaign = null } = {}) {
  const cancelledRaw = sources.find((source) => source.relPath === CANCELLED_LOG_FILE)?.raw ?? null;
  const none = { records: [], notes: [], found: false };
  return spaces
    .filter((space) => !campaign || space.name === campaign)
    .map((space) => {
      const shipped = space.book ? parseHistory(space.book.raw, { campaign: space.name, file: space.book.relPath }) : none;
      const cancelled = cancelledRaw == null ? none : parseHistory(cancelledRaw, { campaign: space.name, file: CANCELLED_LOG_FILE, status: "Cancelled" });
      const records = [...shipped.records, ...cancelled.records];
      const dated = records.map((record) => record.date).filter(Boolean).sort();
      const by = (field, value) => records.filter((record) => record[field] === value).length;
      return {
        campaign: space.name,
        logFound: shipped.found,
        records: records.length,
        exact: by("identity", "exact"),
        referenced: by("identity", "referenced"),
        unidentified: by("identity", "unidentified"),
        day: by("datePrecision", "day"),
        range: by("datePrecision", "range"),
        unrecorded: by("datePrecision", "unrecorded"),
        earliest: dated[0] || null,
        latest: dated[dated.length - 1] || null,
        notes: [...shipped.notes, ...cancelled.notes],
      };
    });
}
