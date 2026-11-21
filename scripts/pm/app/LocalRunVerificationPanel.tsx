import {
  Check,
  ChevronRight,
  ListChecks,
  Shield,
  Terminal,
} from "lucide-react";
import type { LocalRunView } from "./LocalDelivery";
import type { LocalScene } from "./localRunScene";
import { LOCAL_CHECKS, localCheckLabel } from "./localRunModel";
import { clock } from "./localRunLiveness";
export function LocalRunVerificationPanel({
  viewRun,
  snapshot,
  passed,
}: {
  viewRun: LocalRunView;
  snapshot: LocalScene;
  passed: number;
}) {
  return (
    <section aria-label="Verification">
      <div className="run-game-panel-heading">
        <div>
          <span className="eyebrow">Test lab</span>
          <h2>
            <ListChecks size={18} />
            Verification
          </h2>
        </div>
        <strong className="run-game-score">
          {passed}
          <small> / {LOCAL_CHECKS.length}</small>
        </strong>
      </div>
      <div className="run-game-checks">
        {LOCAL_CHECKS.map((name, index) => {
          const check = viewRun.checks.find((entry) => entry.name === name);
          const started =
            check?.started_at ??
            (index
              ? viewRun.checks.find(
                  (entry) => entry.name === LOCAL_CHECKS[index - 1],
                )?.finished_at
              : snapshot.events.find(
                  (entry) => entry.summary === "Host checks started",
                )?.at);
          const finished =
            check?.finished_at ??
            snapshot.events.find(
              (entry) => entry.kind === "check" && entry.detail === name,
            )?.at;
          const duration =
            started && finished
              ? Date.parse(finished) - Date.parse(started)
              : null;
          return (
            <details
              className="run-game-check"
              key={name}
              data-result={
                !check
                  ? "pending"
                  : check.exit === 0 && !check.error
                    ? "passed"
                    : "stopped"
              }
            >
              <summary>
                <span className="run-game-check-symbol">
                  {check?.exit === 0 && !check.error ? (
                    <Check size={18} />
                  ) : (
                    <Terminal size={17} />
                  )}
                </span>
                <span>
                  <small>CHECK {String(index + 1).padStart(2, "0")}</small>
                  <strong>{name}</strong>
                </span>
                <em>{localCheckLabel(check)}</em>
                {duration !== null &&
                  Number.isFinite(duration) &&
                  duration >= 0 && <span>{clock(duration)}</span>}
                <ChevronRight size={15} />
              </summary>
              {check && (
                <pre>
                  {[check.stdout, check.stderr, check.error]
                    .filter(Boolean)
                    .join("\n") || "No output recorded"}
                </pre>
              )}
            </details>
          );
        })}
      </div>
      <div className="run-game-owner-test">
        <Shield size={16} />
        <span>Owner test</span>
        <strong>
          {viewRun.handover ? viewRun.handover.acceptance.state : "Not ready"}
        </strong>
      </div>
      {viewRun.usage && (
        <details className="run-game-disclosure">
          <summary>Usage</summary>
          <dl>
            {Object.entries(viewRun.usage)
              .filter(([, value]) => typeof value === "number")
              .map(([name, value]) => (
                <div className="resource-line" key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </section>
  );
}
