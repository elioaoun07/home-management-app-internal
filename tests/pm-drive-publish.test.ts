// One-way Google Drive publisher (scripts/pm/drive-publish.mjs).
// Real temp directories stand in for the repo and the Drive folder; the supervisor store is a
// fake whose Proxy refuses every method outside STORE_READS. No Drive, network, model or Delivery call.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { promises as nodeFsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FOLDERS,
  STORE_READS,
  buildUatStatus,
  createDrivePublisher,
  loadDocuments,
  readDeliveryFromStore,
  resolveDriveRoot,
  selectDocuments,
  selectVault,
} from "../scripts/pm/drive-publish.mjs";
import { bindDirect, bindRun, freezeHandover, listUat, recordResult, submitFeedback } from "../scripts/delivery-v2/uat.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

let base: string;
let pm: string;
let docs: string;
let drive: string;

const put = (path: string, text: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text, "utf8");
};
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const tree = (dir: string, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tree(join(dir, e.name), prefix + e.name + "/") : [prefix + e.name]));

function fakeStore(overrides: Loose = {}) {
  const calls: string[] = [];
  const data: Loose = {
    listRuns: () => [
      { run_id: "r-open", work_id: "DLV-1", contract_id: "c1", contract_revision: 1, lifecycle: "RUNNING", closed_outcome: null, waiting_reason: null, created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T01:00:00Z" },
      { run_id: "r-done", work_id: "DLV-2", contract_id: "c2", contract_revision: 1, lifecycle: "CLOSED", closed_outcome: "verified_candidate", waiting_reason: null, created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T01:00:00Z" },
    ],
    getContract: (id: string) => ({ outcome: "Outcome " + id }),
    listJobs: (run: string) => (run === "r-open" ? [{ job_id: "j1", status: "active" }, { job_id: "j2", status: "unknown" }] : [{ job_id: "j3", status: "finished" }]),
    listPlans: (run: string) => (run === "r-open" ? [{ plan_id: "p1", revision: 2, status: "proposed" }] : []),
    listQuestions: (run: string) => (run === "r-open" ? [{ question_id: "q1", status: "open", blocking: 1 }] : []),
    latestResult: (run: string) => (run === "r-done" ? { result_id: "res1", result_version: 3, record_json: JSON.stringify({ candidateVerified: true, criterion_states: [{ criterion_id: "c-a", state: "pass" }] }) } : null),
    listApplications: () => [],
    ...overrides,
  };
  const store = new Proxy({}, {
    get: (_t, name: string) => {
      if (!(STORE_READS as readonly string[]).includes(name)) throw new Error("store method outside STORE_READS: " + name);
      return (...args: unknown[]) => {
        calls.push(name);
        return data[name](...args);
      };
    },
  });
  return { store, calls };
}

function build(overrides: Loose = {}) {
  let delivery: Loose = overrides.delivery ?? readDeliveryFromStore(fakeStore().store);
  let tick = 0;
  const publisher = createDrivePublisher({
    root: base,
    pmDir: pm,
    docsDir: docs,
    driveRoot: drive,
    readDelivery: () => delivery,
    readRollups: () => null,
    statePath: join(base, ".pm", "drive-publish.json"),
    now: () => new Date(Date.UTC(2026, 9, 25, 12, 0, tick++)).toISOString(),
    env: {},
    ...overrides.publisher,
  });
  return { publisher, setDelivery: (value: Loose) => (delivery = value) };
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "pm-drive-"));
  pm = join(base, "ERA Notes", "10 - Project Management");
  docs = join(base, "docs");
  drive = join(base, "drive");
  mkdirSync(drive);
  put(join(pm, "_index.md"), "# index");
  put(join(pm, "_Decisions.md"), "# decisions");
  put(join(pm, "Delivery", "4 - Checklist.md"), "- [ ] DLV-1 item");
  put(join(pm, "Delivery", "Delivery \u2014 Master Book.md"), "# book");
  put(join(pm, "Delivery", "scratch notes.md"), "not selected");
  put(join(pm, "Plans", "Delivery V2.md"), "# plan");
  put(join(pm, "_Archive", "old.md"), "archived");
  put(join(pm, "_Templates", "t.md"), "template");
  put(join(pm, ".pm", "era-issues.jsonl"), "{}");
  put(join(pm, "_dashboard.html"), "<html>");
  put(join(pm, "_Planning.json"), "{}");
  put(join(docs, "Delivery-UAT.md"), "# uat");
  put(join(docs, "ERA-Steward-Runbook.md"), "# runbook");
  put(join(docs, "ENV.md"), "env docs stay local");
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("temporary Local session review", () => {
  const id = "local-00000000-0000-0000-0000-000000000001";
  const other = "local-00000000-0000-0000-0000-000000000002";
  const target = (key = id) => join(drive, FOLDERS.review, key + ".md");
  const active = (key = id) => ({
    lane: "local", run_id: key, work_id: "BUD-95", title: "Expense feedback", phase: "checking", updated_at: "2026-11-22T10:00:00Z",
    blockers: [], ownerActions: [], progress: { jobs: { total: 1 }, criteria: { total: 0 } },
    evidence: { head: null as string | null, base: null as string | null, handover_id: null as string | null,
      checks: [{ name: "typecheck", state: "pass", exit: 0 }], review_document: FOLDERS.review + "/" + key + ".md" },
  });
  const observed = (...runs: ReturnType<typeof active>[]) => ({ available: true, runs, requests: [] });
  it("reads only the sealed comparison and receipts, and binds the direct Local handover to the same head", async () => {
    const repo = join(base, "fixture");
    mkdirSync(repo);
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.test",
      "-c", "commit.gpgsign=false", "-c", "core.hooksPath=.no-hooks", ...args], { cwd: repo, encoding: "utf8" }).trim();
    git("init", "--quiet");
    put(join(repo, "src", "example.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-qm", "base");
    const run = active();
    run.evidence.base = git("rev-parse", "HEAD");
    put(join(repo, "src", "example.ts"), "export const value = 2;\n");
    put(join(repo, "tests", "fixtures", "private.ts"), "PRIVATE FIXTURE");
    put(join(repo, ".env.test"), "PRIVATE ENV");
    put(join(repo, "src", "oversized.ts"), "BIG PATCH".repeat(7000));
    put(join(repo, "src", "accidental.ts"), "ghp_" + "a".repeat(36));
    git("add", ".");
    git("commit", "-qm", "candidate");
    run.evidence.head = git("rev-parse", "HEAD");
    put(join(repo, "src", "example.ts"), "UNCOMMITTED CHECKOUT CONTENT");
    const frozen: Loose = freezeHandover({ root: base, subject: { delivery_ref: "local:" + id, work_id: run.work_id, title: run.title },
      binding: bindDirect({ source_revision: run.evidence.head, delivery_ref: "local:" + id }),
      environment: { target: "local", build: run.evidence.head }, ready: true, now: run.updated_at,
      content: { summary: "Check expense feedback", scenarios: [{ id: "S1", title: "Check amount", steps: [{ action: "Open Expense.", expected: "Amount appears." }] }] } });
    expect(frozen.ok).toBe(true);
    run.evidence.handover_id = frozen.handover.handover_id;
    const views = () => listUat({ root: base, now: run.updated_at }).handovers;
    const { publisher } = build({ delivery: observed(run), publisher: { root: repo, readUat: views } });
    const first: Loose = await publisher.publishNow();
    expect(first.ok).toBe(true);
    expect(first.status.delivery.runs[0].evidence.uat).toMatchObject({ revision: 1, required: 1, passed: 0 });
    const review = readFileSync(target(), "utf8");
    expect(review).toContain("+export const value = 2;");
    expect(review).toContain(run.evidence.head);
    expect(review).toContain("typecheck · pass · exit 0");
    expect(review).toContain("Frozen handover r1");
    expect(review).toContain("src/accidental.ts (content withheld)");
    expect(review).toContain("src/oversized.ts (unavailable or exceeds file limit)");
    expect(review).not.toMatch(/PRIVATE FIXTURE|PRIVATE ENV|UNCOMMITTED|BIG PATCH|ghp_/u);
    expect(JSON.stringify(publisher.state())).not.toContain("export const value");
    // A refreshed head invalidates the frozen handover and cached comparison.
    run.evidence.head = "1".repeat(40);
    const next: Loose = await publisher.publishNow({ docs: false });
    expect(next.ok).toBe(true);
    expect(next.status.delivery.runs[0].evidence.uat).toBeUndefined();
    const refreshed = readFileSync(target(), "utf8");
    expect(refreshed).toContain("comparison is unavailable");
    expect(refreshed).toContain("No matching ready handover");
    expect(refreshed).not.toContain("export const value");
    publisher.stop();
  });

  it("keeps an active or blocked run through an outage and prunes only closed packets on recovery and restart", async () => {
    const running = active(), blocked = { ...active(other), phase: "parked" };
    const { publisher, setDelivery } = build({ delivery: observed(running, blocked) });
    expect((await publisher.publishNow({ dryRun: true })).ok).toBe(true);
    expect(existsSync(target())).toBe(false);
    await publisher.publishNow();
    const original = readFileSync(target(), "utf8");
    setDelivery({ available: false, runs: [], requests: [] });
    await publisher.publishNow();
    expect(readFileSync(target(), "utf8")).toEqual(original);
    const otherFile = join(drive, FOLDERS.review, "owner notes.md");
    put(otherFile, "Keep these.");
    setDelivery(observed(blocked));
    await publisher.publishNow();
    expect(existsSync(target())).toBe(false);
    expect(existsSync(target(other))).toBe(true);
    publisher.stop();
    const restarted = build({ delivery: observed(), publisher: { statePath: null } }).publisher;
    await restarted.publishNow();
    expect(readdirSync(join(drive, FOLDERS.review))).toEqual(["owner notes.md"]);
    expect(readFileSync(otherFile, "utf8")).toBe("Keep these.");
    restarted.stop();
  });

  it("preserves a foreign file with a run-shaped name on both publish and prune", async () => {
    put(target(), "My review");
    const run = active();
    const { publisher, setDelivery } = build({ delivery: observed(run) });
    const result = await publisher.publishNow();
    expect(result.skipped).toContainEqual({ path: run.evidence.review_document, reason: "occupied" });
    expect(result.status.delivery.runs[0].evidence.review_available).toBe(false);
    setDelivery(observed());
    await publisher.publishNow();
    expect(readFileSync(target(), "utf8")).toBe("My review");
    publisher.stop();
  });
});

