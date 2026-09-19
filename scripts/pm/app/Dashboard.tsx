import { useId, useMemo, useState, type ReactNode } from "react";
import { go, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import { useV2Runs, useV2Session } from "./DeliveryV2";
import { Back, PageTitle } from "./components";
import {
  boardQueryString,
  dashboardQueryString,
  DASHBOARD_WEEKS,
  historyPath,
  parseDashboardQuery,
  workPath,
  type DashboardQuery,
  type Lane,
} from "./model";
import {
  PRIORITIES,
  bugs as bugMetric,
  deliveryAttempts,
  historyCoverage,
  localDayKey,
  openWork,
  outcomeSeries,
  resourceRows,
  sprintProgress,
  workOutcomes,
} from "../shared/metrics.mjs";
import type { Receipt, Work } from "./types";

// Command Center Phase 6 (PM Tooling R62). Every number here is computed by
// scripts/pm/shared/metrics.mjs, and every chart has a table and a drilldown that
// lists the same records it counts.

const OUTCOME_LABEL: Record<string, string> = {
  verified_candidate: "Verified candidate",
  useful_partial: "Useful partial",
  accepted: "Accepted",
  failed: "Failed",
  cancelled: "Cancelled",
  in_progress: "In progress",
  unrecorded: "Unrecorded",
};
const SEVERITY_LABEL: Record<string, string> = { blocker: "Blocker", friction: "Friction", annoyance: "Annoyance", parked: "Parked", none: "No severity" };
const usd = (value: number) => `$${value.toFixed(2)}`;
const compact = (value: number) =>
  value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e4 ? `${Math.round(value / 1e3)}K` : value.toLocaleString();
const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const pct = (value: number, max: number) => `${max ? (value / max) * 100 : 0}%`;

type Outcome = { workId: string; campaign: string; status: string; date: string; dateEnd: string | null; datePrecision: string; record: Receipt | null; item: Work | null; repeated: number };
type Attempt = ReturnType<typeof deliveryAttempts>["attempts"][number];

function Panel({ title, meta, chart, table }: { title: string; meta?: ReactNode; chart?: ReactNode; table: ReactNode }) {
  const id = useId();
  const [showTable, setShowTable] = useState(!chart);
  return (
    <section className="dash-panel" aria-labelledby={id}>
      <div className="dash-panel-head">
        <h2 id={id}>{title}</h2>
        {meta && <span className="dash-meta">{meta}</span>}
        {chart && (
          <button className="dash-toggle" aria-pressed={showTable} onClick={() => setShowTable(!showTable)}>
            Table
          </button>
        )}
      </div>
      {showTable ? <div className="dash-table-wrap">{table}</div> : chart}
    </section>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="dash-legend">
      {items.map(([label, series]) => (
        <span key={series}>
          <i data-series={series} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Tile({ label, value, href, onClick, pressed }: { label: string; value: ReactNode; href?: string; onClick?: () => void; pressed?: boolean }) {
  const body = (
    <>
      <b>{value}</b>
      <small>{label}</small>
    </>
  );
  if (href) return <a className="dash-tile" href={href}>{body}</a>;
  if (onClick) return <button className="dash-tile" aria-pressed={pressed} onClick={onClick}>{body}</button>;
  return <div className="dash-tile">{body}</div>;
}

function boardHref(campaign: string | null, extra: { status?: "open" | "blocked"; kind?: string | null; lane?: Lane; view?: "board" | "list" } = {}) {
  return `#/explore${boardQueryString({ view: extra.view || "list", status: extra.status || "open", campaigns: campaign ? [campaign] : [], kind: extra.kind || null, lane: extra.lane || "Now" })}`;
}

function OutcomeList({ title, entries, route }: { title: string; entries: Outcome[]; route: string }) {
  if (!entries.length) return null;
  return (
    <div className="dash-drill-group">
      <h3>
        {title} <span>{entries.length}</span>
      </h3>
      <ul>
        {entries.map((entry) => (
          <li key={`${entry.workId}:${entry.status}`}>
            <a href={entry.record ? `#${historyPath(entry.record)}` : entry.item ? `#${workPath(entry.item, route)}` : undefined}>
              <small>
                {entry.workId} · {entry.campaign} · {entry.date ? (entry.dateEnd ? `${entry.date} – ${entry.dateEnd}` : entry.date) : "Undated"}
                {entry.repeated > 0 ? ` · ${entry.repeated + 1} receipts` : ""}
                {entry.record ? "" : " · Checklist"}
              </small>
              <span>{entry.record ? entry.record.text : entry.item?.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecordList({ title, entries }: { title: string; entries: Receipt[] }) {
  if (!entries.length) return null;
  return (
    <div className="dash-drill-group">
      <h3>
        {title} <span>{entries.length}</span>
      </h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.key}>
            <a href={`#${historyPath(entry)}`}>
              <small>
                {entry.campaign} · {entry.date || "Undated"}
                {entry.identity === "referenced" ? ` · ${entry.ids.join(", ") || entry.id}` : ""}
              </small>
              <span>{entry.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dashboard() {
  const { world, runs, connected } = useWorld();
  const route = useRoute();
  const query = parseDashboardQuery(route.query);
  const set = (patch: Partial<DashboardQuery>) => go(`/dashboard${dashboardQueryString({ ...query, ...patch })}`);
  const session = useV2Session();
  const v2 = useV2Runs();
  const campaign = query.campaign;
  const today = localDayKey();

  const open = useMemo(() => openWork(world.work, { campaign, order: world.spaces.map((space) => space.name) }), [world, campaign]);
  const outcomes = useMemo(() => workOutcomes({ history: world.history, work: world.work }, { campaign }), [world, campaign]);
  const series = useMemo(() => outcomeSeries(outcomes, { weeks: query.weeks, today }), [outcomes, query.weeks, today]);
  const bugs = useMemo(() => bugMetric(world.work, { campaign }), [world, campaign]);
  const delivery = useMemo(() => deliveryAttempts({ v1: runs, v2: v2.data?.runs || [] }, { campaign }), [runs, v2.data, campaign]);
  const resources = useMemo(() => resourceRows(delivery.attempts), [delivery]);
  const coverage = useMemo(() => historyCoverage(world, { campaign }), [world, campaign]);
  const sprint = sprintProgress();

  const maxOpen = Math.max(1, ...open.rows.map((row) => row.total));
  const maxWeek = Math.max(1, ...series.buckets.flatMap((bucket) => [bucket.completed.length, bucket.cancelled.length]));
  const tickEvery = Math.max(1, Math.ceil(series.buckets.length / 6));
  const selected = query.week
    ? series.buckets.find((bucket) => bucket.week === query.week) || null
    : query.set === "undated"
      ? series.undated
      : query.set === "before"
        ? series.before
        : query.set === "all"
          ? { completed: outcomes.completed, cancelled: outcomes.cancelled, historical: outcomes.historical }
          : null;
  const undatedCount = series.undated.completed.length + series.undated.cancelled.length + series.undated.historical.length;
  const beforeCount = series.before.completed.length + series.before.cancelled.length + series.before.historical.length;
  const v2State = !connected ? "Offline" : v2.isError ? "Unavailable" : session.data && !session.data.paired ? "Not paired" : null;
  const v2Paired = !!session.data?.paired && !v2.isError;
  const runHref = (attempt: Attempt) =>
    attempt.engine === "v2" ? `#/delivery/run/${encodeURIComponent(attempt.id)}` : transport().v1SessionHref(attempt.id) || undefined;

  return (
    <div className="dashboard-page">
      <Back label="Home" />
      <PageTitle eyebrow="Dashboard" title="Progress" />

      <div className="dash-filters">
        <select aria-label="Campaign" value={campaign || ""} onChange={(event) => set({ campaign: event.target.value || null, week: null, set: null })}>
          <option value="">All campaigns</option>
          {world.spaces.map((space) => (
            <option key={space.name} value={space.name}>
              {space.name}
            </option>
          ))}
        </select>
        <select aria-label="Weeks" value={query.weeks} onChange={(event) => set({ weeks: Number(event.target.value), week: null, set: null })}>
          {DASHBOARD_WEEKS.map((weeks) => (
            <option key={weeks} value={weeks}>
              {weeks ? `${weeks} weeks` : "All weeks"}
            </option>
          ))}
        </select>
      </div>

      <div className="dash-tiles">
        <Tile label="Open" value={open.total} href={boardHref(campaign)} />
        <Tile label="Blocked" value={open.blocked.length} href={boardHref(campaign, { status: "blocked" })} />
        <Tile label="Completed" value={outcomes.completed.length} onClick={() => set({ week: null, set: query.set === "all" ? null : "all" })} pressed={query.set === "all"} />
        <Tile label="Cancelled" value={outcomes.cancelled.length} onClick={() => set({ week: null, set: query.set === "all" ? null : "all" })} pressed={query.set === "all"} />
        {outcomes.conflicts.length > 0 && (
          <Tile label="Reopened" value={outcomes.conflicts.length} onClick={() => set({ week: null, set: query.set === "reopened" ? null : "reopened" })} pressed={query.set === "reopened"} />
        )}
      </div>

      <Panel
        title="Open work"
        meta={open.duplicates.length ? `${open.duplicates.length} duplicate rows` : undefined}
        chart={
          <div className="dash-hbars">
            <Legend items={[["Now", "now"], ["Next", "next"], ["Later", "later"]]} />
            {open.rows.map((row) => (
              <div className="dash-hbar-row" key={row.campaign}>
                <a className="dash-row-label" href={boardHref(row.campaign)}>
                  {row.campaign}
                </a>
                <div
                  className="dash-hbar-track"
                  role="img"
                  aria-label={`${row.campaign}: ${PRIORITIES.map((lane) => `${row.lanes[lane].length} ${lane}`).join(", ")}`}
                >
                  {PRIORITIES.map((lane) =>
                    row.lanes[lane].length ? (
                      <a
                        key={lane}
                        data-series={lane.toLowerCase()}
                        style={{ width: pct(row.lanes[lane].length, maxOpen) }}
                        href={boardHref(row.campaign, { view: "board", lane: lane as Lane })}
                        title={`${row.campaign} · ${lane} ${row.lanes[lane].length}`}
                        aria-label={`${row.campaign} ${lane} ${row.lanes[lane].length}`}
                      />
                    ) : null,
                  )}
                </div>
                <span className="dash-value">{row.total}</span>
              </div>
            ))}
          </div>
        }
        table={
          <table>
            <caption>Open work by campaign and priority</caption>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                {PRIORITIES.map((lane) => (
                  <th scope="col" key={lane}>{lane}</th>
                ))}
                <th scope="col">Total</th>
                <th scope="col">Blocked</th>
              </tr>
            </thead>
            <tbody>
              {open.rows.map((row) => (
                <tr key={row.campaign}>
                  <th scope="row">
                    <a href={boardHref(row.campaign)}>{row.campaign}</a>
                  </th>
                  {PRIORITIES.map((lane) => (
                    <td key={lane}>{row.lanes[lane].length}</td>
                  ))}
                  <td>{row.total}</td>
                  <td>
                    <a href={boardHref(row.campaign, { status: "blocked" })}>{row.blocked.length}</a>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {PRIORITIES.map((lane) => (
                  <td key={lane}>{open.rows.reduce((sum, row) => sum + row.lanes[lane].length, 0)}</td>
                ))}
                <td>{open.total}</td>
                <td>{open.blocked.length}</td>
              </tr>
            </tfoot>
          </table>
        }
      />

      <Panel
        title="Completed and cancelled"
        meta={`Exact IDs · ${dayLabel(series.start)} – ${dayLabel(series.end)}`}
        chart={
          <div>
            <Legend items={[["Completed", "done"], ["Cancelled", "cancel"]]} />
            <div className="dash-columns" style={{ ["--weeks" as string]: series.buckets.length }}>
              <span className="dash-axis-max">{maxWeek}</span>
              {series.buckets.map((bucket, index) => (
                <button
                  key={bucket.week}
                  className="dash-col-group"
                  aria-pressed={query.week === bucket.week}
                  aria-label={`Week of ${dayLabel(bucket.week)}: ${bucket.completed.length} completed, ${bucket.cancelled.length} cancelled, ${bucket.historical.length} without an exact ID`}
                  title={`${dayLabel(bucket.week)} · ${bucket.completed.length} completed · ${bucket.cancelled.length} cancelled`}
                  onClick={() => set({ week: query.week === bucket.week ? null : bucket.week, set: null })}
                >
                  <span className="dash-col-pair">
                    <span data-series="done" data-empty={!bucket.completed.length} style={{ height: pct(bucket.completed.length, maxWeek) }} />
                    <span data-series="cancel" data-empty={!bucket.cancelled.length} style={{ height: pct(bucket.cancelled.length, maxWeek) }} />
                  </span>
                  <small data-tick={index % tickEvery === 0}>{dayLabel(bucket.week)}</small>
                </button>
              ))}
            </div>
            <div className="dash-chips">
              {undatedCount > 0 && (
                <button aria-pressed={query.set === "undated"} onClick={() => set({ week: null, set: query.set === "undated" ? null : "undated" })}>
                  Undated <b>{undatedCount}</b>
                </button>
              )}
              {beforeCount > 0 && (
                <button aria-pressed={query.set === "before"} onClick={() => set({ week: null, set: query.set === "before" ? null : "before" })}>
                  Earlier <b>{beforeCount}</b>
                </button>
              )}
              <span>
                No exact ID <b>{outcomes.historical.length}</b>
              </span>
            </div>
          </div>
        }
        table={
          <table>
            <caption>Work outcomes by week</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Completed</th>
                <th scope="col">Cancelled</th>
                <th scope="col">No exact ID</th>
              </tr>
            </thead>
            <tbody>
              {series.buckets.map((bucket) => (
                <tr key={bucket.week}>
                  <th scope="row">
                    <button className="dash-link" onClick={() => set({ week: bucket.week, set: null })}>
                      {bucket.week}
                    </button>
                  </th>
                  <td>{bucket.completed.length}</td>
                  <td>{bucket.cancelled.length}</td>
                  <td>{bucket.historical.length}</td>
                </tr>
              ))}
              {(
                [
                  ["before", "Earlier"],
                  ["undated", "Undated"],
                ] as const
              ).map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">
                    <button className="dash-link" onClick={() => set({ week: null, set: key })}>
                      {label}
                    </button>
                  </th>
                  <td>{series[key].completed.length}</td>
                  <td>{series[key].cancelled.length}</td>
                  <td>{series[key].historical.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{series.totals.completed}</td>
                <td>{series.totals.cancelled}</td>
                <td>{series.totals.historical}</td>
              </tr>
            </tfoot>
          </table>
        }
      />

      {(selected || query.set === "reopened") && (
        <section className="dash-drill" aria-label="Records">
          <div className="dash-panel-head">
            <h2>
              {query.week
                ? `Week of ${dayLabel(query.week)}`
                : query.set === "undated"
                  ? "Undated"
                  : query.set === "before"
                    ? "Earlier"
                    : query.set === "reopened"
                      ? "Reopened"
                      : "All outcomes"}
            </h2>
            <button className="dash-toggle" onClick={() => set({ week: null, set: null })}>
              Close
            </button>
          </div>
          {selected && (
            <>
              <OutcomeList title="Completed" entries={selected.completed as Outcome[]} route={route.full} />
              <OutcomeList title="Cancelled" entries={selected.cancelled as Outcome[]} route={route.full} />
              <RecordList title="No exact ID" entries={selected.historical as Receipt[]} />
              {!selected.completed.length && !selected.cancelled.length && !selected.historical.length && <p className="dash-empty">None</p>}
            </>
          )}
          {query.set === "reopened" && (
            <RecordList title="Receipts for open IDs" entries={outcomes.conflicts.flatMap((conflict) => conflict.receipts) as Receipt[]} />
          )}
        </section>
      )}

      <Panel
        title="Bugs"
        meta={`Kind declared ${bugs.declared} / ${bugs.open}`}
        chart={
          bugs.total ? (
            <div className="dash-hbars">
              {bugs.rows.map((row) => (
                <div className="dash-hbar-row" key={row.severity}>
                  <span className="dash-row-label">{SEVERITY_LABEL[row.severity]}</span>
                  <div className="dash-hbar-track" role="img" aria-label={`${row.severity} ${row.items.length}`}>
                    {row.items.length > 0 && <a data-series="single" style={{ width: pct(row.items.length, bugs.total) }} href={boardHref(campaign, { kind: "bug" })} aria-label={`${row.severity} ${row.items.length}`} />}
                  </div>
                  <span className="dash-value">{row.items.length}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dash-empty">None declared</p>
          )
        }
        table={
          <table>
            <caption>Open bugs by severity</caption>
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Bugs</th>
              </tr>
            </thead>
            <tbody>
              {bugs.rows.map((row) => (
                <tr key={row.severity}>
                  <th scope="row">{SEVERITY_LABEL[row.severity]}</th>
                  <td>{row.items.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>
                  <a href={boardHref(campaign, { kind: "bug" })}>{bugs.total}</a>
                </td>
              </tr>
            </tfoot>
          </table>
        }
      />

      <Panel
        title="Delivery attempts"
        chart={
          <div className="dash-multiples">
            {(["v1", "v2"] as const).map((engine) => {
              const rows = delivery[engine].filter((row) => row.attempts.length);
              const max = Math.max(1, ...rows.map((row) => row.attempts.length));
              return (
                <div key={engine}>
                  <h3>{engine.toUpperCase()}</h3>
                  {engine === "v2" && !v2Paired ? (
                    <p className="dash-empty">{v2State || "Loading"}</p>
                  ) : rows.length ? (
                    <div className="dash-hbars">
                      {rows.map((row) => (
                        <div className="dash-hbar-row" key={row.outcome}>
                          <span className="dash-row-label">{OUTCOME_LABEL[row.outcome]}</span>
                          <div className="dash-hbar-track" role="img" aria-label={`${engine} ${OUTCOME_LABEL[row.outcome]} ${row.attempts.length}`}>
                            <span data-series="single" style={{ width: pct(row.attempts.length, max) }} />
                          </div>
                          <span className="dash-value">{row.attempts.length}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="dash-empty">None</p>
                  )}
                  {engine === "v2" && v2Paired && (
                    <div className="dash-chips">
                      <span>
                        Verified candidate <b>{delivery.dispositions.verifiedCandidate.length}</b>
                      </span>
                      <span>
                        Applied <b>{delivery.dispositions.appliedChange.length}</b>
                      </span>
                    </div>
                  )}
                  {engine === "v1" && rows.length > 0 && (
                    <div className="dash-chips">
                      <span>
                        Disposition unrecorded <b>{delivery.dispositions.unrecorded.length}</b>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
        table={
          <table>
            <caption>Delivery attempts</caption>
            <thead>
              <tr>
                <th scope="col">Attempt</th>
                <th scope="col">Item</th>
                <th scope="col">Outcome</th>
                <th scope="col">Disposition</th>
                <th scope="col">Executor</th>
                <th scope="col">Estimated USD</th>
                <th scope="col">Tokens</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {delivery.attempts.map((attempt) => (
                <tr key={`${attempt.engine}:${attempt.id}`}>
                  <th scope="row">
                    {runHref(attempt) ? <a href={runHref(attempt)}>{attempt.engine.toUpperCase()}</a> : attempt.engine.toUpperCase()}
                  </th>
                  <td>{attempt.workId || "—"}</td>
                  <td>{OUTCOME_LABEL[attempt.outcome]}</td>
                  <td>{attempt.engine === "v1" ? "Unrecorded" : attempt.disposition ? OUTCOME_LABEL[attempt.disposition] || attempt.disposition.replace(/_/g, " ") : "—"}</td>
                  <td>{attempt.executor || "Unknown"}</td>
                  <td>{attempt.usage.estimatedUsd == null ? "Unknown" : usd(attempt.usage.estimatedUsd)}</td>
                  <td>{attempt.usage.tokens ? compact(attempt.usage.tokens.input + attempt.usage.tokens.output + attempt.usage.tokens.cache) : "Unknown"}</td>
                  <td>{attempt.at ? attempt.at.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <Panel
        title="Resources"
        table={
          <table>
            <caption>Known usage by executor</caption>
            <thead>
              <tr>
                <th scope="col">Executor</th>
                <th scope="col">Runs</th>
                <th scope="col">Estimated USD</th>
                <th scope="col">Tokens in</th>
                <th scope="col">Tokens out</th>
                <th scope="col">Cache</th>
                <th scope="col">Settled</th>
                <th scope="col">Unknown readings</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((row) => (
                <tr key={row.key}>
                  <th scope="row">
                    {row.engine.toUpperCase()} · {row.executor || "Unknown"}
                  </th>
                  <td>{row.runs.length}</td>
                  <td>
                    {row.estimatedUsd.known ? usd(row.estimatedUsd.sum) : "Unknown"}
                    <small> {row.estimatedUsd.known}/{row.runs.length}</small>
                  </td>
                  <td>{row.tokens.known ? compact(row.tokens.input) : "Unknown"}</td>
                  <td>{row.tokens.known ? compact(row.tokens.output) : "Unknown"}</td>
                  <td>
                    {row.tokens.known ? compact(row.tokens.cache) : "Unknown"}
                    <small> {row.tokens.known}/{row.runs.length}</small>
                  </td>
                  <td>
                    {Object.keys(row.settled).length
                      ? Object.entries(row.settled)
                          .map(([unit, amount]) => `${unit === "usd" ? usd(amount as number) : amount} ${unit === "usd" ? "" : unit}`.trim())
                          .join(" · ")
                      : "—"}
                  </td>
                  <td>{row.engine === "v1" ? "—" : row.unknownReadings}</td>
                </tr>
              ))}
              {!resources.length && (
                <tr>
                  <td colSpan={8}>None</td>
                </tr>
              )}
            </tbody>
          </table>
        }
      />

      <details className="dash-coverage">
        <summary>History coverage</summary>
        <div className="dash-table-wrap">
          <table>
            <caption>History records by campaign</caption>
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Records</th>
                <th scope="col">Exact ID</th>
                <th scope="col">Referenced</th>
                <th scope="col">No ID</th>
                <th scope="col">Day</th>
                <th scope="col">Range</th>
                <th scope="col">Undated</th>
                <th scope="col">First</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.campaign}>
                  <th scope="row">{row.campaign}</th>
                  <td>{row.records}</td>
                  <td>{row.exact}</td>
                  <td>{row.referenced}</td>
                  <td>{row.unidentified}</td>
                  <td>{row.day}</td>
                  <td>{row.range}</td>
                  <td>{row.unrecorded}</td>
                  <td>{row.earliest || "—"}</td>
                  <td>{row.logFound ? row.notes.length : "No log"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {(["records", "exact", "referenced", "unidentified", "day", "range", "unrecorded"] as const).map((field) => (
                  <td key={field}>{coverage.reduce((sum, row) => sum + row[field], 0)}</td>
                ))}
                <td>{coverage.map((row) => row.earliest).filter(Boolean).sort()[0] || "—"}</td>
                <td>{coverage.reduce((sum, row) => sum + row.notes.length, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {coverage.some((row) => row.notes.length) && (
          <ul className="dash-notes">
            {coverage.flatMap((row) =>
              row.notes.map((note) => (
                <li key={`${note.file}:${note.line}`}>
                  <a href={`#/read?file=${encodeURIComponent(note.file)}`}>
                    <small>{note.campaign}</small>
                    <span>{note.text}</span>
                  </a>
                </li>
              )),
            )}
          </ul>
        )}
        <dl className="dash-facts">
          <dt>Sprints</dt>
          <dd>{sprint.available ? "Tracked" : "Not planned"}</dd>
        </dl>
      </details>
    </div>
  );
}
