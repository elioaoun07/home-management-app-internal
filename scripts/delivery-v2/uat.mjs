// scripts/delivery-v2/uat.mjs
// DLV-145 — the one canonical UAT record for a delivery.
//
// A *handover* is the frozen, candidate-bound set of manual scenarios the owner
// tests. Everything the owner does about it is an append-only *receipt*:
// per-scenario results, build availability, sign-off and its retraction, and
// feedback revisions. Step progress is only a draft; it is never an acceptance
// receipt. Implementation (Done), automated checks, Apply and the test-gate
// "Proceed anyway" are separate facts and never satisfy sign-off.
//
// Files live under `.delivery/v2/uat/` (gitignored runtime state), one JSON
// object per line, written under a small cross-process lock:
//   handovers.ndjson  one line per handover revision (supervisor-written)
//   receipts.ndjson   result / availability / signoff / retract
//   feedback.ndjson   one line per feedback revision (thread)
//   drafts.json       the wizard's saved position, compare-and-set
//
// Identity, the actor, the receipt time and the content digest are decided here
// from trusted inputs — never from the caller's payload. This module touches no
// process, provider, Git, database or application data.
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const UAT_DIR_REL = ".delivery/v2/uat";
export const UAT_IMPORT_JOURNAL_REL = ".pm/uat-import.jsonl";
export const UAT_SCHEMA = "uat-handover-v1";
/** A submitted report can be withdrawn without trace until this long after it was saved. */
export const FEEDBACK_UNDO_MS = 2 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export const LIMITS = Object.freeze({
  scenarios: 40,
  steps: 60,
  criteria: 40,
  id: 64,
  title: 160,
  step: 1500,
  block: 2000,
  note: 500,
  observation: 1000,
  details: 4000,
  evidence: 8,
  url: 500,
  content: 250_000,
  problems: 50,
});

export const RESULTS = Object.freeze(["pass", "fail", "blocked"]);
export const PURPOSES = Object.freeze(["feature", "defect", "regression", "edge", "tooling", "review"]);
export const TARGETS = Object.freeze(["local", "hosted", "phone", "none"]);
export const CLASSIFICATIONS = Object.freeze(["bug", "change", "comment"]);

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const sha = (text) => createHash("sha256").update(text).digest("hex");

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }
  return JSON.stringify(value ?? null);
}
export const digestOf = (value) => sha(stable(value));

const text = (value) => String(value ?? "").replace(/\r\n/gu, "\n").trim();
const isoOrNull = (value) => {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const dirOf = (root) => join(root, ...UAT_DIR_REL.split("/"));
const fileOf = (root, name) => join(dirOf(root), name);

/** Parse an NDJSON file; a torn or foreign line is counted, never thrown. */
function readRows(path) {
  if (!existsSync(path)) return { rows: [], corrupt: 0 };
  const rows = [];
  let corrupt = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row === "object" && !Array.isArray(row)) rows.push(row);
      else corrupt += 1;
    } catch {
      corrupt += 1;
    }
  }
  return { rows, corrupt };
}

function lastByteIsNewline(path) {
  if (!existsSync(path)) return true;
  const size = statSync(path).size;
  if (size === 0) return true;
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(1);
    readSync(fd, buffer, 0, 1, size - 1);
    return buffer[0] === 0x0a;
  } finally {
    closeSync(fd);
  }
}

