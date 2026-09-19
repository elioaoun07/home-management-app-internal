import { useEffect, useRef, useState } from "preact/hooks";
import { route, parseRoute } from "../../app/router.js";
import { apiGet } from "../../app/api.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { ContextView } from "./ContextView.jsx";
import { ConversationView } from "./ConversationView.jsx";
import { TimelineView } from "./TimelineView.jsx";
import { UsageView } from "./UsageView.jsx";
import { SessionWorkspace } from "./SessionWorkspace.jsx";
import { phaseLabel, gateLabel, taskHref, workTitle } from "../../lib/product.js";
import { localReturn, projectPath } from "../../lib/portfolio.js";
import { workItems } from "../../app/productStore.js";
import { deliveryCapabilities, deliveryPost, deliveryQuestions, deliverySession, sessionError, loadDeliveryCapabilities, loadDeliveryQuestions, loadDeliverySession, loadDeliveryTurns, activeDeliveryId } from "./deliveryStore.js";

const terminal = new Set(["SHIPPED", "CANCELLED", "FAILED"]);
const gateArtifact = { spec: "spec.md", plan: "plan.md", uat: "uat/summary.md" };
const EFFORT_PHASES = ["discovery", "plan", "building", "review"];
const TABS = ["overview", "questions", "conversation", "timeline", "context", "usage", "artifacts"];
const TAB_LABEL = { overview: "Live overview", timeline: "Timeline", conversation: "Conversation", questions: "Questions", context: "Context", usage: "Resources", artifacts: "Evidence" };

