// Command Center Phase 3 — the container worker/checker boundary, as argv.
//
// These fixtures never start a container. They pin what the supervisor asks the
// runtime for: named volumes only, no host authority, a read-only workspace for an
// investigation, a network-less checker, and SDK records relayed without letting
// functions or controllers cross into the worker.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BOUNDARY_REFUSALS,
  WORKDIR,
  assertNoHostAuthority,
  boundaryBindingDigest,
  checkerRunArgs,
  makeBoundaryConfig,
  sdkFromRunnerStream,
  workerRunArgs,
  createContainerRuntime,
  modelReadinessProbe,
  typecheckArgv,
} from "../../scripts/delivery-v2/worker-boundary.mjs";
import { COMPILER_RESOURCE_PROFILE } from "../../scripts/delivery-v2/compiler-resources.mjs";
import { canonicalJson, fingerprint } from "../../scripts/delivery-v2/contracts.mjs";

const boundary = makeBoundaryConfig({ image: "era-delivery-v2-worker:test" });

const mounts = (args: string[]) => args.flatMap((arg, index) => (arg === "--mount" ? [args[index + 1]] : []));
const flagValue = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
const temporary: string[] = [];
afterEach(() => { vi.useRealTimers(); for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("explicit native model readiness", () => {
  const image = "sha256:" + "1".repeat(64), key = "sha256:" + "2".repeat(64);
  const configured = makeBoundaryConfig({ image, credentials: { "codex-exec-sdk": { volume: "fixture-subscription" } }, dependencies: { volume: "fixture-deps", environment: { key, contentDigest: key, receiptDigest: key } } });
  const selected = { model: "gpt-6-luna", effort: "low" };
  type Result = { status: number | null; stdout: string; stderr: string; error: string | null };
  function fixture(native: Record<string, unknown> = {}, usableSignIn = true, lifecycle = "clean", hooks: { sync?: () => void; image?: () => void; probe?: () => Result; engine?: () => Result } = {}) {
    const root = mkdtempSync(join(tmpdir(), "era-native-readiness-"));temporary.push(root);mkdirSync(join(root, "host"));
    const calls: { args: string[]; input?: string; timeout?: number }[] = [];
    let syncs = 0, probeStarted = false, removed = false, ownershipLabel = "";
    const authentication = { era: "subscription-ready", backend_id: "codex-exec-sdk", method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true };
    const docker = {
      async run(args: string[], options: { input?: string; timeout?: number } = {}) {
        calls.push({ args, ...options });let stdout = "", status = 0;
        if (args[0] === "version" && hooks.engine) return hooks.engine();
        if (args[0] === "volume") stdout = "fixture-deps";
        else if (args[0] === "container") {
          const pattern = args[args.indexOf("--filter") + 1].replace(/^name=/u, "");
          const name = calls.find(row => row.args.includes("--input-type=module"))?.args;
          const canonicalName = "/" + (name ? name[name.indexOf("--name") + 1] : pattern.match(/era-v2-model-[a-f0-9-]+/u)?.[0]);
          const matches = new RegExp(pattern, "u").test(canonicalName);
          stdout = matches && (lifecycle === "collision" || (probeStarted && !removed && lifecycle !== "clean")) ? "b".repeat(64) : "";
        }
        else if (args[0] === "create") stdout = "a".repeat(64);
        else if (args[0] === "start") stdout = JSON.stringify({ ok: true, key, contentDigest: key, receiptDigest: key, receipt: { probes: { nativePackages: { "@openai/codex-sdk": { cliVersion: "0.144.1" } } } } });
        else if (args[0] === "inspect") stdout = args[2]?.includes("era.model-readiness") ? lifecycle === "foreign-label" ? "unrelated-owner" : ownershipLabel : "exited 0";
        else if (args[0] === "rm" && args.at(-1) === "b".repeat(64)) { if (lifecycle === "remove-fails") status = 1;else removed = true; }
        else if (args[0] === "image") { hooks.image?.();stdout = image; }
        else if (args.includes("--probe")) stdout = JSON.stringify({ task_brief_version: 1, sdk: { "codex-exec-sdk": "0.144.1" }, battery_digest: "fixture" });
        else if (args.includes("--input-type=module")) {
          probeStarted = true;ownershipLabel = args[args.indexOf("--label") + 1].split("=")[1];
          if (lifecycle === "throw") throw new Error("Docker client timed out");
          if (lifecycle === "timeout") status = 124;
          stdout = JSON.stringify(authentication) + "\n" + JSON.stringify({ era: "native-model-readiness", schema: "delivery-v2/codex-model-probe@1", backend_id: "codex-exec-sdk", ...selected, nativeVersion: "0.144.1", ok: true, modelAdvertised: true, effortAdvertised: true, cleanupConfirmed: true, providerTurns: 0, entitlement: "unverified", code: "native-selection-advertised", observedAt: new Date().toISOString(), ...native });
          if (hooks.probe) return hooks.probe();
        }
        return { status, stdout, stderr: "", error: null };
      },
      runSync() { return { status: 0, stdout: "", stderr: "", error: null }; },
      async *lines() { yield ""; },
    };
    return { calls, syncs: () => syncs, runtime: createContainerRuntime({ boundary: configured, hostRoot: join(root, "host"), workRoot: join(root, "work"), docker, credentialSync: { sync: () => { syncs++;hooks.sync?.();return { ok: usableSignIn, reason: usableSignIn ? undefined : "expired" }; } } }) };
  }
  it("uses one existing auth-envelope container, selected native metadata and redacted subscription evidence", async () => {
    const f = fixture();expect(f.calls).toEqual([]);
    const result = await f.runtime.readinessObservations("codex-exec-sdk", selected);
    expect(result).toMatchObject({ environment: { ok: true }, authentication: { ok: true, method: "chatgpt" }, modelAvailability: { ok: true, ...selected, entitlement: "unverified", providerTurns: 0, containerCleanupConfirmed: true } });
    const native = f.calls.filter(row => row.args.includes("--input-type=module"));expect(native).toHaveLength(1);
    const exactFilter = f.calls.find(row => row.args[0] === "container")!.args;
    const namePattern = new RegExp(exactFilter[exactFilter.indexOf("--filter") + 1].replace(/^name=/u, ""), "u");
    const nativeName = native[0].args[native[0].args.indexOf("--name") + 1];
    expect(namePattern.test("/" + nativeName)).toBe(true);expect(namePattern.test(nativeName)).toBe(true);
    expect(namePattern.test("/" + nativeName + "-other")).toBe(false);expect(namePattern.test("/other-" + nativeName)).toBe(false);
    expect(native[0].args).toContain("type=volume,source=fixture-subscription,target=/run/era-credentials,readonly");
    expect(native[0].args).toContain("--read-only");expect(native[0].args).toContain("-i");expect(native[0].timeout).toBe(45000);
    expect(native[0].input).toContain("subscriptionObservation");expect(native[0].input).toContain('"model":"gpt-6-luna","effort":"low","expectedNativeVersion":"0.144.1"');
    expect(native[0].input).not.toContain('method: "turn/start"');expect(f.syncs()).toBe(1);
    const before = f.calls.length;expect(await f.runtime.authReadiness("codex-exec-sdk")).toMatchObject({ ok: true });expect(f.calls).toHaveLength(before);
  });
  it("records a slow credential stage without renewing earlier environment/runtime observations", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-18T11:00:00.000Z"), later = start + 61_000;
    vi.setSystemTime(start);
    const f = fixture({}, true, "clean", { sync: () => vi.setSystemTime(later) });
    const result = await f.runtime.readinessObservations("codex-exec-sdk", selected);
    expect(result.observedAt).toEqual({ environment: new Date(start).toISOString(), runtime: new Date(start).toISOString(), authentication: new Date(later).toISOString(), modelAvailability: new Date(later).toISOString() });
    expect(result.collection).toMatchObject({ schema: "delivery-v2/readiness-collection@1", startedAt: new Date(start).toISOString(), completedAt: new Date(later).toISOString() });
    expect(result.collection.stages.map(stage => stage.name)).toEqual(["docker", "environment", "runtime-binding", "egress", "credential-sync", "native-model"]);
    expect(result.collection.stages.find(stage => stage.name === "credential-sync")).toEqual({ name: "credential-sync", startedAt: new Date(start).toISOString(), completedAt: new Date(later).toISOString(), durationMs: 61_000, outcome: "satisfied", code: null });
    expect(result.collection.stages.find(stage => stage.name === "native-model")).toMatchObject({ durationMs: 0, startedAt: new Date(later).toISOString(), outcome: "satisfied" });
    expect(result.modelAvailability).toMatchObject({ providerTurns: 0, ok: true });
    expect(f.syncs()).toBe(1);
  });
  it("names a stopped Docker engine and probes nothing else", async () => {
    const f = fixture({}, true, "clean", { engine: () => ({ status: 1, stdout: "", stderr: "error during connect: open //./pipe/dockerDesktopLinuxEngine", error: null }) });
    const result = await f.runtime.readinessObservations("codex-exec-sdk", selected);
    expect(result).toMatchObject({ environment: { ok: false, reason: "Docker is not running" }, runtime: null, authentication: null, modelAvailability: null, error: null });
    expect(result.collection.stages).toEqual([expect.objectContaining({ name: "docker", outcome: "blocked", code: "docker-unavailable" })]);
    expect(f.calls.map(row => row.args[0])).toEqual(["version"]);expect(f.calls[0].timeout).toBe(10_000);expect(f.syncs()).toBe(0);
    expect(JSON.stringify(result)).not.toContain("pipe");
  });
  it.each(["image", "sync"] as const)("retains earlier facts and only a fixed diagnostic when %s throws", async failureStage => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-18T11:00:00.000Z");vi.setSystemTime(start);
    const f = fixture({}, true, "clean", { [failureStage]: () => { vi.setSystemTime(start + 2_000);throw new Error("secret credential path and Docker output"); } });
    const result = await f.runtime.readinessObservations("codex-exec-sdk", selected);
    expect(result).toMatchObject({ environment: { ok: true }, error: "readiness-collection-failed", authentication: null, modelAvailability: null });
    expect(result.observedAt.environment).toBe(new Date(start).toISOString());
    expect(result.runtime === null).toBe(failureStage === "image");
    const name = failureStage === "image" ? "runtime-binding" : "credential-sync";
    expect(result.collection.stages.at(-1)).toEqual({ name, startedAt: new Date(start).toISOString(), completedAt: new Date(start + 2_000).toISOString(), durationMs: 2_000, outcome: "failed", code: name + "-collection-failed" });
    expect(JSON.stringify(result)).not.toContain("secret credential");
    expect(f.calls.some(row => row.args.includes("--input-type=module"))).toBe(false);
  });
  it.each([
    [{ ok: false, modelAdvertised: false, effortAdvertised: false, code: "native-model-not-advertised" }, "native-model-not-advertised"],
    [{ model: "another-model" }, "native-model-probe-unavailable"],
    [{ effort: "high" }, "native-model-probe-unavailable"],
    [{ era: "unexpected-record" }, "native-model-probe-unavailable"],
    [{ providerTurns: 1 }, "native-model-probe-unavailable"],
    [{ cleanupConfirmed: false }, "native-model-probe-unverified"],
    [{ nativeVersion: "0.144.0" }, "native-model-probe-unverified"],
  ])("refuses unavailable or mismatched native selections: %j", async (native, code) => {
    const f = fixture(native);
    expect(await f.runtime.readinessObservations("codex-exec-sdk", selected)).toMatchObject({ modelAvailability: { ok: false, code } });
  });
  it("does not probe a model without a selected model/effort or usable sign-in", async () => {
    const missing = fixture();expect(await missing.runtime.readinessObservations("codex-exec-sdk")).toMatchObject({ modelAvailability: { ok: false, code: "native-selection-unavailable" } });
    expect(missing.calls.some(row => row.args.includes("--input-type=module"))).toBe(false);expect(missing.syncs()).toBe(0);
    const expired = fixture({}, false);expect(await expired.runtime.readinessObservations("codex-exec-sdk", selected)).toMatchObject({ modelAvailability: { ok: false, code: "subscription-unavailable" } });
    expect(expired.calls.some(row => row.args.includes("--input-type=module"))).toBe(false);
  });
  it("retains the existing credential mounts and restrictions when supplying current trusted probe source", () => {
    const probe = modelReadinessProbe(configured, { ...selected, expectedNativeVersion: "0.144.1" });
    expect(probe.args.slice(-3)).toEqual(["node", "--input-type=module", "-"]);
    expect(mounts(probe.args).every(value => value.startsWith("type=volume,"))).toBe(true);
    // Use the probe's reviewed session budget. A ten-second override left
    // model/list under five seconds after a slow account/read in the R44 trace.
    expect(probe.input).toContain("prepareSubscription:observeSubscription,onProgress:");
    expect(probe.input).not.toContain("limits:{timeoutMs:10000}");
  });
  it.each(["timeout", "throw"])("cleans only the owned container after a Docker client %s", async lifecycle => {
    const f = fixture({}, true, lifecycle);
    expect(await f.runtime.readinessObservations("codex-exec-sdk", selected)).toMatchObject({ modelAvailability: { ok: false, code: "native-model-probe-unavailable", containerCleanupConfirmed: true } });
    expect(f.calls.filter(row => row.args[0] === "rm" && row.args.at(-1) === "b".repeat(64))).toHaveLength(1);
    const ownedRemovals = f.calls.filter(row => row.args[0] === "rm");
    expect(ownedRemovals.every(row => ["a".repeat(64), "b".repeat(64)].includes(row.args.at(-1)!))).toBe(true);
  });
  it("retains a Docker timeout and the last reached stage without promoting partial evidence or leaking output", async () => {
    const at = "2026-10-19T20:17:52.488Z";
    const f = fixture({}, true, "timeout", { probe: () => ({ status: null, error: "ETIMEDOUT", stderr: "private-token failed", stdout: [
      { era: "native-model-progress", stage: "version", event: "completed", at, code: "native-version-observed", nativeVersion: "0.144.1", cleanupConfirmed: true, secret: "private-token" },
      { era: "native-model-progress", stage: "subscription", event: "started", at, payload: "private-token" },
      { era: "native-model-progress", stage: "private-token", event: "started", at },
    ].map(value => JSON.stringify(value)).join("\n") }) });
    const result = await f.runtime.readinessObservations("codex-exec-sdk", selected);
    expect(result.modelAvailability).toMatchObject({ ok: false, code: "native-model-probe-unavailable", containerCleanupConfirmed: true,
      diagnostics: { transport: { process: { outcome: "timed-out", errorCode: "ETIMEDOUT", exitCode: null, nativeRecords: 0, authenticationRecords: 0 }, progress: [
        { stage: "version", event: "completed", nativeVersion: "0.144.1", cleanupConfirmed: true }, { stage: "subscription", event: "started" },
      ] } } });
    expect(result.modelAvailability).not.toHaveProperty("nativeVersion");
    expect(result.modelAvailability).not.toHaveProperty("cleanupConfirmed");
    expect(result.authentication).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(f.calls.filter(row => row.args[0] === "rm" && row.args.at(-1) === "b".repeat(64))).toHaveLength(1);
  });
  it("keeps a failed outer process blocked even if it emitted a successful native record", async () => {
    const f = fixture({}, true, "timeout");
    expect((await f.runtime.readinessObservations("codex-exec-sdk", selected)).modelAvailability).toMatchObject({
      ok: false, diagnostics: { transport: { process: { outcome: "failed", exitCode: 124, nativeRecords: 1 } } },
    });
  });
  it.each(["remove-fails", "foreign-label"])("refuses uncertain container cleanup: %s", async lifecycle => {
    const f = fixture({}, true, lifecycle);
    expect(await f.runtime.readinessObservations("codex-exec-sdk", selected)).toMatchObject({ modelAvailability: { ok: false, code: "native-container-cleanup-unconfirmed", containerCleanupConfirmed: false } });
    if (lifecycle === "foreign-label") expect(f.calls.some(row => row.args[0] === "rm" && row.args.at(-1) === "b".repeat(64))).toBe(false);
  });
  it("refuses an existing container name without launching or deleting it", async () => {
    const f = fixture({}, true, "collision");
    expect(await f.runtime.readinessObservations("codex-exec-sdk", selected)).toMatchObject({ modelAvailability: { ok: false, code: "native-model-container-unavailable" } });
    expect(f.calls.some(row => row.args.includes("--input-type=module"))).toBe(false);
    expect(f.calls.some(row => row.args[0] === "rm" && row.args.at(-1) === "b".repeat(64))).toBe(false);
  });
});

