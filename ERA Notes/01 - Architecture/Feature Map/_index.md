# Feature Map — Index

> Find the module, jump to its file. Use this as your only entry point.

## Quick lookup by user intent

If the user says…                                              | Open
---                                                            | ---
"the expense form" / "logging a spend" / "categories grid"     | [standalone/transactions.md](standalone/transactions.md)
"my accounts" / "balance" / "balance history"                  | [standalone/accounts-and-balance.md](standalone/accounts-and-balance.md)
"the recurring payments page"                                  | [standalone/recurring-payments.md](standalone/recurring-payments.md)
"add/edit a category" / "subcategory"                          | [standalone/categories.md](standalone/categories.md)
"the schedule view" / "items" / "reminders" / "an item entry"  | [standalone/items-and-reminders.md](standalone/items-and-reminders.md)
"recipes" / "cooking mode" / "the recipe book"                 | [standalone/recipes.md](standalone/recipes.md)
"meal planner" / "what we're eating this week"                 | [standalone/meal-planning.md](standalone/meal-planning.md)
"inventory" / "what's in the pantry" / "restock"               | [standalone/inventory.md](standalone/inventory.md)
"debts" / "settle a debt"                                      | [standalone/debts.md](standalone/debts.md)
"the catalogue" / "saved item templates"                       | [standalone/catalogue.md](standalone/catalogue.md)
"future purchases" / "wishlist"                                | [standalone/future-purchases.md](standalone/future-purchases.md)
"budget allocation" / "envelope budgeting"                     | [standalone/budget-allocation.md](standalone/budget-allocation.md)
"settings" / "preferences" / "theme" / "LBP" / "month start"   | [standalone/preferences.md](standalone/preferences.md)
"statement import" / "merchant mapping"                        | [standalone/statement-import.md](standalone/statement-import.md)
"transfers between accounts"                                   | [standalone/transfers.md](standalone/transfers.md)
"analytics" / "net worth" / "charts"                           | [standalone/analytics.md](standalone/analytics.md)
"drafts drawer" / "pending transactions"                       | [standalone/drafts.md](standalone/drafts.md)
"watch UI" / "Wear OS"                                         | [standalone/watch-ui.md](standalone/watch-ui.md)
"guest portal" / "share with a guest" / "/g/[tag]"             | [standalone/guest-portal.md](standalone/guest-portal.md)
"NFC tags" / "tap-to-log"                                      | [standalone/nfc-tags.md](standalone/nfc-tags.md)
"error logs page"                                              | [standalone/error-logs.md](standalone/error-logs.md)
"AI usage page" / "model cards" / "session usage"              | [standalone/ai-usage.md](standalone/ai-usage.md)
"chores" / "household tasks"                                   | [standalone/chores.md](standalone/chores.md)
"focus page" / "flexible routines"                             | [standalone/focus.md](standalone/focus.md)
"the dashboard" / "today view" / "main landing"                | [standalone/dashboard.md](standalone/dashboard.md)
"the recycle bin"                                              | [standalone/recycle-bin.md](standalone/recycle-bin.md)
---                                                            | ---
"plan my day" / "disrupted day" / "wedding this Saturday" / "push off" / "prepone" | [junction/plan-my-day.md](junction/plan-my-day.md)
"trips" / "travel" / "activate trip" / "packing list"          | [junction/trips.md](junction/trips.md)
"hub chat" / "message actions" / "chat thread"                 | [junction/hub-chat.md](junction/hub-chat.md)
"shopping list"                                                | [junction/shopping-list.md](junction/shopping-list.md)
"the ERA assistant" / "voice mode" / "faces" / "command bar"   | [junction/ai-assistant.md](junction/ai-assistant.md)
"push notifications" / "alerts" / "cron jobs"                  | [junction/notifications.md](junction/notifications.md)
"household sharing" / "linking partners" / "partner data"      | [junction/household-sharing.md](junction/household-sharing.md)
"offline mode" / "sync queue" / "indexeddb"                    | [junction/sync-and-offline.md](junction/sync-and-offline.md)
"message-to-transaction" / "message-to-reminder"               | [junction/message-actions.md](junction/message-actions.md)
"prerequisites" / "NFC unlocks an item"                        | [junction/prerequisites.md](junction/prerequisites.md)
---                                                            | ---
"theme switching" / "blue / pink / frost / calm"               | [cross-cutting/theming.md](cross-cutting/theming.md)
"the atlas" / "the in-app feature map"                         | [cross-cutting/atlas.md](cross-cutting/atlas.md)
"the layout" / "header" / "bottom nav" / "FAB"                 | [cross-cutting/layout-and-nav.md](cross-cutting/layout-and-nav.md)
"the ERAMark logo / animated mark"                             | [cross-cutting/era-mark.md](cross-cutting/era-mark.md)

---

## Standalone modules (self-contained features)