export function SessionDetail() {
  const id = route.value.id;
  const [artifact, setArtifact] = useState(null);
  const [artifactError, setArtifactError] = useState("");
  const artifactRequest = useRef(0);
  const closeArtifact = () => { artifactRequest.current++; setArtifact(null); };
  const [configOpen, setConfigOpen] = useState(false);
  const [abortOpen, setAbortOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const requested = route.value.query.get("tab");
  const tab = TABS.includes(requested) ? requested : "overview";
  const setTab = (value) => { const params = new URLSearchParams(route.value.query); params.set("tab", value); const hash = `#/delivery/session/${id}?${params}`; history.replaceState(null, "", hash); route.value = parseRoute(hash); };
  useEffect(() => {
    let stopped = false, fetching = false;
    const refresh = async (reset = false) => {
      if (stopped || fetching) return;
      fetching = true;
      try { await loadDeliverySession(id, { reset }); if (!stopped) await Promise.all([loadDeliveryQuestions(id), loadDeliveryTurns(id, { reset })]); }
      catch { /* the retained snapshot carries a visible refresh error */ }
      finally { fetching = false; }
    };
    refresh(true); loadDeliveryCapabilities();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 5000);
    return () => { stopped = true; clearInterval(timer); if (activeDeliveryId.value === id) activeDeliveryId.value = null; };
  }, [id]);
  const detail = activeDeliveryId.value === id ? deliverySession.value : null;
  if (!detail) return activeDeliveryId.value === id && sessionError.value ? <EmptyState icon="bolt" title="Session unavailable"><p>{sessionError.value}</p><button class="button" onClick={() => loadDeliverySession(id, { reset: true }).catch(() => {})}>Retry</button><a class="button ghost" href="#/delivery">All runs</a></EmptyState> : <div class="empty" role="status">Loading session…</div>;
  const { packet, state, artifacts, runner } = detail;
  const sourceTask = workItems.value.find((task) => task.module === packet.item.campaign && task.idChip === packet.item.id);
  const from = localReturn(route.value.query.get("from"), "/delivery");
  const paused = !!state.execution?.paused;
  const closed = terminal.has(state.state);
  const questions = deliveryQuestions.value;
  const openCount = (questions?.blocking?.length || 0) + (questions?.advisory?.length || 0);
  const currentProvider = state.execution?.provider || packet.agent;
  const supportsAbort = !!deliveryCapabilities.value?.providers?.[currentProvider]?.manifest?.supportsAbort;
  const control = async (type, payload = {}) => {
    if (controlBusy) return;
    setControlBusy(true);
    try { await deliveryPost("control", { id, type, payload }); await loadDeliverySession(id); }
    catch { /* shared API error notification */ }
    finally { setControlBusy(false); }
  };
  const openArtifact = async (path) => {
    const request = ++artifactRequest.current;
    setArtifact({ name: path, content: "Loading…" }); setArtifactError("");
    try { const result = await apiGet(`/api/delivery/artifact?id=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`); if (request === artifactRequest.current) setArtifact(result); }
    catch (error) { if (request === artifactRequest.current) setArtifactError(error.message); }
  };
  return <div class="session-page"><a class="back-link" href={`#${from}`}>← {from === "/delivery" ? "Delivery" : "Back to selection"}</a>
    <header class="page-head session-head"><div><div class="eyebrow"><a href={`#${projectPath({ selection: packet.item.campaign })}`}>Project</a> / <a href={`#/module/${encodeURIComponent(packet.item.campaign)}`}>{packet.item.campaign}</a> / {sourceTask ? <a href={taskHref(sourceTask, from)}>{packet.item.id}</a> : packet.item.id}</div><h1>{workTitle(packet.item)}</h1><div class="chip-row"><Chip>{phaseLabel(state.state)}</Chip>{packet.parentSession && <a href={`#/delivery/session/${packet.parentSession}?from=${encodeURIComponent(from)}`}>Parent run →</a>}{state.forks?.map((forkId) => <a href={`#/delivery/session/${forkId}?from=${encodeURIComponent(from)}`} key={forkId}>Branch →</a>)}</div></div>
    {!closed && <div class="actions"><button class="button" disabled={controlBusy} onClick={() => control(paused ? "resume-run" : "pause")}>{paused ? "Resume" : "Pause"}</button><details class="run-controls"><summary class="button">Manage <Icon name="arrow" size={14}/></summary><div class="run-controls-menu"><button onClick={() => setConfigOpen(true)}>Change model</button><button disabled={controlBusy} onClick={() => control("fork")}>Branch run</button>{!paused && supportsAbort && <button onClick={() => setAbortOpen(true)}>Stop turn</button>}<button onClick={() => setCancelOpen(true)}>Cancel run</button></div></details></div>}</header>
    {sessionError.value && <div class="inline-error" role="alert">Live refresh failed: {sessionError.value}<button class="button" onClick={() => loadDeliverySession(id).catch(() => {})}>Retry</button></div>}
    {!runner.alive && !closed && <RunnerOfflinePanel id={id} state={state} runner={runner}/>}
    {state.awaiting && <GatePanel key={state.awaiting.gate} id={id} state={state} openArtifact={openArtifact}/>}
    <nav class="product-tabs run-tabs" aria-label="Session views">{TABS.map((value) => <button class={tab === value ? "active" : ""} aria-pressed={tab === value} onClick={() => setTab(value)} key={value}>{value === "overview" && closed ? "Outcome" : TAB_LABEL[value]}{value === "questions" && openCount > 0 && <span>{openCount}</span>}</button>)}</nav>
    {tab === "overview" && <><SessionWorkspace id={id} detail={detail} onGoTo={setTab} openArtifact={openArtifact}/>{!closed && <MessageComposer id={id}/>}</>}
    {tab === "timeline" && <TimelineView/>}
    {tab === "conversation" && <ConversationView id={id}/>}
    {tab === "questions" && <QuestionsCard id={id} questions={questions} terminal={closed}/>}
    {tab === "context" && <ContextView id={id} terminal={closed}/>}
    {tab === "usage" && <UsageView id={id} legacyUsage={state.usage} budgets={deliveryCapabilities.value?.config?.budgets}/>}
    {tab === "artifacts" && <section class="work-brief"><h2>Evidence & handoff</h2>{artifacts.length ? artifacts.map((entry) => <button class="artifact-row" onClick={() => openArtifact(entry.path)} key={entry.path}><Icon name="file"/><span>{entry.path}</span><small>{Math.ceil(entry.size / 1024)} KB</small><Icon name="arrow" size={15}/></button>) : <p class="quiet-empty">No evidence recorded yet.</p>}<details class="technical-details"><summary>Session reference</summary><code>{id}</code>{state.driver?.rawTranscript && <pre>{pretty(JSON.stringify(state.driver.rawTranscript))}</pre>}</details></section>}
    {artifact && <Modal title={artifact.name} onClose={closeArtifact}><div class="artifact-viewer">{artifactError ? <div class="inline-error">{artifactError}</div> : <pre><code>{artifact.lang === "json" ? pretty(artifact.content) : artifact.content}</code></pre>}</div></Modal>}
    {configOpen && <ConfigDialog id={id} packet={packet} state={state} onClose={() => setConfigOpen(false)}/>}
    {abortOpen && <AbortDialog id={id} onClose={() => setAbortOpen(false)}/>}
    {cancelOpen && <CancelSessionDialog id={id} label={packet.item.id || packet.item.text} onClose={() => setCancelOpen(false)} onDone={() => loadDeliverySession(id)}/>}
  </div>;
}

