// PM Delivery V2 — S1.2 fixtures: the durable store.
//
// The storage half of F-JOB, F-COST and the F-RESULT storage variants from
// "PM Delivery — Evidence & Autonomy.md" §9: transactional persistence, restart,
// artifact publish/verify, and restore with missing blobs.
//
// These run against a real SQLite file in a disposable directory. An in-memory
// database would be faster and would test nothing that matters here — the
// properties under test are what survives a process boundary and what a backup
// actually contains.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContractError, authorizeGrant, revokeGrant } from "../../scripts/delivery-v2/contracts.mjs";
import {
  STORE_REFUSALS,
  openStore,
  payloadDigest,
  publishArtifact,
  readArtifact,
  verifyRestore,
} from "../../scripts/delivery-v2/store.mjs";

let ROOT: string;
let store: ReturnType<typeof openStore>;
let clock = 0;
const now = () => "2026-09-07T00:00:" + String(clock++).padStart(2, "0") + ".000Z";

function seedRun(id = "r-1") {
  store.insertRun({
    run_id: id,
    work_id: "w-1",
    contract_id: "c-1",
    contract_revision: 1,
    grant_id: "g-1",
    grant_revision: 0,
    lifecycle: "ACTIVE",
  });
  return id;
}

function seedJob(job_id = "j-1", run_id = "r-1", overrides: Record<string, unknown> = {}) {
  return store.insertJob({
    job_id,
    run_id,
    purpose: "start",
    backend_id: "codex-exec-sdk",
    dispatch_key: job_id,
    contract_id: "c-1",
    contract_revision: 1,
    grant_id: "g-1",
    grant_revision: 0,
    profile_id: "p-1",
    reservation: { unit: "usd", amount: null, basis: "no monetary reading is available from this backend" },
    request: { job_id },
    ...overrides,
  });
}

beforeEach(() => {
  clock = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-store-"));
  store = openStore({ path: join(ROOT, "supervisor.sqlite"), now });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* already closed by a test */
  }
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* leftover temp dir */
  }
});

describe("the schema enforces the identity equation", () => {
  it("refuses a job whose dispatch key is not its job id", () => {
    seedRun();
    expect(() => seedJob("j-1", "r-1", { dispatch_key: "j-other" })).toThrow(ContractError);
  });

  it("refuses it at the SQL layer too, not only in the helper", () => {
    seedRun();
    // Straight past the helper, to prove the CHECK constraint is real and would
    // stop a future call site that forgot.
    expect(() =>
      store.db
        .prepare(
          `INSERT INTO jobs (job_id, run_id, purpose, backend_id, dispatch_key, status, contract_id,
             contract_revision, grant_id, grant_revision, reservation_unit, reservation_basis,
             request_json, created_at, updated_at)
           VALUES ('j-x','r-1','start','b','j-DIFFERENT','reserved','c-1',1,'g-1',0,'usd','b','{}','t','t')`,
        )
        .run(),
    ).toThrow();
  });

  it("refuses a second, different native session behind one dispatch key", () => {
    seedRun();
    seedJob();
    store.bindNativeRef("j-1", "thr_a");
    expect(store.getJob("j-1")!.native_ref).toBe("thr_a");
    expect(store.bindNativeRef("j-1", "thr_a").native_ref).toBe("thr_a"); // idempotent
    expect(() => store.bindNativeRef("j-1", "thr_b")).toThrow(/native-ref-already-bound/u);
  });

  it("keeps the earliest dispatch marker", () => {
    seedRun();
    seedJob();
    store.markDispatchStarted("j-1", "2026-09-07T10:00:00.000Z");
    store.markDispatchStarted("j-1", "2026-09-07T11:00:00.000Z");
    expect(store.getJob("j-1")!.dispatch_started_at).toBe("2026-09-07T10:00:00.000Z");
    expect(store.getJob("j-1")!.status).toBe("active");
  });
});

describe("transactions are all-or-nothing", () => {
  it("rolls back a partial admission", () => {
    seedRun();
    expect(() =>
      store.transaction(() => {
        seedJob("j-1");
        throw new Error("crash between reserving the job and recording its receipt");
      }),
    ).toThrow(/crash between/u);
    expect(store.getJob("j-1")).toBeNull();
    expect(store.listJobs("r-1")).toHaveLength(0);
  });

  it("joins a nested call to the outer transaction rather than committing early", () => {
    seedRun();
    expect(() =>
      store.transaction(() => {
        store.transaction(() => seedJob("j-inner"));
        throw new Error("outer failure after the inner unit of work");
      }),
    ).toThrow();
    // If the inner call had opened and committed its own transaction, this row
    // would have survived the outer rollback.
    expect(store.getJob("j-inner")).toBeNull();
  });
});

