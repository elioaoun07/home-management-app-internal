import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStorage } from "../../scripts/delivery-v2/local-storage.mjs";
import { runProcess } from "../../scripts/delivery-v2/process.mjs";
import { pnpmCommand } from "../../scripts/delivery-v2/local-process.mjs";
import { localEnvironment } from "../../scripts/delivery-v2/local-guardrails.mjs";

const parents: string[] = [];
afterEach(() => { for (const dir of parents.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(run = runProcess) {
  const parent = mkdtempSync(join(tmpdir(), "era-storage-"));
  parents.push(parent);
  const root = join(parent, "repo"), folder = root + "-delivery", workspace = join(folder, "DLV-700");
  mkdirSync(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...localEnvironment(), NODE_ENV: "test" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "test@example.invalid");
  writeFileSync(join(root, ".gitignore"), "/node_modules\n/.delivery/\n/.next/\n");
  writeFileSync(join(root, "tracked.txt"), "original\n");
  git("add", "."); git("commit", "-m", "base");
  const id = "local-" + randomUUID(), base = git("rev-parse", "HEAD"), branch = "delivery/DLV-700";
  git("worktree", "add", "-b", branch, workspace, base);
  const data = { phase: "failed", branch, workspace, base, work: { id: "DLV-700", title: "Fixture" }, parked: false };
  const activity: string[] = [];
  const env = () => ({ ...localEnvironment(), NODE_ENV: "test" as const, npm_config_store_dir: join(parent, "fixture-store"), npm_config_cache_dir: join(parent, "fixture-cache") });
  const storage = createLocalStorage({ root, run, env, getRecord: () => data,
    rows: () => [{ run_id: id }], activity: () => activity, busy: () => false,
    record: (_id: string, message: string) => activity.push(message), stopPreview: () => {} });
  return { root, git, folder, workspace, id, data, activity, storage, env };
}

function longDependencyPath(workspace: string) {
  const directory = join(workspace, "node_modules", ".pnpm", "package".repeat(16), "directory".repeat(12));
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "fixture.d.ts");
  expect(file.length).toBeGreaterThan(260);
  writeFileSync(file, "generated dependency");
  return file;
}

describe("delivery disk and retention", { timeout: 60_000 }, () => {
  it.skipIf(process.platform !== "win32")("clears long pnpm paths and nested junctions before Git removes the worktree", async () => {
    const f = fixture((bin, args, options) => {
      if (args.includes("worktree") && args.includes("remove")) {
        expect(existsSync(join(f.workspace, "node_modules"))).toBe(false);
        expect(existsSync(join(f.workspace, ".next"))).toBe(false);
      }
      return runProcess(bin, args, options);
    });
    const file = longDependencyPath(f.workspace);
    const target = join(f.root, "owner-packages");
    mkdirSync(target);
    writeFileSync(join(target, "keep"), "owner");
    symlinkSync(target, join(f.workspace, "node_modules", ".pnpm", "linked"), "junction");
    mkdirSync(join(f.workspace, ".next", "dev"), { recursive: true });
    writeFileSync(join(f.workspace, ".next", "dev", "cache"), "cache");
    expect(existsSync(file)).toBe(true);
    const preview = (await f.storage.preview(f.id))!;
    expect(preview.commands[0]).toContain("core.longpaths=true");
    const result = await f.storage.clean(f.id, preview.witness);
    expect(result.cleaned_at).toBeTruthy();
    expect(existsSync(f.workspace)).toBe(false);
    expect(f.git("branch", "--list", f.data.branch)).toBe("");
    expect(readFileSync(join(target, "keep"), "utf8")).toBe("owner");
  });

  it.skipIf(process.platform !== "win32")("finishes the confirmed cleanup if Git detaches the same directory and leaves files behind", async () => {
    const f = fixture((bin, args, options) => {
      if (args.includes("worktree") && args.includes("remove")) {
        longDependencyPath(f.workspace);
        mkdirSync(join(f.workspace, "remaining"));
        writeFileSync(join(f.workspace, "remaining", "notes.txt"), "survived");
        return runProcess(bin, args.map(arg => arg === "core.longpaths=true" ? "core.longpaths=false" : arg), options);
      }
      return runProcess(bin, args, options);
    });
    writeFileSync(join(f.workspace, "tracked.txt"), "archived\n");
    const preview = (await f.storage.preview(f.id))!;
    const result = await f.storage.clean(f.id, preview.witness);
    expect(existsSync(f.workspace)).toBe(false);
    const archived = join(f.root, result.cleanup_archive);
    expect(readFileSync(join(archived, "diff.patch"), "utf8")).toContain("+archived");
    expect(existsSync(join(archived, "remaining-worktree", "node_modules"))).toBe(false);
    expect(f.git("branch", "--list", f.data.branch)).toBe("");
    const [removeExit, branchExit] = f.activity.map(line => JSON.parse(line).exit);
    expect(removeExit).toBeGreaterThan(0);
    expect(branchExit).toBe(0);
  });

  it("recovers a worktree Git unregistered partway through cleanup", async () => {
    const f = fixture(async (bin, args, options) => {
      if (args.includes("worktree") && args.includes("remove")) {
        const result = await runProcess(bin, args, options);
        if (result.status !== 0 || result.error) return result;
        mkdirSync(f.workspace);
        if (process.platform === "win32") longDependencyPath(f.workspace);
        const target = join(f.root, "owner-cache");
        mkdirSync(target);
        writeFileSync(join(target, "keep"), "owner");
        mkdirSync(join(f.workspace, "node_modules"), { recursive: true });
        symlinkSync(target, join(f.workspace, "node_modules", "linked"), "junction");
        writeFileSync(join(f.workspace, "remaining.txt"), "survived the failure");
        return { ...result, status: 1, stderr: "Filename too long" };
      }
      return runProcess(bin, args, options);
    });
    writeFileSync(join(f.workspace, "tracked.txt"), "keep the original patch\n");
    const before = (await f.storage.preview(f.id))!;
    await expect(f.storage.clean(f.id, before.witness)).rejects.toThrow("Filename too long");
    expect(existsSync(join(f.workspace, ".git"))).toBe(false);
    expect(f.git("worktree", "list")).not.toContain("DLV-700");
    writeFileSync(join(f.workspace, ".git"), "gitdir: another-repository");
    await expect(f.storage.preview(f.id)).rejects.toThrow("unregistered-worktree");
    rmSync(join(f.workspace, ".git"));
    const retry = (await f.storage.preview(f.id))!;
    expect(retry.remainder).toBeTruthy();
    expect(retry.commands).toHaveLength(1);
    await expect(f.storage.clean(f.id, before.witness)).rejects.toThrow("cleanup-preview-changed");
    const result = await f.storage.clean(f.id, retry.witness);
    expect(existsSync(f.workspace)).toBe(false);
    expect(f.git("branch", "--list", f.data.branch)).toBe("");
    expect(existsSync(join(retry.remainder!, "node_modules"))).toBe(false);
    expect(readFileSync(join(f.root, "owner-cache", "keep"), "utf8")).toBe("owner");
    expect(readFileSync(join(retry.remainder!, "remaining.txt"), "utf8")).toBe("survived the failure");
    expect(readFileSync(join(f.root, result.cleanup_archive, "diff.patch"), "utf8")).toContain("+keep the original patch");
  });

  it("archives failed tracked, binary untracked and handover files; unlinks the junction without touching its target", async () => {
    const f = fixture(), target = join(f.root, "node_modules");
    mkdirSync(target); writeFileSync(join(target, "sentinel"), "owner");
    symlinkSync(target, join(f.workspace, "node_modules"), "junction");
    const home = join(f.root, ".delivery/local", f.id, "home"); mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "private"), "fixture credential");
    const runtime = join(f.root, ".delivery/local", f.id);
    for (const name of ["merge-inputs", "hooks", "other"]) mkdirSync(join(runtime, name));
    writeFileSync(join(f.workspace, "tracked.txt"), "staged only\n");
    f.git("-C", f.workspace, "add", "--", "tracked.txt");
    writeFileSync(join(f.workspace, "tracked.txt"), "updated\n");
    writeFileSync(join(f.workspace, "asset.bin"), Buffer.from([0, 1, 255]));
    writeFileSync(join(f.workspace, ".delivery-handover.json"), '{"summary":"example"}');
    const preview = await f.storage.preview(f.id);
    expect(preview!.commands[0]).toContain("worktree");
    expect(preview!.commands[1]).toContain("update-ref");
    expect(preview!.commands).toEqual(await f.storage.cleanupCommands(f.workspace, f.data.branch));
    expect(preview!.commands[1].at(-1)).toBe("--stdin");
    expect(preview!.branchInput).toBe("delete refs/heads/" + f.data.branch + " " + f.data.base + "\n");
    const result = await f.storage.clean(f.id, preview!.witness);
    expect(result.cleaned_at).toBeTruthy();
    expect(readFileSync(join(f.root, result.cleanup_archive, "diff.patch"), "utf8")).toContain("+updated");
    expect(readFileSync(join(f.root, result.cleanup_archive, "index.patch"), "utf8")).toContain("+staged only");
    expect(readFileSync(join(f.root, result.cleanup_archive, "untracked/asset.bin"))).toEqual(Buffer.from([0, 1, 255]));
    expect(readFileSync(join(f.root, result.cleanup_archive, "handover.json"), "utf8")).toContain("example");
    expect(existsSync(home)).toBe(false);
    expect(existsSync(join(runtime, "merge-inputs"))).toBe(false);
    expect(existsSync(join(runtime, "hooks"))).toBe(false);
    expect(existsSync(join(runtime, "other"))).toBe(true);
    expect(existsSync(f.workspace)).toBe(false);
    expect(f.git("branch", "--list", f.data.branch)).toBe("");
    expect(readFileSync(join(target, "sentinel"), "utf8")).toBe("owner");
    expect(f.activity.map(line => JSON.parse(line).exit)).toEqual([0, 0]);
    expect(JSON.parse(f.activity[1]).stdin).toBe(preview!.branchInput);
  });
  it("requires the current preview, rejects parked runs and forged paths, and refuses a new start at capacity", async () => {
    const f = fixture();
    const before = await f.storage.preview(f.id);
    writeFileSync(join(f.workspace, "tracked.txt"), "late edit\n");
    await expect(f.storage.clean(f.id, before!.witness)).rejects.toThrow("preview-changed");
    f.data.parked = true;
    expect(await f.storage.preview(f.id)).toBe(null);
    f.data.parked = false; Object.assign(f.data, { merge_pending: {} });
    expect(await f.storage.preview(f.id)).toBe(null);
    Object.assign(f.data, { merge_pending: null }); f.data.workspace = f.root;
    await expect(f.storage.preview(f.id)).rejects.toThrow("unowned-worktree");
    mkdirSync(join(f.folder, "another"));
    expect(() => f.storage.checkCapacity()).toThrow("Two worktree slots");
    expect(existsSync(join(f.root, "tracked.txt"))).toBe(true);
  });
  it("counts hard-linked bytes once and includes runtime files outside the checkout", async () => {
    const f = fixture();
    const measure = () => f.storage.view({ summary: true, measure: true }).then(v => v.bytes as number);
    const initial = await measure();
    const payload = join(f.workspace, "cache.bin");
    writeFileSync(payload, Buffer.alloc(100));
    linkSync(payload, join(f.workspace, "duplicate.bin"));
    const runtime = join(f.root, ".delivery/local", f.id); mkdirSync(runtime, { recursive: true });
    writeFileSync(join(runtime, "cache.bin"), Buffer.alloc(40));
    expect(await measure()).toBe(initial + 140);
    const second = join(f.folder, "second");
    mkdirSync(second); linkSync(payload, join(second, "shared.bin"));
    const summary = await f.storage.view({ summary: true, measure: true });
    expect(summary.bytes).toBe(initial + 140);
    expect(summary.checkouts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "second", bytes: 100 }),
      expect.objectContaining({ name: "DLV-700", run_id: f.id, bytes: initial + 100 }),
    ]));
  });
  it("keeps legacy file-copy merges out of bulk cleanup and requires an individual request for refresh conflicts", async () => {
    const f = fixture();
    Object.assign(f.data, { phase: "shipped", applied: { files: ["tracked.txt"] } });
    expect((await f.storage.view()).retained.map(run => run.run_id)).toEqual([f.id]);
    expect((await f.storage.view()).runs).toEqual([]);
    for (const phase of ["refresh-conflict", "merged", "committed", "push-pending", "revert-push-pending"]) {
      f.data.phase = phase;
      expect((await f.storage.view()).runs).toEqual([]);
      expect((await f.storage.view({ run_id: f.id })).runs).toHaveLength(1);
    }
  });
  it("retries a failed branch deletion from its archived head without losing the patch", async () => {
    let rejectDelete = true;
    const f = fixture(async (bin, args, options) => {
      if (rejectDelete && args.includes("update-ref")) {
        rejectDelete = false;
        return { status: 1, signal: null, stderr: "fixture interruption", stdout: "", error: null };
      }
      return runProcess(bin, args, options);
    });
    writeFileSync(join(f.workspace, "tracked.txt"), "keep this patch\n");
    const original = await f.storage.preview(f.id);
    await expect(f.storage.clean(f.id, original!.witness)).rejects.toThrow("fixture interruption");
    expect(existsSync(f.workspace)).toBe(false);
    const retry = await f.storage.preview(f.id);
    expect(retry!.commands).toHaveLength(1);
    const result = await f.storage.clean(f.id, retry!.witness);
    expect(readFileSync(join(f.root, result.cleanup_archive, "diff.patch"), "utf8")).toContain("keep this patch");
    expect(f.git("branch", "--list", f.data.branch)).toBe("");
  });
  it.each([false, true])("installs private package files for fresh and legacy worktrees (legacy=%s)", async legacy => {
    const f = fixture();
    mkdirSync(join(f.workspace, "pkg"));
    writeFileSync(join(f.workspace, "pkg/package.json"), JSON.stringify({ name: "fixture-dep", version: "1.0.0" }));
    writeFileSync(join(f.workspace, "package.json"), JSON.stringify({ name: "fixture-app", dependencies: { "fixture-dep": "file:./pkg" } }));
    const [bin, cli] = pnpmCommand();
    const seeded = await runProcess(bin, [cli, "install", "--lockfile-only", "--offline", "--ignore-scripts"], { cwd: f.workspace, env: f.env() });
    expect(seeded.status, seeded.stderr || seeded.stdout).toBe(0);
    if (legacy) {
      mkdirSync(join(f.workspace, "node_modules/.pnpm"), { recursive: true });
      writeFileSync(join(f.workspace, "node_modules/.modules.yaml"), "fixture");
      writeFileSync(join(f.workspace, "node_modules/.pnpm/lock.yaml"), "old");
      mkdirSync(join(f.workspace, ".next/dev"), { recursive: true });
      writeFileSync(join(f.workspace, ".next/dev/previous"), "cache");
    }
    const result = await f.storage.prepare(f.id, f.data, pnpmCommand);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(realpathSync(join(f.workspace, "node_modules"))).toBe(realpathSync(join(f.root, ".delivery/local", f.id, "dependencies/node_modules")));
    expect(existsSync(join(f.workspace, "node_modules/fixture-dep/package.json"))).toBe(true);
    writeFileSync(join(f.workspace, ".next/dev", "cache"), "preview");
    expect(readFileSync(join(f.root, ".delivery/local", f.id, "dependencies/next-dev/cache"), "utf8")).toBe("preview");
    expect(existsSync(join(f.root, ".next"))).toBe(false);
    expect(existsSync(join(f.root, "node_modules"))).toBe(false);
    if (legacy) {
      expect(readFileSync(join(f.root, ".delivery/local", f.id, "dependencies/previous-install/.pnpm/lock.yaml"), "utf8")).toBe("old");
      expect(readFileSync(join(f.workspace, ".next/dev/previous"), "utf8")).toBe("cache");
    }
  }, 30_000);
});
