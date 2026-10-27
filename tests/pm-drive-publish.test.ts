// One-way Google Drive publisher (scripts/pm/drive-publish.mjs).
// Real temp directories stand in for the repo and the Drive folder; the supervisor store is a
// fake whose Proxy refuses every method outside STORE_READS. No Drive, network, model or Delivery call.
import { createHash } from "node:crypto";
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
} from "../scripts/pm/drive-publish.mjs";
import { bindRun, freezeHandover, listUat, recordResult, submitFeedback } from "../scripts/delivery-v2/uat.mjs";

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
    expect(imports.sort()).toEqual(["./relay-shared.mjs", "./relay.mjs", "node:crypto", "node:fs", "node:fs", "node:path"].sort());
    expect(source).not.toMatch(/\.(?:apply|approve|dispatch|deliver|reconcile|launch|settle|resume|cancel|put[A-Z]\w*|set[A-Z]\w*)\(/u);
  });

  it("is wired into the PM server only as schedule() triggers, and the CLI opens the store read-only", () => {
    const server = readFileSync(join(__dirname, "..", "scripts", "pm-server.mjs"), "utf8");
    const uses = [...server.matchAll(/\bdrive\??\.(\w+)/gu)].map((m) => m[1]);
    expect(new Set(uses)).toEqual(new Set(["schedule"]));
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
