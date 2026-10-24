// DLV-140: observation of an existing launch, never a dispatcher or retry loop.
// Uses the supervisor's receipts table; command_id remains DLV-138's launch id.
import { canonicalJson, fingerprint } from "./contracts.mjs";

const KIND = "steward-initiation";
const receiptId = (id) => "steward:" + id;
const parse = (value) => (value ? JSON.parse(String(value)) : null);

export const DEFAULT_STEWARD_STALE_MS = 180_000;
export function stewardStaleMs(value) {
  const ms = Number(value);
  return Number.isSafeInteger(ms) && ms >= 1_000 && ms <= 86_400_000
    ? ms
    : DEFAULT_STEWARD_STALE_MS;
}

/** One durable claim before the first await. Cross-process serialization is SQLite's. */
export function acceptStewardRequest(store, body, actor, at) {
  return store.transaction(() => {
    const id = receiptId(body.command_id),
      existing = store.getReceipt(id);
    const digest = fingerprint(canonicalJson(body));
    if (existing) {
      if (existing.actor !== actor || existing.payload_digest !== digest)
        return { conflict: true };
      return { created: false, record: parse(existing.observed_json) };
    }
    // Do not adopt a command initiated through another entry point.
    if (store.getCommand(body.command_id)) return { conflict: true };
    const workKey =
      "steward-work:" + body.file + ":" + String(body.expectId).toUpperCase();
    const pending = store
      .listReceipts(workKey)
      .map((row) => parse(row.observed_json))
      .find((record) => {
        const command = store.getCommand(record.command_id);
        const outcome = record.outcome || parse(command?.outcome_json);
        if (!outcome) return true;
        return (
          outcome.ok && store.getRun(outcome.run_id)?.lifecycle !== "CLOSED"
        );
      });
    if (pending) return { conflict: true, command_id: pending.command_id };
    const record = {
      command_id: body.command_id,
      initiatedBy: "ERA Steward",
      actor,
      file: body.file,
      workId: body.expectId || body.witness?.alias || "",
      acceptedAt: at,
      startedAt: null,
      lastConfirmedAt: at,
      stage: "accepted",
      run_id: null,
      outcome: null,
      evidence: [{ stage: "accepted", at, code: "steward-request-accepted" }],
    };
    store.putReceipt({
      receipt_id: id,
      kind: KIND,
      subject_id: workKey,
      actor,
      payload_digest: digest,
      state_after: "accepted",
      observed: record,
    });
    return { created: true, record };
  });
}

/** @param {Record<string, unknown> | null} outcome */
export function updateStewardRequest(
  store,
  command_id,
  stage,
  at,
  outcome = null,
) {
  return store.transaction(() => {
    const row = store.getReceipt(receiptId(command_id));
    if (!row) return null;
    const previous = parse(row.observed_json);
    if (previous.outcome) return previous; // Late coordination cannot rewrite a conclusion.
    const record = {
      ...previous,
      startedAt: previous.startedAt || at,
      stage,
      lastConfirmedAt: at,
      run_id: outcome?.run_id || previous.run_id,
      outcome,
      evidence: [
        ...previous.evidence,
        {
          stage,
          at,
          code: outcome?.error || (outcome?.ok ? "run-created" : stage),
        },
      ].slice(-16),
    };
    store.putReceipt({
      ...row,
      observed: record,
      state_before: previous.stage,
      state_after: stage,
    });
    return record;
  });
}

/** Read-only reconciliation. A crash after command commit can still find its run. */
export function projectStewardRequest(store, row, staleAfterMs) {
  const record = parse(row.observed_json),
    command = store.getCommand(record.command_id);
  const outcome = record.outcome || parse(command?.outcome_json);
  const run_id = outcome?.run_id || command?.subject_id || record.run_id;
  const run = run_id ? store.getRun(run_id) : null;
  const jobs = run ? store.listJobs(run_id) : [];
  const result = run ? store.latestResult(run_id) : null;
  const latestEvent = run ? store.latestRunEvent(run_id) : null;
  const terminal = run?.lifecycle === "CLOSED";
  const job = jobs.find((job) =>
    ["unknown", "active", "reserved"].includes(job.status),
  );
  const stage = terminal
    ? "closed"
    : run?.waiting_reason ||
      (job ? job.purpose : run ? "run-created" : record.stage);
  const status = terminal
    ? String(run.closed_outcome || "closed")
    : outcome?.ok === false
      ? "blocked"
      : run?.waiting_reason ||
        (job?.status === "unknown"
          ? "outcome-unconfirmed"
          : job?.status === "active"
            ? "running"
            : job
              ? "queued"
              : run
                ? "started"
                : "pending");
  // Keep coordination and job evidence clocks apart. Reading/publishing is no heartbeat.
  return {
    ...record,
    run_id: run_id || null,
    outcome,
    stage,
    status,
    terminal,
    staleAfterMs,
    jobUpdatedAt: latestEvent?.at || run?.updated_at || null,
    blocker:
      outcome?.ok === false
        ? {
            code:
              outcome.error || outcome.refusals?.[0]?.code || "launch-refused",
            readiness: outcome.readiness || null,
            refusals: outcome.refusals || [],
          }
        : !terminal && run?.lifecycle === "WAITING" && run.waiting_reason
          ? { code: run.waiting_reason }
          : null,
    result: result
      ? {
          result_id: result.result_id,
          version: result.result_version,
          at: result.created_at,
          record: parse(result.record_json),
        }
      : null,
    runEvidence: latestEvent
      ? { seq: latestEvent.seq, kind: latestEvent.kind, at: latestEvent.at }
      : null,
  };
}

export function listStewardRequests(store, staleAfterMs) {
  return store
    .listReceiptsByKind(KIND)
    .map((row) => projectStewardRequest(store, row, staleAfterMs));
}

export function stewardCommandState(store, command_id, staleAfterMs) {
  const row = store.getReceipt(receiptId(command_id));
  if (!row) return null;
  const request = projectStewardRequest(store, row, staleAfterMs);
  return {
    command_id,
    actor: row.actor,
    recorded: !!request.outcome,
    outcome: request.outcome,
    request,
  };
}