/** Append one record, fsynced; a torn previous line is closed first. */
function appendRow(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  const prefix = lastByteIsNewline(path) ? "" : "\n";
  const fd = openSync(path, "a");
  try {
    writeSync(fd, prefix + JSON.stringify(row) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** One writer at a time across PM processes and the CLI. */
function withLock(root, fn) {
  const lock = fileOf(root, ".lock");
  mkdirSync(dirname(lock), { recursive: true });
  const deadline = Date.now() + 3000;
  let fd = null;
  for (;;) {
    try {
      fd = openSync(lock, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 15_000) {
          unlinkSync(lock);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) throw Object.assign(new Error("UAT store is busy"), { code: "uat-store-busy" });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
}

/** @param {Record<string, any>} input */
export function readUat({ root }) {
  const handovers = readRows(fileOf(root, "handovers.ndjson"));
  const receipts = readRows(fileOf(root, "receipts.ndjson"));
  const feedback = readRows(fileOf(root, "feedback.ndjson"));
  let drafts = {};
  try {
    const raw = JSON.parse(readFileSync(fileOf(root, "drafts.json"), "utf8"));
    if (raw && typeof raw === "object" && !Array.isArray(raw)) drafts = raw;
  } catch { /* none yet */ }
  return {
    handovers: handovers.rows,
    receipts: receipts.rows,
    feedback: feedback.rows,
    drafts,
    corrupt: handovers.corrupt + receipts.corrupt + feedback.corrupt,
  };
}

const refuse = (code, detail = null) => ({ ok: false, refusals: [{ code, detail }] });

// ---------------------------------------------------------------------------
// Handover content
// ---------------------------------------------------------------------------

/**
 * Validate and normalize worker- or author-supplied scenario content. Never
 * truncates: an oversized or incomplete input is reported, not repaired, so a
 * delivery can only become testable with content someone actually wrote.
 *
 * `criteria` lists the acceptance criteria the handover must cover; each needs a
 * required scenario naming it.
 */
/** @param {any} raw @param {{ criteria?: string[] }} [options] */
export function validateContent(raw, { criteria = [] } = {}) {
  const problems = [];
  const add = (code, detail = null, where = {}) => {
    if (problems.length < LIMITS.problems) problems.push({ code, detail, ...where });
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    add("content-missing", "no handover content");
    return { ok: false, problems, content: null };
  }
  const list = Array.isArray(raw.scenarios) ? raw.scenarios : null;
  if (!list || list.length === 0) add("no-scenarios", "at least one scenario is required");
  if (list && list.length > LIMITS.scenarios) add("too-many-scenarios", `${list.length} > ${LIMITS.scenarios}`);
  const seen = new Set();
  const scenarios = [];
  for (const [index, entry] of (list || []).slice(0, LIMITS.scenarios).entries()) {
    const at = { scenario: typeof entry?.id === "string" ? entry.id : `#${index + 1}` };
    if (!entry || typeof entry !== "object") {
      add("scenario-invalid", "not an object", at);
      continue;
    }
    const id = text(entry.id);
    if (!ID.test(id)) add("scenario-id-invalid", "use letters, digits, . _ -", at);
    else if (seen.has(id.toLowerCase())) add("duplicate-scenario-id", id, at);
    seen.add(id.toLowerCase());
    const title = text(entry.title);
    if (!title) add("scenario-title-missing", null, at);
    if (title.length > LIMITS.title) add("text-too-long", `title > ${LIMITS.title}`, at);
    const purpose = PURPOSES.includes(entry.purpose) ? entry.purpose : "feature";
    const steps = [];
    const rawSteps = Array.isArray(entry.steps) ? entry.steps : [];
    if (rawSteps.length === 0) add("no-steps", "a scenario needs at least one step", at);
    if (rawSteps.length > LIMITS.steps) add("too-many-steps", `${rawSteps.length} > ${LIMITS.steps}`, at);
    for (const [n, step] of rawSteps.slice(0, LIMITS.steps).entries()) {
      const action = text(step?.action);
      const expected = text(step?.expected);
      if (!action) add("step-missing-action", null, { ...at, step: n + 1 });
      if (!expected) add("step-missing-expectation", null, { ...at, step: n + 1 });
      if (action.length > LIMITS.step || expected.length > LIMITS.step) add("text-too-long", `step > ${LIMITS.step}`, { ...at, step: n + 1 });
      steps.push({ action, expected });
    }
    const block = (value, name) => {
      const out = text(value);
      if (out.length > LIMITS.block) add("text-too-long", `${name} > ${LIMITS.block}`, at);
      return out;
    };
    const refs = (Array.isArray(entry.criteria) ? entry.criteria : []).map(text).filter(Boolean);
    if (refs.length > LIMITS.criteria) add("too-many-criteria", `${refs.length} > ${LIMITS.criteria}`, at);
    scenarios.push({
      id,
      title,
      purpose,
      required: entry.required !== false,
      criteria: refs.slice(0, LIMITS.criteria),
      draft: entry.draft === true,
      setup: block(entry.setup, "setup"),
      starting: block(entry.starting, "starting"),
      steps,
      defect: entry.defect == null ? null : block(entry.defect, "defect"),
      cleanup: block(entry.cleanup, "cleanup"),
      limits: entry.limits == null ? null : block(entry.limits, "limits"),
    });
  }
  if (scenarios.length && !scenarios.some((scenario) => scenario.required)) add("no-required-scenario", "at least one scenario must be required");
  for (const criterion of criteria) {
    const wanted = text(criterion).toLowerCase();
    if (wanted && !scenarios.some((scenario) => scenario.required && scenario.criteria.some((ref) => ref.toLowerCase() === wanted))) {
      add("criterion-uncovered", text(criterion));
    }
  }
  const content = {
    summary: text(raw.summary).slice(0, LIMITS.block),
    setup: text(raw.setup).slice(0, LIMITS.block),
    limits: text(raw.limits).slice(0, LIMITS.block),
    scenarios,
  };
  if (stable(content).length > LIMITS.content) add("content-too-large", `more than ${LIMITS.content} characters`);
  return { ok: problems.length === 0, problems, content };
}

function normalizeEnvironment(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const target = TARGETS.includes(value.target) ? value.target : "local";
  const short = (input, max) => text(input).slice(0, max) || null;
  return { target, build: short(value.build, 200), url: short(value.url, LIMITS.url), device: short(value.device, 200) };
}

function normalizeSubject(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const run_id = text(value.run_id) || null;
  return {
    type: run_id ? "run" : "direct",
    run_id,
    delivery_ref: text(value.delivery_ref).slice(0, 300) || (run_id ? `run:${run_id}` : ""),
    work_id: text(value.work_id).slice(0, 64) || null,
    campaign: text(value.campaign).slice(0, 80) || null,
    title: text(value.title).slice(0, LIMITS.title) || null,
  };
}

export const handoverIdFor = (subject) => "uat-" + sha(subject.type === "run" ? `run:${subject.run_id}` : `direct:${subject.delivery_ref}`).slice(0, 12);

/**
 * The supervisor-side binding for a run: only identities the journey already
 * holds. Returns null when the run has nothing testable.
 */
/** @param {Record<string, any> | null} context */
export function bindRun(context) {
  if (!context?.candidate_id) return null;
  return {
    kind: "candidate",
    candidate_id: String(context.candidate_id),
    generation: context.generation == null ? null : String(context.generation),
    result_version: context.result_version ?? null,
    plan_revision: context.plan_revision ?? null,
    contract_revision: context.contract_revision ?? null,
  };
}

/** A direct delivery binds an exact source revision and a unique delivery reference. */
export function bindDirect({ delivery_ref, source_revision, files_digest = null }) {
  const revision = text(source_revision);
  const ref = text(delivery_ref);
  if (!ref || !/^[0-9a-f]{7,64}$/iu.test(revision)) return null;
  return { kind: "source", delivery_ref: ref, source_revision: revision.toLowerCase(), files_digest: files_digest ? text(files_digest) : null };
}

const latestBy = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    const previous = map.get(row[key]);
    if (!previous || (row.revision ?? 0) >= (previous.revision ?? 0)) map.set(row[key], row);
  }
  return map;
};

/**
 * Freeze one revision of a handover. Identity, digest, revision number and
 * status are decided here. `ready` only holds when the content validates and a
 * trusted binding is supplied; otherwise the revision is `draft` (valid, not
 * yet bound) or `incomplete` (invalid, with its problems). An identical
 * re-freeze returns the existing revision, so recovery keeps exactly one.
 */
/** @param {Record<string, any>} input */
export function freezeHandover({ root, subject: rawSubject, binding = null, environment = null, content, criteria = [], source = { kind: "import", ref: "" }, ready = false, now }) {
  const subject = normalizeSubject(rawSubject);
  if (!subject.run_id && !subject.delivery_ref) return refuse("subject-missing", "a run or a delivery reference is required");
  const checked = validateContent(content, { criteria });
  const env = normalizeEnvironment(environment);
  const handover_id = handoverIdFor(subject);
  return withLock(root, () => {
    const { handovers } = readUat({ root });
    const previous = latestBy(handovers, "handover_id").get(handover_id) || null;
    let status = "draft";
    if (!checked.ok) status = "incomplete";
    else if (ready && binding) status = "ready";
    else if (ready && !binding) return refuse("binding-missing", "ready needs a candidate or exact source revision");
    const record = {
      kind: "handover",
      schema: UAT_SCHEMA,
      handover_id,
      revision: (previous?.revision ?? 0) + 1,
      status,
      subject,
      binding,
      environment: env,
      // An incomplete handover keeps what was written so the wizard can show it
      // read-only beside the exact problems; only an oversize body is dropped.
      content: checked.content && !checked.problems.some((problem) => problem.code === "content-too-large") ? checked.content : null,
      content_digest: digestOf(checked.content ?? content ?? null),
      problems: checked.ok ? [] : checked.problems,
      source: { kind: text(source.kind).slice(0, 20) || "import", ref: text(source.ref).slice(0, 300) },
      created_at: isoOrNull(now) || new Date().toISOString(),
    };
    if (previous
      && previous.status === record.status
      && previous.content_digest === record.content_digest
      && stable(previous.binding) === stable(record.binding)
      && stable(previous.environment) === stable(record.environment)
      && stable(previous.subject) === stable(record.subject)) {
      return { ok: true, repeated: true, handover: previous };
    }
    appendRow(fileOf(root, "handovers.ndjson"), record);
    return { ok: true, repeated: false, handover: record };
  });
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

const unresolved = (thread) => thread.state === "submitted" && (thread.classification === "bug" || thread.classification === "change");

/** Reduce feedback revisions to threads (latest revision wins; history kept). */
export function feedbackThreads(rows) {
  const byThread = new Map();
  for (const row of rows) {
    const list = byThread.get(row.thread_id) || [];
    list.push(row);
    byThread.set(row.thread_id, list);
  }
  return [...byThread.values()].map((list) => {
    const latest = list[list.length - 1];
    return { ...latest, first_received_at: list[0].received_at, revisions: list.length };
  });
}

/**
 * Everything the wizard and the Delivery list need about one handover, derived
 * from the append-only records.
 *
 * `context` is what the live supervisor knows about the delivery: `{ run }` for a
 * run subject (candidate identity and `applied`), or null when it is unknown.
 */
/** @param {Record<string, any>} input */
export function projectHandover({ handover, revisions = [handover], receipts, feedback, drafts = {}, context = null, importStatus = {}, supersededBy = null, now }) {
  const mine = receipts.filter((row) => row.handover_id === handover.handover_id);
  const forRevision = mine.filter((row) => row.revision === handover.revision);
  const scenarios = (handover.content?.scenarios || []).map((scenario) => {
    const results = forRevision.filter((row) => row.kind === "result" && row.scenario_id === scenario.id);
    const current = results.length ? results[results.length - 1] : null;
    return {
      ...scenario,
      result: current ? current.result : "pending",
      receipt: current ? { receipt_id: current.receipt_id, note: current.note, step: current.step, device: current.device, build: current.build, observed_at: current.observed_at, received_at: current.received_at, actor: current.actor } : null,
      attempts: results.length,
    };
  });
  const required = scenarios.filter((scenario) => scenario.required);
  const counts = { pass: 0, fail: 0, blocked: 0, pending: 0 };
  for (const scenario of scenarios) counts[scenario.result] += 1;

  const run = context?.run || null;
  const stale = Boolean(handover.binding?.kind === "candidate" && run?.candidate_id
    && (run.candidate_id !== handover.binding.candidate_id || (run.result_version ?? null) !== (handover.binding.result_version ?? null)));
  const noCandidate = handover.subject.type === "run" && Boolean(run) && !run.candidate_id;

  // Availability: the environment named by the handover must hold this version.
  const availabilityReceipts = forRevision.filter((row) => row.kind === "availability");
  const attested = availabilityReceipts.length ? availabilityReceipts[availabilityReceipts.length - 1] : null;
  let availability = { state: "unknown", evidence: null };
  if (handover.environment.target === "none") availability = { state: "available", evidence: "review only" };
  else if (attested?.available === true) availability = { state: "available", evidence: `owner confirmed ${attested.build || "build"}` };
  else if (attested?.available === false) availability = { state: "awaiting", evidence: attested.note || "owner reported it is not available" };
  else if (handover.environment.target === "local" && run?.applied) availability = { state: "available", evidence: "applied to this checkout" };
  else if (handover.subject.type === "run" && run && !run.applied) availability = { state: "awaiting", evidence: "not applied" };

  const threads = feedbackThreads(feedback.filter((row) => row.handover_id === handover.handover_id)).map((thread) => ({
    thread_id: thread.thread_id,
    state: thread.state,
    classification: thread.classification,
    urgency: thread.urgency,
    revision: thread.revisions,
    handover_revision: thread.handover_revision,
    scenario_id: thread.scenario_id,
    step: thread.step,
    observation: thread.observation,
    expected: thread.expected,
    actual: thread.actual,
    received_at: thread.received_at,
    disposition: thread.disposition || null,
    undoable_until: new Date(Date.parse(thread.received_at) + FEEDBACK_UNDO_MS).toISOString(),
    import: importStatus[thread.thread_id] || (unresolved(thread) ? { status: "saved" } : null),
  }));
  const open = threads.filter(unresolved);

  const signoffs = forRevision.filter((row) => row.kind === "signoff" || row.kind === "retract");
  const lastSign = signoffs.length ? signoffs[signoffs.length - 1] : null;
  const signoff = lastSign?.kind === "signoff" ? lastSign : null;

  const blockers = [];
  if (handover.status === "incomplete") blockers.push({ code: "handover-incomplete", detail: handover.problems.length });
  else if (handover.status === "draft") blockers.push({ code: "handover-draft", detail: null });
  if (handover.status === "ready" && stale) blockers.push({ code: "stale-candidate", detail: null });
  if (noCandidate) blockers.push({ code: "no-candidate", detail: null });
  const notPassed = required.filter((scenario) => scenario.result !== "pass").map((scenario) => scenario.id);
  if (notPassed.length) blockers.push({ code: "required-not-passed", detail: notPassed });
  if (availability.state !== "available") blockers.push({ code: "not-available", detail: availability.state });
  if (open.length) blockers.push({ code: "feedback-unresolved", detail: open.map((thread) => thread.thread_id) });

  let state;
  // A changed candidate retires the results recorded for the old one; a newer attempt retires an unaccepted older one.
  if (stale || (supersededBy && !signoff)) state = "superseded";
  else if (noCandidate) state = "no-candidate";
  else if (signoff && !open.length && !stale && !notPassed.length) state = "accepted";
  else if (open.length || counts.fail > 0) state = "needs-changes";
  else if (counts.blocked > 0) state = "blocked";
  else if (counts.pass > 0) state = "in-progress";
  else state = "pending";

  const draft = drafts[handover.handover_id] || null;
  const live = draft && draft.revision === handover.revision && draft.content_digest === handover.content_digest;
  return {
    handover_id: handover.handover_id,
    revision: handover.revision,
    revisions: revisions.length,
    status: handover.status,
    subject: handover.subject,
    binding: handover.binding,
    environment: handover.environment,
    source: handover.source,
    created_at: handover.created_at,
    summary: handover.content?.summary || "",
    setup: handover.content?.setup || "",
    limits: handover.content?.limits || "",
    problems: handover.problems,
    scenarios,
    counts,
    availability,
    stale,
    acceptance: { state, shipped: state === "accepted" },
    signoff: signoff ? { receipt_id: signoff.receipt_id, actor: signoff.actor, received_at: signoff.received_at, build: signoff.build, environment: signoff.environment } : null,
    signable: blockers.length === 0 && !signoff,
    blockers,
    feedback: threads,
    draft: live ? { position: draft.position, notes: draft.notes, rev: draft.rev, saved_at: draft.saved_at } : null,
    staleDraft: Boolean(draft && !live),
    draftRev: draft ? draft.rev : 0,
    supersededBy,
    now: isoOrNull(now),
  };
}

/**
 * Every delivery's current projection, newest first. `contextFor(handover)` is
 * called lazily and may return null (no supervisor store, unknown run).
 */
/** @param {Record<string, any>} input */
export function listUat({ root, contextFor = () => null, importStatus = {}, now = new Date().toISOString() }) {
  const store = readUat({ root });
  const byId = new Map();
  for (const row of store.handovers) {
    const list = byId.get(row.handover_id) || [];
    list.push(row);
    byId.set(row.handover_id, list);
  }
  const latest = [...byId.values()].map((list) => list[list.length - 1]);
  const newestForWork = new Map();
  for (const handover of latest) {
    const work = handover.subject.work_id;
    if (!work) continue;
    const key = `${handover.subject.campaign || ""}/${work}`.toLowerCase();
    const known = newestForWork.get(key);
    if (!known || handover.created_at > known.created_at) newestForWork.set(key, handover);
  }
  const views = latest.map((handover) => {
    const key = handover.subject.work_id ? `${handover.subject.campaign || ""}/${handover.subject.work_id}`.toLowerCase() : null;
    const newest = key ? newestForWork.get(key) : null;
    const supersededBy = newest && newest.handover_id !== handover.handover_id && newest.created_at > handover.created_at ? newest.handover_id : null;
    return projectHandover({
      handover,
      revisions: byId.get(handover.handover_id),
      receipts: store.receipts,
      feedback: store.feedback,
      drafts: store.drafts,
      context: contextFor(handover),
      importStatus,
      supersededBy,
      now,
    });
  });
  views.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { handovers: views, corrupt: store.corrupt };
}

/** @param {Record<string, any>} input */
export function viewOne({ root, handover_id, contextFor = () => null, importStatus = {}, now }) {
  const all = listUat({ root, contextFor, importStatus, now });
  return all.handovers.find((view) => view.handover_id === handover_id) || null;
}

// ---------------------------------------------------------------------------
// Commands (every one append-only, idempotent by command_id)
// ---------------------------------------------------------------------------

function checkTimes(observed_at, now) {
  const received_at = isoOrNull(now) || new Date().toISOString();
  if (observed_at == null || observed_at === "") return { received_at, observed_at: received_at };
  const observed = isoOrNull(observed_at);
  if (!observed) return { error: refuse("time-invalid", "observed_at is not a time") };
  if (Date.parse(observed) > Date.parse(received_at) + FUTURE_SKEW_MS) return { error: refuse("time-in-future", "observed_at is in the future") };
  return { received_at, observed_at: observed };
}

const nextReceiptId = () => "rc-" + randomUUID().replace(/-/gu, "").slice(0, 16);

function loadCurrent(root, handover_id, revision) {
  const store = readUat({ root });
  const latest = latestBy(store.handovers, "handover_id").get(handover_id);
  if (!latest) return { error: refuse("unknown-handover", handover_id) };
  if (revision != null && Number(revision) !== latest.revision) {
    return { error: refuse("stale-revision", `this handover is now revision ${latest.revision}`) };
  }
  return { store, latest };
}

function priorCommand(store, command_id) {
  if (!command_id) return null;
  return [...store.receipts, ...store.feedback].find((row) => row.command_id === command_id) || null;
}

const needActor = (actor) => (text(actor) ? null : refuse("actor-missing", "an authenticated actor is required"));
const needCommand = (command_id) => (text(command_id) ? null : refuse("command-id-missing", "every UAT command carries a command id"));

/** One owner result for one scenario of the current revision. */
/** @param {Record<string, any>} input */
export function recordResult({ root, handover_id, revision, scenario_id, result, note = "", step = null, device = null, build = null, observed_at = null, command_id, actor, now }) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  if (!RESULTS.includes(result)) return refuse("result-invalid", "pass, fail or blocked");
  const reason = text(note);
  if (reason.length > LIMITS.note) return refuse("note-too-long", `more than ${LIMITS.note} characters`);
  if ((result === "fail" || result === "blocked") && !reason) return refuse("note-required", "say what happened");
  const times = checkTimes(observed_at, now);
  if (times.error) return times.error;
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const prior = priorCommand(loaded.store, command_id);
    if (prior) return { ok: true, repeated: true, receipt: prior };
    const { latest } = loaded;
    if (latest.status === "incomplete") return refuse("handover-incomplete", "repair the handover first");
    // A draft is not bound to a build, so a result against it would certify nothing.
    if (latest.status === "draft") return refuse("handover-draft", "mark it ready first");
    const scenario = latest.content.scenarios.find((entry) => entry.id === scenario_id);
    if (!scenario) return refuse("unknown-scenario", scenario_id);
    if (step != null && !(Number.isInteger(step) && step >= 1 && step <= scenario.steps.length)) return refuse("step-invalid", `1-${scenario.steps.length}`);
    const earlier = loaded.store.receipts.filter((row) => row.kind === "result" && row.handover_id === handover_id && row.revision === latest.revision && row.scenario_id === scenario_id);
    const receipt = {
      kind: "result",
      receipt_id: nextReceiptId(),
      command_id: text(command_id),
      handover_id,
      revision: latest.revision,
      scenario_id,
      result,
      note: reason || null,
      step: step ?? null,
      device: text(device).slice(0, 200) || null,
      build: text(build).slice(0, 200) || null,
      observed_at: times.observed_at,
      received_at: times.received_at,
      actor: text(actor),
      supersedes: earlier.length ? earlier[earlier.length - 1].receipt_id : null,
    };
    appendRow(fileOf(root, "receipts.ndjson"), receipt);
    return { ok: true, repeated: false, receipt };
  });
}

/** The owner states whether the named environment serves this version. */
/** @param {Record<string, any>} input */
export function recordAvailability({ root, handover_id, revision, available, build = null, note = "", command_id, actor, now }) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  const times = checkTimes(null, now);
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const prior = priorCommand(loaded.store, command_id);
    if (prior) return { ok: true, repeated: true, receipt: prior };
    const receipt = {
      kind: "availability",
      receipt_id: nextReceiptId(),
      command_id: text(command_id),
      handover_id,
      revision: loaded.latest.revision,
      available: available === true,
      build: text(build).slice(0, 200) || null,
      note: text(note).slice(0, LIMITS.note) || null,
      received_at: times.received_at,
      actor: text(actor),
    };
    appendRow(fileOf(root, "receipts.ndjson"), receipt);
    return { ok: true, repeated: false, receipt };
  });
}