describe("worker argv", () => {
  const args = workerRunArgs({ boundary, run_id: "r-1", job_id: "j-1", access: "write", backend_id: "claude-agent-sdk", payload: { prompt: "x" } });

  it("runs non-root on a read-only root filesystem with no capabilities or network", () => {
    expect(flagValue(args, "--user")).toBe("10001:10001");
    expect(args).toContain("--read-only");
    expect(flagValue(args, "--cap-drop")).toBe("ALL");
    expect(flagValue(args, "--security-opt")).toBe("no-new-privileges");
    expect(flagValue(args, "--network")).toBe("none");
  });

  it("mounts named volumes only, never a host path or the docker socket", () => {
    expect(args).not.toContain("-v");
    expect(args).not.toContain("--volume");
    for (const mount of mounts(args)) {
      expect(mount).toMatch(/^type=volume,/u);
      expect(mount).not.toMatch(/docker\.sock/u);
    }
  });

  it("keeps the container after exit so its output can be reconciled", () => {
    expect(args).not.toContain("--rm");
    expect(flagValue(args, "--name")).toBe("era-v2-job-j-1");
  });

  it("mounts the workspace read-only for an investigation and writable after approval", () => {
    const readOnly = workerRunArgs({ boundary, run_id: "r-1", job_id: "j-2", access: "read-only", backend_id: "codex-exec-sdk", payload: {} });
    expect(mounts(readOnly).find((mount) => mount.includes("target=" + WORKDIR))).toMatch(/,readonly$/u);
    expect(mounts(args).find((mount) => mount.includes("target=" + WORKDIR))).not.toMatch(/readonly/u);
  });
});

