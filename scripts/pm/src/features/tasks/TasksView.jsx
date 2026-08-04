import { useMemo, useState } from "preact/hooks";
import { isChecklistPath } from "../../../shared/tasks.mjs";
import { allTasks, archiveTask, files, hideCompleted, moveTask, postponed, runMutation, togglePostponed, toggleTask } from "../../app/store.js";
import { parseRoute, route } from "../../app/router.js";
import { matchesFilters, parseQuery } from "../search/queryLang.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { BoardToolbar } from "./BoardToolbar.jsx";
import { boardHash, groupTasks, readBoardState, sortTasks } from "./boardState.js";

const lanes = ["Now", "Next", "Later"];
const isChecklist = isChecklistPath;

function TaskCard({ task }) {
  const canArchive = globalThis.PM_MODE === "server" && isChecklist(task.file);
  const canMove = canArchive && task.state === "open";
  const onMove = (event) => {
    const select = event.currentTarget;
    const target = select.value;
    select.value = "";
    if (target) moveTask(task, target);
  };

  return <article class={`task-card ${task.state === "done" ? "done" : ""}`}>
    <div class="task-card-main"><button class={`checkbox ${task.state === "done" ? "checked" : ""}`} onClick={() => toggleTask(task.file, task.cbidx)} disabled={globalThis.PM_MODE !== "server"}>{task.state === "done" ? "✓" : ""}</button><div class="task-card-copy"><div class="task-card-eyeline">{task.idChip && <Chip tone="id">{task.idChip}</Chip>}<Chip tone={task.severity}>{task.severity || "unrated"}</Chip></div><a class="task-text" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a><div class="task-card-foot"><span>{task.module}</span><span>{task.effort || "—"}</span>{task.postponed && <span>postponed</span>}</div></div></div>
    <div class="task-actions"><a class="button ghost" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>Open</a>{canMove && <label class="move-control"><span class="sr-only">Move task</span><select value="" onChange={onMove} aria-label={`Move ${task.idChip || "task"} to another lane`}><option value="" disabled>Move</option>{lanes.filter((lane) => lane !== task.section).map((lane) => <option value={lane} key={lane}>{lane}</option>)}</select></label>}<button class="button ghost secondary-action" onClick={() => togglePostponed(task.key)}><Icon name="clock" size={14} />{task.postponed ? "Resume" : "Postpone"}</button>{globalThis.PM_MODE === "server" && task.state === "open" && <a class="button ghost secondary-action" href={`#/delivery/new?file=${encodeURIComponent(task.file)}&cb=${task.cbidx}`}><Icon name="bolt" size={14} />Deliver</a>}{canArchive && task.state === "done" && <button class="button ghost ship secondary-action" title="File into the Master Book's Shipped Log" onClick={() => archiveTask(task.file, task.cbidx, "ship")}><Icon name="archive" size={14} />Ship</button>}{canArchive && <button class="button ghost discard secondary-action" title="Archive as Cancelled" onClick={() => archiveTask(task.file, task.cbidx, "discard")}><Icon name="ban" size={14} />Discard</button>}</div>
  </article>;
}

function NewTaskDialog({ initialModule, initialLane = "Now", onClose }) {
  const [module, setModule] = useState(initialModule || "");
  const [lane, setLane] = useState(initialLane);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const checklists = files.value.filter((file) => !file.inFabled && isChecklist(file.relPath));
  const checklist = checklists.find((file) => file.module === module);
  const add = async (event) => {
    event.preventDefault();
    if (!checklist || !text.trim()) return;
    setBusy(true);
    try {
      await runMutation("append", { file: checklist.relPath, afterHeading: lane, line: `- [ ] ${text.trim()}` }, "Task added", (result) => runMutation("restore", { snapshots: result.undo }, "Task removed"));
      onClose();
    } finally { setBusy(false); }
  };

  return <Modal title="New work item" onClose={onClose}><form onSubmit={add}><div class="form-grid"><div class="field"><label>Campaign</label><select value={module} onChange={(event) => setModule(event.currentTarget.value)}><option value="" disabled>Select a campaign</option>{checklists.map((file) => <option value={file.module} key={file.relPath}>{file.module}</option>)}</select></div><div class="field"><label>Lane</label><select value={lane} onChange={(event) => setLane(event.currentTarget.value)}>{lanes.map((value) => <option value={value} key={value}>{value}</option>)}</select></div></div><div class="field"><label>Outcome</label><textarea rows="5" autofocus value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="**BUD-12** Clear, verifiable outcome _(friction - S)_" /></div><div class="modal-actions"><button type="button" class="button" onClick={onClose}>Cancel</button><button class="button primary" disabled={!checklist || !text.trim() || busy}>{busy ? "Adding…" : "Add work item"}</button></div></form></Modal>;
}

