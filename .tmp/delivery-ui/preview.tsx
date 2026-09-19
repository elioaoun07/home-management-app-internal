import React from "react";
import { createRoot } from "react-dom/client";
import { CommandCenter } from "../../scripts/pm/app/CommandCenter";
import { setTransport, type Transport } from "../../scripts/pm/app/transport";
import { deliveryReviewFixture } from "../../tests/pm-ui/fixtures/delivery-review";
import "../../scripts/pm/app/brand.css";
import "../../scripts/pm/app/styles.css";
import "../../scripts/pm/app/delivery.css";
import "../../scripts/pm/app/responsive.css";
const detail = deliveryReviewFixture();
detail.candidate!.changed[0].review = {state:"available",beforeHash:"sha256:fixture-before",afterHash:"sha256:fixture-after",diff:'--- a/scripts/pm/app/Work.tsx\n+++ b/scripts/pm/app/Work.tsx\n@@ -72,1 +72,1 @@\n- href={`#${spacePath(campaign)}?view=story`}\n+ href={`#${spacePath(campaign)}?tab=story`}'};
const scenario = new URLSearchParams(location.search).get("scenario");
if (scenario === "plan") { detail.run.lifecycle = "WAITING"; detail.run.closed_outcome = null; detail.plans[0].status = "proposed"; detail.candidate = null; detail.candidates = []; detail.applications = []; detail.ownerAction = {kind: "plan", label: "Review plan"}; detail.stage.current = 0; }
if (scenario === "applied") detail.applications![0].state = "applied";
if (scenario === "checks") { detail.ownerAction = {kind: "review-result", label: "Review checks"}; detail.evidence = detail.evidence.filter(e => e.state !== "satisfied"); detail.run.lifecycle = "WAITING"; }
if (scenario === "long") { detail.plans[0].body.steps = Array.from({length:30},(_,i)=>({title:`Step ${i+1}. ${"A detailed implementation step with an acceptance boundary. ".repeat(16)}`})); }
if (scenario === "revisions") { detail.run.lifecycle="WAITING"; detail.run.closed_outcome=null; detail.applications=[]; detail.plans.push({...detail.plans[0],plan_id:"plan-second",revision:2,status:"proposed",body:{...detail.plans[0].body,outcome:"Revised plan for review"}}); }
const calls: unknown[]=[];
Object.assign(window, {uat: {detail,calls}});
const snapshot = {generatedAt: new Date().toISOString(), files:[{relPath:"Delivery/4 - Checklist.md",raw:"# Delivery\n\n## Now\n\n- [ ] **DLV-107** Open completed items in campaign history _(friction - S)_\n\n## Next\n\n## Later\n"},{relPath:"Delivery/Delivery — Master Book.md",raw:"# Delivery\n\n## Purpose & ownership\nDeliver useful changes.\n\n## Acceptance Criteria Index\n\n### DLV-107\n\n**Outcome:** Open campaign history.\n\n## Shipped Log\n"}]};
setTransport({
 capabilities:{kind:"local",planWrites:false,capture:false,v1Launch:false,v1Detail:false,v2:true,pairing:false,apply:true,referenceTools:false},
 start:()=>()=>{},subscribe:()=>()=>{},connection:()=>({online:true,bridge:{state:"local",seenAt:null},lastAck:{at:null,state:null},worker:{state:"ready",detail:null},stale:false,savedAt:null}),
 snapshot:async()=>snapshot,v1Runs:async()=>({sessions:[]}),dispatchMode:async()=>({mode:"v2"}),
 v2Session:async()=>({paired:true}),v2Runs:async()=>({runs:[]}),v2Run:async()=>detail,v2Queue:async()=>null,v2Assess:async()=>null,
 v2Executors:async()=>({executors:[],refusals:[]}),v2SessionHref:()=>null,
 v2Command:async(path,body)=>{calls.push({path,body}); if(body.action==="rollback-preview")return {ok:true,application_id:"app-preview",revision:3,digest:"preview-digest",operations:[{path:"scripts/pm/app/Work.tsx",action:"restore"}],conflicts:[]}; return {ok:true};},
} as Transport);
if(!location.hash) location.hash="/delivery/run/r-uat-preview";
createRoot(document.getElementById("app")!).render(<CommandCenter/>);
