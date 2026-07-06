import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

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
  let filePath = "";

  try {
    const payload = JSON.parse(input);
    // Claude Code PostToolUse hooks deliver the path under tool_input;
    // keep the legacy top-level fallback for other callers.
    filePath = payload.tool_input?.file_path ?? payload.file_path ?? "";
  } catch {
    process.exit(0);
  }

  if (!filePath.endsWith("CLAUDE.md")) {
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

for (const target of targets) {
  writeFileSync(target, content);
}

console.log("Synced CLAUDE.md -> CODEX.md, AGENTS.md, .github/copilot-instructions.md");
