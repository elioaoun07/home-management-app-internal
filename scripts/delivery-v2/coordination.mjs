// scripts/delivery-v2/coordination.mjs
// Command Center Phase 5 — which candidates may write at the same time (DLV-106).
//
// Rules over recorded facts, not a scheduler, a paid planner or a debate between
// agents. Every admission gets one of three answers, each with its reasons:
//
//   Can run together   no rule found a conflict between two known scopes
//   Must follow        a named item, path, contract or resource has to finish first
//   Needs scope check  something that would decide it is not known
//
// Facts come from two places. Declared: the item's `Depends on` and `Touches` lines
// and a HELD title (scripts/pm/shared/declarations.mjs). Observed: the approved
// plan's scope and every frozen candidate's changed paths. Missing scope is unknown,
// never proof of independence. Fleet limits count every job that may still be
// running — reserved, active, paused, unknown, or stopped without an observed stop —
// so an unreconciled job keeps its slot.
//
// Nothing here writes. journey.mjs evaluates these rules inside the admission
// transaction and again under the dispatch claim. One writer per candidate: native
// subagents run inside their parent's job and scratch, so they never take a writer
// slot, and their usage is kept unknown unless it is known.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";

import { deepFreeze, normalizePath } from "./contracts.mjs";
import { evaluateResources, resourceSummary } from "./jobs.mjs";
import { fileTasks } from "../pm/shared/tasks.mjs";
import { idSection, normalizeWorkId, workIds } from "../pm/shared/work-id.mjs";
import { declaredPath, declaredTouches, dependencyIds, isHeld } from "../pm/shared/declarations.mjs";

export const VERDICTS = Object.freeze({ TOGETHER: "together", FOLLOW: "follow", SCOPE: "scope" });

export const VERDICT_LABELS = Object.freeze({
  together: "Can run together",
  follow: "Must follow",
  scope: "Needs scope check",
});

/** Why two items, or an item and the fleet, cannot proceed together. UI labels live in v2model.ts. */
export const REASONS = Object.freeze({
  SAME_ITEM: "same-item",
  HELD: "held",
  DEPENDENCY_OPEN: "dependency-open",
  DEPENDENCY_CANCELLED: "dependency-cancelled",
  DEPENDENCY_UNRESOLVED: "dependency-unresolved",
  PATH: "path-overlap",
  CONTRACT: "shared-contract",
  SCHEMA: "shared-schema",
  LOCKFILE: "lockfile",
  GENERATED: "generated-output",
  CHECK_RESOURCE: "check-resource",
  SCOPE_UNKNOWN: "scope-unknown",
  SOURCE_MOVED: "source-moved",
  WRITERS: "writer-slots-full",
  JOBS: "job-slots-full",
  FLEET: "fleet-resources",
});

const FOLLOW_REASONS = new Set([
  REASONS.SAME_ITEM,
  REASONS.HELD,
  REASONS.DEPENDENCY_OPEN,
  REASONS.PATH,
  REASONS.CONTRACT,
  REASONS.SCHEMA,
  REASONS.LOCKFILE,
  REASONS.GENERATED,
  REASONS.CHECK_RESOURCE,
]);
const SCOPE_REASONS = new Set([REASONS.DEPENDENCY_CANCELLED, REASONS.DEPENDENCY_UNRESOLVED, REASONS.SCOPE_UNKNOWN, REASONS.SOURCE_MOVED]);
const CAPACITY_REASONS = new Set([REASONS.WRITERS, REASONS.JOBS, REASONS.FLEET]);

/**
 * Admission refusals. A run refused only with the first three waits in the queue and
 * is admitted when they clear; `source-moved` needs a new run on current source.
 */
export const COORDINATION_REFUSALS = Object.freeze({
  FOLLOW: "must-follow",
  SCOPE: "needs-scope-check",
  CAPACITY: "fleet-capacity",
  SOURCE_MOVED: "source-moved",
});

