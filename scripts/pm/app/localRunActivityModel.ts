import { localRunLabel } from "./localRunModel";

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

export interface LocalActivityAgent {
  role?: string;
  id?: string | null;
  executor?: string;
  model?: string | null;
}

export interface RecordedActivity {
  at: string;
  summary: string | null;
  message_text?: string;
  message_excerpt?: boolean;
  kind?: string | null;
  seq?: number;
  job_id?: string | null;
  agent_json?: LocalActivityAgent | string | null;
}

interface ActivityRun {
  phase: string;
  interrupted: boolean;
  error?: string;
  workspace?: string;
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
  messageText?: string;
  messageExcerpt?: boolean;
  station: LocalActivityStation;
  paths: string[];
  command: string | null;
  agent: LocalActivityAgent | null;
}

const checkResult = /^(typecheck|lint|test|pm:lint):\s*(-?\d+|null)$/u;
const checkCommand =
  /(?:^|[\s;&|])(?:(?:pnpm|npm|yarn|bun)(?:\s+(?:run|exec))?\s+(?:typecheck|lint|test|vitest|eslint|tsc|pm:lint)|(?:eslint|tsc|vitest))(?:\s|$)/u;
const readCommand =
  /^(?:Get-Content|gc|cat|type|rg|grep|Select-String|ls|dir|Get-ChildItem|Get-Item|head|tail|find)\b|^sed\s+-n(?:\s|$)|^git\s+(?:diff|status|log|show)(?:\s|$)/iu;
const searchCommand = /^(?:rg|grep|Select-String|find)\b/iu;

function unquote(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 1 &&
    ["'", '"'].includes(trimmed[0]) &&
    trimmed.at(-1) === trimmed[0]
    ? trimmed.slice(1, -1)
    : trimmed;
}

/** Remove only recognised shell launchers; never evaluate recorded shell text. */
export function unwrapLocalCommand(summary: string): string {
  let command = summary.trim();
  for (let depth = 0; depth < 3; depth += 1) {
    const wrapper =
      /^(?:"[^"]*(?:powershell|pwsh)(?:\.exe)?"|'[^']*(?:powershell|pwsh)(?:\.exe)?'|[^\s]*(?:powershell|pwsh)(?:\.exe)?)(?:\s+.*?)?\s+-(?:Command|c)\s+([\s\S]+)$/iu.exec(
        command,
      ) ||
      /^(?:"[^"]*(?:bash|sh)"|'[^']*(?:bash|sh)'|[^\s]*(?:bash|sh))\s+-[a-z]*c\s+([\s\S]+)$/iu.exec(
        command,
      ) ||
      /^(?:"[^"]*cmd(?:\.exe)?"|'[^']*cmd(?:\.exe)?'|[^\s]*cmd(?:\.exe)?)\s+\/c\s+([\s\S]+)$/iu.exec(
        command,
      );
    if (!wrapper) break;
    command = unquote(wrapper[1]);
  }
  // Native summaries can end before the shell's closing quote. Its opening
  // quote is launcher syntax, not part of the observed command's leading verb.
  if (["'", '"'].includes(command[0]) && command.at(-1) !== command[0])
    command = command.slice(1);
  return command;
}

export function relativeLocalPath(path: string, workspace = ""): string {
  let normal = unquote(path).replaceAll("\\", "/").replace(/^\.\//u, "");
  const base = workspace.replaceAll("\\", "/").replace(/\/+$/u, "");
  if (base && normal.toLowerCase().startsWith(`${base.toLowerCase()}/`))
    normal = normal.slice(base.length + 1);
  return normal;
}

function commandParts(command: string) {
  return (command.match(/"[^"]*"|'[^']*'|[^\s]+/gu) || []).map(unquote);
}

const cappedSummary = (summary: string) =>
  summary.length === 240 || summary.length === 400;

/** A cap-sized capture cannot prove that its last argument is complete. Keep
 * earlier arguments; discard the whole final token, including an open quote. */
function completeCommandPrefix(command: string): string {
  let quote: string | null = null;
  let tokenStart = 0;
  let inToken = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        if (command[index + 1] === quote) index += 1;
        else quote = null;
      }
    } else if (/\s/u.test(character)) inToken = false;
    else {
      if (!inToken) tokenStart = index;
      inToken = true;
      if (character === "'" || character === '"') quote = character;
    }
  }
  return command.slice(0, tokenStart).trimEnd();
}

