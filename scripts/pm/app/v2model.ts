// Delivery V2 presentation helpers. Pure: records in, labels out. Nothing here
// derives a verdict — every state shown comes from the server's projection, and
// unknown values stay unknown rather than rendering as zero.
import type { ConnectionState, ReceiptState } from "./transport";
import type { V2Application, V2Evidence, V2Executor, V2Job, V2Queue, V2Reason, V2Resources, V2RunDetail, V2Settings } from "./types";

export function executorLabel(id: string | null | undefined) {
  if (id === "claude" || id === "claude-agent-sdk") return "Claude";
  if (id === "codex" || id === "codex-exec-sdk") return "Codex";
  return id || "Executor";
}

export function settingsLine(settings: Pick<V2Settings, "executor" | "model" | "effort"> & { backend_id?: string | null }) {
  return [executorLabel(settings.executor || settings.backend_id), settings.model || "Default model", settings.effort].filter(Boolean).join(" · ");
}

export function branchLabel(branch: string | null | undefined) {
  switch (branch) {
    case "stop-requested":
      return "Stop requested";
    case "unknown":
      return "Outcome unknown";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return null;
  }
}

export function outcomeLabel(outcome: string | null | undefined) {
  switch (outcome) {
    case "verified_candidate":
      return "Candidate verified";
    case "useful_partial":
      return "Partial";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Closed";
  }
}

export function evidenceLabel(evidence: Pick<V2Evidence, "state" | "reason" | "label">) {
  if (evidence.state === "missing" && evidence.reason === "zero-executed") return "Not tested";
  return (
    { satisfied: "Passed", failed: "Failed", stale: "Stale", inconclusive: "Couldn't verify", missing: "Missing", waived: "Waived" } as Record<string, string>
  )[evidence.state] || evidence.label;
}

export function obligationLabel(obligation: { kind: string; detail: unknown }) {
  const detail = (obligation.detail || {}) as Record<string, unknown>;
  switch (obligation.kind) {
    case "criterion":
      return "Check " + String(detail.criterion_id ?? "") + " · " + String(detail.state ?? "");
    case "disposition":
      return "Awaiting " + String(detail.requested ?? detail.criterion_id ?? "disposition").replace(/_/gu, " ");
    case "unresolved-resource":
      return "Usage unknown";
    case "unknown-job-or-effect":
      return "Job outcome unknown";
    case "publication-scope":
      return "Changes outside scope";
    case "integrity-violation":
      return "Integrity";
    case "authority-violation":
      return "Authority";
    case "stale-candidate":
      return "Candidate changed";
    case "missing-artifact":
      return "Missing artifact";
    default:
      return obligation.kind;
  }
}

/** One compact cost view. An amount nobody reported is "Unknown", never "$0.00". */
export function costRows(resources: V2Resources | null | undefined) {
  if (!resources) return [{ label: "Cost", value: "Unknown" }];
  const reported = resources.provenance.measuredTokens || {};
  const tokens = Number(reported.total ?? 0);
  const rows = [
    {
      label: "Estimated",
      value: resources.provenance.providerReportedUsd == null ? "Unknown" : "$" + resources.provenance.providerReportedUsd.toFixed(2),
    },
    { label: "Tokens", value: tokens > 0 ? tokens.toLocaleString() : "None observed" },
    { label: "Unknown", value: resources.unknown.length ? String(new Set(resources.unknown.map((entry) => entry.job_id)).size) + " job(s)" : "None" },
    { label: "Reserved", value: String(resources.openReservations) },
  ];
  if (resources.thresholdUsd != null) rows.push({ label: "Threshold", value: "$" + resources.thresholdUsd });
  if (resources.allowance != null) rows.push({ label: "Allowance", value: resources.allowance + " " + resources.unit + (resources.strict ? " · strict" : "") });
  return rows;
}

/** Why an executor cannot be chosen for a run, or null when it can. */
export function launchState(executor: V2Executor) {
  if (executor.available === false) return { enabled: false, reason: "Not installed" };
  if (!executor.permitted) return { enabled: false, reason: "Not permitted" };
  if (!executor.qualified) return { enabled: false, reason: "Not qualified" };
  return { enabled: true, reason: null };
}

