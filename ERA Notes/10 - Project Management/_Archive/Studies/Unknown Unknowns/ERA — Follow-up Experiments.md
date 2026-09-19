---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# ERA — Follow-up Experiments

These experiments test the [main findings](<ERA — Unknown Unknowns.md>) with the smallest useful witnesses. Each separates what was **executed during this study** from what remains **proposed**. They are not implementation packets or authority to access production.

All executed source probes used synthetic inputs and in-memory mocks. TypeScript was transpiled in memory with the installed `typescript` package; no source or test file was written. Supabase, Google Calendar, template telemetry and other effect boundaries were replaced before the relevant modules executed. No application server, provider client, DB, push sender or replay worker was started. These probes establish code behavior under the specified inputs, not production incidence or complete UI behavior.

Initial source baseline: `83e44be98a96ef836de029b1113cb27100932368`; final HEAD `60f1af97e86b043cbbd0f859323651a1c25f6d97` contains no intervening `src/` or `migrations/` changes. All three embedded probes were rerun from this document at final verification. Run the snippets from the repository root in PowerShell. They read local source/artifacts and print synthetic output. No package installation is required.

## X1 — Does teaching preserve the referent?

**Hypothesis.** A successful confirmed proposal with a canonical title absent verbatim from the user's phrase can teach a fixed phrase that later dispatches against another focused reminder.

**Evidence required.** Original utterance and validated proposal slots; actual learned pattern; focus state at replay; real routed intent; arguments arriving at the resolver boundary. An AI answer or a match count is not sufficient evidence.

**Method — executed.** Use `bin the dentist reminder`, validated slots `{itemId: "dentist-id", title: "Dentist visit"}`, and the real `reminder.delete` entity-reference contract. Change focus to `Call bank` before routing the stored template. Execute the actual learner, all face routers, template matcher, capability registry/schema and dispatcher. Replace only the store and effect/formatting boundaries. No live teaching, deletion or model call occurs.

Reproduction:

```powershell
@'
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
global.fetch=()=>{throw Error('NETWORK FORBIDDEN')};
const calls=[],state={activeFaceKey:'budget',templates:[],focusEntities:[
  {id:'bank-id',title:'Call bank',type:'reminder',addedAt:Date.now()}
]};
const cache=new Map();
function load(file){
  file=path.resolve(file);
  if(!path.extname(file)){
    file=[file+'.ts',file+'.tsx',path.join(file,'index.ts')].find(fs.existsSync);
    if(!file)throw Error('Cannot resolve source');
  }
  const key=file.replaceAll('\\','/');
  if(key.endsWith('/useEraStore.ts'))return {useEraStore:{getState:()=>state}};
  if(key.includes('/intents/resolvers/'))return new Proxy({}, {
    get:(_,name)=>(...args)=>{
      calls.push({resolver:String(name),args});
      return Promise.resolve({text:'synthetic result',ok:true});
    }
  });
  if(key.endsWith('/templates/useEraTemplates.ts'))return {bumpTemplateMatch:()=>{}};
  if(key.endsWith('/replyFormatter.ts'))return {formatReply:()=>''};
  if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const req=id=>id.startsWith('@/')?load('src/'+id.slice(2)):
    id.startsWith('.')?load(path.resolve(path.dirname(file),id)):
    ['zod','date-fns','chrono-node','rrule'].includes(id)?require(id):
    (()=>{throw Error('Unapproved dependency '+id)})();
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  vm.runInThisContext('(function(require,module,exports){'+js+'\n})',
    {filename:file})(req,mod,mod.exports);
  return mod.exports;
}
(async()=>{
  const {learnTemplateFromProposal}=load('src/features/era/templates/learn.ts');
  const {rootIntentRouter}=load('src/features/era/intents/index.ts');
  const {resolveIntent}=load('src/features/era/intents/resolveIntent.ts');
  const raw='bin the dentist reminder';
  const lesson=learnTemplateFromProposal(raw,
    {itemId:'dentist-id',title:'Dentist visit'},{entityRefSlot:'itemId'});
  console.log('without template',JSON.stringify(rootIntentRouter.parse(raw)));
  console.log('learned',JSON.stringify(lesson));
  state.templates=[{id:'template-fixture',capabilityId:'reminder.delete',
    ...lesson,enabled:true}];
  const intent=rootIntentRouter.parse(raw);
  console.log('with template',JSON.stringify(intent));
  await resolveIntent(intent);
  console.log('effect-boundary receipt',JSON.stringify(calls));
})().catch(e=>{console.error(e);process.exitCode=1});
'@ | node
```

**Observed receipt:**