function relativeCommand(command: string, workspace?: string) {
  if (!workspace) return command;
  const roots = new Set([
    workspace.replaceAll("\\", "/"),
    workspace.replaceAll("/", "\\"),
  ]);
  let result = command;
  for (const root of roots) {
    const escaped = root
      .replace(/[/\\]+$/u, "")
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    result = result.replace(new RegExp(`${escaped}[/\\\\]`, "giu"), "");
  }
  return result;
}

function searchQuery(command: string) {
  const tokens = commandParts(command);
  const explicit = tokens.findIndex((token) =>
    ["-e", "--regexp", "-pattern"].includes(token.toLowerCase()),
  );
  if (explicit >= 0) return tokens[explicit + 1];
  const valueFlags = new Set([
    "-g",
    "--glob",
    "-t",
    "--type",
    "-m",
    "--max-count",
    "-a",
    "-b",
    "-c",
    "--context",
    "--encoding",
    "-path",
    "-literalpath",
  ]);
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (valueFlags.has(token.toLowerCase())) {
      index += 1;
      continue;
    }
    if (!token.startsWith("-")) return token;
  }
  return undefined;
}

function readPaths(command: string, workspace?: string) {
  const tokens = commandParts(command);
  const verb = tokens[0]?.toLowerCase();
  const search = searchCommand.test(command);
  const pathFlags = new Set(["-literalpath", "-path"]);
  const valueFlags = new Set([
    "-encoding",
    "-totalcount",
    "-readcount",
    "-tail",
    "-head",
    "-g",
    "--glob",
    "-t",
    "--type",
    "-e",
    "--regexp",
    "-pattern",
    "-maxdepth",
    "-mindepth",
  ]);
  const paths: string[] = [];
  let skippedQuery = false;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^[;|&]$/u.test(token)) break;
    if (pathFlags.has(token.toLowerCase())) {
      if (tokens[index + 1])
        paths.push(relativeLocalPath(tokens[++index], workspace));
      continue;
    }
    if (
      valueFlags.has(token.toLowerCase()) ||
      (token === "-n" && ["head", "tail", "sed"].includes(verb || ""))
    ) {
      if (["-e", "--regexp", "-pattern"].includes(token.toLowerCase()))
        skippedQuery = true;
      index += 1;
      continue;
    }
    if (token.startsWith("-")) continue;
    if (search && !skippedQuery) {
      skippedQuery = true;
      continue;
    }
    if (verb === "git" && index === 1) continue;
    const looksLikeFile = /(?:^|[/\\])\.[^/\\]+$|\.[a-z0-9_-]+$/iu.test(token);
    const directRead = [
      "get-content",
      "gc",
      "cat",
      "type",
      "head",
      "tail",
    ].includes(verb || "");
    if ((looksLikeFile || directRead) && !/[;|&]$|[*?]/u.test(token))
      paths.push(relativeLocalPath(token, workspace));
  }
  return [...new Set(paths)];
}

function observedAgent(
  value: RecordedActivity["agent_json"],
): LocalActivityAgent | null {
  try {
    const parsed: unknown =
      typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object"
      ? (parsed as LocalActivityAgent)
      : null;
  } catch {
    return null;
  }
}

