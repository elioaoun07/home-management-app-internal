import { useEffect, useState } from "preact/hooks";
import { route } from "../../app/router.js";
import { showToast } from "../../app/store.js";
import { apiGet } from "../../app/api.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Breadcrumbs } from "../nav/Breadcrumbs.jsx";
import { ContextView } from "./ContextView.jsx";
import { ConversationView } from "./ConversationView.jsx";
import { TimelineView } from "./TimelineView.jsx";
import { UsageView } from "./UsageView.jsx";
import { deliveryCapabilities, deliveryPost, deliveryQuestions, deliverySession, loadDeliveryCapabilities, loadDeliveryQuestions, loadDeliverySession } from "./deliveryStore.js";

const steps=["SELECTED","DISCOVERY","SPEC_READY","PLAN_READY","BUILDING","VALIDATING","REVIEWING","UAT_READY","ACCEPTED","SHIPPED"];
const terminal=new Set(["SHIPPED","CANCELLED","FAILED"]);
const gateArtifact={spec:"spec.md",plan:"plan.md",uat:"uat/summary.md"};
const EFFORT_PHASES=["discovery","plan","building","review"];
const TABS=["overview","timeline","conversation","questions","context","usage","artifacts"];
const TAB_LABEL={overview:"Overview",timeline:"Timeline",conversation:"Conversation",context:"Context",usage:"Usage",artifacts:"Artifacts"};

