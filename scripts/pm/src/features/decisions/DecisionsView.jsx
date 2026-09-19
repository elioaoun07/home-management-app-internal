import { ownerDecisions, workItems } from "../../app/productStore.js";
import { route } from "../../app/router.js";
import { Inline } from "../doc/Markdown.jsx";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { taskHref } from "../../lib/product.js";
import { localReturn } from "../../lib/portfolio.js";

export function DecisionsView() {
  const selected = route.value.query.get("id");
  const from = route.value.query.get("from");
  const visible = ownerDecisions.value.filter((d) => !selected || selected === d.id);
  return <>{from && <a class="back-link" href={`#${localReturn(from)}`}>← Back to selection</a>}<header class="page-head"><div><div class="eyebrow">Owner attention</div><h1>Decisions</h1></div><a class="button" href="#/doc/_Decisions.md">Open register</a></header>{selected && <a class="back-link" href="#/decisions">← All decisions</a>}
    {visible.length ? <div class="decisions-list">{visible.map((decision) => <article class="decision-detail" key={decision.id}><div class="decision-id"><Chip tone="id">{decision.id}</Chip><span>Open choice</span></div><div><h2>{decision.text}</h2><div class="decision-constraint"><Inline text={decision.constraint} file="_Decisions.md"/></div><div class="chip-row">{workItems.value.filter((task) => task.decisionIds.includes(decision.id)).map((task) => <a class="button ghost" href={taskHref(task, "/decisions?id=" + decision.id + (from ? "&from=" + encodeURIComponent(from) : ""))} key={task.key}>{task.idChip} →</a>)}</div></div></article>)}</div> : <EmptyState icon="check" title="No open decisions"/>}
  </>;
}
