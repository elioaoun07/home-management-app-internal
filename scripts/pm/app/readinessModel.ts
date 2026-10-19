import type { V2Readiness, V2ReadinessSelection } from "./types";
import { LAUNCH_GATES, READINESS_SCHEMA } from "../../delivery-v2/readiness-contract.mjs";

/** Present server facts; never infer readiness from SDK installation or a lane. */
export function readinessCanStart(result: V2Readiness | null | undefined, selection: V2ReadinessSelection, at = Date.now()) {
  return Boolean(result?.schema === READINESS_SCHEMA && result.phase === "launch" && result.ready && result.blockers.length === 0 && /^sha256:[a-f0-9]{64}$/u.test(result.fingerprint) &&
    Date.parse(result.expiresAt || "") > at && LAUNCH_GATES.every(gate => result.facts[gate]?.state === "satisfied") &&
    Object.entries(selection).every(([key, value]) => result.selection[key as keyof V2ReadinessSelection] === value));
}
export function readinessLabels(result: V2Readiness | null | undefined) {
  return result ? result.blockers.map(blocker => ({ ...blocker, label: blocker.code.replace(/-/gu, " ") }))
    : [{ gate: "inspection", state: "unknown", code: "readiness-unavailable", label: "Readiness unavailable", nextAction: null }];
}
