import {
  localRunActivity,
  type LocalActivityStation,
} from "./localRunActivityModel";

export interface LocalFailureRecord {
  code: "install" | "secrets" | "native-error" | "no-change" | "commit-hook" | "commit-timeout" | "checks" | "handover" | "cancelled";
  step: string;
  detail: string;
  /** The commit-hook step that refused the commit, when known. */
  stage?: string;
}

interface FailureRun {
  phase: string;
  interrupted: boolean;
  error?: string;
  failure?: LocalFailureRecord;
  head?: string | null;
  workspace?: string;
  branch?: string;
  activity: Parameters<typeof localRunActivity>[0]["activity"];
  checks: { name: string; exit: number | null; error: string | null }[];
}

export interface LocalRunFailure {
  stage: string;
  station: LocalActivityStation | "forge-lab";
  title: string;
  excerpt: string;
  kept: string;
  log: string;
  tail: string;
  truncated: boolean;
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/gu, "");
}

export function localRunFailure(run: FailureRun): LocalRunFailure | null {
  if (!run.error && !run.failure) return null;
  const log = stripAnsi(run.error || "");
  const nativeStarted = run.activity.some(
    (row) => row.summary === "Native session started",
  );
  const verifyStarted = !!run.head || run.checks.length > 0;
  let stage = verifyStarted ? "Verify" : nativeStarted ? "Build" : "Setup";
  let station: LocalRunFailure["station"] = verifyStarted
    ? "lab"
    : nativeStarted
      ? "forge"
      : "launch";
  let title = log.split(/\r?\n/u)[0];
  if (log.startsWith("worktree dependencies unavailable")) {
    stage = "Setup";
    station = "launch";
    title = "Dependency setup failed";
  } else if (log.startsWith("worktree contains")) {
    stage = nativeStarted ? "Build" : "Setup";
    station = "launch";
    title = "Secret guard stopped it";
  } else if (log.startsWith("native session exited")) {
    stage = "Build";
    station = "forge";
    title = "Agent could not start";
  } else if (log.startsWith("native session did not confirm success") || log.startsWith("native session failed:")) {
    stage = "Build";
    station = "forge";
    title = "Agent ended early";
  } else if (log.startsWith("candidate needs a change")) {
    stage = "Build";
    station = "forge";
    title = "No changes made";
  } else if (log.startsWith("git ")) {
    stage = "Build → Verify";
    station = "forge-lab";
    title = log.startsWith("git commit: timed out")
      ? "Commit timed out"
      : log.startsWith("git commit:")
        ? "Commit hook failed"
        : "Git step failed";
  } else if (log.startsWith("host checks failed")) {
    stage = "Verify";
    station = "lab";
    const failed = run.checks.find(
      (check) => check.exit !== 0 || !!check.error,
    );
    title = failed ? `${failed.name} failed` : "Verification failed";
  } else if (log.startsWith("candidate changed during host checks")) {
    stage = "Verify";
    station = "lab";
    title = "Candidate changed";
  } else if (
    log.startsWith("handover incomplete") ||
    log.includes(".delivery-handover.json")
  ) {
    stage = "Handover";
    station = "review";
    title = "Handover missing";
  }
  if (run.failure) {
    const failedCheck = run.checks.find(check => check.exit !== 0 || !!check.error)?.name || run.failure.detail.split(/\r?\n/u)[0] || "host checks";
    const decoded: Record<LocalFailureRecord["code"], [string, LocalRunFailure["station"], string]> = {
      install: ["Setup", "launch", "Setup failed"],
      secrets: ["Setup", "launch", "Setup failed"],
      "native-error": ["Build", "forge", "Agent ended early"],
      "no-change": ["Build", "forge", "No changes made"],
      "commit-hook": ["Seal", "forge-lab", "Commit hook failed"],
      "commit-timeout": ["Seal", "forge-lab", "Commit timed out"],
      checks: ["Verify", "lab", `Check failed: ${failedCheck}`],
      handover: ["Handover", "review", "Handover incomplete"],
      cancelled: ["—", station, "Cancelled"],
    };
    const match = decoded[run.failure.code];
    if (match) [stage, station, title] = match;
  }
  const lines = log
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  const tailLines = lines.slice(-12);
  const summaryIndex = tailLines.findLastIndex((line) =>
    /Test Files|Tests|error TS|ELIFECYCLE|FAIL|Error:/u.test(line),
  );
  if (summaryIndex >= 0) {
    const [summary] = tailLines.splice(summaryIndex, 1);
    tailLines.unshift(summary);
  }
  const excerpt = run.failure ? stripAnsi(run.failure.detail) || "no reason reported" : tailLines.join("\n");
  const paths = new Set(
    localRunActivity(run)
      .events.filter((event) => event.kind === "edit")
      .flatMap((event) => event.paths),
  );
  const kept = [paths.size ? `${paths.size} files` : null, run.branch || null]
    .filter(Boolean)
    .join(" · ");
  return {
    stage,
    station,
    title,
    excerpt,
    kept,
    log,
    tail: log.slice(-20_000),
    truncated: log.length > 20_000,
  };
}
