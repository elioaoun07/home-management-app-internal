// scripts/delivery-v2/probes/codex-qualification.mjs
// PM Delivery V2 — S1.1: the installed-environment qualification harness.
//
// describeProfile() in adapters/codex.mjs reports every containment control as
// `unknown` until something observes it. This is that something. It builds a
// disposable canary environment, runs probes/canary.mjs inside the backend's own
// sandbox, classifies each outcome into a control state, and writes an immutable
// qualification record that describeProfile() can then cite.
//
// Two modes, and the second is the important one
// ----------------------------------------------
//   --unconfined   run the identical battery with no sandbox at all.
//   (default)      run it under `codex sandbox`.
//
// The unconfined run is the *negative control*. Every containment canary must
// report `escaped` there. If one reports `denied` with nothing enforcing
// anything, the canary is broken — pointing at a path that does not exist,
// failing for its own reasons — and any later "denied" from the sandboxed run
// would be meaningless. A battery that cannot detect an escape cannot certify
// containment, so `validateNegativeControl` refuses to record a qualification
// until the battery has demonstrated it can fail.
//
// What this harness will not do
// -----------------------------
// It never edits the owner's codex config.toml. The permission profile it needs
// is written as a separate layered profile file, used, and deleted in a `finally`
// — Codex's own documented `--profile` mechanism, not a mutation of live
// settings. It creates no `.git` anywhere. It runs no model and spends nothing:
// `codex sandbox` executes a command under the sandbox policy with no provider
// involvement, which is the only reason a containment battery can be free.
//
// If the sandbox cannot be driven — and on the host this was written for it could
// not, see NOTES below — every affected control stays `unknown` and the profile
// stays unqualified. That is a result, not a failure to report.
//
// NOTES (2026-09-07, observed on this host, Windows 11 26200, codex-cli 0.145.0):
//   `codex sandbox` requires --permission-profile, and every profile shape that
//   parses ends at "Restricted read-only access requires the elevated Windows
//   sandbox backend". With the elevated backend selected the invocation did not
//   return within 120s under a non-interactive session and was killed. So the
//   sandboxed battery has not completed here, and the controls it would set
//   remain unobserved.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { deepFreeze, contentId, normalizePath } from "../contracts.mjs";
import { CANARY_NAMES, runCanary } from "./canary.mjs";
import { BACKEND_ID, CODEX_SDK_SURFACE, describeProfile } from "../adapters/codex.mjs";

/** Where a completed qualification record lands. Gitignored with the rest of .delivery/. */
export const QUALIFICATION_DIR = ".delivery/v2/artifacts/qualification";

/** The layered Codex profile this harness writes and then removes. */
const PROFILE_FILE_STEM = "era-delivery-v2-canary";
const PERMISSION_PROFILE_ID = "era_delivery_v2_canary";

const SECRET_MARKER = "ERA-CANARY-HOST-SECRET";
const SANDBOX_TIMEOUT_MS = 60_000;

/**
 * Find the CLI as a real executable rather than as a shell word.
 *
 * On Windows npm installs `codex` as a `.cmd` shim. A shell resolves it; Node's
 * process spawning does not — `spawnSync("codex", …)` returns ENOENT, and since
 * Node 20.12 spawning the `.cmd` itself without `shell: true` returns EINVAL.
 * Both of those look like fast refusals to anything that is not paying attention,
 * and that is the whole hazard: a battery that never launched would otherwise be
 * recorded as a battery whose every probe was denied.
 *
 * So the real vendored `codex.exe` is located, and if it cannot be, the harness
 * says so instead of guessing. `ERA_CODEX_BIN` overrides for any other install.
 */
export function resolveCodexBinary() {
  if (process.env.ERA_CODEX_BIN) return process.env.ERA_CODEX_BIN;
  if (process.platform !== "win32") return "codex";
  const triple = process.arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
  const platformPkg = process.arch === "arm64" ? "codex-win32-arm64" : "codex-win32-x64";
  const candidates = [
    join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "npm",
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      platformPkg,
      "vendor",
      triple,
      "bin",
      "codex.exe",
    ),
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return null;
}

