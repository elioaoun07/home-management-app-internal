---
type: reference
module: ai-assistant
generated: true
---

# ERA Reach Matrix

Generated from `src/features/era/reach.ts` by `src/features/era/reach.test.ts` (HUB-81). Do not edit by hand:
`ERA_REACH_WRITE=1 pnpm vitest run src/features/era/reach.test.ts`.

<!-- reach-matrix:begin -->
| Module | Navigation | Useful prefill | Inline | Verified (Gym) | Note |
|---|---|---|---|---|---|
| Accounts & Balance | ✓ `/dashboard` | – | balance.read | ✓ |  |
| Transactions | ✓ `/expense` | ✓ | transaction.draft | ✓ |  |
| Categories | ✓ `/expense` | – | – | – |  |
| Recurring Payments | ✓ `/recurring` | ✓ | recurring.cover | ✓ |  |
| Recipes | ✓ `/recipe` | – | recipe.search, recipe.list | ✓ |  |
| Meal Planning | ✓ `/meal-plan` | – | meal.assign, meal.gaps | ✓ |  |
| Inventory | ✓ `/catalogue` | – | – | – |  |
| Debts | ✓ `/expense` | – | debt.record | ✓ | Settle waits on BUD-68. |
| Catalogue | ✓ `/catalogue` | – | – | – | Search waits on HUB-69 (KIT-20/22). |
| Future Purchases | ✓ `/dashboard` | – | purchases.read | – |  |
| Budget Allocation | ✓ `/dashboard` | – | spend.month | ✓ |  |
| Preferences (LBP, theme) | ✓ `/settings` | – | – | – |  |
| Statement Import | ✓ `/statement-import` | – | – | – |  |
| Transfers | ✓ `/expense` | ✓ | transfer.create | ✓ |  |
| Hub Chat | ✓ `/chat` | – | – | – |  |
| Shopping List | ✓ `/chat` | – | shopping.add | ✓ |  |
| Message Actions | ✓ `/chat` | – | – | – | Reached through Hub Chat. |
| Items / Reminders | ✓ `/reminders` | – | reminder.create, reminder.reschedule, reminder.complete, reminder.delete, reminder.skip, schedule.forDay | ✓ |  |
| AI Assistant | ✓ `/era` | – | – | ✓ |  |
| Notifications | ✓ `/alerts` | – | – | – |  |
| Household Sharing | ✓ `/settings` | – | – | – |  |
| Analytics | ✓ `/dashboard` | – | analytics.show, spend.month, spend.day | ✓ |  |
| Drafts | ✓ `/expense/drafts` | – | draft.list, draft.confirm | ✓ |  |
| Watch UI | ✓ `/watch` | – | – | – |  |
| Guest Portal | n/a | – | – | – | Guest-only surface behind an NFC slug; not an owner page. |
| Sync & Offline | n/a | – | – | – | Background system; no page to open. |
| Error Logs | ✓ `/error-logs` | – | – | – |  |
| NFC Tags | ✓ `/nfc` | – | – | – |  |
| Prerequisites | ✓ `/reminders` | – | – | – | Set on an item inside Reminders. |
| Chores | ✓ `/chores` | – | – | – |  |
| Focus | ✓ `/reminders?tab=focus` | – | – | – |  |
| Trips | ✓ `/trips` | – | – | – | Reads wait on TRIP-1–3. |
| Dashboard | ✓ `/dashboard` | – | – | – |  |
| Recycle Bin | ✓ `/recycle-bin` | – | – | – |  |
| Plan My Day | ✓ `/today` | – | – | – |  |
| Healthcare | ✓ `/healthcare` | – | – | – | Dose log waits on HLTH-19/25. |
| Outfits | ✓ `/outfits` | – | – | – |  |
| Activity Log | ✓ `/activity-log` | – | activity.read | – | Needs HUB-72's owner SQL. |
<!-- reach-matrix:end -->
