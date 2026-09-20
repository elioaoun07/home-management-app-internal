// scripts/delivery-v2/interaction.mjs
// Command Center Phase 3 — plans, questions, answers and guidance receipts.
//
// Command Center §4: "Approve / Revise binds the exact revision… Plan changes
// invalidate old approvals. A second answer to a superseded question must be
// rejected or reconciled, not applied to today's question. Guidance needs a
// receipt saying queued, delivered to executor, or awaiting next turn."
//
// These are records over the existing store, not a second state machine. What an
// executor writes is untrusted text: a plan is parsed into a readable body and a
// malformed reply is kept as raw text for the owner, never promoted into an
// approval or a question the executor did not actually ask.

import { ContractError, canonicalJson, contentId, deepFreeze, fingerprint } from "./contracts.mjs";

export const PLAN_STATUS = Object.freeze(["proposed", "approved", "revising", "superseded"]);
export const QUESTION_STAGES = Object.freeze(["plan", "build"]);

export const INTERACTION_REFUSALS = Object.freeze({
  NO_PLAN: "no-plan",
  PLAN_SUPERSEDED: "plan-revision-superseded",
  PLAN_DECIDED: "plan-already-decided",
  PLAN_UNREADABLE: "plan-unreadable",
  BLOCKING_OPEN: "blocking-question-open",
  QUESTION_UNKNOWN: "unknown-question",
  QUESTION_SUPERSEDED: "question-superseded",
  QUESTION_ANSWERED: "question-already-answered",
  EMPTY: "empty-text",
  APPROVAL_STALE: "approval-stale",
  NO_APPROVAL: "no-approved-plan",
});

const LIMITS = Object.freeze({ list: 20, text: 800, body: 8000 });
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const clip = (value, size = LIMITS.text) => String(value).trim().slice(0, size);

/**
 * Pull the structured object out of an executor reply.
 *
 * The last fenced ```json block wins; otherwise the outermost `{…}`. Anything
 * that does not parse to a plain object is `ok: false` with the raw text kept.
 */
export function parseEngineerReply(text) {
  const raw = String(text || "");
  const fences = [...raw.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gu)].map((match) => match[1]);
  const candidates = fences.length ? [fences[fences.length - 1]] : [];
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return deepFreeze({ ok: true, value, raw });
    } catch {
      /* try the next candidate */
    }
  }
  return deepFreeze({ ok: false, value: null, raw });
}

/** Questions an executor actually asked, with their blocking flag. */
export function extractQuestions(value, { complete = false } = {}) {
  return (Array.isArray(value && value.questions) ? value.questions : [])
    .map((entry) => (typeof entry === "string" ? { text: entry, blocking: true } : entry))
    .filter((entry) => entry && isNonEmptyString(entry.text))
    .slice(0, complete ? undefined : LIMITS.list)
    .map((entry) => ({ text: complete ? entry.text.trim() : clip(entry.text), blocking: entry.blocking !== false }));
}

/**
 * Normalize a parsed reply into a readable plan body.
 *
 * A plan with neither an outcome nor steps is unreadable: it is recorded so the
 * owner can see it and ask for a revision, and it cannot be approved.
 */
export function normalizePlanBody(value) {
  // Approval covers this entire stored revision. Clipping a plan hides scope and
  // questions from both the owner and the executor resuming its approved work.
  const completeList = (entries) => (Array.isArray(entries) ? entries : [])
    .map((entry) => typeof entry === "string" ? entry : entry && (entry.text || entry.title || entry.description))
    .filter(isNonEmptyString).map((entry) => entry.trim());
  const body = {
    outcome: value && isNonEmptyString(value.outcome) ? value.outcome.trim() : null,
    scope: completeList(value && value.scope),
    steps: completeList(value && value.steps).map((title) => ({ title })),
    risks: completeList(value && value.risks),
    unknowns: completeList(value && value.unknowns),
    checks: completeList(value && value.checks),
    questions: extractQuestions(value, { complete: true }),
  };
  const readable = Boolean(body.outcome || body.steps.length);
  return deepFreeze({ readable, body });
}

/**
 * Record the plan an investigation produced as the run's next revision.
 *
 * Earlier proposals are superseded and their open questions with them, so an
 * answer or approval aimed at an old revision cannot land on the new one.
 *
 * @param {{store:any, run:any, contract:any, job_id:(string|null), replyText:string}} input
 */
