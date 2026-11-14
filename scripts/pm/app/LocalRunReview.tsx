import { Check, FileText, GitBranch, ListChecks } from "lucide-react";
import { Markdown, RunOrb } from "./components";
import { bareTitle } from "./deliveryHomeModel";
import { LocalActions, type LocalRunView } from "./LocalDelivery";
import {
  LOCAL_CHECKS,
  localCheckLabel,
  localFailureTitle,
  localRunLabel,
  localRunStages,
} from "./localRunModel";
import "./local-run.css";

export function LocalRunReview({
  run,
  busy,
  act,
  patch,
}: {
  run: LocalRunView;
  busy: boolean;
  act: (action: "review" | "ship" | "undo" | "cancel") => void;
  patch: string | null;
}) {
  const running =
    ["preparing", "building", "checking"].includes(run.phase) &&
    !run.interrupted;
  const stages = localRunStages(run);
  const title = bareTitle(run.work.title, run.work.id).replace(
    /\s+— criteria$/u,
    "",
  );
  return (
    <>
      <header className="run-heading">
        <div>
          <span className="eyebrow">
            {run.work.campaign ? `${run.work.campaign} · ` : ""}
            {run.work.id} · Local
          </span>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="run-moment" aria-label="Session status">
        <RunOrb
          running={running}
          space={run.work.campaign || "Delivery"}
          size={90}
        />
        <div>
          <span className="eyebrow">Local session</span>
          <h2 role="status">{localRunLabel(run)}</h2>
          {run.settings && (
            <p>
              {[run.settings.executor, run.settings.model, run.settings.effort]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </section>
      <nav className="journey" aria-label="Delivery stages">
        {stages.map((stage, index) => (
          <div
            key={stage.label}
            className={
              stage.state === "done"
                ? "visited"
                : stage.state === "pending"
                  ? ""
                  : "current"
            }
            data-stage-state={stage.state}
            aria-current={
              stage.state === "current" || stage.state === "stopped"
                ? "step"
                : undefined
            }
          >
            <span>
              {stage.state === "done" ? <Check size={13} /> : index + 1}
            </span>
            <strong>{stage.label}</strong>
          </div>
        ))}
      </nav>
      {(run.error || run.interrupted) && (
        <section className="local-run-failure" aria-label="Session issue">
          <h2 role="alert">
            {run.interrupted
              ? "Session interrupted"
              : localFailureTitle(run.error!)}
          </h2>
          {run.error && (
            <details>
              <summary>Error details</summary>
              <pre>{run.error}</pre>
            </details>
          )}
          {run.work.campaign && ["failed", "cancelled"].includes(run.phase) && (
            <a
              className="primary"
              href={`#/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`}
            >
              New attempt
            </a>
          )}
        </section>
      )}
      <LocalActions run={run} busy={busy} act={act} />
      <div className="run-story-grid local-run-story">
        <section className="local-run-plan" aria-label="Plan">
          <h2>
            <FileText size={18} />
            Plan
          </h2>
          {run.work.brief ? (
            <>
              <span className="eyebrow">Work brief</span>
              <Markdown raw={run.work.brief} />
            </>
          ) : (
            <p className="quiet">Plan not recorded</p>
          )}
        </section>
        <section className="run-checks" aria-label="Verification">
          <h2>
            <ListChecks size={18} />
            Verification
          </h2>
          {LOCAL_CHECKS.map((name) => {
            const check = run.checks.find((entry) => entry.name === name);
            return (
              <details className="local-check" key={name}>
                <summary>
                  <span>{name}</span>
                  <strong
                    data-pass={
                      check ? check.exit === 0 && !check.error : undefined
                    }
                  >
                    {localCheckLabel(check)}
                  </strong>
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
          <div className="resource-line">
            <span>Owner test</span>
            <strong>
              {run.handover ? run.handover.acceptance.state : "Not ready"}
            </strong>
          </div>
          {run.usage && (
            <details>
              <summary>Usage</summary>
              <dl>
                {Object.entries(run.usage)
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
      </div>
      <section className="local-run-activity" aria-label="Activity">
        <h2>Activity</h2>
        {run.activity.length ? (
          <ol>
            {run.activity.slice(-30).map((entry, index) => (
              <li key={index}>
                <time dateTime={entry.at}>
                  {entry.at.replace(/^.*T/u, "").slice(0, 8)} UTC
                </time>
                <span>
                  {entry.summary === run.error ||
                  entry.summary?.startsWith("native session exited")
                    ? "Session failed · see error details"
                    : entry.summary}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="quiet">No activity recorded</p>
        )}
      </section>
      <section className="local-run-changes" aria-label="Changes">
        <h2>
          <GitBranch size={18} />
          Changes
        </h2>
        {run.head ? (
          <p>
            <code>{run.head.slice(0, 12)}</code>
          </p>
        ) : (
          <p className="quiet">No candidate recorded</p>
        )}
        {patch !== null && <pre>{patch || "No changes"}</pre>}
        {run.risk?.required && (
          <details>
            <summary>Review required</summary>
            <ul>
              {run.risk.flagged.map((file) => (
                <li key={file.path}>
                  <code>{file.path}</code> · {file.domains.join(", ")}
                </li>
              ))}
            </ul>
          </details>
        )}
        <details>
          <summary>Worktree</summary>
          <dl>
            <dt>Branch</dt>
            <dd>
              <code>{run.branch}</code>
            </dd>
            <dt>Path</dt>
            <dd>
              <code>{run.workspace}</code>
            </dd>
          </dl>
        </details>
      </section>
    </>
  );
}