describe("F-COST — a duplicate reading is a no-op at the storage layer", () => {
  it("stores one row for the same reading key seen three times", () => {
    seedRun();
    seedJob();
    const reading = { reading_key: "turn:0", unit: "tokens", input: 1200, output: 300 };
    expect(store.recordUsageReading("j-1", reading).inserted).toBe(true);
    expect(store.recordUsageReading("j-1", reading).inserted).toBe(false);
    expect(store.recordUsageReading("j-1", reading).inserted).toBe(false);
    expect(store.countUsageReadings("j-1")).toBe(1);
    expect(Number(store.listUsageReadings("j-1")[0].input)).toBe(1200);
  });

  it("keeps distinct turns apart", () => {
    seedRun();
    seedJob();
    store.recordUsageReading("j-1", { reading_key: "turn:0", unit: "tokens", input: 100 });
    store.recordUsageReading("j-1", { reading_key: "turn:1", unit: "tokens", input: 50 });
    expect(store.countUsageReadings("j-1")).toBe(2);
  });

  it("does not let a later reading overwrite an earlier one under the same key", () => {
    seedRun();
    seedJob();
    store.recordUsageReading("j-1", { reading_key: "turn:0", unit: "tokens", input: 1200 });
    store.recordUsageReading("j-1", { reading_key: "turn:0", unit: "tokens", input: 1 });
    // INSERT OR IGNORE, not upsert: a re-reported counter that shrank is not a
    // correction, and the first observation stands.
    expect(Number(store.listUsageReadings("j-1")[0].input)).toBe(1200);
  });
});

describe("F-COMMAND — the same command finds its own receipt", () => {
  it("distinguishes created, duplicate and conflict", () => {
    seedRun();
    const payload = { run_id: "r-1", purpose: "start" };
    expect(store.admitCommand({ command_id: "cmd-1", kind: "Deliver", actor: "owner", payload }).status).toBe("created");
    store.recordCommandOutcome("cmd-1", { admitted: true, job_id: "j-1" });

    const again = store.admitCommand({ command_id: "cmd-1", kind: "Deliver", actor: "owner", payload });
    expect(again.status).toBe("duplicate");
    expect(again.outcome).toEqual({ admitted: true, job_id: "j-1" });

    const otherPayload = store.admitCommand({
      command_id: "cmd-1",
      kind: "Deliver",
      actor: "owner",
      payload: { run_id: "r-1", purpose: "resume" },
    });
    expect(otherPayload.status).toBe("conflict");
    expect(otherPayload.reason).toBe(STORE_REFUSALS.COMMAND_CONFLICT);

    const otherActor = store.admitCommand({ command_id: "cmd-1", kind: "Deliver", actor: "someone-else", payload });
    expect(otherActor.status).toBe("conflict");
    expect(otherActor.reason).toBe(STORE_REFUSALS.ACTOR_CONFLICT);
  });

  it("digests payloads structurally, so key order is not a different command", () => {
    expect(payloadDigest({ a: 1, b: 2 })).toBe(payloadDigest({ b: 2, a: 1 }));
    expect(payloadDigest({ a: 1 })).not.toBe(payloadDigest({ a: 2 }));
  });
});

