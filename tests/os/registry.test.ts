import { afterAll, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fingerprint, scan, writeSnapshot, readSnapshot } from "../../scripts/os/scan.mjs";
import { check, conflicts, CLASSES } from "../../scripts/os/check.mjs";

const repo = resolve("."), scratch = mkdtempSync(join(tmpdir(), "era-os-a1 with spaces-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let sequence = 0;
const header = "<!-- AUTO-GENERATED FROM CLAUDE.md -- DO NOT EDIT DIRECTLY. Edit CLAUDE.md instead. -->";
function write(root: string, file: string, text: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}
function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}
function fixture(guard = true) {
  const root = join(scratch, `fixture-${sequence++}`);
  mkdirSync(root);
  const rules = `# Setup\n\n## Hard Rules\n${Array.from({ length: 29 }, (_, i) => `${i + 1}. Rule ${i + 1}`).join("\n")}\n\n## Other\n`;
  write(root, "CLAUDE.md", rules);
  for (const target of ["CODEX.md", "AGENTS.md", ".github/copilot-instructions.md"]) write(root, target, `${header}\n\n${rules}`);
  const hooks = guard ? { PreToolUse: [{ hooks: [{ type: "command", command: "bash .claude/hooks/guard.sh" }] }] } : {};
  write(root, ".claude/settings.json", JSON.stringify({ permissions: { deny: ["mcp__claude_ai_Supabase__*", "mcp__Supabase__*"] }, hooks }));
  write(root, ".codex/hooks.json", JSON.stringify({ hooks: guard ? { PreToolUse: [{ hooks: [{ type: "command",
    command: 'node "$(git rev-parse --show-toplevel)/scripts/run-agent-hook.mjs" PreToolUse 0 0',
    commandWindows: "& node (Join-Path (git rev-parse --show-toplevel) 'scripts/run-agent-hook.mjs') PreToolUse 0 0; exit $LASTEXITCODE",
  }] }] } : {} }));
  if (guard) for (const file of [".claude/hooks/guard.sh", ".codex/hooks/guard.sh"]) write(root, file, "#!/bin/sh\n# enforces: HR-26\nexit 2\n");
  write(root, "package.json", JSON.stringify({ scripts: { "os:scan": "node scripts/os/scan.mjs", "os:check": "node scripts/os/check.mjs" } }));
  symlinkSync(join(repo, "node_modules"), join(root, "node_modules"), "junction");
  for (const file of ["scripts/os/scan.mjs", "scripts/os/check.mjs", "scripts/os/forms.mjs", "scripts/os/review-requirements.mjs", "scripts/os/launch-settings.mjs", "scripts/os/detector-support.mjs", "scripts/pm/shared/frontmatter.mjs"]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(repo, file), join(root, file));
  }
  git(root, "init", "--quiet");
  git(root, "-c", "user.name=OS fixture", "-c", "user.email=os@example.invalid", "-c", "commit.gpgSign=false", "-c", "core.hooksPath=.no-hooks", "commit", "--quiet", "--allow-empty", "-m", "fixture");
  return root;
}
function config(root: string, source: string, update: (value: Record<string, unknown>) => void) {
  const value = JSON.parse(readFileSync(join(root, source), "utf8"));
  update(value);
  write(root, source, JSON.stringify(value));
}
function rows(root: string, code: string) { return conflicts(scan(root), root).filter((row: { code: string }) => row.code === code); }

