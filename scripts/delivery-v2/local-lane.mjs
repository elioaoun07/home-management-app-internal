// DLV-150–153. Local worktree supervision over the existing run/job/activity store.
import { randomUUID, createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
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
import { bindDirect, freezeHandover, validateContent, viewOne } from "./uat.mjs";
import { REGRESSION_INSTRUCTION, REVISION_LIMIT, UAT_CRITERION, acceptanceCriteria, acceptanceInstruction, decideAcceptance,
  findingsOf, isBugItem, parseVerdict, regressionDeclarations, regressionVerdict, revisionPreamble, runRegressions } from "./local-acceptance.mjs";
import { applyCopy, createPublication, obstructedCopyPath, prepareCopy } from "./local-publication.mjs";
import { localMessageBodies, normalizeAnswers, normalizeMessage, normalizeQuestion, projectQuestions, readLedger, resumePrompt, writeLedger } from "./local-questions.mjs";
import { createPreviews } from "./local-preview.mjs";
import { needsRefreshPlan, refreshCandidate, refreshPlan } from "./local-refresh.mjs";
import { createLocalStorage, individualDiscard } from "./local-storage.mjs";
import { fileURLToPath } from "node:url";

const ASK_SERVER = fileURLToPath(new URL("./local-ask-mcp.mjs", import.meta.url));

const parse = value => { try { return JSON.parse(value || "null"); } catch { return null; } };
export const localRecord = run => parse(run?.base_manifest_json)?.lane === "local" ? parse(run.base_manifest_json) : null;
const sha = value => createHash("sha256").update(value).digest("hex");
const at = () => new Date().toISOString();
const PM = "ERA Notes/10 - Project Management";
/** Phases a supervisor task drives; without one they read as interrupted. */
const WORKING_PHASES = ["preparing", "building", "checking", "accepting"];
const trimTail = (value, max = 4000) => typeof value === "string" && value.length > max ? value.slice(-max) : value;
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
 * baseBranch?:string, hasStore?:()=>boolean, catalog?:()=>object|null,
 * limits?:{hookMs?:number, pushMs?:number}, previews?:ReturnType<typeof createPreviews>|null,
 * reviewSession?:typeof nativeLocalSession}} options
 * `reviewSession` runs the read-only acceptance reviewer (DLV-175); it defaults to `session`. */
