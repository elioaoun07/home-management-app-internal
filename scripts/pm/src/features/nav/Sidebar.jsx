import { byRelPath, inboxCount, menuOpen, modal, pins, recents } from "../../app/store.js";
import { campaigns, ownerDecisions, workItems } from "../../app/productStore.js";
import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";
import { AREA_ICONS, projectPath } from "../../lib/portfolio.js";

function NavLink({ href, icon, children, count, active: forced }) {
  const active = forced ?? (route.value.path === href || href !== "/" && route.value.path.startsWith(href));
  return <a class={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} href={`#${href}`} onClick={() => { menuOpen.value = false; }}><Icon name={icon}/><span>{children}</span>{count != null && <span class="count">{count}</span>}</a>;
}
export function Sidebar() {
  const open = workItems.value.filter((task) => task.state === "open").length;
  const references = [...pins.value, ...recents.value.filter((path) => !pins.value.includes(path))].slice(0, 3);
  return <aside class="sidebar">
    <a class="brand" href="#/"><div class="brand-mark">E</div><div class="brand-copy"><strong>ERA</strong><span>Command Center</span></div></a>
    <nav aria-label="Workspace" class="side-section"><div class="side-label">Workspace</div>
      <NavLink href="/" icon="projects" active={["home", "projects", "module"].includes(route.value.name)}>Project</NavLink>
      <NavLink href="/work" icon="tasks" count={open}>Work</NavLink>
      {globalThis.PM_MODE === "server" && <NavLink href="/delivery" icon="bolt">Delivery</NavLink>}
      <NavLink href="/decisions" icon="bulb" count={ownerDecisions.value.length || undefined}>Decisions</NavLink>
      <NavLink href="/activity" icon="archive">Outcomes</NavLink>
    </nav>
    <details class="side-section campaign-nav area-shortcuts"><summary>Areas<span>{campaigns.value.length}</span></summary>{campaigns.value.map((campaign) => <NavLink href={projectPath({ selection: campaign.name })} active={route.value.query.get("select") === campaign.name || route.value.module === campaign.name} icon={AREA_ICONS[campaign.name]} count={campaign.open.length} key={campaign.name}>{campaign.name}</NavLink>)}</details>
    <div class="side-section side-utilities"><NavLink href="/inbox" icon="inbox" count={inboxCount.value || undefined}>Inbox</NavLink><NavLink href="/search" icon="search">Search</NavLink><details class="reference-nav"><summary>References</summary><NavLink href="/checklist" icon="check">All checklists</NavLink><NavLink href="/bugs" icon="bug">Pain inventory</NavLink>{references.map((path) => { const file = byRelPath.value.get(path.toLowerCase()); return file ? <a class="nav-link" href={`#/doc/${encodeURI(path)}`} key={path}><Icon name="file"/><span class="nav-ellipsis">{file.title}</span></a> : null; })}{globalThis.PM_MODE === "server" && <button class="nav-link" onClick={() => { modal.value = { type: "create", dir: "" }; }}>Create document</button>}</details></div>
    <div class="workspace-status"><span class="status-beacon"/><span>{globalThis.PM_MODE === "server" ? "Local workspace" : "Read-only snapshot"}</span></div>
  </aside>;
}
