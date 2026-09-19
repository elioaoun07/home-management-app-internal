// scripts/delivery-v2/store.mjs
// PM Delivery V2 — S1.2: the durable local supervisor store.
//
// "Use one local service and one local-disk transactional store, not
// network-shared SQLite. Pin a supported binding in S0/S1 and test transactions,
// durable writes and restore. Publish immutable artifacts via temporary
// write/flush/rename/hash verification before committing references."
//   — "PM Delivery — V2 Architecture.md" §9
//
// The binding: node:sqlite
// ------------------------
// Node 22.20's built-in `node:sqlite` (DatabaseSync + the `backup` helper) is the
// pinned binding. It was chosen over better-sqlite3 for one reason that outweighs
// its experimental flag: it is *already here*. A native addon would add a
// compiled dependency to a repo whose only other native packages are build-time
// image tools, and the delivery supervisor is exactly the component that must
// still start after a Node upgrade breaks someone's prebuilt binary. It provides
// what §9 asks for — real transactions, durable writes, and a backup API that
// copies a live database rather than a file nobody has quiesced.
//
// No ORM, by instruction and by preference: the schema below is nine tables of
// plain SQL, and the invariants that matter are enforced *in* it.
//
// Three invariants live in the schema rather than in calling code
// ---------------------------------------------------------------
//   1. `CHECK (dispatch_key = job_id)` — V2-I04's identity equation cannot drift
//      in storage, whatever a future caller does.
//   2. `PRIMARY KEY (job_id, reading_key)` on usage readings, written with
//      INSERT OR IGNORE — a cumulative reading seen twice is a no-op. F-COST's
//      "duplicate-usage does not double-count" is therefore a property of the
//      table, not a property of whoever remembered to deduplicate.
//   3. `commands.command_id` is a primary key carrying its actor and payload
//      digest — a repeated command finds its own receipt; the same id with a
//      different payload or actor is a conflict, not an update.
//
// Nothing here decides anything. Admission, authority and reconciliation are
// jobs.mjs; this module stores and retrieves, and refuses writes that would break
// an invariant.

import { createHash } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, fsyncSync } from "node:fs";
import { dirname, join } from "node:path";

import { ContractError, canonicalJson, deepFreeze, normalizePath } from "./contracts.mjs";

// 2 adds `work_refs` and `contracts` for the S1.4 entry point. Both are additive
// `CREATE TABLE IF NOT EXISTS`, so an existing store opens and keeps its rows.
// 3 (Command Center Phase 3) adds the dispatch claim/intent and per-run settings
// columns plus the interaction and evidence tables. Columns are added by
// `ensureColumns`, so a schema-2 store migrates in place without losing rows.
// 4 (Command Center Phase 4) adds `applications`: one owner-triggered Apply of a
// verified candidate to the host checkout. A partial unique index is the
// exclusive application claim, so two applications to one destination cannot be
// in flight at once whatever the callers do.
// 5 (Command Center Phase 5) adds `runs.coordination_json`: a waiting run's verdict,
// reasons and the continuation to admit when they clear.
// 6 keeps cache creation separate from cache reads and adds an application
// revision. A rollback preview is bound to that revision.
export const STORE_SCHEMA_VERSION = 6;

/** Application states that hold the destination's exclusive claim. */
export const ACTIVE_APPLICATION_STATES = Object.freeze(["prepared", "writing", "checking", "rolling-back", "interrupted"]);

/** Where a store and its artifacts live. Gitignored (`/.delivery/` in .gitignore). */
export const STORE_DIR = ".delivery/v2";
export const ARTIFACT_DIR = ".delivery/v2/artifacts/blobs";

