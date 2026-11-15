import { useId, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  FileCode2,
  FileText,
  GitBranch,
  Layers3,
  ListChecks,
  MessageSquare,
  Radio,
  Search,
  Shield,
  Terminal,
  Workflow,
} from "lucide-react";
import { Markdown } from "./components";
import { bareTitle } from "./deliveryHomeModel";
import { LocalActions, type LocalRunView } from "./LocalDelivery";
import { DeliveryWorkshop } from "./DeliveryWorkshop";
import {
  localRunActivity,
  type LocalActivityKind,
} from "./localRunActivityModel";
import {
  LOCAL_CHECKS,
  localCheckLabel,
  localFailureTitle,
  localRunLabel,
  localRunStages,
} from "./localRunModel";
import "./local-run-game.css";

const tools = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "brief", label: "Brief", icon: BookOpen },
  { id: "verification", label: "Verification", icon: ListChecks },
  { id: "changes", label: "Changes", icon: FileCode2 },
  { id: "worktree", label: "Worktree", icon: GitBranch },
  { id: "limits", label: "Host limits", icon: Shield },
] as const;
type Tool = (typeof tools)[number]["id"];
const eventIcons: Record<LocalActivityKind, typeof Search> = {
  read: Search,
  edit: Code2,
  command: Terminal,
  check: ListChecks,
  message: MessageSquare,
  event: Workflow,
  failure: Radio,
};

