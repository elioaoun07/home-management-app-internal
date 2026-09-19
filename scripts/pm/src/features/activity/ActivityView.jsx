import { useEffect } from "preact/hooks";
import { route } from "../../app/router.js";
import { outcomes } from "../../app/productStore.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Inline } from "../doc/Markdown.jsx";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";
import { sessionStatus, timeLabel } from "../../lib/product.js";
import { localReturn } from "../../lib/portfolio.js";

export function OutcomesList({ entries, compact = false }) {
  if (!entries.length) return <EmptyState icon="archive" title="No outcomes recorded"/>;
  return <div class={`outcomes-list ${compact ? "compact" : ""}`}>{entries.map((entry) => <article class="outcome-row" key={entry.key}><div class="outcome-date"><span class={`outcome-mark ${entry.status.toLowerCase()}`}>{entry.status === "Shipped" ? "✓" : "×"}</span><time>{entry.date}</time></div><div class="outcome-copy"><div><span>{entry.campaign}</span><Chip tone={entry.status === "Shipped" ? "success" : ""}>{entry.status}</Chip></div><p><Inline text={entry.raw || entry.text} file={entry.file}/></p>{!compact && entry.status === "Shipped" && <a class="reference-link" href={`#/doc/${encodeURI(entry.file)}?h=shipped-log`}>Source record →</a>}</div></article>)}</div>;
}

export function ActivityView() {
  useEffect(() => { loadDeliverySessions().catch(() => {}); }, []);
  const filter = route.value.query.get("filter") || "all";
  const campaign = route.value.query.get("campaign") || "";
  const update = (values) => { const params = new URLSearchParams(route.value.query); Object.entries(values).forEach(([k,v]) => v ? params.set(k,v) : params.delete(k)); location.hash = `/activity?${params}`; };
  const entries = outcomes.value.filter((entry) => (!campaign || entry.campaign === campaign) && (filter === "all" || entry.status.toLowerCase() === filter));
  return <>{route.value.query.get("from") && <a class="back-link" href={"#" + localReturn(route.value.query.get("from"))}>← Back to selection</a>}<header class="page-head"><div><div class="eyebrow">Project record</div><h1>Outcomes</h1></div><select class="button" aria-label="Filter outcomes by campaign" value={campaign} onChange={(event) => update({ campaign: event.currentTarget.value })}><option value="">All campaigns</option>{[...new Set(outcomes.value.map((e) => e.campaign))].sort().map((name) => <option key={name}>{name}</option>)}</select></header>
    <nav class="product-tabs" aria-label="Outcome filters">{[["all", "All"], ["shipped", "Shipped"], ["cancelled", "Cancelled"], ...(globalThis.PM_MODE === "server" ? [["runs", "Delivery runs"]] : [])].map(([value,label]) => <a href={`#/activity?${new URLSearchParams({ ...Object.fromEntries(route.value.query), filter: value })}`} aria-current={filter === value ? "page" : undefined} key={value}>{label}</a>)}</nav>
    {filter === "runs" ? <div class="work-list">{(deliveryData.value.sessions || []).filter((s) => !campaign || s.item?.campaign === campaign).map((session) => <a class="history-run" href={`#/delivery/session/${session.sessionId}`} key={session.sessionId}><div><span class="mono">{session.item?.id}</span><strong>{session.item?.text}</strong><small>{session.item?.campaign}</small></div><div><Chip>{sessionStatus(session)}</Chip><time>{timeLabel(session.updatedAt || session.createdAt)}</time></div></a>)}</div> : <OutcomesList entries={entries}/>}
  </>;
}
