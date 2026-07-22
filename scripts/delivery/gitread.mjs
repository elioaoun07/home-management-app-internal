// scripts/delivery/gitread.mjs
// Read-only git wrapper — the ONLY module in this tooling permitted to invoke
// git. Enforces the owner's permanent hard constraint ("no git-state-changing
// action, ever") by construction: an allowlist of read-only subcommands, not a
// blocklist. Anything not explicitly listed throws, with no exceptions.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §3.
//
// Zero-dependency: node:child_process builtin only. No other module under
// scripts/delivery/ may import node:child_process for git — grep-tested.

import { execFileSync } from "node:child_process";

/** The complete set of permitted git subcommands. Nothing else may ever run. */
export const ALLOWED_SUBCOMMANDS = Object.freeze([
  "status",
  "diff",
  "log",
  "show",
  "rev-parse",
  "for-each-ref",
]);

export class GitReadError extends Error {}

/**
 * Run a read-only git command. Throws GitReadError before ever spawning a
 * process if `args[0]` is not in the allowlist.
 * @param {string[]} args - full argv after `git`, e.g. ["status", "--porcelain"]
 * @param {{cwd?:string, execFileSync?:Function, encoding?:string}} [options]
 * @returns {string} stdout
 */
export function runGitRead(args, options = {}) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new GitReadError("a git subcommand is required");
  }
  const subcommand = args[0];
  if (!ALLOWED_SUBCOMMANDS.includes(subcommand)) {
    throw new GitReadError(
      `git subcommand not permitted by the read-only allowlist: "${subcommand}"`,
    );
  }
  const exec = options.execFileSync || execFileSync;
  const cwd = options.cwd || process.cwd();
  try {
    return exec("git", args, {
      cwd,
      encoding: options.encoding || "utf8",
    });
  } catch (err) {
    // execFileSync's generic "Command failed: git …" message drops the part
    // that says WHY (git's stderr + exit code / killing signal). Re-throw with
    // both attached so a crash log or BLOCKED gate names the actual failure
    // (s-20260722-221533-wous died on a bare "Command failed: git status").
    const stderr = err && err.stderr ? String(err.stderr).trim() : "";
    const exit = err && err.status != null ? `exit ${err.status}` : err && err.signal ? `signal ${err.signal}` : "unknown exit";
    const wrapped = new GitReadError(
      `git ${args.join(" ")} failed (${exit})${stderr ? `: ${stderr.slice(0, 2000)}` : ""}`,
    );
    wrapped.cause = err;
    throw wrapped;
  }
}

/** `git status --porcelain` — used for baseline capture and dirty-tree checks. */
export function gitStatusPorcelain(options = {}) {
  return runGitRead(["status", "--porcelain", "--untracked-files=all"], options);
}

/** `git rev-parse HEAD`, trimmed. */
export function gitRevParseHead(options = {}) {
  return runGitRead(["rev-parse", "HEAD"], options).trim();
}

/** `git for-each-ref` — used for the post-turn ref-change guard. */
export function gitForEachRef(options = {}) {
  return runGitRead(["for-each-ref"], options);
}

/** `git diff [...args]`. */
export function gitDiff(diffArgs = [], options = {}) {
  return runGitRead(["diff", ...diffArgs], options);
}

/** `git log [...args]`. */
export function gitLog(logArgs = [], options = {}) {
  return runGitRead(["log", ...logArgs], options);
}

/** `git show [...args]`. */
export function gitShow(showArgs = [], options = {}) {
  return runGitRead(["show", ...showArgs], options);
}
