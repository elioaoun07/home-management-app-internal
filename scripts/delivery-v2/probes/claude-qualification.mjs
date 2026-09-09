// scripts/delivery-v2/probes/claude-qualification.mjs
// PM Delivery V2 — the Claude backend's own qualification harness.
//
// Its counterpart, probes/codex-qualification.mjs, can run the containment
// battery for free because `codex sandbox` executes a command under the sandbox
// policy with no model involvement. This backend has no equivalent: the Claude
// Agent SDK's confinement is a property of a running *query*, and a query is a
// paid dispatch. So this harness deliberately does less, and says so.
//
// What it does
// ------------
//   - Collects the installed runtime facts, each carrying how it was obtained.
//   - Reads the SDK's own type surface to confirm the interface findings the
//     adapter pins (a caller-minted sessionId, a total_cost_usd on the result, no
//     monetary ceiling option, a platform-gated sandbox setting).
//   - Writes an immutable record with `controls: null` and an explicit statement
//     of what remains unobserved and what observing it would cost.
//
// What it does not do, and why that is the point
// ----------------------------------------------
// It does not mark a single containment control. Every one of them stays
// `unknown`, so `finalizeProfile()` leaves the profile unqualified and
// `admitProfile()` refuses it — the same refusal Codex gets, reached
// independently. Context §2's documentation finding that this SDK's Bash sandbox
// covers macOS/Linux/WSL2 and not native Windows is recorded here as a
// *documentation finding*, exactly as that section labels it, and is never
// promoted to an observation. A dated doc claim is a hypothesis; Hard Rule #27's
// lesson generalizes past RLS.
//
// The one thing this harness must never become is a way to qualify a profile
// without observing it. If a real containment run becomes possible — an
// equivalent free sandbox entry point, or a separately authorized paid
// qualification dispatch — it belongs here as a mode alongside this one, using
// the same canary battery in probes/canary.mjs.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { contentId, deepFreeze, normalizePath } from "../contracts.mjs";
import { BACKEND_ID, CLAUDE_SDK_SURFACE, describeProfile } from "../adapters/claude.mjs";

/** Where a completed qualification record lands. Gitignored with the rest of .delivery/. */
export const QUALIFICATION_DIR = ".delivery/v2/artifacts/qualification";

/** Controls this harness cannot observe, with what each would take. */
export const UNOBSERVABLE_CONTROLS = deepFreeze({
  "filesystem.scratchWrite": "a dispatched job writing inside its workspace",
  "filesystem.outsideScratchWrite": "a dispatched job attempting a write outside its workspace",
  "filesystem.hostSecretRead": "a dispatched job attempting to read a synthetic host-private secret",
  "filesystem.linkEscape": "a dispatched job following a reparse point planted inside its workspace",
  "network.egress": "a dispatched job attempting an outbound connection",
  "process.descendantsAfterStop": "a dispatched job spawning a detached descendant, then a stop",
  "store.workerAccess": "a dispatched job attempting to read the supervisor store",
});

const run = (file, args) => {
  try {
    return { ok: true, out: String(execFileSync(file, args, { encoding: "utf8", timeout: 20_000 })).trim() };
  } catch (error) {
    return { ok: false, out: String((error && (error.stdout || error.message)) || error).trim() };
  }
};

/**
 * Read the installed SDK's type surface and check the adapter's pinned findings
 * against it.
 *
 * This is the only thing here that is genuinely an observation rather than a
 * report: the .d.ts on disk either contains `total_cost_usd` and `sessionId` or
 * it does not. A drifted surface is worth catching at qualification time, because
 * the adapter's refusals — no monetary ceiling, reconciliation by a derived
 * session id — are all reasoned from it.
 *
 * @param {{repoRoot?:string}} [input]
 */
export function inspectSdkSurface({ repoRoot = process.cwd() } = {}) {
  const pkgDir = join(repoRoot, "node_modules", "@anthropic-ai", "claude-agent-sdk");
  const dts = join(pkgDir, "sdk.d.ts");
  if (!existsSync(dts)) {
    return deepFreeze({
      read: false,
      path: normalizePath(dts),
      installed_version: null,
      findings: null,
      note: "the SDK is not installed in this checkout; the adapter's interface findings could not be rechecked",
    });
  }
  let installed = null;
  try {
    installed = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version || null;
  } catch {
    installed = null;
  }
  const text = readFileSync(dts, "utf8");
  const findings = {
    callerMintedSessionId: /\n\s*sessionId\?: string;/u.test(text),
    resumeById: /\n\s*resume\?: string;/u.test(text),
    monetaryUsageField: /total_cost_usd/u.test(text),
    sandboxOption: /\n\s*sandbox\?: SandboxSettings;/u.test(text),
    abortController: /\n\s*abortController\?: AbortController;/u.test(text),
    maxTurns: /\n\s*maxTurns\?: number;/u.test(text),
    // A monetary ceiling would have to appear as an option naming a spend, cost
    // or budget limit. Absence is the finding the adapter's strict-bound refusal
    // rests on, so it is searched for rather than assumed.
    monetaryCeilingOption: /\n\s*(maxCostUsd|costLimit|budgetUsd|spendLimit)\??:/u.test(text),
  };
  return deepFreeze({
    read: true,
    path: normalizePath(dts),
    installed_version: installed,
    reviewed_version: CLAUDE_SDK_SURFACE.reviewed_version,
    version_matches_review: installed === CLAUDE_SDK_SURFACE.reviewed_version,
    findings: Object.freeze(findings),
    drift: Object.freeze(
      [
        findings.callerMintedSessionId ? null : "Options.sessionId is gone; the derived-session-id reconciliation no longer holds",
        findings.monetaryUsageField ? null : "total_cost_usd is gone; this backend no longer reports a cost",
        findings.monetaryCeilingOption ? "an option that looks like a spend ceiling now exists; the strict-bound refusal must be re-derived" : null,
        findings.sandboxOption ? null : "Options.sandbox is gone; the launch no longer requests a sandbox at all",
      ].filter(Boolean),
    ),
  });
}

