// scripts/delivery-v2/probes/container-feasibility.mjs
// Command Center Phase 0 — bounded feasibility check for an external worker and
// checker boundary (DLV-96).
//
// Runs the UNMODIFIED F-ISOLATION battery — probes/canary.mjs as the payload,
// validateNegativeControl and classifyControls from codex-qualification.mjs as
// the judges — inside disposable Docker containers against synthetic assets.
//
// What it will not do: run a model or provider, mount the host checkout, profile
// or any credential, feed admitProfile()/describeProfile(), or treat a pass here
// as an admitted executor. The receipt answers one question: can this runtime
// satisfy the battery, and which boundaries does it leave unresolved?
//
// Four observations, each with its own control:
//   worker    hardened container, writable scratch volume.
//   checker   hardened container, frozen candidate mounted read-only.
//   (each)    the same staging run unconfined (root, writable rootfs, network),
//             which must escape — otherwise a "denied" proves nothing.
//   absence   the proposed "mount nothing from the host" shape, pointed at real
//             synthetic host files, with the host itself as negative control.
//
// Decoys: /host-private and /supervisor are baked into the image (root 0700/0600)
// to stand for a host secret and the supervisor store reaching the worker through
// a mistaken mount. The canary classifies ENOENT as inconclusive (a missing target
// is not containment), so only present-but-forbidden targets can yield "denied".

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { contentId, deepFreeze, fingerprint } from "../contracts.mjs";
import { CANARY_NAMES, runCanary } from "./canary.mjs";
import { QUALIFICATION_DIR, buildCanaryEnvironment, classifyControls, validateNegativeControl } from "./codex-qualification.mjs";

export const FEASIBILITY_SCHEMA = "delivery-v2/isolation-feasibility@1";
export const BASE_IMAGE = "node:22-bookworm-slim";
export const CANARY_IMAGE = "era-delivery-v2-canary:feasibility";
export const CANARY_IN_IMAGE = "/opt/era/probes/canary.mjs";
const WORKER_USER = "10001:10001";
const SECRET_MARKER = "ERA-CANARY-HOST-SECRET";
const CANARY_SOURCE = fileURLToPath(new URL("./canary.mjs", import.meta.url));

/** Controls DLV-96 and admitProfile() need proven before any unattended dispatch. */
export const REQUIRED_CONTROLS = Object.freeze([
  "filesystem.scratchWrite",
  "filesystem.outsideScratchWrite",
  "filesystem.hostSecretRead",
  "filesystem.linkEscape",
  "store.workerAccess",
]);

export const CANARY_DOCKERFILE = [
  `FROM ${BASE_IMAGE}`,
  `COPY canary.mjs ${CANARY_IN_IMAGE}`,
  "RUN mkdir -p /host-private/repo/.git /supervisor \\",
  ` && printf '${SECRET_MARKER}-container\\n' > /host-private/secret.txt \\`,
  " && printf 'ref: refs/heads/main\\n' > /host-private/repo/.git/HEAD \\",
  " && printf 'ERA-CANARY-STORE\\n' > /supervisor/supervisor.db \\",
  " && chmod 0700 /host-private /supervisor \\",
  " && chmod 0600 /host-private/secret.txt /supervisor/supervisor.db \\",
  ` && chmod 0444 ${CANARY_IN_IMAGE}`,
  "",
].join("\n");

/** The worker/checker boundary: non-root, read-only rootfs, no capabilities, no network. */
export function hardenedFlags() {
  return [
    "--user", WORKER_USER,
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--network", "none",
    "--pids-limit", "64",
    "--tmpfs", "/tmp:rw,size=16m",
  ];
}

/** The negative control: identical image and staging with nothing enforcing anything. */
export function unconfinedFlags() {
  return ["--user", "0:0"];
}

const DECOYS = Object.freeze({
  hostSecretPath: "/host-private/secret.txt",
  gitMutationPath: "/host-private/repo/.git/HEAD",
  storePath: "/supervisor/supervisor.db",
  secretMarker: SECRET_MARKER,
  descendantSeconds: 20,
});

/**
 * Volumes, staging and canary paths for one role. Only named volumes are mounted;
 * the canary is baked into the image, so no host path enters any container.
 *
 * @param {{run:string, role:"worker"|"checker", confined:boolean}} input
 */
