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
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import { runProcess } from "../../scripts/delivery-v2/process.mjs";
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
  put(root, `${PM}/Delivery/4 - Checklist.md`, "# Checklist\n\n## Next\n\n- [ ] **DLV-899** Preserve this other item _(friction - S)_\n- [ ] **DLV-900** Change the greeting _(friction - S)_\n");
  put(root, `${PM}/Delivery/Delivery — Master Book.md`, "# Delivery\n\n## Acceptance Criteria Index\n\n### DLV-900\n\n**Outcome:** greeting changes\n\n- **Acceptance:** changed greeting\n\n## Shipped Log\n");
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
    expect(git(view.workspace, "rev-parse", "HEAD")).toBe(view.base);
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
    expect(rows.slice(rows.indexOf("Committing candidate") + 1, rows.indexOf("Host checks started")))
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
  it.each([{}, { hookMs: 120_000, pushMs: 90_000 }, { hookMs: 120_000 }])("uses configured limits for build, merge, ship, undo and both pushes (%j)", async limits => {
    const calls: { verb: string; timeout?: number }[] = [];
    const run: typeof runProcess = (command, args, options) => {
      if (command === "git") calls.push({ verb: args[1], timeout: options?.timeout });
      return runProcess(command, args, options);
    };
    const f = await fixture(false, false, false, "claude", { run, limits });
    const started = await f.lane.start(f.input);
    const id = started.run_id!;
    await f.lane.wait(id);
    const view = await f.lane.detail(id);
    expect(view.phase).toBe("uat-ready");
    accept(f.root, view.handover!);
    expect((await f.lane.ship(id)).phase).toBe("shipped");
    expect((await f.lane.undo(id)).phase).toBe("reverted");
    expect(calls.filter(call => ["commit", "merge", "revert"].includes(call.verb)))
      .toEqual(["commit", "merge", "commit", "revert"].map(verb => ({ verb, timeout: limits.hookMs ?? 25 * 60_000 })));
    expect(calls.filter(call => call.verb === "push"))
      .toEqual([1, 2].map(() => ({ verb: "push", timeout: limits.pushMs ?? 5 * 60_000 })));
    expect(calls.filter(call => !["commit", "merge", "revert", "push"].includes(call.verb)).every(call => call.timeout === 30_000)).toBe(true);
  }, 60_000);
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
  function history(head: string | null = null) {
    const data = { lane: "local", phase: "failed", workspace: "missing-history-worktree", base: "base", head, checks: [], risk: { required: false, flagged: [] } };
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
    const f = history("candidate");
    f.run.mockImplementation(async (_command, args) => ({ status: args[1] === "diff" ? 1 : 0, stdout: args[1] === "rev-parse" ? "candidate\n" : "", stderr: "", error: null, signal: null }));
    await expect(f.lane.review("history")).rejects.toThrow("candidate-changed");
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
    expect(existsSync(old.workspace)).toBe(true);
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
    expect(f.store.listActivity(f.id).map((row: { summary: string }) => row.summary)).toEqual([
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
  it("ships only after current-head UAT and review; pushes once and reverts the merge", async () => {
    const f = await built(true); accept(f.root, f.view.handover!);
    await expect(f.lane.ship(f.id)).rejects.toThrow("risk-review");
    expect(await f.lane.review(f.id)).toContain("src/features/accounts/change.ts");
    expect((await f.lane.detail(f.id)).canShip).toBe(true);
    const ctx = { root: f.root, store: f.store, local: f.lane };
    const h = { host: "127.0.0.1:4317", "sec-fetch-site": "same-origin" };
    const boot = await routeDeliveryV2({ method: "GET", path: "/api/delivery/v2/session", headers: h, loopbackPeer: true }, ctx);
    const headers = { ...h, cookie: boot!.headers!["Set-Cookie"].split(";")[0], "x-era-csrf": boot!.json.csrf };
    const ownerCommand = (action: string) => routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/local", body: { action, run_id: f.id }, headers, loopbackPeer: true }, ctx);
    expect((await routeDeliveryV2({ method: "POST", path: "/api/delivery/v2/local", body: { action: "ship", run_id: f.id } }, ctx))?.status).toBe(401);
    const shipped = await ownerCommand("ship");
    expect(shipped?.json.phase).toBe("shipped"); expect(git(f.root, "rev-parse", "HEAD^2")).toBe(f.view.head);
    expect(git(f.root, "ls-remote", "origin", "refs/heads/main")).toContain(git(f.root, "rev-parse", "HEAD"));
    expect(readFileSync(join(f.root, `${PM}/Delivery/4 - Checklist.md`), "utf8")).not.toContain("**DLV-900**");
    expect(readFileSync(join(f.root, `${PM}/Delivery/4 - Checklist.md`), "utf8")).toContain("**DLV-899**");
    expect(readFileSync(join(f.root, `${PM}/Delivery/Delivery — Master Book.md`), "utf8")).toMatch(/✅.*DLV-900/);
    const merged = git(f.root, "rev-parse", "HEAD"); await f.lane.ship(f.id); expect(git(f.root, "rev-parse", "HEAD")).toBe(merged);
    expect((await ownerCommand("undo"))?.json.phase).toBe("reverted");
    expect(existsSync(join(f.root, "src/features/accounts/change.ts"))).toBe(false);
    expect(readFileSync(join(f.root, `${PM}/Delivery/4 - Checklist.md`), "utf8")).toContain("**DLV-900**");
    const reverted = git(f.root, "rev-parse", "HEAD"); await f.lane.undo(f.id); expect(git(f.root, "rev-parse", "HEAD")).toBe(reverted);
  }, 60_000);
  it("retries failed pushes without a duplicate merge or revert", async () => {
    const f = await built(); accept(f.root, f.view.handover!);
    git(f.root, "remote", "set-url", "origin", join(f.parent, "missing.git"));
    await expect(f.lane.ship(f.id)).rejects.toThrow("git push");
    expect((await f.lane.detail(f.id)).phase).toBe("push-pending"); const merge = git(f.root, "rev-parse", "HEAD");
    git(f.root, "remote", "set-url", "origin", f.remote); await f.lane.ship(f.id); expect(git(f.root, "rev-parse", "HEAD")).toBe(merge);
    git(f.root, "remote", "set-url", "origin", join(f.parent, "missing.git"));
    await expect(f.lane.undo(f.id)).rejects.toThrow("git push"); const revert = git(f.root, "rev-parse", "HEAD");
    expect((await f.lane.detail(f.id)).phase).toBe("revert-push-pending");
    git(f.root, "remote", "set-url", "origin", f.remote); await f.lane.undo(f.id); expect(git(f.root, "rev-parse", "HEAD")).toBe(revert);
  }, 60_000);
  it("allows an unflagged candidate without opening review and refuses retracted UAT", async () => {
    const f = await built(); accept(f.root, f.view.handover!); expect((await f.lane.detail(f.id)).canShip).toBe(true);
    const h = f.view.handover!;
    expect(retractSignOff({ root: f.root, handover_id: h.handover_id, revision: h.revision, actor: "fixture-owner", command_id: randomUUID(), now: new Date().toISOString() }).ok).toBe(true);
    expect((await f.lane.detail(f.id)).canShip).toBe(false);
  }, 60_000);
  it("invalidates UAT and review on a changed branch head", async () => {
    const f = await built(true); accept(f.root, f.view.handover!); await f.lane.review(f.id);
    vi.stubEnv("GIT_INDEX_FILE", ".git/index");
    put(f.view.workspace, "later.txt", "later"); git(f.view.workspace, "add", "."); git(f.view.workspace, "commit", "-m", "later");
    expect((await f.lane.detail(f.id)).canShip).toBe(false); await expect(f.lane.ship(f.id)).rejects.toThrow();
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
    await expect(f.lane.ship(f.id)).rejects.toThrow("candidate-edits-pm-row");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(f.view.base);
    expect(git(f.root, "status", "--porcelain")).toBe("");
    expect(git(f.root, "rev-parse", "--git-path", "MERGE_HEAD")).toBe(".git/MERGE_HEAD");
    expect(existsSync(join(f.root, ".git/MERGE_HEAD"))).toBe(false);
    expect((await f.lane.detail(f.id)).phase).toBe("uat-ready");
  }, 60_000);
  it("aborts a rejected ship commit and lets the second click ship exactly once", async () => {
    const f = await ready();
    rejectHook(f.root);
    await expect(f.lane.ship(f.id)).rejects.toThrow("fixture hook rejected");
    const failed = await f.lane.detail(f.id);
    expect(failed).toMatchObject({ phase: "uat-ready", canShip: true, ship_error: expect.stringContaining("fixture hook rejected") });
    expect(git(f.root, "rev-parse", "HEAD")).toBe(f.view.base);
    expect(git(f.root, "status", "--porcelain", "--untracked-files=all")).toBe("");
    expect(existsSync(join(f.root, ".git/MERGE_HEAD"))).toBe(false);
    expect(readFileSync(join(f.root, `${PM}/Delivery/4 - Checklist.md`), "utf8")).toContain("[ ] **DLV-900**");
    expect(readFileSync(join(f.root, `${PM}/Delivery/Delivery — Master Book.md`), "utf8")).not.toContain("✅");
    rmSync(join(f.root, ".git/hooks/pre-commit"));
    expect((await f.lane.ship(f.id)).phase).toBe("shipped");
    expect(git(f.root, "rev-list", "--count", "--merges", "HEAD")).toBe("1");
  }, 60_000);
  it.each([true, false])("recovers an interrupted merging record (MERGE_HEAD %s) through Ship", async present => {
    const f = await ready();
    if (present) git(f.root, "merge", "--no-ff", "--no-commit", f.view.head!);
    setPhase(f, "merging");
    const restarted = createLocalLane({ root: f.root, store: f.store });
    expect(await restarted.detail(f.id)).toMatchObject({ phase: "merging", canShip: true });
    expect((await restarted.ship(f.id)).phase).toBe("shipped");
    expect(git(f.root, "status", "--porcelain")).toBe("");
    expect(git(f.root, "rev-list", "--count", "--merges", "HEAD")).toBe("1");
    expect((await restarted.detail(f.id)).activity.some((row: { summary: string }) => row.summary === "Recovered Ship; main restored")).toBe(true);
  }, 60_000);
  it("refuses interrupted recovery when main advanced, preserving owner changes", async () => {
    const f = await ready();
    setPhase(f, "merging");
    put(f.root, "owner.txt", "owner work\n"); git(f.root, "add", "."); git(f.root, "commit", "-m", "owner change");
    const head = git(f.root, "rev-parse", "HEAD");
    await expect(f.lane.ship(f.id)).rejects.toThrow("ship-interrupted; inspect main");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(head);
    expect(readFileSync(join(f.root, "owner.txt"), "utf8")).toBe("owner work\n");
    expect(await f.lane.detail(f.id)).toMatchObject({ phase: "merging", ship_error: "merge-abort-failed" });
  }, 60_000);
  it.each(["staged", "unstaged", "untracked"])("preserves %s owner work beside a matching interrupted merge", async state => {
    const f = await ready();
    git(f.root, "merge", "--no-ff", "--no-commit", f.view.head!);
    setPhase(f, "merging");
    const file = state === "untracked" ? "owner.txt" : "CLAUDE.md";
    put(f.root, file, "owner work\n");
    if (state === "staged") git(f.root, "add", file);
    const status = git(f.root, "status", "--porcelain");
    await expect(f.lane.ship(f.id)).rejects.toThrow("ship-interrupted; inspect main");
    expect(readFileSync(join(f.root, file), "utf8")).toBe("owner work\n");
    expect(git(f.root, "status", "--porcelain")).toBe(status);
    expect(existsSync(join(f.root, ".git/MERGE_HEAD"))).toBe(true);
    expect(await f.lane.detail(f.id)).toMatchObject({ ship_error: "merge-abort-failed", ship_error_detail: "foreign-merge-changes" });
  }, 60_000);
  it("retains merging and the abort error if cleanup itself fails", async () => {
    let abortsFail = false;
    const run: typeof runProcess = (command, args, options) => {
      if (abortsFail && command === "git" && args[1] === "merge" && args.includes("--abort"))
        return Promise.resolve({ status: 1, stdout: "", stderr: "fixture abort unavailable", error: null, signal: null });
      return runProcess(command, args, options);
    };
    const f = await ready({ run });
    rejectHook(f.root); abortsFail = true;
    await expect(f.lane.ship(f.id)).rejects.toThrow("fixture hook rejected");
    expect(await f.lane.detail(f.id)).toMatchObject({ phase: "merging", canShip: true, ship_error: "merge-abort-failed", ship_error_detail: expect.stringContaining("fixture abort unavailable") });
    expect(existsSync(join(f.root, ".git/MERGE_HEAD"))).toBe(true);
    abortsFail = false; rmSync(join(f.root, ".git/hooks/pre-commit"));
    expect((await f.lane.ship(f.id)).phase).toBe("shipped");
  }, 60_000);
  it("preserves an extra staged owner edit to a supervisor-owned PM file", async () => {
    let main = "";
    const book = `${PM}/Delivery/Delivery — Master Book.md`;
    const run: typeof runProcess = (command, args, options) => {
      if (command === "git" && options?.cwd === main && args[1] === "commit") {
        put(main, book, readFileSync(join(main, book), "utf8") + "\nOwner note\n");
        git(main, "add", "--", book);
        return Promise.resolve({ status: 1, stdout: "", stderr: "fixture hook rejected with owner edit", error: null, signal: null });
      }
      return runProcess(command, args, options);
    };
    const f = await ready({ run }); main = f.root;
    await expect(f.lane.ship(f.id)).rejects.toThrow("fixture hook rejected");
    expect(await f.lane.detail(f.id)).toMatchObject({ phase: "merging", ship_error: "merge-abort-failed", ship_error_detail: "foreign-merge-changes" });
    expect(git(f.root, "show", `:${book}`)).toContain("Owner note");
    const status = git(f.root, "status", "--porcelain");
    await expect(f.lane.ship(f.id)).rejects.toThrow("ship-interrupted; inspect main");
    expect(git(f.root, "status", "--porcelain")).toBe(status);
    expect(readFileSync(join(f.root, book), "utf8")).toContain("Owner note");
  }, 60_000);
  it("aborts a rejected revert and lets Undo retry without a duplicate commit", async () => {
    const f = await ready();
    const shipped = await f.lane.ship(f.id), head = git(f.root, "rev-parse", "HEAD");
    rejectHook(f.root, "prepare-commit-msg");
    await expect(f.lane.undo(f.id)).rejects.toThrow("fixture hook rejected");
    expect(await f.lane.detail(f.id)).toMatchObject({ phase: "shipped", canUndo: true, undo_error: expect.stringContaining("fixture hook rejected") });
    expect(git(f.root, "status", "--porcelain", "--untracked-files=all")).toBe("");
    expect(git(f.root, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(f.root, ".git/REVERT_HEAD"))).toBe(false);
    rmSync(join(f.root, ".git/hooks/prepare-commit-msg"));
    expect((await f.lane.undo(f.id)).phase).toBe("reverted");
    expect(git(f.root, "rev-parse", "HEAD^")).toBe(shipped.merge);
    expect(git(f.root, "show", "HEAD:greeting.txt")).toBe("before");
  }, 60_000);
  it("preserves unknown files beside a failed markerless revert", async () => {
    const f = await ready();
    await f.lane.ship(f.id);
    put(f.root, ".git/hooks/prepare-commit-msg", "#!/bin/sh\necho 'owner file' > owner.txt\nexit 1\n");
    if (process.platform !== "win32") chmodSync(join(f.root, ".git/hooks/prepare-commit-msg"), 0o755);
    await expect(f.lane.undo(f.id)).rejects.toThrow("git revert");
    expect(await f.lane.detail(f.id)).toMatchObject({ phase: "shipped", undo_error: "revert-abort-failed" });
    expect(readFileSync(join(f.root, "owner.txt"), "utf8")).toContain("owner file");
    expect(git(f.root, "diff", "--cached", "--name-only")).toContain("greeting.txt");
  }, 60_000);
  it("preserves staged owner work beside a matching interrupted revert", async () => {
    const f = await ready();
    const shipped = await f.lane.ship(f.id), head = git(f.root, "rev-parse", "HEAD");
    git(f.root, "revert", "--no-commit", "-m", "1", shipped.merge!);
    put(f.root, ".git/REVERT_HEAD", `${shipped.merge}\n`);
    const row = f.store.getRun(f.id);
    f.store.updateRun(f.id, { base_manifest_json: { ...JSON.parse(row.base_manifest_json), undo_base: head } });
    put(f.root, "CLAUDE.md", "owner staged work\n"); git(f.root, "add", "CLAUDE.md");
    const status = git(f.root, "status", "--porcelain");
    await expect(f.lane.undo(f.id)).rejects.toThrow("undo-interrupted; inspect main");
    expect(git(f.root, "show", ":CLAUDE.md")).toBe("owner staged work");
    expect(git(f.root, "status", "--porcelain")).toBe(status);
    expect(existsSync(join(f.root, ".git/REVERT_HEAD"))).toBe(true);
    expect(await f.lane.detail(f.id)).toMatchObject({ undo_error: "revert-abort-failed", undo_error_detail: "foreign-revert-changes" });
  }, 60_000);
  it("reclaims only a provably dead command owner and records the recovery", async () => {
    const f = await ready();
    const dead = Number(execFileSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8", windowsHide: true }));
    expect(() => process.kill(dead, 0)).toThrow();
    put(f.root, ".delivery/local-command.lock/owner.json", JSON.stringify({ pid: dead, action: "ship", run_id: f.id, at: "2026-11-16T00:00:00Z" }));
    expect((await f.lane.ship(f.id)).phase).toBe("shipped");
    expect((await f.lane.detail(f.id)).activity.filter((row: { summary: string }) => row.summary === "Recovered stale lock")).toHaveLength(1);
    expect(existsSync(join(f.root, ".delivery/local-command.lock"))).toBe(false);
  }, 60_000);
  it.each(["live", "missing", "invalid"])("does not reclaim a %s lock owner", async owner => {
    const f = await ready(), lock = ".delivery/local-command.lock";
    mkdirSync(join(f.root, lock), { recursive: true });
    if (owner !== "missing") put(f.root, `${lock}/owner.json`, owner === "invalid" ? "{" : JSON.stringify({ pid: process.pid, action: "ship", run_id: f.id, at: new Date().toISOString() }));
    await expect(f.lane.ship(f.id)).rejects.toThrow(owner === "live" ? `local-command-busy; ship ${f.id}` : "local-command-busy; unknown action unknown run");
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
    expect(existsSync(f.view.workspace)).toBe(true);
    expect(git(f.root, "rev-parse", f.view.branch)).toBe(f.view.head);
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
