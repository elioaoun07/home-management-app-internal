import { allTasks, byRelPath, inboxCount, menuOpen, moduleStats, pins, recents } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";

function NavLink({ href, icon, children, count, legacy = [] }) {
  const active = route.value.path === href
    || (href !== "/" && route.value.path.startsWith(href))
    || legacy.some((path) => route.value.path.startsWith(path));
  return <a class={`nav-link ${active ? "active" : ""}`} href={`#${href}`} onClick={() => { menuOpen.value = false; }}>
    <Icon name={icon} />
    <span>{children}</span>
    {count != null && <span class="count">{count}</span>}
  </a>;
}

function FileLinks({ paths }) {
  return paths.map((path) => {
    const file = byRelPath.value.get(path.toLowerCase());
    return file ? <a class="nav-link" href={`#/doc/${encodeURI(file.relPath)}`} key={path}><Icon name="file" size={15} /><span class="nav-ellipsis">{file.title}</span></a> : null;
  });
}

export function Sidebar() {
  const openWork = allTasks.value.filter((task) => task.state === "open" && !task.inFabled).length;
  return <aside class="sidebar">
    <div class="brand"><div class="brand-mark">E</div><div class="brand-copy"><strong>PM Command Center</strong><span>Owner workspace</span></div></div>

    <div class="side-section">
      <div class="side-label">Workspace</div>
      <NavLink href="/" icon="home">Overview</NavLink>
      <NavLink href="/work" icon="tasks" count={openWork} legacy={["/tasks"]}>Work queue</NavLink>
      <NavLink href="/projects" icon="projects">Projects</NavLink>
      {globalThis.PM_MODE === "server" && <NavLink href="/delivery" icon="bolt">Delivery</NavLink>}
      <NavLink href="/activity" icon="activity">Activity</NavLink>
    </div>

    <div class="side-section">
      <div class="side-label">Campaigns</div>
      {moduleStats.value.map((stat) => <NavLink href={`/module/${encodeURIComponent(stat.module)}`} icon="folder" count={stat.open} key={stat.module}>{stat.module}</NavLink>)}
    </div>

    {(pins.value.length > 0 || recents.value.length > 0) && <div class="side-section">
      <div class="side-label">Documents</div>
      <FileLinks paths={[...pins.value, ...recents.value.filter((path) => !pins.value.includes(path))].slice(0, 6)} />
    </div>}

    <div class="side-section side-utilities">
      <div class="side-label">Utilities</div>
      <NavLink href="/inbox" icon="inbox" count={inboxCount.value || undefined}>Idea inbox</NavLink>
      <NavLink href="/checklist" icon="check">Checklist</NavLink>
      <NavLink href="/bugs" icon="bug">Blockers</NavLink>
    </div>

    <div class="owner-card"><div class="owner-avatar">EA</div><div><strong>Elio Aoun</strong><span>Workspace owner</span></div></div>
  </aside>;
}
