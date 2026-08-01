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
import {
  deliveryCapabilities,
  deliveryData,
  deliveryLoading,
  deliveryPost,
  deliveryPreflight,
  deliverEligibility,
  deliveryRecommendation,
  loadDeliveryCapabilities,
  loadDeliveryPreflight,
  loadDeliveryRecommendation,
  loadDeliverySessions,
} from "./deliveryStore.js";
import { CancelSessionDialog } from "./SessionDetail.jsx";

const EFFORT_PHASES = ["discovery", "plan", "building", "review"];
const TERMINAL_STATES = new Set(["SHIPPED", "CANCELLED", "FAILED"]);
// DLV-73: INSTANT leads the list because it is the cheapest thing that can
// still be a supervised session — the lane the triage gate now routes a trivial
// item to instead of refusing it outright.
const DELIVERY_LANES = ["INSTANT", "FAST", "STANDARD", "DEEP"];
const LANE_BLURB = {
  INSTANT: "2 turns · one located file · review verified from the diff",
  FAST: "merged spec+plan · lean context · targeted tests",
  STANDARD: "full pipeline",
  DEEP: "full pipeline · highest reasoning",
};
const checklist = (path) => /(?:^|\/)4\s*-\s*Checklist\.md$/i.test(path);

export function DeliveryHome() {
  const [tab, setTab] = useState("sessions");
  useEffect(() => {
    loadDeliverySessions();
    loadDeliveryCapabilities();
  }, []);
  const configStatus = deliveryCapabilities.value?.config?.status;
  return (
    <>
      <header class="page-head">
        <div>
          <div class="eyebrow">Supervised agent workflow</div>
          <h1>Delivery</h1>
          <p>Launch, gate, and inspect implementation sessions while the server remains authoritative.</p>
        </div>
        <button class="button primary" onClick={() => navigate("/delivery/new")}>
          <Icon name="plus" />
          New delivery
        </button>
      </header>
      {configStatus && !configStatus.healthy && (
        <div class="lock-banner" style={{ borderColor: "var(--era-amber,#e0a852)" }}>
          <strong>Delivery config needs attention.</strong> Using {configStatus.source === "last-known-good" ? "the last known-good configuration" : "safe built-in defaults"} until <code>.delivery/config.json</code> is fixed. {configStatus.message}
        </div>
      )}
      {deliveryData.value.buildLockActive && <div class="lock-banner">A session is already past the plan gate. Other plan approvals wait for the build lock.</div>}
      <div class="delivery-tabs">
        <button class={`button ${tab === "sessions" ? "primary" : ""}`} onClick={() => setTab("sessions")}>
          Sessions
        </button>
        <button class={`button ${tab === "agents" ? "primary" : ""}`} onClick={() => setTab("agents")}>
          Agent catalog
        </button>
      </div>
      {tab === "sessions" ? (
        <>
          <FleetMetrics metrics={deliveryData.value.metrics} />
          <SessionsList />
        </>
      ) : (
        <AgentCatalog />
      )}
    </>
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

function SessionsList() {
  const sessions = deliveryData.value.sessions || [];
  const [cancelId, setCancelId] = useState(null);
  if (deliveryLoading.value && !sessions.length) return <div class="empty">Loading sessions…</div>;
  if (!sessions.length)
    return (
      <EmptyState icon="bolt" title="No delivery sessions">
        Launch an open checklist item when you are ready.
      </EmptyState>
    );
  const cancelTarget = cancelId ? sessions.find((s) => s.sessionId === cancelId) : null;
  return (
    <div class="session-list">
      {sessions.map((session) => {
        // DLV-37: include cached-read + cache-creation, not just input/output —
        // the fleet list previously under-reported the same way the session
        // header chip did (Cost Anatomy §4).
        const usageTotal = session.usageTotal;
        const usage = usageTotal
          ? (usageTotal.input || 0) +
            (usageTotal.cachedRead != null ? usageTotal.cachedRead : usageTotal.cachedInput || 0) +
            (usageTotal.cacheCreation || 0) +
            (usageTotal.output || 0)
          : 0;
        const cancellable = !TERMINAL_STATES.has(session.state);
        return (
          <a class="session-row" href={`#/delivery/session/${session.sessionId}${session.awaiting?.gate === "question" ? "?tab=questions" : ""}`} style={{ color: "inherit" }}>
            <span class={`session-dot ${session.runnerAlive ? "alive" : ""}`} />
            <Chip tone={session.state === "SHIPPED" ? "success" : session.state === "BLOCKED" ? "blocker" : ""}>{session.state}</Chip>
            {session.awaiting && <Chip tone="blocker">{session.awaiting.gate}</Chip>}
            <span class="session-title">
              <strong>
                {session.item?.id ? `${session.item.id} · ` : ""}
                {session.item?.text || "Untitled"}
              </strong>
              <span class="muted" style={{ display: "block", fontSize: 11 }}>
                {session.item?.campaign} · {session.agent}
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span class="session-usage mono muted">{usage} tok</span>
              {cancellable && (
                <button
                  class="icon-button"
                  title="Cancel this delivery session"
                  style={{
                    color: "var(--era-danger,#e05252)",
                    width: 32,
                    height: 32,
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCancelId(session.sessionId);
                  }}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </span>
          </a>
        );
      })}
      {cancelTarget && <CancelSessionDialog id={cancelTarget.sessionId} label={cancelTarget.item?.id || cancelTarget.item?.text} onClose={() => setCancelId(null)} onDone={loadDeliverySessions} />}
    </div>
  );
}

function AgentCatalog() {
  return (
    <div class="card">
      {AGENT_REGISTRY.map((agent) => (
        <div class="agent-row">
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
  const topics = [...new Set(files.value.filter((file) => !file.inFabled && checklist(file.relPath)).map((file) => file.module))];
  const candidates = value.campaign ? allTasks.value.filter((task) => task.module === value.campaign && !task.inFabled && checklist(task.file)) : [];
  const update = (patch) => setValue({ ...value, ...patch });
  const providerCaps = deliveryCapabilities.value?.providers?.[value.provider];
  const models = providerCaps?.models || [];
  const efforts = providerCaps?.efforts || providerCaps?.manifest?.efforts || [];
  useEffect(() => {
    if (value.task) loadDeliveryRecommendation(value.task.file, value.task.cbidx, value.provider, value.locatorChoice);
    else deliveryRecommendation.value = null;
  }, [value.task?.file, value.task?.cbidx, value.provider, value.locatorChoice]);
  useEffect(() => {
    if (value.task) loadDeliveryPreflight();
    else deliveryPreflight.value = { loading: false, data: null, error: null };
  }, [value.task?.file, value.task?.cbidx]);
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
      "Delivery session launched",
    );
    location.hash = `/delivery/session/${result.sessionId}`;
  };
  return (
    <>
      <Breadcrumbs items={[{ label: "Delivery", href: "/delivery" }, { label: "New session" }]} />
      <header class="page-head" style={{ marginTop: 18 }}>
        <div>
          <div class="eyebrow">Supervised agent workflow</div>
          <h1>New delivery session</h1>
          <p>Pick a topic and work item, then authorize the launch envelope.</p>
        </div>
        <button class="button" onClick={onClose}>
          Cancel
        </button>
      </header>
      <div class="wizard-steps">
        <div class={`wizard-step ${!value.campaign ? "active" : ""}`}>
          <div class="eyebrow">1 · Topic</div>
          <div class="chip-row">
            {topics.map((topic) => (
              <button class={`button ${value.campaign === topic ? "primary" : ""}`} onClick={() => update({ campaign: topic, task: null, lane: null, locatorChoice: null, dropped: [], dirtyAck: "", redBaselineAck: "", triageAck: "" })}>
                {topic}
              </button>
            ))}
          </div>
        </div>
        {value.campaign && (
          <div class={`wizard-step ${!value.task ? "active" : ""}`}>
            <div class="eyebrow">2 · Work item</div>
            <div class="search-list" style={{ maxHeight: 250, overflow: "auto" }}>
              {candidates.map((task) => {
                const eligibility = deliverEligibility(task, deliveryData.value.sessions, topics);
                return (
                  <button class={`palette-result ${value.task?.key === task.key ? "selected" : ""}`} disabled={!eligibility.eligible} title={eligibility.reason || ""} onClick={() => update({ task, lane: null, locatorChoice: null, dropped: [], dirtyAck: "", redBaselineAck: "", triageAck: "" })}>
                    <span class="palette-result-main">
                      <strong>
                        {task.idChip ? `${task.idChip} · ` : ""}
                        {task.text}
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
        {value.task && (
          <div class="wizard-step active flight-check">
            <div class="flight-check-head">
              <div>
                <div class="eyebrow">3 · Preflight Flight-Check</div>
                <h2>Authorize the whole launch envelope</h2>
                <p class="muted">One auditable view of the work, execution fit, spend, context, capabilities, and baseline.</p>
              </div>
              <Chip tone={flightCheckReady ? "success" : "blocker"}>
                {flightCheckReady ? "Ready to launch" : "Action required"}
              </Chip>
            </div>
            <div class="flight-check-grid">
            <section class="flight-check-section">
              <div class="eyebrow">Work item & acceptance criteria</div>
              <p>{value.task.text}</p>
              <span class="mono muted" style={{ fontSize: 11 }}>
                {value.task.file} · cb {value.task.cbidx}
              </span>
              {launchPreview?.acceptanceCriteria?.length ? (
                <ul class="flight-check-list">
                  {launchPreview.acceptanceCriteria.map((criterion) => (
                    <li><strong>{criterion.id}</strong> · {criterion.text}</li>
                  ))}
                </ul>
              ) : (
                <p class="muted" style={{ fontSize: 11 }}>Acceptance criteria will be authored and gated during SPEC.</p>
              )}
            </section>
            <section class="flight-check-section">
              <div class="eyebrow">Lane, provider & model fit</div>
              <div class="chip-row" style={{ marginBottom: 8 }}>
                {DELIVERY_LANES.map((lane) => (
                  <button type="button" title={LANE_BLURB[lane] || ""} class={`button ${selectedLane === lane ? "primary" : ""}`} onClick={() => update({ lane })}>
                    {lane}{lane === launchPreview?.recommendedLane ? " · recommended" : ""}
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
                  <button class={`button ${value.provider === provider ? "primary" : ""}`} onClick={() => update({ provider, model: null, lane: null, effort: {} })}>
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
                    Use recommendation
                  </button>
                </div>
              )}
              {mismatchWarnings.map((warning) => (
                <p class="verdict-block flight-check-warning">{warning}</p>
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
                      <option value={m.id}>{m.label || m.id}</option>
                    ))}
                  </select>
                </div>
              )}
              {efforts.length > 0 && (
                <div class="field" style={{ marginTop: 8 }}>
                  <label>
                    Effort per phase <span class="muted">(blank = server default)</span>
                  </label>
                  <div class="chip-row">
                    {EFFORT_PHASES.map((phase) => (
                      <label
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
                            <option value={e}>{e}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section class="flight-check-section">
              <div class="eyebrow">Budget envelope</div>
              <p class="muted" style={{ fontSize: 11 }}>
                The runner checks this packet-authorized envelope between turns. Warning fires once at the chosen percentage.
              </p>
              <div class="chip-row">
                <label class="field" style={{ flex: "1 1 130px" }}>
                  <span>Max USD</span>
                  <input type="text" inputMode="decimal" value={budget.maxUsd} disabled={budget.noCap} onInput={(event) => updateBudget({ maxUsd: event.currentTarget.value })} />
                </label>
                <label class="field" style={{ flex: "1 1 160px" }}>
                  <span>Max tokens</span>
                  <input type="text" inputMode="decimal" value={budget.maxTokens} disabled={budget.noCap} onInput={(event) => updateBudget({ maxTokens: event.currentTarget.value })} />
                </label>
                <label class="field" style={{ flex: "1 1 120px" }}>
                  <span>Warn at %</span>
                  <input type="text" inputMode="decimal" value={budget.warnPct} onInput={(event) => updateBudget({ warnPct: event.currentTarget.value })} />
                </label>
              </div>
              <label class="button" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={budget.noCap} onChange={(event) => updateBudget({ noCap: event.currentTarget.checked })} />
                Deliberately run without a cap
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
            </section>
            <section class="flight-check-section">
              <div class="eyebrow">Context manifest preview</div>
              {launchPreview?.contextManifest ? (
                <>
                  <p>
                    <strong>~{launchPreview.contextManifest.estimatedTokens.toLocaleString()} tokens</strong>
                    <span class="muted"> · {launchPreview.contextManifest.estimateMethod}</span>
                  </p>
                  <div class="flight-check-manifest">
                    {launchPreview.contextManifest.entries.map((entry) => (
                      <div>
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
            </section>
            <section class="flight-check-section">
              <div class="eyebrow">
                Capabilities & risk flags <span class="muted">server-authoritative</span>
              </div>
              <div class="chip-row">
                {capabilities.map((cap) => {
                  const locked = ALWAYS_ON_CAPABILITIES.includes(cap.name),
                    dropped = value.dropped.includes(cap.name),
                    agent = getAgent(cap.name);
                  return (
                    <button
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
                    <li>{risk.name} · {risk.reason}</li>
                  ))}
                </ul>
              ) : (
                <p class="verdict-pass">No optional risk capability was triggered.</p>
              )}
            </section>
            <section class="flight-check-section">
              <div class="eyebrow">
                Baseline & ownership <span class="muted">authoritative preflight</span>
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
                      : "Working tree clean"}
                  </p>
                  {preflight.data.dirtyAtStart && (
                    <>
                      <div class="event mono" style={{ maxHeight: 130, overflow: "auto" }}>
                        {preflight.data.changedFiles.map((path) => (
                          <div>{path}</div>
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
                      ? "Validation baseline green"
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
            </section>
            </div>
            <button class="button primary button-submit" onClick={launch} disabled={!flightCheckReady}>
              <Icon name="bolt" />
              Launch session
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function DeliveryWizardPage() {
  const [value, setValue] = useState(() => {
    const file = route.value.query.get("file"),
      cb = Number(route.value.query.get("cb"));
    const task = file && Number.isInteger(cb) ? allTasks.value.find((entry) => entry.file === file && entry.cbidx === cb) : null;
    return {
      campaign: task?.module || null,
      task: task || null,
      provider: "claude",
      model: null,
      lane: null,
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
  return <Wizard value={value} setValue={setValue} onClose={() => navigate("/delivery")} />;
}
