import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronDown, Code2, ListChecks, MessageSquare, Radio, Search, Terminal, Workflow } from "lucide-react";
import { localRunActivity, type LocalActivityEvent, type LocalActivityKind } from "./localRunActivityModel";
import type { LocalRunView } from "./LocalDelivery";
import { LocalChat } from "./LocalChat";
import { chatThread } from "./localChatModel";
import { client, pmKeys } from "./state";
import { read } from "./api";
import { ErrorNotice } from "./components";

const eventIcons: Record<LocalActivityKind, typeof Search> = {
  read: Search, edit: Code2, command: Terminal, check: ListChecks,
  message: MessageSquare, event: Workflow, failure: Radio,
};
const pageSize = 30;

export function LocalRunActivityPanel({
  visibleEvents, fileFilter, setFileFilter, viewRun, focusId, replay,
}: {
  visibleEvents: LocalActivityEvent[];
  fileFilter: string | null;
  setFileFilter: (value: string | null) => void;
  viewRun: LocalRunView;
  focusId?: string;
  replay: boolean;
}) {
  const [mode, setMode] = useState<"feed" | "chat">("feed");
  const [limit, setLimit] = useState(pageSize);
  const [cursors, setCursors] = useState<number[]>([]);
  const before = replay ? undefined : cursors.at(-1);
  const archive = useQuery({
    queryKey: pmKeys.localActivityPage(viewRun.run_id, before ?? -1),
    queryFn: ({ signal }) => read<{ activity: LocalRunView["activity"]; more: boolean }>(
      "/api/delivery/v2/local/activity?" + new URLSearchParams({ id: viewRun.run_id, before: String(before) }), signal),
    enabled: before !== undefined, staleTime: Infinity, retry: false,
  }, client);
  const events = before === undefined ? visibleEvents :
    localRunActivity({ ...viewRun, activity: archive.data?.activity ?? [] }).events
      .filter(entry => !fileFilter || entry.paths.includes(fileFilter));
  const older = !replay && (before === undefined ? viewRun.earlier_activity : archive.data?.more);
  const oldest = before === undefined ? viewRun.activity[0]?.seq : archive.data?.activity[0]?.seq;
  const list = useRef<HTMLOListElement>(null);
  const target = events.find((entry) => entry.id === focusId);
  const shown = events.slice(0, limit);
  if (target && !shown.includes(target)) shown.push(target);
  const hasChat = !replay && (!!viewRun.canMessage || chatThread(viewRun, 1).length > 0);
  const chat = hasChat && mode === "chat" && before === undefined;

  useEffect(() => {
    if (focusId) { setMode("feed"); setCursors([]); }
  }, [focusId]);
  useEffect(() => {
    if (before !== undefined && archive.data) list.current?.scrollIntoView({ block: "start" });
  }, [before, archive.data]);
  useEffect(() => {
    if (!focusId || chat) return;
    const frame = requestAnimationFrame(() => {
      const row = list.current?.querySelector<HTMLElement>(
        `[data-event-id="${CSS.escape(focusId)}"]`,
      );
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, chat]);

  return (
    <section aria-label="Activity" className="run-game-activity">
      <div className="run-feed-toolbar">
        <div role="group" aria-label="Activity view" className="run-feed-mode">
          <button type="button" aria-pressed={!chat} onClick={() => setMode("feed")}>
            <Activity size={16} />Mission feed
          </button>
          {hasChat && <button type="button" aria-pressed={chat} onClick={() => { setMode("chat"); setCursors([]); }}>
            <MessageSquare size={15} />Chat
          </button>}
        </div>
        {before !== undefined ? <button type="button" className="secondary" onClick={() => setCursors(ids => ids.slice(0, -1))}>Newer events</button>
          : !chat && <span>{events.length}{older && "+"} events</span>}
      </div>
      {chat ? <LocalChat run={viewRun} compact limit={Infinity} /> : <>
        {fileFilter && <button type="button" className="stage-filter" onClick={() => setFileFilter(null)}>
          {fileFilter} ×
        </button>}
        <ol className="run-game-events" ref={list} aria-label="Mission feed">
          {shown.map((entry, index) => {
            const Icon = eventIcons[entry.kind];
            const title = entry.label === "Event recorded" ? entry.summary : entry.label;
            const firstLine = title.split("\n", 1)[0];
            const label = firstLine.length > 96 ? firstLine.slice(0, 95).trimEnd() + "…" : firstLine;
            const text = entry.messageText || entry.summary;
            const extra = text !== label || entry.id === focusId;
            const heading = <>
              <Icon className="run-feed-icon" size={16} />
              <strong>{label}</strong>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString([], { hour12: false })}</time>
              {extra && <ChevronDown className="run-feed-chevron" size={14} />}
            </>;
            return <li key={entry.id} data-kind={entry.kind} data-latest={index === 0}
              data-event-id={entry.id} tabIndex={entry.id === focusId ? -1 : undefined}>
              {extra ? <details open={entry.id === focusId || undefined}>
                <summary>{heading}</summary>
                <pre>{text}</pre>
                {entry.messageExcerpt && <small className="quiet">Recorded excerpt</small>}
              </details> : <div className="run-feed-line">{heading}</div>}
            </li>;
          })}
        </ol>
        {before !== undefined && archive.error
          ? <ErrorNotice error={archive.error} retry={() => void archive.refetch()} />
          : !shown.length && <p className="quiet">{before !== undefined && archive.isPending ? "Loading…" : fileFilter ? "No matching events" : "Awaiting activity"}</p>}
        {(limit < events.length || (older && oldest !== undefined)) && <button type="button" className="secondary run-feed-older"
          onClick={() => {
            if (limit < events.length) setLimit(current => current + pageSize);
            else if (oldest !== undefined) setCursors(ids => [...ids, oldest]);
          }}>Older events</button>}
      </>}
    </section>
  );
}
