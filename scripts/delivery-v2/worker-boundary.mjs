// scripts/delivery-v2/worker-boundary.mjs
// Command Center Phase 3 — the container worker and checker boundary (DLV-96/97).
//
// Phase 0 established, on synthetic assets, that a hardened Docker container
// (non-root, read-only root filesystem, no capabilities, no host mounts) denies
// the battery's host reads, writes, link escapes and store access, and that a
// stop must mean removing the container. This module turns that boundary into
// the runtime a job actually executes in:
//
//   provision   trusted snapshot (scratch.mjs) → a named volume; nothing from the
//               host is ever bind-mounted, and the docker socket never is.
//   execute     the native executor runs *inside* the worker container through a
//               small runner; the adapters talk to it through their existing SDK
//               seam (`importSdk`), so no supervisor branch is added per provider.
//   access      an investigation mounts the workspace read-only, so a preapproval
//               write is denied by the environment rather than by a prompt.
//   stop        container removal, observed by inspecting that it is gone.
//   recover     a worker container is kept after exit until its output has been
//               recorded, so a supervisor crash can be reconciled from the
//               retained log without dispatching anything again.
//   export      the workspace volume → host staging → trusted import (checks.mjs).
//   check       the frozen candidate → a fresh read-only volume → a separate
//               checker container with no network and a restricted environment.
//
// What this module does not establish: that any executor is qualified to run in
// it. That is a bound receipt (qualification.mjs). Provider egress through an
// allowlist is configurable here and unverified by the battery.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ContractError, canonicalJson, deepFreeze, fingerprint, normalizePath } from "./contracts.mjs";
import { assertScratchOutsideHost, provisionScratch } from "./scratch.mjs";
import { importTrustedCandidate } from "./checks.mjs";
import { normalizeHosts, PROXY_PORT } from "./worker/egress.mjs";
import { nestedSandboxDigest, nestedSandboxJSON } from "./worker/seccomp.mjs";

export const BOUNDARY_SCHEMA = "delivery-v2/worker-boundary@1";
export const WORKER_USER = "10001:10001";
export const WORKER_HOME = "/home/era";
export const WORKDIR = "/work";
export const RUNNER_PATH = "/opt/era/scripts/delivery-v2/worker/runner.mjs";
export const CANARY_PATH = "/opt/era/scripts/delivery-v2/probes/canary.mjs";
export const CREDENTIAL_ROOT = "/run/era-credentials";
export const NETWORK_MODES = Object.freeze(["none", "allowlist-proxy", "namespace-proxy"]);

export const BOUNDARY_REFUSALS = Object.freeze({
  HOST_MOUNT: "host-mount-refused",
  SOCKET: "container-socket-refused",
  PRIVILEGE: "privileged-container-refused",
  NETWORK: "unsupported-network-mode",
  IMAGE: "worker-image-required",
  VOLUME: "invalid-volume-name",
});

const VOLUME_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Validate and freeze a boundary configuration.
 *
 * Only named volumes may be supplied (credentials, dependencies). A host path is
 * refused by shape, because a mistaken bind mount is exactly how a host secret or
 * the supervisor store reaches a worker.
 *
 * @param {{image:string, network?:{mode:string, name?:string, proxyUrl?:string, allowHosts?:string[]},
 *   limits?:{pids?:number, memory?:string, cpus?:string},
 *   credentials?:Record<string, {volume:string}>, dependencies?:({volume:string}|null),
 *   synthetic?:boolean}} input
 */
