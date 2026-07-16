import { useEffect, useState } from "preact/hooks";
import { route } from "../../app/router.js";
import { showToast } from "../../app/store.js";
import { apiGet } from "../../app/api.js";
import { Chip, EmptyState, Modal } from "../../components/Primitives.jsx";
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
  const id=route.value.id;const [artifact,setArtifact]=useState(null);const [artifactError,setArtifactError]=useState("");const [configOpen,setConfigOpen]=useState(false);const [abortOpen,setAbortOpen]=useState(false);const [tab,setTab]=useState("overview");
  useEffect(()=>{loadDeliverySession(id,{reset:true}).catch((error)=>showToast(error.message,{type:"error"}));loadDeliveryCapabilities();loadDeliveryQuestions(id);setTab("overview");},[id]);
  const detail=deliverySession.value;if(!detail)return <div class="empty">Loading session…</div>;
  const {packet,state,artifacts,runner}=detail;const current=steps.indexOf(state.state);const usage=state.usage?.total||{};
  const openArtifact=async(path)=>{setArtifact({name:path,content:"Loading…"});setArtifactError("");try{setArtifact(await apiGet(`/api/delivery/artifact?id=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`));}catch(error){setArtifactError(error.message);}};
  const paused=!!state.execution?.paused;
  const togglePause=async()=>{await deliveryPost("control",{id,type:paused?"resume-run":"pause",payload:{}},paused?"Resume requested":"Pause requested — takes effect after the current turn");await loadDeliverySession(id);};
  const questions=deliveryQuestions.value;const openCount=(questions?.blocking?.length||0)+(questions?.advisory?.length||0);
  const fork=async()=>{await deliveryPost("control",{id,type:"fork",payload:{}},"Fork queued — a new session branches at the next boundary and this one pauses");await loadDeliverySession(id);};
  const currentProvider=state.execution?.provider||packet.agent;
  const supportsAbort=!!deliveryCapabilities.value?.providers?.[currentProvider]?.manifest?.supportsAbort;
  return <><Breadcrumbs items={[{label:"Delivery",href:"/delivery"},{label:id}]}/><header class="page-head" style={{marginTop:18}}><div><div class="eyebrow">{packet.item.campaign} · {packet.agent}{state.execution?.model?` · ${state.execution.model}`:""}</div><h1>{packet.item.id?`${packet.item.id} — `:""}{packet.item.text}</h1>{(packet.parentSession||state.forks?.length)&&<div class="chip-row" style={{marginTop:4}}>{packet.parentSession&&<a class="nav-link" href={`#/delivery/session/${packet.parentSession}`}>← forked from {packet.parentSession}</a>}{state.forks?.map((forkId)=><a class="nav-link" href={`#/delivery/session/${forkId}`}>→ fork {forkId}</a>)}</div>}<div class="chip-row"><Chip>{state.state}</Chip><Chip>{runner.alive?"runner alive":"runner stale"}</Chip>{paused&&<Chip tone="blocker">paused</Chip>}<Chip>{(usage.input||0)+(usage.output||0)} tok</Chip>{openCount>0&&<Chip tone={questions.blocking.length?"blocker":""}>Questions: {openCount} open{questions.blocking.length?` · ${questions.blocking.length} blocking`:""}</Chip>}{!runner.alive&&!terminal.has(state.state)&&<button class="button" onClick={()=>deliveryPost("resume",{id},"Resume requested").then(()=>loadDeliverySession(id))}>Resume runner</button>}{!terminal.has(state.state)&&<button class="button" onClick={togglePause}>{paused?"Resume run":"Pause"}</button>}{!terminal.has(state.state)&&!paused&&supportsAbort&&<button class="button" onClick={()=>setAbortOpen(true)} title="Immediately stop a turn that's currently running">Abort turn…</button>}{!terminal.has(state.state)&&<button class="button" onClick={()=>setConfigOpen(true)}>Change model…</button>}{!terminal.has(state.state)&&<button class="button" onClick={fork} title="Branch a new independent session from here; this one pauses">Fork</button>}</div></div></header>
    <div class="stepper">{steps.map((step,index)=><div class={`step-node ${index<current?"done":index===current?"current":""}`}>{step}</div>)}</div>
    {state.awaiting&&<GatePanel id={id} state={state} openArtifact={openArtifact}/>}
    <div class="delivery-tabs" style={{marginTop:18}}>{TABS.map((t)=><button class={`button ${tab===t?"primary":""}`} onClick={()=>setTab(t)}>{t==="questions"?`Q&A${openCount?` (${openCount})`:""}`:TAB_LABEL[t]}</button>)}</div>
    {tab==="overview"&&<div class="delivery-grid" style={{marginTop:12}}><div>{!terminal.has(state.state)&&<MessageComposer id={id}/>}</div><aside><UsageMeter usage={state.usage}/></aside></div>}
    {tab==="timeline"&&<div style={{marginTop:12}}><TimelineView/></div>}
    {tab==="conversation"&&<div style={{marginTop:12}}><ConversationView id={id}/></div>}
    {tab==="questions"&&<div style={{marginTop:12}}><QuestionsCard id={id} questions={questions} terminal={terminal.has(state.state)}/></div>}
    {tab==="context"&&<div style={{marginTop:12}}><ContextView id={id} terminal={terminal.has(state.state)}/></div>}
    {tab==="usage"&&<div style={{marginTop:12}}><UsageView id={id} legacyUsage={state.usage}/></div>}
    {tab==="artifacts"&&<div style={{marginTop:12}}><section class="card"><h2>Artifacts</h2>{artifacts.length?artifacts.map((entry)=><button class="nav-link" onClick={()=>openArtifact(entry.path)}>{entry.path}<span class="count">{entry.size} B</span></button>):<div class="empty">No artifacts yet.</div>}</section></div>}
    {artifact&&<div class="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setArtifact(null)}><section class="modal artifact-viewer" style={{width:"min(1000px,96vw)"}}><div class="page-head"><h2>{artifact.name}</h2><button class="icon-button" onClick={()=>setArtifact(null)}>×</button></div>{artifactError?<div class="empty">{artifactError}</div>:<pre><code>{artifact.lang==="json"?pretty(artifact.content):artifact.content}</code></pre>}</section></div>}
    {configOpen&&<ConfigDialog id={id} packet={packet} state={state} onClose={()=>setConfigOpen(false)}/>}
    {abortOpen&&<AbortDialog id={id} onClose={()=>setAbortOpen(false)}/>}</>;
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
    <button class="button primary" onClick={apply} disabled={isProviderSwitch&&switchConfirm!=="SWITCH"} style={{marginTop:12}}>{isProviderSwitch?"Switch provider":"Apply"}</button>
  </Modal>;
}

