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

/** The Acceptance Check result and, while it is paused, the owner's decision. */
export function LocalAcceptance({ run, busy, act, readOnly = false }: {
  run: LocalRunView;
  busy: boolean;
  act: LocalAct;
  readOnly?: boolean;
}) {
  const [note, setNote] = useState("");
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
  return (
    <section className="local-acceptance" aria-label="Acceptance check" data-state={acceptance.state}>
      <header>
        <h3>Acceptance</h3>
        <span>{met} met · {missed} missed · {unclear} unclear</span>
      </header>
      {acceptance.error && <p className="merge-note">{acceptance.error}</p>}
      <AcceptanceVerdict criteria={acceptance.criteria} />
      {paused && !readOnly && (
        <div className="local-acceptance-decision">
          <textarea aria-label="Notes" placeholder="Notes" maxLength={4000} value={note}
            onChange={(event) => setNote(event.target.value)} />
          <div className="gate-actions">
            <button className="primary" disabled={busy || !run.canRequestChanges || !head}
              onClick={() => head && act("request-changes", { expected_head: head, ...(note.trim() ? { note: note.trim() } : {}) })}>
              Request changes
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
                {revision.state} · <code>{revision.from_head.slice(0, 8)}</code>
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
