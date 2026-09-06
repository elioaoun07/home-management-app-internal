---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
---

# ERA — Unknown Unknowns

ERA's reliability work has concentrated on whether an operation happened. This study found a separate problem: **what an operation means can change without changing its apparent identity.** A learned sentence can acquire a different target; connectivity can select different business rules; an account setting can change an old transaction's inverse; and the same two people can resolve to different households in different modules. Even the implementation graph merges unrelated functions under one identity.

These are five findings, not five proposed projects. The common question is: **which parts of an action's meaning must remain fixed, and which may be resolved again from current context?** Better persistence, atomicity, validation and models remain valuable, but none independently answers that question.

Companion documents: [Hidden Assumptions](<ERA — Hidden Assumptions.md>), [Questions Nobody Asked](<ERA — Questions Nobody Asked.md>), [Follow-up Experiments](<ERA — Follow-up Experiments.md>).

## Scope, evidence and novelty

This follows the [session contract](../../../docs/ASTRA-UNKOWN-UNKOWNS-STUDY.md). Orientation preceded deliverable writing: repository rules and playbooks; Feature Map and Design Doctrine; active Master Plan, portfolio, contradiction and coverage records; Top Layer, Command Center and campaign ASTRA work; and the newer, uncommitted Proactive ERA study. Investigation then followed implementation, tests, historical source and local artifacts across assistant learning, Budget, Schedule, household sharing, Kitchen, offline transport and PM tooling. This was broad orientation followed by selective deep tracing, **not a claim to have inspected every source line or exercised every module**.

Initial source baseline: `83e44be98a96ef836de029b1113cb27100932368`. Read-only `git diff --stat 3106164..HEAD -- src migrations` returned no differences, so the earlier ASTRA source cutoff was still useful. During the study HEAD advanced externally to `60f1af97e86b043cbbd0f859323651a1c25f6d97` (`Proactive`). The final comparison confirmed no intervening `src/` or `migrations/` changes; the newly committed Proactive documents and campaign changes were already included as uncommitted prior evidence during orientation. A new uncommitted-files reporting script is unrelated to these witnesses. Existing work was preserved. Three parallel research tasks were attempted but stopped at a service usage limit; no independent completed review is claimed. The findings below were traced and challenged in this session.

**Observed fact** means current source/artifact content or execution with synthetic inputs. **Inference** means a conclusion drawn from it. **Hypothesis** needs another observation. **Recommendation** is a proposed response. Source line references describe this baseline. **UNVERIFIED:** current production rows, policies, triggers, DB functions, deployed builds, actual template populations and notification delivery. No production DB query, application-provider call, app mutation, git write or application-code change was performed by this study.

The novelty exclusions matter:

| Earlier work | Already established; not claimed as new | What this study adds |
|---|---|---|
| [Top Layer Architecture](<../Top Layer/Top Layer — ASTRA Architecture.md>) and [Packets](<../Top Layer/Top Layer — ASTRA Packets.md>), E-11 | Successful-looking replies and template counts can hide failures | A genuinely successful original action can teach a different, well-typed future action |
| Same, E-09; [Schedule ASTRA Book](<../Schedule/ASTRA/Schedule — ASTRA Book.md>) | Queue durability, replay identity, partial writes and unsupported recurrence | Successful online and replayed execution of the same supported input produce different effects |
| [Budget ASTRA Book](<../Budget/ASTRA/Budget — ASTRA Book.md>), F1–F6 | Mutable balance races, confirmation/restore gaps and inconsistent projections | An ordinary account metadata change alters the inverse even with perfect serialization |
| [Schedule Master Book](<../Schedule/Schedule — Master Book.md>), June 21 shipped entry | Multiple active household links broke one notification lookup | Different modules implement incompatible household-selection rules and different continuity units |
| [Proactive Intelligence Model](<../Proactive ERA/Proactive ERA — Intelligence Model.md>) and [Architectural Leverage](<../Proactive ERA/Proactive ERA — Architectural Leverage.md>) | Model confidence cannot certify physical truth; evidence must retain scope and validity | Structured references themselves can lose meaning during learning, transport or later metadata edits |
| [Command Center Architecture](<../Command Center/Command Center — ASTRA Architecture.md>) | Wrong row identity, weak acceptance evidence and misleading execution metrics | The mandated implementation map itself contains source-identity collisions and a historical false dependency |

