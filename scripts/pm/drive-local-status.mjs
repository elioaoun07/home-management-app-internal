// The Local supervisor stores candidate evidence in the run manifest. Its job
// finishing, owner UAT, publication and eventual worktree disposal are distinct.
import { findSecrets } from "./relay.mjs";

const localId = /^local-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u;
const revision = value => /^(?:[\da-f]{40}|[\da-f]{64})$/u.test(value) ? value : null;
const checkNames = new Set(["typecheck", "lint", "test", "pm:lint"]);
const failureCodes = new Set(["install", "secrets", "native-error", "no-change", "commit-hook", "commit-timeout", "checks", "handover", "cancelled"]);
const ownerSteps = new Map([
  ["uat-ready", ["local-review", "Review candidate and UAT"]],
  // DLV-175: a missed or unclear Acceptance Check waits for Request changes or Stop.
  ["acceptance-paused", ["local-acceptance", "Decide on acceptance findings"]],
  ["refresh-conflict", ["local-refresh", "Inspect refresh conflict"]],
  ["refresh-failed", ["local-refresh", "Inspect failed refresh"]],
  ["merged", ["local-commit", "Review commit"]],
  ["committed", ["local-push", "Review push"]],
  ["push-pending", ["local-push", "Check push result"]],
  ["revert-push-pending", ["local-push", "Check revert push result"]],
]);

export function localHandoverRun(view) {
  if (view.subject.run_id) return view.subject.run_id;
  const ref = view.subject.delivery_ref;
  if (typeof ref !== "string" || !ref.startsWith("local:")) return null;
  const id = ref.slice(6);
  return localId.test(id) ? id : null;
}

export function matchesLocalHandover(run, view) {
  return view?.status === "ready" && view.handover_id === run.evidence.handover_id &&
    view.subject?.work_id === run.work_id && localHandoverRun(view) === run.run_id &&
    view.binding?.kind === "source" && !!revision(run.evidence.head) && view.binding.source_revision === run.evidence.head;
}

export function bindLocalUat(delivery, views) {
  if (!delivery.available || delivery.stale || !views) return delivery;
  const byId = new Map(views.map(view => [view.handover_id, view]));
  const runs = delivery.runs.map(run => {
    if (run.lane !== "local") return run;
    const view = byId.get(run.evidence.handover_id);
    if (!matchesLocalHandover(run, view)) return run;
    const required = view.scenarios.filter(scenario => scenario.required);
    const uat = { revision: view.revision, state: view.acceptance.state, signed_off_at: view.signoff?.received_at || null,
      passed: required.filter(scenario => scenario.result === "pass").length, required: required.length };
    const evidence = { ...run.evidence, uat };
    if (run.phase === "uat-ready" && uat.state === "accepted")
      return { ...run, evidence, ownerActions: [{ kind: "local-merge", key: "local-merge:" + run.run_id, label: "Review merge" }] };
    if (run.phase === "uat-ready" && uat.state === "needs-changes")
      return { ...run, evidence, blockers: [...run.blockers, { kind: "uat", ref: "needs-changes" }],
        ownerActions: [{ kind: "local-feedback", key: "local-feedback:" + run.run_id, label: "Review UAT feedback" }] };
    return { ...run, evidence };
  });
  return { ...delivery, runs };
}

