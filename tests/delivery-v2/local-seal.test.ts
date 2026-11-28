// The Seal commit hook, from the supervisor's side.
// DLV-177: the hook already runs typecheck and the full suite on the sealed tree;
// Verify reuses those passed results instead of running them a second time.
// DLV-178: Stop kills the hook mid-run and deletes the worktree.
import { afterEach, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { createLocalLane, sealedChecks } from "../../scripts/delivery-v2/local-lane.mjs";
import { localEnvironment } from "../../scripts/delivery-v2/local-guardrails.mjs";
import { hostChecks } from "../../scripts/delivery-v2/local-process.mjs";

const roots: string[] = [];
const stores: ReturnType<typeof openStore>[] = [];
afterEach(() => { stores.splice(0).forEach(s => s.close()); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
const git = (root: string, ...args: string[]) => execFileSync("git", args, { cwd: root, env: { ...localEnvironment(), NODE_ENV: "test" }, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root: string, path: string, value: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
const PM = "ERA Notes/10 - Project Management";

async function hookLane(hookSource: string) {
  const parent = mkdtempSync(join(tmpdir(), "era-seal-")); roots.push(parent);
  const root = join(parent, "repo");
  mkdirSync(root); git(root, "init", "-b", "main"); git(root, "config", "user.email", "fixture@example.invalid"); git(root, "config", "user.name", "Fixture");
  put(root, ".gitignore", "node_modules/\n.delivery/\n");
  put(root, "CLAUDE.md", "Fixture instructions\n");
  put(root, `${PM}/Delivery/4 - Checklist.md`, "# Checklist\n\n## Next\n\n- [ ] **DLV-900** Change the greeting — [criteria](<Delivery — Master Book.md#dlv-900>) _(friction - S)_\n");
  put(root, `${PM}/Delivery/Delivery — Master Book.md`, "# Delivery\n\n## Acceptance Criteria Index\n\n### DLV-900\n\n**Outcome:** greeting changes\n\n- **Acceptance:** changed greeting\n- **UAT:** pending\n\n## Shipped Log\n");
  put(root, "package.json", JSON.stringify({ scripts: Object.fromEntries(["typecheck", "lint", "test", "pm:lint"].map(name => [name, `node check.cjs ${name}`])) }));
  put(root, "check.cjs", "process.stdout.write(process.argv[2] + ': host output\\n');");
  put(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\nimporters:\n  .:\n");
  put(root, "node_modules/.pnpm/lock.yaml", readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
  put(root, "greeting.txt", "before\n");
  git(root, "add", "."); git(root, "commit", "-m", "fixture base");
  // Worktrees share the main checkout's hooks directory.
  const script = join(root, ".git", "hook.cjs");
  put(root, ".git/hook.cjs", hookSource);
  const quote = (value: string) => `'${value.replace(/\\/gu, "/").replace(/'/gu, `'"'"'`)}'`;
  put(root, ".git/hooks/pre-commit", `#!/bin/sh\n${quote(process.execPath)} ${quote(script)}\n`);
  if (process.platform !== "win32") chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
  const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") }); stores.push(store);
  const credential = join(parent, "subscription"); mkdirSync(credential); put(credential, ".credentials.json", JSON.stringify({ fixture: true }));
  const lane = createLocalLane({ root, store, authenticate: () => ({ ok: true, method: "fixture", directory: credential }),
    catalog: () => ({ revision: 1, models: { claude: [{ id: "fixture-claude", efforts: ["medium"] }], codex: [] } }),
    prepareDependencies: async (workspace: string) => { put(workspace, "node_modules/.pnpm/lock.yaml", readFileSync(join(workspace, "pnpm-lock.yaml"), "utf8")); return { status: 0 }; },
    session: (async ({ request }: { request: { workspace: { root: string } } }) => {
      put(request.workspace.root, "greeting.txt", "after\n");
      put(request.workspace.root, ".delivery-handover.json", JSON.stringify({ summary: "Changed greeting", scenarios: [{ id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read greeting", expected: "after" }] }] }));
      return { status: "finished", observations: { nativeOutcome: "succeeded" } };
    }) as never,
    reviewSession: (async ({ request }: { request: { instruction: string } }) => {
      const criteria = [...request.instruction.matchAll(/^\[([\w:-]+)\] /gmu)].map(match => ({ id: match[1], state: "met", evidence: ["fixture"] }));
      return { status: "finished", observations: { nativeOutcome: "succeeded", finalText: "Reviewed.\n" + JSON.stringify({ criteria }) } };
    }) as never });
  const started = await lane.start({ file: "Delivery/4 - Checklist.md", id: "DLV-900", executor: "claude" });
  expect(started.ok).toBe(true);
  return { root, parent, store, lane, id: started.run_id! };
}
async function sealedRun(hookSource: string) {
  const { store, lane, id } = await hookLane(hookSource);
  const started = { run_id: id };
  await lane.wait(started.run_id!);
  const record = JSON.parse(store.getRun(started.run_id!).base_manifest_json);
  return { record, checks: Object.fromEntries(record.checks.map((check: { name: string }) => [check.name, check])) };
}

it("reuses the Seal hook's passed typecheck and tests instead of running them again", async () => {
  const { record, checks } = await sealedRun("process.stdout.write('Running TypeScript check...\\nRunning unit tests...\\n Test Files  3 passed (3)\\n      Tests  9 passed (9)\\nRunning ESLint on staged files...\\n');");
  expect(record.phase).toBe("uat-ready");
  expect(record.checks.map((check: { name: string }) => check.name)).toEqual(["typecheck", "lint", "test", "pm:lint"]);
  expect(checks.typecheck).toMatchObject({ exit: 0, reused: "seal-hook" });
  expect(checks.test).toMatchObject({ exit: 0, reused: "seal-hook", stdout: expect.stringContaining("Test Files  3 passed (3)") });
  expect(checks.lint).toMatchObject({ exit: 0, stdout: expect.stringContaining("lint: host output") });
  expect(checks.lint.reused).toBeUndefined();
  expect(checks["pm:lint"].stdout).toContain("pm:lint: host output");
}, 60_000);

it("runs every host check when the hook printed no test summary", async () => {
  const { record, checks } = await sealedRun("process.stdout.write('Running TypeScript check...\\nRunning unit tests...\\nRunning ESLint on staged files...\\n');");
  expect(record.phase).toBe("uat-ready");
  expect(checks.typecheck.reused).toBe("seal-hook");
  expect(checks.test.reused).toBeUndefined();
  expect(checks.test.stdout).toContain("test: host output");
}, 60_000);

it("reuses only steps a successful hook proved, and never spawns a reused check", async () => {
  const at = "2026-11-25T20:00:00.000Z", later = "2026-11-25T20:05:00.000Z";
  const failedSuite = [{ stage: "typecheck", at, lines: [] }, { stage: "tests", at: later, lines: [" Test Files  1 failed | 2 passed (3)"] }];
  expect(Object.keys(sealedChecks(failedSuite, later))).toEqual(["typecheck"]);
  expect(sealedChecks(failedSuite, later).typecheck).toMatchObject({ started_at: at, finished_at: later, exit: 0 });
  expect(Object.keys(sealedChecks([{ stage: "docs", at, lines: [] }, { stage: "lint", at, lines: [] }], later))).toEqual([]);
  const colored = "\u001b[2m Test Files \u001b[22m \u001b[32m3 passed\u001b[39m (3)";
  expect(Object.keys(sealedChecks([{ stage: "tests", at, lines: [colored] }, { stage: "lint", at: later, lines: [] }], later))).toEqual(["test"]);
  const ran: string[] = [];
  const run = (async (_bin: string, args: string[]) => { ran.push(args.at(-1)!); return { status: 0, signal: null, stdout: "", stderr: "", error: null }; }) as never;
  const reused = { name: "test", started_at: at, finished_at: later, exit: 0, stdout: "hook", stderr: "", error: null, reused: "seal-hook" };
  const results = await hostChecks({ workspace: ".", env: process.env, run, reuse: { test: reused, typecheck: { ...reused, name: "typecheck", exit: 1 } } });
  expect(ran).toEqual(["typecheck", "lint", "pm:lint"]);
  expect(results.map(check => check.name)).toEqual(["typecheck", "lint", "test", "pm:lint"]);
  expect(results[2]).toBe(reused);
});

it("DLV-178 Stop during the Seal hook kills it, then deletes the worktree, branch and run folder", async () => {
  const pidFile = join(mkdtempSync(join(tmpdir(), "era-seal-pid-")), "hook.pid");
  roots.push(dirname(pidFile));
  const { root, store, lane, id } = await hookLane(`require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
    process.stdout.write('Running unit tests...\\n'); setInterval(() => {}, 1000);`);
  await expect.poll(() => store.listActivity(id).some((row: { summary: string }) => row.summary === "Hook: tests"), { timeout: 30_000 }).toBe(true);
  const hookPid = Number(readFileSync(pidFile, "utf8"));
  const record = () => JSON.parse(store.getRun(id).base_manifest_json);
  const workspace = record().workspace;
  const started = Date.now();
  expect(await lane.cancel(id)).toEqual({ ok: true });
  await lane.wait(id);
  expect(Date.now() - started).toBeLessThan(20_000);
  expect(record()).toMatchObject({ phase: "cancelled", failure: { code: "cancelled" } });
  expect(record().cleaned_at).toBeTruthy();
  expect(existsSync(workspace)).toBe(false);
  expect(git(root, "branch", "--list", "delivery/*")).toBe("");
  expect(existsSync(join(root, ".delivery/local", id))).toBe(false);
  expect(existsSync(join(root, ".delivery/local-archive", id, "diff.patch"))).toBe(true);
  const summaries = store.listActivity(id).map((row: { summary: string }) => row.summary);
  expect(summaries.some((line: string) => line.startsWith("Seal refused"))).toBe(false);
  expect(summaries).toContain("Delivery files archived and cleaned");
  await expect.poll(() => { try { process.kill(hookPid, 0); return true; } catch { return false; } }, { timeout: 5000 }).toBe(false);
}, 90_000);
