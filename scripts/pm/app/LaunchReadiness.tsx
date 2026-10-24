import { Check, ClipboardCheck, Clock, LoaderCircle, ShieldAlert } from "lucide-react";
import { readinessCanStart, readinessIssues, readinessRows } from "./readinessModel";
import type { V2Readiness } from "./types";

/** Inspection feedback is separate from admission: only the server can start work. */
export function LaunchReadiness({ result, connected, loading, checking, checkedAt, error, disabled, onCheck }: {
  result: V2Readiness | null | undefined;
  connected: boolean;
  loading: boolean;
  checking: boolean;
  checkedAt?: number;
  error?: Error | null;
  disabled: boolean;
  onCheck: () => void;
}) {
  const rows = readinessRows(result);
  const issues = readinessIssues(result, rows);
  const needsSetup = rows.some(row => row.state === "fix");
  const ready = !!result && readinessCanStart(result, result.selection);
  const title = !connected ? "Laptop offline" : checking ? "Checking readiness…" : error ? "Check failed"
    : loading && !result ? "Loading readiness…" : !result ? "Readiness unavailable"
    : needsSetup ? "Setup required" : ready ? "Checks passed" : "Checks at Start";
  const Icon = checking || (loading && !result) ? LoaderCircle : needsSetup || error || !connected ? ShieldAlert : ready ? Check : Clock;
  return <section className="launch-readiness" aria-label="Readiness" aria-busy={checking}>
    <div className="launch-readiness-heading" role="status" aria-live="polite">
      <span className="launch-status-icon"><Icon size={22} className={checking ? "readiness-spinner" : undefined} /></span>
      <div>
        <h2>{title}</h2>
        {checking ? <p>Waiting for the laptop</p> : checkedAt && !error ? <p>Checked {new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p> : null}
      </div>
    </div>
    {error && <p className="launch-check-error" role="alert">{error.message}</p>}
    {!checking && issues.length > 0 && <ul className="launch-blockers">{issues.map(text => <li key={text}><ShieldAlert size={16} /><span>{text}</span></li>)}</ul>}
    <button type="button" className="secondary launch-check-button" disabled={disabled || checking} onClick={onCheck}>
      {checking ? <LoaderCircle size={16} className="readiness-spinner" /> : <ClipboardCheck size={16} />}
      {checking ? "Checking…" : "Check readiness"}
    </button>
    {rows.length > 0 && <details className="launch-check-details">
      <summary>{error ? "Previous checks" : "Check details"}{!error && !checking && <span>{rows.filter(row => row.state === "ok").length}/{rows.length}</span>}</summary>
      <ul className="launch-check-list">{rows.map(row => <li key={row.gate} data-state={row.state}>
        {row.state === "ok" ? <Check size={15} /> : row.state === "fix" ? <ShieldAlert size={15} /> : <Clock size={15} />}
        <span>{row.label}</span><small>{row.state === "ok" ? "Passed" : row.state === "fix" ? "Needs attention" : "Checked at Start"}</small>
        {row.state === "fix" && <code className="launch-check-explanation">{result?.facts[row.gate]?.code}{typeof result?.facts[row.gate]?.detail === "string" ? ` · ${result.facts[row.gate].detail}` : ""}</code>}
      </li>)}</ul>
    </details>}
  </section>;
}
