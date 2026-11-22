// The Local supervisor stores candidate evidence in the run manifest. Its job
// finishing, owner UAT, publication and eventual worktree disposal are distinct.
const localId = /^local-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u;
const revision = value => /^(?:[\da-f]{40}|[\da-f]{64})$/u.test(value) ? value : null;
const checkNames = new Set(["typecheck", "lint", "test", "pm:lint"]);
const failureCodes = new Set(["install", "secrets", "native-error", "no-change", "commit-hook", "commit-timeout", "checks", "handover", "cancelled"]);
const ownerSteps = new Map([
  ["uat-ready", ["local-review", "Review candidate and UAT"]],
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
  }
  for (const check of candidateChecks.filter(check => check.state !== "pass"))
    blockers.push({ kind: "check", ref: check.name + "-" + check.state });

  const head = revision(record.head);
  const retained = !closed && !record.cleaned_at && !record.pushed && localId.test(id);
  return {
    lane: "local", run_id: id, work_id: record.work?.id || run.work_id,
    title: record.work?.title || run.work_id, phase: closed ? "CLOSED/" + (run.closed_outcome || stage) : stage,
    progress: { jobs, plan: null, criteria: { total: 0, byState: {} }, application: null },
    blockers, ownerActions: step ? [{ kind: step[0], key: step[0] + ":" + id, label: step[1] }] : [],
    created_at: run.created_at, updated_at: run.updated_at,
    evidence: {
      base: revision(record.base), head, checks: candidateChecks,
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
