import { useWorld } from "./state";
import { canDeliver, workPath } from "./model";
import { Empty, PageTitle } from "./components";
import { PairV2 } from "./DeliveryV2";
import { groupDelivery, deliveredIds } from "./deliveryHomeModel";
import { useCockpitSessions } from "./useCockpitSessions";
import { cockpitUnits } from "./cockpitModel";
import { ArrowRight, CircleHelp, Radio, Layers } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useGameLayer } from "./GameLayer";
import { BridgeCore, BridgeCharts } from "./BridgeVisuals";
import { ProviderStatus } from "./ProviderStatus";
import "./bridge.css";
export function Bridge() {
  const { enabled, transitioning } = useGameLayer();
  const reducedMotion = useReducedMotion();
  const layoutTransition = {
    duration: reducedMotion ? 0 : transitioning ? (enabled ? 1.8 : 1) : 0.25,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  };
  const { world, runs, readError } = useWorld();
  const { board, counts, pending, uncertain, session, v2, queue, uat } = useCockpitSessions("/bridge");
  const groups = groupDelivery({
    v1Runs: runs,
    v2Runs: v2.data?.runs || [],
    queue: queue.data,
    requests: v2.data?.requests || [],
    uat: uat.data,
  });
  const needs = board.lanes.find(lane => lane.id === "needs")!;
  const running = board.lanes.find(lane => lane.id === "running")!;
  const taken = deliveredIds(groups);
  const next = world.work
    .filter(
      (w) =>
        w.state === "open" &&
        ["Now", "Next"].includes(w.section) &&
        !taken.has(w.id.toUpperCase()) &&
        canDeliver(w),
    )
    .sort(
      (a, b) =>
        ["Now", "Next"].indexOf(a.section) - ["Now", "Next"].indexOf(b.section),
    )
    .slice(0, 3);
  return (
    <div
      className="cockpit bridge"
      data-mode={enabled ? "game" : "calm"}
      data-transition={transitioning || undefined}
    >
      <PageTitle
        title="Bridge"
        action={
          <div className="bridge-actions">
            <a className="primary" href="#/sprints">
              Open plan <ArrowRight size={16} />
            </a>
          </div>
        }
      />
      {world.cockpit?.stale && <span role="status">Saved evidence</span>}
      {uncertain && !pending && (
        <a className="cockpit-status" href="#/sessions?view=delivery">
          <CircleHelp size={16} /> Delivery status unconfirmed{" "}
          <ArrowRight size={14} />
        </a>
      )}
      <div className="bridge-grid bridge-workspace">
        {enabled && (
          <BridgeCore
            needs={counts.needs}
            running={counts.running}
            uncertain={uncertain}
            v1Runs={runs}
            v2Runs={v2.data?.runs || []}
            requests={v2.data?.requests || []}
          />
        )}
        <motion.section
          layout
          transition={layoutTransition}
          className="cockpit-panel bridge-needs"
          aria-label="Needs you"
        >
          <motion.div layout="position" transition={layoutTransition}>
            <h2 className="queue-heading">
              <CircleHelp size={18} />
              <a href="#/sessions?view=delivery">
                Needs you ·{" "}
                {pending ? <span className="cockpit-skeleton" aria-label="Loading" /> : counts.needsTotal}
              </a>
            </h2>
            {!pending && <small className="bridge-queue-parts">{cockpitUnits(needs.counts)}{counts.decisions > 0 && ` · ${counts.decisions} decisions`}</small>}
            {!pending && uncertain && <span className="cockpit-unconfirmed">Unconfirmed</span>}
            {!pending && needs.cards.slice(0, 3).map((r) => {
              return (
                <a className="session-identity" key={r.key} href={r.href}>
                  {r.workId || r.title} · {r.status}
                </a>
              );
            })}
            {!pending && world.choices.length > 0 && (
              <a className="session-identity" href="#/attention">
                Decisions · {world.choices.length}
              </a>
            )}
            {!pending && !needs.cards.length && !world.choices.length && (
              <div className="queue-empty">
                {uncertain ? "Awaiting status" : "Nothing waiting"}
              </div>
            )}
          </motion.div>
        </motion.section>
        <motion.section
          layout
          transition={layoutTransition}
          className="cockpit-panel bridge-running"
          aria-label="Running"
        >
          <motion.div layout="position" transition={layoutTransition}>
            <h2 className="queue-heading">
              <Radio size={18} />
              <a href="#/sessions?view=delivery">
                Running · {pending ? <span className="cockpit-skeleton" aria-label="Loading" /> : counts.running}
              </a>
            </h2>
            {!pending && uncertain && <span className="cockpit-unconfirmed">Unconfirmed</span>}
            {!pending && running.cards.slice(0, 3).map((r) => {
              return (
                <a className="session-identity" key={r.key} href={r.href}>
                  {r.workId || r.title} · {r.status}
                </a>
              );
            })}
            {!pending && !running.cards.length && (
              <div className="queue-empty">
                {uncertain ? "Awaiting status" : "No active sessions"}
              </div>
            )}
          </motion.div>
        </motion.section>
        <motion.section
          layout
          transition={layoutTransition}
          className="cockpit-panel bridge-next"
          aria-label="Next up"
        >
          <motion.div layout="position" transition={layoutTransition}>
            <h2 className="queue-heading">
              <Layers size={18} />
              Next up{" "}
              <a href="#/explore" className="queue-more">
                All work <ArrowRight size={14} />
              </a>
            </h2>
            <div className="bridge-next-items">
              {next.map((w) => (
                <div key={w.key} className="session-identity">
                  <a href={`#${workPath(w, "/bridge")}`}>
                    <small>
                      {w.id} · {w.module}
                    </small>
                    <strong>
                      {w.title.replace(w.id, "").replace(/^[\s·—-]+/, "")}
                    </strong>
                  </a>
                  <a
                    href={`#/deliver/${encodeURIComponent(w.module)}/${encodeURIComponent(w.id)}?from=%2Fbridge`}
                    className="queue-deliver"
                  >
                    Deliver ▸
                  </a>
                </div>
              ))}
              {!next.length && <Empty title="No ready work" />}
            </div>
          </motion.div>
        </motion.section>
      </div>
      {enabled && <BridgeCharts world={world} unavailable={!!readError} />}
      <ProviderStatus />
      <nav className="bridge-backlog" aria-label="Work queues">
        <span>Backlog</span>
        {["Now", "Next", "Later"].map((lane) => (
          <a href={`#/explore?lane=${lane.toLowerCase()}`} key={lane}>
            {lane} ·{" "}
            {
              world.work.filter((w) => w.state === "open" && w.section === lane)
                .length
            }
          </a>
        ))}
        <a href="#/library">
          Library <ArrowRight size={14} />
        </a>
      </nav>
      {session.data?.paired === false && <PairV2 />}
    </div>
  );
}
