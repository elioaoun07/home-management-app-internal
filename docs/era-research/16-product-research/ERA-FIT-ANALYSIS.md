# ERA fit analysis

Verified **2026-11-06**. Analyzed HEAD: `9cd4166691edd9367ea1bd9a604e0bec13ffe870`; inspected working-copy files, with Git cleanliness unknown as explained in [README](README.md). This is a source review, not a deployed acceptance test.

## Scope: ERA is the household application

### CURRENT IMPLEMENTATION

The following inventory separates executable boundaries from navigation and documentation. A source path's presence does not certify its live deployment.

| Capability area | Inspected evidence | What can safely be concluded |
| --- | --- | --- |
| Everyday capture and assistant | [captureAssist.ts](../../../src/features/era/captureAssist.ts), `AssistState`/`AssistToken`; [useEraTurn.ts](../../../src/features/era/useEraTurn.ts), `useEraTurn`; [captureMemory.ts](../../../src/lib/era/captureMemory.ts), `recallExpense`/`preferredThread`/`recallGroup`. | Typed/voice turns share orchestration; interpretation and prior choices can be reused. The recall helper is deterministic, not an always-on model. |
| Personal planning, tasks, events, calendar | [WebDayPlanner.tsx](../../../src/components/planner/WebDayPlanner.tsx), `WebDayPlanner`; [dayOccurrences.ts](../../../src/lib/utils/dayOccurrences.ts), `expandOccurrencesInRange`/`getOccurrencesForDay`; [useDayPlan.ts](../../../src/features/day-plan/useDayPlan.ts), `useDayPlan`/`useChecklistActions`. | Existing source APIs and planner components combine scheduled items, occurrence actions, flexible placements, and a day checklist. This is a foundation for triage, not proof of workload optimization. |
| External calendar | [gcal/sync.ts](../../../src/lib/gcal/sync.ts), `isSyncEligible` and one-way contract; [GoogleCalendarSettings.tsx](../../../src/components/settings/GoogleCalendarSettings.tsx), `GoogleCalendarSettings`; [gcal-reconcile route](../../../src/app/api/cron/gcal-reconcile/route.ts), `reconcile`. | ERA → Google backup code exists for scheduled reminders/events; Google is not read back by this path. Connection/sync status and reconciliation exist in code. Actual connection and cron execution are unknown. |
| Budget and accounts | [WebBudget.tsx](../../../src/components/web/WebBudget.tsx), `OwnershipToggle` and budget hook imports; [budget/hooks.ts](../../../src/features/budget/hooks.ts), `useBudgetAllocations`; [budgetForecast.ts](../../../src/lib/budget/budgetForecast.ts), `buildStatisticalSuggestion`; [ai-suggest route](../../../src/app/api/budget-allocations/ai-suggest/route.ts), `POST`. | Household ownership views, explicit range-aware budget reads, historical suggestions, and deterministic fallback exist. These are more than transaction logging. They do not establish a coherent one-step reallocation workflow. |
| Meals and recipes | [mealPlanCoverage.ts](../../../src/lib/mealPlanCoverage.ts), `mealCoversDate`/`getMealActiveDates`; [chef.ts](../../../src/features/era/intents/resolvers/chef.ts), `resolveMealPlanGaps`/`resolveAssignMeal`; [ChefDashboard.tsx](../../../src/components/era/dashboards/ChefDashboard.tsx), `useRecipeData`. | Saved recipe context, assignment, meal coverage including leftovers, and viewer-specific gaps exist. Gap detection is whole-day coverage, not proof that every meal slot is filled. |
| Shopping and pantry | [AddToShoppingDialog.tsx](../../../src/components/web/AddToShoppingDialog.tsx), `handleAddToShopping`; [meal add-to-shopping route](../../../src/app/api/meal-plans/add-to-shopping/route.ts), `POST`; [inventory/hooks.ts](../../../src/features/inventory/hooks.ts), `inventoryKeys`/`fetchInventoryItemsWithStock`. | Selected recipe ingredients can become shopping messages; inventory/low-stock reads exist. The dialog initially selects every ingredient and chooses the first shopping thread. Pantry-aware quantity subtraction is not present in that inspected journey. |
| Household coordination | [accounts route](../../../src/app/api/accounts/route.ts), `fetchAccountList`; [capture-memory route](../../../src/app/api/era/capture-memory/route.ts), `shoppingRows`; [day-plan types](../../../src/features/day-plan/types.ts), `DayPlansResponse`. | Partner-aware access, private/shared distinctions, owner-specific capture history, and separate own/partner plans are represented. Authorization must be established per source; membership is not universal write permission. Live RLS was not inspected. |
| Knowledge and context | [memories route](../../../src/app/api/memories/route.ts), `GET`/`POST`; [brain.ts](../../../src/features/era/intents/resolvers/brain.ts), `resolveMemoryRecall`; [eraAdaptiveContext.ts](../../../src/lib/ai/eraAdaptiveContext.ts), `AdaptiveContext`/`ContextReceipt`; [eraAdaptiveContextSource.ts](../../../src/lib/ai/eraAdaptiveContextSource.ts), `fetchAdaptiveContext`. | Household label/value memories coexist with owner-scoped conversational evidence. Adaptive context has explicit/observed choices, coverage and source identifiers. This is not a general cross-app knowledge index. |
| Follow-through and recovery | [notifications/registry.tsx](../../../src/lib/notifications/registry.tsx), `NOTIFICATION_REGISTRY`; [execution/state.ts](../../../src/features/era/execution/state.ts), `RunState`/`DURABLE_EXECUTION`; [useEraArtifacts.ts](../../../src/features/era/widgets/useEraArtifacts.ts), `reversalOf`. | Notification actions, a gated progress journal, source status checks and supported artifact reversals exist. Neither universal Undo nor journal rollout can be inferred. |
| Wider personal modules | [reach.ts](../../../src/features/era/reach.ts), `ERA_REACH`; application/feature directory inventory. | Chores, trips, healthcare, outfits, fitness, catalogue, NFC, debts, analytics, drafts, statement import, transfers and watch surfaces are represented. Reach distinguishes navigation, prefill, inline and verified levels. This review does not certify every module's complete workflow. |
| PM/Delivery | [pm/live/page.tsx](../../../src/app/pm/live/page.tsx), `PmLivePage`. | A route mounts the Command Center or legacy PM view. This is a part of ERA; no household concept here depends on Delivery dispatch machinery. |