export function recordPlan({ store, run, contract, job_id, replyText }) {
  const parsed = parseEngineerReply(replyText);
  const { readable, body } = normalizePlanBody(parsed.value);
  const plans = store.listPlans(run.run_id);
  const revision = plans.length ? Math.max(...plans.map((plan) => Number(plan.revision))) + 1 : 1;
  const body_digest = fingerprint(canonicalJson(body));
  const plan_id = contentId("plan", { v: 1, run_id: run.run_id, revision, body_digest });
  return store.transaction(() => {
    for (const plan of plans) {
      if (plan.status === "proposed" || plan.status === "revising") store.setPlanStatus(plan.plan_id, "superseded");
    }
    store.supersedeQuestions(run.run_id, { beforeRevision: revision, stage: "plan" });
    const row = store.putPlan({
      plan_id,
      run_id: run.run_id,
      revision,
      contract_id: contract.contract_id,
      contract_revision: contract.revision,
      job_id,
      body,
      body_digest,
      raw_text: parsed.raw,
      malformed: !readable,
      status: "proposed",
    });
    const questions = body.questions.map((question, index) =>
      store.putQuestion({
        question_id: contentId("q", { v: 1, plan_id, index, text: question.text }),
        run_id: run.run_id,
        plan_revision: revision,
        job_id,
        stage: "plan",
        text: question.text,
        blocking: question.blocking,
      }),
    );
    store.appendRunEvent(run.run_id, "plan.proposed", { plan_id, revision, readable, questions: questions.length });
    return deepFreeze({ plan: row, questions, readable });
  });
}

/**
 * Record blocking questions an implementation job stopped on. Bound to the
 * approved plan revision they arose under.
 */
export function recordBuildQuestions({ store, run, job_id, plan_revision, questions }) {
  return store.transaction(() =>
    questions.map((question, index) =>
      store.putQuestion({
        question_id: contentId("q", { v: 1, run_id: run.run_id, job_id, index, text: question.text }),
        run_id: run.run_id,
        plan_revision,
        job_id,
        stage: "build",
        text: question.text,
        blocking: question.blocking,
      }),
    ),
  );
}

export function latestPlan(store, run_id) {
  const plans = store.listPlans(run_id);
  return plans.length ? plans[plans.length - 1] : null;
}

export function openBlockingQuestions(store, run_id, stage = null) {
  return store
    .listQuestions(run_id)
    .filter((question) => question.status === "open" && question.blocking && (!stage || question.stage === stage));
}

/**
 * Approve or ask to revise one exact plan revision.
 *
 * The decision records what was seen — plan digest, contract revision, grant and
 * its revocation version — so `approvalFor` can tell later whether it still
 * stands.
 *
 * @param {{store:any, run:any, contract:any, grant:any, plan_id:string, plan_revision:number,
 *   decision:"approve"|"revise", feedback?:(string|null), actor:string, command_id:string}} input
 */
