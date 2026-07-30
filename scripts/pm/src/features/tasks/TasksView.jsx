import { useMemo, useState } from "preact/hooks";
import { scanCheckboxes } from "../../../shared/md-scan.mjs";
import { allTasks, files, hideCompleted, postponed, runMutation, togglePostponed, toggleTask } from "../../app/store.js";
import { parseRoute, route } from "../../app/router.js";
import { matchesFilters, parseQuery } from "../search/queryLang.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { BoardToolbar } from "./BoardToolbar.jsx";
import { boardHash, groupTasks, readBoardState, sortTasks } from "./boardState.js";

const isChecklist = (path) => /(?:^|\/)4\s*-\s*Checklist\.md$/i.test(path);

function TaskCard({ task }) {
  return <article class="task-card"><div class="task-card-main"><button class={`checkbox ${task.state === "done" ? "checked" : ""}`} onClick={()=>toggleTask(task.file,task.cbidx)} disabled={globalThis.PM_MODE!=="server"}>{task.state==="done"?"✓":""}</button><div class="task-text">{task.text}</div></div><div class="task-meta">{task.idChip&&<Chip tone="id">{task.idChip}</Chip>}{task.severity&&<Chip tone={task.severity}>{task.severity}</Chip>}{task.effort&&<Chip>{task.effort}</Chip>}<Chip>{task.module}</Chip>{task.postponed&&<Chip>postponed</Chip>}</div><div class="task-actions"><a class="button ghost" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>Open</a><button class="button ghost" onClick={()=>togglePostponed(task.key)}><Icon name="clock" size={14}/>{task.postponed?"Resume":"Postpone"}</button>{globalThis.PM_MODE==="server"&&<a class="button ghost" href={`#/delivery?file=${encodeURIComponent(task.file)}&cb=${task.cbidx}`}><Icon name="bolt" size={14}/>Deliver</a>}</div></article>;
}

function QuickAdd({ module, lane, onClose }) {
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const checklist=files.value.find((file)=>file.module===module&&!file.inFabled&&isChecklist(file.relPath));
  const add=async(event)=>{event.preventDefault();if(!checklist||!text.trim())return;setBusy(true);const line=`- [ ] ${text.trim()}`; try{await runMutation("append",{file:checklist.relPath,afterHeading:lane,line},"Task added",(result)=>{const cbidx=scanCheckboxes(result.raw).length-1;return toggleTask(checklist.relPath,cbidx,{quiet:true});});onClose();}finally{setBusy(false);}};
  return <Modal title={`Add to ${lane}`} onClose={onClose}><form onSubmit={add}><div class="field"><label>Campaign</label><input value={module} disabled/></div><div class="field"><label>Task</label><textarea rows="4" autofocus value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="**BUD-12** Clear, verifiable outcome _(friction - S)_"/></div><button class="button primary" disabled={!checklist||busy}>{busy?"Adding…":"Add task"}</button>{!checklist&&<p class="muted">This campaign has no standard checklist file.</p>}</form></Modal>;
}