describe("A1 registry and read-only CLI", () => {
  it("is clean without a cache, fingerprints content rather than time/commit/CRLF, and works from a subdirectory", () => {
    const root = fixture(), first = scan(root);
    expect(check(root).rows).toEqual([]);
    expect(check(root).exitCode).toBe(0);
    expect(first.schema).toBe("os/setup@1");
    expect(first.entities.filter((entity: { id: string }) => /^HR-\d+$/.test(entity.id))).toHaveLength(29);
    expect(scan(root).fingerprint).toBe(first.fingerprint);
    expect(fingerprint({ ...first, generatedAt: "tomorrow", commit: "another" })).toBe(first.fingerprint);
    for (const file of ["CLAUDE.md", "CODEX.md", "AGENTS.md", ".github/copilot-instructions.md"]) write(root, file, readFileSync(join(root, file), "utf8").replaceAll("\n", "\r\n"));
    expect(scan(root).fingerprint).toBe(first.fingerprint);
    const run = (script: string) => spawnSync(process.execPath, [join(root, "scripts/os", script)], { cwd: join(root, "scripts"), encoding: "utf8" });
    expect(run("scan.mjs").status).toBe(0);
    expect(readSnapshot(root).fingerprint).toBe(first.fingerprint);
    expect(readFileSync(join(root, ".os/setup.sha256"), "utf8").trim()).toBe(first.fingerprint);
    expect(run("check.mjs").status).toBe(0);
    const target = ".github/copilot-instructions.md";
    write(root, target, "injected drift\n");
    const result = run("check.mjs");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("MIRROR");
    expect(result.stdout).toContain("DRIFT");
    expect(readFileSync(join(root, target), "utf8")).toBe("injected drift\n");
    expect(readSnapshot(root).fingerprint).toBe(first.fingerprint);
    expect(run("scan.mjs").status).toBe(0);
    expect(run("check.mjs").status).toBe(1); // Rebuilding never hides a conflict.
  });

  it("refuses unknown versions, corrupt fingerprints, missing inputs and malformed JSON", () => {
    const root = fixture(), setup = scan(root);
    writeSnapshot(setup, root);
    write(root, ".os/setup.sha256", "wrong\n");
    expect(check(root).rows.some((row: { code: string }) => row.code === "DRIFT")).toBe(true);
    write(root, ".os/setup.json", JSON.stringify({ ...setup, schema: "os/setup@99" }));
    expect(() => check(root)).toThrow("Unsupported registry version");
    write(root, ".os/setup.json", JSON.stringify({ ...setup, fingerprint: "wrong" }));
    expect(() => check(root)).toThrow("fingerprint");
    rmSync(join(root, ".os/setup.json"));
    write(root, ".claude/settings.json", "{");
    expect(check(root).exitCode).toBe(1);
    expect(check(root).rows).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INPUT", message: "Invalid JSON" })]));
    rmSync(join(root, "package.json"));
    expect(check(root).rows).toEqual(expect.arrayContaining([expect.objectContaining({ source: "package.json", code: "INPUT" })]));
  });

  it("keeps rule tombstones and hashes supporting skill assets without exposing local credentials", () => {
    const root = fixture(), previous = scan(root);
    write(root, "CLAUDE.md", readFileSync(join(root, "CLAUDE.md"), "utf8").replace("29. Rule 29\n", ""));
    expect(scan(root, previous).entities.find((entity: { id: string }) => entity.id === "HR-29").retired).toBe(true);
    write(root, ".claude/skills/example/SKILL.md", "---\nname: example\ndescription: A fixture\n---\n# Example\n");
    const before = scan(root).fingerprint;
    write(root, ".claude/skills/example/reference.txt", "reference");
    write(root, ".claude/settings.local.json", JSON.stringify({ permissions: { allow: ["Bash(SECRET_FIXTURE_TOKEN)"] } }));
    const after = scan(root);
    expect(after.fingerprint).not.toBe(before);
    expect(JSON.stringify(after)).not.toContain("SECRET_FIXTURE_TOKEN");
    expect(after.entities.find((entity: { kind: string }) => entity.kind === "skill").description).toBe("A fixture");
  });
});