describe("selection", () => {
  it("publishes roadmap, backlog, decisions, plans and delivery docs only", () => {
    expect(selectDocuments({ pmDir: pm, docsDir: docs }).map((d) => d.dest)).toEqual([
      "Docs/Delivery-UAT.md",
      "Docs/ERA-Steward-Runbook.md",
      "PM/Delivery/4 - Checklist.md",
      "PM/Delivery/Delivery \u2014 Master Book.md",
      "PM/Plans/Delivery V2.md",
      "PM/_Decisions.md",
      "PM/_index.md",
    ]);
  });

  it("leaves out a document carrying a credential and reports the reason, never the value", () => {
    const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123";
    put(join(docs, "Delivery-Leak.md"), "token " + key);
    const loaded = loadDocuments(selectDocuments({ pmDir: pm, docsDir: docs }), {});
    expect(loaded.files.map((f: Loose) => f.dest)).not.toContain("Docs/Delivery-Leak.md");
    expect(loaded.skipped).toEqual([{ path: "Docs/Delivery-Leak.md", reason: expect.stringMatching(/^secret:shape:anthropic-key/u) }]);
    expect(JSON.stringify(loaded.skipped)).not.toContain(key);
  });
});

describe("delivery status", () => {
  it("projects runs from read-only store methods and nothing else", () => {
    const { store, calls } = fakeStore();
    const delivery: Loose = readDeliveryFromStore(store, { requests: [{ command_id: "cmd1", workId: "DLV-1", status: "pending", blocker: { code: "x" } }] });
    expect(delivery.available).toBe(true);
    expect(new Set(calls).size).toBeGreaterThan(0);
    for (const name of calls) expect(STORE_READS).toContain(name);

    const open = delivery.runs.find((r: Loose) => r.run_id === "r-open");
    expect(open.phase).toBe("RUNNING");
    expect(open.blockers).toEqual([
      { kind: "question", ref: "q1" },
      { kind: "unknown-job", ref: "j2" },
    ]);
    expect(open.ownerActions.map((a: Loose) => a.label)).toEqual(expect.arrayContaining(["Question", "Review plan", "Reconcile"]));
    expect(open.progress.jobs).toEqual({ total: 2, byStatus: { active: 1, unknown: 1 } });

    const done = delivery.runs.find((r: Loose) => r.run_id === "r-done");
    expect(done.phase).toBe("CLOSED/verified_candidate");
    expect(done.ownerActions.map((a: Loose) => a.label)).toContain("Apply");
    expect(done.evidence).toMatchObject({ result_id: "res1", result_version: 3, candidate_verified: true, link: "/pm/live#/delivery/run/r-done" });
    expect(delivery.requests[0]).toMatchObject({ command_id: "cmd1", blocker: { code: "x" } });
  });

  it("reports unavailable instead of throwing when the store read fails", () => {
    const { store } = fakeStore({ listRuns: () => { throw new Error("database is locked"); } });
    expect(readDeliveryFromStore(store)).toMatchObject({ available: false, reason: "database is locked", runs: [] });
  });

  it("publishes the Local candidate and its actionable phase while keeping check output private", () => {
    const run_id = "local-11111111-1111-4111-8111-111111111111";
    const head = "a".repeat(40);
    const record = { lane: "local", phase: "building", head, base: "b".repeat(40), work: { id: "BUD-95", title: "Private cache header" },
      checks: [{ name: "test", exit: 0, stdout: "private check output" }], handover_id: "uat-06bc4a08494c" };
    const row = { run_id, work_id: "BUD-95", lifecycle: "ACTIVE", closed_outcome: "", base_manifest_json: JSON.stringify(record) };
    const { store } = fakeStore({ listRuns: () => [row] });
    const read = (live?: Loose) => readDeliveryFromStore(store, { localSummaries: rows => {
      expect(rows).toEqual([row]);
      return live ? [{ run_id, ...live }] : [];
    } }).runs[0] as Loose;
    expect(read({ active: true, ownerActionKind: "local-question" })).toMatchObject({
      lane: "local", work_id: "BUD-95", title: "Private cache header", phase: "building",
      blockers: [{ kind: "question" }], ownerActions: [{ kind: "local-question" }],
      evidence: { head, runner_active: true, checks: [{ name: "test", state: "pass", exit: 0 }],
        handover_id: "uat-06bc4a08494c", review_document: FOLDERS.review + "/" + run_id + ".md" },
    });
    expect(read({ active: false, ownerAction: "Interrupted" }).blockers).toEqual([{ kind: "interrupted", ref: "local-supervisor" }]);
    expect(read().evidence.runner_active).toBeNull();
    row.base_manifest_json = JSON.stringify({ ...record, phase: "discarded", applied: { at: "2026-11-22T12:00:00Z" }, cleaned_at: "2026-11-22T13:00:00Z" });
    row.lifecycle = "CLOSED";
    row.closed_outcome = "discarded";
    expect(read()).toMatchObject({ phase: "CLOSED/discarded", ownerActions: [], evidence: { review_document: null,
      merged_at: "2026-11-22T12:00:00Z", pushed_commit: null, handover_id: record.handover_id } });
    expect(JSON.stringify(read())).not.toContain("private check output");
  });

  it("leaves historical cancelled questions and applied results out of pending owner actions", () => {
    const run = { run_id: "r-done", lifecycle: "CLOSED", closed_outcome: "cancelled" };
    const { store } = fakeStore({ listRuns: () => [run], listQuestions: () => [{ question_id: "old", status: "open", blocking: 1 }],
      listApplications: () => [{ application_id: "previous", state: "applied" }] });
    expect(readDeliveryFromStore(store).runs[0]).toMatchObject({ blockers: [], ownerActions: [] });
  });
});

