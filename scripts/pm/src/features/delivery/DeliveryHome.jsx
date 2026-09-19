import { useEffect, useState } from "preact/hooks";
import { AGENT_REGISTRY, getAgent } from "../../../../delivery/agent-registry.mjs";
import { ALWAYS_ON_CAPABILITIES, isTrivialLaunchCandidate } from "../../../../delivery/classify.mjs";
import { DIRTY_TREE_ACK, RED_BASELINE_ACK, TRIAGE_OVERRIDE_ACK } from "../../../../delivery/validation-baseline.mjs";
import { scanCheckboxes } from "../../../shared/md-scan.mjs";
import { allTasks, byRelPath, files } from "../../app/store.js";
import { navigate, route } from "../../app/router.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Breadcrumbs } from "../nav/Breadcrumbs.jsx";
import { Icon } from "../../components/Icon.jsx";
import { sessionStatus, timeLabel, workTitle } from "../../lib/product.js";
import { localReturn } from "../../lib/portfolio.js";
import {
  deliveryCapabilities,
  deliveryData,
  deliveryError,
  recommendationState,
  deliveryDispatchMode,
  deliveryExecutor,
  deliveryLoading,
  deliveryPost,
  deliveryPreflight,
  deliverEligibility,
  deliveryRecommendation,
  loadDeliveryCapabilities,
  loadDeliveryDispatchMode,
  loadDeliveryExecutor,
  loadDeliveryPreflight,
  loadDeliveryRecommendation,
  loadDeliverySessions,
  setDeliveryExecutor,
} from "./deliveryStore.js";

const EFFORT_PHASES = ["discovery", "plan", "building", "review"];
const TERMINAL_STATES = new Set(["SHIPPED", "CANCELLED", "FAILED"]);
// DLV-73: INSTANT leads the list because it is the cheapest thing that can
// still be a supervised session — the lane the triage gate now routes a trivial
// item to instead of refusing it outright.
const DELIVERY_LANES = ["INSTANT", "FAST", "STANDARD", "DEEP"];
const LANE_LABEL = { INSTANT: "Quick edit", FAST: "Focused", STANDARD: "Standard", DEEP: "Deep" };
const LANE_BLURB = {
  INSTANT: "One file, verified from the diff",
  FAST: "Combined scope and plan, targeted checks",
  STANDARD: "Full scope, plan and review",
  DEEP: "Full review with deeper reasoning",
};
const checklist = (path) => /(?:^|\/)4\s*-\s*Checklist\.md$/i.test(path);