/**
 * Collect what is actually installed, with each fact carrying how it was obtained.
 *
 * Nothing is inferred from a package.json range or a documentation page. A value
 * that could not be read is null, and describeProfile() renders that as null
 * rather than as the version someone expected.
 *
 * @param {{repoRoot?:string}} [input]
 */
export function collectRuntimeFacts({ repoRoot = process.cwd() } = {}) {
  const surface = inspectSdkSurface({ repoRoot });
  const cli = process.platform === "win32" ? { ok: false, out: "" } : run("claude", ["--version"]);
  return deepFreeze({
    sdk_version_installed: surface.installed_version,
    sdk_version_reviewed: CLAUDE_SDK_SURFACE.reviewed_version,
    sdk_surface: surface,
    cli_version: cli.ok ? cli.out : null,
    cli_version_note: cli.ok
      ? null
      : "the CLI version was not read; the SDK vendors its own runtime and a CLI on PATH is a different fact",
    node: process.version,
    os: process.platform + " " + process.arch,
    claude_home: join(homedir(), ".claude"),
    collected_at: new Date().toISOString(),
  });
}

/**
 * Build the record.
 *
 * `controls` is null, and that is the entire result: it means nothing was
 * observed, which is a different statement from "everything failed" and from
 * "nothing was tried". The limitations list names each unobserved control and
 * what observing it would take, so the record is actionable rather than merely
 * negative.
 *
 * @param {{repoRoot?:string}} [input]
 */
export function runQualification({ repoRoot = process.cwd() } = {}) {
  const runtime = collectRuntimeFacts({ repoRoot });
  const evidenceRef = "qualification:" + contentId("q", { v: 1, backend: BACKEND_ID, runtime });

  return deepFreeze({
    qualification_id: evidenceRef.replace("qualification:", ""),
    schema: "delivery-v2/qualification@1",
    backend_id: BACKEND_ID,
    mode: "interface-only",
    runtime,
    records: Object.freeze([]),
    descendantSurvived: null,
    negativeControl: null,
    // No control is claimed. finalizeProfile() therefore leaves the profile
    // unqualified and admitProfile() refuses it — independently of whatever the
    // other executor's profile says.
    controls: null,
    documentationFindings: Object.freeze([
      {
        claim:
          "the Claude Agent SDK's Bash sandbox supports macOS/Linux/WSL2 and not native Windows; an appropriate additional execution environment is required here",
        source: "PM Delivery — Context & Agent Model.md §2, citing the vendor's sandboxing documentation",
        status: "documentation finding, not a conformance result; it is not recorded as a control observation",
      },
    ]),
    limitations: Object.freeze([
      "No containment control was observed. This backend's confinement is a property of a running query, and a query is a paid dispatch, so the free battery that qualifies the other executor has no equivalent here.",
      ...Object.entries(UNOBSERVABLE_CONTROLS).map(([id, need]) => id + " is unobserved; observing it needs " + need + "."),
      "The declared harness control (canUseTool) screens tool calls. It is not an OS boundary and cannot constrain what a permitted tool's subprocess then does.",
      "No paid provider work was performed and nothing was dispatched.",
    ]),
  });
}

/**
 * Persist a qualification record and return the profile it supports.
 *
 * The profile is built from the record rather than handed the record's
 * conclusions, so a record that observed nothing produces an unqualified profile
 * with no further ceremony.
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

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("probes/claude-qualification.mjs")) {
  const rootArgIndex = process.argv.indexOf("--repo-root");
  const repoRoot = rootArgIndex > -1 && process.argv[rootArgIndex + 1] ? resolve(process.argv[rootArgIndex + 1]) : process.cwd();
  const record = runQualification({ repoRoot });
  const { path, profile } = writeQualification({ record, repoRoot });
  process.stdout.write("qualification record: " + path + "\n");
  process.stdout.write("mode: " + record.mode + "\n");
  process.stdout.write("sdk installed: " + String(record.runtime.sdk_version_installed) + "\n");
  for (const entry of record.runtime.sdk_surface.drift || []) process.stdout.write("  DRIFT: " + entry + "\n");
  process.stdout.write("profile qualified: " + profile.qualified + "\n");
  process.stdout.write("unverified controls: " + profile.unverifiedControls.join(", ") + "\n");
}