export function decidePlan({ store, run, contract, grant, plan_id, plan_revision, decision, feedback = null, actor, command_id }) {
  if (decision !== "approve" && decision !== "revise") throw new ContractError("decision must be approve or revise");
  const refuse = (code, detail) => deepFreeze({ ok: false, refusals: [{ code, detail }], decision_id: null });
  const latest = latestPlan(store, run.run_id);
  if (!latest) return refuse(INTERACTION_REFUSALS.NO_PLAN, run.run_id);
  if (latest.plan_id !== plan_id || Number(latest.revision) !== Number(plan_revision)) {
    return refuse(INTERACTION_REFUSALS.PLAN_SUPERSEDED, "the current plan is revision " + latest.revision);
  }
  if (latest.status !== "proposed") return refuse(INTERACTION_REFUSALS.PLAN_DECIDED, latest.status);
  if (decision === "approve") {
    if (latest.malformed) return refuse(INTERACTION_REFUSALS.PLAN_UNREADABLE, "ask for a revision");
    const blocking = openBlockingQuestions(store, run.run_id, "plan");
    if (blocking.length) return refuse(INTERACTION_REFUSALS.BLOCKING_OPEN, blocking.map((question) => question.question_id));
  } else if (!isNonEmptyString(feedback)) {
    return refuse(INTERACTION_REFUSALS.EMPTY, "say what should change");
  }
  const decision_id = contentId("d", { v: 1, run_id: run.run_id, kind: "plan", plan_id, decision, command_id });
  return store.transaction(() => {
    store.putDecision({
      decision_id,
      run_id: run.run_id,
      subject_id: plan_id,
      subject_revision: Number(plan_revision),
      kind: decision === "approve" ? "plan-approval" : "plan-revision",
      requested: decision,
      actor,
      answer: decision === "approve" ? "approve" : clip(feedback, LIMITS.body),
      evidence_seen: {
        plan_digest: latest.body_digest,
        contract_id: contract.contract_id,
        contract_revision: contract.revision,
        grant_id: grant.grant_id,
        grant_revision: grant.revocation_version,
        policy_revision: grant.policy_revision,
        command_id,
      },
    });
    store.setPlanStatus(plan_id, decision === "approve" ? "approved" : "revising");
    store.appendRunEvent(run.run_id, "plan." + (decision === "approve" ? "approved" : "revision-requested"), { plan_id, plan_revision, actor });
    return deepFreeze({ ok: true, refusals: [], decision_id });
  });
}

/**
 * Does an approval bind the run's current plan, contract and grant?
 *
 * @param {{store:any, run:any, contract:any, grant:any}} input
 */
export function approvalFor({ store, run, contract, grant }) {
  const no = (code, detail) => deepFreeze({ ok: false, plan: null, decision: null, refusal: { code, detail } });
  const latest = latestPlan(store, run.run_id);
  if (!latest || latest.status !== "approved") return no(INTERACTION_REFUSALS.NO_APPROVAL, latest ? latest.status : "no plan");
  const decision = store
    .listDecisions(run.run_id)
    .filter((entry) => entry.kind === "plan-approval" && entry.subject_id === latest.plan_id)
    .pop();
  if (!decision) return no(INTERACTION_REFUSALS.NO_APPROVAL, "no approval decision recorded");
  let seen = {};
  try {
    seen = JSON.parse(String(decision.evidence_seen || "{}")) || {};
  } catch {
    seen = {};
  }
  const stale = [];
  if (seen.plan_digest !== latest.body_digest) stale.push("plan");
  if (seen.contract_id !== contract.contract_id || Number(seen.contract_revision) !== Number(contract.revision)) stale.push("contract");
  if (seen.grant_id !== grant.grant_id || Number(seen.grant_revision) !== Number(grant.revocation_version)) stale.push("grant");
  if (stale.length) return no(INTERACTION_REFUSALS.APPROVAL_STALE, stale);
  return deepFreeze({ ok: true, plan: latest, decision, refusal: null });
}

/**
 * Answer one open question for the revision it was asked under.
 *
 * @param {{store:any, run:any, question_id:string, plan_revision:number, answer:string, actor:string}} input
 */
export function answerQuestion({ store, run, question_id, plan_revision, answer, actor }) {
  const refuse = (code, detail) => deepFreeze({ ok: false, refusals: [{ code, detail }], question: null });
  if (!isNonEmptyString(answer)) return refuse(INTERACTION_REFUSALS.EMPTY, "an answer needs text");
  const question = store.getQuestion(question_id);
  if (!question || question.run_id !== run.run_id) return refuse(INTERACTION_REFUSALS.QUESTION_UNKNOWN, question_id);
  if (question.status === "superseded" || Number(question.plan_revision) !== Number(plan_revision)) {
    return refuse(INTERACTION_REFUSALS.QUESTION_SUPERSEDED, "asked under revision " + question.plan_revision);
  }
  if (question.status === "answered") return refuse(INTERACTION_REFUSALS.QUESTION_ANSWERED, question.answered_at);
  const applied = store.answerQuestion(question_id, { answer: clip(answer, LIMITS.body), actor });
  if (!applied) return refuse(INTERACTION_REFUSALS.QUESTION_ANSWERED, "answered concurrently");
  store.appendRunEvent(run.run_id, "question.answered", { question_id, plan_revision, actor });
  return deepFreeze({ ok: true, refusals: [], question: store.getQuestion(question_id) });
}

