// scripts/delivery-v2/probes/worker-qualification.mjs
// Command Center Phase 3 — qualify one executor's worker boundary (DLV-96).
//
// Runs the UNMODIFIED battery (canary.mjs payload; validateNegativeControl and
// classifyControls as judges, through container-feasibility's runRole) inside the
// executor's own worker image, under the exact worker and checker flags the
// runtime uses, and writes a receipt bound to:
//
//   backend_id       the executor the image carries
//   sdk_version      that SDK's version as installed IN the image
//   boundary_digest  the boundary configuration plus the exact image id
//   battery_digest   the canary shipped in the image
//
// Decoys (a host-private secret, a .git directory, a supervisor store) are added
// as a thin root-owned layer on top of the worker image, present but forbidden,
// because an absent target only proves absence. No model, provider or credential
// is involved; nothing here admits a profile — the loader and admitProfile() do.
//
//   node scripts/delivery-v2/probes/worker-qualification.mjs --image <tag> --backend <claude-agent-sdk|codex-exec-sdk>

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { contentId, deepFreeze } from "../contracts.mjs";
import { BACKEND_IDS } from "../adapters/registry.mjs";
import { makeQualificationReceipt, writeQualificationReceipt } from "../qualification.mjs";
import {
  CANARY_PATH,
  RUNNER_PATH,
  WORKER_USER,
  boundaryBindingDigest,
  readEgressBinding,
  hardenedFlags as workerFlags,
  makeBoundaryConfig,
} from "../worker-boundary.mjs";
import { roleVerdict, runRole } from "./container-feasibility.mjs";

const SECRET_MARKER = "ERA-CANARY-HOST-SECRET";

/** The decoy layer. Same decoys as the feasibility image, over the worker image. */
export function batteryDockerfile(image) {
  return [
    "FROM " + image,
    "USER 0:0",
    "RUN mkdir -p /host-private/repo/.git /supervisor \\",
    ` && printf '${SECRET_MARKER}-container\\n' > /host-private/secret.txt \\`,
    " && printf 'ref: refs/heads/main\\n' > /host-private/repo/.git/HEAD \\",
    " && printf 'ERA-CANARY-STORE\\n' > /supervisor/supervisor.db \\",
    " && chmod 0700 /host-private /supervisor \\",
    " && chmod 0600 /host-private/secret.txt /supervisor/supervisor.db",
    "USER " + WORKER_USER,
    "",
  ].join("\n");
}

function spawnDocker(args, { timeout = 600_000 } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout, windowsHide: true });
  return { status: result.status, stdout: String(result.stdout || ""), stderr: String(result.stderr || "").slice(0, 800) };
}

/**
 * The binding a receipt for this image would carry, or the reason there is none.
 *
 * @param {{boundary:ReturnType<typeof makeBoundaryConfig>, backend_id:string, docker?:Function}} input
 */
export function readImageBinding({ boundary, backend_id, docker = spawnDocker }) {
  const image = docker(["image", "inspect", "--format", "{{.Id}}", boundary.image]);
  if (image.status !== 0) return { binding: null, reason: "worker image " + boundary.image + " is not built" };
  const probe = docker(["run", "--rm", "--network", "none", "--user", WORKER_USER, "--read-only", boundary.image, "node", RUNNER_PATH, "--probe"]);
  const facts = String(probe.stdout)
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .pop();
  const sdk_version = facts && facts.sdk ? facts.sdk[backend_id] : null;
  if (!sdk_version) return { binding: null, reason: "the worker image does not carry " + backend_id };
  if (!facts.battery_digest) return { binding: null, reason: "the worker image does not carry the canary battery" };
  let egressId;
  try { egressId = readEgressBinding(boundary, docker); } catch (error) { return { binding: null, reason: error.message }; }
  return {
    binding: {
      backend_id,
      sdk_version,
      boundary_digest: boundaryBindingDigest(boundary, image.stdout.trim(), egressId),
      battery_digest: facts.battery_digest,
    },
    reason: null,
  };
}

