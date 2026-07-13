import { allTasks, files, modal, moduleStats } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Card, Chip, EmptyState, ProgressBar } from "../../components/Primitives.jsx";
import { Breadcrumbs } from "../nav/Breadcrumbs.jsx";

function fileWeight(path) { const name = path.split("/").pop(); if (name === "_index.md") return 0; const match = name.match(/^(\d+)/); return match ? Number(match[1]) : 99; }

export function ModuleView() {
  const campaign = route.value.module;
  const moduleFiles = files.value.filter((file) => file.module === campaign).sort((a,b) => fileWeight(a.relPath)-fileWeight(b.relPath) || a.relPath.localeCompare(b.relPath));
  const stat = moduleStats.value.find((entry) => entry.module === campaign);
  const next = allTasks.value.filter((task) => task.module === campaign && task.state === "open" && !task.inFabled).sort((a,b) => a.sectionRank-b.sectionRank).slice(0,5);
  if (!moduleFiles.length) return <EmptyState title="Campaign not found">The route does not match a PM campaign.</EmptyState>;
  return <><Breadcrumbs items={[{label:campaign}]}/><header class="page-head" style={{marginTop:18}}><div><div class="eyebrow">Campaign</div><h1>{campaign}</h1><p>{stat?.open || 0} open tasks across {stat?.files || 0} active documents.</p></div><div>{stat && <div style={{minWidth:190}}><ProgressBar value={stat.progress}/><div class="muted" style={{fontSize:11,marginTop:7}}>{stat.progress}% complete</div></div>}{globalThis.PM_MODE==="server"&&<div style={{display:"flex",gap:8,marginTop:12}}><button class="button" onClick={()=>{modal.value={type:"create",dir:campaign}}}>Create</button><button class="button" onClick={()=>{modal.value={type:"reorder",dir:campaign}}}>Reorder</button></div>}</div></header>
    <div class="grid cards">{moduleFiles.filter((file) => !file.inFabled).map((file) => <a href={`#/doc/${encodeURI(file.relPath)}`} key={file.relPath} style={{color:"inherit"}}><Card interactive><div style={{display:"flex",justifyContent:"space-between",gap:8}}><h3>{file.title}</h3><Chip>{file.tasks.filter((task)=>task.state==="open").length} open</Chip></div><div class="muted" style={{fontSize:11}}>{file.relPath}</div></Card></a>)}</div>
    {next.length > 0 && <section style={{marginTop:34}}><h2>Next up</h2><div class="grid">{next.map((task) => <a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`} class="card interactive" key={task.key} style={{color:"inherit"}}><div style={{display:"flex",gap:8}}>{task.idChip && <Chip tone="id">{task.idChip}</Chip>}<span>{task.text}</span><span class="chip" style={{marginLeft:"auto"}}>{task.section}</span></div></a>)}</div></section>}
    {moduleFiles.some((file)=>file.inFabled) && <details style={{marginTop:34}}><summary class="button">FABLED evidence layers ({moduleFiles.filter((file)=>file.inFabled).length})</summary><div class="grid cards" style={{marginTop:14}}>{moduleFiles.filter((file)=>file.inFabled).map((file)=><a href={`#/doc/${encodeURI(file.relPath)}`} class="card interactive" key={file.relPath}>{file.title}</a>)}</div></details>}
  </>;
}
