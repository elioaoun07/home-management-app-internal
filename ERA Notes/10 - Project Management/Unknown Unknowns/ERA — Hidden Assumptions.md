---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
---

# ERA — Hidden Assumptions

The important distinction is between an invariant that ERA enforces and a condition under which its code happens to work. This register classifies the assumptions behind the [five findings](<ERA — Unknown Unknowns.md>). It does not turn every uncertain condition into a defect or task.

“Proven invariant” below is explicitly bounded to inspected source and synthetic executions. No end-to-end production invariant was certified. An owner decision describes intended behavior; it does not prove enforcement. **Cross-system** marks assumptions whose failure propagates beyond one local function.

## Proven invariants, within stated boundaries

| Assumption | What is established | Boundary / evidence |
|---|---|---|
| A matched registered capability receives schema validation before dispatch | The `capabilityAction` branch calls the capability's own `safeParse` before `execute` | [resolveIntent](../../../src/features/era/intents/resolveIntent.ts), lines 126–133. Proven shape validation; not semantic target validation. X1 passes this guard and still dispatches another reminder. |
| A captured explicit reference can be resolved by name instead of always using recent focus | `target`, then legacy `title`, feed `resolveEntityRef`; ambiguous equal-score names can refuse | [router](../../../src/features/era/intents/index.ts), lines 119–137; [focus memory](../../../src/features/era/focusMemory.ts). This applies only when the learner retained a reference. |
| The online reminder creator suppresses draft alerts | Both explicit and automatic alert branches require `status !== "draft"` | [useItems](../../../src/features/items/useItems.ts), lines 410–480. X2 exercises this source rule. The API path is outside the invariant. |
| Create/delete deltas are inverses when their interpretation inputs remain identical | For a fixed amount, account type and debt-return flag, `delete` negates `create` | [balance-utils](../../../src/lib/balance-utils.ts), lines 17–42. X3 changes only the type between operations and breaks the lifecycle inverse. |
| A supplied historical exchange rate gives a stable arithmetic USD projection | `toUsd(amount, rate)` uses that rate, not an account lookup | [balance-utils](../../../src/lib/balance-utils.ts), lines 68–78. Whether all callers supply the right rate and whether it was stamped in production are separate questions. |

These bounded invariants are useful. Their failure is not required for the main findings: the surprising behavior occurs while several of them hold.

## Deliberate owner decisions

| Decision | Evidence | What it does not imply |
|---|---|---|
| **Cross-system:** ERA serves exactly two people plus an AI | [Design Doctrine](<../../01 - Architecture/Design Doctrine.md>), “What this app is,” line 21 | It does not prove one active `household_links` row or one permanent household container. X4 needs only the same two people. |
| Hub/ERA handles frequent conversation; dedicated module forms provide precise control | [CLAUDE.md](../../../CLAUDE.md), opening interaction model | Different interfaces need not produce different domain effects for the same agreed intention. Nor must they expose identical UI fields. |
| General AI proposals require human confirmation; ERA favors trust and reversibility over extra foresight | [CLAUDE.md](../../../CLAUDE.md), Domain Gotchas; [Design Doctrine](<../../01 - Architecture/Design Doctrine.md>), tradeoff order | A confirm tap approves the presented action. Whether it also establishes a reusable rule is a separate learning contract. Existing intentional deterministic commands need not gain another confirmation dialog. |
| Avoid expanding meta-tooling without household value | [Design Doctrine](<../../01 - Architecture/Design Doctrine.md>), final judgment prompts; [Portfolio](<../ASTRA — 10x Portfolio.md>) | Discovering a bad graph is not an instruction to build a better graph platform. Demoting an artifact or removing a mandatory step may be sufficient. |

This study preserves those decisions. None requires a multi-tenant rewrite, universal command bus, event store, new model, or new approval ceremony.

## Implementation assumptions

