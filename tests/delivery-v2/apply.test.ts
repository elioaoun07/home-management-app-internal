// Command Center Phase 4 — the protected integrator (DLV-105).
//
// A verified candidate reaches the host checkout only through an owner Apply that
// names the exact candidate and result version. These fixtures drive the real
// journey (scripted Claude SDK, fake worker runtime, synthetic PM documents) to a
// verified candidate, then exercise the integrator against real files: before-image
// conflicts, unrelated CLI edits, protected and linked paths, case collisions, the
// exclusive application claim, a crash between two writes, rollback that never
// clobbers a later edit, and checks that run only in the checker, on the integrated
// snapshot. Nothing reaches a provider, a container, Git or a database.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { APPLY_REFUSALS, PROTECTED_PATHS, inspectDestination, planApplication } from "../../scripts/delivery-v2/apply.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { issuePairingCode, pairSession } from "../../scripts/delivery-v2/local-auth.mjs";
import {
  BASE_AMOUNT,
  CONFIG,
  PM_REL,
  ROW,
  bookPathIn,
  journeyFor,
  makeHarness,
  seedRoot,
  verifiedRun,
  writePolicy,
  type Loose,
} from "./fixtures/v2-harness";

let ROOT: string;
let DATA: string;
let store: ReturnType<typeof openStore>;
let seq = 0;
const cmd = () => "cmd-" + ++seq;

const host = (...parts: string[]) => join(ROOT, ...parts);
const read = (...parts: string[]) => readFileSync(host(...parts), "utf8");
const bookPath = () => bookPathIn(ROOT);
const harness = (build?: (dir: string) => void) => makeHarness(ROOT, build);
const policy = (overrides: Loose = {}) => writePolicy(ROOT, overrides);
const verified = (journey: Loose, extra: Loose = {}) => verifiedRun(journey, cmd, extra);
const journeyWith = (h: ReturnType<typeof makeHarness>, overrides: Loose = {}) => journeyFor({ root: ROOT, data: DATA, store, harness: h, overrides });
const rollbackPreview = (journey: Loose, run_id: string, application_id: string) => journey.apply({ run_id, action: "rollback-preview", application_id, actor: "owner" });
const confirmRollback = async (journey: Loose, run_id: string, application_id: string) => {
  const preview = await rollbackPreview(journey, run_id, application_id);
  expect(preview.ok).toBe(true);
  return journey.apply({
    run_id,
    action: "rollback",
    application_id,
    preview_digest: preview.digest,
    expected_revision: preview.revision,
    command_id: cmd(),
    actor: "owner",
  });
};

beforeEach(() => {
  seq = 0;
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-apply-root-"));
  DATA = mkdtempSync(join(tmpdir(), "era-v2-apply-data-"));
  seedRoot(ROOT);
  writePolicy(ROOT);
  store = openStore({ path: host(".delivery", "v2", "supervisor.sqlite") });
});

afterEach(() => {
  try {
    store.close();
  } catch {
    /* closed by a test */
  }
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(DATA, { recursive: true, force: true });
});