function GatePanel({id,state,openArtifact}){
  const gate=state.awaiting.gate;const [note,setNote]=useState("");const [confirmText,setConfirmText]=useState("");const [answer,setAnswer]=useState("");const [tick,setTick]=useState(true);
  useEffect(()=>{if(gateArtifact[gate])openArtifact(gateArtifact[gate]);},[gate]);
  const decide=async(decision)=>{const body={id,gate,decision,note:note||null};if(gate==="plan"&&decision==="approve")body.confirmText=confirmText;if(gate==="uat"&&decision==="accept")body.tickCheckbox=tick;if(gate==="question")body.answer=answer;await deliveryPost("decision",body,"Decision recorded");await loadDeliverySession(id);};
  return <section class="card" style={{marginTop:18,borderColor:"var(--era-border-active)"}}><div class="eyebrow">Owner gate</div><h2>{gate}</h2>{gate==="question"&&state.awaiting.questions&&<ul>{state.awaiting.questions.map((question)=><li>{question.text}</li>)}</ul>}{gate==="blocked"&&<p class="verdict-block">{state.lastError?.message||"Session is blocked."}</p>}{["spec","plan","uat"].includes(gate)&&<button class="button" onClick={()=>openArtifact(gateArtifact[gate])}>Open {gateArtifact[gate]}</button>}{gate==="plan"&&<div class="field"><label>Typed approval when risk-flagged</label><input value={confirmText} onInput={(event)=>setConfirmText(event.currentTarget.value)} placeholder="APPROVE"/></div>}{gate==="question"&&<div class="field"><label>Answer</label><textarea value={answer} onInput={(event)=>setAnswer(event.currentTarget.value)}/></div>}{["spec","plan","uat"].includes(gate)&&<div class="field"><label>Owner note / requested change</label><textarea value={note} onInput={(event)=>setNote(event.currentTarget.value)}/></div>}{gate==="uat"&&<label class="button"><input type="checkbox" checked={tick} onChange={(event)=>setTick(event.currentTarget.checked)}/>Tick source checkbox on accept</label>}<div class="chip-row" style={{marginTop:12}}>{["spec","plan"].includes(gate)&&<><button class="button primary" onClick={()=>decide("approve")}>Approve</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{gate==="uat"&&<><button class="button primary" onClick={()=>decide("accept")}>Accept</button><button class="button" onClick={()=>decide("reject")}>Request changes</button></>}{gate==="question"&&<button class="button primary" onClick={()=>decide("answer")}>Submit answer</button>}{gate==="blocked"&&<button class="button primary" onClick={()=>decide("retry")}>Retry</button>}{gate==="shipped"&&<button class="button primary" onClick={()=>decide("shipped")}>Mark shipped</button>}<button class="button ghost" onClick={()=>deliveryPost("decision",{id,gate,decision:"cancel",note},"Session cancelled").then(()=>loadDeliverySession(id))}>Cancel session</button></div></section>;
}

function MessageComposer({id}){const [text,setText]=useState("");const send=async()=>{if(!text.trim())return;await deliveryPost("message",{id,text:text.trim()},"Message queued for the next boundary");setText("");};return <section class="card" style={{marginTop:18}}><h2>Message the orchestrator</h2><div class="field"><textarea rows="4" value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="Guidance is read at the next step boundary."/></div><button class="button" onClick={send}>Queue message</button></section>;}

function UsageMeter({usage={}}){const phases=Object.entries(usage.perPhase||{});return <section class="card" style={{marginTop:18}}><h2>Usage</h2><div class="stat-value">{(usage.total?.input||0)+(usage.total?.output||0)}</div><div class="muted">total tokens</div>{phases.length>0&&<table class="usage-table"><thead><tr><th>Phase</th><th>Input</th><th>Output</th></tr></thead><tbody>{phases.map(([phase,row])=><tr><td>{phase}</td><td>{row.input||0}</td><td>{row.output||0}</td></tr>)}</tbody></table>}</section>;}
function pretty(text){try{return JSON.stringify(JSON.parse(text),null,2);}catch{return text;}}