export function makeBoundaryConfig({ image, network = { mode: "none" }, limits = {}, credentials = {}, dependencies = null, synthetic = false }) {
  if (!isNonEmptyString(image)) throw new ContractError(BOUNDARY_REFUSALS.IMAGE);
  const net = isPlainObject(network) ? network : { mode: "none" };
  if (!NETWORK_MODES.includes(net.mode)) throw new ContractError(BOUNDARY_REFUSALS.NETWORK + ": " + String(net.mode));
  const normalizedNetwork = { mode: net.mode };
  if (net.mode === "namespace-proxy") {
    if (!VOLUME_NAME.test(String(net.name || ""))) throw new ContractError("network.name must name the egress container");
    if (!/^sha256:[a-f0-9]{64}$/u.test(String(net.imageId || ""))) throw new ContractError("network.imageId must pin the egress image");
    Object.assign(normalizedNetwork, { name: net.name, imageId: net.imageId, proxyUrl: "http://127.0.0.1:" + PROXY_PORT, allowHosts: normalizeHosts(net.allowHosts) });
  }
  if (net.mode === "allowlist-proxy") {
    if (!VOLUME_NAME.test(String(net.name || ""))) throw new ContractError("network.name must be a docker network name");
    if (!/^http:\/\/[A-Za-z0-9.-]+:\d{2,5}$/u.test(String(net.proxyUrl || ""))) {
      throw new ContractError("network.proxyUrl must be http://<host>:<port> on the internal network");
    }
    const hosts = Array.isArray(net.allowHosts) ? net.allowHosts.filter(isNonEmptyString) : [];
    if (!hosts.length) throw new ContractError("network.allowHosts must name at least one host");
    Object.assign(normalizedNetwork, { name: net.name, proxyUrl: net.proxyUrl, allowHosts: [...hosts].sort() });
  }
  const volumes = {};
  for (const [backend, entry] of Object.entries(isPlainObject(credentials) ? credentials : {})) {
    if (!entry || !VOLUME_NAME.test(String(entry.volume || ""))) throw new ContractError(BOUNDARY_REFUSALS.VOLUME + ": credentials." + backend);
    volumes[backend] = { volume: entry.volume };
  }
  if (dependencies && !VOLUME_NAME.test(String(dependencies.volume || ""))) {
    throw new ContractError(BOUNDARY_REFUSALS.VOLUME + ": dependencies");
  }
  const body = {
    schema: BOUNDARY_SCHEMA,
    image,
    network: normalizedNetwork,
    ...(net.mode === "namespace-proxy" ? { seccompDigest: nestedSandboxDigest } : {}),
    limits: {
      pids: Number.isInteger(limits.pids) && limits.pids > 0 ? limits.pids : 256,
      memory: isNonEmptyString(limits.memory) ? limits.memory : "4g",
      cpus: isNonEmptyString(limits.cpus) ? limits.cpus : "2",
    },
    credentials: volumes,
    dependencies: dependencies ? { volume: dependencies.volume } : null,
    synthetic: Boolean(synthetic),
  };
  return deepFreeze({ ...body, digest: fingerprint(canonicalJson(body)) });
}

/** The binding digest a qualification receipt must match: configuration plus the exact image. */
export function boundaryBindingDigest(boundary, imageId, egressId = null) {
  return fingerprint(canonicalJson({ boundary: boundary.digest, image_id: String(imageId || ""), ...(egressId ? { egress_id: egressId } : {}) }));
}

/** Inspect the actual namespace owner. A stopped/replaced proxy invalidates admission. */
export function readEgressBinding(boundary, run) {
  if (boundary.network.mode !== "namespace-proxy") return null;
  const inspected = run(["inspect", boundary.network.name]);
  if (inspected.status !== 0) throw new ContractError("delivery egress container is unavailable");
  const [item] = JSON.parse(inspected.stdout);
  if (!item?.State?.Running || item.Image !== boundary.network.imageId || item.HostConfig.Privileged || item.HostConfig.NetworkMode === "host" || item.Mounts.length) throw new ContractError("delivery egress boundary does not match configuration");
  if (!item.HostConfig.ReadonlyRootfs || canonicalJson((item.HostConfig.CapAdd || []).map(cap => cap.replace(/^CAP_/u, "")).sort()) !== canonicalJson(["NET_ADMIN", "SETGID", "SETUID"]) || !(item.HostConfig.CapDrop || []).includes("ALL") || item.Config.Cmd?.[1] !== "/opt/era/scripts/delivery-v2/worker/egress.mjs") throw new ContractError("delivery egress process does not match configuration");
  const health = run(["exec", "--user", WORKER_USER, boundary.network.name, "node", "-e", "fetch('http://127.0.0.1:3128/__era/ready').then(r=>r.json()).then(x=>process.stdout.write(JSON.stringify(x)))"]);
  const facts = JSON.parse(health.stdout || "null");
  if (health.status !== 0 || !facts?.ready || facts.proxyUid !== 10002 || facts.firewall !== "uid-proxy-only@1" || canonicalJson(facts.allowHosts) !== canonicalJson(boundary.network.allowHosts)) throw new ContractError("delivery egress firewall is not ready");
  return item.Id;
}