/**
 * Confirms then posts `decision:"cancel"`, which the runner accepts from ANY
 * non-terminal state (state-machine.mjs NON_TERMINAL_STATES) and applies
 * immediately — even mid-phase and even while paused (DW-16) — rather than
 * only at the next gate. Shared between the session header and the
 * SessionsList quick action so both places behave identically.
 */
export function CancelSessionDialog({id,label,onClose,onDone}){
  const [busy,setBusy]=useState(false);
  const cancel=async()=>{setBusy(true);try{await deliveryPost("decision",{id,gate:null,decision:"cancel",note:null},"Session cancelled");onClose();if(onDone)await onDone();}finally{setBusy(false);}};
  return <Modal title="Cancel this delivery?" onClose={onClose}>
    <p class="verdict-block">This immediately aborts the whole delivery session{label?<> for <strong>{label}</strong></>:""} — takes effect right away, even if it's currently paused or blocked, and even if the runner isn't alive. The session moves to <strong>CANCELLED</strong> and cannot be resumed or retried. Artifacts, transcript, and history stay on disk for review.</p>
    <button class="button" onClick={cancel} disabled={busy} style={{marginTop:12,borderColor:"var(--era-danger,#e05252)",color:"var(--era-danger,#e05252)"}}>{busy?"Cancelling…":"Cancel session"}</button>
  </Modal>;
}

function AbortDialog({id,onClose}){
  const [busy,setBusy]=useState(false);
  const abort=async()=>{setBusy(true);try{await deliveryPost("control",{id,type:"pause",payload:{abortInFlight:true}},"Abort requested — stopping the in-flight turn now");onClose();await loadDeliverySession(id);}finally{setBusy(false);}};
  return <Modal title="Abort in-flight turn?" onClose={onClose}>
    <p class="verdict-block">This immediately stops the turn that's currently running. <strong>Its response is lost outright</strong> — it is not saved as a completed turn and cannot be resumed. The workspace is <strong>not</strong> rolled back: if this was a Building turn, files it already changed stay changed. Check the diff (or run validation) before retrying. The session pauses and the phase is left blocked, awaiting a retry decision.</p>
    <p class="muted">If no turn is currently running, this has no effect beyond queuing a pause.</p>
    <button class="button" onClick={abort} disabled={busy} style={{marginTop:12,borderColor:"var(--era-danger,#e05252)",color:"var(--era-danger,#e05252)"}}>{busy?"Aborting…":"Abort now"}</button>
  </Modal>;
}

