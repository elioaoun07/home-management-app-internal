import { useWorld } from "./state";
import { canDeliver, workPath } from "./model";
import { Empty, PageTitle } from "./components";
import { useV2Queue, useV2Runs, useV2Session, PairV2 } from "./DeliveryV2";
import { groupDelivery, deliveredIds, type HomeRow } from "./deliveryHomeModel";
import { useUat } from "./UatWizard";
import { sessionStatus } from "../shared/product.mjs";
import { branchLabel, runningLabel } from "./v2model";
import { label as requestLabel } from "./StewardRequests";
import { ArrowRight, CircleHelp, Radio, Layers } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useGameLayer } from "./GameLayer";
import { BridgeCore, BridgeCharts } from "./BridgeVisuals";
import { ProviderStatus } from "./ProviderStatus";
import { transport } from "./transport";
import "./bridge.css";
function rowLink(row: HomeRow) {
  if (row.kind === "v1")
    return {
      href: `#/delivery/session/${encodeURIComponent(row.run.sessionId)}`,
      label: `${row.run.item.id || row.run.sessionId} · ${sessionStatus(row.run)}`,
    };
  if (row.kind === "uat")
    return {
      href: `#/delivery/test/${encodeURIComponent(row.item.handover_id)}`,
      label: `UAT · ${row.item.subject.work_id || row.item.subject.title}`,
    };
  if (row.kind === "request")
    return {
      href: row.request.run_id
        ? `#/delivery/run/${encodeURIComponent(row.request.run_id)}`
        : "#/sessions?view=delivery",
      label: `${row.request.workId} · ${requestLabel(row.request.status)}`,
    };
  if (row.kind === "decision")
    return {
      href: `#/delivery/run/${encodeURIComponent(row.item.run_id)}`,
      label: `${row.item.alias} · ${row.item.label}`,
    };
  return {
    href: `#/delivery/run/${encodeURIComponent(row.run.run_id)}`,
    label: `${row.run.alias || row.run.title} · ${branchLabel(row.run.branch) || (row.running ? runningLabel(row.running) : row.run.ownerAction)}`,
  };
}
export function Bridge() {
  const { enabled, transitioning } = useGameLayer();
  const reducedMotion = useReducedMotion();
  const layoutTransition = {
    duration: reducedMotion ? 0 : transitioning ? (enabled ? 1.8 : 1) : 0.25,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  };
  const { world, runs, runError, connection, connected, runsReady, readError } =
    useWorld();
  const session = useV2Session(),
    v2 = useV2Runs(),
    queue = useV2Queue(),
    uat = useUat(!!session.data?.paired);
  const groups = groupDelivery({
    v1Runs: runs,
    v2Runs: v2.data?.runs || [],
    queue: queue.data,
    requests: v2.data?.requests || [],
    uat: uat.data,
  });
  const owner = groups.progress.filter((r) =>
    r.kind === "v1"
      ? !!r.run.awaiting
      : r.kind === "v2"
        ? !["none", "waiting", undefined].includes(r.run.ownerActionKind)
        : false,
  );
  const needs = [...groups.needs, ...owner];
  const running = groups.progress.filter(
    (r) =>
      !owner.includes(r) &&
      (r.kind === "v1"
        ? r.run.runnerAlive === true
        : r.kind === "v2"
          ? r.run.active || r.run.lifecycle === "ACTIVE"
          : r.kind === "request" && r.request.status === "running"),
  );
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
  const uncertain =
    !connected ||
    connection.stale ||
    !!runError ||
    v2.isError ||
    queue.isError ||
    !runsReady ||
    !!readError ||
    !v2.isSuccess ||
    !queue.isSuccess ||
    uat.isError ||
    (Boolean(transport().v2Uat) && !uat.isSuccess) ||
    !session.data?.paired;
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
      {uncertain && (
        <a className="cockpit-status" href="#/sessions?view=delivery">
          <CircleHelp size={16} /> Delivery status unconfirmed{" "}
          <ArrowRight size={14} />
        </a>
      )}
      <div className="bridge-grid bridge-workspace">
        {enabled && (
          <BridgeCore
            needs={needs.length}
            running={running.length}
            uncertain={uncertain}
            v1Runs={runs}
            v2Runs={v2.data?.runs || []}
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
                {needs.length + world.choices.length || (uncertain ? "—" : 0)}
              </a>
            </h2>
            {needs.slice(0, 3).map((r) => {
              const link = rowLink(r);
              return (
                <a className="session-identity" key={r.key} href={link.href}>
                  {link.label}
                </a>
              );
            })}
            {world.choices.length > 0 && (
              <a className="session-identity" href="#/attention">
                Decisions · {world.choices.length}
              </a>
            )}
            {!needs.length && !world.choices.length && (
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
                Running · {running.length || (uncertain ? "—" : 0)}
              </a>
            </h2>
            {running.slice(0, 3).map((r) => {
              const link = rowLink(r);
              return (
                <a className="session-identity" key={r.key} href={link.href}>
                  {link.label}
                </a>
              );
            })}
            {!running.length && (
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