/** Flags shared by the worker and the checker. */
export function hardenedFlags(boundary, { network = true } = {}) {
  const seccomp = join(tmpdir(), "era-delivery-seccomp-" + nestedSandboxDigest.slice(7, 23) + ".json");
  if (boundary.seccompDigest) {
    if (boundary.seccompDigest !== nestedSandboxDigest) throw new ContractError("worker syscall profile changed; requalify the boundary");
    if (!existsSync(seccomp) || readFileSync(seccomp, "utf8") !== nestedSandboxJSON) writeFileSync(seccomp, nestedSandboxJSON, { mode: 0o600 });
  }
  const flags = [
    "--user", WORKER_USER,
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    ...(boundary.seccompDigest ? ["--security-opt", "seccomp=" + seccomp] : []),
    "--pids-limit", String(boundary.limits.pids),
    "--memory", boundary.limits.memory,
    "--cpus", boundary.limits.cpus,
    "--tmpfs", "/tmp:rw,size=256m",
  ];
  if (!network || boundary.network.mode === "none") return [...flags, "--network", "none"];
  return [
    ...flags,
    "--network", (boundary.network.mode === "namespace-proxy" ? "container:" : "") + boundary.network.name,
    "--env", "HTTPS_PROXY=" + boundary.network.proxyUrl,
    "--env", "HTTP_PROXY=" + boundary.network.proxyUrl,
  ];
}

/** Refuse any argv that could hand host authority to a container. */
export function assertNoHostAuthority(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index]);
    const next = String(args[index + 1] ?? "");
    if (arg === "-v" || arg === "--volume" || arg.startsWith("--volume=")) throw new ContractError(BOUNDARY_REFUSALS.HOST_MOUNT);
    if (arg === "--mount" && (/type=bind/u.test(next) || /docker\.sock/u.test(next))) {
      throw new ContractError(/docker\.sock/u.test(next) ? BOUNDARY_REFUSALS.SOCKET : BOUNDARY_REFUSALS.HOST_MOUNT);
    }
    if (arg === "--privileged" || arg === "--cap-add") throw new ContractError(BOUNDARY_REFUSALS.PRIVILEGE);
    if ((arg === "--network" || arg === "--pid" || arg === "--ipc") && next === "host") throw new ContractError(BOUNDARY_REFUSALS.PRIVILEGE);
  }
  return args;
}

export function volumesFor(run_id) {
  return deepFreeze({ work: "era-v2-" + run_id + "-work", session: "era-v2-" + run_id + "-session" });
}

export const containerNameFor = (job_id) => "era-v2-job-" + job_id;

/**
 * `docker run` argv for one job's worker container.
 *
 * No `--rm`: the container and its log outlive the process so a supervisor crash
 * can be reconciled from what the executor actually printed.
 *
 * @param {{boundary:ReturnType<typeof makeBoundaryConfig>, run_id:string, job_id:string,
 *   access:string, backend_id:string, payload:object}} input
 */
export function workerRunArgs({ boundary, run_id, job_id, access, backend_id }) {
  const volumes = volumesFor(run_id);
  const credential = boundary.credentials[backend_id];
  const args = [
    "run",
    "-i",
    "--name", containerNameFor(job_id),
    "--label", "era.v2.job=" + job_id,
    "--label", "era.v2.run=" + run_id,
    ...hardenedFlags(boundary),
    "--mount", "type=volume,source=" + volumes.work + ",target=" + WORKDIR + (access === "read-only" ? ",readonly" : ""),
    "--mount", "type=volume,source=" + volumes.session + ",target=" + WORKER_HOME,
    ...(credential ? ["--mount", "type=volume,source=" + credential.volume + ",target=" + CREDENTIAL_ROOT + ",readonly"] : []),
    ...(boundary.dependencies ? ["--mount", "type=volume,source=" + boundary.dependencies.volume + ",target=/deps,readonly"] : []),
    "--env", "HOME=" + WORKER_HOME,
    ...(boundary.synthetic ? ["--env", "ERA_V2_SYNTHETIC=1"] : []),
    "--workdir", WORKDIR,
    boundary.image,
    "node", RUNNER_PATH,
    "--stdin",
  ];
  return assertNoHostAuthority(args);
}