function QuestionsCard({id,questions,terminal}){
  const [askText,setAskText]=useState("");const [answering,setAnswering]=useState(null);const [answerText,setAnswerText]=useState("");
  if(!questions)return null;
  const {blocking=[],advisory=[],answered=[]}=questions;
  const ask=async()=>{if(!askText.trim())return;await deliveryPost("control",{id,type:"ask",payload:{text:askText.trim()}},"Question added to the record");setAskText("");await loadDeliveryQuestions(id);};
  const submitAnswer=async(questionId)=>{if(!answerText.trim())return;await deliveryPost("control",{id,type:"answer",payload:{questionId,text:answerText.trim()}},"Answer recorded");setAnswering(null);setAnswerText("");await loadDeliveryQuestions(id);};
  return <section class="card" style={{marginTop:18}}><h2>Questions &amp; Answers</h2>
    {blocking.length>0&&<><div class="eyebrow" style={{color:"var(--era-danger,#e05252)"}}>Blocking — answer via the gate above</div><ul>{blocking.map((q)=><li key={q.id}>{q.text}</li>)}</ul></>}
    {advisory.length>0&&<><div class="eyebrow" style={{marginTop:blocking.length?10:0}}>Advisory</div>{advisory.map((q)=><div class="event" key={q.id}><div>{q.text}</div>{answering===q.id?<div class="field" style={{marginTop:4}}><textarea rows="2" value={answerText} onInput={(event)=>setAnswerText(event.currentTarget.value)}/><div class="chip-row" style={{marginTop:4}}><button class="button primary" onClick={()=>submitAnswer(q.id)}>Submit</button><button class="button ghost" onClick={()=>setAnswering(null)}>Cancel</button></div></div>:<button class="button" style={{marginTop:4}} onClick={()=>{setAnswering(q.id);setAnswerText("");}}>Answer</button>}</div>)}</>}
    {blocking.length===0&&advisory.length===0&&<div class="empty">No open questions.</div>}
    {answered.length>0&&<details style={{marginTop:10}}><summary class="muted" style={{cursor:"pointer",fontSize:12}}>{answered.length} answered</summary>{answered.map((q)=><div key={q.id} class="event"><div class="muted" style={{fontSize:11}}>Q: {q.text}</div><div style={{fontSize:12}}>A: {q.answer?.text}</div></div>)}</details>}
    {!terminal&&<div class="field" style={{marginTop:10}}><label>Ask a question (for the record)</label><textarea rows="2" value={askText} onInput={(event)=>setAskText(event.currentTarget.value)}/><button class="button" style={{marginTop:4}} onClick={ask}>Ask</button></div>}
  </section>;
}