describe("owner-triggered Apply of the exact verified candidate", () => {
  it("writes only the approved bytes, checks the integrated snapshot in the checker and records it", async () => {
    const h = harness();
    const journey = journeyWith(h);
    const { run_id, candidate_id, result_ref, view } = await verified(journey);
    expect(view.ownerAction).toEqual({ kind: "apply", label: "Apply" });
    // Verification never wrote the checkout.
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);

    const applied = await journey.apply({ run_id, action: "apply", candidate_id, result_ref, command_id: cmd(), actor: "remote:supabase:owner-1" });
    expect(applied).toMatchObject({ ok: true, state: "applied" });
    expect(read("src", "amount.ts")).toBe("export const amount = 20;\n");
    expect(read("src", "config.ts")).toBe(CONFIG);

    const after = journey.detail(run_id);
    const application = after.applications[0];
    expect(application.state).toBe("applied");
    expect(application.ops).toEqual([{ path: "src/amount.ts", kind: "update", noop: false }]);
    expect(application.checks.state).toBe("passed");
    // The integrated generation is its own snapshot of the checkout, observed by the
    // checker outside the checkout. Identical bytes give the candidate's identity.
    expect(application.checks.generation).toBe("A1");
    expect(application.checks.integrated_id).toBe(candidate_id);
    const integrated = h.checked.find((entry) => entry.generation === "A1");
    expect(integrated).toBeDefined();
    expect(integrated!.root.replace(/\\/gu, "/").startsWith(ROOT.replace(/\\/gu, "/"))).toBe(false);
    expect(after.ownerAction.label).toBe("Applied");
    expect(after.stage.stages[after.stage.current]).toBe("Applied");
    // A verified_candidate request stays met; the application is its own fact.
    expect(after.result.observedDisposition).toBe("verified_candidate");
    expect(readFileSync(bookPath(), "utf8")).toContain("applied; integrated checks passed");
    // The checkbox is the owner's; no Git metadata appears.
    expect(read(PM_REL, "Budget", "4 - Checklist.md")).toContain(ROW);
    expect(existsSync(host(".git"))).toBe(false);
  });

  it("completes an applied-change contract with a new Result version, and a rollback reverses it", async () => {
    policy({ execution: { maxRequestedDisposition: "applied_change", repairDispatchLimit: 1, retryAutomatically: false } });
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref, view } = await verified(journey, { requestedDisposition: "applied_change" });
    expect(view.result.workComplete).toBe(false);

    await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    let after = journey.detail(run_id);
    expect(after.result.result_version).toBe(2);
    expect(after.result.observedDisposition).toBe("applied_change");
    expect(after.result.workComplete).toBe(true);

    const rolled = await confirmRollback(journey, run_id, after.applications[0].application_id);
    expect(rolled).toMatchObject({ ok: true, state: "rolled-back", restored: ["src/amount.ts"] });
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);
    after = journey.detail(run_id);
    expect(after.result.result_version).toBe(3);
    expect(after.result.observedDisposition).toBe("verified_candidate");
    expect(after.result.workComplete).toBe(false);
  });

  it("requires a matching read-only preview, deletes a true creation, and refuses a stale confirmation", async () => {
    const h = harness((dir) => {
      writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");
      writeFileSync(join(dir, "src", "extra.ts"), "export const extra = true;\n", "utf8");
    });
    const journey = journeyWith(h);
    const { run_id, candidate_id, result_ref } = await verified(journey);
    await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    const application_id = journey.detail(run_id).applications[0].application_id;

    const direct = await journey.apply({ run_id, action: "rollback", application_id, command_id: cmd(), actor: "owner" });
    expect(direct.refusals[0].code).toBe("rollback-preview-required");
    expect(existsSync(host("src", "extra.ts"))).toBe(true);

    const preview = await rollbackPreview(journey, run_id, application_id);
    expect(preview).toMatchObject({ ok: true, operations: expect.arrayContaining([expect.objectContaining({ path: "src/extra.ts", action: "delete" })]) });
    const rolled = await confirmRollback(journey, run_id, application_id);
    expect(rolled).toMatchObject({ ok: true, deleted: ["src/extra.ts"], restored: expect.arrayContaining(["src/amount.ts", "src/extra.ts"]) });
    expect(existsSync(host("src", "extra.ts"))).toBe(false);

  });

  it("refuses rollback when the checkout changes after its preview", async () => {
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    const application_id = journey.detail(run_id).applications[0].application_id;
    const preview = await rollbackPreview(journey, run_id, application_id);
    expect(preview.ok).toBe(true);
    writeFileSync(host("src", "amount.ts"), "export const amount = 30;\n", "utf8");
    const stale = await journey.apply({
      run_id,
      action: "rollback",
      application_id,
      preview_digest: preview.digest,
      expected_revision: preview.revision,
      command_id: cmd(),
      actor: "owner",
    });
    expect(stale.refusals[0].code).toBe("rollback-preview-stale");
    expect(read("src", "amount.ts")).toBe("export const amount = 30;\n");
  });

  it("preserves an unrelated CLI edit and checks the combined source", async () => {
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    writeFileSync(host("src", "config.ts"), "export const config = { mode: 'owner edit' };\n", "utf8");

    const applied = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.state).toBe("applied");
    expect(read("src", "config.ts")).toBe("export const config = { mode: 'owner edit' };\n");
    expect(read("src", "amount.ts")).toBe("export const amount = 20;\n");
    const application = journey.detail(run_id).applications[0];
    expect(application.unrelatedDrift).toEqual(["src/config.ts"]);
    // Evidence is bound to the combined source, not to the candidate alone.
    expect(application.checks.integrated_id).not.toBe(candidate_id);
  });

  it("rechecks on the current source before writing when a CLI edit breaks the checks, and writes nothing", async () => {
    // Command Center Phase 5: base drift re-observes the candidate's criteria on the
    // source the application would produce, before any byte reaches the checkout.
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    writeFileSync(host("src", "config.ts"), "export const config = 'BROKEN';\n", "utf8");

    const refused = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(refused).toMatchObject({ ok: false, state: "reassessment-failed" });
    expect(refused.refusals[0].code).toBe("checks-fail-on-current-source");
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);
    const view = journey.detail(run_id);
    expect(view.applications[0].reassessment).toMatchObject({ state: "failed", generation: "P1" });
    expect(view.ownerAction.label).toBe("Apply");

    // Once the owner repairs the edit, the same candidate applies.
    writeFileSync(host("src", "config.ts"), "export const config = { mode: 'repaired' };\n", "utf8");
    expect((await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" })).state).toBe("applied");
  });

  it("reports failing integrated checks without calling the change applied; rollback keeps the CLI edit", async () => {
    // A CLI edit that lands while the integrator writes is seen only by the integrated check.
    const journey = journeyWith(harness(), {
      applyFaults: { beforeWrite: () => writeFileSync(host("src", "config.ts"), "export const config = 'BROKEN';\n", "utf8") },
    });
    const { run_id, candidate_id, result_ref } = await verified(journey);

    const applied = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.state).toBe("checks-failed");
    let view = journey.detail(run_id);
    expect(view.ownerAction.label).toBe("Checks failed");
    expect(view.stage.stages[view.stage.current]).not.toBe("Applied");

    const rolled = await confirmRollback(journey, run_id, view.applications[0].application_id);
    expect(rolled.ok).toBe(true);
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);
    expect(read("src", "config.ts")).toBe("export const config = 'BROKEN';\n");
    view = journey.detail(run_id);
    expect(view.ownerAction.label).toBe("Apply");
  });

  it("blocks on a conflict with the current checkout and writes nothing; the candidate stays available", async () => {
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    writeFileSync(host("src", "amount.ts"), "export const amount = 30;\n", "utf8");

    const refused = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(refused.ok).toBe(false);
    expect(refused.refusals[0].code).toBe("application-conflict");
    expect(refused.refusals[0].detail).toEqual([expect.objectContaining({ path: "src/amount.ts", kind: "changed-since-base" })]);
    expect(read("src", "amount.ts")).toBe("export const amount = 30;\n");
    expect(journey.detail(run_id).ownerAction.label).toBe("Conflict");

    // Once the owner restores the base, the same candidate applies.
    writeFileSync(host("src", "amount.ts"), BASE_AMOUNT, "utf8");
    const applied = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.state).toBe("applied");
  });

  it("refuses an approval bound to another candidate or result version, and replays a command from its receipt", async () => {
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    const stale = await journey.apply({ run_id, candidate_id: "cand-other", result_ref, command_id: cmd(), actor: "owner" });
    expect(stale.refusals[0].code).toBe("apply-approval-stale");
    const staleVersion = await journey.apply({ run_id, candidate_id, result_ref: result_ref.replace(/@\d+$/u, "@9"), command_id: cmd(), actor: "owner" });
    expect(staleVersion.refusals[0].code).toBe("apply-approval-stale");
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);

    const id = cmd();
    const first = await journey.apply({ run_id, candidate_id, result_ref, command_id: id, actor: "owner" });
    const replay = await journey.apply({ run_id, candidate_id, result_ref, command_id: id, actor: "owner" });
    expect(first.state).toBe("applied");
    expect(replay).toMatchObject({ duplicate: true, state: "applied" });
    expect(store.listApplications(run_id)).toHaveLength(1);
    const again = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(again.refusals[0].code).toBe("candidate-already-applied");
    const otherActor = await journey.apply({ run_id, candidate_id, result_ref, command_id: id, actor: "remote:supabase:someone-else" });
    expect(otherActor.refusals[0].code).toBe("command-conflict");
  });

  it("holds one exclusive application claim per destination", async () => {
    const journey = journeyWith(harness());
    const { run_id, candidate_id, result_ref } = await verified(journey);
    const holder = store.insertApplication({
      application_id: "app-holder",
      run_id,
      candidate_id: "cand-holder",
      result_ref: "res@1",
      destination: realpathSync.native(ROOT).replace(/\\/gu, "/"),
      state: "writing",
      claim: "another-process",
      plan: { ops: [] },
      actor: "owner",
      command_id: "cmd-holder",
    });
    expect(holder.acquired).toBe(true);
    const refused = await journey.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(refused.refusals[0]).toMatchObject({ code: "application-in-progress", detail: "app-holder" });
    expect(read("src", "amount.ts")).toBe(BASE_AMOUNT);
  });

  it("recovers a crash between writes: interrupted after restart, then resumed without rewriting what landed", async () => {
    const h = harness((dir) => {
      writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");
      writeFileSync(join(dir, "src", "extra.ts"), "export const extra = true;\n", "utf8");
    });
    let writes = 0;
    const crashing = journeyWith(h, {
      claimant: "process-1",
      applyFaults: {
        beforeWrite: () => {
          writes += 1;
          if (writes === 2) throw Object.assign(new Error("process died"), { simulatedCrash: true });
        },
      },
    });
    const { run_id, candidate_id, result_ref } = await verified(crashing);
    const crashed = await crashing.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(crashed.ok).toBe(false);
    expect(store.listApplications(run_id)[0].state).toBe("writing");
    expect(read("src", "amount.ts")).toBe("export const amount = 20;\n");
    expect(existsSync(host("src", "extra.ts"))).toBe(false);

    store.close();
    store = openStore({ path: host(".delivery", "v2", "supervisor.sqlite") });
    const restarted = journeyWith(h, { claimant: "process-2" });
    const reconciled = await restarted.reconcile();
    expect(reconciled.interruptedApplications).toHaveLength(1);
    let view = restarted.detail(run_id);
    expect(view.applications[0].state).toBe("interrupted");
    expect(view.applications[0].inspected).toMatchObject({ applied: ["src/amount.ts"], pending: ["src/extra.ts"], foreign: [] });
    expect(view.ownerAction.label).toBe("Resolve apply");

    const resumed = await restarted.apply({ run_id, action: "resume", application_id: view.applications[0].application_id, command_id: cmd(), actor: "owner" });
    expect(resumed.state).toBe("applied");
    expect(read("src", "extra.ts")).toBe("export const extra = true;\n");
    view = restarted.detail(run_id);
    expect(view.applications).toHaveLength(1);
    expect(view.applications[0].state).toBe("applied");
  });

  it("rolls back an interrupted application only where the bytes are still the candidate's", async () => {
    const h = harness((dir) => {
      writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");
      writeFileSync(join(dir, "src", "extra.ts"), "export const extra = true;\n", "utf8");
      rmSync(join(dir, "src", "old.ts"));
    });
    writeFileSync(host("src", "old.ts"), "export const old = 1;\n", "utf8");
    let writes = 0;
    const crashing = journeyWith(h, {
      claimant: "process-1",
      applyFaults: {
        beforeWrite: () => {
          writes += 1;
          if (writes === 3) throw Object.assign(new Error("process died"), { simulatedCrash: true });
        },
      },
    });
    const { run_id, candidate_id, result_ref } = await verified(crashing);
    await crashing.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    // Two of three operations landed (amount update, extra create); old.ts is still there.
    expect(read("src", "extra.ts")).toBe("export const extra = true;\n");
    expect(existsSync(host("src", "old.ts"))).toBe(true);

    const restarted = journeyWith(h, { claimant: "process-2" });
    await restarted.reconcile();
    // The owner edits one of the written files before deciding.
    writeFileSync(host("src", "extra.ts"), "export const extra = 'owner kept this';\n", "utf8");
    const application_id = restarted.detail(run_id).applications[0].application_id;
    const resume = await restarted.apply({ run_id, action: "resume", application_id, command_id: cmd(), actor: "owner" });
    expect(resume.refusals[0].code).toBe("application-conflict");

    const preview = await rollbackPreview(restarted, run_id, application_id);
    expect(preview.ok).toBe(false);
    expect(preview.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ path: "src/extra.ts" })]));
    expect(read("src", "amount.ts")).toBe("export const amount = 20;\n");
    expect(read("src", "extra.ts")).toBe("export const extra = 'owner kept this';\n");
    expect(read("src", "old.ts")).toBe("export const old = 1;\n");
    expect(restarted.detail(run_id).applications[0].state).toBe("interrupted");
  });

  it("leaves checks pending, never applied, when no checker runtime is available", async () => {
    const h = harness();
    const { run_id, candidate_id, result_ref } = await verified(journeyWith(h));
    const withoutChecker = journeyWith(h, { runtime: { ...h.runtime, checkExecutor: undefined } });
    const applied = await withoutChecker.apply({ run_id, candidate_id, result_ref, command_id: cmd(), actor: "owner" });
    expect(applied.state).toBe("checks-pending");
    const view = withoutChecker.detail(run_id);
    expect(view.ownerAction.label).toBe("Checks pending");
    expect(view.stage.stages[view.stage.current]).not.toBe("Applied");
    expect(view.applications[0].checks).toMatchObject({ state: "not-run", reason: "no checker runtime" });
  });
});