export function roleLayout({ run, role, confined }) {
  const volume = (name) => `era-v2-feas-${run}-${role}-${confined ? "hardened" : "unconfined"}-${name}`;
  if (role === "worker") {
    const work = volume("work");
    return deepFreeze({
      mounts: [{ volume: work, target: "/work", readonly: false }],
      staging: [{ volume: work, target: "/work", script: "ln -sfn /host-private /work/linked-out && chown -h 10001:10001 /work/linked-out && chown 10001:10001 /work" }],
      paths: {
        ...DECOYS,
        scratchWritePath: "/work/canary-write.txt",
        outsideWritePath: "/host-private/escape.txt",
        linkSecretPath: "/work/linked-out/secret.txt",
        heartbeatPath: "/work/descendant-heartbeat.txt",
      },
      heartbeat: { volume: work, dir: "/work", path: "/work/descendant-heartbeat.txt" },
    });
  }
  const candidate = volume("candidate");
  const out = volume("out");
  return deepFreeze({
    // The checker reads a frozen candidate it cannot change, and writes only its own output.
    mounts: [
      { volume: candidate, target: "/candidate", readonly: confined },
      { volume: out, target: "/out", readonly: false },
    ],
    staging: [
      {
        volume: candidate,
        target: "/candidate",
        script: "mkdir -p /candidate/src && printf 'export const amount = 20;\\n' > /candidate/src/app.ts && ln -sfn /host-private /candidate/linked-out",
      },
      { volume: out, target: "/out", script: "chown 10001:10001 /out" },
    ],
    paths: {
      ...DECOYS,
      scratchWritePath: "/out/check-output.txt",
      outsideWritePath: "/candidate/escape.txt",
      linkSecretPath: "/candidate/linked-out/secret.txt",
      heartbeatPath: "/out/descendant-heartbeat.txt",
    },
    heartbeat: { volume: out, dir: "/out", path: "/out/descendant-heartbeat.txt" },
  });
}

const mountArgs = (mounts) =>
  mounts.flatMap((mount) => [
    "--mount",
    `type=volume,source=${mount.volume},target=${mount.target}${mount.readonly ? ",readonly" : ""}`,
  ]);

/** `docker run` argv for one canary. Every mount is a named volume. */
export function canaryRunArgs({ name, flags, mounts, paths, containerName, image = CANARY_IMAGE, canaryPath = CANARY_IN_IMAGE }) {
  const payload = Buffer.from(JSON.stringify(paths), "utf8").toString("base64");
  return ["run", "--rm", "--name", containerName, ...flags, ...mountArgs(mounts), image, "node", canaryPath, name, payload];
}

/**
 * Judge one role. Mirrors codex-qualification: the negative control must be valid,
 * every required control must be denied-and-verified, and descendant survival must
 * have been observed either way.
 */
export function roleVerdict({ negativeRecords, hardenedRecords, descendantSurvived, evidenceRef }) {
  const negativeControl = validateNegativeControl(negativeRecords);
  const controls = classifyControls(hardenedRecords, { evidenceRef, descendantSurvived });
  const failing = REQUIRED_CONTROLS.filter((id) => controls[id].state !== "supported" || !controls[id].verified);
  const descendantsObserved = controls["process.descendantsAfterStop"].verified;
  return deepFreeze({
    negativeControl,
    controls,
    failing,
    unverified: Object.entries(controls)
      .filter(([, control]) => !control.verified)
      .map(([id]) => id),
    met: negativeControl.valid && failing.length === 0 && descendantsObserved,
  });
}

// --- Docker plumbing --------------------------------------------------------

function docker(args, { input = undefined, timeout = 120_000 } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout, windowsHide: true });
  return {
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || "").slice(0, 800),
    error: result.error ? String(result.error.code || result.error.message) : null,
  };
}