export function TasksView() {
  const table = route.value.mode === "table";
  const path = table ? "/tasks/table" : "/tasks";
  const state = readBoardState(route.value.query);
  const [showArchived, setShowArchived] = useState(false);
  const [quick, setQuick] = useState(null);
  const [sort, setSort] = useState({ key: "sectionRank", dir: 1 });

  // The URL is the state: replaceState keeps the back button meaningful (it
  // steps between pages, not between keystrokes) while making any filtered
  // board reloadable and shareable. replaceState fires no hashchange, so the
  // route signal is pushed by hand through the router's own parser.
  const update = (next) => { const hash = boardHash(path, next); history.replaceState(null, "", hash); route.value = parseRoute(hash); };

  const pool = useMemo(() => allTasks.value.filter((task) => (table || isChecklist(task.file)) && (showArchived || !task.inFabled)),
    [table, showArchived, allTasks.value]);

  const filtered = useMemo(() => {
    const parsed = parseQuery(state.query);
    return pool.filter((task) => (!hideCompleted.value || task.state !== "done")
      && matchesFilters(task, parsed.filters)
      && (!parsed.text || `${task.idChip || ""} ${task.text}`.toLowerCase().includes(parsed.text.toLowerCase())));
  }, [pool, state.query, hideCompleted.value, postponed.value]);

  const groups = useMemo(() => groupTasks(sortTasks(filtered, state.sortBy), state.groupBy), [filtered, state.sortBy, state.groupBy]);
  // Quick-add needs one unambiguous campaign to append into, so it only appears
  // when the lane grouping is active and every visible task belongs to one.
  const campaigns = [...new Set(filtered.map((task) => task.module))];
  const quickAddCampaign = globalThis.PM_MODE === "server" && state.groupBy === "lane" && campaigns.length === 1 ? campaigns[0] : null;

  return <><header class="page-head"><div><div class="eyebrow">JIRA-style workbench</div><h1>{table ? "Task table" : "Task board"}</h1><p>Checklist queues are the board's source of truth. Filters live in the URL — reload or share the link and the view survives.</p></div><div class="actions"><a class="button" href={boardHash(table ? "/tasks" : "/tasks/table", state)}>{table ? "Board view" : "Table view"}</a></div></header>

    <BoardToolbar state={state} onChange={update} shown={filtered.length} total={pool.length}
      extra={<label class="chip toggle" data-active={String(showArchived)}><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.currentTarget.checked)} style={{marginRight:6}}/>archived docs</label>}/>

    {!filtered.length
      ? <EmptyState icon="tasks" title="No matching tasks">{state.query ? <button class="button" onClick={() => update({ ...state, query: "" })}>Clear filters</button> : "Add a task to a checklist lane to see it here."}</EmptyState>
      : table
        ? <TaskTable tasks={sortTasks(filtered, state.sortBy)} sort={sort} setSort={setSort}/>
        : <div class="task-board">{groups.map((group) => <section class="lane" key={group.key}>
            <div class="lane-head"><span class="lane-title">{group.label}</span><span><Chip>{group.items.length}</Chip>{quickAddCampaign && ["Now","Next","Later"].includes(group.label) && <button class="icon-button" title={`Add to ${group.label}`} onClick={() => setQuick({ module: quickAddCampaign, lane: group.label })}><Icon name="plus"/></button>}</span></div>
            {group.items.length === 0
              ? <p class="lane-empty">Nothing here.</p>
              : group.items.map((task) => <TaskCard key={task.key} task={task}/>)}
          </section>)}</div>}

    {quick && quick.module && <QuickAdd {...quick} onClose={() => setQuick(null)}/>}</>;
}

function TaskTable({tasks,sort,setSort}) {
  const columns=[["module","Module"],["idChip","ID"],["text","Task"],["sectionRank","Section"],["severity","Severity"],["effort","Effort"],["state","State"],["file","File"]];
  const click=(key)=>setSort(sort.key===key?{key,dir:-sort.dir}:{key,dir:1});
  const rows=[...tasks].sort((a,b)=>{const av=a[sort.key]??"",bv=b[sort.key]??"";return (typeof av==="number"?av-bv:String(av).localeCompare(String(bv)))*sort.dir;});
  return <div class="task-table-wrap"><table class="task-table"><thead><tr>{columns.map(([key,label])=><th onClick={()=>click(key)}>{label}{sort.key===key?(sort.dir>0?" ↑":" ↓"):""}</th>)}</tr></thead><tbody>{rows.slice(0,500).map((task)=><tr><td>{task.module}</td><td>{task.idChip&&<Chip tone="id">{task.idChip}</Chip>}</td><td><a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a></td><td>{task.section}</td><td>{task.severity&&<Chip tone={task.severity}>{task.severity}</Chip>}</td><td>{task.effort}</td><td><button class="chip" onClick={()=>toggleTask(task.file,task.cbidx)}>{task.state}</button></td><td class="mono muted" style={{fontSize:10}}>{task.file}</td></tr>)}</tbody></table>{rows.length>500&&<div class="empty">Showing the first 500 of {rows.length} rows. Narrow the filter to keep the table responsive.</div>}</div>;
}
