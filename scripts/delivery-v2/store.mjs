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
export const STORE_SCHEMA_VERSION = 2;

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
`;

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
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = FULL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)").run("schema_version", String(STORE_SCHEMA_VERSION));

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
      sql(
        `UPDATE runs SET lifecycle = ?, closed_outcome = ?, result_ref = ?, waiting_reason = ?,
           grant_id = ?, grant_revision = ?, updated_at = ? WHERE run_id = ?`,
      ).run(
        next.lifecycle,
        next.closed_outcome ?? null,
        next.result_ref ?? null,
        next.waiting_reason ?? null,
        next.grant_id ?? null,
        next.grant_revision ?? null,
        next.updated_at,
        run_id,
      );
      return api.getRun(run_id);
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
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'reserved', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, NULL, NULL, 0, ?, ?)`,
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
        at,
        at,
      );
      return api.getJob(job.job_id);
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
           (job_id, reading_key, unit, input, cached_input, output, reasoning_output, cost_usd, observed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        job_id,
        String(reading.reading_key),
        reading.unit || "tokens",
        Number(reading.input || 0),
        Number(reading.cachedInput || 0),
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