function lastJsonLine(stdout) {
  const line = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("{"))
    .pop();
  try {
    return line ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

function heartbeatSize({ volume, dir, path }, image = CANARY_IMAGE) {
  const probe = `try{process.stdout.write(String(require('fs').statSync(${JSON.stringify(path)}).size))}catch{process.stdout.write('-1')}`;
  const result = docker(["run", "--rm", "--network", "none", "--mount", `type=volume,source=${volume},target=${dir},readonly`, image, "node", "-e", probe]);
  const size = Number(result.stdout.trim());
  return Number.isFinite(size) ? size : -1;
}

/** Growth of the heartbeat across a pause, read from outside the worker. */
async function heartbeatGrew(heartbeat, ms = 2500, image = CANARY_IMAGE) {
  const before = heartbeatSize(heartbeat, image);
  await pause(ms);
  const after = heartbeatSize(heartbeat, image);
  return { before, after, grew: after > before };
}

function stage(layout, image = CANARY_IMAGE) {
  for (const step of layout.staging) {
    docker(["volume", "create", step.volume]);
    const result = docker(["run", "--rm", "--user", "0:0", "--network", "none", "--mount", `type=volume,source=${step.volume},target=${step.target}`, image, "sh", "-c", step.script]);
    if (result.status !== 0) throw new Error("staging failed for " + step.volume + ": " + result.stderr);
  }
}

function removeVolumes(layout) {
  for (const mount of layout.mounts) docker(["volume", "rm", "-f", mount.volume]);
}

/**
 * Run the battery in one role/mode and observe descendant survival after the
 * container exits. `image`, `canaryPath` and `hardened` default to this probe's
 * own canary image; the worker qualification harness passes the worker image
 * (with decoys) and the exact worker flags. The battery and its judges are the same.
 */
export async function runRole({ run, role, confined, image = CANARY_IMAGE, canaryPath = CANARY_IN_IMAGE, hardened = hardenedFlags() }) {
  const layout = roleLayout({ run, role, confined });
  const flags = confined ? hardened : unconfinedFlags();
  stage(layout, image);
  const records = [];
  try {
    for (const name of CANARY_NAMES) {
      const containerName = `era-v2-feas-${run}-${role}-${confined ? "h" : "u"}-${name}`;
      const result = docker(canaryRunArgs({ name, flags, mounts: layout.mounts, paths: layout.paths, containerName, image, canaryPath }));
      const record = lastJsonLine(result.stdout);
      records.push(
        record
          ? { ...record, transport: "docker run", status: result.status }
          : { canary: name, outcome: "error", transport: "docker run", detail: "no canary record", status: result.status, stderr: result.stderr, error: result.error },
      );
    }
    // "Stop" here is the container's PID 1 exiting, which tears down its PID namespace.
    const spawn = records.find((record) => record.canary === "descendant-spawn");
    let descendantSurvived = null;
    let heartbeat = null;
    if (spawn && spawn.outcome === "denied") descendantSurvived = false;
    else if (spawn && spawn.outcome === "escaped" && spawn.heartbeatStarted) {
      heartbeat = await heartbeatGrew(layout.heartbeat, 2500, image);
      descendantSurvived = heartbeat.grew;
    }
    return { layout, flags, records, descendantSurvived, heartbeat };
  } finally {
    removeVolumes(layout);
  }
}

/**
 * Show the battery can see a surviving descendant in this runtime, and what a
 * stop must mean: ending a process inside a live container leaves its children;
 * removing the container does not.
 */
async function observeStopSemantics({ run }) {
  const layout = roleLayout({ run, role: "worker", confined: true });
  const name = `era-v2-feas-${run}-stop`;
  stage(layout);
  try {
    const started = docker(["run", "-d", "--name", name, ...hardenedFlags(), ...mountArgs(layout.mounts), CANARY_IMAGE, "sleep", "600"]);
    if (started.status !== 0) return { observed: false, detail: started.stderr };
    const payload = Buffer.from(JSON.stringify(layout.paths), "utf8").toString("base64");
    const exec = docker(["exec", name, "node", CANARY_IN_IMAGE, "descendant-spawn", payload]);
    const record = lastJsonLine(exec.stdout);
    const afterProcessExit = await heartbeatGrew(layout.heartbeat);
    docker(["rm", "-f", name]);
    const afterContainerRemoval = await heartbeatGrew(layout.heartbeat);
    return {
      observed: Boolean(record && record.heartbeatStarted),
      record,
      afterProcessExit,
      afterContainerRemoval,
      processStopLeavesDescendants: afterProcessExit.grew,
      containerRemovalStopsDescendants: !afterContainerRemoval.grew,
    };
  } finally {
    docker(["rm", "-f", name]);
    removeVolumes(layout);
  }
}

/**
 * The proposed boundary as specified — nothing from the host mounted — aimed at
 * real synthetic host files. The host run is its negative control.
 */
async function observeAbsence({ run, hostRoot }) {
  const env = buildCanaryEnvironment({ root: hostRoot });
  const hostPaths = { ...env.paths, descendantSeconds: 2 };
  const hostRecords = [];
  for (const name of CANARY_NAMES) hostRecords.push(await runCanary(name, hostPaths));
  const layout = roleLayout({ run, role: "worker", confined: true });
  stage(layout);
  const containerPaths = {
    ...hostPaths,
    scratchWritePath: "/work/canary-write.txt",
    heartbeatPath: "/work/descendant-heartbeat.txt",
  };
  const records = [];
  try {
    for (const name of CANARY_NAMES.filter((entry) => entry !== "descendant-spawn")) {
      const result = docker(
        canaryRunArgs({ name, flags: hardenedFlags(), mounts: layout.mounts, paths: containerPaths, containerName: `era-v2-feas-${run}-absent-${name}` }),
      );
      records.push(lastJsonLine(result.stdout) || { canary: name, outcome: "error", detail: result.stderr });
    }
  } finally {
    removeVolumes(layout);
  }
  return {
    hostNegativeControl: validateNegativeControl(hostRecords),
    hostLinkCreated: env.linkCreated,
    records,
    controls: classifyControls(records, { evidenceRef: "absence-observation" }),
  };
}

function runtimeFacts() {
  const version = docker(["version", "--format", "{{json .}}"]);
  let parsed = null;
  try {
    parsed = JSON.parse(version.stdout);
  } catch {
    parsed = null;
  }
  const image = docker(["image", "inspect", "--format", "{{.Id}}", CANARY_IMAGE]);
  const base = docker(["image", "inspect", "--format", "{{json .RepoDigests}}", BASE_IMAGE]);
  const node = docker(["run", "--rm", "--network", "none", CANARY_IMAGE, "node", "--version"]);
  const kernel = docker(["run", "--rm", "--network", "none", CANARY_IMAGE, "uname", "-sr"]);
  return {
    docker_client: parsed?.Client?.Version ?? null,
    docker_server: parsed?.Server?.Version ?? null,
    server_os: parsed?.Server?.Os ?? null,
    server_kernel: kernel.stdout.trim() || null,
    host_platform: process.platform + " " + process.arch,
    host_node: process.version,
    container_node: node.stdout.trim() || null,
    canary_image_id: image.stdout.trim() || null,
    base_image_digests: base.stdout.trim() || null,
    canary_sha256: fingerprint(readFileSync(CANARY_SOURCE, "utf8")),
  };
}

export const STANDING_UNRESOLVED = Object.freeze([
  "No native executor (Claude Agent SDK or Codex) ran inside the container; its credential supply, SDK install and effective controls are unobserved.",
  "Provider traffic needs an allowlisted egress path. --network none blocks all egress but surfaces ENETUNREACH, which the battery correctly records as inconclusive, so network.egress stays unverified.",
  "Absence-based isolation (host paths never mounted) yields ENOENT, which the unmodified battery classifies as inconclusive; only the present-but-forbidden decoy layer can produce denied.",
  "Qualification observations are not loaded into describeProfile()/admitProfile(); both executor profiles still refuse admission.",
  "The Docker daemon holds host authority. The supervisor must own the socket and never mount it into a worker or checker.",
  "Host checkout -> trusted snapshot -> worker volume, and candidate export -> frozen checker volume, were not exercised end to end.",
]);

export async function runFeasibility({ repoRoot = process.cwd() } = {}) {
  const run = contentId("f", { v: 1, at: new Date().toISOString(), pid: process.pid }).slice(2, 10);
  const context = mkdtempSync(join(tmpdir(), "era-v2-feasibility-image-"));
  const hostRoot = mkdtempSync(join(tmpdir(), "era-v2-feasibility-host-"));
  try {
    copyFileSync(CANARY_SOURCE, join(context, "canary.mjs"));
    writeFileSync(join(context, "Dockerfile"), CANARY_DOCKERFILE, "utf8");
    const build = docker(["build", "-q", "-t", CANARY_IMAGE, context], { timeout: 300_000 });
    if (build.status !== 0) throw new Error("image build failed: " + build.stderr);
    const runtime = runtimeFacts();

    const roles = {};
    for (const role of /** @type {const} */ (["worker", "checker"])) {
      const unconfined = await runRole({ run, role, confined: false });
      const hardened = await runRole({ run, role, confined: true });
      const evidenceRef = `feasibility:${run}:${role}`;
      roles[role] = {
        flags: hardened.flags,
        mounts: hardened.layout.mounts.map((mount) => ({ target: mount.target, readonly: mount.readonly })),
        unconfinedRecords: unconfined.records,
        hardenedRecords: hardened.records,
        descendantSurvived: hardened.descendantSurvived,
        heartbeat: hardened.heartbeat,
        verdict: roleVerdict({
          negativeRecords: unconfined.records,
          hardenedRecords: hardened.records,
          descendantSurvived: hardened.descendantSurvived,
          evidenceRef,
        }),
      };
    }
    const stopSemantics = await observeStopSemantics({ run });
    const absence = await observeAbsence({ run, hostRoot });

    const passing = roles.worker.verdict.met && roles.checker.verdict.met;
    const unresolved = [
      ...STANDING_UNRESOLVED,
      ...["worker", "checker"].flatMap((role) =>
        roles[role].verdict.failing.map((id) => `${role}: required control ${id} not proven`),
      ),
      ...(stopSemantics.processStopLeavesDescendants
        ? ["Stopping a process inside a live container leaves its descendants running; stop must mean container removal."]
        : []),
    ];
    const record = deepFreeze({
      schema: FEASIBILITY_SCHEMA,
      receipt_id: `feasibility-${run}`,
      observed_at: new Date().toISOString(),
      purpose: "Command Center Phase 0 bounded feasibility slice for DLV-96; synthetic assets only, no provider, no production, no admission change.",
      runtime,
      battery: { payload: "scripts/delivery-v2/probes/canary.mjs", judges: "validateNegativeControl + classifyControls (probes/codex-qualification.mjs)", unmodified: true, canaries: CANARY_NAMES },
      roles,
      stopSemantics,
      absence,
      verdict: {
        batteryRequiredControlsMet: passing,
        passingEnvironmentForSyntheticWorkload: passing,
        admitsAnExecutorProfile: false,
        blocksPaidDispatch: true,
        unresolved,
      },
    });
    const dir = join(repoRoot, QUALIFICATION_DIR);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, record.receipt_id + ".json");
    writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
    return { record, path };
  } finally {
    docker(["image", "rm", "-f", CANARY_IMAGE]);
    rmSync(context, { recursive: true, force: true });
    rmSync(hostRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("probes/container-feasibility.mjs")) {
  runFeasibility()
    .then(({ record, path }) => {
      const out = (line) => process.stdout.write(line + "\n");
      out("receipt: " + path);
      out("runtime: docker " + record.runtime.docker_server + " / " + record.runtime.server_kernel);
      for (const role of ["worker", "checker"]) {
        const entry = record.roles[role];
        out(`${role}: negative control ${entry.verdict.negativeControl.valid ? "valid" : "INVALID"}; required met ${entry.verdict.met}; descendantSurvived ${entry.descendantSurvived}`);
        for (const item of entry.hardenedRecords) out(`  ${String(item.canary).padEnd(18)} ${item.outcome}  ${item.detail || ""}`);
        if (entry.verdict.unverified.length) out("  unverified: " + entry.verdict.unverified.join(", "));
      }
      out(`stop: process exit leaves descendants ${record.stopSemantics.processStopLeavesDescendants}; container removal stops them ${record.stopSemantics.containerRemovalStopsDescendants}`);
      out("absence: " + record.absence.records.map((item) => `${item.canary}=${item.outcome}`).join(", "));
      out("passing environment (synthetic): " + record.verdict.passingEnvironmentForSyntheticWorkload);
    })
    .catch((error) => {
      process.stderr.write("feasibility harness failed: " + String((error && error.stack) || error) + "\n");
      process.exitCode = 1;
    });
}
