# Source register and verification record

Research date: **2026-11-06**, Asia/Beirut. Analyzed HEAD: **`9cd4166691edd9367ea1bd9a604e0bec13ffe870`**.

## Evidence standard

**External:** First-party help/manual text supports a documented workflow. It does not prove observed behavior, recommendation quality, delivery reliability or usability. No accounts were created; no product session, integration, purchase or live API was exercised. Retrieval/index freshness is not a vendor release date.

**Repository:** CURRENT IMPLEMENTATION claims are grounded in inspected source paths/symbols below. DOCUMENTED INTENT comes from the separately listed design/module documents. PROPOSED DESIGN is confined to research judgments and concepts. UNKNOWN covers rollout, data quality, live permissions, flags and liveness. Tests mentioned by existing documents were not rerun and are not evidence of this session passing application checks.

## External source register

Every source below was verified on **2026-11-06**. Full URLs are retained to make the snapshot re-checkable. “Opened” means readable body through the public web tool, not authenticated or hands-on use.

| ID | Product / source | Access and version qualification | Supports |
| --- | --- | --- | --- |
| T1 | Todoist — [Use Task Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz) | Opened; page shows updated 2026-09-01. | P01: sentence interpretation and correction. |
| T2 | Todoist — [Dictate to add tasks with Ramble](https://www.todoist.com/help/todoist/todoist-and-ai/dictate-to-add-tasks-with-ramble-P1Raq7vVF) | Opened; page shows updated 2026-10-08; platform/beta distinctions retained. | P02: preview and contextual capture. |
| S1 | Sunsama — [Daily Planning: the basics](https://help.sunsama.com/docs/getting-started/basics/daily-planning-the-basics/) | Opened current user manual; no publication date relied upon. | P03: daily triage sequence. |
| S2 | Sunsama — [Account Settings](https://help.sunsama.com/docs/settings/user-settings/) | Opened; selected workload/ritual/rollover sections inspected. | P03/P10: configurable planning behavior. |
| S3 | Sunsama — [Task rollover: the basics](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/) | Opened via the manual's actual link. | Rollover boundary; not proof of interrupted-editor persistence. |
| R1 | Reclaim — [Reclaim 2.0 FAQ](https://help.reclaim.ai/en/articles/15280604-reclaim-2-0-faq) | Opened; explicitly version 2.0, relative update stamp only. | P04: staging and rule-based calendar changes. |
| R2 | Reclaim — [Manage notifications for Reclaim events](https://help.reclaim.ai/en/articles/6179615-manage-notifications-for-reclaim-events) | Opened; page says 1.0 and 2.0; provider exceptions retained. | P10: channel/default limitations. |
| Y1 | YNAB — [Moving Money in Your Plan](https://support.ynab.com/moving-money-in-your-plan-ryyCKbBJi) | First-party search extraction readable; direct open had no body. Extract shows 2026-09-03. Lower confidence. | P05: explicit tradeoff and history. |
| Y2 | YNAB — [Handling Overspending](https://support.ynab.com/en_us/overspending-in-ynab-a-guide-ryWoxEyi?mobile-help=true) | First-party search extraction readable; direct open had no body. Extract shows 2026-09-09 and platform rollout caveats. Lower confidence. | P05: shortfall-driven adjustment. |
| P1 | Paprika — [User Guide for Windows](https://www.paprikaapp.com/help/windows/) | Opened; explicitly Paprika 3, separate version 4 beta link. | P06/P09: meal/grocery reuse and sync visibility. |
| C1 | Cozi — [Family Organizer FAQs](https://www.cozi.com/faq/) | Opened. Contains overlapping sections and dated platform references; notification/access passages used narrowly. | P07/P10: recipient selection and opt-in agendas. |
| N1 | Notion — [Enterprise Search](https://www.notion.com/help/enterprise-search) | Opened current help; documented plan/model limits retained. | P08: source scope and citations. |
| N2 | Notion — [Search in your workspace](https://www.notion.com/help/search) | Opened current help. | P08/P09: filters and return paths. |

### Access exclusions and evidence caveats

- The guessed Sunsama URL ending `task-rollover-the-basics/` failed. S3 is the reachable link discovered from S1; the failed URL is not used as evidence.
- YNAB direct-open failures are recorded rather than represented as complete page inspection. Search extraction provided meaningful first-party instructions, but no platform behavior was tested.
- Cozi's FAQ contains overlapping account-deletion/platform statements. No deletion, encryption, security certification or minimum-OS conclusion is drawn from it.
- Paprika's Windows guide is version-scoped. Other platform manuals appeared in search but are not silently generalized into one verified cross-platform behavior.
- Reclaim items labeled “coming soon” are not counted as shipped workflows.
- Notion product marketing and research-mode promotional pages appeared during discovery; productivity/speed/accuracy claims are not used. Search results from third-party reviews, Reddit and aggregators are excluded.
- No source establishes reliable crash recovery for an unsent editor unless the package explicitly says otherwise. Lack of documentation is not proof of lack of support.

## Repository evidence register

All paths below were inspected during this session. Links are relative to the repository. Symbols are navigation aids, not claims that every caller was traced. Source comments were checked against executable structure where the conclusion depends on it; live deployment was not checked.

| ID | Source / symbols | Evidence boundary |
| --- | --- | --- |
| E01 | [Feature Map index](<../../../ERA Notes/01 - Architecture/Feature Map/_index.md>) and selected standalone/junction maps | Routing and breadth; an index is not behavioral proof. |
| E02 | [Design Doctrine](<../../../ERA Notes/01 - Architecture/Design Doctrine.md>) | DOCUMENTED INTENT: capture, household, trust, one engine, offline and priorities. |
| E03 | [captureMemory.ts](../../../src/lib/era/captureMemory.ts): `aggregateExpenses`, `aggregateShopping`, `recallExpense`, `preferredThread`, `recallGroup` | Existing deterministic recall/default foundations. |
| E04 | [capture-memory GET](../../../src/app/api/era/capture-memory/route.ts): `shoppingRows`, `GET`; [useEraCaptureMemory.ts](../../../src/features/era/useEraCaptureMemory.ts): `useEraCaptureMemory` | Own capture history, visible lists and empty-memory degradation. |
| E05 | [captureAssist.ts](../../../src/features/era/captureAssist.ts): `captureGhost`, `captureTokens`, `captureMarks`; [useEraCapture.ts](../../../src/features/era/useEraCapture.ts): `learnedCategory`, `useEraCapture` | Editable interpretation, explicit/learned field precedence and account/currency restrictions. |
| E06 | [useEraTurn.ts](../../../src/features/era/useEraTurn.ts): `useEraTurn`; [useEraAskAI.ts](../../../src/features/era/useEraAskAI.ts): `assertRequestActive`, `useEraAskAI` | Common turn orchestration and owner/conversation/time-zone checks. Full model quality untested. |
| E07 | [capabilities/registry.ts](../../../src/features/era/capabilities/registry.ts): `ERA_CAPABILITIES`, `reminderReschedule`, `ingredients`, `shoppingAdd`; [plan.ts](../../../src/features/era/capabilities/plan.ts): `MAX_PLAN_STEPS`, `validatePlan` | Registered scope, semantic limits and six-step bound. |
| E08 | [reach.ts](../../../src/features/era/reach.ts): `ERA_REACH` | Distinguishes navigation/native reach from registered model execution. Its “verified” field is historical metadata, not a test run here. |
| E09 | [WebDayPlanner.tsx](../../../src/components/planner/WebDayPlanner.tsx); [useDayPlan.ts](../../../src/features/day-plan/useDayPlan.ts): `useDayPlan`, `useChecklistActions`; [day-plan/types.ts](../../../src/features/day-plan/types.ts) | Planner integration, day-plan/checklist contract and mutation hooks. |
| E10 | [dayOccurrences.ts](../../../src/lib/utils/dayOccurrences.ts): `expandOccurrencesInRange`, `getOccurrencesForDay` | Existing occurrence/placement boundary; not a new optimization algorithm. |
| E11 | [gcal/sync.ts](../../../src/lib/gcal/sync.ts): one-way contract, `isSyncEligible`; [GoogleCalendarSettings.tsx](../../../src/components/settings/GoogleCalendarSettings.tsx); [gcal-reconcile route](../../../src/app/api/cron/gcal-reconcile/route.ts): `reconcile` | Outbound backup/settings/reconciliation code; connection and scheduler state unknown. |
| E12 | [budget/hooks.ts](../../../src/features/budget/hooks.ts): `useBudgetAllocations`; [WebBudget.tsx](../../../src/components/web/WebBudget.tsx): `OwnershipToggle`; [budgetForecast.ts](../../../src/lib/budget/budgetForecast.ts): `aggregateCleanMonthlyByCategory`, `buildStatisticalSuggestion`; [ai-suggest route](../../../src/app/api/budget-allocations/ai-suggest/route.ts): `POST` | Explicit range input, ownership UI, estimation and suggestion metadata. No money-correctness certification. |
| E13 | [ai/context.ts](../../../src/lib/ai/context.ts): `fetchBudgetContext`, `fetchScheduleContext` | Face context; inspected calendar-month and bounded schedule-read limitations. |
| E14 | [mealPlanCoverage.ts](../../../src/lib/mealPlanCoverage.ts): `getMealActiveDates`, `mealCoversDate`; [chef.ts](../../../src/features/era/intents/resolvers/chef.ts): `resolveAssignMeal`, `resolveMealPlanGaps` | Person/leftover/slot coverage and assistant assignment/gap paths. |
| E15 | [AddToShoppingDialog.tsx](../../../src/components/web/AddToShoppingDialog.tsx): `handleAddToShopping`; [meal add-to-shopping route](../../../src/app/api/meal-plans/add-to-shopping/route.ts): `POST`; [inventory/hooks.ts](../../../src/features/inventory/hooks.ts): `inventoryKeys`, `fetchInventoryItemsWithStock` | Current selected-ingredient journey and inventory read seams. Sequential source effects are not atomicity evidence. |
| E16 | [ChefDashboard.tsx](../../../src/components/era/dashboards/ChefDashboard.tsx): `useRecipeData`; [ScheduleDashboard.tsx](../../../src/components/era/dashboards/ScheduleDashboard.tsx): `fetchScheduleData` | Representative personal dashboards; not complete source parity validation. |
| E17 | [accounts route](../../../src/app/api/accounts/route.ts): `fetchAccountList`; capture-memory `shoppingRows` (E04) | Examples of partner/private access logic; live RLS unknown. |
| E18 | [memories route](../../../src/app/api/memories/route.ts): `GET`, `POST`; [brain.ts](../../../src/features/era/intents/resolvers/brain.ts): `resolveMemoryRecall`; [memories/types.ts](../../../src/features/memories/types.ts): `Memory`; [BrainDashboard.tsx](../../../src/components/era/dashboards/BrainDashboard.tsx) | Household facts, simple label search and result/record identity gap. |
| E19 | [eraAdaptiveContext.ts](../../../src/lib/ai/eraAdaptiveContext.ts): `AdaptiveContext`, `ContextReceipt`, `successfulCapabilities`; [eraAdaptiveContextSource.ts](../../../src/lib/ai/eraAdaptiveContextSource.ts): `fetchAdaptiveContext`; [era/ask route](../../../src/app/api/era/ask/route.ts) | Bounded owner evidence and coverage/receipt structure, not a general knowledge index. |
| E20 | [useEraStore.ts](../../../src/features/era/useEraStore.ts): `pendingTranscript`, `resetConversationContext`; [useEraConversation.ts](../../../src/features/era/useEraConversation.ts): New chat/History helpers; [focusRehydrate.ts](../../../src/features/era/focusRehydrate.ts): `focusFromMessages`; [useEraHandoff.ts](../../../src/features/era/useEraHandoff.ts) | Different continuity mechanisms; no universal durable draft inferred. |
| E21 | [execution/state.ts](../../../src/features/era/execution/state.ts): `DURABLE_EXECUTION`, `RunState`; [useEraRuns.ts](../../../src/features/era/execution/useEraRuns.ts) | Gated progress journal; enabled production flag unknown. |
| E22 | [useEraArtifacts.ts](../../../src/features/era/widgets/useEraArtifacts.ts): `reversalOf`, `useEraRowStatus`; [safeFetch.ts](../../../src/lib/safeFetch.ts): `RequestTimeoutError`, `isOfflineError`; [offlineQueue.ts](../../../src/lib/offlineQueue.ts): `OfflineOperation` | Supported inverses, uncertain status, timeout/offline distinction and storage limits. |
| E23 | [notifications/registry.tsx](../../../src/lib/notifications/registry.tsx): `NOTIFICATION_REGISTRY`; [preferences route](../../../src/app/api/notifications/preferences/route.ts): `NotificationPreference`; [daily-items-reminder route](../../../src/app/api/cron/daily-items-reminder/route.ts); [NotificationSettings.tsx](../../../src/components/settings/NotificationSettings.tsx) | Delivery controls/actions and summary code, not proof of every producer's enforcement. |
| E24 | [focus-insights route](../../../src/app/api/focus-insights/route.ts): `GET`, cache constants | Cached/stale insight representation, not a new unified briefing engine. |
| E25 | [PM live route](../../../src/app/pm/live/page.tsx): `PmLivePage` | PM/Delivery entry exists within the broader application. |

### Design and module documents inspected

These support **DOCUMENTED INTENT**, and historical notes are not substituted for current code.

- [AI Assistant overview](<../../../ERA Notes/03 - Junction Modules/AI Assistant/Overview.md>) — capability boundaries, proposals, source artifacts, historical validation caveats.
- [Plan My Day overview](<../../../ERA Notes/03 - Junction Modules/Plan My Day/Overview.md>) — triage-first/save-gated interaction, deferred hourly/energy optimizer.
- [Budget Allocation overview](<../../../ERA Notes/02 - Standalone Modules/Budget Allocation/Overview.md>) — suggestion/estimate explanations and manual control.
- [Meal Planning overview](<../../../ERA Notes/03 - Junction Modules/Meal Planning/Overview.md>) — leftovers, household assignment, future weekly shopping.
- [Shopping List overview](<../../../ERA Notes/03 - Junction Modules/Shopping List/Overview.md>), [Recipes overview](<../../../ERA Notes/02 - Standalone Modules/Recipes/Overview.md>), [Inventory overview](<../../../ERA Notes/02 - Standalone Modules/Inventory/Overview.md>).
- [Household Sharing overview](<../../../ERA Notes/03 - Junction Modules/Household Sharing/Overview.md>), [Notifications overview](<../../../ERA Notes/03 - Junction Modules/Notifications/Overview.md>), [Sync & Offline overview](<../../../ERA Notes/03 - Junction Modules/Sync & Offline/Overview.md>).
- [start-task](../../../.claude/skills/start-task/SKILL.md) and [finish-task](../../../.claude/skills/finish-task/SKILL.md) — repository protocol read; no code/migration lifecycle changes made.

### Observed documentation/source distinctions

1. The Transactions Feature Map still mentions a 3-second CRUD timeout; current `safeFetch.ts` sets 8 seconds. Research uses the source value.
2. The Meal Planning overview retains an older 14-day lookback description, while its newer coverage note and current Chef path use interval-aware coverage. Research uses the shared coverage contract rather than assuming a lookback cap.
3. Native reach, page navigation and the model-executable capability registry differ intentionally. A broad `ERA_REACH` row is not evidence that a model may execute that action.
4. The Brain resolver's “closest match” wording exceeds the inspected simple query semantics: label substring filtering and update-time ordering, then first result.
5. Stored planning intent is not proof of energy-aware scheduling; quiet-window columns are not proof that every sender checks them; cron source is not a last-run trace.

No existing document was corrected because the user's scope permits only the five new deliverables.

## Verification boundary

HEAD was obtained by reading `.git/HEAD` → `refs/heads/main`. General Git/search process startup failed with an execution-helper setup error, and the optional Node runtime also failed to initialize. This limits working-tree/automated-search verification; it is not evidence of a repository defect or an approval rejection. Reads continued through available file commands. Exact working-copy-to-commit correspondence remains **UNKNOWN**.

The final consistency pass was bounded to the five new Markdown files and their references. Results: five expected files, seven product sections, ten pattern assessments, five concept sections with all requested fields, no invalid internal file/heading references, 66 readable repository link targets, and key source symbols/limits found in 12 files. Source URL/date records, evidence distinctions and proposal/failure coverage were reviewed. This is not an exhaustive source audit or external URL uptime check.

Application checks, deployment, live DB/RLS, notifications, connected calendars and paid models were not run. No claim in this package says they passed.