```text
without template: switchFace(schedule)
learned: {patternText:"bin the dentist reminder", slotNames:[]}
with template: capabilityAction(reminder.delete, itemId:"bank-id", title:"Call bank")
effect boundary: resolveReminderDelete("bank-id", "Call bank")
```

**Pass/fail interpretation.** The semantic-preservation property fails at dispatch. The proposition “shared Zod validation rules this out” is falsified. A live deletion was neither attempted nor necessary. Proposal generation/confirmation is represented by the supplied already-validated slots; its canonical-title substitution and learning call are separately source-traced in the main report.

**Smallest remaining experiment — proposed.** Add four corpus cases in an isolated harness: exact title, paraphrased title, genuine pronoun, and no usable focus. Then vary only whether the phrase actually names an entity. Ask which cases must preserve the name, which deliberately follow focus and which should not be learned. If all unsafe cases can be refused cheaply, no richer compiler is justified. If the owner has an already-exported, sanitized template list, classify it offline to estimate current exposure; do not fetch live rows.

**Decision changed.** Whether automatic learning should be narrowed or whether a small explicit reference representation is necessary. Improving success telemetry alone cannot answer it.

## X2 — Are online and offline captures equivalent?

**Hypothesis.** The same supported draft reminder input generates different effects depending on the online branch versus API replay.

**Evidence required.** Identical input; actual offline queued body; table/operation/payload receipts from both implementations; returned status. Compare effects after normalizing generated IDs and inconsequential undefined/null fields.

**Method — executed.** Transpile [useItems.ts](<../../../../../src/features/items/useItems.ts>) and [items/route.ts](<../../../../../src/app/api/items/route.ts>) in memory. Mock `useMutation` to return its options, `useQueryClient` with an inert client, and `supabaseBrowser`/`supabaseServer` with one synthetic authenticated owner. A thenable `.from().insert().select().single()` recorder returns successful inserts and `synthetic-item` for the item. Mock `addToQueue` to capture its argument, Google Calendar calls to no-ops, and network calls to throw.

Invoke `useCreateReminder().mutationFn(input)` once with `isReallyOnline() === true`. Reset write receipts, change the flag to false, invoke the same mutation, and pass **the captured queued body** to the actual route's `POST({json: async () => queued.body})`. This executes the online mutation function and the API handler; it does not execute the queue's durable storage or the sync engine.

```json
{
  "title": "Unconfirmed fixture",
  "status": "draft",
  "due_at": "2026-09-07T09:00:00.000Z"
}
```

**Observed receipt:**

| Path | Successful write requests | Result |
|---|---|---|
| Online hook | `items`, `reminder_details` | Item returned |
| Same input → queued body → API | `items`, `reminder_details`, `item_alerts` | 201 |

Extra API alert payload:

```json
{
  "item_id": "synthetic-item",
  "kind": "absolute",
  "trigger_at": "2026-09-07T09:00:00.000Z",
  "channel": "push",
  "active": true
}
```

The caller is not hypothetical: [BulkConvertReviewSheet](<../../../../../src/components/hub/BulkConvertReviewSheet.tsx>), lines 310–319, passes draft/pending status and due time to this hook.

**Pass/fail interpretation.** Source-level attempted effects differ. This falsifies unconditional transport equivalence even with successful dependencies. It does not prove a push will fire: current DB rules and cron selection could neutralize the extra row. An isolated DB reproduction with known synthetic schema could settle normalization; a live DB query is not part of this experiment.

**Smallest remaining experiment — proposed.** Extend only to nearby supported forms: draft/pending × explicit/automatic alert. Then, if needed, run the same relative-alert input in isolated client/server timezone configurations and compare normalized `trigger_at`. The timezone extension was **not executed**, so its outcome is unknown. Do not combine this with recurrence expansion or a queue rewrite.

**Decision changed.** Whether an existing path should delegate to another, whether a shared domain rule is needed, or whether authoritative normalization already makes them equivalent. Agree on desired effects before choosing which implementation should win.

## X3 — Does an inverse survive account maintenance?

**Hypothesis.** Reversing a transaction after its account type changes can apply the same sign twice. Current account type is a hidden input to historical reversal.

**Evidence required.** Actual delta function; source proof that metadata changes are accepted and deletion reads current type; one unchanged-type control and one changed-type case. Current production admission requires separate evidence.

**Method — executed.** Execute the real pure helper in memory:

```powershell
@'
const fs=require('fs'),vm=require('vm'),ts=require('typescript');
const js=ts.transpileModule(
  fs.readFileSync('src/lib/balance-utils.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS}}
).outputText;
const m={exports:{}};
vm.runInThisContext('(function(exports){'+js+'\n})')(m.exports);
const d=m.exports.getBalanceDelta;
console.log(JSON.stringify({
  unchangedType:100+d(10,'expense',false,'create')+d(10,'expense',false,'delete'),
  changedType:100+d(10,'expense',false,'create')+d(10,'income',false,'delete')
}));
'@ | node
```

