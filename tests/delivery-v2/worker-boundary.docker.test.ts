// Command Center Phase 3 — the container boundary exercised for real, on
// synthetic assets. Opt-in: ERA_V2_DOCKER=1 pnpm exec vitest run tests/delivery-v2/worker-boundary.docker.test.ts
//
// No provider, no credential, no host mount. A tiny image carries only the worker
// runner; under a synthetic boundary the runner refuses anything but a scripted
// write, so nothing here can reach an SDK. What it proves about the boundary Phase 0
// left unexercised: host snapshot → worker volume, a read-only investigation mount
// denying a write, a writable implementation, retained output replayed without a
// relaunch, stop observed as removal, export through the trusted loader, and a
// separate network-less checker that cannot write the frozen candidate.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createClaudeAdapter } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { makeJobRequest } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import { RUNNER_PATH, createContainerRuntime, makeBoundaryConfig, volumesFor } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { loadQualification } from "../../scripts/delivery-v2/qualification.mjs";

const enabled = process.env.ERA_V2_DOCKER === "1";
const IMAGE = "era-delivery-v2-smoke:phase3";
const RUN = "r-smoke" + String(process.pid);
const runner = fileURLToPath(new URL("../../scripts/delivery-v2/worker/runner.mjs", import.meta.url));

let HOST: string;
let WORK: string;
let GENERATIONS: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtime: any;

const docker = (args: string[]) => spawnSync("docker", args, { encoding: "utf8", windowsHide: true, timeout: 600_000 });

function request(job_id: string, access: "read-only" | "write", script: object) {
  return makeJobRequest({
    job_id,
    run_id: RUN,
    purpose: access === "read-only" ? "investigate" : "resume",
    contract: { contract_id: "c-smoke", revision: 1 },
    grant: { grant_id: "g-smoke", revision: 0 },
    workspace: { root: "/work", backing: "container-volume", access },
    reservation: { unit: "usd", amount: null, basis: "synthetic; no provider" },
    backend_id: "claude-agent-sdk",
    instruction: "SYNTHETIC " + JSON.stringify(script),
  });
}

async function dispatch(job_id: string, access: "read-only" | "write", script: object) {
  const job = { job_id, run_id: RUN, access, backend_id: "claude-agent-sdk" };
  const provisioned = await runtime.provision({ run_id: RUN, job, include: ["src/amount.ts", "tests/check.mjs"] });
  const adapter = createClaudeAdapter({ importSdk: provisioned.importSdk });
  return { provisioned, result: await adapter.start(request(job_id, access, script), {}) };
}

