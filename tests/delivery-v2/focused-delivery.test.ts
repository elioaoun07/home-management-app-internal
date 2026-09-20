import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { revokeGrant } from "../../scripts/delivery-v2/contracts.mjs";
import { SELECT, BOOK, bookPathIn, journeyFor, makeHarness, seedRoot, writePolicy, type Loose } from "./fixtures/v2-harness";

let root: string, data: string, store: ReturnType<typeof openStore>, seq: number;
const cmd = () => "focused-" + ++seq;
const material = {
  outcome: "The control emits 20", scope: ["src/amount.ts"], steps: ["Change the constant from 25 to 20"],
  acceptance: ["The control emits 20"], invariants: ["Keep configuration unchanged"], exclusions: ["No other controls"],
  checks: ["amount-check"], risks: [], unknowns: [], dependencies: [], risk: "low", ownerReviewed: true, provenance: "Owner-reviewed fixture specification",
};
const source = (ready = true, changes = {}) => BOOK.replace("\n## Delivery session log", "\n**Touches:** `src/amount.ts`\n<!-- delivery:advisory:v1 -->\nStart with src/amount.ts; verify the current constant.\n<!-- /delivery:advisory -->\n" + (ready ? "```delivery-plan-v1\n" + JSON.stringify({ ...material, ...changes }) + "\n```\n" : "") + "\n## Delivery session log");
const typecheckPolicy = {
  specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } }, inputs: ["tests/amount.check.mjs"],
  requiredVerifications: { typecheck: { enabled: true, enforcement: "required", argv: ["tsc", "--noEmit"], include: ["src", "tsconfig.json"] } },
};
beforeEach(() => {
  seq = 0;
  root = mkdtempSync(join(tmpdir(), "era-focused-root-")); data = mkdtempSync(join(tmpdir(), "era-focused-data-"));
  seedRoot(root); writePolicy(root, { checks: typecheckPolicy });
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }));
  writeFileSync(bookPathIn(root), source());
  store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") });
});
afterEach(() => { store.close(); rmSync(root, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); });
const harness = (build?: (dir: string) => void, overrides: Loose = {}) => {
  const h = { ...makeHarness(root, build), hideNativeRef: false };
  // Fixture supplies the bridge capability; prompts and recovery bytes are
  // inspected from persisted requests, no container or model is invoked.
  h.runtime.taskBriefs = true;
  const journey = journeyFor({ root, data, store, harness: h, overrides: {
    store: () => ({ ...store, getJob: (id: string) => { const row = store.getJob(id); return h.hideNativeRef && row?.access === "read-only" ? { ...row, native_ref: null } : row; } }),
    typecheckExecutor: () => ({ exitCode: 0, stdout: "", stderr: "", spawnError: null, signal: null }),
    ...overrides,
  } });
  return { h, journey };
};
const launch = (journey: Loose, extra: Loose = {}) => journey.deliver({ ...SELECT, executor: "claude", model: "claude-test", effort: "low", workProfile: "focused", actor: "owner", command_id: cmd(), ...extra });
const approve = (journey: Loose, run_id: string, extra: Loose = {}) => {
  const plan = journey.detail(run_id).plans.at(-1);
  return journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: cmd(), actor: "owner", ...extra });
};