/** One owner-facing cause for an unavailable executor. Internal gate codes stay out of the launch screen. */
export function executorBlockMessage(executor: V2Executor) {
  if (executor.available === false) return "This executor is not installed.";
  if (!executor.permitted) return "This executor is disabled in Delivery settings.";
  const codes = new Set([
    ...executor.refusals.map((entry) => entry.code),
    ...executor.qualification.refusals.map((entry) => entry.code),
  ]);
  if (codes.has("subscription-not-ready")) {
    const detail = executor.refusals.find(
      (entry) => entry.code === "subscription-not-ready",
    )?.detail;
    if (/429/iu.test(String(detail || "")))
      return "Its subscription check was rate-limited.";
    return "Its subscription sign-in needs refreshing.";
  }
  if (codes.has("runtime-binding-unavailable"))
    return "Its Delivery worker is offline.";
  if (
    codes.has("qualification-binding-mismatch") ||
    codes.has("no-qualification-receipt") ||
    codes.has("profile-unqualified") ||
    codes.has("confinement-unproven")
  )
    return "Its worker verification needs refreshing.";
  return "This executor is unavailable.";
}

/** Efforts the SDK accepts, narrowed to what the chosen model lists. */
export function effortsFor(executor: V2Executor, modelId: string) {
  const model = executor.models.find((entry) => entry.id === modelId);
  return model && model.efforts ? executor.supportedEfforts.filter((effort) => model.efforts!.includes(effort)) : executor.supportedEfforts;
}

export function verificationLabel(job: V2Job) {
  const verification = job.effective && job.effective.verification;
  if (!verification) return null;
  if (verification.mismatch) return "Settings differ";
  const states = [verification.model.state, verification.effort.state];
  if (states.every((state) => state === "unreported")) return "Settings unreported";
  if (states.includes("unreported")) return "Partly reported";
  return states.every((state) => state === "matched") ? "Settings matched" : "Default used";
}