describe("host authority is refused by shape", () => {
  it.each([
    [["-v", "C:\\Users\\aoune:/host"], BOUNDARY_REFUSALS.HOST_MOUNT],
    [["--mount", "type=bind,source=/,target=/host"], BOUNDARY_REFUSALS.HOST_MOUNT],
    [["--mount", "type=volume,source=x,target=/var/run/docker.sock"], BOUNDARY_REFUSALS.SOCKET],
    [["--network", "host"], BOUNDARY_REFUSALS.PRIVILEGE],
    [["--privileged"], BOUNDARY_REFUSALS.PRIVILEGE],
  ])("refuses %j", (argv, code) => {
    expect(() => assertNoHostAuthority(argv)).toThrow(code);
  });

  it("refuses a credential or dependency supplied as a host path", () => {
    expect(() => makeBoundaryConfig({ image: "x", credentials: { "claude-agent-sdk": { volume: "C:/Users/aoune/.claude" } } })).toThrow(
      BOUNDARY_REFUSALS.VOLUME,
    );
    expect(() => makeBoundaryConfig({ image: "x", dependencies: { volume: "../node_modules" } })).toThrow(BOUNDARY_REFUSALS.VOLUME);
  });

  it("requires an allowlist and an internal proxy before any egress is configured", () => {
    expect(() => makeBoundaryConfig({ image: "x", network: { mode: "bridge" } })).toThrow(BOUNDARY_REFUSALS.NETWORK);
    expect(() => makeBoundaryConfig({ image: "x", network: { mode: "allowlist-proxy", name: "era-egress", proxyUrl: "http://proxy:3128", allowHosts: [] } })).toThrow();
  });
});

