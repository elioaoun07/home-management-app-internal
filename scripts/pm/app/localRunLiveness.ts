import { localRunLabel } from "./localRunModel";

export const LIVENESS = {
  thinkingAfter: 20_000,
  quietAfter: 90_000,
  staleAfter: { preparing: 300_000, building: 240_000, checking: 600_000 },
  linkDownAfter: 12_000,
} as const;

export type LocalLivenessState =
  | "live"
  | "thinking"
  | "quiet"
  | "stale"
  | "link-down"
  | "signal-lost"
  | "failed"
  | "cancelled"
  | "shipped"
  | "reverted"
  | "your-turn"
  | "push-pending";

interface LivenessRun {
  phase: string;
  interrupted: boolean;
  activity: { at: string; summary: string | null }[];
  checks: { finished_at?: string | null }[];
  questions?: { state: string; asked_at: string }[];
}

export interface LocalPollHealth {
  dataUpdatedAt?: number;
  isError?: boolean;
}
export interface LocalLiveness {
  state: LocalLivenessState;
  caption: string;
  lastSignalAt: number | null;
  sinceSignalMs: number | null;
  waitingMs: number | null;
  active: boolean;
}

/** A retained duration, never an ETA or a claim about the missing history. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

function timestamp(value: string | null | undefined): number | null {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** The UI can distinguish a silent supervisor from a failed observation link. */
export function liveness(
  run: LivenessRun,
  now: number,
  poll: LocalPollHealth = {},
): LocalLiveness {
  const times = [
    ...run.activity.map((entry) => timestamp(entry.at)),
    ...run.checks.map((check) => timestamp(check.finished_at)),
  ].filter((at): at is number => at !== null);
  const lastSignalAt = times.length ? Math.max(...times) : null;
  const sinceSignalMs =
    lastSignalAt === null ? null : Math.max(0, now - lastSignalAt);
  const readyTimes = run.activity
    .filter((entry) => entry.summary === "Ready for owner UAT")
    .map((entry) => timestamp(entry.at))
    .filter((at): at is number => at !== null);
  // DLV-164: a session holding on an owner question is waiting, not silent.
  const asked = run.interrupted
    ? null
    : timestamp(run.questions?.find((entry) => entry.state === "open")?.asked_at);
  const waitingMs =
    asked !== null
      ? Math.max(0, now - asked)
      : run.phase === "uat-ready" && readyTimes.length
        ? Math.max(0, now - Math.max(...readyTimes))
        : null;
  const terminal = ["failed", "cancelled", "shipped", "reverted", "pushed", "cleaned", "discarded"].includes(
    run.phase,
  );
  let state: LocalLivenessState;
  // Owner decision: intentional stopped/slower terminal polling must preserve its
  // final frame. A real failed request still has the highest precedence.
  if (
    poll.isError ||
    (!terminal &&
      !!poll.dataUpdatedAt &&
      now - poll.dataUpdatedAt > LIVENESS.linkDownAfter)
  )
    state = "link-down";
  else if (run.interrupted) state = "signal-lost";
  else if (run.phase === "discarded") state = "cancelled";
  else if (run.phase === "pushed" || run.phase === "cleaned") state = "shipped";
  else if (terminal)
    state = run.phase as "failed" | "cancelled" | "shipped" | "reverted";
  else if (["uat-ready", "merged", "committed", "refresh-conflict", "refresh-failed", "merging"].includes(run.phase) || asked !== null) state = "your-turn";
  else if (["push-pending", "revert-push-pending"].includes(run.phase))
    state = "push-pending";
  else {
    const threshold =
      LIVENESS.staleAfter[run.phase as keyof typeof LIVENESS.staleAfter];
    state =
      sinceSignalMs === null
        ? "live"
        : threshold !== undefined && sinceSignalMs >= threshold
          ? "stale"
          : sinceSignalMs >= LIVENESS.quietAfter
            ? "quiet"
            : sinceSignalMs >= LIVENESS.thinkingAfter
              ? "thinking"
              : "live";
  }
  const phaseCaption =
    run.phase === "preparing"
      ? "Preparing"
      : run.phase === "checking"
        ? "Verifying"
        : "Building";
  const captions: Partial<Record<LocalLivenessState, string>> = {
    "link-down": "Link down",
    "signal-lost": "Signal lost",
    failed: "Failed",
    cancelled: "Stopped",
    shipped: localRunLabel(run),
    reverted: "Reverted",
    "push-pending": "Push pending",
    "your-turn":
      waitingMs !== null && waitingMs >= 3_600_000
        ? `Waiting ${Math.floor(waitingMs / 3_600_000)}h`
        : asked !== null
          ? "Question for you"
          : "Your turn",
    quiet: `Quiet ${clock(sinceSignalMs || 0)}`,
    stale: `No signal ${clock(sinceSignalMs || 0)}`,
    thinking: `${phaseCaption} · ${clock(sinceSignalMs || 0)}`,
  };
  return {
    state,
    caption: state !== "link-down" && state !== "signal-lost" && ["merged", "committed", "pushed", "cleaned", "discarded", "refresh-conflict", "refresh-failed", "refreshing", "merging"].includes(run.phase) ? localRunLabel(run) : captions[state] || phaseCaption,
    lastSignalAt,
    sinceSignalMs,
    waitingMs,
    active: state === "live" || state === "thinking",
  };
}