/**
 * Wizard position and unsent notes. Compare-and-set on `rev`; never an
 * acceptance receipt, and it reads stale once the handover revision moves.
 */
/** @param {Record<string, any>} input */
export function saveDraft({ root, handover_id, revision, position = null, notes = {}, base_rev = 0, now }) {
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const draftsPath = fileOf(root, "drafts.json");
    const drafts = loaded.store.drafts;
    const current = drafts[handover_id] || null;
    if ((current?.rev ?? 0) !== Number(base_rev || 0)) return refuse("draft-conflict", "reload before saving");
    const clean = {};
    for (const [key, value] of Object.entries(notes && typeof notes === "object" ? notes : {}).slice(0, LIMITS.scenarios)) {
      if (ID.test(key)) clean[key] = text(value).slice(0, LIMITS.note);
    }
    const pos = position && typeof position === "object" ? { scenario_id: text(position.scenario_id).slice(0, LIMITS.id), step: Math.max(0, Math.min(LIMITS.steps, Number(position.step) || 0)) } : null;
    drafts[handover_id] = {
      revision: loaded.latest.revision,
      content_digest: loaded.latest.content_digest,
      position: pos,
      notes: clean,
      rev: (current?.rev ?? 0) + 1,
      saved_at: isoOrNull(now) || new Date().toISOString(),
    };
    mkdirSync(dirname(draftsPath), { recursive: true });
    const temp = draftsPath + "." + process.pid + ".tmp";
    writeFileSync(temp, JSON.stringify(drafts, null, 2) + "\n");
    renameSync(temp, draftsPath);
    return { ok: true, rev: drafts[handover_id].rev };
  });
}

