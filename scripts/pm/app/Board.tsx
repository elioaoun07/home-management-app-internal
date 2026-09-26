import { useDeferredValue, useState, type DragEvent } from "react";
import { useCommand, useRoute, useWorld, go, type UndoSnapshot } from "./state";
import { transport } from "./transport";
import {
  activityBadges,
  bucketOf,
  discover,
  KIND_OPTIONS,
  laneGroups,
  laneOf,
  LANES,
  matchesBoardFilters,
  parseBoardQuery,
  type BoardFilters,
  type Lane,
  type Status,
  workPath,
} from "./model";
import { Empty, ErrorNotice, SpaceIcon, WorkHeading } from "./components";
import { boardFilterPath, boardVisibleLane, exploreBucket, exploreViewPath } from "./explore-state";
import { UndoNotice } from "./Work";
import type { RunSummary, Work } from "./types";

function BoardCard({
  work,
  runs,
  from,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  disabled,
}: {
  work: Work;
  runs: RunSummary[];
  from: string;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: () => void;
  onMove?: (lane: Lane) => void;
  disabled?: boolean;
}) {
  const badges = activityBadges(work, runs);
  return (
    <div
      className="board-card"
      data-dragging={!!dragging}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <a href={`#${workPath(work, from)}`}>
        <SpaceIcon name={work.module} size={17} />
        <WorkHeading work={work} detail={work.effort} />
      </a>
      {badges.length > 0 && (
        <div className="board-badges">
          {badges.map((badge) => (
            <span key={badge} className={`board-badge board-badge-${badge}`}>
              {badge === "review" ? "done" : badge}
            </span>
          ))}
        </div>
      )}
      {onMove && (
        <label className="board-move">
          Move
          <select
            aria-label={`Move ${work.label}`}
            value={laneOf(work)}
            disabled={disabled}
            onChange={(event) => onMove(event.target.value as Lane)}
          >
            {LANES.map((lane) => (
              <option key={lane} value={lane}>
                {lane}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/**
 * The shared global/module organizing surface: Board and List are two
 * projections of the same filtered rows, never a separate data source. Every
 * filter round-trips through the URL (Campaign acceptance D4).
 */
export function Board({
  work,
  basePath,
  lockCampaign,
}: {
  work: Work[];
  basePath: string;
  lockCampaign?: string;
}) {
  const { runs, connected } = useWorld();
  const route = useRoute();
  const command = useCommand();
  const [undo, setUndo] = useState<UndoSnapshot[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const term = useDeferredValue(route.query.get("q") || "");
  const bucket = exploreBucket(route.query);
  const filters = parseBoardQuery(route.query);
  const setFilters = (patch: Partial<BoardFilters>) => {
    const path = boardFilterPath(basePath, route.query, patch);
    go(basePath === "/explore" && patch.status === "review"
      ? exploreViewPath(new URLSearchParams(path.split("?")[1]), "done")
      : path);
  };
  const campaigns = lockCampaign
    ? []
    : [...new Set(work.map((item) => item.module))].sort();
  const filtered = discover(work, term).filter((item) =>
    matchesBoardFilters(item, runs, filters) && (!bucket || bucketOf(item) === bucket),
  );
  // Checklist moves stay at the desk when the transport cannot write the checklist.
  const canMove = transport().capabilities.planWrites;
  const disabled = !connected || command.isPending || !canMove;
  const move = async (item: Work, toHeading: Lane) => {
    if (disabled || laneOf(item) === toHeading) return;
    try {
      const result = await command.mutateAsync({
        op: "move-task",
        body: {
          file: item.file,
          cbidx: item.cbidx,
          expectLine: item.rawLine,
          expectId: item.idChip,
          expectState: item.state,
          toHeading,
        },
      });
      if (result.undo) setUndo(result.undo);
    } catch {
      // Surfaced through command.error below.
    }
  };
  if (filters.status === "review") {
    return (
      <div className="board">
        <BoardToolbar
          filters={filters}
          campaigns={campaigns}
          onChange={setFilters}
        />
        <div className="board-list">
          {filtered.length ? (
            filtered.map((item) => (
              <BoardCard
                key={item.key}
                work={item}
                runs={runs}
                from={route.full}
              />
            ))
          ) : (
            <Empty title="Nothing awaiting archive" />
          )}
        </div>
        <ErrorNotice error={command.error} />
        {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
      </div>
    );
  }
  const groups = laneGroups(filtered);
  const visibleLane = boardVisibleLane(route.query, filtered);
  const empty = !filtered.length;
  return (
    <div className="board">
      <BoardToolbar
        filters={filters}
        campaigns={campaigns}
        onChange={setFilters}
      />
      {empty ? (
        <Empty title="Nothing matches these filters" />
      ) : filters.view === "list" ? (
        <div className="board-list">
          {LANES.filter((lane) => groups[lane].length).map((lane) => (
            <section key={lane} className="board-list-section">
              <h3>
                {lane} <span>{groups[lane].length}</span>
              </h3>
              {groups[lane].map((item) => (
                <BoardCard
                  key={item.key}
                  work={item}
                  runs={runs}
                  from={route.full}
                  onMove={canMove ? (toHeading) => void move(item, toHeading) : undefined}
                  disabled={disabled}
                />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <>
          <nav className="board-lane-switch" aria-label="Lane">
            {LANES.map((lane) => (
              <button
                key={lane}
                aria-pressed={visibleLane === lane}
                onClick={() => setFilters({ lane })}
              >
                {lane}
                <span>{groups[lane].length}</span>
              </button>
            ))}
          </nav>
          <div className="board-columns">
            {LANES.map((lane) => (
              <section
                key={lane}
                className="board-column"
                data-active={visibleLane === lane}
                onDragOver={(event) => {
                  if (dragKey) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const key = event.dataTransfer.getData("text/plain");
                  const item = filtered.find((entry) => entry.key === key);
                  setDragKey(null);
                  if (item) void move(item, lane);
                }}
              >
                <h3>
                  {lane} <span>{groups[lane].length}</span>
                </h3>
                {groups[lane].length ? (
                  groups[lane].map((item) => (
                    <BoardCard
                      key={item.key}
                      work={item}
                      runs={runs}
                      from={route.full}
                      draggable={!disabled}
                      dragging={dragKey === item.key}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", item.key);
                        event.dataTransfer.effectAllowed = "move";
                        setDragKey(item.key);
                      }}
                      onDragEnd={() => setDragKey(null)}
                      onMove={canMove ? (toHeading) => void move(item, toHeading) : undefined}
                      disabled={disabled}
                    />
                  ))
                ) : (
                  <p className="board-empty">Nothing here</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      <ErrorNotice error={command.error} />
      {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
    </div>
  );
}

function BoardToolbar({
  filters,
  campaigns,
  onChange,
}: {
  filters: BoardFilters;
  campaigns: string[];
  onChange: (patch: Partial<BoardFilters>) => void;
}) {
  return (
    <div className="board-toolbar">
      <div className="board-view-toggle" role="tablist" aria-label="View">
        <button
          aria-pressed={filters.view === "board"}
          onClick={() => onChange({ view: "board" })}
        >
          Board
        </button>
        <button
          aria-pressed={filters.view === "list"}
          onClick={() => onChange({ view: "list" })}
        >
          List
        </button>
      </div>
      <div className="board-filters">
        <select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value as Status })}
        >
          <option value="open">All open</option>
          <option value="blocked">Blocked</option>
          <option value="active">Active</option>
          <option value="review">Done</option>
        </select>
        {campaigns.length > 0 && (
          <select
            aria-label="Campaign"
            value={filters.campaigns[0] || ""}
            onChange={(event) =>
              onChange({ campaigns: event.target.value ? [event.target.value] : [] })
            }
          >
            <option value="">All campaigns</option>
            {campaigns.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Kind"
          value={filters.kind || ""}
          onChange={(event) => onChange({ kind: event.target.value || null })}
        >
          <option value="">All kinds</option>
          {KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
