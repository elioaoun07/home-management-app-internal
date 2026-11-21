import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tierAlias, pmFacts } from "./item.mjs";
import { sessionScorecard } from "./scorecard.mjs";
import { readCodex } from "./ingest/codex.mjs";
import { readClaude } from "./ingest/claude.mjs";
import { eventFile, gitFact } from "./runtime.mjs";
import { assertVersion, openStore } from "./store.mjs";
import { evaluate, readRange, readWorkingTree } from "./eval.mjs";

/** @param {{root: string, transcript: string, sessionId?: string|null, range?: string|null, agent?:string, itemId?:string|null, tier?:string|null, workingTree?:boolean}} input */
export async function ingest({
  root,
  transcript,
  sessionId = null,
  range = null,
  agent = "claude",
  itemId = null,
  tier = null,
  workingTree = false,
}) {
  const marker = resolve(root, ".os/recorder-unavailable");
  const markerBefore = existsSync(marker) ? readFileSync(marker, "utf8") : null;
  if (!["claude", "codex"].includes(agent))
    throw new Error("Unsupported agent");
  const facts = await (agent === "codex" ? readCodex : readClaude)(
    transcript,
    sessionId,
  );
  const file = eventFile(root, facts.id);
  const runnerEvents = existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const event = assertVersion(JSON.parse(line), "os/event@1");
          if (event.sessionId !== facts.id)
            throw new Error("Event session identity mismatch");
          return event;
        })
    : [];
  const events = [
    ...new Map(runnerEvents.map((row) => [row.id, row])).values(),
  ];
  const start = events.find((row) => row.event === "SessionStart");
  const stop = events.filter((row) => row.event === "Stop").at(-1);
  const warnings = [];
  if (!start)
    warnings.push(
      "Recorder unavailable at session start: historical setup and base commit unknown",
    );
  if (!stop)
    warnings.push("No runner Stop observed; session completion unknown");
  if (existsSync(resolve(root, ".os/recorder-unavailable")))
    warnings.push(
      "Recorder failure marker present; hook coverage may be incomplete",
    );
  for (const row of events)
    if (row.recorderWarning || row.event === "unavailable")
      warnings.push(row.recorderWarning ?? row.message);
  const selectedRange =
    range ??
    (start?.git?.head && stop?.git?.head
      ? `${start.git.head}..${stop.git.head}`
      : null);
  const uncommitted =
    workingTree &&
    !range &&
    stop?.git?.dirty &&
    start?.git?.head &&
    start.git.head === stop.git.head;
  // A lifecycle with no commit still contains the actual work. Only evaluate
  // that snapshot while HEAD still matches the recorded Stop; a later import
  // must not attribute another session's tree to this flight.
  const context =
    uncommitted && gitFact(root, "rev-parse", "HEAD") === stop.git.head
      ? readWorkingTree(root, stop.git.head)
      : selectedRange
        ? readRange(root, selectedRange)
        : null;
  const evaluation = context ? evaluate(context) : null;
  if (!evaluation)
    warnings.push(
      "Rule verdicts unavailable: supply --range <base>..<head> for historical sessions",
    );
  if (context?.scope === "uncommitted")
    warnings.push(
      "Uncommitted working-tree snapshot: verdicts include pre-existing dirty changes",
    );
  else if (start?.git?.dirty || stop?.git?.dirty)
    warnings.push(
      "Dirty worktree observed: verdicts cover committed range only",
    );
  const session = {
    schema: "os/session@1",
    id: facts.id,
    agent,
    itemId,
    tier,
    coverage: facts.coverage,
    visibilityBug: facts.visibilityBug,
    mobileEvidence: facts.mobileEvidence,
    model: facts.model,
    effort: facts.effort,
    startedAt: start?.timestamp ?? facts.startedAt,
    endedAt: stop
      ? !stop.blocked && stop.exitCode === 0
        ? stop.timestamp
        : null
      : (facts.endedAt ?? null),
    lastObservedAt: facts.lastObservedAt,
    branch: start?.git?.branch ?? facts.branch,
    worktree: start?.git?.worktree ?? facts.worktree,
    setup: start?.setup ?? null,
    base: evaluation?.base ?? start?.git?.head ?? null,
    head: evaluation?.head ?? stop?.git?.head ?? null,
    rangeSource: range
      ? "explicit import range"
      : evaluation
        ? context.scope === "uncommitted"
          ? "runner lifecycle: uncommitted working tree"
          : "runner lifecycle"
        : null,
    skills: facts.skills,
    reads: facts.reads,
    timeline: facts.timeline,
    usage: facts.usage,
    turns: facts.turns,
    outcome: "unrecorded",
    warnings,
    ingestedAt: new Date().toISOString(),
  };
  // Transcript summaries are fallback evidence only; do not double-count a
  // runner-covered Stop. Historical exit codes stay unknown.
  if (!stop) events.push(...facts.hooks);
  const items = itemId ? pmFacts(root) : [];
  const item = items.find((i) => i.id === itemId) || {};
  session.tier = tier ?? tierAlias(root, session.model);
  session.itemClass = {
    kind: item.kind ?? null,
    effort: item.effort ?? null,
    risk: context
      ? context.changes.some((c) =>
          /balance|money|accounts|transactions|recurr|migrations/.test(c.file),
        )
      : null,
  };
  const store = openStore(root);
  try {
    const record = {
      session,
      events,
      checks: facts.checks,
      verdicts: evaluation?.rules ?? [],
    };
    session.changeFacts =
      context?.changes.map(({ file, beforeFile, added, removed, hunks }) => ({
        beforeFile,
        hunks,
        file,
        added,
        removed,
      })) ?? null;
    session.scorecard = sessionScorecard(
      record,
      context?.changes ?? null,
      item,
    );
    store.put(record);
    // A successful durable ingest establishes recovery. Preserve an outage
    // that began after this import observed the marker.
    if (
      markerBefore !== null &&
      (!stop || (!stop.blocked && stop.exitCode === 0)) &&
      existsSync(marker) &&
      readFileSync(marker, "utf8") === markerBefore
    )
      unlinkSync(marker);
  } finally {
    store.close();
  }
  return session;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      transcript = args.shift();
    let sessionId = null,
      range = null,
      agent = "claude",
      itemId = null,
      tier = null,
      workingTree = false;
    while (args.length) {
      const flag = args.shift();
      if (flag === "--working-tree") {
        workingTree = true;
        continue;
      }
      const value = args.shift();
      if (
        !value ||
        !["--session", "--range", "--agent", "--item", "--tier"].includes(flag)
      )
        throw new Error("Unsupported ingest arguments");
      if (flag === "--session") sessionId = value;
      else if (flag === "--range") range = value;
      else if (flag === "--agent") agent = value;
      else if (flag === "--item") itemId = value;
      else tier = value;
    }
    if (!transcript)
      throw new Error(
        "Usage: pnpm os:ingest <transcript.jsonl> [--agent claude|codex] [--item ID] [--tier ALIAS] [--session <id>] [--range <base>..<head>]",
      );
    const root = gitFact(process.cwd(), "rev-parse", "--show-toplevel");
    if (!root) throw new Error("Run from a Git worktree");
    const session = await ingest({
      root,
      transcript: resolve(transcript),
      sessionId,
      range,
      agent,
      itemId,
      tier,
      workingTree,
    });
    process.stdout.write(
      `Ingested ${session.id}; pnpm os:report ${session.id}\n`,
    );
  } catch (error) {
    process.stderr.write(`os:ingest: ${error.message}\n`);
    process.exitCode = 2;
  }
}
