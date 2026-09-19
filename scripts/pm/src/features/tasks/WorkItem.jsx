import { useEffect, useState } from "preact/hooks";
import { route } from "../../app/router.js";
import { campaigns, ownerDecisions, topics, workItems } from "../../app/productStore.js";
import { archiveTask, moveTask, offlineSnapshot, togglePostponed, toggleTask } from "../../app/store.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Markdown } from "../doc/Markdown.jsx";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";
import { sessionForTask, taskHref, workTitle } from "../../lib/product.js";
import { localReturn, projectPath } from "../../lib/portfolio.js";

export function DeliveryAction({ task, primary = false, from = "/work" }) {
  if (globalThis.PM_MODE !== "server" || task.state !== "open") return null;
  const session = sessionForTask(task, deliveryData.value.sessions || []);
  const held = /\bHELD\b/i.test(task.text);
  return session ? <a class={`button ${primary ? "primary" : "ghost"}`} href={`#/delivery/session/${session.sessionId}?from=${encodeURIComponent(from)}`}><Icon name="activity" size={15}/>View run</a>
    : <a class={`button ${primary ? "primary" : "ghost"}`} aria-disabled={held || !!offlineSnapshot.value} tabIndex={held || offlineSnapshot.value ? -1 : undefined} href={held || offlineSnapshot.value ? undefined : `#/delivery/new?file=${encodeURIComponent(task.file)}&cb=${task.cbidx}&from=${encodeURIComponent(from)}`} title={held ? "Held by a prerequisite or decision" : undefined}><Icon name="bolt" size={15}/>Deliver</a>;
}

export function WorkRow({ task, from = "/work", compact = false }) {
  const held = task.blocked || /\bHELD\b/i.test(task.text);
  return <article class={`work-row ${task.state === "done" ? "is-complete" : ""}`}>
    <span class={`work-indicator ${task.state === "done" ? "complete" : held ? "held" : ""}`} aria-label={task.state === "done" ? "Completed" : held ? "Blocked" : "Open"}>{task.state === "done" && <Icon name="check" size={12}/>}</span>
    <a class="work-row-link" href={taskHref(task, from)}><span class="work-row-eyeline"><span class="mono">{task.idChip}</span>{!compact && <span>{task.module}</span>}{held && <Chip>Blocked</Chip>}</span><strong>{workTitle(task)}</strong></a>
    <div class="work-row-meta"><Chip tone={task.severity}>{task.severity}</Chip><span class="effort-label">{task.effort}</span></div>
    <DeliveryAction task={task} from={from}/>
  </article>;
}

export function WorkItem() {
  const current = route.value;
  const campaign = campaigns.value.find((entry) => entry.name === current.campaign);
  const task = campaign?.items.find((entry) => (entry.idChip || `@${entry.cbidx}`) === current.itemId);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadDeliverySessions().catch(() => {}); }, []);
  if (!task) return <EmptyState icon="check" title="Item is no longer in the backlog"><a class="button" href={`#/module/${encodeURIComponent(current.campaign)}?tab=outcomes`}>View outcomes</a><a class="button ghost" href="#/work">All work</a></EmptyState>;
  const from = localReturn(current.query.get("from"), "/work");
  const self = taskHref(task, from).slice(1);
  const canEdit = globalThis.PM_MODE === "server" && !offlineSnapshot.value;
  const run = async (action) => { if (busy) return; setBusy(true); try { await action(); } catch { /* shared mutation reports errors */ } finally { setBusy(false); } };
  return <div class="work-detail">
    <a class="back-link" href={`#${from}`}>← Back to {from.startsWith("/?") || from === "/" ? "project" : "selection"}</a>
    <header class="page-head"><div><div class="eyebrow"><a href={`#${projectPath({ selection: task.module })}`}>Project</a><span> / </span><a href={`#/module/${encodeURIComponent(task.module)}`}>{task.module}</a><span> / </span>{task.idChip}</div><h1>{workTitle(task)}</h1><div class="chip-row"><Chip>{task.state === "done" ? "Completed" : task.blocked ? "Blocked" : "Open"}</Chip><Chip tone={task.severity}>{task.severity}</Chip><Chip>{task.effort} effort</Chip></div></div><DeliveryAction task={task} primary from={self}/></header>
    <div class="work-detail-grid"><article class="work-brief"><div class="work-outcome"><span class="eyebrow">Intended outcome</span><p>{task.outcome}</p></div><WorkConnections task={task} from={self}/><details class="contract-disclosure"><summary>Acceptance & scope</summary>{task.contract ? <Markdown raw={task.contract} file={campaign.book.relPath}/> : <EmptyState title="No acceptance recorded"><a href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}>Open checklist</a></EmptyState>}{campaign.book && <a class="reference-link" href={`#/doc/${encodeURI(campaign.book.relPath)}?h=${task.idChip?.toLowerCase()}`}>Source contract <Icon name="arrow" size={13}/></a>}</details></article>
    <aside class="work-properties"><h3>Planning</h3><label class="field"><span>Priority</span><select aria-label="Priority" disabled={!canEdit || busy || task.state === "done"} value={task.section} onChange={(event) => run(() => moveTask(task, event.currentTarget.value))}>{["Now", "Next", "Later"].map((lane) => <option key={lane}>{lane}</option>)}</select></label>
    {canEdit && <div class="property-actions"><button class="button" disabled={busy} onClick={() => run(() => toggleTask(task.file, task.cbidx))}><Icon name="check"/>{task.state === "done" ? "Reopen" : "Complete"}</button><button class="button ghost" onClick={() => togglePostponed(task.key)}><Icon name="clock"/>{task.postponed ? "Resume" : "Postpone"}</button>{task.state === "done" && <button class="button" disabled={busy} onClick={() => run(() => archiveTask(task.file, task.cbidx, "ship"))}><Icon name="archive"/>Ship</button>}<details><summary>More actions</summary><button class="button ghost" disabled={busy} onClick={() => run(() => archiveTask(task.file, task.cbidx, "discard"))}>Discard</button></details></div>}
    <a class="reference-link" href={`#/doc/${encodeURI(task.file)}?cb=${task.cbidx}`}><Icon name="file" size={15}/>Checklist source</a></aside></div>
  </div>;
}