export function SessionDetail(){
  const id=route.value.id;const [artifact,setArtifact]=useState(null);const [artifactError,setArtifactError]=useState("");const [configOpen,setConfigOpen]=useState(false);const [abortOpen,setAbortOpen]=useState(false);const [cancelOpen,setCancelOpen]=useState(false);const [tab,setTab]=useState("overview");
  useEffect(()=>{loadDeliverySession(id,{reset:true}).catch((error)=>showToast(error.message,{type:"error"}));loadDeliveryCapabilities();loadDeliveryQuestions(id);const requested=route.value.query.get("tab");setTab(TABS.includes(requested)?requested:"overview");},[id]);
  const detail=deliverySession.value;if(!detail)return <div class="empty">Loading session…</div>;
  const {packet,state,artifacts,runner}=detail;const current=steps.indexOf(state.state);const usage=state.usage?.total||{};
  const openArtifact=async(path)=>{setArtifact({name:path,content:"Loading…"});setArtifactError("");try{setArtifact(await apiGet(`/api/delivery/artifact?id=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`));}catch(error){setArtifactError(error.message);}};
  const paused=!!state.execution?.paused;
  const togglePause=async()=>{await deliveryPost("control",{id,type:paused?"resume-run":"pause",payload:{}},paused?"Resume requested":"Pause requested — takes effect after the current turn");await loadDeliverySession(id);};
  const questions=deliveryQuestions.value;const openCount=(questions?.blocking?.length||0)+(questions?.advisory?.length||0);
  const fork=async()=>{await deliveryPost("control",{id,type:"fork",payload:{}},"Fork queued — a new session branches at the next boundary and this one pauses");await loadDeliverySession(id);};
  const currentProvider=state.execution?.provider||packet.agent;
  const supportsAbort=!!deliveryCapabilities.value?.providers?.[currentProvider]?.manifest?.supportsAbort;
  return <><Breadcrumbs items={[{label:"Delivery",href:"/delivery"},{label:id}]}/><header class="page-head" style={{marginTop:18}}><div><div class="eyebrow">{packet.item.campaign} · {packet.agent}{state.execution?.model?` · ${state.execution.model}`:""}</div><h1>{packet.item.id?`${packet.item.id} — `:""}{packet.item.text}</h1>{(packet.parentSession||state.forks?.length)&&<div class="chip-row" style={{marginTop:4}}>{packet.parentSession&&<a class="nav-link" href={`#/delivery/session/${packet.parentSession}`}>← forked from {packet.parentSession}</a>}{state.forks?.map((forkId)=><a class="nav-link" href={`#/delivery/session/${forkId}`}>→ fork {forkId}</a>)}</div>}<div class="chip-row"><Chip>{state.state}</Chip><Chip>{runner.alive?"runner alive":"runner stale"}</Chip>{paused&&<Chip tone="blocker">paused</Chip>}<Chip>{(usage.input||0)+(usage.output||0)} tok</Chip>{openCount>0&&<Chip tone={questions.blocking.length?"blocker":""}>Questions: {openCount} open{questions.blocking.length?` · ${questions.blocking.length} blocking`:""}</Chip>}{!runner.alive&&!terminal.has(state.state)&&<button class="button" onClick={()=>deliveryPost("resume",{id},"Resume requested").then(()=>loadDeliverySession(id))}>Resume runner</button>}{!terminal.has(state.state)&&<button class="button" onClick={togglePause}>{paused?"Resume run":"Pause"}</button>}{!terminal.has(state.state)&&!paused&&supportsAbort&&<button class="button" onClick={()=>setAbortOpen(true)} title="Immediately stop a turn that's currently running">Abort turn…</button>}{!terminal.has(state.state)&&<button class="button" onClick={()=>setConfigOpen(true)}>Change model…</button>}{!terminal.has(state.state)&&<button class="button" onClick={fork} title="Branch a new independent session from here; this one pauses">Fork</button>}{!terminal.has(state.state)&&<button class="button" onClick={()=>setCancelOpen(true)} title="Abort the whole delivery session — takes effect immediately, even if paused or blocked" style={{color:"var(--era-danger,#e05252)"}}>Cancel session</button>}</div></div></header>
    <div class="stepper">{steps.map((step,index)=><div class={`step-node ${index<current?"done":index===current?"current":""}`}>{step}</div>)}</div>
    {!runner.alive&&!terminal.has(state.state)&&<RunnerOfflinePanel id={id} state={state} runner={runner}/>}
    {state.awaiting&&<GatePanel id={id} state={state} openArtifact={openArtifact}/>}
    <div class="delivery-tabs" style={{marginTop:18}}>{TABS.map((t)=><button class={`button ${tab===t?"primary":""}`} onClick={()=>setTab(t)}>{t==="questions"?`Q&A${openCount?` (${openCount})`:""}`:TAB_LABEL[t]}</button>)}</div>
    {tab==="overview"&&<div class="delivery-grid" style={{marginTop:12}}><div>{!terminal.has(state.state)&&<MessageComposer id={id}/>}</div><aside><UsageMeter usage={state.usage} budgets={deliveryCapabilities.value?.config?.budgets}/></aside></div>}
    {tab==="timeline"&&<div style={{marginTop:12}}><TimelineView/></div>}
    {tab==="conversation"&&<div style={{marginTop:12}}><ConversationView id={id}/></div>}
    {tab==="questions"&&<div style={{marginTop:12}}><QuestionsCard id={id} questions={questions} terminal={terminal.has(state.state)}/></div>}
    {tab==="context"&&<div style={{marginTop:12}}><ContextView id={id} terminal={terminal.has(state.state)}/></div>}
    {tab==="usage"&&<div style={{marginTop:12}}><UsageView id={id} legacyUsage={state.usage} budgets={deliveryCapabilities.value?.config?.budgets}/></div>}
    {tab==="artifacts"&&<div style={{marginTop:12}}><section class="card"><h2>Artifacts</h2>{artifacts.length?artifacts.map((entry)=><button class="nav-link" onClick={()=>openArtifact(entry.path)}>{entry.path}<span class="count">{entry.size} B</span></button>):<div class="empty">No artifacts yet.</div>}</section></div>}
    {artifact&&<div class="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setArtifact(null)}><section class="modal artifact-viewer" style={{width:"min(1000px,96vw)"}}><div class="page-head"><h2>{artifact.name}</h2><button class="icon-button" onClick={()=>setArtifact(null)}>×</button></div>{artifactError?<div class="empty">{artifactError}</div>:<pre><code>{artifact.lang==="json"?pretty(artifact.content):artifact.content}</code></pre>}</section></div>}
    {configOpen&&<ConfigDialog id={id} packet={packet} state={state} onClose={()=>setConfigOpen(false)}/>}
    {abortOpen&&<AbortDialog id={id} onClose={()=>setAbortOpen(false)}/>}
    {cancelOpen&&<CancelSessionDialog id={id} label={packet.item.id||packet.item.text} onClose={()=>setCancelOpen(false)} onDone={()=>loadDeliverySession(id)}/>}</>;
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
    {blocking.length>0&&<><div class="eyebrow" style={{color:"var(--era-danger,#e05252)"}}>Blocking — answer via the gate above</div><ul>{blocking.map((q)=><li>{q.text}</li>)}</ul></>}
    {advisory.length>0&&<><div class="eyebrow" style={{marginTop:blocking.length?10:0}}>Advisory</div>{advisory.map((q)=><div class="event" key={q.id}><div>{q.text}</div>{answering===q.id?<div class="field" style={{marginTop:4}}><textarea rows="2" value={answerText} onInput={(event)=>setAnswerText(event.currentTarget.value)}/><div class="chip-row" style={{marginTop:4}}><button class="button primary" onClick={()=>submitAnswer(q.id)}>Submit</button><button class="button ghost" onClick={()=>setAnswering(null)}>Cancel</button></div></div>:<button class="button" style={{marginTop:4}} onClick={()=>{setAnswering(q.id);setAnswerText("");}}>Answer</button>}</div>)}</>}
    {blocking.length===0&&advisory.length===0&&<div class="empty">No open questions.</div>}
    {answered.length>0&&<details style={{marginTop:10}}><summary class="muted" style={{cursor:"pointer",fontSize:12}}>{answered.length} answered</summary>{answered.map((q)=><div class="event"><div class="muted" style={{fontSize:11}}>Q: {q.text}</div><div style={{fontSize:12}}>A: {q.answer?.text}</div></div>)}</details>}
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
    <div class="field"><label>Provider</label><div class="chip-row">{["claude","codex"].map((p)=><button class={`button ${provider===p?"primary":""}`} onClick={()=>switchProvider(p)}>{p}</button>)}</div></div>
    {isProviderSwitch&&<div class="verdict-block" style={{marginTop:8}}>
      <strong>Switching provider ({currentProvider} → {provider}).</strong> Transfers: decisions, requirements, constraints, Q&A, artifacts (by path). Does NOT transfer: the {currentProvider} session/thread or its prompt cache — the next turn is a full-price, uncached verification turn on {provider}. If it finds gaps, the session pauses on a blocking question instead of continuing silently.
      <div class="field" style={{marginTop:8}}><label>Type SWITCH to confirm</label><input value={switchConfirm} onInput={(event)=>setSwitchConfirm(event.currentTarget.value)} placeholder="SWITCH"/></div>
    </div>}
    {models.length>0&&<div class="field"><label>Model</label><select value={model} onChange={(event)=>setModel(event.currentTarget.value)}><option value="">Default{providerCaps?.defaultModel?` (${providerCaps.defaultModel})`:""}</option>{models.map((m)=><option value={m.id}>{m.label||m.id}</option>)}</select></div>}
    {efforts.length>0&&<div class="field"><label>Effort per phase</label><div class="chip-row">{EFFORT_PHASES.map((phase)=><label style={{display:"flex",flexDirection:"column",gap:2,fontSize:10}}><span class="muted">{phase}</span><select value={effort[phase]||""} onChange={(event)=>setEffort({...effort,[phase]:event.currentTarget.value||undefined})}><option value="">{isProviderSwitch?"translate automatically":"unchanged"}</option>{efforts.map((e)=><option value={e}>{e}</option>)}</select></label>)}</div></div>}
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
  const gate=state.awaiting.gate;const reason=state.awaiting.reason;const reasonInfo=reason&&BLOCKED_REASON_INFO[reason];const [note,setNote]=useState("");const [confirmText,setConfirmText]=useState("");const [answer,setAnswer]=useState("");const [tick,setTick]=useState(true);
  useEffect(()=>{if(gateArtifact[gate])openArtifact(gateArtifact[gate]);},[gate]);
  const decide=async(decision)=>{const body={id,gate,decision,note:note||null};if(gate==="plan"&&decision==="approve")body.confirmText=confirmText;if(gate==="uat"&&decision==="accept")body.tickCheckbox=tick;if(gate==="question")body.answer=answer;await deliveryPost("decision",body,"Decision recorded");await loadDeliverySession(id);};
  return <section class="card" style={{marginTop:18,borderColor:"var(--era-border-active)"}}><div class="eyebrow">Owner gate</div><h2>{gate==="blocked"&&reasonInfo?reasonInfo.heading:gate}</h2>{gate==="question"&&state.awaiting.questions&&<ul>{state.awaiting.questions.map((question)=><li>{question.text}</li>)}</ul>}{gate==="blocked"&&reasonInfo&&<p class="verdict-block" style={{borderColor:"var(--era-danger,#e05252)"}}>{reasonInfo.note}</p>}{gate==="blocked"&&<p class="verdict-block">{state.lastError?.message||"Session is blocked."}</p>}{["spec","plan","uat"].includes(gate)&&<button class="button" onClick={()=>openArtifact(gateArtifact[gate])}>Open {gateArtifact[gate]}</button>}{gate==="plan"&&<div class="field"><label>Typed approval when risk-flagged</label><input value={confirmText} onInput={(event)=>setConfirmText(event.currentTarget.value)} placeholder="APPROVE"/></div>}{gate==="question"&&<div class="field"><label>Answer</label><textarea value={answer} onInput={(event)=>setAnswer(event.currentTarget.value)}/></div>}{["spec","plan","uat"].includes(gate)&&<div class="field"><label>Owner note / requested change</label><textarea value={note} onInput={(event)=>setNote(event.currentTarget.value)}/></div>}{gate==="uat"&&<label class="button"><input type="checkbox" checked={tick} onChange={(event)=>setTick(event.currentTarget.checked)}/>Tick source checkbox on accept</label>}<div class="chip-row gate-actions" style={{marginTop:12}}>{["spec","plan"].includes(gate)&&<><button class="button primary" onClick={()=>decide("approve")}>Approve</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{gate==="uat"&&<><button class="button primary" onClick={()=>decide("accept")}>Accept</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{gate==="question"&&<button class="button primary" onClick={()=>decide("answer")}>Submit answer</button>}{gate==="blocked"&&<button class="button primary" onClick={()=>decide("retry")}>Retry</button>}{gate==="shipped"&&<button class="button primary" onClick={()=>decide("shipped")}>Mark shipped</button>}</div></section>;
}

function MessageComposer({id}){const [text,setText]=useState("");const send=async()=>{if(!text.trim())return;await deliveryPost("message",{id,text:text.trim()},"Message queued for the next boundary");setText("");};return <section class="card" style={{marginTop:18}}><h2>Message the orchestrator</h2><div class="field"><textarea rows="4" value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="Guidance is read at the next step boundary."/></div><button class="button" onClick={send}>Queue message</button></section>;}

// Slice C: processed tokens = input + cachedInput + output — the same total
// checked against budgets.{warn,max}SessionTokens in budgets.mjs, so this bar
// reads the same number that can trip a BLOCKED(budget-exceeded) gate.
function UsageMeter({usage={},budgets={}}){
  const phases=Object.entries(usage.perPhase||{});
  const total=usage.total||{};
  const processedTokens=(total.input||0)+(total.cachedInput||0)+(total.output||0);
  const maxTokens=budgets?.maxSessionTokens;const warnTokens=budgets?.warnSessionTokens;
  const pct=typeof maxTokens==="number"&&maxTokens>0?Math.min(1,processedTokens/maxTokens):null;
  const over=typeof maxTokens==="number"&&processedTokens>=maxTokens;
  const warn=!over&&typeof warnTokens==="number"&&processedTokens>=warnTokens;
  const barColor=over?"var(--era-danger,#e05252)":warn?"var(--era-amber,#e0a852)":"var(--era-accent,#4a9eff)";
  return <section class="card" style={{marginTop:18}}><h2>Usage</h2><div class="stat-value">{processedTokens}</div><div class="muted">total processed tokens (input+cached+output)</div>
    {pct!=null&&<div style={{marginTop:8}}>
      <div style={{height:6,borderRadius:3,background:"var(--era-border,#333)",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(pct*100)}%`,background:barColor}}/></div>
      <div class="muted" style={{fontSize:11,marginTop:4}}>{processedTokens.toLocaleString()} / {maxTokens.toLocaleString()} session budget{typeof total.costUsd==="number"?` · est. $${total.costUsd.toFixed(2)}`:""}</div>
      {over&&<div style={{fontSize:11,color:"var(--era-danger,#e05252)",marginTop:2}}>Over budget — further turns will be blocked</div>}
      {warn&&<div style={{fontSize:11,color:"var(--era-amber,#e0a852)",marginTop:2}}>Approaching the session budget</div>}
    </div>}
    {phases.length>0&&<table class="usage-table"><thead><tr><th>Phase</th><th>Input</th><th>Output</th></tr></thead><tbody>{phases.map(([phase,row])=><tr><td>{phase}</td><td>{row.input||0}</td><td>{row.output||0}</td></tr>)}</tbody></table>}
  </section>;
}
function pretty(text){try{return JSON.stringify(JSON.parse(text),null,2);}catch{return text;}}