| Module             | One-liner                                                                              | File                                                                              |
| ------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Transactions       | Expense form, category grid, voice entry, draft transactions.                          | [standalone/transactions.md](standalone/transactions.md)                          |
| Accounts & Balance | Account list, balance card, balance history drawer, new-account drawer.                | [standalone/accounts-and-balance.md](standalone/accounts-and-balance.md)          |
| Recurring          | Recurring payments page; auto-posted entries; future-payments forecast.                | [standalone/recurring-payments.md](standalone/recurring-payments.md)              |
| Categories         | User categories + subcategories, color/icon, manager dialogs.                          | [standalone/categories.md](standalone/categories.md)                              |
| Items & Reminders  | Schedule, calendar, reminders, item entry form, recurrence, alerts.                    | [standalone/items-and-reminders.md](standalone/items-and-reminders.md)            |
| Recipes            | Recipe book, ingredients, instructions, cooking mode, version compare.                 | [standalone/recipes.md](standalone/recipes.md)                                    |
| Meal Planning      | Weekly meal planner, drag-drop, recipe → day mapping.                                  | [standalone/meal-planning.md](standalone/meal-planning.md)                        |
| Inventory          | Pantry / stock count, restock dialog.                                                  | [standalone/inventory.md](standalone/inventory.md)                                |
| Debts              | Debt list, settlement modal, owed-to / owed-by views.                                  | [standalone/debts.md](standalone/debts.md)                                        |
| Catalogue          | Saved templates for items, recipes, tasks; promote to catalogue.                       | [standalone/catalogue.md](standalone/catalogue.md)                                |
| Future Purchases   | Wishlist of things to buy later.                                                       | [standalone/future-purchases.md](standalone/future-purchases.md)                  |
| Budget Allocation  | Envelope-style allocations across categories.                                          | [standalone/budget-allocation.md](standalone/budget-allocation.md)                |
| Preferences        | LBP rate, theme, month start day, section order, onboarding.                           | [standalone/preferences.md](standalone/preferences.md)                            |
| Statement Import   | Upload CSV/PDF statement; map merchants to categories.                                 | [standalone/statement-import.md](standalone/statement-import.md)                  |
| Transfers          | Between-account transfers.                                                             | [standalone/transfers.md](standalone/transfers.md)                                |
| Analytics          | Net worth, mini-charts, world map of spend.                                            | [standalone/analytics.md](standalone/analytics.md)                                |
| Drafts             | Drafts drawer, draft transactions badge, drafts dialog.                                | [standalone/drafts.md](standalone/drafts.md)                                      |
| Watch UI           | Wear OS / watch surface — voice entry, simple face.                                    | [standalone/watch-ui.md](standalone/watch-ui.md)                                  |
| Guest Portal       | Public `/g/[tag]` views (drinks admin, deception box).                                 | [standalone/guest-portal.md](standalone/guest-portal.md)                          |
| NFC Tags           | NFC slug routes, admin page, PWA redirect banner.                                      | [standalone/nfc-tags.md](standalone/nfc-tags.md)                                  |
| Error Logs         | Persistent structured error log viewer.                                                | [standalone/error-logs.md](standalone/error-logs.md)                              |
| AI Usage           | Track Claude/OpenAI token usage; upcoming sessions.                                    | [standalone/ai-usage.md](standalone/ai-usage.md)                                  |
| Chores             | Household chores list, postpone, group, "up next" hero.                                | [standalone/chores.md](standalone/chores.md)                                      |
| Focus              | Flexible routines / focus page.                                                        | [standalone/focus.md](standalone/focus.md)                                        |
| Dashboard          | Main landing page after login — KPI cards, recent transactions.                        | [standalone/dashboard.md](standalone/dashboard.md)                                |
| Recycle Bin        | Soft-deleted items with restore.                                                       | [standalone/recycle-bin.md](standalone/recycle-bin.md)                            |

## Junction modules (bridge two or more standalones)

| Module             | Connects                                                                          | File                                                                              |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Plan My Day        | Items/Schedule (one-time + recurring + flexible) ↔ new `day_plans` table.        | [junction/plan-my-day.md](junction/plan-my-day.md)                                |
| Trips              | Budget (auto account) ↔ Items/Chores (skip/pause) ↔ Meal Planning ↔ Catalogue.   | [junction/trips.md](junction/trips.md)                                            |
| Hub Chat           | Transactions ↔ Items ↔ Shopping List (message actions create entries).            | [junction/hub-chat.md](junction/hub-chat.md)                                      |
| Shopping List      | Hub ↔ Recipes (ingredients) ↔ Inventory.                                          | [junction/shopping-list.md](junction/shopping-list.md)                            |
| AI Assistant       | All modules — context injection, briefing, voice mode, faces.                     | [junction/ai-assistant.md](junction/ai-assistant.md)                              |
| Notifications      | Items (alerts) ↔ Recurring (payment reminders) ↔ Budget (spend alerts).           | [junction/notifications.md](junction/notifications.md)                            |
| Household Sharing  | ALL modules — partner data via `household_links` + `profiles`.                    | [junction/household-sharing.md](junction/household-sharing.md)                    |
| Sync & Offline     | ALL mutations — IndexedDB queue + `OfflineSyncEngine`.                            | [junction/sync-and-offline.md](junction/sync-and-offline.md)                      |
| Message Actions    | Hub message → Transaction / Reminder / Item.                                      | [junction/message-actions.md](junction/message-actions.md)                        |
| Prerequisites      | NFC Tags + Items (dormant items become pending when prerequisites met).           | [junction/prerequisites.md](junction/prerequisites.md)                            |

## Cross-cutting (system, not a feature)

| Topic               | File                                                            |
| ------------------- | --------------------------------------------------------------- |
| Theming             | [cross-cutting/theming.md](cross-cutting/theming.md)            |
| Atlas               | [cross-cutting/atlas.md](cross-cutting/atlas.md)                |
| Layout & navigation | [cross-cutting/layout-and-nav.md](cross-cutting/layout-and-nav.md) |
| ERAMark             | [cross-cutting/era-mark.md](cross-cutting/era-mark.md)          |
| Conventions         | [_conventions.md](_conventions.md)                              |
