// Replay-only: real temporary Git worktrees/remotes, synthetic subscription and
// native session; all UAT receipts below are fixture-owner actions.
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { createLocalLane } from "../../scripts/delivery-v2/local-lane.mjs";
import { classifyLocalDiff, localEnvironment, localSubscription, assertNoLocalSecrets } from "../../scripts/delivery-v2/local-guardrails.mjs";
import { installedDependencies } from "../../scripts/delivery-v2/local-process.mjs";
import { LOCAL_LAUNCH_GATES, LAUNCH_GATES } from "../../scripts/delivery-v2/readiness-contract.mjs";
import { loopbackBrowserSession, authenticateLocal, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";
import { recordAvailability, recordResult, signOff, retractSignOff } from "../../scripts/delivery-v2/uat.mjs";
import { createJourney } from "../../scripts/delivery-v2/journey.mjs";
import { routeLocal } from "../../scripts/delivery-v2/local-routes.mjs";
import { buildSessionOptions } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

const roots: string[] = [];
const stores: ReturnType<typeof openStore>[] = [];
afterEach(() => { stores.splice(0).forEach(s => s.close()); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function temp() { const root = mkdtempSync(join(tmpdir(), "era-local-")); roots.push(root); return root; }
const git = (root: string, ...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const put = (root: string, path: string, value: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
const PM = "ERA Notes/10 - Project Management";
async function fixture(risk = false, red = false) {
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
  let launches = 0;
  let requestedSettings: unknown = null;
  const lane = createLocalLane({ root, store, authenticate: () => ({ ok: true, method: "fixture", directory: credential }),
    catalog: () => ({ revision: 1, models: { claude: [{ id: "fixture-claude", efforts: ["medium"] }, { id: "disabled-claude", disabled: true }] } }),
    prepareDependencies: async (workspace: string) => { put(workspace, "node_modules/.pnpm/lock.yaml", readFileSync(join(workspace, "pnpm-lock.yaml"), "utf8")); return { status: 0 }; },
    session: async ({ request, env }: { request: { workspace: { root: string }; instruction: string }; env: Record<string, string> }) => {
      launches++;
      requestedSettings = (request as typeof request & { settings: unknown }).settings;
      const workspace = request.workspace.root;
      expect(readFileSync(join(workspace, "CLAUDE.md"), "utf8")).toContain("Fixture instructions");
      expect(existsSync(join(workspace, ".claude/skills/start-task/SKILL.md"))).toBe(true);
      expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY"); expect(env).not.toHaveProperty("CRON_SECRET"); expect(env).not.toHaveProperty("OPENAI_API_KEY");
      expect(request.instruction).toContain("DLV-900");
      put(workspace, risk ? "src/features/accounts/change.ts" : "greeting.txt", "after\n");
      put(workspace, ".delivery-handover.json", JSON.stringify({ summary: "Changed greeting", scenarios: [{ id: "greeting", title: "Greeting", required: true, steps: [{ action: "Read greeting", expected: "after" }] }] }));
      return { status: "finished", observations: { nativeOutcome: "succeeded", usage: { input: 1, output: 1 } } };
    } });
  const input = { file: "Delivery/4 - Checklist.md", id: "DLV-900", executor: "claude" };
  return { parent, root, remote, store, lane, input, launches: () => launches, requestedSettings: () => requestedSettings };
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

describe("versioned Local guardrails", () => {
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
  it("loads Claude project skills/hooks while retaining its sandbox", () => {
    const options = buildSessionOptions({ workspaceRoot: temp(), local: true, env: { PATH: "fixture" } });
    expect(options.settingSources).toEqual(["project"]); expect(options.skills).toBe("all");
    expect(options.sandbox).toEqual({ enabled: true, failIfUnavailable: true }); expect(options.env).toEqual({ PATH: "fixture" });
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
  });
  it("runs all four real host commands and records their output in the shared session", async () => {
    const f = await built();
    expect(f.view.phase).toBe("uat-ready"); expect(relative(f.root, f.view.workspace).startsWith("..")).toBe(true);
    expect(git(f.view.workspace, "branch", "--show-current")).toBe("delivery/DLV-900");
    expect(f.view.checks.map(c => c.name)).toEqual(["typecheck", "lint", "test", "pm:lint"]);
    expect(f.view.checks.every(c => c.exit === 0 && c.stdout.includes("host output"))).toBe(true);
    expect(f.store.listActivity(f.id).length).toBeGreaterThan(3); expect(f.launches()).toBe(1);
    expect((await f.lane.start(f.input)).run_id).toBe(f.id); expect(f.launches()).toBe(1);
    expect(await f.lane.detail(f.id)).toMatchObject({ canShip: false });
    // Confined lifecycle cannot apply, count or recover Local jobs.
    const journey = createJourney({ root: f.root, pmRel: PM, store: f.store });
    expect(journey.list()).toEqual([]); expect(journey.detail(f.id).ok).toBe(false);
  }, 30_000);
  it("keeps exactly three blockers and treats other gates as advisory", async () => {
    const f = await fixture(); const result = await f.lane.readiness(f.input);
    expect(LOCAL_LAUNCH_GATES).toEqual(["source", "authentication", "environment"]); expect(LAUNCH_GATES).toHaveLength(11);
    expect(result.ready).toBe(true); expect(result.facts.budget.state).toBe("advisory");
    put(f.root, "dirty.txt", "dirty"); expect((await f.lane.readiness(f.input)).facts.source.state).toBe("blocked");
    expect((await f.lane.start(f.input)).ok).toBe(false); expect(f.launches()).toBe(0);
  });
  it("refuses red checks without producing a ready handover", async () => {
    const f = await built(false, true); expect(f.view.phase).toBe("failed"); expect(f.view.canShip).toBe(false);
    expect(f.view.checks.find(c => c.name === "lint")?.exit).toBe(1); expect(f.view.handover).toBeNull();
  }, 30_000);
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
  }, 30_000);
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
  }, 30_000);
  it("allows an unflagged candidate without opening review and refuses retracted UAT", async () => {
    const f = await built(); accept(f.root, f.view.handover!); expect((await f.lane.detail(f.id)).canShip).toBe(true);
    const h = f.view.handover!;
    expect(retractSignOff({ root: f.root, handover_id: h.handover_id, revision: h.revision, actor: "fixture-owner", command_id: randomUUID(), now: new Date().toISOString() }).ok).toBe(true);
    expect((await f.lane.detail(f.id)).canShip).toBe(false);
  }, 30_000);
  it("invalidates UAT and review on a changed branch head", async () => {
    const f = await built(true); accept(f.root, f.view.handover!); await f.lane.review(f.id);
    put(f.view.workspace, "later.txt", "later"); git(f.view.workspace, "add", "."); git(f.view.workspace, "commit", "-m", "later");
    expect((await f.lane.detail(f.id)).canShip).toBe(false); await expect(f.lane.ship(f.id)).rejects.toThrow();
  }, 30_000);
  it("refuses relay/Steward Ship and invalid action payloads at the command boundary", async () => {
    const ctx = { local: { ship: () => { throw new Error("must not execute"); } } };
    const request = { method: "POST", path: "/api/delivery/v2/local", body: { action: "ship", run_id: "local-" + randomUUID() }, loopbackPeer: true };
    expect((await routeLocal(request, { kind: "bridge" }, ctx))?.status).toBe(403);
    expect((await routeLocal(request, { kind: "steward" }, ctx))?.status).toBe(403);
    expect((await routeLocal({ ...request, loopbackPeer: false }, { kind: "browser" }, ctx))?.status).toBe(403);
    expect((await routeLocal({ ...request, body: { action: "shell" } }, { kind: "browser" }, ctx))?.status).toBe(400);
  });
});