The latest Proactive work already asks whether recorded activity measures benefit and whether defaults are real observations. Those are excluded from the main findings. The additions here are not a second intervention framework or a replacement roadmap.

## Ranking after investigation

Ordering weighs **potential consequence × confidence × architectural reach**. These are qualitative judgments, not measured incident probabilities. Production exposure is unknown even where source behavior is reproduced.

| Rank | Finding | Potential consequence | Confidence | Architectural reach |
|---|---|---|---|---|
| 1 | Successful teaching can change command meaning | A named request can dispatch deletion of another reminder | High: actual learner, router, registry and dispatcher exercised; effect mocked | Every learned capability; human confirmation and future autonomy |
| 2 | Connectivity selects domain behavior | Capture has different effects depending on the path taken | High: actual hook and route exercised with identical input | Schedule, Hub conversion, offline capture, ERA adapters |
| 3 | Mutable account metadata changes historical meaning | An inverse can move money in the wrong direction | High for source arithmetic; live edit admissibility unverified | Account settings, transactions, balances, restore and projections |
| 4 | “Household” has several incompatible identities | Modules can disagree about the same household's members and history | High for selector divergence; current multiplicity unverified | Hub, Brain, Kitchen, Budget, notifications and recovery |
| 5 | The implementation graph is not independent structural evidence | Research and change scoping can follow invented coupling | High for audited artifact defects; downstream harm unmeasured | Repository exploration and agent reasoning across modules |

## 1. A successful lesson can teach a different action

**Finding — observed fact.** The taught-template pipeline can turn a successfully confirmed action on an explicitly named reminder into a future action on whichever reminder is currently in focus. Both actions pass the capability schema. The missing information is how the target was identified, not whether the original execution succeeded.

**Evidence.** [Proposal validation](../../../src/lib/ai/eraAskProposal.ts), lines 313–359, replaces the model's `FOCUS` sentinel with a real focus ID and canonical title. [Confirmation](../../../src/features/era/useEraAskAI.ts), lines 176–232, executes that proposal and, on a nonfailed result, learns and POSTs a template. [The learner](../../../src/features/era/templates/learn.ts), lines 61–101, substitutes only slot values present verbatim in the utterance. It accepts sufficiently long fixed phrases even when no slot survives. [Template routing](../../../src/features/era/intents/index.ts), lines 111–147, uses captured `target`, then `title`, then the literal `"it"`; it re-resolves that reference against current focus.

The synthetic witness used `bin the dentist reminder` and a successfully resolved title `Dentist visit`. The real learner returned that unchanged phrase with `slotNames: []`. With `Call bank` subsequently in focus, the real root router emitted `reminder.delete` with `itemId: "bank-id"`, `title: "Call bank"`. The real registry/schema/dispatcher reached a mocked `resolveReminderDelete("bank-id", "Call bank")`. Without the template, that sentence only switched to Schedule. No record was deleted. [The dispatcher](../../../src/features/era/intents/resolveIntent.ts), lines 126–133, executes a matched capability directly; [the real delete resolver](../../../src/features/era/intents/resolvers/schedule.ts), lines 400–419, would issue DELETE for the supplied ID. The [template API](../../../src/app/api/era/templates/route.ts), lines 18–24 and 82–95, accepts an empty slot list and stores the submitted pattern; the [client mirror](../../../src/features/era/templates/useEraTemplates.ts), lines 39–47, carries pattern, slots and enabled state into the matcher. Live storage and enablement remain unverified. See experiment X1 for the exact boundary proved.