export function WorkConnections({ task, from, onPreview }) {
  const decisions = ownerDecisions.value.filter((decision) => task.decisionIds?.includes(decision.id));
  const downstream = workItems.value.filter((item) => task.dependentIds?.includes(item.idChip));
  const related = workItems.value.filter((item) => item.state === "open" && task.relatedIds?.includes(item.idChip) && !task.dependencyIds.includes(item.idChip) && !task.dependentIds.includes(item.idChip));
  const link = (item, status) => {
    const content = <><span class="mono">{item.idChip}</span><strong>{workTitle(item)}</strong>{status && <Chip>{status}</Chip>}<Icon name="arrow" size={13}/></>;
    return onPreview ? <button class="connection-row" onClick={() => onPreview(item)} key={item.key}>{content}</button> : <a class="connection-row" href={taskHref(item, from)} key={item.key}>{content}</a>;
  };
  return <div class="work-connections"><div class="topic-links">{topics.value.filter((topic) => task.topicIds?.includes(topic.id)).map((topic) => <a href={`#${projectPath({ lens: "topics", selection: topic.id })}`} key={topic.id}><Icon name={topic.icon} size={13}/>{topic.name}</a>)}</div>
    {task.dependencies?.length > 0 && <section class="inspector-section"><h3>Depends on</h3>{task.dependencies.map((dependency) => { const target = workItems.value.find((item) => item.key === dependency.key); return target ? link(target, dependency.status) : <div class="connection-row" key={dependency.id}><span class="mono">{dependency.id}</span><span>{dependency.status}</span>{dependency.file && <a href={`#/doc/${encodeURI(dependency.file)}?h=shipped-log`}>Record →</a>}</div>; })}</section>}
    {decisions.length > 0 && <section class="inspector-section"><h3>Related choices</h3>{decisions.map((decision) => <a class="connection-row" href={`#/decisions?id=${decision.id}&from=${encodeURIComponent(from)}`} key={decision.id}><span class="mono">{decision.id}</span><strong>{decision.text}</strong><Icon name="arrow" size={13}/></a>)}</section>}
    {downstream.length > 0 && <section class="inspector-section"><h3>Unblocks <span class="count">{downstream.length}</span></h3>{downstream.slice(0, 4).map((item) => link(item))}{downstream.length > 4 && <details><summary>{downstream.length - 4} more</summary>{downstream.slice(4).map((item) => link(item))}</details>}</section>}
    {related.length > 0 && <details class="contract-disclosure"><summary>Related work ({related.length})</summary>{related.map((item) => link(item))}</details>}
    <details class="topic-evidence"><summary>Topic matches</summary>{task.topicEvidence?.map((match) => <p key={match.id}><b>{topics.value.find((topic) => topic.id === match.id)?.name}</b><span>{match.evidence}</span></p>)}</details>
  </div>;
}
