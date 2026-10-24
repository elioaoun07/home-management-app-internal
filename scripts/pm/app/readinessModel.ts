import type { V2Readiness, V2ReadinessSelection, V2Reason } from "./types";
import { LAUNCH_GATES, PASSIVE_GATES, READINESS_SCHEMA } from "../../delivery-v2/readiness-contract.mjs";
import { reasonLabel } from "./v2model";

const projected = (result: V2Readiness | null | undefined, selection: V2ReadinessSelection): result is V2Readiness =>
  Boolean(result?.schema === READINESS_SCHEMA && result.phase === "launch" && /^sha256:[a-f0-9]{64}$/u.test(result.fingerprint) &&
    Object.entries(selection).every(([key, value]) => result.selection[key as keyof V2ReadinessSelection] === value));

/** Present server facts; never infer readiness from SDK installation or a lane. */
export function readinessCanStart(result: V2Readiness | null | undefined, selection: V2ReadinessSelection, at = Date.now()) {
  return projected(result, selection) && result.ready && result.blockers.length === 0 &&
    Date.parse(result.expiresAt || "") > at && LAUNCH_GATES.every(gate => result.facts[gate]?.state === "satisfied");
}

/** Start collects the live gates itself (entry.mjs), so only passively settled gates hold it back. */
export function readinessCanLaunch(result: V2Readiness | null | undefined, selection: V2ReadinessSelection) {
  return projected(result, selection) && PASSIVE_GATES.every(gate => result.facts[gate]?.state === "satisfied");
}

const GATE_LABELS: Record<string, string> = {
  policy: "Policy", selection: "Selection", source: "Item", coordination: "Queue", runtime: "Worker", authentication: "Sign-in",
  modelAvailability: "Model", environment: "Environment", qualification: "Qualification", checks: "Checks", budget: "Budget",
};
// A live fact that only lacks a current observation; Start collects it.
const AT_START = /-(?:unprobed|stale)$|^(?:authentication-runtime|native-model-runtime|qualification-binding)-unavailable$/u;

export type ReadinessRow = { gate: string; label: string; state: "ok" | "start" | "fix" };

export function readinessRows(result: V2Readiness | null | undefined): ReadinessRow[] {
  if (!result) return [];
  return LAUNCH_GATES.map(gate => {
    const fact = result.facts[gate];
    const state = fact?.state === "satisfied" ? "ok" : fact && !PASSIVE_GATES.includes(gate) && AT_START.test(fact.code) ? "start" : "fix";
    return { gate, label: GATE_LABELS[gate] || gate, state };
  });
}

const CODE_FIXES: Record<string, string> = {
  "grant-expired": "Policy expired — renew it",
  "owner-tests-pending": "Record your test result",
  "source-scope-unknown": "Add Touches to the item",
  "scope-not-authorized": "Item scope is outside the policy",
  "environment-manifest-mismatch": "package.json or lockfile changed",
  "environment-check-input-mismatch": "Check files changed",
  "coordination-store-moved": "Delivery busy — check again",
};

function stageFix(name: string, result: V2Readiness) {
  const detail = (gate: string) => (typeof result.facts[gate]?.detail === "string" ? String(result.facts[gate].detail) : null);
  switch (name) {
    case "docker": return "Start Docker Desktop";
    case "credential-sync":
    case "authentication": return detail("authentication") || "Sign in again on this laptop";
    case "environment": return detail("environment") || "Environment check failed";
    case "runtime-binding": return "Worker image unavailable";
    case "egress": return "Worker network unavailable";
    case "native-model": return "Model check failed — retry";
    default: return "Check failed — retry";
  }
}

/** One short clause per thing to fix. The server's codes decide; this only words them. */
export function readinessIssues(result: V2Readiness | null | undefined, rows = readinessRows(result)) {
  if (!result) return [];
  const issues = new Set<string>();
  const failed = result.collection?.stages.find(stage => stage.outcome !== "satisfied");
  for (const row of rows) {
    if (row.state !== "fix") continue;
    if (failed && !PASSIVE_GATES.includes(row.gate)) {
      issues.add(stageFix(failed.name, result));
      continue;
    }
    for (const blocker of result.blockers.filter(entry => entry.gate === row.gate)) {
      const detail = typeof blocker.detail === "string" && blocker.detail.length <= 80 ? blocker.detail : null;
      const fix = detail === "generated compiler input changed" ? "Refresh build setup" : detail;
      issues.add(CODE_FIXES[blocker.code] || fix || reasonLabel(blocker as unknown as V2Reason));
    }
  }
  return [...issues];
}
