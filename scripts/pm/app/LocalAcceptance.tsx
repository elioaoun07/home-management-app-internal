import { useState } from "react";
import { Check, CircleHelp, X } from "lucide-react";
import type { LocalAct, LocalAcceptanceCriterion, LocalRunView } from "./LocalDelivery";
import "./local-acceptance.css";

const marks = { met: Check, missed: X, unclear: CircleHelp };

/** DLV-175: each criterion's verdict, evidence behind a disclosure. */
export function AcceptanceVerdict({ criteria }: { criteria: LocalAcceptanceCriterion[] }) {
  return (
    <ul className="local-acceptance-list">
      {criteria.map((criterion) => {
        const Mark = marks[criterion.state];
        return (
          <li key={criterion.id} data-state={criterion.state}>
            <Mark size={16} aria-hidden />
            <details>
              <summary>
                <strong>{criterion.source}</strong>
                <span>{criterion.text}</span>
                <small>{criterion.state}</small>
              </summary>
              <ul>
                {criterion.evidence.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** Failure lines name files inside the run worktree; show them repository-relative. */
function repoRelative(text: string | undefined, workspace: string | undefined) {
  if (!text) return "";
  if (!workspace) return text;
  return [workspace, workspace.replace(/\//gu, "\\"), workspace.replace(/\\/gu, "/")]
    .reduce((value, prefix) => value.split(prefix + "\\").join("").split(prefix + "/").join(""), text);
}

/** The Acceptance Check result and, while it is paused, the owner's decision. */
export function LocalAcceptance({ run, busy, act, readOnly = false }: {
  run: LocalRunView;
  busy: boolean;
  act: LocalAct;
  readOnly?: boolean;
}) {
  // A revision that ended without a candidate: its notes carry over and a retry starts from its kept changes.
  const unfinished = run.revisions?.at(-1);
  const lastFailed = unfinished && (unfinished.state === "failed" || unfinished.state === "cancelled") && unfinished.from_head === run.head ? unfinished : null;
  const [note, setNote] = useState(lastFailed?.note ?? "");
  const [confirmStop, setConfirmStop] = useState(false);
  const recheck = !readOnly && run.canRecheckAcceptance && (
    <button className="secondary" disabled={busy} onClick={() => act("check-acceptance")}>Check again</button>
  );
  if (run.phase === "accepting")
    return (
      <section className="local-acceptance" aria-label="Acceptance check">
        <h3 role="status">Checking acceptance</h3>
        {recheck}
      </section>
    );
  const acceptance = run.acceptance;
  if (!acceptance) return null;
  const paused = run.phase === "acceptance-paused";
  const { met, missed, unclear } = acceptance.counts;
  const head = run.head ?? undefined;
  // The verdict belongs to one sealed candidate; after a failed revision it is the earlier one.
  const candidate = run.candidates?.find((entry) => entry.head === acceptance.head) ?? run.candidates?.at(-1);
  const checkedAt = acceptance.finished_at ? new Date(acceptance.finished_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const failedDetail = lastFailed?.state === "failed" ? repoRelative(lastFailed.failure?.detail, run.workspace) : "";
  return (
    <section className="local-acceptance" aria-label="Acceptance check" data-state={acceptance.state}>
      {lastFailed && (
        <div className="local-acceptance-failed" role="status">
          <strong>
            Revision {lastFailed.ordinal ?? lastFailed.n} {lastFailed.state}
            {lastFailed.failure && lastFailed.state === "failed" && <> · {lastFailed.failure.step}{lastFailed.failure.stage ? ` · ${lastFailed.failure.stage}` : ""}</>}
          </strong>
          {failedDetail && <pre>{failedDetail}</pre>}
        </div>
      )}
      <header>
        <h3>Acceptance{candidate ? ` · candidate ${candidate.n}` : ""}</h3>
        <span>{met} met · {missed} missed · {unclear} unclear{checkedAt ? ` · ${checkedAt}` : ""}</span>
      </header>
      {acceptance.error && <p className="merge-note">{acceptance.error}</p>}
      <AcceptanceVerdict criteria={acceptance.criteria} />
      {paused && !readOnly && (
        <div className="local-acceptance-decision">
          <textarea aria-label="Notes" placeholder="Notes" maxLength={4000} value={note}
            onChange={(event) => setNote(event.target.value)} />
          <div className="gate-actions">
            <button className="primary" disabled={busy || !run.canRequestChanges || !head}
              onClick={() => head && act("request-changes", { expected_head: head, ...(note.trim() ? { note: note.trim() } : {}),
                ...(run.canReuseAttempt ? { reuse_attempt: "true" } : {}) })}>
              {lastFailed ? "Retry revision" : "Request changes"}
            </button>
            <span className="local-acceptance-budget">{run.revisions_used ?? 0} of {run.revision_limit ?? 2}</span>
            {recheck}
            {confirmStop ? (
              <>
                <button className="secondary" disabled={busy || !run.canStop}
                  onClick={() => act("stop", head ? { expected_head: head } : undefined)}>Confirm stop</button>
                <button className="secondary" onClick={() => setConfirmStop(false)}>Keep</button>
              </>
            ) : (
              <button className="secondary" disabled={busy || !run.canStop} onClick={() => setConfirmStop(true)}>Stop run</button>
            )}
          </div>
        </div>
      )}
      {!!run.revisions?.length && (
        <details className="local-acceptance-history">
          <summary>Revisions</summary>
          <ol>
            {run.revisions.map((revision) => (
              <li key={revision.n}>
                {revision.ordinal ?? revision.n} · {revision.state} · <code>{revision.from_head.slice(0, 8)}</code>
                {revision.to_head && <> → <code>{revision.to_head.slice(0, 8)}</code></>}
                {revision.note && <p>{revision.note}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