const QUEUEABLE = new Set([COORDINATION_REFUSALS.FOLLOW, COORDINATION_REFUSALS.SCOPE, COORDINATION_REFUSALS.CAPACITY]);

/** Every refusal is one the queue can wait out. */
export const isQueueable = (refusals) => Array.isArray(refusals) && refusals.length > 0 && refusals.every((entry) => entry && QUEUEABLE.has(entry.code));

/** The plan's initial ceiling. Raising it is a code change backed by recorded evidence, not a policy edit. */
export const WRITER_CEILING = 2;

export const DEFAULT_CONCURRENCY = deepFreeze({
  maxWriters: 2,
  maxJobs: 3,
  fleetAllowance: null,
  sharedPaths: [],
  schemaPaths: [],
  lockfiles: [],
  generated: [],
  checkResources: {},
});

/**
 * Conservative built-in classes. A policy may add to each (`concurrency.*`); nothing
 * removes one. Shared contracts follow the repository rule that shared code lives in
 * src/components, src/lib and src/types.
 */
export const BUILTIN_RULES = deepFreeze({
  sharedPaths: ["src/types", "src/lib", "src/components", "src/contexts", "src/hooks", "scripts/pm/shared"],
  schemaPaths: ["migrations"],
  lockfiles: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package-lock.json", "yarn.lock"],
  generated: [
    "public/atlas/atlas.json",
    "public/pm.html",
    "ERA Notes/10 - Project Management/_dashboard.html",
    "AGENTS.md",
    "CODEX.md",
    ".github/copilot-instructions.md",
  ],
});

export const OUTSTANDING_JOB_STATUSES = Object.freeze(["reserved", "active", "paused", "unknown"]);

/** A job that may still be running: outstanding, or asked to stop without an observed stop. */
export const possiblyRunning = (job) =>
  OUTSTANDING_JOB_STATUSES.includes(String(job.status)) || Boolean(job.stop_requested_at && !job.stop_observed_at);

