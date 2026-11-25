// scripts/pm/drive-publish.mjs
// One-way publisher: the repository's PM state -> a Google Drive folder that
// ERA Steward (Dot) can read without waking a coding agent.
//
//   01 - PM Documentation   selected PM + delivery documents (allowlist, secret-scanned)
//   02 - Delivery Status    status.json + status.md, rewritten only when the state changes
//   03 - Steward Proposals  Dot's folder. Created if missing, never written to, never read back.
//   04 - ERA Notes          the whole ERA Notes vault, same folder tree (dot-folders such as
//                           .obsidian and .pm stay local), secret-scanned like the documents
//   05 - Session Review     temporary Local run evidence from its recorded checks and Git revisions
//
// Local PM stays authoritative: nothing here reads the Drive folder into the
// repository. A Drive-side edit to a published file is overwritten on the next
// publish, after the edited copy is kept under `03 - Steward Proposals/Drive edits/`.
//
// No model, network or Delivery call. Delivery state is read from the supervisor
// store through read-only methods (see STORE_READS); the publisher cannot start,
// approve, apply or settle anything.
//
//   - Drive unavailable (folder missing, I/O error, hang): the pass fails closed,
//     keeps local state, and retries with backoff. Callers never see an exception.
//   - One pass at a time; a pass that makes no progress for `timeoutMs` is abandoned, so a
//     hung Drive call cannot pile up threads while a long first copy still completes.

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { promises as nodeFsp } from "node:fs";
import { dirname, join } from "node:path";

import { attentionItems } from "./relay-shared.mjs";
import { findSecrets } from "./relay.mjs";
import { bindLocalUat, localDriveStatus, localHandoverRun } from "./drive-local-status.mjs";
import { createSessionReviewSync, REVIEW_FOLDER } from "./drive-session-review.mjs";

export const DEFAULT_DRIVE_ROOT = "G:\\My Drive\\ERA PM Command Center";
export const FOLDERS = Object.freeze({
  docs: "01 - PM Documentation",
  status: "02 - Delivery Status",
  proposals: "03 - Steward Proposals",
  vault: "04 - ERA Notes",
  review: REVIEW_FOLDER,
});
/** How vault paths are reported (wrote / pruned / skipped / Drive edits); never a Drive path. */
export const VAULT_LABEL = "ERA Notes/";
export const DRIVE_EDITS_DIR = "Drive edits";
export const STATUS_SCHEMA = "era-pm-drive/status@1";

/** Every store method the status reader may call. Anything else is a bug. */
export const STORE_READS = Object.freeze(["listRuns", "getContract", "listJobs", "listPlans", "listQuestions", "latestResult", "listApplications"]);

const MAX_DOC_BYTES = 2_000_000;
// The vault carries plan images and the generated _dashboard.html (~11 MB).
const MAX_VAULT_BYTES = 25_000_000;
const HEARTBEAT_MS = 5 * 60_000;
const RUNS_LISTED = 20;
const PM_ROOT_FILES = new Set(["_index.md", "_Conventions.md", "_Decisions.md", "0 - Inbox.md"]);
const PM_CAMPAIGN_FILE = /^(?:4 - Checklist|.+ \u2014 Master Book)\.md$/u;
const PM_SUBDIRS_ALL_MD = new Set(["Plans", "Research"]);
const DOCS_FILE = /^(?:Delivery-|ERA-Steward-|R44-)[^/]*\.md$/iu;

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const readDirSafe = (abs) => {
  try {
    return readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Selection: an allowlist. New file kinds are opt-in.
// ---------------------------------------------------------------------------

/**
 * @param {{pmDir:string, docsDir?:string|null}} input
 * @returns {{abs:string, dest:string}[]} dest is relative to the "01 - PM Documentation" folder, forward slashes
 */
export function selectDocuments({ pmDir, docsDir = null }) {
  const out = [];
  for (const entry of readDirSafe(pmDir)) {
    if (entry.isFile() && PM_ROOT_FILES.has(entry.name)) out.push({ abs: join(pmDir, entry.name), dest: "PM/" + entry.name });
    // `_Archive`, `_Templates`, `.pm` and any other underscore/dot folder stay local.
    if (!entry.isDirectory() || /^[_.]/u.test(entry.name)) continue;
    for (const file of readDirSafe(join(pmDir, entry.name))) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const wanted = PM_SUBDIRS_ALL_MD.has(entry.name) || PM_CAMPAIGN_FILE.test(file.name);
      if (wanted) out.push({ abs: join(pmDir, entry.name, file.name), dest: "PM/" + entry.name + "/" + file.name });
    }
  }
  if (docsDir) {
    for (const file of readDirSafe(docsDir)) {
      if (file.isFile() && DOCS_FILE.test(file.name)) out.push({ abs: join(docsDir, file.name), dest: "Docs/" + file.name });
    }
  }
  return out.sort(byDest);
}

const byDest = (a, b) => (a.dest < b.dest ? -1 : a.dest > b.dest ? 1 : 0); // code-unit order: same on every machine

/**
 * Every file in the ERA Notes vault, keeping its folder tree. Names starting with "." (.obsidian
 * editor state, the PM .pm machine state) stay local at any depth.
 *
 * @param {{vaultDir:string}} input
 * @returns {{abs:string, dest:string}[]} dest is relative to the "04 - ERA Notes" folder, forward slashes
 */
export function selectVault({ vaultDir }) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readDirSafe(dir)) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) walk(join(dir, entry.name), prefix + entry.name + "/");
      else if (entry.isFile()) out.push({ abs: join(dir, entry.name), dest: prefix + entry.name });
    }
  };
  walk(vaultDir, "");
  return out.sort(byDest);
}