**Why it matters — inference.** Confirmation currently approves one execution and also supplies the training example for a reusable policy. Those are different permissions and different correctness claims. The system has enough data to execute the first action correctly while discarding the information needed to execute the next one correctly. A stronger model that supplies a more accurate canonical title does not fix verbatim substitution; paraphrasing is precisely the case that can lose the binding.

**Why it was easy to miss.** [HUB-34](<../Hub & ERA/Hub & ERA — Master Book.md>), lines 138–141, already fixed wrong-target templates with captured references and rejected learning from graceful execution failures. Its named-target tests are meaningful. The remaining case is a canonical title that never becomes a captured reference. Existing [learner tests](../../../src/features/era/templates/learn.test.ts) also deliberately accept zero-slot pronoun commands. Each local rule looks defensible; their composition changes the lesson.

**Systems affected.** Ask AI, focus memory, taught templates, the capability registry and deterministic dispatch. Wrong deletion is demonstrated at dispatch; analogous loss of a date or other resolved argument remains a hypothesis, not another proven incident.

**Confidence.** High for this source path and fixture. **UNVERIFIED:** whether a stored user template already has this shape and whether it has produced an unintended live effect.

**Counter-evidence considered.** Patterns are anchored and escaped; built-in routers take precedence; explicit captured names use fuzzy matching with tie refusal; focus expires; the original proposal is confirmed. These reduce exposure but do not preserve an explicit name omitted during learning. With no usable focus, the example refuses instead of misdispatching.

**What would falsify it.** An intervening current-source step that preserves the omitted referent or prevents this template from reaching dispatch would invalidate the reproduction. A verified absence of such templates in an owner-controlled export would reduce present exposure, not repair the learning rule.

**Consequence if true.** Improving E-11's success reporting can make telemetry more honest while a perfectly successful wrong-target action still counts as a success. This extends E-11; it does not dispute the need for it.

**Appropriate next move — recommendation.** Use a small corpus to distinguish executable proposals from safely reusable lessons. Try refusal to learn when target meaning cannot be preserved before adding a richer template language. The useful deletion candidate is **automatic learning of an under-specified policy**, not the whole template feature.

**Action needed now?** Yes at the interpretation level: a successful confirmation is not evidence that the resulting lesson is safe. No template was disabled and no implementation task is created here.

## 2. Connectivity is an unstated business-rule selector

**Finding — observed fact.** “Create this reminder” has at least two implementations with different successful results. The online hook writes directly through browser Supabase; the offline hook queues an API request. Transport changes domain semantics, not just latency or reliability.

**Evidence.** [useCreateReminder](../../../src/features/items/useItems.ts), lines 326–395, chooses between queued `/api/items` and direct table inserts. Its online alert creation explicitly excludes drafts, lines 410–480. [The replay endpoint](../../../src/app/api/items/route.ts), lines 180–233, has no corresponding draft exclusion. This is an active product seam: [BulkConvertReviewSheet](../../../src/components/hub/BulkConvertReviewSheet.tsx), lines 310–319, calls the hook with `status: isDraft ? "draft" : "pending"` and a due time.

A synthetic invocation of the actual hook used `{title: "Unconfirmed fixture", status: "draft", due_at: "2026-09-07T09:00:00.000Z"}`. With successful mocked storage, the online branch wrote `items` and `reminder_details`. The offline branch's captured body, passed to the actual API handler, returned 201 and also inserted an active push `item_alerts` row. No storage or network request reached a real service. This proves attempted-effect divergence under successful dependencies; it does **not** prove that a draft notification would actually be delivered. The current cron's DB selection behavior is unverified.

**Why it matters — inference.** The user's intended action cannot be specified by its fields alone if connectivity chooses a different implementation. An API-only atomicity fix cannot establish the online hook's behavior because that branch never calls the API. Conversely, repairing the hook does not repair ERA and replay consumers of the endpoint. The absent contract is equivalence of domain effects across supported entry paths.

