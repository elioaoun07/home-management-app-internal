import { useEffect } from "preact/hooks";
import { campaigns, ownerDecisions } from "../../app/productStore.js";
import { hideCompleted, modal } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Markdown } from "../doc/Markdown.jsx";
import { WorkRow } from "../tasks/WorkItem.jsx";
import { OutcomesList } from "../activity/ActivityView.jsx";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";
import { sessionStatus } from "../../lib/product.js";

import { localReturn, projectPath } from "../../lib/portfolio.js";

export function ModuleView() {
  const campaign = campaigns.value.find((entry) => entry.name === route.value.module);
  useEffect(() => { loadDeliverySessions().catch(() => {}); }, []);
  if (!campaign) return <EmptyState title="Campaign not found"><a href="#/projects">All campaigns</a><a class="button ghost" href="#/search">Search references</a></EmptyState>;
  const path = `/module/${encodeURIComponent(campaign.name)}`;
  const tab = ["work", "decisions", "outcomes", "brief"].includes(route.value.query.get("tab")) ? route.value.query.get("tab") : "work";
  const decisions = ownerDecisions.value.filter((d) => campaign.items.some((task) => task.decisionIds.includes(d.id)));
  const from = localReturn(route.value.query.get("from"), projectPath({ selection: campaign.name }));
  const self = path + "?tab=" + tab + "&from=" + encodeURIComponent(from);
  const sessions = (deliveryData.value.sessions || []).filter((s) => s.item?.campaign === campaign.name);
  const history = [...campaign.shipped, ...campaign.cancelled].sort((a, b) => b.date.localeCompare(a.date));
  return <><a class="back-link" href={"#" + from}>← Back to project</a><header class="page-head"><div><div class="eyebrow">Project / Area</div><h1>{campaign.name}</h1><p class="campaign-intro">{campaign.purpose}</p></div>{globalThis.PM_MODE === "server" && <button class="button" onClick={() => { modal.value = { type: "idea" }; }}><Icon name="plus"/>Capture</button>}</header>
    <div class="metric-strip"><div><b>{campaign.open.length}</b><span>Open</span></div><div><b>{campaign.now.length}</b><span>Now</span></div><div><b>{campaign.held.length}</b><span>Blocked</span></div><div><b>{campaign.shipped.length}</b><span>Shipped records</span></div><div><b>{campaign.cancelled.length}</b><span>Cancelled</span></div></div>
    <nav class="product-tabs" aria-label="Campaign views">{[["work", "Work", campaign.open.length], ["decisions", "Decisions", decisions.length], ["outcomes", "Outcomes", history.length], ["brief", "Brief", null]].map(([value, label, count]) => <a href={`#${path}?tab=${value}&from=${encodeURIComponent(from)}`} aria-current={tab === value ? "page" : undefined} key={value}>{label}{count != null && <span>{count}</span>}</a>)}</nav>
    {tab === "work" && <div class="campaign-workspace"><div>{["Now", "Next", "Later"].map((lane) => {
      const items = campaign.items.filter((task) => task.section === lane && (!hideCompleted.value || task.state !== "done"));
      return <section class="work-group" key={lane}><div class="section-heading"><h2><span class={`priority-dot ${lane.toLowerCase()}`}/>{lane}<span class="count">{items.length}</span></h2><a href={`#/work?q=${encodeURIComponent(`m:"${campaign.name}" lane:${lane}`)}`}>Open queue</a></div>{items.length ? items.map((task) => <WorkRow task={task} compact from={self} key={task.key}/>) : <p class="quiet-empty">No work in {lane.toLowerCase()}.</p>}</section>;
    })}</div><aside class="campaign-rail"><section class="rail-card"><h3>Delivery</h3>{sessions.length ? sessions.slice(0, 5).map((session) => <a class="mini-session" href={`#/delivery/session/${session.sessionId}?from=${encodeURIComponent(self)}`} key={session.sessionId}><strong>{session.item.id || "Session"}</strong><span>{sessionStatus(session)}</span></a>) : <p class="muted">No sessions yet.</p>}</section><section class="rail-card"><h3>References</h3>{campaign.book && <a class="reference-link" href={`#/doc/${encodeURI(campaign.book.relPath)}`}><Icon name="file"/>Master Book</a>}<a class="reference-link" href={`#/doc/${encodeURI(campaign.checklist.relPath)}`}><Icon name="tasks"/>Checklist</a></section></aside></div>}
    {tab === "decisions" && (decisions.length ? decisions.map((decision) => <a class="decision-row" href={`#/decisions?id=${decision.id}&from=${encodeURIComponent(self)}`} key={decision.id}><Chip tone="id">{decision.id}</Chip><strong>{decision.text}</strong><Icon name="arrow"/></a>) : <EmptyState icon="check" title="No linked decisions"/>)}
    {tab === "outcomes" && <OutcomesList entries={history}/>}
    {tab === "brief" && <div class="work-brief"><h2>Purpose</h2><p>{campaign.purpose}</p><h2>Decisions & direction</h2><Markdown raw={campaign.decisions} file={campaign.book?.relPath || campaign.checklist.relPath}/></div>}
  </>;
}