export function createLocalLane({ root, store, run = runProcess, session = nativeLocalSession, reviewSession = session,
  authenticate = localWorkerSubscription, dependencies = installedDependencies, checks = hostChecks,
  prepareDependencies = null, baseBranch = "main", hasStore = () => true, limits = {},
  catalog = () => { const loaded = loadExecutionPolicy({ root }); return loaded.ok ? loaded.policy.executors.catalog : null; },
  previews = null }) {
  const s = () => typeof store === "function" ? store() : store;
  const tasks = new Map();
  const apps = previews || createPreviews({ root });
  const supervisor = { pid: process.pid, instance: randomUUID() };
  const env = () => localEnvironment();
  const { hookMs = 25 * 60_000, pushMs = 5 * 60_000 } = limits;
  async function git(cwd, ...args) {
    const out = await run("git", ["--no-optional-locks", ...args], { cwd, env: env(), timeout: 30_000 });
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

  function activeCommand(id) {
    try {
      const owner = parse(readFileSync(join(root, ".delivery/local-command.lock/owner.json"), "utf8"));
      if (!owner || owner.run_id !== id || !Number.isSafeInteger(owner.pid) || owner.pid < 1) return null;
      process.kill(owner.pid, 0);
      return owner.action;
    } catch (error) { return error.code === "EPERM" ? "busy" : null; }
  }

  async function buildGit(id, cwd, args, timeout, onStderrLine = undefined) {
    const argv = ["git", "--no-optional-locks", ...args];
    event(id, JSON.stringify(argv));
    const result = await run("git", argv.slice(1), { cwd, env: env(), timeout, onStderrLine });
    const tail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n").trim().slice(-1800);
    event(id, `Git exit ${result.status ?? "unknown"} · ${JSON.stringify(argv)}\n${tail}`);
    if (result.error?.code === "ETIMEDOUT") throw new Error(`git ${args[0]}: timed out after ${timeout / 1000} s`);
    if (result.status !== 0 || result.error) throw new Error(`git ${args[0]}: ${result.stderr || result.error?.message || result.status}`);
  }
  const storage = createLocalStorage({ root, run, env, getRecord: dataOf, rows: list,
    activity: id => s().listActivity(id, 200, true), busy: id => tasks.has(id) && !tasks.get(id).releasing, record: event, stopPreview: id => apps.stop(id) });
  function prepareRunDependencies(id, d) {
    return prepareDependencies ? prepareDependencies(d.workspace) : storage.prepare(id, d, pnpmCommand);
  }
  async function releaseStorage(id, witness, individual) {
    const row = s().getRun(id), d = dataOf(id);
    if (d.cleaned_at) return { run_id: id, cleaned_at: d.cleaned_at };
    const fields = await storage.clean(id, witness, individual);
    const discarded = individualDiscard.has(d.phase) || (d.phase === "shipped" && d.applied && !d.pushed);
    const phase = discarded ? "discarded" : d.phase;
    save(id, { ...d, ...fields, phase, cleanup_outcome: phase }, "CLOSED", discarded ? phase : row.closed_outcome || phase);
    event(id, "Delivery files archived and cleaned");
    return { run_id: id, ...fields };
  }
  async function autoClean(id) {
    try {
      const plan = await storage.preview(id);
      if (plan) await releaseStorage(id, plan.witness, true);
    } catch (error) {
      const row = s().getRun(id);
      save(id, { ...dataOf(id), cleanup_error: String(error.message) }, row.lifecycle, row.closed_outcome);
      event(id, "Cleanup pending: " + error.message);
    }
  }
  async function cleanAfterPush(id, witness) {
    try { await releaseStorage(id, witness, true); }
    catch (error) {
      const row = s().getRun(id);
      save(id, { ...dataOf(id), cleanup_error: String(error.message) }, row.lifecycle, row.closed_outcome);
      event(id, "Pushed; cleanup pending: " + error.message);
    }
  }
  function discard(id, witness) {
    return locked("discard", id, () => releaseStorage(id, witness, true));
  }
  function cleanup(selections) {
    return locked("cleanup", null, async () => {
      const cleaned = [], failed = [];
      for (const { run_id, witness } of selections) {
        try { cleaned.push(await releaseStorage(run_id, witness, false)); }
        catch (error) { failed.push({ run_id, reason: error.message }); }
      }
      return { cleaned, failed };
    });
  }

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

  function visiblePhase(d) {
    if (d.phase === "discarded") return "discarded";
    if (d.pushed && d.cleaned_at) return "cleaned";
    if (d.pushed) return "pushed";
    if (d.committed) return "committed";
    if (d.applied) return "merged";
    return d.phase;
  }
  function list(selectedRows = null) {
    if (!hasStore()) return [];
    return (selectedRows ?? s().listRuns()).filter(localRecord).map(row => {
      const d = localRecord(row);
      const active = tasks.has(row.run_id);
      // A parked session has no process by design; it is waiting, not interrupted.
      const parked = !!d.parked && !active && row.lifecycle !== "CLOSED";
      const interrupted = WORKING_PHASES.includes(d.phase) && !active && !parked;
      const asking = (active || parked) && chatOf(row.run_id, d).questions.some(entry => entry.state === "open");
      return { run_id: row.run_id, engine: "v2", lane: "local", title: d.work.title, alias: d.work.id, file: d.work.file, campaign: d.work.campaign,
        lifecycle: row.lifecycle, closed_outcome: row.closed_outcome, waiting_reason: null, executor: d.settings.executor, model: d.settings.model,
        effort: d.settings.effort, ownerAction: interrupted ? "Interrupted" : asking ? "Question" : d.phase,
        ownerActionKind: asking ? "local-question" : row.lifecycle === "CLOSED" || active ? "none" : d.phase === "uat-ready" ? "local-review"
          : d.phase === "acceptance-paused" ? "local-acceptance" : "inspect-session", active,
        created_at: row.created_at, updated_at: row.updated_at, resources: null, application: null, stage: visiblePhase(d), branch: d.branch };
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

  // A station inspects immutable Git objects, even after a file-copy merge or
  // worktree removal. Opening it must never satisfy the owner's review gate.
  async function comparison(id, expectedHead, path = null, against = "base", expectedSource = null) {
    const d = dataOf(id);
    const revision = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
    if (!revision.test(d.base) || !revision.test(d.head)) throw new Error("No recorded candidate comparison");
    if (expectedHead !== d.head) throw new Error("Candidate changed. Reopen the comparison.");
    const source = against === "repo" ? await git(root, "rev-parse", "HEAD") : d.base;
    if (expectedSource && expectedSource !== source) throw new Error("Repository HEAD changed. Reload the file list.");
    const args = ["--no-optional-locks", "--literal-pathspecs", "-c", "color.ui=false", "diff",
      "--no-ext-diff", "--no-textconv", "--no-renames"];
    if (path === null) args.push("--name-status", "-z");
    else {
      const match = await git(root, "--literal-pathspecs", "diff", "--no-ext-diff", "--no-textconv", "--no-renames",
        "--name-only", "-z", d.base, d.head, "--", path);
      if (match !== path + "\0") throw new Error("File is outside the recorded change");
    }
    // The picker lists only the candidate's own changes. An advanced checkout
    // may contain unrelated commits; those files do not belong to this run.
    args.push(path === null ? d.base : source, d.head, "--");
    if (path !== null) args.push(path);
    const result = await run("git", args, { cwd: root, env: env(), timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error?.code === "ENOBUFS") throw new Error("Comparison exceeds the 4 MB reader limit");
    if (result.status !== 0 || result.error) throw new Error("Recorded Git objects are unavailable");
    if (path !== null) return { base: source, head: d.head, path, patch: result.stdout };
    const fields = result.stdout.split("\0");
    const files = [];
    for (let i = 0; i + 1 < fields.length; i += 2) files.push({ status: fields[i], path: fields[i + 1] });
    return { base: source, head: d.head, files };
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
    const passed = !!d.checks?.length && d.checks.every(c => c.exit === 0 && !c.error);
    let mergePlan = null;
    if ((d.phase === "uat-ready" && current) || needsRefreshPlan(d)) {
      try { mergePlan = await planMerge(d); } catch (error) { mergePlan = { files: [], conflicts: [], branch: null, expected: baseBranch, error: String(error.message) }; }
    }
    const publicationPlan = await publication.plan({...d,run_id:id});
    const cancelCleanupCommands = ["preparing", "building", "checking"].includes(d.phase)
      ? await storage.cleanupCommands(d.workspace, d.branch).catch(() => []) : [];
    const window = s().listActivity(id, 201, true);
    // DLV-175: the owner's decision after a paused acceptance check.
    const revisionLimit = d.revision_limit ?? REVISION_LIMIT, revisionsUsed = (d.revisions || []).length;
    const paused = d.phase === "acceptance-paused" && s().getRun(id)?.lifecycle !== "CLOSED" && !task;
    const acceptanceInterrupted = d.phase === "accepting" && !task && s().getRun(id)?.lifecycle !== "CLOSED";
    return { ...d, phase: visiblePhase(d), publication: publicationPlan, run_id: id, current_head: head, clean, risk: changes.risk, patch: changes.patch,
      revision_limit: revisionLimit, revisions_used: revisionsUsed,
      canRequestChanges: paused && current && revisionsUsed < revisionLimit, canStop: paused,
      canRecheckAcceptance: (paused && !!d.acceptance?.error) || acceptanceInterrupted,
      activity: localMessageBodies(window.slice(-200), observed), earlier_activity: window.length > 200, usage: observed?.usage || null,
      handover, questions: chat.questions, messages: chat.messages, parked, preview: apps.view(id), activeCommand: activeCommand(id), cancelCleanupCommands,
      canMessage: running && (!!task?.accepting || parked),
      canShip: false,
      mergePlan, canMerge: !!d.merge_pending || (d.phase === "uat-ready" && current && reviewed && signed && passed && !!mergePlan && !mergePlan.error && mergePlan.branch === baseBranch
        && mergePlan.files.length > 0 && mergePlan.conflicts.length === 0),
      // A file-copy merge (DLV-167) has no merge commit to revert.
      canUndo: false, interrupted: WORKING_PHASES.includes(d.phase) && !task && !parked };
  }

  // DLV-167. The run started from `main` at d.base (ALPHA); the owner's checkout
  // may since have moved (BETA). Only the session's own files matter.
  const HANDOVER_FILE = ".delivery-handover.json";
  const inside = (base, path) => { const rel = relative(base, resolve(base, path)); return !!rel && !isAbsolute(rel) && !rel.startsWith(".."); };
  async function planMerge(d) {
    const parts = (await git(d.workspace, "diff", "--no-renames", "--name-status", "-z", d.base, d.head)).split("\0").filter(Boolean);
    const files = [];
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const path = parts[i + 1];
      if (path === HANDOVER_FILE) continue;
      if (!inside(root, path)) throw new Error(`unsafe-path ${path}`);
      files.push({ status: parts[i][0], path });
    }
    const branch = await git(root, "symbolic-ref", "--quiet", "--short", "HEAD").catch(() => null);
    const target = await git(root, "rev-parse", "HEAD");
    if (!files.length) return refreshPlan(d, { files, conflicts: [], branch, expected: baseBranch }, target);
    const paths = files.map(file => file.path);
    const committed = new Set((await git(root, "--literal-pathspecs", "diff", "--no-renames", "--name-only", "-z", d.base, target, "--", ...paths)).split("\0").filter(Boolean));
    const uncommitted = (await git(root, "--literal-pathspecs", "status", "--porcelain", "-z", "--no-renames", "--ignored=matching", "--untracked-files=all", "--", ...paths))
      .split("\0").filter(Boolean).map(entry => entry.slice(3).replace(/\/$/u,""));
    const overlaps = (changed, path) => changed === path || changed.startsWith(path + "/") || path.startsWith(changed + "/");
    const conflicts = files.map(({path, status}) => {
      const inHistory = [...committed].some(name => overlaps(name,path));
      const occupied = obstructedCopyPath(root,path) || (status === "A" && !inHistory && existsSync(join(root,path)));
      return {path, committed:inHistory, uncommitted:occupied || uncommitted.some(name => overlaps(name,path))};
    }).filter(file => file.committed || file.uncommitted);
    return refreshPlan(d, { files, conflicts, branch, expected: baseBranch }, target);
  }

  async function refresh(id, expectedBase, expectedHead) {
    return locked("refresh", id, async () => {
      await refreshCandidate({ id, root, d: dataOf(id), expectedBase, expectedHead, git, run, env, save,
        event, planMerge, checks, inspect: diff, stopPreview: key => apps.stop(key), hookMs,
        // DLV-175: a rebased candidate is a new sealed candidate; it passes the check before Handover.
        accept: key => accept(key, null, { readyEvent: "Refreshed candidate ready for owner UAT", source: "refresh" }),
        ensureDeps: async (key, candidate) => {
          assertNoLocalSecrets(candidate.workspace);
          const changed = await git(candidate.workspace, "diff", "--name-only", candidate.refresh.old_base,
            candidate.base, "--", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc");
          if (changed || !dependencies(candidate.workspace)) {
            const install = await prepareRunDependencies(key, candidate);
            if (install.status !== 0 || install.error || !dependencies(candidate.workspace))
              throw new Error("Refreshed dependencies could not be prepared");
          }
        } });
      return detail(id);
    });
  }

  function freezeCandidate(id, d, head) {
    const handoverFile = join(d.workspace, HANDOVER_FILE);
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
    return frozen.handover.handover_id;
  }

  // ---------------------------------------------------------------------------
  // DLV-175. Acceptance Check between Verify and Handover, and owner revisions.
  // ---------------------------------------------------------------------------

  const historyFile = (id, name) => join(root, ".delivery/local-history", id, name);
  const revisionOf = d => d.revision ? (d.revisions || []).find(entry => entry.n === d.revision) || null : null;
  /** Raw Git output (patches keep their bytes and final newline). */
  async function gitRaw(cwd, args, timeout = 60_000) {
    const out = await run("git", ["--no-optional-locks", ...args], { cwd, env: env(), timeout });
    if (out.status !== 0 || out.error) throw new Error(`git ${args[0]}: ${out.stderr || out.error?.message || out.status}`);
    return out.stdout;
  }
  function keepFile(id, name, body) {
    const file = historyFile(id, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    return relative(root, file).replace(/\\/gu, "/");
  }
  const checkSummary = checks => (checks || []).map(check => ({ name: check.name, exit: check.exit, error: check.error ? String(check.error).slice(0, 200) : null }));

  /** Every sealed candidate is kept: its commit, a patch that survives cleanup, checks and verdict. */
  async function recordCandidate(id, d, source) {
    const list = [...(d.candidates || [])];
    const last = list.at(-1);
    if (last?.head === d.head && last.base === d.base) return d;
    const n = list.length + 1;
    let patch = null;
    try { patch = keepFile(id, `candidate-${n}.patch`, await gitRaw(d.workspace, ["diff", "--binary", "--no-ext-diff", "--no-textconv", d.base, d.head])); }
    catch (error) { event(id, "Candidate patch not kept: " + error.message); }
    list.push({ n, head: d.head, base: d.base, sealed_at: at(), source, revision: d.revision ?? null, patch,
      checks: checkSummary(d.checks), acceptance: null, outcome: null });
    return { ...d, candidates: list };
  }
  function withCandidate(d, fields) {
    const list = [...(d.candidates || [])];
    const index = list.findLastIndex(entry => entry.head === d.head);
    if (index < 0) return d;
    list[index] = { ...list[index], ...fields };
    return { ...d, candidates: list };
  }

  /** The independent reviewer: a fresh read-only session with no build context. */
  async function reviewer(id, d, instruction, signal) {
    const childEnv = prepareHome(id, d);
    try {
      const request = makeJobRequest({ job_id: `${id}:accept:${randomUUID().slice(0, 8)}`, run_id: id, purpose: "review", backend_id: d.settings.backend_id,
        contract: { contract_id: id, revision: 1 }, grant: { grant_id: "local-owner", revision: 1 },
        reservation: { unit: "tokens", basis: "subscription-advisory" },
        workspace: { root: d.workspace, access: "read-only", backing: "git-worktree" }, settings: d.settings, instruction });
      return await reviewSession({ request: { ...request, settings: d.settings }, env: childEnv, signal: signal ?? undefined,
        onActivity: () => {}, onQuestion: () => {}, onDelivered: () => {}, onChannel: () => {} });
    } finally {
      try { await storage.removeHome(id); } catch (error) { event(id, "Credential home cleanup pending: " + error.message); }
    }
  }

  async function checkAcceptance(id, d, signal) {
    const head = d.head, started_at = at();
    const criteria = [...acceptanceCriteria(d.work), UAT_CRITERION];
    let content = null, draft;
    const handoverFile = join(d.workspace, HANDOVER_FILE);
    try {
      content = JSON.parse(readFileSync(handoverFile, "utf8"));
      const checked = validateContent(content);
      draft = { ok: checked.ok, problems: [`${HANDOVER_FILE} incomplete`, ...checked.problems.map(p => [p.code, p.detail, p.scenario, p.step].filter(value => value != null).join(" "))] };
    } catch (error) {
      draft = { ok: false, problems: [existsSync(handoverFile) ? `${HANDOVER_FILE} unparsable: ${error.message}` : `${HANDOVER_FILE} missing`] };
    }
    const names = await git(d.workspace, "diff", "--no-renames", "--name-status", "-z", d.base, head);
    const fields = names.split("\0").filter(Boolean), files = [];
    for (let i = 0; i + 1 < fields.length; i += 2) if (fields[i + 1] !== HANDOVER_FILE) files.push({ status: fields[i][0], path: fields[i + 1] });
    const tree = new Set((await git(d.workspace, "ls-tree", "-r", "--name-only", "-z", head)).split("\0").filter(Boolean));
    const { declared, problems } = regressionDeclarations(content, { bug: isBugItem(d.work), exists: path => tree.has(path) });
    const privateDir = join(root, ".delivery/local", id, "regression");
    let ran = [];
    try {
      if (declared.length) event(id, "Regression proof started");
      ran = await runRegressions({ declared, run, env: env(), workspace: d.workspace, base: d.base, head, privateDir, record: line => event(id, line) });
    } finally { rmSync(privateDir, { recursive: true, force: true, maxRetries: 3 }); }
    const regression = ran.map(entry => {
      const verdict = regressionVerdict(entry, entry.base, entry.head);
      const plain = side => ({ status: side.status, message: side.message });
      return { test: entry.test, name: entry.name, expected_failure: entry.expected_failure, files: entry.files,
        base: plain(entry.base), head: plain(entry.head), state: verdict.state, evidence: verdict.evidence };
    });
    if (signal?.aborted) throw new Error("cancelled");
    let verdict = null, reviewerError = null, usage = null;
    try {
      event(id, "Acceptance reviewer started");
      const patch = await gitRaw(d.workspace, ["diff", "--no-ext-diff", "--no-textconv", d.base, head, "--", ".", ":(exclude)" + HANDOVER_FILE]);
      const result = await reviewer(id, d, acceptanceInstruction({ work: d.work, criteria, files, patch, handover: content, regression }), signal);
      const observations = result?.observations || {};
      usage = observations.usage || null;
      if (result?.status !== "finished" || observations.nativeOutcome !== "succeeded")
        reviewerError = "The reviewer did not finish: " + String(observations.error || observations.nativeOutcome || result?.status || "unknown").slice(0, 300);
      else {
        const parsed = parseVerdict(observations.finalText, criteria);
        reviewerError = parsed.error;
        verdict = parsed.verdicts;
      }
    } catch (error) {
      if (signal?.aborted) throw new Error("cancelled");
      reviewerError = "The reviewer could not run: " + String(error.message).slice(0, 300);
    }
    if (signal?.aborted) throw new Error("cancelled");
    const decided = decideAcceptance({ criteria, verdict, reviewerError, draft, regression, regressionProblems: problems });
    return { ...decided, head, base: d.base, started_at, finished_at: at(), regression,
      reviewer: { executor: d.settings.executor, model: d.settings.model ?? null, effort: d.settings.effort ?? null, usage } };
  }

  /** Acceptance Check, then Handover only on an all-met verdict. Never retries. */
  async function accept(id, signal = null, { readyEvent = "Ready for owner UAT", source = "build" } = {}) {
    let d = await recordCandidate(id, { ...dataOf(id), phase: "accepting", acceptance: null, handover_id: null }, source);
    const head = d.head;
    save(id, d); event(id, "Acceptance check started");
    const acceptance = await checkAcceptance(id, d, signal);
    d = dataOf(id);
    if (d.head !== head || head !== await git(d.workspace, "rev-parse", "HEAD") || await git(d.workspace, "status", "--porcelain", "--untracked-files=all"))
      throw new Error("candidate changed during the acceptance check");
    d = withCandidate({ ...d, acceptance }, { acceptance });
    // A revision ends once its candidate has a verdict; a later failure is not that revision's.
    const settled = data => {
      const entry = revisionOf(data);
      return entry ? { ...data, revision: null, revisions: data.revisions.map(item => item.n === entry.n ? { ...item, state: "sealed", to_head: head, finished_at: at() } : item) } : data;
    };
    const { met, missed, unclear } = acceptance.counts;
    if (acceptance.state !== "passed") {
      save(id, settled({ ...d, phase: "acceptance-paused" }));
      event(id, `Acceptance paused · ${missed} missed · ${unclear} unclear`);
      return false;
    }
    save(id, d); event(id, `Acceptance passed · ${met} met`);
    const handover_id = freezeCandidate(id, d, head);
    save(id, settled(withCandidate({ ...dataOf(id), phase: "uat-ready", handover_id }, { outcome: "handed-over", handover_id })));
    event(id, readyEvent);
    return true;
  }

  /** A failed or cancelled revision restores the candidate it started from and pauses again. */
  async function restoreRevision(id, failure, message, cancelled) {
    const d = dataOf(id), entry = revisionOf(d);
    if (!entry) return false;
    const from = entry.previous.head;
    let attempt = null;
    try {
      await git(d.workspace, "add", "--all");
      const patch = await gitRaw(d.workspace, ["diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv", from]);
      if (patch) attempt = keepFile(id, `revision-${entry.n}-attempt.patch`, patch);
    } catch (error) { event(id, "Revision attempt not kept: " + error.message); }
    await git(d.workspace, "reset", "--hard", from);
    await git(d.workspace, "clean", "-fd");
    if (await git(d.workspace, "rev-parse", "HEAD") !== from || await git(d.workspace, "status", "--porcelain", "--untracked-files=all"))
      throw new Error("the previous candidate could not be restored");
    const state = cancelled ? "cancelled" : "failed";
    const revisions = d.revisions.map(item => item.n === entry.n
      ? { ...item, state, finished_at: at(), failure: cancelled ? { code: "cancelled", step: "—", detail: "—" } : failure, error: String(message).slice(0, 2000), attempt_patch: attempt }
      : item);
    const candidates = (d.candidates || []).map(item => item.revision === entry.n && !item.outcome ? { ...item, outcome: state } : item);
    const p = entry.previous;
    save(id, { ...d, phase: "acceptance-paused", head: from, checks: p.checks, risk: p.risk, acceptance: p.acceptance,
      reviewed_head: p.reviewed_head ?? null, reviewed_risk: p.reviewed_risk ?? null, native_ref: p.native_ref ?? null,
      revision: null, revisions, candidates, parked: null, error: null, failure: null, handover_id: null });
    event(id, `Revision ${entry.n} ${state} · restored ${from.slice(0, 12)}`);
    return true;
  }

  /** The owner's explicit request: one revision of the paused candidate, within the original scope.
   * @param {string} id @param {string} expectedHead @param {string} [note] */
  async function requestChanges(id, expectedHead, note = "") {
    return locked("request-changes", id, async () => {
      const d = dataOf(id), row = s().getRun(id);
      if (row.lifecycle === "CLOSED" || d.phase !== "acceptance-paused" || tasks.has(id)) throw new Error("Request changes needs a paused acceptance check");
      if (!expectedHead || d.head !== expectedHead) throw new Error("Candidate changed. Reload the run.");
      const limit = d.revision_limit ?? REVISION_LIMIT, used = (d.revisions || []).length;
      if (used >= limit) throw new Error(`revision-limit-reached: ${used} of ${limit}`);
      const text = String(note ?? "").trim();
      if (text.length > 4000) throw new Error("Notes are limited to 4000 characters");
      const current = selected(d.work.file, d.work.id);
      if (current.brief !== d.work.brief || current.row !== d.work.row) throw new Error("Acceptance changed. Stop this run and start a new one.");
      if (await git(d.workspace, "rev-parse", "HEAD") !== d.head || await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) throw new Error("candidate-changed");
      const n = used + 1;
      const previous = { head: d.head, checks: (d.checks || []).map(check => ({ ...check, stdout: trimTail(check.stdout), stderr: trimTail(check.stderr) })),
        risk: d.risk ?? null, acceptance: d.acceptance ?? null, reviewed_head: d.reviewed_head ?? null, reviewed_risk: d.reviewed_risk ?? null, native_ref: d.native_ref ?? null };
      const entry = { n, requested_at: at(), actor: "owner", from_head: d.head, note: text || null, findings: findingsOf(d.acceptance), state: "building", previous };
      save(id, withCandidate({ ...d, revision_limit: limit, revision: n, revisions: [...(d.revisions || []), entry], phase: "building",
        native_ref: null, parked: null, error: null, failure: null, handover_id: null }, { outcome: "revision-requested", revision_requested: n }));
      event(id, `Owner requested changes · revision ${n} of ${limit}`);
      const controller = new AbortController();
      tasks.set(id, { controller, promise: null, send: null, accepting: true });
      tasks.get(id).promise = build(id, controller);
      return { ok: true, run_id: id };
    });
  }

  /** Close a paused run without Handover. Candidates and feedback stay recorded.
   * @param {string} id @param {string|null} [expectedHead] */
  async function stopRun(id, expectedHead = null) {
    return locked("stop", id, async () => {
      const d = dataOf(id), row = s().getRun(id);
      if (row.lifecycle === "CLOSED" || d.phase !== "acceptance-paused" || tasks.has(id)) throw new Error("Stop needs a paused acceptance check");
      if (expectedHead && expectedHead !== d.head) throw new Error("Candidate changed. Reload the run.");
      closeQuestions(id);
      save(id, withCandidate({ ...d, phase: "stopped", stopped_at: at(), revision: null }, { outcome: "stopped" }), "CLOSED", "stopped");
      s().updateJob(id, { status: "finished", reservation_open: false }); s().markAfterJob(id, "done");
      event(id, "Owner stopped the run before Handover");
      try { await storage.removeHome(id); } catch (error) { event(id, "Credential home cleanup pending: " + error.message); }
      await autoClean(id);
      return detail(id);
    });
  }

  function assertSupervisorGone(d) {
    if (d.supervisor?.instance === supervisor.instance) return;
    if (!Number.isSafeInteger(d.supervisor?.pid) || d.supervisor.pid < 1 || !d.supervisor.instance) throw new Error("supervisor-ownership-unknown; inspect session");
    try { process.kill(d.supervisor.pid, 0); throw new Error("supervisor-still-running; cancel in its process"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
  }

  /** Owner-started only: an interrupted check, or one whose reviewer could not give a verdict. */
  async function recheckAcceptance(id) {
    return locked("check-acceptance", id, async () => {
      const d = dataOf(id), row = s().getRun(id);
      const interrupted = d.phase === "accepting" && !tasks.has(id);
      const failedReview = d.phase === "acceptance-paused" && !!d.acceptance?.error && !tasks.has(id);
      if (row.lifecycle === "CLOSED" || !(interrupted || failedReview)) throw new Error("Check again needs an interrupted or failed acceptance check");
      if (interrupted) assertSupervisorGone(d);
      if (await git(d.workspace, "rev-parse", "HEAD") !== d.head || await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) throw new Error("candidate-changed");
      const prior = d.acceptance ?? null;
      save(id, { ...d, supervisor }); event(id, "Owner asked to check acceptance again");
      const controller = new AbortController();
      tasks.set(id, { controller, promise: null, send: null, accepting: false });
      tasks.get(id).promise = (async () => {
        try { await accept(id, controller.signal); }
        catch (error) {
          const cancelled = controller.signal.aborted;
          const acceptance = cancelled ? prior : { ...(prior || { criteria: [], counts: { met: 0, missed: 0, unclear: 0 }, regression: [] }),
            state: "paused", error: String(error.message).slice(0, 600) };
          save(id, { ...dataOf(id), phase: "acceptance-paused", acceptance });
          event(id, cancelled ? "Acceptance check cancelled" : "Acceptance check failed: " + error.message);
        } finally { tasks.delete(id); }
      })();
      return { ok: true, run_id: id };
    });
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
    const bug = isBugItem(d.work);
    const instruction = `Implement only ${d.work.id}. Read CLAUDE.md and start-task; use the repository skills and hooks. Work only in this worktree. Never push, merge, read the main checkout's secrets or write any database. Do not commit; the supervisor commits your work. Do not ship PM records; the owner ships. ${checkInstruction}${askInstruction} The owner may message you while you work; follow those messages. Write .delivery-handover.json with the UAT schema {summary,scenarios:[{id,title,required:true,steps:[{action,expected}]}]}. An independent acceptance check compares your candidate and its UAT steps with every Outcome, Acceptance and Comment line below before the owner sees it.${bug ? REGRESSION_INSTRUCTION : ""}\n\n${d.work.brief}`;
    // DLV-175: a revision keeps the original instruction and scope, with the findings first.
    const revision = revisionOf(d);
    return revision ? revisionPreamble({ work: d.work, n: revision.n, limit: d.revision_limit ?? REVISION_LIMIT, fromHead: revision.from_head,
      findings: revision.findings, note: revision.note, regressionAsked: bug }) + instruction : instruction;
  }

  /** `resumeWith` continues a parked session with the owner's answer/messages (DLV-165).
   * With `d.revision` set, it builds the owner's requested revision on the sealed candidate (DLV-175). */
  async function build(id, controller, resumeWith = null) {
    let d = dataOf(id);
    const revising = revisionOf(d);
    let failure = { code: "install", step: "Setup", detail: "" };
    let checking = "host checks";
    const task = tasks.get(id);
    try {
      if (!resumeWith && !revising) {
        event(id, "Installing dependencies");
        const install = await prepareRunDependencies(id, d);
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
        const jobId = prompt ? `${id}:r${segment}` : revising ? `${id}:v${revising.n}` : id;
        const request = makeJobRequest({ job_id: jobId, run_id: id, backend_id: d.settings.backend_id, contract: { contract_id: id, revision: 1 },
          grant: { grant_id: "local-owner", revision: 1 }, reservation: { unit: "tokens", basis: "subscription-advisory" },
          workspace: { root: d.workspace, access: "write", backing: "git-worktree" }, settings: d.settings,
          instruction: prompt || instructionFor(d) });
        // makeJobRequest carries model/effort; executor is the local dispatch choice.
        if (prompt) s().updateJob(id, { status: "active" });
        else if (revising) { s().updateJob(id, { status: "active", outcome: null, reservation_open: true }); s().markAfterJob(id, null); }
        else s().markDispatchStarted(id, at());
        failure = { code: "native-error", step: "Build", detail: "" };
        let lastNativeSeq = -1;
        try {
          result = await session({
            request: { ...request, settings: d.settings, ...(prompt ? { resume: { dispatch_key: id, native_ref: d.native_ref } } : {}) },
            env: childEnv, signal: controller.signal,
            onActivity: value => {
              // Native ordinals restart at zero per segment. Preserve stream
              // deduplication while sharing the store sequence with supervisor rows.
              if (Number.isInteger(value.seq) && value.seq <= lastNativeSeq) return;
              s().appendActivity(id, id, [{ ...value, seq: undefined }]);
              if (Number.isInteger(value.seq)) lastNativeSeq = value.seq;
            },
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
      await storage.removeHome(id);
      if (!dependencies(d.workspace) || await git(d.workspace, "diff", "--name-only", d.base, "--", "package.json", "pnpm-lock.yaml")) {
        const install = await prepareRunDependencies(id, d);
        if (install.status !== 0 || !dependencies(d.workspace)) throw new Error("updated dependency installation failed");
      }
      s().updateJob(id, { status: "finished", reservation_open: false, observations_json: observations, outcome: observations?.nativeOutcome });
      s().markAfterJob(id, "done");
      failure = { code: "secrets", step: "Setup", detail: "" };
      assertNoLocalSecrets(d.workspace);
      // Native sandboxes may keep Git's shared administrative directory read-only.
      // The trusted supervisor can commit the stopped worker's material, with the
      // repository hooks, without giving the worker push/merge authority.
      failure = null;
      if (await git(d.workspace, "status", "--porcelain", "--untracked-files=all")) {
        await buildGit(id, d.workspace, ["add", "--all"], 30_000);
        event(id, "Committing candidate");
        const seen = new Set();
        failure = { code: "commit-hook", step: "Seal", detail: "" };
        await buildGit(id, d.workspace, ["commit", "-m", revising ? `Revise ${d.work.id} (revision ${revising.n})` : `Build ${d.work.id}`], hookMs, line => {
          const stage = HOOK_STAGES.get(line.trim());
          if (stage && !seen.has(stage)) { seen.add(stage); event(id, `Hook: ${stage}`); }
        });
      }
      failure = null;
      const head = await git(d.workspace, "rev-parse", "HEAD");
      if (head === (revising ? revising.from_head : d.base)) {
        failure = { code: "no-change", step: "Build", detail: result.observations?.finalText?.slice(0, 400) || "" };
        throw new Error(`candidate needs a change: ${failure.detail || "no reason reported"}`);
      }
      await git(d.workspace, "merge-base", "--is-ancestor", d.base, head);
      if (revising) await git(d.workspace, "merge-base", "--is-ancestor", revising.from_head, head);
      const changes = await diff(d, head);
      d = { ...d, phase: "checking", head, risk: changes.risk, checks: [], reviewed_head: null, reviewed_risk: null }; save(id, d); event(id, "Host checks started");
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
      // DLV-175: Acceptance Check, then Handover only when every criterion is met.
      d = { ...d, checks: results }; save(id, d);
      failure = { code: "handover", step: "Handover", detail: "" };
      await accept(id, controller.signal, { source: revising ? "revision" : "build" });
    } catch (error) {
      const message = String(error.message);
      if (controller.signal.aborted) failure = { code: "cancelled", step: "—", detail: "—" };
      else if (failure?.code === "commit-hook" && message.startsWith("git commit: timed out")) failure = { code: "commit-timeout", step: "Seal", detail: `timed out after ${hookMs / 1000} s` };
      else if (failure && !failure.detail && failure.code !== "no-change") failure.detail = failure.code === "checks" ? `${checking}\n${decisiveLines(message)}` : failure.code === "commit-hook" ? decisiveLines(message) : failure.code === "handover" ? message.replace(/^handover incomplete: /u, "") : message;
      // DLV-175: a revision that fails or is cancelled restores the candidate it started from.
      if (revising && revisionOf(dataOf(id))) {
        try {
          if (task) task.accepting = false;
          closeQuestions(id);
          s().updateJob(id, { status: "finished", reservation_open: false, outcome: controller.signal.aborted ? "cancelled" : "failed" }); s().markAfterJob(id, "done");
          try { await storage.removeHome(id); } catch (cleanup) { event(id, "Credential home cleanup pending: " + cleanup.message); }
          if (await restoreRevision(id, failure, message, controller.signal.aborted)) return;
        } catch (restore) { event(id, "Revision restore failed: " + restore.message); }
      }
      d = { ...dataOf(id), phase: controller.signal.aborted ? "cancelled" : "failed", parked: null, error: controller.signal.aborted ? "cancelled" : message, ...(failure ? { failure } : {}) };
      if (task) task.accepting = false;
      closeQuestions(id);
      save(id, d, "CLOSED", d.phase);
      s().updateJob(id, { status: "finished", reservation_open: false, outcome: d.phase }); s().markAfterJob(id, "done");
      event(id, d.error);
    } finally {
      try {
        if (["failed", "cancelled"].includes(dataOf(id).phase)) {
          if (task) task.releasing = true;
          try { await storage.removeHome(id); } catch (error) { event(id, "Credential home cleanup pending: " + error.message); }
          try { await locked("cleanup", id, () => autoClean(id)); }
          catch (error) { event(id, "Cleanup pending: " + error.message); }
        }
      } finally { tasks.delete(id); }
    }
  }

  async function startPlan(input) {
    const work = selected(input.file, input.id);
    const base = await git(root, "rev-parse", "--verify", `refs/heads/${baseBranch}`);
    const nonce = input.start_nonce || randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(nonce)) throw new Error("Invalid Start preview");
    const previous = list().some(row => row.alias === work.id && row.file === work.file);
    const suffix = previous ? `${work.id}-${nonce}` : work.id;
    const workspace = join(dirname(root), `${root.split(/[/\\]/u).at(-1)}-delivery`, suffix);
    const branch = `delivery/${suffix}`;
    const commands = [
      ["git", "--no-optional-locks", "worktree", "add", "-b", branch, workspace, base],
      ["git", "--no-optional-locks", "add", "--all"],
      ["git", "--no-optional-locks", "commit", "-m", `Build ${work.id}`],
    ];
    const cleanupCommands = await storage.cleanupCommands(workspace, branch);
    return { start_nonce: nonce, token: sha(JSON.stringify([commands, cleanupCommands])), commands, cleanupCommands, workspace, branch, base };
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
      const plan = await startPlan(input);
      if ((input.requirePreview || input.preview_id) && plan.token !== input.preview_id) throw new Error("Start preview changed. Reload the launch page.");
      if (plan.base !== ready.base) throw new Error("Main changed. Refresh the Start preview.");
      const id = "local-" + plan.start_nonce;
      storage.checkCapacity();
      // Each retry gets a new branch and a separate archive.
      const { workspace, branch } = plan;
      if (existsSync(workspace)) throw new Error("worktree-already-exists; inspect the previous attempt");
      const d = { lane: "local", work, settings: settings.settings, supervisor, workspace, base: ready.base, branch, phase: "preparing", checks: [], head: null };
      s().insertRun({ run_id: id, work_id: input.id, contract_id: id, contract_revision: 1, lifecycle: "ACTIVE" });
      save(id, d);
      s().insertJob({ job_id: id, run_id: id, dispatch_key: id, purpose: "start", backend_id: d.settings.backend_id,
        contract_id: id, contract_revision: 1, grant_id: "local-owner", grant_revision: 1,
        reservation: { unit: "tokens", basis: "subscription-advisory" }, settings: d.settings });
      s().updateJob(id, { status: "active" });
      try { await buildGit(id, root, plan.commands[0].slice(2), 30_000); }
      catch (error) {
        save(id, { ...d, phase: "failed", error: error.message }, "CLOSED", "failed");
        s().updateJob(id, { status: "finished", reservation_open: false, outcome: "failed" });
        s().markAfterJob(id, "done");
        throw error;
      }
      const controller = new AbortController();
      tasks.set(id, { controller, promise: null, send: null, accepting: true });
      tasks.get(id).promise = build(id, controller);
      return { ok: true, run_id: id };
    });
  }

  async function review(id, expectedHead = null) {
    return locked("review", id, async () => {
      const d = dataOf(id);
      if (expectedHead && d.head !== expectedHead) throw new Error("Candidate changed. Reopen the comparison.");
      if (d.phase !== "uat-ready" || d.merge_pending || s().getRun(id)?.lifecycle === "CLOSED") throw new Error("Review needs a candidate ready to test");
      const view = await detail(id, { inspect: true });
      if (!view.clean || view.current_head !== view.head) throw new Error("candidate-changed");
      save(id, { ...d, reviewed_head: view.current_head, reviewed_risk: sha(JSON.stringify(view.risk)) });
      event(id, "Owner opened diff review");
      return view.patch;
    });
  }

  /** DLV-166: serve the candidate for owner UAT from its own worktree. Not
   * locked: it never touches Git or the main checkout, and Ship may take minutes. */
  async function preview(id) {
    const d = dataOf(id);
    if (s().getRun(id)?.lifecycle === "CLOSED" || d.phase !== "uat-ready") throw new Error("preview-needs-a-candidate-ready-for-test");
    const view = await detail(id);
    if (!view.clean || view.current_head !== d.head) throw new Error("candidate-changed");
    const was = apps.view(id)?.state;
    await apps.start(id, { workspace: d.workspace });
    if (was !== "starting" && was !== "ready") event(id, "Owner started the app");
    return detail(id);
  }

  async function stopPreview(id) {
    dataOf(id);
    const was = apps.view(id)?.state;
    apps.stop(id);
    if (was === "starting" || was === "ready") event(id, "Owner stopped the app");
    return detail(id);
  }

  async function merge(id) {
    return locked("merge", id, async () => {
      let d = dataOf(id);
      if (d.applied) return detail(id);
      if (!d.merge_pending) {
        const view = await detail(id, { inspect: true });
        const plan = view.mergePlan;
        if (plan?.conflicts?.length) throw new Error("changed-in-your-repo: " + plan.conflicts.map(c => c.path).join(", "));
        if (plan && plan.branch !== baseBranch) throw new Error("checkout-" + baseBranch + "-first");
        if (!view.canMerge) throw new Error(plan?.error || "merge-needs-passed-checks-sign-off-and-review");
        const current = selected(d.work.file, d.work.id);
        if (current.brief !== d.work.brief || current.row !== d.work.row) throw new Error("Acceptance changed. Review the current item.");
        const pending = await prepareCopy(root, d, plan, id, git);
        d = { ...d, merge_pending:pending }; save(id,d);
      }
      if (await git(root, "symbolic-ref", "--short", "HEAD") !== baseBranch || await git(root,"rev-parse","HEAD") !== d.merge_pending.main_head) throw new Error("Checkout moved during Merge");
      applyCopy(root, id, d.merge_pending);
      const applied = {...d.merge_pending, at:at(), pm_error:null};
      save(id,{...d,merge_pending:null,applied,phase:"merged"});
      event(id, "Owner merged " + applied.files.length + " file" + (applied.files.length === 1 ? "" : "s") + " into the main checkout");
      apps.stop(id);
      return detail(id);
    });
  }

  const publication = createPublication({root, git, run, env, dataOf, save, event, hookMs, pushMs,
    cleanupPreview: id => storage.previewAfterPush(id).catch(() => null)});
  const pushSettings = publication.pushSettings;
  const inspectPushDestination = publication.inspectPushDestination;
  /** @param {string} [expectedUrl] */
  const configurePush = (expectedUrl = undefined) => locked("configure-push", null, () => publication.configurePush(expectedUrl));
  const commit = (id, token) => locked("commit", id, async () => {
    await publication.publish(id, "commit", token);
    return detail(id);
  });
  const push = (id, token) => locked("push", id, async () => {
    const witness = await publication.publish(id, "push", token);
    if (!dataOf(id).cleaned_at) await cleanAfterPush(id, witness);
    return detail(id);
  });
  async function ship() { throw new Error("Ship retired. Use Merge, Commit and Push."); }
  async function undo() { throw new Error("Undo retired. Review the run in your checkout."); }
  async function cancel(id) {
    return locked("cancel", id, async () => {
      const task = tasks.get(id);
      if (task) { task.controller.abort(); return { ok: true }; }
      const d = dataOf(id), row = s().getRun(id);
      if (d.phase === "cancelled") return { ok: true };
      // DLV-175: stopping a revision returns to the candidate it started from.
      const restore = async () => {
        closeQuestions(id);
        s().updateJob(id, { status: "finished", reservation_open: false, outcome: "cancelled" }); s().markAfterJob(id, "done");
        try { await storage.removeHome(id); } catch (error) { event(id, "Credential home cleanup pending: " + error.message); }
        await restoreRevision(id, { code: "cancelled", step: "—", detail: "—" }, "cancelled", true);
        return { ok: true };
      };
      // DLV-165: a parked session has no process to stop; close it directly.
      if (d.parked && row.lifecycle !== "CLOSED" && revisionOf(d)) return restore();
      if (d.parked && row.lifecycle !== "CLOSED") {
        closeQuestions(id);
        save(id, { ...d, parked: null, phase: "cancelled", error: "cancelled", failure: { code: "cancelled", step: "—", detail: "—" } }, "CLOSED", "cancelled");
        s().updateJob(id, { status: "finished", reservation_open: false, outcome: "cancelled" });
        s().markAfterJob(id, "done");
        event(id, "Owner cancelled waiting session");
        await storage.removeHome(id);
        await autoClean(id);
        return { ok: true };
      }
      if (row.lifecycle === "CLOSED" || !WORKING_PHASES.includes(d.phase)) throw new Error("session-not-running-in-this-process");
      if (!Number.isSafeInteger(d.supervisor?.pid) || d.supervisor.pid < 1 || !d.supervisor.instance) throw new Error("supervisor-ownership-unknown; inspect session");
      try { process.kill(d.supervisor.pid, 0); throw new Error("supervisor-still-running; cancel in its process"); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
      if (revisionOf(d)) return restore();
      save(id, { ...d, phase: "cancelled", error: "cancelled", failure: { code: "cancelled", step: "—", detail: "—" } }, "CLOSED", "cancelled");
      s().updateJob(id, { status: "finished", reservation_open: false, outcome: "cancelled" });
      s().markAfterJob(id, "done");
      event(id, "Owner cancelled interrupted attempt");
      await storage.removeHome(id);
      await autoClean(id);
      return { ok: true };
    });
  }
  return { readiness, startPlan, start, list, detail, comparison, refresh, review, preview, stopPreview, merge, ship, undo, cancel, answer, message,
    commit, push, pushSettings, configurePush, inspectPushDestination, requestChanges, stop: stopRun, recheckAcceptance,
    storage: options => storage.view(options), discard, cleanup,
    earlierActivity(id, before) {
      dataOf(id);
      const rows = s().earlierLocalActivity(id, before);
      return { activity: localMessageBodies(rows.slice(-30), parse(s().getJob(id)?.observations_json)), more: rows.length > 30 };
    },
    isWorking: () => tasks.size > 0,
    wait: id => tasks.get(id)?.promise || Promise.resolve(),
  };
}