**Why it was easy to miss.** [Design Doctrine](<../../01 - Architecture/Design Doctrine.md>), the Offline Question, asks whether offline work queues, degrades or blocks. [E-09](<../Top Layer/Top Layer — ASTRA Packets.md>) correctly concentrates on durability, identity and atomic ERA capture. Both questions can receive satisfactory answers while online and offline actions still mean different things. This fixture requires no failure, retry race or recurrence edge case.

**Systems affected.** Reminder creation, Hub bulk conversion, standalone forms, offline replay and ERA's API consumers. This is a demonstrated reminder seam, not a claim that every dual path in ERA is inconsistent.

**Confidence.** High for source and synthetic effects. **UNVERIFIED:** deployed behavior and downstream draft alert eligibility.

**Counter-evidence considered.** Direct browser writes can be deliberate and may share DB constraints. Common DB enforcement could suppress or normalize the divergent inserts. Current rules cannot be inferred from migration files. Also, E-09c explicitly leaves legacy/recurring paths separate; this study does not misrepresent it as promising complete unification.

**What would falsify it.** A faithful isolated execution showing a shared authoritative rule normalizes both paths to identical domain effects would narrow this to duplicated client logic. A route-only unit test or two HTTP success codes would not settle it.

**Consequence if true.** “One capability” and “one endpoint” are insufficient units for acceptance. The same intent must preserve agreed status, details, alerts and relationships through every supported path. Connectivity is one hidden input; execution timezone and replay date are further candidates, not demonstrated defects here.

**Appropriate next move — recommendation.** Differential fixtures for the existing paths, beginning with the draft witness. Compare normalized domain effects, then decide whether to delegate one path to another or retain two implementations with an explicit equivalence boundary. The duplicate implementations are also a useful test asset: their disagreement exposes missing decisions cheaply.

**Action needed now?** Add this distinction to how capture readiness is judged. No new transport, queue or service is justified by this study alone.

## 3. Some account “settings” are part of historical money

**Finding — observed fact plus inference.** Transaction reversal recomputes direction using the account's current type, while the account API permits that type to change. Currency is also editable metadata, even though it supplies the unit for existing native amounts. These fields are part of financial meaning; treating them like a rename can change what old records mean.

**Evidence.** [Account PATCH](../../../src/app/api/accounts/[id]/route.ts), lines 11–18 and 49–77, accepts `type`, `currency` and `exchange_rate` and updates the account without a source-level history guard or rebasing operation. [Transaction DELETE](../../../src/app/api/transactions/[id]/route.ts), lines 340–361 and 394–405, reads the current account type before computing the inverse. The real [getBalanceDelta](../../../src/lib/balance-utils.ts), lines 17–42, gives this deterministic witness:

```text
Start:                         100
Create 10 in expense account:   90  (delta -10)
Change account type to income:  90  (metadata-only source update)
Delete that transaction:        80  (current-type delta -10)
Expected reversal of its original effect: 100
```

Only the pure delta helper was executed for this arithmetic. The metadata update and delete integration are traced source paths, not an executed live transaction. The fixture assumes no additional DB guard or compensating trigger.

Currency has a visible editing path in [AccountCurrencyDialog](../../../src/components/expense/AccountCurrencyDialog.tsx), lines 74–104. The [schema snapshot](../../../migrations/schema.sql), accounts lines 4–26 and transactions lines 48–80, records account currency/type and a transaction exchange rate, but no original transaction account type or denomination. The [August 4 migration](../../../migrations/2026-08-04_multi-currency.sql), lines 29–55, describes rate stamping historically; it is not evidence of the current trigger. Changing a rate is not equivalent to changing a unit.

**Why it matters — inference.** Perfect atomicity can apply the wrong inverse perfectly. A transaction amount plus a frozen USD rate protects one projection, but does not identify the original native unit or the sign policy used when its balance effect was applied. A later account edit is therefore potentially a correction or conversion of existing facts, not merely a prospective preference.