function ConfigDialog({id,packet,state,onClose}){
  const currentProvider=state.execution?.provider||packet.agent;
  const [provider,setProvider]=useState(currentProvider);
  const providerCaps=deliveryCapabilities.value?.providers?.[provider];
  const models=providerCaps?.models||[];
  const currentModel=provider===currentProvider?(state.execution?.model||packet.agentConfig?.model||""):"";
  const currentEffort=provider===currentProvider?(state.execution?.effortByPhase||packet.agentConfig?.effort||{}):{};
  const [model,setModel]=useState(currentModel);const [effort,setEffort]=useState({...currentEffort});const [switchConfirm,setSwitchConfirm]=useState("");
  const efforts=providerCaps?.efforts||providerCaps?.manifest?.efforts||[];
  const isProviderSwitch=provider!==currentProvider;
  const cacheCold=isProviderSwitch||model!==currentModel;
  const switchProvider=(next)=>{setProvider(next);setModel("");setEffort({});setSwitchConfirm("");};
  const apply=async()=>{
    const payload={};
    if(isProviderSwitch)payload.provider=provider;
    if(model!==currentModel)payload.model=model||null;
    const changedEffort=Object.fromEntries(Object.entries(effort).filter(([phase,value])=>value&&value!==currentEffort[phase]));
    if(Object.keys(changedEffort).length)payload.effortByPhase=changedEffort;
    if(!Object.keys(payload).length){onClose();return;}
    await deliveryPost("control",{id,type:"set-config",payload},isProviderSwitch?"Provider switch queued — verification runs at the next boundary":"Config change queued for the next turn boundary");
    onClose();
  };
  return <Modal title="Change model / provider / effort" onClose={onClose}>
    <p class="muted">Applies at the next turn boundary — an in-flight turn always finishes first.</p>
    <div class="field"><label>Provider</label><div class="chip-row">{["claude","codex"].map((p)=><button key={p} class={`button ${provider===p?"primary":""}`} onClick={()=>switchProvider(p)}>{p}</button>)}</div></div>
    {isProviderSwitch&&<div class="verdict-block" style={{marginTop:8}}>
      <strong>Switching provider ({currentProvider} → {provider}).</strong> Transfers: decisions, requirements, constraints, Q&A, artifacts (by path). Does NOT transfer: the {currentProvider} session/thread or its prompt cache — the next turn is a full-price, uncached verification turn on {provider}. If it finds gaps, the session pauses on a blocking question instead of continuing silently.
      <div class="field" style={{marginTop:8}}><label>Type SWITCH to confirm</label><input value={switchConfirm} onInput={(event)=>setSwitchConfirm(event.currentTarget.value)} placeholder="SWITCH"/></div>
    </div>}
    {models.length>0&&<div class="field"><label>Model</label><select value={model} onChange={(event)=>setModel(event.currentTarget.value)}><option value="">Default{providerCaps?.defaultModel?` (${providerCaps.defaultModel})`:""}</option>{models.map((m)=><option key={m.id} value={m.id}>{m.label||m.id}</option>)}</select></div>}
    {efforts.length>0&&<div class="field"><label>Effort per phase</label><div class="chip-row">{EFFORT_PHASES.map((phase)=><label key={phase} style={{display:"flex",flexDirection:"column",gap:2,fontSize:10}}><span class="muted">{phase}</span><select value={effort[phase]||""} onChange={(event)=>setEffort({...effort,[phase]:event.currentTarget.value||undefined})}><option value="">{isProviderSwitch?"translate automatically":"unchanged"}</option>{efforts.map((e)=><option key={e} value={e}>{e}</option>)}</select></label>)}</div></div>}
    {cacheCold&&!isProviderSwitch&&<p class="verdict-block" style={{marginTop:8}}>Changing the model invalidates the provider's prompt cache — the next turn re-sends its full context uncached.</p>}
    <button class="button primary button-submit" onClick={apply} disabled={isProviderSwitch&&switchConfirm!=="SWITCH"} style={{marginTop:12}}>{isProviderSwitch?"Switch provider":"Apply"}</button>
  </Modal>;
}

// Slice C/A: BLOCKED reasons that mean "don't just mash Retry" — each maps to
// a heading + a note shown above the generic lastError.message. Unlisted /
// absent reasons (the original plain "Session is blocked" case) render
// nothing extra, so existing sessions blocked before these reasons existed
// are unaffected.
const BLOCKED_REASON_INFO = {
  "budget-exhausted": { heading: "Paused — authorized budget exhausted", note: "The in-flight turn finished and its usage/artifacts were saved. A finish package is available under artifacts/finish/. Raise the packet envelope with an audited reason to resume, or cancel the session." },
  "quota-paused": { heading: "Paused: provider quota or authentication needs attention", note: "The provider reported an allowance, spend-limit, or authentication failure. Automatic retries are disabled. Resolve the provider issue, add a reason below, then Resume; the runner will establish a fresh preflight session." },
  "provider-quota": { heading: "Blocked — provider allowance exhausted", note: "The provider (Claude/Codex) reported a session limit or rate limit — retrying immediately will very likely fail the same way. Wait for the reset time in the message below, then Retry." },
  "budget-exceeded": { heading: "Blocked — session budget exceeded", note: "This session's token/cost usage crossed the cap configured in .delivery/config.json (budgets). Raise the cap there if this session genuinely needs more, then Retry — or Cancel if the spend looks runaway." },
  "phase-turn-limit": { heading: "Blocked — phase turn limit reached", note: "A single phase has run more turns than budgets.maxTurnsPerPhase allows without converging — each further turn should be treated as diminishing returns. Add owner guidance below, or raise the limit, before retrying." },
  "pre-existing-failure": { heading: "Blocked — pre-existing validation failure", note: "Validation failed on something that was already broken before this session started (the workspace was dirty at launch). This session made zero fix-loop attempts on it. Fix it outside this delivery, then Retry." },
  "runner-crash": { heading: "Blocked — runner hit an unexpected error", note: "The runner caught an unexpected internal error and parked the session instead of dying. The message below says what failed; the full stack is in the session's runner.log (shown in the Runner panel when the runner is offline). Retry re-runs the phase it happened in." },
};

// Shown whenever the runner process is not alive on a non-terminal session —
// the one situation that used to read as "stuck with no explanation". Names
// the last recorded error and shows the runner.log tail (the process's stderr
// + any crash stack) so the cause is on screen, not only on disk.
function RunnerOfflinePanel({id,state,runner}){
  const resume=()=>deliveryPost("resume",{id},"Resume requested").then(()=>loadDeliverySession(id));
  return <section class="card" style={{marginTop:18,borderColor:"var(--era-danger,#e05252)"}}>
    <div class="eyebrow" style={{color:"var(--era-danger,#e05252)"}}>Runner offline</div>
    <h2>The runner process for this session is not running</h2>
    <p class="muted">Last heartbeat: {runner.heartbeatAt?new Date(runner.heartbeatAt).toLocaleString():"never"}. The session is parked exactly where it stopped — nothing is lost, but no work happens until it's resumed.</p>
    {state.lastError?.message&&<p class="verdict-block" style={{borderColor:"var(--era-danger,#e05252)"}}>{state.lastError.message}</p>}
    {runner.logTail&&<details open={!state.lastError}><summary class="muted" style={{cursor:"pointer",fontSize:12}}>runner.log (tail)</summary><pre style={{maxHeight:260,overflow:"auto",fontSize:11,whiteSpace:"pre-wrap"}}><code>{runner.logTail}</code></pre></details>}
    {!state.lastError&&!runner.logTail&&<p class="verdict-block">No error was recorded — the process likely exited or the machine restarted. Resume to continue from the last persisted state.</p>}
    <button class="button primary" style={{marginTop:12}} onClick={resume}>Resume runner</button>
  </section>;
}

function GatePanel({id,state,openArtifact}){
  const gate=state.awaiting.gate;const reason=state.awaiting.reason;const reasonInfo=reason&&BLOCKED_REASON_INFO[reason];const [note,setNote]=useState("");const [confirmText,setConfirmText]=useState("");const [answer,setAnswer]=useState("");const [tick,setTick]=useState(true);const [busy,setBusy]=useState(false);

  // DLV-73: on INSTANT the merged turn produces spec AND plan together, so the
  // two gates fire back-to-back over one artifact with nothing running between
  // them. `extras` carries the one-click affordances that collapse the dead
  // second interaction without collapsing the recorded decisions.
  const lanePolicy=deliverySession.value?.packet?.lanePolicy||{};
  const canApproveBoth=gate==="spec"&&lanePolicy.lane==="INSTANT"&&lanePolicy.mergedDiscoveryPlan===true;
  const canAcceptProposal=gate==="question"&&state.awaiting.proposalReady===true;
  const decide=async(decision,extras={})=>{if(busy)return;setBusy(true);try{const body={id,gate,decision,note:note||null,...extras};if(gate==="plan"&&decision==="approve")body.confirmText=confirmText;if(gate==="spec"&&extras.alsoApprovePlan&&confirmText)body.confirmText=confirmText;if(gate==="uat"&&decision==="accept")body.tickCheckbox=tick;if(gate==="question")body.answer=answer;await deliveryPost("decision",body);await loadDeliverySession(id);}catch{/* shared API error notification */}finally{setBusy(false);}};
  if(gate==="budget")return <BudgetRaisePanel id={id} state={state}/>;
  return <section class="card" style={{marginTop:18,borderColor:"var(--era-border-active)"}}><div class="eyebrow">Needs your review</div><h2>{reasonInfo?reasonInfo.heading:reason==="retry-exhausted"?"Decision needed: automatic retries exhausted":gateLabel(gate)}</h2>{gate==="question"&&state.awaiting.questions&&<ul>{state.awaiting.questions.map((question)=><li key={question.id || question.text}>{question.text}</li>)}</ul>}{reasonInfo&&<p class="verdict-block" style={{borderColor:"var(--era-danger,#e05252)"}}>{reasonInfo.note}</p>}{gate==="blocked"&&state.lastError?.resetsAt&&<p class="muted">Provider reset: {state.lastError.resetsAt}</p>}{gate==="blocked"&&<p class="verdict-block">{state.lastError?.message||"Session is blocked."}</p>}{["spec","plan","uat"].includes(gate)&&<button class="button" onClick={()=>openArtifact(gateArtifact[gate])}>Open {gateArtifact[gate]}</button>}{gate==="plan"&&<div class="field"><label>Typed approval when risk-flagged</label><input value={confirmText} onInput={(event)=>setConfirmText(event.currentTarget.value)} placeholder="APPROVE"/></div>}{gate==="question"&&<div class="field"><label>{reason==="retry-exhausted"?"Next-step decision (required)":"Answer"}</label><textarea value={answer} onInput={(event)=>setAnswer(event.currentTarget.value)}/></div>}{(["spec","plan","uat"].includes(gate)||gate==="blocked")&&<div class="field"><label>{gate==="blocked"?"Reason for retry / resume (required)":"Owner note / requested change"}</label><textarea value={note} onInput={(event)=>setNote(event.currentTarget.value)}/></div>}{gate==="uat"&&<label class="button"><input type="checkbox" checked={tick} onChange={(event)=>setTick(event.currentTarget.checked)}/>Tick source checkbox on accept</label>}<fieldset disabled={busy} class="chip-row gate-actions" style={{marginTop:12}}>{canApproveBoth&&<><button class="button primary" onClick={()=>decide("approve",{alsoApprovePlan:true})} title="Records both the spec and the plan approval — one artifact, one review, two audited decisions">Approve spec + plan</button><button class="button" onClick={()=>decide("approve")} title="Approve the spec only and review the plan separately">Approve spec only</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{!canApproveBoth&&["spec","plan"].includes(gate)&&<><button class="button primary" onClick={()=>decide("approve")}>Approve</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{gate==="uat"&&<><button class="button primary" onClick={()=>decide("accept")}>Accept</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{canAcceptProposal&&<><button class="button primary" onClick={()=>decide("answer",{acceptProposal:true})} title="Answer the question and approve the spec+plan the turn already produced — no second discovery turn">Answer + approve proposal</button><button class="button" onClick={()=>decide("answer")}>Answer + revise</button></>}{gate==="question"&&!canAcceptProposal&&<button class="button primary" onClick={()=>decide("answer")}>Submit answer</button>}{gate==="blocked"&&<button class="button primary" onClick={()=>decide("retry")}>{reason==="quota-paused"?"Resume with preflight":"Retry"}</button>}{gate==="shipped"&&<button class="button primary" onClick={()=>decide("shipped")}>Mark shipped</button>}</fieldset></section>;
}

function BudgetRaisePanel({id,state}){
  const envelope=state.budget?.current||deliverySession.value?.packet?.budget||{};
  const [maxTokens,setMaxTokens]=useState(typeof envelope.maxTokens==="number"?String(envelope.maxTokens):"");
  const [maxUsd,setMaxUsd]=useState(typeof envelope.maxUsd==="number"?String(envelope.maxUsd):"");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const changed=(envelope.maxTokens!=null&&Number(maxTokens)>envelope.maxTokens)||(envelope.maxUsd!=null&&Number(maxUsd)>envelope.maxUsd);
  const raise=async()=>{setBusy(true);try{await deliveryPost("control",{id,type:"set-budget",payload:{maxTokens:maxTokens===""?undefined:Number(maxTokens),maxUsd:maxUsd===""?undefined:Number(maxUsd),reason:reason.trim()}},"Budget raise recorded");await loadDeliverySession(id);}finally{setBusy(false);}};
  return <section class="card" style={{marginTop:18,borderColor:"var(--era-amber,#e0a852)"}}><div class="eyebrow">Governed pause</div><h2>Authorized budget exhausted</h2><p class="verdict-block">The completed turn and its artifacts are safe. The finish package is under <code>artifacts/finish/</code>. Raising the cap is permanent and audited; lowering it is intentionally forbidden.</p><div class="chip-row"><label class="field" style={{flex:"1 1 160px"}}><span>New max tokens</span><input type="text" inputMode="decimal" value={maxTokens} disabled={envelope.maxTokens==null} onInput={(event)=>setMaxTokens(event.currentTarget.value)}/></label><label class="field" style={{flex:"1 1 130px"}}><span>New max USD</span><input type="text" inputMode="decimal" value={maxUsd} disabled={envelope.maxUsd==null} onInput={(event)=>setMaxUsd(event.currentTarget.value)}/></label></div><div class="field"><label>Reason for additional authorization</label><textarea value={reason} onInput={(event)=>setReason(event.currentTarget.value)} placeholder="Why this session needs more budget"/></div><button class="button primary" onClick={raise} disabled={busy||!changed||!reason.trim()}>{busy?"Recordingâ€¦":"Raise budget and resume"}</button></section>;
}

function MessageComposer({id}){const [text,setText]=useState("");const send=async()=>{if(!text.trim())return;await deliveryPost("message",{id,text:text.trim()},"Message queued for the next boundary");setText("");};return <section class="card" style={{marginTop:18}}><h2>Guide this run</h2><div class="field"><textarea rows="4" value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="Add guidance for the next step"/></div><button class="button" onClick={send}>Send</button></section>;}

function pretty(text){try{return JSON.stringify(JSON.parse(text),null,2);}catch{return text;}}
