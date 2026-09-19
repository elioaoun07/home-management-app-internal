// scripts/pm/relay-shared.mjs
// Command Center Phase 4 — the relay contract both ends read (DLV-104, R63).
//
// Pure and browser-safe: no filesystem, no network. The laptop bridge
// (scripts/pm/relay.mjs + bridge.mjs) publishes rows and drains commands with
// these names; the phone (src/features/pm-live/relay/) reads them with the same
// names. One definition, so the two ends cannot drift.
//
// Rows ride the existing `pm_live (id, user_id, kind, payload jsonb)` table.
// Every id is scoped to one installation, and every read is scoped to one owner by
// RLS, so a phone never mixes two laptops or two owners.

export const RELAY_SCHEMA = "pm-relay@2";

/** How long a bridge heartbeat stays believable. Three missed 10 s beats. */
export const BRIDGE_STALE_MS = 30_000;

export const ROW_KINDS = Object.freeze({
  HEARTBEAT: "heartbeat",
  MANIFEST: "manifest",
  DOC: "doc",
  CAPABILITIES: "capabilities",
  V1RUNS: "v1runs",
  V2RUNS: "v2runs",
  V2RUN: "v2run",
  ATTENTION: "attention",
});

/** Phone command types for Delivery V2, each mapped to its local route. */
export const V2_COMMAND_TYPES = Object.freeze({
  "v2-deliver": "deliver",
  "v2-decision": "decision",
  "v2-answer": "answer",
  "v2-message": "message",
  "v2-control": "control",
  "v2-apply": "apply",
});

const INSTALLATION_PATTERN = /^inst-[a-f0-9]{12}$/u;

export function isInstallationId(value) {
  return typeof value === "string" && INSTALLATION_PATTERN.test(value);
}

/**
 * `cc:<installation>:<kind>[:<key>]`
 *
 * @param {string} installation_id
 * @param {string} kind
 * @param {(string|null)} [key]
 */
export function rowId(installation_id, kind, key = null) {
  if (!isInstallationId(installation_id)) throw new Error("relay rows need an installation id");
  if (!Object.values(ROW_KINDS).includes(kind)) throw new Error("unknown relay row kind " + String(kind));
  return "cc:" + installation_id + ":" + kind + (key == null ? "" : ":" + String(key));
}

/** @returns {{installation_id:string, kind:string, key:(string|null)}|null} */
export function parseRowId(id) {
  const match = /^cc:(inst-[a-f0-9]{12}):([a-z0-9]+)(?::(.*))?$/u.exec(String(id || ""));
  if (!match || !Object.values(ROW_KINDS).includes(match[2])) return null;
  return { installation_id: match[1], kind: match[2], key: match[3] ?? null };
}

/**
 * Where a phone command stands, from its row alone.
 *
 * `sent` means the row exists and no bridge has acknowledged it; `acknowledged`
 * means a bridge claimed it and has not recorded an outcome; `unknown` means the
 * bridge could not establish whether the effect happened. None of these is a
 * failure, and a timeout on the phone never turns one into a failure.
 *
 * @param {{status?:string, result?:any, error?:(string|null)}|null} row
 */
export function receiptState(row) {
  if (!row) return { state: "unsent", outcome: null, error: null };
  const result = row.result && typeof row.result === "object" ? row.result : null;
  switch (row.status) {
    case "pending":
      return { state: "sent", outcome: null, error: null };
    case "claimed":
      return result && result.outcome_unknown
        ? { state: "unknown", outcome: result, error: row.error ?? null }
        : { state: "acknowledged", outcome: null, error: null };
    case "done":
      return { state: "done", outcome: result, error: null };
    case "failed":
      return { state: "refused", outcome: result, error: row.error ?? null };
    case "unknown":
      return { state: "unknown", outcome: result, error: row.error ?? null };
    case "expired":
      return { state: "expired", outcome: result, error: row.error ?? null };
    default:
      return { state: "acknowledged", outcome: null, error: null };
  }
}

export const SETTLED_RECEIPT_STATES = Object.freeze(["done", "refused", "unknown", "expired"]);

/**
 * Rebuild the local app's snapshot from a manifest and its document rows.
 *
 * Complete or nothing: a document whose hash does not match the manifest, or that
 * is missing, makes the snapshot incomplete and the caller keeps what it had.
 *
 * @param {any} manifest
 * @param {Map<string, {relPath:string, raw:string, mtimeMs?:number, sha:string}>} docs
 */