**Why it was easy to miss.** Budget ASTRA's atomicity and restore findings correctly target split effects. Multi-currency work explicitly freezes historical exchange rates, which appears to settle historical stability. The unnoticed variable is the mutable account interpretation read later by another operation.

**Systems affected.** Account maintenance, transaction deletion and restore, stored balances and native/USD projections. Type editing is proven as an API capability; this study does not assert that a current UI exposes a type-change control.

**Confidence.** High for the arithmetic and current source contract; medium for practical exposure. **UNVERIFIED:** current DB guards, installed historical triggers and whether the owner changes denominations or types on populated accounts.

**Counter-evidence considered.** `toUsd`, lines 68–78 of the balance helper, uses the transaction's frozen rate when supplied. Existing transfers support distinct converted destination amounts. Neither is dismissed. A type/denomination that never changes avoids this witness; a rate-only update need not revalue a properly stamped historical transaction.

**What would falsify it.** Current verified enforcement that populated accounts cannot change type/denomination, or a complete correction mechanism that preserves old effects, would remove this path. Showing that USD projections preserve their rate does not falsify the current-type inverse.

**Consequence if true.** BUD-63's atomic primitive is necessary but cannot by itself define the correct delta. The account's interpretation must be stable or changes must have explicit historical semantics.

**Appropriate next move — recommendation.** Decide whether a populated account may change economic type or denomination, and distinguish correction from conversion from rate refresh. Test one synthetic lifecycle before designing a ledger or adding historical fields. A narrow prohibition may be sufficient; a new event store is not established as necessary.

**Action needed now?** Clarify the invariant before treating account metadata changes or an atomic balance helper as harmless/complete. No production balance audit or migration is requested by this finding.

## 4. The same two people do not imply the same household

**Finding — observed fact.** Current consumers disagree on how to select a household link. They also disagree on what persists across replacement of that link: Budget follows user IDs, while memories and meals follow the link row's ID. Household identity is therefore both an authorization relationship and a data-continuity boundary, without one shared selection rule in the inspected paths.

**Evidence.** These are current source choices:

| Consumer | Selection / continuity rule |
|---|---|
| [Budget account access](../../../src/lib/accountAccess.ts), lines 44–62; [accounts route](../../../src/app/api/accounts/route.ts), lines 47–75 | Newest active link; then find partner accounts by the partner's user ID |
| [Memories](../../../src/app/api/memories/route.ts), lines 15–24 and 38–43 | Newest active link; memory rows scoped to that link's ID |
| [Meal plans](../../../src/app/api/meal-plans/route.ts), lines 27–51 | One active link, with no ordering; plans scoped to its ID |
| [Hub threads](../../../src/app/api/hub/threads/route.ts), lines 19–31; [Hub partner hook](../../../src/features/hub/usePartnerId.ts), lines 21–36 | Expect at most one active link; no limit; null data becomes no household/partner |
| [Item-reminder cron](../../../src/app/api/cron/item-reminders/route.ts), lines 288–315 | Union of members across every active link |

An in-memory fixture used two active links, `H-old` and `H-new`, both connecting **A and B**, with a memory and meal under each. The actual read handlers/helper/hook produced: Budget partner B; Hub partner null and no household; only the newer memory; and either the older or newer meal depending on fixture row order. This models the multirow result at the client boundary, not RLS or PostgreSQL's current physical row order.

Multiplicity is not an invented product requirement: the [Schedule Master Book](<../Schedule/Schedule — Master Book.md>), line 112, records a June 21 fix for stale active links left by relinking. The current cron comment repeats that rationale. Those records establish historical design context, **not current live multiplicity**.

**Why it matters — inference.** “Exactly two people” simplifies membership but does not establish a unique household container. Recreating a link for the same pair can leave user-owned Budget history continuous while link-owned knowledge and planning start a new scope. A recovered household could look complete in one module and empty in another even if every individual record is intact and access is correctly enforced.