/**
 * Read the selection from disk; files with credential shapes or an unreasonable size are
 * reported (never their contents) and left out, which also removes them from Drive.
 *
 * @param {{abs:string, dest:string}[]} selection
 * @param {Record<string, string|undefined>} [env]
 * @param {{maxBytes?:number, label?:string}} [options] label prefixes the reported path
 * @returns {{files:{dest:string, buffer:Buffer, hash:string}[], skipped:{path:string, reason:string}[]}}
 */
export function loadDocuments(selection, env = process.env, { maxBytes = MAX_DOC_BYTES, label = "" } = {}) {
  const files = [];
  const skipped = [];
  for (const { abs, dest: rel } of selection) {
    const dest = label + rel;
    try {
      const buffer = readFileSync(abs);
      if (buffer.length > maxBytes) {
        skipped.push({ path: dest, reason: "too-large" });
        continue;
      }
      const hits = findSecrets(buffer.toString("utf8"), env);
      if (hits.length) {
        skipped.push({ path: dest, reason: "secret:" + hits.join(",") });
        continue;
      }
      files.push({ dest: rel, buffer, hash: sha(buffer) });
    } catch (error) {
      skipped.push({ path: dest, reason: "unreadable:" + String(error?.code || error?.message || error) });
    }
  }
  return { files, skipped };
}

// ---------------------------------------------------------------------------
// Delivery status: pure projection of read-only store rows.
// ---------------------------------------------------------------------------

const parse = (text, fallback = null) => {
  try {
    return JSON.parse(String(text));
  } catch {
    return fallback;
  }
};
const countBy = (rows, key) => rows.reduce((acc, row) => ((acc[String(row[key])] = (acc[String(row[key])] || 0) + 1), acc), {});

/**
 * @param {Record<string, Function>} store  only STORE_READS are called
 * @param {{requests?:any[], limit?:number, localSummaries?:(rows:any[])=>any[]}} [options]
 */
export function readDeliveryFromStore(store, { requests = [], limit = RUNS_LISTED, localSummaries } = {}) {
  try {
    const rows = store.listRuns();
    const chosen = [...rows.filter((row) => row.lifecycle !== "CLOSED"), ...rows.filter((row) => row.lifecycle === "CLOSED").slice(0, limit)];
    const summaries = new Map((localSummaries?.(chosen) || []).map(row => [row.run_id, row]));
    const runs = chosen.map((run) => runStatus(store, run, summaries.get(run.run_id)));
    return { available: true, runs, requests: requests.map(requestStatus) };
  } catch (error) {
    return { available: false, reason: String(error?.message || error).slice(0, 200), runs: [], requests: [] };
  }
}

function requestStatus(request) {
  return {
    command_id: request.command_id ?? null,
    workId: request.workId ?? null,
    status: request.status ?? null,
    stage: request.stage ?? null,
    run_id: request.run_id ?? null,
    lastConfirmedAt: request.lastConfirmedAt ?? null,
    blocker: request.blocker ? { code: String(request.blocker.code || "unknown") } : null,
  };
}

