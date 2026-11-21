import { afterAll, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  evaluate,
  format,
  readRange,
  readWorkingTree,
} from "../../scripts/os/eval.mjs";

const scratch = mkdtempSync(join(tmpdir(), "era-os-eval with spaces-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const cli = resolve("scripts/os/eval.mjs");
let sequence = 0;
function git(root: string, ...args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
function write(root: string, file: string, text: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}
function commit(root: string) {
  git(root, "add", "--all");
  git(
    root,
    "-c",
    "user.name=OS fixture",
    "-c",
    "user.email=os@example.invalid",
    "-c",
    "commit.gpgSign=false",
    "-c",
    "core.hooksPath=.no-hooks",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "OS fixture",
  );
  return git(root, "rev-parse", "HEAD");
}
function fixture() {
  const root = join(scratch, `fixture ${sequence++}`);
  mkdirSync(root);
  git(root, "init", "--quiet");
  write(root, "README.md", "fixture\n");
  return { root, base: commit(root) };
}
const run = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });

describe("A2 read-only Git range CLI", () => {
  it("evaluates staged, unstaged, deleted and untracked source without changing the index or HEAD", () => {
    const { root } = fixture();
    write(root, "src/components/Staged.tsx", "export const Staged = 1;\n");
    write(root, "src/components/Deleted.tsx", "console.log('old debt');\n");
    write(root, "src/components/Unstaged.tsx", "export const Old = 1;\n");
    const head = commit(root);
    write(root, "src/components/Staged.tsx", "console.log('staged');\n");
    git(root, "add", "src/components/Staged.tsx");
    write(root, "src/components/Unstaged.tsx", "console.warn('unstaged');\n");
    write(root, "src/components/New ü.tsx", "console.error('untracked');\n");
    rmSync(join(root, "src/components/Deleted.tsx"));
    const status = git(root, "status", "--porcelain"),
      index = readFileSync(join(root, ".git/index"));
    const context = readWorkingTree(root);
    expect(context).toMatchObject({ base: head, head, scope: "uncommitted" });
    expect(context.changes).toHaveLength(4);
    const report = evaluate(context),
      rule = report.rules.find((row) => row.rule === "HR-22")!;
    expect(rule.added).toBe(3);
    expect(rule.removed).toBe(1);
    expect(format(report)).toContain("uncommitted working tree");
    expect(readRange(root, `${head}..${head}`).changes).toHaveLength(0);
    expect(git(root, "status", "--porcelain")).toBe(status);
    expect(readFileSync(join(root, ".git/index")).equals(index)).toBe(true);
    expect(git(root, "rev-parse", "HEAD")).toBe(head);
  }, 60_000);
  it("handles a staged rename and refuses to follow a directory link replacing a tracked source", () => {
    const { root } = fixture();
    write(root, "src/components/Old.tsx", "console.log('old');\n");
    write(root, "src/components/Type.tsx", "export const Old = 1;\n");
    commit(root);
    mkdirSync(join(root, "src/lib"), { recursive: true });
    git(root, "mv", "src/components/Old.tsx", "src/lib/Moved.tsx");
    const privateDir = join(scratch, `private ${sequence++}`);
    mkdirSync(privateDir);
    writeFileSync(
      join(privateDir, "secret.tsx"),
      "PRIVATE CONTENT NEVER READ\n",
    );
    rmSync(join(root, "src/components/Type.tsx"));
    symlinkSync(privateDir, join(root, "src/components/Type.tsx"), "junction");
    const context = readWorkingTree(root);
    expect(
      context.changes.find((row) => row.file === "src/lib/Moved.tsx"),
    ).toMatchObject({
      status: "R",
      beforeFile: "src/components/Old.tsx",
      before: "console.log('old');\n",
      after: "console.log('old');\n",
    });
    expect(
      context.changes.find((row) => row.file === "src/components/Type.tsx"),
    ).toMatchObject({ after: null });
    expect(JSON.stringify(context)).not.toContain("PRIVATE CONTENT NEVER READ");
    expect(
      evaluate(context).rules.find((row) => row.rule === "HR-22"),
    ).toMatchObject({ verdict: "improved" });
  }, 60_000);
  it("catches the actual HR-22 violation introduced by repository commit bf0ee6ef", () => {
    const report = evaluate(readRange(resolve("."), "bf0ee6ef^..bf0ee6ef"));
    expect(report.rules.find((row) => row.rule === "HR-22")).toMatchObject({
      verdict: "fail",
      added: 1,
      file: "src/components/settings/SettingsDialog.tsx",
      line: 567,
      excerpt: 'console.error("Failed to set default income account:", error);',
    });
  }, 60_000);
  it("finds a known committed violation with exact line/excerpt, ignores dirty files and runs from subdirectories", () => {
    const { root, base } = fixture(),
      file = "src/components/Card ü with spaces.tsx";
    write(
      root,
      file,
      "export function Card() {\n  console.warn('known violation');\n  return null;\n}\n",
    );
    const head = commit(root);
    write(root, file, "export const clean = true;\n");
    const dirty = git(root, "status", "--porcelain");
    const result = run(join(root, "src"), `${base}..${head}`, "--json");
    expect(result.status, result.stderr).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.schema).toBe("os/evaluation@1");
    expect(report.rules).toHaveLength(21);
    expect(
      report.rules.find((row: { rule: string }) => row.rule === "HR-22"),
    ).toMatchObject({
      verdict: "fail",
      file,
      line: 2,
      excerpt: "console.warn('known violation');",
      side: "head",
      version: 1,
    });
    expect(git(root, "status", "--porcelain")).toBe(dirty);
    expect(readFileSync(join(root, file), "utf8")).toBe(
      "export const clean = true;\n",
    );
    expect(format(report)).toContain(
      `fail | HR-22 | ${JSON.stringify(file)}:2 [head]`,
    );
    const text = run(root, `${base}..${head}`);
    expect(text.status).toBe(1);
    expect(text.stdout).toContain("FAIL HR-22");
  }, 60_000);
  it("reports pass for an unrelated edit around old debt and improved when debt is removed", () => {
    const { root } = fixture(),
      file = "src/components/Card.tsx";
    write(root, file, "console.log('old');\n");
    const base = commit(root);
    write(root, file, "// unrelated\nconsole.log('old');\n");
    const edited = commit(root);
    const rule = (baseRef: string, head: string) =>
      evaluate(readRange(root, `${baseRef}..${head}`)).rules.find(
        (row) => row.rule === "HR-22",
      )!;
    expect(rule(base, edited).verdict).toBe("pass");
    write(root, file, "export const n = 1;\n");
    const fixed = commit(root);
    expect(rule(edited, fixed)).toMatchObject({
      verdict: "improved",
      line: 2,
      side: "base",
      removed: 1,
    });
  }, 60_000);
  it("handles renames into and out of client scope and deletion with base paths", () => {
    const { root } = fixture(),
      old = "src/components/Card.tsx",
      moved = "src/lib/Card.tsx";
    write(root, old, "console.log('old');\n");
    const base = commit(root);
    mkdirSync(dirname(join(root, moved)), { recursive: true });
    git(root, "mv", old, moved);
    const renamed = commit(root);
    const report = evaluate(readRange(root, `${base}..${renamed}`));
    expect(report.rules.find((row) => row.rule === "HR-22")).toMatchObject({
      verdict: "improved",
      file: old,
      side: "base",
    });
    expect(
      evaluate(readRange(root, `${renamed}..${base}`)).rules.find(
        (row) => row.rule === "HR-22",
      ),
    ).toMatchObject({ verdict: "fail", file: old });
    rmSync(join(root, moved));
    const deleted = commit(root);
    expect(readRange(root, `${renamed}..${deleted}`).changes[0]).toMatchObject({
      file: moved,
      after: null,
      status: "D",
    });
  }, 60_000);
  it("returns n/a/zero for empty and out-of-scope ranges", () => {
    const { root, base } = fixture();
    write(root, "README.md", "changed documentation\n");
    const head = commit(root);
    for (const range of [`${head}..${head}`, `${base}..${head}`]) {
      const result = run(root, range, "--json");
      expect(result.status, result.stderr).toBe(0);
      expect(
        JSON.parse(result.stdout).rules.every(
          (row: { verdict: string }) => row.verdict === "n/a",
        ),
      ).toBe(true);
    }
  }, 60_000);
  it("preserves binary metadata and UTF-8 source bytes in the batched range", () => {
    const { root, base } = fixture();
    mkdirSync(join(root, "src/components"), { recursive: true });
    const source = Buffer.from([0, 0xc3, 0xa9, 10]);
    writeFileSync(join(root, "src/components/Binary.tsx"), source);
    writeFileSync(join(root, "image.bin"), Buffer.from([0, 1, 2, 3]));
    write(root, "README.md", "changed documentation\n");
    const range = readRange(root, `${base}..${commit(root)}`);
    expect(
      range.changes.find(
        (change) => change.file === "src/components/Binary.tsx",
      ),
    ).toMatchObject({
      before: null,
      after: source.toString("utf8"),
      added: null,
      removed: null,
      hunks: [],
    });
    expect(
      range.changes.find((change) => change.file === "image.bin"),
    ).toMatchObject({
      before: null,
      after: "",
      added: null,
      removed: null,
      hunks: [],
    });
    expect(
      range.changes.find((change) => change.file === "README.md")?.after,
    ).toBe("");
  }, 60_000);
  it("keeps a regular-file to symlink type change as one change without reading its target", () => {
    const { root } = fixture(),
      file = "src/components/Type change.tsx";
    write(root, file, "export const old = 1;\n");
    const base = commit(root);
    const object = spawnSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: root,
      input: "private-target",
      encoding: "utf8",
    });
    expect(object.status).toBe(0);
    git(
      root,
      "update-index",
      "--cacheinfo",
      "120000",
      object.stdout.trim(),
      file,
    );
    git(
      root,
      "-c",
      "user.name=OS fixture",
      "-c",
      "user.email=os@example.invalid",
      "-c",
      "core.hooksPath=.no-hooks",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "--quiet",
      "-m",
      "type change",
    );
    const change = readRange(
      root,
      `${base}..${git(root, "rev-parse", "HEAD")}`,
    ).changes;
    expect(change).toHaveLength(1);
    expect(change[0]).toMatchObject({
      status: "T",
      before: "export const old = 1;\n",
      after: null,
      added: 1,
      removed: 1,
    });
    expect(JSON.stringify(change)).not.toContain("private-target");
  }, 60_000);
  it("refuses missing/invalid/three-dot/option-like ranges without evaluating a partial diff", () => {
    const { root } = fixture();
    for (const args of [
      [],
      ["HEAD...HEAD"],
      ["HEAD.."],
      ["unknown..HEAD"],
      ["--output=bad..HEAD"],
      ["HEAD..HEAD", "extra"],
    ]) {
      const result = run(root, ...args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("os:eval:");
      expect(result.stdout).toBe("");
    }
  }, 60_000);
});