**Why it was easy to miss.** Prior work treats household sharing mainly as access and viewer scope. The old bug was closed by making one consumer tolerate multiple links. Other consumers encode uniqueness or recency instead. A local robustness fix made notifications work without settling the household's identity contract.

**Systems affected.** Hub, Brain, Kitchen, Budget, notifications, onboarding and any future restore/export procedure that reconstructs relationship IDs.

**Confidence.** High for selector disagreement and fixture output; medium for present operational risk. **UNVERIFIED:** whether current DB constraints prevent multiple active rows, the deployed claim RPC's behavior, and actual link/history distribution. This is not a diagnosis of a reported live visibility bug.

**Counter-evidence considered.** [Onboarding](../../../src/app/api/onboarding/route.ts), lines 84–148, attempts to reuse an existing active link. No ordinary unlink/relink UI flow was established in this study. If one stable active link is guaranteed for the lifetime of the data, the fixture is unreachable and the practical concern narrows substantially. Two people do not by themselves provide that guarantee.

**What would falsify it.** Owner-provided evidence of a unique, stable household identity invariant covering creation, claiming and recovery would discharge the multiplicity/lifetime hypothesis. A screenshot of one working module would not.

**Consequence if true.** Canonical projections can still disagree if they start from different households. “Include the partner” does not specify which knowledge history belongs to the household. Choosing newest everywhere would remove one disagreement but could still strand older link-owned history.

**Appropriate next move — recommendation.** Choose whether the durable household is the stable container or a replaceable relationship epoch, and test preservation using the same-pair fixture. A stable existing ID and a uniqueness rule may suffice. This is not a recommendation to generalize ERA into a multi-tenant product.

**Action needed now?** Evidence collection before any relinking/recovery design or claim of whole-household continuity. No live inspection or cleanup was performed.

## 5. The map used to verify architecture can manufacture architecture

**Finding — observed fact.** The committed Graphify artifact merges unrelated concrete functions into common nodes and includes a false cross-module call edge. Its topology is therefore unsafe as independent proof of implementation coupling. Age alone does not explain the defect.

**Evidence.** [CLAUDE.md](../../../CLAUDE.md), “Graphify (Dynamic Codebase Exploration),” distinguishes design intent from implementation reality and mandates graph exploration for unfamiliar modules and architecture verification. The [July 11 graph report](../../../graphify-out/GRAPH_REPORT.md), lines 1–9, describes 3,656 nodes, 4,338 edges and 81% EXTRACTED edges.

An audit of [graph.json](../../../graphify-out/graph.json), normalizing path separators and omitted `src/` prefixes, found **18 function nodes with `contains` edges from multiple distinct source paths**. This is a candidate collision count, not a claim that every case was individually adjudicated. Concrete examples: `id_route_patch` has 20 source paths but its node points to Trips' PATCH at line 41; `id_route_delete` also has 20; `history_route_get` combines account-balance, inventory and NFC history handlers. They are separate concrete route functions, not one shared implementation.

Another edge says `recurring_page_handleconfirmrecurring` calls `web_webevents_format`, confidence INFERRED 0.8. The target is a supposed `format()` node at WebEvents line 1464, a call site. Read-only `git show ae876a5:src/app/recurring/page.tsx` establishes that, **at the graph's historical commit**, Recurring imported `format` from `date-fns` and had no WebEvents import. The report's “surprising” connection and its high-degree `format()` hub cannot be used as evidence of that UI dependency. X5 contains the reproducible artifact audit.

**Why it matters — inference.** This is upstream of code review. A map that aliases identities can create hubs, communities and apparent blast radii before an agent reads any source. Stronger reasoning over that map cannot recover distinctions the map discarded. Repository documents and a generated graph are not automatically independent corroboration, especially when the graph also ingests the documents.

**Why it was easy to miss.** The artifact has source locations, extraction labels, confidence scores and a detailed report. Those make it inspectable, but do not certify identity. Existing ASTRA challenges documentation and delivery evidence; the exploration tool itself almost escaped scrutiny because it is not a product campaign.

