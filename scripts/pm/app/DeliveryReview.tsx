import { useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileCode2,
  FileText,
  GitBranch,
  ListChecks,
  Terminal,
} from "lucide-react";
import { Empty, Markdown, Sheet } from "./components";
import {
  activityTime,
  applicationLabel,
  evidenceLabel,
  executorLabel,
  obligationLabel,
  settingsLine,
} from "./v2model";
import {
  checkGroups,
  checkLog,
  checkOutcome,
  checkReason,
  checkTitle,
  compact,
  planMarkdown,
  normalizationNote,
  planWindowMovement,
  tokenSplit,
} from "./deliveryReviewModel";
import type {
  V2ChangedFile,
  V2Evidence,
  V2Job,
  V2Plan,
  V2Resources,
  V2RunDetail,
} from "./types";

function ChangedFile({ entry }: { entry: V2ChangedFile }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const diff = entry.review?.state === "available" ? entry.review.diff : null;
  const reason =
    (
      {
        "base-unavailable": "Original bytes unavailable",
        "missing-bytes": "Snapshot unavailable",
        "hash-mismatch": "Snapshot changed",
        binary: "Binary file",
        "too-large": "File exceeds preview size",
        "preview-limit": "Preview size reached",
        "unsafe-path": "Unsafe path",
      } as Record<string, string>
    )[entry.review?.reason || ""] || "Diff unavailable for this candidate";
  return (
    <>
      <button
        ref={trigger}
        className="changed-file"
        onClick={() => setOpen(true)}
        aria-label={`Review ${entry.path}`}
      >
        <FileCode2 size={21} />
        <span>
          <strong>{entry.path.split("/").at(-1)}</strong>
          <small>{entry.path.split("/").slice(0, -1).join("/")}</small>
        </span>
        <span className="review-badge">
          {(
            { add: "Created", delete: "Deleted", update: "Modified" } as Record<
              string,
              string
            >
          )[entry.kind] || entry.kind}
        </span>
        <ChevronRight size={17} />
      </button>
      <Sheet
        title={entry.path.split("/").at(-1) || "Changes"}
        open={open}
        onClose={() => setOpen(false)}
        returnFocus={trigger}
      >
        <div className="delivery-artifact">
          <p className="review-meta">{entry.path}</p>
          {diff ? (
            <pre className="delivery-diff" aria-label="Frozen candidate diff">
              {diff.split("\n").map((line, i) => (
                <span
                  key={i}
                  data-kind={
                    line.startsWith("+")
                      ? "add"
                      : line.startsWith("-")
                        ? "delete"
                        : "context"
                  }
                >
                  {line || " "}
                </span>
              ))}
            </pre>
          ) : (
            <p className="review-notice">{reason}</p>
          )}
        </div>
      </Sheet>
    </>
  );
}

