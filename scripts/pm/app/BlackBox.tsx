import { useState } from "react";
import { Copy, FileWarning, UnfoldVertical } from "lucide-react";
import type { LocalRunView } from "./LocalDelivery";
import { localRunFailure, stripAnsi } from "./localRunFailure";
import "./local-run-story.css";

export function BlackBox({ run, hideAttempt = false }: { run: LocalRunView; hideAttempt?: boolean }) {
  const [full, setFull] = useState(false);
  if (!run.error && !run.failure && !run.interrupted) return null;
  const failure = localRunFailure(run);
  const log = stripAnsi(run.error ?? "");
  const visible = full ? log : log.slice(-20 * 1024);
  return (
    <section
      className="local-run-failure stage-black-box"
      aria-label="Session issue"
      data-fault={failure?.station}
    >
      <header>
        <FileWarning size={19} />
        <h2 role="alert">
          {run.interrupted ? "Session interrupted" : failure?.title}
        </h2>
      </header>
      {!run.interrupted && failure && (
        <>
          <dl>
            <div>
              <dt>Stopped at</dt>
              <dd>{failure.stage}</dd>
            </div>
            <div>
              <dt>Kept</dt>
              <dd>{failure.kept}</dd>
            </div>
          </dl>
          {failure.excerpt && (
            <pre className="black-box-excerpt">{failure.excerpt}</pre>
          )}
        </>
      )}
      <div className="black-box-actions">
        {!hideAttempt && run.work.campaign && ["failed", "cancelled"].includes(run.phase) && (
          <a
            className="primary"
            href={`#/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`}
          >
            New attempt
          </a>
        )}
        {log && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(log).catch(() => {});
            }}
          >
            <Copy size={14} /> Copy
          </button>
        )}
      </div>
      {log && (
        <details className="black-box-log">
          <summary>Error details</summary>
          {log.length > 20 * 1024 && (
            <button
              type="button"
              className="secondary"
              aria-label="Error details"
              aria-expanded={full}
              onClick={() => setFull((value) => !value)}
            >
              <UnfoldVertical size={16} /> {full ? "−" : "+"}
            </button>
          )}
          <pre>{visible}</pre>
        </details>
      )}
    </section>
  );
}