const clock = (at: string | null) => (at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

/** Only agents the executor actually reported. A quiet run shows its one main agent. */
export function agentRows(detail: Pick<V2RunDetail, "agents">) {
  return detail.agents.map((agent) => ({
    key: agent.role + ":" + (agent.id || ""),
    label:
      [agent.role === "subagent" ? "Subagent" : "Main", executorLabel(agent.executor), agent.model].filter(Boolean).join(" · ") +
      (agent.lastAction ? " — " + agent.lastAction : " — no activity observed"),
    time: clock(agent.lastAt),
  }));
}

export const activityTime = clock;

/** A command whose outcome is not established yet. Never "failed". */
export function receiptLabel(state: ReceiptState) {
  switch (state) {
    case "acknowledged":
      return "Acknowledged";
    case "unknown":
      return "Outcome unknown";
    case "expired":
      return "Expired";
    default:
      return "Not acknowledged";
  }
}

const ago = (at: string | null, now: number) => {
  if (!at) return null;
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  return clock(at);
};

const WORKER_LABELS: Record<string, string> = {
  ready: "Ready",
  "not-qualified": "Not qualified",
  "not-configured": "Not configured",
  unavailable: "Unavailable",
  unknown: "Unknown",
  local: "Local",
};

/**
 * Three separate facts, never merged: whether the laptop bridge is reachable,
 * the last command receipt this device saw, and whether a worker could run.
 */
export function connectionChips(connection: ConnectionState, now: number) {
  const bridge = connection.bridge;
  const bridgeValue =
    bridge.state === "online" ? ago(bridge.seenAt, now) || "Online" : bridge.state === "stale" ? "Offline · " + (clock(bridge.seenAt) || "?") : bridge.state === "never" ? "Offline" : "Local";
  return [
    { key: "bridge", label: "Laptop", value: bridgeValue, tone: bridge.state === "online" || bridge.state === "local" ? "ok" : "warn" },
    {
      key: "ack",
      label: "Ack",
      value: connection.lastAck.at ? clock(connection.lastAck.at) + (connection.lastAck.state ? " · " + connection.lastAck.state : "") : "None",
      tone: connection.lastAck.state === "unknown" ? "warn" : "neutral",
    },
    { key: "worker", label: "Workers", value: WORKER_LABELS[connection.worker.state] || connection.worker.state, tone: connection.worker.state === "ready" ? "ok" : "warn" },
    ...(connection.stale ? [{ key: "saved", label: "Saved", value: clock(connection.savedAt) || "Yes", tone: "warn" }] : []),
  ];
}

export function applicationLabel(state: string) {
  return (
    {
      prepared: "Applying",
      writing: "Applying",
      checking: "Checking",
      "rolling-back": "Rolling back",
      applied: "Applied",
      "checks-failed": "Checks failed",
      "checks-inconclusive": "Checks inconclusive",
      "checks-pending": "Checks pending",
      conflict: "Conflict",
      refused: "Refused",
      failed: "Failed",
      interrupted: "Interrupted",
      "rolled-back": "Rolled back",
      "partly-restored": "Partly restored",
      "reassessment-failed": "Fails on current source",
    } as Record<string, string>
  )[state] || state;
}

/** Which Apply controls a run offers, derived from the server's projection only. */
export function applyControls(detail: Pick<V2RunDetail, "run" | "result" | "candidate" | "applications" | "ownerAction">) {
  const applications: V2Application[] = detail.applications || [];
  const latest = applications.length ? applications[applications.length - 1] : null;
  const verified = detail.run.closed_outcome === "verified_candidate" && !!detail.result?.candidateVerified && !!detail.candidate;
  const retryable =
    !latest || ["refused", "conflict", "failed", "rolled-back", "reassessment-failed"].includes(latest.state) || latest.candidate_id !== detail.candidate?.candidate_id;
  return {
    latest,
    canApply: verified && retryable,
    canResume: latest?.state === "interrupted",
    canRollback: !!latest && ["applied", "checks-failed", "checks-inconclusive", "checks-pending", "interrupted", "partly-restored"].includes(latest.state),
    canRecheck: !!latest && ["checks-pending", "checks-failed", "checks-inconclusive"].includes(latest.state),
    resultRef: detail.result ? detail.result.result_id + "@" + detail.result.result_version : null,
  };
}

// --- Parallel items (Command Center Phase 5) ---------------------------------

const VERDICT_LABELS: Record<string, string> = { together: "Ready", follow: "Waiting", scope: "Scope required" };

export function verdictLabel(verdict: string | null | undefined) {
  return verdict ? VERDICT_LABELS[verdict] || verdict : null;
}

/** The current blocker takes precedence over a generic parallel-work verdict. */
export function coordinationStatus(
  verdict: string | null | undefined,
  reasons: V2Reason[],
) {
  if (
    reasons.some((reason) =>
      ["writer-slots-full", "job-slots-full"].includes(reason.code),
    )
  )
    return "Capacity full";
  // The token allowance, not a slot: the owner can change it in Settings.
  if (reasons.some((reason) => reason.code === "fleet-resources"))
    return "Allowance used";
  if (reasons.some((reason) => reason.code === "scope-unknown"))
    return "Scope required";
  if (reasons.some((reason) => reason.code.startsWith("dependency-")))
    return "Waiting";
  return verdictLabel(verdict);
}

const paths = (list: string[] | undefined) => {
  const values = list || [];
  return values.slice(0, 2).join(", ") + (values.length > 2 ? " +" + (values.length - 2) : "");
};

/** One short clause per reason. The server's codes decide; this only words them. */
export function reasonLabel(reason: V2Reason) {
  const other = reason.with ? " · " + reason.with : "";
  switch (reason.code) {
    case "same-item":
      return "Same item";
    case "held":
      return "Held";
    case "dependency-open":
      return "After " + (reason.first || reason.with || "prerequisite");
    case "dependency-cancelled":
      return (reason.with || "Prerequisite") + " cancelled";
    case "dependency-unresolved":
      return (reason.with || "Prerequisite") + " not found";
    case "path-overlap":
      return paths(reason.paths) + other;
    case "shared-contract":
      return "Uses " + paths(reason.paths) + other;
    case "shared-schema":
      return "Schema" + other;
    case "lockfile":
      return "Dependencies" + other;
    case "generated-output":
      return paths(reason.paths) + other;
    case "check-resource":
      return "Checks share " + (reason.resources || []).join(", ");
    case "scope-unknown":
      return "Add file scope";
    case "source-moved":
      return "Changed since snapshot · " + paths(reason.paths);
    case "writer-slots-full":
      return "Writers " + reason.used + "/" + reason.max;
    case "job-slots-full":
      return "Jobs " + reason.used + "/" + reason.max;
    case "fleet-resources":
      return "Allowance used";
    default:
      return reason.code.replace(/-/gu, " ");
  }
}

/** Slot chips: writers and jobs always, unknown jobs and observed subagents when present. */
export function queueSlots(queue: Pick<V2Queue, "writers" | "jobs" | "unknown" | "nativeAgents">) {
  return [
    { key: "writers", label: "Writers", value: queue.writers.used + "/" + queue.writers.max, full: queue.writers.used >= queue.writers.max },
    { key: "jobs", label: "Jobs", value: queue.jobs.used + "/" + queue.jobs.max, full: queue.jobs.used >= queue.jobs.max },
    ...(queue.unknown.jobs.length ? [{ key: "unknown", label: "Unknown", value: String(queue.unknown.jobs.length), full: true }] : []),
    ...(queue.nativeAgents ? [{ key: "subagents", label: "Subagents", value: String(queue.nativeAgents), full: false }] : []),
  ];
}

/** What a running row is doing, from the job the server reported. */
export function runningLabel(row: Pick<V2Queue["running"][number], "writer" | "job_id" | "access" | "status">) {
  if (row.status === "unknown") return "Outcome unknown";
  if (row.writer) return row.job_id ? "Writing" : "Checking";
  return "Planning";
}