function runStatus(store, run, live) {
  const run_id = String(run.run_id);
  const jobs = store.listJobs(run_id);
  const jobCounts = { total: jobs.length, byStatus: countBy(jobs, "status") };
  const record = parse(run.base_manifest_json);
  if (record?.lane === "local") return localDriveStatus({ run, record, live, jobs: jobCounts, reviewFolder: FOLDERS.review });
  const plans = store.listPlans(run_id);
  const questions = store.listQuestions(run_id);
  const resultRow = store.latestResult(run_id);
  const result = resultRow ? parse(resultRow.record_json, {}) : null;
  const applications = store.listApplications(run_id);
  const application = applications.length ? applications[applications.length - 1] : null;
  const contract = run.contract_id != null ? store.getContract(run.contract_id, run.contract_revision) : null;
  const closed = run.lifecycle === "CLOSED";
  const plan = plans.length ? plans[plans.length - 1] : null;
  const criteria = (result?.criterion_states || []).map((entry) => ({ criterion_id: String(entry.criterion_id), state: String(entry.state) }));
  const unknownJobs = jobs.filter((job) => job.status === "unknown");
  const openQuestions = closed ? [] : questions.filter((q) => q.status === "open" && q.blocking);

  const blockers = [];
  for (const q of openQuestions) blockers.push({ kind: "question", ref: String(q.question_id) });
  for (const job of unknownJobs) blockers.push({ kind: "unknown-job", ref: String(job.job_id) });
  if (!closed && run.waiting_reason) blockers.push({ kind: "waiting", ref: String(run.waiting_reason) });
  if (application && ["conflict", "checks-failed", "checks-inconclusive", "interrupted"].includes(String(application.state))) {
    blockers.push({ kind: "application", ref: String(application.application_id) + ":" + String(application.state) });
  }

  // The same projection the phone relay uses for its attention list; the label is a mirrored
  // subset of the journey's owner action, so the run link stays the authority.
  let ownerAction = {};
  if (unknownJobs.length) ownerAction = { kind: "reconcile", label: "Reconcile" };
  else if (closed && run.closed_outcome === "verified_candidate" && !application) ownerAction = { kind: "apply", label: "Apply" };
  const items = attentionItems([
    {
      summary: { run_id, title: contract?.outcome || run_id, updated_at: String(run.updated_at) },
      detail: {
        ok: true,
        run: { lifecycle: String(run.lifecycle) },
        plans: plans.map((p) => ({ plan_id: p.plan_id, revision: p.revision, status: p.status })),
        questions: openQuestions,
        jobs: jobs.map((job) => ({ job_id: job.job_id, status: job.status })),
        result: resultRow && ownerAction.kind === "apply" ? { result_id: String(resultRow.result_id), result_version: Number(resultRow.result_version) } : null,
        applications: application?.state === "applied" ? [] : applications.map((a) => ({ application_id: a.application_id, state: a.state })),
        ownerAction,
      },
    },
  ]);

  return {
    run_id,
    work_id: String(run.work_id),
    title: String(contract?.outcome || run_id),
    phase: closed ? "CLOSED/" + String(run.closed_outcome || "?") : String(run.lifecycle) + (run.waiting_reason ? " (" + run.waiting_reason + ")" : ""),
    progress: {
      jobs: jobCounts,
      plan: plan ? { revision: Number(plan.revision), status: String(plan.status) } : null,
      criteria: { total: criteria.length, byState: countBy(criteria, "state") },
      application: application ? { application_id: String(application.application_id), state: String(application.state) } : null,
    },
    blockers,
    ownerActions: items.map((item) => ({ key: item.key, kind: item.kind, label: item.label })),
    created_at: String(run.created_at),
    updated_at: String(run.updated_at),
    evidence: {
      result_id: resultRow ? String(resultRow.result_id) : null,
      result_version: resultRow ? Number(resultRow.result_version) : null,
      candidate_verified: result ? Boolean(result.candidateVerified) : null,
      application_id: application ? String(application.application_id) : null,
      link: "/pm/live#/delivery/run/" + encodeURIComponent(run_id),
    },
  };
}

// ---------------------------------------------------------------------------
// Owner testing (R78). The mirror reports recorded UAT facts one way; a Drive edit
// can never sign off, record a result or become feedback.
// ---------------------------------------------------------------------------

export const UAT_DIR = "UAT";
const UAT_LISTED = 120;
const oneLine = (value, max = 160) => String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, max);

/**
 * The status section for the owner's tests. `views` are the projections from
 * scripts/delivery-v2/uat.mjs computed without the live supervisor, so whether a
 * run's candidate has since changed is not checked here (`candidate: "unchecked"`).
 *
 * @param {any[]} views
 */
export function buildUatStatus(views) {
  const counts = { total: views.length, draft: 0, incomplete: 0, ready: 0, accepted: 0, needsChanges: 0, openFeedback: 0 };
  for (const view of views) {
    counts[view.status] += 1;
    if (view.acceptance.state === "accepted") counts.accepted += 1;
    if (view.acceptance.state === "needs-changes") counts.needsChanges += 1;
    counts.openFeedback += view.feedback.filter((thread) => thread.state === "submitted" && thread.classification !== "comment").length;
  }
  // Tested and signed work first; the unbound drafts last, so the cap never hides a real record.
  const order = (view) => (view.status === "ready" ? 0 : view.status === "incomplete" ? 1 : 2);
  const listed = [...views].sort((a, b) => order(a) - order(b) || (a.created_at < b.created_at ? 1 : -1)).slice(0, UAT_LISTED);
  const evidence = views.flatMap((view) => [view.signoff?.received_at, ...view.scenarios.map((s) => s.receipt?.received_at), ...view.feedback.map((t) => t.received_at)]).filter(Boolean);
  return {
    candidate: "unchecked",
    counts,
    evidenceAt: evidence.length ? evidence.sort().at(-1) : null,
    handovers: listed.map((view) => ({
      handover_id: view.handover_id,
      revision: view.revision,
      work_id: view.subject.work_id,
      campaign: view.subject.campaign,
      title: oneLine(view.subject.title || view.summary),
      run_id: localHandoverRun(view),
      source_revision: view.binding?.kind === "source" ? view.binding.source_revision : null,
      status: view.status,
      acceptance: view.acceptance.state,
      shipped: view.acceptance.shipped,
      required: view.scenarios.filter((s) => s.required).length,
      passed: view.scenarios.filter((s) => s.required && s.result === "pass").length,
      signedOffAt: view.signoff?.received_at ?? null,
      attemptAt: view.created_at,
      feedback: view.feedback
        .filter((thread) => thread.classification !== "comment")
        .map((thread) => ({ thread_id: thread.thread_id, state: thread.state, import: thread.import?.status ?? null, work: thread.import?.workId ?? null })),
      document: `${UAT_DIR}/${view.handover_id}.md`,
    })),
  };
}