function currentView(root, latest, store, context, importStatus, now) {
  const all = new Map();
  for (const row of store.handovers) all.set(row.handover_id, [...(all.get(row.handover_id) || []), row]);
  return projectHandover({ handover: latest, revisions: all.get(latest.handover_id), receipts: store.receipts, feedback: store.feedback, drafts: store.drafts, context, importStatus, now });
}

/**
 * Explicit owner acceptance. The gate is recomputed from the records at this
 * instant; nothing the caller says (or any other signal — Apply, a green check,
 * the test gate's Proceed) can stand in for it. Only an authenticated owner
 * actor reaches this; the Steward credential is refused by the route allowlist.
 */
/** @param {Record<string, any>} input */
export function signOff({ root, handover_id, revision, command_id, actor, now, context = null, importStatus = {}, build = null }) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  const times = checkTimes(null, now);
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const prior = priorCommand(loaded.store, command_id);
    if (prior) return { ok: true, repeated: true, receipt: prior };
    const view = currentView(root, loaded.latest, loaded.store, context, importStatus, now);
    if (view.signoff) return refuse("already-signed", "retract the sign-off first");
    if (view.blockers.length) return { ok: false, refusals: view.blockers };
    const passes = view.scenarios.filter((scenario) => scenario.required).map((scenario) => `${scenario.id}:${scenario.receipt.receipt_id}`).sort();
    const receipt = {
      kind: "signoff",
      receipt_id: nextReceiptId(),
      command_id: text(command_id),
      handover_id,
      revision: loaded.latest.revision,
      content_digest: loaded.latest.content_digest,
      binding: loaded.latest.binding,
      results_digest: sha(passes.join("|")),
      build: text(build).slice(0, 200) || loaded.latest.environment.build,
      environment: loaded.latest.environment.target,
      received_at: times.received_at,
      actor: text(actor),
    };
    appendRow(fileOf(root, "receipts.ndjson"), receipt);
    return { ok: true, repeated: false, receipt };
  });
}

