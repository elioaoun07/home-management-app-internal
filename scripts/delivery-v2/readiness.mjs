// DLV-137: one deterministic projection, with no I/O or execution authority.
import { canonicalJson, deepFreeze, fingerprint } from "./contracts.mjs";
import { LAUNCH_GATES, READINESS_SCHEMA } from "./readiness-contract.mjs";
export { LAUNCH_GATES, READINESS_SCHEMA } from "./readiness-contract.mjs";
/** @typedef {{state:string,code:string,detail:unknown,evidence:unknown,nextAction:string|null,reasons?:Array<{code:string,detail?:unknown,state?:string,nextAction?:string|null}>}} ReadinessFact */
/** @param {string} state @param {string} code @param {unknown} detail @param {unknown} evidence @param {string|null} nextAction
 * @returns {ReadinessFact} */
export const readinessFact = (state, code, detail = null, evidence = null, nextAction = null) => ({ state, code, detail, evidence, nextAction });

/** Fixed field names only; shared by admission and non-authoritative diagnostics. */
export function nativeModelEvidenceInvalidFields({ selection, evidence, expectedNativeVersion }) {
  return Object.entries({
    schema: evidence?.schema === "delivery-v2/codex-model-probe@1",
    backend_id: evidence?.backend_id === "codex-exec-sdk",
    model: evidence?.model === selection.model,
    effort: evidence?.effort === selection.effort,
    expectedNativeVersion: Boolean(expectedNativeVersion),
    nativeVersion: evidence?.nativeVersion === expectedNativeVersion,
    cleanupConfirmed: evidence?.cleanupConfirmed === true,
    containerCleanupConfirmed: evidence?.containerCleanupConfirmed === true,
    providerTurns: evidence?.providerTurns === 0,
    entitlement: evidence?.entitlement === "unverified",
  }).filter(([, valid]) => !valid).map(([field]) => field);
}

const nativeCodes = new Set([
  "native-process-exited", "native-spawn-failed", "rpc-method-refused", "native-input-failed", "native-output-limit",
  "native-protocol-invalid", "native-process-error", "native-probe-timeout", "probe-input-invalid", "probe-limit-invalid",
  "native-version-invalid", "native-cleanup-unconfirmed", "native-version-mismatch", "subscription-unavailable", "subscription-not-proven",
  "unexpected-native-activity", "native-rpc-refused", "native-platform-mismatch", "native-subscription-mismatch",
  "native-catalog-invalid", "native-catalog-ambiguous", "native-efforts-unknown", "native-selection-advertised",
  "native-effort-not-advertised", "native-model-not-advertised", "native-cursor-invalid", "native-catalog-page-limit",
  "native-selection-unavailable", "native-model-container-unavailable", "native-container-cleanup-unconfirmed",
  "native-model-probe-unavailable", "native-model-probe-unverified",
]);
const nativeSignals = new Set(["unauthorized", "forbidden", "rateLimited", "tls", "proxy", "dns", "timeout", "connection", "modelRefresh"]);

/** Redact outer-process and incremental probe evidence before it leaves the boundary. */
export function nativeProbeTransportDiagnostics(value) {
  if (!value || typeof value !== "object") return null;
  const number = (input, max) => Number.isInteger(input) && input >= 0 && input <= max ? input : null;
  const process = value.process;
  return {
    process: process && typeof process === "object" ? {
      outcome: ["completed", "failed", "timed-out", "output-limit", "threw", "unobserved"].includes(process.outcome) ? process.outcome : "unobserved",
      errorCode: ["ETIMEDOUT", "ENOBUFS", "ENOENT", "EACCES", "EPERM"].includes(process.errorCode) ? process.errorCode : process.errorCode == null ? null : "unclassified",
      exitCode: number(process.exitCode, 255), elapsedMs: number(process.elapsedMs, 60_000),
      stdoutBytes: number(process.stdoutBytes, 64 * 1024 * 1024), stderrBytes: number(process.stderrBytes, 64 * 1024 * 1024),
      nativeRecords: number(process.nativeRecords, 10_000), authenticationRecords: number(process.authenticationRecords, 10_000),
    } : null,
    progress: Array.isArray(value.progress) ? value.progress.slice(0, 32)
      .filter(row => ["version", "subscription", "app-server", "initialize", "account/read", "model/list"].includes(row?.stage) && ["started", "completed"].includes(row?.event))
      .map(row => ({ stage: row.stage, event: row.event,
        at: typeof row.at === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/u.test(row.at) && row.at.length <= 40 && Number.isFinite(Date.parse(row.at)) ? row.at : null,
        code: nativeCodes.has(row.code) || ["native-version-observed", "subscription-observed"].includes(row.code) ? row.code : null,
        nativeVersion: typeof row.nativeVersion === "string" && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/u.test(row.nativeVersion) && row.nativeVersion.length <= 64 ? row.nativeVersion : null,
        cleanupConfirmed: typeof row.cleanupConfirmed === "boolean" ? row.cleanupConfirmed : null,
      })) : [],
  };
}

