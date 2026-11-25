// An owner refreshes a tested candidate against the commit shown in its merge
// plan. A refresh never rebases, stashes, or resets the owner's checkout.
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const rebaseArgs = (d, target) => ["git", "--no-optional-locks", "rebase", "--no-autostash",
  "--no-update-refs", "--onto", target, d.base, d.branch];
const abortArgs = ["git", "--no-optional-locks", "rebase", "--abort"];
const iso = () => new Date().toISOString();
const inRefresh = d => ["refreshing", "refresh-failed", "refresh-conflict"].includes(d.phase);

export function refreshPlan(d, merge, target) {
  const dirtyConflicts = merge.conflicts.filter(file => file.uncommitted).map(file => file.path);
  const committedConflicts = merge.conflicts.filter(file => file.committed).map(file => file.path);
  const retryChecks = inRefresh(d) && d.refresh?.step === "checks";
  const interrupted = d.phase === "refreshing" && d.refresh?.step === "rebase";
  const refreshBase = retryChecks || interrupted ? d.refresh.target : target;
  const retryRebase = d.phase === "refresh-conflict" &&
    (d.refresh?.target !== target || !d.refresh.conflicts.length);
  const canRefresh = merge.branch === merge.expected && (retryChecks || interrupted ||
    (!dirtyConflicts.length && (retryRebase || (d.phase === "uat-ready" && committedConflicts.length > 0))));
  const refreshCommands = retryChecks ? [] : [rebaseArgs(d, refreshBase), abortArgs];
  return { ...merge, canRefresh, refreshBase, dirtyConflicts, committedConflicts, refreshCommands };
}

export function needsRefreshPlan(d) { return inRefresh(d); }

// Git's per-worktree rebase metadata proves which branch/head an interrupted
// operation belongs to before offering the recorded conditional abort.
function matchingRebase(workspace, gitDir, record, branch) {
  for (const name of ["rebase-merge", "rebase-apply"]) {
    const dir = resolve(workspace, gitDir, name);
    if (!existsSync(dir)) continue;
    const read = file => readFileSync(join(dir, file), "utf8").trim();
    if (read("orig-head") !== record.original || read("head-name") !== "refs/heads/" + branch ||
        read("onto") !== record.target) throw new Error("A different rebase owns this worktree");
    return true;
  }
  return false;
}