describe("the integrator's path boundary", () => {
  function candidateFrom(base: Record<string, string>, next: Record<string, string>) {
    const baseDir = mkdtempSync(join(tmpdir(), "era-v2-apply-base-"));
    const nextDir = mkdtempSync(join(DATA, "cand-"));
    for (const [path, text] of Object.entries(base)) {
      mkdirSync(join(baseDir, ...path.split("/").slice(0, -1)), { recursive: true });
      writeFileSync(join(baseDir, ...path.split("/")), text, "utf8");
    }
    for (const [path, text] of Object.entries(next)) {
      mkdirSync(join(nextDir, ...path.split("/").slice(0, -1)), { recursive: true });
      writeFileSync(join(nextDir, ...path.split("/")), text, "utf8");
    }
    const base_manifest = freezeCandidate({ root: baseDir }).manifest as unknown as Loose[];
    rmSync(baseDir, { recursive: true, force: true });
    return freezeCandidate({ root: nextDir, base_manifest: base_manifest as never }) as unknown as Loose;
  }

  it("refuses protected paths whatever the publication scope allows", () => {
    mkdirSync(host("scripts", "delivery-v2"), { recursive: true });
    mkdirSync(host(".github", "workflows"), { recursive: true });
    const candidate = candidateFrom({}, { "scripts/delivery-v2/policy.mjs": "x", ".github/workflows/ci.yml": "x", "CLAUDE.md": "x" });
    const plan = planApplication({ root: ROOT, candidate, publicationScope: { allowedPaths: ["scripts", ".github", "CLAUDE.md"] } });
    expect(plan.ok).toBe(false);
    const protectedHits = plan.refusals.filter((entry: Loose) => entry.code === APPLY_REFUSALS.PROTECTED_PATH || entry.code === APPLY_REFUSALS.UNSAFE_PATH);
    expect(protectedHits.map((entry: Loose) => entry.path).sort()).toEqual([".github/workflows/ci.yml", "CLAUDE.md", "scripts/delivery-v2/policy.mjs"]);
    expect(PROTECTED_PATHS).toContain("scripts/delivery-v2");
  });

  it("refuses a policy-added protected path and a candidate outside the publication scope", () => {
    const candidate = candidateFrom({ "src/amount.ts": BASE_AMOUNT }, { "src/amount.ts": "x", "docs/notes.md": "x" });
    const plan = planApplication({ root: ROOT, candidate, publicationScope: { allowedPaths: ["src"] }, protectedPaths: ["src/amount.ts"] });
    expect(plan.refusals.map((entry: Loose) => entry.code)).toEqual(expect.arrayContaining([APPLY_REFUSALS.OUTSIDE_SCOPE, APPLY_REFUSALS.PROTECTED_PATH]));
  });

  it("refuses to follow a link or junction in the destination", () => {
    const outside = mkdtempSync(join(tmpdir(), "era-v2-apply-outside-"));
    try {
      symlinkSync(outside, host("src", "linked"), "junction");
      const candidate = candidateFrom({}, { "src/linked/evil.ts": "export {};\n" });
      const plan = planApplication({ root: ROOT, candidate, publicationScope: { allowedPaths: ["src"] } });
      expect(plan.refusals).toEqual([expect.objectContaining({ code: APPLY_REFUSALS.LINK_ESCAPE, path: "src/linked/evil.ts" })]);
      expect(existsSync(join(outside, "evil.ts"))).toBe(false);
    } finally {
      rmSync(host("src", "linked"), { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses a name that differs from an existing entry only by case", () => {
    writeFileSync(host("src", "README.md"), "# readme\n", "utf8");
    expect(inspectDestination(ROOT, "src/Readme.md")).toMatchObject({ ok: false, reason: APPLY_REFUSALS.NAME_COLLISION, detail: "README.md" });
  });

  it("refuses a candidate frozen inside the checkout it would be applied to", () => {
    mkdirSync(host("scratch", "src"), { recursive: true });
    writeFileSync(host("scratch", "src", "amount.ts"), "export const amount = 20;\n", "utf8");
    const inside = freezeCandidate({ root: host("scratch"), base_manifest: [{ path: "src/amount.ts", sha256: "sha256:x", size: 1 }] }) as unknown as Loose;
    const plan = planApplication({ root: ROOT, candidate: inside, publicationScope: { allowedPaths: ["src"] } });
    expect(plan.refusals.map((entry: Loose) => entry.code)).toContain(APPLY_REFUSALS.CANDIDATE_INSIDE_DESTINATION);
  });

  it("names migration files without running anything", () => {
    const candidate = candidateFrom({}, { "migrations/2026-09-12_example.sql": "select 1;\n" });
    const plan = planApplication({ root: ROOT, candidate, publicationScope: { allowedPaths: ["migrations"] } });
    expect(plan.ok).toBe(true);
    expect(plan.migrationPaths).toEqual(["migrations/2026-09-12_example.sql"]);
  });

  it("contains no process, Git, deploy or database capability", () => {
    const source = readFileSync(join(__dirname, "..", "..", "scripts", "delivery-v2", "apply.mjs"), "utf8");
    const code = source.replace(/\/\/.*$/gmu, "");
    for (const forbidden of ["child_process", "spawn", "execSync", "execFile", "supabase", "fetch("]) {
      expect(code.includes(forbidden)).toBe(false);
    }
    expect(/\bgit\s+(reset|merge|commit|push)\b/u.test(code)).toBe(false);
  });
});

describe("the Apply route", () => {
  it("requires a paired credential and passes the owner's binding through unchanged", async () => {
    const calls: Loose[] = [];
    const ctx = { root: ROOT, journey: { apply: async (input: Loose) => (calls.push(input), { ok: true, state: "applied", refusals: [] }) } };
    const body = { run_id: "r-1", candidate_id: "cand-1", result_ref: "res-1@1", command_id: "c-1" };
    const anonymous = await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/apply", body, headers: {} }, ctx);
    expect(anonymous!.status).toBe(401);
    expect(calls).toHaveLength(0);

    const { code } = issuePairingCode({ root: ROOT });
    const bridge = pairSession({ root: ROOT, code, kind: "bridge" });
    const remote = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/apply", body, headers: { authorization: "Bearer " + bridge.token, "x-era-remote-actor": "supabase:owner-1" } },
      ctx,
    );
    expect(remote!.status).toBe(200);
    expect(calls[0]).toMatchObject({ run_id: "r-1", action: "apply", candidate_id: "cand-1", result_ref: "res-1@1", command_id: "c-1", actor: "remote:supabase:owner-1" });
  });
});
