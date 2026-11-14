import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [event, groupIndex, hookIndex] = process.argv.slice(2);
const { hooks } = JSON.parse(readFileSync(resolve(root, ".claude/settings.json"), "utf8"));
const hook = hooks[event]?.[groupIndex]?.hooks[hookIndex];
if (!hook || hook.type !== "command") throw new Error("Unknown agent hook");

let bash = "bash";
if (process.platform === "win32") {
  // Avoid System32/bash.exe (WSL). Use the Bash belonging to this Git install.
  const git = spawnSync("git", ["--exec-path"], { encoding: "utf8", cwd: root });
  if (git.status !== 0) throw new Error("Git for Windows is required for agent hooks");
  bash = resolve(git.stdout.trim(), "../../..", "bin/bash.exe");
  if (!existsSync(bash)) throw new Error("Git Bash is required for agent hooks");
}
const result = spawnSync(bash, ["-c", hook.command.replaceAll(".claude/hooks/", ".codex/hooks/")], {
  cwd: root,
  env: { ...process.env, CLAUDE_PROJECT_DIR: root, OS_AGENT: "codex" },
  stdio: "inherit",
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