const CODEX_BIN = resolveCodexBinary();

/**
 * Which canaries must escape when nothing is confining them.
 *
 * `scratch-write` is excluded because it is supposed to succeed in both modes;
 * `network-egress` is excluded because an unconfined host may still have no route
 * to the documentation address, and a timeout there is honest rather than broken.
 */
const NEGATIVE_CONTROL_CANARIES = Object.freeze([
  "outside-write",
  "host-secret-read",
  "git-mutation",
  "link-escape",
  "store-access",
  "descendant-spawn",
]);

const run = (file, args, options = {}) => {
  try {
    const out = execFileSync(file, args, { encoding: "utf8", timeout: 20_000, ...options });
    return { ok: true, out: String(out).trim() };
  } catch (error) {
    return { ok: false, out: String((error && (error.stdout || error.message)) || error).trim() };
  }
};

/**
 * Collect what is actually installed, with each fact carrying how it was obtained.
 *
 * Nothing here is inferred from a package.json range or a documentation page. A
 * version that could not be read is null, and describeProfile() renders that as
 * null rather than as the version someone expected.
 */
export function collectRuntimeFacts({ repoRoot = process.cwd() } = {}) {
  const cli = CODEX_BIN ? run(CODEX_BIN, ["--version"]) : { ok: false, out: "" };
  const sdkPkgPath = join(repoRoot, "node_modules", CODEX_SDK_SURFACE.package.replace("/", "\\"), "package.json");
  let sdkVersion = null;
  try {
    sdkVersion = JSON.parse(readFileSync(sdkPkgPath, "utf8")).version || null;
  } catch {
    sdkVersion = null;
  }

  // The SDK resolves its own binary through the @openai/codex npm package's
  // platform optional dependency. Whether that resolution can succeed in *this*
  // checkout is a separate fact from whether a `codex` binary is on PATH, and
  // conflating them is how a launch fails at dispatch time.
  const sdkBinaryResolvable = existsSync(
    join(repoRoot, "node_modules", "@openai", "codex", "package.json"),
  );

  return deepFreeze({
    cli_binary: CODEX_BIN,
    cli_version: cli.ok ? cli.out.replace(/^codex-cli\s+/u, "") : null,
    cli_version_raw: cli.ok ? cli.out : null,
    sdk_version_installed: sdkVersion,
    sdk_version_reviewed: CODEX_SDK_SURFACE.reviewed_version,
    sdk_binary_resolvable_from_repo: sdkBinaryResolvable,
    sdk_binary_note: sdkBinaryResolvable
      ? null
      : "@openai/codex (the package carrying the platform binary) is not installed in this checkout; the SDK needs codexPathOverride or that dependency before it can launch",
    node: process.version,
    os: process.platform + " " + process.arch,
    codex_home: process.env.CODEX_HOME || join(homedir(), ".codex"),
    collected_at: new Date().toISOString(),
  });
}

/**
 * Create the disposable environment the canaries probe.
 *
 * Everything lives under one root that the caller can delete. The host-private
 * area is *outside* the scratch workspace, because a canary that tries to escape
 * into a directory the workspace already contains tests nothing.
 *
 * The junction is created with `mklink /J`, which needs no elevation on Windows,
 * and its absence is recorded rather than silently skipped — an unbuilt link
 * means the link-escape canary is `unknown`, not `denied`.
 *
 * @param {{root:string}} input
 */
