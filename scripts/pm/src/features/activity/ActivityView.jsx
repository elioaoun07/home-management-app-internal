import { useEffect, useMemo, useState } from "preact/hooks";
import { files } from "../../app/store.js";
import { Chip, EmptyState, StatTile } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";

function sessionStamp(session) {
  return Date.parse(session.updatedAt || session.lastEventAt || session.startedAt || session.createdAt || "") || 0;
}

function formatStamp(stamp) {
  if (!stamp) return "Time not recorded";
  return new Date(stamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ActivityView() {
  const isServer = globalThis.PM_MODE === "server";
  const [filter, setFilter] = useState("all");
  useEffect(() => { if (isServer) loadDeliverySessions(); }, []);

  const sessions = isServer ? deliveryData.value.sessions || [] : [];
  const metrics = deliveryData.value.metrics;
  const entries = useMemo(() => [
    ...sessions.map((session) => ({ type: "delivery", stamp: sessionStamp(session), title: `${session.item?.id ? `${session.item.id} · ` : ""}${session.item?.text || "Delivery session"}`, detail: `${session.item?.campaign || "Delivery"} · ${session.state}${session.awaiting ? ` · waiting at ${session.awaiting.gate}` : ""}`, href: `#/delivery/session/${session.sessionId}`, tone: session.awaiting ? "blocker" : session.state === "SHIPPED" ? "success" : "" })),
    ...files.value.filter((file) => !file.inFabled).map((file) => ({ type: "document", stamp: Number(file.mtimeMs || 0), title: file.title, detail: `${file.module} · Markdown source updated`, href: `#/doc/${encodeURI(file.relPath)}`, tone: "" })),
  ].sort((a, b) => b.stamp - a.stamp), [sessions, files.value]);
  const visible = entries.filter((entry) => filter === "all" || entry.type === filter).slice(0, 100);
  const waiting = sessions.filter((session) => session.awaiting).length;

  return <>
    <header class="page-head command-head"><div><div class="eyebrow">Audit trail</div><h1>Activity</h1><p>Recent Markdown changes and delivery outcomes in one place. Open any delivery session for its complete timeline, conversation, files, gates, and usage record.</p></div><div class="actions"><a class="button" href="#/search"><Icon name="search" />Search history</a>{isServer && <a class="button primary" href="#/delivery/new"><Icon name="plus" />New session</a>}</div></header>

    <div class="grid stats activity-stats"><StatTile label="Session history" value={sessions.length} detail="Auditable delivery runs" /><StatTile label="Awaiting owner" value={waiting} detail="Questions and approval gates" /><StatTile label="Tracked documents" value={files.value.filter((file) => !file.inFabled).length} detail="Markdown sources" /><StatTile label="Fleet spend" value={typeof metrics?.totalCostUsd === "number" ? `$${metrics.totalCostUsd.toFixed(2)}` : "—"} detail={metrics?.costBasis === "unavailable" ? "Pricing not configured" : "Recorded provider cost"} /></div>

    <div class="activity-layout"><section class="activity-feed-card"><div class="section-heading"><div><div class="eyebrow">History</div><h2>Recent activity</h2></div><div class="project-filters">{[["all", "All"], ["delivery", "Delivery"], ["document", "Markdown"]].map(([value, label]) => <button class="chip toggle" data-active={String(filter === value)} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></div>{visible.length ? <div class="activity-feed">{visible.map((entry, index) => <a class="activity-entry" href={entry.href} key={`${entry.type}:${entry.href}:${index}`}><span class="activity-entry-icon"><Icon name={entry.type === "delivery" ? "bolt" : "file"} /></span><span class="activity-entry-copy"><strong>{entry.title}</strong><span>{entry.detail}</span></span><span class="activity-entry-tail"><Chip tone={entry.tone}>{entry.type}</Chip><time>{formatStamp(entry.stamp)}</time></span></a>)}</div> : <EmptyState icon="activity" title="No matching activity">Change the filter to see more history.</EmptyState>}</section>

      <aside class="activity-audit-card"><div class="eyebrow">Audit coverage</div><h2>What is preserved</h2><ul><li>Every Markdown task remains traceable to its campaign file.</li><li>Delivery decisions, answers, gates, and artifacts live with the session.</li><li>Budget raises and owner interventions remain explicit and auditable.</li><li>Shipped and discarded queue items retain Undo through snapshots.</li></ul>{isServer && <a class="button" href="#/delivery">Open delivery history</a>}</aside></div>
  </>;
}
