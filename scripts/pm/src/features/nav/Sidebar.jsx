import { byRelPath, files, hideCompleted, menuOpen, moduleNames, pins, recents } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";

function NavLink({ href, icon, children, count }) {
  const active = route.value.path === href || (href !== "/" && route.value.path.startsWith(href));
  return <a class={`nav-link ${active ? "active" : ""}`} href={`#${href}`} onClick={() => { menuOpen.value = false; }}><Icon name={icon}/><span>{children}</span>{count != null && <span class="count">{count}</span>}</a>;
}

function FileLinks({ paths }) {
  return paths.map((path) => { const file = byRelPath.value.get(path.toLowerCase()); return file ? <a class="nav-link" href={`#/doc/${encodeURI(file.relPath)}`} key={path}><Icon name="file" size={15}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.title}</span></a> : null; });
}

export function Sidebar() {
  return <aside class="sidebar"><div class="brand"><div class="brand-mark">E</div><div class="brand-copy"><strong>PM Command Center</strong><span>ERA owner workspace</span></div></div>
    <div class="side-section"><NavLink href="/" icon="home">Overview</NavLink><NavLink href="/tasks" icon="tasks">Task board</NavLink><NavLink href="/tasks/table" icon="tasks">Task table</NavLink><NavLink href="/checklist" icon="check">Checklist</NavLink><NavLink href="/bugs" icon="bug">Bugs</NavLink>{globalThis.PM_MODE === "server" && <NavLink href="/delivery" icon="bolt">Delivery</NavLink>}</div>
    {pins.value.length > 0 && <div class="side-section"><div class="side-label">Pinned</div><FileLinks paths={pins.value}/></div>}
    {recents.value.length > 0 && <div class="side-section"><div class="side-label">Recent</div><FileLinks paths={recents.value}/></div>}
    <div class="side-section"><div class="side-label">Campaigns</div>{moduleNames.value.map((module) => <NavLink href={`/module/${encodeURIComponent(module)}`} icon="folder" count={files.value.filter((file) => file.module === module).length} key={module}>{module}</NavLink>)}</div>
    <label class="nav-link"><input type="checkbox" checked={hideCompleted.value} onChange={(event) => { hideCompleted.value = event.currentTarget.checked; }}/><span>Hide completed</span></label>
    <div class="side-label" style={{marginTop:18}}>Updated {dataStamp()}</div>
  </aside>;
}

function dataStamp() { const stamp = globalThis.PM_DATA?.generatedAt; return stamp ? new Date(stamp).toLocaleDateString() : "live"; }