describe("A1 conflict classes, isolated repositories", () => {
  it("MIRROR: injected instruction drift produces exactly one row", () => {
    const root = fixture(); write(root, "AGENTS.md", "stale");
    expect(rows(root, "MIRROR")).toEqual([expect.objectContaining({ source: "AGENTS.md", severity: "error" })]);
    write(root, "AGENTS.md", `${header}\n\n${readFileSync(join(root, "CLAUDE.md"), "utf8")}`);
    write(root, ".claude/skills/example/reference.txt", "source\n");
    write(root, ".agents/skills/example/reference.txt", "source\r\n");
    expect(rows(root, "MIRROR")).toEqual([expect.objectContaining({ source: ".agents/skills/example/reference.txt", severity: "error" })]);
  });
  it("PARITY: a blocking local guard missing for Codex is an error", () => {
    const root = fixture();
    write(root, ".claude/hooks/extra.sh", "#!/bin/sh\nexit 2\n");
    write(root, ".codex/hooks/extra.sh", "#!/bin/sh\nexit 2\n");
    write(root, ".claude/settings.local.json", JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: "bash .claude/hooks/extra.sh" }] }] } }));
    expect(rows(root, "PARITY")).toEqual([expect.objectContaining({ severity: "error" })]);
  });
  it("reads Codex's actual mirrored guard instead of assuming the source still blocks", () => {
    const root = fixture();
    write(root, ".codex/hooks/guard.sh", "#!/bin/sh\n# enforces: HR-26\nexit 0\n");
    expect(scan(root).entities.find((entity: { kind: string; agent?: string }) => entity.kind === "hook" && entity.agent === "codex").blocking).toBe(false);
    expect(rows(root, "MIRROR")).toHaveLength(1);
    expect(rows(root, "PARITY")).toEqual([expect.objectContaining({ severity: "error" })]);
  });
  it("PORTABLE: recognizes absolute paths and Windows-only permissions", () => {
    const root = fixture(); config(root, ".claude/settings.json", (value) => { value.permissions = { allow: ["Bash(C:\\Users\\owner\\guard.sh)", "PowerShell(pnpm test)"] }; });
    expect(rows(root, "PORTABLE")).toHaveLength(2);
  });
  it("DUPLICATE: two different hook configurations claim Codex", () => {
    const root = fixture(); write(root, ".codex/settings.json", JSON.stringify({ hooks: { Stop: [] } }));
    expect(rows(root, "DUPLICATE")).toHaveLength(1);
  });
  it("DEAD: an unreachable script and Git's non-executable index mode are visible", () => {
    const root = fixture();
    write(root, ".claude/hooks/dead.sh", "#!/bin/sh\nexit 0\n");
    write(root, ".husky/pre-commit", "#!/bin/sh\nexit 0\n");
    git(root, "add", ".husky/pre-commit"); git(root, "update-index", "--chmod=-x", ".husky/pre-commit");
    expect(rows(root, "DEAD")).toHaveLength(2);
  });
  it("NAME-BOUND: missing namespace fails; wildcard coverage is accepted", () => {
    const root = fixture();
    config(root, ".claude/settings.json", (value) => { value.permissions = { deny: ["mcp__claude_ai_Supabase__execute_sql"] }; });
    expect(rows(root, "NAME-BOUND")).toHaveLength(1);
    config(root, ".claude/settings.json", (value) => { value.permissions = { deny: ["mcp__*Supabase__*"] }; });
    expect(rows(root, "NAME-BOUND")).toHaveLength(0);
  });
  it("SOFT-CLAIM: header declarations are links; reminder text is not a declaration", () => {
    const root = fixture();
    write(root, "scripts/check.mjs", '// enforces: HR-24\nprocess.stdout.write("Hard Rule #1 reminder");\n');
    config(root, "package.json", (value) => { value.scripts = { check: "node scripts/check.mjs" }; });
    expect(rows(root, "SOFT-CLAIM")).toEqual([expect.objectContaining({ rule: "HR-24" })]);
    expect(scan(root).entities.find((entity: { id: string }) => entity.id === "HR-1").enforcedBy).toEqual([]);
  });
  it("CONTRADICTION: compares owned module enumerations", () => {
    const root = fixture();
    write(root, "CLAUDE.md", "## Hard Rules\n1. A rule\n### Junction Modules\n| Junction | Connects |\n| --- | --- |\n| Meal Planning | Recipes |\n## Feature Index\n| Feature | Paths | Vault | Type |\n| --- | --- | --- | --- |\n| Meal Planning | path | doc | Standalone |\n");
    expect(rows(root, "CONTRADICTION")).toEqual([expect.objectContaining({ message: "Meal Planning: Junction table vs Feature Index (Standalone)" })]);
  });
  it("SHADOW: an instruction basename has another role", () => {
    const root = fixture(); write(root, "ERA Notes/CODEX.md", "A checklist");
    expect(rows(root, "SHADOW")).toHaveLength(1);
  });
  it("STALE-REF: literal missing/archived references, not templates", () => {
    const root = fixture();
    write(root, ".claude/skills/example/SKILL.md", "---\nname: example\n---\n[missing](missing.md)\n[old](<../../../ERA Notes/_Archive/old.md>)\n`migrations/YYYY-MM-DD_description.sql`\n");
    expect(rows(root, "STALE-REF")).toHaveLength(2);
  });
  it("UNLOADED: reports empty launch settings without running a provider", () => {
    const root = fixture(); write(root, "scripts/delivery-v2/profiles/local.json", '{"skills": [], "settingSources": []}');
    expect(rows(root, "UNLOADED")).toHaveLength(1);
  });
  it("TRACKED-LOCAL: checks Git tracking rather than a file's name alone", () => {
    const root = fixture(); write(root, ".claude/settings.local.json", "{}");
    expect(rows(root, "TRACKED-LOCAL")).toHaveLength(0);
    git(root, "add", "-f", ".claude/settings.local.json");
    expect(rows(root, "TRACKED-LOCAL")).toHaveLength(1);
  });
  it("keeps workstation permissions visible without making the shared setup nonportable", () => {
    const root = fixture();
    write(root, ".claude/settings.local.json", JSON.stringify({ permissions: { allow: ["PowerShell(pnpm test)", "Bash(C:\\Users\\owner\\guard.sh)"] } }));
    expect(rows(root, "PORTABLE")).toEqual([expect.objectContaining({ severity: "info", message: "2 workstation-specific permission entries" })]);
    config(root, ".claude/settings.json", (value) => { (value.permissions as { allow: string[] }).allow = ["PowerShell(pnpm test)"]; });
    expect(rows(root, "PORTABLE")).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "error", source: ".claude/settings.json:permissions.allow[0]" })]));
  });
  it("recognizes a generated mirror of the wired pre-commit script, while drift remains visible", () => {
    const root = fixture();
    write(root, ".husky/pre-commit", "bash .claude/hooks/pre-commit.sh\n");
    for (const directory of [".claude", ".codex"]) write(root, `${directory}/hooks/pre-commit.sh`, "#!/bin/sh\nexit 0\n");
    expect(rows(root, "DEAD")).toEqual([]);
    write(root, ".codex/hooks/pre-commit.sh", "#!/bin/sh\nexit 1\n");
    expect(rows(root, "MIRROR")).toEqual(expect.arrayContaining([expect.objectContaining({ source: ".codex/hooks/pre-commit.sh" })]));
    expect(rows(root, "DEAD")).toEqual(expect.arrayContaining([expect.objectContaining({ source: ".codex/hooks/pre-commit.sh" })]));
  });
  it("reports a referenced hook script that has disappeared", () => {
    const root = fixture();
    rmSync(join(root, ".claude/hooks/guard.sh"));
    expect(rows(root, "INPUT")).toEqual(expect.arrayContaining([expect.objectContaining({
      severity: "error", source: ".claude/hooks/guard.sh", message: "Required setup source is missing",
    })]));
  });
  it("preserves advisory limits and warns if their rule is incorrectly promoted", () => {
    const root = fixture();
    write(root, "scripts/check.mjs", "// enforces: HR-24\n");
    config(root, "package.json", (value) => { value.scripts = { check: "node scripts/check.mjs" }; });
    const setup = scan(root);
    expect(conflicts(setup, root)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOFT-CLAIM", rule: "HR-24", severity: "info" })]));
    setup.entities.find((entity: { id: string }) => entity.id === "HR-24").level = "checked";
    expect(conflicts(setup, root)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOFT-CLAIM", rule: "HR-24", severity: "warning" })]));
  });
  it("shows explicit review requirements without claiming automated coverage", () => {
    const setup = scan(fixture());
    for (const id of ["HR-2", "HR-4", "HR-16", "HR-21"]) {
      expect(setup.entities.find((entry: { id: string }) => entry.id === id)).toMatchObject({
        level: "documented", enforcedBy: [], review: { required: true, verify: expect.any(String), source: expect.any(String) },
      });
    }
  });
  it("flags a literal model introduced into a skill", () => {
    const root = fixture();
    write(root, ".claude/skills/example/SKILL.md", "---\nname: example\n---\nUse Sonnet 5.5 with medium effort.\n");
    expect(rows(root, "TIER-LITERAL")).toEqual([expect.objectContaining({
      severity: "warning", source: ".claude/skills/example/SKILL.md",
    })]);
  });
  it("recognizes confined settings only with the boundary and the Local project-loading branch", () => {
    const root = fixture();
    const source = "scripts/delivery-v2/adapters/claude.mjs";
    const body = `function buildSessionOptions({ local }) {
      const options = { skills: [], settingSources: [], strictMcpConfig: true,
        canUseTool: buildCanUseTool({}), sandbox: { enabled: true, failIfUnavailable: true } };
      if (local) { options.skills = "all"; options.settingSources = ["project"]; }
      return options;
    }`;
    write(root, source, body);
    expect(rows(root, "UNLOADED")).toEqual([expect.objectContaining({ severity: "info" })]);
    write(root, source, body.replace('options.settingSources = ["project"]', 'options.settingSources = []'));
    expect(rows(root, "UNLOADED")).toEqual([expect.objectContaining({ severity: "warning" })]);
    write(root, source, body.replace("failIfUnavailable: true", "failIfUnavailable: false"));
    expect(rows(root, "UNLOADED")).toEqual([expect.objectContaining({ severity: "warning" })]);
    write(root, source, '// skills: []\nconst text = "settingSources: []";');
    expect(rows(root, "UNLOADED")).toEqual([]);
  });
  it("keeps unknown tracked-local decisions actionable and the documented owner choice visible", () => {
    const root = fixture();
    write(root, ".claude/settings.local.json", "{}");
    git(root, "add", "-f", ".claude/settings.local.json");
    expect(rows(root, "TRACKED-LOCAL")).toEqual([expect.objectContaining({ severity: "warning" })]);
    write(root, "docs/Skills-and-Agents.md", "`.claude/settings.local.json` remains committed by\nowner choice (2026-11-10).\n");
    expect(rows(root, "TRACKED-LOCAL")).toEqual([expect.objectContaining({ severity: "info" })]);
  });
  it("BASELINE: reports recorded evidence only; no measurement is fabricated in A1", () => {
    const root = fixture(), setup = scan(root);
    expect(Object.keys(CLASSES)).toHaveLength(16); // A6 adds the three form/tier diagnostics.
    expect(conflicts(setup, root).filter((row: { code: string }) => row.code === "BASELINE")).toEqual([]);
    setup.entities.push({ id: "fixture:recorded", kind: "detector", source: "fixture.json", baseline: 3 });
    expect(conflicts(setup, root).filter((row: { code: string }) => row.code === "BASELINE")).toEqual([expect.objectContaining({ severity: "info", message: "3 recorded baseline violations" })]);
    expect(check(root).exitCode).toBe(0);
    expect(existsSync(join(root, ".os"))).toBe(false);
  });
});

