---
created: 2026-11-06
type: research
status: proposed-design
analyzed_commit: 9cd4166691edd9367ea1bd9a604e0bec13ffe870
---

# ERA life journeys

Five opportunities to turn existing ERA records and actions into completed real-life outcomes. This is a standalone documentation study, not an implementation plan, product change, or new PM queue.

## Read this pack

| File | Outcome |
|---|---|
| [CROSS-MODULE-OPPORTUNITIES.md](CROSS-MODULE-OPPORTUNITIES.md) | Ranking, selection rationale, smallest useful slices, and alternatives considered |
| [SHARED-DEPENDENCIES.md](SHARED-DEPENDENCIES.md) | Ownership, handoff, consent, freshness, time, duplicate and recovery contracts |
| [JOURNEY-01.md](JOURNEY-01.md) | Get through a busy week with realistic daily commitments |
| [JOURNEY-02.md](JOURNEY-02.md) | Feed the household within a grocery cap and record the actual spend |
| [JOURNEY-03.md](JOURNEY-03.md) | Prepare for a trip, account for its costs, and return without losing home commitments |
| [JOURNEY-04.md](JOURNEY-04.md) | Review an upcoming renewal and record its real outcome once |
| [JOURNEY-05.md](JOURNEY-05.md) | Turn an existing fitness plan into weekly commitments and recorded workouts |

Journey numbers are scenario identifiers, not priority. Recommended priority is **01 → 02 → 04 → 03 → 05**. Each journey includes an independently readable failure/recovery section; the shared document supplies common semantics.

## Evidence and limits

Analyzed on **2026-11-06, Asia/Beirut**, at commit **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**. Initial tracked working tree was clean; pre-existing untracked `16-product-research/` and `RemainingTASKS.MD` were outside this study. Only the eight new Markdown files in this directory are deliverables.

Both requested packs were available and consulted: [01-atlas](../01-atlas/README.md), especially its capability map and critical flows, and [08-shared-data](../08-shared-data/README.md), especially its source-of-truth matrix and cross-module contracts. Their evidence cutoffs are `53443c0` and `77141d1` respectively. `git diff --stat 53443c0..HEAD -- src migrations` returned no changes. That supports reuse of their findings, but does not establish runtime behavior. Critical seams below were also read directly in this session.

Labels throughout:

- **CURRENT:** repository implementation inspected at the analyzed commit, not a claim that it is deployed or works on a phone.
- **DOCUMENTED INTENT:** a vault or feature-map statement; subordinate to source when they disagree.
- **PROPOSED:** a new interaction, rule, event name, integration, or guarantee described by this study. Unqualified steps under a proposed-interaction heading are proposals.
- **UNKNOWN:** needs owner evidence, runtime observation, or an implementation decision. No live database, external account, scheduler, device, paid API, or user data was queried.

The DB snapshot is historical (2026-08-04). Schema columns and migration bodies are evidence of repository contracts, not current RLS or applied migrations. Fitness and several other capabilities have migration dependencies whose live application is unknown. Existing research findings are not silently promoted into verified production defects.

## What materially changes the proposals

| Evidence boundary | Consequence for these journeys |
|---|---|
| ERA has a bounded capability registry and a durable execution journal, not arbitrary access to every module. | Reuse its consent/checkpoint model; proposed journey adapters still need implementation. Opening Fitness or Trips is not controlling it. |
| Recurring payments have manual confirm and mark-covered paths; the six cron routes contain no recurring-payment runner. | Reviewing or logging a renewal does not pay a provider, cancel a subscription, or prove an automatic debit occurred. |
| `TRIP_CASCADE_ENABLED = false`. | Activation creates a trip account but does not pause home schedules, skip meals, or reassign chores. |
| Shopping check-off changes the shopping row; recipe shopping has no automatic deduplication or stock subtraction. | Purchase, expense, pantry and cooking are separate facts and confirmations. |
| Meal coverage already distinguishes visibility, leftovers, person and skipped meals. | Reuse `mealCoversDate`; a visible calendar card is not evidence somebody is fed. |
| Fitness already mirrors Schedule completion and uses operation receipts. | Reuse this integration; a generic goal engine or second workout scheduler adds little value. |

These discrepancies are recorded here rather than editing existing documentation, as requested.

## Source register

Line numbers identify inspected entry points; follow the linked file for surrounding logic. The journeys also cite their local implementation claims.

