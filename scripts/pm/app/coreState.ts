import type { RunSummary, StewardRequest, V2RunSummary } from "./types";

export interface CoreSessionState {
  state: "idle" | "running" | "attention" | "success" | "failed" | "unknown";
  label: string;
  value: number | null;
  unit: string;
  detail?: string;
}

interface Terminal {
  at: number | null;
  state: "success" | "failed" | "unknown";
  label: string;
}

function timestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function v2Terminal(run: V2RunSummary): Terminal {
  const base = { at: timestamp(run.updated_at) };
  if (run.lane === "local" && run.closed_outcome === "shipped")
    return { ...base, state: "success", label: "Shipped" };
  if (run.closed_outcome === "failed")
    return { ...base, state: "failed", label: "Session failed" };
  if (
    ["checks-failed", "reassessment-failed"].includes(
      run.application?.state || "",
    )
  )
    return { ...base, state: "failed", label: "Checks failed" };
  if (run.closed_outcome === "verified_candidate") {
    if (run.application?.state === "applied")
      return { ...base, state: "success", label: "Applied" };
    if (!run.application)
      return { ...base, state: "success", label: "Candidate verified" };
    // A verified candidate is no longer a clean terminal result while its
    // application is pending, interrupted, inconclusive, conflicted or undone.
    return { ...base, state: "unknown", label: "Application unresolved" };
  }
  return {
    ...base,
    state: "unknown",
    label:
      run.closed_outcome === "cancelled"
        ? "Cancelled"
        : run.closed_outcome === "useful_partial"
          ? "Partial result"
          : "Outcome unconfirmed",
  };
}

/** Pure presentation of observed delivery state; clicking the core changes none of it. */
export function coreSessionState({
  needs,
  running,
  uncertain,
  v1Runs,
  v2Runs,
  requests = [],
}: {
  needs: number;
  running: number;
  uncertain: boolean;
  v1Runs: RunSummary[];
  v2Runs: V2RunSummary[];
  requests?: StewardRequest[];
}): CoreSessionState {
  // Execution wins even when some other session is waiting on its owner.
  if (running > 0)
    return {
      state: "running",
      label: "In motion",
      value: running,
      unit: running === 1 ? "session" : "sessions",
      ...(uncertain ? { detail: "Status incomplete" } : {}),
    };
  const terminal: Terminal[] = [
    ...v1Runs
      .filter((run) => ["SHIPPED", "FAILED", "CANCELLED"].includes(run.state))
      .map(
        (run): Terminal => ({
          at: timestamp(run.updatedAt),
          state:
            run.state === "SHIPPED"
              ? "success"
              : run.state === "FAILED"
                ? "failed"
                : "unknown",
          label:
            run.state === "SHIPPED"
              ? "Shipped"
              : run.state === "FAILED"
                ? "Session failed"
                : "Cancelled",
        }),
      ),
    ...v2Runs.filter((run) => run.lifecycle === "CLOSED").map(v2Terminal),
    ...v2Runs
      .filter(
        (run) =>
          run.lane === "local" &&
          run.lifecycle !== "CLOSED" &&
          !run.active &&
          // DLV-165: a parked session waits on the owner by design.
          run.ownerActionKind !== "local-question" &&
          ["preparing", "building", "checking"].includes(run.stage),
      )
      .map(
        (run): Terminal => ({
          at: timestamp(run.updated_at),
          state: "failed",
          label: "Session interrupted",
        }),
      ),
    ...requests
      .filter((request) => request.status === "blocked" && !request.run_id)
      .map(
        (request): Terminal => ({
          at: timestamp(request.lastConfirmedAt),
          state: "failed",
          label: "Launch blocked",
        }),
      ),
  ];
  // A new failure must remain visible even with unrelated UAT waiting. A newer
  // session/attempt supersedes it; missing or tied mixed evidence stays unknown.
  const latestObserved = Math.max(
    0,
    ...v1Runs.map((run) => timestamp(run.updatedAt) || 0),
    ...v2Runs.map((run) => timestamp(run.updated_at) || 0),
    ...requests.map((request) => timestamp(request.lastConfirmedAt) || 0),
  );
  const recent = terminal.filter((run) => run.at === latestObserved);
  if (
    recent.length &&
    recent.every((run) => run.state === "failed") &&
    !terminal.some((run) => run.at === null)
  )
    return {
      state: "failed",
      label: recent[0].label,
      value: null,
      unit: "Latest session",
      ...(uncertain ? { detail: "Status incomplete" } : {}),
    };
  if (needs > 0)
    return {
      state: "attention",
      label: "Awaiting you",
      value: needs,
      unit: needs === 1 ? "action" : "actions",
      ...(uncertain ? { detail: "Status incomplete" } : {}),
    };
  if (uncertain)
    return {
      state: "unknown",
      label: "Unconfirmed",
      value: null,
      unit: "Delivery status",
    };
  if (!terminal.length)
    return {
      state: "idle",
      label: "Ready when you are",
      value: null,
      unit: "No active sessions",
    };
  if (terminal.some((run) => run.at === null))
    return {
      state: "unknown",
      label: "Outcome unconfirmed",
      value: null,
      unit: "Session order unknown",
    };
  const latestAt = Math.max(...terminal.map((run) => run.at!));
  const latest = terminal.filter((run) => run.at === latestAt);
  const states = new Set(latest.map((run) => run.state));
  if (states.size !== 1)
    return {
      state: "unknown",
      label: "Outcome unconfirmed",
      value: null,
      unit: "Session order unknown",
    };
  const result = latest[0];
  const labels = new Set(latest.map((run) => run.label));
  return {
    state: result.state,
    label:
      labels.size === 1
        ? result.label
        : result.state === "success"
          ? "Completed"
          : result.state === "failed"
            ? "Session failed"
            : "Outcome unconfirmed",
    value: null,
    unit: latest.length === 1 ? "Latest session" : "Latest sessions",
  };
}
