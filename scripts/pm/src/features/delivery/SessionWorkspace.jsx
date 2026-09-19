import { useEffect, useState } from "preact/hooks";
import { apiGet } from "../../app/api.js";
import { Chip } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Markdown } from "../doc/Markdown.jsx";
import { deliveryEvents, deliveryTurns, deliveryTranscriptByTurn, loadDeliveryTranscript } from "./deliveryStore.js";
import { gateLabel, phaseLabel, timeLabel } from "../../lib/product.js";
import { sessionModel, STAGES } from "./sessionModel.js";
import { PHASE_ROLES } from "../../../../delivery/transcript.mjs";
const DOCUMENT_KEYS = ["plan.json", "validation.json", "finish/summary.md"];

export function SessionWorkspace({ id, detail, onGoTo, openArtifact }) {
  const [documents, setDocuments] = useState({});
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const version = JSON.stringify(detail.artifacts.filter((a) => DOCUMENT_KEYS.includes(a.path)).map(({path,mtimeMs}) => ({path,mtimeMs})));
  useEffect(() => {
    let live = true;
    const paths = JSON.parse(version).map((entry) => entry.path);
    Promise.all(paths.map(async (path) => {
      const result = await apiGet(`/api/delivery/artifact?id=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`);
      return [path, path.endsWith(".json") ? JSON.parse(result.content) : result.content];
    })).then((entries) => { if (live) { setDocuments(Object.fromEntries(entries)); setError(""); } }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id, version, retry]);
  const latestTurn = deliveryTurns.value.at(-1);
  useEffect(() => { if (latestTurn?.turnId) loadDeliveryTranscript(id, latestTurn.turnId); }, [id, latestTurn?.turnId]);
  const records = deliveryTranscriptByTurn.value[latestTurn?.turnId]?.records || [];
  const tools = records.filter((r) => ["tool.use", "file.change", "command"].includes(r.kind)).slice(-4).reverse();
  const { state, packet, runner } = detail;
  const model = sessionModel(detail, deliveryEvents.value, documents["plan.json"]);
  const role = PHASE_ROLES[state.state] || phaseLabel(state.state);
  const usage = state.usage?.total || {};
  const tokens = (usage.input || 0) + (usage.cachedRead ?? usage.cachedInput ?? 0) + (usage.cacheCreation || 0) + (usage.output || 0);
  const budget = state.budget?.current || packet.budget || {};
  const checks = Object.entries(documents["validation.json"]?.results || {});
  const changed = state.workspace?.changedFiles || [];
  return <>
    <div class="run-stage-track" aria-label="Delivery stages">{STAGES.map((stage, index) => <div class={`${model.stage === index ? "current" : ""} ${model.stage > index && stage.phases.some((phase) => model.visited.has(phase)) ? "visited" : ""}`} key={stage.label}><span>{model.stage > index && stage.phases.some((phase) => model.visited.has(phase)) ? <Icon name="check" size={12}/> : index + 1}</span>{stage.label}</div>)}</div>
    <div class={`run-now ${model.running ? "running" : ""}`}><div class="run-agent-mark"><Icon name={model.terminal ? "archive" : model.running ? "bolt" : "clock"} size={26}/></div><div><div class="eyebrow">{model.terminal ? "Run outcome" : model.running ? "Working now" : "Current state"}</div><h2>{state.awaiting ? gateLabel(state.awaiting.gate) : state.execution?.paused ? "Paused" : !runner.alive && !model.terminal ? "Run stopped" : phaseLabel(state.state)}</h2><span class="muted">{state.execution?.provider || packet.agent} · {state.execution?.model || packet.agentConfig?.model || "Default model"}{model.running ? ` · ${role}` : ""}</span></div><span class="run-heartbeat"><span class={`status-beacon ${model.running ? "running" : ""}`}/>{runner.heartbeatAt ? `Heartbeat ${timeLabel(runner.heartbeatAt)}` : "No heartbeat recorded"}</span></div>
    {error && <div class="inline-error" role="alert">Evidence unavailable: {error}<button class="button" onClick={() => setRetry(retry + 1)}>Retry</button></div>}
    {documents["finish/summary.md"] && (model.terminal || state.state === "ACCEPTED" || state.state === "UAT_READY") && <section class="run-outcome"><div class="section-heading"><h2>Handoff</h2><button class="button ghost" onClick={() => onGoTo("artifacts")}>All evidence →</button></div><Markdown raw={documents["finish/summary.md"]} file=""/></section>}
    <div class="run-workspace"><div>
      <section class="run-section"><div class="section-heading"><h2>Execution plan</h2>{documents["plan.json"] && <button class="button ghost" onClick={() => openArtifact("plan.json")}>View plan</button>}</div>{model.steps.length ? <ol class="execution-steps">{model.steps.map((step,index) => <li class={step.status} key={step.id || index}><span class="step-number">{step.status === "done" ? <Icon name="check" size={14}/> : index + 1}</span><div><strong>{step.description || step.title || step.id}</strong><span>{step.status === "done" ? "Completed" : step.status === "current" ? model.running ? "In progress" : "Current step · stopped" : "Upcoming"}</span>{Array.isArray(step.paths) && <small>{step.paths.join(" · ")}</small>}</div></li>)}</ol> : <p class="quiet-empty">{state.state === "BUILDING" && state.build?.mode === "fix" ? "Fixing issues from validation." : "No plan recorded yet."}</p>}</section>
      <section class="run-section"><div class="section-heading"><h2>Activity</h2><button class="button ghost" onClick={() => onGoTo("timeline")}>Full timeline →</button></div><div class="run-events">{model.recent.length ? model.recent.map((event) => <div class="run-event" key={event.seq}><span class="activity-dot"/><div><strong>{event.label}</strong><span>{phaseLabel(event.phase)}</span></div><time>{timeLabel(event.ts || event.at)}</time></div>) : <p class="quiet-empty">No activity recorded.</p>}</div></section>
      {tools.length > 0 && <section class="run-section"><div class="section-heading"><h2>Last recorded tools</h2><button class="button ghost" onClick={() => onGoTo("conversation")}>Conversation →</button></div>{tools.map((record) => <div class="tool-record" key={record.seq}><Icon name="file" size={15}/><strong>{record.tool || record.kind}</strong><span>{record.input?.file_path || record.input?.path || record.text?.slice(0, 150) || "Recorded in conversation"}</span></div>)}</section>}
    </div><aside class="run-rail">
      <section class="rail-card"><div class="section-heading"><h3>Acceptance</h3><Chip>{(state.acceptance || []).filter((a) => a.status === "met").length}/{state.acceptance?.length || 0}</Chip></div>{state.acceptance?.length ? state.acceptance.map((ac) => <div class="acceptance-row" key={ac.id}><Chip tone={ac.status === "met" ? "success" : ""}>{ac.status}</Chip><span>{ac.text || ac.criterion || ac.id}</span></div>) : <p class="quiet-empty">No criteria recorded.</p>}</section>
      <section class="rail-card"><h3>Checks</h3>{checks.length ? checks.map(([name, result]) => <div class="check-row" key={name}><span>{name}</span><Chip tone={result.ok === true && !result.skipped ? "success" : ""}>{result.skipped ? "Skipped" : result.ok === true ? "Passed" : result.ok === false ? "Failed" : "Not verified"}</Chip></div>) : <p class="quiet-empty">No check results yet.</p>}</section>
      <section class="rail-card"><div class="section-heading"><h3>Files changed</h3><Chip>{changed.length}</Chip></div>{changed.length ? changed.map((path) => <div class="file-line" key={path}><Icon name="file" size={14}/><span>{path}</span></div>) : <p class="quiet-empty">No changes recorded.</p>}<button class="button ghost" onClick={() => onGoTo("context")}>Context & references →</button></section>
      <section class="rail-card"><div class="section-heading"><h3>Resources</h3><button class="button ghost" onClick={() => onGoTo("usage")}>Details</button></div><div class="resource-value">{tokens.toLocaleString()}<span> tokens</span></div>{budget.maxTokens > 0 && <><div class="progress"><span style={{ width: `${Math.min(100, tokens / budget.maxTokens * 100)}%` }}/></div><p class="resource-caption">of {budget.maxTokens.toLocaleString()} authorized</p></>}<div class="check-row"><span>Recorded cost</span><strong>{Number.isFinite(usage.costUsd) ? `$${usage.costUsd.toFixed(2)}` : "Unavailable"}</strong></div>{budget.maxUsd > 0 && <div class="check-row"><span>Cost limit</span><strong>${budget.maxUsd.toFixed(2)}</strong></div>}</section>
    </aside></div>
  </>;
}