export function authProbeArgs(boundary, backend) {
  const credential = boundary.credentials[backend];
  if (!credential) throw new ContractError("subscription login has not been connected to this worker");
  return ["run", "--rm", ...hardenedFlags(boundary), "--tmpfs", WORKER_HOME + ":rw,uid=10001,gid=10001,size=32m", "--mount", "type=volume,source=" + credential.volume + ",target=/run/era-credentials,readonly", "--env", "HOME=" + WORKER_HOME, boundary.image, "node", RUNNER_PATH, "--auth-probe", backend];
}

/**
 * `docker run` argv for one protected check against a frozen candidate volume.
 *
 * @param {{boundary:ReturnType<typeof makeBoundaryConfig>, name:string, candidateVolume:string,
 *   outVolume:string, argv:string[], env?:Record<string, string>}} input
 */
export function checkerRunArgs({ boundary, name, candidateVolume, outVolume, argv, env = {} }) {
  const allowed = ["CI", "NODE_ENV", "LANG"];
  const args = [
    "run",
    "--rm",
    "--name", name,
    ...hardenedFlags(boundary, { network: false }),
    "--mount", "type=volume,source=" + candidateVolume + ",target=/candidate,readonly",
    "--mount", "type=volume,source=" + outVolume + ",target=/out",
    ...(boundary.dependencies ? ["--mount", "type=volume,source=" + boundary.dependencies.volume + ",target=/deps,readonly"] : []),
    "--env", "HOME=/tmp",
    ...Object.entries(env)
      .filter(([key]) => allowed.includes(key))
      .flatMap(([key, value]) => ["--env", key + "=" + value]),
    "--workdir", "/candidate",
    boundary.image,
    ...argv,
  ];
  return assertNoHostAuthority(args);
}

// ---------------------------------------------------------------------------
// Docker CLI
// ---------------------------------------------------------------------------

/** The only place a docker process is spawned. Injected everywhere for fixtures. */
export function createDockerCli({ bin = "docker", spawnFn = spawn, spawnSyncFn = spawnSync } = {}) {
  return {
    run(args, { input = undefined, timeout = 300_000 } = {}) {
      const result = spawnSyncFn(bin, args, { encoding: "utf8", input, timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
      return {
        status: result.status,
        stdout: String(result.stdout || ""),
        stderr: String(result.stderr || ""),
        error: result.error ? String(result.error.code || result.error.message) : null,
      };
    },
    /** Spawn and yield stdout lines as they arrive. */
    async *lines(args, { signal = null, onAbort = null, input = null } = {}) {
      const child = spawnFn(bin, args, { windowsHide: true });
      const queue = [];
      let done = false;
      let failure = null;
      let wake = null;
      let buffer = "";
      let stderr = "";
      child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-2000); });
      child.stdin.on("error", () => {});
      child.stdin.end(input);
      const notify = () => {
        if (wake) {
          const resolve = wake;
          wake = null;
          resolve();
        }
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf("\n")) >= 0) {
          queue.push(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
        notify();
      });
      child.on("error", (error) => {
        failure = error;
        done = true;
        notify();
      });
      child.on("close", code => {
        if (code !== 0 && !failure) failure = new ContractError("worker process exited " + code + (stderr ? ": " + stderr : ""));
        if (buffer) queue.push(buffer);
        done = true;
        notify();
      });
      const abort = () => {
        if (typeof onAbort === "function") onAbort();
      };
      if (signal) {
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      }
      while (true) {
        if (queue.length) {
          yield queue.shift();
          continue;
        }
        if (done) break;
        await new Promise((resolve) => {
          wake = resolve;
        });
      }
      if (failure) throw failure;
    },
  };
}

