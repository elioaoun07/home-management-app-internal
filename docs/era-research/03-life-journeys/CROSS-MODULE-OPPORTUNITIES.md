---
created: 2026-11-06
status: proposed-design
analyzed_commit: 9cd4166691edd9367ea1bd9a604e0bec13ffe870
---

# Cross-module opportunities

[Index and evidence](README.md) · [Shared dependencies](SHARED-DEPENDENCIES.md)

The valuable connection is a retained decision and a verified outcome: a meal selected becomes a reviewed shopping list and a recorded purchase; a workout plan becomes a scheduled slot and a completed session. Merely putting five destinations in a dashboard does not achieve that.

## Ranking

Scores are qualitative design judgments, not measured usage or delivery estimates. Benefit and reuse: **5 is strongest**. Uncertainty and maintenance: **5 is highest cost/risk**. Ranking weighs recurring household benefit first, then reuse, and discounts unverified dependencies. It is intentionally not a false-precision weighted total.

| Rank | Journey | Benefit | Reuse | Uncertainty | Maintenance | Why this position |
|---|---|---:|---:|---:|---:|---|
| 1 | [01: Busy week](JOURNEY-01.md) | 5 | 4 | 3 | 3 | Frequent coordination problem; Schedule, daily plans and flexible placement already exist. The missing piece is reviewable coordination across days, not a new calendar. |
| 2 | [02: Meals within budget](JOURNEY-02.md) | 5 | 4 | 4 | 4 | Repeated household value and existing recipe → meal → shopping seams. Price confidence, unit matching and missing purchase/stock links create substantial uncertainty. |
| 3 | [04: Renewal review](JOURNEY-04.md) | 4 | 4 | 3 | 3 | Narrow, consequential loop with existing coverage matching and expense forms. Exactly-once payment coverage must precede more automation. |
| 4 | [03: Trip readiness and return](JOURNEY-03.md) | 4 | 4 | 4 | 4 | Strong itinerary, packing, documents and cost records, but episodic use. Home routine cascade is disabled, with incomplete live evidence. A planner-only slice costs much less than full automation. |
| 5 | [05: Fitness commitments](JOURNEY-05.md) | 3 | 5 | 3 | 2 | Best existing Schedule/completion integration; narrower benefit. Incremental navigation and review work is small, assuming owner migrations are applied. |

Benefits follow the repository's emphasis on low-friction household capture, not an inferred account of the owner's habits. Reprioritize from owner feedback: a pending trip may make 03 immediately more useful than 01; an active training plan may put 05 ahead of 04.

## What to connect, and how little is enough

| Journey | Smallest useful proposed slice | A simple link is enough when… | A shared contract is necessary when… | Do not promise yet |
|---|---|---|---|---|
| 01 | An approved week review that opens each affected day with retained intent and source IDs | Opening an existing item or `/reminders?date=…&plan=1` to edit it | A plan moves occurrences, assigns another person, or resumes partway through writes | Automatic week optimization, recurrence editing through the current ERA reminder adapter |
| 02 | Reuse saved recipes, show a grocery cap, review ingredients, then link to one expense capture | Opening a recipe, pantry row, or prefilled expense form still leaves that module in charge | Subtracting stock, merging ingredient demand, creating shopping batches or correlating purchase/spend/restock | Reliable live store prices, automatic pantry consumption, guaranteed affordability |
| 04 | Review one commitment, inspect candidate payment, then confirm coverage or open a spend form | Opening Recurring, the source transaction, or a review reminder | Claiming one due occurrence, advancing dates and recording payment coverage across retries | Provider payment, provider cancellation, verified auto-debit, automatic renewal reminders |
| 03 | A trip readiness review with retained links to packing, documents, tagged expenses and home commitments | The user edits a packing row, opens a document, or tags an expense in its owning module | Applying or reversing home changes, changing dates after approval, or reconciling an uncertain activation | An active trip means chores/meals were changed; document expiry checks prove entry eligibility |
| 05 | Open/import an existing PT plan, review slots, link back to its next workout and weekly progress | Navigating to Fitness or opening the existing measurement form | Placing slots, mirroring completion, retrying set logs or sharing progress | An arbitrary-goal planner, automatic exercise prescription, new conversational Fitness commands |

