import { useMemo, useState } from "preact/hooks";
import { scanCheckboxes } from "../../../shared/md-scan.mjs";
import { allTasks, files, hideCompleted, postponed, runMutation, togglePostponed, toggleTask } from "../../app/store.js";
import { route } from "../../app/router.js";
import { matchesFilters, parseQuery } from "../search/queryLang.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";

const lanes = ["Now", "Next", "Later"];
const isChecklist = (path) => /(?:^|\/)4\s*-\s*Checklist\.md$/i.test(path);

function TaskCard({ task }) {
  return <article class="task-card"><div class="task-card-main"><button class={`checkbox ${task.state === "done" ? "checked" : ""}`} onClick={()=>toggleTask(task.file,task.cbidx)} disabled={globalThis.PM_MODE!=="server"}>{task.state==="done"?"✓":""}</button><div class="task-text">{task.text}</div></div><div class="task-meta">{task.idChip&&<Chip tone="id">{task.idChip}</Chip>}{task.severity&&<Chip tone={task.severity}>{task.severity}</Chip>}{task.effort&&<Chip>{task.effort}</Chip>}<Chip>{task.module}</Chip>{task.postponed&&<Chip>postponed</Chip>}</div><div class="task-actions"><a class="button ghost" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>Open</a><button class="button ghost" onClick={()=>togglePostponed(task.key)}><Icon name="clock" size={14}/>{task.postponed?"Resume":"Postpone"}</button>{globalThis.PM_MODE==="server"&&<a class="button ghost" href={`#/delivery?file=${encodeURIComponent(task.file)}&cb=${task.cbidx}`}><Icon name="bolt" size={14}/>Deliver</a>}</div></article>;
}

function QuickAdd({ module, lane, onClose }) {
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const checklist=files.value.find((file)=>file.module===module&&!file.inFabled&&isChecklist(file.relPath));
  const add=async(event)=>{event.preventDefault();if(!checklist||!text.trim())return;setBusy(true);const line=`- [ ] ${text.trim()}`; try{await runMutation("append",{file:checklist.relPath,afterHeading:lane,line},"Task added",(result)=>{const cbidx=scanCheckboxes(result.raw).length-1;return toggleTask(checklist.relPath,cbidx,{quiet:true});});onClose();}finally{setBusy(false);}};
  return <Modal title={`Add to ${lane}`} onClose={onClose}><form onSubmit={add}><div class="field"><label>Campaign</label><input value={module} disabled/></div><div class="field"><label>Task</label><textarea rows="4" autofocus value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="**R1** Clear, verifiable outcome _(friction - S)_"/></div><button class="button primary" disabled={!checklist||busy}>{busy?"Adding…":"Add task"}</button>{!checklist&&<p class="muted">This campaign has no standard checklist file.</p>}</form></Modal>;
}

export function TasksView() {
  const table=route.value.mode==="table"; const [module,setModule]=useState("All"); const [showFabled,setShowFabled]=useState(false); const [query,setQuery]=useState(route.value.query.get("q")||""); const [quick,setQuick]=useState(null); const [sort,setSort]=useState({key:"sectionRank",dir:1});
  const tasks=useMemo(()=>{const parsed=parseQuery(query);return allTasks.value.filter((task)=>(table||isChecklist(task.file))&&(showFabled||!task.inFabled)&&(module==="All"||task.module===module)&&(!hideCompleted.value||task.state!=="done")&&matchesFilters(task,parsed.filters)&&(!parsed.text||`${task.idChip||""} ${task.text}`.toLowerCase().includes(parsed.text.toLowerCase()))).sort((a,b)=>{const av=a[sort.key]??"",bv=b[sort.key]??"";return (typeof av==="number"?av-bv:String(av).localeCompare(String(bv)))*sort.dir;});},[table,module,showFabled,query,sort,allTasks.value,hideCompleted.value,postponed.value]);
  const modules=["All",...new Set(allTasks.value.filter((task)=>!task.inFabled).map((task)=>task.module))];
  return <><header class="page-head"><div><div class="eyebrow">JIRA-style workbench</div><h1>{table?"Task table":"Task board"}</h1><p>Checklist queues are the board’s source of truth. Open any task for exact document context.</p></div><div class="actions"><a class="button" href={table?"#/tasks":"#/tasks/table"}>{table?"Board view":"Table view"}</a></div></header>
    <div class="task-toolbar"><input class="search-trigger" value={query} onInput={(event)=>setQuery(event.currentTarget.value)} placeholder="Filter tasks · m:Budget s:blocker is:open"/>{modules.map((name)=><button class={`button ${module===name?"primary":""}`} onClick={()=>setModule(name)}>{name}</button>)}<label class="button"><input type="checkbox" checked={showFabled} onChange={(event)=>setShowFabled(event.currentTarget.checked)}/>FABLED</label></div>
    {!tasks.length?<EmptyState icon="tasks" title="No matching tasks">Change filters or add a task to a checklist lane.</EmptyState>:table?<TaskTable tasks={tasks} sort={sort} setSort={setSort}/>:<div class="task-board">{lanes.map((lane)=><section class="lane"><div class="lane-head"><span class="lane-title">{lane}</span><span><Chip>{tasks.filter((task)=>task.section.toLowerCase()===lane.toLowerCase()).length}</Chip>{globalThis.PM_MODE==="server"&&module!=="All"&&<button class="icon-button" title={`Add to ${lane}`} onClick={()=>setQuick({module,lane})}><Icon name="plus"/></button>}</span></div>{tasks.filter((task)=>task.section.toLowerCase()===lane.toLowerCase()).map((task)=><TaskCard key={task.key} task={task}/>)}</section>)}</div>}
    {quick&&<QuickAdd {...quick} onClose={()=>setQuick(null)}/>}</>;
}

function TaskTable({tasks,sort,setSort}) {
  const columns=[["module","Module"],["idChip","ID"],["text","Task"],["sectionRank","Section"],["severity","Severity"],["effort","Effort"],["state","State"],["file","File"]];
  const click=(key)=>setSort(sort.key===key?{key,dir:-sort.dir}:{key,dir:1});
  return <div class="task-table-wrap"><table class="task-table"><thead><tr>{columns.map(([key,label])=><th onClick={()=>click(key)}>{label}{sort.key===key?(sort.dir>0?" ↑":" ↓"):""}</th>)}</tr></thead><tbody>{tasks.slice(0,500).map((task)=><tr><td>{task.module}</td><td>{task.idChip&&<Chip tone="id">{task.idChip}</Chip>}</td><td><a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a></td><td>{task.section}</td><td>{task.severity&&<Chip tone={task.severity}>{task.severity}</Chip>}</td><td>{task.effort}</td><td><button class="chip" onClick={()=>toggleTask(task.file,task.cbidx)}>{task.state}</button></td><td class="mono muted" style={{fontSize:10}}>{task.file}</td></tr>)}</tbody></table>{tasks.length>500&&<div class="empty">Showing the first 500 of {tasks.length} rows. Narrow the filter to keep the table responsive.</div>}</div>;
}