describe("publishing", () => {
  it("publishes documents and status, then writes nothing when nothing changed", async () => {
    const { publisher } = build();
    const first = await publisher.publishNow({ full: true });
    expect(first.ok).toBe(true);
    expect(first.wrote).toHaveLength(7);
    expect(first.statusWritten).toBe(true);
    expect(tree(drive)).toEqual(
      expect.arrayContaining([
        "01 - PM Documentation/PM/Delivery/4 - Checklist.md",
        "01 - PM Documentation/Docs/Delivery-UAT.md",
        "02 - Delivery Status/status.json",
        "02 - Delivery Status/status.md",
        "README.md",
      ]),
    );
    expect(existsSync(join(drive, FOLDERS.proposals))).toBe(true);
    expect(tree(drive).filter((p) => p.includes("_Archive") || p.includes("ENV.md") || p.endsWith(".tmp"))).toEqual([]);
    const status = JSON.parse(readFileSync(join(drive, FOLDERS.status, "status.json"), "utf8"));
    expect(status.delivery.runs.map((r: Loose) => r.run_id)).toEqual(["r-open", "r-done"]);
    expect(status.pendingOwnerActions.length).toBeGreaterThan(0);

    const second = await publisher.publishNow({ full: false });
    expect(second).toMatchObject({ ok: true, wrote: [], pruned: [], statusWritten: false });
  });

  it("rewrites only the changed document and prunes one that left the selection", async () => {
    const { publisher } = build();
    await publisher.publishNow({ full: true });
    put(join(pm, "Delivery", "4 - Checklist.md"), "- [x] DLV-1 item");
    rmSync(join(pm, "Plans", "Delivery V2.md"));
    const next = await publisher.publishNow({ docs: true, status: false });
    expect(next.wrote).toEqual(["PM/Delivery/4 - Checklist.md"]);
    expect(next.pruned).toEqual(["PM/Plans/Delivery V2.md"]);
    expect(existsSync(join(drive, FOLDERS.docs, "PM", "Plans", "Delivery V2.md"))).toBe(false);
  });

  it("removes a published document that later gains a credential", async () => {
    const { publisher } = build();
    await publisher.publishNow({ full: true });
    put(join(docs, "Delivery-UAT.md"), "now " + "ghp_" + "a".repeat(36));
    const next = await publisher.publishNow({ docs: true, status: false });
    expect(next.pruned).toEqual(["Docs/Delivery-UAT.md"]);
    expect(next.skipped[0].reason).toBe("secret:shape:github-token");
    expect(existsSync(join(drive, FOLDERS.docs, "Docs", "Delivery-UAT.md"))).toBe(false);
  });

  it("never writes back to the repository; a Drive edit is kept aside and overwritten", async () => {
    const { publisher } = build();
    await publisher.publishNow({ full: true });
    const before = tree(base).filter((p) => !p.startsWith("drive/") && !p.startsWith(".pm/")).map((p) => [p, sha(readFileSync(join(base, p)))]);

    const published = join(drive, FOLDERS.docs, "PM", "_Decisions.md");
    writeFileSync(published, "edited in Drive", "utf8");
    writeFileSync(join(drive, FOLDERS.proposals, "Dot idea.md"), "proposal", "utf8");
    const next = await publisher.publishNow({ full: true });

    expect(next.driveEdits).toHaveLength(1);
    expect(next.driveEdits[0].path).toBe("PM/_Decisions.md");
    expect(readFileSync(published, "utf8")).toBe("# decisions");
    expect(readFileSync(join(drive, FOLDERS.proposals, ...next.driveEdits[0].keptAs.split("/")), "utf8")).toBe("edited in Drive");
    expect(readFileSync(join(drive, FOLDERS.proposals, "Dot idea.md"), "utf8")).toBe("proposal");
    const after = tree(base).filter((p) => !p.startsWith("drive/") && !p.startsWith(".pm/")).map((p) => [p, sha(readFileSync(join(base, p)))]);
    expect(after).toEqual(before);
  });

  it("recreates a published file deleted in Drive on a full pass", async () => {
    const { publisher } = build();
    await publisher.publishNow({ full: true });
    rmSync(join(drive, FOLDERS.docs, "PM", "_index.md"));
    const next = await publisher.publishNow({ full: true });
    expect(next.wrote).toEqual(["PM/_index.md"]);
  });

  it("rewrites status only when it changed (or on heartbeat)", async () => {
    const { publisher, setDelivery } = build();
    await publisher.publishNow({ full: true });
    expect((await publisher.publishNow({ docs: false })).statusWritten).toBe(false);
    setDelivery(readDeliveryFromStore(fakeStore({ listRuns: () => [] }).store));
    const changed = await publisher.publishNow({ docs: false });
    expect(changed.statusWritten).toBe(true);
    expect(JSON.parse(readFileSync(join(drive, FOLDERS.status, "status.json"), "utf8")).delivery.runs).toEqual([]);
  });

  it("keeps the last good delivery data, marked stale, when the store is unreadable", async () => {
    const { publisher, setDelivery } = build();
    await publisher.publishNow({ full: true });
    setDelivery({ available: false, reason: "wal-held", runs: [], requests: [] });
    await publisher.publishNow({ docs: false });
    const status = JSON.parse(readFileSync(join(drive, FOLDERS.status, "status.json"), "utf8"));
    expect(status.delivery).toMatchObject({ stale: true, staleReason: "wal-held" });
    expect(status.delivery.runs).toHaveLength(2);
  });
});