/** One handover as a stable Markdown document for Drive (steps, expected results, results, feedback). */
export function renderHandoverMarkdown(view) {
  const lines = [
    `# ${oneLine(view.subject.title || view.summary || view.handover_id, 200)}`,
    "",
    `${view.subject.campaign ? view.subject.campaign + " · " : ""}${view.subject.work_id || "no item"} · handover ${view.handover_id} r${view.revision} · ${view.status} · ${view.acceptance.state}`,
    "",
    `Run ${localHandoverRun(view) || "none"} · ${view.binding ? (view.binding.kind === "candidate" ? "candidate " + view.binding.candidate_id : "source " + view.binding.source_revision) : "unbound"} · environment ${view.environment.target}${view.environment.build ? " " + view.environment.build : ""}`,
    "",
  ];
  if (view.setup) lines.push("## Setup", "", view.setup, "");
  if (view.limits) lines.push("## Limits", "", view.limits, "");
  if (view.problems.length) lines.push("## Problems", "", ...view.problems.map((p) => `- ${p.scenario || ""}${p.step ? " step " + p.step : ""} ${p.code}`), "");
  for (const scenario of view.scenarios) {
    lines.push(`## ${scenario.title} (${scenario.id})`, "", `${scenario.required ? "Required" : "Optional"} · ${scenario.result}${scenario.receipt ? " · " + scenario.receipt.received_at : ""}`, "");
    scenario.steps.forEach((step, index) => lines.push(`${index + 1}. ${step.action}`, `   Expected: ${step.expected}`));
    if (scenario.cleanup) lines.push("", `Reset: ${scenario.cleanup}`);
    lines.push("");
  }
  const threads = view.feedback.filter((thread) => thread.classification !== "comment");
  if (threads.length) {
    lines.push("## Feedback", "");
    for (const thread of threads) lines.push(`- ${thread.thread_id} · ${thread.state}${thread.import?.workId ? " · work " + thread.import.workId : thread.import ? " · " + thread.import.status : ""}: ${oneLine(thread.observation, 300)}`);
    lines.push("");
  }
  if (view.signoff) lines.push("## Sign-off", "", `${view.signoff.actor} · ${view.signoff.received_at}${view.signoff.build ? " · " + view.signoff.build : ""}`, "");
  return lines.join("\n");
}

/** Every run that is not closed: working, waiting for the owner, or blocked, and since when. */
function attentionList(delivery) {
  if (!delivery.available && !delivery.stale) return null;
  const rank = { blocked: 0, "waiting-owner": 1, working: 2, idle: 3 };
  return delivery.runs.filter((run) => run.attention && run.attention.state !== "closed")
    .map((run) => ({ run_id: run.run_id, work_id: run.work_id, ...run.attention }))
    .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || String(b.since).localeCompare(String(a.since)));
}

/** @param {{delivery:any, rollups:any, publish:any, now:string, uat?:any, server?:any}} input */
export function buildStatus({ delivery, rollups, publish, now, uat = null, server = null }) {
  const attention = attentionList(delivery);
  return {
    schema: STATUS_SCHEMA,
    generatedAt: now,
    // A supervisor reads this first: null = unknown, [] = nothing running or waiting.
    attention,
    paused: attention ? attention.some((entry) => entry.state === "waiting-owner" || entry.state === "blocked") : null,
    // The PM process that wrote this file; restart_needed means its server code is older than the checkout.
    server,
    delivery,
    uat,
    // null = unknown (store unreadable and nothing earlier to fall back on); [] = confirmed none
    pendingOwnerActions: delivery.available || delivery.stale ? delivery.runs.flatMap((run) => run.ownerActions.map((action) => ({ run_id: run.run_id, ...action }))) : null,
    campaigns: rollups
      ? {
          totals: rollups.totals,
          list: rollups.campaigns.map((c) => ({ campaign: c.campaign, open: c.checklist.open, done: c.checklist.done, blockers: c.checklist.bySeverity.blocker, painBlockers: c.pain.blocker, updated: c.updated })),
        }
      : null,
    publish,
  };
}

const cell = (value) => String(value ?? "").replace(/\|/gu, "/").replace(/\r?\n/gu, " ");