/** Queue owner guidance. Its receipt moves only when a job actually carries it. */
export function queueMessage({ store, run, body, actor, message_id }) {
  if (!isNonEmptyString(body)) return deepFreeze({ ok: false, refusals: [{ code: INTERACTION_REFUSALS.EMPTY, detail: "empty message" }], message: null });
  const message = store.putMessage({ message_id, run_id: run.run_id, actor, body: clip(body, LIMITS.body), status: "queued" });
  store.appendRunEvent(run.run_id, "message.queued", { message_id, actor });
  return deepFreeze({ ok: true, refusals: [], message });
}

/** Owner-facing receipt label for a message status. */
export function messageReceipt(status) {
  return status === "delivered" ? "Delivered" : status === "awaiting-dispatch" ? "Awaiting next turn" : "Queued";
}

// ---------------------------------------------------------------------------
// Instructions the supervisor hands the executor
// ---------------------------------------------------------------------------

const PLAN_SHAPE =
  '{"outcome": string, "scope": [path], "steps": [string], "risks": [string], "unknowns": [string], "checks": [string], "questions": [{"text": string, "blocking": boolean}]}';

// Owner rule (2026-09-19): the owner runs typecheck, lint and tests on the laptop after
// Apply, so the executor spends no turns (tokens) on them. The protected checker still runs
// the policy's pinned checks.
export const NO_TEST_RUNS =
  " Do not run test, lint, typecheck or build commands (pnpm/npm/npx test, vitest, jest, eslint, tsc, next build): the owner runs them after Apply and protected checks run separately.";

/**
 * What the workspace actually is, so the executor stops paying for commands that
 * cannot work in it.
 *
 * Run r-83dddb67fea9 spent a whole request on `git diff --check`, `git diff
 * --stat` and `git diff`, all of which failed with "not a Git repository", and
 * part of another on a typecheck whose compiler was not installed (Investigation
 * §4.5, F6). Neither was the model's mistake: the prompt said "run the checks you
 * need" and never said what the environment was. This sentence is the fix, and
 * it is one sentence because the alternative — a list of everything absent —
 * would cost more than the commands it prevents.
 *
 * It also states who verifies what, because "no git, no tests" without that
 * reads as "nothing is checked" and invites the executor to improvise a
 * substitute.
 */
export const WORKSPACE_FACTS =
  " The workspace is a file snapshot with no Git metadata and no .git directory: git commands (diff, status, log, stash) all fail here, so do not run them — report changes in your reply instead." +
  " Verification is not yours: a protected checker re-runs the declared criteria and a deterministic typecheck on the frozen candidate after you finish, outside this session.";

function section(title, lines) {
  const kept = lines.filter(isNonEmptyString);
  return kept.length ? "\n\n" + title + ":\n" + kept.map((line) => "- " + line).join("\n") : "";
}

/** The read-only investigation that produces (or revises) a plan. */
export function investigationInstruction({ contract, alias, acceptance, messages = [], answers = [], feedback = null, previous = null, profile = "investigate" }) {
  return (
    "Investigate one work item" +
    (alias ? " (" + alias + ")" : "") +
    " in this workspace and propose a plan. The workspace is read-only for this job; do not attempt to edit files." +
    NO_TEST_RUNS +
    WORKSPACE_FACTS +
    (profile === "focused" ? " This is Focused delivery: use the declared scope, avoid broad exploration, and produce one proportionate plan." : " This is Investigate delivery: establish scope and risks before proposing the plan.") +
    "\n\nOutcome: " +
    contract.outcome +
    (acceptance ? "\n\nAcceptance:\n" + acceptance : "") +
    (previous ? "\n\nPrevious plan (revision " + previous.revision + "):\n" + JSON.stringify(previous.body) : "") +
    (feedback ? "\n\nRequested change: " + feedback : "") +
    section("Owner answers", answers.map((entry) => entry.text + " → " + entry.answer)) +
    section("Owner messages", messages.map((entry) => entry.body)) +
    "\n\nReply with one JSON object in a ```json block shaped " +
    PLAN_SHAPE +
    ". Ask a blocking question only when the plan cannot be made without the answer."
  );
}

