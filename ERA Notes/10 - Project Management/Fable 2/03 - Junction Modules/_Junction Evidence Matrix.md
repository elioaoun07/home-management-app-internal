---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Counts by `find`, `wc` and `grep` over `src/`. Measured for every junction; read deeply only where marked."
---

# Junction modules — evidence matrix

[Fable 2 index](<../_index.md>) · standalone view: [Module evidence matrix](<../02 - Standalone Modules/_Module Evidence Matrix.md>)

A blank Notes cell means "measured, not audited".

| Junction | Code measured | Tests | API (routes / mutating / no Zod / service-role) | Notes |
|---|---|---|---|---|
| Hub Chat | `src/features/hub` 2,643 lines; `src/components/hub/HubPage.tsx` 5,972; `src/app/api/hub/messages/route.ts` 1,639 | 1 feature test | hub: 12 / 10 / 7 / 2 | Largest component in the repo ([Mega-components](<../04 - UI & Design/Mega-Components.md>)) |
| Shopping List | `src/components/hub/ShoppingListView.tsx` 3,229 lines | 0 | (under hub, inventory, meal-plans) | 13 raw `fetch` mutations per the sweep (X1) |
| ERA / AI Assistant | `src/features/era` 17,099 lines; `src/lib/ai`; `src/lib/era` | 41 + 6 + 4, plus the Gym replay | era: 16 / 14 / 0 / 0; ai-chat: 3 / 3 / 2 / 0 | The best-covered area of the product. Every ERA route validates input |
| Notifications | `src/app/api/notifications`, `src/app/api/cron` | 1 lib test | notifications: 17 / 16 / 15 / 3; cron: 6 / 5 / 3 / 6 | Lowest validation rate of any area. Three deprecated forwarding routes remain. Cron defects: NOTIF-22, NOTIF-23 |
| Household Sharing | `household_links` lookups across routes | `accountAccess.test.ts` | household: 2 / 1 / 1 / 1 | [Service-role surface](<Household Sharing/Service-Role Authorization Surface.md>). **read** |
| Sync & Offline | `src/lib/offlineQueue.ts`, `src/lib/offlineSyncEngine.ts`, `src/contexts/SyncContext.tsx` | 4 lib tests | n/a | [Exactly-once remains open](<Sync & Offline/Exactly-Once Remains Open.md>) |
| Trips | `src/features/trips` 1,264 lines | 2 + `tripSpend.test.ts` | trips: 24 / 21 / 5 / 6 | Most routes of any area; six use the service role |
| Plan My Day | `src/features/day-plan` 155 lines; `src/components/planner/WebDayPlanner.tsx` 2,155 | 0 | day-plans: 2 / 2 / 0 / 0 | |
| Meal Planning | `src/features/meal-planning` 164 lines | 1 coverage test | meal-plans: 3 / 3 / 3 / 0 | |
| Prerequisites | `src/lib/prerequisites` | 1 route test | (under items) | `item_prerequisites` has RLS disabled in the committed snapshot |
| Activity Log | `src/features/activity-log` 233 lines | 2 + 1 route test | activity-log: 1 / 0 / 0 / 0 | Sets `private, no-store` and `Vary: Cookie`; the model for [BUD-95](<../../Budget/Budget — Master Book.md#bud-95>) |
| Voice | `src/features/voice-conversation` 1,991 lines | 1 | azure-speech, tts: 2 / 2 / 1 / 0 | Not examined |
| PM live (phone relay) | `src/features/pm-live` 2,099 lines | 0 in `src`; relay tests under `tests/` | pm: 1 / 1 / 0 / 1 | Part of the tool, shipped inside the product bundle |

## What the matrix says

1. **ERA is where the engineering discipline is.** Contract tests, replayed evaluations, full validation. The modules ERA drives (money, schedule, shopping) have far less, so ERA's correct commands land on weaker routes.
2. **Notifications validates least and runs unattended.** 15 of 16 mutating routes carry no schema, and the cron half has no liveness evidence in the repo (existing HUB-38).
3. **The largest feature file is a junction.** `HubPage.tsx` at 5,972 lines is nearly twice the next component, and `ShoppingListView.tsx` is fourth in the repository.