describe("checker argv", () => {
  it("binds the trusted compiler heap to qualification, refuses caller injection, and leaves model workers unchanged", () => {
    const input = { boundary, name: "compiler", candidateVolume: "candidate", outVolume: "output", argv: typecheckArgv({ phase: "baseline" }), env: { NODE_OPTIONS: "--require=/candidate/attack.cjs", CI: "1" } };
    const compiler = checkerRunArgs(input);
    expect(compiler.filter((value: string) => value.startsWith("NODE_OPTIONS="))).toEqual(["NODE_OPTIONS=--max-old-space-size=6144"]);
    expect(compiler).not.toContain("NODE_OPTIONS=--require=/candidate/attack.cjs");
    expect(flagValue(compiler, "--memory")).toBe("8g");expect(flagValue(compiler, "--cpus")).toBe("2");expect(flagValue(compiler, "--pids-limit")).toBe("256");
    expect(compiler).toContain("/tmp:rw,size=256m");
    // @ts-expect-error Deliberately replay the old resource profile to verify runtime refusal.
    expect(() => checkerRunArgs({ ...input, boundary: { ...boundary, compilerProfile: { ...boundary.compilerProfile, containerMemory: "4g" } } })).toThrow(/requalify/);
    expect(flagValue(checkerRunArgs({ ...input, argv: ["node", "behavior.mjs"] }), "--memory")).toBe("8g");
    const worker = workerRunArgs({ boundary, run_id: "r-heap", job_id: "j-heap", access: "write", backend_id: "codex-exec-sdk", payload: {} });
    expect(worker.some((value: string) => value.startsWith("NODE_OPTIONS="))).toBe(false);
    expect(flagValue(worker, "--memory")).toBe("4g");
    expect(boundary.compilerProfile).toEqual(COMPILER_RESOURCE_PROFILE);
    const oldBody = Object.fromEntries(Object.entries(boundary).filter(([key]) => !["digest", "compilerProfile"].includes(key)));
    const oldBoundary = { ...boundary, digest: fingerprint(canonicalJson(oldBody)) };
    expect(boundaryBindingDigest(boundary, "fixture")).not.toBe(boundaryBindingDigest(oldBoundary, "fixture"));
  });
  const args = checkerRunArgs({
    boundary: makeBoundaryConfig({ image: "x", network: { mode: "allowlist-proxy", name: "era-egress", proxyUrl: "http://proxy:3128", allowHosts: ["api.anthropic.com"] } }),
    name: "era-v2-check-r-1-C1-1",
    candidateVolume: "era-v2-r-1-cand-C1",
    outVolume: "era-v2-r-1-out-C1",
    argv: ["node", "test.mjs"],
    env: { CI: "1", ANTHROPIC_API_KEY: "sk-leak", NODE_ENV: "test" },
  });

  it("has no network even when the worker boundary allows provider egress", () => {
    expect(flagValue(args, "--network")).toBe("none");
    expect(args.join(" ")).not.toMatch(/HTTPS_PROXY/u);
  });

  it("reads the frozen candidate read-only and passes no credentials", () => {
    expect(mounts(args).find((mount) => mount.includes("target=/candidate"))).toMatch(/,readonly$/u);
    expect(args.join(" ")).not.toMatch(/ANTHROPIC_API_KEY/u);
    expect(args).toContain("CI=1");
  });
});

