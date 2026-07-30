import { useMemo, useState } from "preact/hooks";
import { severityItems } from "../../../shared/tasks.mjs";
import { allTasks, files, hideCompleted, toggleTask } from "../../app/store.js";
import { parseRoute, route } from "../../app/router.js";
import { matchesFilters, parseQuery } from "../search/queryLang.js";
import { BoardToolbar } from "../tasks/BoardToolbar.jsx";
import { boardHash, groupTasks, readBoardState, sortTasks } from "../tasks/boardState.js";
import { Chip, EmptyState, StatTile } from "../../components/Primitives.jsx";

// Shared readable checkbox row: chips on one line, the full item text wrapped
// on its own line below. Used by the Checklist rollup and the mobile home.
export function TaskCard({ task, showModule = true }) {
  return <div class={`task-card ${task.state === "done" ? "done" : ""}`}>
    <button class={`checkbox ${task.state === "done" ? "checked" : ""}`} aria-label={task.state === "done" ? "Reopen task" : "Complete task"} onClick={() => toggleTask(task.file, task.cbidx)}>{task.state === "done" ? "✓" : ""}</button>
    <div class="task-card-body">
      <div class="task-card-chips">{task.idChip && <Chip tone="id">{task.idChip}</Chip>}{task.severity && <Chip tone={task.severity}>{task.severity}</Chip>}{task.effort && <Chip>{task.effort}</Chip>}{showModule && <Chip>{task.module}</Chip>}</div>
      <a class="task-card-text" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a>
    </div>
  </div>;
}

export function ChecklistRollup() {
  const state = readBoardState(route.value.query);
  const update = (next) => { const hash = boardHash("/checklist", next); history.replaceState(null, "", hash); route.value = parseRoute(hash); };

  const pool = allTasks.value.filter((task) => !task.inFabled);
  const filtered = useMemo(() => {
    const parsed = parseQuery(state.query);
    return pool.filter((task) => (!hideCompleted.value || task.state === "open")
      && matchesFilters(task, parsed.filters)
      && (!parsed.text || `${task.idChip || ""} ${task.text}`.toLowerCase().includes(parsed.text.toLowerCase())));
  }, [pool, state.query, hideCompleted.value]);
  const groups = useMemo(() => groupTasks(sortTasks(filtered, state.sortBy), state.groupBy), [filtered, state.sortBy, state.groupBy]);
  const singleCampaign = new Set(filtered.map((task) => task.module)).size === 1;

  return <><header class="page-head"><div><div class="eyebrow">Cross-campaign rollup</div><h1>Checklist</h1><p>Every active checkbox, with canonical ordinals shared with server mutations.</p></div></header>
    <div class="grid stats"><StatTile label="Total" value={pool.length}/><StatTile label="Open" value={pool.filter((t) => t.state === "open").length}/><StatTile label="Done" value={pool.filter((t) => t.state === "done").length}/><StatTile label="Blockers" value={pool.filter((t) => t.state === "open" && t.severity === "blocker").length}/></div>

    <BoardToolbar state={state} onChange={update} shown={filtered.length} total={pool.length}/>

    {!filtered.length
      ? <EmptyState icon="check" title="Nothing to show">{state.query ? <button class="button" onClick={() => update({ ...state, query: "" })}>Clear filters</button> : "Every matching checkbox is swept or filtered out."}</EmptyState>
      : groups.map((group, index) => group.items.length
          ? <details class="task-lane" open={index < 2} key={group.key}>
              <summary><span class="eyebrow">{group.label}</span><span class="count">{group.items.filter((t) => t.state === "open").length} open · {group.items.length} total</span></summary>
              <div class="task-lane-list">{group.items.map((task) => <TaskCard task={task} showModule={!singleCampaign} key={task.key}/>)}</div>
            </details>
          : null)}
  </>;
}

export function BugsRollup() {
  const [query, setQuery] = useState("");
  const bugs = files.value.filter((file) => !file.inFabled).flatMap((file) => severityItems(file.raw).map((bug) => ({ ...bug, file: file.relPath, module: file.module })));
  const parsed = parseQuery(query);
  const shown = bugs.filter((bug) => matchesFilters({ ...bug, type: "bug" }, parsed.filters) && (!parsed.text || bug.text.toLowerCase().includes(parsed.text.toLowerCase())));
  return <><header class="page-head"><div><div class="eyebrow">Pain inventory</div><h1>Bugs &amp; friction</h1><p>Severity rows from every campaign's Master Book. Individual rows stay calm; aggregate blocker counts carry the alert signal.</p></div></header>
    {!bugs.length ? <EmptyState icon="bug" title="No severity rows found"/> : <>
      <div class="grid stats">{["blocker", "friction", "annoyance", "parked"].map((severity) => <StatTile key={severity} label={severity[0].toUpperCase() + severity.slice(1) + (severity === "friction" ? "" : "s")} value={bugs.filter((bug) => bug.severity === severity).length}/>)}</div>
      <div class="board-toolbar" style={{marginTop:18}}>
        <div class="board-search"><input value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="Filter pains — or m:Schedule s:blocker" aria-label="Filter pains"/></div>
        <div class="board-chips">{["blocker", "friction", "annoyance", "parked"].map((severity) => <button class="chip toggle" key={severity} data-active={String(parsed.filters.s === severity)} onClick={() => setQuery(parsed.filters.s === severity ? "" : `s:${severity}`)}>{severity}</button>)}</div>
        <p class="board-count">{shown.length === bugs.length ? `${bugs.length} shown` : `${shown.length} of ${bugs.length}`}</p>
      </div>
      {!shown.length
        ? <EmptyState icon="bug" title="No matching pains"><button class="button" onClick={() => setQuery("")}>Clear filters</button></EmptyState>
        : <div class="search-list" style={{marginTop:18}}>{shown.map((bug) => <a class="search-hit" href={`#/doc/${encodeURI(bug.file)}`} key={`${bug.file}:${bug.line}`} style={{color:"inherit"}}><Chip tone={bug.severity}>{bug.severity}</Chip> {bug.text}<div class="muted" style={{fontSize:11,marginTop:6}}>{bug.module} · {bug.file}</div></a>)}</div>}
    </>}</>;
}
