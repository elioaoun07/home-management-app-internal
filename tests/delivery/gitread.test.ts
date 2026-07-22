import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ALLOWED_SUBCOMMANDS,
  GitReadError,
  gitDiff,
  gitForEachRef,
  gitLog,
  gitRevParseHead,
  gitShow,
  gitStatusPorcelain,
  runGitRead,
} from "../../scripts/delivery/gitread.mjs";

describe("ALLOWED_SUBCOMMANDS is the complete read-only set", () => {
  it("matches the doc 4 §3 allowlist exactly", () => {
    expect([...ALLOWED_SUBCOMMANDS].sort()).toEqual(
      ["diff", "for-each-ref", "log", "rev-parse", "show", "status"].sort(),
    );
  });
});

describe("runGitRead: allowlist invariant", () => {
  it("throws before spawning anything for every non-read subcommand", () => {
    const spy = vi.fn();
    const illegal = [
      "worktree",
      "branch",
      "checkout",
      "switch",
      "add",
      "commit",
      "push",
      "pull",
      "fetch",
      "merge",
      "rebase",
      "reset",
      "restore",
      "stash",
      "tag",
      "config",
    ];
    for (const sub of illegal) {
      expect(() => runGitRead([sub], { execFileSync: spy })).toThrow(GitReadError);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires a non-empty args array", () => {
    expect(() => runGitRead([])).toThrow(GitReadError);
    expect(() => runGitRead(undefined as unknown as string[])).toThrow(GitReadError);
  });

  it("re-throws an exec failure with git's stderr and exit code in the message", () => {
    const execError = Object.assign(new Error("Command failed: git status --porcelain"), {
      status: 128,
      stderr: "fatal: Unable to create '.git/index.lock': File exists.\n",
    });
    const spy = vi.fn(() => {
      throw execError;
    });
    expect(() => runGitRead(["status", "--porcelain"], { execFileSync: spy })).toThrow(
      /git status --porcelain failed \(exit 128\): fatal: Unable to create/,
    );
    try {
      runGitRead(["status", "--porcelain"], { execFileSync: spy });
    } catch (err) {
      expect(err).toBeInstanceOf(GitReadError);
      expect((err as Error & { cause?: unknown }).cause).toBe(execError);
    }
  });

  it("invokes git only for allowed subcommands, forwarding cwd and args", () => {
    const spy = vi.fn().mockReturnValue("output");
    const out = runGitRead(["status", "--porcelain"], { execFileSync: spy, cwd: "/repo" });
    expect(out).toBe("output");
    expect(spy).toHaveBeenCalledWith("git", ["status", "--porcelain"], {
      cwd: "/repo",
      encoding: "utf8",
    });
  });
});

describe("read-only helper wrappers", () => {
  it("gitStatusPorcelain", () => {
    const spy = vi.fn().mockReturnValue(" M file.ts\n");
    expect(gitStatusPorcelain({ execFileSync: spy })).toBe(" M file.ts\n");
    expect(spy).toHaveBeenCalledWith(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      expect.any(Object),
    );
  });

  it("gitRevParseHead trims the output", () => {
    const spy = vi.fn().mockReturnValue("abc123\n");
    expect(gitRevParseHead({ execFileSync: spy })).toBe("abc123");
  });

  it("gitForEachRef", () => {
    const spy = vi.fn().mockReturnValue("refs...");
    expect(gitForEachRef({ execFileSync: spy })).toBe("refs...");
    expect(spy).toHaveBeenCalledWith("git", ["for-each-ref"], expect.any(Object));
  });

  it("gitDiff forwards extra args", () => {
    const spy = vi.fn().mockReturnValue("diff...");
    gitDiff(["--stat", "HEAD~1"], { execFileSync: spy });
    expect(spy).toHaveBeenCalledWith("git", ["diff", "--stat", "HEAD~1"], expect.any(Object));
  });

  it("gitLog forwards extra args", () => {
    const spy = vi.fn().mockReturnValue("log...");
    gitLog(["-1"], { execFileSync: spy });
    expect(spy).toHaveBeenCalledWith("git", ["log", "-1"], expect.any(Object));
  });

  it("gitShow forwards extra args", () => {
    const spy = vi.fn().mockReturnValue("show...");
    gitShow(["HEAD"], { execFileSync: spy });
    expect(spy).toHaveBeenCalledWith("git", ["show", "HEAD"], expect.any(Object));
  });
});

// ---- Repo-wide invariant (doc 6 §2): gitread.mjs is the ONLY git invocation
// point under scripts/delivery/, and the word "worktree" appears nowhere in
// that tree — by construction there is nothing to blocklist.
describe("repo-wide invariant: scripts/delivery/ never manages git state outside gitread.mjs", () => {
  const TEST_DIR = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(TEST_DIR, "..", "..", "scripts", "delivery");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) out.push(...walk(abs));
      else if (/\.mjs$/i.test(name)) out.push(abs);
    }
    return out;
  }

  const files = walk(ROOT);

  it("found at least the expected S1 module set (sanity check the walk itself works)", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  // S2 legitimately spawns child processes for two non-git purposes: the
  // runner process itself (server-routes.mjs) and the validation commands
  // `pnpm typecheck/lint/test` (run-session.mjs) — neither touches git. The
  // real invariant (doc 6 §3 DoD #9) is narrower than "no child_process
  // import anywhere": no file outside gitread.mjs ever spawns "git".
  it('no file outside gitread.mjs spawns "git" as a process', () => {
    const gitSpawnPattern = /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync)\s*\(\s*["']git["']/;
    for (const file of files) {
      if (file.endsWith("gitread.mjs")) continue;
      const text = readFileSync(file, "utf8");
      expect(gitSpawnPattern.test(text)).toBe(false);
    }
  });

  it('no file anywhere under scripts/delivery/ contains the literal string "worktree"', () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      expect(text.includes("worktree")).toBe(false);
    }
  });
});
