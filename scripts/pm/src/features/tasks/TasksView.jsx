import { useEffect } from "preact/hooks";
import { campaigns, workItems } from "../../app/productStore.js";
import { hideCompleted, modal } from "../../app/store.js";
import { parseRoute, route } from "../../app/router.js";
import { matchesFilters, parseQuery } from "../search/queryLang.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { BoardToolbar } from "./BoardToolbar.jsx";
import { boardHash, groupTasks, readBoardState, sortTasks } from "./boardState.js";
import { WorkRow, DeliveryAction } from "./WorkItem.jsx";
import { taskHref, workTitle } from "../../lib/product.js";
import { loadDeliverySessions } from "../delivery/deliveryStore.js";

export function TasksView() {
  useEffect(() => { loadDeliverySessions().catch(() => {}); }, []);
  const list = route.value.mode === "table";
  const state = readBoardState(route.value.query);
  const parsed = parseQuery(state.query);
  const update = (next) => { const hash = boardHash(list ? "/work/table" : "/work", next); history.replaceState(null, "", hash); route.value = parseRoute(hash); };
  const filtered = workItems.value.filter((task) => (parsed.filters.is === "done" || !hideCompleted.value || task.state !== "done") && matchesFilters(task, parsed.filters) && (!parsed.text || `${task.idChip} ${task.text}`.toLowerCase().includes(parsed.text.toLowerCase())));
  const groups = groupTasks(sortTasks(filtered, state.sortBy), state.groupBy);
  const from = route.value.path + (route.value.query.size ? "?" + route.value.query.toString() : "");
  const setCampaign = (name) => {
    const tokens = state.query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    update({ ...state, query: [...tokens.filter((token) => !token.startsWith("m:")), ...(name ? [`m:"${name}"`] : [])].join(" ") });
  };
  return <><header class="page-head"><div><div class="eyebrow">Plan & execute</div><h1>Work</h1></div><div class="actions"><select class="button" aria-label="Campaign" value={parsed.filters.m || ""} onChange={(event) => setCampaign(event.currentTarget.value)}><option value="">All campaigns</option>{campaigns.value.map((campaign) => <option value={campaign.name} key={campaign.name}>{campaign.name}</option>)}</select>{globalThis.PM_MODE === "server" && <button class="button primary" onClick={() => { modal.value = { type: "idea" }; }}><Icon name="plus"/>Capture</button>}</div></header>
    <BoardToolbar state={state} onChange={update} shown={filtered.length} total={workItems.value.length} extra={<a class="chip view-switch" href={boardHash(list ? "/work" : "/work/table", state)}>{list ? "Board" : "List"}</a>}/>
    {!filtered.length ? <EmptyState icon="tasks" title="No matching work"><button class="button" onClick={() => { hideCompleted.value = false; update({ ...state, query: "" }); }}>Clear filters</button></EmptyState> : list ? <div class="work-list">{sortTasks(filtered, state.sortBy).map((task) => <WorkRow task={task} from={from} key={task.key}/>)}</div> : <div class={`work-board ${state.groupBy === "lane" ? "by-lane" : ""}`}>{groups.map((group) => <section class="work-column" key={group.key}><div class="work-column-head"><h2><span class={`priority-dot ${group.label.toLowerCase()}`}/>{group.label}</h2><span class="count">{group.items.length}</span></div>{group.items.length ? group.items.map((task) => <article class={`work-card ${task.state === "done" ? "is-complete" : ""}`} key={task.key}><a href={taskHref(task, from)}><div class="work-card-eyeline"><span class="mono">{task.idChip}</span><span>{task.effort}</span></div><h3>{workTitle(task)}</h3><span class="muted">{task.module}</span></a><div class="work-card-foot"><Chip tone={task.severity}>{task.state === "done" ? "Completed" : /\bHELD\b/i.test(task.text) ? "Held" : task.severity}</Chip><DeliveryAction task={task}/></div></article>) : <p class="quiet-empty">No work here.</p>}</section>)}</div>}
  </>;
}