/** Reasons a store operation refuses. Callers and fixtures match on codes. */
export const STORE_REFUSALS = Object.freeze({
  COMMAND_CONFLICT: "command-id-reused-with-different-payload",
  ACTOR_CONFLICT: "command-id-reused-by-another-actor",
  DISPATCH_KEY_MISMATCH: "dispatch-key-must-equal-job-id",
  MISSING_BLOB: "referenced-artifact-missing",
  BLOB_CORRUPT: "referenced-artifact-hash-mismatch",
  UNKNOWN_JOB: "unknown-job",
  NATIVE_REF_CONFLICT: "native-ref-already-bound",
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  run_id            TEXT PRIMARY KEY,
  work_id           TEXT NOT NULL,
  contract_id       TEXT NOT NULL,
  contract_revision INTEGER NOT NULL,
  grant_id          TEXT,
  grant_revision    INTEGER,
  lifecycle         TEXT NOT NULL,
  closed_outcome    TEXT,
  result_ref        TEXT,
  waiting_reason    TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id              TEXT PRIMARY KEY,
  run_id              TEXT NOT NULL REFERENCES runs(run_id),
  purpose             TEXT NOT NULL,
  backend_id          TEXT NOT NULL,
  -- V2-I04 in the schema: the dispatch key IS the job id, and no code path can
  -- store a row where they disagree.
  dispatch_key        TEXT NOT NULL UNIQUE CHECK (dispatch_key = job_id),
  native_ref          TEXT,
  status              TEXT NOT NULL,
  outcome             TEXT,
  contract_id         TEXT NOT NULL,
  contract_revision   INTEGER NOT NULL,
  grant_id            TEXT NOT NULL,
  grant_revision      INTEGER NOT NULL,
  profile_id          TEXT,
  reservation_unit    TEXT NOT NULL,
  reservation_amount  REAL,
  reservation_basis   TEXT NOT NULL,
  reservation_open    INTEGER NOT NULL DEFAULT 1,
  -- NULL means "known undispatched". Non-NULL means "potentially dispatched",
  -- even if the request may never have left the process.
  dispatch_started_at TEXT,
  request_json        TEXT NOT NULL,
  observations_json   TEXT,
  reason              TEXT,
  publication_revoked INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_run ON jobs(run_id);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS usage_readings (
  job_id           TEXT NOT NULL REFERENCES jobs(job_id),
  -- The identity of a *reading*, not of a job. Two observations of the same
  -- cumulative counter share it, so the second insert is a no-op.
  reading_key      TEXT NOT NULL,
  unit             TEXT NOT NULL,
  input            REAL NOT NULL DEFAULT 0,
  cached_input     REAL NOT NULL DEFAULT 0,
  cache_creation   REAL NOT NULL DEFAULT 0,
  output           REAL NOT NULL DEFAULT 0,
  reasoning_output REAL NOT NULL DEFAULT 0,
  cost_usd         REAL,
  observed_at      TEXT NOT NULL,
  note             TEXT,
  PRIMARY KEY (job_id, reading_key)
);

CREATE TABLE IF NOT EXISTS commands (
  command_id     TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,
  actor          TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  subject_id     TEXT,
  outcome_json   TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id     TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  actor          TEXT,
  payload_digest TEXT,
  state_before   TEXT,
  state_after    TEXT,
  observed_json  TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS receipts_subject ON receipts(subject_id);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  path        TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  decision_id      TEXT PRIMARY KEY,
  run_id           TEXT,
  subject_id       TEXT NOT NULL,
  subject_revision INTEGER NOT NULL,
  kind             TEXT NOT NULL,
  requested        TEXT,
  actor            TEXT,
  answer           TEXT,
  evidence_seen    TEXT,
  supersedes       TEXT,
  created_at       TEXT NOT NULL
);

-- Only rows for items the owner actually selected. Architecture §4: "Initial
-- WorkRef mapping covers only selected uniquely identifiable items… Do not adopt
-- the entire backlog into a new lifecycle database."
CREATE TABLE IF NOT EXISTS work_refs (
  work_id          TEXT PRIMARY KEY,
  file             TEXT NOT NULL,
  alias            TEXT,
  text_fingerprint TEXT NOT NULL,
  heading          TEXT,
  mapping_revision INTEGER NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- One row per authorized Contract *revision*. Immutable: a revision is never
-- updated in place, because a run's history has to keep pointing at the exact
-- text that was authorized.
CREATE TABLE IF NOT EXISTS contracts (
  contract_id   TEXT NOT NULL,
  revision      INTEGER NOT NULL,
  work_id       TEXT NOT NULL,
  contract_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (contract_id, revision)
);

CREATE TABLE IF NOT EXISTS grants (
  grant_id           TEXT PRIMARY KEY,
  contract_id        TEXT NOT NULL,
  contract_revision  INTEGER NOT NULL,
  policy_revision    INTEGER NOT NULL,
  revocation_version INTEGER NOT NULL DEFAULT 0,
  grant_json         TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- Schema 3. A plan is one readable proposal revision; approval binds to it.
CREATE TABLE IF NOT EXISTS plans (
  plan_id           TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES runs(run_id),
  revision          INTEGER NOT NULL,
  contract_id       TEXT NOT NULL,
  contract_revision INTEGER NOT NULL,
  job_id            TEXT,
  body_json         TEXT NOT NULL,
  body_digest       TEXT NOT NULL,
  raw_text          TEXT,
  malformed         INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (run_id, revision)
);

CREATE TABLE IF NOT EXISTS questions (
  question_id   TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(run_id),
  plan_revision INTEGER NOT NULL,
  job_id        TEXT,
  stage         TEXT NOT NULL,
  text          TEXT NOT NULL,
  blocking      INTEGER NOT NULL,
  status        TEXT NOT NULL,
  answer        TEXT,
  answered_by   TEXT,
  answered_at   TEXT,
  created_at    TEXT NOT NULL
);

-- Owner guidance. The status is a receipt, never "read": queued until a job
-- carries it, delivered once that job's dispatch marker is committed.
CREATE TABLE IF NOT EXISTS messages (
  message_id   TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES runs(run_id),
  actor        TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL,
  job_id       TEXT,
  delivered_at TEXT,
  created_at   TEXT NOT NULL
);

-- Observed native activity. Agent identity comes from the executor's own
-- records; nothing here is inferred from a phase name.
CREATE TABLE IF NOT EXISTS activity (
  job_id     TEXT NOT NULL REFERENCES jobs(job_id),
  seq        INTEGER NOT NULL,
  run_id     TEXT NOT NULL,
  at         TEXT,
  kind       TEXT NOT NULL,
  agent_json TEXT NOT NULL,
  summary    TEXT,
  PRIMARY KEY (job_id, seq)
);

CREATE TABLE IF NOT EXISTS candidates (
  run_id       TEXT NOT NULL REFERENCES runs(run_id),
  generation   TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  job_id       TEXT,
  record_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (run_id, generation)
);

CREATE TABLE IF NOT EXISTS evidence (
  evidence_id        TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES runs(run_id),
  candidate_id       TEXT NOT NULL,
  criterion_id       TEXT NOT NULL,
  criterion_revision INTEGER NOT NULL,
  state              TEXT NOT NULL,
  reason             TEXT,
  receipt_json       TEXT,
  record_json        TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_run ON evidence(run_id, candidate_id);

CREATE TABLE IF NOT EXISTS results (
  result_id         TEXT NOT NULL,
  result_version    INTEGER NOT NULL,
  run_id            TEXT NOT NULL REFERENCES runs(run_id),
  record_json       TEXT NOT NULL,
  projection_status TEXT NOT NULL,
  projection_reason TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (result_id, result_version)
);

CREATE TABLE IF NOT EXISTS run_events (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id    TEXT NOT NULL,
  kind      TEXT NOT NULL,
  data_json TEXT,
  at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS run_events_run ON run_events(run_id, seq);

-- Schema 4. One owner-triggered application of a frozen candidate to the host
-- checkout. The bytes, backups and per-operation journal live outside the checkout
-- (journal_dir); this row is the claim, the state and the observed outcome.
CREATE TABLE IF NOT EXISTS applications (
  application_id TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES runs(run_id),
  candidate_id   TEXT NOT NULL,
  result_ref     TEXT NOT NULL,
  destination    TEXT NOT NULL,
  state          TEXT NOT NULL,
  claim          TEXT,
  plan_json      TEXT NOT NULL,
  journal_dir    TEXT,
  integrated_id  TEXT,
  outcome_json   TEXT,
  actor          TEXT NOT NULL,
  command_id     TEXT NOT NULL,
  revision       INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_run ON applications(run_id, created_at);
-- The exclusive application claim: at most one in-flight application per destination.
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_active ON applications(destination)
  WHERE state IN ('prepared', 'writing', 'checking', 'rolling-back', 'interrupted');
`;

/**
 * Columns added after a table first shipped. `CREATE TABLE IF NOT EXISTS` never
 * alters an existing table, so each is added only where it is missing.
 */
const ADDED_COLUMNS = Object.freeze({
  jobs: [
    ["access", "TEXT NOT NULL DEFAULT 'write'"],
    ["settings_json", "TEXT"],
    ["effective_json", "TEXT"],
    ["dispatch_claim", "TEXT"],
    ["dispatch_claimed_at", "TEXT"],
    ["intent_json", "TEXT"],
    ["plan_id", "TEXT"],
    ["stop_requested_at", "TEXT"],
    ["stop_observed_at", "TEXT"],
  ],
  runs: [
    ["settings_json", "TEXT"],
    ["base_manifest_json", "TEXT"],
    ["coordination_json", "TEXT"],
  ],
  usage_readings: [["cache_creation", "REAL NOT NULL DEFAULT 0"]],
  applications: [["revision", "INTEGER NOT NULL DEFAULT 1"]],
});

const sha256 = (buffer) => "sha256:" + createHash("sha256").update(buffer).digest("hex");

/** Stable digest of a command payload, so "the same command" is a defined thing. */
export function payloadDigest(payload) {
  return sha256(Buffer.from(canonicalJson(payload ?? null), "utf8"));
}

/**
 * Open (creating if needed) the supervisor store.
 *
 * `synchronous = FULL` rather than the WAL default of NORMAL. The whole point of
 * this store is that a crash between "we decided to dispatch" and "we called the
 * provider" leaves a record; a durability mode that can lose the last commit on
 * power loss would quietly reintroduce the hole the `dispatch_started_at` marker
 * exists to close.
 *
 * @param {{path:string, now?:Function}} input
 */
export function openStore({ path, now = () => new Date().toISOString() }) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  // A second process (the bridge, a restarted server) waits for the write lock
  // instead of failing an admission outright.
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = FULL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const present = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
    for (const [name, ddl] of columns) {
      if (!present.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  }
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run("schema_version", String(STORE_SCHEMA_VERSION));

  const statements = new Map();
  /** Prepared-statement cache; SQLite is happier and the call sites stay short. */
  const sql = (text) => {
    if (!statements.has(text)) statements.set(text, db.prepare(text));
    return statements.get(text);
  };

  /**
   * Run `fn` inside one transaction.
   *
   * BEGIN IMMEDIATE, so a writer takes its lock up front instead of discovering
   * a conflict at COMMIT after it has already decided to dispatch. Nested calls
   * join the outer transaction rather than opening a second one — SQLite has no
   * nested BEGIN, and silently committing an inner unit of work would break the
   * all-or-nothing property that admission depends on.
   */
  let depth = 0;
  function transaction(fn) {
    if (depth > 0) return fn(api);
    db.exec("BEGIN IMMEDIATE");
    depth += 1;
    try {
      const result = fn(api);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* a rollback failure must not mask the original error */
      }
      throw error;
    } finally {
      depth -= 1;
    }
  }

  const api = {
    path: normalizePath(path),
    db,
    now,
    transaction,

    close() {
      statements.clear();
      db.close();
    },

    // -- runs ---------------------------------------------------------------

    insertRun(run) {
      const at = now();
      sql(
        `INSERT INTO runs (run_id, work_id, contract_id, contract_revision, grant_id, grant_revision,
           lifecycle, closed_outcome, result_ref, waiting_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      ).run(
        run.run_id,
        run.work_id,
        run.contract_id,
        run.contract_revision,
        run.grant_id ?? null,
        run.grant_revision ?? null,
        run.lifecycle || "DRAFT",
        at,
        at,
      );
      return api.getRun(run.run_id);
    },

    getRun(run_id) {
      return sql("SELECT * FROM runs WHERE run_id = ?").get(run_id) || null;
    },

    updateRun(run_id, patch) {
      const current = api.getRun(run_id);
      if (!current) throw new ContractError("unknown run " + run_id);
      const next = { ...current, ...patch, updated_at: now() };
      const json = (value) => (value == null ? null : typeof value === "string" ? value : JSON.stringify(value));
      sql(
        `UPDATE runs SET lifecycle = ?, closed_outcome = ?, result_ref = ?, waiting_reason = ?,
           grant_id = ?, grant_revision = ?, settings_json = ?, base_manifest_json = ?, coordination_json = ?, updated_at = ? WHERE run_id = ?`,
      ).run(
        next.lifecycle,
        next.closed_outcome ?? null,
        next.result_ref ?? null,
        next.waiting_reason ?? null,
        next.grant_id ?? null,
        next.grant_revision ?? null,
        json(next.settings_json),
        json(next.base_manifest_json),
        json(next.coordination_json),
        next.updated_at,
        run_id,
      );
      return api.getRun(run_id);
    },

    listRuns() {
      return sql("SELECT * FROM runs ORDER BY updated_at DESC, run_id").all();
    },

    // -- selected work and frozen contracts ---------------------------------

    /**
     * Persist the mapping for one selected item.
     *
     * Upsert on the *mapping revision*, not on the fingerprint: a re-selection of
     * unchanged content is idempotent (S0.1's determinism property), and a rebind
     * arrives with a bumped revision because `rebindWorkRef` is the only thing
     * that can produce one.
     */
    putWorkRef(workRef) {
      const at = now();
      sql(
        `INSERT INTO work_refs (work_id, file, alias, text_fingerprint, heading, mapping_revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(work_id) DO UPDATE SET
           file = excluded.file,
           alias = excluded.alias,
           text_fingerprint = excluded.text_fingerprint,
           heading = excluded.heading,
           mapping_revision = excluded.mapping_revision,
           updated_at = excluded.updated_at`,
      ).run(
        workRef.work_id,
        workRef.locator.file,
        workRef.locator.alias ?? null,
        workRef.locator.textFingerprint,
        workRef.locator.heading ?? null,
        workRef.mapping_revision,
        at,
        at,
      );
      return api.getWorkRef(workRef.work_id);
    },

    getWorkRef(work_id) {
      return sql("SELECT * FROM work_refs WHERE work_id = ?").get(work_id) || null;
    },

    listWorkRefs() {
      return sql("SELECT * FROM work_refs ORDER BY created_at, work_id").all();
    },

    /**
     * Store one authorized Contract revision.
     *
     * INSERT OR IGNORE, never a replace. A Contract is immutable once authorized;
     * the only legal way for its content to change is a new revision, and letting
     * a re-authorization overwrite a stored one would silently rewrite the terms a
     * completed job ran under.
     */
    putContract(contract) {
      sql(
        `INSERT OR IGNORE INTO contracts (contract_id, revision, work_id, contract_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(contract.contract_id, contract.revision, contract.work_id, JSON.stringify(contract), now());
      return api.getContract(contract.contract_id, contract.revision);
    },

    getContract(contract_id, revision) {
      const row = sql("SELECT * FROM contracts WHERE contract_id = ? AND revision = ?").get(contract_id, revision);
      return row ? JSON.parse(String(row.contract_json)) : null;
    },

    // -- grants -------------------------------------------------------------

    putGrant(grant) {
      const at = now();
      sql(
        `INSERT INTO grants (grant_id, contract_id, contract_revision, policy_revision,
           revocation_version, grant_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(grant_id) DO UPDATE SET
           revocation_version = excluded.revocation_version,
           grant_json = excluded.grant_json,
           updated_at = excluded.updated_at`,
      ).run(
        grant.grant_id,
        grant.contract_id,
        grant.contract_revision,
        grant.policy_revision,
        grant.revocation_version,
        JSON.stringify(grant),
        at,
        at,
      );
      return api.getGrant(grant.grant_id);
    },

    getGrant(grant_id) {
      const row = sql("SELECT * FROM grants WHERE grant_id = ?").get(grant_id);
      return row ? JSON.parse(String(row.grant_json)) : null;
    },

    // -- jobs ---------------------------------------------------------------

    /**
     * Persist a reserved job. The executionRef is stored *before* anything is
     * dispatched — that is the whole reason this function exists separately from
     * `markDispatchStarted`.
     */
    insertJob(job) {
      if (job.dispatch_key !== job.job_id) {
        throw new ContractError(STORE_REFUSALS.DISPATCH_KEY_MISMATCH);
      }
      const at = now();
      sql(
        `INSERT INTO jobs (job_id, run_id, purpose, backend_id, dispatch_key, native_ref, status, outcome,
           contract_id, contract_revision, grant_id, grant_revision, profile_id,
           reservation_unit, reservation_amount, reservation_basis, reservation_open,
           dispatch_started_at, request_json, observations_json, reason, publication_revoked,
           access, settings_json, plan_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'reserved', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, NULL, NULL, 0, ?, ?, ?, ?, ?)`,
      ).run(
        job.job_id,
        job.run_id,
        job.purpose,
        job.backend_id,
        job.dispatch_key,
        job.contract_id,
        job.contract_revision,
        job.grant_id,
        job.grant_revision,
        job.profile_id ?? null,
        job.reservation.unit,
        job.reservation.amount ?? null,
        job.reservation.basis,
        JSON.stringify(job.request ?? null),
        job.access || "write",
        job.settings == null ? null : JSON.stringify(job.settings),
        job.plan_id ?? null,
        at,
        at,
      );
      return api.getJob(job.job_id);
    },

    /**
     * Take the exclusive right to dispatch one reserved job.
     *
     * The conditional UPDATE is the claim: of two callers racing on the same job,
     * exactly one sees `changes === 1`. An idempotent dispatch marker cannot do
     * this, because both callers would find it absent before either set it.
     * The dispatch intent is recorded in the same statement, so a claim never
     * exists without the checks it was granted under.
     *
     * @returns {{acquired:boolean, holder:(string|null), job:object, reason:(string|null)}}
     */
    claimDispatch(job_id, claimant, intent = null) {
      const job = api.getJob(job_id);
      if (!job) throw new ContractError(STORE_REFUSALS.UNKNOWN_JOB + ": " + job_id);
      if (job.dispatch_started_at) return { acquired: false, holder: job.dispatch_claim ?? null, job, reason: "already-dispatched" };
      // Held already — by anyone, including this claimant. A second call from the
      // same process is a second dispatch attempt, not an idempotent retry.
      if (job.dispatch_claim) return { acquired: false, holder: String(job.dispatch_claim), job, reason: "claim-held" };
      if (job.status !== "reserved") return { acquired: false, holder: null, job, reason: "job-not-reserved" };
      const at = now();
      const outcome = sql(
        `UPDATE jobs SET dispatch_claim = ?, dispatch_claimed_at = ?, intent_json = ?, updated_at = ?
          WHERE job_id = ? AND dispatch_claim IS NULL AND dispatch_started_at IS NULL AND status = 'reserved'`,
      ).run(claimant, at, intent == null ? null : JSON.stringify(intent), at, job_id);
      const after = api.getJob(job_id);
      return Number(outcome.changes) === 1
        ? { acquired: true, holder: claimant, job: after, reason: null }
        : { acquired: false, holder: after.dispatch_claim ?? null, job: after, reason: "claim-held" };
    },

    /** Record the checks a claim was dispatched under. Only the holder may. */
    recordDispatchIntent(job_id, claimant, intent) {
      const at = now();
      sql("UPDATE jobs SET intent_json = ?, updated_at = ? WHERE job_id = ? AND dispatch_claim = ?").run(
        JSON.stringify(intent ?? null),
        at,
        job_id,
        claimant,
      );
      return api.getJob(job_id);
    },

    /** Give up a claim that never reached its dispatch marker. */
    releaseClaim(job_id, claimant = null) {
      const at = now();
      const outcome = claimant
        ? sql(
            "UPDATE jobs SET dispatch_claim = NULL, dispatch_claimed_at = NULL, updated_at = ? WHERE job_id = ? AND dispatch_claim = ? AND dispatch_started_at IS NULL",
          ).run(at, job_id, claimant)
        : sql(
            "UPDATE jobs SET dispatch_claim = NULL, dispatch_claimed_at = NULL, updated_at = ? WHERE job_id = ? AND dispatch_started_at IS NULL",
          ).run(at, job_id);
      return Number(outcome.changes) === 1;
    },

    /** Reserved jobs whose claim was taken but whose marker never committed. */
    listClaimedUndispatched() {
      return sql(
        "SELECT * FROM jobs WHERE dispatch_claim IS NOT NULL AND dispatch_started_at IS NULL AND status = 'reserved' ORDER BY created_at, job_id",
      ).all();
    },

    setJobEffective(job_id, effective) {
      sql("UPDATE jobs SET effective_json = ?, updated_at = ? WHERE job_id = ?").run(JSON.stringify(effective ?? null), now(), job_id);
      return api.getJob(job_id);
    },

    markStopRequested(job_id, at = null) {
      sql("UPDATE jobs SET stop_requested_at = COALESCE(stop_requested_at, ?), updated_at = ? WHERE job_id = ?").run(at || now(), now(), job_id);
      return api.getJob(job_id);
    },

    markStopObserved(job_id, at = null) {
      sql("UPDATE jobs SET stop_observed_at = COALESCE(stop_observed_at, ?), updated_at = ? WHERE job_id = ?").run(at || now(), now(), job_id);
      return api.getJob(job_id);
    },

    getJob(job_id) {
      return sql("SELECT * FROM jobs WHERE job_id = ?").get(job_id) || null;
    },

    /** Reconciliation by dispatch key — available in the *store* even when the backend has no such lookup. */
    getJobByDispatchKey(dispatch_key) {
      return sql("SELECT * FROM jobs WHERE dispatch_key = ?").get(dispatch_key) || null;
    },

    listJobs(run_id) {
      return sql("SELECT * FROM jobs WHERE run_id = ? ORDER BY created_at, job_id").all(run_id);
    },

    /** Every job of every run: the fleet a coordination check counts. */
    listAllJobs() {
      return sql("SELECT * FROM jobs ORDER BY created_at, job_id").all();
    },

    /** Jobs that a restart must reconcile before anything new is dispatched. */
    listOutstandingJobs() {
      return sql(
        `SELECT * FROM jobs
          WHERE status IN ('reserved', 'active', 'paused', 'unknown')
          ORDER BY created_at, job_id`,
      ).all();
    },

    /**
     * Commit the dispatch marker.
     *
     * Idempotent: a second call keeps the first timestamp. Re-marking would move
     * the boundary that recovery reasons about, and the earliest possible moment
     * is the true one.
     */
    markDispatchStarted(job_id, at) {
      const job = api.getJob(job_id);
      if (!job) throw new ContractError(STORE_REFUSALS.UNKNOWN_JOB + ": " + job_id);
      if (job.dispatch_started_at) return job;
      sql("UPDATE jobs SET dispatch_started_at = ?, status = 'active', updated_at = ? WHERE job_id = ?").run(
        at || now(),
        now(),
        job_id,
      );
      return api.getJob(job_id);
    },

    /**
     * Bind the backend's own identity to this dispatch.
     *
     * A second, different native reference behind one dispatch key is refused: it
     * means two native sessions are attributable to one admitted job, which is
     * the overlap the boundary exists to notice rather than absorb.
     */
    bindNativeRef(job_id, native_ref) {
      const job = api.getJob(job_id);
      if (!job) throw new ContractError(STORE_REFUSALS.UNKNOWN_JOB + ": " + job_id);
      if (job.native_ref && job.native_ref !== native_ref) {
        throw new ContractError(STORE_REFUSALS.NATIVE_REF_CONFLICT + ": " + job.native_ref + " vs " + native_ref);
      }
      sql("UPDATE jobs SET native_ref = ?, updated_at = ? WHERE job_id = ?").run(native_ref, now(), job_id);
      return api.getJob(job_id);
    },

    updateJob(job_id, patch) {
      const job = api.getJob(job_id);
      if (!job) throw new ContractError(STORE_REFUSALS.UNKNOWN_JOB + ": " + job_id);
      const next = { ...job, ...patch };
      sql(
        `UPDATE jobs SET status = ?, outcome = ?, observations_json = ?, reason = ?,
           reservation_open = ?, publication_revoked = ?, updated_at = ? WHERE job_id = ?`,
      ).run(
        next.status,
        next.outcome ?? null,
        typeof next.observations_json === "string" ? next.observations_json : JSON.stringify(next.observations_json ?? null),
        next.reason ?? null,
        next.reservation_open ? 1 : 0,
        next.publication_revoked ? 1 : 0,
        now(),
        job_id,
      );
      return api.getJob(job_id);
    },

    // -- usage --------------------------------------------------------------

    /**
     * Record one usage reading.
     *
     * INSERT OR IGNORE against a (job_id, reading_key) primary key. The duplicate
     * case is not an error and not an update — it is the same fact arriving
     * twice, and the correct response is to keep the first copy and move on.
     * Returns whether the row was new, so a caller can tell the difference.
     */
    recordUsageReading(job_id, reading) {
      const before = api.countUsageReadings(job_id);
      sql(
        `INSERT OR IGNORE INTO usage_readings
           (job_id, reading_key, unit, input, cached_input, cache_creation, output, reasoning_output, cost_usd, observed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        job_id,
        String(reading.reading_key),
        reading.unit || "tokens",
        Number(reading.input || 0),
        Number(reading.cachedInput || 0),
        Number(reading.cacheCreation || 0),
        Number(reading.output || 0),
        Number(reading.reasoningOutput || 0),
        reading.costUsd == null ? null : Number(reading.costUsd),
        reading.observed_at || now(),
        reading.note ?? null,
      );
      return { inserted: api.countUsageReadings(job_id) > before };
    },

    countUsageReadings(job_id) {
      return Number(sql("SELECT COUNT(*) AS n FROM usage_readings WHERE job_id = ?").get(job_id).n);
    },

    listUsageReadings(job_id) {
      return sql("SELECT * FROM usage_readings WHERE job_id = ? ORDER BY reading_key").all(job_id);
    },

    // -- commands and receipts ---------------------------------------------

    /**
     * Reserve a command id, or hand back the receipt of the one already recorded.
     *
     * Three outcomes, and the caller must distinguish them: `created` (this is a
     * new command), `duplicate` (the same actor sent the same payload again — the
     * prior outcome is returned and nothing is re-run), and `conflict` (the id was
     * reused with a different payload or by a different actor, which is never a
     * retry).
     *
     * @param {{command_id:string, kind:string, actor:string, payload?:unknown, subject_id?:(string|null)}} input
     * @returns {{status:"created"|"duplicate"|"conflict", reason:(string|null),
     *   receipt:Record<string, unknown>, outcome?:(Record<string, unknown>|null)}}
     */
    admitCommand({ command_id, kind, actor, payload, subject_id = null }) {
      const digest = payloadDigest(payload);
      const existing = sql("SELECT * FROM commands WHERE command_id = ?").get(command_id);
      if (existing) {
        if (existing.actor !== actor) {
          return deepFreeze({ status: "conflict", reason: STORE_REFUSALS.ACTOR_CONFLICT, receipt: existing });
        }
        if (existing.payload_digest !== digest) {
          return deepFreeze({ status: "conflict", reason: STORE_REFUSALS.COMMAND_CONFLICT, receipt: existing });
        }
        return deepFreeze({
          status: "duplicate",
          reason: null,
          receipt: existing,
          outcome: existing.outcome_json ? JSON.parse(String(existing.outcome_json)) : null,
        });
      }
      sql(
        "INSERT INTO commands (command_id, kind, actor, payload_digest, subject_id, outcome_json, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)",
      ).run(command_id, kind, actor, digest, subject_id, now());
      return deepFreeze({ status: "created", reason: null, receipt: sql("SELECT * FROM commands WHERE command_id = ?").get(command_id) });
    },

    getCommand(command_id) {
      return sql("SELECT * FROM commands WHERE command_id = ?").get(command_id) || null;
    },

    recordCommandOutcome(command_id, outcome) {
      sql("UPDATE commands SET outcome_json = ? WHERE command_id = ?").run(JSON.stringify(outcome ?? null), command_id);
      return sql("SELECT * FROM commands WHERE command_id = ?").get(command_id);
    },

    putReceipt(receipt) {
      sql(
        `INSERT OR REPLACE INTO receipts
           (receipt_id, kind, subject_id, actor, payload_digest, state_before, state_after, observed_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        receipt.receipt_id,
        receipt.kind,
        receipt.subject_id,
        receipt.actor ?? null,
        receipt.payload_digest ?? null,
        receipt.state_before ?? null,
        receipt.state_after ?? null,
        JSON.stringify(receipt.observed ?? null),
        now(),
      );
      return sql("SELECT * FROM receipts WHERE receipt_id = ?").get(receipt.receipt_id);
    },

    listReceipts(subject_id) {
      return sql("SELECT * FROM receipts WHERE subject_id = ? ORDER BY created_at, receipt_id").all(subject_id);
    },

    // -- decisions ----------------------------------------------------------

    putDecision(decision) {
      sql(
        `INSERT OR REPLACE INTO decisions
           (decision_id, run_id, subject_id, subject_revision, kind, requested, actor, answer, evidence_seen, supersedes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        decision.decision_id,
        decision.run_id ?? null,
        decision.subject_id,
        decision.subject_revision,
        decision.kind,
        decision.requested ?? null,
        decision.actor ?? null,
        decision.answer ?? null,
        JSON.stringify(decision.evidence_seen ?? null),
        decision.supersedes ?? null,
        now(),
      );
      return sql("SELECT * FROM decisions WHERE decision_id = ?").get(decision.decision_id);
    },

    listDecisions(run_id) {
      return sql("SELECT * FROM decisions WHERE run_id = ? ORDER BY created_at, decision_id").all(run_id);
    },

    getDecision(decision_id) {
      return sql("SELECT * FROM decisions WHERE decision_id = ?").get(decision_id) || null;
    },

    // -- plans, questions and messages (schema 3) -------------------------

    putPlan(plan) {
      const at = now();
      sql(
        `INSERT INTO plans (plan_id, run_id, revision, contract_id, contract_revision, job_id, body_json, body_digest,
           raw_text, malformed, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        plan.plan_id,
        plan.run_id,
        plan.revision,
        plan.contract_id,
        plan.contract_revision,
        plan.job_id ?? null,
        JSON.stringify(plan.body ?? null),
        plan.body_digest,
        plan.raw_text ?? null,
        plan.malformed ? 1 : 0,
        plan.status,
        at,
        at,
      );
      return api.getPlan(plan.plan_id);
    },

    getPlan(plan_id) {
      return sql("SELECT * FROM plans WHERE plan_id = ?").get(plan_id) || null;
    },

    listPlans(run_id) {
      return sql("SELECT * FROM plans WHERE run_id = ? ORDER BY revision").all(run_id);
    },

    setPlanStatus(plan_id, status) {
      sql("UPDATE plans SET status = ?, updated_at = ? WHERE plan_id = ?").run(status, now(), plan_id);
      return api.getPlan(plan_id);
    },

    putQuestion(question) {
      sql(
        `INSERT OR IGNORE INTO questions (question_id, run_id, plan_revision, job_id, stage, text, blocking, status,
           answer, answered_by, answered_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      ).run(
        question.question_id,
        question.run_id,
        question.plan_revision,
        question.job_id ?? null,
        question.stage,
        question.text,
        question.blocking ? 1 : 0,
        question.status || "open",
        now(),
      );
      return api.getQuestion(question.question_id);
    },

    getQuestion(question_id) {
      return sql("SELECT * FROM questions WHERE question_id = ?").get(question_id) || null;
    },

    listQuestions(run_id) {
      return sql("SELECT * FROM questions WHERE run_id = ? ORDER BY created_at, question_id").all(run_id);
    },

    answerQuestion(question_id, { answer, actor, at = null }) {
      const outcome = sql(
        "UPDATE questions SET status = 'answered', answer = ?, answered_by = ?, answered_at = ? WHERE question_id = ? AND status = 'open'",
      ).run(answer, actor, at || now(), question_id);
      return Number(outcome.changes) === 1;
    },

    supersedeQuestions(run_id, { beforeRevision = null, stage = null } = {}) {
      const clauses = ["run_id = ?", "status = 'open'"];
      const params = [run_id];
      if (beforeRevision != null) {
        clauses.push("plan_revision < ?");
        params.push(beforeRevision);
      }
      if (stage) {
        clauses.push("stage = ?");
        params.push(stage);
      }
      return Number(sql("UPDATE questions SET status = 'superseded' WHERE " + clauses.join(" AND ")).run(...params).changes);
    },

    putMessage(message) {
      sql(
        `INSERT OR IGNORE INTO messages (message_id, run_id, actor, body, status, job_id, delivered_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
      ).run(message.message_id, message.run_id, message.actor, message.body, message.status || "queued", now());
      return sql("SELECT * FROM messages WHERE message_id = ?").get(message.message_id) || null;
    },

    listMessages(run_id) {
      return sql("SELECT * FROM messages WHERE run_id = ? ORDER BY created_at, message_id").all(run_id);
    },

    /** Attach every still-queued message to the job that will carry it. */
    attachQueuedMessages(run_id, job_id) {
      sql("UPDATE messages SET status = 'awaiting-dispatch', job_id = ? WHERE run_id = ? AND status = 'queued'").run(job_id, run_id);
      return sql("SELECT * FROM messages WHERE job_id = ? ORDER BY created_at, message_id").all(job_id);
    },

    /** The carrying job reached its marker: the text was handed to the executor. */
    markMessagesDelivered(job_id, at = null) {
      sql("UPDATE messages SET status = 'delivered', delivered_at = ? WHERE job_id = ? AND status = 'awaiting-dispatch'").run(at || now(), job_id);
    },

    /** The carrying job never dispatched: its messages return to the queue. */
    requeueMessages(job_id) {
      sql("UPDATE messages SET status = 'queued', job_id = NULL WHERE job_id = ? AND status = 'awaiting-dispatch'").run(job_id);
    },

    // -- observed activity -------------------------------------------------

    appendActivity(run_id, job_id, entries) {
      const start = Number(sql("SELECT COALESCE(MAX(seq), -1) AS m FROM activity WHERE job_id = ?").get(job_id).m) + 1;
      const insert = sql(
        "INSERT OR IGNORE INTO activity (job_id, seq, run_id, at, kind, agent_json, summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      (entries || []).forEach((entry, index) => {
        insert.run(
          job_id,
          start + index,
          run_id,
          entry.at ?? null,
          String(entry.kind || "event"),
          JSON.stringify(entry.agent ?? { role: "main" }),
          entry.summary == null ? null : String(entry.summary).slice(0, 400),
        );
      });
    },

    listActivity(run_id, limit = 200) {
      return sql("SELECT * FROM activity WHERE run_id = ? ORDER BY rowid DESC LIMIT ?").all(run_id, limit).reverse();
    },

    /** Native subagent activity the executors reported, for fleet accounting. */
    listSubagentActivity() {
      return sql(`SELECT DISTINCT job_id, agent_json FROM activity WHERE agent_json LIKE '%"role":"subagent"%'`).all();
    },

    // -- candidates, evidence and results -----------------------------------

    putCandidate({ run_id, generation, candidate, job_id = null }) {
      sql(
        "INSERT OR IGNORE INTO candidates (run_id, generation, candidate_id, job_id, record_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(run_id, generation, candidate.candidate_id, job_id, JSON.stringify(candidate), now());
      return api.listCandidates(run_id).find((row) => row.generation === generation) || null;
    },

    listCandidates(run_id) {
      return sql("SELECT * FROM candidates WHERE run_id = ? ORDER BY created_at, generation").all(run_id);
    },

    putEvidence(record) {
      sql(
        `INSERT OR REPLACE INTO evidence (evidence_id, run_id, candidate_id, criterion_id, criterion_revision, state, reason,
           receipt_json, record_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.evidence_id,
        record.run_id,
        record.candidate_id,
        record.criterion_id,
        record.criterion_revision,
        record.state,
        record.reason ?? null,
        record.receipt == null ? null : JSON.stringify(record.receipt),
        JSON.stringify(record.record ?? null),
        now(),
      );
    },

    listEvidence(run_id, candidate_id = null) {
      return candidate_id
        ? sql("SELECT * FROM evidence WHERE run_id = ? AND candidate_id = ? ORDER BY created_at, evidence_id").all(run_id, candidate_id)
        : sql("SELECT * FROM evidence WHERE run_id = ? ORDER BY created_at, evidence_id").all(run_id);
    },

    putResult(result) {
      const at = now();
      sql(
        `INSERT OR IGNORE INTO results (result_id, result_version, run_id, record_json, projection_status, projection_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      ).run(result.result_id, result.result_version, result.run_id, JSON.stringify(result), result.projection_status, at, at);
      return api.latestResult(result.run_id);
    },

    latestResult(run_id) {
      return sql("SELECT * FROM results WHERE run_id = ? ORDER BY created_at DESC, result_version DESC LIMIT 1").get(run_id) || null;
    },

    listResults(run_id) {
      return sql("SELECT * FROM results WHERE run_id = ? ORDER BY created_at, result_version").all(run_id);
    },

    setResultProjection(result_id, result_version, status, reason = null) {
      sql(
        "UPDATE results SET projection_status = ?, projection_reason = ?, updated_at = ? WHERE result_id = ? AND result_version = ?",
      ).run(status, reason, now(), result_id, result_version);
    },

    // -- run event feed -----------------------------------------------------

    appendRunEvent(run_id, kind, data = null) {
      sql("INSERT INTO run_events (run_id, kind, data_json, at) VALUES (?, ?, ?, ?)").run(
        run_id,
        kind,
        data == null ? null : JSON.stringify(data),
        now(),
      );
    },

    listRunEvents(run_id, after = 0) {
      return sql("SELECT * FROM run_events WHERE run_id = ? AND seq > ? ORDER BY seq").all(run_id, Number(after) || 0);
    },

    // -- applications (schema 4) ----------------------------------------------

    /**
     * Record a new application and take the destination's exclusive claim.
     *
     * The partial unique index refuses a second in-flight application to the same
     * destination; that refusal is returned, never thrown past the caller, because
     * "another application is in progress" is an answer the owner needs to see.
     *
     * @returns {{acquired:boolean, application:(object|null), holder:(object|null)}}
     */
    insertApplication(application) {
      const at = now();
      const active = ACTIVE_APPLICATION_STATES.includes(String(application.state));
      if (active) {
        const holder = api.activeApplication(application.destination);
        if (holder) return { acquired: false, application: null, holder };
      }
      try {
        sql(
          `INSERT INTO applications (application_id, run_id, candidate_id, result_ref, destination, state, claim, plan_json,
             journal_dir, integrated_id, outcome_json, actor, command_id, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?)`,
        ).run(
          application.application_id,
          application.run_id,
          application.candidate_id,
          application.result_ref,
          application.destination,
          application.state,
          active ? application.claim ?? null : null,
          JSON.stringify(application.plan ?? null),
          application.journal_dir ?? null,
          application.outcome == null ? null : JSON.stringify(application.outcome),
          application.actor,
          application.command_id,
          at,
          at,
        );
      } catch (error) {
        const holder = active ? api.activeApplication(application.destination) : null;
        if (holder) return { acquired: false, application: null, holder };
        throw error;
      }
      return { acquired: true, application: api.getApplication(application.application_id), holder: null };
    },

    getApplication(application_id) {
      return sql("SELECT * FROM applications WHERE application_id = ?").get(application_id) || null;
    },

    listApplications(run_id) {
      return sql("SELECT * FROM applications WHERE run_id = ? ORDER BY created_at, application_id").all(run_id);
    },

    /** The in-flight application holding a destination's claim, or null. */
    activeApplication(destination) {
      return (
        sql(
          `SELECT * FROM applications WHERE destination = ? AND state IN ('prepared', 'writing', 'checking', 'rolling-back', 'interrupted')
            ORDER BY created_at LIMIT 1`,
        ).get(destination) || null
      );
    },

    listActiveApplications() {
      return sql(
        "SELECT * FROM applications WHERE state IN ('prepared', 'writing', 'checking', 'rolling-back', 'interrupted') ORDER BY created_at",
      ).all();
    },

    /**
     * Move an application to a new state. `expectState` makes it a compare-and-swap,
     * so two processes cannot both move one application out of the same state.
     *
     * @returns {boolean} whether the row moved
     */
    updateApplication(application_id, patch, { expectState = null, expectRevision = null } = {}) {
      const current = api.getApplication(application_id);
      if (!current) return false;
      if (expectState != null && String(current.state) !== String(expectState)) return false;
      if (expectRevision != null && Number(current.revision) !== Number(expectRevision)) return false;
      const next = { ...current, ...patch };
      const active = ACTIVE_APPLICATION_STATES.includes(String(next.state));
      const json = (value) => (value == null ? null : typeof value === "string" ? value : JSON.stringify(value));
      let outcome;
      try {
        outcome = sql(
          `UPDATE applications SET state = ?, claim = ?, journal_dir = ?, integrated_id = ?, outcome_json = ?, plan_json = ?, revision = revision + 1, updated_at = ?
            WHERE application_id = ? AND state = ? AND revision = ?`,
        ).run(
          next.state,
          active ? next.claim ?? null : null,
          next.journal_dir ?? null,
          next.integrated_id ?? null,
          json(next.outcome_json),
          json(next.plan_json),
          now(),
          application_id,
          current.state,
          current.revision,
        );
      } catch (error) {
        // Moving into an active state while another application holds the claim.
        if (/constraint/iu.test(String((error && error.message) || error))) return false;
        throw error;
      }
      return Number(outcome.changes) === 1;
    },

    // -- artifacts ----------------------------------------------------------

    putArtifactRow(row) {
      sql(
        "INSERT OR REPLACE INTO artifacts (artifact_id, kind, path, sha256, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(row.artifact_id, row.kind, row.path, row.sha256, row.bytes, now());
      return sql("SELECT * FROM artifacts WHERE artifact_id = ?").get(row.artifact_id);
    },

    getArtifactRow(artifact_id) {
      return sql("SELECT * FROM artifacts WHERE artifact_id = ?").get(artifact_id) || null;
    },

    listArtifactRows() {
      return sql("SELECT * FROM artifacts ORDER BY created_at, artifact_id").all();
    },

    /**
     * Copy the live database to `destPath`.
     *
     * Uses SQLite's own online backup rather than a file copy. §9 is explicit
     * that "a copied database file alone is not assumed a valid backup" — with
     * WAL enabled, copying the `.sqlite` while a checkpoint is pending yields a
     * file that opens fine and is missing committed rows.
     */
    async backupTo(destPath) {
      mkdirSync(dirname(destPath), { recursive: true });
      await backup(db, destPath);
      return normalizePath(destPath);
    },
  };

  return api;
}

/**
 * Publish an immutable blob: temp write → flush → rename → re-read → hash verify
 * → return the reference.
 *
 * The re-read is not paranoia about SQLite; it is about the sequence §9 demands.
 * A reference committed to a blob nobody verified is how "missing referenced
 * artifact blocks dependent evidence" turns into "dependent evidence quietly
 * cites a truncated file". The row is written by the caller *after* this returns,
 * inside its transaction, so a crash leaves an orphan blob (tolerable) rather
 * than a dangling reference (not).
 *
 * @param {{dir:string, artifact_id:string, kind:string, bytes:(Buffer|string)}} input
 */
export function publishArtifact({ dir, artifact_id, kind, bytes }) {
  mkdirSync(dir, { recursive: true });
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), "utf8");
  const digest = sha256(buffer);
  const finalPath = join(dir, artifact_id + ".blob");
  const tempPath = finalPath + ".tmp";

  writeFileSync(tempPath, buffer);
  const fd = openSync(tempPath, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tempPath, finalPath);

  const readBack = readFileSync(finalPath);
  if (sha256(readBack) !== digest) {
    rmSync(finalPath, { force: true });
    throw new ContractError(STORE_REFUSALS.BLOB_CORRUPT + ": " + artifact_id);
  }

  return deepFreeze({ artifact_id, kind, path: normalizePath(finalPath), sha256: digest, bytes: buffer.length });
}

/**
 * Read a published blob back, refusing rather than returning something plausible.
 *
 * A missing blob and a corrupted blob are different failures and get different
 * codes, because the first is recoverable from a backup and the second means the
 * backup is suspect too.
 *
 * @param {{row:{path:string, sha256:string}}} input
 */
export function readArtifact({ row }) {
  if (!row) return deepFreeze({ ok: false, reason: STORE_REFUSALS.MISSING_BLOB, bytes: null });
  let buffer;
  try {
    buffer = readFileSync(row.path);
  } catch {
    return deepFreeze({ ok: false, reason: STORE_REFUSALS.MISSING_BLOB, bytes: null });
  }
  if (sha256(buffer) !== row.sha256) {
    return deepFreeze({ ok: false, reason: STORE_REFUSALS.BLOB_CORRUPT, bytes: null });
  }
  return deepFreeze({ ok: true, reason: null, bytes: buffer });
}

/**
 * Verify a restored store against its artifacts before anything is allowed to
 * dispatch from it.
 *
 * §9: "Restore into a separate directory, verify references and reconcile native
 * jobs before allowing dispatch." This is the verify half; jobs.mjs owns the
 * reconcile half. Returns the list of broken references rather than a boolean,
 * because a restore with two missing blobs and forty good ones is usable for
 * everything that does not depend on those two.
 *
 * @param {ReturnType<typeof openStore>} store
 */
export function verifyRestore(store) {
  const missing = [];
  const corrupt = [];
  for (const row of store.listArtifactRows()) {
    const result = readArtifact({ row });
    if (result.ok) continue;
    (result.reason === STORE_REFUSALS.MISSING_BLOB ? missing : corrupt).push(row.artifact_id);
  }
  const outstanding = store.listOutstandingJobs();
  return deepFreeze({
    ok: missing.length === 0 && corrupt.length === 0,
    missing: Object.freeze(missing),
    corrupt: Object.freeze(corrupt),
    // Not an error. A restore that still holds unknown jobs is the *correct*
    // outcome; it just may not dispatch until they are reconciled.
    outstandingJobs: Object.freeze(outstanding.map((job) => job.job_id)),
    dispatchAllowed: false,
    dispatchAllowedReason: "reconcile outstanding jobs before allowing dispatch from a restored store",
  });
}
