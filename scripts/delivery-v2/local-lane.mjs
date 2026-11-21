// DLV-150–153. Local worktree supervision over the existing run/job/activity store.
import { randomUUID, createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { runProcess } from "./process.mjs";
import { decisiveLines } from "./failure-lines.mjs";
import { installedDependencies, hostChecks, nativeLocalSession, pnpmCommand } from "./local-process.mjs";
import { localEnvironment, localWorkerSubscription, assertNoLocalSecrets, classifyLocalDiff } from "./local-guardrails.mjs";
import { LOCAL_ADVISORIES, LOCAL_LAUNCH_GATES } from "./readiness-contract.mjs";
import { validateRunSettings } from "./adapters/registry.mjs";
import { loadExecutionPolicy } from "./policy.mjs";
import { makeJobRequest } from "./adapters/adapter.mjs";
import { parseWorkItems } from "./work-ref.mjs";
import { idSection } from "../pm/shared/work-id.mjs";
import { bindDirect, freezeHandover, viewOne } from "./uat.mjs";
import { archiveItem, insertDatedStamp, itemBody, removeLine, shippedStamp } from "../pm/archive.mjs";
import { tickById, buildIndexBlock, refreshIndex } from "../pm/ship.mjs";
import { normalizeAnswers, normalizeMessage, normalizeQuestion, projectQuestions, readLedger, resumePrompt, writeLedger } from "./local-questions.mjs";
import { fileURLToPath } from "node:url";

const ASK_SERVER = fileURLToPath(new URL("./local-ask-mcp.mjs", import.meta.url));

const parse = value => { try { return JSON.parse(value || "null"); } catch { return null; } };
export const localRecord = run => parse(run?.base_manifest_json)?.lane === "local" ? parse(run.base_manifest_json) : null;
const sha = value => createHash("sha256").update(value).digest("hex");
const at = () => new Date().toISOString();
const PM = "ERA Notes/10 - Project Management";
const HOOK_STAGES = new Map([
  ["Checking AI guidance docs...", "docs"],
  ["Checking generated agent setup...", "mirrors"],
  ["Checking PWA manifests...", "manifests"],
  ["Running TypeScript check...", "typecheck"],
  ["Running unit tests...", "tests"],
  ["Running ESLint on staged files...", "lint"],
]);

/** @param {{root:string, store:object|Function, run?:typeof runProcess,
 * session?:typeof nativeLocalSession, authenticate?:typeof localWorkerSubscription,
 * dependencies?:typeof installedDependencies, checks?:typeof hostChecks,
 * prepareDependencies?:((workspace:string)=>Promise<{status:number|null}>)|null,
 * baseBranch?:string, remote?:string, hasStore?:()=>boolean, catalog?:()=>object|null,
 * limits?:{hookMs?:number, pushMs?:number}}} options */
export function createLocalLane({ root, store, run = runProcess, session = nativeLocalSession,
  authenticate = localWorkerSubscription, dependencies = installedDependencies, checks = hostChecks,
  prepareDependencies = null, baseBranch = "main", remote = "origin", hasStore = () => true, limits = {},
  catalog = () => { const loaded = loadExecutionPolicy({ root }); return loaded.ok ? loaded.policy.executors.catalog : null; } }) {
  const s = () => typeof store === "function" ? store() : store;
  const tasks = new Map();
  const supervisor = { pid: process.pid, instance: randomUUID() };
  const env = () => localEnvironment();
  const { hookMs = 25 * 60_000, pushMs = 5 * 60_000 } = limits;
  async function git(cwd, ...args) {
    const out = await run("git", ["--no-optional-locks", ...args], { cwd, env: env(), timeout: 30_000 });
    if (out.status !== 0 || out.error) throw new Error(`git ${args[0]}: ${out.stderr || out.error?.message || out.status}`);
    return out.stdout.trimEnd();
  }
  async function gitSlow(cwd, limitMs, onLine, ...args) {
    const out = await run("git", ["--no-optional-locks", ...args], { cwd, env: env(), timeout: limitMs, onStderrLine: onLine });
    if (out.error?.code === "ETIMEDOUT") throw new Error(`git ${args[0]}: timed out after ${limitMs / 1000} s`);
    if (out.status !== 0 || out.error) throw new Error(`git ${args[0]}: ${out.stderr || out.error?.message || out.status}`);
    return out.stdout.trimEnd();
  }
  const save = (id, data, lifecycle = "ACTIVE", outcome = null) => s().updateRun(id, { base_manifest_json: data, lifecycle, closed_outcome: outcome });
  const dataOf = id => { const data = localRecord(s().getRun(id)); if (!data) throw new Error("unknown-local-run"); return data; };
  /** @template T @param {string} action @param {string|null} id @param {()=>Promise<T>} fn @returns {Promise<T>} */
  function locked(action, id, fn) {
    const lock = join(root, ".delivery/local-command.lock");
    let recoveredOwner = null;
    mkdirSync(dirname(lock), { recursive: true });
    try { mkdirSync(lock); } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let raw = "", owner = null;
      try { raw = readFileSync(join(lock, "owner.json"), "utf8"); owner = parse(raw); } catch { /* unknown owner stays locked */ }
      const busy = () => new Error(`local-command-busy; ${owner?.action || "unknown action"} ${owner?.run_id || "unknown run"}`);
      if (!Number.isSafeInteger(owner?.pid) || owner.pid < 1) throw busy();
      try { process.kill(owner.pid, 0); throw busy(); }
      catch (probe) { if (probe.code !== "ESRCH") throw busy(); }
      // Retain the old owner as a tiny tombstone: a second stale-lock reclaimer
      // cannot rename a newly acquired lock over this nonempty destination.
      const recovered = join(root, ".delivery/local-command-recovered", sha(raw));
      mkdirSync(dirname(recovered), { recursive: true });
      try { renameSync(lock, recovered); mkdirSync(lock); }
      catch { throw busy(); }
      recoveredOwner = owner;
    }
    const owner = { pid: process.pid, action, run_id: id, at: at(), token: randomUUID() };
    try { writeFileSync(join(lock, "owner.json"), JSON.stringify(owner), { flag: "wx" }); }
    catch (error) { try { rmdirSync(lock); } catch { /* retain unknown ownership */ } throw error; }
    return Promise.resolve().then(() => {
      if (recoveredOwner?.run_id && localRecord(s().getRun(recoveredOwner.run_id))) event(recoveredOwner.run_id, "Recovered stale lock");
      return fn();
    }).finally(() => {
      let current = null;
      try { current = parse(readFileSync(join(lock, "owner.json"), "utf8")); } catch { /* never remove unknown ownership */ }
      if (current?.token !== owner.token) return;
      unlinkSync(join(lock, "owner.json")); rmdirSync(lock);
    });
  }
  const event = (id, message) => s().appendActivity(id, id, [{ at: at(), kind: "status", summary: message }]);

  // DLV-164/165. The conversation ledger lives outside `.delivery/local/<id>/`,
  // whose credential home is disposable. A question parks the session: no
  // process waits; the answer (or an owner message) resumes the same native session.
  const chatFile = id => join(root, ".delivery/local-chat", `${id}.json`);
  const readChat = id => readLedger(chatFile(id));
  const writeChat = (id, chat) => writeLedger(chatFile(id), chat);
  const answerable = (id, d) => tasks.has(id) || !!d?.parked;
  const chatOf = (id, d) => {
    const chat = readChat(id);
    return { questions: projectQuestions(chat.questions, answerable(id, d)), messages: chat.messages };
  };
  function recordQuestion(id, value) {
    const asked = normalizeQuestion(value);
    if (!asked.ok) return;
    const chat = readChat(id);
    if (chat.questions.some(entry => entry.id === asked.question.id)) return;
    writeChat(id, { ...chat, questions: [...chat.questions,
      { ...asked.question, asked_at: at(), answers: null, answered_at: null, delivered_at: null, closed_at: null }] });
    event(id, `Question: ${asked.question.questions.map(entry => entry.header).join(" · ")}`);
  }
  function markDelivered(id, ids) {
    const chat = readChat(id), when = at();
    writeChat(id, { ...chat, messages: chat.messages.map(entry => ids.includes(entry.id) && !entry.delivered_at ? { ...entry, delivered_at: when } : entry) });
  }
  function closeQuestions(id) {
    const chat = readChat(id);
    if (chat.questions.some(entry => !entry.answers && !entry.closed_at))
      writeChat(id, { ...chat, questions: chat.questions.map(entry => entry.answers || entry.closed_at ? entry : { ...entry, closed_at: at() }) });
  }
  /** Answers and messages the agent has not received, as the next prompt; marks them delivered. */
  function takeResume(id) {
    const chat = readChat(id), when = at();
    const answered = chat.questions.filter(entry => entry.answers && !entry.delivered_at);
    const messages = chat.messages.filter(entry => !entry.delivered_at);
    if (!answered.length && !messages.length) return null;
    writeChat(id, {
      questions: chat.questions.map(entry => answered.includes(entry) ? { ...entry, delivered_at: when } : entry),
      messages: chat.messages.map(entry => messages.includes(entry) ? { ...entry, delivered_at: when } : entry),
    });
    return resumePrompt({ answered, messages });
  }
  /** Claimed synchronously: one resume per parked session, whatever arrives first. */
  function resumeParked(id) {
    if (tasks.has(id) || !dataOf(id).parked) return false;
    const prompt = takeResume(id);
    if (!prompt) return false;
    const controller = new AbortController();
    tasks.set(id, { controller, promise: null, send: null, accepting: true });
    tasks.get(id).promise = build(id, controller, prompt);
    return true;
  }
  async function answer(id, question_id, answers) {
    const d = dataOf(id), chat = readChat(id);
    const entry = chat.questions.find(item => item.id === question_id);
    if (!entry) throw new Error("unknown-question");
    if (entry.answers) {
      if (JSON.stringify(normalizeAnswers(entry, answers).answers) === JSON.stringify(entry.answers)) return { ok: true, replayed: true };
      throw new Error("question-already-answered");
    }
    if (entry.closed_at || !answerable(id, d)) throw new Error("question-closed");
    const normalized = normalizeAnswers(entry, answers);
    if (!normalized.ok) throw new Error(normalized.reason);
    writeChat(id, { ...chat, questions: chat.questions.map(item => item.id === question_id ? { ...item, answers: normalized.answers, answered_at: at() } : item) });
    event(id, "Owner answered");
    // A session still winding down picks the answer up when it parks.
    resumeParked(id);
    return { ok: true };
  }
  /** DLV-165: an owner message reaches a running session at its next step, or resumes a parked one. */
  async function message(id, text) {
    const checked = normalizeMessage(text);
    if (!checked.ok) throw new Error(checked.reason);
    const d = dataOf(id), row = s().getRun(id), task = tasks.get(id);
    const parked = !!d.parked && !task;
    if (row.lifecycle === "CLOSED" || !["preparing", "building"].includes(d.phase) || !(task?.accepting || parked)) throw new Error("session-not-taking-messages");
    const chat = readChat(id);
    const entry = { id: randomUUID(), at: at(), text: checked.text, delivered_at: null };
    // Writing instead of answering leaves the open question unanswered.
    writeChat(id, {
      questions: parked ? chat.questions.map(item => item.answers || item.closed_at ? item : { ...item, closed_at: entry.at }) : chat.questions,
      messages: [...chat.messages, entry],
    });
    event(id, "Owner message");
    if (!task?.send?.({ type: "message", id: entry.id, text: entry.text })) resumeParked(id);
    return { ok: true, message_id: entry.id };
  }
  /** Sum each session segment's counters; a resumed session reports only its own. */
  function accumulate(id, observations) {
    const previous = parse(s().getJob(id)?.observations_json)?.usage;
    const next = observations?.usage;
    if (!previous || !next) return observations;
    const usage = { ...next };
    for (const field of ["input", "cachedInput", "cacheCreation", "output", "reasoningOutput"]) usage[field] = Number(previous[field] || 0) + Number(next[field] || 0);
    for (const field of ["costUsd", "apiEquivalentUsd"])
      if (previous[field] != null || next[field] != null) usage[field] = Number(previous[field] || 0) + Number(next[field] || 0);
    return { ...observations, usage };
  }

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
      // A parked session has no process by design; it is waiting, not interrupted.
      const parked = !!d.parked && !active && row.lifecycle !== "CLOSED";
      const interrupted = ["preparing", "building", "checking"].includes(d.phase) && !active && !parked;
      const asking = (active || parked) && chatOf(row.run_id, d).questions.some(entry => entry.state === "open");
      return { run_id: row.run_id, engine: "v2", lane: "local", title: d.work.title, alias: d.work.id, file: d.work.file, campaign: d.work.campaign,
        lifecycle: row.lifecycle, closed_outcome: row.closed_outcome, waiting_reason: null, executor: d.settings.executor, model: d.settings.model,
        effort: d.settings.effort, ownerAction: interrupted ? "Interrupted" : asking ? "Question" : d.phase,
        ownerActionKind: asking ? "local-question" : row.lifecycle === "CLOSED" || active ? "none" : d.phase === "uat-ready" ? "local-review" : "inspect-session", active,
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

  async function detail(id, { inspect = false } = {}) {
    const d = dataOf(id);
    let head = null, clean = false, changes = { files: [], risk: d.risk, patch: "" };
    // A history poll must not reread every changed blob. Candidate risk was
    // recorded at build time and is bound to its immutable head. Owner actions
    // request a fresh inspection; failed attempts without a candidate need none.
    if (d.head) try {
      head = await git(d.workspace, "rev-parse", "HEAD");
      clean = !(await git(d.workspace, "status", "--porcelain", "--untracked-files=all"));
      if (inspect && clean && head === d.head) changes = await diff(d, head);
    } catch {
      // History remains readable after worktree loss; action verification fails closed.
      if (inspect) clean = false;
    }
    const handover = d.handover_id ? viewOne({ root, handover_id: d.handover_id, now: at() }) : null;
    const current = clean && head === d.head;
    const reviewed = !!changes.risk && (!changes.risk.required || (d.reviewed_head === head && d.reviewed_risk === sha(JSON.stringify(changes.risk))));
    const signed = handover?.acceptance.state === "accepted" && handover.status === "ready" && handover.blockers.length === 0 && handover.binding?.source_revision === head;
    const job = s().getJob(id);
    const observed = parse(job?.observations_json);
    const task = tasks.get(id), parked = !!d.parked && !task;
    const chat = chatOf(id, d);
    const running = s().getRun(id)?.lifecycle !== "CLOSED" && ["preparing", "building"].includes(d.phase);
    return { ...d, run_id: id, current_head: head, clean, risk: changes.risk, patch: changes.patch, activity: s().listActivity(id), usage: observed?.usage || null,
      handover, questions: chat.questions, messages: chat.messages, parked,
      canMessage: running && (!!task?.accepting || parked),
      canShip: current && reviewed && signed && ["uat-ready", "merging"].includes(d.phase) && d.checks?.every(c => c.exit === 0 && !c.error),
      canUndo: d.phase === "shipped", interrupted: ["preparing", "building", "checking"].includes(d.phase) && !task && !parked };
  }

  /** The private home for the native CLI: subscription credential, config, hooks. Idempotent for resumes. */
  function prepareHome(id, d) {
    // Copy only the selected native subscription credential, never user MCP,
    // provider settings, .env, or server credentials. The private home is runtime-only.
    const login = authenticate(d.settings.executor);
    const privateHome = join(root, ".delivery/local", id, "home");
    const configDir = join(privateHome, d.settings.executor === "claude" ? ".claude" : ".codex");
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    const credentialName = d.settings.executor === "claude" ? ".credentials.json" : "auth.json";
    cpSync(join(login.directory, credentialName), join(configDir, credentialName));
    // DLV-165: Codex has no built-in question tool; ask_owner is our stdio MCP server.
    if (d.settings.executor === "codex") writeFileSync(join(configDir, "config.toml"),
      'forced_login_method = "chatgpt"\ncli_auth_credentials_store = "file"\n' +
      `\n[mcp_servers.era_owner]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(ASK_SERVER)}]\n` +
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
    return { ...env(), HOME: privateHome, USERPROFILE: privateHome,
      ...(d.settings.executor === "claude" ? { CLAUDE_CONFIG_DIR: configDir } : { CODEX_HOME: configDir }),
      GIT_CONFIG_COUNT: "3", GIT_CONFIG_KEY_0: "remote.origin.pushurl", GIT_CONFIG_VALUE_0: "file:///local-delivery-push-disabled",
      GIT_CONFIG_KEY_1: "remote.origin.receivepack", GIT_CONFIG_VALUE_1: "false",
      GIT_CONFIG_KEY_2: "core.hooksPath", GIT_CONFIG_VALUE_2: hooks };
  }

  function instructionFor(d) {
    const checkInstruction = d.settings.executor === "claude" && process.platform === "win32"
      ? "You have no shell. The supervisor runs the checks after you finish."
      : "Finish with checks.";
    // DLV-164/165. Claude asks with AskUserQuestion; Codex with the era_owner ask_owner tool.
    const askInstruction = d.settings.executor === "claude"
      ? " If you are blocked on a decision that is genuinely the owner's, ask with AskUserQuestion: put your recommended option first and end its label with \" (Recommended)\". Otherwise decide with sensible defaults and continue."
      : " If you are blocked on a decision that is genuinely the owner's, call the ask_owner tool: put your recommended option first and end its label with \" (Recommended)\", then end your turn. Otherwise decide with sensible defaults and continue.";
    return `Implement only ${d.work.id}. Read CLAUDE.md and start-task; use the repository skills and hooks. Work only in this worktree. Never push, merge, read the main checkout's secrets or write any database. Do not commit; the supervisor commits your work. Do not ship PM records; the owner ships. ${checkInstruction}${askInstruction} The owner may message you while you work; follow those messages. Write .delivery-handover.json with the UAT schema {summary,scenarios:[{id,title,required:true,steps:[{action,expected}]}]}.\n\n${d.work.brief}`;
  }

  /** `resumeWith` continues a parked session with the owner's answer/messages (DLV-165). */
  async function build(id, controller, resumeWith = null) {
    let d = dataOf(id);
    let failure = { code: "install", step: "Setup", detail: "" };
    let checking = "host checks";
    const task = tasks.get(id);
    try {
      if (!resumeWith) {
        const [bin, launcher] = pnpmCommand();
        event(id, "Installing dependencies");
        const install = prepareDependencies ? await prepareDependencies(d.workspace) : await run(bin,
          [launcher, "install", "--offline", "--frozen-lockfile", "--ignore-scripts"], { cwd: d.workspace, env: env(), timeout: 10 * 60_000 });
        if (install.status !== 0 || install.error || !dependencies(d.workspace)) {
          failure.detail = (install.stderr || install.error?.message || "offline frozen install failed or dependencies do not match the lock").trimEnd().split(/\r?\n/u).slice(-20).join("\n");
          throw new Error(`worktree dependencies unavailable; offline frozen install failed\n${install.stderr || failure.detail}`);
        }
      }
      if (controller.signal.aborted) throw new Error("cancelled");
      failure = { code: "secrets", step: "Setup", detail: "" };
      assertNoLocalSecrets(d.workspace);
      failure = null;
      const childEnv = prepareHome(id, d);
      let prompt = resumeWith, result, observations;
      // One native session, possibly in segments: it parks on a question and
      // resumes with the answer; messages it never saw resume it before checks.
      for (;;) {
        const segment = prompt ? (d.segments || 0) + 1 : 0;
        d = { ...dataOf(id), phase: "building", parked: null, supervisor, ...(prompt ? { segments: segment } : {}) };
        save(id, d); event(id, prompt ? "Session resumed" : "Native session started");
        const jobId = prompt ? `${id}:r${segment}` : id;
        const request = makeJobRequest({ job_id: jobId, run_id: id, backend_id: d.settings.backend_id, contract: { contract_id: id, revision: 1 },
          grant: { grant_id: "local-owner", revision: 1 }, reservation: { unit: "tokens", basis: "subscription-advisory" },
          workspace: { root: d.workspace, access: "write", backing: "git-worktree" }, settings: d.settings,
          instruction: prompt || instructionFor(d) });
        // makeJobRequest carries model/effort; executor is the local dispatch choice.
        if (prompt) s().updateJob(id, { status: "active" }); else s().markDispatchStarted(id, at());
        failure = { code: "native-error", step: "Build", detail: "" };
        try {
          result = await session({
            request: { ...request, settings: d.settings, ...(prompt ? { resume: { dispatch_key: id, native_ref: d.native_ref } } : {}) },
            env: childEnv, signal: controller.signal,
            onActivity: value => s().appendActivity(id, id, [value]),
            onQuestion: value => recordQuestion(id, value),
            onDelivered: ids => markDelivered(id, ids),
            onChannel: send => {
              if (!task) return;
              task.send = send;
              for (const entry of readChat(id).messages.filter(item => !item.delivered_at)) send({ type: "message", id: entry.id, text: entry.text });
            },
          });
        } finally { if (task) task.send = null; }
        observations = accumulate(id, result.observations);
        if (!d.native_ref && result.executionRef?.native_ref) { d = { ...dataOf(id), native_ref: result.executionRef.native_ref }; save(id, d); }
        if (controller.signal.aborted) throw new Error("cancelled");
        if (observations?.nativeOutcome === "parked") {
          prompt = takeResume(id);
          if (prompt) { s().updateJob(id, { observations_json: observations }); continue; }
          if (!d.native_ref) throw new Error("native session failed: parked without a resumable session id");
          if (!readChat(id).questions.some(entry => !entry.answers && !entry.closed_at)) throw new Error("native session failed: parked without a recorded question");
          save(id, { ...dataOf(id), parked: { at: at(), question_id: observations.parked?.id ?? null } });
          s().updateJob(id, { status: "paused", observations_json: observations });
          event(id, "Waiting for owner");
          return;
        }
        if (result.status !== "finished" || observations?.nativeOutcome !== "succeeded") {
          s().updateJob(id, { status: "finished", reservation_open: false, observations_json: observations, outcome: observations?.nativeOutcome });
          s().markAfterJob(id, "done");
          failure.detail = observations?.error || observations?.finalText?.slice(0, 400) || "no reason reported";
          throw new Error(`native session failed: ${failure.detail}`);
        }
        prompt = takeResume(id);
        if (!prompt) break;
        s().updateJob(id, { observations_json: observations });
      }
      if (task) task.accepting = false;
      closeQuestions(id);
      s().updateJob(id, { status: "finished", reservation_open: false, observations_json: observations, outcome: observations?.nativeOutcome });
      s().markAfterJob(id, "done");
      failure = { code: "secrets", step: "Setup", detail: "" };
      assertNoLocalSecrets(d.workspace);
      // Native sandboxes may keep Git's shared administrative directory read-only.
      // The trusted supervisor can commit the stopped worker's material, with the
      // repository hooks, without giving the worker push/merge authority.
      failure = null;
      if (await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) {
        await git(d.workspace, "add", "--all");
        event(id, "Committing candidate");
        const seen = new Set();
        failure = { code: "commit-hook", step: "Seal", detail: "" };
        await gitSlow(d.workspace, hookMs, line => {
          const stage = HOOK_STAGES.get(line.trim());
          if (stage && !seen.has(stage)) { seen.add(stage); event(id, `Hook: ${stage}`); }
        }, "commit", "-m", `Build ${d.work.id}`);
      }
      failure = null;
      const head = await git(d.workspace, "rev-parse", "HEAD");
      if (head === d.base) {
        failure = { code: "no-change", step: "Build", detail: result.observations?.finalText?.slice(0, 400) || "" };
        throw new Error(`candidate needs a change: ${failure.detail || "no reason reported"}`);
      }
      await git(d.workspace, "merge-base", "--is-ancestor", d.base, head);
      const changes = await diff(d, head);
      d = { ...d, phase: "checking", head, risk: changes.risk, checks: [] }; save(id, d); event(id, "Host checks started");
      failure = { code: "checks", step: "Verify", detail: "" };
      const results = await checks({ workspace: d.workspace, env: env(), onStart: name => { checking = name; event(id, `${name} started`); }, onCheck: c => { d.checks.push(c); save(id, d); event(id, `${c.name}: ${c.exit}`); } });
      if (controller.signal.aborted) throw new Error("cancelled");
      d.checks = results;
      failure = null;
      if (head !== await git(d.workspace, "rev-parse", "HEAD") || await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) throw new Error("candidate changed during host checks");
      if (results.length !== 4 || results.some(c => c.exit !== 0 || c.error)) {
        failure = { code: "checks", step: "Verify", detail: "" };
        const failed = results.find(c => c.exit !== 0 || c.error);
        const raw = failed ? [failed.stdout, failed.stderr, failed.error].filter(Boolean).join("\n") || `exit ${failed.exit}` : `expected 4 check results, received ${results.length}`;
        checking = failed?.name || "host checks";
        failure.detail = `${checking}\n${decisiveLines(raw)}`;
        throw new Error(`host checks failed: ${checking}\n${raw}`);
      }
      failure = { code: "handover", step: "Handover", detail: "" };
      const handoverFile = join(d.workspace, ".delivery-handover.json");
      if (!existsSync(handoverFile)) throw new Error("handover incomplete: .delivery-handover.json missing");
      let content;
      try { content = JSON.parse(readFileSync(handoverFile, "utf8")); }
      catch (error) { throw new Error(`handover incomplete: .delivery-handover.json unparsable: ${error.message}`); }
      event(id, "Freezing handover");
      const frozen = freezeHandover({ root, subject: { delivery_ref: `local:${id}`, work_id: d.work.id, campaign: d.work.campaign, title: d.work.title },
        binding: bindDirect({ delivery_ref: `local:${id}`, source_revision: head }), environment: { target: "local", build: head },
        content, source: { kind: "local-supervisor", ref: id }, ready: true, now: at() });
      if (!frozen.ok || frozen.handover.status !== "ready") {
        const problems = frozen.handover?.problems || frozen.refusals || [];
        throw new Error(`handover incomplete: .delivery-handover.json incomplete: ${problems.map(p => [p.code, p.detail, p.scenario, p.step].filter(value => value != null).join(" ")).join("; ") || "not ready"}`);
      }
      d = { ...d, phase: "uat-ready", handover_id: frozen.handover.handover_id }; save(id, d); event(id, "Ready for owner UAT");
    } catch (error) {
      const message = String(error.message);
      if (controller.signal.aborted) failure = { code: "cancelled", step: "—", detail: "—" };
      else if (failure?.code === "commit-hook" && message.startsWith("git commit: timed out")) failure = { code: "commit-timeout", step: "Seal", detail: `timed out after ${hookMs / 1000} s` };
      else if (failure && !failure.detail && failure.code !== "no-change") failure.detail = failure.code === "checks" ? `${checking}\n${decisiveLines(message)}` : failure.code === "commit-hook" ? decisiveLines(message) : failure.code === "handover" ? message.replace(/^handover incomplete: /u, "") : message;
      d = { ...d, phase: controller.signal.aborted ? "cancelled" : "failed", parked: null, error: controller.signal.aborted ? "cancelled" : message, ...(failure ? { failure } : {}) };
      if (task) task.accepting = false;
      closeQuestions(id);
      save(id, d, "CLOSED", d.phase);
      s().updateJob(id, { status: "finished", reservation_open: false, outcome: d.phase }); s().markAfterJob(id, "done");
      event(id, d.error);
    } finally { tasks.delete(id); }
  }

  async function start(input) {
    return locked("start", null, async () => {
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
      const d = { lane: "local", work, settings: settings.settings, supervisor, workspace, base: ready.base, branch, phase: "preparing", checks: [], head: null };
      s().insertRun({ run_id: id, work_id: input.id, contract_id: id, contract_revision: 1, lifecycle: "ACTIVE" });
      save(id, d);
      s().insertJob({ job_id: id, run_id: id, dispatch_key: id, purpose: "start", backend_id: d.settings.backend_id,
        contract_id: id, contract_revision: 1, grant_id: "local-owner", grant_revision: 1,
        reservation: { unit: "tokens", basis: "subscription-advisory" }, settings: d.settings });
      s().updateJob(id, { status: "active" });
      const controller = new AbortController();
      tasks.set(id, { controller, promise: null, send: null, accepting: true });
      tasks.get(id).promise = build(id, controller);
      return { ok: true, run_id: id };
    });
  }

  async function review(id) {
    const view = await detail(id, { inspect: true });
    if (!view.clean || view.current_head !== view.head) throw new Error("candidate-changed");
    const d = dataOf(id);
    save(id, { ...d, reviewed_head: view.current_head, reviewed_risk: sha(JSON.stringify(view.risk)) });
    event(id, "Owner opened diff review");
    return view.patch;
  }

  async function operationHead(ref) {
    const out = await run("git", ["--no-optional-locks", "rev-parse", "--verify", "--quiet", ref], { cwd: root, env: env(), timeout: 30_000 });
    if (out.status === 1 && !out.error) return null;
    if (out.status !== 0 || out.error) throw new Error(`git rev-parse: ${out.stderr || out.error?.message || out.status}`);
    return out.stdout.trim();
  }

  async function cleanAt(head) {
    return await git(root, "symbolic-ref", "--short", "HEAD") === baseBranch &&
      await git(root, "rev-parse", "HEAD") === head &&
      !(await git(root, "status", "--porcelain", "--untracked-files=all"));
  }

  async function ownedShipState(d) {
    if (await git(root, "ls-files", "--others", "--exclude-standard") || await git(root, "ls-files", "--unmerged")) return false;
    // No supervisor PM write changes a mode, renames a path or removes a file.
    if (await git(root, "diff", "--cached", "--summary", "--no-renames", d.head) || await git(root, "diff", "--summary", "--no-renames")) return false;
    const staged = (await git(root, "diff", "--cached", "--name-only", "--no-renames", "-z", d.head)).split("\0").filter(Boolean);
    const unstaged = (await git(root, "diff", "--name-only", "--no-renames", "-z")).split("\0").filter(Boolean);
    const owned = d.ship_owned_files || {};
    if ([...staged, ...unstaged].some(path => !Object.hasOwn(owned, path))) return false;
    for (const [path, hashes] of Object.entries(owned)) {
      const file = await run("git", ["--no-optional-locks", "show", `:${path}`], { cwd: root, env: env(), timeout: 30_000 });
      if (file.status !== 0 || file.error || !hashes.includes(sha(file.stdout)) || !hashes.includes(sha(readFileSync(join(root, path))))) return false;
    }
    return true;
  }

  async function ownedUndoState(d) {
    if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch ||
      await git(root, "rev-parse", "HEAD") !== d.undo_base ||
      await git(root, "diff", "--no-ext-diff", "--no-textconv") ||
      await git(root, "ls-files", "--others", "--exclude-standard")) return false;
    const inverse = await git(root, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "--full-index", d.merge, `${d.merge}^1`);
    const staged = await git(root, "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--cached", "--binary", "--full-index", d.undo_base);
    return !!inverse && staged === inverse;
  }

  async function abortShip(id, d, message) {
    try {
      const merge = await operationHead("MERGE_HEAD");
      if (merge) {
        if (merge !== d.head || await git(root, "rev-parse", "HEAD") !== d.base ||
          await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch) throw new Error("foreign-merge");
        if (!await ownedShipState(d)) throw new Error("foreign-merge-changes");
        await git(root, "merge", "--abort");
      }
      if (!await cleanAt(d.base)) throw new Error("main-not-restored");
      save(id, { ...d, phase: "uat-ready", ship_error: message });
      event(id, "Recovered Ship; main restored");
      return true;
    } catch (error) {
      save(id, { ...d, phase: "merging", ship_error: "merge-abort-failed", ship_error_detail: String(error.message) });
      return false;
    }
  }

  async function abortUndo(id, d, message) {
    try {
      const revert = await operationHead("REVERT_HEAD");
      if (revert) {
        if (revert !== d.merge || await git(root, "rev-parse", "HEAD") !== d.undo_base ||
          await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch) throw new Error("foreign-revert");
        if (!await ownedUndoState(d)) throw new Error("foreign-revert-changes");
        await git(root, "revert", "--abort");
      }
      if (!revert && !await cleanAt(d.undo_base)) {
        // A failed commit-message hook can leave the inverse staged without
        // REVERT_HEAD. Reset only the exact recorded inverse, never owner work.
        if (!await ownedUndoState(d)) throw new Error("foreign-revert-changes");
        await git(root, "reset", "--merge", d.undo_base);
      }
      if (!await cleanAt(d.undo_base)) throw new Error("main-not-restored");
      save(id, { ...d, phase: "shipped", undo_error: message }, "CLOSED", "shipped");
      event(id, "Recovered Undo; main restored");
      return true;
    } catch (error) {
      save(id, { ...d, phase: "shipped", undo_error: "revert-abort-failed", undo_error_detail: String(error.message) }, "CLOSED", "shipped");
      return false;
    }
  }

  async function ship(id) {
    return locked("ship", id, async () => {
      let d = dataOf(id);
      if (d.phase === "shipped") return detail(id);
      if (d.phase === "merging") {
        if (!await abortShip(id, d, "ship-interrupted")) throw new Error("ship-interrupted; inspect main");
        d = dataOf(id);
      }
      if (d.phase !== "push-pending") {
        const v = await detail(id, { inspect: true });
        if (!v.canShip) throw new Error("current-head-uat-checks-and-risk-review-required");
        if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch || await git(root, "status", "--porcelain", "--untracked-files=all")) throw new Error("main-checkout-must-be-clean");
        if (await git(root, "rev-parse", "HEAD") !== d.base) throw new Error("main-advanced; rebuild and repeat UAT");
        const current = selected(d.work.file, d.work.id);
        if (current.row !== d.work.row || current.brief !== d.work.brief) throw new Error("acceptance-changed; repeat delivery");
        if (await git(root, "rev-parse", d.branch) !== d.head) throw new Error("branch-head-changed");
        let candidateTick;
        try { candidateTick = tickById(await git(d.workspace, "show", `${d.head}:${PM}/${d.work.file.replace(/\\/gu, "/")}`), d.work.id); }
        catch { throw new Error("candidate-edits-pm-row"); }
        if (candidateTick.state !== "ticked") throw new Error("candidate-edits-pm-row");
        d = { ...d, phase: "merging", ship_error: null, ship_owned_files: {} }; save(id, d);
        try {
          await gitSlow(root, hookMs, undefined, "merge", "--no-ff", "--no-commit", d.head);
          if (!await ownedShipState(d)) throw new Error("foreign-merge-changes");
          const checklist = join(root, PM, d.work.file);
          const checklistRaw = readFileSync(checklist, "utf8");
          const tick = tickById(checklistRaw, d.work.id);
          if (tick.state !== "ticked") throw new Error("candidate-edits-pm-row");
          const row = parseWorkItems(tick.raw).find(row => row.alias === d.work.id);
          const bookPath = `${PM}/${d.work.book.replace(/\\/gu, "/")}`;
          const bookRaw = readFileSync(join(root, bookPath), "utf8");
          const date = at().slice(0, 10);
          const archivedBook = insertDatedStamp(bookRaw, /^##\s+Shipped Log\s*$/iu, shippedStamp(itemBody(tick.raw.split("\n")[row.line]), date), date, "Shipped Log");
          d = { ...d, ship_owned_files: {
            [`${PM}/${d.work.file.replace(/\\/gu, "/")}`]: [checklistRaw, tick.raw, removeLine(tick.raw, row.line)].map(sha),
            [bookPath]: [bookRaw, archivedBook].map(sha),
          } }; save(id, d);
          writeFileSync(checklist, tick.raw);
          const pm = archiveItem({ pmDir: join(root, PM), repoRoot: root, pmRelFromRoot: PM, file: d.work.file, cbidx: row.cbidx, mode: "ship", date });
          if (!pm.ok) throw new Error("PM trace failed; inspect the uncommitted merge");
          const indexPath = join(root, PM, "_index.md");
          if (existsSync(indexPath)) {
            const raw = readFileSync(indexPath, "utf8"), next = refreshIndex(raw, buildIndexBlock(join(root, PM)));
            d = { ...d, ship_owned_files: { ...d.ship_owned_files, [`${PM}/_index.md`]: [sha(raw), sha(next)] } }; save(id, d);
            writeFileSync(indexPath, next);
          }
          if (!await ownedShipState(d)) throw new Error("foreign-merge-changes");
          await git(root, "add", "--", PM);
          if (!await ownedShipState(d)) throw new Error("foreign-merge-changes");
          await gitSlow(root, hookMs, undefined, "commit", "-m", `Ship ${d.work.id}`);
          d = { ...d, merge: await git(root, "rev-parse", "HEAD"), phase: "push-pending" }; save(id, d);
        } catch (error) {
          await abortShip(id, d, String(error.message));
          throw error;
        }
      }
      if (await git(root, "rev-parse", "HEAD") !== d.merge) throw new Error("ship-head-changed");
      await gitSlow(root, pushMs, undefined, "push", remote, `HEAD:refs/heads/${baseBranch}`);
      save(id, { ...d, phase: "shipped" }, "CLOSED", "shipped"); event(id, "Owner shipped merge");
      return detail(id);
    });
  }

  async function undo(id) {
    return locked("undo", id, async () => {
      let d = dataOf(id);
      if (d.phase === "reverted") return detail(id);
      if (!["shipped", "revert-push-pending"].includes(d.phase)) throw new Error("nothing-to-undo");
      if (d.phase === "shipped" && (await operationHead("REVERT_HEAD") || d.undo_error === "revert-abort-failed")) {
        if (!d.undo_base || !await abortUndo(id, d, "undo-interrupted")) throw new Error("undo-interrupted; inspect main");
        d = dataOf(id);
      }
      if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch || await git(root, "status", "--porcelain", "--untracked-files=all")) throw new Error("main-checkout-must-be-clean");
      if (d.phase === "shipped") {
        const head = await git(root, "rev-parse", "HEAD");
        if (d.undo_base && head !== d.undo_base) throw new Error("undo-interrupted; inspect main");
        d = { ...d, undo_base: head, undo_error: null }; save(id, d, "CLOSED", "shipped");
        try {
          await gitSlow(root, hookMs, undefined, "revert", "--no-edit", "-m", "1", d.merge);
          d = { ...d, revert: await git(root, "rev-parse", "HEAD"), phase: "revert-push-pending" }; save(id, d, "CLOSED", "shipped");
        } catch (error) {
          await abortUndo(id, d, String(error.message));
          throw error;
        }
      }
      if (await git(root, "rev-parse", "HEAD") !== d.revert) throw new Error("revert-head-changed");
      await gitSlow(root, pushMs, undefined, "push", remote, `HEAD:refs/heads/${baseBranch}`);
      save(id, { ...d, phase: "reverted" }, "CLOSED", "reverted"); event(id, "Owner reverted merge");
      return detail(id);
    });
  }
  async function cancel(id) {
    return locked("cancel", id, async () => {
      const task = tasks.get(id);
      if (task) { task.controller.abort(); return { ok: true }; }
      const d = dataOf(id), row = s().getRun(id);
      if (d.phase === "cancelled") return { ok: true };
      // DLV-165: a parked session has no process to stop; close it directly.
      if (d.parked && row.lifecycle !== "CLOSED") {
        closeQuestions(id);
        save(id, { ...d, parked: null, phase: "cancelled", error: "cancelled", failure: { code: "cancelled", step: "—", detail: "—" } }, "CLOSED", "cancelled");
        s().updateJob(id, { status: "finished", reservation_open: false, outcome: "cancelled" });
        s().markAfterJob(id, "done");
        event(id, "Owner cancelled waiting session");
        return { ok: true };
      }
      if (row.lifecycle === "CLOSED" || !["preparing", "building", "checking"].includes(d.phase)) throw new Error("session-not-running-in-this-process");
      if (!Number.isSafeInteger(d.supervisor?.pid) || d.supervisor.pid < 1 || !d.supervisor.instance) throw new Error("supervisor-ownership-unknown; inspect session");
      try { process.kill(d.supervisor.pid, 0); throw new Error("supervisor-still-running; cancel in its process"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
      save(id, { ...d, phase: "cancelled", error: "cancelled", failure: { code: "cancelled", step: "—", detail: "—" } }, "CLOSED", "cancelled");
      s().updateJob(id, { status: "finished", reservation_open: false, outcome: "cancelled" });
      s().markAfterJob(id, "done");
      event(id, "Owner cancelled interrupted attempt");
      return { ok: true };
    });
  }
  return { readiness, start, list, detail, review, ship, undo, cancel, answer, message,
    wait: id => tasks.get(id)?.promise || Promise.resolve(),
  };
}