describe.skipIf(!enabled)("container worker and checker on synthetic assets", () => {
  beforeAll(() => {
    const context = mkdtempSync(join(tmpdir(), "era-v2-smoke-image-"));
    mkdirSync(join(context, "worker"), { recursive: true });
    copyFileSync(runner, join(context, "worker", "runner.mjs"));
    copyFileSync(fileURLToPath(new URL("../../scripts/delivery-v2/worker/subscription.mjs", import.meta.url)), join(context, "worker", "subscription.mjs"));
    writeFileSync(
      join(context, "Dockerfile"),
      [
        "FROM node:22-bookworm-slim",
        "RUN groupadd -g 10001 era && useradd -u 10001 -g 10001 -d /home/era -m era && mkdir -p /work && chown 10001:10001 /work",
        "COPY worker/runner.mjs " + RUNNER_PATH,
        "COPY worker/subscription.mjs " + RUNNER_PATH.replace("runner.mjs", "subscription.mjs"),
        "USER 10001:10001",
        "",
      ].join("\n"),
      "utf8",
    );
    const built = docker(["build", "-q", "-t", IMAGE, context]);
    rmSync(context, { recursive: true, force: true });
    expect(built.status, built.stderr).toBe(0);

    HOST = mkdtempSync(join(tmpdir(), "era-v2-smoke-host-"));
    WORK = mkdtempSync(join(tmpdir(), "era-v2-smoke-work-"));
    GENERATIONS = mkdtempSync(join(tmpdir(), "era-v2-smoke-generations-"));
    mkdirSync(join(HOST, "src"), { recursive: true });
    mkdirSync(join(HOST, "tests"), { recursive: true });
    writeFileSync(join(HOST, "src", "amount.ts"), "export const amount = 25;\n", "utf8");
    writeFileSync(join(HOST, "tests", "check.mjs"), "// synthetic\n", "utf8");
    runtime = createContainerRuntime({ boundary: makeBoundaryConfig({ image: IMAGE, synthetic: true }), hostRoot: HOST, workRoot: WORK });
  }, 600_000);

  afterAll(() => {
    if (!enabled) return;
    const names = docker(["ps", "-a", "--filter", "label=era.v2.run=" + RUN, "--format", "{{.Names}}"]).stdout.split("\n").filter(Boolean);
    for (const name of names) docker(["rm", "-f", name]);
    const volumes = docker(["volume", "ls", "--format", "{{.Name}}"]).stdout.split("\n").filter((name) => name.startsWith("era-v2-" + RUN));
    for (const volume of [...volumes, volumesFor(RUN).work, volumesFor(RUN).session]) docker(["volume", "rm", "-f", volume]);
    docker(["image", "rm", "-f", IMAGE]);
    for (const dir of [HOST, WORK, GENERATIONS]) if (dir) rmSync(dir, { recursive: true, force: true });
  }, 600_000);

  it("denies a write from a read-only investigation by the mount itself", async () => {
    const { provisioned, result } = await dispatch("j-smoke-investigate", "read-only", {
      writes: [{ path: "src/amount.ts", content: "export const amount = 99;\n" }],
    });
    expect(provisioned.base_manifest.map((entry: { path: string }) => entry.path)).toEqual(["src/amount.ts", "tests/check.mjs"]);
    expect(result.status).toBe("finished");
    expect(String(result.observations.finalText)).toMatch(/write denied: src\/amount\.ts: EROFS/u);
  }, 300_000);

  it("replays a finished worker's retained output without starting it again", async () => {
    const recovered = await runtime.recover({ job_id: "j-smoke-investigate", backend_id: "claude-agent-sdk" });
    expect(recovered.running).toBe(false);
    const replay = await createClaudeAdapter({ importSdk: recovered.importSdk }).start(request("j-smoke-investigate", "read-only", {}), {});
    expect(replay.status).toBe("finished");
    expect(String(replay.observations.finalText)).toMatch(/EROFS/u);
    await runtime.release({ job_id: "j-smoke-investigate" });
    const stop = await runtime.stop({ job_id: "j-smoke-investigate" });
    expect(stop.stopObserved).toBe(true);
  }, 300_000);

  it("lets the approved job write, then freezes exactly what it wrote", async () => {
    const { result } = await dispatch("j-smoke-implement", "write", { writes: [{ path: "src/amount.ts", content: "export const amount = 20;\n" }], reply: "done" });
    expect(result.status).toBe("finished");
    expect(result.observations.finalText).toBe("done");
    const candidate = await runtime.exportCandidate({
      run_id: RUN,
      job_id: "j-smoke-implement",
      generation: "C1",
      generationsRoot: GENERATIONS,
      base_manifest: [
        { path: "src/amount.ts", sha256: "unused", size: 0 },
        { path: "tests/check.mjs", sha256: "unused", size: 0 },
      ],
    });
    expect(readFileSync(join(candidate.root, "src", "amount.ts"), "utf8")).toBe("export const amount = 20;\n");
    expect(candidate.manifest.map((entry: { path: string }) => entry.path)).toEqual(["src/amount.ts", "tests/check.mjs"]);
    // The host checkout was never written.
    expect(readFileSync(join(HOST, "src", "amount.ts"), "utf8")).toBe("export const amount = 25;\n");

    const execute = runtime.checkExecutor({ run_id: RUN, candidate });
    const passed = execute({
      argv: ["node", "-e", "require('fs').readFileSync('/candidate/src/amount.ts','utf8').includes('= 20;') ? console.log('Tests  1 passed (1)') : process.exit(1)"],
      env: { CI: "1", ANTHROPIC_API_KEY: "must-not-arrive" },
    });
    expect(passed.exitCode).toBe(0);
    expect(passed.stdout).toMatch(/Tests {2}1 passed \(1\)/u);
    const noWrite = execute({ argv: ["node", "-e", "require('fs').writeFileSync('/candidate/src/amount.ts','x')"], env: {} });
    expect(noWrite.exitCode).not.toBe(0);
    expect(noWrite.stderr).toMatch(/EROFS/u);
    const noNetwork = execute({
      argv: ["node", "-e", "require('net').connect(443,'1.1.1.1').on('error',e=>{console.log(e.code);process.exit(0)}).on('connect',()=>{console.log('CONNECTED');process.exit(0)})"],
      env: {},
    });
    expect(noNetwork.stdout).not.toMatch(/CONNECTED/u);
    const noCredential = execute({ argv: ["node", "-e", "console.log(String(process.env.ANTHROPIC_API_KEY))"], env: { ANTHROPIC_API_KEY: "must-not-arrive" } });
    expect(noCredential.stdout.trim()).toBe("undefined");
  }, 600_000);

  it("states no binding for an image without an executor SDK, so nothing qualifies", async () => {
    const binding = await runtime.binding("claude-agent-sdk");
    expect(binding).toBeNull();
    expect(loadQualification({ root: HOST, backend_id: "claude-agent-sdk", binding }).refusals[0].code).toBe("runtime-binding-unavailable");
  }, 300_000);
});
