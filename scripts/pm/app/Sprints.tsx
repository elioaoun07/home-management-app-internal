import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  CircleDot,
  Flag,
  Layers3,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { client, go, pmKeys, useCommand, useRoute, useWorld } from "./state";
import { PendingCommand, transport } from "./transport";
import { useV2Runs, useV2Session } from "./DeliveryV2";
import { Empty, ErrorNotice, PageTitle, Sheet, SpaceIcon } from "./components";
import { canDeliver, workPath } from "./model";
import {
  addCalendarDays,
  dateInTimezone,
  eraHotfixes,
  forecastSprints,
  mondayOf,
  sprintItemStatus,
  type EraHotfix,
} from "./sprintModel";
import type { Planning, Sprint, SprintMember } from "./planningTypes";
import type { World } from "./types";
import "./sprints.css";

const EMPTY: Planning = {
  schema: "pm-planning@1",
  revision: 0,
  sprints: [],
  deliverables: [],
};
const strategyName = (strategy: Sprint["strategy"]) =>
  strategy === "balanced" ? "Mixed modules" : "Module focus";
const fromWeek = (id: string) => `/sprints?week=${encodeURIComponent(id)}`;
const shortDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const range = (sprint: Pick<Sprint, "startDate" | "endExclusive">) =>
  `${shortDay(sprint.startDate)} – ${shortDay(addCalendarDays(sprint.endExclusive, -1))}`;
const memberTitle = (member: SprintMember, world: World) =>
  world.work.find(
    (work) =>
      work.id.toUpperCase() === member.workId &&
      work.file === member.origin.file,
  )?.title ||
  world.history.find((record) => record.workId === member.workId)?.text ||
  member.origin.alias;
const numeric = (value: string) => (value.trim() === "" ? null : Number(value));
/** Commands accept editable fields only; state and scope history are server-owned. */
type Draft = Pick<
  Sprint,
  | "id"
  | "name"
  | "goal"
  | "startDate"
  | "endExclusive"
  | "timezone"
  | "strategy"
  | "capacity"
  | "members"
>;
const draftPayload = (sprint: Draft): Draft => ({
  id: sprint.id,
  name: sprint.name,
  goal: sprint.goal,
  startDate: sprint.startDate,
  endExclusive: sprint.endExclusive,
  timezone: sprint.timezone,
  strategy: sprint.strategy,
  capacity: sprint.capacity,
  members: sprint.members,
});

function Ring({
  done,
  total,
  compact = false,
}: {
  done: number;
  total: number;
  compact?: boolean;
}) {
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className={`sprint-ring${compact ? " compact" : ""}`}
      style={{ "--progress": percent } as CSSProperties}
      role="img"
      aria-label={`${done} of ${total} delivered`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" />
        <circle
          className="ring-fill"
          cx="60"
          cy="60"
          r="51"
          pathLength="100"
          strokeDasharray={`${percent} 100`}
        />
      </svg>
      <div>
        <strong>
          {percent}
          <small>%</small>
        </strong>
        {!compact && <span>delivered</span>}
      </div>
    </div>
  );
}

/**
 * R72 — ERA chat reports in Now, shown on the current week as standalone
 * Hotfixes / Defects regardless of the week they were filed in. Not members:
 * they never count against planned points. Deliver opens the ordinary flow.
 */
