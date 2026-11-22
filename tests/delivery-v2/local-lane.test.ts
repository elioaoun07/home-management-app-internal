// Replay-only: real temporary Git worktrees/remotes, synthetic subscription and
// native session; all UAT receipts below are fixture-owner actions.
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { createLocalLane } from "../../scripts/delivery-v2/local-lane.mjs";
import { classifyLocalDiff, localEnvironment, localSubscription, localWorkerSubscription, assertNoLocalSecrets } from "../../scripts/delivery-v2/local-guardrails.mjs";
import { installedDependencies } from "../../scripts/delivery-v2/local-process.mjs";
import { LOCAL_LAUNCH_GATES, LAUNCH_GATES } from "../../scripts/delivery-v2/readiness-contract.mjs";
import { loopbackBrowserSession, authenticateLocal, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { recordAvailability, recordResult, signOff, retractSignOff } from "../../scripts/delivery-v2/uat.mjs";
import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { routeLocal } from "../../scripts/delivery-v2/local-routes.mjs";
import { listStewardRequests } from "../../scripts/delivery-v2/steward-requests.mjs";
import { buildSessionOptions } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { runProcess } from "../../scripts/delivery-v2/process.mjs";
import { createPreviews } from "../../scripts/delivery-v2/local-preview.mjs";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

const roots: string[] = [];
const stores: ReturnType<typeof openStore>[] = [];
afterEach(() => { vi.unstubAllEnvs(); stores.splice(0).forEach(s => s.close()); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function temp() { const root = mkdtempSync(join(tmpdir(), "era-local-")); roots.push(root); return root; }
// Git hooks export GIT_INDEX_FILE; a fixture worktree must use its own index,
// just like the production Local supervisor's scrubbed Git environment.
const git = (root: string, ...args: string[]) => execFileSync("git", args, { cwd: root, env: { ...localEnvironment(), NODE_ENV: "test" }, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root: string, path: string, value: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
const PM = "ERA Notes/10 - Project Management";
async function fixture(risk = false, red = false, failFirst = false, executor = "claude",
  options: Pick<Parameters<typeof createLocalLane>[0], "run" | "limits" | "checks" | "session" | "prepareDependencies"> = {}) {
  const parent = temp(), root = join(parent, "repo"), remote = join(parent, "origin.git");
  mkdirSync(root); git(root, "init", "-b", "main"); git(root, "config", "user.email", "fixture@example.invalid"); git(root, "config", "user.name", "Fixture");
  git(parent, "init", "--bare", remote); git(root, "remote", "add", "origin", remote);
  put(root, ".gitignore", "node_modules/\n.delivery/\n");
  put(root, "CLAUDE.md", "Fixture instructions\n");
  put(root, ".claude/skills/start-task/SKILL.md", "Fixture skill\n");
  put(root, `${PM}/Delivery/4 - Checklist.md`, "# Checklist\n\n## Next\n\n- [ ] **DLV-899** Preserve this other item _(friction - S)_\n- [ ] **DLV-900** Change the greeting — [criteria](<Delivery — Master Book.md#dlv-900>) _(friction - S)_\n");
  put(root, `${PM}/Delivery/Delivery — Master Book.md`, "# Delivery\n\n## Acceptance Criteria Index\n\n### DLV-900\n\n**Outcome:** greeting changes\n\n- **Acceptance:** changed greeting\n- **UAT:** pending\n\n## Shipped Log\n");
  put(root, "package.json", JSON.stringify({ scripts: Object.fromEntries(["typecheck", "lint", "test", "pm:lint"].map(name => [name, `node check.cjs ${name}`])) }));
  put(root, "check.cjs", `process.stdout.write(process.argv[2] + ': host output\\n'); ${red ? "if(process.argv[2]==='lint') process.exitCode=1;" : ""}`);
  put(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\nimporters:\n  .:\n");
  put(root, "node_modules/.pnpm/lock.yaml", readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
  put(root, "greeting.txt", "before\n");
  git(root, "add", "."); git(root, "commit", "-m", "fixture base"); git(root, "push", "origin", "main");
  const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") }); stores.push(store);
  const credential = join(parent, "subscription"); mkdirSync(credential); put(credential, ".credentials.json", JSON.stringify({ fixture: true }));
  put(credential, "auth.json", JSON.stringify({ fixture: true }));
  let launches = 0;
  let releaseFirst: () => void = () => {};
  let requestedSettings: unknown = null;
  const lane = createLocalLane({ root, store, authenticate: () => ({ ok: true, method: "fixture", directory: credential }),
    catalog: () => ({ revision: 1, models: { claude: [{ id: "fixture-claude", efforts: ["medium"] }, { id: "disabled-claude", disabled: true }], codex: [{ id: "fixture-codex", efforts: ["medium"] }] } }),
    prepareDependencies: async (workspace: string) => { put(workspace, "node_modules/.pnpm/lock.yaml", readFileSync(join(workspace, "pnpm-lock.yaml"), "utf8")); return { status: 0 }; },
    session: async ({ request, env }: { request: { workspace: { root: string }; instruction: string }; env: Record<string, string> }) => {
      launches++;
      if (failFirst && launches === 1) {
        await new Promise<void>(resolve => { releaseFirst = resolve; });
        throw new Error("synthetic native startup failure");
      }
      requestedSettings = (request as typeof request & { settings: unknown }).settings;
      const workspace = request.workspace.root;
      expect(readFileSync(join(workspace, "CLAUDE.md"), "utf8")).toContain("Fixture instructions");
      expect(existsSync(join(workspace, ".claude/skills/start-task/SKILL.md"))).toBe(true);
      expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY"); expect(env).not.toHaveProperty("CRON_SECRET"); expect(env).not.toHaveProperty("OPENAI_API_KEY");
      expect(request.instruction).toContain("DLV-900");
      expect(request.instruction).toContain("Do not commit; the supervisor commits your work.");
      expect(request.instruction).not.toMatch(/Commit the change|commit it/);
      if (executor === "codex") {
        const config = readFileSync(join(env.CODEX_HOME, "config.toml"), "utf8");
        expect(config).toContain('forced_login_method = "chatgpt"');
        expect(config).toContain('cli_auth_credentials_store = "file"');
        if (process.platform === "win32") expect(config).toContain('[windows]\nsandbox = "unelevated"');
        else expect(config).not.toContain("[windows]");
      }
      if (executor === "claude" && process.platform === "win32") {
        expect(request.instruction).toContain("You have no shell. The supervisor runs the checks after you finish.");
        expect(request.instruction).not.toContain("Finish with checks");
      } else expect(request.instruction).not.toContain("You have no shell");
      put(workspace, risk ? "src/features/accounts/change.ts" : "greeting.txt", "after\n");
      put(workspace, ".delivery-handover.json", JSON.stringify({ summary: "Changed greeting", scenarios: [{ id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read greeting", expected: "after" }] }] }));
      return { status: "finished", observations: { nativeOutcome: "succeeded", usage: { input: 1, output: 1 } } };
    }, ...options });
  const input = { file: "Delivery/4 - Checklist.md", id: "DLV-900", executor };
  return { parent, root, remote, store, lane, input, launches: () => launches, releaseFirst: () => releaseFirst(), requestedSettings: () => requestedSettings };
}
async function built(risk = false, red = false) {
  const f = await fixture(risk, red);
  const launched = await f.lane.start(f.input);
  expect(launched.ok).toBe(true);
  const id = launched.run_id!;
  await f.lane.wait(id);
  const view: LocalRunView = await f.lane.detail(id);
  return { ...f, id, view };
}
function accept(root: string, handover: { handover_id: string; revision: number }) {
  const args = { root, handover_id: handover.handover_id, revision: handover.revision, actor: "fixture-owner", now: new Date().toISOString() };
  expect(recordAvailability({ ...args, available: true, command_id: randomUUID() }).ok).toBe(true);
  expect(recordResult({ ...args, scenario_id: "greeting", result: "pass", command_id: randomUUID() }).ok).toBe(true);
  expect(signOff({ ...args, command_id: randomUUID() }).ok).toBe(true);
}

it("continues bulk cleanup after a selection fails its preview check", async () => {
  const f = await built();
  const record = JSON.parse(f.store.getRun(f.id).base_manifest_json);
  f.store.updateRun(f.id, { base_manifest_json: { ...record, phase: "failed" } });
  const preview = (await f.lane.storage()).runs.find(run => run.run_id === f.id)!;
  const missing = "local-" + randomUUID();
  const result = await f.lane.cleanup([
    { run_id: missing, witness: preview.witness },
    { run_id: f.id, witness: preview.witness },
  ]);
  expect(result.failed).toEqual([{ run_id: missing, reason: "unknown-local-run" }]);
  expect(result.cleaned).toMatchObject([{ run_id: f.id }]);
  expect(existsSync(record.workspace)).toBe(false);
}, 60_000);

it("records Local narration beside supervisor events and deduplicates repeated native ordinals", async () => {
  const text = "The recorded message. ".repeat(30);
  const f = await fixture(false, false, false, "claude", { session: async ({ onActivity }) => {
    const row = { seq: 0, at: "2026-11-22T12:00:00Z", kind: "message", summary: text.slice(0, 240), message_text: text };
    onActivity?.(row);
    onActivity?.(row);
    return { status: "finished", observations: { nativeOutcome: "failed", error: "Fixture stopped" } };
  } });
  const id = (await f.lane.start(f.input)).run_id!;
  await f.lane.wait(id);
  const rows = (await f.lane.detail(id)).activity;
  expect(rows.some((row: {summary: string}) => row.summary === "Native session started")).toBe(true);
  expect(rows.filter((row: {kind: string}) => row.kind === "message")).toMatchObject([
    { summary: text.slice(0, 240), message_text: text, message_excerpt: false },
  ]);
  expect(f.store.listActivity(id).find((row: { kind: string }) => row.kind === "message")?.summary).toBe(text.slice(0, 240));
  f.store.appendActivity(id, id, Array.from({ length: 245 }, (_, index) => ({ kind: "status", summary: String(index) })));
  const window = await f.lane.detail(id);
  expect(window.activity).toHaveLength(200);
  expect(window.earlier_activity).toBe(true);
  const collected = [...window.activity];
  let older = window.earlier_activity;
  while (older) {
    const page = f.lane.earlierActivity(id, collected[0].seq);
    expect(page.activity.length).toBeGreaterThan(0);
    expect(page.activity.length).toBeLessThanOrEqual(30);
    collected.unshift(...page.activity);
    older = page.more;
  }
  expect(collected.map(row => row.seq)).toEqual(f.store.listActivity(id, 1000).map((row: { seq: number }) => row.seq));
}, 60_000);

describe("Owner station comparison", () => {
  it("reads only candidate paths against either revision without accepting review", async () => {
    const f = await fixture(false, false, false, "claude", { checks: async () => [
      { name: "fixture", exit: 0, stdout: "", stderr: "", error: null, started_at: "", finished_at: "" },
    ] });
    const id = (await f.lane.start(f.input)).run_id!;
    await f.lane.wait(id);
    const view = await f.lane.detail(id);
    const request = (fields: Record<string, string>, peer = true) => routeLocal({
      method: "GET", path: "/api/delivery/v2/local/comparison", query: new URLSearchParams({ id, head: view.head, ...fields }),
      loopbackPeer: peer,
    }, { kind: "browser" }, { local: f.lane });
    expect((await request({}, false))?.status).toBe(403);
    expect((await request({}))?.json).toMatchObject({ base: view.base, head: view.head,
      files: expect.arrayContaining([{ status: "M", path: "greeting.txt" }]) });
    expect((await request({ path: "greeting.txt" }))?.json).toMatchObject({ patch: expect.stringContaining("-before\n+after") });
    put(f.root, "greeting.txt", "new owner version\n");
    put(f.root, "unrelated.txt", "other work\n");
    git(f.root, "add", "."); git(f.root, "commit", "-m", "owner changes");
    const source = git(f.root, "rev-parse", "HEAD");
    expect((await request({ against: "repo" }))?.json).toMatchObject({ base: source });
    expect((await request({ against: "repo", source, path: "greeting.txt" }))?.json).toMatchObject({ patch: expect.stringContaining("-new owner version\n+after") });
    expect((await request({ against: "repo", source: view.base, path: "greeting.txt" }))?.status).toBe(409);
    expect((await request({ against: "repo", path: "unrelated.txt" }))?.status).toBe(409);
    expect((await request({ path: "." }))?.status).toBe(409);
    expect((await request({ head: view.base }))?.status).toBe(409);
    await expect(f.lane.review(id, view.base)).rejects.toThrow("Candidate changed");
    expect((await f.lane.detail(id)).reviewed_head).toBeFalsy();
  }, 30_000);
});

describe("DLV-174 Refresh", () => {
  async function candidate() {
    let passes = 0;
    let failNext = false;
    const f = await fixture(false, false, false, "claude", {
      checks: async () => {
        passes++;
        const results = ["typecheck", "lint", "test", "pm:lint"].map(name => ({ name, started_at: "", finished_at: "",
          exit: failNext && name === "test" ? 1 : 0, stdout: "", stderr: "", error: null }));
        failNext = false;
        return results;
      },
      session: async ({ request }) => {
        const workspace = request.workspace.root;
        const content = readFileSync(join(workspace, "greeting.txt"), "utf8").replace("last", "candidate");
        put(workspace, "greeting.txt", content);
        put(workspace, ".delivery-handover.json", JSON.stringify({ summary: "Greeting", scenarios: [
          { id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read", expected: "candidate" }] }] }));
        return { status: "finished", observations: { nativeOutcome: "succeeded" } };
      },
    });
    const original = ["first", "2", "3", "4", "5", "6", "7", "8", "9", "last", ""].join("\n");
    put(f.root, "greeting.txt", original);
    git(f.root, "commit", "-am", "prepare multi-line fixture");
    const id = (await f.lane.start(f.input)).run_id!;
    await f.lane.wait(id);
    const view = await f.lane.detail(id);
    accept(f.root, view.handover!);
    return { ...f, original, id, view, passes: () => passes, failChecks: () => { failNext = true; } };
  }
  it("rechecks a clean rebase, revokes the old sign-off, and never alters main", async () => {
    const f = await candidate();
    put(f.root, "greeting.txt", f.original.replace("first", "owner"));
    expect((await f.lane.detail(f.id)).mergePlan).toMatchObject({ canRefresh: false, dirtyConflicts: ["greeting.txt"] });
    git(f.root, "commit", "-am", "owner changed the first line");
    const base = git(f.root, "rev-parse", "HEAD");
    const detail = await f.lane.detail(f.id);
    expect(detail.mergePlan).toMatchObject({ canRefresh: true, refreshBase: base, committedConflicts: ["greeting.txt"] });
    await expect(f.lane.refresh(f.id, f.view.base, f.view.head)).rejects.toThrow(/preview changed/i);
    f.failChecks();
    const refreshRequest = { method: "POST", path: "/api/delivery/v2/local", loopbackPeer: true,
      body: { action: "refresh", run_id: f.id, expected_base: base, expected_head: f.view.head } };
    const routed = await routeLocal(refreshRequest, { kind: "browser" }, { local: f.lane });
    expect(routed?.status).toBe(200);
    const failed = routed!.json;
    expect(failed).toMatchObject({ phase: "refresh-failed", handover_id: null, canMerge: false });
    const next = await f.lane.refresh(f.id, base, failed.head);
    expect(f.passes()).toBe(3);
    expect(next).toMatchObject({ phase: "uat-ready", base, canMerge: false, reviewed_head: null });
    expect(next.head).not.toBe(f.view.head);
    expect(next.handover!.binding.source_revision).toBe(next.head);
    expect(next.handover!.revision).toBeGreaterThan(f.view.handover!.revision);
    accept(f.root, next.handover!);
    expect((await f.lane.detail(f.id)).canMerge).toBe(true);
    expect(git(f.root, "rev-parse", "HEAD")).toBe(base);
    expect(git(f.root, "status", "--porcelain")).toBe("");
  }, 60_000);
  it("records the conflicting paths and restores the original tested branch", async () => {
    const f = await candidate();
    put(f.root, "greeting.txt", f.original.replace("last", "owner"));
    git(f.root, "commit", "-am", "overlapping owner change");
    const base = git(f.root, "rev-parse", "HEAD");
    const result = await f.lane.refresh(f.id, base, f.view.head);
    expect(result).toMatchObject({ phase: "refresh-conflict", handover_id: null, canMerge: false,
      refresh: { conflicts: ["greeting.txt"] } });
    expect(result.refresh.commands.map((c: { exit: number }) => c.exit)).toEqual([1, 0]);
    expect(git(result.workspace, "rev-parse", "HEAD")).toBe(f.view.head);
    expect(git(result.workspace, "status", "--porcelain")).toBe("");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(base);
    expect(f.passes()).toBe(1);
  }, 60_000);
});

describe("DLV-159 supervisor Git limits", () => {
  const stages = ["Checking AI guidance docs...", "Checking generated agent setup...", "Checking PWA manifests...",
    "Running TypeScript check...", "Running unit tests...", "Running ESLint on staged files..."];
  function hook(root: string, source: string) {
    const script = join(root, ".git", "hook.cjs");
    put(root, ".git/hook.cjs", source);
    const quote = (value: string) => `'${value.replace(/\\/gu, "/").replace(/'/gu, `'"'"'`)}'`;
    put(root, ".git/hooks/pre-commit", `#!/bin/sh\n${quote(process.execPath)} ${quote(script)}\n`);
    git(root, "config", "core.fileMode", "false");
    // Git requires executable hooks on POSIX; Windows Git runs the shebang.
    if (process.platform !== "win32") chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
  }
  it.each([2000, 31_000])("lets a successful %i ms hook reach host checks", async delay => {
    const f = await fixture(false, false, false, "claude", { limits: { hookMs: delay + 10_000 } });
    hook(f.root, `setTimeout(() => {}, ${delay});`);
    const started = await f.lane.start(f.input);
    await f.lane.wait(started.run_id!);
    const view = await f.lane.detail(started.run_id!);
    expect(view.phase).toBe("uat-ready");
    expect(view.activity.some((row: { summary: string }) => row.summary === "Host checks started")).toBe(true);
  }, 60_000);
  it("kills the timed-out hook and its child, keeps HEAD at base and names the limit", async () => {
    const f = await fixture(false, false, false, "claude", { limits: { hookMs: 1000 } });
    const pidFile = join(f.parent, "hook-pids.json");
    hook(f.root, `const {spawn}=require('node:child_process'); const fs=require('node:fs');
      const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{windowsHide:true});
      fs.writeFileSync(${JSON.stringify(pidFile)},JSON.stringify([process.pid,child.pid]));
      process.stderr.write('Running unit tests...\\n');setInterval(()=>{},1000);`);
    const started = await f.lane.start(f.input);
    await f.lane.wait(started.run_id!);
    const view = await f.lane.detail(started.run_id!);
    expect(view).toMatchObject({ phase: "failed", error: "git commit: timed out after 1 s" });
    expect(view.failure).toEqual({ code: "commit-timeout", step: "Seal", detail: "timed out after 1 s" });
    expect(JSON.parse(readFileSync(join(f.root, ".delivery/local-archive", started.run_id!, "archive.json"), "utf8")).head).toBe(view.base);
    const pids: number[] = JSON.parse(readFileSync(pidFile, "utf8"));
    expect(pids).toHaveLength(2);
    for (const pid of pids) await expect.poll(() => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    }, { timeout: 5000 }).toBe(false);
  }, 60_000);
  it("records each real hook stage once in order before host checks", async () => {
    const f = await fixture();
    hook(f.root, `for(const line of ${JSON.stringify(stages)}) process.stdout.write(line+'\\n'+line+'\\n');`);
    const started = await f.lane.start(f.input);
    await f.lane.wait(started.run_id!);
    const view = await f.lane.detail(started.run_id!);
    expect(view.phase).toBe("uat-ready");
    const rows = view.activity.map((row: { summary: string }) => row.summary);
    expect(rows.slice(rows.indexOf("Committing candidate") + 1, rows.indexOf("Host checks started")).filter((row: string) => row.startsWith("Hook:")))
      .toEqual(["Hook: docs", "Hook: mirrors", "Hook: manifests", "Hook: typecheck", "Hook: tests", "Hook: lint"]);
  }, 60_000);
  it("preserves the hook's nonzero-exit error text", async () => {
    const f = await fixture();
    hook(f.root, "process.stderr.write('fixture hook rejected\\n');process.exitCode=2;");
    const started = await f.lane.start(f.input);
    await f.lane.wait(started.run_id!);
    expect(await f.lane.detail(started.run_id!)).toMatchObject({ phase: "failed", error: "git commit: fixture hook rejected\n",
      failure: { code: "commit-hook", step: "Seal", detail: "git commit: fixture hook rejected" } });
  }, 60_000);
  it("keeps archived Ship and Undo unable to change the checkout", async () => {
    const f = await fixture();
    const head = git(f.root, "rev-parse", "HEAD");
    await expect(f.lane.ship()).rejects.toThrow("Ship retired");
    await expect(f.lane.undo()).rejects.toThrow("Undo retired");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(head);
  });
});

describe("DLV-160 recorded failure reasons", () => {
  async function attempt(options: Parameters<typeof fixture>[4]) {
    const f = await fixture(false, false, false, "claude", options);
    const started = await f.lane.start(f.input);
    await f.lane.wait(started.run_id!);
    const view = await f.lane.detail(started.run_id!);
    expect(f.store.getRun(started.run_id!).lifecycle).toBe("CLOSED");
    // The record survives a fresh lane instance, not just the in-memory task.
    const stored = await createLocalLane({ root: f.root, store: f.store }).detail(started.run_id!);
    expect(stored.failure).toEqual(view.failure);
    return view;
  }
  it("keeps the last twenty install stderr lines and the full old-reader log", async () => {
    const stderr = Array.from({ length: 25 }, (_, i) => `install line ${i}`).join("\n") + "\n";
    const view = await attempt({ prepareDependencies: async () => ({ status: 1, stderr }) });
    expect(view.failure).toEqual({ code: "install", step: "Setup", detail: stderr.trimEnd().split("\n").slice(-20).join("\n") });
    expect(view.error).toContain("install line 0");
  }, 60_000);
  it.each(["before", "after"])("records the %s-session secret guard's own reason", async when => {
    const options = when === "before" ? {
      prepareDependencies: async (workspace: string) => {
        put(workspace, "node_modules/.pnpm/lock.yaml", readFileSync(join(workspace, "pnpm-lock.yaml"), "utf8"));
        put(workspace, ".env.local", "fixture only"); return { status: 0 };
      },
    } : {
      session: async ({ request }: { request: { workspace: { root: string } } }) => {
        put(request.workspace.root, ".env.local", "fixture only");
        return { status: "finished", observations: { nativeOutcome: "succeeded" } };
      },
    };
    const view = await attempt(options);
    expect(view.failure).toEqual({ code: "secrets", step: "Setup", detail: "worktree contains an .env file" });
  }, 60_000);
  it.each([
    { status: "failed", observations: { nativeOutcome: "failed", error: "Sandbox required but unavailable: windows is not supported", finalText: "other reason" }, detail: "Sandbox required but unavailable: windows is not supported" },
    { status: "finished", observations: { nativeOutcome: "failed", finalText: "f".repeat(450) }, detail: "f".repeat(400) },
    { status: "finished", observations: {}, detail: "no reason reported" },
  ])("keeps the native reason for $status / $detail", async ({ status, observations, detail }) => {
    const view = await attempt({ session: async () => ({ status, observations }) });
    expect(view.failure).toEqual({ code: "native-error", step: "Build", detail });
    expect(view.error).toBe(`native session failed: ${detail}`);
  }, 60_000);
  it("records a rejected native session without discarding its reason", async () => {
    const view = await attempt({ session: async () => { throw new Error("native session exited 1: fixture crash"); } });
    expect(view.failure).toEqual({ code: "native-error", step: "Build", detail: "native session exited 1: fixture crash" });
  }, 60_000);
  it("keeps the no-change ending's first four hundred characters", async () => {
    const finalText = "the workspace policy is read-only, and command execution was rejected. ".repeat(8);
    const view = await attempt({ session: async () => ({ status: "finished", observations: { nativeOutcome: "succeeded", finalText } }) });
    expect(view.failure).toEqual({ code: "no-change", step: "Build", detail: finalText.slice(0, 400) });
    expect(view.error).toBe(`candidate needs a change: ${finalText.slice(0, 400)}`);
  }, 60_000);
  it("names the failed check with decisive lines while retaining all its output", async () => {
    const raw = "check chatter\n FAIL tests/fixture.test.ts\nAssertionError: fixture mismatch\n Test Files 1 failed\n Tests 1 failed\n";
    const view = await attempt({ checks: async () => ["typecheck", "lint", "test", "pm:lint"].map(name => ({ name, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), exit: name === "test" ? 1 : 0, stdout: name === "test" ? raw : "", stderr: "", error: null })) });
    expect(view.failure).toEqual({ code: "checks", step: "Verify", detail: "test\n FAIL tests/fixture.test.ts\nAssertionError: fixture mismatch\n Test Files 1 failed\n Tests 1 failed" });
    expect(view.error).toContain("check chatter");
  }, 60_000);
  it("names a checker that throws before producing a result", async () => {
    const view = await attempt({ checks: async ({ onStart }) => { onStart?.("lint"); throw new Error("lint runner unavailable"); } });
    expect(view.failure).toEqual({ code: "checks", step: "Verify", detail: "lint\nlint runner unavailable" });
  }, 60_000);
  it("reports missing check results", async () => {
    const view = await attempt({ checks: async () => [] });
    expect(view.failure).toEqual({ code: "checks", step: "Verify", detail: "host checks\nexpected 4 check results, received 0" });
  }, 60_000);
  it("keeps an ordinary Git error out of the commit-hook classification", async () => {
    const view = await attempt({ run: (command, args, options) => {
      if (command === "git" && args[1] === "status" && options?.cwd?.includes("repo-delivery")) return Promise.resolve({ status: 1, stdout: "", stderr: "fixture status unavailable", error: null, signal: null });
      return runProcess(command, args, options);
    } });
    expect(view.error).toBe("git status: fixture status unavailable");
    expect(view.failure).toBeUndefined();
  }, 60_000);
  it("keeps candidate drift distinct from passed host checks", async () => {
    const view = await attempt({ checks: async ({ workspace }) => {
      put(workspace, "unexpected.txt", "changed during checks");
      return ["typecheck", "lint", "test", "pm:lint"].map(name => ({ name, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), exit: 0, stdout: "", stderr: "", error: null }));
    } });
    expect(view.error).toBe("candidate changed during host checks");
    expect(view.checks.every((check: { exit: number }) => check.exit === 0)).toBe(true);
    expect(view.failure).toBeUndefined();
  }, 60_000);
  it.each(["missing", "unparsable", "incomplete"])("names a %s handover", async condition => {
    const view = await attempt({ session: async ({ request }) => {
      put(request.workspace.root, "greeting.txt", "after\n");
      if (condition !== "missing") put(request.workspace.root, ".delivery-handover.json", condition === "unparsable" ? "{bad json" : JSON.stringify({ summary: "missing scenarios" }));
      return { status: "finished", observations: { nativeOutcome: "succeeded" } };
    }, checks: async () => ["typecheck", "lint", "test", "pm:lint"].map(name => ({ name, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), exit: 0, stdout: "", stderr: "", error: null })) });
    expect(view.failure).toMatchObject({ code: "handover", step: "Handover" });
    expect(view.failure?.detail).toContain(`.delivery-handover.json ${condition}`);
    if (condition === "incomplete") expect(view.failure?.detail).toContain("no-scenarios");
    expect(view.error).toContain(view.failure?.detail);
  }, 60_000);
  it("records cancellation independently of a native rejection", async () => {
    let startedNative: () => void = () => {};
    const started = new Promise<void>(resolve => { startedNative = resolve; });
    const f = await fixture(false, false, false, "claude", { session: async ({ signal }) => {
      startedNative();
      await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
      throw new Error("native process stopped");
    } });
    const launched = await f.lane.start(f.input);
    await started;
    await f.lane.cancel(launched.run_id!);
    await f.lane.wait(launched.run_id!);
    expect(await f.lane.detail(launched.run_id!)).toMatchObject({ phase: "cancelled", error: "cancelled", failure: { code: "cancelled", step: "—", detail: "—" } });
  }, 60_000);
});

describe("DLV-164/165 owner questions and messages", () => {
  const question = { question: "Which greeting should ship?", header: "Greeting", multiSelect: false,
    options: [{ label: "Hello (Recommended)", description: "Matches the brief." }, { label: "Hi", description: "Shorter." }] };
  type Request = { job_id: string; instruction: string; workspace: { root: string }; resume?: { dispatch_key: string; native_ref: string } };
  type Message = { type: string; id: string; text: string };
  type Native = { request: Request; env: Record<string, string>; signal: AbortSignal; onQuestion: (value: unknown) => void;
    onDelivered: (ids: string[]) => void; onChannel: (send: (message: Message) => boolean) => void };
  const auth = { kind: "browser", actor: "fixture-owner" };
  const command = (body: Record<string, unknown>) => ({ method: "POST", path: "/api/delivery/v2/local", loopbackPeer: true, body });
  const finish = (root: string, greeting: string) => {
    put(root, "greeting.txt", `${greeting}\n`);
    put(root, ".delivery-handover.json", JSON.stringify({ summary: "Changed greeting", scenarios: [{ id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read greeting", expected: greeting }] }] }));
  };
  const succeeded = () => ({ status: "finished", observations: { nativeOutcome: "succeeded", usage: { input: 1, output: 1 } } });
  const parked = () => ({ status: "finished", executionRef: { native_ref: "native-1" }, observations: { nativeOutcome: "parked", parked: { id: "toolu_lane" }, usage: { input: 1, output: 1 } } });
  const told = (instruction: string) => /Answer: (\w+)/u.exec(instruction)?.[1] ?? /owner:\n(\w+)/u.exec(instruction)?.[1] ?? "none";
  /** The first segment asks and parks; a resumed segment writes what it was told. */
  const asking = (calls: Request[]) => async ({ request, onQuestion }: Native) => {
    calls.push(request);
    if (!request.resume) { onQuestion({ id: "toolu_lane", questions: [question] }); return parked(); }
    finish(request.workspace.root, told(request.instruction));
    return succeeded();
  };
  const restart = (f: Awaited<ReturnType<typeof fixture>>, session: unknown) => createLocalLane({ root: f.root, store: f.store, session: session as never,
    authenticate: () => ({ ok: true, method: "fixture", directory: join(f.parent, "subscription") }) });
  const gate = () => { let open: () => void = () => {}; const opened = new Promise<void>(resolve => { open = resolve; }); return { open, opened }; };

  it("parks on a question with no process, survives a restart and resumes the same session with the answer", async () => {
    const calls: Request[] = [];
    const f = await fixture(false, false, false, "claude", { session: asking(calls) as never });
    const { run_id: id } = await f.lane.start(f.input);
    await f.lane.wait(id!);
    expect(calls[0].instruction).toContain("AskUserQuestion");
    expect(calls[0].instruction).toContain("(Recommended)");
    expect(calls[0].instruction).toContain("The owner may message you while you work");
    expect(await f.lane.detail(id!)).toMatchObject({ phase: "building", parked: true, interrupted: false, canMessage: true, native_ref: "native-1",
      questions: [{ id: "toolu_lane", state: "open", questions: [question] }] });
    expect(f.store.getJob(id!).status).toBe("paused");
    const lane = restart(f, asking(calls));
    expect(lane.list()[0]).toMatchObject({ active: false, ownerAction: "Question", ownerActionKind: "local-question" });
    expect(await lane.detail(id!)).toMatchObject({ parked: true, interrupted: false, questions: [{ state: "open" }] });
    await expect(lane.answer(id!, "toolu_lane", {})).rejects.toThrow("answer-every-question");
    await expect(lane.answer(id!, "missing", { [question.question]: "Hello" })).rejects.toThrow("unknown-question");
    const routed = await routeLocal(command({ action: "answer", run_id: id, question_id: "toolu_lane", answers: { [question.question]: "Hello" } }), auth, { local: lane });
    expect(routed?.status).toBe(200);
    await lane.wait(id!);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ job_id: `${id}:r1`, resume: { dispatch_key: id, native_ref: "native-1" } });
    expect(calls[1].instruction).toContain(`- ${question.question}\n  Answer: Hello`);
    const view = await lane.detail(id!);
    expect(view).toMatchObject({ phase: "uat-ready", parked: false, segments: 1, canMessage: false,
      questions: [{ state: "answered", answers: { [question.question]: "Hello" }, delivered_at: expect.any(String) }] });
    expect(readFileSync(join(view.workspace, "greeting.txt"), "utf8")).toBe("Hello\n");
    expect(view.usage).toMatchObject({ input: 2, output: 2 });
    expect(f.store.listActivity(id!).map((row: { summary: string }) => row.summary)).toEqual(expect.arrayContaining(["Question: Greeting", "Waiting for owner", "Owner answered", "Session resumed"]));
    expect(lane.list()[0]).toMatchObject({ ownerActionKind: "local-review" });
    expect(await lane.answer(id!, "toolu_lane", { [question.question]: "Hello" })).toMatchObject({ ok: true, replayed: true });
    await expect(lane.answer(id!, "toolu_lane", { [question.question]: "Hi" })).rejects.toThrow("question-already-answered");
  }, 60_000);

  it("resumes a parked session with an owner message instead of an answer", async () => {
    const calls: Request[] = [];
    const f = await fixture(false, false, false, "claude", { session: asking(calls) as never });
    const { run_id: id } = await f.lane.start(f.input);
    await f.lane.wait(id!);
    expect((await routeLocal(command({ action: "message", run_id: id, text: "Howdy" }), auth, { local: f.lane }))?.status).toBe(200);
    await f.lane.wait(id!);
    expect(calls[1].instruction).toContain("Message from the owner:\nHowdy");
    const view = await f.lane.detail(id!);
    expect(view.questions).toMatchObject([{ state: "closed", answers: null, closed_at: expect.any(String) }]);
    expect(view.messages).toMatchObject([{ text: "Howdy", delivered_at: expect.any(String) }]);
    expect(readFileSync(join(view.workspace, "greeting.txt"), "utf8")).toBe("Howdy\n");
    await expect(f.lane.answer(id!, "toolu_lane", { [question.question]: "Hello" })).rejects.toThrow("question-closed");
  }, 60_000);

  it("delivers a message to a running session at its next step, without a resume", async () => {
    const calls: Request[] = [];
    const running = gate(), arrived = gate();
    let received: Message | null = null;
    const session = async ({ request, onChannel, onDelivered }: Native) => {
      calls.push(request);
      onChannel(message => { received = message; arrived.open(); return true; });
      running.open();
      await arrived.opened;
      onDelivered([received!.id]);
      finish(request.workspace.root, received!.text);
      return succeeded();
    };
    const f = await fixture(false, false, false, "claude", { session: session as never });
    const { run_id: id } = await f.lane.start(f.input);
    await running.opened;
    expect((await f.lane.detail(id!)).canMessage).toBe(true);
    await f.lane.message(id!, "Greetings");
    await f.lane.wait(id!);
    expect(calls).toHaveLength(1);
    const view = await f.lane.detail(id!);
    expect(view).toMatchObject({ phase: "uat-ready", messages: [{ text: "Greetings", delivered_at: expect.any(String) }] });
    expect(readFileSync(join(view.workspace, "greeting.txt"), "utf8")).toBe("Greetings\n");
    await expect(f.lane.message(id!, "late")).rejects.toThrow("session-not-taking-messages");
  }, 60_000);

  it("resumes before checks with a message the agent never took", async () => {
    const calls: Request[] = [];
    const running = gate(), arrived = gate();
    const session = async ({ request, onChannel }: Native) => {
      calls.push(request);
      if (request.resume) { finish(request.workspace.root, told(request.instruction)); return succeeded(); }
      onChannel(() => { arrived.open(); return true; });
      running.open();
      await arrived.opened;
      return { ...succeeded(), executionRef: { native_ref: "thread-1" } };
    };
    const f = await fixture(false, false, false, "codex", { session: session as never });
    const { run_id: id } = await f.lane.start(f.input);
    await running.opened;
    await f.lane.message(id!, "Salut");
    await f.lane.wait(id!);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ resume: { native_ref: "thread-1" } });
    expect(calls[1].instruction).toContain("Message from the owner:\nSalut");
    expect(await f.lane.detail(id!)).toMatchObject({ phase: "uat-ready", messages: [{ delivered_at: expect.any(String) }] });
  }, 60_000);

  it("takes an answer given while the session winds down and resumes at once", async () => {
    const calls: Request[] = [];
    const asked = gate(), release = gate();
    const session = async ({ request, onQuestion }: Native) => {
      calls.push(request);
      if (request.resume) { finish(request.workspace.root, told(request.instruction)); return succeeded(); }
      onQuestion({ id: "toolu_lane", questions: [question] });
      asked.open();
      await release.opened;
      return parked();
    };
    const f = await fixture(false, false, false, "claude", { session: session as never });
    const { run_id: id } = await f.lane.start(f.input);
    await asked.opened;
    expect(await f.lane.answer(id!, "toolu_lane", { [question.question]: "Hi" })).toEqual({ ok: true });
    release.open();
    await f.lane.wait(id!);
    expect(calls).toHaveLength(2);
    expect(await f.lane.detail(id!)).toMatchObject({ phase: "uat-ready", parked: false });
    expect(f.store.listActivity(id!).map((row: { summary: string }) => row.summary)).not.toContain("Waiting for owner");
  }, 60_000);

  it("cancels a parked session directly and refuses later answers and messages", async () => {
    const calls: Request[] = [];
    const f = await fixture(false, false, false, "claude", { session: asking(calls) as never });
    const { run_id: id } = await f.lane.start(f.input);
    await f.lane.wait(id!);
    await f.lane.cancel(id!);
    expect(await f.lane.detail(id!)).toMatchObject({ phase: "cancelled", parked: false, questions: [{ state: "closed" }] });
    await expect(f.lane.answer(id!, "toolu_lane", { [question.question]: "Hello" })).rejects.toThrow("question-closed");
    await expect(f.lane.message(id!, "hello?")).rejects.toThrow("session-not-taking-messages");
    expect(calls).toHaveLength(1);
  }, 60_000);

  it("fails a session that parks without a recorded question rather than waiting forever", async () => {
    const f = await fixture(false, false, false, "claude", { session: (async () => parked()) as never });
    const { run_id: id } = await f.lane.start(f.input);
    await f.lane.wait(id!);
    expect(await f.lane.detail(id!)).toMatchObject({ phase: "failed", error: expect.stringContaining("parked without a recorded question") });
  }, 60_000);

  it("gives Local Codex the ask_owner tool through its private config", async () => {
    let config = "", instruction = "";
    const f = await fixture(false, false, false, "codex", { session: (async ({ request, env }: Native) => {
      config = readFileSync(join(env.CODEX_HOME, "config.toml"), "utf8");
      instruction = request.instruction;
      finish(request.workspace.root, "after");
      return succeeded();
    }) as never });
    const { run_id: id } = await f.lane.start(f.input);
    await f.lane.wait(id!);
    expect(config).toContain("[mcp_servers.era_owner]");
    expect(config).toContain(JSON.stringify(process.execPath));
    expect(config).toMatch(/local-ask-mcp\.mjs/u);
    expect(instruction).toContain("call the ask_owner tool");
    expect(instruction).not.toContain("AskUserQuestion");
  }, 60_000);
});

describe("Local history reads", () => {
  function history(head: string | null = null, phase = "failed") {
    const data = { lane: "local", phase, workspace: "missing-history-worktree", base: "base", head, checks: [], risk: { required: false, flagged: [] } };
    const run = vi.fn(async (_command: string, _args: string[], _options?: unknown) => ({ status: 0, stdout: "candidate\n", stderr: "", error: null, signal: null }));
    const store = { getRun: () => ({ base_manifest_json: JSON.stringify(data) }), getJob: () => null, listActivity: () => [{ summary: "Retained failure" }] };
    return { lane: createLocalLane({ root: temp(), store, run }), run };
  }
  it("opens a failed attempt without inspecting its unrelated worktree diff", async () => {
    const f = history();
    expect(await f.lane.detail("history")).toMatchObject({ phase: "failed", canShip: false, activity: [{ summary: "Retained failure" }] });
    expect(f.run).not.toHaveBeenCalled();
  });
  it("polls candidate identity without reading changed blobs", async () => {
    const f = history("candidate");
    await f.lane.detail("history");
    expect(f.run.mock.calls.map(call => call[1][1])).toEqual(["rev-parse", "status"]);
  });
  it("refuses review when fresh inspection fails", async () => {
    const f = history("candidate", "uat-ready");
    f.run.mockImplementation(async (_command, args) => ({ status: args[1] === "diff" ? 1 : 0, stdout: args[1] === "rev-parse" ? "candidate\n" : "", stderr: "", error: null, signal: null }));
    await expect(f.lane.review("history")).rejects.toThrow("candidate-changed");
  });
  it("keeps a failed historical run closed when an old client requests review", async () => {
    const f = history("candidate");
    await expect(f.lane.review("history")).rejects.toThrow("ready to test");
    expect(f.run).not.toHaveBeenCalled();
  });
});

describe("versioned Local guardrails", () => {
  it("authenticates a subscription despite unrelated PM host API configuration, preserving custom credential paths", () => {
    const home = temp();
    const directory = join(home, "custom-claude");
    put(directory, ".credentials.json", JSON.stringify({ claudeAiOauth: { accessToken: "synthetic", subscriptionType: "pro", scopes: ["user:inference"] } }));
    const env = { CLAUDE_CONFIG_DIR: directory, ANTHROPIC_API_KEY: "synthetic-app-key", AZURE_TTS_KEY: "synthetic-speech-key", AZURE_TTS_REGION: "fixture" };
    expect(localWorkerSubscription("claude", { env, home })).toMatchObject({ ok: true, method: "claude.ai", directory });
    expect(() => localSubscription("claude", { env, home })).toThrow("API or alternate-provider");
    expect(env.ANTHROPIC_API_KEY).toBe("synthetic-app-key");
    put(directory, ".credentials.json", JSON.stringify({ apiKey: "synthetic" }));
    expect(() => localWorkerSubscription("claude", { env, home })).toThrow("Claude subscription login required");
  });
  it.each([
    ["src/features/accounts/a.ts", "money", ""], ["src/lib/schedule/a.ts", "recurrence", ""],
    ["src/app/api/notes/route.ts", "auth-household", 'import { supabaseAdmin } from "@/lib/supabase/admin"'],
    ["src/lib/accountAccess.ts", "auth-household", ""], ["migrations/new.sql", "schema", ""], ["CLAUDE.md", "rules", ""],
    [".codex/hooks.json", "rules", ""], ["src/a.ts", "recurrence", 'import { RRule } from "rrule"'],
  ])("flags %s", (path, domain, before) => expect(classifyLocalDiff([{ path, before, after: "" }]).flagged[0].domains).toContain(domain));
  it("allows an ordinary diff and excludes every non-allowlisted variable", () => {
    expect(classifyLocalDiff([{ path: "greeting.txt" }]).required).toBe(false);
    expect(localEnvironment({ PATH: "bin", SUPABASE_SERVICE_ROLE_KEY: "secret", CRON_SECRET: "secret", OPENAI_API_KEY: "secret", NODE_OPTIONS: "--require evil", OTHER_SECRET: "secret" })).toEqual({ PATH: "bin" });
  });
  it("refuses API-key and unknown sign-ins without exposing credentials", () => {
    const home = temp();
    put(home, ".codex/auth.json", JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: "synthetic", account_id: "fixture" } }));
    expect(localSubscription("codex", { home, env: {} }).method).toBe("chatgpt");
    expect(() => localSubscription("codex", { home, env: { OPENAI_API_KEY: "bad" } })).toThrow("subscription-only");
    put(home, ".codex/auth.json", JSON.stringify({ OPENAI_API_KEY: "bad" }));
    expect(() => localSubscription("codex", { home, env: {} })).toThrow("subscription-only");
  });
  it("refuses ignored nested env files and mismatched installed locks", () => {
    const root = temp(); put(root, "nested/.env.local", "fixture");
    expect(() => assertNoLocalSecrets(root)).toThrow(".env");
    put(root, "pnpm-lock.yaml", "a"); put(root, "node_modules/.pnpm/lock.yaml", "b");
    expect(installedDependencies(root)).toBe(false);
  });
  it("loads Claude project skills/hooks with a sandbox whenever a shell is available", () => {
    const options = buildSessionOptions({ workspaceRoot: temp(), local: true, env: { PATH: "fixture" } });
    expect(options.settingSources).toEqual(["project"]); expect(options.skills).toBe("all");
    expect(options.sandbox).toEqual(process.platform === "win32" ? { enabled: false } : { enabled: true, failIfUnavailable: true });
    expect(options.tools.includes("Bash")).toBe(options.sandbox.enabled);
    if (!options.sandbox.enabled) expect(options.disallowedTools).toContain("Bash");
    expect(options.env).toEqual({ PATH: "fixture" });
  });
  it("snapshots the real Node environment without attempting to freeze the host object", () => {
    const options = buildSessionOptions({ workspaceRoot: temp(), local: true, env: process.env });
    expect(options.env).not.toBe(process.env);
    expect(Object.isFrozen(options.env)).toBe(true);
    expect(Object.isFrozen(process.env)).toBe(false);
    expect(options.tools.includes("Bash")).toBe(options.sandbox.enabled);
    const custom = { PATH: "fixture" };
    const snapshot = buildSessionOptions({ workspaceRoot: temp(), local: true, env: custom });
    custom.PATH = "changed";
    expect(snapshot.env.PATH).toBe("fixture");
  });
});

describe("loopback bootstrap", () => {
  it("pairs a fresh same-origin loopback browser with cookie and CSRF, never LAN or spoofed origin", () => {
    const root = temp(); const headers = { host: "127.0.0.1:4317", "sec-fetch-site": "same-origin" };
    const boot = loopbackBrowserSession({ root, headers, loopbackPeer: true })!;
    expect(boot.view.paired).toBe(true);
    const cookie = boot.cookie!.split(";")[0];
    expect(authenticateLocal({ root, headers: { ...headers, cookie, "x-era-csrf": boot.view.csrf } }).ok).toBe(true);
    expect(authenticateLocal({ root, headers: { ...headers, cookie } }).ok).toBe(false);
    expect(sessionView({ root, headers: { cookie } }).paired).toBe(true);
    expect(loopbackBrowserSession({ root, headers, loopbackPeer: false })).toBeNull();
    expect(loopbackBrowserSession({ root, headers: { ...headers, host: "192.168.1.2" }, loopbackPeer: true })).toBeNull();
    expect(loopbackBrowserSession({ root, headers: { ...headers, "sec-fetch-site": "cross-site" }, loopbackPeer: true })).toBeNull();
    expect(loopbackBrowserSession({ root, headers: { ...headers, origin: "http://127.0.0.1:9999" }, loopbackPeer: true })).toBeNull();
  });
});

describe("Local worktree to owner merge and revert", () => {
  it("provisions Codex's private sandbox config and lets the supervisor commit and check uncommitted work", async () => {
    const f = await fixture(false, false, false, "codex");
    const launched = await f.lane.start(f.input);
    expect(launched.ok).toBe(true);
    await f.lane.wait(launched.run_id!);
    const view = await f.lane.detail(launched.run_id!);
    expect(view.phase).toBe("uat-ready");
    expect(view.head).not.toBe(view.base);
    expect(view.checks.map((check: { exit: number }) => check.exit)).toEqual([0, 0, 0, 0]);
  }, 60_000);
  it("projects actual execution, terminal failure and interrupted work without inventing owner gates", async () => {
    const f = await fixture(false, false, true);
    const start = await f.lane.start(f.input);
    expect(f.lane.list()[0]).toMatchObject({ lane: "local", active: true, ownerActionKind: "none" });
    await expect.poll(f.launches).toBe(1);
    f.releaseFirst();
    await f.lane.wait(start.run_id!);
    expect(f.lane.list()[0]).toMatchObject({ active: false, lifecycle: "CLOSED", closed_outcome: "failed", ownerActionKind: "none" });
    const old = await f.lane.detail(start.run_id!);
    const retry = await f.lane.start(f.input);
    await f.lane.wait(retry.run_id!);
    const next = await f.lane.detail(retry.run_id!);
    expect(next.workspace).not.toBe(old.workspace);
    expect(next.branch).not.toBe(old.branch);
    expect(existsSync(old.workspace)).toBe(false);
    expect(existsSync(join(f.root, ".delivery/local-archive", start.run_id!, "diff.patch"))).toBe(true);
    expect((await f.lane.detail(start.run_id!)).error).toBe("synthetic native startup failure");
    expect(f.lane.list().find((row: { run_id: string }) => row.run_id === retry.run_id)).toMatchObject({ active: false, ownerActionKind: "local-review" });
    const restarted = createLocalLane({ root: f.root, store: f.store });
    const row = f.store.getRun(start.run_id!);
    const data = JSON.parse(row.base_manifest_json);
    f.store.updateRun(start.run_id!, { lifecycle: "ACTIVE", base_manifest_json: { ...data, phase: "preparing" } });
    expect(restarted.list().find((row: { run_id: string }) => row.run_id === start.run_id)).toMatchObject({ active: false, ownerAction: "Interrupted", ownerActionKind: "inspect-session" });
    expect((await restarted.detail(start.run_id!)).interrupted).toBe(true);
  }, 60_000);
  it("retains refused Local Starts in the existing launch store and replays a UUID once", async () => {
    const f = await fixture();
    put(f.root, "pending.txt", "dirty source\n");
    const request = { method: "POST", path: "/api/delivery/v2/local", loopbackPeer: true,
      body: { ...f.input, action: "start", command_id: randomUUID() } };
    const ctx = { local: f.lane, store: f.store };
    const auth = { kind: "browser", actor: "fixture-owner" };
    expect((await routeLocal(request, auth, ctx))?.status).toBe(409);
    expect(listStewardRequests(f.store, 180_000)).toMatchObject([{ status: "blocked", workId: "DLV-900", run_id: null }]);
    const again = await routeLocal(request, auth, ctx);
    expect(again?.status).toBe(409);
    expect(listStewardRequests(f.store, 180_000)).toHaveLength(1);
    expect(f.launches()).toBe(0);
    git(f.root, "add", "pending.txt"); git(f.root, "commit", "-m", "fixture source update");
    request.body.command_id = randomUUID();
    const getPlan = await routeLocal({ method: "GET", path: "/api/delivery/v2/local/start-plan", loopbackPeer: true,
      query: new URLSearchParams({ id: f.input.id, file: f.input.file }) }, auth, ctx);
    expect(getPlan?.status).toBe(200);
    const plan = getPlan!.json;
    expect(plan.commands[0]).toContain(git(f.root, "rev-parse", "HEAD"));
    Object.assign(request.body, { start_nonce: plan.start_nonce, preview_id: plan.token });
    const started = await routeLocal(request, auth, ctx);
    expect(started?.status).toBe(200);
    const replayed = await routeLocal(request, auth, ctx);
    expect(replayed?.json.run_id).toBe(started?.json.run_id);
    await f.lane.wait(started!.json.run_id);
    expect(f.launches()).toBe(1);
  }, 60_000);
  it("validates and passes the selected model and effort into the native session", async () => {
    const f = await fixture();
    await expect(f.lane.start({ ...f.input, model: "missing" })).rejects.toThrow("not in this installation");
    await expect(f.lane.start({ ...f.input, model: "disabled-claude" })).rejects.toThrow("disabled");
    await expect(f.lane.start({ ...f.input, model: "fixture-claude", effort: "high" })).rejects.toThrow("does not offer");
    expect(f.launches()).toBe(0);
    const result = await f.lane.start({ ...f.input, model: "fixture-claude", effort: "medium" });
    await f.lane.wait(result.run_id!);
    expect(f.requestedSettings()).toMatchObject({ executor: "claude", model: "fixture-claude", effort: "medium", catalog_revision: 1 });
    const recorded = f.lane.list().find((row: { run_id: string }) => row.run_id === result.run_id);
    expect(recorded).toMatchObject({ model: "fixture-claude", effort: "medium" });
  }, 60_000);
  it("runs all four real host commands and records their output in the shared session", async () => {
    const f = await built();
    expect(f.view.phase).toBe("uat-ready"); expect(relative(f.root, f.view.workspace).startsWith("..")).toBe(true);
    expect(git(f.view.workspace, "branch", "--show-current")).toBe("delivery/DLV-900");
    expect(f.view.checks.map(c => c.name)).toEqual(["typecheck", "lint", "test", "pm:lint"]);
    expect(f.view.checks.every(c => c.exit === 0 && c.stdout.includes("host output"))).toBe(true);
    const activity: string[] = f.store.listActivity(f.id).map((row: { summary: string }) => row.summary);
    const commands = activity.filter(line => line.startsWith('["git"')).map(line => JSON.parse(line));
    expect(commands).toEqual([
      ["git", "--no-optional-locks", "worktree", "add", "-b", f.view.branch, f.view.workspace, f.view.base],
      ["git", "--no-optional-locks", "add", "--all"],
      ["git", "--no-optional-locks", "commit", "-m", "Build DLV-900"],
    ]);
    expect(activity.filter(line => line.startsWith("Git exit 0"))).toHaveLength(3);
    expect(activity.filter(line => !line.startsWith('["git"') && !line.startsWith("Git exit"))).toEqual([
      "Installing dependencies", "Native session started", "Committing candidate", "Host checks started",
      "typecheck started", "typecheck: 0", "lint started", "lint: 0", "test started", "test: 0",
      "pm:lint started", "pm:lint: 0", "Freezing handover", "Ready for owner UAT",
    ]); expect(f.launches()).toBe(1);
    expect((await f.lane.start(f.input)).run_id).toBe(f.id); expect(f.launches()).toBe(1);
    expect(await f.lane.detail(f.id)).toMatchObject({ canShip: false });
    // Confined lifecycle cannot apply, count or recover Local jobs.
    const journey = createJourney({ root: f.root, pmRel: PM, store: f.store });
    expect(journey.list()).toEqual([]); expect(journey.detail(f.id).ok).toBe(false);
  }, 60_000);
  it("keeps exactly three blockers and treats other gates as advisory", async () => {
    const f = await fixture(); const result = await f.lane.readiness(f.input);
    expect(LOCAL_LAUNCH_GATES).toEqual(["source", "authentication", "environment"]); expect(LAUNCH_GATES).toHaveLength(11);
    expect(result.ready).toBe(true); expect(result.facts.budget.state).toBe("advisory");
    put(f.root, "dirty.txt", "dirty"); expect((await f.lane.readiness(f.input)).facts.source.state).toBe("blocked");
    expect((await f.lane.start(f.input)).ok).toBe(false); expect(f.launches()).toBe(0);
  }, 60_000);
  it("refuses red checks without producing a ready handover", async () => {
    const f = await built(false, true); expect(f.view.phase).toBe("failed"); expect(f.view.canShip).toBe(false);
    expect(f.view.checks.find(c => c.name === "lint")?.exit).toBe(1); expect(f.view.handover).toBeNull();
  }, 60_000);
  it("refuses legacy Ship and Undo even for an approved candidate", async () => {
    const f = await built(true);
    accept(f.root, f.view.handover!);
    await f.lane.review(f.id);
    await expect(f.lane.ship()).rejects.toThrow("retired");
    await expect(f.lane.undo()).rejects.toThrow("retired");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(f.view.base);
    expect(git(f.remote, "rev-parse", "main")).toBe(f.view.base);
  }, 60_000);
  it("allows an unflagged candidate without opening review and refuses retracted UAT", async () => {
    const f = await built(); accept(f.root, f.view.handover!); expect((await f.lane.detail(f.id)).canMerge).toBe(true);
    const h = f.view.handover!;
    expect(retractSignOff({ root: f.root, handover_id: h.handover_id, revision: h.revision, actor: "fixture-owner", command_id: randomUUID(), now: new Date().toISOString() }).ok).toBe(true);
    expect((await f.lane.detail(f.id)).canMerge).toBe(false);
  }, 60_000);
  it("invalidates UAT and review on a changed branch head", async () => {
    const f = await built(true); accept(f.root, f.view.handover!); await f.lane.review(f.id);
    vi.stubEnv("GIT_INDEX_FILE", ".git/index");
    put(f.view.workspace, "later.txt", "later"); git(f.view.workspace, "add", "."); git(f.view.workspace, "commit", "-m", "later");
    expect((await f.lane.detail(f.id)).canMerge).toBe(false); await expect(f.lane.merge(f.id)).rejects.toThrow();
  }, 60_000);
  it("refuses relay/Steward Ship and invalid action payloads at the command boundary", async () => {
    const ctx = { local: { ship: () => { throw new Error("must not execute"); } } };
    const request = { method: "POST", path: "/api/delivery/v2/local", body: { action: "ship", run_id: "local-" + randomUUID() }, loopbackPeer: true };
    expect((await routeLocal(request, { kind: "bridge" }, ctx))?.status).toBe(403);
    expect((await routeLocal(request, { kind: "steward" }, ctx))?.status).toBe(403);
    expect((await routeLocal({ ...request, loopbackPeer: false }, { kind: "browser" }, ctx))?.status).toBe(403);
    expect((await routeLocal({ ...request, body: { action: "shell" } }, { kind: "browser" }, ctx))?.status).toBe(400);
  });
});

describe("DLV-161 Ship, Undo and command recovery / R121 interrupted attempts", () => {
  const checks: typeof import("../../scripts/delivery-v2/local-process.mjs").hostChecks = async () =>
    ["typecheck", "lint", "test", "pm:lint"].map(name => ({ name, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), exit: 0, stdout: "fixture replay", stderr: "", error: null }));
  async function ready(options: Parameters<typeof fixture>[4] = {}) {
    const f = await fixture(false, false, false, "claude", { checks, ...options });
    const started = await f.lane.start(f.input), id = started.run_id!;
    await f.lane.wait(id);
    const view = await f.lane.detail(id);
    expect(view.phase).toBe("uat-ready");
    accept(f.root, view.handover!);
    return { ...f, id, view };
  }
  function setPhase(f: Awaited<ReturnType<typeof ready>>, phase: string) {
    const row = f.store.getRun(f.id);
    f.store.updateRun(f.id, { lifecycle: "ACTIVE", base_manifest_json: { ...JSON.parse(row.base_manifest_json), phase } });
  }
  function rejectHook(root: string, name = "pre-commit") {
    put(root, `.git/hooks/${name}`, "#!/bin/sh\necho 'fixture hook rejected' >&2\nexit 1\n");
    if (process.platform !== "win32") chmodSync(join(root, `.git/hooks/${name}`), 0o755);
  }
  it("refuses a candidate that ticked its own row before touching main", async () => {
    const f = await ready({ session: async ({ request }) => {
      const workspace = request.workspace.root;
      const checklist = `${PM}/Delivery/4 - Checklist.md`;
      put(workspace, checklist, readFileSync(join(workspace, checklist), "utf8").replace("[ ] **DLV-900**", "[x] **DLV-900**"));
      put(workspace, "greeting.txt", "after\n");
      put(workspace, ".delivery-handover.json", JSON.stringify({ summary: "Greeting", scenarios: [{ id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read", expected: "after" }] }] }));
      return { status: "finished", observations: { nativeOutcome: "succeeded" } };
    } });
    await f.lane.review(f.id);
    await expect(f.lane.merge(f.id)).rejects.toThrow("candidate-edits-pm-row");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(f.view.base);
    expect(git(f.root, "status", "--porcelain")).toBe("");
    expect(git(f.root, "rev-parse", "--git-path", "MERGE_HEAD")).toBe(".git/MERGE_HEAD");
    expect(existsSync(join(f.root, ".git/MERGE_HEAD"))).toBe(false);
    expect((await f.lane.detail(f.id)).phase).toBe("uat-ready");
  }, 60_000);
  it("keeps the merged files and retries only the reviewed Commit after a hook failure", async () => {
    const f = await ready();
    const merged = await f.lane.merge(f.id);
    const base = git(f.root, "rev-parse", "HEAD");
    rejectHook(f.root);
    await expect(f.lane.commit(f.id, merged.publication!.token)).rejects.toThrow("fixture hook rejected");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(base);
    rmSync(join(f.root, ".git/hooks/pre-commit"));
    const restarted = createLocalLane({root:f.root, store:f.store});
    const retry = await restarted.detail(f.id);
    const view = await restarted.commit(f.id, retry.publication!.token);
    expect(view.phase).toBe("committed");
    expect(git(f.root,"rev-parse","HEAD^")).toBe(base);
    expect(view.publication_log.map((row: {exit:number}) => row.exit)).toEqual([0,1,0,0]);
  }, 60_000);
  it("publishes exactly the run and its PM receipt to internal and preserves the owner's index", async () => {
    const f = await ready({ session: async ({ request }) => {
      const workspace = request.workspace.root;
      rmSync(join(workspace, "greeting.txt"));
      put(workspace, "new[1].txt", "introduced\n");
      put(workspace, ".delivery-handover.json", JSON.stringify({ summary: "Replace greeting", scenarios: [{ id:"greeting", title:"Greeting", required:true, steps:[{action:"Read",expected:"introduced"}] }] }));
      return {status:"finished",observations:{nativeOutcome:"succeeded"}};
    }});
    const internal = join(f.parent, "internal.git");
    const post = async (lane: typeof f.lane, body: Record<string, unknown>) => {
      const result = await routeLocal({method:"POST",path:"/api/delivery/v2/local",body,loopbackPeer:true},
        {kind:"browser",actor:"fixture-owner"},{local:lane});
      expect(result?.status, JSON.stringify(result?.json)).toBe(200);
      return result!.json;
    };
    git(f.parent,"init","--bare",internal); git(f.root,"remote","add","internal",internal);
    const parallelChecklist = PM+"/Budget/4 - Checklist.md";
    put(f.root,PM+"/_index.md","# Delivery\n<!-- pm:generated:start -->\n<!-- pm:generated:end -->\n");
    put(f.root,parallelChecklist,"# Budget\n## Now\n- [ ] **BUD-1** Committed label _(friction - S)_\n");
    git(f.root,"add","--",PM+"/_index.md",parallelChecklist);
    git(f.root,"commit","-m","Existing PM index");
    git(f.root,"push","internal","main");
    const old = git(f.remote,"rev-parse","main");
    const internalBase = git(internal,"rev-parse","main");
    put(f.root,parallelChecklist,"# Budget\n## Now\n- [ ] **BUD-1** Private editor draft _(friction - S)_\n");
    put(f.root, "owner.txt", "already staged\n"); git(f.root, "add", "owner.txt");
    put(f.root, "owner.txt", "further edit\n");
    const merged = await f.lane.merge(f.id), commitPlan = merged.publication!;
    expect(commitPlan.files).toEqual(expect.arrayContaining(["greeting.txt","new[1].txt"]));
    expect(commitPlan.files).not.toContain("owner.txt");
    expect(commitPlan.files).not.toContain(parallelChecklist);
    expect(readFileSync(join(f.root,PM,"_index.md"),"utf8")).toContain("Committed label");
    expect(readFileSync(join(f.root,PM,"_index.md"),"utf8")).not.toContain("Private editor draft");
    const committed = await post(f.lane, {action:"commit",run_id:f.id,preview_id:commitPlan.token});
    expect(committed.phase).toBe("committed");
    expect(committed.publication!.reason).toContain("Setup");
    expect(git(f.root,"show","-s","--format=%s","HEAD")).toBe("DLV-900 Change the greeting");
    expect(git(f.root,"diff","--cached","--name-only")).toBe("owner.txt");
    expect(git(f.root,"show",":owner.txt")).toBe("already staged");
    expect(git(f.root,"diff","--name-only","HEAD^","HEAD").split("\n")).not.toContain("owner.txt");
    expect(git(f.root,"show","HEAD:new[1].txt")).toBe("introduced");
    expect(git(f.remote,"rev-parse","main")).toBe(old);
    const destination = await f.lane.inspectPushDestination();
    await expect(f.lane.configurePush("stale-destination")).rejects.toThrow("Push URL changed");
    expect(await post(f.lane,{action:"configure-push",expected_url:destination})).toMatchObject({setting:{remote:"internal",branch:"main"}});
    const restarted = createLocalLane({root:f.root,store:f.store});
    // Simulate a restart after Git committed but before the receipt was stored.
    const interrupted = JSON.parse(f.store.getRun(f.id).base_manifest_json);
    delete interrupted.committed;
    f.store.updateRun(f.id,{base_manifest_json:{...interrupted,phase:"merged"}});
    const reconciliation = (await restarted.detail(f.id)).publication!;
    expect(reconciliation.recover).toBe(true);
    expect((await restarted.commit(f.id,reconciliation.token)).committed.sha).toBe(committed.committed.sha);
    put(f.root,"parallel.txt","another owner commit\n");
    git(f.root,"add","--","parallel.txt"); git(f.root,"commit","--only","-m","Parallel work","--","parallel.txt");
    const reviewedHead = git(f.root,"rev-parse","HEAD");
    expect(git(f.root,"diff","--cached","--name-only")).toBe("owner.txt");
    const pushPlan = (await restarted.detail(f.id)).publication!;
    expect(pushPlan.commands[0]).toContain("--force-with-lease=refs/heads/main:"+internalBase);
    expect(pushPlan.outgoing).toHaveLength(2);
    await expect(restarted.push(f.id,"outdated")).rejects.toThrow("preview changed");
    const pushed = await post(restarted, {action:"push",run_id:f.id,preview_id:pushPlan.token});
    expect(pushed.pushed).toMatchObject({remote:"internal",branch:"main",sha:reviewedHead});
    expect(git(internal,"rev-parse","main")).toBe(reviewedHead);
    expect(git(f.remote,"rev-parse","main")).toBe(old);
    expect(pushed.publication_log.map((r: {argv:string[]})=>r.argv)).toEqual([...commitPlan.commands,...pushPlan.commands]);
    await restarted.push(f.id,pushPlan.token);
    expect(git(f.root,"diff","--cached","--name-only")).toBe("owner.txt");
  }, 80_000);

  it("refuses dirty shared PM files, later run-file edits and repointed destinations", async () => {
    const f = await ready();
    const checklist = PM+"/Delivery/4 - Checklist.md";
    const original = readFileSync(join(f.root,checklist),"utf8");
    put(f.root,checklist,original+"\nOwner's unrelated note\n");
    await expect(f.lane.merge(f.id)).rejects.toThrow("Changed in your checkout");
    expect(readFileSync(join(f.root,"greeting.txt"),"utf8").trim()).toBe("before");
    put(f.root,checklist,original);
    const merged = await f.lane.merge(f.id);
    put(f.root,"greeting.txt","owner edits after Merge\n");
    await expect(f.lane.commit(f.id,merged.publication!.token)).rejects.toThrow("Changed since Merge");
    expect(git(f.root,"diff","--cached","--name-only")).toBe("");
    git(f.root,"remote","add","internal",f.remote);
    await expect(f.lane.configurePush()).rejects.toThrow("points to origin");
    expect(f.lane.pushSettings()).toBe(null);
  }, 60_000);

  it("verifies an owner's manual push with a remote read and keeps the original candidate receipt", async () => {
    const f = await ready(), internal = join(f.parent,"internal.git");
    git(f.parent,"init","--bare",internal); git(f.root,"remote","add","internal",internal);
    git(f.root,"push","internal","main"); await f.lane.configurePush();
    const merged = await f.lane.merge(f.id), committed = await f.lane.commit(f.id,merged.publication!.token);
    git(f.root,"push","internal","main");
    const plan = (await f.lane.detail(f.id)).publication!;
    const check = ["git","ls-remote","--refs","internal","refs/heads/main"];
    expect(plan).toMatchObject({recover:true,outgoing:[],commands:[check]});
    // A stale local tracking ref alone cannot establish Pushed.
    git(internal,"update-ref","refs/heads/main",f.view.base);
    await expect(f.lane.push(f.id,plan.token)).rejects.toThrow("Remote confirmation failed");
    expect((await f.lane.detail(f.id)).phase).toBe("committed");
    git(f.root,"push","internal","main");
    const confirmed = await f.lane.push(f.id,plan.token);
    expect(confirmed.pushed).toMatchObject({sha:committed.committed.sha,evidence:"verified-external"});
    expect(confirmed.publication_log.at(-1).argv).toEqual(check);
    expect(confirmed.publication_log.some((r: {argv:string[]}) => r.argv[1] === "push")).toBe(false);
    expect(git(f.remote,"rev-parse","main")).toBe(f.view.base);
  }, 60_000);

  it("lists ignored additions and file-to-directory collisions without touching the owner's bytes", async () => {
    const f = await ready({session: async ({request}) => {
      const workspace = request.workspace.root;
      rmSync(join(workspace,"greeting.txt"));
      put(workspace,"new.txt","candidate content\n");
      put(workspace,".delivery-handover.json",JSON.stringify({summary:"Greeting",scenarios:[{id:"greeting",title:"Greeting",required:true,steps:[{action:"Read",expected:"after"}]}]}));
      return {status:"finished",observations:{nativeOutcome:"succeeded"}};
    }});
    expect((await f.lane.detail(f.id)).canMerge).toBe(true);
    put(f.root,".git/info/exclude","new.txt\ngreeting.txt/\n");
    put(f.root,"new.txt","ignored owner file\n");
    rmSync(join(f.root,"greeting.txt")); put(f.root,"greeting.txt/owner.txt","ignored owner child\n");
    const view = await f.lane.detail(f.id);
    expect(view.mergePlan?.conflicts).toEqual([
      {path:"greeting.txt",committed:false,uncommitted:true},
      {path:"new.txt",committed:false,uncommitted:true},
    ]);
    expect(view.canMerge).toBe(false); expect(view.mergePlan?.canRefresh).toBe(false);
    await expect(f.lane.merge(f.id)).rejects.toThrow("changed-in-your-repo");
    expect(readFileSync(join(f.root,"new.txt"),"utf8")).toBe("ignored owner file\n");
    expect(readFileSync(join(f.root,"greeting.txt/owner.txt"),"utf8")).toBe("ignored owner child\n");
  }, 60_000);

  it("refuses remote movement under the reviewed lease and retains the committed receipt", async () => {
    const f = await ready(), internal = join(f.parent,"internal.git");
    git(f.parent,"init","--bare",internal); git(f.root,"remote","add","internal",internal);
    git(f.root,"push","internal","main"); await f.lane.configurePush();
    const merged = await f.lane.merge(f.id), committed = await f.lane.commit(f.id,merged.publication!.token);
    const pushPlan = committed.publication!;
    git(f.root,"remote","set-url","internal",f.remote);
    await expect(f.lane.push(f.id,pushPlan.token)).rejects.toThrow("origin");
    git(f.root,"remote","set-url","internal",internal);
    const elsewhere = join(f.parent,"elsewhere");
    git(f.parent,"clone","-b","main",internal,elsewhere);
    git(elsewhere,"config","user.name","Owner"); git(elsewhere,"config","user.email","another@example.invalid");
    put(elsewhere,"elsewhere.txt","parallel work\n");
    git(elsewhere,"add","."); git(elsewhere,"commit","-m","Parallel work"); git(elsewhere,"push","origin","main");
    await expect(f.lane.push(f.id,pushPlan.token)).rejects.toThrow();
    const blocked = await f.lane.detail(f.id);
    expect(blocked.phase).toBe("committed"); expect(blocked.pushed).toBeUndefined();
    expect(blocked.publication_log.at(-1)).toMatchObject({argv:pushPlan.commands[0],exit:1});
    expect(git(internal,"rev-parse","main")).toBe(git(elsewhere,"rev-parse","HEAD"));
    expect(git(f.remote,"rev-parse","main")).toBe(f.view.base);
  }, 80_000);
  it("reclaims only a provably dead command owner and records the recovery", async () => {
    const f = await ready();
    const dead = Number(execFileSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8", windowsHide: true }));
    expect(() => process.kill(dead, 0)).toThrow();
    put(f.root, ".delivery/local-command.lock/owner.json", JSON.stringify({ pid: dead, action: "ship", run_id: f.id, at: "2026-11-16T00:00:00Z" }));
    expect((await f.lane.merge(f.id)).phase).toBe("merged");
    expect((await f.lane.detail(f.id)).activity.filter((row: { summary: string }) => row.summary === "Recovered stale lock")).toHaveLength(1);
    expect(existsSync(join(f.root, ".delivery/local-command.lock"))).toBe(false);
  }, 60_000);
  it.each(["live", "missing", "invalid"])("does not reclaim a %s lock owner", async owner => {
    const f = await ready(), lock = ".delivery/local-command.lock";
    mkdirSync(join(f.root, lock), { recursive: true });
    if (owner !== "missing") put(f.root, `${lock}/owner.json`, owner === "invalid" ? "{" : JSON.stringify({ pid: process.pid, action: "ship", run_id: f.id, at: new Date().toISOString() }));
    await expect(f.lane.merge(f.id)).rejects.toThrow(owner === "live" ? `local-command-busy; ship ${f.id}` : "local-command-busy; unknown action unknown run");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(f.view.base);
    expect(existsSync(join(f.root, lock))).toBe(true);
  }, 60_000);
  it.each(["preparing", "building", "checking"])("closes an interrupted %s attempt and preserves it beside the next explicit attempt", async phase => {
    const f = await ready();
    setPhase(f, phase);
    const owner = f.store.getRun(f.id);
    const dead = Number(execFileSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8", windowsHide: true }));
    f.store.updateRun(f.id, { base_manifest_json: { ...JSON.parse(owner.base_manifest_json), supervisor: { pid: dead, instance: randomUUID() } } });
    const priorJob = f.store.getJob(f.id);
    f.store.updateJob(f.id, { status: "active", reservation_open: true });
    const restarted = createLocalLane({ root: f.root, store: f.store });
    expect(restarted.list().find((row: { run_id: string }) => row.run_id === f.id)).toMatchObject({ ownerAction: "Interrupted", active: false });
    const cancelled = await routeLocal({ method: "POST", path: "/api/delivery/v2/local", body: { action: "cancel", run_id: f.id }, loopbackPeer: true }, { kind: "browser", actor: "fixture-owner" }, { local: restarted });
    expect(cancelled).toMatchObject({ status: 200, json: { ok: true } });
    expect(await restarted.cancel(f.id)).toEqual({ ok: true });
    expect(f.store.getRun(f.id)).toMatchObject({ lifecycle: "CLOSED", closed_outcome: "cancelled" });
    expect(await restarted.detail(f.id)).toMatchObject({ phase: "cancelled", interrupted: false, error: "cancelled", canShip: false, canUndo: false });
    expect(f.store.getJob(f.id)).toMatchObject({ status: "finished", reservation_open: 0, outcome: "cancelled", observations_json: priorJob.observations_json });
    const next = await f.lane.start(f.input);
    expect(next.run_id).not.toBe(f.id); await f.lane.wait(next.run_id!);
    const nextView = await f.lane.detail(next.run_id!);
    expect(nextView.workspace).not.toBe(f.view.workspace);
    expect(nextView.branch).not.toBe(f.view.branch);
    expect(existsSync(f.view.workspace)).toBe(false);
    expect(JSON.parse(readFileSync(join(f.root, ".delivery/local-archive", f.id, "archive.json"), "utf8")).head).toBe(f.view.head);
    expect((await restarted.detail(f.id)).activity.filter((row: { summary: string }) => row.summary === "Owner cancelled interrupted attempt")).toHaveLength(1);
  }, 60_000);
  it("does not close a live sibling supervisor's native session", async () => {
    const f = await fixture(false, false, true, "claude", { checks });
    const start = await f.lane.start(f.input), id = start.run_id!;
    await expect.poll(f.launches).toBe(1);
    expect(JSON.parse(f.store.getRun(id).base_manifest_json).supervisor).toMatchObject({ pid: process.pid, instance: expect.any(String) });
    const restarted = createLocalLane({ root: f.root, store: f.store });
    const run = f.store.getRun(id), job = f.store.getJob(id);
    await expect(restarted.cancel(id)).rejects.toThrow("supervisor-still-running");
    expect(f.store.getRun(id)).toEqual(run); expect(f.store.getJob(id)).toEqual(job);
    await f.lane.cancel(id); f.releaseFirst(); await f.lane.wait(id);
    expect((await f.lane.detail(id)).phase).toBe("cancelled");
  }, 60_000);
  it("preserves legacy interrupted attempts whose supervisor ownership is unknown", async () => {
    const f = await ready();
    setPhase(f, "building");
    const row = f.store.getRun(f.id), data = JSON.parse(row.base_manifest_json);
    delete data.supervisor;
    f.store.updateRun(f.id, { base_manifest_json: data });
    f.store.updateJob(f.id, { status: "active", reservation_open: true });
    const run = f.store.getRun(f.id), job = f.store.getJob(f.id);
    const restarted = createLocalLane({ root: f.root, store: f.store });
    await expect(restarted.cancel(f.id)).rejects.toThrow("supervisor-ownership-unknown");
    expect(f.store.getRun(f.id)).toEqual(run); expect(f.store.getJob(f.id)).toEqual(job);
    expect(existsSync(f.view.workspace)).toBe(true);
  }, 60_000);
  it("does not close a ready candidate through interrupted Cancel", async () => {
    const f = await ready(), restarted = createLocalLane({ root: f.root, store: f.store });
    await expect(restarted.cancel(f.id)).rejects.toThrow("session-not-running-in-this-process");
    expect((await restarted.detail(f.id)).phase).toBe("uat-ready");
  }, 60_000);
});

describe("DLV-166 Run app from Test steps", () => {
  async function previewing(red = false) {
    const f = await built(false, red);
    // The real checkout ignores .env; the fixture does it without a tracked edit.
    put(f.root, ".git/info/exclude", ".env\n");
    put(f.root, ".env", "NEXT_PUBLIC_SUPABASE_URL=https://fixture.invalid\nNEXT_PUBLIC_SUPABASE_ANON_KEY=anon\n");
    const calls: { args: string[]; options: { cwd: string; env: Record<string, string> } }[] = [];
    const kill = vi.fn();
    const previews = createPreviews({ root: f.root, choose: async () => 3100, command: () => ["node", "pnpm.cjs"], kill,
      spawn: ((_bin: string, args: string[], options: { cwd: string; env: Record<string, string> }) => {
        calls.push({ args, options });
        return Object.assign(new EventEmitter(), { pid: 7000 + calls.length, stdout: new PassThrough(), stderr: new PassThrough() });
      }) as never });
    return { ...f, lane: createLocalLane({ root: f.root, store: f.store, previews }), calls, kill };
  }

  it("serves the candidate from its own worktree with the checkout's env and writes no file there", async () => {
    const f = await previewing();
    const view = await f.lane.preview(f.id);
    expect(view.preview).toMatchObject({ state: "starting", url: "http://localhost:3100", port: 3100 });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].args).toEqual(["pnpm.cjs", "dev", "--port", "3100"]);
    expect(f.calls[0].options.cwd).toBe(f.view.workspace);
    expect(f.calls[0].options.env).toMatchObject({ NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
    expect(existsSync(join(f.view.workspace, ".env"))).toBe(false);
    expect(() => assertNoLocalSecrets(f.view.workspace)).not.toThrow();
    expect(view.clean).toBe(true);
    await f.lane.preview(f.id);
    expect(f.calls).toHaveLength(1);
    const stopped = await f.lane.stopPreview(f.id);
    expect(stopped.preview?.state).toBe("stopped");
    expect(f.kill).toHaveBeenCalledWith(7001);
    const rows = stopped.activity.map((row: { summary: string | null }) => row.summary);
    expect(rows.filter((summary: string | null) => summary === "Owner started the app")).toHaveLength(1);
    expect(rows).toContain("Owner stopped the app");
  }, 60_000);

  it("refuses a failed run and a changed candidate", async () => {
    const failed = await previewing(true);
    await expect(failed.lane.preview(failed.id)).rejects.toThrow("preview-needs-a-candidate-ready-for-test");
    const dirty = await previewing();
    put(dirty.view.workspace, "stray.txt", "x\n");
    await expect(dirty.lane.preview(dirty.id)).rejects.toThrow("candidate-changed");
    expect([...failed.calls, ...dirty.calls]).toHaveLength(0);
  }, 60_000);

  it("stops the app when the candidate ships", async () => {
    const f = await previewing();
    await f.lane.preview(f.id);
    accept(f.root, f.view.handover!);
    const shipped = await f.lane.merge(f.id);
    expect(shipped.phase).toBe("merged");
    expect(shipped.preview?.state).toBe("stopped");
    expect(f.kill).toHaveBeenCalledWith(7001);
  }, 60_000);
});

describe("DLV-167 Merge into the main checkout", () => {
  const book = (root: string) => join(root, PM, "Delivery/Delivery — Master Book.md");
  it("copies only the session's files, records UAT, ships the PM item and writes nothing to Git", async () => {
    const f = await built();
    // Parallel owner work on other files: committed (ALPHA → BETA) and uncommitted.
    put(f.root, "other.txt", "owner\n"); git(f.root, "add", "other.txt"); git(f.root, "commit", "-m", "owner work");
    put(f.root, "scratch.txt", "wip\n");
    accept(f.root, f.view.handover!);
    const before = await f.lane.detail(f.id);
    expect(before.mergePlan).toMatchObject({ files: [{ status: "M", path: "greeting.txt" }], conflicts: [], branch: "main", expected: "main" });
    expect(before.canMerge).toBe(true);
    const head = git(f.root, "rev-parse", "HEAD"), remoteMain = git(f.remote, "rev-parse", "main");
    const view = await f.lane.merge(f.id);
    expect(readFileSync(join(f.root, "greeting.txt"), "utf8")).toBe("after\n");
    expect(existsSync(join(f.root, ".delivery-handover.json"))).toBe(false);
    expect(readFileSync(join(f.root, "other.txt"), "utf8")).toBe("owner\n");
    expect(readFileSync(join(f.root, "scratch.txt"), "utf8")).toBe("wip\n");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(head);
    expect(git(f.remote, "rev-parse", "main")).toBe(remoteMain);
    expect(view).toMatchObject({ phase: "merged", canUndo: false, canMerge: false, applied: { files: ["greeting.txt"], main_head: head, pm_error: null } });
    const checklist = readFileSync(join(f.root, PM, "Delivery/4 - Checklist.md"), "utf8");
    expect(checklist).not.toMatch(/- \[ \] \*\*DLV-900\*\*/u);
    expect(checklist).toContain("DLV-899");
    const archive = join(f.root, PM, "_Archive/Shipped/Delivery.md");
    const pm = readFileSync(book(f.root), "utf8") + (existsSync(archive) ? readFileSync(archive, "utf8") : "");
    expect(pm).toMatch(/DLV-900[\s\S]*merged from Local run/u);
    expect(pm).toMatch(/\*\*UAT:\*\* passed \d{4}-\d{2}-\d{2} \(owner sign-off, Test steps /u);
    expect(pm).not.toContain("**UAT:** pending");
    expect(view.activity.map((row: { summary: string | null }) => row.summary)).toContain("Owner merged 1 file into the main checkout");
    await expect(f.lane.undo()).rejects.toThrow("retired");
  }, 60_000);

  it("refuses and lists the file when the repo changed it since the clone, committed or not", async () => {
    const f = await built();
    accept(f.root, f.view.handover!);
    put(f.root, "greeting.txt", "owner edit\n");
    let view = await f.lane.detail(f.id);
    expect(view.canMerge).toBe(false);
    expect(view.mergePlan?.conflicts).toEqual([{ path: "greeting.txt", committed: false, uncommitted: true }]);
    await expect(f.lane.merge(f.id)).rejects.toThrow("changed-in-your-repo: greeting.txt");
    git(f.root, "add", "greeting.txt"); git(f.root, "commit", "-m", "owner edit");
    view = await f.lane.detail(f.id);
    expect(view.mergePlan?.conflicts).toEqual([{ path: "greeting.txt", committed: true, uncommitted: false }]);
    await expect(f.lane.merge(f.id)).rejects.toThrow("changed-in-your-repo");
    expect(readFileSync(join(f.root, "greeting.txt"), "utf8")).toBe("owner edit\n");
    expect(view.phase).toBe("uat-ready");
  }, 60_000);

  it("needs the owner's sign-off and the main branch", async () => {
    const f = await built();
    expect((await f.lane.detail(f.id)).canMerge).toBe(false);
    await expect(f.lane.merge(f.id)).rejects.toThrow("merge-needs-passed-checks-sign-off-and-review");
    accept(f.root, f.view.handover!);
    git(f.root, "checkout", "-b", "side");
    const view = await f.lane.detail(f.id);
    expect(view.mergePlan?.branch).toBe("side");
    expect(view.canMerge).toBe(false);
    await expect(f.lane.merge(f.id)).rejects.toThrow("checkout-main-first");
    expect(readFileSync(join(f.root, "greeting.txt"), "utf8")).toBe("before\n");
  }, 60_000);
});