const STATE_LABEL = { blocked: "Blocked", "waiting-owner": "Waiting for the owner", working: "Working", idle: "Idle" };
/** The "## Now" section: what PM is doing or waiting on, per run, with the reason and evidence. */
function renderNow(status, lines) {
  lines.push("## Now", "");
  const server = status.server;
  if (server) lines.push(`- PM process ${server.pid} started ${server.started_at}${server.restart_needed ? ` · **restart needed**: ${cell(server.changed_file || "server code")} changed after start, so newer fixes are not running` : ""}`);
  if (!status.attention) lines.push("- Run state unknown.");
  else if (!status.attention.length) lines.push("- Nothing is running or waiting.");
  const runs = new Map((status.delivery.runs || []).map((run) => [run.run_id, run]));
  for (const entry of status.attention || []) {
    const run = runs.get(entry.run_id), evidence = run?.evidence || {};
    const attempt = evidence.attempt && evidence.attempt.of > 1 ? ` · attempt ${evidence.attempt.n} of ${evidence.attempt.of}` : "";
    lines.push(`- **${STATE_LABEL[entry.state] || entry.state}** · ${cell(entry.work_id)}${attempt} · ${cell(entry.reason)} · since ${entry.since || "unknown"}${entry.action ? " · next: " + cell(entry.action) : ""} · run ${entry.run_id}`);
    for (const finding of evidence.acceptance?.state === "paused" ? evidence.acceptance.findings || [] : [])
      lines.push(`  - ${finding.state} · ${cell(finding.source)} · ${cell(finding.text).slice(0, 200)}${finding.evidence.length ? " — " + finding.evidence.map(cell).join(" · ") : ""}`);
    const last = evidence.revisions?.history?.at(-1);
    if (last?.failure) lines.push(`  - Revision ${last.ordinal} failed at ${cell(last.failure.step)}${last.failure.stage ? " (" + cell(last.failure.stage) + ")" : ""}: ${cell(last.failure.detail)}`);
    if (last?.note) lines.push(`  - Owner note (revision ${last.ordinal}): ${cell(last.note).slice(0, 300)}`);
    const event = evidence.events?.at(-1);
    if (event) lines.push(`  - Latest event ${event.at}: ${cell(event.text)}`);
  }
  lines.push("");
}

export function renderStatusMarkdown(status, changedAt) {
  const d = status.delivery;
  const lines = ["# ERA delivery status", "", `Updated ${status.generatedAt} · changed ${changedAt}`, ""];
  if (!d.available) lines.push(`Delivery store unavailable: ${cell(d.reason)}`, "");
  else if (d.stale) lines.push(`Delivery data is stale (last read ${cell(d.staleSince)}): ${cell(d.staleReason)}`, "");
  renderNow(status, lines);
  lines.push("## Pending owner actions", "");
  if (!status.pendingOwnerActions) lines.push("Unknown.");
  else if (!status.pendingOwnerActions.length) lines.push("None.");
  for (const a of status.pendingOwnerActions || []) lines.push(`- ${cell(a.label)} · run ${a.run_id}`);
  lines.push("", "## Runs", "", "| Run | Phase | Progress | Blockers | Updated |", "| --- | --- | --- | --- | --- |");
  for (const run of d.runs) {
    const p = run.progress;
    const progress = [
      `jobs ${p.jobs.total}`,
      p.plan ? `plan r${p.plan.revision} ${p.plan.status}` : null,
      p.criteria.total ? "criteria " + Object.entries(p.criteria.byState).map(([k, v]) => `${v} ${k}`).join(", ") : null,
      run.lane === "local" ? (run.evidence?.checks?.map(c => c.name + " " + c.state).join(", ") || "no recorded checks") : null,
      run.evidence?.uat ? `UAT ${run.evidence.uat.state} ${run.evidence.uat.passed}/${run.evidence.uat.required}` : null,
      run.evidence?.pushed_commit ? "push " + run.evidence.pushed_commit.slice(0, 12) : null,
      p.application ? `apply ${p.application.state}` : null,
    ].filter(Boolean).join(" · ");
    const blockers = run.blockers.map((b) => `${b.kind}:${b.ref}`).join(", ") || "none";
    lines.push(`| ${run.run_id} · ${run.lane === "local" ? cell(run.work_id) + " · " : ""}${cell(run.title).slice(0, 80)} | ${cell(run.phase)} | ${cell(progress)} | ${cell(blockers)} | ${run.updated_at} |`);
  }
  const u = status.uat;
  if (u) {
    const c = u.counts;
    lines.push("", "## Owner testing", "", `${c.ready} ready · ${c.draft} draft · ${c.incomplete} incomplete · ${c.accepted} shipped · ${c.needsChanges} needs changes · ${c.openFeedback} open feedback${u.stale ? " · stale since " + cell(u.staleSince) : ""}`, "", "Candidate changes are not checked in this mirror.", "");
    for (const h of u.handovers.filter((entry) => entry.status !== "draft")) {
      lines.push(`- ${cell(h.work_id || "-")} · ${cell(h.title).slice(0, 80)} · ${h.status} · ${h.acceptance} · ${h.passed}/${h.required}${h.feedback.length ? " · feedback " + h.feedback.map((f) => f.thread_id + " " + (f.work || f.import || f.state)).join(", ") : ""} · [steps](${h.document})`);
    }
  }
  if (d.requests.length) {
    lines.push("", "## Requests", "");
    for (const r of d.requests) lines.push(`- ${cell(r.workId)} · ${cell(r.status)}${r.stage && r.stage !== r.status ? " (" + cell(r.stage) + ")" : ""} · run ${r.run_id || "-"} · confirmed ${r.lastConfirmedAt || "never"}${r.blocker ? " · blocked: " + cell(r.blocker.code) : ""}`);
  }
  if (status.campaigns) {
    lines.push("", "## Campaigns", "", "| Campaign | Open | Done | Blockers | Pain blockers |", "| --- | --- | --- | --- | --- |");
    for (const c of status.campaigns.list) lines.push(`| ${cell(c.campaign)} | ${c.open} | ${c.done} | ${c.blockers} | ${c.painBlockers} |`);
  }
  const pub = status.publish;
  lines.push("", "## Publisher", "", `Documents ${pub.documents}${pub.vaultFiles != null ? " · ERA Notes files " + pub.vaultFiles : ""} · skipped ${pub.skipped.length}${pub.skipped.length ? " (" + pub.skipped.map((s) => s.path + " " + s.reason).join("; ") + ")" : ""} · Drive edits kept ${pub.driveEdits.length}`, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

const ROOT_README = [
  "# ERA PM Command Center",
  "",
  "One-way mirror of the repository's PM. The repository is authoritative.",
  "",
  "- 01 - PM Documentation: read-only copies. A Drive edit is overwritten on the next publish; the edited copy is kept in 03 - Steward Proposals/Drive edits.",
  "- 02 - Delivery Status: status.json and status.md. Stale if Updated is older than 10 minutes. Read attention (or the Now section) first: every run that is working, waiting for the owner or blocked, with the reason and since when. server.restart_needed means PM runs code older than the checkout.",
  "- 03 - Steward Proposals: write recommendations here. Nothing in this folder is read back automatically.",
  "- 04 - ERA Notes: read-only copy of the whole ERA Notes vault, same folders. Same overwrite rule as 01. Anything under an _Archive folder is history, not current state.",
  "- 05 - Session Review: temporary Local session reports with recorded checks, sealed changes and matching owner UAT. Check the run and candidate against 02 before using a report.",
  "",
].join("\n");

/**
 * Race `start(progress)` against a watchdog that fires after `ms` without a `progress()` call.
 * A hung Drive call stops progress; a long first copy of the vault keeps calling it.
 */
const withIdleTimeout = (start, ms, label) => {
  let timer;
  let fail;
  const guard = new Promise((_, reject) => (fail = reject));
  const progress = () => {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new Error(label + " timed out after " + ms + " ms without progress")), ms);
    timer.unref?.();
  };
  progress();
  const work = start(progress);
  return { work, settled: Promise.race([work, guard]).finally(() => clearTimeout(timer)) };
};