describe("prepared Focused lifecycle", () => {
  it.each(["held", "dependency"])("does not prepare or dispatch through a %s gate", async gate => {
    const selected = { ...SELECT };
    if (gate === "held") {
      selected.expectLine = SELECT.expectLine.replace("quick-amount", "HELD quick-amount");
      writeFileSync(join(root, "ERA Notes/10 - Project Management/Budget/4 - Checklist.md"), "## Now\n\n" + selected.expectLine + "\n");
    } else writeFileSync(bookPathIn(root), source().replace("**Touches:**", "**Depends on:** BUD-99\n**Touches:**"));
    const { h, journey } = harness();
    const delivered = await launch(journey, selected); await journey.idle();
    expect(delivered.ok).toBe(false); expect(h.calls).toHaveLength(0); expect(store.listRuns()).toHaveLength(0);
  });
  it("creates no job before approval, replays commands, then checks and applies through the ordinary gates", async () => {
    const { h, journey } = harness();
    const command_id = cmd();
    const delivered = await launch(journey, { command_id }); await journey.idle();
    expect(delivered).toMatchObject({ ok: true, prepared: true, job_id: null });
    expect(h.calls).toHaveLength(0); expect(store.listJobs(delivered.run_id)).toHaveLength(0);
    const plan = journey.detail(delivered.run_id).plans[0];
    expect(plan.body.steps).toEqual([{ title: material.steps[0] }]);
    expect(plan.body.preparation.kind).toBe("selected-item");
    expect(await launch(journey, { command_id })).toMatchObject({ duplicate: true, run_id: delivered.run_id });
    const decision_id = cmd();
    await approve(journey, delivered.run_id, { command_id: decision_id }); await journey.idle();
    expect(await approve(journey, delivered.run_id, { command_id: decision_id })).toMatchObject({ duplicate: true });
    expect(h.calls).toHaveLength(1); expect(h.calls[0].access).toBe("write");
    expect(h.calls[0].prompt).toContain("Task brief:"); expect(h.calls[0].prompt).toContain("one Focused implementation");
    expect(h.calls[0].prompt.match(/Change the constant from 25 to 20/g)).toHaveLength(1);
    const view = journey.detail(delivered.run_id);
    expect(view.run.closed_outcome).toBe("verified_candidate");
    const applied = await journey.apply({ run_id: delivered.run_id, candidate_id: view.candidate.candidate_id, result_ref: view.result.result_id + "@" + view.result.result_version, command_id: cmd(), actor: "owner", action: "apply" });
    expect(applied.ok).toBe(true);
    expect(readFileSync(join(root, "src/amount.ts"), "utf8")).toContain("= 20;");
  });
  it.each(["steps", "checks", "invariants"])("uses investigation when %s is missing", async field => {
    writeFileSync(bookPathIn(root), source(true, { [field]: [] }));
    const { h, journey } = harness(); const delivered = await launch(journey); await journey.idle();
    expect(delivered.prepared).not.toBe(true); expect(h.calls).toHaveLength(1);
    expect(h.calls[0].access).toBe("read-only");
  });
  it("allows a prepared plan revision through a real investigation without a phantom planning job", async () => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    await approve(journey, delivered.run_id, { decision: "revise", feedback: "Inspect the implementation first" }); await journey.idle();
    expect(h.calls).toHaveLength(1); expect(h.calls[0].access).toBe("read-only");
    expect(h.calls[0].prompt).toContain("This is Focused delivery");
    expect(journey.detail(delivered.run_id).plans.at(-1).revision).toBe(2);
  });
  it("refuses a stale specification at approval without dispatching", async () => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    writeFileSync(bookPathIn(root), source(true, { steps: ["Change to 21"] }));
    await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls).toHaveLength(0); expect(store.listJobs(delivered.run_id)).toHaveLength(0);
    expect(journey.detail(delivered.run_id).run.waiting_reason).toBe("continuation-refused");
  });
  it.each(["source", "grant"])("refuses changed %s before the first job", async change => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    if (change === "source") writeFileSync(join(root, "src/amount.ts"), "export const amount = 21;\n");
    const run = store.getRun(delivered.run_id)!;
    if (change === "grant") store.putGrant(revokeGrant(store.getGrant(String(run.grant_id))!));
    const decided = await approve(journey, delivered.run_id); await journey.idle();
    expect(decided.continuation.ok).toBe(false); expect(h.calls).toHaveLength(0);
    // Replay cannot reinsert the original unrevoked grant.
    expect((await launch(journey, { command_id: "focused-1" })).duplicate).toBe(true);
    if (change === "grant") expect(store.getGrant(String(run.grant_id))!.revocation_version).toBeGreaterThan(0);
  });
  it("rejects a snapshot that does not match the source approved before preparation", async () => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    const provision = h.runtime.provision;
    h.runtime.provision = async (args: Loose) => {
      const result = await provision(args);
      return { ...result, base_manifest: result.base_manifest.map((row: Loose) => row.path === "src/amount.ts" ? { ...row, sha256: "sha256:changed" } : row) };
    };
    await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls).toHaveLength(0);
    expect(String(store.listJobs(delivered.run_id)[0].reason)).toContain("prepared snapshot changed");
  });
  it("keeps the frozen advisory input without invalidating approval on guide-only changes", async () => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    writeFileSync(bookPathIn(root), source().replace("Start with src/amount.ts", "Start with NEW-GUIDE"));
    await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls).toHaveLength(1); expect(h.calls[0].prompt).not.toContain("NEW-GUIDE");
    expect(h.calls[0].prompt).toContain("Start with src/amount.ts");
  });
  it("preserves the scope-growth stop", async () => {
    const { h, journey } = harness(dir => {
      writeFileSync(join(dir, "src/amount.ts"), "export const amount = 20;\n");
      writeFileSync(join(dir, "src/config.ts"), "export const config = { mode: 'changed' };\n");
    });
    const delivered = await launch(journey); await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls).toHaveLength(1);
    expect(journey.detail(delivered.run_id).run.waiting_reason).toBe("plan-scope-changed");
    expect(h.checked).toHaveLength(0);
    expect(journey.detail(delivered.run_id).ownerAction.label).toBe("Review scope");
    await journey.control({ run_id: delivered.run_id, action: "recheck", command_id: cmd(), actor: "owner" });
    expect(journey.detail(delivered.run_id).result.candidateVerified).toBe(false);
  });
  it("cannot use an old plan revision after requesting investigation", async () => {
    const { h, journey } = harness(); const delivered = await launch(journey);
    const old = journey.detail(delivered.run_id).plans[0];
    await approve(journey, delivered.run_id, { decision: "revise", feedback: "Inspect first" }); await journey.idle();
    const stale = await journey.decide({ run_id: delivered.run_id, plan_id: old.plan_id, plan_revision: old.revision, decision: "approve", command_id: cmd(), actor: "owner" });
    expect(stale.ok).toBe(false); expect(h.calls).toHaveLength(1);
  });
});