describe("Drive unavailability", () => {
  it("fails closed when the folder is missing, then recovers without losing state", async () => {
    rmSync(drive, { recursive: true });
    const { publisher } = build({ publisher: { retryMs: [3_600_000] } });
    const failed = await publisher.publishNow({ full: true });
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain("drive-unavailable");
    expect(existsSync(drive)).toBe(false); // never invents the root
    expect(publisher.state().lastError.message).toContain("drive-unavailable");

    mkdirSync(drive);
    const recovered = await publisher.publishNow({ full: true });
    expect(recovered.ok).toBe(true);
    expect(recovered.wrote).toHaveLength(7);
    publisher.stop();
  });

  it("bounds a hung Drive call and does not start overlapping passes", async () => {
    let release: () => void = () => {};
    const hang = new Promise<void>((resolve) => (release = resolve));
    const fsp = { ...nodeFsp, stat: async () => { await hang; return nodeFsp.stat(drive); } };
    const { publisher } = build({ publisher: { fsp, timeoutMs: 40, retryMs: [3_600_000] } });
    const stuck = publisher.publishNow({ full: true });
    expect(await publisher.publishNow({ full: true })).toEqual({ ok: false, busy: true });
    expect((await stuck).error).toContain("timed out");
    release();
    publisher.stop();
  });

  it("never throws into the caller when Drive writes fail", async () => {
    const fsp = { ...nodeFsp, writeFile: async () => { throw Object.assign(new Error("EBUSY"), { code: "EBUSY" }); } };
    const { publisher } = build({ publisher: { fsp, retryMs: [3_600_000] } });
    const result = await publisher.publishNow({ full: true });
    expect(result).toMatchObject({ ok: false, error: "EBUSY" });
    publisher.stop();
  });
});