| ID | Evidence read | Supports |
|---|---|---|
| E01 | [Capability map](../01-atlas/CAPABILITY-MAP.md), [source-of-truth matrix](../08-shared-data/SOURCE-OF-TRUTH-MATRIX.md) | Whole-repository selection; current versus documented-only scope |
| E02 | [registry.ts:311](../../../src/features/era/capabilities/registry.ts#L311), [reach.ts:58](../../../src/features/era/reach.ts#L58) | Limited assistant mutations; Trips/Fitness navigation boundaries |
| E03 | [execution/state.ts:82](../../../src/features/era/execution/state.ts#L82), [execution/client.ts:138](../../../src/features/era/execution/client.ts#L138) | Run states, original date/zone, confirmed progress and resume |
| E04 | [day-plans/route.ts:65](../../../src/app/api/day-plans/route.ts#L65), [dayOccurrences.ts:35](../../../src/lib/utils/dayOccurrences.ts#L35), [WebDayPlanner.tsx](../../../src/components/planner/WebDayPlanner.tsx) | Saved daily intent/checklist versus actual Schedule occurrences |
| E05 | [mealPlanCoverage.ts:37](../../../src/lib/mealPlanCoverage.ts#L37), [chef.ts:191](../../../src/features/era/intents/resolvers/chef.ts#L191) | Leftover/person coverage and failed-read handling |
| E06 | [meal-plans/add-to-shopping/route.ts:88](../../../src/app/api/meal-plans/add-to-shopping/route.ts#L88), [hub/messages/route.ts:1038](../../../src/app/api/hub/messages/route.ts#L1038) | Ingredients to message IDs; check-off does not restock or spend |
| E07 | [budget-allocations/route.ts:238](../../../src/app/api/budget-allocations/route.ts#L238), [date.ts:55](../../../src/lib/utils/date.ts#L55) | Explicit billing window and spend exclusions |
| E08 | [cascade.ts:8](../../../src/features/trips/cascade.ts#L8), [activate/route.ts:97](../../../src/app/api/trips/[id]/activate/route.ts#L97), [complete/route.ts:32](../../../src/app/api/trips/[id]/complete/route.ts#L32) | Disabled travel cascade |
| E09 | [tripAccess.ts:13](../../../src/lib/tripAccess.ts#L13), [tripSpend.ts:26](../../../src/lib/tripSpend.ts#L26), [spend/route.ts:42](../../../src/app/api/trips/[id]/spend/route.ts#L42) | Household access and per-currency union of tagged/account spending |
| E10 | [recurring confirm:197](../../../src/app/api/recurring-payments/[id]/route.ts#L197), [mark-covered:66](../../../src/app/api/recurring-payments/[id]/mark-covered/route.ts#L66), [budgetFamilies.ts:140](../../../src/features/era/intents/resolvers/budgetFamilies.ts#L140) | Distinct new-spend and existing-spend coverage paths; replay limitations |
| E11 | [commitments.ts:90](../../../src/features/recurring/commitments.ts#L90), [cron directory](../../../src/app/api/cron) | Custom billing period; no recurring auto-post runner found |
| E12 | [ptPlan.ts:132](../../../src/lib/fitness/ptPlan.ts#L132), [Fitness hooks:57](../../../src/features/fitness/hooks.ts#L57), [server.ts:17](../../../src/lib/fitness/server.ts#L17) | Validated plans, receipts, offline and setup-pending behavior |
| E13 | [Fitness migration:1003](../../../migrations/2026-10-12_fitness-module.sql#L1003), [mirror:1114](../../../migrations/2026-10-12_fitness-module.sql#L1114) | Atomic finish, Schedule mirror, deterministic rewards |
| E14 | [schema.sql:192](../../../migrations/schema.sql#L192), [:330](../../../migrations/schema.sql#L330), [:1072](../../../migrations/schema.sql#L1072), [:1166](../../../migrations/schema.sql#L1166), [:1609](../../../migrations/schema.sql#L1609), [:1703](../../../migrations/schema.sql#L1703) | Recurring, budget, stock, meals, trips and day-plan fields |
| E15 | [activity-log/route.ts:70](../../../src/app/api/activity-log/route.ts#L70) | Activity read checks current source privacy; history is not current state |

## Consistency pass and validation boundary

One final consistency pass was performed: all eight requested files are present; relative source targets and cited line bounds resolve; every journey has all required sections; ranking, decision IDs, fictional arithmetic and current/proposed boundaries were reviewed. Three failure-table labels were made explicit during that pass (stale/revoked trip data and contradictory Fitness completion). The tracked diff remained empty; only this new directory was added alongside the two pre-existing untracked paths.

No application tests or browser/live checks are needed for these new documents; none were run. The repository finish-task code, UI, migration and PM-change gates are not applicable because those surfaces were untouched. This pack specifies acceptance outcomes, not test results. No existing docs, PM files, policies, code, configuration, dependencies, services, or data are changed.

## Unresolved owner decisions

These do not block delivery of this documentation. They block only the dependent future behavior.

| ID | Decision | Recommended design assumption |
|---|---|---|
| D1 | When should journeys surface, and may ERA move commitments? | User-invoked first; optional opted-in briefings later. Show changes and require approval; no silent rescheduling. |
| D2 | What does “within budget” promise when pantry amounts and prices are uncertain? | A visible estimate with unknowns, an explicit account/currency/period, and a user grocery cap; never guaranteed affordability. |
| D3 | Should shopping check-off offer expense capture and pantry restock? | Optional linked steps with separate acknowledgements; checking a row alone means bought only. |
| D4 | How far should travel affect home routines? | Planner plus explicit module links first. Keep the cascade disabled; any future cascade requires conflict-aware reversal and independent verification. |
| D5 | Does “renewal handled” mean reviewed, paid, or cancelled externally? | Keep these distinct. Store payment coverage only from a confirmed transaction; record external cancellation only from user evidence. |
| D6 | Is the goal journey initially fitness-only, and what can a partner see? | Fitness-first using an existing plan; private workouts and measurements, existing opt-in aggregate summary only. |
| D7 | Which zone governs a traveling person's routines, and how are DST ambiguities resolved? | Preserve each commitment's original zone; ask before changing it. For a new ambiguous/nonexistent wall time, request a concrete choice. |
| D8 | How long should a saved journey proposal remain resumable? | Keep minimal owner-bound progress and source references; revalidate on every resume. Retention period and deletion UX remain undecided. |

Deployment evidence remains an external unknown, distinct from these product decisions: applied Fitness/item/journal migrations, current RLS, notification permission and scheduler execution. Repository presence alone settles none of them.