| Assumption | How implementation depends on it | Status |
|---|---|---|
| **Cross-system:** a correctly executed proposal can safely become a phrase template | [confirmProposal](../../../src/features/era/useEraAskAI.ts), lines 192–229, gates learning on execution outcome | Contradicted for semantic preservation by X1. The success gate itself is still useful. |
| A resolved value absent from source wording may be omitted and recovered later in the same way | [learn.ts](../../../src/features/era/templates/learn.ts), opening comment and zero-slot branch | Contradicted by named dentist wording becoming a current-focus rule. This is an explicit source claim, not an inferred owner belief. |
| **Cross-system:** endpoint replay implements the same intention as the online hook | [useItems](../../../src/features/items/useItems.ts), lines 326–395, versus [items API](../../../src/app/api/items/route.ts) | Contradicted at attempted-effect level by X2. Shared DB enforcement remains unverified. |
| Account type at reversal is the type that determined the original effect | [transaction DELETE](../../../src/app/api/transactions/[id]/route.ts), lines 355–405 | Required by the inverse arithmetic, but the account PATCH accepts changes. X3 falsifies the unconditional source-level assumption. |
| **Cross-system:** choosing newest, first, unique or all active links gives compatible household context | [accountAccess](../../../src/lib/accountAccess.ts), [memories](../../../src/app/api/memories/route.ts), [meal plans](../../../src/app/api/meal-plans/route.ts), [Hub partner](../../../src/features/hub/usePartnerId.ts), [cron](../../../src/app/api/cron/item-reminders/route.ts) | Contradicted by X4 under a two-link fixture; current reachability unverified. |

## Historical assumptions

| Assumption inherited from previous work | Historical evidence | Present interpretation |
|---|---|---|
| Multiple active household links should be tolerated | [Schedule Master Book](<../Schedule/Schedule — Master Book.md>), June 21 shipped log, line 112; corresponding cron comment | This history explains the union policy. It is not evidence that the live DB has duplicates today, and it does not explain what should happen to link-owned history. |
| Frozen FX protects old transaction meaning | [multi-currency migration](../../../migrations/2026-08-04_multi-currency.sql), lines 29–55; [AccountCurrencyDialog](../../../src/components/expense/AccountCurrencyDialog.tsx) | Preserve the useful rate distinction. Do not extend it to original denomination or account-type sign, which are different inputs. The migration is an authored historical artifact. |
| The graph represents implementation reality from its extraction date | [GRAPH_REPORT](../../../graphify-out/GRAPH_REPORT.md), July 11 metadata, and [CLAUDE.md](../../../CLAUDE.md), Graphify instructions | Historical source disproves the Recurring → WebEvents example at that very date. Staleness is only one limitation. |

## Undocumented or insufficiently settled assumptions

These are hypotheses about missing contracts in the inspected paths, not claims that nobody has ever discussed them.

| Assumption | Why it matters | Evidence needed |
|---|---|---|
| **Cross-system:** a household link's UUID lasts as long as its shared data | Memories and meals filter by that UUID, while Budget follows user IDs | A lifecycle/recovery decision plus an isolated fixture that preserves the same household's history. X4. |
| A currency edit on a populated account is a relabeling, conversion, correction or prospective change | Those operations have different effects on old amounts and current balances | Owner intent for one concrete before/after example; then verify the chosen rule. X3. |
| A phrase with no extracted slots really is a no-argument command | A missing slot can mean either “no argument needed” or “argument could not be represented” | Teach/replay corpus separating literal, pronoun, named and relative references. X1. |
| **Cross-system:** an action may consult current context again without changing the user's intention | Focus, date, account policy and household selection can change between capture and execution | A per-domain rule specifying what is fixed, what is re-resolved and when ambiguity must stop execution. No universal implementation is presumed. |
| A graph's source-qualified-looking node actually identifies one source entity | Source links and topology are used to guide exploration | Small extraction fixture with same-named exports and imported symbols, then compare with source. X5. |

## Assumptions now contradicted by evidence

The strongest contradictions concern **unqualified claims**, not the bounded invariants above:

- “The learner can omit paraphrased values because match time resolves them the same way.” X1 changes a named reference into `it`.
- “Queued creation is just delayed online creation.” X2 produces a different set of writes with successful dependencies.
- “Delete reverses the original effect regardless of later account maintenance.” X3 reverses according to the current type.
- “The household lookup is interchangeable wherever the same two people are involved.” X4 gives incompatible actual consumer outputs.
- “Refreshing the graph's age is enough to restore structural confidence.” X5 finds a false relationship in source from the graph's own commit.

The positive result is equally important: **small deterministic counterexamples can test these assumptions without touching production or building the proposed architecture.** Their proper use is to force a precise decision, not to turn every possible state into a new feature.
