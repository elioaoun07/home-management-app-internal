import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, symlinkSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const maxWorktrees = 2;
const generatedDirectories = ["node_modules", ".next"];
const localId = /^local-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u;
// DLV-175: "stopped" is an owner-closed run that never reached Handover.
const terminal = new Set(["failed", "cancelled", "stopped", "reverted", "pushed", "discarded"]);
export const individualDiscard = new Set(["uat-ready", "refresh-conflict", "refresh-failed", "merged", "committed", "push-pending", "revert-push-pending"]);
const digest = value => createHash("sha256").update(value).digest("hex");
const same = (left, right) => relative(left, right) === "";
const statIfPresent = path => lstatSync(path, { throwIfNoEntry: false });
const absentOkay = async fn => { try { return await fn(); } catch (error) { if (error.code !== "ENOENT") throw error; } };

async function removeGenerated(workspace, names) {
  for (const name of names)
    await rm(join(workspace, name), { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}

// Check every existing ancestor. Never recurse through a replacement junction in
// a runtime, archive or checkout path, even if that path came from our own DB.
function checked(base, ...segments) {
  const target = resolve(base, ...segments), inside = relative(base, target);
  if (!inside || isAbsolute(inside) || inside.split(/[/\\]/u).includes("..")) throw new Error("unowned-storage-path");
  let part = resolve(base);
  for (const name of inside.split(/[/\\]/u)) {
    part = join(part, name);
    if (statIfPresent(part)?.isSymbolicLink()) throw new Error("linked-storage-path: " + part);
  }
  return target;
}

export function createLocalStorage({ root, run, env, getRecord, rows, activity, busy, record, stopPreview }) {
  const parent = dirname(root), folder = basename(root) + "-delivery";
  const treeRoot = () => checked(parent, folder);
  const privatePath = (id, ...parts) => {
    if (!localId.test(id)) throw new Error("invalid-local-run");
    return checked(root, ".delivery", "local", id, ...parts);
  };
  function assertWorktree(id, d) {
    const item = d.work?.id;
    if (!localId.test(id) || !/^[A-Z]{1,5}-?\d+[A-Z]?(?:\.\d+[A-Z]?)*$/u.test(item)) throw new Error("unowned-worktree");
    const suffix = basename(d.workspace);
    if (![item, item + "-" + id.slice(6)].includes(suffix) || d.branch !== "delivery/" + suffix ||
        !same(checked(parent, folder, suffix), d.workspace)) throw new Error("unowned-worktree");
  }
  function capacity() {
    const path = treeRoot();
    return { worktrees: existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter(e => e.isDirectory() || e.isSymbolicLink()).length : 0, maxWorktrees };
  }
  function checkCapacity() {
    if (capacity().worktrees >= maxWorktrees) throw new Error("Two worktree slots are full. Open Setup to clean up closed runs.");
  }
  // The host worker, its hooks and Next have no read-only mount that applies to
  // all three. A run gets its own package files, including pnpm's virtual store.
  // The junction only targets this one run. pnpm clone-or-copy avoids shared
  // mutable hard links to the owner's installation or pnpm store.
  async function prepare(id, d, command) {
    assertWorktree(id, d);
    const modules = privatePath(id, "dependencies", "node_modules"), link = join(d.workspace, "node_modules");
    mkdirSync(modules, { recursive: true });
    const existing = statIfPresent(link);
    // Older runs have a regular pnpm installation. Keep it until the replacement
    // is installed, then retain it under this run's own cleanup directory.
    const oldInstall = existing?.isDirectory() && !existing.isSymbolicLink() &&
      statIfPresent(checked(link, ".modules.yaml"))?.isFile() && statIfPresent(checked(link, ".pnpm", "lock.yaml"))?.isFile();
    if (!existing) symlinkSync(modules, link, "junction");
    else if (!oldInstall && (!existing.isSymbolicLink() || !same(realpathSync(link), realpathSync(modules)))) throw new Error("unexpected-dependency-directory");
    // Next's isolated development build writes to .next/dev. Keep both the
    // checkout directory and the target private; the owner may run Next beside it.
    const next = checked(d.workspace, ".next"), cache = privatePath(id, "dependencies", "next-dev");
    mkdirSync(next, { recursive: true });
    const dev = join(next, "dev"), devStat = statIfPresent(dev);
    if (devStat?.isDirectory() && oldInstall && !devStat.isSymbolicLink() && !existsSync(cache)) {
      renameSync(dev, cache);
      symlinkSync(cache, dev, "junction");
    } else if (!devStat) {
      mkdirSync(cache, { recursive: true });
      symlinkSync(cache, dev, "junction");
    }
    else if (!devStat.isSymbolicLink() || !same(realpathSync(dev), realpathSync(cache))) throw new Error("unexpected-preview-cache");
    const [bin, launcher] = command();
    const result = await run(bin, [launcher, "install", "--offline", "--frozen-lockfile", "--ignore-scripts", "--package-import-method=clone-or-copy",
      "--modules-dir", relative(d.workspace, modules), "--virtual-store-dir", join(modules, ".pnpm")],
      { cwd: d.workspace, env: env(), timeout: 10 * 60_000 });
    if (oldInstall && result.status === 0 && !result.error) {
      const previous = privatePath(id, "dependencies", "previous-install");
      if (statIfPresent(previous)) throw new Error("previous-dependency-install-already-retained");
      renameSync(link, previous);
      try { symlinkSync(modules, link, "junction"); }
      catch (error) { renameSync(previous, link); throw error; }
    }
    return result;
  }

  const removeHome = id => rm(privatePath(id, "home"), { recursive: true, force: true, maxRetries: 3 });

  async function git(cwd, args, logId = null, input = undefined) {
    const argv = ["--no-optional-locks", ...args];
    const result = await run("git", argv, { cwd, env: env(), input, timeout: 15 * 60_000 });
    if (logId) record(logId, JSON.stringify({ argv: ["git", ...argv], ...(input && { stdin: input }), exit: result.status, tail: (result.stderr || result.stdout || "").slice(-1500) }));
    if (result.status !== 0 || result.error) throw new Error("git " + args.join(" ") + ": " + (result.stderr || result.error?.message || result.status));
    return result.stdout;
  }
  async function cleanupSpec(workspace, branch) {
    if (branch !== "delivery/" + basename(workspace) || !same(dirname(workspace), treeRoot())) throw new Error("unowned-worktree");
    const admin = (await git(root, ["rev-parse", "--absolute-git-dir"])).trim();
    const argv = ["git", "--no-optional-locks", "--git-dir", admin];
    if (process.platform === "win32") argv.push("-c", "core.longpaths=true");
    return { admin, commands: [[...argv, "worktree", "remove", "--force", workspace], [...argv, "update-ref", "--stdin"]] };
  }
  const cleanupCommands = async (workspace, branch) => (await cleanupSpec(workspace, branch)).commands;
  function eligible(id, d, individual) {
    const legacyPushed = d.phase === "shipped" && !!d.merge && !d.applied;
    const ownerDiscard = individual && (individualDiscard.has(d.phase) || d.phase === "shipped" && !!d.applied);
    return !busy(id) && !d.parked && !d.merge_pending && !d.cleaned_at && (terminal.has(d.phase) || legacyPushed || ownerDiscard);
  }
  async function snapshot(id, d) {
    assertWorktree(id, d);
    const workspace = d.workspace;
    const { admin, commands: [removeTree, deleteRef] } = await cleanupSpec(workspace, d.branch);
    const trees = (await git(root, ["worktree", "list", "--porcelain", "-z"])).split("\0\0").map(entry => entry.split("\0"));
    const entry = trees.find(fields => fields[0]?.startsWith("worktree ") && same(fields[0].slice(9), workspace));
    const ref = "refs/heads/" + d.branch;
    if (trees.some(fields => fields.includes("branch " + ref) && fields !== entry)) throw new Error("branch-in-another-worktree");
    const refs = (await git(root, ["for-each-ref", "--format=%(refname) %(objectname)", ref])).trim().split("\n");
    const head = refs.find(line => line.startsWith(ref + " "))?.slice(ref.length + 1);
    const workspaceStat = statIfPresent(workspace);
    const pathExists = !!workspaceStat;
    if (entry && (!entry.includes("branch " + ref) || !entry.includes("HEAD " + head) || (d.head && d.head !== head) || !pathExists || entry.some(v => /^locked(?: |$)/u.test(v)))) throw new Error("worktree-identity-changed");
    const archive = checked(root, ".delivery", "local-archive", id);
    const receiptFile = checked(root, ".delivery", "local-archive", id, "archive.json");
    let receipt = null;
    if (existsSync(receiptFile)) receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
    if (receipt && (receipt.id !== id || receipt.base !== d.base)) throw new Error("archive-identity-changed");
    // Git can unregister a worktree even when deleting its files fails. Recover
    // only from an existing archive for this exact branch revision.
    const remainder = checked(archive, "remaining-worktree");
    const moved = statIfPresent(remainder);
    const interrupted = pathExists && !entry;
    const recovering = interrupted || !!moved;
    const remainingDirectory = interrupted ? workspaceStat : moved;
    if (recovering) {
      const archived = receipt?.head && (!head || receipt.head === head) &&
        statIfPresent(checked(archive, "diff.patch"))?.isFile() &&
        statIfPresent(checked(archive, "activity.json"))?.isFile();
      const detached = interrupted && head && !moved && !statIfPresent(join(workspace, ".git"));
      const alreadyMoved = moved && !pathExists && !entry;
      if (!archived || !remainingDirectory?.isDirectory() || (!detached && !alreadyMoved))
        throw new Error("unregistered-worktree");
    }
    if (!pathExists && !entry && !head && !existsSync(privatePath(id)) && !receipt) throw new Error("run-has-no-owned-storage");
    if (!entry && head && receipt?.head !== head) throw new Error("unarchived-branch");
    let patch = "", staged = "", extras = [], generated = [];
    if (entry) {
      // Keep incomplete attempts, including binary and untracked candidate files.
      // Reject an unrelated replacement repository or diverged branch.
      const common = (await git(workspace, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim();
      if (!same(common, admin) || (await git(workspace, ["symbolic-ref", "HEAD"])).trim() !== ref) throw new Error("worktree-identity-changed");
      await git(workspace, ["merge-base", "--is-ancestor", d.base, head]);
      const envFile = /(^|[/\\])\.env(?:\.|$)/iu;
      const tracked = (await git(workspace, ["ls-files", "-z"])).split("\0").filter(Boolean);
      if (tracked.some(name => envFile.test(name))) throw new Error("candidate-contains-env-file");
      patch = await git(workspace, ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", d.base, "--"]);
      staged = await git(workspace, ["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", d.base, "--"]);
      for (const name of (await git(workspace, ["ls-files", "--others", "--exclude-standard", "-z"])).split("\0").filter(Boolean)) {
        if (envFile.test(name)) throw new Error("candidate-contains-env-file");
        const path = checked(workspace, name);
        if (!lstatSync(path).isFile()) throw new Error("unarchivable-file: " + name);
        extras.push({ name, hash: digest(await readFile(path)) });
      }
      // Git for Windows can leave a legacy pnpm tree behind after deleting its
      // worktree registration. Let Node remove generated files and links first.
      const sourcePaths = [...tracked, ...extras.map(file => file.name)];
      generated = generatedDirectories.filter(name =>
        !sourcePaths.some(path => path.toLowerCase() === name || path.toLowerCase().startsWith(name + "/")));
    }
    const commands = [];
    if (entry) commands.push(removeTree);
    if (head) commands.push(deleteRef);
    const branchInput = head ? `delete ${ref} ${head}\n` : null;
    const witness = digest(JSON.stringify([id, d.phase, workspace, head, digest(patch), digest(staged), extras, commands,
      recovering ? [remainder, interrupted, remainingDirectory.dev, remainingDirectory.ino] : null]));
    const preview = { run_id: id, phase: d.phase, title: d.work.title, workspace, branch: d.branch, expectedHead: head || null, branchInput, commands, witness,
      remainder: recovering ? remainder : null };
    return { preview, head, patch, staged, extras, receipt, archive, entry, interrupted, generated, workspaceStat };
  }
  async function preview(id, individual = true) {
    const d = getRecord(id);
    return eligible(id, d, individual) ? (await snapshot(id, d)).preview : null;
  }
  async function previewAfterPush(id) {
    const d = getRecord(id);
    if (busy(id) || d.parked || d.cleaned_at) return null;
    return (await snapshot(id, { ...d, phase: "pushed" })).preview;
  }
  async function archiveRemainder(id, d, plan) {
    assertWorktree(id, d);
    const remainder = checked(plan.archive, "remaining-worktree");
    if (plan.interrupted) await rename(d.workspace, remainder);
    // Preserve surviving source and unrecognized files alongside the patch.
    await removeGenerated(checked(plan.archive, "remaining-worktree"), generatedDirectories);
  }
  async function clean(id, witness, individual = true) {
    const d = getRecord(id);
    if (!eligible(id, d, individual)) throw new Error("run-not-eligible-for-cleanup");
    const plan = await snapshot(id, d);
    if (!witness || plan.preview.witness !== witness) throw new Error("cleanup-preview-changed");
    const { entry, archive, extras, patch, staged, head } = plan;
    stopPreview(id);
    await mkdir(archive, { recursive: true });
    const archivedPath = (...parts) => checked(root, ".delivery", "local-archive", id, ...parts);
    if (entry || !plan.receipt) {
      await writeFile(archivedPath("diff.patch"), patch);
      if (staged !== patch) await writeFile(archivedPath("index.patch"), staged);
      for (const file of extras) {
        const bytes = await readFile(checked(d.workspace, file.name));
        if (digest(bytes) !== file.hash) throw new Error("cleanup-preview-changed");
        const target = archivedPath("untracked", ...file.name.split("/"));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      }
      const handover = checked(d.workspace, ".delivery-handover.json");
      if (entry && existsSync(handover)) await writeFile(archivedPath("handover.json"), await readFile(handover));
      await writeFile(archivedPath("activity.json"), JSON.stringify(activity(id), null, 2));
      await writeFile(archivedPath("archive.json"), JSON.stringify({ id, base: d.base, head, extras, checks: d.checks, error: d.error, handover_id: d.handover_id }));
    }
    if (entry) {
      const current = await snapshot(id, d);
      if (current.preview.witness !== witness) throw new Error("cleanup-preview-changed");
      await removeGenerated(d.workspace, current.generated);
    }
    if (plan.preview.remainder) {
      if ((await snapshot(id, d)).preview.witness !== witness) throw new Error("cleanup-preview-changed");
      await archiveRemainder(id, d, plan);
    }
    for (const cmd of plan.preview.commands) {
      try {
        await git(parent, cmd.slice(2), id, cmd.at(-1) === "--stdin" ? plan.preview.branchInput : undefined);
      } catch (error) {
        if (!entry || cmd.at(-4) !== "worktree") throw error;
        const retry = await snapshot(id, d).catch(() => null);
        // Only finish automatically if Git detached the same directory and
        // branch we just archived. Otherwise a fresh preview is required.
        if (!retry?.interrupted || retry.head !== head ||
            retry.workspaceStat.dev !== plan.workspaceStat.dev || retry.workspaceStat.ino !== plan.workspaceStat.ino)
          throw error;
        await archiveRemainder(id, d, retry);
      }
    }
    await removeHome(id);
    for (const name of ["dependencies", "merge-inputs", "hooks"])
      await rm(privatePath(id, name), { recursive: true, force: true, maxRetries: 3 });
    // The run's own folder goes too once empty; anything unrecognized stays.
    await rmdir(privatePath(id)).catch(() => {});
    return { cleaned_at: new Date().toISOString(), cleanup_archive: relative(root, archive), cleanup_error: null };
  }
  // Metadata-only, follows no junctions. Worker-friendly async I/O keeps PM
  // responsive even for ten legacy checkouts with separate package trees.
  async function measure() {
    const seen = new Set(), checkouts = [];
    let bytes = 0;
    async function walk(path, local) {
      const stat = await absentOkay(() => lstat(path, { bigint: true }));
      if (!stat || stat.isSymbolicLink()) return 0;
      if (stat.isDirectory()) {
        let total = 0;
        const names = await absentOkay(() => readdir(path));
        for (const name of names || []) total += await walk(join(path, name), local);
        return total;
      }
      if (!stat.isFile()) return 0;
      if (stat.nlink > 1n) {
        const key = stat.dev + "/" + stat.ino;
        if (!seen.has(key)) { seen.add(key); bytes += Number(stat.size); }
        if (local.has(key)) return 0;
        local.add(key);
      } else bytes += Number(stat.size);
      return Number(stat.size);
    }
    const folder = treeRoot();
    const directories = await absentOkay(() => readdir(folder, { withFileTypes: true }));
    for (const entry of directories || []) {
      const workspace = join(folder, entry.name);
      const size = await walk(workspace, new Set());
      if (entry.isDirectory()) checkouts.push({ name: entry.name, workspace, bytes: size });
    }
    await walk(checked(root, ".delivery", "local"), new Set());
    await walk(checked(root, ".delivery", "local-archive"), new Set());
    return { bytes, checkouts };
  }
  let measuring = null;
  function diskBytes() {
    measuring ??= measure().finally(() => { measuring = null; });
    return measuring;
  }
  /** @param {{ run_id?: string, measure?: boolean, summary?: boolean }} options */
  async function view({ run_id, measure: count = false, summary = false } = {}) {
    const runs = [], blocked = [], retained = [], sessions = new Map();
    for (const row of run_id ? [{ run_id }] : rows()) {
      const d = getRecord(row.run_id);
      if (d.workspace) sessions.set(basename(d.workspace), { run_id: row.run_id, title: d.work?.title, phase: d.phase });
      if (!eligible(row.run_id, d, !!run_id) && !d.cleaned_at && d.workspace && existsSync(d.workspace)) {
        retained.push({ run_id: row.run_id, title: d.work?.title || row.run_id, phase: d.phase });
      }
      if (summary) continue;
      try { const item = await preview(row.run_id, !!run_id); if (item) runs.push(item); }
      catch (error) { blocked.push({ run_id: row.run_id, reason: String(error.message) }); }
    }
    const disk = count ? await diskBytes() : null;
    const checkouts = disk?.checkouts.map(entry => ({ ...entry, ...sessions.get(entry.name) })) || [];
    return { ...capacity(), bytes: disk?.bytes ?? null, checkouts, runs, blocked, retained };
  }
  return { checkCapacity, capacity, prepare, removeHome, clean, cleanupCommands, preview, previewAfterPush, view };
}
