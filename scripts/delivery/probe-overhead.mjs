#!/usr/bin/env node
// Measure the FIXED per-spawn context overhead of a delivery agent session.
//
// Why this exists (DLV-35, doc 7 "Cost Anatomy"):
// A delivery session makes ~40 model calls, and every one re-sends the system
// prompt, the tool definitions, CLAUDE.md and any attached MCP tool schemas.
// That fixed cost was invisible — the only way to observe it was to run a real
// session and read the bill afterwards. Forensics on the 2026-07-25 smoke tests
// found 16-36 unused MCP tools (Gmail/Supabase/Chrome) riding along on 10 of 13
// turns, plus ~10.2K tokens of CLAUDE.md, on a doc-only task.
//
// This issues ONE `maxTurns: 1` query that does no work ("Reply with exactly:
// OK") and reports what it cost to merely EXIST. Cache-creation tokens are the
// number that matters: they are what a fresh spawn pays to write its prefix, and
// they are billed at 2x base input on the 1-hour cache Claude Code uses.
//
// Usage:
//   node scripts/delivery/probe-overhead.mjs                  # proposed (current code) options
//   node scripts/delivery/probe-overhead.mjs --baseline       # pre-DLV-33 options, for A/B
//   node scripts/delivery/probe-overhead.mjs --mode=build
//   node scripts/delivery/probe-overhead.mjs --model=claude-haiku-4-5 --json
//
// Cost: a fraction of a cent per run. It never writes to the repo, never
// persists a session, and permits no tool use.

import { buildSessionOptions } from "./drivers/claude.mjs";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const mode = valueOf("mode", "readonly");
const model = valueOf("model", "claude-haiku-4-5");
const baseline = has("--baseline");
const asJson = has("--json");

/**
 * The options this driver used BEFORE DLV-33 — `strictMcpConfig`/`skills` unset
 * and no build-mode allowlist, so the CLI loaded every MCP server, every skill
 * description and every built-in tool. Kept here purely so the improvement can
 * be measured rather than asserted.
 */
function baselineOptions() {
  const options = { cwd: process.cwd(), permissionMode: mode === "build" ? "acceptEdits" : "default" };
  if (mode === "readonly") {
    options.tools = ["Read", "Grep", "Glob"];
    options.disallowedTools = ["Write", "Edit", "Bash", "NotebookEdit"];
  } else {
    options.disallowedTools = [];
  }
  return options;
}

function probeOptions() {
  if (baseline) return baselineOptions();
  // Strip the enforcement callback: canUseTool would reject everything anyway
  // (the probe uses no tools) and it is not part of the context cost. Deleted
  // rather than destructured-and-discarded so no unused binding is created —
  // buildSessionOptions returns a fresh object per call, so this mutates nothing
  // shared.
  const options = buildSessionOptions({ mode, cwd: process.cwd(), model });
  delete options.canUseTool;
  return options;
}

function usageOf(messages) {
  const result = messages.find((m) => m && m.type === "result");
  const u = (result && result.usage) || {};
  const creation = u.cache_creation || {};
  return {
    input: u.input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheCreation: u.cache_creation_input_tokens || 0,
    cacheCreation1h: creation.ephemeral_1h_input_tokens || 0,
    cacheCreation5m: creation.ephemeral_5m_input_tokens || 0,
    output: u.output_tokens || 0,
    costUsd: result && typeof result.total_cost_usd === "number" ? result.total_cost_usd : null,
    tools: (messages.find((m) => m && m.type === "system" && m.subtype === "init") || {}).tools || [],
  };
}

async function main() {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const options = { ...probeOptions(), model, maxTurns: 1, persistSession: false, effort: "low" };

  const messages = [];
  for await (const message of query({ prompt: "Reply with exactly: OK", options })) {
    messages.push(message);
  }
  const u = usageOf(messages);
  const mcpTools = u.tools.filter((t) => String(t).startsWith("mcp__"));
  // Everything the spawn had to establish before it could answer a 6-token prompt.
  const fixedOverhead = u.input + u.cacheRead + u.cacheCreation;

  if (asJson) {
    console.log(JSON.stringify({ variant: baseline ? "baseline" : "current", mode, model, ...u, mcpToolCount: mcpTools.length, fixedOverhead }, null, 2));
    return;
  }

  console.log(`\nper-spawn overhead — ${baseline ? "BASELINE (pre-DLV-33)" : "CURRENT"} · mode=${mode} · ${model}`);
  console.log(`  input              ${String(u.input).padStart(9)}`);
  console.log(`  cache read         ${String(u.cacheRead).padStart(9)}`);
  console.log(`  cache creation     ${String(u.cacheCreation).padStart(9)}   (1h ${u.cacheCreation1h} / 5m ${u.cacheCreation5m})`);
  console.log(`  output             ${String(u.output).padStart(9)}`);
  console.log(`  ---------------------------------`);
  console.log(`  FIXED OVERHEAD     ${String(fixedOverhead).padStart(9)} tokens`);
  console.log(`  reported cost      ${u.costUsd == null ? "unavailable" : "$" + u.costUsd.toFixed(6)}`);
  console.log(`  tools advertised   ${u.tools.length} (${mcpTools.length} MCP)`);
  if (mcpTools.length) {
    console.log(`  ⚠ MCP tools attached — strictMcpConfig is not taking effect:`);
    for (const t of mcpTools.slice(0, 8)) console.log(`      ${t}`);
    if (mcpTools.length > 8) console.log(`      … and ${mcpTools.length - 8} more`);
  }
  console.log(`\n  × ~40 model calls per session ≈ ${(fixedOverhead * 40).toLocaleString()} tokens of fixed cost\n`);
}

main().catch((err) => {
  console.error(`probe failed: ${(err && err.message) || err}`);
  process.exitCode = 1;
});
