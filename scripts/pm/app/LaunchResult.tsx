import { ShieldAlert } from "lucide-react";
import { startReadinessIssues } from "./readinessModel";
import type { V2Readiness } from "./types";

/** The retained outcome of Start, separate from current passive readiness. */
export function LaunchResult({ failure, commandId }: {
  failure: { message: string; payload: Record<string, unknown>; receivedAt?: string; persistenceError?: string | null };
  commandId?: string;
}) {
  const readiness = failure.payload.readiness as V2Readiness | undefined;
  const issues = readiness?.facts && Array.isArray(readiness.blockers)
    ? startReadinessIssues(readiness)
    : [];
  const reasons = issues.length ? issues : [failure.message];
  return <section className="launch-readiness" aria-label="Start result">
    <div className="launch-readiness-heading" role="status" aria-live="polite">
      <span className="launch-status-icon"><ShieldAlert size={22} /></span>
      <div><h2>Start blocked</h2>{failure.receivedAt && <p>Result received <time dateTime={failure.receivedAt}>{new Date(failure.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></p>}</div>
    </div>
    <ul className="launch-blockers">{reasons.map(text => <li key={text}><ShieldAlert size={16} /><span>{text}</span></li>)}</ul>
    {failure.persistenceError && <p role="alert">{failure.persistenceError}</p>}
    <details className="launch-check-details"><summary>Start details</summary>
      {commandId && <p>Request: {commandId}</p>}
      <pre>{JSON.stringify(failure.payload, null, 2)}</pre>
    </details>
  </section>;
}
