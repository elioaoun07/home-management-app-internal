import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJourney } from '../scripts/delivery-v2/journey.mjs';
import { openStore } from '../scripts/delivery-v2/store.mjs';
import { policyTemplate } from '../scripts/delivery-v2/policy.mjs';
const root=mkdtempSync(join(tmpdir(),'era-review-recovery-'));let store;
try {
 const pmRel='pm', row='- [ ] **BUD-14** emits 20 _(friction - S)_';
 mkdirSync(join(root,pmRel,'Budget'),{recursive:true});mkdirSync(join(root,'.delivery','v2'),{recursive:true});
 writeFileSync(join(root,pmRel,'Budget','4 - Checklist.md'),'# Budget\n\n## Now\n\n'+row+'\n');
 writeFileSync(join(root,pmRel,'Budget','Budget \u2014 Master Book.md'),'# Budget\n\n## Acceptance Criteria Index\n\n### BUD-14\n\n- **Acceptance:** emit 20.\n');
 const base=policyTemplate({executor:'claude',authorized_by:'fixture-owner'});
 writeFileSync(join(root,'.delivery','v2','execution-policy.json'),JSON.stringify({...base,executors:{...base.executors,permitted:['claude'],catalog:{revision:1,models:{claude:[{id:'claude-test',efforts:['low']}]},profiles:{}}},scratchScope:{kind:'snapshot',include:[]},publicationScope:{allowedPaths:['src'],changeConstraints:{}},criteria:[],checks:{specs:{},inputs:[]}}));
 store=openStore({path:join(root,'fixture.sqlite')});let sdkCalls=0;
 const runtime={kind:'fake',workspaceFor:({access})=>({root:'/work',backing:'fake',access}),binding:async(backend_id)=>({backend_id,sdk_version:'fixture',boundary_digest:'sha256:fake',battery_digest:'sha256:fake'}),provision:async()=>({base_manifest:[],refusals:[],importSdk:async()=>({query:({options})=>(async function*(){sdkCalls++;yield {type:'system',subtype:'init',model:'claude-test',session_id:options.resume||options.sessionId};const result=JSON.stringify({outcome:'emit 20',scope:['src/a.ts'],steps:['edit'],risks:[],unknowns:[],checks:[],questions:[]});yield {type:'result',subtype:'success',is_error:false,result,total_cost_usd:0.01,usage:{input_tokens:1,output_tokens:1}};})()})}),release:async()=>{throw new Error('fixture crash after persisted output, before plan creation');},recover:async()=>null};
 const describe=async(backend_id)=>({ok:true,refusal:null,profile:{profile_id:'p-'+backend_id,backend_id,qualified:true,qualification_ref:'qr-fixture',unverifiedControls:[],controls:['filesystem.outsideScratchWrite','filesystem.hostSecretRead','store.workerAccess'].map(id=>({id,verified:true,state:'supported'})),resources:{strictBound:false,strictBoundRefusalReason:'fixture'}}});
 const args={root,pmRel,store:()=>store,runtime,describe,generationsRoot:join(root,'data','generations'),applicationsRoot:join(root,'data','applications'),stagingRoot:join(root,'data','staging')};
 const first=createJourney(args), result=await first.deliver({file:'Budget/4 - Checklist.md',cbidx:0,expectLine:row,expectId:'BUD-14',executor:'claude',model:'claude-test',effort:'low',command_id:'fixture-first',actor:'owner'});await first.idle();
 console.log('launch',JSON.stringify(result));
 const summary=()=>({run:store.getRun(result.run_id).lifecycle,reason:store.getRun(result.run_id).waiting_reason,jobs:store.listJobs(result.run_id).map(j=>({status:j.status,outcome:j.outcome})),plans:store.listPlans(result.run_id).length,sdkCalls});
 if(result.ok){console.log('before restart',JSON.stringify(summary()));runtime.release=async()=>{};const second=createJourney(args);console.log('reconcile',JSON.stringify(await second.reconcile()));await second.idle();console.log('after restart',JSON.stringify(summary()));}
} finally {store?.close();rmSync(root,{recursive:true,force:true});}