/** Take the sign-off back. The receipt stays; acceptance reopens. */
/** @param {Record<string, any>} input */
export function retractSignOff({ root, handover_id, revision, command_id, reason = "", actor, now }) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  const times = checkTimes(null, now);
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const prior = priorCommand(loaded.store, command_id);
    if (prior) return { ok: true, repeated: true, receipt: prior };
    const signs = loaded.store.receipts.filter((row) => row.handover_id === handover_id && row.revision === loaded.latest.revision && (row.kind === "signoff" || row.kind === "retract"));
    const last = signs.length ? signs[signs.length - 1] : null;
    if (last?.kind !== "signoff") return refuse("not-signed", "there is no sign-off to take back");
    const receipt = {
      kind: "retract",
      receipt_id: nextReceiptId(),
      command_id: text(command_id),
      handover_id,
      revision: loaded.latest.revision,
      retracts: last.receipt_id,
      reason: text(reason).slice(0, LIMITS.note) || null,
      received_at: times.received_at,
      actor: text(actor),
    };
    appendRow(fileOf(root, "receipts.ndjson"), receipt);
    return { ok: true, repeated: false, receipt };
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function cleanEvidence(list) {
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const value = text(entry).slice(0, LIMITS.url);
    if (/^https?:\/\//iu.test(value)) out.push(value);
    if (out.length >= LIMITS.evidence) break;
  }
  return out;
}

