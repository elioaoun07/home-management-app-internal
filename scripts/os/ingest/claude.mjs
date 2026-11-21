import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { safety, normalizedPath, mobileWidth } from "./signals.mjs";
import { short } from "../privacy.mjs";

const timestamp = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
const number = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
const checkName = (command) =>
  /^(?:pnpm|npm run) (typecheck|lint|test|pm:lint|docs:check|os:check)(?:\s+[\w./:@=-]+)*(?:\s+2>&1)?\s*$/.exec(
    command.trim(),
  )?.[1] ?? null;
const normalize = (file) => short(file?.replaceAll("\\", "/"), 500);

// Only known read commands and literal filenames, never commands or their output.
export function shellReads(command) {
  const paths = [];
  for (const match of command.matchAll(
    /(?:^|[;&|\n])\s*(?:cat|Get-Content)\s+([^;|\n]+)/gi,
  )) {
    for (const token of match[1].matchAll(/"([^"]+)"|'([^']+)'|([^\s,]+)/g)) {
      const file = token[1] ?? token[2] ?? token[3];
      if (/\.(?:md|json)$/i.test(file) && !/[$`*<>]/.test(file))
        paths.push(normalize(file));
    }
  }
  return paths;
}

export async function readClaude(transcript, expectedId = null) {
  const tools = new Map(),
    usages = new Map(),
    turns = new Set(),
    turnModels = new Map(),
    seen = new Set(),
    hooks = [];
  let visibilityBug = false;
  let id = expectedId,
    first = null,
    last = null,
    branch = null,
    worktree = null,
    model = null,
    line = 0;
  for await (const raw of createInterface({
    input: createReadStream(transcript),
    crlfDelay: Infinity,
  })) {
    line++;
    if (!raw.trim()) continue;
    let row;
    try {
      row = JSON.parse(raw);
    } catch {
      throw new Error(
        `Invalid transcript JSON at line ${line}; no rows changed`,
      );
    }
    // Sidechains have their own context/counters and do not belong to this session.
    if (row.isSidechain) continue;
    if (row.sessionId) {
      id ??= row.sessionId;
      if (row.sessionId !== id)
        throw new Error("Transcript session identity mismatch");
    }
    if (row.uuid && seen.has(row.uuid)) continue;
    if (row.uuid) seen.add(row.uuid);
    const at = timestamp(row.timestamp);
    if (at) {
      if (!first || at < first) first = at;
      if (!last || at > last) last = at;
    }
    branch ??= row.gitBranch ? short(row.gitBranch) : null;
    worktree ??= row.cwd ? normalize(row.cwd) : null;
    if (row.type === "user" && typeof row.message?.content === "string")
      visibilityBug ||=
        /(?:can.t see|cannot see|empty list|silently empty|works for (?:one|me)|partner.*(?:missing|see))/i.test(
          row.message.content,
        );
    if (row.type === "assistant") {
      const messageId = row.message?.id;
      if (messageId) turns.add(messageId);
      if (messageId && row.message?.model)
        turnModels.set(messageId, short(row.message.model));
      // Streaming content blocks repeat the same message/usage. Keep one reading.
      if (messageId && row.message?.usage)
        usages.set(messageId, row.message.usage);
      for (const block of Array.isArray(row.message?.content)
        ? row.message.content
        : [])
        if (block.type === "tool_use" && !tools.has(block.id)) {
          const input = block.input ?? {},
            name = short(block.name, 100);
          const reads =
            name === "Read"
              ? [normalize(input.file_path)]
              : /^(Bash|PowerShell)$/.test(name)
                ? shellReads(input.command ?? "")
                : [];
          const skill = name === "Skill" ? short(input.skill, 100) : null;
          tools.set(block.id, {
            id: short(block.id),
            tool: name,
            target: input.file_path ? normalize(input.file_path) : null,
            mobileWidth: mobileWidth(name, input),
            signals: safety(name, input.command ?? ""),
            edit: /^(Edit|Write|NotebookEdit)$/.test(name),
            order: tools.size,
            startedAt: at,
            durationMs: null,
            completed: false,
            failed: null,
            reads: reads.filter(Boolean),
            skill,
            check: /^(Bash|PowerShell)$/.test(name)
              ? checkName(input.command ?? "")
              : null,
            exitCode: null,
          });
        }
    }
    for (const block of Array.isArray(row.message?.content)
      ? row.message.content
      : [])
      if (block.type === "tool_result") {
        const tool = tools.get(block.tool_use_id);
        if (!tool || tool.completed) continue;
        tool.completed = true;
        tool.failed = block.is_error === true;
        tool.durationMs =
          at && tool.startedAt
            ? Math.max(0, Date.parse(at) - Date.parse(tool.startedAt))
            : null;
        // No inferred zero exit status from an arbitrary successful shell tool.
        const text = typeof block.content === "string" ? block.content : "";
        const exit =
          /(?:^|\n)(?:Exit code|Process exited with code):?\s*(\d+)\b/i.exec(
            text,
          );
        tool.exitCode = exit ? Number(exit[1]) : null;
      }
    if (row.type === "system" && row.subtype === "stop_hook_summary") {
      for (const [index, info] of (row.hookInfos ?? []).entries()) {
        const hook =
          /(?:\/hooks\/)([\w.-]+\.sh)\b/.exec(info.command ?? "")?.[1] ??
          "unidentified hook";
        hooks.push({
          schema: "os/event@1",
          id: `transcript:${row.uuid ?? line}:${index}`,
          source: "transcript",
          event: "Stop",
          hook,
          timestamp: at,
          durationMs: number(info.durationMs),
          exitCode: null,
          blocked: row.preventedContinuation === true,
          message: "Historical hook summary; exit code not recorded",
        });
      }
    }
  }
  if (typeof id !== "string" || !id || id.length > 200)
    throw new Error("Transcript has no supported session identity");
  const timeline = [...tools.values()];
  // Count complete assistant messages, not streaming fragments or the final
  // housekeeping model. A trailing cheap turn must not relabel the whole flight.
  const modelCounts = new Map();
  for (const value of turnModels.values())
    modelCounts.set(value, (modelCounts.get(value) ?? 0) + 1);
  model = [...modelCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const firstEdit = timeline.findIndex((tool) =>
    /^(Edit|Write|NotebookEdit)$/.test(tool.tool),
  );
  const reads = [],
    skills = [];
  for (const [index, tool] of timeline.entries())
    if (tool.completed && !tool.failed) {
      for (const path of tool.reads) {
        reads.push({
          order: index,
          path: normalizedPath(path, worktree),
          beforeFirstEdit: firstEdit < 0 || index < firstEdit,
        });
        const skill =
          /(?:^|\/)(?:\.claude|\.agents)\/skills\/([^/]+)\/SKILL\.md$/.exec(
            path,
          )?.[1];
        if (skill)
          skills.push({
            name: skill,
            via: "read",
            at: tool.startedAt,
            order: index,
          });
      }
      if (tool.skill)
        skills.push({
          name: tool.skill,
          via: "Skill",
          at: tool.startedAt,
          order: index,
        });
    }
  const counters = [
    "input_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
    "output_tokens",
  ];
  const usage = Object.fromEntries(
    counters.map((key) => [
      key,
      usages.size &&
      [...usages.values()].every((row) => number(row[key]) !== null)
        ? [...usages.values()].reduce((sum, row) => sum + row[key], 0)
        : null,
    ]),
  );
  const checks = timeline
    .filter((tool) => tool.check)
    .map((tool) => ({
      schema: "os/check@1",
      id: tool.id,
      name: tool.check,
      source: "transcript",
      exitCode: tool.exitCode,
      durationMs: tool.durationMs,
      completed: tool.completed,
      toolError: tool.failed,
    }));
  return {
    mobileEvidence: timeline.some(
      (t) => t.completed && !t.failed && t.mobileWidth === 390,
    )
      ? { width: 390 }
      : null,
    coverage: "transcript",
    visibilityBug,
    id,
    startedAt: first,
    lastObservedAt: last,
    branch,
    worktree,
    model,
    effort: null,
    skills,
    reads,
    timeline: timeline.map(
      ({ reads: _reads, skill: _skill, check: _check, ...tool }) => tool,
    ),
    usage,
    turns: turns.size || null,
    hooks,
    checks,
  };
}