/** Assemble the receipt from the two role verdicts. The worker's controls are the executor's. */
export function assembleReceipt({ backend_id, binding, worker, checker, run, observed_at }) {
  return makeQualificationReceipt({
    backend_id,
    binding,
    controls: worker.controls,
    negativeControl: worker.negativeControl,
    harness: { name: "worker-qualification", run },
    observed_at,
    notes: [
      "checker required controls " + (checker.met ? "met" : "not met: " + checker.failing.join(", ")),
      worker.unverified.length ? "unverified: " + worker.unverified.join(", ") : "every battery control observed",
    ],
  });
}

/**
 * @param {{repoRoot?:string, boundary:ReturnType<typeof makeBoundaryConfig>, backend_id:string}} input
 */
export async function runWorkerQualification({ repoRoot = process.cwd(), boundary, backend_id }) {
  if (!BACKEND_IDS.includes(backend_id)) throw new Error("unknown executor " + backend_id);
  const { binding, reason } = readImageBinding({ boundary, backend_id });
  if (!binding) throw new Error(reason);
  const run = contentId("wq", { v: 1, at: new Date().toISOString(), pid: process.pid, backend_id }).slice(3, 11);
  const batteryImage = "era-delivery-v2-battery:" + run;
  const baseTag = "era-delivery-v2-battery-base:" + run;
  const context = mkdtempSync(join(tmpdir(), "era-v2-battery-"));
  try {
    // BuildKit interprets a bare sha256 image ID as a registry name in FROM.
    // Give the already-pinned local image a temporary tag for this decoy layer.
    const tagged = spawnDocker(["tag", boundary.image, baseTag]);
    if (tagged.status !== 0) throw new Error("could not tag the pinned battery base: " + tagged.stderr);
    writeFileSync(join(context, "Dockerfile"), batteryDockerfile(baseTag), "utf8");
    const built = spawnDocker(["build", "-q", "-t", batteryImage, context], { timeout: 900_000 });
    if (built.status !== 0) throw new Error("battery image build failed: " + built.stderr);
    const verdicts = {};
    for (const role of /** @type {const} */ (["worker", "checker"])) {
      const unconfined = await runRole({ run, role, confined: false, image: batteryImage, canaryPath: CANARY_PATH });
      const hardened = await runRole({
        run,
        role,
        confined: true,
        image: batteryImage,
        canaryPath: CANARY_PATH,
        hardened: role === "worker" ? workerFlags(boundary) : workerFlags(boundary, { network: false }),
      });
      verdicts[role] = {
        ...roleVerdict({
          negativeRecords: unconfined.records,
          hardenedRecords: hardened.records,
          descendantSurvived: hardened.descendantSurvived,
          evidenceRef: `worker-qualification:${run}:${role}`,
        }),
        records: hardened.records,
      };
    }
    const receipt = assembleReceipt({ backend_id, binding, worker: verdicts.worker, checker: verdicts.checker, run, observed_at: new Date().toISOString() });
    const path = writeQualificationReceipt({ root: repoRoot, receipt });
    return deepFreeze({ receipt, path, verdicts });
  } finally {
    spawnDocker(["image", "rm", "-f", batteryImage]);
    spawnDocker(["image", "rm", baseTag]);
    rmSync(context, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("probes/worker-qualification.mjs")) {
  const arg = (flag) => {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : null;
  };
  const boundary = makeBoundaryConfig(arg("--boundary") ? JSON.parse(readFileSync(arg("--boundary"), "utf8")) : { image: String(arg("--image") || ""), network: { mode: "none" } });
  runWorkerQualification({ boundary, backend_id: String(arg("--backend") || "") })
    .then(({ receipt, path, verdicts }) => {
      const out = (line) => process.stdout.write(line + "\n");
      out("receipt: " + path);
      out("binding: " + JSON.stringify(receipt.binding));
      for (const role of ["worker", "checker"]) {
        out(role + ": negative control " + (verdicts[role].negativeControl.valid ? "valid" : "INVALID") + "; required met " + verdicts[role].met);
        for (const item of verdicts[role].records) out("  " + String(item.canary).padEnd(18) + " " + item.outcome + "  " + (item.detail || ""));
      }
      out("unverified: " + (Object.entries(receipt.controls).filter(([, control]) => !control.verified).map(([id]) => id).join(", ") || "none"));
    })
    .catch((error) => {
      process.stderr.write("worker qualification failed: " + String((error && error.message) || error) + "\n");
      process.exitCode = 1;
    });
}