describe("configuration and isolation", () => {
  it("resolves the destination from env, defaults on Windows only, and can be disabled", () => {
    expect(resolveDriveRoot({ PM_DRIVE_DIR: "X:\\d" }, "linux")).toBe("X:\\d");
    expect(resolveDriveRoot({}, "win32")).toBe("G:\\My Drive\\ERA PM Command Center");
    expect(resolveDriveRoot({}, "linux")).toBeNull();
    expect(resolveDriveRoot({ PM_DRIVE_PUBLISH: "0", PM_DRIVE_DIR: "X:\\d" }, "win32")).toBeNull();
  });

  it("imports nothing that can start, approve, apply or settle delivery work", () => {
    const source = readFileSync(join(__dirname, "..", "scripts", "pm", "drive-publish.mjs"), "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gmu)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./drive-local-status.mjs", "./drive-session-review.mjs", "./relay-shared.mjs", "./relay.mjs", "node:crypto", "node:fs", "node:fs", "node:path"].sort());
    expect(source).not.toMatch(/\.(?:apply|approve|dispatch|deliver|reconcile|launch|settle|resume|cancel|put[A-Z]\w*|set[A-Z]\w*)\(/u);
  });

  it("only schedules publication from the PM server and allows managed shutdown to observe and stop it", () => {
    const server = readFileSync(join(__dirname, "..", "scripts", "pm-server.mjs"), "utf8");
    const uses = [...server.matchAll(/\bdrive\??\.(\w+)/gu)].map((m) => m[1]);
    expect(new Set(uses)).toEqual(new Set(["schedule", "isBusy", "stop"]));
    const cli = readFileSync(join(__dirname, "..", "scripts", "pm", "drive-publish-cli.mjs"), "utf8");
    expect(cli).toMatch(/openStore\(\{ path: STORE_PATH, readOnly: true \}\)/u);
  });
});