**Observed receipt:** `{"unchangedType":100,"changedType":80}`.

**Pass/fail interpretation.** Same-input inverse arithmetic passes; the lifecycle inverse with mutable type fails. [Account PATCH](<../../../../../src/app/api/accounts/[id]/route.ts>), lines 11–18 and 49–77, accepts the type change. [Transaction DELETE](<../../../../../src/app/api/transactions/[id]/route.ts>), lines 355–405, uses current type. The complete DB lifecycle was not executed and a DB prohibition/compensating mechanism could make the changed-type scenario unreachable.

**Smallest remaining experiment — proposed.** First settle owner intent for a populated account: is type/denomination allowed to change? If no, use an isolated route/DB contract to prove refusal. If yes, require one worked conversion or correction with expected old transaction display, current native balance, USD projection and reversal. Use a synthetic account and supplied schema only. A currency/rate change must be tested separately from type; the arithmetic above does not claim to reproduce denomination conversion.

**Decision changed.** Whether immutability is sufficient, a narrow correction is needed, or historical interpretation must be retained. Do not infer the need for a ledger rewrite from a ten-unit fixture.

## X4 — Can the same pair resolve to different households?

**Hypothesis.** With two active links for the same two people, actual consumers disagree even before considering RLS; replacing a link can also change the history partition independently of membership.

**Evidence required.** Identical link fixture for all consumers, query operator behavior, returned household/partner/history identities, and a reversed fixture order to expose unordered selection. Do not substitute a larger household for the actual two-person design.

**Method — executed.** Transpile the actual GET handlers for memories, meal plans and Hub threads, plus `getActiveHouseholdPartnerId` and `usePartnerId`. Inject synthetic auth user A and the same in-memory Supabase query builder into each. The builder implements equality, ordering, limit and awaitable results; `maybeSingle()` returns null data plus a `PGRST116`-shaped error for multiple rows. This models the client result contract, not PostgreSQL, RLS or physical DB order.

Fixture:

```text
H-old: owner A, partner B, active true, created 2026-01-01
H-new: owner A, partner B, active true, created 2026-09-01
old-memory / old-meal: household_id H-old
new-memory / new-meal: household_id H-new
```

**Observed receipt:**

| Fixture row order | Memories GET | Meals GET | Hub threads GET | Hub partner hook | Budget partner helper |
|---|---|---|---|---|---|
| H-old, H-new | new-memory | old-meal | `threads: [], household_id: null` | null | B |
| H-new, H-old | new-memory | new-meal | `threads: [], household_id: null` | null | B |

Sources and exact selector lines are collected in [Finding 4](<ERA — Unknown Unknowns.md>). The notification union was source-traced, not executed. All rows refer to A/B; no unauthorized third person is needed for this result.

**Pass/fail interpretation.** Consumer equivalence fails under this fixture. Current production multiplicity is **UNVERIFIED**. The historical relinking entry establishes why the state deserves consideration, not that it exists today. A current verified invariant that prevents it would reduce urgency. An invariant of unique active membership alone still needs a preservation rule if a new link ID can replace an old one.

**Smallest remaining experiment — proposed.** With owner-provided existing evidence or an isolated schema, establish whether two active rows are possible. Separately deactivate H-old and create/reuse H-new for A/B in the fixture, then specify which old memories/meals must remain accessible. Compare preserving the original link ID with deliberately starting a new epoch. Do not run onboarding, claiming or repair scripts against production.

**Decision changed.** Whether to enforce one stable container, define epochs or merely document a guaranteed lifecycle. Choosing “newest everywhere” is insufficient if older link-owned history should survive.

## X5 — Does the implementation graph identify source entities correctly?

**Hypothesis.** Some graph identities alias independent concrete functions, producing misleading topology; at least one claimed cross-module call was wrong even at extraction time.

**Evidence required.** Node IDs, source-qualified containment edges, historical imports at the graph's commit, and a distinction between candidate collisions and individually verified examples.

**Method — executed.** Analyze the committed JSON without regenerating it. Normalize separators and missing `src/` prefixes before counting; otherwise a path-format difference could be mistaken for two files. Respect `_src`/`_tgt`, which preserve original direction in the graph's undirected representation.