**Systems affected.** Agent orientation, architectural studies, dependency reasoning and change scoping across the repository. **No production defect is attributed to this graph.**

**Confidence.** High for the examples and historical comparison. **UNVERIFIED:** how often prior agents used these edges, whether they changed decisions, and whether the current extractor would reproduce the same problem. The claim concerns this committed artifact, not every Graphify run or graph-based technique.

**Counter-evidence considered.** The report labels the example INFERRED and explicitly asks readers to verify inferred `format()` edges near its end. Many graph edges may be useful. Deliberate symbol aggregation would also explain some shared nodes, but then source-specific links and source-level coupling conclusions need different treatment. Normalizing paths did not remove the concrete route-handler collisions.

**What would falsify it.** A source-qualified interpretation or corrected artifact demonstrating distinct route function identities and actual import resolution would restore those uses. Regeneration alone, without checking identity and edge semantics, would not.

**Consequence if true.** A mandatory graph step can consume attention while biasing inquiry. Its metrics cannot establish which modules are most coupled until the entities and relationships they count are verified.

**Appropriate next move — recommendation.** Demote this graph to a navigation aid now; independently verify every load-bearing relationship. Test a small extraction fixture before investing in a rebuild. If that cannot establish reliable identities, remove the mandatory step rather than create a graph-maintenance program. This session changed neither the graph nor the repository rules.

**Action needed now?** Yes: stop treating this artifact's topology as implementation proof. No model upgrade or additional graph generation is needed to make that decision.

## The five changes in thinking before code

“Current belief” below means the position suggested by repository decisions and comments, not a claim to know the owner's private beliefs.

| Finding | Current belief suggested by the repository | Evidence suggests instead | Why the difference matters | Thinking change before code |
|---|---|---|---|---|
| 1 | A successful confirmed proposal is a safe lesson; re-resolution keeps it current | Re-resolution can discard an explicit referent and change the action | Safe execution of one example does not authorize or validate its generalization | Separate an action, its evidence of success, and the policy learned from it |
| 2 | Offline work needs safe delivery to its owning endpoint | Delivery may select a different implementation of the intention | All-or-nothing and exactly-once say nothing about equivalence between paths | Define the intended effect before choosing transport and write ownership |
| 3 | Account settings describe the account now; frozen FX protects the past | Current type/unit can interpret and reverse past effects | Serialization can preserve the wrong arithmetic | Classify meaning-changing settings as corrections/conversions or constrain them |
| 4 | Household means the current user and partner | Consumers also depend on a particular relationship row and its selection rule | Same membership can coexist with different knowledge histories | Separate membership, durable household identity and any deliberate epochs |
| 5 | The implementation graph supplies another view of reality | It can collapse identities and invent relationships | More evidence-looking artifacts can amplify one mistake | Validate how a map identifies things before trusting what it connects |

## Verification receipt

The four requested documents are the only new working-tree files at final verification. Their relative links resolve, their required finding fields and final section are present, and whitespace checks pass. All three embedded executable probes in the Experiments document were rerun directly from its code blocks and exited 0 with the recorded outputs. X2 and X4 additionally have the in-session hook/route fixture receipts described there. These are bounded research probes, not a full test-suite result. Typecheck, application lint/build, browser/mobile UAT, Atlas regeneration and PM campaign updates are not applicable to this documentation-only study; no product behavior or roadmap item was changed.

## Mandatory second-pass challenge