describe("ordinary Focused brief and resolved profile", () => {
  it.each([false, true])("preserves Focused instructions and limits through queued admission (prepared=%s)", async prepared => {
    writeFileSync(bookPathIn(root), source(prepared));
    const { h, journey } = harness();
    // Only this disposable fixture's allowance changes; installed policy is untouched.
    journey.changeAllowance({ action: "fleet", limit: 5, period: "reset", command_id: cmd(), actor: "owner" });
    const delivered = await launch(journey, { workProfile: null });
    if (prepared) expect((await approve(journey, delivered.run_id)).continuation.queued).toBe(true);
    else expect(delivered.queued).toBe(true);
    await journey.idle(); expect(h.calls).toHaveLength(0);
    journey.changeAllowance({ action: "fleet", limit: null, command_id: cmd(), actor: "owner" });
    await journey.idle();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].prompt).toContain(prepared ? "one Focused implementation" : "This is Focused delivery");
    expect(h.calls[0].prompt).toContain("Task brief:");
    expect(JSON.parse(String(store.listJobs(delivered.run_id)[0].request_json)).native_limits.maxTurns).toBeLessThanOrEqual(prepared ? 24 : 12);
  });
  it("uses the recommended profile for the first prompt and native limits, then recovers by reference", async () => {
    writeFileSync(bookPathIn(root), source(false));
    const { h, journey } = harness(); const delivered = await launch(journey, { workProfile: null }); await journey.idle();
    expect(delivered.settings.work_profile).toBe("focused"); expect(h.calls[0].prompt).toContain("This is Focused delivery");
    const planning = store.listJobs(delivered.run_id)[0];
    expect(JSON.parse(String(planning.request_json)).native_limits.maxTurns).toBeLessThanOrEqual(12);
    await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls[1].prompt).toContain("/tmp/era-task-brief-");
    expect(h.calls[1].prompt).not.toContain("Task brief:\n");
    const build = JSON.parse(String(store.listJobs(delivered.run_id)[1].request_json));
    expect(JSON.parse(build.task_brief.text).guidance.text).toContain("verify the current constant");
    expect(JSON.parse(build.task_brief.text).plan.body.scope).toEqual(["src/amount.ts"]);
  });
  it("sends full recovery input when native continuity is unavailable", async () => {
    writeFileSync(bookPathIn(root), source(false));
    const { h, journey } = harness(); const delivered = await launch(journey); await journey.idle();
    h.hideNativeRef = true;
    await approve(journey, delivered.run_id); await journey.idle();
    expect(h.calls[1].prompt).toContain("Task brief:\n");
    expect(h.calls[1].prompt).toContain("verify the current constant");
  });
});

