// Codex rollout adapter: verified local session_meta/turn_context/response_item
// and token_usage_record shapes, 2026-11-11. No native session is launched.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { short } from "../privacy.mjs";
import { shellReads } from "./claude.mjs";
import {
  safety,
  codeSignals,
  mobileWidth,
  commandsFromCode,
  normalizedPath,
  checkName,
  isEdit,
} from "./signals.mjs";
const time = (v) =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? new Date(v).toISOString()
    : null;
const count = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
function outputText(value) {
  if (typeof value === "string") {
    try {
      return outputText(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(outputText).join("\n");
  if (value && typeof value === "object")
    return [
      value.text,
      value.output,
      value.content,
      value.exit_code == null
        ? ""
        : "Process exited with code: " + value.exit_code,
    ]
      .filter((v) => v != null)
      .map(outputText)
      .join("\n");
  return "";
}
/** @param {string} file @param {string|null} expectedId */
export async function readCodex(file, expectedId = null) {
  let id = null,
    model = null,
    effort = null,
    worktree = null,
    branch = null,
    first = null,
    last = null,
    endedAt = null,
    turnId = null,
    visibilityBug = false,
    line = 0;
  const tools = new Map(),
    usageRows = new Map(),
    turns = new Set(),
    turnModels = new Map(),
    seen = new Set();
  let cumulative = null;
  for await (const raw of createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  })) {
    line++;
    if (!raw.trim()) continue;
    let row;
    try {
      row = JSON.parse(raw);
    } catch {
      throw new Error(
        "Invalid Codex transcript JSON at line " + line + "; no rows changed",
      );
    }
    const p = row.payload || {},
      at = time(row.timestamp);
    if (at) {
      first = first && first < at ? first : at;
      last = last && last > at ? last : at;
    }
    if (row.type === "session_meta") {
      const next = p.id || p.session_id;
      if (!next || (id && id !== next) || (expectedId && expectedId !== next))
        throw new Error("Codex session identity mismatch");
      id = next;
      worktree = short(p.cwd || "", 500);
      branch = p.git?.branch ? short(p.git.branch) : null;
    }
    if (row.type === "turn_context") {
      endedAt = null;
      model = p.model ? short(p.model) : model;
      effort = p.effort ? short(p.effort) : effort;
      if (p.turn_id) turns.add(p.turn_id);
      turnId = p.turn_id ?? `context:${line}`;
    }
    if (row.type === "event_msg" && p.type === "user_message")
      visibilityBug ||=
        /can.t see|cannot see|empty list|silently empty|partner.*(?:see|missing)/i.test(
          p.message || "",
        );
    if (
      row.type === "event_msg" &&
      /^(?:task_complete|turn_complete)$/.test(p.type)
    )
      endedAt = at;
    if (row.type === "token_usage_record") {
      if (p.session_id && id && p.session_id !== id)
        throw new Error("Codex token session identity mismatch");
      if (p.response_id && p.usage) usageRows.set(p.response_id, p.usage);
      if (p.thread_token_usage) cumulative = p.thread_token_usage;
    }
    if (
      row.type === "event_msg" &&
      p.type === "token_count" &&
      p.info?.total_token_usage
    )
      cumulative = p.info.total_token_usage;
    if (row.type !== "response_item") continue;
    if (
      turnId &&
      model &&
      (p.role === "assistant" ||
        /^(?:function_call|custom_tool_call)$/.test(p.type))
    )
      turnModels.set(turnId, { model, effort });
    if (/^(?:function_call|custom_tool_call)$/.test(p.type)) {
      if (!p.call_id || tools.has(p.call_id)) continue;
      const name = [p.namespace, p.name].filter(Boolean).join(".");
      let args = {};
      try {
        args = JSON.parse(p.arguments || "{}");
      } catch {
        /* unsupported args stay unknown */
      }
      const code = p.input || "",
        commands = /exec$/.test(name)
          ? commandsFromCode(code)
          : args.cmd
            ? [args.cmd]
            : args.command
              ? [args.command]
              : [];
      const reads = commands
        .flatMap(shellReads)
        .map((f) => normalizedPath(f, worktree));
      const edit = isEdit(name) || /\btools\.apply_patch\s*\(/.test(code);
      const signals = safety(name, commands.join("\n"));
      const nested = codeSignals(code);
      for (const key of Object.keys(nested)) signals[key] ||= nested[key];
      signals.approval ||=
        args.sandbox_permissions === "require_escalated" ||
        /sandbox_permissions\s*:\s*["']require_escalated/.test(code);
      tools.set(p.call_id, {
        id: short(p.call_id),
        tool: short(name, 100),
        order: tools.size,
        startedAt: at,
        durationMs: null,
        completed: false,
        failed: null,
        edit,
        mobileWidth: mobileWidth(name, args),
        target: args.file_path
          ? normalizedPath(args.file_path, worktree)
          : null,
        reads,
        signals,
        check: commands.length === 1 ? checkName(commands[0]) : null,
        exitCode: null,
      });
    }
    if (/^(?:function_call_output|custom_tool_call_output)$/.test(p.type)) {
      const tool = tools.get(p.call_id);
      if (!tool || tool.completed) continue;
      const out = outputText(p.output),
        exit = /(?:Exit code|Process exited with code):?\s*(\d+)/i.exec(out);
      tool.completed = true;
      tool.failed =
        /Script failed|"isError"\s*:\s*true|"is_error"\s*:\s*true/.test(
          out + " " + JSON.stringify(p.output),
        );
      tool.exitCode = exit ? Number(exit[1]) : null;
      if (tool.exitCode && tool.reads.length) tool.failed = true;
      tool.durationMs =
        at && tool.startedAt
          ? Math.max(0, Date.parse(at) - Date.parse(tool.startedAt))
          : null;
    }
    if (
      p.type === "message" &&
      p.role === "assistant" &&
      p.id &&
      !seen.has(p.id)
    )
      seen.add(p.id);
  }
  if (!id)
    throw new Error("Not a supported Codex rollout: missing session_meta");
  const timeline = [...tools.values()],
    firstEdit = timeline.findIndex((t) => t.edit),
    skills = [],
    reads = [];
  const modelCounts = new Map();
  for (const value of turnModels.values()) {
    const count = modelCounts.get(value.model) ?? {
      turns: 0,
      efforts: new Map(),
    };
    count.turns++;
    count.efforts.set(value.effort, (count.efforts.get(value.effort) ?? 0) + 1);
    modelCounts.set(value.model, count);
  }
  const dominant = [...modelCounts].sort((a, b) => b[1].turns - a[1].turns)[0];
  if (dominant) {
    model = dominant[0];
    effort =
      [...dominant[1].efforts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  for (const tool of timeline)
    if (tool.completed && !tool.failed)
      for (const path of tool.reads) {
        reads.push({
          path,
          order: tool.order,
          beforeFirstEdit: firstEdit < 0 || tool.order < firstEdit,
        });
        const skill =
          /(?:^|\/)(?:\.claude|\.agents|\.codex)\/skills\/([^/]+)\/SKILL\.md$/.exec(
            path,
          )?.[1];
        if (skill)
          skills.push({
            name: skill,
            via: "read",
            at: tool.startedAt,
            order: tool.order,
          });
      }
  // Per-response usage is incremental; cumulative event counters must never be summed.
  const counters = {
    input_tokens: "input_tokens",
    cache_read_input_tokens: "cached_input_tokens",
    cache_creation_input_tokens: "cache_write_input_tokens",
    output_tokens: "output_tokens",
    reasoning_output_tokens: "reasoning_output_tokens",
  };
  const source = usageRows.size
    ? [...usageRows.values()]
    : cumulative
      ? [cumulative]
      : [];
  const usage = Object.fromEntries(
    Object.entries(counters).map(([key, provider]) => [
      key,
      source.length && source.every((r) => count(r[provider]) !== null)
        ? source.reduce((sum, r) => sum + r[provider], 0)
        : null,
    ]),
  );
  return {
    mobileEvidence: timeline.some(
      (t) => t.completed && !t.failed && t.mobileWidth === 390,
    )
      ? { width: 390 }
      : null,
    id,
    model,
    effort,
    worktree,
    branch,
    startedAt: first,
    lastObservedAt: last,
    endedAt,
    visibilityBug,
    coverage: "transcript",
    skills,
    reads,
    timeline: timeline.map(({ reads: _reads, check: _check, ...t }) => t),
    usage,
    turns: turns.size || null,
    hooks: [],
    checks: timeline
      .filter((t) => t.check)
      .map((t) => ({
        schema: "os/check@1",
        id: t.id,
        name: t.check,
        source: "transcript",
        exitCode: t.exitCode,
        durationMs: t.durationMs,
        completed: t.completed,
        toolError: t.failed,
      })),
  };
}