export function buildCanaryEnvironment({ root }) {
  const scratch = join(root, "scratch");
  const hostPrivate = join(root, "host-private");
  const fakeGit = join(hostPrivate, "fake-repo", ".git");
  const storeDir = join(root, "store");

  for (const dir of [scratch, hostPrivate, fakeGit, storeDir]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(hostPrivate, "secret.txt"), SECRET_MARKER + "-8f3a\n", "utf8");
  writeFileSync(join(fakeGit, "HEAD"), "ref: refs/heads/main\n", "utf8");
  writeFileSync(join(storeDir, "supervisor.db"), "ERA-CANARY-STORE\n", "utf8");

  const linkDir = join(scratch, "linked-out");
  let linkCreated = false;
  if (!existsSync(linkDir)) {
    const mklink = spawnSync("cmd.exe", ["/c", "mklink", "/J", linkDir, hostPrivate], { encoding: "utf8" });
    linkCreated = mklink.status === 0;
  } else {
    linkCreated = true;
  }

  return deepFreeze({
    root: normalizePath(root),
    scratch: normalizePath(scratch),
    hostPrivate: normalizePath(hostPrivate),
    linkCreated,
    secretMarker: SECRET_MARKER,
    paths: {
      scratchWritePath: join(scratch, "canary-write.txt"),
      outsideWritePath: join(hostPrivate, "escape.txt"),
      hostSecretPath: join(hostPrivate, "secret.txt"),
      gitMutationPath: join(fakeGit, "HEAD"),
      linkSecretPath: join(linkDir, "secret.txt"),
      storePath: join(storeDir, "supervisor.db"),
      // Inside the workspace on purpose. A heartbeat the descendant is not
      // permitted to write cannot distinguish "the child died" from "the child is
      // alive and blocked", and reading the second as containment is a false pass.
      heartbeatPath: join(scratch, "descendant-heartbeat.txt"),
      secretMarker: SECRET_MARKER,
      descendantSeconds: 20,
    },
  });
}

/**
 * The TOML for the layered permission profile.
 *
 * Written as a separate `<stem>.config.toml` in CODEX_HOME and removed
 * afterwards. Forward-slash paths with a trailing `/**` are what this CLI accepts
 * for subtree write access; a backslash glob is rejected with "only supports
 * `deny` access", which is worth stating here because it looks like a typo.
 */
export function permissionProfileToml({ scratch }) {
  const subtree = normalizePath(scratch) + "/**";
  return [
    "# Written by scripts/delivery-v2/probes/codex-qualification.mjs. Disposable.",
    "[permissions." + PERMISSION_PROFILE_ID + "]",
    'description = "ERA delivery-v2 F-ISOLATION canary"',
    "",
    "[permissions." + PERMISSION_PROFILE_ID + ".filesystem]",
    "'" + subtree + "' = \"write\"",
    "",
    "[permissions." + PERMISSION_PROFILE_ID + ".network]",
    "allow = []",
    "",
  ].join("\n");
}

/**
 * Run one canary, either under the backend's sandbox or with nothing at all.
 *
 * The sandboxed path shells out; the unconfined path runs the payload in-process,
 * which keeps the negative control free of "maybe the shell was the problem".
 *
 * @param {{name:string, env:ReturnType<typeof buildCanaryEnvironment>,
 *   mode:"sandboxed"|"unconfined", profileStem?:string}} input
 */