describe.each([false, true])("verification and Apply parity (prepared=%s)", prepared => {
  it.each(["failed", "inconclusive", "zero-tests"])("does not verify or Apply %s evidence", async state => {
    writeFileSync(bookPathIn(root), source(prepared));
    let calls = 0;
    const { h, journey } = harness(undefined, { typecheckExecutor: () => {
      calls += 1;
      const stdout = state === "inconclusive" ? "src/amount.ts(1,1): error TS2307: Cannot find module 'missing'." : state === "failed" && calls % 2 === 0 ? "src/amount.ts(1,1): error TS2339: Property 'from' does not exist." : "";
      return { exitCode: stdout ? 2 : 0, stdout, stderr: "", spawnError: null, signal: null };
    } });
    if (state === "zero-tests") h.runtime.checkExecutor = () => () => ({ exitCode: 0, stdout: "No test files found", stderr: "", spawnError: null });
    const delivered = await launch(journey); await journey.idle();
    await approve(journey, delivered.run_id); await journey.idle();
    const view = journey.detail(delivered.run_id);
    expect(view.result.candidateVerified).toBe(false);
    const applied = await journey.apply({ run_id: delivered.run_id, candidate_id: view.candidate.candidate_id, result_ref: view.result.result_id + "@" + view.result.result_version, command_id: cmd(), actor: "owner", action: "apply" });
    expect(applied.ok).toBe(false);
    expect(readFileSync(join(root, "src/amount.ts"), "utf8")).toContain("= 25;");
    expect(h.calls.filter((job: Loose) => job.access === "write")).toHaveLength(1);
  });
  it.each(["missing", "stale"])("refuses Apply with %s required verification", async state => {
    writeFileSync(bookPathIn(root), source(prepared));
    let changed = false;
    const { journey } = harness(undefined, { store: () => ({ ...store, listEvidence: (runId: string, candidateId?: string) => store.listEvidence(runId).filter((row: Loose) => !candidateId || row.candidate_id === candidateId).flatMap((row: Loose) => {
      const record = JSON.parse(String(row.record_json));
      if (!changed || !record.verification) return [row];
      if (state === "missing") return [];
      return [{ ...row, record_json: JSON.stringify({ ...record, verification: { ...record.verification, candidate_id: "different-candidate" } }) }];
    }) }) });
    const delivered = await launch(journey); await journey.idle();
    await approve(journey, delivered.run_id); await journey.idle();
    const view = journey.detail(delivered.run_id);
    expect(view.result.candidateVerified).toBe(true);
    changed = true;
    const applied = await journey.apply({ run_id: delivered.run_id, candidate_id: view.candidate.candidate_id, result_ref: view.result.result_id + "@" + view.result.result_version, command_id: cmd(), actor: "owner", action: "apply" });
    expect(applied.ok).toBe(false);
    expect(applied.refusals[0].code).toBe("required-verification-missing-failed-or-stale");
  });
});