function HotfixLane({
  hotfixes,
  from,
  canLaunch,
}: {
  hotfixes: EraHotfix[];
  from: string;
  canLaunch: boolean;
}) {
  const canSync = !!transport().capabilities.eraSync;
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const sync = async () => {
    setSyncing(true);
    setNote(null);
    try {
      const r = await transport().post<{
        imported: unknown[];
        waiting: number;
        error?: string;
      }>("era-issues/sync", {});
      setNote(
        r.imported.length
          ? `${r.imported.length} added`
          : r.waiting
            ? "Waiting for Undo"
            : "Up to date",
      );
      await client.invalidateQueries({ queryKey: pmKeys.all });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Couldn't refresh");
    } finally {
      setSyncing(false);
    }
  };
  if (!hotfixes.length && !canSync) return null;
  return (
    <section className="sprint-hotfixes" aria-labelledby="sprint-hotfixes-title">
      <div className="section-title">
        <h2 id="sprint-hotfixes-title">Hotfixes</h2>
        <span className="quiet">
          {note ?? (hotfixes.length ? `${hotfixes.length} from ERA` : "None")}
        </span>
        {canSync && (
          <button
            className="secondary"
            onClick={() => void sync()}
            disabled={syncing}
            aria-label="Refresh ERA reports"
          >
            <RefreshCw size={15} className={syncing ? "spin" : undefined} />
            Refresh
          </button>
        )}
      </div>
      <div className="sprint-items">
        {hotfixes.map(({ work, label, reported, comment }) => {
          const href = workPath(work, from);
          return (
            <article
              key={work.key}
              className="sprint-item"
              data-state="todo"
              data-hotfix={label.toLowerCase()}
            >
              <div className="sprint-item-mark">
                <Flag size={18} />
              </div>
              <a className="sprint-item-content" href={`#${href}`}>
                <span className="sprint-item-meta">
                  <b>{work.label}</b>
                  <span>{work.module}</span>
                  {reported && <span>{shortDay(reported)}</span>}
                </span>
                <h3>{work.title}</h3>
                {comment && <p className="sprint-hotfix-comment">{comment}</p>}
                <span className="sprint-item-bottom">
                  <span className={`sprint-hotfix-badge ${label.toLowerCase()}`}>
                    {label}
                  </span>
                </span>
              </a>
              {canDeliver(work) ? (
                <button
                  className="sprint-item-action"
                  disabled={!canLaunch}
                  onClick={() =>
                    go(
                      `/deliver/${encodeURIComponent(work.module)}/${encodeURIComponent(work.id)}?from=${encodeURIComponent(from)}`,
                    )
                  }
                >
                  <Zap size={14} />
                  Deliver
                </button>
              ) : (
                <a
                  className="sprint-item-action"
                  href={`#${href}`}
                  aria-label={`View ${work.label}`}
                >
                  <ChevronRight size={18} />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Shared by desktop and the relay. Launch remains the ordinary witnessed Delivery flow. */
export function Sprints() {
  const { world, runs, connected, connection, runError } = useWorld();
  const route = useRoute();
  const v2 = useV2Runs();
  const session = useV2Session();
  const command = useCommand();
  const planning = world.planning || EMPTY;
  const weeks = [...planning.sprints].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const [editor, setEditor] = useState<
    "forecast" | "edit" | "close" | "add" | null
  >(null);
  const [undo, setUndo] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!undo || command.isPending || command.error) return;
    const timer = setTimeout(() => setUndo(null), 4000);
    return () => clearTimeout(timer);
  }, [undo, command.isPending, command.error]);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const today = dateInTimezone(new Date(), weeks[0]?.timezone || "Asia/Beirut");
  const selected =
    weeks.find((week) => week.id === route.query.get("week")) ||
    weeks.find((week) => week.state === "active") ||
    weeks.find(
      (week) => week.startDate <= today && week.endExclusive > today,
    ) ||
    weeks.find((week) => week.state === "draft") ||
    weeks.at(-1);
  const writeBlock = !connected
    ? "Reconnect to start"
    : connection.bridge.state !== "local" &&
        connection.bridge.state !== "online"
      ? "Laptop offline"
      : !transport().capabilities.sprintWrites
        ? "Laptop setup required"
        : session.isPending
          ? "Checking connection…"
          : session.isError
            ? "Reconnect Delivery"
            : !session.data?.paired
              ? "Connect Delivery"
              : world.planningError
                ? "Repair sprint plan"
                : null;
  const writable = !writeBlock;
  const activeWeek = weeks.find((week) => week.state === "active");
  const startBlock =
    writeBlock ||
    (command.isPending
      ? "Saving…"
      : activeWeek && activeWeek.id !== selected?.id
        ? "Close the active week first"
        : !selected?.members.length
          ? "Add work to this week"
          : null);
  const statusFor = (member: SprintMember, sprint?: Sprint) => {
    const change = sprint?.scopeChanges
      .filter(
        (entry) => entry.workId === member.workId && entry.action !== "remove",
      )
      .at(-1);
    const current = sprintItemStatus(member, world, {
      v1: runs,
      v2: v2.data?.runs || [],
      readiness: world.planningReadiness,
      criteriaRevision:
        change?.criteriaRevision ||
        sprint?.commitment?.members.find(
          (item) => item.workId === member.workId,
        )?.criteriaRevision,
    });
    if (!sprint?.closed) return current;
    const state = sprint.closed.delivered.includes(member.workId)
      ? ("done" as const)
      : sprint.closed.cancelled.includes(member.workId)
        ? ("cancelled" as const)
        : ("todo" as const);
    return {
      ...current,
      state,
      label:
        state === "done"
          ? "Delivered"
          : state === "cancelled"
            ? "Cancelled"
            : "Unfinished at close",
      reasons: [],
      ready: false,
      run: null,
    };
  };
  const statsFor = (sprint: Sprint) => {
    const statuses = sprint.members.map((member) => ({
      member,
      ...statusFor(member, sprint),
    }));
    const done =
      sprint.state === "closed"
        ? sprint.closed?.delivered.length || 0
        : statuses.filter((item) => item.state === "done").length;
    const cancelled =
      sprint.state === "closed"
        ? sprint.closed?.cancelled.length || 0
        : statuses.filter((item) => item.state === "cancelled").length;
    return {
      statuses,
      done,
      cancelled,
      remaining: sprint.members.length - done - cancelled,
    };
  };
  async function act(
    body: Record<string, unknown>,
    inverse?: Record<string, unknown>,
  ) {
    const witnessed =
      body.action === "start"
        ? planning.sprints.find((week) => week.id === body.sprintId)?.members ||
          []
        : body.action === "add-member"
          ? [body.member as SprintMember]
          : null;
    const payload = {
      ...body,
      expectedRevision: body.expectedRevision ?? planning.revision,
      ...(witnessed
        ? {
            criteriaRevisions: Object.fromEntries(
              witnessed.map((member) => [
                member.workId,
                world.planningReadiness?.[member.workId]?.criteriaRevision ||
                  "",
              ]),
            ),
          }
        : {}),
    };
    const key = JSON.stringify(payload);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const reply = await command.mutateAsync({
        op: "planning",
        body: { ...payload, command_id: pending.current.id },
      });
      pending.current = null;
      setUndo(
        inverse
          ? {
              ...inverse,
              expectedRevision: reply.appliedRevision ?? planning.revision + 1,
            }
          : null,
      );
      setEditor(null);
      await client.invalidateQueries({ queryKey: pmKeys.all });
    } catch {
      /* ErrorNotice retains the actual refusal or pending receipt. */
    }
  }
  const stats = selected && statsFor(selected);
  const filter = route.query.get("status") || "all";
  const rows = stats?.statuses || [];
  const attention = rows.filter((row) =>
    ["review", "blocked", "needs-input", "missing"].includes(row.state),
  );
  const next =
    rows.find((row) => row.state === "review" && row.run) ||
    rows.find((row) => row.state === "active" && row.run) ||
    rows.find((row) => row.ready && row.work && canDeliver(row.work));
  const used =
    selected?.members.reduce((sum, member) => sum + (member.points || 0), 0) ||
    0;
  const review =
    selected?.members.reduce(
      (sum, member) => sum + (member.reviewMinutes || 0),
      0,
    ) || 0;
  const unknown =
    selected?.members.filter(
      (member) => member.points === null || member.reviewMinutes === null,
    ).length || 0;
  const estimateLabel = (field: "points" | "reviewMinutes", total: number) => {
    const known =
      selected?.members.filter((member) => member[field] !== null).length || 0;
    if (!known && selected?.members.length) return "—";
    return `${total}${known < (selected?.members.length || 0) ? "+" : ""}`;
  };
  const over =
    !!selected &&
    (used > selected.capacity.available ||
      review > selected.capacity.reviewMinutes);
  const deliveryKnown =
    !v2.isError && !!session.data?.paired && !runError && connected;
  const hotfixes = useMemo(() => eraHotfixes(world), [world]);
  const showHotfixes = !selected || selected.state !== "closed";
  const launch = (row: (typeof rows)[number]) => {
    if (!selected) return;
    if (row.run && !row.ready) {
      const [path, search] = row.run.path.split("?");
      const query = new URLSearchParams(search);
      query.set("from", fromWeek(selected.id));
      go(`${path}?${query}`);
    } else if (row.work)
      go(
        `/deliver/${encodeURIComponent(row.work.module)}/${encodeURIComponent(row.work.id)}?from=${encodeURIComponent(fromWeek(selected.id))}`,
      );
  };
  return (
    <div className="sprints-page">
      <PageTitle
        title="Sprints"
        action={
          <button className="secondary" onClick={() => setEditor("forecast")}>
            <Plus size={17} />
            Plan weeks
          </button>
        }
      />
      {world.planningError && (
        <p className="sprint-alert" role="alert">
          {world.planningError}
        </p>
      )}
      {weeks.length > 0 && (
        <nav className="sprint-weeks" aria-label="Sprint weeks">
          {weeks.map((week, index) => {
            const progress = statsFor(week);
            return (
              <a
                key={week.id}
                href={`#${fromWeek(week.id)}`}
                aria-current={selected?.id === week.id ? "page" : undefined}
                className="sprint-week"
              >
                <span className="sprint-week-top">
                  <span>Week {index + 1}</span>
                  <span className={`sprint-phase ${week.state}`}>
                    {week.state === "draft"
                      ? "Planned"
                      : week.state === "active"
                        ? "In play"
                        : "Closed"}
                  </span>
                </span>
                <strong>{range(week)}</strong>
                <span className="sprint-week-goal">{week.name}</span>
                <span className="sprint-week-progress">
                  <i
                    style={{
                      width: `${week.members.length ? (progress.done / week.members.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <small>
                  {progress.done}/{week.members.length} delivered
                </small>
              </a>
            );
          })}
        </nav>
      )}
      {!selected || !stats ? (
        <>
          <HotfixLane
            hotfixes={hotfixes}
            from="/sprints"
            canLaunch={connected && deliveryKnown}
          />
          <Empty title="No sprints yet">
            <button className="primary" onClick={() => setEditor("forecast")}>
              <Sparkles size={17} />
              Plan weeks
            </button>
          </Empty>
        </>
      ) : (
        <>
          <section className="sprint-hero" aria-labelledby="sprint-goal">
            <div className="sprint-hero-copy">
              <div className="sprint-eyebrow">
                <Flag size={15} />
                <span>{range(selected)}</span>
                <span className={`sprint-phase ${selected.state}`}>
                  {selected.state === "draft"
                    ? "Forecast"
                    : selected.state === "active"
                      ? "In play"
                      : "Closed"}
                </span>
              </div>
              <h2 id="sprint-goal">{selected.goal || selected.name}</h2>
              <div className="sprint-hero-meta">
                <span>
                  <Layers3 size={14} />
                  {strategyName(selected.strategy)}
                </span>
                <span>{selected.timezone}</span>
              </div>
              <div className="sprint-hero-actions">
                {selected.state === "draft" && (
                  <button
                    className="primary"
                    disabled={!!startBlock}
                    aria-describedby={
                      startBlock ? "sprint-start-block" : undefined
                    }
                    onClick={() =>
                      void act({ action: "start", sprintId: selected.id })
                    }
                  >
                    <Play size={17} />
                    Start sprint
                  </button>
                )}
                {selected.state === "active" && (
                  <button
                    className="primary"
                    disabled={!next || !connected || !deliveryKnown}
                    onClick={() => next && launch(next)}
                  >
                    <Zap size={17} />
                    {next?.run && !next.ready
                      ? "Open delivery"
                      : "Deliver next"}
                    <ArrowRight size={16} />
                  </button>
                )}
                {selected.state !== "closed" && (
                  <button
                    className="secondary"
                    disabled={!writable || command.isPending}
                    onClick={() =>
                      setEditor(selected.state === "draft" ? "edit" : "add")
                    }
                  >
                    <Pencil size={15} />
                    {selected.state === "draft" ? "Edit week" : "Adjust scope"}
                  </button>
                )}
                {selected.state === "active" && (
                  <button
                    className="text-button"
                    disabled={!writable || command.isPending}
                    onClick={() => setEditor("close")}
                  >
                    Close week
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
              {selected.state === "draft" && startBlock && (
                <p
                  id="sprint-start-block"
                  className="sprint-start-block"
                  role="status"
                >
                  {startBlock === "Connect Delivery" ||
                  startBlock === "Reconnect Delivery" ? (
                    <a href="#/delivery">{startBlock}</a>
                  ) : startBlock === "Close the active week first" &&
                    activeWeek ? (
                    <a href={`#${fromWeek(activeWeek.id)}`}>{startBlock}</a>
                  ) : startBlock === "Add work to this week" ? (
                    <button
                      className="text-button"
                      onClick={() => setEditor("edit")}
                    >
                      {startBlock}
                    </button>
                  ) : (
                    startBlock
                  )}
                </p>
              )}
            </div>
            <Ring done={stats.done} total={selected.members.length} />
          </section>
          <div className="sprint-scoreboard">
            <div>
              <Check size={18} />
              <span>
                Delivered
                <strong>
                  {stats.done}
                  <small> / {selected.members.length}</small>
                </strong>
              </span>
            </div>
            <div>
              <Target size={18} />
              <span>
                Remaining<strong>{stats.remaining}</strong>
              </span>
            </div>
            <div>
              <CircleDot size={18} />
              <span>
                Needs you<strong>{attention.length}</strong>
              </span>
            </div>
            <div data-over={over}>
              <Layers3 size={18} />
              <span>
                Planned points
                <strong>
                  {used}
                  <small> / {selected.capacity.available}</small>
                </strong>
              </span>
            </div>
          </div>
          {showHotfixes && (
            <HotfixLane
              hotfixes={hotfixes}
              from={fromWeek(selected.id)}
              canLaunch={connected && deliveryKnown}
            />
          )}
          <div className="sprint-layout">
            <section className="sprint-deliverables">
              <div className="section-title">
                <h2>This week’s work</h2>
                <span className="quiet">
                  {selected.members.length} outcomes
                </span>
              </div>
              <div className="sprint-filters" aria-label="Filter sprint items">
                {[
                  { id: "all", label: "All" },
                  { id: "todo", label: "To do" },
                  { id: "active", label: "Active" },
                  { id: "review", label: "Review" },
                  { id: "done", label: "Done" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    aria-pressed={filter === tab.id}
                    onClick={() =>
                      go(`${fromWeek(selected.id)}&status=${tab.id}`)
                    }
                  >
                    {tab.label}
                    <small>
                      {tab.id === "all"
                        ? rows.length
                        : rows.filter((row) =>
                            tab.id === "todo"
                              ? [
                                  "todo",
                                  "blocked",
                                  "needs-input",
                                  "missing",
                                ].includes(row.state)
                              : row.state === tab.id,
                          ).length}
                    </small>
                  </button>
                ))}
              </div>
              {!deliveryKnown && (
                <a className="sprint-status-note" href="#/delivery">
                  {!connected
                    ? "Last known status"
                    : v2.isError || runError
                      ? "Delivery status unavailable"
                      : !session.data?.paired
                        ? "Connect Delivery for live status"
                        : "Updating delivery status"}
                  <ArrowRight size={14} />
                </a>
              )}
              <div className="sprint-items">
                {rows
                  .filter(
                    (row) =>
                      filter === "all" ||
                      (filter === "todo"
                        ? [
                            "todo",
                            "blocked",
                            "needs-input",
                            "missing",
                          ].includes(row.state)
                        : row.state === filter),
                  )
                  .map((row) => {
                    const campaign =
                      row.work?.module || row.member.origin.file.split("/")[0];
                    const href = row.work
                      ? workPath(row.work, fromWeek(selected.id))
                      : `/work/${encodeURIComponent(campaign)}/${encodeURIComponent(row.member.workId)}?from=${encodeURIComponent(fromWeek(selected.id))}`;
                    return (
                      <article
                        key={row.member.workId}
                        className="sprint-item"
                        data-state={row.state}
                      >
                        <div className="sprint-item-mark">
                          {row.state === "done" ? (
                            <Check size={19} />
                          ) : (
                            <SpaceIcon name={campaign} size={20} />
                          )}
                        </div>
                        <a className="sprint-item-content" href={`#${href}`}>
                          <span className="sprint-item-meta">
                            <b>{row.member.origin.alias}</b>
                            <span>{campaign}</span>
                            {row.member.deliverableId && (
                              <span>
                                {
                                  planning.deliverables.find(
                                    (group) =>
                                      group.id === row.member.deliverableId,
                                  )?.title
                                }
                              </span>
                            )}
                          </span>
                          <h3>
                            {row.work?.title || memberTitle(row.member, world)}
                          </h3>
                          <span className="sprint-item-bottom">
                            <span className={`sprint-state state-${row.state}`}>
                              {row.label}
                            </span>
                            <span>{row.member.points ?? "—"} pts</span>
                            {row.member.reviewMinutes !== null && (
                              <span>{row.member.reviewMinutes}m review</span>
                            )}
                          </span>
                          {row.reasons.length > 0 && (
                            <span className="sprint-item-reason">
                              {row.reasons.slice(0, 2).join(" · ")}
                            </span>
                          )}
                        </a>
                        {row.run && !row.ready ? (
                          <button
                            className="sprint-item-action"
                            onClick={() => launch(row)}
                          >
                            Open
                            <ArrowRight size={15} />
                          </button>
                        ) : row.work &&
                          row.state !== "done" &&
                          row.state !== "cancelled" ? (
                          <button
                            className="sprint-item-action"
                            disabled={
                              !connected ||
                              !deliveryKnown ||
                              !row.ready ||
                              !canDeliver(row.work) ||
                              selected.state === "closed"
                            }
                            onClick={() => launch(row)}
                          >
                            <Zap size={14} />
                            Deliver
                          </button>
                        ) : (
                          <a
                            className="sprint-item-action"
                            href={`#${href}`}
                            aria-label={`View ${row.member.origin.alias}`}
                          >
                            <ChevronRight size={18} />
                          </a>
                        )}
                      </article>
                    );
                  })}
              </div>
              {!rows.length && <p className="quiet">Add work to this week.</p>}
            </section>
            <aside className="sprint-aside">
              <section className="sprint-card">
                <div className="sprint-card-title">
                  <Award size={18} />
                  <h3>Week milestones</h3>
                </div>
                <div className="sprint-milestones">
                  {[
                    {
                      label: "First delivery",
                      icon: Flag,
                      achieved: stats.done > 0,
                    },
                    {
                      label: "Halfway there",
                      icon: Target,
                      achieved:
                        stats.done > 0 &&
                        stats.done >= selected.members.length / 2,
                    },
                    {
                      label: "Week cleared",
                      icon: Trophy,
                      achieved:
                        selected.members.length > 0 &&
                        stats.done === selected.members.length,
                    },
                  ].map((badge) => (
                    <div key={badge.label} data-earned={badge.achieved}>
                      <span>
                        <badge.icon size={19} />
                      </span>
                      <b>{badge.label}</b>
                      {badge.achieved && <Check size={14} />}
                    </div>
                  ))}
                </div>
              </section>
              <section className="sprint-card">
                <div className="sprint-card-title">
                  <Layers3 size={18} />
                  <h3>Week capacity</h3>
                </div>
                <div className="sprint-capacity-line">
                  <span>Work</span>
                  <b>
                    {estimateLabel("points", used)} /{" "}
                    {selected.capacity.available} pts
                  </b>
                </div>
                <div className="sprint-capacity-meter">
                  <i
                    style={{
                      width: `${Math.min(100, (used / (selected.capacity.available || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="sprint-capacity-line">
                  <span>Your review</span>
                  <b>
                    {estimateLabel("reviewMinutes", review)} /{" "}
                    {selected.capacity.reviewMinutes} min
                  </b>
                </div>
                <div className="sprint-capacity-meter">
                  <i
                    style={{
                      width: `${Math.min(100, (review / (selected.capacity.reviewMinutes || 1)) * 100)}%`,
                    }}
                  />
                </div>
                {over && <p className="sprint-alert">Over capacity</p>}
                {unknown > 0 &&
                  (selected.state === "draft" ? (
                    <button
                      className="text-button"
                      disabled={!writable}
                      onClick={() => setEditor("edit")}
                    >
                      {unknown} unestimated
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <p>{unknown} unestimated</p>
                  ))}
              </section>
              <section className="sprint-card">
                <div className="sprint-card-title">
                  <Flag size={18} />
                  <h3>Scope record</h3>
                </div>
                <dl className="sprint-scope">
                  <div>
                    <dt>{selected.commitment ? "Original" : "Planned"}</dt>
                    <dd>
                      {selected.commitment?.members.length ??
                        selected.members.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Added</dt>
                    <dd>
                      {selected.scopeChanges?.filter(
                        (change) => change.action !== "remove",
                      ).length || 0}
                    </dd>
                  </div>
                  <div>
                    <dt>Removed</dt>
                    <dd>
                      {selected.scopeChanges?.filter(
                        (change) => change.action === "remove",
                      ).length || 0}
                    </dd>
                  </div>
                  <div>
                    <dt>Cancelled</dt>
                    <dd>{stats.cancelled}</dd>
                  </div>
                </dl>
                {!!selected.scopeChanges?.length && (
                  <details className="sprint-changes">
                    <summary>Changes</summary>
                    {selected.scopeChanges.map((change, index) => (
                      <p key={index}>
                        {change.action !== "remove" ? "+" : "−"}{" "}
                        {change.workId || change.member?.origin.alias}
                        <small>{shortDay(change.at.slice(0, 10))}</small>
                      </p>
                    ))}
                  </details>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
      {command.error instanceof PendingCommand ? (
        <div className="sprint-alert" role="status">
          {command.error.message}
          <button
            className="text-button"
            onClick={() =>
              void client.invalidateQueries({ queryKey: pmKeys.all })
            }
          >
            Refresh
          </button>
        </div>
      ) : (
        <ErrorNotice error={command.error} />
      )}
      {undo && (
        <div className="undo-notice" role="status">
          <span>Saved</span>
          <button
            disabled={!writable || command.isPending}
            onClick={() => void act(undo)}
          >
            <RotateCcw size={15} />
            Undo
          </button>
          <button aria-label="Dismiss" onClick={() => setUndo(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      <Sheet
        title={
          editor === "forecast"
            ? "Plan your weeks"
            : editor === "close"
              ? "Close the week"
              : editor === "add"
                ? "Adjust scope"
                : "Edit week"
        }
        open={!!editor}
        onClose={() => setEditor(null)}
      >
        {editor === "forecast" && (
          <ForecastEditor
            world={world}
            planning={planning}
            writable={writable}
            busy={command.isPending}
            onSave={(sprints, replaceDraftIds) =>
              void act(
                { action: "save-many", sprints, replaceDraftIds },
                {
                  action: "save-many",
                  sprints: planning.sprints
                    .filter((week) => replaceDraftIds.includes(week.id))
                    .map(draftPayload),
                  replaceDraftIds: sprints.map((week) => week.id),
                },
              )
            }
          />
        )}
        {editor === "edit" && selected && (
          <WeekEditor
            key={selected.id}
            sprint={selected}
            world={world}
            busy={command.isPending}
            onSave={(sprint, deliverables) =>
              void act(
                { action: "save", sprint: draftPayload(sprint), deliverables },
                {
                  action: "save",
                  sprint: draftPayload(selected),
                  deliverables: planning.deliverables,
                },
              )
            }
          />
        )}
        {editor === "add" && selected && (
          <ScopeEditor
            sprint={selected}
            world={world}
            busy={command.isPending}
            onAdd={(member) =>
              void act(
                { action: "add-member", sprintId: selected.id, member },
                {
                  action: "remove-member",
                  sprintId: selected.id,
                  workId: member.workId,
                },
              )
            }
            onRemove={(member) =>
              void act(
                {
                  action: "remove-member",
                  sprintId: selected.id,
                  workId: member.workId,
                },
                {
                  action: "restore-member",
                  sprintId: selected.id,
                  workId: member.workId,
                },
              )
            }
          />
        )}
        {editor === "close" && selected && (
          <CloseEditor
            sprint={selected}
            weeks={weeks}
            rows={rows
              .filter((row) => !["done", "cancelled"].includes(row.state))
              .map((row) => row.member)}
            busy={command.isPending}
            world={world}
            onClose={(carryover, carryoverTo) =>
              void act({
                action: "close",
                sprintId: selected.id,
                ...(carryoverTo ? { carryover, carryoverTo } : {}),
              })
            }
          />
        )}
        {command.error && <ErrorNotice error={command.error} />}
      </Sheet>
    </div>
  );
}

function ForecastEditor({
  world,
  planning,
  writable,
  busy,
  onSave,
}: {
  world: World;
  planning: Planning;
  writable: boolean;
  busy: boolean;
  onSave: (sprints: Draft[], replaceDraftIds: string[]) => void;
}) {
  const zone = planning.sprints[0]?.timezone || "Asia/Beirut";
  const lastEnd = planning.sprints
    .map((sprint) => sprint.endExclusive)
    .sort()
    .at(-1);
  const monday = mondayOf(dateInTimezone(new Date(), zone));
  const firstDraft = [...planning.sprints]
    .filter((week) => week.state === "draft")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const [replan, setReplan] = useState(!!firstDraft);
  const [start, setStart] = useState(
    firstDraft?.startDate ||
      (lastEnd && lastEnd > monday ? lastEnd : addCalendarDays(monday, 7)),
  );
  const [strategy, setStrategy] = useState<Sprint["strategy"]>("balanced");
  const [capacity, setCapacity] = useState("6");
  const [weeks, setWeeks] = useState("8");
  const [review, setReview] = useState("90");
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    Number(capacity) > 0 &&
    Number(capacity) <= 40 &&
    Number(weeks) > 0 &&
    Number(weeks) <= 16 &&
    Number.isInteger(Number(weeks)) &&
    Number(review) > 0;
  const forecast = useMemo(() => {
    if (!valid) return null;
    try {
      return forecastSprints(world, {
        strategy,
        start,
        timezone: zone,
        weeks: Number(weeks),
        capacity: Number(capacity),
        maxModules: 2,
        exclude: planning.sprints
          .filter(
            (sprint) =>
              sprint.state !== "closed" &&
              !(
                replan &&
                sprint.state === "draft" &&
                sprint.startDate >= mondayOf(start) &&
                sprint.startDate <
                  addCalendarDays(mondayOf(start), Number(weeks) * 7)
              ),
          )
          .flatMap((sprint) => sprint.members),
        readiness: world.planningReadiness,
      });
    } catch {
      return null;
    }
  }, [
    world,
    strategy,
    start,
    weeks,
    capacity,
    valid,
    planning.sprints,
    zone,
    replan,
  ]);
  const proposed = forecast?.weeks.filter((week) => week.members.length) || [];
  const overlaps = proposed.some((week) =>
    planning.sprints.some(
      (saved) =>
        saved.startDate === week.startDate &&
        (!replan || saved.state !== "draft"),
    ),
  );
  return (
    <div className="sprint-editor">
      {planning.sprints.length > 0 && (
        <label>
          Plan
          <select
            value={replan ? "replace" : "add"}
            onChange={(event) => {
              const replacing = event.target.value === "replace";
              setReplan(replacing);
              setStart(
                replacing && firstDraft
                  ? firstDraft.startDate
                  : lastEnd && lastEnd > monday
                    ? lastEnd
                    : addCalendarDays(monday, 7),
              );
            }}
          >
            <option value="replace" disabled={!firstDraft}>
              Replan drafts
            </option>
            <option value="add">Add weeks</option>
          </select>
        </label>
      )}
      <div
        className="sprint-strategies"
        role="radiogroup"
        aria-label="Weekly approach"
      >
        {[
          {
            id: "balanced" as const,
            title: "Mixed modules",
            text: "One focus + a supporting module",
            icon: Layers3,
          },
          {
            id: "module" as const,
            title: "Module focus",
            text: "One module each week",
            icon: Target,
          },
        ].map((option) => (
          <button
            key={option.id}
            role="radio"
            aria-checked={strategy === option.id}
            onClick={() => setStrategy(option.id)}
          >
            <option.icon size={21} />
            <strong>{option.title}</strong>
            <small>{option.text}</small>
            {option.id === "balanced" && <span>Recommended</span>}
          </button>
        ))}
      </div>
      <div className="sprint-field-grid">
        <label>
          First week
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Weeks
          <select
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
          >
            {[4, 8, 12, 16].map((value) => (
              <option key={value} value={value}>
                {value} weeks
              </option>
            ))}
          </select>
        </label>
        <label>
          Points / week
          <input
            type="text"
            inputMode="decimal"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </label>
        <label>
          Review min / week
          <input
            type="text"
            inputMode="decimal"
            value={review}
            onChange={(event) => setReview(event.target.value)}
          />
        </label>
      </div>
      <p className="quiet">
        Forecast · S = 1, M = 2 · large items need splitting
      </p>
      <div className="sprint-forecast">
        {proposed.map((week, index) => (
          <section key={week.id}>
            <div>
              <b>Week {index + 1}</b>
              <span>{range(week)}</span>
              <small>{week.points} pts</small>
            </div>
            <h3>{week.goal}</h3>
            {week.members.map((member) => (
              <p key={member.workId}>
                <b>{member.origin.alias}</b>
                <span>{memberTitle(member, world)}</span>
              </p>
            ))}
          </section>
        ))}
      </div>
      {!!forecast?.unplanned.length && (
        <details className="sprint-unplanned">
          <summary>{forecast.unplanned.length} outside this plan</summary>
          {forecast.unplanned.map((item) => (
            <p key={item.ref.workId}>
              <b>{item.ref.origin.alias}</b>
              <span>{item.reason}</span>
            </p>
          ))}
        </details>
      )}
      {!writable && (
        <p className="sprint-alert">
          {transport().capabilities.kind === "relay"
            ? "Sprint editing needs the updated laptop bridge and relay migration."
            : "Connect Delivery to save weeks."}
        </p>
      )}
      {overlaps && <p className="sprint-alert">These weeks already exist.</p>}
      <button
        className="primary sprint-save"
        disabled={!writable || busy || !valid || !proposed.length || overlaps}
        onClick={() =>
          onSave(
            proposed.map((week) =>
              draftPayload({
                ...week,
                id: replan
                  ? planning.sprints.find(
                      (saved) =>
                        saved.state === "draft" &&
                        saved.startDate === week.startDate,
                    )?.id || week.id
                  : week.id,
                capacity: { ...week.capacity, reviewMinutes: Number(review) },
              }),
            ),
            replan
              ? planning.sprints
                  .filter(
                    (week) =>
                      week.state === "draft" &&
                      week.startDate >= mondayOf(start) &&
                      week.startDate <
                        addCalendarDays(mondayOf(start), Number(weeks) * 7),
                  )
                  .map((week) => week.id)
              : [],
          )
        }
      >
        <Check size={17} />
        Save {proposed.length} weeks
      </button>
    </div>
  );
}

function WeekEditor({
  sprint,
  world,
  busy,
  onSave,
}: {
  sprint: Sprint;
  world: World;
  busy: boolean;
  onSave: (sprint: Sprint, deliverables: Planning["deliverables"]) => void;
}) {
  const [draft, setDraft] = useState(sprint);
  const [deliverables, setDeliverables] = useState(
    world.planning?.deliverables || [],
  );
  const [groupTitle, setGroupTitle] = useState("");
  const [search, setSearch] = useState("");
  const [points, setPoints] = useState(String(sprint.capacity.available));
  const [review, setReview] = useState(String(sprint.capacity.reviewMinutes));
  const candidates = world.work.filter(
    (item) =>
      item.state === "open" &&
      !draft.members.some(
        (member) => member.workId === item.id.toUpperCase(),
      ) &&
      `${item.id} ${item.title} ${item.module}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const valid =
    draft.name.trim() &&
    draft.goal.trim() &&
    draft.startDate < draft.endExclusive &&
    Number(points) > 0 &&
    Number(review) > 0 &&
    draft.members.every(
      (member) =>
        (member.points === null ||
          (Number.isFinite(member.points) && member.points > 0)) &&
        (member.reviewMinutes === null ||
          (Number.isFinite(member.reviewMinutes) && member.reviewMinutes >= 0)),
    );
  return (
    <div className="sprint-editor">
      <label>
        Name
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        Weekly goal
        <input
          value={draft.goal}
          onChange={(event) => setDraft({ ...draft, goal: event.target.value })}
        />
      </label>
      <div className="sprint-field-grid">
        <label>
          Starts
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) =>
              setDraft({ ...draft, startDate: event.target.value })
            }
          />
        </label>
        <label>
          Ends
          <input
            type="date"
            value={addCalendarDays(draft.endExclusive, -1)}
            onChange={(event) =>
              event.target.value &&
              setDraft({
                ...draft,
                endExclusive: addCalendarDays(event.target.value, 1),
              })
            }
          />
        </label>
        <label>
          Points
          <input
            type="text"
            inputMode="decimal"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        </label>
        <label>
          Your review · min
          <input
            type="text"
            inputMode="decimal"
            value={review}
            onChange={(event) => setReview(event.target.value)}
          />
        </label>
      </div>
      <details className="sprint-group-editor">
        <summary>Deliverable groups</summary>
        <div className="sprint-group-create">
          <label>
            New group
            <input
              maxLength={120}
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={!groupTitle.trim()}
            onClick={() => {
              setDeliverables([
                ...deliverables,
                {
                  id: `group-${crypto.randomUUID()}`,
                  title: groupTitle.trim(),
                },
              ]);
              setGroupTitle("");
            }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </details>
      <div className="sprint-estimate-list">
        {draft.members.map((member) => (
          <div key={member.workId}>
            <b>{member.origin.alias}</b>
            {deliverables.length > 0 && (
              <label className="sprint-member-group">
                Group
                <select
                  aria-label={`${member.origin.alias} group`}
                  value={member.deliverableId || ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      members: draft.members.map((item) => {
                        if (item.workId !== member.workId) return item;
                        const copy = { ...item };
                        if (event.target.value)
                          copy.deliverableId = event.target.value;
                        else delete copy.deliverableId;
                        return copy;
                      }),
                    })
                  }
                >
                  <option value="">Ungrouped</option>
                  {deliverables.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span>{memberTitle(member, world)}</span>
            <label>
              Points
              <input
                aria-label={`${member.origin.alias} points`}
                type="text"
                inputMode="decimal"
                value={member.points ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    members: draft.members.map((item) =>
                      item.workId === member.workId
                        ? {
                            ...item,
                            points: numeric(event.target.value),
                            estimateSource: "override",
                          }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Review · min
              <input
                aria-label={`${member.origin.alias} review minutes`}
                type="text"
                inputMode="decimal"
                value={member.reviewMinutes ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    members: draft.members.map((item) =>
                      item.workId === member.workId
                        ? {
                            ...item,
                            reviewMinutes: numeric(event.target.value),
                          }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <button
              className="icon-button"
              aria-label={`Remove ${member.origin.alias}`}
              onClick={() =>
                setDraft({
                  ...draft,
                  members: draft.members.filter(
                    (item) => item.workId !== member.workId,
                  ),
                })
              }
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
      <label>
        Add work
        <input
          type="search"
          placeholder="Find an item"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="sprint-candidates">
        {candidates.slice(0, 15).map((work) => (
          <button
            key={work.key}
            onClick={() =>
              setDraft({
                ...draft,
                members: [
                  ...draft.members,
                  {
                    workId: work.id.toUpperCase(),
                    origin: { file: work.file, alias: work.id },
                    points:
                      work.effort === "S" ? 1 : work.effort === "M" ? 2 : null,
                    reviewMinutes: null,
                    estimateSource: "effort",
                  },
                ],
              })
            }
          >
            <span>
              <b>{work.id}</b> {work.title}
            </span>
            <Plus size={16} />
          </button>
        ))}
      </div>
      <button
        className="primary sprint-save"
        disabled={busy || !valid}
        onClick={() =>
          onSave(
            {
              ...draft,
              capacity: {
                unit: "points",
                available: Number(points),
                reviewMinutes: Number(review),
              },
            },
            deliverables,
          )
        }
      >
        <Check size={17} />
        Save week
      </button>
    </div>
  );
}

function ScopeEditor({
  sprint,
  world,
  busy,
  onAdd,
  onRemove,
}: {
  sprint: Sprint;
  world: World;
  busy: boolean;
  onAdd: (member: SprintMember) => void;
  onRemove: (member: SprintMember) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState("");
  const [points, setPoints] = useState("2");
  const [review, setReview] = useState("15");
  const work = world.work.find((item) => item.key === chosen);
  return (
    <div className="sprint-editor">
      <div className="sprint-candidates">
        {sprint.members.map((member) => (
          <div key={member.workId}>
            <span>
              <b>{member.origin.alias}</b> {memberTitle(member, world)}
            </span>
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`Remove ${member.origin.alias}`}
              onClick={() => onRemove(member)}
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
      <label>
        Add work
        <input
          type="search"
          placeholder="Find an item"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="sprint-candidates">
        {world.work
          .filter(
            (item) =>
              item.state === "open" &&
              !sprint.members.some(
                (member) => member.workId === item.id.toUpperCase(),
              ) &&
              `${item.id} ${item.title}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .slice(0, 12)
          .map((item) => (
            <button
              key={item.key}
              aria-pressed={chosen === item.key}
              onClick={() => {
                setChosen(item.key);
                setPoints(
                  item.effort === "S" ? "1" : item.effort === "M" ? "2" : "",
                );
              }}
            >
              <span>
                <b>{item.id}</b> {item.title}
              </span>
              {chosen === item.key ? <Check size={16} /> : <Plus size={16} />}
            </button>
          ))}
      </div>
      {work && (
        <>
          <div className="sprint-field-grid">
            <label>
              Points
              <input
                type="text"
                inputMode="decimal"
                value={points}
                onChange={(event) => setPoints(event.target.value)}
              />
            </label>
            <label>
              Review · min
              <input
                type="text"
                inputMode="decimal"
                value={review}
                onChange={(event) => setReview(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary sprint-save"
            disabled={
              busy ||
              !points ||
              !Number.isFinite(Number(points)) ||
              Number(points) <= 0 ||
              !review ||
              !Number.isFinite(Number(review)) ||
              Number(review) < 0
            }
            onClick={() =>
              onAdd({
                workId: work.id.toUpperCase(),
                origin: { file: work.file, alias: work.id },
                points: Number(points),
                reviewMinutes: Number(review),
                estimateSource: "override",
              })
            }
          >
            Add item
            <Plus size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function CloseEditor({
  sprint,
  weeks,
  rows,
  busy,
  world,
  onClose,
}: {
  sprint: Sprint;
  weeks: Sprint[];
  rows: SprintMember[];
  busy: boolean;
  world: World;
  onClose: (ids: string[], target?: string) => void;
}) {
  const next = weeks.filter(
    (week) => week.state === "draft" && week.startDate >= sprint.endExclusive,
  );
  const [target, setTarget] = useState(next[0]?.id || "");
  const [carry, setCarry] = useState<string[]>([]);
  return (
    <div className="sprint-editor">
      <p className="quiet">
        {rows.length
          ? "Choose unfinished work to carry forward."
          : "All work accounted for."}
      </p>
      {rows.length > 0 && (
        <>
          <label>
            Carry to
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Keep in backlog</option>
              {next.map((week) => (
                <option key={week.id} value={week.id}>
                  {week.name} · {range(week)}
                </option>
              ))}
            </select>
          </label>
          <div className="sprint-carry">
            {rows.map((member) => (
              <label key={member.workId}>
                <input
                  type="checkbox"
                  disabled={!target}
                  checked={carry.includes(member.workId)}
                  onChange={(event) =>
                    setCarry(
                      event.target.checked
                        ? [...carry, member.workId]
                        : carry.filter((id) => id !== member.workId),
                    )
                  }
                />
                <span>
                  <b>{member.origin.alias}</b> {memberTitle(member, world)}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      <button
        className="primary sprint-save"
        disabled={busy}
        onClick={() => onClose(target ? carry : [], target || undefined)}
      >
        <Flag size={17} />
        Close week
      </button>
    </div>
  );
}