export function DeliveryHome() {
  const [filter, setFilter] = useState("active");
  const [query, setQuery] = useState("");
  useEffect(() => {
    loadDeliverySessions().catch(() => {});
    loadDeliveryCapabilities(); loadDeliveryDispatchMode(); loadDeliveryExecutor();
    const timer = setInterval(() => { if (!document.hidden) loadDeliverySessions().catch(() => {}); }, 10000);
    return () => clearInterval(timer);
  }, []);
  const sessions = deliveryData.value.sessions || [];
  const active = sessions.filter((s) => !TERMINAL_STATES.has(s.state));
  const waiting = active.filter((s) => s.awaiting);
  const visible = sessions.filter((s) => (filter === "all" || filter === "active" && !TERMINAL_STATES.has(s.state) || filter === "waiting" && s.awaiting && !TERMINAL_STATES.has(s.state) || filter === "finished" && TERMINAL_STATES.has(s.state)) && `${s.item?.id} ${s.item?.text} ${s.item?.campaign}`.toLowerCase().includes(query.toLowerCase()));
  const mode = deliveryDispatchMode.value;
  return <><header class="page-head"><div><div class="eyebrow">Autonomous work</div><h1>Delivery</h1></div><a class="button primary" href="#/delivery/new"><Icon name="plus"/>Start run</a></header>
    <div class="metric-strip"><div><b>{active.length}</b><span>Active</span></div><div><b>{waiting.length}</b><span>Need you</span></div><div><b>{sessions.filter((s) => s.state === "SHIPPED").length}</b><span>Shipped</span></div><div><b>{sessions.filter((s) => ["FAILED", "CANCELLED"].includes(s.state)).length}</b><span>Stopped</span></div></div>
    {mode.mode === "v2" && <DeliverySetup/>}
    {deliveryCapabilities.value?.config?.status?.healthy === false && <div class="inline-error">Delivery settings need attention.<details><summary>Details</summary>{deliveryCapabilities.value.config.status.message}</details></div>}
    {deliveryData.value.buildLockActive && <div class="inline-notice"><Icon name="clock"/>Build in progress. Other runs wait before building.</div>}
    <div class="product-toolbar"><div class="segment-control">{[["active", "Active"], ["waiting", "Needs you"], ["finished", "Finished"], ["all", "All runs"]].map(([value,label]) => <button aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div><div class="board-search"><Icon name="search" size={16}/><input aria-label="Search runs" placeholder="Find a run" value={query} onInput={(event) => setQuery(event.currentTarget.value)}/></div></div>
    {deliveryError.value && <div class="inline-error" role="alert">{deliveryError.value}<button class="button" onClick={() => loadDeliverySessions().catch(() => {})}>Retry</button></div>}
    {deliveryLoading.value && !sessions.length ? <div class="empty" role="status">Loading runs…</div> : visible.length ? <div class="delivery-run-list">{visible.map((session) => <a class="delivery-run-card" href={`#/delivery/session/${session.sessionId}`} key={session.sessionId}><span class={`status-beacon ${session.runnerAlive && !session.awaiting && !TERMINAL_STATES.has(session.state) ? "running" : ""}`}/><div class="delivery-run-copy"><div><span class="mono">{session.item?.id}</span><span>{session.item?.campaign}</span></div><h2>{session.item?.text || "Untitled run"}</h2><small>{session.agent} · {timeLabel(session.updatedAt || session.createdAt)}</small></div><Chip tone={session.awaiting ? "attention" : session.state === "SHIPPED" ? "success" : ""}>{sessionStatus(session)}</Chip><Icon name="arrow"/></a>)}</div> : <EmptyState icon="bolt" title={filter === "active" ? "No active runs" : "No matching runs"}><a class="button" href="#/work">Choose work</a>{filter !== "all" && <button class="button ghost" onClick={() => setFilter("all")}>View history</button>}</EmptyState>}
    <details class="delivery-insights"><summary>Insights & agent capabilities</summary><FleetMetrics metrics={deliveryData.value.metrics}/><AgentCatalog/></details>
  </>;
}
function DeliverySetup() {
  return <section class="delivery-setup"><div><div class="eyebrow">Setup required</div><h2>Execution is not available yet</h2><p>Executor qualification and dispatch policy are pending.</p><div class="chip-row"><a class="button" href="#/work/item/Delivery/DLV-96">Qualification</a><a class="button" href="#/work/item/Delivery/DLV-97">Dispatch policy</a></div></div><ExecutorChip/></section>;
}
/**
 * V2 executor selection.
 *
 * Shown only in v2 dispatch mode, because v1 picks its provider per session in
 * the launch wizard and this chip would contradict it.
 *
 * Three things it will not do, each matching a server-side refusal rather than
 * merely mirroring one:
 *   - it offers no default. An installation that has chosen nothing reads
 *     "Executor: None", and the server refuses to dispatch.
 *   - it never falls back. A refused change reloads the server's answer and says
 *     what the server said; the chip does not quietly show the other provider.
 *   - an SDK this checkout cannot load is shown as unavailable and is not
 *     selectable, so the choice on screen is a choice that can actually run.
 */
function ExecutorChip() {
  const [open, setOpen] = useState(false);
  const { selection, executors } = deliveryExecutor.value;
  const choose = async (id) => {
    setOpen(false);
    await setDeliveryExecutor(id, "owner");
  };
  return (
    <div style={{ position: "relative" }}>
      <button class="button" onClick={() => setOpen(!open)}>
        Agent: {selection.label || "Choose"}
      </button>
      {open && (
        <div
          class="executor-menu"
          style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 20, minWidth: 260, padding: 8 }}
        >
          {executors.map((executor) => (
            <button
              key={executor.backend_id}
              class={`button ${selection.backend_id === executor.backend_id ? "primary" : ""}`}
              style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}
              disabled={executor.available === false}
              onClick={() => choose(executor.id)}
            >
              {executor.label}
              {executor.available === false ? " — not installed" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DLV-19 — the honest mirror. Computed server-side from the session directories
 * (see `computeFleetMetrics`), so nothing here is a new persisted number.
 *
 * Every figure is deliberately one that can look bad. `costPerShippedItem` in
 * particular divides *total* fleet spend by shipped sessions rather than
 * averaging the shipped ones: work that never shipped was still paid for, and
 * this campaign started from seven cancelled sessions and one blocked one.
 */
function FleetMetrics({ metrics }) {
  if (!metrics || !metrics.total) return null;
  const money = (value) => (typeof value === "number" ? `$${value.toFixed(2)}` : "—");
  const pct = (value) => (typeof value === "number" ? `${Math.round(value * 100)}%` : "—");
  const ratio = (value) => (typeof value === "number" ? `${value.toFixed(1)}x` : "—");
  const outcomes = Object.entries(metrics.outcomes).sort((a, b) => b[1] - a[1]);
  return (
    <section class="card" style={{ marginTop: 14 }}>
      <h2>Fleet</h2>
      <div class="chip-row" style={{ marginTop: 6 }}>
        {outcomes.map(([state, count]) => (
          <Chip key={state} tone={state === "SHIPPED" ? "" : state === "CANCELLED" || state === "FAILED" || state === "BLOCKED" ? "blocker" : ""}>
            {state}: {count}
          </Chip>
        ))}
      </div>
      <div class="grid stats" style={{ marginTop: 12 }}>
        <div>
          <div class="stat-value">{money(metrics.costPerShippedItem)}</div>
          <div class="muted" style={{ fontSize: 11 }}>
            cost per shipped item — all fleet spend ({money(metrics.totalCostUsd)}) over {metrics.shippedCount} shipped
          </div>
        </div>
        <div>
          <div class="stat-value">{ratio(metrics.interventionsPerSession)}</div>
          <div class="muted" style={{ fontSize: 11 }}>owner decisions per session</div>
        </div>
        <div>
          <div class="stat-value">{pct(metrics.firstPassValidationRate)}</div>
          <div class="muted" style={{ fontSize: 11 }}>validated first pass, no fix loop</div>
        </div>
        <div>
          <div class="stat-value">{ratio(metrics.scopeEstimateAccuracy)}</div>
          <div class="muted" style={{ fontSize: 11 }}>files changed vs files estimated (1.0x = accurate)</div>
        </div>
      </div>
      {metrics.costBasis === "unavailable" && (
        <p class="muted" style={{ fontSize: 11, marginTop: 8 }}>
          No provider cost has been recorded for any session — populate model pricing in <code>.delivery/config.json</code> for real figures.
        </p>
      )}
    </section>
  );
}

function AgentCatalog() {
  return (
    <div class="card">
      {AGENT_REGISTRY.map((agent) => (
        <div class="agent-row" key={agent.name}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <strong>{agent.name}</strong>
            <Chip>{agent.executionMode}</Chip>
            <Chip>{agent.access}</Chip>
            <Chip tone={agent.status === "enabled" ? "success" : ""}>
              {agent.status} · {agent.phase}
            </Chip>
          </div>
          <p class="muted" style={{ margin: "7px 0 3px" }}>
            {agent.purpose}
          </p>
          <div class="eyebrow">
            trigger: {agent.trigger} · {agent.blocking}
          </div>
        </div>
      ))}
    </div>
  );
}

function Wizard({ value, setValue, onClose }) {
  const [choosing, setChoosing] = useState(!value.task);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const topics = [...new Set(files.value.filter((file) => !file.inFabled && checklist(file.relPath)).map((file) => file.module))];
  const candidates = value.campaign ? allTasks.value.filter((task) => task.module === value.campaign && !task.inFabled && checklist(task.file) && `${task.idChip} ${workTitle(task)}`.toLowerCase().includes(itemQuery.toLowerCase())) : [];
  const update = (patch) => setValue({ ...value, ...patch });
  const providerCaps = deliveryCapabilities.value?.providers?.[value.provider];
  const models = providerCaps?.models || [];
  const efforts = providerCaps?.efforts || providerCaps?.manifest?.efforts || [];
  const selectedTask = value.task;
  useEffect(() => {
    if (selectedTask) loadDeliveryRecommendation(selectedTask.file, selectedTask.cbidx, value.provider, value.locatorChoice, value.lane);
    else deliveryRecommendation.value = null;
  }, [selectedTask, value.provider, value.locatorChoice, value.lane]);
  useEffect(() => {
    if (selectedTask) loadDeliveryPreflight();
    else deliveryPreflight.value = { loading: false, data: null, error: null };
  }, [selectedTask]);
  const recommendationPayload = deliveryRecommendation.value;
  const rec = recommendationPayload?.recommendation;
  const launchPreview = recommendationPayload?.preview;
  const capabilities = launchPreview?.capabilities || [];
  const selectedLane = value.lane || launchPreview?.recommendedLane || "STANDARD";
  // DLV-73: what the zero-token locator resolved, so the owner sees the target
  // before authorizing anything.
  const locator = launchPreview?.scopeHints?.locator || null;
  // D9/DLV-6: was hardcoded to laneDefaults.standard regardless of the lane
  // the owner actually selected -- a FAST launch pre-filled the STANDARD
  // envelope ($2/2M) instead of FAST's ($0.50/500K).
  const budgetDefault =
    deliveryCapabilities.value?.config?.budgets?.laneDefaults?.[selectedLane.toLowerCase()] || { maxUsd: 2, maxTokens: 2000000, warnPct: 0.8 };
  const budget = value.budget || {
    maxUsd: String(budgetDefault.maxUsd ?? ""),
    maxTokens: String(budgetDefault.maxTokens ?? ""),
    warnPct: String(Math.round((budgetDefault.warnPct ?? 0.8) * 100)),
    noCap: false,
    noCapConfirm: "",
  };
  const updateBudget = (patch) => update({ budget: { ...budget, ...patch } });
  const maxUsd = budget.maxUsd === "" ? null : Number(budget.maxUsd);
  const maxTokens = budget.maxTokens === "" ? null : Number(budget.maxTokens);
  const warnPct = Number(budget.warnPct) / 100;
  const budgetValid = budget.noCap ? budget.noCapConfirm === "NO CAP" : ((Number.isFinite(maxUsd) && maxUsd > 0) || (Number.isInteger(maxTokens) && maxTokens > 0)) && Number.isFinite(warnPct) && warnPct > 0 && warnPct < 1;
  const selectedModelId = value.model || providerCaps?.defaultModel || null;
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const mismatchWarnings = [];
  if (rec && selectedModel?.tier && ["economy", "standard", "premium"].indexOf(selectedModel.tier) < ["economy", "standard", "premium"].indexOf(rec.tier)) {
    mismatchWarnings.push(`${selectedModel.label || selectedModel.id} is ${selectedModel.tier} tier, below the ${rec.tier} tier recommended for this scope.`);
  } else if (rec && selectedModelId && selectedModelId !== rec.model) {
    mismatchWarnings.push(`${selectedModelId} differs from the recommended model ${rec.model}.`);
  }
  if (rec && selectedLane !== launchPreview?.recommendedLane) {
    mismatchWarnings.push(`${selectedLane} differs from the recommended ${launchPreview?.recommendedLane} lane.`);
  }
  const preflight = deliveryPreflight.value;
  const dirtyAcknowledged =
    !preflight.data?.dirtyAtStart || value.dirtyAck === DIRTY_TREE_ACK;
  const redBaselineAcknowledged =
    preflight.data?.baselineValidation?.ok !== false ||
    value.redBaselineAck === RED_BASELINE_ACK;
  // D11/DLV-39: hard triage gate -- refuses launch entry for an item this
  // trivial rather than reducing oversight once a session is running. Same
  // classifier the server itself gates on (isTrivialLaunchCandidate), so the
  // UI can never drift from what the server will actually enforce.
  const isTrivialLaunch = !!launchPreview && isTrivialLaunchCandidate(launchPreview.item, launchPreview.riskFlags);
  const triageAcknowledged = !isTrivialLaunch || value.triageAck === TRIAGE_OVERRIDE_ACK;
  const preflightValid =
    !!preflight.data &&
    !preflight.loading &&
    dirtyAcknowledged &&
    redBaselineAcknowledged &&
    triageAcknowledged;
  const flightCheckReady = preflightValid && budgetValid && !!launchPreview;
  const launch = async () => {
    if (launching || !flightCheckReady) return;
    setLaunching(true); setLaunchError("");
    try {
    const currentTask = allTasks.value.find((task) => task.file === value.task.file && task.cbidx === value.task.cbidx);
    if (!currentTask || currentTask.idChip !== value.task.idChip || currentTask.text !== value.task.text || currentTask.state !== "open") throw new Error("Work changed. Select it again to refresh the run scope.");
    const eligibility = deliverEligibility(currentTask, deliveryData.value.sessions, topics);
    if (!eligibility.eligible) throw new Error(eligibility.reason);
    const file = byRelPath.value.get(value.task.file.toLowerCase());
    const line = scanCheckboxes(file.raw)[value.task.cbidx]?.line;
    const expectText = line == null ? value.task.text : file.raw.split("\n")[line];
    const effort = value.effort && Object.keys(value.effort).some((k) => value.effort[k]) ? value.effort : undefined;
    const budgetPayload = budget.noCap
      ? {
          maxUsd: null,
          maxTokens: null,
          warnPct,
          noCapConfirm: budget.noCapConfirm,
        }
      : { maxUsd, maxTokens, warnPct };
    const result = await deliveryPost(
      "start",
      {
        file: value.task.file,
        cbidx: value.task.cbidx,
        expectText,
        agent: value.provider,
        model: value.model || undefined,
        effort,
        preflightId: preflight.data.preflightId,
        dirtyAck: value.dirtyAck,
        redBaselineAck: value.redBaselineAck,
        triageAck: value.triageAck,
        budget: budgetPayload,
        flightCheck: { reviewed: true, lane: selectedLane },
        // DLV-73 — re-validated server-side against the locator's own hits, so
        // this is a choice among candidates, never an arbitrary path.
        locatorChoice: value.locatorChoice || undefined,
        options: { capabilitiesDrop: value.dropped },
      },
    );
    location.hash = `/delivery/session/${result.sessionId}?from=${encodeURIComponent(localReturn(route.value.query.get("from"), "/delivery"))}`;
    } catch (error) { setLaunchError(error.message); }
    finally { setLaunching(false); }
  };
  return (
    <>
      <Breadcrumbs items={[{ label: "Selection", href: localReturn(route.value.query.get("from"), "/delivery") }, { label: "Delivery" }]} />
      <header class="page-head" style={{ marginTop: 18 }}>
        <div>
          <div class="eyebrow">Delivery / New run</div>
          <h1>{value.task ? "Configure run" : "Choose work"}</h1>
        </div>
        <button class="button" onClick={onClose}>
          Cancel
        </button>
      </header>
      {launchError && <div class="inline-error" role="alert">{launchError}</div>}
      <div class="wizard-steps">
        {value.task && <div class="selected-work"><div><span class="eyebrow">{value.task.module} / {value.task.idChip}</span><h2>{workTitle(value.task)}</h2></div><button class="button" onClick={() => setChoosing(!choosing)}>Change</button></div>}
        {choosing && <>
        <div class={`wizard-step ${!value.campaign ? "active" : ""}`}>
          <div class="eyebrow">Campaign</div>
          <div class="chip-row">
            {topics.map((topic) => (
              <button key={topic} class={`button ${value.campaign === topic ? "primary" : ""}`} onClick={() => update({ campaign: topic, task: null, locatorChoice: null, dropped: [], dirtyAck: "", redBaselineAck: "", triageAck: "" })}>
                {topic}
              </button>
            ))}
          </div>
        </div>
        {value.campaign && (
          <div class={`wizard-step ${!value.task ? "active" : ""}`}>
            <div class="eyebrow">Work item</div>
            <div class="field"><input aria-label="Find work to deliver" placeholder="Find work" value={itemQuery} onInput={(event) => setItemQuery(event.currentTarget.value)}/></div>
            <div class="search-list" style={{ maxHeight: 250, overflow: "auto" }}>
              {candidates.map((task) => {
                const eligibility = deliverEligibility(task, deliveryData.value.sessions, topics);
                return (
                  <button key={task.key} class={`palette-result ${value.task?.key === task.key ? "selected" : ""}`} disabled={!eligibility.eligible || /\bHELD\b/i.test(task.text)} title={eligibility.reason || ""} onClick={() => { update({ task, locatorChoice: null, dropped: [], dirtyAck: "", redBaselineAck: "", triageAck: "" }); setChoosing(false); }}>
                    <span class="palette-result-main">
                      <strong>
                        {task.idChip ? `${task.idChip} · ` : ""}
                        {workTitle(task)}
                      </strong>
                      <span>
                        {task.section} · {eligibility.reason || "ready"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </>}
        {value.task && !choosing && (
          <div class="wizard-step active flight-check">
            <div class="flight-check-head">
              <div>
                <div class="eyebrow">Run settings</div>
                <h2>Scope, agent & limits</h2>
              </div>
              <Chip tone={flightCheckReady ? "success" : "blocker"}>
                {flightCheckReady ? "Ready to launch" : "Action required"}
              </Chip>
            </div>
            {recommendationState.value.error && <div class="inline-error" role="alert">{recommendationState.value.error}<button class="button" onClick={() => loadDeliveryRecommendation(value.task.file, value.task.cbidx, value.provider, value.locatorChoice, value.lane)}>Retry</button></div>}
<div class="launch-layout"><div class="launch-primary"><section class="flight-check-section">
              <div class="eyebrow">Approach & agent</div>
              <div class="chip-row" style={{ marginBottom: 8 }}>
                {DELIVERY_LANES.map((lane) => (
                  <button key={lane} type="button" title={LANE_BLURB[lane] || ""} class={`button ${selectedLane === lane ? "primary" : ""}`} onClick={() => update({ lane })}>
                    {LANE_LABEL[lane]}{lane === launchPreview?.recommendedLane ? " · suggested" : ""}
                  </button>
                ))}
              </div>
              <p class="muted" style={{ fontSize: 11, marginBottom: 8 }}>{LANE_BLURB[selectedLane]}</p>
              {/* DLV-73: what the locator resolved, shown BEFORE launch. An
                  ambiguous result is a picker here — the cheapest possible place
                  to ask, since a question raised mid-session costs a whole turn. */}
              {locator && locator.hits?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div class="eyebrow">
                    Target {locator.confidence === "exact" ? "· named by the item" : `· located (${locator.confidence})`}
                  </div>
                  {locator.confidence === "ambiguous" ? (
                    <>
                      <p class="muted" style={{ fontSize: 11 }}>
                        Several files match. Pick one to enable INSTANT, or launch on FAST and let DISCOVERY decide.
                      </p>
                      <div class="chip-row">
                        {locator.hits.map((hit) => (
                          <button
                            key={hit.path}
                            type="button"
                            class={`button ${value.locatorChoice === hit.path ? "primary" : ""}`}
                            title={hit.why}
                            onClick={() => update({ locatorChoice: value.locatorChoice === hit.path ? null : hit.path })}
                          >
                            {hit.path.split("/").pop()}{hit.line ? `:${hit.line}` : ""}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p class="muted" style={{ fontSize: 11 }}>
                      <code>{locator.hits[0].path}{locator.hits[0].line ? `:${locator.hits[0].line}` : ""}</code>
                      {locator.source === "item-paths" ? "" : " — resolved with no model call"}
                    </p>
                  )}
                </div>
              )}
              <div class="chip-row">
                {["claude", "codex"].map((provider) => (
                  <button key={provider} class={`button ${value.provider === provider ? "primary" : ""}`} onClick={() => update({ provider, model: null, lane: null, effort: {} })}>
                    {provider}
                  </button>
                ))}
              </div>
              {rec && (
                <div class="card" style={{ marginTop: 8, padding: 10 }}>
                  <div class="eyebrow">Recommended · {rec.tier} tier</div>
                  <p style={{ margin: "4px 0" }}>
                    <strong>{rec.model}</strong>
                    {rec.estCostUsd != null ? ` · ~$${rec.estCostUsd.toFixed(2)} est.` : ""} · ~{rec.estTokens.toLocaleString()} tok est.
                  </p>
                  <p class="muted" style={{ fontSize: 11, margin: "2px 0 8px" }}>
                    {rec.rationale.length ? rec.rationale.join("; ") : "no complexity signals found — default economy tier"}
                  </p>
                  <button type="button" class="button" onClick={() => update({ model: rec.model, effort: rec.effortByPhase })}>
                    Use suggested
                  </button>
                </div>
              )}
              {mismatchWarnings.map((warning) => (
                <p key={warning} class="verdict-block flight-check-warning">{warning}</p>
              ))}
              {models.length > 0 && (
                <div class="field" style={{ marginTop: 8 }}>
                  <label>Model</label>
                  <select value={value.model || ""} onChange={(event) => update({ model: event.currentTarget.value || null })}>
                    <option value="">
                      Default
                      {providerCaps.defaultModel ? ` (${providerCaps.defaultModel})` : ""}
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label || m.id}</option>
                    ))}
                  </select>
                </div>
              )}
              {efforts.length > 0 && (
                <details class="field technical-details" style={{ marginTop: 8 }}><summary>Reasoning per stage</summary>
                  <div class="chip-row">
                    {EFFORT_PHASES.map((phase) => (
                      <label key={phase}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          fontSize: 10,
                        }}
                      >
                        <span class="muted">{phase}</span>
                        <select
                          value={value.effort?.[phase] || ""}
                          onChange={(event) =>
                            update({
                              effort: {
                                ...value.effort,
                                [phase]: event.currentTarget.value || undefined,
                              },
                            })
                          }
                        >
                          <option value="">default</option>
                          {efforts.map((e) => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </section><section class="flight-check-section">
              <div class="eyebrow">Run limits</div>
              <p class="muted" style={{ fontSize: 11 }}>
                Limits are checked between turns.
              </p>
              <div class="chip-row">
                <label class="field" style={{ flex: "1 1 130px" }}>
                  <span>Cost limit ($)</span>
                  <input type="text" inputMode="decimal" value={budget.maxUsd} disabled={budget.noCap} onInput={(event) => updateBudget({ maxUsd: event.currentTarget.value })} />
                </label>
                <label class="field" style={{ flex: "1 1 160px" }}>
                  <span>Token limit</span>
                  <input type="text" inputMode="decimal" value={budget.maxTokens} disabled={budget.noCap} onInput={(event) => updateBudget({ maxTokens: event.currentTarget.value })} />
                </label>
                <label class="field" style={{ flex: "1 1 120px" }}>
                  <span>Warning (%)</span>
                  <input type="text" inputMode="decimal" value={budget.warnPct} onInput={(event) => updateBudget({ warnPct: event.currentTarget.value })} />
                </label>
              </div>
              <label class="button" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={budget.noCap} onChange={(event) => updateBudget({ noCap: event.currentTarget.checked })} />
                Remove limits
              </label>
              {budget.noCap && (
                <div class="field">
                  <label>Type NO CAP to authorize</label>
                  <input
                    value={budget.noCapConfirm}
                    onInput={(event) =>
                      updateBudget({
                        noCapConfirm: event.currentTarget.value,
                      })
                    }
                  />
                </div>
              )}
              {!budgetValid && (
                <p class="verdict-block" style={{ marginTop: 8 }}>
                  Set at least one positive cap and a warning percentage from 1–99, or type NO CAP.
                </p>
              )}
            </section><details class="flight-check-section technical-details"><summary>Context</summary>
              <div class="eyebrow">Included references</div>
              {launchPreview?.contextManifest ? (
                <>
                  <p>
                    <strong>~{launchPreview.contextManifest.estimatedTokens.toLocaleString()} tokens</strong>
                    <span class="muted"> · {launchPreview.contextManifest.estimateMethod}</span>
                  </p>
                  <div class="flight-check-manifest">
                    {launchPreview.contextManifest.entries.map((entry) => (
                      <div key={entry.path || entry.kind}>
                        <span class="mono">{entry.path || entry.kind}</span>
                        <span class="muted">{entry.phases.join(", ")} · ~{entry.estimatedTokens.toLocaleString()} tok</span>
                      </div>
                    ))}
                  </div>
                  <p class="muted" style={{ fontSize: 11 }}>{launchPreview.contextManifest.note}</p>
                </>
              ) : (
                <p class="muted">Loading the launch context manifest…</p>
              )}
            </details><details class="flight-check-section technical-details"><summary>Capabilities</summary>
              <div class="eyebrow">
                Capabilities <span class="muted"></span>
              </div>
              <div class="chip-row">
                {capabilities.map((cap) => {
                  const locked = ALWAYS_ON_CAPABILITIES.includes(cap.name),
                    dropped = value.dropped.includes(cap.name),
                    agent = getAgent(cap.name);
                  return (
                    <button key={cap.name}
                      class={`chip capability ${dropped ? "dropped" : ""}`}
                      disabled={locked}
                      title={agent?.purpose}
                      onClick={() =>
                        update({
                          dropped: dropped ? value.dropped.filter((name) => name !== cap.name) : [...value.dropped, cap.name],
                        })
                      }
                    >
                      {agent?.name || cap.name}
                      {locked ? " 🔒" : dropped ? " · restore" : " · remove"}
                    </button>
                  );
                })}
              </div>
              {launchPreview?.riskFlags?.length ? (
                <ul class="flight-check-list muted">
                  {launchPreview.riskFlags.map((risk) => (
                    <li key={risk.name}>{risk.name} · {risk.reason}</li>
                  ))}
                </ul>
              ) : (
                <p class="verdict-pass">No additional capabilities needed.</p>
              )}
            </details></div><aside class="launch-review"><section class="flight-check-section">
              <div class="eyebrow">
                Workspace checks <span class="muted"></span>
              </div>
              {preflight.loading && (
                <p class="muted">Running the validation baseline and fingerprinting current edits…</p>
              )}
              {preflight.error && (
                <div>
                  <p class="verdict-block">{preflight.error}</p>
                  <button type="button" class="button" onClick={loadDeliveryPreflight}>
                    Retry preflight
                  </button>
                </div>
              )}
              {preflight.data && (
                <>
                  <p class={preflight.data.dirtyAtStart ? "verdict-block" : "verdict-pass"}>
                    {preflight.data.dirtyAtStart
                      ? `${preflight.data.changedFiles.length} pre-existing changed file${preflight.data.changedFiles.length === 1 ? "" : "s"} — not session-owned`
                      : "Workspace clean"}
                  </p>
                  {preflight.data.dirtyAtStart && (
                    <>
                      <div class="event mono" style={{ maxHeight: 130, overflow: "auto" }}>
                        {preflight.data.changedFiles.map((path) => (
                          <div key={path}>{path}</div>
                        ))}
                      </div>
                      <div class="field">
                        <label>Type {DIRTY_TREE_ACK} to acknowledge shared-workspace risk</label>
                        <input
                          value={value.dirtyAck}
                          onInput={(event) => update({ dirtyAck: event.currentTarget.value })}
                          placeholder={DIRTY_TREE_ACK}
                        />
                      </div>
                    </>
                  )}
                  <p class={preflight.data.baselineValidation.ok ? "verdict-pass" : "verdict-block"}>
                    {preflight.data.baselineValidation.ok
                      ? "Checks passed"
                      : `Validation baseline red: ${Object.entries(preflight.data.baselineValidation.results || {})
                          .filter(([, result]) => !result.ok)
                          .map(([command]) => command)
                          .join(", ")}`}
                  </p>
                  {!preflight.data.baselineValidation.ok && (
                    <div class="field">
                      <label>Type {RED_BASELINE_ACK} to authorize delta-based validation</label>
                      <input
                        value={value.redBaselineAck}
                        onInput={(event) => update({ redBaselineAck: event.currentTarget.value })}
                        placeholder={RED_BASELINE_ACK}
                      />
                    </div>
                  )}
                  {isTrivialLaunch && (
                    <>
                      <p class="verdict-block">
                        This item is S-effort with no risk flags — too trivial to be worth the pipeline's own
                        overhead; a change this small cannot fail in an interesting way.
                        {rec ? ` Pipeline forecast: ~$${(rec.estCostUsd ?? 0).toFixed(2)} / ~${rec.estTokens.toLocaleString()} tokens.` : ""}{" "}
                        Consider making the edit directly instead.
                      </p>
                      <div class="field">
                        <label>Type {TRIAGE_OVERRIDE_ACK} to launch through the pipeline anyway</label>
                        <input
                          value={value.triageAck}
                          onInput={(event) => update({ triageAck: event.currentTarget.value })}
                          placeholder={TRIAGE_OVERRIDE_ACK}
                        />
                      </div>
                    </>
                  )}
                  <button type="button" class="button" onClick={loadDeliveryPreflight}>
                    Refresh baseline
                  </button>
                </>
              )}
            </section><details class="flight-check-section technical-details"><summary>Acceptance criteria</summary>
              <div class="eyebrow">Work item & acceptance criteria</div>
              <p>{workTitle(value.task)}</p>
              <span class="mono muted" style={{ fontSize: 11 }}>
                {value.task.module} / {value.task.idChip}
              </span>
              {launchPreview?.acceptanceCriteria?.length ? (
                <ul class="flight-check-list">
                  {launchPreview.acceptanceCriteria.map((criterion) => (
                    <li key={criterion.id}><strong>{criterion.id}</strong> · {criterion.text}</li>
                  ))}
                </ul>
              ) : (
                <p class="muted" style={{ fontSize: 11 }}>Scope review defines the acceptance criteria.</p>
              )}
            </details></aside></div>
            <div class="launch-footer"><span>{preflight.loading ? "Checking workspace…" : recommendationState.value.loading ? "Preparing run…" : flightCheckReady ? "Ready to start" : "Complete the required checks"}</span><button class="button primary button-submit" onClick={launch} disabled={!flightCheckReady || launching}>
              <Icon name="bolt" />
              {launching ? "Starting…" : "Start run"}
            </button></div>
          </div>
        )}
      </div>
    </>
  );
}

export function DeliveryWizardPage() {
  useEffect(() => { loadDeliveryCapabilities(); loadDeliveryDispatchMode(); loadDeliverySessions().catch(() => {}); }, []);
  const [value, setValue] = useState(() => {
    const file = route.value.query.get("file"),
      cb = Number(route.value.query.get("cb"));
    const requestedLane = String(route.value.query.get("lane") || "").toUpperCase();
    const task = file && Number.isInteger(cb) ? allTasks.value.find((entry) => entry.file === file && entry.cbidx === cb) : null;
    return {
      campaign: task?.module || null,
      task: task || null,
      provider: "claude",
      model: null,
      lane: DELIVERY_LANES.includes(requestedLane) ? requestedLane : null,
      // DLV-73: the file picked from an ambiguous locator shortlist, if any.
      locatorChoice: null,
      effort: {},
      dropped: [],
      dirtyAck: "",
      redBaselineAck: "",
      triageAck: "",
      budget: null,
    };
  });
  if (deliveryDispatchMode.value.mode === "v2") return <><a class="back-link" href="#/delivery">← Delivery</a><DeliverySetup/></>;
  if (!deliveryDispatchMode.value.mode) return <EmptyState icon="bolt" title={deliveryDispatchMode.value.error ? "Delivery settings unavailable" : "Loading delivery settings…"}>{deliveryDispatchMode.value.error && <button class="button" onClick={loadDeliveryDispatchMode}>Retry</button>}</EmptyState>;
  return <Wizard value={value} setValue={setValue} onClose={() => navigate(localReturn(route.value.query.get("from"), "/delivery"))} />;
}