const basename = (path: string) => path.split("/").at(-1) || path;
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
    paths: [],
    command: null,
    agent: observedAgent(entry.agent_json),
  };
  const nativeKind = ["message", "command", "tool", "edit", "search"].includes(
    entry.kind ?? "",
  );
  if (
    !nativeKind &&
    (summary === run.error ||
      summary.startsWith("native session exited") ||
      // The store retains only 400 characters of a supervisor error row while
      // run.error keeps the full hook output. Match that recorded prefix only
      // for supervisor status rows, never assistant prose or tool commands.
      (entry.kind === "status" && !!run.error && run.error.startsWith(summary)))
  ) {
    return {
      ...result,
      kind: "failure",
      label: "Session failed",
      detail: null,
      summary: "Session failed · see error details",
    };
  }
  if (entry.kind === "message") {
    return { ...result, kind: "message", label: "ERA update",
      messageText: entry.message_text,
      messageExcerpt: entry.message_excerpt ?? (!entry.message_text && cappedSummary(summary)) };
  }
  if (entry.kind === "tool" && requestedTools[summary]) {
    return { ...result, ...requestedTools[summary], detail: null };
  }
  if (entry.kind === "tool") {
    return { ...result, label: "Tool requested" };
  }
  if (entry.kind === "edit") {
    // The store/provider cap can cut a path anywhere, including mid-directory.
    // A plausible suffix is still not evidence of a sixth complete filename.
    const completePaths = cappedSummary(summary)
      ? summary.slice(0, Math.max(0, summary.lastIndexOf(",")))
      : summary;
    const paths = entry.summary
      ? completePaths
          .split(/,\s*/u)
          .filter(Boolean)
          .map((path) => relativeLocalPath(path, run.workspace))
      : [];
    return {
      ...result,
      kind: "edit",
      label: paths.length
        ? `Edited ${basename(paths[0])}`
        : "File change recorded",
      detail: paths.length ? paths.join(", ") : result.detail,
      paths,
      station: "forge",
    };
  }
  if (entry.kind === "command") {
    const command = relativeCommand(unwrapLocalCommand(summary), run.workspace);
    const complete = cappedSummary(summary)
      ? completeCommandPrefix(command)
      : command;
    const reading = readCommand.test(command);
    const paths = reading ? readPaths(complete, run.workspace) : [];
    const search = searchCommand.test(command);
    const query = search
      ? searchQuery(complete)
      : commandParts(complete)
          .slice(1)
          .find((token) => !token.startsWith("-"));
    const target = paths.length
      ? basename(paths[0])
      : query || (cappedSummary(summary) ? null : command);
    return {
      ...result,
      kind: reading ? "read" : "command",
      label: reading
        ? target
          ? `${search ? "Searched" : "Read"} ${search && query ? query : target}`
          : search
            ? "Search completed"
            : "Read"
        : `Ran ${command}`,
      detail: paths.length ? paths.join(", ") : command,
      paths,
      command,
      station: reading
        ? "source"
        : checkCommand.test(command)
          ? "lab"
          : "forge",
    };
  }
  if (entry.kind === "search") {
    return {
      ...result,
      kind: "read",
      label: entry.summary ? `Searched ${summary}` : "Search completed",
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
  if (entry.kind === "status") {
    const startingCheck = /^(typecheck|lint|test|pm:lint) started$/u.exec(
      summary,
    );
    const supervisorStation: Record<string, LocalActivityStation> = {
      "Installing dependencies": "launch",
      "Committing candidate": "forge",
      "Hook: docs": "forge",
      "Hook: mirrors": "forge",
      "Hook: manifests": "forge",
      "Hook: typecheck": "forge",
      "Hook: tests": "forge",
      "Hook: lint": "forge",
      "Freezing handover": "review",
    };
    if (startingCheck || supervisorStation[summary])
      return {
        ...result,
        label: summary,
        detail: startingCheck?.[1] ?? null,
        station: startingCheck ? "lab" : supervisorStation[summary],
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
    ["preparing", "building", "checking", "accepting"].includes(run.phase);
  const waiting =
    !run.interrupted &&
    ["uat-ready", "acceptance-paused", "push-pending", "revert-push-pending"].includes(run.phase);
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
  } else if (run.phase === "accepting") {
    station = "lab";
    label = "Checking acceptance";
  } else {
    const labels: Record<string, string> = {
      "uat-ready": "Ready to test",
      "acceptance-paused": "Misses acceptance",
      stopped: "Stopped",
      merging: "Merging",
      "push-pending": "Push pending",
      failed: "Session failed",
      cancelled: "Cancelled",
      reverted: "Reverted",
      "revert-push-pending": "Revert pending",
    };
    label = labels[run.phase] || localRunLabel(run);
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