/**
 * Save a report. Needs-changes (bug / change) is actionable and is imported as
 * work later; a comment is informational and never creates anything. Passing an
 * existing `thread_id` appends a revision of the same thread.
 */
/** @param {Record<string, any>} input */
export function submitFeedback({
  root, handover_id, revision, thread_id = null, scenario_id = null, step = null, classification, urgency = "next",
  observation, expected = "", actual = "", details = "", evidence = [], build = null, device = null, observed_at = null,
  command_id, actor, now,
}) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  if (!CLASSIFICATIONS.includes(classification)) return refuse("classification-invalid", "bug, change or comment");
  const said = text(observation);
  if (!said) return refuse("observation-required", "say what happened");
  if (said.length > LIMITS.observation) return refuse("observation-too-long", `more than ${LIMITS.observation} characters`);
  if (text(details).length > LIMITS.details || text(expected).length > LIMITS.observation || text(actual).length > LIMITS.observation) {
    return refuse("text-too-long", null);
  }
  const times = checkTimes(observed_at, now);
  if (times.error) return times.error;
  return withLock(root, () => {
    const loaded = loadCurrent(root, handover_id, revision);
    if (loaded.error) return loaded.error;
    const prior = priorCommand(loaded.store, command_id);
    if (prior) return { ok: true, repeated: true, feedback: prior };
    const { latest } = loaded;
    let scenario = null;
    if (scenario_id) {
      scenario = latest.content?.scenarios.find((entry) => entry.id === scenario_id) || null;
      if (!scenario) return refuse("unknown-scenario", scenario_id);
    }
    if (step != null && !(scenario && Number.isInteger(step) && step >= 1 && step <= scenario.steps.length)) return refuse("step-invalid", "name the scenario and a step in it");
    let thread = thread_id ? feedbackThreads(loaded.store.feedback).find((entry) => entry.thread_id === thread_id) : null;
    if (thread_id && !thread) return refuse("unknown-thread", thread_id);
    if (thread && thread.handover_id !== handover_id) return refuse("unknown-thread", thread_id);
    if (thread && thread.state !== "submitted") return refuse("thread-closed", `this report is ${thread.state}`);
    const stepText = scenario && step ? scenario.steps[step - 1] : null;
    const record = {
      kind: "feedback",
      thread_id: thread ? thread.thread_id : "fb-" + randomUUID().replace(/-/gu, "").slice(0, 14),
      revision: thread ? thread.revisions + 1 : 1,
      command_id: text(command_id),
      handover_id,
      handover_revision: latest.revision,
      subject: latest.subject,
      binding: latest.binding,
      environment: latest.environment,
      scenario_id: scenario ? scenario.id : null,
      scenario_title: scenario ? scenario.title : null,
      step: step ?? null,
      step_action: stepText ? stepText.action : null,
      classification,
      urgency: urgency === "now" ? "now" : "next",
      observation: said,
      expected: text(expected) || (stepText ? stepText.expected : ""),
      actual: text(actual),
      details: text(details),
      evidence: cleanEvidence(evidence),
      build: text(build).slice(0, 200) || latest.environment.build,
      device: text(device).slice(0, 200) || null,
      observed_at: times.observed_at,
      received_at: times.received_at,
      actor: text(actor),
      state: "submitted",
      disposition: null,
    };
    appendRow(fileOf(root, "feedback.ndjson"), record);
    return { ok: true, repeated: false, feedback: record };
  });
}

