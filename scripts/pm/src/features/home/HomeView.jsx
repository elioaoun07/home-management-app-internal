import { allTasks, files, moduleStats } from "../../app/store.js";
import { Card, Chip, ProgressBar, StatTile } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { isCompact } from "../../lib/media.js";
import { MobileHome } from "./MobileHome.jsx";

export function HomeView() {
  if (isCompact.value) return <MobileHome/>;
  const open = allTasks.value.filter((task) => task.state === "open" && !task.inFabled);
  const done = allTasks.value.filter((task) => task.state === "done" && !task.inFabled).length;
  const blockers = open.filter((task) => task.severity === "blocker").length;
  return <><header class="page-head"><div><div class="eyebrow">Owner surface</div><h1>Command center</h1><p>One place to read project truth, work the queue, search the vault, and supervise agentic delivery.</p></div><a class="button primary" href="#/tasks"><Icon name="bolt"/>Focus the queue</a></header>
    <div class="grid stats"><StatTile label="Campaigns" value={moduleStats.value.length}/><StatTile label="Open work" value={open.length}/><StatTile label="Completed" value={done}/><StatTile label="Blockers" value={blockers} detail="Shown in amber, never red"/></div>
    <section style={{marginTop:32}}><div class="page-head"><div><div class="eyebrow">Portfolio health</div><h2>Campaigns</h2></div></div><div class="grid cards">{moduleStats.value.map((stat) => <a href={`#/module/${encodeURIComponent(stat.module)}`} key={stat.module} style={{color:"inherit"}}><Card interactive><div style={{display:"flex",justifyContent:"space-between",gap:10}}><h3>{stat.module}</h3><Chip>{stat.open} open</Chip></div><ProgressBar value={stat.progress}/><div class="muted" style={{fontSize:11,marginTop:9}}>{stat.progress}% complete · {stat.files} active docs</div></Card></a>)}</div></section>
    <section style={{marginTop:32}}><div class="page-head"><div><div class="eyebrow">Next up</div><h2>Highest-signal open work</h2></div><a href="#/tasks">Open board →</a></div><div class="grid cards">{open.sort((a,b) => a.sectionRank-b.sectionRank || (a.severity === "blocker" ? -1 : 1)).slice(0,6).map((task) => <a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`} key={task.key} style={{color:"inherit"}}><Card interactive><div style={{display:"flex",gap:7,marginBottom:8}}>{task.idChip && <Chip tone="id">{task.idChip}</Chip>}{task.severity && <Chip tone={task.severity}>{task.severity}</Chip>}</div><strong>{task.text}</strong><div class="muted" style={{fontSize:11,marginTop:9}}>{task.module} · {task.section}</div></Card></a>)}</div></section>
  </>;
}