/** A bounded historical diagnosis survives expired/dependent facts. Never an admission input. */
export function nativeModelDiagnostics({ selection, evidence, expectedNativeVersion }) {
  if (!evidence || typeof evidence !== "object") return null;
  const flag = value => typeof value === "boolean" ? value : null;
  const version = value => typeof value === "string" && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/u.test(value) && value.length <= 64 ? value : null;
  const time = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/u.test(value) && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
  const elapsed = evidence.diagnostics?.elapsedMs;
  return {
    authority: "diagnostic-only",
    code: nativeCodes.has(evidence.code) ? evidence.code : "native-code-unrecorded",
    ok: flag(evidence.ok),
    invalidFields: nativeModelEvidenceInvalidFields({ selection, evidence, expectedNativeVersion }),
    nativeVersion: version(evidence.nativeVersion), expectedNativeVersion: version(expectedNativeVersion),
    cleanupConfirmed: flag(evidence.cleanupConfirmed), containerCleanupConfirmed: flag(evidence.containerCleanupConfirmed),
    modelAdvertised: flag(evidence.modelAdvertised), effortAdvertised: flag(evidence.effortAdvertised),
    providerTurnsZero: evidence.providerTurns === 0,
    elapsedMs: Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 60_000 ? elapsed : null,
    stopCode: nativeCodes.has(evidence.diagnostics?.stopCode) ? evidence.diagnostics.stopCode : null,
    sigtermRequested: flag(evidence.diagnostics?.sigtermRequested), sigkillRequested: flag(evidence.diagnostics?.sigkillRequested),
    closeObserved: flag(evidence.diagnostics?.closeObserved),
    transport: nativeProbeTransportDiagnostics(evidence.diagnostics?.transport),
    stderrSignals: Array.isArray(evidence.diagnostics?.stderrSignals) ? [...new Set(evidence.diagnostics.stderrSignals.filter(signal => nativeSignals.has(signal)))].sort() : [],
    rpcStages: Array.isArray(evidence.diagnostics?.rpcStages) ? evidence.diagnostics.rpcStages.slice(0, 7)
      .filter(stage => ["initialize", "account/read", "model/list"].includes(stage?.method))
      .map(stage => ({ method: stage.method, startedAt: time(stage.startedAt), completedAt: time(stage.completedAt) })) : [],
  };
}

/** Native advertising is distinct from policy permission and account entitlement.
 * Reused by passive inspection and the last-moment dispatch check. */
export function nativeModelAvailabilityFact({ selection, evidence, expectedNativeVersion, now = Date.now() }) {
  const fail = (state, code) => readinessFact(state, code, "Native model selection is not proven", evidence || null, "Obtain current native model/effort evidence");
  if (!evidence) return fail("unknown", "native-model-unprobed");
  const age = now - Date.parse(evidence.observedAt || "");
  if (!Number.isFinite(age) || age < 0 || age > 60_000) return fail("blocked", "native-model-stale");
  const invalidFields = nativeModelEvidenceInvalidFields({ selection, evidence, expectedNativeVersion });
  if (invalidFields.length) return { ...fail("blocked", "native-model-evidence-invalid"), detail: "Native model evidence invalid: " + invalidFields.join(", ") };
  if (evidence.modelAdvertised === false) return fail("blocked", "native-model-not-advertised");
  if (evidence.effortAdvertised === false) return fail("blocked", "native-effort-not-advertised");
  if (evidence.ok !== true || evidence.modelAdvertised !== true || evidence.effortAdvertised !== true ||
      evidence.subscription?.method !== "chatgpt" || evidence.subscription.additionalSpendAllowed !== false || evidence.subscription.includedUsageAvailable !== true) return fail("unavailable", "native-model-evidence-unavailable");
  return readinessFact("satisfied", "native-selection-advertised", "Native catalog advertises this selection; account entitlement remains unverified", evidence);
}

/** Unknown/unavailable are blockers, never a successful dependent check.
 * @template {object} T
 * @param {{selection?:T,facts?:Record<string,ReadinessFact>,required?:readonly string[],phase?:string}} options */
export function evaluateReadiness({ selection = {}, facts = {}, required = LAUNCH_GATES, phase = "launch" } = {}) {
  /** @type {Record<string,ReadinessFact>} */
  const normalized = {}, blockers = [];
  for (const gate of required) {
    const supplied = facts[gate];
    const fact = supplied && ["satisfied", "blocked", "unknown", "unavailable"].includes(supplied.state)
      ? supplied : readinessFact("unknown", gate + "-unknown", "No current evidence", null, "Obtain current " + gate + " evidence");
    normalized[gate] = fact;
    if (fact.state !== "satisfied") {
      const reasons = fact.reasons?.length ? fact.reasons : [{ code: fact.code, detail: fact.detail }];
      for (const reason of reasons) blockers.push({ ...reason, gate, state: ["blocked", "unknown", "unavailable"].includes(reason.state) ? reason.state : fact.state, nextAction: reason.nextAction || fact.nextAction || null });
    }
  }
  const body = { schema: READINESS_SCHEMA, phase, selection, facts: normalized, blockers,
    ready: blockers.length === 0, nextActions: [...new Set(blockers.map(row => row.nextAction).filter(Boolean))] };
  return deepFreeze({ ...body, status: body.ready ? "ready" : "blocked", fingerprint: fingerprint(canonicalJson(body)), authority: "inspection-only" });
}

/** Existing admission checks retain their codes and semantics under this view. */
export function readinessForRefusals({ refusals, selection = {}, phase = "dispatch" }) {
  return evaluateReadiness({ selection, phase, required: ["admission"], facts: {
    admission: { ...readinessFact(refusals.length ? "blocked" : "satisfied", "admission-current"), reasons: refusals },
  } });
}