describe("binding and relay", () => {
  it("changes the binding digest when the image or the configuration changes", () => {
    const a = boundaryBindingDigest(boundary, "sha256:image-a");
    expect(boundaryBindingDigest(boundary, "sha256:image-b")).not.toBe(a);
    const proxied = makeBoundaryConfig({ image: boundary.image, network: { mode: "allowlist-proxy", name: "n", proxyUrl: "http://p:3128", allowHosts: ["h"] } });
    expect(boundaryBindingDigest(proxied, "sha256:image-a")).not.toBe(a);
  });

  it("relays runner records as the SDK messages an adapter reads, without functions or controllers", async () => {
    let seen: Record<string, unknown> | null = null;
    const sdk = sdkFromRunnerStream("claude-agent-sdk", async function* (payload: object) {
      seen = payload as Record<string, unknown>;
      yield { era: "runner-started" };
      yield { era: "sdk-message", message: { type: "system", subtype: "init", model: "model-x" } };
      yield { era: "observation", data: { effort: { level: "high" }, agent_id: null } };
      yield { era: "sdk-message", message: { type: "result", subtype: "success", is_error: false } };
    }) as { query: (input: object) => AsyncIterable<{ type: string }> };
    const controller = new AbortController();
    const types: string[] = [];
    for await (const message of sdk.query({ prompt: "p", options: { cwd: "C:/host", canUseTool: () => null, abortController: controller, hooks: {}, model: "m" } })) {
      types.push(message.type);
    }
    expect(types).toEqual(["system", "era_observation", "result"]);
    const options = (seen as unknown as { options: Record<string, unknown>; observe: { effort: boolean } }).options;
    expect(options.cwd).toBe(WORKDIR);
    expect(options).not.toHaveProperty("canUseTool");
    expect(options).not.toHaveProperty("abortController");
    expect((seen as unknown as { observe: { effort: boolean } }).observe.effort).toBe(true);
  });

  it("turns a runner error into a thrown error rather than a quiet end", async () => {
    const sdk = sdkFromRunnerStream("codex-exec-sdk", async function* () {
      yield { era: "runner-error", message: "sdk failed to load" };
    }) as { Codex: new () => { startThread: (o: object) => { runStreamed: (p: string) => Promise<{ events: AsyncIterable<unknown> }> } } };
    const thread = new sdk.Codex().startThread({});
    const streamed = await thread.runStreamed("p");
    await expect(
      (async () => {
        for await (const _event of streamed.events) void _event;
      })(),
    ).rejects.toThrow(/sdk failed to load/u);
  });
});