it("matches the hand inventory at e5f537a, independently of A0's working changes", () => {
  const root = fixture(false);
  const paths = spawnSync("git", ["ls-tree", "-r", "--name-only", "e5f537a", "CLAUDE.md", "AGENTS.md", "CODEX.md", ".claude", ".agents", ".codex", ".github", ".husky/pre-commit", "package.json", "ERA Notes/CODEX.md", "ERA Notes/Model-Registry.md"], { cwd: repo, encoding: "utf8" });
  expect(paths.status).toBe(0);
  for (const file of paths.stdout.trim().split("\n")) {
    const content = spawnSync("git", ["show", `e5f537a:${file}`], { cwd: repo, encoding: "utf8" });
    expect(content.status, file).toBe(0);
    write(root, file, content.stdout);
  }
  const setup = scan(root), kind = (name: string) => setup.entities.filter((entity: { kind: string }) => entity.kind === name);
  expect(kind("rule").filter((entity: { id: string }) => /^HR-/.test(entity.id))).toHaveLength(29);
  expect(kind("skill").filter((entity: { agents: string[] }) => entity.agents.includes("claude"))).toHaveLength(18);
  expect(kind("skill").filter((entity: { agents: string[] }) => entity.agents.includes("codex"))).toHaveLength(2);
  expect(kind("hook").filter((entity: { agent: string }) => entity.agent === "claude")).toHaveLength(8);
  expect(setup.inventory.hookFiles.filter((file: string) => file.startsWith(".claude/"))).toHaveLength(7);
  expect(setup.inventory.hookFiles.filter((file: string) => file.startsWith(".codex/"))).toHaveLength(5);
  expect(kind("permission").filter((entity: { source: string }) => entity.source === ".claude/settings.json")).toHaveLength(22);
  expect(kind("permission").filter((entity: { source: string; action: string }) => entity.source === ".claude/settings.json" && entity.action === "deny")).toHaveLength(20);
  expect(kind("permission").filter((entity: { source: string }) => entity.source === ".claude/settings.local.json")).toHaveLength(226);
  expect(kind("instruction").filter((entity: { source: string }) => entity.source !== "ERA Notes/CODEX.md")).toHaveLength(7);
  expect(conflicts(setup, root).some((row: { code: string }) => row.code === "SHADOW")).toBe(true);
  expect(kind("check").filter((entity: { runs: string[] }) => entity.runs.includes("CI"))).toHaveLength(5);
  expect(setup.inventory.subagents).toHaveLength(0);
  expect(setup.inventory.commands).toHaveLength(0);
  for (const name of ["docs:check", "pwa:check", "pm:lint", "pm:check-docs", "db:verify-rls", "era:capabilities"]) expect(kind("check").some((entity: { name: string }) => entity.name === name)).toBe(true);
  expect(kind("tier")).toHaveLength(6);
}, 30_000);