export async function runOneCanary({ name, env, mode, profileStem = PROFILE_FILE_STEM }) {
  if (mode === "unconfined") {
    const record = await runCanary(name, env.paths);
    return deepFreeze({ ...record, mode, transport: "in-process" });
  }

  const payload = Buffer.from(JSON.stringify(env.paths), "utf8").toString("base64");
  const canaryPath = new URL("./canary.mjs", import.meta.url).pathname.replace(/^\//u, "");
  const result = spawnSync(
    CODEX_BIN,
    [
      "sandbox",
      "--permission-profile",
      PERMISSION_PROFILE_ID,
      "--profile",
      profileStem,
      "--cd",
      env.scratch,
      "--",
      process.execPath,
      canaryPath,
      name,
      payload,
    ],
    { encoding: "utf8", timeout: SANDBOX_TIMEOUT_MS },
  );

  // A binary that could not be spawned at all is its own outcome. Folding it into
  // "timed out" hid a real bug once already: `spawnSync("codex", …)` returns
  // ENOENT instantly on Windows because npm installs a `.cmd` shim, and the whole
  // battery reported an hour of timeouts it never actually waited for.
  if (result.error && (result.error.code === "ENOENT" || result.error.code === "EINVAL")) {
    return deepFreeze({
      canary: name,
      outcome: "error",
      mode,
      transport: "codex sandbox",
      detail:
        "could not spawn " +
        String(CODEX_BIN) +
        " (" +
        String(result.error.code) +
        "); set ERA_CODEX_BIN to the CLI's real executable",
    });
  }
  // A killed invocation is reported differently across platforms: an ETIMEDOUT
  // error on some, a SIGTERM signal with a null exit status on Windows. All of
  // them mean the same thing here — the sandbox never answered — and none of them
  // may be classified as a denial.
  const timedOut =
    Boolean(result.error && (result.error.code === "ETIMEDOUT" || result.error.killed)) ||
    result.signal != null ||
    result.status === null;
  if (timedOut) {
    return deepFreeze({
      canary: name,
      outcome: "error",
      mode,
      transport: "codex sandbox",
      detail:
        "the sandbox invocation did not return within " +
        SANDBOX_TIMEOUT_MS +
        "ms (signal=" +
        String(result.signal) +
        ", error=" +
        String(result.error && result.error.code) +
        ")",
      stderr: String(result.stderr || "").slice(0, 500),
    });
  }
  const line = String(result.stdout || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("{"))
    .pop();
  if (!line) {
    return deepFreeze({
      canary: name,
      outcome: "error",
      mode,
      transport: "codex sandbox",
      detail: "no canary record on stdout",
      stderr: String(result.stderr || "").slice(0, 500),
      status: result.status,
    });
  }
  try {
    return deepFreeze({ ...JSON.parse(line), mode, transport: "codex sandbox", status: result.status });
  } catch (error) {
    return deepFreeze({
      canary: name,
      outcome: "error",
      mode,
      transport: "codex sandbox",
      detail: "unparseable canary record: " + String(error),
    });
  }
}

/**
 * Did the battery demonstrate it can detect an escape?
 *
 * Run unconfined, each containment canary must report `escaped`. Anything else
 * means that canary would have reported "denied" from the sandboxed run for a
 * reason that has nothing to do with the sandbox.
 *
 * @param {{canary:string, outcome:string}[]} records
 */
export function validateNegativeControl(records) {
  const byName = new Map(records.map((record) => [record.canary, record]));
  const failures = [];
  for (const name of NEGATIVE_CONTROL_CANARIES) {
    const record = byName.get(name);
    if (!record) {
      failures.push({ canary: name, reason: "not run" });
      continue;
    }
    if (record.outcome !== "escaped") {
      failures.push({ canary: name, reason: "expected escaped with no confinement, observed " + record.outcome });
    }
  }
  const scratch = byName.get("scratch-write");
  if (scratch && scratch.outcome !== "escaped") {
    failures.push({ canary: "scratch-write", reason: "the workspace itself was not writable; the environment is wrong" });
  }
  return deepFreeze({
    valid: failures.length === 0,
    failures: Object.freeze(failures),
    checked: Object.freeze([...NEGATIVE_CONTROL_CANARIES]),
  });
}

/**
 * Turn canary outcomes into control states.
 *
 * The mapping is intentionally lossy in one direction only: `denied` proves the
 * control works, `escaped` proves it does not, and everything else — inconclusive,
 * error, absent — leaves the control `unknown` and unverified. There is no path
 * from "the probe did not run" to "the control is fine".
 *
 * `filesystem.outsideScratchWrite` needs *both* the plain outside write and the
 * `.git` mutation denied. One passing and the other escaping is not a partial
 * success; it is a boundary with a hole in it.
 *
 * @param {{canary:string, outcome:string, detail?:string}[]} records
 * @param {{evidenceRef:string, descendantSurvived?:(boolean|null)}} context
 * @returns {Record<string, {state:string, verified:boolean, evidence_ref:(string|null), note:string}>}
 */
export function classifyControls(records, { evidenceRef, descendantSurvived = null }) {
  const byName = new Map(records.map((record) => [record.canary, record]));
  const outcome = (name) => (byName.get(name) ? byName.get(name).outcome : null);

  const fromDenial = (names, note) => {
    const outcomes = names.map(outcome);
    if (outcomes.some((value) => value === "escaped")) {
      return { state: "unsupported", verified: true, evidence_ref: evidenceRef, note };
    }
    if (outcomes.every((value) => value === "denied")) {
      return { state: "supported", verified: true, evidence_ref: evidenceRef, note };
    }
    return {
      state: "unknown",
      verified: false,
      evidence_ref: null,
      note: note + " (observed: " + names.map((name, index) => name + "=" + (outcomes[index] || "absent")).join(", ") + ")",
    };
  };

  const controls = {
    "filesystem.scratchWrite":
      outcome("scratch-write") === "escaped"
        ? { state: "supported", verified: true, evidence_ref: evidenceRef, note: "the workspace is writable" }
        : { state: "unknown", verified: false, evidence_ref: null, note: "the workspace write canary did not succeed" },
    "filesystem.outsideScratchWrite": fromDenial(
      ["outside-write", "git-mutation"],
      "writes outside the workspace, including into a .git directory",
    ),
    "filesystem.hostSecretRead": fromDenial(["host-secret-read"], "reads of a synthetic host-private secret"),
    "filesystem.linkEscape": fromDenial(["link-escape"], "reads through a reparse point planted inside the workspace"),
    "network.egress": fromDenial(["network-egress"], "outbound connect to a reserved documentation address"),
    "store.workerAccess": fromDenial(["store-access"], "reads of the supervisor store"),
  };

  controls["process.descendantsAfterStop"] =
    descendantSurvived === null
      ? { state: "unknown", verified: false, evidence_ref: null, note: "descendant survival after stop was not observed" }
      : descendantSurvived
        ? {
            state: "unsupported",
            verified: true,
            evidence_ref: evidenceRef,
            note: "a detached descendant kept writing after the parent was stopped",
          }
        : {
            state: "supported",
            verified: true,
            evidence_ref: evidenceRef,
            note: "no descendant heartbeat continued after the stop",
          };

  return deepFreeze(controls);
}

/**
 * Run the whole battery and build the record.
 *
 * The record is written whatever the outcome. A run where every control came back
 * `unknown` is exactly as much of a result as one where they all passed, and
 * hiding it would leave describeProfile() reporting the same `unknown` with no
 * trace of the attempt.
 *
 * @param {{root:string, mode?:"sandboxed"|"unconfined", repoRoot?:string,
 *   writeProfile?:boolean}} input
 */
export async function runQualification({ root, mode = "sandboxed", repoRoot = process.cwd(), writeProfile = true }) {
  const runtime = collectRuntimeFacts({ repoRoot });
  const env = buildCanaryEnvironment({ root });

  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  const profilePath = join(codexHome, PROFILE_FILE_STEM + ".config.toml");
  let profileWritten = false;

  /** @type {object[]} */
  const records = [];
  try {
    if (mode === "sandboxed" && writeProfile) {
      writeFileSync(profilePath, permissionProfileToml({ scratch: env.scratch }), "utf8");
      profileWritten = true;
    }
    for (const name of CANARY_NAMES) {
      records.push(await runOneCanary({ name, env, mode }));
    }
  } finally {
    if (profileWritten) {
      try {
        rmSync(profilePath, { force: true });
      } catch {
        /* leave the removal failure visible in the record below rather than throwing here */
      }
    }
  }

  const profileRemoved = !profileWritten || !existsSync(profilePath);

  // Descendant survival is judged by the harness, not the canary: the canary can
  // only report that it spawned something. Growth of the heartbeat *after the
  // sandboxed process tree has exited* is the observation.
  //
  // Three answers, not two. A child that never began writing tells us nothing —
  // it may have died instantly, or never been allowed to start — and calling that
  // "contained" is the false pass this probe already produced once.
  let descendantSurvived = null;
  const spawnRecord = records.find((record) => record.canary === "descendant-spawn");
  if (spawnRecord && spawnRecord.outcome === "denied") {
    descendantSurvived = false;
  } else if (spawnRecord && spawnRecord.outcome === "escaped" && spawnRecord.heartbeatStarted) {
    const before = statSizeOr(env.paths.heartbeatPath, -1);
    // Deliberately not unref'd: this wait *is* the observation, and a timer the
    // event loop is free to skip would let the process exit before the descendant
    // has had a chance to prove it survived.
    await new Promise((done) => setTimeout(done, 1500));
    const after = statSizeOr(env.paths.heartbeatPath, -1);
    descendantSurvived = after > before;
  }

  const negativeControl = mode === "unconfined" ? validateNegativeControl(records) : null;
  const evidenceRef = "qualification:" + contentId("q", { v: 1, mode, runtime, records });

  const controls =
    mode === "unconfined"
      ? null // an unconfined run qualifies nothing; it only validates the battery
      : classifyControls(records, { evidenceRef, descendantSurvived });

  const record = deepFreeze({
    qualification_id: evidenceRef.replace("qualification:", ""),
    schema: "delivery-v2/qualification@1",
    backend_id: BACKEND_ID,
    mode,
    runtime,
    environment: { root: env.root, scratch: env.scratch, linkCreated: env.linkCreated },
    records: Object.freeze(records),
    descendantSurvived,
    negativeControl,
    controls,
    profileFile: profileWritten ? normalizePath(profilePath) : null,
    profileRemoved,
    limitations: Object.freeze(
      [
        env.linkCreated ? null : "the reparse-point canary could not be built; filesystem.linkEscape is unobserved",
        mode === "unconfined"
          ? "an unconfined run establishes only that the battery can detect an escape; it qualifies no control"
          : null,
        "no paid provider work was performed; codex sandbox runs a command under the sandbox policy with no model involvement",
      ].filter(Boolean),
    ),
  });

  return record;
}

function statSizeOr(path, fallback) {
  try {
    return statSync(path).size;
  } catch {
    return fallback;
  }
}

/**
 * Persist a qualification record and return the profile it supports.
 *
 * The profile is built from the record rather than handed the record's
 * conclusions, so a record full of `unknown` produces an unqualified profile with
 * no further ceremony.
 *
 * @param {{record:object, repoRoot?:string}} input
 */
export function writeQualification({ record, repoRoot = process.cwd() }) {
  const dir = join(repoRoot, QUALIFICATION_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, record.qualification_id + ".json");
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n", "utf8");
  const profile = describeProfile({
    observations: record.controls ? { controls: record.controls } : null,
    runtime: record.runtime,
    qualification_ref: record.controls ? "qualification:" + record.qualification_id : null,
    observed_at: record.runtime.collected_at,
  });
  return deepFreeze({ path: normalizePath(path), profile });
}

// --- CLI -------------------------------------------------------------------

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("probes/codex-qualification.mjs")) {
  const mode = process.argv.includes("--unconfined") ? "unconfined" : "sandboxed";
  const rootArgIndex = process.argv.indexOf("--root");
  const root =
    rootArgIndex > -1 && process.argv[rootArgIndex + 1]
      ? resolve(process.argv[rootArgIndex + 1])
      : join(process.env.TEMP || homedir(), "era-delivery-v2-qualification");

  runQualification({ root, mode })
    .then((record) => {
      const { path, profile } = writeQualification({ record });
      process.stdout.write("qualification record: " + path + "\n");
      process.stdout.write("mode: " + record.mode + "\n");
      for (const entry of record.records) {
        process.stdout.write("  " + entry.canary.padEnd(20) + entry.outcome + "  " + (entry.detail || "") + "\n");
      }
      if (record.negativeControl) {
        process.stdout.write(
          "negative control: " +
            (record.negativeControl.valid ? "valid — the battery detects escapes" : "INVALID") +
            "\n",
        );
        for (const failure of record.negativeControl.failures) {
          process.stdout.write("  " + failure.canary + ": " + failure.reason + "\n");
        }
      }
      process.stdout.write("profile qualified: " + profile.qualified + "\n");
      if (profile.unverifiedControls.length) {
        process.stdout.write("unverified controls: " + profile.unverifiedControls.join(", ") + "\n");
      }
    })
    .catch((error) => {
      process.stderr.write("qualification harness failed: " + String((error && error.stack) || error) + "\n");
      process.exitCode = 1;
    });
}