function parseLine(line) {
  const text = String(line || "").trim();
  if (!text.startsWith("{")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Options that can cross a process boundary: no functions, no controllers. */
function serializableOptions(options) {
  const rest = { ...(options || {}) };
  delete rest.abortController;
  delete rest.canUseTool;
  delete rest.hooks;
  return JSON.parse(JSON.stringify({ ...rest, cwd: WORKDIR }));
}

/**
 * Turn a stream of runner records into the SDK shapes each adapter already reads.
 *
 * @param {string} backend_id
 * @param {(payload:object, signal:(AbortSignal|null))=>AsyncIterable<any>} source
 */
export function sdkFromRunnerStream(backend_id, source) {
  const relay = async function* (payload, signal) {
    let includedSubscription = false;
    for await (const record of source(payload, signal)) {
      if (!record || typeof record !== "object") continue;
      if (record.era === "subscription-ready" && record.additionalSpendAllowed === false) includedSubscription = true;
      if (record.era === "runner-error") throw new ContractError("worker runner: " + String(record.message));
      if (record.era === "sdk-message" && record.message) yield includedSubscription && record.message.type === "result" ? { ...record.message, era_billing_basis: "included-subscription" } : record.message;
      else if (record.era === "sdk-event" && record.event) yield record.event;
      else if (record.era === "observation") yield { type: "era_observation", ...(record.data || {}) };
    }
  };
  if (backend_id === "claude-agent-sdk") {
    return {
      query: ({ prompt, options }) =>
        relay(
          { prompt, options: serializableOptions(options), observe: { effort: Boolean(options && options.hooks) } },
          options && options.abortController ? options.abortController.signal : null,
        ),
    };
  }
  if (backend_id === "codex-exec-sdk") {
    const thread = (threadOptions, threadId) => ({
      async runStreamed(prompt, turnOptions = {}) {
        const events = relay(
          { prompt, threadOptions: { ...threadOptions, workingDirectory: WORKDIR }, threadId },
          turnOptions.signal || null,
        );
        // Observation records are Claude-shaped; Codex's drain ignores unknown events.
        return { events };
      },
    });
    return {
      Codex: class {
        startThread(threadOptions) {
          return thread(threadOptions, null);
        }
        resumeThread(id, threadOptions) {
          return thread(threadOptions, id);
        }
      },
    };
  }
  throw new ContractError("no worker SDK bridge for " + backend_id);
}

// ---------------------------------------------------------------------------
// The runtime the journey uses
// ---------------------------------------------------------------------------

/**
 * @param {{boundary:ReturnType<typeof makeBoundaryConfig>, hostRoot:string, workRoot?:string,
 *   docker?:ReturnType<typeof createDockerCli>}} input
 */
export function createContainerRuntime({ boundary, hostRoot, workRoot = join(tmpdir(), "era-delivery-v2"), docker = createDockerCli() }) {
  mkdirSync(workRoot, { recursive: true });
  assertScratchOutsideHost({ scratchRoot: workRoot, hostRoot });

  const exists = (kind, name) => docker.run([kind, "inspect", name]).status === 0;

  function importDirToVolume({ dir, volume }) {
    const helper = "era-v2-helper-" + volume;
    docker.run(["rm", "-f", helper]);
    const created = docker.run(["create", "--name", helper, "--network", "none", "--mount", "type=volume,source=" + volume + ",target=/dst", boundary.image, "true"]);
    if (created.status !== 0) throw new ContractError("could not stage volume " + volume + ": " + created.stderr);
    try {
      const copied = docker.run(["cp", dir + "/.", helper + ":/dst"]);
      if (copied.status !== 0) throw new ContractError("could not copy into " + volume + ": " + copied.stderr);
    } finally {
      docker.run(["rm", "-f", helper]);
    }
    const owned = docker.run([
      "run", "--rm", "--user", "0:0", "--network", "none", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "FOWNER",
      "--mount", "type=volume,source=" + volume + ",target=/dst", boundary.image, "chown", "-R", WORKER_USER, "/dst",
    ]);
    if (owned.status !== 0) throw new ContractError("could not hand " + volume + " to the worker user: " + owned.stderr);
  }

  function exportVolumeToDir({ volume, dir }) {
    const helper = "era-v2-export-" + volume;
    docker.run(["rm", "-f", helper]);
    const created = docker.run(["create", "--name", helper, "--network", "none", "--mount", "type=volume,source=" + volume + ",target=/src,readonly", boundary.image, "true"]);
    if (created.status !== 0) throw new ContractError("could not open " + volume + " for export: " + created.stderr);
    try {
      const copied = docker.run(["cp", helper + ":/src/.", dir]);
      if (copied.status !== 0) throw new ContractError("could not export " + volume + ": " + copied.stderr);
    } finally {
      docker.run(["rm", "-f", helper]);
    }
  }

  function containerSource({ run_id, job_id, access, backend_id }) {
    return (payload, signal) => {
      const args = workerRunArgs({ boundary, run_id, job_id, access, backend_id, payload });
      docker.run(["rm", "-f", containerNameFor(job_id)]);
      return (async function* () {
        for await (const line of docker.lines(args, { signal, input: JSON.stringify({ ...payload, backend_id }), onAbort: () => docker.run(["rm", "-f", containerNameFor(job_id)]) })) {
          const record = parseLine(line);
          if (record?.era === "subscription-ready") {
            const dir = join(workRoot, "subscription-receipts");
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, job_id + ".json"), JSON.stringify(record, null, 2));
          }
          if (record) yield record;
        }
      })();
    };
  }

  const bindingMemo = new Map();
  const authMemo = new Map();

  function readBinding(backend_id) {
    const image = docker.run(["image", "inspect", "--format", "{{.Id}}", boundary.image]);
    if (image.status !== 0) return null;
    const probe = docker.run(["run", "--rm", "--network", "none", "--user", WORKER_USER, "--read-only", boundary.image, "node", RUNNER_PATH, "--probe"]);
    const facts = String(probe.stdout).split("\n").map(parseLine).filter(Boolean).pop();
    if (!facts || !facts.sdk || !isNonEmptyString(facts.sdk[backend_id]) || !isNonEmptyString(facts.battery_digest)) return null;
    let egressId;
    try { egressId = readEgressBinding(boundary, (args) => docker.run(args)); } catch { return null; }
    return deepFreeze({
      backend_id,
      sdk_version: facts.sdk[backend_id],
      boundary_digest: boundaryBindingDigest(boundary, image.stdout.trim(), egressId),
      battery_digest: facts.battery_digest,
    });
  }

  return {
    kind: "container",
    boundary,

    async authReadiness(backend) {
      if (boundary.synthetic) return { ok: true, synthetic: true };
      const memo = authMemo.get(backend);
      if (memo && Date.now() - memo.at < 60000) return memo.value;
      let value;
      try {
        const result = docker.run(authProbeArgs(boundary, backend), { timeout: 45000 });
        const facts = result.stdout.split("\n").map(parseLine).filter(Boolean).pop();
        value = result.status === 0 && facts?.era === "subscription-ready" ? { ok: true, ...facts } : { ok: false, reason: facts?.message || "Worker subscription check failed" };
      } catch (error) { value = { ok: false, reason: error.message }; }
      authMemo.set(backend, { at: Date.now(), value });
      return value;
    },

    /** Where a job's workspace appears inside its worker. */
    workspaceFor({ access }) {
      return deepFreeze({ root: WORKDIR, backing: "container-volume", access });
    },

    /** The binding a qualification receipt must match, or null when it cannot be established. Memoized briefly. */
    async binding(backend_id) {
      const memo = bindingMemo.get(backend_id);
      if (memo && Date.now() - memo.at < 60_000) return memo.value;
      const value = readBinding(backend_id);
      bindingMemo.set(backend_id, { at: Date.now(), value });
      return value;
    },

    /**
     * Prepare the run's workspace (once) and hand back the SDK bridge for one job.
     *
     * @param {{run_id:string, job:any, include:string[]}} input
     */
    async provision({ run_id, job, include }) {
      readEgressBinding(boundary, (args) => docker.run(args));
      const volumes = volumesFor(run_id);
      let base_manifest = null;
      let refusals = [];
      if (!exists("volume", volumes.work)) {
        docker.run(["volume", "create", volumes.work]);
        docker.run(["volume", "create", volumes.session]);
        const homeOwner = docker.run(["run", "--rm", "--network", "none", "--user", "0:0", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--mount", "type=volume,source=" + volumes.session + ",target=/dst", boundary.image, "chown", WORKER_USER, "/dst"]);
        if (homeOwner.status !== 0) throw new ContractError("could not initialize worker session volume");
        const staging = mkdtempSync(join(workRoot, "snapshot-"));
        try {
          const supplied = provisionScratch({ scratchRoot: staging, hostRoot, include });
          base_manifest = supplied.supplied;
          refusals = [...supplied.refusals];
          importDirToVolume({ dir: staging, volume: volumes.work });
        } finally {
          rmSync(staging, { recursive: true, force: true });
        }
      }
      const access = String(job.access || "write");
      return deepFreeze({
        workspace: { root: WORKDIR, backing: "container-volume", access },
        base_manifest,
        refusals,
        importSdk: async () => sdkFromRunnerStream(String(job.backend_id), containerSource({ run_id, job_id: String(job.job_id), access, backend_id: String(job.backend_id) })),
      });
    },

    /** Stop means removal; observed only when inspect no longer finds the container. */
    async stop(job) {
      const name = containerNameFor(String(job.job_id));
      const removed = docker.run(["rm", "-f", name]);
      const gone = !exists("container", name);
      return deepFreeze({ stopObserved: gone, detail: gone ? "container removed" : "container still present: " + removed.stderr });
    },

    /** Read-only look at a job's container after a restart. Never starts anything. */
    async recover(job) {
      const name = containerNameFor(String(job.job_id));
      const state = docker.run(["inspect", "--format", "{{json .State}}", name]);
      if (state.status !== 0) return null;
      let parsed = null;
      try {
        parsed = JSON.parse(state.stdout.trim());
      } catch {
        parsed = null;
      }
      if (parsed && parsed.Running) return deepFreeze({ running: true });
      const logs = docker.run(["logs", name]);
      const records = String(logs.stdout).split("\n").map(parseLine).filter(Boolean);
      return deepFreeze({
        running: false,
        exitCode: parsed ? parsed.ExitCode : null,
        importSdk: async () => sdkFromRunnerStream(String(job.backend_id), async function* () {
          for (const record of records) yield record;
        }),
        source: "retained container log " + name,
      });
    },

    /** Remove a job's container once its output is recorded. */
    async release(job) {
      docker.run(["rm", "-f", containerNameFor(String(job.job_id))]);
    },

    /**
     * Copy the quiesced workspace out and freeze it through the trusted loader.
     *
     * @param {{run_id:string, job_id:string, generation:string, generationsRoot:string, base_manifest:object[]}} input
     */
    async exportCandidate({ run_id, job_id, generation, generationsRoot, base_manifest }) {
      const staging = mkdtempSync(join(workRoot, "export-"));
      try {
        exportVolumeToDir({ volume: volumesFor(run_id).work, dir: staging });
        return importTrustedCandidate({ sourceRoot: staging, generationsRoot, generation, job_id, base_manifest }).candidate;
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    },

    /**
     * An executor for `runCheck` that runs each check in its own checker container
     * against a read-only copy of the frozen candidate.
     *
     * @param {{run_id:string, candidate:{root:string, candidate_id:string, generation:string}}} input
     */
    checkExecutor({ run_id, candidate }) {
      const candidateVolume = "era-v2-" + run_id + "-cand-" + candidate.generation;
      const outVolume = "era-v2-" + run_id + "-out-" + candidate.generation;
      if (!exists("volume", candidateVolume)) {
        docker.run(["volume", "create", candidateVolume]);
        const staging = mkdtempSync(join(workRoot, "candidate-"));
        try {
          cpSync(candidate.root, staging, { recursive: true });
          importDirToVolume({ dir: staging, volume: candidateVolume });
        } finally {
          rmSync(staging, { recursive: true, force: true });
        }
      }
      if (!exists("volume", outVolume)) {
        docker.run(["volume", "create", outVolume]);
        const owned = docker.run(["run", "--rm", "--network", "none", "--user", "0:0", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--mount", "type=volume,source=" + outVolume + ",target=/dst", boundary.image, "chown", WORKER_USER, "/dst"]);
        if (owned.status !== 0) throw new ContractError("could not initialize checker output volume");
      }
      let sequence = 0;
      return ({ argv, env }) => {
        sequence += 1;
        const name = "era-v2-check-" + run_id + "-" + candidate.generation + "-" + sequence;
        const result = docker.run(checkerRunArgs({ boundary, name, candidateVolume, outVolume, argv, env }), { timeout: 900_000 });
        return {
          exitCode: result.error ? null : result.status,
          signal: null,
          stdout: result.stdout,
          stderr: result.stderr,
          spawnError: result.error,
        };
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Worker image
// ---------------------------------------------------------------------------

/** Exact SDK versions installed in the worker image, read from this checkout. */
export function installedSdkVersions(repoRoot = REPO_ROOT) {
  const read = (name) => {
    try {
      return JSON.parse(readFileSync(join(repoRoot, "node_modules", ...name.split("/"), "package.json"), "utf8")).version || null;
    } catch {
      return null;
    }
  };
  return deepFreeze({
    "@anthropic-ai/claude-agent-sdk": read("@anthropic-ai/claude-agent-sdk"),
    "@openai/codex-sdk": read("@openai/codex-sdk"),
  });
}

export function workerDockerfile({ baseImage = "node:22-bookworm-slim" } = {}) {
  return [
    "FROM " + baseImage,
    "RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep bubblewrap socat iptables iproute2 ca-certificates && rm -rf /var/lib/apt/lists/*",
    "RUN groupadd -g 10001 era && useradd -u 10001 -g 10001 -d " + WORKER_HOME + " -m era",
    "WORKDIR /opt/era",
    "COPY package.json /opt/era/package.json",
    "RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force",
    "COPY scripts /opt/era/scripts",
    "RUN mkdir -p " + WORKDIR + " && chown 10001:10001 " + WORKDIR + " && ln -s /deps/node_modules /node_modules",
    "USER " + WORKER_USER,
    "",
  ].join("\n");
}

/**
 * Build the worker image from pinned versions. A setup step the owner runs; it
 * downloads packages and contacts no provider.
 *
 * @param {{tag:string, repoRoot?:string, docker?:ReturnType<typeof createDockerCli>, versions?:Record<string, (string|null)>}} input
 */
export function buildWorkerImage({ tag, repoRoot = REPO_ROOT, docker = createDockerCli(), versions = installedSdkVersions(repoRoot) }) {
  const missing = Object.entries(versions).filter(([, version]) => !isNonEmptyString(version));
  if (missing.length) throw new ContractError("cannot pin " + missing.map(([name]) => name).join(", "));
  const context = mkdtempSync(join(tmpdir(), "era-v2-worker-image-"));
  try {
    writeFileSync(
      join(context, "package.json"),
      JSON.stringify({ name: "era-delivery-v2-worker", private: true, type: "module", dependencies: versions }, null, 2),
      "utf8",
    );
    writeFileSync(join(context, "Dockerfile"), workerDockerfile(), "utf8");
    for (const dir of ["scripts/delivery", "scripts/delivery-v2", "scripts/pm/shared"]) {
      cpSync(join(repoRoot, ...dir.split("/")), join(context, ...dir.split("/")), { recursive: true });
    }
    for (const file of ["scripts/pm/mutations.mjs", "scripts/pm/lint.mjs"]) {
      cpSync(join(repoRoot, ...file.split("/")), join(context, ...file.split("/")));
    }
    const built = docker.run(["build", "-q", "-t", tag, context], { timeout: 1_800_000 });
    return deepFreeze({ ok: built.status === 0, tag, stdout: built.stdout.trim(), stderr: built.stderr.slice(0, 2000), context: normalizePath(context) });
  } finally {
    rmSync(context, { recursive: true, force: true });
  }
}
