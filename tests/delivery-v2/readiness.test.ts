import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateReadiness, readinessFact as fact, readinessForRefusals, nativeModelAvailabilityFact, nativeModelDiagnostics, LAUNCH_GATES } from "../../scripts/delivery-v2/readiness.mjs";
import { inspectReadiness } from "../../scripts/delivery-v2/inspect-readiness.mjs";
import { runReadyCli } from "../../scripts/delivery-v2/ready-cli.mjs";
import { createDeliveryV2Context } from "../../scripts/delivery-v2/service.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { buildDeliver } from "../../scripts/delivery-v2/policy.mjs";
import { makeBoundaryConfig, boundaryBindingDigest } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { makeEnvironmentSpec, makeEnvironmentReceipt, environmentReference } from "../../scripts/delivery-v2/dependency-environment.mjs";
import { makeQualificationReceipt, writeQualificationReceipt } from "../../scripts/delivery-v2/qualification.mjs";
import { seedRoot, writePolicy, PM_REL, bookPathIn, SELECT } from "./fixtures/v2-harness";
import { readinessCanStart } from "../../scripts/pm/app/readinessModel";
import type { V2Readiness } from "../../scripts/pm/app/types";

const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), "era-readiness-")); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (text: string | Buffer) => "sha256:" + createHash("sha256").update(text).digest("hex");
const image = hash("image"), now = "2026-10-17T12:00:00.000Z";
const selection = { file: SELECT.file, id: SELECT.expectId, executor: "claude", model: "claude-test", effort: "low", workProfile: "focused" };
const packages = { typescript: "5.9.2", esbuild: "0.25.12", vitest: "4.1.7", eslint: "9.36.0" };
function fixture(boundChecks = false, codex = false) {
  const root = temp(); seedRoot(root);
  const packageJson = codex ? JSON.stringify({ devDependencies: { "@openai/codex-sdk": "0.144.1" } }) : "{}";
  writeFileSync(join(root, "package.json"), packageJson);writeFileSync(join(root, "pnpm-lock.yaml"), "lock");writeFileSync(join(root, "tsconfig.json"), "{}");
  writeFileSync(bookPathIn(root), readFileSync(bookPathIn(root), "utf8").replace("### BUD-14", '### BUD-14\n\n**Touches:** `src/amount.ts`'));
  const spec = makeEnvironmentSpec({ image, nodeVersion: "v22.23.2", pnpmVersion: "10.16.0", pnpmDigest: hash("pnpm"), packageJson, lockfile: "lock", packages,
    oracles: [{ id: "amount", argv: ["node", "tests/amount.check.mjs"], assertions: 2, inputs: { "tests/amount.check.mjs": hash(readFileSync(join(root, "tests/amount.check.mjs"))) } }],
    ...(boundChecks ? { checks: { amount: { argv: ["node", "tests/amount.check.mjs"], assertions: 2, inputs: { "tests/amount.check.mjs": hash(readFileSync(join(root, "tests/amount.check.mjs"))) } } } } : {}) });
  const receipt = makeEnvironmentReceipt({ spec, volume: "era-readiness-fixture", inventory: { ok: true, digest: hash("contents") }, probes: { ok: true, compilerNegativeControl: true, compilerPositiveControl: true, nativeExecuted: true, node: spec.nodeVersion, platform: "linux", arch: "x64", glibc: "2.36", packages,
    ...(codex ? { nativePackages: { "@openai/codex-sdk": { sdkVersion: "0.144.1", cliVersion: "0.144.1", executed: true, exitCode: 0 } } } : {}) }, oracles: [{ id: "amount", exitCode: 0, passed: 2, failed: 0 }], observedAt: now });
  const dependencies = environmentReference(receipt);
  const boundary = makeBoundaryConfig({ image, dependencies });
  const checks = { specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"], ...(boundChecks ? { expected: { assertions: 2 } } : {}) } }, inputs: ["tests/amount.check.mjs"], requiredVerifications: { typecheck: { argv: ["tsc", "--noEmit"], isolation: "checker", program: { roots: ["tsconfig.json", "src"], extensions: [".ts", ".json"] } } } };
  writePolicy(root, { runtime: { kind: "container", image, dependencies, network: { mode: "none" } }, scratchScope: { kind: "snapshot", include: ["src/amount.ts", "src/config.ts", "tests/amount.check.mjs"] }, checks,
    ...(codex ? { executors: { permitted: ["codex"], catalog: { revision: 1, models: { codex: [{ id: "codex-test", efforts: ["low"] }] }, profiles: {} } } } : {}),
    resources: { unit: "tokens", allowance: 10000, strict: false, enforcement: "advisory", perJobReservation: { amount: 1000, basis: "fixture" } } });
  const binding = { backend_id: codex ? "codex-exec-sdk" : "claude-agent-sdk", sdk_version: "fixture", boundary_digest: boundaryBindingDigest(boundary, image), battery_digest: hash("battery") };
  const controls = Object.fromEntries(["filesystem.scratchWrite", "filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "filesystem.linkEscape", "network.egress", "process.descendantsAfterStop", "store.workerAccess"].map(id => [id, { state: "supported", verified: true, evidence_ref: "fixture:" + id }]));
  writeQualificationReceipt({ root, receipt: makeQualificationReceipt({ backend_id: binding.backend_id, binding, controls, negativeControl: { valid: true }, harness: { name: "worker-qualification", run: "fixture" }, observed_at: now }) });
  return { root, receipt, binding, checks };
}
async function observed(f: ReturnType<typeof fixture>, chosen = selection) {
  const initial = await inspectReadiness({ root: f.root, ...chosen, now });
  const evidence = (value: object) => ({ contextFingerprint: initial.contextFingerprint, observedAt: now, fact: fact("satisfied", "fixture-current", null, value) });
  return { runtime: evidence({ image, binding: f.binding }), authentication: evidence({ backend_id: f.binding.backend_id, method: chosen.executor === "codex" ? "chatgpt" : "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true }), environment: evidence({ receipt: f.receipt }) };
}
const codexSelection = { ...selection, executor: "codex", model: "codex-test" };
const nativeProbe = (observedAt = now) => ({ schema: "delivery-v2/codex-model-probe@1", backend_id: "codex-exec-sdk", model: codexSelection.model, effort: codexSelection.effort,
  nativeVersion: "0.144.1", ok: true, modelAdvertised: true, effortAdvertised: true, cleanupConfirmed: true, containerCleanupConfirmed: true, providerTurns: 0, entitlement: "unverified", observedAt,
  subscription: { method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true } });
function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  function walk(path: string, prefix = "") { for (const entry of readdirSync(path, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) walk(join(path, entry.name), name + "/");
    else result[name] = hash(readFileSync(join(path, entry.name)));
  } }
  walk(root); return result;
}

describe("shared readiness facts", () => {
  it("never treats missing/dependent or unknown facts as ready; fingerprints are deterministic", () => {
    const facts = Object.fromEntries(LAUNCH_GATES.map(gate => [gate, fact("satisfied", gate)]));
    const ready = evaluateReadiness({ selection, facts });
    expect(ready.ready).toBe(true);expect(evaluateReadiness({ selection, facts })).toEqual(ready);
    for (const gate of LAUNCH_GATES) for (const state of ["unknown", "blocked", "unavailable"]) {
      const result = evaluateReadiness({ selection, facts: { ...facts, [gate]: fact(state, gate + "-gap") } });
      expect(result.ready).toBe(false);expect(result.blockers[0].gate).toBe(gate);expect(result.fingerprint).not.toBe(ready.fingerprint);
    }
    expect(evaluateReadiness({ selection }).blockers).toHaveLength(LAUNCH_GATES.length);
  });
  it("uses the same refusal projection as dispatch and coordination", () => {
    const refusals = [{ code: "source-stale", detail: "changed" }, { code: "grant-not-permitted", detail: "revoked" }];
    const result = readinessForRefusals({ refusals, selection });
    expect(result.ready).toBe(false);expect(result.blockers.map(({ code, detail }) => ({ code, detail }))).toEqual(refusals);
  });
});

describe("write-free inspection and current evidence", () => {
  it("keeps configured Codex permission separate from fresh native advertising", async () => {
    const f = fixture(false, true), observations = await observed(f, codexSelection);
    const inspect = (modelAvailability?: object) => inspectReadiness({ root: f.root, ...codexSelection, now, observations: { ...observations, ...(modelAvailability ? { modelAvailability } : {}) } });
    const missing = await inspect();
    expect(missing.facts.selection.state).toBe("satisfied");expect(missing.facts.modelAvailability.code).toBe("native-model-unprobed");expect(missing.ready).toBe(false);
    const native = { ...observations.runtime, fact: fact("satisfied", "native-model-observed", null, nativeProbe()) };
    const ready = await inspect(native);expect(ready.ready, JSON.stringify(ready.blockers)).toBe(true);
    expect(ready.facts.modelAvailability.evidence).toMatchObject({ entitlement: "unverified" });
    const absent = await inspect({ ...native, fact: fact("satisfied", "native-model-observed", null, { ...nativeProbe(), ok: false, modelAdvertised: false, effortAdvertised: false }) });
    expect(absent.facts.modelAvailability.code).toBe("native-model-not-advertised");expect(absent.ready).toBe(false);
    for (const changed of [{ ...native, contextFingerprint: hash("another context") }, { ...native, observedAt: "2026-10-17T11:58:00Z" }]) {
      expect((await inspect(changed)).facts.modelAvailability.code).toBe("native-model-stale");
    }
    writeFileSync(join(f.root, "src/amount.ts"), "changed");
    expect((await inspect(native)).facts.modelAvailability.code).toBe("native-model-stale");
  });
  it("refuses native evidence for another selection/version, future time, unconfirmed cleanup or unknown availability", () => {
    const check = (evidence: object | null) => nativeModelAvailabilityFact({ selection: codexSelection, evidence, expectedNativeVersion: "0.144.1", now: Date.parse(now) });
    expect(check(nativeProbe()).state).toBe("satisfied");
    for (const change of [{ model: "another-model" }, { effort: "high" }, { nativeVersion: "0.143.0" }, { cleanupConfirmed: false }, { containerCleanupConfirmed: false },
      { cleanupConfirmed: undefined }, { containerCleanupConfirmed: undefined },
      { observedAt: "2026-10-17T12:00:01Z" }, { observedAt: "2026-10-17T11:58:00Z" }, { ok: false }, { modelAdvertised: undefined }, { effortAdvertised: false }]) {
      expect(check({ ...nativeProbe(), ...change }).state).not.toBe("satisfied");
    }
    for (const expectedNativeVersion of [undefined, ""]) {
      expect(nativeModelAvailabilityFact({ selection: codexSelection, evidence: { ...nativeProbe(), nativeVersion: undefined }, expectedNativeVersion, now: Date.parse(now) }).state).not.toBe("satisfied");
    }
    expect(check(null).state).toBe("unknown");
  });
  it.each([
    ["schema", { schema: "wrong" }], ["backend_id", { backend_id: "wrong" }],
    ["model", { model: "wrong" }], ["effort", { effort: "high" }],
    ["nativeVersion", { nativeVersion: "0.143.0" }], ["cleanupConfirmed", { cleanupConfirmed: false }],
    ["containerCleanupConfirmed", { containerCleanupConfirmed: undefined }],
    ["providerTurns", { providerTurns: 1 }], ["entitlement", { entitlement: "verified" }],
  ])("names the invalid %s field while retaining the same fail-closed gate", (field, change) => {
    const evidence = { ...nativeProbe(), ...change };
    const options = { selection: codexSelection, evidence, expectedNativeVersion: "0.144.1" };
    expect(nativeModelAvailabilityFact({ ...options, now: Date.parse(now) })).toMatchObject({
      state: "blocked", code: "native-model-evidence-invalid", detail: "Native model evidence invalid: " + field,
    });
    expect(nativeModelDiagnostics(options)?.invalidFields).toEqual([field]);
  });
  it("retains the native failure diagnosis after expiry without reviving readiness or exposing private fields", async () => {
    const f = fixture(false, true), original = await observed(f, codexSelection);
    const evidence = { ...nativeProbe(), ok: false, code: "native-cleanup-unconfirmed", cleanupConfirmed: false,
      account: { email: "private@example.invalid" }, error: "private-token", diagnostics: { elapsedMs: 12_000,
        stderrSignals: ["timeout", "private-token"], rpcStages: [{ method: "model/list", startedAt: now, completedAt: null, payload: "private-token" }] } };
    const observations = { ...original, modelAvailability: { ...original.runtime, fact: fact("satisfied", "native-model-observed", null, evidence) } };
    const inspect = (at: string) => inspectReadiness({ root: f.root, ...codexSelection, now: at, observations });
    const fresh = await inspect(now), expired = await inspect("2026-10-17T12:02:00.000Z");
    expect(fresh.facts.modelAvailability.code).toBe("native-model-evidence-invalid");
    expect(expired.facts.runtime.code).toBe("runtime-stale");
    expect(expired.facts.modelAvailability.evidence).toBeNull();
    expect(expired.ready).toBe(false);
    expect(expired.nativeModelDiagnostics).toEqual(fresh.nativeModelDiagnostics);
    expect(expired.nativeModelDiagnostics).toMatchObject({ authority: "diagnostic-only", code: "native-cleanup-unconfirmed",
      invalidFields: ["cleanupConfirmed"], cleanupConfirmed: false, containerCleanupConfirmed: true,
      elapsedMs: 12_000, stderrSignals: ["timeout"], rpcStages: [{ method: "model/list", startedAt: now, completedAt: null }] });
    expect(JSON.stringify(expired.nativeModelDiagnostics)).not.toContain("private");
    expect(evaluateReadiness({ selection: expired.selection, facts: expired.facts }).fingerprint).toBe(expired.fingerprint);
  });
  it("bounds malformed native diagnostics to allowlisted fields and reports missing expected version", () => {
    const evidence = { ...nativeProbe(), code: "private-code", nativeVersion: "private-version", diagnostics: { elapsedMs: Infinity,
      stderrSignals: ["timeout", "timeout", "private"], rpcStages: Array.from({ length: 20 }, () => ({ method: "model/list", startedAt: "private-time", completedAt: now, payload: "private" })) } };
    const result = nativeModelDiagnostics({ selection: codexSelection, evidence, expectedNativeVersion: undefined });
    expect(result).toMatchObject({ code: "native-code-unrecorded", nativeVersion: null, expectedNativeVersion: null,
      invalidFields: ["expectedNativeVersion", "nativeVersion"], elapsedMs: null, stderrSignals: ["timeout"] });
    expect(result?.rpcStages).toHaveLength(7);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(nativeModelDiagnostics({ selection: codexSelection, evidence: null, expectedNativeVersion: undefined })).toBeNull();
  });
  it("retains bounded process/progress diagnostics after dependency expiry with no new authority", async () => {
    const f = fixture(false, true), original = await observed(f, codexSelection);
    const evidence = { ...nativeProbe(), ok: false, code: "native-model-probe-unavailable", diagnostics: { transport: {
      process: { outcome: "timed-out", errorCode: "ETIMEDOUT", exitCode: null, elapsedMs: 45001, stdoutBytes: 300, stderrBytes: 40, nativeRecords: 0, authenticationRecords: 0, stderr: "private-token" },
      progress: [{ stage: "subscription", event: "started", at: now, token: "private-token" }],
    } } };
    const observations = { ...original, modelAvailability: { ...original.runtime, fact: fact("satisfied", "native-model-observed", null, evidence) } };
    const fresh = await inspectReadiness({ root: f.root, ...codexSelection, now, observations });
    const expired = await inspectReadiness({ root: f.root, ...codexSelection, now: "2026-10-17T12:02:00.000Z", observations });
    expect(fresh.ready).toBe(false);expect(expired.ready).toBe(false);
    expect(expired.nativeModelDiagnostics).toEqual(fresh.nativeModelDiagnostics);
    expect(expired.nativeModelDiagnostics?.transport).toMatchObject({ process: { outcome: "timed-out", errorCode: "ETIMEDOUT", elapsedMs: 45001 }, progress: [{ stage: "subscription", event: "started", at: now }] });
    expect(JSON.stringify(expired.nativeModelDiagnostics)).not.toContain("private-token");
    expect(evaluateReadiness({ selection: expired.selection, facts: expired.facts }).fingerprint).toBe(expired.fingerprint);
    const malformed = nativeModelDiagnostics({ selection: codexSelection, expectedNativeVersion: "0.144.1", evidence: { ...evidence, diagnostics: { transport: {
      process: { outcome: "private", errorCode: "private", elapsedMs: Infinity, exitCode: 1000, stdoutBytes: -1 },
      progress: Array.from({ length: 80 }, () => ({ stage: "model/list", event: "started", at: "private", code: "private", nativeVersion: "private", cleanupConfirmed: "private" })),
    } } } });
    expect(malformed?.transport?.progress).toHaveLength(32);
    expect(malformed?.transport?.process).toMatchObject({ outcome: "unobserved", errorCode: "unclassified", elapsedMs: null, exitCode: null, stdoutBytes: null });
    expect(JSON.stringify(malformed)).not.toContain("private");
  });
  it("CLI, HTTP and service share the same conservative result and leave all files unchanged", async () => {
    const f = fixture(), before = snapshot(f.root), runtimeFactory = vi.fn(() => { throw new Error("runtime must not be created"); }), opener = vi.fn(() => { throw new Error("writable store must not open"); });
    const context = createDeliveryV2Context({ ROOT: f.root, openStore: opener, runtimeFactory });
    // Each surface must report the same facts and diagnostics at the same time.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const service = await context.readiness(selection);
      let text = "";
      const code = await runReadyCli(["--file", selection.file, "--id", selection.id, "--executor", "claude", "--model", selection.model, "--effort", "low"], { root: f.root, write: value => { text += value; } });
      expect(code).toBe(1);expect(JSON.parse(text)).toEqual(service);
      const response = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/readiness", query: new URLSearchParams({ ...selection, model: selection.model, effort: selection.effort }) }, context);
      expect(response?.json).toEqual(service);
      const catalogue = await context.describeExecutors();expect(catalogue.inspectOnly).toBe(true);expect(catalogue.executors.every(entry => !entry.qualified)).toBe(true);
      expect(runtimeFactory).not.toHaveBeenCalled();expect(opener).not.toHaveBeenCalled();
      expect(existsSync(join(f.root, ".delivery/v2/local-auth.json"))).toBe(false);
      expect(snapshot(f.root)).toEqual(before);
      expect(service.facts.runtime.state).toBe("unknown");expect(service.facts.qualification.state).toBe("unavailable");
    } finally { context.close();vi.useRealTimers(); }
  });
  it("does not create a missing read-only database or parent directory", () => {
    const root = temp(), path = join(root, "absent", "supervisor.sqlite");
    expect(() => openStore({ path, readOnly: true })).toThrow();expect(readdirSync(root)).toEqual([]);
  });
  it("finds a durable command from the service-owned store after restart without a runtime", () => {
    const f = fixture(), first = createDeliveryV2Context({ ROOT: f.root });
    first.store.admitCommand({ command_id: "lost", kind: "deliver", actor: "owner", payload: {} });
    first.store.recordCommandOutcome("lost", { ok: true, run_id: "one" }); first.close();
    const factory = vi.fn(() => { throw new Error("runtime forbidden"); });
    const restarted = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: factory });
    try { expect(restarted.commandStatus("lost")?.outcome_json).toContain('"run_id":"one"'); expect(factory).not.toHaveBeenCalled(); }
    finally { restarted.close(); }
  });
  it("reads an existing store without migration, maintenance or writable admission", async () => {
    const f = fixture(), path = join(f.root, ".delivery/v2/supervisor.sqlite");
    const writer = openStore({ path });writer.close();const before = snapshot(f.root);
    const reader = openStore({ path, readOnly: true });
    expect(reader.listRuns()).toEqual([]);
    expect(() => reader.insertRun({ run_id: "forbidden", work_id: "fixture", contract_id: "fixture", contract_revision: 1 })).toThrow(/readonly/u);reader.close();
    await inspectReadiness({ root: f.root, ...selection, now });expect(snapshot(f.root)).toEqual(before);
  });
  it("refuses live WAL data without creating, checkpointing or deleting auxiliary files", async () => {
    const f = fixture(), path = join(f.root, ".delivery/v2/supervisor.sqlite");
    writeFileSync(bookPathIn(f.root), readFileSync(bookPathIn(f.root), "utf8").replace("**Touches:**", "**Depends on:** BUD-999\n\n**Touches:**"));
    const writer = openStore({ path });
    try {
      const before = snapshot(f.root);
      expect(() => openStore({ path, readOnly: true })).toThrow(/WAL/u);
      const result = await inspectReadiness({ root: f.root, ...selection, now });
      expect(result.facts.coordination.state).toBe("unavailable");expect(result.facts.budget.state).toBe("unavailable");
      expect(result.blockers.some(row => row.code.startsWith("dependency-"))).toBe(true);
      expect(result.blockers.find(row => row.code.startsWith("dependency-"))?.state).toBe("blocked");
      expect(snapshot(f.root)).toEqual(before);
    } finally { writer.close(); }
  });
  it("invalidates immutable evidence if the store changes while it is being read", () => {
    const f = fixture(), path = join(f.root, ".delivery/v2/supervisor.sqlite"), writer = openStore({ path });writer.close();
    const reader = openStore({ path, readOnly: true });expect(reader.readOnlySnapshotCurrent()).toBe(true);
    const changed = openStore({ path });changed.insertRun({ run_id: "new", work_id: "fixture", contract_id: "fixture", contract_revision: 1 });changed.close();
    expect(reader.readOnlySnapshotCurrent()).toBe(false);reader.close();
  });
  it("reuses only SELECT access on an already-open service store, with no new connection or maintenance", async () => {
    const f = fixture(), factory = vi.fn(() => { throw new Error("runtime forbidden"); }), context = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: factory });
    const writer = context.store;writer.listRuns();const before = snapshot(f.root);
    const view = writer.readOnlyView();expect("insertRun" in view).toBe(false);expect("transaction" in view).toBe(false);expect("updateRun" in view).toBe(false);
    try {
      const result = await context.readiness({ ...selection, now });
      expect(result.facts.coordination.state, String(result.facts.coordination.detail)).toBe("satisfied");expect(result.facts.budget.state).toBe("satisfied");
      expect(snapshot(f.root)).toEqual(before);expect(factory).not.toHaveBeenCalled();
    } finally { context.close(); }
  });
  it("has a genuinely passing control with fresh exact bindings, receipts and subscription facts", async () => {
    const f = fixture(), observations = await observed(f);
    const result = await inspectReadiness({ root: f.root, ...selection, now, observations });
    expect(result.blockers).toEqual([]);expect(result.ready).toBe(true);
    expect(readinessCanStart(result as V2Readiness, selection, Date.parse(now))).toBe(true);
    expect(readinessCanStart(result as V2Readiness, { ...selection, effort: "high" }, Date.parse(now))).toBe(false);
    expect(readinessCanStart(result as V2Readiness, selection, Date.parse(now) + 31_000)).toBe(false);
  });
  it("rejects expired or source-moved observations, paid auth and altered environment receipts", async () => {
    const f = fixture(), observations = await observed(f);
    const expired = await inspectReadiness({ root: f.root, ...selection, now: "2026-10-17T12:02:00Z", observations });
    expect(expired.blockers.some(row => row.code === "runtime-stale")).toBe(true);
    const future = { ...observations, runtime: { ...observations.runtime, observedAt: "2026-10-17T12:00:01.000Z" } };
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: future })).blockers.some(row => row.code === "runtime-stale")).toBe(true);
    const paid = { ...observations, authentication: { ...observations.authentication, fact: fact("satisfied", "auth", null, { backend_id: f.binding.backend_id, method: "claude.ai", additionalSpendAllowed: true, includedUsageAvailable: true }) } };
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: paid })).blockers.some(row => row.code === "subscription-evidence-invalid")).toBe(true);
    const wrongProvider = { ...observations, authentication: { ...observations.authentication, fact: fact("satisfied", "auth", null, { backend_id: f.binding.backend_id, method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true }) } };
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: wrongProvider })).blockers.some(row => row.code === "subscription-evidence-invalid")).toBe(true);
    const corrupt = { ...observations, environment: { ...observations.environment, fact: fact("satisfied", "env", null, { receipt: { ...f.receipt, contentDigest: hash("altered") } }) } };
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: corrupt })).blockers.some(row => row.code === "environment-receipt-invalid")).toBe(true);
    writeFileSync(join(f.root, "src/amount.ts"), "changed");
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations })).blockers.some(row => row.code === "runtime-stale")).toBe(true);
  });

  it.each([
    { reason: "expired", observedAt: "2026-10-17T11:58:59.000Z", ageMs: 61_000 },
    { reason: "future", observedAt: "2026-10-17T12:00:01.000Z", ageMs: -1_000 },
    { reason: "invalid", observedAt: "2026-99-17T12:00:00.000Z", ageMs: null },
    { reason: "context-mismatch", observedAt: now, ageMs: 0 },
  ])("diagnoses $reason independently of dependent runtime gates", async ({ reason, observedAt, ageMs }) => {
    const f = fixture(false, true), original = await observed(f, codexSelection);
    const actualContextFingerprint = reason === "context-mismatch" ? hash("different context") : original.runtime.contextFingerprint;
    const observations = Object.fromEntries(Object.entries({ ...original,
      modelAvailability: { ...original.runtime, fact: fact("satisfied", "native-model-observed", null, nativeProbe()) },
    }).map(([name, entry]) => [name, { ...entry, observedAt, contextFingerprint: actualContextFingerprint, collectorError: "private collector detail" }]));
    const result = await inspectReadiness({ root: f.root, ...codexSelection, now, observations });
    expect(result.ready).toBe(false);
    expect(result.facts.runtime.code).toBe("runtime-stale");
    expect(result.facts.environment.code).toBe("environment-stale");
    expect(result.facts.authentication.code).toBe("authentication-runtime-unavailable");
    expect(result.facts.qualification.code).toBe("qualification-binding-unavailable");
    for (const name of ["runtime", "authentication", "environment", "modelAvailability"]) {
      expect(result.observationDiagnostics[name]).toEqual({ observedAt, evaluatedAt: now, ageMs, maxAgeMs: 60_000,
        expectedContextFingerprint: result.contextFingerprint, actualContextFingerprint, reason });
    }
    expect(JSON.stringify(result.observationDiagnostics)).not.toContain("private collector detail");
    expect(evaluateReadiness({ selection: result.selection, facts: result.facts }).fingerprint).toBe(result.fingerprint);
  });

  it("reports unobserved and current evidence without changing readiness fingerprints", async () => {
    const f = fixture(false, true), missing = await inspectReadiness({ root: f.root, ...codexSelection, now });
    for (const name of ["runtime", "authentication", "environment", "modelAvailability"]) {
      expect(missing.observationDiagnostics[name]).toEqual({ observedAt: null, evaluatedAt: now, ageMs: null, maxAgeMs: 60_000,
        expectedContextFingerprint: missing.contextFingerprint, actualContextFingerprint: null, reason: "unobserved" });
    }
    const original = await observed(f, codexSelection);
    const observations = { ...original, modelAvailability: { ...original.runtime, fact: fact("satisfied", "native-model-observed", null, nativeProbe()) } };
    const current = await inspectReadiness({ root: f.root, ...codexSelection, now, observations });
    const later = await inspectReadiness({ root: f.root, ...codexSelection, now: "2026-10-17T12:00:01.000Z", observations });
    expect(current.ready).toBe(true);expect(later.ready).toBe(true);
    for (const name of ["runtime", "authentication", "environment", "modelAvailability"]) {
      expect(current.observationDiagnostics[name]).toEqual({ observedAt: now, evaluatedAt: now, ageMs: 0, maxAgeMs: 60_000,
        expectedContextFingerprint: current.contextFingerprint, actualContextFingerprint: current.contextFingerprint, reason: "current" });
      expect(later.observationDiagnostics[name]).toMatchObject({ ageMs: 1_000, reason: "current" });
    }
    expect(later.fingerprint).toBe(current.fingerprint);
    expect(later.contextFingerprint).toBe(current.contextFingerprint);
  });

  it("redacts malformed diagnostic metadata without accepting the observation", async () => {
    const f = fixture(), original = await observed(f);
    const result = await inspectReadiness({ root: f.root, ...selection, now,
      observations: { ...original, runtime: { ...original.runtime, observedAt: "private collector detail", contextFingerprint: "private binding detail" } } });
    expect(result.ready).toBe(false);expect(result.facts.runtime.code).toBe("runtime-stale");
    expect(result.observationDiagnostics.runtime).toMatchObject({ observedAt: null, ageMs: null, actualContextFingerprint: null, reason: "context-mismatch" });
    expect(JSON.stringify(result.observationDiagnostics)).not.toContain("private");
  });
  it("requires current manifest and oracle bytes even when old receipts remain valid", async () => {
    const f = fixture();writeFileSync(join(f.root, "package.json"), '{"changed":true}');
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: await observed(f) })).blockers.some(row => row.code === "environment-manifest-mismatch")).toBe(true);
    writeFileSync(join(f.root, "package.json"), "{}");writeFileSync(join(f.root, "tests/amount.check.mjs"), "new oracle");
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: await observed(f) })).blockers.some(row => row.code === "environment-check-input-mismatch")).toBe(true);
    const file = join(f.root, ".delivery/v2/execution-policy.json"), policy = JSON.parse(readFileSync(file, "utf8"));
    policy.publicationScope.allowedPaths = ["src/unrelated.ts"];writeFileSync(file, JSON.stringify(policy));
    const blocked = await inspectReadiness({ root: f.root, ...selection, now });expect(blocked.facts.source.code).toBe("scope-not-authorized");
    writeFileSync(join(f.root, "src/amount.ts"), "changed while scope remains blocked");
    expect((await inspectReadiness({ root: f.root, ...selection, now })).fingerprint).not.toBe(blocked.fingerprint);
  });
  it.each(["assertions", "argv", "removed-count"])("shares the preparation contract and refuses changed %s at readiness", async change => {
    const f = fixture(true);
    expect((await inspectReadiness({ root: f.root, ...selection, now, observations: await observed(f) })).ready).toBe(true);
    const file = join(f.root, ".delivery/v2/execution-policy.json"), policy = JSON.parse(readFileSync(file, "utf8"));
    if (change === "assertions") policy.checks.specs.amount.expected.assertions = 1;
    if (change === "argv") policy.checks.specs.amount.argv.push("--self-test");
    if (change === "removed-count") delete policy.checks.specs.amount.expected.assertions;
    writeFileSync(file, JSON.stringify(policy));
    const result = await inspectReadiness({ root: f.root, ...selection, now, observations: await observed(f) });
    expect(result.ready).toBe(false);
    expect(result.facts.environment.code).toBe("environment-check-input-mismatch");
  });
  it("refuses unsupported hard caps, expired authority, and disabled protected checks", async () => {
    const f = fixture(), file = join(f.root, ".delivery/v2/execution-policy.json"), policy = JSON.parse(readFileSync(file, "utf8"));
    policy.resources.enforcement = "hard-cap";policy.grant.expires_at = "2026-10-16T00:00:00Z";
    policy.checks.requiredVerifications.typecheck.enabled = false;writeFileSync(file, JSON.stringify(policy));
    const result = await inspectReadiness({ root: f.root, ...selection, now, observations: await observed(f) });
    expect(result.ready).toBe(false);expect(result.facts.budget.state).toBe("blocked");
    expect(result.blockers.map(row => row.code)).toEqual(expect.arrayContaining(["grant-expired", "checks-not-prepared"]));
  });
  it("does not read forbidden source inputs or expose their content", async () => {
    const f = fixture(), file = join(f.root, ".delivery/v2/execution-policy.json"), policy = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(join(f.root, ".env.fixture"), "DO_NOT_READ_SENTINEL");policy.scratchScope.include.push(".env.fixture");writeFileSync(file, JSON.stringify(policy));
    const result = await inspectReadiness({ root: f.root, ...selection, now });
    expect(result.ready).toBe(false);expect(result.facts.source.state).toBe("blocked");expect(JSON.stringify(result)).not.toContain("DO_NOT_READ_SENTINEL");
  });
  it("consolidates settings, hold/dependency, checks and budget blockers with admission agreement", async () => {
    const f = fixture();
    writeFileSync(bookPathIn(f.root), readFileSync(bookPathIn(f.root), "utf8").replace("**Touches:**", "**Depends on:** BUD-999\n\n**Touches:**"));
    const file = join(f.root, ".delivery/v2/execution-policy.json"), policy = JSON.parse(readFileSync(file, "utf8"));
    policy.executors.catalog.models.claude[0].disabled = true;
    policy.resources.perJobReservation.amount = 20000;
    policy.checks.requiredVerifications.typecheck.isolation = "host";
    writeFileSync(file, JSON.stringify(policy));
    const result = await inspectReadiness({ root: f.root, ...selection, now });
    expect(result.blockers.map(row => row.gate)).toEqual(expect.arrayContaining(["selection", "coordination", "checks", "budget"]));
    expect(result.blockers.some(row => row.code === "model-disabled")).toBe(true);
    const journey = createJourney({ root: f.root, pmRel: PM_REL, store: () => { throw new Error("no store"); } });
    expect(journey.assess({ file: selection.file, id: selection.id, withoutStore: true })).toMatchObject({ startable: false });
    const deliver = buildDeliver({ root: f.root, pmRel: PM_REL, store: () => { throw new Error("no admission writes"); } });
    const admitted = await deliver!({ ...SELECT, ...selection, actor: "fixture" });
    expect(admitted.ok).toBe(false);expect(admitted.refusals[0].detail[0].code).toBe("model-disabled");
  });
  it("refuses corrupt policy and store evidence without repairing them", async () => {
    const f = fixture(), store = join(f.root, ".delivery/v2/supervisor.sqlite");writeFileSync(store, "not a database");
    const result = await inspectReadiness({ root: f.root, ...selection, now });
    expect(result.blockers.some(row => row.code === "coordination-store-unavailable")).toBe(true);expect(readFileSync(store, "utf8")).toBe("not a database");
    writeFileSync(join(f.root, ".delivery/v2/execution-policy.json"), "not json");
    const invalid = await inspectReadiness({ root: f.root, ...selection, now });
    expect(invalid.ready).toBe(false);expect(invalid.facts.policy.state).toBe("blocked");expect(invalid.blockers.length).toBeGreaterThan(3);
  });
  it("rejects CLI execution/preparation options rather than interpreting them", async () => {
    const root = temp();let text = "";
    expect(await runReadyCli(["--prepare", "yes"], { root, write: value => { text += value; } })).toBe(2);
    expect(JSON.parse(text).error).toBe("usage");expect(readdirSync(root)).toEqual([]);
  });
});