/**
 * @param {{
 *   root:string, pmDir:string, docsDir?:string|null, driveRoot:string,
 *   readDelivery:()=>any, readRollups?:()=>any, readServer?:()=>any,
 *   fsp?:typeof nodeFsp, now?:()=>string, statePath?:string|null,
 *   timeoutMs?:number, debounceMs?:number, retryMs?:number[], log?:(line:string)=>void, env?:Record<string,string|undefined>,
 * }} options
 */
export function createDrivePublisher(options) {
  const {
    pmDir, docsDir = null, vaultDir = null, driveRoot, readDelivery, readRollups = () => null, readUat = () => null, readServer = () => null,
    fsp = nodeFsp, now = () => new Date().toISOString(), statePath = null,
    timeoutMs = 30_000, debounceMs = 1_500, retryMs = [30_000, 60_000, 120_000, 300_000], log = () => {}, env = process.env,
  } = options;

  const syncSessionReviews = createSessionReviewSync({ root: options.root, driveRoot, fsp, env });
  let state = loadState();
  let inFlight = null;
  let rerun = null;
  let timer = null;
  let retryTimer = null;
  let failures = 0;
  let stopped = false;
  const wanted = { docs: false, status: false, full: false };

  function loadState() {
    const blank = { files: {}, vaultFiles: {}, statusHash: null, statusChangedAt: null, statusWrittenAt: null, lastDelivery: null, lastSuccessAt: null, lastError: null };
    try {
      return statePath && existsSync(statePath) ? { ...blank, ...JSON.parse(readFileSync(statePath, "utf8")) } : blank;
    } catch {
      return blank;
    }
  }
  function saveState() {
    if (!statePath) return;
    try {
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
    } catch {
      // local bookkeeping only; the next pass re-verifies against Drive
    }
  }

  const abs = (...parts) => join(driveRoot, ...parts);
  async function readOrNull(path) {
    try {
      return await fsp.readFile(path);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  async function writeAtomic(path, data) {
    await fsp.mkdir(dirname(path), { recursive: true });
    const temp = join(dirname(path), "~pm-" + randomUUID() + ".tmp");
    try {
      await fsp.writeFile(temp, data, { flag: "wx" });
      await fsp.rename(temp, path);
    } catch (error) {
      if (error.code !== "EEXIST") await fsp.unlink(temp).catch(() => {});
      throw error;
    }
  }

  async function pass({ docs, status, full, dryRun }, progress) {
    const result = { ok: true, wrote: [], unchanged: 0, pruned: [], skipped: [], driveEdits: [], statusWritten: false, dryRun: Boolean(dryRun) };
    const rootStat = await fsp.stat(driveRoot).catch(() => null);
    if (!rootStat || !rootStat.isDirectory()) throw new Error("drive-unavailable: " + driveRoot);
    progress();
    const write = async (path, data) => {
      if (!dryRun) await writeAtomic(path, data);
      progress();
    };
    if (!dryRun) {
      for (const [name, folder] of Object.entries(FOLDERS)) {
        if (name === "vault" && !vaultDir) continue;
        await fsp.mkdir(abs(folder), { recursive: true });
        progress();
      }
      if (String((await readOrNull(abs("README.md"))) ?? "") !== ROOT_README) await write(abs("README.md"), ROOT_README);
    }

    let documents = state.documents ?? 0;
    let vaultCount = state.vaultCount ?? 0;
    let skipped = state.skipped ?? [];
    let driveEdits = state.driveEdits ?? [];

    // One mirror group: write what changed, keep a Drive-side edit aside before overwriting it,
    // prune what left the selection. `known` maps dest -> {hash} for what we last published there.
    async function mirror({ folder, files, known, label, cheapFull }) {
      const keep = new Set(files.map((f) => f.dest));
      for (const file of files) {
        const target = abs(folder, ...file.dest.split("/"));
        const last = known[file.dest];
        if (last && last.hash === file.hash) {
          if (!full) {
            result.unchanged += 1;
            continue;
          }
          // Full pass over the vault: presence + size from Drive metadata, so a restart never
          // downloads 1000+ files back from the cloud just to compare them.
          if (cheapFull) {
            const stat = await fsp.stat(target).catch(() => null);
            progress();
            if (stat && stat.size === file.buffer.length) {
              result.unchanged += 1;
              continue;
            }
          }
        }
        const existing = await readOrNull(target);
        progress();
        if (existing && sha(existing) === file.hash) {
          result.unchanged += 1;
          if (!dryRun) known[file.dest] = { hash: file.hash };
          continue;
        }
        // Something other than our last publish sits at the destination: keep it, then overwrite.
        if (existing && (!last || sha(existing) !== last.hash)) {
          const keptAs = `${DRIVE_EDITS_DIR}/${now().replace(/[:.]/gu, "-")} ${(label + file.dest).replace(/\//gu, " - ")}`;
          await write(abs(FOLDERS.proposals, ...keptAs.split("/")), existing);
          result.driveEdits.push({ path: label + file.dest, keptAs });
        }
        await write(target, file.buffer);
        result.wrote.push(label + file.dest);
        if (!dryRun) known[file.dest] = { hash: file.hash };
      }
      for (const dest of Object.keys(known)) {
        if (keep.has(dest)) continue;
        if (!dryRun) {
          await fsp.unlink(abs(folder, ...dest.split("/"))).catch((error) => {
            if (error?.code !== "ENOENT") throw error;
          });
          await removeEmptyParents(folder, dest);
          progress();
          delete known[dest];
        }
        result.pruned.push(label + dest);
      }
    }
    // A renamed or emptied vault folder must not linger in Drive. rmdir refuses a non-empty folder.
    async function removeEmptyParents(folder, dest) {
      const parts = dest.split("/").slice(0, -1);
      while (parts.length) {
        try {
          await fsp.rmdir(abs(folder, ...parts));
        } catch {
          return;
        }
        parts.pop();
      }
    }

    if (docs || full) {
      const loaded = loadDocuments(selectDocuments({ pmDir, docsDir }), env);
      documents = loaded.files.length;
      await mirror({ folder: FOLDERS.docs, files: loaded.files, known: state.files, label: "", cheapFull: false });
      skipped = loaded.skipped;
      if (vaultDir) {
        state.vaultFiles ??= {};
        const vault = loadDocuments(selectVault({ vaultDir }), env, { maxBytes: MAX_VAULT_BYTES, label: VAULT_LABEL });
        vaultCount = vault.files.length;
        await mirror({ folder: FOLDERS.vault, files: vault.files, known: state.vaultFiles, label: VAULT_LABEL, cheapFull: true });
        skipped = [...skipped, ...vault.skipped];
      }
      driveEdits = [...result.driveEdits, ...driveEdits].slice(0, 20);
      result.skipped = skipped;
    }

    if (status || docs || full) {
      let delivery = readDelivery();
      if (!delivery.available && state.lastDelivery) {
        delivery = { ...state.lastDelivery.delivery, stale: true, staleSince: state.lastDelivery.at, staleReason: delivery.reason };
      }
      let rollups = null;
      try {
        rollups = readRollups();
      } catch {
        rollups = null;
      }
      // Owner testing: local records stay authoritative. An unreadable store keeps the last good section, marked stale.
      let uatViews = null;
      let uat = null;
      try {
        uatViews = readUat();
      } catch {
        uatViews = null;
      }
      if (uatViews) {
        uat = buildUatStatus(uatViews);
        if (!dryRun) state.lastUat = { at: now(), uat };
      } else if (state.lastUat) {
        uat = { ...state.lastUat.uat, stale: true, staleSince: state.lastUat.at };
      }
      // Handover documents are retained apart from the rolling status: written on change, never pruned.
      if (uatViews) {
        state.uatFiles ??= {};
        for (const view of uatViews) {
          const body = Buffer.from(renderHandoverMarkdown(view), "utf8");
          const hash = sha(body);
          if (state.uatFiles[view.handover_id] === hash && !full) continue;
          const target = abs(FOLDERS.status, UAT_DIR, `${view.handover_id}.md`);
          const existing = await readOrNull(target);
          if (!existing || sha(existing) !== hash) {
            await write(target, body);
            result.wrote.push(`${UAT_DIR}/${view.handover_id}.md`);
          }
          if (!dryRun) state.uatFiles[view.handover_id] = hash;
        }
      }
      delivery = bindLocalUat(delivery, uatViews);
      await syncSessionReviews({ delivery, dryRun, write, result, progress });
      if (!dryRun && delivery.available && !delivery.stale) state.lastDelivery = { at: now(), delivery };
      const at = now();
      let server = null;
      try { server = readServer(); } catch { server = null; }
      const next = buildStatus({ delivery, rollups, publish: { documents, ...(vaultDir ? { vaultFiles: vaultCount } : {}), skipped, driveEdits }, now: at, uat, server });
      const hash = sha(JSON.stringify({ ...next, generatedAt: undefined })); // the clock alone is not a change
      const changed = hash !== state.statusHash;
      const beat = !state.statusWrittenAt || Date.parse(at) - Date.parse(state.statusWrittenAt) >= HEARTBEAT_MS;
      const missing = full && ((await readOrNull(abs(FOLDERS.status, "status.json"))) === null);
      if (changed || beat || missing) {
        const changedAt = changed || !state.statusChangedAt ? at : state.statusChangedAt;
        await write(abs(FOLDERS.status, "status.json"), JSON.stringify({ ...next, changedAt }, null, 2) + "\n");
        await write(abs(FOLDERS.status, "status.md"), renderStatusMarkdown(next, changedAt));
        result.statusWritten = true;
        result.status = next;
        if (!dryRun) Object.assign(state, { statusHash: hash, statusChangedAt: changedAt, statusWrittenAt: at });
      }
    }
    if (!dryRun) {
      Object.assign(state, { documents, vaultCount, skipped, driveEdits, lastSuccessAt: now(), lastError: null });
      saveState();
    }
    return result;
  }

  /** Run one bounded pass now. Never throws; `ok:false` carries the reason. */
  async function publishNow({ docs = true, status = true, full = false, dryRun = false } = {}) {
    if (inFlight) {
      // Never overlap passes (a hung Drive call must not stack threads); run again once it settles.
      rerun = { docs: docs || rerun?.docs, status: status || rerun?.status, full: full || rerun?.full };
      return { ok: false, busy: true };
    }
    const { work, settled } = withIdleTimeout((progress) => pass({ docs, status, full, dryRun }, progress), timeoutMs, "drive pass");
    inFlight = work.catch(() => {});
    try {
      const result = await settled;
      failures = 0;
      if (result.wrote.length || result.pruned.length || result.statusWritten) log(`[pm-drive] ${dryRun ? "would write" : "wrote"} ${result.wrote.length} doc(s), pruned ${result.pruned.length}${result.statusWritten ? ", status" : ""}`);
      return result;
    } catch (error) {
      const message = String(error?.message || error);
      state.lastError = { at: now(), message };
      if (!dryRun) saveState();
      failures += 1;
      log(`[pm-drive] unavailable, will retry: ${message}`);
      if (!stopped && !dryRun) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => run({ docs: true, status: true, full: failures === 1 }), retryMs[Math.min(failures - 1, retryMs.length - 1)]);
        retryTimer.unref?.();
      }
      return { ok: false, error: message };
    } finally {
      const settled = inFlight;
      settled.then(() => {
        if (inFlight === settled) inFlight = null;
        if (rerun && !stopped) {
          const next = rerun;
          rerun = null;
          run(next);
        }
      });
    }
  }
  const run = (scope) => void publishNow(scope).catch(() => {});

  /** Coalesce triggers: "pm" = documents + status, "delivery"/"poll" = status only. */
  function schedule(reason) {
    if (stopped) return;
    if (reason === "pm" || reason === "docs") Object.assign(wanted, { docs: true, status: true });
    else if (reason === "startup") Object.assign(wanted, { docs: true, status: true, full: true });
    else wanted.status = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const scope = { ...wanted };
      Object.assign(wanted, { docs: false, status: false, full: false });
      run(scope);
    }, debounceMs);
    timer.unref?.();
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(retryTimer);
  }

  return { schedule, publishNow, stop, isBusy: () => Boolean(inFlight), state: () => state };
}

/**
 * Resolve the destination: env wins, Windows defaults to the owner's Drive folder, else disabled.
 * @param {Record<string, string|undefined>} [env]
 * @param {string} [platform]
 */
export function resolveDriveRoot(env = process.env, platform = process.platform) {
  if (env.PM_DRIVE_PUBLISH === "0") return null;
  if (env.PM_DRIVE_DIR) return env.PM_DRIVE_DIR;
  return platform === "win32" ? DEFAULT_DRIVE_ROOT : null;
}