const verdicts = new Set(["met", "missed", "unclear"]);
const revisionStates = new Set(["building", "sealed", "failed", "cancelled"]);
const line = (value, max = 300) => String(value ?? "").replace(/\s+/gu, " ").trim().slice(0, max);
/** Repository-relative and credential-scanned; the mirror never carries the worktree path. */
function textFor(record) {
  const prefixes = [record.workspace, record.workspace?.replace(/\//gu, "\\"), record.workspace?.replace(/\\/gu, "/")]
    .filter(value => typeof value === "string" && value.length > 3);
  return (value, max = 300) => {
    let text = String(value ?? "");
    for (const prefix of prefixes) text = text.split(prefix + "\\").join("").split(prefix + "/").join("").split(prefix).join("");
    text = line(text, max);
    return findSecrets(text).length ? "[withheld by the credential scan]" : text;
  };
}
/** A revision that ended without a candidate is not counted against the limit. */
const spent = entry => !["failed", "cancelled"].includes(entry?.state);

/** The recorded Acceptance Check of the current candidate, bounded for the mirror. */
function acceptanceSummary(record, safe) {
  const acceptance = record.acceptance;
  if (!acceptance || !Array.isArray(acceptance.criteria)) return null;
  const criteria = acceptance.criteria.slice(0, 24).map(entry => ({ id: line(entry.id, 40), source: line(entry.source, 40),
    by: entry.by === "supervisor" ? "supervisor" : "reviewer", state: verdicts.has(entry.state) ? entry.state : "unclear",
    text: safe(entry.text), evidence: (entry.evidence || []).slice(0, 3).map(item => safe(item)) }));
  const count = state => criteria.filter(entry => entry.state === state).length;
  return { state: acceptance.state === "passed" ? "passed" : "paused", error: acceptance.error ? safe(acceptance.error) : null,
    head: revision(acceptance.head), checked_at: typeof acceptance.finished_at === "string" ? acceptance.finished_at : null,
    counts: { met: count("met"), missed: count("missed"), unclear: count("unclear") },
    revisions_used: Array.isArray(record.revisions) ? record.revisions.filter(spent).length : 0,
    // What stopped Handover, so a supervisor need not filter the full list.
    findings: criteria.filter(entry => entry.state !== "met").map(({ id, source, state, text, evidence }) => ({ id, source, state, text, evidence })),
    criteria };
}

/** The owner's revisions of this run: requests, notes, outcomes and why one failed. */
function revisionSummary(record, safe) {
  const list = Array.isArray(record.revisions) ? record.revisions : [];
  if (!list.length) return null;
  return { limit: Number.isInteger(record.revision_limit) ? record.revision_limit : 2, used: list.filter(spent).length,
    active: Number.isInteger(record.revision) ? record.revision : null,
    history: list.slice(-6).map(entry => ({ n: entry.n, ordinal: entry.ordinal ?? entry.n, counted: spent(entry),
      state: revisionStates.has(entry.state) ? entry.state : "unknown",
      requested_at: entry.requested_at || null, finished_at: entry.finished_at || null,
      from_head: revision(entry.from_head), to_head: revision(entry.to_head), note: entry.note ? safe(entry.note, 800) : null,
      findings: (entry.findings || []).slice(0, 20).map(finding => line(finding.id, 40)),
      reused_attempt_of: entry.after?.reused ? entry.after.n : null,
      failure: entry.failure && entry.state === "failed" ? { code: line(entry.failure.code, 40), step: line(entry.failure.step, 40),
        stage: entry.failure.stage ? line(entry.failure.stage, 40) : null, detail: safe(entry.failure.detail, 800) } : null })) };
}

const WORKING = new Map([["preparing", "Preparing the worktree"], ["building", "Building"], ["checking", "Running host checks"], ["accepting", "Checking acceptance"]]);
/** One answer to "is PM working, waiting for the owner, or stuck on this run, and since when". */
function attentionOf({ run, record, live, stage, closed, step, acceptance, revisions }) {
  const since = [record.acceptance?.finished_at, revisions?.history.at(-1)?.finished_at, live?.events?.at(-1)?.at, run.updated_at]
    .filter(value => typeof value === "string").sort().at(-1) || null;
  const action = step ? step[1] : null;
  if (closed) return { state: "closed", reason: "Closed · " + (run.closed_outcome || stage), since: run.updated_at, action: null };
  if (live?.ownerActionKind === "local-question" || record.parked) return { state: "waiting-owner", reason: "The session asked the owner a question", since, action };
  if (live?.ownerAction === "Interrupted")
    return { state: "blocked", reason: `Interrupted while ${WORKING.get(stage)?.toLowerCase() || stage}: no supervisor drives this run, usually after a PM restart. Open the run in PM.`, since, action };
  const current = revisions?.history.find(entry => entry.n === revisions.active);
  const revisionText = current ? ` · revision ${current.ordinal} of ${revisions?.limit}` : "";
  if (WORKING.has(stage)) return { state: "working", reason: WORKING.get(stage) + revisionText, since, action: null };
  if (stage === "acceptance-paused") {
    const last = revisions?.history.at(-1);
    const failed = last && !last.counted
      ? ` · revision ${last.ordinal} ${last.state}${last.failure ? ` at ${last.failure.step}${last.failure.stage ? ` (${last.failure.stage})` : ""}` : ""}, earlier candidate restored` : "";
    return { state: "waiting-owner", reason: `Acceptance paused · ${acceptance?.counts.missed ?? 0} missed · ${acceptance?.counts.unclear ?? 0} unclear${failed}`, since, action };
  }
  if (stage === "uat-ready") return { state: "waiting-owner", reason: "Ready for owner UAT", since, action };
  if (stage === "refresh-conflict" || stage === "refresh-failed") return { state: "blocked", reason: stage === "refresh-conflict" ? "Refresh conflict" : "Refresh failed", since, action };
  return step ? { state: "waiting-owner", reason: step[1], since, action } : { state: "idle", reason: stage, since, action: null };
}

export function localDriveStatus({ run, record, live, jobs, reviewFolder }) {
  const id = run.run_id;
  const closed = run.lifecycle === "CLOSED";
  const stage = record.phase || "unknown";
  const candidateChecks = (record.checks || []).map(check => ({
    name: checkNames.has(check.name) ? check.name : "other",
    state: check.error ? "fail" : !Number.isInteger(check.exit) ? "unknown" : check.exit === 0 ? "pass" : "fail",
    exit: Number.isInteger(check.exit) ? check.exit : null,
  }));
  const blockers = [];
  let step = closed ? null : ownerSteps.get(stage);
  if (stage === "failed") {
    blockers.push({ kind: "failure", ref: failureCodes.has(record.failure?.code) ? record.failure.code : "local-session-failed" });
  } else if (!closed && (live?.ownerActionKind === "local-question" || record.parked)) {
    blockers.push({ kind: "question", ref: "awaiting-owner-answer" });
    step = ["local-question", "Answer session question"];
  } else if (!closed && live?.ownerAction === "Interrupted") {
    blockers.push({ kind: "interrupted", ref: "local-supervisor" });
    step = ["local-interrupted", "Inspect interrupted session"];
  } else if (stage === "refresh-conflict" || stage === "refresh-failed") {
    blockers.push({ kind: "refresh", ref: stage });
  } else if (stage === "acceptance-paused" && !closed) {
    const counts = record.acceptance?.counts || {};
    blockers.push({ kind: "acceptance", ref: `${counts.missed ?? 0} missed · ${counts.unclear ?? 0} unclear` });
  }
  for (const check of candidateChecks.filter(check => check.state !== "pass"))
    blockers.push({ kind: "check", ref: check.name + "-" + check.state });

  const safe = textFor(record);
  const acceptance = acceptanceSummary(record, safe), revisions = revisionSummary(record, safe);
  const lastRevision = revisions?.history.at(-1);
  if (!closed && stage === "acceptance-paused" && lastRevision && !lastRevision.counted)
    blockers.push({ kind: "revision-" + lastRevision.state, ref: `revision ${lastRevision.ordinal}` +
      (lastRevision.failure ? ` · ${lastRevision.failure.step}${lastRevision.failure.stage ? " · " + lastRevision.failure.stage : ""}` : "") });
  const head = revision(record.head);
  const retained = !closed && !record.cleaned_at && !record.pushed && localId.test(id);
  return {
    lane: "local", run_id: id, work_id: record.work?.id || run.work_id,
    title: record.work?.title || run.work_id, phase: closed ? "CLOSED/" + (run.closed_outcome || stage) : stage,
    progress: { jobs, plan: null, criteria: { total: 0, byState: {} }, application: null },
    blockers, ownerActions: step ? [{ kind: step[0], key: step[0] + ":" + id, label: step[1] }] : [],
    created_at: run.created_at, updated_at: run.updated_at,
    attention: attentionOf({ run, record, live, stage, closed, step, acceptance, revisions }),
    evidence: {
      base: revision(record.base), head, checks: candidateChecks,
      // Attempt n of the item's Local runs, and the owner's revisions within this one.
      attempt: Number.isInteger(live?.attempt?.n) ? { n: live.attempt.n, of: live.attempt.of } : null,
      acceptance, revisions,
      failure: stage === "failed" && record.failure ? { code: line(record.failure.code, 40), step: line(record.failure.step, 40),
        stage: record.failure.stage ? line(record.failure.stage, 40) : null, detail: safe(record.failure.detail, 800) } : null,
      // Supervisor events only (never tool calls, agent text or chat), newest last.
      events: Array.isArray(live?.events) ? live.events.slice(-15).map(entry => ({ at: entry.at, text: safe(entry.text, 200) })) : [],
      handover_id: /^uat-[\da-f]{12}$/u.test(record.handover_id) ? record.handover_id : null,
      review_document: retained ? reviewFolder + "/" + id + ".md" : null,
      // The manual CLI can read persisted phases but cannot witness the laptop runner.
      runner_active: typeof live?.active === "boolean" ? live.active : null,
      merged_at: record.applied?.at || null, commit: revision(record.committed?.sha),
      pushed_commit: revision(record.pushed?.sha), cleaned_at: record.cleaned_at || null,
      link: "#/delivery/run/" + encodeURIComponent(id),
    },
  };
}