“Shared contract” means a small agreement at a real boundary, usually a shared type/helper and the owning module's write protocol. It does not imply a global event bus, universal entity table, distributed transaction across all modules, or another offline queue. See [C1–C7](SHARED-DEPENDENCIES.md#proposed-contracts).

## Why these five, rather than plausible but unsupported stories

The [atlas capability map](../01-atlas/CAPABILITY-MAP.md) covers money, schedule, kitchen, health, fitness, outfits, travel, household, assistant and platform modules. Cross-checking the strongest edges in source led to these choices:

- **Busy week:** concrete daily intent, checklists, occurrence expansion and flexible slots support execution. A full “AI optimizes my life” claim is not supported. [Day-plan route](../../../src/app/api/day-plans/route.ts#L65), [occurrence helper](../../../src/lib/utils/dayOccurrences.ts#L35).
- **Meals/groceries:** the registered `recipe.ingredients`, `meal.assign` and `shopping.add` path is unusually reusable, but explicitly lacks deduplication and stock subtraction. [Registry:327–358](../../../src/features/era/capabilities/registry.ts#L327).
- **Trip:** an existing junction with usable planner records and trip-tagged spending; the disabled cascade sets its scope. [Kill switch](../../../src/features/trips/cascade.ts#L8), [spend aggregation](../../../src/lib/tripSpend.ts#L26).
- **Renewal:** a recurring commitment is evidence of an upcoming decision. Existing transaction matching can close the loop without inventing payment-provider integration. [Coverage resolver](../../../src/features/era/intents/resolvers/budgetFamilies.ts#L140).
- **Goal → commitments:** constrain this to an existing fitness/PT plan, where activation, weekly slots, sessions and rewards are implemented. No general goal entity is needed for this selected slice. [Plan validation](../../../src/lib/fitness/ptPlan.ts#L132), [finish/mirror migration](../../../migrations/2026-10-12_fitness-module.sql#L1003).

Alternatives deferred: a medication adherence journey has strong existing Schedule mirroring but adds sensitive health rules and overlaps the atlas's existing medication critical flow; outfit-to-trip packing lacks the documented wardrobe planning implementation; fully autonomous debt/savings goals would couple money mutations without an evidenced general goal lifecycle. These are prioritization choices, not claims that the underlying modules lack value. [Atlas critical flows](../01-atlas/CRITICAL-FLOWS.md), [capability map, health/outfits](../01-atlas/CAPABILITY-MAP.md#14-health-and-body).

## Adoption order within each opportunity

1. **Retain context through links.** Keep selected IDs, date window and actor; open the existing precision tool. Do not copy its source facts into a second editable store.
2. **Add bounded orchestration only where it saves repeat entry.** A proposed plan names exact effects, keeps per-step receipts and stops on changed source data. Extend existing ERA execution conventions for registered capabilities; new module adapters are still work.
3. **Add proactive entry only after the outcome can be verified.** Opt-in signals need coverage/freshness and a last-run trace. An absent scheduler or denied notification permission leaves an in-app review available.

Existing execution receipts prevent replay of known completed registered steps; they do not make every underlying API idempotent. Shopping and recurring payment write limitations remain even when wrapped by a journal. [Execution client:138](../../../src/features/era/execution/client.ts#L138), [shopping registry constraint:358](../../../src/features/era/capabilities/registry.ts#L358), [recurring confirmation sequence:215](../../../src/app/api/recurring-payments/[id]/route.ts#L215).

## Measures of value for a future owner trial

These are proposed observations, not analytics implemented by this task. Check whether the person reaches the named outcome with fewer repeated entries: one weekly review with explicit unresolved conflicts; covered meal slots plus known grocery spend; a handled renewal without double spend; a ready trip with accounted costs and home decisions; a completed training week supported by sessions. Also count reopened/uncertain steps and corrections. A low tap count with wrong facts is failure.

Owner decisions D1–D8 and deployment unknowns are centralized in [README](README.md#unresolved-owner-decisions). This ranking does not authorize implementation, activation of disabled features, migrations, or data changes.