function downloadPlan(plan: V2Plan) {
  const url = URL.createObjectURL(
    new Blob([planMarkdown(plan)], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `plan-r${plan.revision}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PlanReview({
  detail,
  children,
}: {
  detail: V2RunDetail;
  children?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState(false);
  const sourceButton = useRef<HTMLButtonElement>(null);
  const latest = detail.plans.at(-1);
  const plan = detail.plans.find((p) => p.plan_id === selected) || latest;
  if (!plan)
    return (
      <>
        <Empty
          title={
            detail.jobs.some((job) =>
              ["reserved", "active"].includes(job.status),
            )
              ? "Preparing plan"
              : "No plan recorded"
          }
        />
        {children}
      </>
    );
  const current = plan.plan_id === latest?.plan_id;
  const planSections = [
    ["Acceptance", plan.body.acceptance || []],
    ["Invariants", plan.body.invariants || []],
    ["Exclusions", plan.body.exclusions || []],
    ["Risks", plan.body.risks],
    ["Unknowns", plan.body.unknowns],
    ["Questions", plan.body.questions.map((question) => question.text)],
  ] as const;
  return (
    <section className="review-card plan-review">
      <header className="review-card-heading">
        <span className="review-heading-icon">
          <FileText size={22} />
        </span>
        <div>
          <h2>Plan</h2>
          <span className="review-meta">
            {plan.status} · revision {plan.revision}
            {plan.body.preparation && <span title={plan.body.preparation.provenance}> · From task</span>}
          </span>
        </div>
        <div className="review-tools">
          {detail.plans.length > 1 && (
            <select
              aria-label="Plan revision"
              value={plan.plan_id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {detail.plans.map((p) => (
                <option key={p.plan_id} value={p.plan_id}>
                  r{p.revision}
                </option>
              ))}
            </select>
          )}
          <button
            className="icon-button"
            aria-label="Download plan.md"
            disabled={plan.malformed}
            onClick={() => downloadPlan(plan)}
          >
            <ArrowDownToLine size={19} />
          </button>
        </div>
      </header>
      <div className="plan-review-layout">
        <div className="plan-review-main">
          {plan.malformed ? (
            <>
              <p className="review-notice">Plan needs revision</p>
              <pre className="review-code">
                {plan.raw_text || "Plan source unavailable"}
              </pre>
            </>
          ) : (
            <>
              {plan.body.outcome && (
                <div className="plan-outcome">
                  <Markdown raw={plan.body.outcome} />
                </div>
              )}
              {!!plan.body.scope.length && (
                <section className="plan-scope">
                  <h3>Scope</h3>
                  <ul>
                    {plan.body.scope.map((scope, index) => (
                      <li key={index}>
                        <FileCode2 size={15} />
                        <span>{scope}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="plan-steps">
                <h3>Steps</h3>
                <ol className="plan-step-list">
                  {plan.body.steps.map((step, index) => (
                    <li key={index}>
                      <span className="plan-step-number">{index + 1}</span>
                      <Markdown raw={step.title} />
                    </li>
                  ))}
                </ol>
              </section>
              {!!plan.body.checks.length && (
                <section className="plan-checklist">
                  <h3>
                    <ListChecks size={18} />
                    Acceptance checks
                  </h3>
                  <ul>
                    {plan.body.checks.map((check, index) => (
                      <li key={index}>
                        <span className="plan-check-marker" />
                        <Markdown raw={check} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="plan-major-sections">
                {planSections.map(([label, entries]) =>
                  entries.length === 0 && label !== "Risks" && label !== "Unknowns" ? null : (
                    <section className="plan-major-section" key={label}>
                      <h3>{label}</h3>
                      {entries.length ? (
                        <ul>
                          {entries.map((entry, index) => (
                            <li key={index}>
                              <Markdown raw={entry} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="review-meta">None</p>
                      )}
                    </section>
                  ),
                )}
              </div>
            </>
          )}
          {current ? (
            children
          ) : (
            <p className="review-notice">
              Earlier revision ·{" "}
              <button onClick={() => setSelected(null)}>Latest plan</button>
            </p>
          )}
        </div>
        <aside className="plan-artifacts" aria-label="Artifacts">
          <h3>Artifacts</h3>
          <button ref={sourceButton} onClick={() => setSource(true)}>
            <FileText size={18} />
            <span>
              <strong>plan.md</strong>
              <small>Revision {plan.revision}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          {detail.candidate?.changed.map((entry) => (
            <div className="plan-artifact-file" key={entry.path}>
              <FileCode2 size={17} />
              <span>{entry.path}</span>
            </div>
          ))}
        </aside>
      </div>
      <Sheet
        title={`plan.md · r${plan.revision}`}
        open={source}
        onClose={() => setSource(false)}
        returnFocus={sourceButton}
      >
        <div className="delivery-artifact">
          <button
            className="secondary"
            disabled={plan.malformed}
            onClick={() => downloadPlan(plan)}
          >
            <ArrowDownToLine size={17} />
            Download
          </button>
          <Markdown raw={planMarkdown(plan)} />
        </div>
      </Sheet>
    </section>
  );
}

function checkCountLine(entry: V2Evidence) {
  const executed = entry.counts?.executed;
  const selected = entry.counts?.selected;
  if (executed != null && selected != null)
    return entry.state === "satisfied"
      ? `${executed} of ${selected} tests passed`
      : `${executed} of ${selected} tests ran`;
  if (executed != null) return `${executed} tests ran`;
  return checkReason(entry.reason) || "No result";
}

export function ChecksReview({
  detail,
  children,
}: {
  detail: V2RunDetail;
  children?: ReactNode;
}) {
  const groups = checkGroups(detail.evidence);
  const passed = groups.filter((g) => g.current.state === "satisfied").length;
  return (
    <section className="review-card">
      <header className="review-card-heading">
        <span className="review-heading-icon">
          <ListChecks size={22} />
        </span>
        <div>
          <h2>Verification</h2>
          <span className="review-meta">
            {groups.length
              ? `${passed} of ${groups.length} passed`
              : "No checks yet"}
          </span>
        </div>
      </header>
      {!!groups.length && (
        <div
          className="check-meter"
          aria-label={`${passed} of ${groups.length} checks passed`}
        >
          {groups.map((g) => (
            <span
              key={g.current.criterion_id}
              data-pass={g.current.state === "satisfied"}
            />
          ))}
        </div>
      )}
      <div className="verification-list">
        {groups.map(({ current, previous }) => (
          <article
            className="review-check"
            data-state={current.state}
            key={current.criterion_id}
          >
            <header>
            <span className="check-status-icon">
              {current.state === "satisfied" ? (
                <CheckCircle2 size={21} />
              ) : (
                <CircleHelp size={21} />
              )}
            </span>
            <span className="check-summary">
              <strong>{checkTitle(current)}</strong>
              <span className="review-meta">
                {checkCountLine(current)} ·{" "}
                <time>{activityTime(current.created_at)}</time>
              </span>
            </span>
            <span
              className="review-badge"
              data-pass={current.state === "satisfied"}
            >
              {evidenceLabel(current)}
            </span>
            </header>
            {((current.exitCode != null && current.exitCode !== 0) ||
              checkOutcome(current)) && (
              <div className="check-result">
                {current.exitCode != null && current.exitCode !== 0 && (
                  <span>Exit {current.exitCode}</span>
                )}
                {checkOutcome(current) && <span>{checkOutcome(current)}</span>}
              </div>
            )}
            {checkLog(current) && (
              <details className="check-log">
                <summary>Log</summary>
                <pre>{checkLog(current)}</pre>
              </details>
            )}
            {!!previous.length && (
              <section className="check-history">
                <h3>Previous runs</h3>
                <ul>
                  {previous.map((entry, index) => (
                    <li key={index}>
                      <span>{evidenceLabel(entry)}</span>
                      <span>{checkCountLine(entry)}</span>
                      <time>{activityTime(entry.created_at)}</time>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        ))}
      </div>
      {detail.result && !!detail.result.remaining_obligations.length && (
        <section className="remaining-checks">
          <h3>Still needed</h3>
          <ul>
            {detail.result.remaining_obligations.map((o, i) => (
              <li key={i}>{obligationLabel(o)}</li>
            ))}
          </ul>
        </section>
      )}
      {children}
    </section>
  );
}

export function ChangesReview({
  detail,
  children,
}: {
  detail: V2RunDetail;
  children?: ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const candidate =
    selected && selected !== detail.candidate?.candidate_id
      ? detail.candidates.find((c) => c.candidate_id === selected) ||
        detail.candidate
      : detail.candidate;
  const current = candidate?.candidate_id === detail.candidate?.candidate_id;
  const application = detail.applications
    ?.filter((a) => a.candidate_id === candidate?.candidate_id)
    .at(-1);
  return (
    <section className="review-card">
      <header className="review-card-heading">
        <span className="review-heading-icon">
          <GitBranch size={22} />
        </span>
        <div>
          <h2>Changes</h2>
          <span className="review-meta">
            {candidate
              ? `${candidate.generation} · ${candidate.changed.length} ${candidate.changed.length === 1 ? "file" : "files"}`
              : "No candidate yet"}
          </span>
        </div>
        <span className="review-badge">
          {application ? applicationLabel(application.state) : "Not applied"}
        </span>
      </header>
      {detail.candidates.length > 1 && (
        <label className="candidate-picker">
          Candidate
          <select
            value={candidate?.candidate_id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {detail.candidates.map((c) => (
              <option key={c.candidate_id} value={c.candidate_id}>
                {c.generation}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="changed-files">
        {candidate?.changed.map((entry) => (
          <ChangedFile key={entry.path} entry={entry} />
        ))}
      </div>
      {current && children}
      {!!detail.applications?.length && (
        <section className="application-history">
          <h3>Application history</h3>
          {detail.applications
            .slice()
            .reverse()
            .map((a) => (
              <div key={a.application_id}>
                <GitBranch size={17} />
                <span>
                  <strong>{applicationLabel(a.state)}</strong>
                  <small>
                    {a.writes} {a.writes === 1 ? "file" : "files"} ·{" "}
                    {activityTime(a.updated_at)}
                  </small>
                </span>
              </div>
            ))}
        </section>
      )}
    </section>
  );
}

export function ActivityReview({
  detail,
  children,
}: {
  detail: V2RunDetail;
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState("messages");
  const entries = detail.activity
    .filter((entry) => filter === "all" || entry.kind === "message")
    .slice()
    .reverse();
  return (
    <section className="review-card">
      <header className="review-card-heading">
        <span className="review-heading-icon">
          <Activity size={22} />
        </span>
        <div>
          <h2>Activity</h2>
          <span className="review-meta">
            Last observed{" "}
            {activityTime(detail.activity.at(-1)?.at || null) || "—"}
          </span>
        </div>
      </header>
      <div className="delivery-agents">
        {detail.agents.map((agent, i) => (
          <div key={i}>
            <span className="agent-avatar">
              {executorLabel(agent.executor).slice(0, 1)}
            </span>
            <div>
              <strong>
                {agent.role === "subagent"
                  ? "Subagent"
                  : executorLabel(agent.executor)}
              </strong>
              <small>
                {agent.model ||
                  (agent.role === "main" ? "Main agent" : agent.id)}
              </small>
            </div>
          </div>
        ))}
      </div>
      <div className="activity-filter">
        {[
          ["messages", "Messages"],
          ["all", "All activity"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!entries.length && (
        <p className="review-notice">
          No {filter === "messages" ? "messages" : "activity"} recorded
        </p>
      )}
      <div className="delivery-timeline">
        {entries.map((entry, index) => (
          <article key={`${entry.job_id}:${index}`}>
            <span className="timeline-icon">
              {entry.kind === "command" ? (
                <Terminal size={16} />
              ) : (
                <Activity size={16} />
              )}
            </span>
            <header>
              <strong>
                {entry.kind === "message"
                  ? executorLabel(
                      entry.agent.executor || detail.settings.executor,
                    )
                  : entry.kind}
              </strong>
              <time>{activityTime(entry.at)}</time>
            </header>
            {entry.kind === "message" ? (
              <Markdown raw={entry.summary || ""} />
            ) : (
              <p className="activity-event">{entry.summary || entry.kind}</p>
            )}
          </article>
        ))}
      </div>
      {children}
      <section className="run-details">
        <h3>Run</h3>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>
              {detail.applications?.at(-1)
                ? applicationLabel(detail.applications.at(-1)!.state)
                : detail.stage.stages[detail.stage.current]}
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{new Date(detail.run.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(detail.run.updated_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Executor</dt>
            <dd>{settingsLine(detail.settings)}</dd>
          </div>
          <div className="run-id">
            <dt>Run ID</dt>
            <dd>{detail.run.run_id}</dd>
          </div>
        </dl>
        {!!detail.truncated?.length && (
          <p className="review-notice">Some saved history is unavailable.</p>
        )}
      </section>
    </section>
  );
}

export function UsageSummary({ resources, jobs = [] }: { resources: V2Resources | null; jobs?: V2Job[] }) {
  const window = planWindowMovement(jobs);
  const used = resources?.provenance.measuredTokens.total;
  const allowance = resources?.unit === "tokens" ? resources.allowance : null;
  const exceeded = used != null && allowance != null && used > allowance;
  const over = exceeded ? used - allowance : null;
  const live = resources?.enforcement === "threshold";
  const stopped = Boolean(resources?.budget?.stopRequested);
  const split = tokenSplit(resources);
  const note = normalizationNote(resources);
  return (
    <div className="usage-summary" data-exceeded={exceeded}>
      <span>Tokens</span>
      <strong className="usage-number">
        {used != null && used > 0 ? used.toLocaleString() : "—"}
      </strong>
      {allowance != null && (
        <div className="usage-threshold">
          <progress
            aria-label={`${used || 0} of ${allowance} tokens`}
            max={allowance}
            value={used || 0}
          />
          {/* Two different promises, never one label. `advisory` is checked when
              a job is admitted and never interrupts one already running;
              `threshold` asks a running job to stop at the observed crossing,
              which the turn that crossed has already been paid for (DLV-114). */}
          <span title={live ? "Asks a running job to stop at the observed crossing" : "Checked when a job is admitted; a running job is not stopped by it"}>
            {allowance.toLocaleString()} {live ? "stop limit" : "admission limit"}
          </span>
          {over != null && <b>+{over.toLocaleString()}</b>}
        </div>
      )}
      {stopped && (
        <small className="usage-split" data-flagged="true" title={resources?.budget?.basis || undefined}>
          Stopped at limit · {(resources?.budget?.overshoot || 0).toLocaleString()} over
        </small>
      )}
      {split && (split.cached > 0 || split.output > 0) && (
        <small className="usage-split">
          {compact(split.fresh)} uncached · {compact(split.cached)} cached · {compact(split.output)} out
          {split.reasoning > 0 && <> ({compact(split.reasoning)} reasoning)</>}
        </small>
      )}
      {split?.raw != null && (
        <small className="usage-split" title="The provider's counter is cumulative for a resumed thread, so it restates the earlier job's usage">
          provider counter {compact(split.raw)}
        </small>
      )}
      {note && (
        <small className="usage-split" data-flagged="true" title="Some readings could not be normalized, so this total is an upper bound">
          {note}
        </small>
      )}
      {window && (
        <small className="usage-split" title="A shared plan window, moved by everything on the account during this run — not this run's consumption">
          plan window {window.before}% → {window.after}%
        </small>
      )}
    </div>
  );
}