export function assembleSnapshot(manifest, docs) {
  if (!manifest || manifest.schema !== RELAY_SCHEMA || !Array.isArray(manifest.files)) {
    return { ok: false, snapshot: null, missing: [], reason: "manifest" };
  }
  const missing = [];
  const files = [];
  for (const entry of manifest.files) {
    const doc = docs.get(entry.relPath);
    if (!doc || doc.sha !== entry.sha) {
      missing.push(entry.relPath);
      continue;
    }
    files.push({ relPath: entry.relPath, raw: doc.raw, mtimeMs: entry.mtimeMs ?? doc.mtimeMs ?? 0 });
  }
  if (missing.length) return { ok: false, snapshot: null, missing, reason: "documents" };
  return {
    ok: true,
    missing: [],
    reason: null,
    snapshot: { files, cancelledLog: manifest.cancelledLog || "", generatedAt: manifest.generatedAt },
  };
}

/**
 * Is the laptop bridge reachable, judged only by its heartbeat?
 *
 * @param {{seenAt?:string}|null} heartbeat
 * @param {number} now
 */
export function bridgeLiveness(heartbeat, now, staleMs = BRIDGE_STALE_MS) {
  if (!heartbeat || !heartbeat.seenAt) return { state: "never", seenAt: null, ageMs: null };
  const age = now - new Date(heartbeat.seenAt).getTime();
  return { state: Number.isFinite(age) && age < staleMs ? "online" : "stale", seenAt: heartbeat.seenAt, ageMs: Number.isFinite(age) ? age : null };
}

/**
 * Can a V2 job actually run, as far as the phone can know?
 *
 * Worker availability is only believable while the bridge is: a stale heartbeat
 * makes it unknown, never the last "ready" it reported.
 *
 * @param {{availability?:any}|null} heartbeat
 * @param {{state:string}} liveness
 */
export function workerAvailability(heartbeat, liveness) {
  if (liveness.state !== "online") return { state: "unknown", detail: null, executors: [] };
  const availability = heartbeat && heartbeat.availability;
  if (!availability) return { state: "unknown", detail: null, executors: [] };
  return { state: String(availability.state || "unknown"), detail: availability.detail ?? null, executors: availability.executors || [] };
}

/**
 * The owner-attention items for V2 runs, each keyed by the exact revision it is
 * about, so a notification is sent once per decision or result revision.
 *
 * @param {{summary:any, detail:any}[]} runs
 */
export function attentionItems(runs) {
  /** @type {{key:string, kind:string, run_id:string, title:string, label:string, at:string}[]} */
  const items = [];
  for (const { summary, detail } of runs) {
    if (!summary) continue;
    const run_id = String(summary.run_id);
    const title = String(summary.title || summary.alias || run_id);
    const at = String(summary.updated_at || "");
    const push = (key, kind, label) => items.push({ key, kind, run_id, title, label, at });
    if (detail && detail.ok !== false) {
      const plans = detail.plans || [];
      const latest = plans[plans.length - 1];
      for (const question of detail.questions || []) {
        if (question.status === "open" && question.blocking) push("question:" + question.question_id, "question", "Question");
      }
      if (latest && latest.status === "proposed" && detail.run.lifecycle !== "CLOSED") {
        push("plan:" + latest.plan_id + "@r" + latest.revision, "plan", "Review plan");
      }
      const action = detail.ownerAction || {};
      if (action.kind === "reconcile") {
        const unknown = (detail.jobs || []).filter((job) => job.status === "unknown").map((job) => job.job_id).sort();
        push("reconcile:" + run_id + ":" + unknown.join(","), "reconcile", "Reconcile");
      }
      if (action.kind === "settings") push("settings:" + run_id, "settings", "Settings mismatch");
      // An item that cannot write beside the others until its scope is declared needs the owner.
      const coordination = summary.coordination || detail.coordination;
      if (coordination && coordination.verdict === "scope") push("scope:" + run_id + ":" + String(coordination.since || ""), "coordination", "Needs scope check");
      if (detail.result && detail.run.lifecycle === "CLOSED") {
        push("result:" + detail.result.result_id + "@" + detail.result.result_version, "result", action.label || "Result");
      }
      const applications = detail.applications || [];
      const application = applications[applications.length - 1];
      if (application && ["applied", "conflict", "checks-failed", "checks-inconclusive", "checks-pending", "interrupted"].includes(application.state)) {
        push("application:" + application.application_id + "@" + application.state, "application", action.label || application.state);
      }
    }
  }
  return items;
}