1. **What did I assume from the documents?** That correctness chiefly failed at acknowledgment/commit boundaries; that HUB-34's name resolution closed the relevant wrong-target family; that Graphify's main limitation was staleness. The cases above changed those assumptions.
2. **What did evidence force me to change?** Successful execution is too weak a learning criterion; identical supported input can select different successful effects; stable transaction amounts do not imply stable inverses; household membership does not imply history continuity; source-looking graph nodes can alias unrelated functions.
3. **What did I almost ignore because no roadmap pointed to it?** The construction of the exploration graph. It was initially a tool for finding evidence, then became evidence requiring examination.
4. **What requires the most compositional reasoning?** Finding 1: correct focus resolution, canonical titles, verbatim extraction, fixed-phrase admission, fresh-focus fallback and valid dispatch combine into a policy different from the confirmed example. Auditing those functions separately misses the transition.
5. **Which finding connects the most distant parts?** Finding 4 joins account access, memory identity, meal-history partitioning, Hub lookup behavior, notification fan-out and a historical relinking fix. The graph finding crosses product source and the institution used to reason about it.
6. **Which apparent local problem was a symptom?** A draft gaining an alert is a witness of two business implementations behind one action. Wrong-target replay is a witness of missing binding semantics in a learned policy. Neither is adequately described as an isolated missing conditional.
7. **Which recommendation became less convincing?** Automatically learning every successful proposal, and mandatory reliance on the existing graph. API-only safety improvements remain worthwhile but should not be presented as proof of cross-path equivalence. Atomic balances remain worthwhile but do not settle the inverse's inputs.
8. **What is still unproved?** Current DB enforcement and deployments; reachable live populations of hazardous templates/accounts/links; whether the owner intends retrospective account corrections; and the value/cost of a richer learning representation. No universal command envelope, event store or household graph has been demonstrated necessary.
9. **Is this just the roadmap again?** There is overlap in affected modules, explicitly disclosed above. The tested propositions differ: successful action versus valid lesson; transport equivalence versus durable replay; historical meaning versus atomic delta; household continuity versus visibility; map identity versus execution acceptance. The study adds no packets and rejects restating already-covered defaults, causal feedback, delivery receipts and queue durability as discoveries.

Two attractive allegations were dropped. The offline queue's replacement comment suggested that two partial updates might overwrite one another; executing the actual fallback queue retained both. A suspected root-proxy bypass of PM authentication did not survive inspection of installed Next build discovery and the local middleware matcher artifact: the `src/middleware.ts` gate was selected. Neither experiment certifies all queue behavior or the deployed PM build. They prevented unsupported findings, rather than supplying extra ones to reach a count. Details are in X6.

# Things I initially believed that the repository forced me to change my mind about

- I initially expected the strongest findings to be unrecorded failure/partial-success cases. The strongest witness performs the wrong learned action **successfully**. Meaning must be checked separately from completion.
- I initially treated canonical focus IDs and shared Zod schemas as strong evidence that the repaired teaching loop retained its target. They validate the new ID while the lesson silently loses the old reference rule.
- I initially expected online and offline reminder paths to differ mainly in failure handling. The draft fixture produced different successful effects with every mocked write succeeding.
- I initially treated frozen exchange rates as the main historical money safeguard. Current account type can still reverse the sign of an old transaction's inverse; rate and historical interpretation are different things.
- I initially treated two-person household scope as simpler than other identity problems. Two links for the same two people were enough to make five actual consumers disagree.
- I initially considered the old graph a useful relationship map needing freshness checks. Historical import evidence and concrete function collisions showed a structural problem that refreshing source dates alone would not answer.
- I initially suspected queue patch loss and a PM auth bypass. The targeted checks contradicted those interpretations, so I discarded them rather than promoting suspicious comments or filenames into facts.

**The single most important thing the owner does not appear to be thinking about enough:** ERA needs to preserve the meaning of an intention as carefully as it preserves the record of its execution. The repository's plans are increasingly explicit about identity, authority, atomicity and evidence of completion. Less explicit is **which context an action is allowed to reinterpret later**. Focus, connectivity, account type and household-link selection currently answer that question implicitly in different places. The next improvement in ERA's intelligence may be to make fewer unsupported generalizations, not to generate more actions. This conclusion is inferred from the five bounded witnesses above; it is not a claim about the owner's unexpressed beliefs.
