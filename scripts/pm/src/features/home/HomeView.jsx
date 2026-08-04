import { useEffect } from "preact/hooks";
import { allTasks, files, moduleStats, togglePostponed } from "../../app/store.js";
import { Card, Chip, ProgressBar, StatTile } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { isCompact } from "../../lib/media.js";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";
import { MobileHome } from "./MobileHome.jsx";

const severityRank = { blocker: 0, friction: 1, annoyance: 2, parked: 3 };
const terminal = new Set(["SHIPPED", "CANCELLED", "FAILED"]);

function rankTask(a, b) {
  return Number(a.postponed) - Number(b.postponed)
    || a.sectionRank - b.sectionRank
    || (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
}

function timeAgo(value) {
  const stamp = Number(value);
  if (!stamp) return "recently";
  const minutes = Math.max(0, Math.round((Date.now() - stamp) / 60000));
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function QueueRow({ task }) {
  return <article class="queue-row">
    <div class="queue-row-main">
      <div class="queue-row-chips">{task.idChip && <Chip tone="id">{task.idChip}</Chip>}<Chip tone={task.severity}>{task.severity || "unrated"}</Chip><Chip>{task.effort || "—"}</Chip></div>
      <a class="queue-row-title" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>{task.text}</a>
      <span class="queue-row-meta">{task.module} · {task.section}</span>
    </div>
    <div class="queue-row-actions"><a class="button ghost" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>Open</a>{globalThis.PM_MODE === "server" && <a class="button ghost" href={`#/delivery/new?file=${encodeURIComponent(task.file)}&cb=${task.cbidx}`}><Icon name="bolt" size={14} />Deliver</a>}</div>
  </article>;
}

export function HomeView() {
  const isServer = globalThis.PM_MODE === "server";
  useEffect(() => { if (isServer) loadDeliverySessions(); }, []);
  if (isCompact.value) return <MobileHome />;

  const open = allTasks.value.filter((task) => task.state === "open" && !task.inFabled).sort(rankTask);
  const done = allTasks.value.filter((task) => task.state === "done" && !task.inFabled).length;
  const blockers = open.filter((task) => task.severity === "blocker");
  const focus = open[0];
  const sessions = isServer ? deliveryData.value.sessions || [] : [];
  const decisions = sessions.filter((session) => session.awaiting).slice(0, 4);
  const active = sessions.filter((session) => !terminal.has(session.state));
  const recentFiles = [...files.value].filter((file) => !file.inFabled).sort((a, b) => Number(b.mtimeMs || 0) - Number(a.mtimeMs || 0)).slice(0, 4);

  return <>
    <header class="page-head command-head">
      <div><div class="eyebrow">Owner surface</div><h1>Command center</h1><p>Start with decisions and active work. Markdown remains the source of truth; this workspace gives it actions, health, and delivery state.</p></div>
      <div class="actions"><a class="button" href="#/projects">Review portfolio</a><a class="button primary" href="#/work"><Icon name="bolt" />Focus the queue</a></div>
    </header>

    <div class="grid stats command-stats">
      <StatTile label="Campaigns" value={moduleStats.value.length} detail="Active portfolio" />
      <StatTile label="Open work" value={open.length} detail={`${open.filter((task) => task.sectionRank === 0).length} in Now`} />
      <StatTile label="Blockers" value={blockers.length} detail="Across active campaigns" />
      <StatTile label="Live sessions" value={active.length} detail={decisions.length ? `${decisions.length} need a decision` : "No owner action waiting"} />
    </div>

    <div class="overview-grid">
      <div class="overview-primary">
        <section>
          <div class="section-heading"><div><div class="eyebrow">Current focus</div><h2>Work next</h2></div>{focus && <a href={`#/module/${encodeURIComponent(focus.module)}`}>View project</a>}</div>
          {focus ? <div class="focus-card">
            <div class="focus-content"><div class="focus-kicker"><Chip tone="id">{focus.idChip || focus.module}</Chip><span>{focus.module} · {focus.section}</span></div><h2>{focus.text}</h2><p>{focus.severity || "unrated"} priority · {focus.effort || "unsized"} effort. Open the source item or launch a governed delivery session.</p></div>
            <div class="focus-actions"><a class="button focus-primary" href={`#/doc/${encodeURI(focus.file)}?cb=${focus.cbidx}`}>Open work item</a>{isServer && <a class="button focus-secondary" href={`#/delivery/new?file=${encodeURIComponent(focus.file)}&cb=${focus.cbidx}`}>Start delivery</a>}<button class="button focus-secondary" onClick={() => togglePostponed(focus.key)}>{focus.postponed ? "Resume" : "Postpone"}</button></div>
          </div> : <Card><p class="muted">The queue is clear. Capture the next outcome from the Work Queue.</p></Card>}
        </section>

        <section>
          <div class="section-heading"><div><div class="eyebrow">Priority queue</div><h2>Needs attention</h2></div><a href="#/work">View all</a></div>
          <div class="queue-list">{open.slice(0, 5).map((task) => <QueueRow task={task} key={task.key} />)}</div>
        </section>
      </div>

      <aside class="overview-rail">
        <section class="rail-card"><div class="section-heading"><div><div class="eyebrow">Needs a decision</div><h3>Owner gates</h3></div><Chip tone={decisions.length ? "blocker" : "success"}>{decisions.length}</Chip></div>
          {decisions.length ? <div class="rail-list">{decisions.map((session) => <a class="rail-item" href={`#/delivery/session/${session.sessionId}${session.awaiting?.gate === "question" ? "?tab=questions" : ""}`} key={session.sessionId}><span><strong>{session.item?.id || session.item?.campaign || "Session"}</strong>{session.item?.text || "Open delivery session"}</span><Chip tone="blocker">{session.awaiting.gate}</Chip></a>)}</div> : <div class="rail-empty"><Icon name="check" /><span>No agent decisions are waiting.</span></div>}
        </section>

        <section class="rail-card"><div class="section-heading"><div><div class="eyebrow">Recent activity</div><h3>Workspace changes</h3></div><a href="#/activity">Open activity</a></div><div class="activity-mini-list">{recentFiles.map((file) => <a href={`#/doc/${encodeURI(file.relPath)}`} key={file.relPath}><span class="activity-dot" /><span><strong>{file.title}</strong><small>{file.module} · {timeAgo(file.mtimeMs)}</small></span></a>)}</div></section>
      </aside>
    </div>

    <section class="portfolio-section"><div class="section-heading"><div><div class="eyebrow">Portfolio health</div><h2>Projects</h2></div><a href="#/projects">All projects</a></div><div class="portfolio-grid">{moduleStats.value.slice(0, 8).map((stat) => {
      const projectOpen = open.filter((task) => task.module === stat.module);
      const projectBlockers = projectOpen.filter((task) => task.severity === "blocker").length;
      return <a class="portfolio-card" href={`#/module/${encodeURIComponent(stat.module)}`} key={stat.module}><div class="portfolio-card-head"><span class="project-icon"><Icon name="folder" /></span><strong>{stat.module}</strong><span class={`health-dot ${projectBlockers ? "risk" : stat.progress > 60 ? "healthy" : "watch"}`} /></div><div class="portfolio-meta">{stat.open} open · {projectBlockers} blockers</div><ProgressBar value={stat.progress} /><div class="portfolio-next"><span>Next</span><strong>{projectOpen[0]?.idChip || projectOpen[0]?.text || "Queue clear"}</strong></div></a>;
    })}</div></section>
  </>;
}
