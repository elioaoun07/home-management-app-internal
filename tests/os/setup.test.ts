import { afterAll, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { toolPaths } from "../../scripts/agent-tool-paths.mjs";

const root = resolve(".");
const scratch = mkdtempSync(join(tmpdir(), "era-a0-with spaces-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
function copy(file: string, target: string) {
  mkdirSync(dirname(join(target, file)), { recursive: true });
  cpSync(join(root, file), join(target, file), { recursive: true });
}
function fixture(name: string) {
  const dir = join(scratch, name);
  for (const file of [".claude/skills", ".claude/hooks", ".claude/settings.json", "CLAUDE.md",
    "scripts/sync-ai-mirrors.mjs", "scripts/check-feature-index.mjs", "scripts/agent-tool-paths.mjs",
    "scripts/run-agent-hook.mjs", "scripts/os", "ERA Notes/01 - Architecture/Feature Map/_index.md"]) copy(file, dir);
  return dir;
}
function sync(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [join(dir, "scripts/sync-ai-mirrors.mjs"), ...args], { cwd: join(dir, "scripts"), encoding: "utf8" });
}
const bash = process.platform === "win32"
  ? resolve(spawnSync("git", ["--exec-path"], { encoding: "utf8" }).stdout.trim(), "../../..", "bin/bash.exe")
  : "bash";

describe("A0 generated setup", () => {
  it("generates byte-equal trees from a different cwd and detects drift without rewriting it", () => {
    const dir = fixture("parity");
    expect(sync(dir).status).toBe(0);
    for (const [source, target] of [[".claude/skills", ".agents/skills"], [".claude/hooks", ".codex/hooks"]]) {
      for (const file of readdirSync(join(dir, source), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())) {
        const relative = join(file.parentPath, file.name).slice(join(dir, source).length + 1);
        expect(readFileSync(join(dir, target, relative)).equals(readFileSync(join(dir, source, relative)))).toBe(true);
      }
    }
    expect(sync(dir, "--check").status).toBe(0);
    const drift = join(dir, ".agents/skills/cache-invalidation/SKILL.md");
    writeFileSync(drift, "stale skill");
    const result = sync(dir, "--check");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".agents/skills/cache-invalidation/SKILL.md");
    expect(readFileSync(drift, "utf8")).toBe("stale skill");
    expect(sync(dir).status).toBe(0);
    writeFileSync(join(dir, ".codex/hooks/block-ui-dir.sh"), "stale hook");
    expect(sync(dir, "--check").stderr).toContain(".codex/hooks/block-ui-dir.sh");
    writeFileSync(join(dir, ".codex/settings.json"), "{}");
    expect(sync(dir, "--check").stderr).toContain("obsolete hook config");
    writeFileSync(join(dir, ".codex/hooks/dead.sh"), "dead");
    expect(sync(dir, "--check").stderr).toContain("unexpected");
  });

  it("runs the generated guard from a subdirectory in a repo path containing spaces", () => {
    const dir = fixture("portable");
    expect(sync(dir).status).toBe(0);
    expect(spawnSync("git", ["init", dir]).status).toBe(0);
    const config = JSON.parse(readFileSync(join(dir, ".codex/hooks.json"), "utf8"));
    const command = config.hooks.PreToolUse[0].hooks[0].command;
    const call = (input: object) => spawnSync(bash, ["-c", command], {
      cwd: join(dir, "scripts"), input: JSON.stringify(input), encoding: "utf8",
    });
    for (const input of [
      { tool_input: { file_path: "C:\\repo\\src\\components\\ui\\button.tsx" } },
      { file_path: "src/components/ui/button.tsx" },
      { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: src/allowed.ts\n*** Move to: src/components/ui/moved.ts\n*** End Patch" } },
    ]) {
      const result = call(input);
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("Blocked: src/components/ui/");
    }
    expect(call({ tool_input: { file_path: "src/components/allowed.tsx" } }).status).toBe(0);
    const malformed = spawnSync(bash, ["-c", command], { cwd: dir, input: "invalid", encoding: "utf8" });
    expect(malformed.status).toBe(2);
    expect(call({ tool_input: {} }).status).toBe(2);
    if (process.platform === "win32") {
      const windows = spawnSync("powershell", ["-NoProfile", "-Command", config.hooks.PreToolUse[0].hooks[0].commandWindows], {
        cwd: join(dir, "scripts"), input: JSON.stringify({ tool_input: { file_path: "src/components/ui/button.tsx" } }), encoding: "utf8",
      });
      expect(windows.status, windows.stderr).toBe(2);
      expect(windows.stderr).toContain("Blocked: src/components/ui/");
    }
    expect(toolPaths({ tool_name: "apply_patch", tool_input: { command: "*** Delete File: src/other/../components/ui/x.ts" } })).toEqual(["src/components/ui/x.ts"]);
  }, 15_000); // Eight native shell launches exceed Vitest's 5 s default on Windows.

  it("Git invokes the executable pre-commit, and failed checks reject an isolated commit", () => {
    const dir = join(scratch, "commit");
    for (const file of [".husky/pre-commit", ".claude/hooks/pre-commit.sh"]) copy(file, dir);
    mkdirSync(join(dir, ".husky/_"), { recursive: true });
    cpSync(join(root, "node_modules/husky/husky.sh"), join(dir, ".husky/_/husky.sh"));
    mkdirSync(join(dir, "bin"));
    writeFileSync(join(dir, "bin/pnpm"), '#!/bin/sh\necho "$*" >> checks.log\n[ "$*" != "$A0_FAIL_CHECK" ]\n', { mode: 0o755 });
    const git = (...args: string[]) => spawnSync("git", ["-c", "user.name=A0 fixture", "-c", "user.email=a0@example.invalid", "-c", "commit.gpgSign=false", ...args], {
      cwd: dir, encoding: "utf8", env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path")),
        NODE_ENV: process.env.NODE_ENV,
        PATH: `${join(dir, "bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? process.env.Path}`,
        HOME: dir, USERPROFILE: dir, HUSKY: "1", A0_FAIL_CHECK: "sync:ai:check",
      },
    });
    expect(git("init").status).toBe(0);
    expect(git("config", "core.hooksPath", ".husky").status).toBe(0);
    expect(git("add", ".husky/pre-commit").status).toBe(0);
    expect(git("update-index", "--chmod=+x", ".husky/pre-commit").status).toBe(0);
    const rejected = git("commit", "-m", "must fail");
    expect(rejected.status).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain("Generated agent setup drifted");
    expect(readFileSync(join(dir, "checks.log"), "utf8").trim().split(/\r?\n/)).toEqual(["docs:check", "sync:ai:check"]);
    writeFileSync(join(dir, "bin/pnpm"), '#!/bin/sh\necho "$*" >> checks.log\nif [ "$1" = eslint ]; then [ "$#" -eq 4 ] && [ "$4" = "src/a file.ts" ]; fi\n', { mode: 0o755 });
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a file.ts"), "export {};\n");
    expect(git("add", "src/a file.ts").status).toBe(0);
    expect(git("commit", "-m", "hook passed").status).toBe(0);
    expect(readFileSync(join(dir, "checks.log"), "utf8")).toContain("tsc --noEmit\ntest");
    expect(existsSync(join(dir, ".git/HEAD"))).toBe(true);
  });
});