export function TasksView() {
  const table = route.value.mode === "table";
  const path = table ? "/work/table" : "/work";
  const state = readBoardState(route.value.query);
  const [showArchived, setShowArchived] = useState(false);
  const [quick, setQuick] = useState(null);
  const [sort, setSort] = useState({ key: "sectionRank", dir: 1 });
  const update = (next) => { const hash = boardHash(path, next); history.replaceState(null, "", hash); route.value = parseRoute(hash); };

  const pool = useMemo(() => allTasks.value.filter((task) => (table || isChecklist(task.file)) && (showArchived || !task.inFabled)), [table, showArchived, allTasks.value]);
  const filtered = useMemo(() => {
    const parsed = parseQuery(state.query);
    return pool.filter((task) => (!hideCompleted.value || task.state !== "done") && matchesFilters(task, parsed.filters) && (!parsed.text || `${task.idChip || ""} ${task.text}`.toLowerCase().includes(parsed.text.toLowerCase())));
  }, [pool, state.query, hideCompleted.value, postponed.value]);
  const groups = useMemo(() => groupTasks(sortTasks(filtered, state.sortBy), state.groupBy), [filtered, state.sortBy, state.groupBy]);
  const campaigns = [...new Set(filtered.map((task) => task.module))];
  const checklistModules = [...new Set(files.value.filter((file) => !file.inFabled && isChecklist(file.relPath)).map((file) => file.module))];
  const quickAddCampaign = campaigns.length === 1 ? campaigns[0] : checklistModules[0];

  return <><header class="page-head command-head"><div><div class="eyebrow">JIRA-style workbench</div><h1>Work queue</h1><p>Move work between Now, Next, and Later, complete items, launch delivery, or open the Markdown source. Filters persist in the URL.</p></div><div class="actions"><button class="button" onClick={() => { hideCompleted.value = !hideCompleted.value; }}>{hideCompleted.value ? "Show completed" : "Hide completed"}</button>{globalThis.PM_MODE === "server" && <button class="button primary" onClick={() => setQuick({ module: quickAddCampaign, lane: "Now" })}><Icon name="plus" />New task</button>}</div></header>
    <BoardToolbar state={state} onChange={update} shown={filtered.length} total={pool.length} extra={<><label class="chip toggle" data-active={String(showArchived)}><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.currentTarget.checked)} />archived</label><a class="chip view-switch" href={boardHash(table ? "/work" : "/work/table", state)}>{table ? "Board" : "Table"}</a></>} />
    {!filtered.length ? <EmptyState icon="tasks" title="No matching tasks">{state.query ? <button class="button" onClick={() => update({ ...state, query: "" })}>Clear filters</button> : "Add a task to a checklist lane to see it here."}</EmptyState> : table ? <TaskTable tasks={sortTasks(filtered, state.sortBy)} sort={sort} setSort={setSort} /> : <div class="task-board">{groups.map((group) => <section class="lane" key={group.key}><div class="lane-head"><span class="lane-title">{group.label}</span><span><Chip>{group.items.length}</Chip>{globalThis.PM_MODE === "server" && state.groupBy === "lane" && lanes.includes(group.label) && <button class="icon-button" title={`Add to ${group.label}`} onClick={() => setQuick({ module: quickAddCampaign, lane: group.label })}><Icon name="plus" /></button>}</span></div>{group.items.length === 0 ? <p class="lane-empty">Nothing here.</p> : group.items.map((task) => <TaskCard key={task.key} task={task} />)}</section>)}</div>}
    {quick && <NewTaskDialog initialModule={quick.module} initialLane={quick.lane} onClose={() => setQuick(null)} />}</>;
}

function TaskTable({ tasks, sort, setSort }) {
  const columns = [["module", "Project"], ["idChip", "ID"], ["text", "Task"], ["sectionRank", "Lane"], ["severity", "Severity"], ["effort", "Effort"], ["state", "State"], ["file", "Source"]];
  const click = (key) => setSort(sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 });
  const rows = [...tasks].sort((a, b) => { const av = a[sort.key] ?? "", bv = b[sort.key] ?? ""; return (typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir; });
  return <div class="task-table-wrap"><table class="task-table"><thead><tr>{columns.map(([key, label]) => <th onClick={() => click(key)}>{label}{sort.key === key ? sort.dir > 0 ? " ↑" : " ↓" : ""}</th>)}</tr></thead><tbody>{rows.slice(0, 500).map((task) => <tr><td>{task.module}</td><td>{task.idChip && <Chip tone="id">{task.idChip}</Chip>}</td><td><a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a></td><td>{task.section}</td><td>{task.severity && <Chip tone={task.severity}>{task.severity}</Chip>}</td><td>{task.effort}</td><td><button class="chip" onClick={() => toggleTask(task.file, task.cbidx)}>{task.state}</button></td><td class="mono muted source-cell">{task.file}</td></tr>)}</tbody></table>{rows.length > 500 && <div class="empty">Showing the first 500 of {rows.length} rows. Narrow the filter to keep the table responsive.</div>}</div>;
}
