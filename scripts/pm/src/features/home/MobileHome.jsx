import { useEffect } from "preact/hooks";
import { allTasks, moduleStats } from "../../app/store.js";
import { Chip, StatTile } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { TaskCard } from "../rollups/Rollups.jsx";
import { deliveryData, loadDeliverySessions } from "../delivery/deliveryStore.js";

const TERMINAL = new Set(["SHIPPED", "CANCELLED", "FAILED"]);
const GATE_LABEL = { question: "Agent asked a question", spec: "Spec awaiting approval", plan: "Plan awaiting approval", uat: "UAT awaiting acceptance", blocked: "Session blocked — needs a retry decision", shipped: "Ready to close out" };

// Glance-first home for phone-width viewports: what needs me, what's next,
// where do I go. Rendered by HomeView when isCompact is true.
export function MobileHome() {
  const isServer = globalThis.PM_MODE === "server";
  useEffect(() => { if (isServer) loadDeliverySessions(); }, []);
  const open = allTasks.value.filter((task) => task.state === "open" && !task.inFabled);
  const nowOpen = open.filter((task) => task.sectionRank === 0);
  const nowTop = [...nowOpen].sort((a, b) => (a.severity === "blocker" ? 0 : 1) - (b.severity === "blocker" ? 0 : 1)).slice(0, 8);
  const sessions = isServer ? deliveryData.value.sessions || [] : [];
  const active = sessions.filter((session) => !TERMINAL.has(session.state));
  const attention = sessions.filter((session) => session.awaiting);
  return <div class="m-home">
    <header class="m-head"><div class="eyebrow">Owner surface</div><h1>Command center</h1></header>
    <div class="m-stats"><StatTile label="Open work" value={open.length}/><StatTile label="Blockers" value={open.filter((task) => task.severity === "blocker").length}/><StatTile label="Now lane" value={nowOpen.length}/><StatTile label="Active sessions" value={isServer ? active.length : "—"}/></div>
    {attention.length > 0 && <section class="m-section"><div class="m-section-head"><div class="eyebrow">Needs your decision</div></div>{attention.map((session) => <a class="m-attention" key={session.sessionId} href={`#/delivery/session/${session.sessionId}${session.awaiting.gate === "question" ? "?tab=questions" : ""}`}><Icon name="bolt"/><span class="m-attention-body"><strong>{GATE_LABEL[session.awaiting.gate] || `Awaiting ${session.awaiting.gate}`}</strong><span>{session.item?.id ? `${session.item.id} · ` : ""}{session.item?.text || "Untitled"}</span></span><Chip tone="blocker">{session.state}</Chip></a>)}</section>}
    <section class="m-section"><div class="m-section-head"><div class="eyebrow">Now lane</div><a href="#/checklist">All →</a></div>{nowTop.length ? <div class="task-lane-list">{nowTop.map((task) => <TaskCard task={task} key={task.key}/>)}</div> : <div class="muted" style={{fontSize:12}}>Nothing queued under ## Now.</div>}</section>
    {isServer && active.length > 0 && <section class="m-section"><div class="m-section-head"><div class="eyebrow">Active sessions</div><a href="#/delivery">All →</a></div>{active.map((session) => <a class="m-session" key={session.sessionId} href={`#/delivery/session/${session.sessionId}`}><span class={`session-dot ${session.runnerAlive ? "alive" : ""}`}/><span class="m-session-body"><strong>{session.item?.id ? `${session.item.id} · ` : ""}{session.item?.text || "Untitled"}</strong><span>{session.item?.campaign} · {session.agent}</span></span><Chip tone={session.state === "BLOCKED" ? "blocker" : ""}>{session.state}</Chip></a>)}</section>}
    <section class="m-section"><div class="m-section-head"><div class="eyebrow">Go to</div></div><div class="m-tiles"><a class="m-tile" href="#/tasks"><Icon name="tasks"/><span>Task board</span></a><a class="m-tile" href="#/checklist"><Icon name="check"/><span>Checklist</span></a><a class="m-tile" href="#/bugs"><Icon name="bug"/><span>Bugs</span></a>{isServer && <a class="m-tile" href="#/delivery"><Icon name="bolt"/><span>Delivery</span></a>}<a class="m-tile" href="#/search"><Icon name="search"/><span>Search</span></a></div></section>
    <section class="m-section"><div class="m-section-head"><div class="eyebrow">Campaigns</div></div><div class="m-campaigns">{moduleStats.value.map((stat) => <a class="m-campaign" key={stat.module} href={`#/module/${encodeURIComponent(stat.module)}`}><span>{stat.module}</span><Chip>{stat.open} open</Chip></a>)}</div></section>
  </div>;
}