describe("F-RESULT — artifacts are verified before they are referenced", () => {
  it("publishes through temp, rename and a read-back hash check", () => {
    const dir = join(ROOT, "blobs");
    const artifact = publishArtifact({ dir, artifact_id: "a-1", kind: "transcript", bytes: "hello\n" });
    expect(artifact.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(readArtifact({ row: artifact }).ok).toBe(true);
  });

  it("reports a missing blob rather than an empty one", () => {
    const dir = join(ROOT, "blobs");
    const artifact = publishArtifact({ dir, artifact_id: "a-2", kind: "transcript", bytes: "hello\n" });
    rmSync(artifact.path, { force: true });
    const result = readArtifact({ row: artifact });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(STORE_REFUSALS.MISSING_BLOB);
  });

  it("reports a corrupted blob rather than its contents", () => {
    const dir = join(ROOT, "blobs");
    const artifact = publishArtifact({ dir, artifact_id: "a-3", kind: "transcript", bytes: "hello\n" });
    writeFileSync(artifact.path, "tampered\n");
    const result = readArtifact({ row: artifact });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(STORE_REFUSALS.BLOB_CORRUPT);
  });
});

describe("crash recovery and restore", () => {
  it("keeps committed records across a close and reopen", () => {
    const path = join(ROOT, "supervisor.sqlite");
    seedRun();
    seedJob();
    store.markDispatchStarted("j-1", "2026-09-07T10:00:00.000Z");
    store.recordUsageReading("j-1", { reading_key: "turn:0", unit: "tokens", input: 900 });
    store.close();

    const reopened = openStore({ path, now });
    const job = reopened.getJob("j-1");
    expect(job).not.toBeNull();
    expect(job!.dispatch_started_at).toBe("2026-09-07T10:00:00.000Z");
    expect(reopened.countUsageReadings("j-1")).toBe(1);
    // Still outstanding after the restart: nothing about a process ending
    // resolves a job.
    expect(reopened.listOutstandingJobs().map((entry: Record<string, unknown>) => entry.job_id)).toEqual(["j-1"]);
    reopened.close();
    store = reopened;
  });

  it("backs up through SQLite rather than by copying the file", async () => {
    seedRun();
    seedJob();
    store.recordUsageReading("j-1", { reading_key: "turn:0", unit: "tokens", input: 900 });
    const dest = join(ROOT, "backup", "supervisor.sqlite");
    await store.backupTo(dest);

    const restored = openStore({ path: dest, now });
    expect(restored.getJob("j-1")).not.toBeNull();
    expect(restored.countUsageReadings("j-1")).toBe(1);
    restored.close();
  });

  it("refuses to call a restore dispatchable while jobs are unreconciled", async () => {
    seedRun();
    seedJob();
    store.markDispatchStarted("j-1", "2026-09-07T10:00:00.000Z");
    const dir = join(ROOT, "blobs");
    const kept = publishArtifact({ dir, artifact_id: "a-keep", kind: "transcript", bytes: "kept\n" });
    const lost = publishArtifact({ dir, artifact_id: "a-lost", kind: "transcript", bytes: "lost\n" });
    store.putArtifactRow(kept);
    store.putArtifactRow(lost);

    const dest = join(ROOT, "backup2", "supervisor.sqlite");
    await store.backupTo(dest);
    // The blob is not inside the database. A restore that copies only the .sqlite
    // has references to files that are not there — which is the point of checking.
    rmSync(lost.path, { force: true });

    const restored = openStore({ path: dest, now });
    const verdict = verifyRestore(restored);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual(["a-lost"]);
    expect(verdict.corrupt).toEqual([]);
    expect(verdict.outstandingJobs).toEqual(["j-1"]);
    expect(verdict.dispatchAllowed).toBe(false);
    restored.close();
  });

  it("does not lose an unresolved reservation to a restore", async () => {
    seedRun();
    seedJob();
    store.markDispatchStarted("j-1");
    const dest = join(ROOT, "backup3", "supervisor.sqlite");
    await store.backupTo(dest);
    const restored = openStore({ path: dest, now });
    expect(restored.getJob("j-1")!.reservation_open).toBe(1);
    expect(restored.getJob("j-1")!.reservation_basis).toMatch(/no monetary reading/u);
    restored.close();
  });
});

describe("grants round-trip with their revocation version", () => {
  it("stores and reloads a grant, and a revoke is a new version rather than a deletion", () => {
    const grant = authorizeGrant({
      contract_id: "c-1",
      contract_revision: 1,
      permitted_effects: ["native_dispatch", "candidate_export"],
      resource_policy: { unit: "usd", allowance: null },
    });
    store.putGrant(grant);
    expect(store.getGrant(grant.grant_id)!.permitted_effects).toEqual(["candidate_export", "native_dispatch"]);

    store.putGrant(revokeGrant(grant));
    const reloaded = store.getGrant(grant.grant_id)!;
    expect(reloaded.revocation_version).toBe(1);
    // Same id: the run's history still refers to the authority its jobs had.
    expect(reloaded.grant_id).toBe(grant.grant_id);
  });
});