function closeThread({ root, thread_id, command_id, actor, now, state, disposition = null }) {
  const missing = needActor(actor) || needCommand(command_id);
  if (missing) return missing;
  const times = checkTimes(null, now);
  return withLock(root, () => {
    const store = readUat({ root });
    const prior = priorCommand(store, command_id);
    if (prior) return { ok: true, repeated: true, feedback: prior };
    const thread = feedbackThreads(store.feedback).find((entry) => entry.thread_id === thread_id);
    if (!thread) return refuse("unknown-thread", thread_id);
    if (thread.state !== "submitted") return refuse("thread-closed", `this report is already ${thread.state}`);
    const { revisions, ...rest } = thread;
    const base = { ...rest };
    delete base.first_received_at;
    const record = { ...base, revision: revisions + 1, command_id: text(command_id), state, disposition, received_at: times.received_at, actor: text(actor) };
    appendRow(fileOf(root, "feedback.ndjson"), record);
    return { ok: true, repeated: false, feedback: record };
  });
}

/** Undo: the report is taken back. Before import it leaves no trace in the backlog. */
/** @param {Record<string, any>} input */
export const withdrawFeedback = (input) => closeThread({ ...input, state: "withdrawn" });

/**
 * The owner settles a report without a fix on this version: `resolved` (a
 * retest on a newer version verified it) or `follow-up` (kept as separate work,
 * reason retained). It never waives a failed required scenario — that stays
 * FAIL until a current PASS replaces it.
 */