it("explicit service refresh supplies observations; passive local/mobile snapshots never probe", async () => {
  const f = fixture();
  // Qualification observation time must be current for this service-driven test.
  const observer = vi.fn(async () => ({ runtime: { image, binding: f.binding }, environment: { ok: true, receipt: f.receipt },
    authentication: { ok: true, method: "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true } }));
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  try {
    const passive = await ctx.readiness(selection);
    expect(passive.ready).toBe(false); expect(observer).not.toHaveBeenCalled();
    const refreshed = await ctx.refreshReadiness(selection);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(f.binding.backend_id, { model: selection.model, effort: selection.effort });
    expect(refreshed.facts.runtime.state).toBe("satisfied");
    expect(refreshed.facts.environment.state).toBe("satisfied");
    expect(refreshed.facts.authentication.state).toBe("satisfied");
    expect(refreshed.facts.coordination.state).toBe("satisfied");
    expect((await ctx.readinessSnapshots()).map(value => value.fingerprint)).toEqual([(await ctx.readiness(selection)).fingerprint]);
    expect(observer).toHaveBeenCalledTimes(1);
    writeFileSync(join(f.root, "src/amount.ts"), "changed");
    expect((await ctx.readiness(selection)).facts.runtime.code).toBe("runtime-stale");
    expect(observer).toHaveBeenCalledTimes(1);
  } finally { ctx.close(); }
});

it("discards previous observations when an explicit refresh refuses an expired policy", async () => {
  const f = fixture();
  const observer = vi.fn(async () => ({ runtime: { image, binding: f.binding }, environment: { ok: true, receipt: f.receipt },
    authentication: { ok: true, method: "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true } }));
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  try {
    const first = await ctx.refreshReadiness(selection);
    expect(first.ready).toBe(true);expect(observer).toHaveBeenCalledTimes(1);
    const policyFile = join(f.root, ".delivery", "v2", "execution-policy.json"), policy = JSON.parse(readFileSync(policyFile, "utf8"));
    policy.grant.expires_at = new Date(Date.now() - 1_000).toISOString();writeFileSync(policyFile, JSON.stringify(policy));
    const refused = await ctx.refreshReadiness(selection), passive = await ctx.readiness(selection);
    expect(refused.ready).toBe(false);expect(refused.facts.policy.code).toBe("grant-expired");
    expect(observer).toHaveBeenCalledTimes(1);
    expect(passive.facts).toEqual(refused.facts);expect(passive.fingerprint).toBe(refused.fingerprint);
    expect(passive.facts.runtime.code).toBe("runtime-unprobed");expect(passive.facts.environment.code).toBe("environment-unprobed");
    expect(passive.observationDiagnostics.runtime.reason).toBe("unobserved");
    expect((await ctx.readinessSnapshots()).map(result => result.fingerprint)).toEqual([passive.fingerprint]);
  } finally { ctx.close(); }
});

it("preserves sanitized collection diagnostics through refresh, passive reads and the service CLI", async () => {
  const f = fixture(), collectedAt = new Date().toISOString();
  const collection = { schema: "delivery-v2/readiness-collection@1", startedAt: collectedAt, completedAt: collectedAt,
    stages: [{ name: "environment", startedAt: collectedAt, completedAt: collectedAt, durationMs: 0, outcome: "passed", code: "environment-observed" }] };
  const observer = vi.fn(async () => ({ runtime: { image, binding: f.binding }, environment: { ok: true, receipt: f.receipt }, collection,
    authentication: { ok: true, method: "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true } }));
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const response = await routeDeliveryV2({ method: init?.method || "GET", path: url.pathname, query: url.searchParams, headers: init?.headers }, ctx);
    return Response.json(response?.json, { status: response?.status });
  });
  try {
    const refreshed = await ctx.refreshReadiness(selection), passive = await ctx.readiness(selection);
    let text = "";
    const code = await runReadyCli(["--file", selection.file, "--id", selection.id, "--executor", selection.executor, "--model", selection.model,
      "--effort", selection.effort, "--service", "http://127.0.0.1:4317"], { root: f.root, fetcher, write: value => { text += value; } });
    const cli = JSON.parse(text);
    expect(code).toBe(0);expect(refreshed.ready).toBe(true);
    for (const result of [refreshed, passive, cli]) {
      expect(result.collection).toEqual(collection);
      expect(result.fingerprint).toBe(refreshed.fingerprint);
      expect(result.contextFingerprint).toBe(refreshed.contextFingerprint);
      expect(evaluateReadiness({ selection: result.selection, facts: result.facts }).fingerprint).toBe(result.fingerprint);
    }
    expect(observer).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { ctx.close(); }
});

it("reports a sanitized collection failure without exposing thrown details", async () => {
  const f = fixture(), sentinel = "private-collector-error-sentinel";
  const observer = vi.fn(async () => { throw new Error(sentinel); });
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  try {
    const refreshed = await ctx.refreshReadiness(selection), passive = await ctx.readiness(selection);
    if (!("collection" in refreshed) || !("collection" in passive)) throw new Error("Failed collector must retain diagnostics");
    expect(refreshed.ready).toBe(false);
    expect(refreshed.facts.runtime.detail).toBe("readiness-collection-failed");
    expect(refreshed.collection).toMatchObject({ schema: "delivery-v2/readiness-collection@1",
      stages: [{ name: "collector", outcome: "failed", code: "readiness-collection-failed", durationMs: expect.any(Number) }] });
    expect(passive.collection).toEqual(refreshed.collection);expect(passive.fingerprint).toBe(refreshed.fingerprint);
    expect(JSON.stringify([refreshed, passive])).not.toContain(sentinel);
    expect(observer).toHaveBeenCalledTimes(1);
  } finally { ctx.close(); }
});

it("caches explicit Codex model evidence for its exact passive selection and invalidates moved source", async () => {
  const f = fixture(false, true);
  const observer = vi.fn(async () => ({ runtime: { image, binding: f.binding }, environment: { ok: true, receipt: f.receipt },
    authentication: { ok: true, method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true },
    modelAvailability: nativeProbe(new Date().toISOString()) }));
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  try {
    expect((await ctx.readiness(codexSelection)).facts.modelAvailability.code).toBe("native-model-unprobed");
    expect(observer).not.toHaveBeenCalled();
    expect((await ctx.refreshReadiness(codexSelection)).facts.modelAvailability.state).toBe("satisfied");
    expect(observer).toHaveBeenCalledWith(f.binding.backend_id, { model: codexSelection.model, effort: codexSelection.effort });
    expect((await ctx.readiness(codexSelection)).facts.modelAvailability.state).toBe("satisfied");
    expect((await ctx.readiness({ ...codexSelection, effort: "high" })).facts.modelAvailability.state).not.toBe("satisfied");
    writeFileSync(join(f.root, "src/amount.ts"), "changed");
    expect((await ctx.readiness(codexSelection)).facts.modelAvailability.code).toBe("native-model-stale");
    expect(observer).toHaveBeenCalledTimes(1);
  } finally { ctx.close(); }
});

it("ages each observed fact independently when a multi-step refresh crosses the freshness window", async () => {
  const f = fixture();
  vi.useFakeTimers({ toFake: ["Date"] });
  const began = Date.now();
  const observer = vi.fn(async () => {
    vi.setSystemTime(began + 61_000);
    const completed = new Date().toISOString();
    return { runtime: { image, binding: f.binding }, environment: { ok: true, receipt: f.receipt },
      authentication: { ok: true, method: "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true },
      observedAt: { environment: new Date(began).toISOString(), runtime: completed, authentication: completed } };
  });
  const ctx = createDeliveryV2Context({ ROOT: f.root, runtimeFactory: (boundary: ReturnType<typeof makeBoundaryConfig>) => ({ boundary, readinessObservations: observer }) });
  try {
    const result = await ctx.refreshReadiness(selection);
    expect(result.facts.runtime.state).toBe("satisfied");
    expect(result.facts.authentication.state).toBe("satisfied");
    expect(result.facts.environment.code).toBe("environment-stale");
    expect(result.ready).toBe(false);
    expect(observer).toHaveBeenCalledTimes(1);
  } finally { ctx.close();vi.useRealTimers(); }
});
