import { severityItems } from "../../../shared/tasks.mjs";
import { allTasks, files, toggleTask } from "../../app/store.js";
import { Chip, EmptyState, StatTile } from "../../components/Primitives.jsx";

export function ChecklistRollup() {
  const tasks=allTasks.value.filter((task)=>!task.inFabled);
  return <><header class="page-head"><div><div class="eyebrow">Cross-campaign rollup</div><h1>Checklist</h1><p>Every active checkbox, with canonical ordinals shared with server mutations.</p></div></header><div class="grid stats"><StatTile label="Total" value={tasks.length}/><StatTile label="Open" value={tasks.filter((t)=>t.state==="open").length}/><StatTile label="Done" value={tasks.filter((t)=>t.state==="done").length}/><StatTile label="Blockers" value={tasks.filter((t)=>t.state==="open"&&t.severity==="blocker").length}/></div><div class="search-list" style={{marginTop:24}}>{tasks.map((task)=><div class="search-hit" style={{display:"flex",gap:10,alignItems:"center"}}><button class={`checkbox ${task.state==="done"?"checked":""}`} onClick={()=>toggleTask(task.file,task.cbidx)}>{task.state==="done"?"✓":""}</button><a style={{flex:1}} href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a><Chip>{task.module}</Chip></div>)}</div></>;
}

export function BugsRollup() {
  const bugs=files.value.filter((file)=>!file.inFabled).flatMap((file)=>severityItems(file.raw).map((bug)=>({...bug,file:file.relPath,module:file.module})));
  return <><header class="page-head"><div><div class="eyebrow">Pain inventory</div><h1>Bugs & friction</h1><p>Severity rows from the live PM corpus. Individual rows stay calm; aggregate blocker counts carry the alert signal.</p></div></header>{!bugs.length?<EmptyState icon="bug" title="No severity rows found"/>:<><div class="grid stats"><StatTile label="Blockers" value={bugs.filter((b)=>b.severity==="blocker").length}/><StatTile label="Friction" value={bugs.filter((b)=>b.severity==="friction").length}/><StatTile label="Annoyances" value={bugs.filter((b)=>b.severity==="annoyance").length}/><StatTile label="Parked" value={bugs.filter((b)=>b.severity==="parked").length}/></div><div class="search-list" style={{marginTop:24}}>{bugs.map((bug)=><a class="search-hit" href={`#/doc/${encodeURI(bug.file)}`} style={{color:"inherit"}}><Chip tone={bug.severity}>{bug.severity}</Chip> {bug.text}<div class="muted" style={{fontSize:11,marginTop:6}}>{bug.module} · {bug.file}</div></a>)}</div></>}</>;
}

