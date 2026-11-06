# Candidate comparison

Status: proposals, not approved features. Source baseline and available inputs: [README](README.md). Ratings below are qualitative architectural judgments about the proposed minimum releases. Benefit is a hypothesis to validate, not measured usage or time saved. “Low maintenance” describes user burden first; implementation upkeep is called out separately.

## Five complete outcomes

| Candidate | Personal-life outcome | Existing foundation and missing boundary |
|---|---|---|
| C1 — Finish an interrupted request | A reminder and groceries requested together are saved once, or the user can see precisely what still needs action | Versioned [run state](../../../src/features/era/execution/state.ts#L82), [execution client](../../../src/features/era/execution/client.ts#L138), [owner-scoped run updates](../../../src/app/api/era/runs/%5Bid%5D/route.ts#L20), artifacts. Missing: discoverable continuation across requests and proven source-local recovery for each supported write. Durable execution is [flag-gated](../../../src/features/era/execution/state.ts#L14). |
| C2 — Reset a disrupted day | After plans change, the user deliberately keeps or moves a few remaining commitments and knows what will happen next | Shared [occurrence expansion](../../../src/lib/utils/dayOccurrences.ts#L39), [flexible placement](../../../src/features/items/useFlexibleRoutines.ts#L756), and [day-plan records](../../../migrations/schema.sql#L1703). Missing: bounded review, source-bound consent, and safe partial application. Google integration is [one-way export](../../../src/lib/gcal/sync.ts#L1), not complete availability. |
| C3 — Dinner through cooking | The user chooses a dinner, shops for missing ingredients, then explicitly records cooking | [Person/date/meal coverage](../../../src/lib/mealPlanCoverage.ts#L36), [meal assignment](../../../src/app/api/meal-plans/route.ts#L140), [ingredient-to-shopping route](../../../src/app/api/meal-plans/add-to-shopping/route.ts#L71), [cooked status](../../../src/app/api/meal-plans/%5Bid%5D/route.ts#L72). Missing: linked, reviewable sequence with retry-safe contribution identity and honest progress. |
| C4 — Recall a household fact and use its source | The user finds the correct saved household detail, verifies it, and opens/copies it without asking repeatedly | [Memories API](../../../src/app/api/memories/route.ts#L27) filters household and label; [resolver](../../../src/features/era/intents/resolvers/brain.ts#L58) selects the first result and drops source identity/age from its return. Missing: disambiguation, provenance in the simple path, correction contract. `household_memories` was not found in the analyzed schema; deployed storage/access remain unknown. |
| C5 — Resolve a renewal once | The user chooses to keep, investigate, or stop a renewal, then links the actual payment without recording it twice | [Confirm-payment hook](../../../src/features/recurring/useRecurringPayments.ts#L291) and [mark-covered hook](../../../src/features/recurring/useRecurringPayments.ts#L365) exist. Missing: trusted period identity, robust matching/confirmation/undo, and external cancellation evidence. A recorded cancellation decision cannot cancel a vendor contract. |

## Benefit, uncertainty, and burden

| Candidate | Expected benefit and validation question | Implementation uncertainty | Recurring maintenance | UX complexity |
|---|---|---|---|---|
| C1 | High across interrupted writes: removes reconstruction and duplicate anxiety. Do users actually lose their place between persisted requests? | Medium: journal exists, adapter receipt guarantees and rollout unknown | Low user burden if self-populated; medium engineering burden as adapters evolve | Low–medium: one resume point, but “Check” must remain understandable |
| C2 | High when a day changes: resolves a small set of concrete commitments. Does the owner want explicit triage or already handle this quickly in Schedule? | Medium–high: occurrence identity, concurrent edits, time zones, source-managed exclusions | Low user burden when invoked only on disruption; medium–high engineering upkeep across schedule semantics | Medium: concise before/after review; avoid presenting an optimizer or requiring estimates |
| C3 | High for household meal routines: connects choosing, shopping, and doing. Is recipe data sufficiently complete to avoid manual transcription? | Medium–high: slot conflict semantics, ingredient identity, sequential writes | Low–medium user burden for choosing recipes and marking cooked; medium engineering upkeep. No pantry census required | Medium: audience/date/ingredients need review, but one dinner bounds the choices |
| C4 | Medium: saves repeated lookup for a narrow question. Is recall actually unreliable, and would source links solve it? | Medium despite small UI: storage/schema and correction route gaps; semantic ambiguity | Low user burden if source-backed; facts can become stale, so no mandatory periodic review queue | Low for exact matches, medium for ambiguity and correction |
| C5 | Potentially high financial value, but unmeasured | High: accounting periods, transaction matching, uncertain writes, real-world cancellation/provider evidence | Medium: renewal data changes and exceptions require attention; high engineering risk around money | Medium–high: account, actual amount/date, period, and cancellation proof cannot all be inferred safely |

## Safety and reversibility

| Candidate | Principal safety issue | Reversal boundary | Assessment |
|---|---|---|---|
| C1 | Repeating a committed write after a lost acknowledgement; leaking private run history | Stop only remaining work; inverse supported source writes with fresh checks; unknown outcomes require reconciliation | Strongest first investment because it makes uncertainty explicit; cannot claim exactly-once effects from journal versioning alone |
| C2 | Moving a fixed, shared, recurring, or source-managed obligation; overlooking external events | Restore prior placement only when unchanged since this operation; preserve original occurrence identity | Acceptable only with restrictive eligibility and explicit review; no autonomous scheduling |
| C3 | Replacing a household meal, duplicating groceries, claiming dietary safety, conflating bought with cooked | Remove unchanged contributions owned by this operation; restore meal/status only with preconditions; never undo real shopping/cooking | Acceptable for one dinner with actual recipe evidence and separate receipts |
| C4 | Returning another person's information or treating an old statement as current truth | Read/copy is non-mutating; edits need explicit source correction, not silent memory rewriting | Safest interaction shape, but avoid sensitive facts in notifications and verify storage/access before expansion |
| C5 | Duplicate spend, wrong account/currency/period, premature cancellation claims | Source financial correction is distinct from refund or reinstating a vendor contract | Highest downside; leave as a bounded future discovery option |

## Selected concepts

1. **C1 → [Blueprint 01](BLUEPRINT-01.md).** Highest reuse of current execution foundations, low continuing user maintenance, and a clear safety benefit. This is not universal auto-retry: the first release supports only adapters whose source outcomes can be reconciled.
2. **C2 → [Blueprint 02](BLUEPRINT-02.md).** A complete everyday outcome that uses existing schedule semantics and can work without AI. A small manual review is more credible than importing a full scheduling service or adding another plan store.
3. **C3 → [Blueprint 03](BLUEPRINT-03.md).** Concrete household value through several existing modules. The minimum release ends with an explicit cooked record, while allowing the user to leave earlier stages unfinished without daily cleanup.

**Defer C4:** attractive and relatively small, but it solves a narrower outcome and still needs foundational schema/access discovery. It could replace C2 or C3 if the owner reports frequent household lookup friction. Do not add a second memory system to make it larger.

**Defer C5:** preserve it as a financial discovery option. Current confirmation and mark-covered actions are useful foundations, but the user must still verify actual payment and external cancellation. Financial write safety and transaction/period identities must be resolved before making an end-to-end convenience promise.

## Alternatives to a new feature

For C1, improving existing run cards and history may be enough; validate before adding a new entry surface. For C2, better bulk selection and direct schedule controls may outperform conversational replanning. For C3, a clearer ingredient picker plus durable links between meal and shopping may deliver most of the value without AI. C4 could start with a source-rich result row; C5 could start with clearer recurring-payment status and direct links.

The [interaction pack](../10-interaction-design/README.md) favors fewer controls and visible unfinished work. The [product concepts](../16-product-research/SOLUTION-CONCEPTS.md) and [journey dependencies](../03-life-journeys/SHARED-DEPENDENCIES.md) support these directions, but neither validates adoption. No universal Home redesign, automatic pantry ledger, daily planning ceremony, generalized memory extraction, or new external subscription is required.

Before committing to any build, test the fictional journey with the owner and compare a direct-control prototype with the conversational entry. Record completion, source corrections, abandoned steps, and confusion about saved versus done in that test; do not present those future observations as existing analytics.