### DOCUMENTED INTENT

The [Design Doctrine](<../../../ERA Notes/01 - Architecture/Design Doctrine.md>) describes two people plus an assistant, near-zero capture cost, foresight, source-owned operations, offline resilience, Undo, and proposals before AI writes. These are design requirements, not blanket statements about today's compliance.

The [Plan My Day overview](<../../../ERA Notes/03 - Junction Modules/Plan My Day/Overview.md>) specifies a triage-first, save-gated day plan and explicitly defers hourly timeline and energy optimization. The [Meal Planning overview](<../../../ERA Notes/03 - Junction Modules/Meal Planning/Overview.md>) describes household assignment/leftovers and lists further nutrition and weekly shopping ambitions. The [Budget Allocation overview](<../../../ERA Notes/02 - Standalone Modules/Budget Allocation/Overview.md>) describes non-destructive inline suggestions with reasoning and manual values taking precedence.

### UNKNOWN

Production flag values, applied migrations, effective RLS, enabled cron schedules, notification arrival, real household usage, parse accuracy and pantry data reliability remain unknown. Neither old PM completion stamps nor source comments prove those operational states.

## Pattern-by-pattern fit

External pattern IDs refer to [PRODUCT-PATTERNS](PRODUCT-PATTERNS.md#candidate-pattern-ledger). Each classification concerns the complete named pattern. Subparts may already be implemented.

### P01 — editable capture and contextual defaults

**Fit: already present** for the core pattern.

**CURRENT IMPLEMENTATION:** `captureAssist.ts` represents interpretation tokens and selectable fields. `captureMemory.ts` aggregates prior expenses/titles/shopping rows and derives usual targets. `useEraCaptureMemory` returns empty memory on an unavailable read so basic parsing remains possible. The [capture-memory route](../../../src/app/api/era/capture-memory/route.ts) reads own spends/titles and permitted household shopping lists; it is not a license to suggest private partner accounts.

**DOCUMENTED INTENT:** Fast conversational capture, with precision forms for detailed control (Doctrine).

**PROPOSED DESIGN:** Preserve this path. C1 adds recovery around it; a second capture interface or new inferred-default store is unnecessary.

**UNKNOWN:** Real-world correction success and persistence of an unsent sentence after process termination. `pendingTranscript` in [useEraStore.ts](../../../src/features/era/useEraStore.ts) is ordinary Zustand state, not evidence of durable draft storage.

### P02 — reviewed batch capture

**Fit: partly present.**

**CURRENT IMPLEMENTATION:** [capabilities/plan.ts](../../../src/features/era/capabilities/plan.ts), `planSchema`/`validatePlan`, permits at most **six** registered steps. [useEraAskAI.ts](../../../src/features/era/useEraAskAI.ts), `assertRequestActive`, binds confirmation to owner, conversation and time zone. [registry.ts](../../../src/features/era/capabilities/registry.ts), `shoppingAdd`, accepts a bounded item array; `ingredients` supplies saved recipe facts.

**DOCUMENTED INTENT:** AI proposes, the user reviews, source operations execute.

**PROPOSED DESIGN:** C1 should expose the existing batch's state and resume boundary, not invent an unbounded “handle everything” agent.

**UNKNOWN:** A general multi-domain spoken capture preview with row-by-row corrections and durable unsent items. Existing plan execution does not prove that interaction. Arrays of shopping texts and a six-step plan are different limits.

### P03 — deliberate daily triage and carryover

**Fit: partly present.**

**CURRENT IMPLEMENTATION:** `useDayPlan`, checklist check-off/Undo, and the occurrence helpers provide a selected-day plan backed by existing schedule facts. [WebDayPlanner.tsx](../../../src/components/planner/WebDayPlanner.tsx) imports the existing flexible scheduling and item action hooks rather than a separate recurrence engine.

**DOCUMENTED INTENT:** The Plan My Day overview explicitly chooses triage first and describes push-off/prepone and draft Save/Cancel.

**PROPOSED DESIGN:** C2 adds an optional short “rest of today” review with keep/move/leave-unscheduled choices. Carryover should be deliberate, not a nightly blanket date change.

**UNKNOWN:** A complete duration/capacity model, saved interruption state for the planner editor, or household agreement to a daily ritual.

### P04 — preview a conflict-aware schedule change

**Fit: partly present** for review infrastructure; **missing at the inspected boundary** for a household day-reset workflow.

**CURRENT IMPLEMENTATION:** `useEraAskAI`/`validatePlan` offer bounded confirmed actions. The [registry](../../../src/features/era/capabilities/registry.ts), `reminderReschedule`, is limited to owned, open, non-recurring reminders. It is not a general occurrence-aware rescheduler. [gcal/sync.ts](../../../src/lib/gcal/sync.ts) supplies outbound backup, not incoming busy time.

**DOCUMENTED INTENT:** Reuse one occurrence engine and protect schedule correctness before foresight (Doctrine).

**PROPOSED DESIGN:** C2 previews a few legal changes to ERA's known schedule, with explicit unknown-calendar coverage. Fixed/shared appointments remain protected by default.

**UNKNOWN:** Full external-calendar conflicts, travel buffers, reliable task durations, or deployed readiness for a new bulk move adapter. No scheduler algorithm should be inferred from stored `rest|balanced|productive` intent.

### P05 — explain a budget tradeoff

**Fit: partly present.**

**CURRENT IMPLEMENTATION:** [budgetForecast.ts](../../../src/lib/budget/budgetForecast.ts), `aggregateCleanMonthlyByCategory`/`computeCategoryBaselines`/`buildStatisticalSuggestion`, cleans history and supplies estimates. The [ai-suggest route](../../../src/app/api/budget-allocations/ai-suggest/route.ts) stores generation method, summary and excluded-outlier count. These are useful explanation foundations.

**DOCUMENTED INTENT:** The Budget overview describes visible reasoning and manual control. Custom billing periods and dual-currency household reality are deliberate (Doctrine).

**PROPOSED DESIGN:** C3 turns one shortfall into a small set of allocation alternatives with consequences and evidence.

**UNKNOWN / drift to resolve:** [context.ts](../../../src/lib/ai/context.ts), `fetchBudgetContext`, constructs calendar-month dates, whereas `useBudgetAllocations` accepts an explicit custom-month range. The ai-suggest path aggregates history by `YYYY-MM` and sums selected wallet balances numerically; this inspection does not establish consistent currency normalization. These boundaries must be reconciled before a trusted tradeoff calculation. The reviewed registry does not register a budget-reallocation action.

### P06 — plan-to-shopping reuse with pantry hints and consolidation

**Fit: partly present; missing for automatic stock subtraction/deduplication in the inspected assistant path.**

**CURRENT IMPLEMENTATION:** `mealCoversDate` distinguishes display from whether a person is fed. `resolveMealPlanGaps` returns failure on unavailable data rather than declaring every day empty. `recipe.ingredients` exposes actual recipe ingredients. `shoppingAdd.constraints` explicitly says **no automatic deduplication or stock subtraction** and warns that a partial batch is unsafe to replay. `AddToShoppingDialog` initially selects all ingredients. [Meal add-to-shopping POST](../../../src/app/api/meal-plans/add-to-shopping/route.ts) inserts messages and then updates meal/thread metadata in separate operations.

**DOCUMENTED INTENT:** The Meal Planning overview lists full-week shopping generation as a future requirement.

**PROPOSED DESIGN:** C4 builds a reviewed delta, first using exact compatible quantities and user-confirmed “have it” choices.

**UNKNOWN:** Reliable ingredient identity, unit compatibility, pantry freshness, safe whole-batch retry and a single shared receipt across meal/shopping writes. Existing status fields do not prove exactly-once transfer.

### P07 — coordinate affected people without assuming shared authority

**Fit: partly present.**

**CURRENT IMPLEMENTATION:** `fetchAccountList` checks an active partner and selected visibility rules; capture-memory shopping reads filter private threads; `DayPlansResponse` separates mine/partner. [Notification registry](../../../src/lib/notifications/registry.tsx) supplies actions and destinations. These establish person/source distinctions, not universal collaboration permissions.

**DOCUMENTED INTENT:** The Doctrine's Partner Question and person-absolute identity apply to every proposal.

**PROPOSED DESIGN:** C2/C4 show whose commitments/meal coverage change. A proposed assignment is not accepted responsibility. Any change alert should target affected people and exclude the initiating person when appropriate.

**UNKNOWN:** Consistent recipient suppression/acknowledgement across all producers. Cozi's broadly shared credentials/data model is rejected for ERA.

### P08 — scoped retrieval with evidence and age

**Fit: partly present; missing in the inspected simple recall result for source identity.**

**CURRENT IMPLEMENTATION:** [memories GET](../../../src/app/api/memories/route.ts) filters labels with `ilike`, orders by `updated_at`, and returns household rows. [resolveMemoryRecall](../../../src/features/era/intents/resolvers/brain.ts) takes the first hit and returns label/value metadata without the row ID or timestamp. Its “closest match” comment is not evidence of semantic ranking. [Adaptive context](../../../src/lib/ai/eraAdaptiveContext.ts) already separates explicit/observed choices and exposes coverage/source receipts; [fetchAdaptiveContext](../../../src/lib/ai/eraAdaptiveContextSource.ts) retrieves owner-scoped evidence with bounded reads.

**DOCUMENTED INTENT:** Reuse captured facts without silently promoting observations to defaults (Doctrine plus the adaptive-context source contract).

**PROPOSED DESIGN:** C5 exposes a source-aware answer with a scope control and ambiguity handling. Reuse current evidence, not a second memory store.

**UNKNOWN:** General searchable personal documents, permission-safe cross-module retrieval, and user-visible citations for every AI answer. The current simple memory API requires a household; unlinked users get an empty read, which must not be mistaken for a technical error or a universal personal-memory solution.

### P09 — explicit recovery and commit state

**Fit: partly present.**

**CURRENT IMPLEMENTATION:** [useEraConversation.ts](../../../src/features/era/useEraConversation.ts) includes History/New chat selection; [focusRehydrate.ts](../../../src/features/era/focusRehydrate.ts), `focusFromMessages`, reconstructs recent editable context; [useEraHandoff.ts](../../../src/features/era/useEraHandoff.ts) handles ready/expired/consumed/missing form handoffs. [execution/state.ts](../../../src/features/era/execution/state.ts) defines running/waiting/uncertain steps and a time-zone/date anchor. [useEraRuns.ts](../../../src/features/era/execution/useEraRuns.ts) queries only when `DURABLE_EXECUTION` is enabled. [useEraArtifacts.ts](../../../src/features/era/widgets/useEraArtifacts.ts) checks live/trashed/changed/gone status and exposes supported reversals.

**DOCUMENTED INTENT:** Offline is a normal constraint; uncertain writes must not become duplicate actions. The [Sync overview](<../../../ERA Notes/03 - Junction Modules/Sync & Offline/Overview.md>) documents feature-specific held item creates and bulk limitations.

**PROPOSED DESIGN:** C1 unifies the visible return journey without merging execution receipts, unsent drafts, and the offline queue into one mechanism.

**UNKNOWN:** Journal rollout and universal crash-safe unsent drafts. [offlineQueue.ts](../../../src/lib/offlineQueue.ts) has an in-memory fallback; that is not durable storage. [safeFetch.ts](../../../src/lib/safeFetch.ts) distinguishes latency from offline status; timeout alone is not proof that a write failed.

### P10 — restrained, coordinated follow-through

**Fit: partly present** for controls; **unclear** for end-to-end policy enforcement.

**CURRENT IMPLEMENTATION:** [Notification preferences](../../../src/app/api/notifications/preferences/route.ts), `NotificationPreference`, includes enabled/frequency/time-zone/quiet-window fields. [Daily items cron](../../../src/app/api/cron/daily-items-reminder/route.ts) implements time-slot matching and summary construction; its contract describes skipping empty summaries and slot deduplication. `NOTIFICATION_REGISTRY` distinguishes scheduled notifications from system nudges and excludes system nudges from calendar sync. [focus-insights GET](../../../src/app/api/focus-insights/route.ts) returns cached insight age/staleness, but is not a unified household digest.

**DOCUMENTED INTENT:** Proactivity must return attention and preserve trust.

**PROPOSED DESIGN:** All five concepts default to in-app follow-through. User-created reminders retain their own semantics. Optional review nudges use existing preferences/registry, reason/destination, deduplication and explicit freshness; no new daily digest engine is assumed.

**UNKNOWN:** Quiet fields being respected by every sender, push deduplication across Google/ERA/device channels, and scheduler liveness. Existence of a cron file is not evidence it ran.

## Decision

**PROPOSED DESIGN:** Prioritize continuity and explicit decisions over new module breadth. P01 is a preserve decision. P02/P09 motivate C1; P03/P04 motivate C2; P05 motivates C3; P06 motivates C4; P08 motivates C5. P07/P10 constrain every shared or proactive journey. Detailed designs, exclusions and acceptance scenarios are in [SOLUTION-CONCEPTS](SOLUTION-CONCEPTS.md).

The largest practical dependencies are trustworthy source receipts, consistent period/currency semantics, known permissions, and data quality. None is solved by a better prompt alone.

