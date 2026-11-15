export type LocalActivityKind =
  | "read"
  | "edit"
  | "command"
  | "check"
  | "message"
  | "event"
  | "failure";

export type LocalActivityStation =
  | "launch"
  | "source"
  | "forge"
  | "lab"
  | "review";

interface RecordedActivity {
  at: string;
  summary: string | null;
  kind?: string;
  seq?: number;
  job_id?: string | null;
}

interface ActivityRun {
  phase: string;
  interrupted: boolean;
  error?: string;
  activity: RecordedActivity[];
  checks: { name: string; exit: number | null; error: string | null }[];
}

export interface LocalActivityEvent {
  id: string;
  at: string;
  kind: LocalActivityKind;
  label: string;
  detail: string | null;
  summary: string;
  station: LocalActivityStation;
}

const checkResult = /^(typecheck|lint|test|pm:lint):\s*(-?\d+|null)$/u;
const checkCommand =
  /(?:^|[\s;&|])(?:pnpm|npm|yarn|bun)(?:\s+(?:run|exec))?\s+(?:typecheck|lint|test|vitest|pm:lint)(?:\s|$)/u;
const requestedTools: Record<
  string,
  { kind: LocalActivityKind; station: LocalActivityStation; label: string }
> = {
  Read: { kind: "read", station: "source", label: "Read requested" },
  Grep: { kind: "read", station: "source", label: "Search requested" },
  Glob: { kind: "read", station: "source", label: "File search requested" },
  Edit: { kind: "edit", station: "forge", label: "Edit requested" },
  Write: { kind: "edit", station: "forge", label: "Write requested" },
  NotebookEdit: {
    kind: "edit",
    station: "forge",
    label: "Notebook edit requested",
  },
  Bash: { kind: "command", station: "forge", label: "Command requested" },
};

/** Adapt only executor/supervisor observations. Prose never proves a tool ran. */
function activityEvent(
  entry: RecordedActivity,
  index: number,
  run: ActivityRun,
): LocalActivityEvent {
  const summary = entry.summary || "Event recorded";
  const result: LocalActivityEvent = {
    // Persisted seq is stable even when the store's bounded window advances.
    id:
      entry.seq !== undefined
        ? `${entry.job_id || "activity"}:${entry.seq}`
        : `${entry.at}:${index}`,
    at: entry.at,
    kind: "event",
    label: "Event recorded",
    detail: summary === "Event recorded" ? null : summary,
    summary,
    station: "forge",
  };
  if (summary === run.error || summary.startsWith("native session exited")) {
    return {
      ...result,
      kind: "failure",
      label: "Session failed",
      detail: null,
      summary: "Session failed · see error details",
    };
  }
  if (entry.kind === "message") {
    return { ...result, kind: "message", label: "ERA update" };
  }
  if (entry.kind === "tool" && requestedTools[summary]) {
    return { ...result, ...requestedTools[summary], detail: null };
  }
  if (entry.kind === "tool") {
    return { ...result, label: "Tool requested" };
  }
  if (entry.kind === "edit") {
    return {
      ...result,
      kind: "edit",
      label: "File change recorded",
      station: "forge",
    };
  }
  if (entry.kind === "command") {
    return {
      ...result,
      kind: "command",
      label: "Command completed",
      station: checkCommand.test(summary) ? "lab" : "forge",
    };
  }
  if (entry.kind === "search") {
    return {
      ...result,
      kind: "read",
      label: "Search completed",
      station: "source",
    };
  }
  // Old Local records omitted kind. Only exact known tool names are understood;
  // an assistant sentence such as "I will read a file" remains an observation.
  if (!entry.kind && requestedTools[summary]) {
    return { ...result, ...requestedTools[summary], detail: null };
  }
  const check = checkResult.exec(summary);
  if (check) {
    const inconclusive =
      check[2] === "null" ||
      run.checks.some((record) => record.name === check[1] && !!record.error);
    return {
      ...result,
      kind: "check",
      label: inconclusive
        ? "Check inconclusive"
        : check[2] === "0"
          ? "Check passed"
          : "Check failed",
      detail: check[1],
      station: "lab",
    };
  }
  if (summary === "Native session started") {
    return {
      ...result,
      label: "Session started",
      detail: null,
      station: "launch",
    };
  }
  if (summary === "Host checks started") {
    return {
      ...result,
      label: "Host checks started",
      detail: null,
      station: "lab",
    };
  }
  if (summary === "Ready for owner UAT") {
    return {
      ...result,
      label: "Ready to test",
      detail: null,
      station: "review",
    };
  }
  if (
    [
      "Owner opened diff review",
      "Owner shipped merge",
      "Owner reverted merge",
    ].includes(summary)
  ) {
    return { ...result, label: summary, detail: null, station: "review" };
  }
  return result;
}

/** A latest-observation view, not a native thought trace or a completion estimate. */
export function localRunActivity(run: ActivityRun) {
  const events = run.activity
    .map((entry, index) => activityEvent(entry, index, run))
    .reverse();
  const active =
    !run.interrupted &&
    ["preparing", "building", "checking"].includes(run.phase);
  const waiting =
    !run.interrupted &&
    ["uat-ready", "push-pending", "revert-push-pending"].includes(run.phase);
  let station: LocalActivityStation = "review";
  let label = "Session recorded";
  let detail: string | null = null;
  if (run.phase === "preparing") {
    station = "launch";
    label = "Preparing workspace";
  } else if (run.phase === "building") {
    station = "forge";
    label = "Building";
    const latest = events[0];
    if (latest && ["read", "edit", "command"].includes(latest.kind)) {
      station = latest.station;
      label = latest.label;
      detail = latest.detail;
    }
  } else if (run.phase === "checking") {
    station = "lab";
    label = "Verifying";
  } else {
    const labels: Record<string, string> = {
      "uat-ready": "Ready to test",
      merging: "Merging",
      "push-pending": "Push pending",
      shipped: "Shipped",
      failed: "Session failed",
      cancelled: "Cancelled",
      reverted: "Reverted",
      "revert-push-pending": "Revert pending",
    };
    label = labels[run.phase] || run.phase;
  }
  if (run.interrupted) label = "Session interrupted";
  return {
    station,
    label,
    detail,
    active,
    waiting,
    events,
    latestAt: events[0]?.at || null,
    counts: {
      reads: events.filter((event) => event.kind === "read").length,
      edits: events.filter((event) => event.kind === "edit").length,
      commands: events.filter((event) => event.kind === "command").length,
      checks: run.checks.filter((check) => check.exit === 0 && !check.error)
        .length,
      events: events.length,
    },
  };
}