export async function refreshCandidate({ id, root, d, expectedBase, expectedHead, git, run, env, save, event,
  planMerge, checks, inspect, accept, stopPreview, ensureDeps, hookMs }) {
  if (d.phase !== "uat-ready" && !inRefresh(d)) throw new Error("Refresh needs a candidate waiting for Merge");
  if (!d.head || d.head !== expectedHead || !/^delivery\/[\w.-]+$/u.test(d.branch) ||
      resolve(d.workspace) !== resolve(dirname(root), basename(root) + "-delivery", d.branch.slice("delivery/".length)))
    throw new Error("Refresh preview changed");
  if (resolve(await git(d.workspace, "rev-parse", "--show-toplevel")) !== resolve(d.workspace))
    throw new Error("The recorded Delivery worktree is missing");
  const plan = await planMerge(d);
  if (!plan.canRefresh || plan.refreshBase !== expectedBase) throw new Error("Refresh preview changed. Recheck the files.");
  const wgit = (...args) => git(d.workspace, ...args);
  const head = () => wgit("rev-parse", "HEAD");
  const branch = () => wgit("symbolic-ref", "--quiet", "--short", "HEAD").catch(() => null);
  const dirty = () => wgit("status", "--porcelain", "--untracked-files=all");
  const retry = inRefresh(d) && ["checks", "rebase"].includes(d.refresh?.step);
  let record = retry ? { ...d.refresh } : { original: d.head, old_base: d.base, target: expectedBase,
    step: "rebase", started_at: iso(), commands: [], conflicts: [] };
  const persist = (phase, fields = {}) => { d = { ...d, ...fields, phase, refresh: { ...record } }; save(id, d); };
  const execute = async argv => {
    event(id, JSON.stringify(argv));
    const result = await run(argv[0], argv.slice(1), { cwd: d.workspace, env: env(), timeout: hookMs });
    const tail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n").trim().slice(-2000);
    const receipt = { argv, exit: result.status, tail, at: iso() };
    record = { ...record, commands: [...record.commands, receipt] };
    persist("refreshing");
    event(id, `Refresh exit ${result.status ?? "unknown"} ${tail}`);
    return result.status === 0 && !result.error;
  };
  const conflicts = async () => (await wgit("diff", "--name-only", "-z", "--diff-filter=U")).split("\0").filter(Boolean);
  const gitDir = await wgit("rev-parse", "--absolute-git-dir");
  const alreadyRebasing = matchingRebase(d.workspace, gitDir, record, d.branch);
  const initialHead = await head();
  if (!alreadyRebasing && (await branch() !== d.branch || await dirty())) throw new Error("Candidate changed. Inspect the worktree.");
  if (alreadyRebasing && !(retry && record.step === "rebase")) throw new Error("An existing rebase needs attention");
  if (!retry && initialHead !== expectedHead) throw new Error("Candidate changed since the preview");
  stopPreview(id);
  persist("refreshing", { checks: [], reviewed_head: null, reviewed_risk: null, handover_id: null, error: null });
  if (record.step === "rebase") {
    let completed = false;
    if (!alreadyRebasing && initialHead === record.original) completed = await execute(rebaseArgs(d, record.target));
    else if (!alreadyRebasing) {
      // PM may have stopped after Git finished. Accept only the recorded
      // branch's rebase-finish reflog entry. All checks and UAT run anew.
      const reflog = await wgit("reflog", "-1", "--format=%gs", "refs/heads/" + d.branch);
      completed = reflog.startsWith("rebase (finish):") && reflog.endsWith(record.target);
      if (!completed) throw new Error("Unrecognized worktree head after interrupted refresh");
    }
    if (!completed) {
      const files = alreadyRebasing && record.conflicts?.length ? record.conflicts : await conflicts();
      record = { ...record, conflicts: files };
      persist("refreshing");
      if (matchingRebase(d.workspace, gitDir, record, d.branch) && !await execute(abortArgs))
        throw new Error("Refresh stopped. Could not restore the original candidate.");
      if (await branch() !== d.branch || await head() !== record.original || await dirty())
        throw new Error("Inspect the interrupted rebase in the Delivery worktree");
      record.step = "stopped";
      const reason = files.length ? "Rebase conflict: " + files.join(", ") : "Rebase failed; see activity";
      persist("refresh-conflict", { error: reason });
      event(id, reason);
      return;
    }
    const nextHead = await head();
    await wgit("merge-base", "--is-ancestor", record.target, nextHead);
    if (await branch() !== d.branch || await dirty()) throw new Error("Candidate changed during refresh");
    record = { ...record, step: "checks", conflicts: [] };
    persist("refreshing", { base: record.target, head: nextHead });
  }
  try {
    if (await head() !== d.head) throw new Error("Refreshed candidate changed before checks");
    await ensureDeps(id, d);
    const changes = await inspect(d, d.head);
    persist("refreshing", { risk: changes.risk, checks: [] });
    const results = await checks({ workspace: d.workspace, env: env(), onStart: name => event(id, name + " started"),
      onCheck: result => { persist("refreshing", { checks: [...d.checks, result] }); event(id, result.name + ": " + result.exit); } });
    persist("refreshing", { checks: results });
    if (results.length !== 4 || results.some(result => result.exit !== 0 || result.error)) throw new Error("Refreshed candidate failed host checks");
    if (await branch() !== d.branch || await head() !== d.head || await dirty()) throw new Error("Candidate changed during host checks");
  } catch (error) {
    persist("refresh-failed", { error: String(error.message) });
    event(id, d.error);
    return;
  }
  // DLV-175: the rebased candidate passes the Acceptance Check before its Handover.
  record = { ...record, step: "done", finished_at: iso() };
  persist("accepting");
  await accept(id);
}