describe("owner testing (R78)", () => {
  const content = { summary: "Split", scenarios: [{ id: "M1", title: "Remove the tag", criteria: ["AC-1"], steps: [{ action: "Open Activity.", expected: "The list appears." }] }] };
  const subject = { run_id: "r-aaaaaaaaaaaa", work_id: "BUD-83", campaign: "Budget", title: "Remove a pending split" };
  const seed = () => {
    const ready: Loose = freezeHandover({ root: base, subject, binding: bindRun({ candidate_id: "cand-1" }), environment: { target: "local", build: "b1" }, content, ready: true, now: "2026-10-25T10:00:00.000Z" });
    freezeHandover({ root: base, subject: { delivery_ref: "docs/x.md#y", work_id: "SCH-20", campaign: "Schedule", title: "Chores" }, content, now: "2026-10-25T10:01:00.000Z" });
    recordResult({ root: base, handover_id: ready.handover.handover_id, revision: 1, scenario_id: "M1", result: "pass", command_id: "c-1", actor: "owner", now: "2026-10-25T10:05:00.000Z" });
    return ready.handover.handover_id as string;
  };
  const views = () => listUat({ root: base, now: "2026-10-25T11:00:00.000Z" }).handovers;
  const statusFile = () => JSON.parse(readFileSync(join(drive, FOLDERS.status, "status.json"), "utf8"));

  it("adds the recorded UAT state to status.json and one retained document per handover, without a local path", async () => {
    const id = seed();
    const { publisher } = build({ publisher: { readUat: views } });
    const first = await publisher.publishNow({ full: true });
    expect(first.wrote).toEqual(expect.arrayContaining([`UAT/${id}.md`]));
    const status = statusFile();
    expect(status.uat).toMatchObject({ candidate: "unchecked", counts: { total: 2, ready: 1, draft: 1, accepted: 0, openFeedback: 0 }, evidenceAt: "2026-10-25T10:05:00.000Z" });
    const ready = status.uat.handovers.find((h: Loose) => h.handover_id === id);
    expect(ready).toMatchObject({ work_id: "BUD-83", status: "ready", acceptance: "in-progress", required: 1, passed: 1, document: `UAT/${id}.md`, shipped: false });
    expect(JSON.stringify(status.uat)).not.toMatch(/[A-Z]:\|C:\//u);
    const doc = readFileSync(join(drive, FOLDERS.status, "UAT", `${id}.md`), "utf8");
    expect(doc).toContain("Open Activity.");
    expect(doc).toContain("Expected: The list appears.");
    expect(doc).toContain("Required · pass");
    expect(readFileSync(join(drive, FOLDERS.status, "status.md"), "utf8")).toContain("## Owner testing");
    expect(tree(drive).filter((p) => p.endsWith(".tmp"))).toEqual([]);
  });

  it("writes nothing more until a record changes, then rewrites only that document", async () => {
    const id = seed();
    const { publisher } = build({ publisher: { readUat: views } });
    await publisher.publishNow({ full: true });
    expect(await publisher.publishNow({ full: false })).toMatchObject({ wrote: [], statusWritten: false });
    submitFeedback({ root: base, handover_id: id, revision: 1, scenario_id: "M1", step: 1, classification: "bug", observation: "No list", command_id: "fb-1", actor: "owner", now: "2026-10-25T10:10:00.000Z" });
    const next = await publisher.publishNow({ full: false });
    expect(next.wrote).toEqual([`UAT/${id}.md`]);
    expect(next.statusWritten).toBe(true);
    expect(statusFile().uat.handovers.find((h: Loose) => h.handover_id === id)).toMatchObject({ acceptance: "needs-changes", feedback: [{ state: "submitted", import: "saved", work: null }] });
    expect(statusFile().uat.counts.openFeedback).toBe(1);
  });

  it("is read-only toward the records: a Drive edit never reaches them, and the edited document is overwritten", async () => {
    const id = seed();
    const before = readFileSync(join(base, ".delivery", "v2", "uat", "receipts.ndjson"), "utf8");
    const { publisher } = build({ publisher: { readUat: views } });
    await publisher.publishNow({ full: true });
    writeFileSync(join(drive, FOLDERS.status, "UAT", `${id}.md`), "# edited in Drive: SIGN OFF\n");
    await publisher.publishNow({ full: true });
    expect(readFileSync(join(drive, FOLDERS.status, "UAT", `${id}.md`), "utf8")).toContain("Open Activity.");
    expect(readFileSync(join(base, ".delivery", "v2", "uat", "receipts.ndjson"), "utf8")).toBe(before);
    expect(statusFile().uat.handovers.find((h: Loose) => h.handover_id === id).shipped).toBe(false);
  });

  it("keeps the last good section, marked stale, when the records cannot be read, and publishes none when there never were any", async () => {
    seed();
    let broken = false;
    const { publisher } = build({ publisher: { readUat: () => { if (broken) throw new Error("unreadable"); return views(); } } });
    await publisher.publishNow({ full: true });
    broken = true;
    await publisher.publishNow({ full: false, status: true });
    expect(statusFile().uat).toMatchObject({ stale: true, counts: { total: 2 } });
    const fresh = build({ publisher: { statePath: join(base, ".pm", "never-had-records.json") } });
    rmSync(join(drive, FOLDERS.status), { recursive: true, force: true });
    await fresh.publisher.publishNow({ full: true });
    expect(statusFile().uat).toBeNull();
  });

  it("keeps drafts out of the first part of the list and never lists more than the cap", () => {
    const many = Array.from({ length: 150 }, (_, index) => ({
      handover_id: `uat-${index}`, revision: 1, status: index === 0 ? "ready" : "draft", subject: { work_id: `X-${index}`, campaign: "Budget", title: "t", run_id: null },
      summary: "", acceptance: { state: "pending", shipped: false }, scenarios: [], feedback: [], signoff: null, created_at: `2026-10-25T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
    }));
    const status = buildUatStatus(many);
    expect(status.counts).toMatchObject({ total: 150, ready: 1, draft: 149 });
    expect(status.handovers).toHaveLength(120);
    expect(status.handovers[0].status).toBe("ready");
  });
});

describe("ERA Notes vault mirror", () => {
  let vault: string;
  const vaultBuild = (publisher: Loose = {}) => build({ publisher: { vaultDir: vault, ...publisher } });
  beforeEach(() => {
    vault = join(base, "ERA Notes");
    put(join(vault, "00 - Home", "Home.md"), "# home");
    put(join(vault, "01 - Architecture", "Feature Map", "_index.md"), "# map");
    put(join(vault, "Model-Registry.md"), "# models");
    put(join(vault, "_Archive", "old.md"), "history");
    put(join(vault, ".obsidian", "workspace.json"), "{}");
  });

  it("selects every file in the vault with its folder tree, leaving dot-folders local at any depth", () => {
    const dests = selectVault({ vaultDir: vault }).map((d) => d.dest);
    expect(dests).toContain("00 - Home/Home.md");
    expect(dests).toContain("01 - Architecture/Feature Map/_index.md");
    expect(dests).toContain("10 - Project Management/_Archive/old.md");
    expect(dests).toContain("10 - Project Management/_dashboard.html");
    expect(dests).toContain("_Archive/old.md");
    expect(dests.filter((d) => d.split("/").some((part) => part.startsWith(".")))).toEqual([]);
    expect(dests).toEqual([...dests].sort());
  });

  it("mirrors the vault into its own folder beside the PM documents, which stay as they were", async () => {
    const { publisher } = vaultBuild();
    const first = await publisher.publishNow({ full: true });
    expect(first.ok).toBe(true);
    const files = tree(drive);
    expect(files).toEqual(expect.arrayContaining([
      "04 - ERA Notes/00 - Home/Home.md",
      "04 - ERA Notes/01 - Architecture/Feature Map/_index.md",
      "04 - ERA Notes/10 - Project Management/Delivery/scratch notes.md",
      "04 - ERA Notes/Model-Registry.md",
      "01 - PM Documentation/PM/_index.md",
    ]));
    expect(files.filter((p) => p.includes("/.obsidian/") || p.includes("/.pm/") || p.endsWith(".tmp"))).toEqual([]);
    expect(first.wrote).toContain("ERA Notes/00 - Home/Home.md");
    expect(first.wrote.filter((p: string) => p.startsWith("PM/") || p.startsWith("Docs/"))).toHaveLength(7);
    expect(readFileSync(join(drive, FOLDERS.vault, "01 - Architecture", "Feature Map", "_index.md"), "utf8")).toBe("# map");
    expect(readFileSync(join(drive, "README.md"), "utf8")).toContain("04 - ERA Notes");
    expect(JSON.parse(readFileSync(join(drive, FOLDERS.status, "status.json"), "utf8")).publish.vaultFiles).toBe(selectVault({ vaultDir: vault }).length);
    expect((await publisher.publishNow({})).wrote).toEqual([]);
  });

  it("restarts without reading the vault back from Drive, yet recreates a file deleted there", async () => {
    await vaultBuild().publisher.publishNow({ full: true });
    rmSync(join(drive, FOLDERS.vault, "00 - Home", "Home.md"));
    const reads: string[] = [];
    const fsp = { ...nodeFsp, readFile: async (path: Loose, ...rest: Loose[]) => (reads.push(String(path)), (nodeFsp.readFile as Loose)(path, ...rest)) };
    const next = await vaultBuild({ fsp }).publisher.publishNow({ full: true });
    expect(next.wrote).toEqual(["ERA Notes/00 - Home/Home.md"]);
    expect(reads.filter((p) => p.includes(FOLDERS.vault) && !p.endsWith("Home.md"))).toEqual([]);
  });

  it("prunes a deleted note and the folder it emptied", async () => {
    const { publisher } = vaultBuild();
    await publisher.publishNow({ full: true });
    rmSync(join(vault, "00 - Home"), { recursive: true });
    const next = await publisher.publishNow({ docs: true, status: false });
    expect(next.pruned).toEqual(["ERA Notes/00 - Home/Home.md"]);
    expect(existsSync(join(drive, FOLDERS.vault, "00 - Home"))).toBe(false);
    expect(existsSync(join(drive, FOLDERS.vault, "01 - Architecture", "Feature Map", "_index.md"))).toBe(true);
  });

  it("keeps a Drive-side edit of a note aside before overwriting it with the next local change", async () => {
    const { publisher } = vaultBuild();
    await publisher.publishNow({ full: true });
    const published = join(drive, FOLDERS.vault, "Model-Registry.md");
    writeFileSync(published, "edited in Drive", "utf8");
    put(join(vault, "Model-Registry.md"), "# models v2");
    const next = await publisher.publishNow({ docs: true, status: false });
    expect(next.driveEdits).toHaveLength(1);
    expect(next.driveEdits[0].path).toBe("ERA Notes/Model-Registry.md");
    expect(readFileSync(join(drive, FOLDERS.proposals, ...next.driveEdits[0].keptAs.split("/")), "utf8")).toBe("edited in Drive");
    expect(readFileSync(published, "utf8")).toBe("# models v2");
  });

  it("leaves out a note carrying a credential and reports it by vault path, never the value", async () => {
    const key = "ghp_" + "b".repeat(36);
    put(join(vault, "08 - Sessions", "setup.md"), "token " + key);
    const result = await vaultBuild().publisher.publishNow({ full: true });
    expect(result.skipped).toEqual([{ path: "ERA Notes/08 - Sessions/setup.md", reason: "secret:shape:github-token" }]);
    expect(existsSync(join(drive, FOLDERS.vault, "08 - Sessions", "setup.md"))).toBe(false);
    expect(readFileSync(join(drive, FOLDERS.status, "status.md"), "utf8")).not.toContain(key);
  });

  it("lets a long first copy finish while it keeps making progress", async () => {
    const fsp = { ...nodeFsp, writeFile: async (...args: Loose[]) => (await new Promise((r) => setTimeout(r, 10)), (nodeFsp.writeFile as Loose)(...args)) };
    const result = await vaultBuild({ fsp, timeoutMs: 40, retryMs: [3_600_000] }).publisher.publishNow({ full: true });
    expect(result.ok).toBe(true);
    expect(result.wrote.length).toBeGreaterThan(10);
  });

  it("is watched by the PM server, which ignores dot-folder churn", () => {
    const server = readFileSync(join(__dirname, "..", "scripts", "pm-server.mjs"), "utf8");
    expect(server).toContain('vaultDir: join(ROOT, "ERA Notes")');
    expect(server).toContain('watch(join(ROOT, "ERA Notes"), { recursive: true }');
    const cli = readFileSync(join(__dirname, "..", "scripts", "pm", "drive-publish-cli.mjs"), "utf8");
    expect(cli).toContain('vaultDir: join(ROOT, "ERA Notes")');
  });
});