export function LocalRunGame({
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
  const [tool, setTool] = useState<Tool>("activity");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const activity = localRunActivity(run);
  const stages = localRunStages(run);
  const passed = run.checks.filter(
    (check) => check.exit === 0 && !check.error,
  ).length;
  const title = bareTitle(run.work.title, run.work.id).replace(
    /\s+— criteria$/u,
    "",
  );
  const files =
    patch
      ?.split(/\r?\n/u)
      .filter((line) => line.startsWith("diff --git "))
      .map((line) => line.replace(/^diff --git a\/.* b\//u, "")) || [];
  const selectTool = (index: number) => {
    const next = (index + tools.length) % tools.length;
    setTool(tools[next].id);
    tabs.current[next]?.focus();
  };
  return (
    <div className="run-game" data-phase={run.phase}>
      <header className="run-game-heading">
        <div className="run-game-identity">
          <span className="run-game-tag">
            <Layers3 size={13} /> {run.work.id}
          </span>
          <span>{run.work.campaign || "Delivery"}</span>
          <span className="run-game-lane">
            <GitBranch size={12} /> Local
          </span>
        </div>
        <h1>{title}</h1>
        <div className="run-game-meta">
          <span className="run-game-state" data-active={activity.active}>
            <i />
            {localRunLabel(run)}
          </span>
          {run.settings && (
            <span>
              {[run.settings.executor, run.settings.model, run.settings.effort]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
      </header>

      <nav className="run-game-journey" aria-label="Delivery stages">
        {stages.map((stage, index) => (
          <div
            key={stage.label}
            data-stage-state={stage.state}
            aria-current={
              stage.state === "current" || stage.state === "stopped"
                ? "step"
                : undefined
            }
          >
            <span>
              {stage.state === "done" ? (
                <Check size={13} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <strong>{stage.label}</strong>
            {index < stages.length - 1 && (
              <ChevronRight size={13} className="run-game-stage-link" />
            )}
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

      <DeliveryWorkshop
        station={activity.station}
        active={activity.active}
        label={activity.label}
        detail={activity.detail}
        phase={run.interrupted ? "interrupted" : run.phase}
        completed={run.phase === "shipped"}
        onStationSelect={(station) => {
          setTool(
            station === "forge"
              ? "changes"
              : station === "lab"
                ? "verification"
                : station === "review"
                  ? "brief"
                  : "activity",
          );
          requestAnimationFrame(() => {
            panel.current?.focus({ preventScroll: true });
            panel.current?.parentElement?.scrollIntoView({
              block: "start",
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
          });
        }}
      />

      <div className="run-game-commandbar">
        <span className="run-game-command-label">
          <Workflow size={15} /> Mission controls
        </span>
        <LocalActions
          run={run}
          busy={busy}
          act={(action) => {
            if (action === "review") setTool("changes");
            act(action);
          }}
        />
      </div>

      <div className="run-game-console">
        <div
          className="run-game-tools"
          role="tablist"
          aria-label="Session tools"
        >
          {tools.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-${item.id}`}
              aria-controls={`${id}-panel`}
              aria-selected={tool === item.id}
              tabIndex={tool === item.id ? 0 : -1}
              onClick={() => setTool(item.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  selectTool(index + (event.key === "ArrowRight" ? 1 : -1));
                }
                if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  selectTool(event.key === "Home" ? 0 : tools.length - 1);
                }
              }}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.id === "verification" && (
                <small>
                  {passed}/{LOCAL_CHECKS.length}
                </small>
              )}
              {item.id === "changes" && files.length > 0 && (
                <small>{files.length}</small>
              )}
            </button>
          ))}
        </div>
        <section
          ref={panel}
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${tool}`}
          tabIndex={0}
          className="run-game-panel"
        >
          {tool === "activity" && (
            <section aria-label="Activity" className="run-game-activity">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Mission feed</span>
                  <h2>
                    <Activity size={17} />
                    Activity
                  </h2>
                </div>
                <details className="run-game-feed-help">
                  <summary aria-label="Activity information">i</summary>
                  <p>
                    Recent recorded events. File details depend on the executor.
                  </p>
                </details>
              </div>
              <div
                className="run-game-counters"
                aria-label="Recorded activity counts"
              >
                <span>
                  <Search size={14} />
                  <strong>{activity.counts.reads}</strong> Explore
                </span>
                <span>
                  <Code2 size={14} />
                  <strong>{activity.counts.edits}</strong> Edits
                </span>
                <span>
                  <Terminal size={14} />
                  <strong>{activity.counts.commands}</strong> Commands
                </span>
                <span>
                  <ListChecks size={14} />
                  <strong>{activity.counts.checks}</strong> Passed
                </span>
              </div>
              {activity.events.length ? (
                <ol className="run-game-events">
                  {activity.events.slice(0, 30).map((entry, index) => {
                    const Icon = eventIcons[entry.kind];
                    return (
                      <li
                        key={entry.id}
                        data-kind={entry.kind}
                        data-latest={index === 0}
                      >
                        <span className="run-game-event-node">
                          <Icon size={16} />
                        </span>
                        <div className="run-game-event-body">
                          <div>
                            <strong>{entry.label}</strong>
                            <time dateTime={entry.at}>
                              {entry.at.replace(/^.*T/u, "").slice(0, 8)} UTC
                            </time>
                          </div>
                          {entry.detail && <code>{entry.detail}</code>}
                          <details>
                            <summary>
                              Event <ArrowDown size={11} />
                            </summary>
                            <pre>
                              {entry.summary === run.error ||
                              entry.summary.startsWith("native session exited")
                                ? "Session failed · see error details"
                                : entry.summary}
                            </pre>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="quiet">Awaiting activity</p>
              )}
            </section>
          )}

          {tool === "brief" && (
            <section aria-label="Plan" className="run-game-brief">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Work brief</span>
                  <h2>
                    <BookOpen size={18} />
                    Plan
                  </h2>
                </div>
                <span className="run-game-tag">{run.work.id}</span>
              </div>
              {run.work.brief ? (
                <Markdown raw={run.work.brief} />
              ) : (
                <p className="quiet">Plan not recorded</p>
              )}
            </section>
          )}

          {tool === "verification" && (
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
                  const check = run.checks.find((entry) => entry.name === name);
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
                          <small>
                            CHECK {String(index + 1).padStart(2, "0")}
                          </small>
                          <strong>{name}</strong>
                        </span>
                        <em>{localCheckLabel(check)}</em>
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
                  {run.handover ? run.handover.acceptance.state : "Not ready"}
                </strong>
              </div>
              {run.usage && (
                <details className="run-game-disclosure">
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
          )}

          {tool === "changes" && (
            <section aria-label="Changes">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Build output</span>
                  <h2>
                    <FileCode2 size={18} />
                    Changes
                  </h2>
                </div>
                {run.head && (
                  <code className="run-game-tag">{run.head.slice(0, 12)}</code>
                )}
              </div>
              {files.length > 0 && (
                <ul className="run-game-files">
                  {files.map((file, index) => (
                    <li key={`${file}-${index}`}>
                      <FileText size={16} />
                      <code>{file}</code>
                      <Check size={14} />
                    </li>
                  ))}
                </ul>
              )}
              {patch === null ? (
                <div className="run-game-output">
                  <FileCode2 size={38} />
                  <strong>
                    {run.head ? "Candidate recorded" : "Candidate pending"}
                  </strong>
                  <button
                    className="secondary"
                    disabled={busy || !run.head}
                    onClick={() => act("review")}
                  >
                    Review diff <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <details className="run-game-disclosure" open>
                  <summary>Patch</summary>
                  <pre className="run-game-patch">{patch || "No changes"}</pre>
                </details>
              )}
              {run.risk?.required && (
                <details className="run-game-disclosure">
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
            </section>
          )}

          {tool === "worktree" && (
            <section aria-label="Worktree">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Workspace</span>
                  <h2>
                    <GitBranch size={18} />
                    Worktree
                  </h2>
                </div>
              </div>
              <div className="run-game-branch">
                <span className="run-game-branch-node">
                  <GitBranch size={26} />
                </span>
                <div>
                  <small>Branch</small>
                  <code>{run.branch}</code>
                </div>
              </div>
              <dl className="run-game-worktree-facts">
                <div>
                  <dt>Path</dt>
                  <dd>
                    <code>{run.workspace}</code>
                  </dd>
                </div>
                <div>
                  <dt>Candidate</dt>
                  <dd>
                    <code>{run.head || "Not recorded"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Current head</dt>
                  <dd>
                    <code>{run.current_head || "Not recorded"}</code>
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {tool === "limits" && (
            <section aria-label="Host limits">
              <div className="run-game-panel-heading">
                <div>
                  <span className="eyebrow">Local boundary</span>
                  <h2>
                    <Shield size={18} />
                    Host limits
                  </h2>
                </div>
              </div>
              <div className="run-game-boundary">
                <span className="run-game-boundary-emblem">
                  <Shield size={44} strokeWidth={1} />
                </span>
                <div>
                  <strong>Host access</strong>
                  <p>
                    Credential scrub prevents accidents, not deliberate host
                    access.
                  </p>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
