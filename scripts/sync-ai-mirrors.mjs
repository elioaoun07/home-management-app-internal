import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toolPaths } from "./agent-tool-paths.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const checkOnly = process.argv.includes("--check");

const targets = ["CODEX.md", "AGENTS.md", ".github/copilot-instructions.md"];
const header = "<!-- AUTO-GENERATED FROM CLAUDE.md -- DO NOT EDIT DIRECTLY. Edit CLAUDE.md instead. -->";

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

if (process.argv.includes("--hook")) {
  const input = await readStdin();
  let paths = [];

  try {
    const payload = JSON.parse(input);
    // Claude Code PostToolUse hooks deliver the path under tool_input;
    // keep the legacy top-level fallback for other callers.
    paths = toolPaths(payload);
  } catch {
    process.exit(0);
  }

  if (!paths.some((path) => /(^|\/)CLAUDE\.md$|(^|\/)\.claude\//.test(path))) {
    process.exit(0);
  }
}

const check = spawnSync(process.execPath, ["scripts/check-feature-index.mjs"], {
  encoding: "utf8",
  stdio: "inherit",
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

const claude = readFileSync("CLAUDE.md", "utf8");
const content = `${header}\n\n${claude}`;

const outputs = new Map(targets.map((target) => [target, content]));
function mirrorTree(source, target) {
  for (const entry of readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const from = `${source}/${entry.name}`;
    const to = `${target}/${entry.name}`;
    if (entry.isDirectory()) mirrorTree(from, to);
    else if (entry.isFile()) outputs.set(to, readFileSync(from));
  }
}
mirrorTree(".claude/skills", ".agents/skills");
mirrorTree(".claude/hooks", ".codex/hooks");

// Codex reads hooks.json, not settings.json. Keep event/matcher parity; the
// launcher resolves the repo and Git Bash without a machine-specific path.
const { hooks } = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
const codexHooks = structuredClone(hooks);
for (const [event, groups] of Object.entries(codexHooks)) {
  groups.forEach((group, groupIndex) => group.hooks.forEach((hook, hookIndex) => {
    delete hook.shell;
    hook.command = `node "$(git rev-parse --show-toplevel)/scripts/run-agent-hook.mjs" ${event} ${groupIndex} ${hookIndex}`;
    // PowerShell otherwise maps a native exit 2 to exit 1, which Codex treats
    // as a hook error rather than a deny. Preserve the blocking status.
    hook.commandWindows = `& node (Join-Path (git rev-parse --show-toplevel) 'scripts/run-agent-hook.mjs') ${event} ${groupIndex} ${hookIndex}; exit $LASTEXITCODE`;
  }));
}
outputs.set(".codex/hooks.json", `${JSON.stringify({ description: "Generated from .claude/settings.json by pnpm sync:ai; do not edit.", hooks: codexHooks }, null, 2)}\n`);

const drift = [];
function checkExtras(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) checkExtras(path);
    else if (!outputs.has(path)) drift.push(`${path} (unexpected; remove stale generated copy)`);
  }
}
checkExtras(".agents/skills");
checkExtras(".codex/hooks");
if (existsSync(".codex/settings.json")) drift.push(".codex/settings.json (obsolete hook config)");
for (const [target, bytes] of outputs) {
  if (existsSync(target) && readFileSync(target).equals(Buffer.from(bytes))) continue;
  if (checkOnly) drift.push(target);
  else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

if (drift.length) {
  console.error(`AI setup drift:\n${drift.map((file) => `  ${file}`).join("\n")}\nRun pnpm sync:ai.`);
  process.exit(1);
}

console.log(`AI setup ${checkOnly ? "verified" : "synced"}: ${targets.length} instruction mirrors, ${readdirSync(".claude/skills").length} skills, ${readdirSync(".claude/hooks").length} hooks, 1 Codex config.`);
