import { useEffect } from "preact/hooks";
import { campaigns, outcomes, ownerDecisions, topics, workItems } from "../../app/productStore.js";
import { modal } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";
import { Chip, Modal } from "../../components/Primitives.jsx";
import { isCompact } from "../../lib/media.js";
import { AREA_ICONS, activeRuns, matchesPerspective, projectPath } from "../../lib/portfolio.js";
import { sessionStatus, taskHref, workTitle } from "../../lib/product.js";
import { deliveryData, deliveryError, loadDeliverySessions } from "../delivery/deliveryStore.js";
import { DeliveryAction, WorkConnections } from "../tasks/WorkItem.jsx";
import { Markdown } from "../doc/Markdown.jsx";

const STATES = [["all", "All work"], ["now", "Now"], ["blocked", "Blocked"], ["needs-you", "Needs you"], ["delivery", "Delivering"]];
const FOUNDATIONS = new Set(["Native App", "Delivery", "PM Tooling"]);

export function ProjectExplorer() {
  const isServer = globalThis.PM_MODE === "server";
  const query = route.value.query;
  const lens = query.get("lens") === "topics" ? "topics" : "areas";
  const state = STATES.some(([id]) => query.get("state") === id) ? query.get("state") : "all";
  const selection = query.get("select") || "";
  const selected = lens === "topics" ? topics.value.find((topic) => topic.id === selection) : campaigns.value.find((campaign) => campaign.name === selection);
  const item = workItems.value.find((task) => task.idChip === query.get("item"));
  const sessions = isServer ? deliveryData.value.sessions || [] : [];
  const active = activeRuns(sessions);
  const open = workItems.value.filter((task) => task.state === "open");
  const visible = open.filter((task) => matchesPerspective(task, state, sessions));
  const view = { lens, selection, state, item: item?.idChip || "" };
  const from = projectPath(view);
  const update = (change) => { location.hash = projectPath({ ...view, ...change }); };
  useEffect(() => {
    if (!isServer) return;
    let pending = false;
    const refresh = async () => { if (pending || document.hidden) return; pending = true; try { await loadDeliverySessions(); } catch { /* visible refresh error */ } finally { pending = false; } };
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [isServer]);
  const inspect = (entry) => update({ selection: lens === "topics" ? entry.id : entry.name, item: "" });
  const preview = (task) => update({ item: task.idChip });
  const scopedItems = selected ? selected.open : open;
  const scopedRuns = active.filter((run) => !selected || (lens === "areas" ? run.item?.campaign === selected.name : scopedItems.some((task) => task.idChip === run.item?.id && task.module === run.item?.campaign)));
  const scopedDecisions = ownerDecisions.value.filter((decision) => !selected || scopedItems.some((task) => task.decisionIds.includes(decision.id)));
  const selectedTasks = scopedItems.filter((task) => matchesPerspective(task, state, sessions));
  const panel = item ? <WorkPreview task={item} from={from} onBack={() => update({ item: "" })} onPreview={preview}/>
    : selected ? <AreaInspector selected={selected} lens={lens} tasks={selectedTasks} decisions={scopedDecisions} sessions={scopedRuns} state={state} from={from} onPreview={preview} onNavigate={update}/>
      : <ProjectPulse sessions={active} decisions={scopedDecisions} from={from} state={state} tasks={visible} onPreview={preview}/>;

  function tile(entry) {
    const matching = entry.open.filter((task) => matchesPerspective(task, state, sessions));
    const focus = (lens === "topics" && matching.find((task) => entry.pattern?.test(workTitle(task)))) || matching.find((task) => task.section === "Now" && !task.postponed) || matching[0];
    const blocked = matching.filter((task) => task.blocked).length;
    const runs = active.filter((run) => lens === "areas" ? run.item?.campaign === entry.name : entry.open.some((task) => task.idChip === run.item?.id && task.module === run.item?.campaign));
    const identity = lens === "topics" ? entry.id : entry.name;
    return <button key={identity} class={`project-tile ${matching.length ? "" : "is-quiet"}`} aria-pressed={selection === identity} aria-controls={isCompact.value ? undefined : "project-inspector"} onClick={() => inspect(entry)}>
      <div class="project-tile-top"><span class="area-symbol"><Icon name={lens === "topics" ? entry.icon : AREA_ICONS[entry.name] || "projects"} size={19}/></span><span class="tile-count">{matching.length}<small>{state === "all" ? "open" : "matching"}</small></span></div>
      <h2>{entry.name}</h2><p class="tile-focus">{focus ? workTitle(focus) : state === "all" ? "No open work" : "No work in this view"}</p>
      <div class="tile-footer">{lens === "topics" ? <span>{entry.areas.length} areas</span> : <span>{entry.now.filter((task) => !task.postponed).length} Now</span>}<span>{runs.length ? <><i class="status-beacon"/>{runs.length} runs</> : blocked ? `${blocked} blocked` : <Icon name="arrow" size={14}/>}</span></div>
    </button>;
  }

  return <div class="project-explorer"><header class="page-head project-head"><div><div class="eyebrow">ERA / Command Center</div><h1>Your project<span class="heading-dot">.</span></h1></div><div class="actions"><a class="button ghost" href="#/activity">Recent changes <Icon name="clock" size={15}/></a>{isServer && <button class="button primary" onClick={() => { modal.value = { type: "idea" }; }}><Icon name="plus" size={16}/>Capture</button>}</div></header>
    <div class="project-summary"><span class="project-scope"><b>{campaigns.value.length}</b> areas <span>·</span> <b>{open.length}</b> open</span><div class="project-states" aria-label="Project perspective">{STATES.filter(([id]) => isServer || id !== "delivery").map(([id, label]) => <button class={state === id ? "active" : ""} aria-pressed={state === id} onClick={() => update({ state: id, item: "" })} key={id}>{label}<span>{id === "delivery" ? active.length : id === "needs-you" ? ownerDecisions.value.length + active.filter((run) => run.awaiting).length : open.filter((task) => matchesPerspective(task, id, sessions)).length}</span></button>)}</div></div>
    {isServer && deliveryError.value && <div class="inline-error" role="alert">{deliveryError.value}<button class="button" onClick={() => loadDeliverySessions().catch(() => {})}>Retry</button></div>}
    <div class="explorer-layout"><section class="project-map" aria-label="Explore project"><div class="map-toolbar"><div class="segment-control" aria-label="Explore by"><button aria-pressed={lens === "areas"} onClick={() => update({ lens: "areas", selection: "", item: "" })}><Icon name="projects" size={15}/>Areas</button><button aria-pressed={lens === "topics"} onClick={() => update({ lens: "topics", selection: "", item: "" })}><Icon name="connections" size={15}/>Topics</button></div><a href="#/work" class="reference-link">Work queue <Icon name="arrow" size={14}/></a></div>
      {lens === "areas" ? <>{[["Product", false], ["Foundation", true]].map(([label, foundation]) => <section class="map-group" key={label}><h2 class="map-group-label">{label}</h2><div class="project-tiles">{campaigns.value.filter((campaign) => FOUNDATIONS.has(campaign.name) === foundation).map(tile)}</div></section>)}</> : <><div class="map-topic-note"><span>Across areas</span><details><summary aria-label="About topics"><Icon name="info" size={15}/></summary><p>Matched from recorded titles, outcomes and acceptance. Topics can overlap; ownership stays with the area.</p></details></div><div class="project-tiles topic-tiles">{topics.value.map(tile)}</div></>}
    </section>{isCompact.value && (selected || item) ? <Modal title={item ? item.idChip : lens === "topics" ? "Topic" : "Area"} onClose={() => update({ selection: "", item: "" })}><div class="project-inspector">{panel}</div></Modal> : <aside id="project-inspector" class="project-inspector" aria-label={selected?.name || "Project pulse"} aria-live="polite">{(selected || item) && <button class="inspector-close icon-button" aria-label="Close detail" onClick={() => update({ selection: "", item: "" })}><Icon name="close" size={16}/></button>}{panel}</aside>}</div>
  </div>;
}

function PreviewRows({ tasks, onPreview }) {
  return <div class="preview-rows">{tasks.map((task) => <button class="preview-row" key={task.key} onClick={() => onPreview(task)}><div><span class="mono">{task.idChip}</span><span>{task.module}</span></div><strong>{workTitle(task)}</strong><div><span>{task.section}</span>{task.blocked && <Chip>Blocked</Chip>}{task.decisionIds.length > 0 && <span class="preview-attention"><Icon name="bulb" size={12}/>{task.decisionIds.length}</span>}<Icon name="arrow" size={14}/></div></button>)}</div>;
}
function RunRows({ sessions, from }) {
  return <div class="inspector-runs">{sessions.map((run) => <a class="inspector-run" href={`#/delivery/session/${run.sessionId}?from=${encodeURIComponent(from)}`} key={run.sessionId}><div><span class="mono">{run.item?.id}</span><span>{run.agent}</span></div><strong>{workTitle(run.item)}</strong><span class="run-current"><i class={`status-beacon ${run.runnerAlive && !run.awaiting && !run.execution?.paused ? "running" : ""}`}/>{sessionStatus(run)}</span></a>)}</div>;
}
function DecisionRows({ decisions, from }) {
  return <div>{decisions.map((decision) => <a class="inspector-decision" href={`#/decisions?id=${decision.id}&from=${encodeURIComponent(from)}`} key={decision.id}><span class="mono">{decision.id}</span><strong>{decision.text}</strong><Icon name="arrow" size={14}/></a>)}</div>;
}
function RecentChanges({ entries, from }) {
  return <div>{entries.map((entry) => <a class="recent-change" key={entry.key} href={`#/activity?campaign=${encodeURIComponent(entry.campaign)}&from=${encodeURIComponent(from)}`}><div><time>{entry.date}</time><span>{entry.status}</span></div><strong>{entry.text}</strong><span>{entry.campaign} <Icon name="arrow" size={12}/></span></a>)}</div>;
}
function ProjectPulse({ sessions, decisions, from, state, tasks, onPreview }) {
  const waiting = sessions.filter((run) => run.awaiting);
  return <><div class="inspector-heading"><span class="eyebrow">Project pulse</span><h2>{state === "blocked" ? "Blocked work" : state === "now" ? "In focus" : state === "needs-you" ? "Needs you" : state === "delivery" ? "Delivering" : "Where things stand"}</h2></div>
    {state === "now" || state === "blocked" ? <><PreviewRows tasks={tasks.slice(0, 5)} onPreview={onPreview}/>{tasks.length > 5 && <p class="inspector-note">{tasks.length - 5} more across the areas</p>}{!tasks.length && <p class="quiet-empty">No matching work.</p>}</> : <>
      {sessions.length > 0 && <section class="inspector-section"><div class="section-heading"><h3>{waiting.length && state !== "delivery" ? "Ready for you" : "In Delivery"}</h3><a href="#/delivery">All {sessions.length} →</a></div><RunRows sessions={state === "needs-you" ? waiting : [...waiting, ...sessions.filter((run) => !run.awaiting)].slice(0, 2)} from={from}/></section>}
      {state === "delivery" && !sessions.length && <p class="quiet-empty">No active runs.</p>}
      {state !== "delivery" && <section class="inspector-section"><div class="section-heading"><h3>Open choices <span class="count">{decisions.length}</span></h3><a href="#/decisions">All →</a></div><DecisionRows decisions={decisions.slice(0, state === "needs-you" ? 8 : 2)} from={from}/></section>}
    </>}
    <section class="inspector-section"><div class="section-heading"><h3>Recent changes</h3><a href="#/activity">All →</a></div><RecentChanges entries={outcomes.value.slice(0, 3)} from={from}/></section>
  </>;
}
function AreaInspector({ selected, lens, tasks, decisions, sessions, state, from, onPreview, onNavigate }) {
  const area = lens === "areas";
  const ordered = area ? tasks : [...tasks].sort((a, b) => Number(selected.pattern?.test(workTitle(b))) - Number(selected.pattern?.test(workTitle(a))) || ["Now", "Next", "Later"].indexOf(a.section) - ["Now", "Next", "Later"].indexOf(b.section));
  const scopeTopics = area ? topics.value.filter((topic) => selected.topicIds.includes(topic.id) && topic.id !== "other") : [];
  const history = area ? [...selected.shipped, ...selected.cancelled].sort((a, b) => b.date.localeCompare(a.date)) : selected.outcomes;
  return <><div class="inspector-heading"><span class="eyebrow">{area ? "Area" : `${selected.areas.length} areas · Topic`}</span><h2>{selected.name}</h2>{area && <p class="area-purpose">{selected.purpose.split(/\.\s/)[0]}</p>}</div>
    <div class="inspector-stats"><span><b>{selected.open.length}</b>Open</span><span><b>{selected.open.filter((task) => task.section === "Now" && !task.postponed).length}</b>Now</span><span><b>{selected.open.filter((task) => task.blocked).length}</b>Blocked</span></div>
    <div class="topic-links">{area ? scopeTopics.map((topic) => <button key={topic.id} onClick={() => onNavigate({ lens: "topics", selection: topic.id, item: "" })}>{topic.name}<Icon name="arrow" size={12}/></button>) : selected.areas.map((name) => <button key={name} onClick={() => onNavigate({ lens: "areas", selection: name, item: "" })}>{name}<Icon name="arrow" size={12}/></button>)}</div>
    {sessions.length > 0 && <section class="inspector-section"><h3>In Delivery</h3><RunRows sessions={sessions} from={from}/></section>}
    {decisions.length > 0 && <details class="inspector-section choice-disclosure" open={state === "needs-you"}><summary>Needs a choice <span class="count">{decisions.length}</span></summary><DecisionRows decisions={decisions} from={from}/></details>}
    <section class="inspector-section"><div class="section-heading"><h3>{state === "all" ? "Planned outcomes" : STATES.find(([id]) => id === state)?.[1]} <span class="count">{tasks.length}</span></h3></div><PreviewRows tasks={ordered.slice(0, 3)} onPreview={onPreview}/>{tasks.length > 3 && <details><summary>View all {tasks.length}</summary><PreviewRows tasks={ordered.slice(3)} onPreview={onPreview}/></details>}{!tasks.length && <p class="quiet-empty">No work in this view.</p>}</section>
    {history.length > 0 && <section class="inspector-section"><h3>Recent changes</h3><RecentChanges entries={history.slice(0, 2)} from={from}/></section>}
    {area && <a class="button inspector-full" href={`#/module/${encodeURIComponent(selected.name)}?from=${encodeURIComponent(from)}`}>Open area <Icon name="arrow" size={14}/></a>}
  </>;
}
function WorkPreview({ task, from, onBack, onPreview }) {
  const campaign = campaigns.value.find((entry) => entry.name === task.module);
  return <><button class="back-link preview-back" onClick={onBack}>← Back to selection</button><div class="inspector-heading"><span class="eyebrow">{task.module} / {task.idChip}</span><h2>{workTitle(task)}</h2><div class="chip-row"><Chip>{task.section}</Chip>{task.blocked && <Chip>Blocked</Chip>}<Chip>{task.effort}</Chip></div></div>
    {task.outcome.replace(/[.!?]$/, "") !== workTitle(task).replace(/[.!?]$/, "") && <p class="preview-outcome">{task.outcome}</p>}
    <div class="preview-actions"><DeliveryAction task={task} primary from={from}/><a class="button" href={taskHref(task, from)}>Open work <Icon name="arrow" size={14}/></a></div>
    <WorkConnections task={task} from={from} onPreview={onPreview}/>
    <details class="contract-disclosure"><summary>Acceptance & scope</summary>{task.contract ? <Markdown raw={task.contract} file={campaign?.book?.relPath}/> : <p>No acceptance recorded.</p>}</details>
  </>;
}
