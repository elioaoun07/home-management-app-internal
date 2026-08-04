import { useMemo, useState } from "preact/hooks";
import { allTasks, moduleStats } from "../../app/store.js";
import { Chip, EmptyState, ProgressBar } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";

function projectHealth(openTasks, progress) {
  if (openTasks.some((task) => task.severity === "blocker")) return "at-risk";
  if (progress >= 65) return "healthy";
  return "watch";
}

export function ProjectsView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("health");

  const projects = useMemo(() => moduleStats.value.map((stat) => {
    const tasks = allTasks.value.filter((task) => task.module === stat.module && !task.inFabled);
    const openTasks = tasks.filter((task) => task.state === "open").sort((a, b) => a.sectionRank - b.sectionRank);
    return { ...stat, openTasks, blockers: openTasks.filter((task) => task.severity === "blocker").length, health: projectHealth(openTasks, stat.progress) };
  }), [moduleStats.value, allTasks.value]);

  const visible = projects.filter((project) => project.module.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || project.health === filter)).sort((a, b) => {
    if (sort === "name") return a.module.localeCompare(b.module);
    if (sort === "progress") return b.progress - a.progress;
    const order = { "at-risk": 0, watch: 1, healthy: 2 };
    return order[a.health] - order[b.health] || b.blockers - a.blockers || b.open - a.open;
  });

  return <>
    <header class="page-head command-head"><div><div class="eyebrow">Portfolio</div><h1>Projects</h1><p>Each campaign is a working surface: health, progress, next milestone, open work, and blockers—not only a folder of documents.</p></div><div class="actions"><select class="button compact-select" value={sort} onChange={(event) => setSort(event.currentTarget.value)} aria-label="Sort projects"><option value="health">Sort by health</option><option value="progress">Sort by progress</option><option value="name">Sort by name</option></select><a class="button primary" href="#/work"><Icon name="plus" />Add work</a></div></header>

    <div class="project-toolbar"><div class="board-search"><Icon name="search" size={14} /><input value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="Search campaigns" aria-label="Search projects" />{query && <button class="board-search-clear" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" size={14} /></button>}</div><div class="project-filters">{[["all", "All"], ["at-risk", "At risk"], ["watch", "Watch"], ["healthy", "Healthy"]].map(([value, label]) => <button class="chip toggle" data-active={String(filter === value)} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></div>

    {visible.length ? <div class="projects-grid">{visible.map((project) => <article class="project-card" key={project.module}>
      <div class="project-card-head"><span class="project-icon"><Icon name="folder" /></span><div><h3>{project.module}</h3><span>{project.open} open · {project.blockers} blockers</span></div><span class={`health-dot ${project.health}`} title={project.health} /></div>
      <div class="project-progress"><div><span>Progress</span><strong>{project.progress}%</strong></div><ProgressBar value={project.progress} /></div>
      <div class="project-next"><span>Next</span><strong>{project.openTasks[0]?.text || "No open work"}</strong></div>
      <div class="project-card-actions"><a class="button ghost" href={`#/module/${encodeURIComponent(project.module)}`}>Open project</a><a class="button ghost" href={`#/work?q=${encodeURIComponent(`m:${project.module}`)}`}>View queue</a><Chip tone={project.health === "healthy" ? "success" : project.health === "at-risk" ? "blocker" : ""}>{project.health}</Chip></div>
    </article>)}</div> : <EmptyState icon="projects" title="No matching projects"><button class="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></EmptyState>}
  </>;
}