/**
 * The approved implementation turn.
 *
 * `planAlreadyInThread` is set only when the dispatcher has established that
 * this job really is resuming the provider thread that produced this exact plan
 * revision (journey.dispatch, after `priorRef` exists). In that case the plan's
 * JSON is already in the conversation as the planning job's own final answer and
 * re-sending it is paid for on every request of the build — ≈0.4k tokens × 11–13
 * requests in run r-83dddb67fea9 (Investigation §4.5, F7).
 *
 * The default is false, and every uncertain case keeps the full JSON: a fresh
 * thread, a continuity fallback, a different plan revision, or any doubt about
 * what the thread still holds. A reference the model cannot resolve would cost
 * far more than the duplication it saves.
 */
export function implementationInstruction({ plan, contract, messages = [], answers = [], profile = "investigate", planAlreadyInThread = false }) {
  return (
    "Implement the approved plan (revision " +
    plan.revision +
    ") in this workspace. Stay inside its scope." +
    NO_TEST_RUNS +
    WORKSPACE_FACTS +
    (profile === "focused" ? " This is the one Focused implementation attempt; do not start an automatic repair loop." : "") +
    "\n\nOutcome: " +
    contract.outcome +
    (planAlreadyInThread
      ? "\n\nPlan: the approved plan is revision " +
        plan.revision +
        ", the one you produced earlier in this same conversation. It is unchanged; use it as written."
      : "\n\nPlan:\n" + JSON.stringify(plan.body)) +
    section("Owner answers", answers.map((entry) => entry.text + " → " + entry.answer)) +
    section("Owner messages", messages.map((entry) => entry.body)) +
    '\n\nIf you cannot continue without the owner, stop and reply with ```json {"questions": [{"text": string, "blocking": true}]}```.'
  );
}

/** One supervisor-dispatched repair after protected checks failed. */
export function repairInstruction({ plan, failures, messages = [] }) {
  return (
    "Protected checks failed on the candidate. Repair within the approved plan (revision " +
    plan.revision +
    ") and stop." +
    NO_TEST_RUNS +
    WORKSPACE_FACTS +
    section("Failed checks", failures.map((entry) => entry.criterion_id + ": " + entry.state + (entry.reason ? " (" + entry.reason + ")" : ""))) +
    section("Owner messages", messages.map((entry) => entry.body))
  );
}

/** A fresh session after an explicit executor handoff. */
export function handoffInstruction({ checkpoint, plan, contract }) {
  return (
    "Continue this work from a handoff. Nothing from the previous session is available except what is below." +
    NO_TEST_RUNS +
    WORKSPACE_FACTS +
    "\n\nOutcome: " +
    contract.outcome +
    (plan ? "\n\nApproved plan (revision " + plan.revision + "):\n" + JSON.stringify(plan.body) : "") +
    "\n\nCheckpoint:\n" +
    JSON.stringify({ remaining: checkpoint.remaining, findings: checkpoint.findings, next_action: checkpoint.next_action })
  );
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export const STAGES = Object.freeze(["Plan", "Build", "Check", "Review", "Applied"]);

/**
 * Where the run is, as a projection of its records — never a percentage and
 * never a state that drives anything.
 */
export function stageProjection({ run, plans, jobs, candidates, result, applied = false }) {
  const approved = plans.some((plan) => plan.status === "approved");
  const writeJobs = jobs.filter((job) => job.access === "write");
  let current = 0;
  if (approved) current = 1;
  if (candidates.length && (!result || writeJobs.some((job) => job.status === "active" || job.status === "reserved"))) current = 2;
  if (result && candidates.length) current = 3;
  // Applied only when the protected integrator observed it: an applied-change
  // Result, or an application whose integrated checks passed.
  if ((result && result.observedDisposition === "applied_change") || (applied && result && candidates.length)) current = 4;
  if (writeJobs.some((job) => (job.status === "active" || job.status === "reserved") && job.purpose === "repair")) current = 1;
  const unknown = jobs.some((job) => job.status === "unknown");
  const stopRequested = jobs.some((job) => job.stop_requested_at && !job.stop_observed_at);
  const branch =
    run.closed_outcome === "cancelled"
      ? "cancelled"
      : run.closed_outcome === "failed"
        ? "failed"
        : stopRequested
          ? "stop-requested"
          : unknown
            ? "unknown"
            : null;
  return deepFreeze({ stages: STAGES, current, branch });
}
