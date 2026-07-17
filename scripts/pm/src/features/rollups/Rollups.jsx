import { useState } from "preact/hooks";
import { severityItems } from "../../../shared/tasks.mjs";
import { allTasks, files, hideCompleted, toggleTask } from "../../app/store.js";
import { Chip, EmptyState, StatTile } from "../../components/Primitives.jsx";

const SEV_ORDER = { blocker: 0, friction: 1, annoyance: 2, parked: 3 };
const LANES = [["Now", 0], ["Next", 1], ["Later", 2], ["Other", 3]];

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
  const [campaign, setCampaign] = useState(null);
  const tasks = allTasks.value.filter((task) => !task.inFabled);
  const campaigns = [...new Set(tasks.map((task) => task.module))].sort((a, b) => a.localeCompare(b));
  const visible = tasks.filter((task) => (!campaign || task.module === campaign) && (!hideCompleted.value || task.state === "open"));
  const laneSort = (a, b) => (a.state === "open" ? 0 : 1) - (b.state === "open" ? 0 : 1) || (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.module.localeCompare(b.module);
  return <><header class="page-head"><div><div class="eyebrow">Cross-campaign rollup</div><h1>Checklist</h1><p>Every active checkbox, with canonical ordinals shared with server mutations.</p></div></header>
    <div class="grid stats"><StatTile label="Total" value={tasks.length}/><StatTile label="Open" value={tasks.filter((t) => t.state === "open").length}/><StatTile label="Done" value={tasks.filter((t) => t.state === "done").length}/><StatTile label="Blockers" value={tasks.filter((t) => t.state === "open" && t.severity === "blocker").length}/></div>
    <div class="chip-row" style={{marginTop:20}}><button class={`button ${!campaign ? "primary" : ""}`} onClick={() => setCampaign(null)}>All</button>{campaigns.map((name) => <button class={`button ${campaign === name ? "primary" : ""}`} key={name} onClick={() => setCampaign(campaign === name ? null : name)}>{name}</button>)}</div>
    {LANES.map(([label, rank]) => { const lane = visible.filter((task) => task.sectionRank === rank).sort(laneSort); return lane.length ? <details class="task-lane" open={rank < 2} key={label}><summary><span class="eyebrow">{label}</span><span class="count">{lane.filter((t) => t.state === "open").length} open · {lane.length} total</span></summary><div class="task-lane-list">{lane.map((task) => <TaskCard task={task} showModule={!campaign} key={task.key}/>)}</div></details> : null; })}
    {!visible.length && <EmptyState icon="check" title="Nothing to show">Every matching checkbox is swept or filtered out.</EmptyState>}
  </>;
}

export function BugsRollup() {
  const bugs=files.value.filter((file)=>!file.inFabled).flatMap((file)=>severityItems(file.raw).map((bug)=>({...bug,file:file.relPath,module:file.module})));
  return <><header class="page-head"><div><div class="eyebrow">Pain inventory</div><h1>Bugs & friction</h1><p>Severity rows from the live PM corpus. Individual rows stay calm; aggregate blocker counts carry the alert signal.</p></div></header>{!bugs.length?<EmptyState icon="bug" title="No severity rows found"/>:<><div class="grid stats"><StatTile label="Blockers" value={bugs.filter((b)=>b.severity==="blocker").length}/><StatTile label="Friction" value={bugs.filter((b)=>b.severity==="friction").length}/><StatTile label="Annoyances" value={bugs.filter((b)=>b.severity==="annoyance").length}/><StatTile label="Parked" value={bugs.filter((b)=>b.severity==="parked").length}/></div><div class="search-list" style={{marginTop:24}}>{bugs.map((bug)=><a class="search-hit" href={`#/doc/${encodeURI(bug.file)}`} style={{color:"inherit"}}><Chip tone={bug.severity}>{bug.severity}</Chip> {bug.text}<div class="muted" style={{fontSize:11,marginTop:6}}>{bug.module} · {bug.file}</div></a>)}</div></>}</>;
}