/** @param {Record<string, any>} input */
export function dispositionFeedback({ kind, reason = "", work_id = null, ...input }) {
  if (!["resolved", "follow-up"].includes(kind)) return refuse("disposition-invalid", "resolved or follow-up");
  const why = text(reason);
  if (!why) return refuse("reason-required", "a reason is retained with the disposition");
  return closeThread({ ...input, state: "dispositioned", disposition: { kind, reason: why.slice(0, LIMITS.note), work_id: text(work_id).slice(0, 64) || null } });
}

// ---------------------------------------------------------------------------
// Import journal (written by scripts/pm/uat-feedback.mjs, read by the views)
// ---------------------------------------------------------------------------

/**
 * Where each feedback thread stands with the PM importer, from its journal.
 * `saved` → `importing` (intent written) → `imported` (committed) or `blocked`.
 */
/** @param {Record<string, any>} input */
export function readImportStatus({ root }) {
  const path = join(root, ...UAT_IMPORT_JOURNAL_REL.split("/"));
  const { rows } = readRows(path);
  /** @type {Record<string, any>} */
  const status = {};
  for (const row of rows) {
    if (!row.thread_id) continue;
    if (row.state === "intent") status[row.thread_id] = { status: "importing", workId: row.workId, campaign: row.campaign };
    else if (row.state === "committed") status[row.thread_id] = { status: "imported", workId: row.workId, campaign: row.campaign, revision: row.revision, committed_at: row.at };
    else if (row.state === "blocked") status[row.thread_id] = { status: "blocked", cause: row.cause, at: row.at };
    else if (row.state === "withdrawn-after-import") status[row.thread_id] = { ...(status[row.thread_id] || {}), status: "imported", withdrawn: true };
  }
  return status;
}

export const importJournalPath = (root) => join(root, ...UAT_IMPORT_JOURNAL_REL.split("/"));