```powershell
@'
import json, collections, pathlib, subprocess
g=json.loads(pathlib.Path('graphify-out/graph.json').read_text(encoding='utf-8'))
nodes={n['id']:n for n in g['nodes']}
parents=collections.defaultdict(set)
for e in g['links']:
    target=e.get('_tgt',e['target'])
    p=e.get('source_file','').replace('\\','/')
    if p.startswith(('app/','lib/')): p='src/'+p
    if e.get('relation')=='contains' and nodes.get(target,{}).get('label','').endswith('()'):
        parents[target].add(p)
collisions={n:p for n,p in parents.items() if len(p)>1}
print('nodes',len(nodes),'links',len(g['links']),'multi_source_functions',len(collisions))
for k in ['id_route_patch','id_route_delete','history_route_get']:
    print(k,'distinct_paths',len(parents[k]),'node_path',nodes[k]['source_file'])
s=subprocess.check_output(
    ['git','show','ae876a5:src/app/recurring/page.tsx'],text=True,encoding='utf-8')
print('historical format import',[(i+1,l.strip()) for i,l in enumerate(s.splitlines())
    if l.strip()=='format,' or 'from "date-fns"' in l])
print('historical WebEvents reference','WebEvents' in s)
'@ | python -
```

**Observed receipt:** 3,656 nodes; 4,338 links; 18 multi-source function-node candidates. `id_route_patch`: 20 paths, node points to Trips. `id_route_delete`: 20 paths, node points to Trips. `history_route_get`: three paths, node points to NFC history. Historical Recurring imports `format` at line 58 from `date-fns` at line 66; no `WebEvents` reference. The audited graph edge targets `web_webevents_format`, confidence INFERRED 0.8.

**Pass/fail interpretation.** Source-level identity/topology trust fails for these examples. This does not establish that all graph edges are wrong, that the 18 candidates have identical causes, or that the installed extractor still has the defect. The report's explicit warning to verify inferred edges is real counter-evidence; it does not make merged concrete route-handler identities safe.

**Smallest remaining experiment — proposed.** In a disposable, synthetic corpus outside the product source, create two route files each exporting PATCH, a shared library exporting `format`, and two consumers importing that function. If a future graph generation is worth its cost, check that it produces distinct route-handler nodes and one correctly identified library function, not consumer-local call-site functions. Include full relative path and export identity in the expected answer. No model/provider run was performed here.

**Decision changed.** Whether graph generation earns a mandatory role, remains optional navigation or should be removed from the boot protocol. Do not commission a graph rebuild merely because an audit found a defect.

## X6 — Disconfirmation receipts: allegations rejected during the study

These are completed checks, not extra findings or proposed work.

### Queue patch loss

**Initial hypothesis:** two partial updates to one endpoint replace one another and lose the first patch. **Evidence required:** actual retained operations, not the replacement comment. **Method executed:** run the real [offlineQueue](<../../../../../src/lib/offlineQueue.ts>) in its memory fallback, enqueue a title patch and then a priority patch for the same endpoint, inspect pending bodies. **Result:** both patches remained.

The caller supplies the endpoint as a lookup target at lines 113–125, but `findPendingOperation`, lines 430–440, compares that argument with `body.id`/`tempId`. The simple endpoint-only overwrite theory therefore did not hold for the fixture. **Interpretation:** reject this allegation. This is not proof of durable storage, all replacement shapes, idempotency or correct patch ordering; earlier E-09 findings remain intact. **Decision changed:** no new queue-loss finding or cleanup task.

### PM authentication bypass

**Initial hypothesis:** the root `proxy.ts` displaced `src/middleware.ts`, bypassing the PM login gate. **Evidence required:** actual framework discovery and the local build's selected matchers. **Method executed:** inspect installed Next build discovery (`node_modules/next/dist/build/index.js`, around lines 569–575), the [middleware](<../../../../../src/middleware.ts>), and **only the middleware matchers** in the local build artifact. **Result:** build discovery derives its root from `src/app`; the local artifact contains `/pm`, `/pm.html` and `/pm/live` matchers from the guarded middleware.

**Interpretation:** reject the filename-based bypass theory. This does not certify the currently deployed build or all PM authorization behavior. Never print the full build manifest: unrelated build metadata can contain sensitive values and is unnecessary evidence. **Decision changed:** no unauthenticated-publication allegation. The study did not rebuild the PM dashboard or publish its new documents.

## Stop conditions for further study

The useful stopping point is a disproved assumption or a precise owner/domain decision. A failed synthetic equivalence property does not authorize a rewrite. A verified invariant that excludes the witness may justify no implementation. An unknown deployment fact remains unknown until suitable owner-provided evidence exists; this study does not query production to resolve it.

The highest-value next evidence is X1's small teaching corpus and X2's nearby effect comparison. X3/X4 should first settle lifecycle intent and admissible states. X5 already supports demoting this particular graph; rebuilding it is optional. No experiment here allocates a roadmap item.
