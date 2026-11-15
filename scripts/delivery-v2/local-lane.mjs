// DLV-150–153. Local worktree supervision over the existing run/job/activity store.
import { randomUUID, createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { runProcess } from "./process.mjs";
import { installedDependencies, hostChecks, nativeLocalSession, pnpmCommand } from "./local-process.mjs";
import { localEnvironment, localWorkerSubscription, assertNoLocalSecrets, classifyLocalDiff } from "./local-guardrails.mjs";
import { LOCAL_ADVISORIES, LOCAL_LAUNCH_GATES } from "./readiness-contract.mjs";
import { validateRunSettings } from "./adapters/registry.mjs";
import { loadExecutionPolicy } from "./policy.mjs";
import { makeJobRequest } from "./adapters/adapter.mjs";
import { parseWorkItems } from "./work-ref.mjs";
import { idSection } from "../pm/shared/work-id.mjs";
import { bindDirect, freezeHandover, viewOne } from "./uat.mjs";
import { archiveItem } from "../pm/archive.mjs";
import { tickById, buildIndexBlock, refreshIndex } from "../pm/ship.mjs";

const parse = value => { try { return JSON.parse(value || "null"); } catch { return null; } };
export const localRecord = run => parse(run?.base_manifest_json)?.lane === "local" ? parse(run.base_manifest_json) : null;
const sha = value => createHash("sha256").update(value).digest("hex");
const at = () => new Date().toISOString();
const PM = "ERA Notes/10 - Project Management";

/** @param {{root:string, store:object|Function, run?:typeof runProcess,
 * session?:typeof nativeLocalSession, authenticate?:typeof localWorkerSubscription,
 * dependencies?:typeof installedDependencies, checks?:typeof hostChecks,
 * prepareDependencies?:((workspace:string)=>Promise<{status:number|null}>)|null,
 * baseBranch?:string, remote?:string, hasStore?:()=>boolean, catalog?:()=>object|null}} options */
export function createLocalLane({ root, store, run = runProcess, session = nativeLocalSession,
  authenticate = localWorkerSubscription, dependencies = installedDependencies, checks = hostChecks,
  prepareDependencies = null, baseBranch = "main", remote = "origin", hasStore = () => true,
  catalog = () => { const loaded = loadExecutionPolicy({ root }); return loaded.ok ? loaded.policy.executors.catalog : null; } }) {
  const s = () => typeof store === "function" ? store() : store;
  const tasks = new Map();
  const env = () => localEnvironment();
  async function git(cwd, ...args) {
    const out = await run("git", ["--no-optional-locks", ...args], { cwd, env: env(), timeout: 30_000 });
    if (out.status !== 0 || out.error) throw new Error(`git ${args[0]}: ${out.stderr || out.error?.message || out.status}`);
    return out.stdout.trimEnd();
  }
  const save = (id, data, lifecycle = "ACTIVE", outcome = null) => s().updateRun(id, { base_manifest_json: data, lifecycle, closed_outcome: outcome });
  const dataOf = id => { const data = localRecord(s().getRun(id)); if (!data) throw new Error("unknown-local-run"); return data; };
  /** @template T @param {()=>Promise<T>} fn @returns {Promise<T>} */
  function locked(fn) {
    const lock = join(root, ".delivery/local-command.lock");
    mkdirSync(dirname(lock), { recursive: true });
    try { mkdirSync(lock); } catch { throw new Error("local-command-busy; inspect any interrupted command before removing its lock"); }
    return Promise.resolve().then(fn).finally(() => rmdirSync(lock));
  }
  const event = (id, message) => s().appendActivity(id, id, [{ at: at(), kind: "status", summary: message }]);

  function selected(file, id) {
    if (!/^[A-Z]{1,5}-?\d+[A-Z]?(?:\.\d+[A-Z]?)*$/u.test(id)) throw new Error("invalid-work-id");
    const abs = resolve(root, PM, file), rel = relative(join(root, PM), abs);
    if (isAbsolute(rel) || rel.startsWith("..") || !/^[^/\\]+[/\\]4 - Checklist\.md$/u.test(rel)) throw new Error("invalid-checklist");
    const rows = parseWorkItems(readFileSync(abs, "utf8")).filter(row => row.alias === id && row.state === "open");
    if (rows.length !== 1 || /\bHELD\b/u.test(rows[0].rest)) throw new Error("item-unavailable");
    const campaign = file.split(/[/\\]/u)[0];
    const names = readdirSync(join(root, PM, campaign)).filter(name => name.endsWith("— Master Book.md"));
    if (names.length !== 1) throw new Error("master-book-unavailable");
    const book = `${campaign}/${names[0]}`;
    const section = idSection(readFileSync(join(root, PM, book), "utf8"), id);
    if (!section || /\*\*Execution:\*\*\s*owner/iu.test(section.body)) throw new Error("acceptance-unavailable-or-owner-only");
    return { file, id, campaign, book, title: rows[0].text, row: rows[0].rest, brief: section.body };
  }

  async function readiness({ executor = "claude" } = {}) {
    /** @type {Record<string, {state:string, code:string, detail?:string}>} */
    const facts = {};
    let base = null;
    try {
      base = await git(root, "rev-parse", "--verify", `refs/heads/${baseBranch}`);
      const current = await git(root, "symbolic-ref", "--short", "HEAD");
      const dirty = await git(root, "status", "--porcelain", "--untracked-files=all");
      facts.source = { state: current === baseBranch && !dirty ? "pass" : "blocked", code: current !== baseBranch ? "checkout-main" : dirty ? "commit-or-stash-changes" : "source-clean", detail: base };
    } catch { facts.source = { state: "blocked", code: "base-unknown" }; }
    try { authenticate(executor); facts.authentication = { state: "pass", code: "subscription-login" }; }
    catch { facts.authentication = { state: "blocked", code: "subscription-sign-in-required-no-api-keys" }; }
    let installed = false;
    try {
      installed = dependencies(root) && (await import("./dependency-environment.mjs")).manifestMatchesLock(
        readFileSync(join(root, "package.json"), "utf8"), readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
    } catch { /* missing or mismatched installation */ }
    facts.environment = { state: installed ? "pass" : "blocked", code: installed ? "dependencies-match-lock" : "install-frozen-dependencies" };
    for (const name of LOCAL_ADVISORIES) facts[name] = { state: "advisory", code: name === "coordination" ? `${list().filter(row => row.lifecycle !== "CLOSED").length} local sessions` : "not-probed" };
    return { lane: "local", ready: LOCAL_LAUNCH_GATES.every(name => facts[name].state === "pass"), facts, base, executor };
  }

  function list() {
    if (!hasStore()) return [];
    return s().listRuns().filter(localRecord).map(row => {
      const d = localRecord(row);
      const active = tasks.has(row.run_id);
      const interrupted = ["preparing", "building", "checking"].includes(d.phase) && !active;
      return { run_id: row.run_id, engine: "v2", lane: "local", title: d.work.title, alias: d.work.id, file: d.work.file, campaign: d.work.campaign,
        lifecycle: row.lifecycle, closed_outcome: row.closed_outcome, waiting_reason: null, executor: d.settings.executor, model: d.settings.model,
        effort: d.settings.effort, ownerAction: interrupted ? "Interrupted" : d.phase,
        ownerActionKind: row.lifecycle === "CLOSED" || active ? "none" : d.phase === "uat-ready" ? "local-review" : "inspect-session", active,
        created_at: row.created_at, updated_at: row.updated_at, resources: null, application: null, stage: d.phase, branch: d.branch };
    });
  }

  async function diff(data, head) {
    const paths = (await git(data.workspace, "diff", "--no-renames", "--name-only", "-z", data.base, head)).split("\0").filter(Boolean);
    const files = [];
    for (const path of paths) {
      const read = async ref => { try { return await git(data.workspace, "show", `${ref}:${path}`); } catch { return ""; } };
      files.push({ path, before: await read(data.base), after: await read(head) });
    }
    return { files, risk: classifyLocalDiff(files), patch: await git(data.workspace, "diff", "--no-ext-diff", "--no-textconv", data.base, head) };
  }

  async function detail(id) {
    const d = dataOf(id);
    let head = null, clean = false, changes = { files: [], risk: d.risk, patch: "" };
    try {
      head = await git(d.workspace, "rev-parse", "HEAD");
      clean = !(await git(d.workspace, "status", "--porcelain", "--untracked-files=all"));
      changes = await diff(d, head);
    } catch { /* retained session still visible after a missing worktree */ }
    const handover = d.handover_id ? viewOne({ root, handover_id: d.handover_id, now: at() }) : null;
    const current = clean && head === d.head;
    const reviewed = !changes.risk?.required || (d.reviewed_head === head && d.reviewed_risk === sha(JSON.stringify(changes.risk)));
    const signed = handover?.acceptance.state === "accepted" && handover.status === "ready" && handover.blockers.length === 0 && handover.binding?.source_revision === head;
    const job = s().getJob(id);
    const observed = parse(job?.observations_json);
    return { ...d, run_id: id, current_head: head, clean, risk: changes.risk, patch: changes.patch, activity: s().listActivity(id), usage: observed?.usage || null,
      handover, canShip: current && reviewed && signed && d.phase === "uat-ready" && d.checks?.every(c => c.exit === 0 && !c.error),
      canUndo: d.phase === "shipped", interrupted: ["preparing", "building", "checking"].includes(d.phase) && !tasks.has(id) };
  }

  async function build(id, controller) {
    let d = dataOf(id);
    try {
      const [bin, launcher] = pnpmCommand();
      const install = prepareDependencies ? await prepareDependencies(d.workspace) : await run(bin,
        [launcher, "install", "--offline", "--frozen-lockfile", "--ignore-scripts"], { cwd: d.workspace, env: env(), timeout: 10 * 60_000 });
      if (install.status !== 0 || !dependencies(d.workspace)) throw new Error("worktree dependencies unavailable; offline frozen install failed");
      if (controller.signal.aborted) throw new Error("cancelled");
      assertNoLocalSecrets(d.workspace);
      // Copy only the selected native subscription credential, never user MCP,
      // provider settings, .env, or server credentials. The private home is runtime-only.
      const login = authenticate(d.settings.executor);
      const privateHome = join(root, ".delivery/local", id, "home");
      const configDir = join(privateHome, d.settings.executor === "claude" ? ".claude" : ".codex");
      mkdirSync(configDir, { recursive: true, mode: 0o700 });
      const credentialName = d.settings.executor === "claude" ? ".credentials.json" : "auth.json";
      cpSync(join(login.directory, credentialName), join(configDir, credentialName));
      if (d.settings.executor === "codex") writeFileSync(join(configDir, "config.toml"),
        'forced_login_method = "chatgpt"\ncli_auth_credentials_store = "file"\n' +
        (process.platform === "win32" ? '\n[windows]\nsandbox = "unelevated"\n' : ""));
      const hooks = join(root, ".delivery/local", id, "hooks");
      mkdirSync(hooks, { recursive: true });
      const originalHooks = join(d.workspace, ".husky");
      if (existsSync(originalHooks)) cpSync(originalHooks, hooks, { recursive: true });
      const huskyRuntime = join(d.workspace, "node_modules/husky/husky.sh");
      if (existsSync(huskyRuntime)) {
        mkdirSync(join(hooks, "_"), { recursive: true });
        cpSync(huskyRuntime, join(hooks, "_/husky.sh"));
        if (existsSync(originalHooks)) {
          mkdirSync(join(originalHooks, "_"), { recursive: true });
          writeFileSync(join(originalHooks, "_/.gitignore"), "*\n");
          cpSync(huskyRuntime, join(originalHooks, "_/husky.sh"));
        }
      }
      writeFileSync(join(hooks, "pre-push"), '#!/bin/sh\necho "Local delivery workers cannot push" >&2\nexit 1\n', { mode: 0o755 });
      const childEnv = { ...env(), HOME: privateHome, USERPROFILE: privateHome,
        ...(d.settings.executor === "claude" ? { CLAUDE_CONFIG_DIR: configDir } : { CODEX_HOME: configDir }),
        GIT_CONFIG_COUNT: "3", GIT_CONFIG_KEY_0: "remote.origin.pushurl", GIT_CONFIG_VALUE_0: "file:///local-delivery-push-disabled",
        GIT_CONFIG_KEY_1: "remote.origin.receivepack", GIT_CONFIG_VALUE_1: "false",
        GIT_CONFIG_KEY_2: "core.hooksPath", GIT_CONFIG_VALUE_2: hooks };
      d = { ...d, phase: "building" }; save(id, d); event(id, "Native session started");
      const checkInstruction = d.settings.executor === "claude" && process.platform === "win32"
        ? "You have no shell. The supervisor runs the checks after you finish."
        : "Finish with checks.";
      const request = makeJobRequest({ job_id: id, run_id: id, backend_id: d.settings.backend_id, contract: { contract_id: id, revision: 1 },
        grant: { grant_id: "local-owner", revision: 1 }, reservation: { unit: "tokens", basis: "subscription-advisory" },
        workspace: { root: d.workspace, access: "write", backing: "git-worktree" }, settings: d.settings,
        instruction: `Implement only ${d.work.id}. Read CLAUDE.md and start-task; use the repository skills and hooks. Work only in this worktree. Never push, merge, read the main checkout's secrets or write any database. Do not commit; the supervisor commits your work. Do not ship PM records; the owner ships. ${checkInstruction} Write .delivery-handover.json with the UAT schema {summary,scenarios:[{id,title,required:true,steps:[{action,expected}]}]}.\n\n${d.work.brief}` });
      // makeJobRequest carries model/effort; executor is the local dispatch choice.
      s().markDispatchStarted(id, at());
      const result = await session({ request: { ...request, settings: d.settings }, env: childEnv, signal: controller.signal,
        onActivity: value => s().appendActivity(id, id, [value]) });
      s().updateJob(id, { status: "finished", reservation_open: false, observations_json: result.observations, outcome: result.observations?.nativeOutcome });
      s().markAfterJob(id, "done");
      if (controller.signal.aborted) throw new Error("cancelled");
      if (result.status !== "finished" || result.observations?.nativeOutcome !== "succeeded") throw new Error("native session did not confirm success");
      assertNoLocalSecrets(d.workspace);
      // Native sandboxes may keep Git's shared administrative directory read-only.
      // The trusted supervisor can commit the stopped worker's material, with the
      // repository hooks, without giving the worker push/merge authority.
      if (await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) {
        await git(d.workspace, "add", "--all");
        await git(d.workspace, "commit", "-m", `Build ${d.work.id}`);
      }
      const head = await git(d.workspace, "rev-parse", "HEAD");
      if (head === d.base) throw new Error("candidate needs a change");
      await git(d.workspace, "merge-base", "--is-ancestor", d.base, head);
      const changes = await diff(d, head);
      d = { ...d, phase: "checking", head, risk: changes.risk, checks: [] }; save(id, d); event(id, "Host checks started");
      const results = await checks({ workspace: d.workspace, env: env(), onCheck: c => { d.checks.push(c); save(id, d); event(id, `${c.name}: ${c.exit}`); } });
      if (controller.signal.aborted) throw new Error("cancelled");
      if (head !== await git(d.workspace, "rev-parse", "HEAD") || await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) throw new Error("candidate changed during host checks");
      d.checks = results;
      if (results.length !== 4 || results.some(c => c.exit !== 0 || c.error)) throw new Error("host checks failed");
      const content = parse(readFileSync(join(d.workspace, ".delivery-handover.json"), "utf8"));
      const frozen = freezeHandover({ root, subject: { delivery_ref: `local:${id}`, work_id: d.work.id, campaign: d.work.campaign, title: d.work.title },
        binding: bindDirect({ delivery_ref: `local:${id}`, source_revision: head }), environment: { target: "local", build: head },
        content, source: { kind: "local-supervisor", ref: id }, ready: true, now: at() });
      if (!frozen.ok || frozen.handover.status !== "ready") throw new Error("handover incomplete");
      d = { ...d, phase: "uat-ready", handover_id: frozen.handover.handover_id }; save(id, d); event(id, "Ready for owner UAT");
    } catch (error) {
      d = { ...d, phase: controller.signal.aborted ? "cancelled" : "failed", error: String(error.message) };
      save(id, d, "CLOSED", d.phase);
      s().updateJob(id, { status: "finished", reservation_open: false, outcome: d.phase }); s().markAfterJob(id, "done");
      event(id, d.error);
    } finally { tasks.delete(id); }
  }

  async function start(input) {
    return locked(async () => {
      const existing = list().find(row => row.alias === input.id && row.file === input.file && row.lifecycle !== "CLOSED");
      if (existing) return { ok: true, run_id: existing.run_id };
      const settings = validateRunSettings({ ...input, catalog: catalog() });
      if (!settings.ok) throw new Error(settings.refusals[0].detail);
      const work = selected(input.file, input.id);
      const ready = await readiness(input);
      if (!ready.ready) return { ok: false, readiness: ready, error: "local-preflight-failed" };
      const id = "local-" + randomUUID();
      // A failed attempt owns its worktree and evidence permanently. A fresh
      // owner Start uses a new branch/path instead of deleting or reusing it.
      const previous = list().filter(row => row.alias === input.id && row.file === input.file);
      const suffix = previous.length ? `${input.id}-${id.slice(6)}` : input.id;
      const workspace = join(dirname(root), `${root.split(/[/\\]/u).at(-1)}-delivery`, suffix);
      if (existsSync(workspace)) throw new Error("worktree-already-exists; inspect the previous attempt");
      const branch = `delivery/${suffix}`;
      await git(root, "worktree", "add", "-b", branch, workspace, ready.base);
      const d = { lane: "local", work, settings: settings.settings, workspace, base: ready.base, branch, phase: "preparing", checks: [], head: null };
      s().insertRun({ run_id: id, work_id: input.id, contract_id: id, contract_revision: 1, lifecycle: "ACTIVE" });
      save(id, d);
      s().insertJob({ job_id: id, run_id: id, dispatch_key: id, purpose: "start", backend_id: d.settings.backend_id,
        contract_id: id, contract_revision: 1, grant_id: "local-owner", grant_revision: 1,
        reservation: { unit: "tokens", basis: "subscription-advisory" }, settings: d.settings });
      s().updateJob(id, { status: "active" });
      const controller = new AbortController();
      tasks.set(id, { controller, promise: null });
      tasks.get(id).promise = build(id, controller);
      return { ok: true, run_id: id };
    });
  }

  async function review(id) {
    const view = await detail(id);
    if (!view.clean || view.current_head !== view.head) throw new Error("candidate-changed");
    const d = dataOf(id);
    save(id, { ...d, reviewed_head: view.current_head, reviewed_risk: sha(JSON.stringify(view.risk)) });
    event(id, "Owner opened diff review");
    return view.patch;
  }

  async function ship(id) {
    return locked(async () => {
      let d = dataOf(id);
      if (d.phase === "shipped") return detail(id);
      if (d.phase !== "push-pending") {
        const v = await detail(id);
        if (!v.canShip) throw new Error("current-head-uat-checks-and-risk-review-required");
        if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch || await git(root, "status", "--porcelain", "--untracked-files=all")) throw new Error("main-checkout-must-be-clean");
        if (await git(root, "rev-parse", "HEAD") !== d.base) throw new Error("main-advanced; rebuild and repeat UAT");
        const current = selected(d.work.file, d.work.id);
        if (current.row !== d.work.row || current.brief !== d.work.brief) throw new Error("acceptance-changed; repeat delivery");
        if (await git(root, "rev-parse", d.branch) !== d.head) throw new Error("branch-head-changed");
        d = { ...d, phase: "merging" }; save(id, d); // crash is retained, never blindly re-merged
        await git(root, "merge", "--no-ff", "--no-commit", d.head);
        const checklist = join(root, PM, d.work.file);
        const tick = tickById(readFileSync(checklist, "utf8"), d.work.id);
        if (tick.state !== "ticked") throw new Error("PM item changed in candidate; inspect merge");
        writeFileSync(checklist, tick.raw);
        const row = parseWorkItems(tick.raw).find(row => row.alias === d.work.id);
        const pm = archiveItem({ pmDir: join(root, PM), repoRoot: root, pmRelFromRoot: PM, file: d.work.file, cbidx: row.cbidx, mode: "ship" });
        if (!pm.ok) throw new Error("PM trace failed; inspect the uncommitted merge");
        const indexPath = join(root, PM, "_index.md");
        if (existsSync(indexPath)) writeFileSync(indexPath, refreshIndex(readFileSync(indexPath, "utf8"), buildIndexBlock(join(root, PM))));
        await git(root, "add", "--", PM);
        await git(root, "commit", "-m", `Ship ${d.work.id}`);
        d = { ...d, merge: await git(root, "rev-parse", "HEAD"), phase: "push-pending" }; save(id, d);
      }
      if (await git(root, "rev-parse", "HEAD") !== d.merge) throw new Error("ship-head-changed");
      await git(root, "push", remote, `HEAD:refs/heads/${baseBranch}`);
      save(id, { ...d, phase: "shipped" }, "CLOSED", "shipped"); event(id, "Owner shipped merge");
      return detail(id);
    });
  }

  async function undo(id) {
    return locked(async () => {
      let d = dataOf(id);
      if (d.phase === "reverted") return detail(id);
      if (!["shipped", "revert-push-pending"].includes(d.phase)) throw new Error("nothing-to-undo");
      if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch || await git(root, "status", "--porcelain", "--untracked-files=all")) throw new Error("main-checkout-must-be-clean");
      if (d.phase === "shipped") {
        await git(root, "revert", "--no-edit", "-m", "1", d.merge);
        d = { ...d, revert: await git(root, "rev-parse", "HEAD"), phase: "revert-push-pending" }; save(id, d, "CLOSED", "shipped");
      }
      if (await git(root, "rev-parse", "HEAD") !== d.revert) throw new Error("revert-head-changed");
      await git(root, "push", remote, `HEAD:refs/heads/${baseBranch}`);
      save(id, { ...d, phase: "reverted" }, "CLOSED", "reverted"); event(id, "Owner reverted merge");
      return detail(id);
    });
  }
  return { readiness, start, list, detail, review, ship, undo,
    wait: id => tasks.get(id)?.promise || Promise.resolve(),
    cancel(id) { const task = tasks.get(id); if (!task) throw new Error("session-not-running-in-this-process"); task.controller.abort(); return { ok: true }; },
  };
}