const unique = (values) => [...new Set(values)].sort();
const clean = (value) => normalizePath(String(value || "")).replace(/^\.\//u, "").replace(/\/\*\*$/u, "").replace(/\/+$/u, "");
const folded = (value) => clean(value).toLowerCase();

/** Segment containment, case-folded: the destination refuses names differing only by case. */
export function within(path, prefix) {
  const a = folded(path);
  const b = folded(prefix);
  return b !== "" && (a === b || a.startsWith(b + "/"));
}

export const overlaps = (a, b) => within(a, b) || within(b, a);

const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/iu;
const moduleKey = (path) => folded(path).replace(CODE_FILE, "").replace(/\/index$/u, "");
const sameModule = (a, b) => {
  const x = moduleKey(a);
  const y = moduleKey(b);
  return x !== "" && y !== "" && (x === y || x.startsWith(y + "/") || y.startsWith(x + "/"));
};

// ---------------------------------------------------------------------------
// Rules and facts
// ---------------------------------------------------------------------------

/**
 * The built-in classes with a policy's additions.
 *
 * @param {{sharedPaths?:readonly string[], schemaPaths?:readonly string[], lockfiles?:readonly string[],
 *   generated?:readonly string[], checkResources?:Record<string, string[]>}} [concurrency]
 */
export function coordinationRules(concurrency = DEFAULT_CONCURRENCY) {
  const merge = (builtin, extra) => unique([...builtin, ...(extra || [])].map(clean).filter(Boolean));
  return deepFreeze({
    sharedPaths: merge(BUILTIN_RULES.sharedPaths, concurrency.sharedPaths),
    schemaPaths: merge(BUILTIN_RULES.schemaPaths, concurrency.schemaPaths),
    lockfiles: merge(BUILTIN_RULES.lockfiles, concurrency.lockfiles),
    generated: merge(BUILTIN_RULES.generated, concurrency.generated),
    checkResources: { ...(concurrency.checkResources || {}) },
  });
}

/** Exclusive check resources (ports, databases) used by a contract's criteria, per the policy's check specs. */
export function checkResourcesFor({ criteria = [], criteriaRefs = [], rules }) {
  const specs = criteria
    .filter((criterion) => criteriaRefs.some((ref) => ref.criterion_id === criterion.criterion_id && ref.revision === criterion.revision))
    .map((criterion) => criterion.observer && criterion.observer.expected && criterion.observer.expected.spec_id)
    .filter(Boolean);
  return unique(specs.flatMap((id) => rules.checkResources[String(id)] || []));
}

/**
 * What an item is known to touch. `declared` null means the item declared nothing;
 * plan and observed paths are claims and observations respectively. Unsafe paths
 * (absolute, `..`) are dropped, never followed.
 *
 * @param {{declared?:(string[]|null), plan?:string[], observed?:string[]}} [input]
 */
export function makeFootprint({ declared = null, plan = [], observed = [] } = {}) {
  const list = (values) => unique((values || []).map(declaredPath).filter(Boolean));
  const declaredList = declared == null ? null : list(declared);
  const planList = list(plan);
  const observedList = list(observed);
  return deepFreeze({
    known: declaredList !== null || planList.length > 0 || observedList.length > 0,
    declared: declaredList,
    plan: planList,
    observed: observedList,
    paths: list([...(declaredList || []), ...planList, ...observedList]),
  });
}

/** Observed paths outside what was declared or approved: scope the writer discovered. */
export function scopeGrowth(footprint) {
  const reserved = [...(footprint.declared || []), ...footprint.plan];
  return footprint.observed.filter((path) => !reserved.some((entry) => within(path, entry)));
}

export function classify(paths, rules) {
  const touching = (roots) => paths.filter((path) => roots.some((root) => overlaps(path, root)));
  return deepFreeze({
    shared: touching(rules.sharedPaths),
    schema: touching(rules.schemaPaths),
    lockfiles: touching(rules.lockfiles),
    generated: rules.generated.filter((output) => paths.some((path) => overlaps(path, output))),
  });
}

/**
 * Declared facts for one checklist item, read from its title and Master Book section.
 *
 * @param {{alias:(string|null), title?:string, bookRaw?:(string|null)}} input
 */
export function itemFacts({ alias, title = "", bookRaw = null }) {
  const key = normalizeWorkId(alias);
  const section = key ? idSection(bookRaw || "", key) : null;
  const contract = section ? section.body.split(/\*\*Provenance:\*\*/u)[0] : "";
  return deepFreeze({
    key,
    alias: alias || null,
    title: String(title || ""),
    held: isHeld(title),
    dependencyIds: dependencyIds(contract, title).filter((id) => id !== key),
    declared: declaredTouches(contract),
  });
}

// ---------------------------------------------------------------------------
// Backlog: whether a prerequisite is open, completed or cancelled
// ---------------------------------------------------------------------------

const RECEIPT_LINE = /^\s*-\s*[✅❌]\s*\d{4}-\d{2}-\d{2}\s*[—–-]\s*\*\*([^*]+)\*\*/u;

function sectionLines(raw, heading) {
  const lines = String(raw || "").split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${heading}\\s*$`, "u").test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^##\s/u.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
}

// ID-only receipt reading. The shared dated-history parser is PM Tooling R62's.
const receiptIds = (lines) =>
  lines
    .flatMap((line) => {
      const match = line.match(RECEIPT_LINE);
      if (!match) return [];
      const ids = workIds(match[1]);
      return [ids.length ? ids[0] : normalizeWorkId(match[1])];
    })
    .filter(Boolean);

/**
 * Read the canonical backlog for prerequisite states: unchecked rows are open,
 * checked rows and Shipped Log receipts are completed, Cancelled Log receipts are
 * cancelled. An unchecked row wins over an older receipt.
 *
 * @param {{root:string, pmRel:string, readText?:(path:string)=>(string|null), listDirs?:(path:string)=>string[]}} input
 */
export function readBacklog({ root, pmRel, readText = null, listDirs = null }) {
  const read =
    readText ||
    ((path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    });
  const dirs =
    listDirs ||
    ((path) => {
      try {
        return readdirSync(path, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
      } catch {
        return [];
      }
    });
  const pmRoot = join(root, pmRel);
  const open = new Set();
  const completed = new Set();
  const cancelled = new Set();
  for (const name of dirs(pmRoot)) {
    if (/^[_.]/u.test(name)) continue;
    const checklist = read(join(pmRoot, name, "4 - Checklist.md"));
    if (checklist == null) continue;
    for (const task of fileTasks(checklist)) {
      if (!task.idChip) continue;
      if (task.state === "done") completed.add(task.idChip);
      else open.add(task.idChip);
    }
    for (const id of receiptIds(sectionLines(read(join(pmRoot, name, name + " — Master Book.md")), "Shipped Log"))) completed.add(id);
  }
  for (const id of receiptIds(String(read(join(pmRoot, "_Archive", "Cancelled Log.md")) || "").split(/\r?\n/))) cancelled.add(id);
  return deepFreeze({ open, completed, cancelled });
}

export function dependencyState(id, backlog) {
  const key = normalizeWorkId(id);
  if (backlog.open.has(key)) return "open";
  if (backlog.completed.has(key)) return "completed";
  if (backlog.cancelled.has(key)) return "cancelled";
  return "unresolved";
}

/** Held items and unmet prerequisites. A cancelled or unresolved prerequisite is not satisfied. */
export function itemReasons({ facts, backlog }) {
  const reasons = [];
  if (facts.held) reasons.push({ code: REASONS.HELD, with: null });
  for (const id of facts.dependencyIds) {
    const state = dependencyState(id, backlog);
    if (state === "completed") continue;
    reasons.push({
      code: state === "open" ? REASONS.DEPENDENCY_OPEN : state === "cancelled" ? REASONS.DEPENDENCY_CANCELLED : REASONS.DEPENDENCY_UNRESOLVED,
      with: id,
    });
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// Shared contracts: who imports what
// ---------------------------------------------------------------------------

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])([^"'\r\n]+)\1/gmu;
const RESOLVE_SUFFIXES = Object.freeze(["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js", "/index.mjs"]);

/**
 * Repo-relative modules a file imports through `@/` or a relative specifier. Packages are ignored.
 *
 * @param {{path:string, text:(string|null), exists?:(path:string)=>boolean}} input
 */
export function importTargets({ path, text, exists = () => false }) {
  const targets = new Set();
  for (const match of String(text || "").matchAll(SPECIFIER)) {
    const spec = match[2];
    let base;
    if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
    else if (spec.startsWith("./") || spec.startsWith("../")) base = posix.normalize(posix.join(posix.dirname(clean(path)), spec));
    else continue;
    base = clean(base);
    if (!base || base.startsWith("..")) continue;
    targets.add(RESOLVE_SUFFIXES.map((suffix) => base + suffix).find((candidate) => exists(candidate)) || base);
  }
  return unique([...targets]);
}

const SKIPPED_DIRS = new Set(["node_modules", ".git", ".next", ".delivery", ".pm", "dist", "build", "coverage"]);

/** Read-only file access under one root, for the rules. */
export function filesUnder(root) {
  const abs = (rel) => join(root, ...clean(rel).split("/"));
  return {
    readText(rel) {
      try {
        return readFileSync(abs(rel), "utf8");
      } catch {
        return null;
      }
    },
    exists(rel) {
      try {
        return statSync(abs(rel)).isFile();
      } catch {
        return false;
      }
    },
    listFiles(rel, limit) {
      const found = [];
      const walk = (dir) => {
        if (found.length >= limit) return;
        let entries;
        try {
          entries = readdirSync(abs(dir), { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (found.length >= limit) return;
          if (entry.isSymbolicLink() || SKIPPED_DIRS.has(entry.name)) continue;
          const child = dir ? dir + "/" + entry.name : entry.name;
          if (entry.isDirectory()) walk(child);
          else if (entry.isFile()) found.push(child);
        }
      };
      walk(clean(rel));
      return found;
    },
  };
}

/**
 * Modules an item's code imports: static specifiers in the files of its footprint,
 * directories walked up to `limit` files. Static imports only; the integrated check
 * on the combined source stays the backstop for anything this cannot see.
 */
export function consumedPaths({ paths, readers, limit = 400 }) {
  const files = [];
  const seen = new Set();
  const add = (file) => {
    if (seen.has(file) || files.length >= limit) return;
    seen.add(file);
    files.push(file);
  };
  for (const path of paths) {
    if (files.length >= limit) break;
    if (CODE_FILE.test(path)) add(path);
    for (const reader of readers) for (const file of reader.listFiles(path, limit - files.length)) if (CODE_FILE.test(file)) add(file);
  }
  const text = (file) => readers.map((reader) => reader.readText(file)).find((value) => value != null) ?? null;
  const exists = (file) => readers.some((reader) => reader.exists(file));
  return deepFreeze({
    paths: unique(files.flatMap((file) => importTargets({ path: file, text: text(file), exists }))),
    scanned: files.length,
    capped: files.length >= limit,
  });
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export function verdictOf(reasons) {
  if (reasons.some((reason) => FOLLOW_REASONS.has(reason.code))) return VERDICTS.FOLLOW;
  if (reasons.some((reason) => SCOPE_REASONS.has(reason.code))) return VERDICTS.SCOPE;
  return VERDICTS.TOGETHER;
}

const dedupe = (reasons) => {
  const seen = new Set();
  return reasons.filter((reason) => {
    const key = JSON.stringify([reason.code, normalizeWorkId(reason.with), reason.paths ?? null, reason.resources ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * One pair: `a` is the item asking, `b` an item holding or seeking a reservation.
 * Each side: {key, alias, footprint, consumes, dependencyIds, checkResources}.
 */
export function relate(a, b, rules) {
  const reasons = [];
  const push = (code, extra = {}) => reasons.push({ code, with: b.alias, ...extra });
  if (a.key && a.key === b.key) push(REASONS.SAME_ITEM);
  if (b.key && (a.dependencyIds || []).includes(b.key)) push(REASONS.DEPENDENCY_OPEN, { first: b.alias });
  if (a.key && (b.dependencyIds || []).includes(a.key)) push(REASONS.DEPENDENCY_OPEN, { first: a.alias });
  const resources = (a.checkResources || []).filter((entry) => (b.checkResources || []).includes(entry));
  if (resources.length) push(REASONS.CHECK_RESOURCE, { resources });
  if (!a.footprint.known || !b.footprint.known) {
    push(REASONS.SCOPE_UNKNOWN, { unknown: [a, b].filter((side) => !side.footprint.known).map((side) => side.alias) });
  } else {
    const overlap = unique(
      a.footprint.paths.flatMap((path) => b.footprint.paths.filter((other) => overlaps(path, other)).map((other) => (within(path, other) ? path : other))),
    );
    if (overlap.length) push(REASONS.PATH, { paths: overlap });
    const beyond = (paths) => paths.filter((path) => !overlap.some((entry) => overlaps(entry, path)));
    const ca = classify(a.footprint.paths, rules);
    const cb = classify(b.footprint.paths, rules);
    if (ca.schema.length && cb.schema.length) {
      const paths = beyond(unique([...ca.schema, ...cb.schema]));
      if (paths.length) push(REASONS.SCHEMA, { paths });
    }
    if (ca.lockfiles.length && cb.lockfiles.length) {
      const paths = beyond(unique([...ca.lockfiles, ...cb.lockfiles]));
      if (paths.length) push(REASONS.LOCKFILE, { paths });
    }
    const generated = beyond(ca.generated.filter((output) => cb.generated.includes(output)));
    if (generated.length) push(REASONS.GENERATED, { paths: generated });
    const consumed = beyond(
      unique([
        ...ca.shared.filter((path) => (b.consumes || []).some((entry) => sameModule(entry, path))),
        ...cb.shared.filter((path) => (a.consumes || []).some((entry) => sameModule(entry, path))),
      ]),
    );
    if (consumed.length) push(REASONS.CONTRACT, { paths: consumed });
  }
  const verdict = verdictOf(reasons);
  return deepFreeze({ a: a.alias, b: b.alias, verdict, label: VERDICT_LABELS[verdict], reasons });
}

/**
 * The fleet as the store records it. Writers are runs with a write job that may
 * still be running, or inside their approved check/repair loop. Every possibly
 * running job holds a job slot, whatever its purpose. `since` limits settled usage
 * to the owner's allowance window (allowances.mjs).
 *
 * @param {{store:any, unit:string, since?:(string|null)}} input
 */
export function fleetOf({ store, unit, since = null }) {
  const runs = store.listRuns();
  const jobs = store.listAllJobs();
  const running = jobs.filter(possiblyRunning);
  const writers = runs
    .filter((run) => {
      const writes = jobs.filter((job) => String(job.run_id) === String(run.run_id) && job.access === "write");
      if (writes.some(possiblyRunning)) return true;
      return run.lifecycle === "ACTIVE" && writes.length > 0 && ["checking", "repairing"].includes(String(run.waiting_reason));
    })
    .map((run) => String(run.run_id));
  const summary = resourceSummary(store, { unit, jobs, since });
  const live = new Set(jobs.filter((job) => job.reservation_open || possiblyRunning(job)).map((job) => String(job.job_id)));
  const subagents = {};
  for (const row of store.listSubagentActivity()) {
    let agent;
    try {
      agent = JSON.parse(String(row.agent_json));
    } catch {
      continue;
    }
    const key = String(row.job_id);
    subagents[key] = unique([...(subagents[key] || []), String(agent.id || "subagent")]);
  }
  // A finished job whose reservation was settled or released is not an obstacle.
  const unknown = summary.unknown.filter((entry) => live.has(String(entry.job_id)));
  for (const [job_id, ids] of Object.entries(subagents)) {
    if (!live.has(job_id)) continue;
    const job = jobs.find((entry) => String(entry.job_id) === job_id);
    unknown.push({ job_id, status: job ? String(job.status) : "unknown", reason: ids.length + " native subagent(s) observed; their usage may be missing from the job's readings" });
  }
  return deepFreeze({
    runs,
    jobs,
    running,
    writers,
    subagents: Object.fromEntries(Object.entries(subagents).map(([job_id, ids]) => [job_id, ids.length])),
    resources: { ...summary, unknown },
  });
}

/**
 * Writer slots, job slots and the owner's fleet allowance.
 *
 * @param {{fleet:any, concurrency:any, access:string, run_id?:(string|null),
 *   reservation?:({unit:string, amount?:(number|null)}|null), strict?:boolean}} input
 */
export function capacityReasons({ fleet, concurrency, access, run_id = null, reservation = null, strict = false }) {
  const reasons = [];
  if (access === "write") {
    const used = fleet.writers.filter((id) => id !== run_id).length;
    if (used >= concurrency.maxWriters) reasons.push({ code: REASONS.WRITERS, with: null, used, max: concurrency.maxWriters });
  }
  if (fleet.running.length >= concurrency.maxJobs) {
    reasons.push({ code: REASONS.JOBS, with: null, used: fleet.running.length, max: concurrency.maxJobs });
  }
  if (concurrency.fleetAllowance != null && reservation) {
    const allowance = Number(concurrency.fleetAllowance);
    const verdict = evaluateResources({
      grant: { resource_policy: { unit: fleet.resources.unit, allowance, strict } },
      summary: fleet.resources,
      reservation,
      nextJob: reservation.amount ?? null,
    });
    const refusals = [...verdict.refusals];
    const next = verdict.next == null ? null : Number(verdict.next);
    if (verdict.ok && next != null && fleet.resources.settled + fleet.resources.reserved + next > allowance) {
      refusals.push({ code: "fleet-allowance-exceeded", detail: fleet.resources.settled + fleet.resources.reserved + next + " > " + allowance + " " + fleet.resources.unit });
    }
    if (refusals.length) reasons.push({ code: REASONS.FLEET, with: null, refusals });
  }
  return reasons;
}

/**
 * The whole answer for one admission.
 *
 * `others` are the runs holding reservations. `drift` lists base-manifest paths the
 * destination has changed since this run's snapshot; drift inside the item's own
 * footprint means its plan was made on source that no longer exists.
 *
 * @param {{self:any, others?:any[], backlog?:any, fleet?:any, concurrency?:any, rules?:any,
 *   access?:string, run_id?:(string|null), reservation?:({unit:string, amount?:(number|null)}|null),
 *   strict?:boolean, drift?:string[], item?:boolean, pairwise?:boolean, capacity?:boolean}} input
 */
export function coordinate({
  self,
  others = [],
  backlog = null,
  fleet = null,
  concurrency = DEFAULT_CONCURRENCY,
  rules = coordinationRules(concurrency),
  access = "write",
  run_id = null,
  reservation = null,
  strict = false,
  drift = [],
  item = true,
  pairwise = true,
  capacity = true,
}) {
  const reasons = [];
  if (item && backlog) reasons.push(...itemReasons({ facts: self, backlog }));
  const pairs = [];
  if (pairwise) {
    for (const other of others) {
      const pair = relate(self, other, rules);
      pairs.push(pair);
      reasons.push(...pair.reasons);
    }
  }
  const moved = pairwise ? unique(drift.filter((path) => self.footprint.paths.some((entry) => overlaps(entry, path)))) : [];
  if (moved.length) reasons.push({ code: REASONS.SOURCE_MOVED, with: null, paths: moved });
  if (capacity && fleet) reasons.push(...capacityReasons({ fleet, concurrency, access, run_id, reservation, strict }));
  const all = dedupe(reasons);
  const verdict = verdictOf(all);
  const refusals = [];
  const follow = all.filter((reason) => FOLLOW_REASONS.has(reason.code));
  const scope = all.filter((reason) => SCOPE_REASONS.has(reason.code) && reason.code !== REASONS.SOURCE_MOVED);
  const capacityBlocked = all.filter((reason) => CAPACITY_REASONS.has(reason.code));
  if (follow.length) refusals.push({ code: COORDINATION_REFUSALS.FOLLOW, detail: follow });
  if (scope.length && !follow.length) refusals.push({ code: COORDINATION_REFUSALS.SCOPE, detail: scope });
  if (moved.length) refusals.push({ code: COORDINATION_REFUSALS.SOURCE_MOVED, detail: all.filter((reason) => reason.code === REASONS.SOURCE_MOVED) });
  if (capacityBlocked.length) refusals.push({ code: COORDINATION_REFUSALS.CAPACITY, detail: capacityBlocked });
  return deepFreeze({ verdict, label: VERDICT_LABELS[verdict], reasons: all, pairs, admitted: refusals.length === 0, refusals });
}

/** Rebuild a verdict from recorded refusals (a duplicate command carries no fresh evaluation). */
export function verdictFromRefusals(refusals) {
  const reasons = dedupe(
    (refusals || [])
      .filter((entry) => entry && Object.values(COORDINATION_REFUSALS).includes(entry.code))
      .flatMap((entry) => (Array.isArray(entry.detail) ? entry.detail : [])),
  );
  const verdict = verdictOf(reasons);
  return deepFreeze({ verdict, label: VERDICT_LABELS[verdict], reasons });
}
