import {
  Activity,
  ArrowDown,
  Code2,
  ListChecks,
  MessageSquare,
  Radio,
  Search,
  Terminal,
  Workflow,
} from "lucide-react";
import type {
  LocalActivityEvent,
  LocalActivityKind,
  localRunActivity,
} from "./localRunActivityModel";
import type { LocalRunView } from "./LocalDelivery";
import type { LocalTimeline } from "./localRunScene";
import { clock } from "./localRunLiveness";
import { useEffect, useRef } from "react";
const eventIcons: Record<LocalActivityKind, typeof Search> = {
  read: Search,
  edit: Code2,
  command: Terminal,
  check: ListChecks,
  message: MessageSquare,
  event: Workflow,
  failure: Radio,
};
export function LocalRunActivityPanel({
  activity,
  visibleEvents,
  fileFilter,
  setFileFilter,
  timeline,
  viewRun,
  focusId,
}: {
  activity: ReturnType<typeof localRunActivity>;
  visibleEvents: LocalActivityEvent[];
  fileFilter: string | null;
  setFileFilter: (value: string | null) => void;
  timeline: LocalTimeline;
  viewRun: LocalRunView;
  focusId?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const shown = visibleEvents.slice(0, 30);
  const target = visibleEvents.find((entry) => entry.id === focusId);
  if (target && !shown.includes(target)) shown.push(target);
  useEffect(() => {
    if (!focusId) return;
    const frame = requestAnimationFrame(() => {
      const row = list.current?.querySelector<HTMLElement>(
        `[data-event-id="${CSS.escape(focusId)}"]`,
      );
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId]);
  return (
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
          <p>Recent recorded events. File details depend on the executor.</p>
        </details>
      </div>
      <div className="run-game-counters" aria-label="Recorded activity counts">
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
      {visibleEvents.length ? (
        <>
          {fileFilter && (
            <button
              className="stage-filter"
              onClick={() => setFileFilter(null)}
            >
              {fileFilter} ×
            </button>
          )}
          <ol className="run-game-events" ref={list}>
            {shown.map((entry, index) => {
              const Icon = eventIcons[entry.kind];
              return (
                <li
                  key={entry.id}
                  data-kind={entry.kind}
                  data-latest={index === 0}
                  data-event-id={entry.id}
                  tabIndex={entry.id === focusId ? -1 : undefined}
                >
                  <span className="run-game-event-node">
                    <Icon size={16} />
                  </span>
                  <div className="run-game-event-body">
                    <div>
                      <strong>{entry.label}</strong>
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleTimeString([], {
                          hour12: false,
                        })}{" "}
                        ·{" "}
                        {timeline.start === null
                          ? "—"
                          : clock(Date.parse(entry.at) - timeline.start)}
                      </time>
                    </div>
                    {entry.detail &&
                      (entry.kind === "message" ? (
                        <p>{entry.detail}</p>
                      ) : (
                        <code>{entry.detail}</code>
                      ))}
                    <details open={entry.id === focusId || undefined}>
                      <summary>
                        Event <ArrowDown size={11} />
                      </summary>
                      <pre>
                        {entry.summary === viewRun.error ||
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
        </>
      ) : (
        <p className="quiet">Awaiting activity</p>
      )}
    </section>
  );
}
