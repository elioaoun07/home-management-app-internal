---
created: 2026-03-25
type: ui
module: cross-cutting
module-type: n/a
status: active
tags:
  - type/ui
  - scope/cross-cutting
  - scope/routes
---

# Screen → File Map

> ⚠️ **Superseded by the [Page & Feature Atlas](Page%20&%20Feature%20Atlas/_Index.md)**.
> The Atlas is auto-seeded from the codebase and viewable in-app at `/atlas`. This file remains as a quick legacy reference but should not be the source of truth for new work.
>
> **Purpose (legacy)**: When you see a UI issue on any screen, look it up here to find the exact TSX file(s) to edit.
> For icons and route metadata, see [[App Routes and Icons]].

---

## How to Use

1. **Ctrl+F** the screen name or route (e.g., "Recurring" or "/recurring")
2. Open the **Page file** — that's the entry point
3. If the page delegates to a **Main component**, open that instead — it contains the actual UI
4. For complex screens, check the **Key sub-components** list

---

## Auth & Onboarding

| Screen               | Route                    | Page file                                | Main component                  |
| -------------------- | ------------------------ | ---------------------------------------- | ------------------------------- |
| Landing              | `/`                      | `src/app/page.tsx`                       | `LandingPageClient` (same file) |
| Login                | `/login`                 | `src/app/login/page.tsx`                 | Self-contained (`LoginPage`)    |
| Signup               | `/signup`                | `src/app/signup/page.tsx`                | Self-contained (`SignupPage`)   |
| Welcome / Onboarding | `/welcome`               | `src/app/welcome/page.tsx`               | `WelcomeClient` (same dir)      |
| Reset Password       | `/reset-password`        | `src/app/reset-password/page.tsx`        | Self-contained                  |
| Update Password      | `/reset-password/update` | `src/app/reset-password/update/page.tsx` | Self-contained                  |
| Auth Reset Confirm   | `/auth/reset`            | `src/app/auth/reset/page.tsx`            | Self-contained                  |

---

## Main Tabs (Mobile Bottom Nav)

These are the four tabs in the mobile bottom navigation. The tab system is managed by `src/contexts/TabContext.tsx` and rendered via `src/components/layouts/TabContainer.tsx`.

### Dashboard / Activity

|                   | Path                                           |
| ----------------- | ---------------------------------------------- |
| **Route**         | `/dashboard`                                   |
| **Page**          | `src/app/dashboard/page.tsx`                   |
| **Wrapper**       | `src/app/dashboard/DashboardClientWrapper.tsx` |
| **Mobile view**   | `src/app/dashboard/DashboardClientPage.tsx`    |
| **Activity list** | `src/components/activity/ActivityView.tsx`     |

Key sub-components:

- `src/components/activity/TransactionListView.tsx` — transaction rows
- `src/components/activity/TransferListView.tsx` — transfer rows
- `src/components/activity/CategoryDetailView.tsx` — category drill-down
- `src/components/transactions/TransactionDetailModal.tsx` — transaction detail popup
- `src/components/transactions/SwipeableTransactionItem.tsx` — swipeable row
- `src/components/activity/EnhancedMobileDashboard.tsx` — dashboard summary cards

### Expense Form

|                 | Path                                           |
| --------------- | ---------------------------------------------- |
| **Route**       | `/expense`                                     |
| **Page**        | `src/app/expense/page.tsx`                     |
| **Wrapper**     | `src/app/expense/ExpenseClientWrapper.tsx`     |
| **Mobile form** | `src/components/expense/MobileExpenseForm.tsx` |

Key sub-components:

- `src/components/expense/AccountSelect.tsx` — account picker
- `src/components/expense/AmountInput.tsx` — amount entry + calculator
- `src/components/expense/DescriptionField.tsx` — description + voice
- `src/components/expense/CategoryGrid.tsx` — category selection
- `src/components/expense/SubcategoryGrid.tsx` — subcategory selection
- `src/components/expense/ExpenseTagsBar.tsx` — tags toolbar
- `src/components/expense/TemplateDrawer.tsx` — expense templates
- `src/components/expense/CalculatorDialog.tsx` — calculator popup
- `src/components/expense/SplitBillModal.tsx` — split bill
- `src/components/transfers/TransferDialog.tsx` — transfer dialog

### Reminders

|                    | Path                                                  |
| ------------------ | ----------------------------------------------------- |
| **Route**          | `/reminders`                                          |
| **Page**           | `src/app/reminders/page.tsx`                          |
| **Main component** | `src/components/reminder/StandaloneRemindersPage.tsx` |
| **Form**           | `src/components/reminder/MobileReminderForm.tsx`      |

### Recurring Payments

|           | Path                                              |
| --------- | ------------------------------------------------- |
| **Route** | `/recurring`                                      |
| **Page**  | `src/app/recurring/page.tsx` — **self-contained** |
| **Hooks** | `src/features/recurring/useRecurringPayments.ts`  |
| **API**   | `src/app/api/recurring/route.ts`                  |

> The entire Recurring UI lives in one file: `src/app/recurring/page.tsx`.

---

## Standalone Pages

### Focus

|                    | Path                                 |
| ------------------ | ------------------------------------ |
| **Route**          | `/focus`                             |
| **Page**           | `src/app/focus/page.tsx`             |
| **Main component** | `src/components/focus/FocusPage.tsx` |

### Settings

|                    | Path                                |
| ------------------ | ----------------------------------- |
| **Route**          | `/settings`                         |
| **Page**           | `src/app/settings/page.tsx`         |
| **Main component** | `src/app/settings/SettingsPage.tsx` |

### Catalogue

|                    | Path                                  |
| ------------------ | ------------------------------------- |
| **Route**          | `/catalogue`                          |
| **Page**           | `src/app/catalogue/page.tsx`          |
| **Main component** | `src/components/web/WebCatalogue.tsx` |
| **Hooks**          | `src/features/catalogue/`             |

### Recipes

|                    | Path                                |
| ------------------ | ----------------------------------- |
| **Route**          | `/recipe`                           |
| **Page**           | `src/app/recipe/page.tsx`           |
| **Main component** | `src/components/web/WebRecipes.tsx` |
| **Hooks**          | `src/features/recipes/`             |

### Hub Chat

|                    | Path                             |
| ------------------ | -------------------------------- |
| **Route**          | `/chat`                          |
| **Page**           | `src/app/chat/page.tsx`          |
| **Main component** | `src/components/hub/HubPage.tsx` |

HubPage renders multiple views internally: chat, feed, score, alerts. Key sub-components:

- `src/components/hub/ShoppingListView.tsx` — shopping list
- `src/components/hub/NotesListView.tsx` — shared notes
- `src/components/hub/InlineVoiceRecorder.tsx` — voice messages
- `src/components/hub/VoiceMessagePlayer.tsx` — voice playback
- `src/features/hub/messageActions.ts` — message action logic

### Alerts

|                    | Path                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| **Route**          | `/alerts`                                                                   |
| **Page**           | `src/app/alerts/page.tsx`                                                   |
| **Main component** | `src/components/hub/HubPage.tsx` (same as Chat, with `allowedViews` filter) |

### Drafts

|           | Path                                                   |
| --------- | ------------------------------------------------------ |
| **Route** | `/expense/drafts`                                      |
| **Page**  | `src/app/expense/drafts/page.tsx` — **self-contained** |
| **Hooks** | `src/features/drafts/`                                 |

### Quick Expense

|                    | Path                                     |
| ------------------ | ---------------------------------------- |
| **Route**          | `/quick-expense`                         |
| **Page**           | `src/app/quick-expense/page.tsx`         |
| **Main component** | `src/components/expense/ExpenseForm.tsx` |

### QR Expense

|           | Path                                               |
| --------- | -------------------------------------------------- |
| **Route** | `/qr/expense`                                      |
| **Page**  | `src/app/qr/expense/page.tsx` — **self-contained** |

---

## View Modes (Device Detection)

The app detects device type via `src/hooks/useViewMode.ts` and renders different UIs.

### Watch Mode

|                     | Path                                          |
| ------------------- | --------------------------------------------- |
| **Dashboard watch** | `src/components/watch/SimpleWatchView.tsx`    |
| **Expense watch**   | `src/components/watch/WatchView.tsx`          |
| **Error boundary**  | `src/components/watch/WatchErrorBoundary.tsx` |

### Web / Desktop Mode

|                      | Path                                        |
| -------------------- | ------------------------------------------- |
| **Container**        | `src/components/web/WebViewContainer.tsx`   |
| **Dashboard**        | `src/components/web/WebDashboard.tsx`       |
| **Budget**           | `src/components/web/WebBudget.tsx`          |
| **Events**           | `src/components/web/WebEvents.tsx`          |
| **Catalogue**        | `src/components/web/WebCatalogue.tsx`       |
| **Recipes**          | `src/components/web/WebRecipes.tsx`         |
| **Meal Planner**     | `src/components/web/WebMealPlanner.tsx`     |
| **Future Purchases** | `src/components/web/WebFuturePurchases.tsx` |

---

## Guest Portal & Utility

### Guest Portal

|                     | Path                                         |
| ------------------- | -------------------------------------------- |
| **Route**           | `/g/[tag]` (dynamic — e.g., `/g/kitchen-1`)  |
| **Page**            | `src/app/g/[tag]/page.tsx`                   |
| **Main component**  | `src/app/g/[tag]/guest-portal-client.tsx`    |
| **Deception intro** | `src/components/guest/DeceptionBoxScene.tsx` |

### Drinks Admin

|           | Path                                                   |
| --------- | ------------------------------------------------------ |
| **Route** | `/g/drinks-admin`                                      |
| **Page**  | `src/app/g/drinks-admin/page.tsx` — **self-contained** |

### Error Logs

|           | Path                                               |
| --------- | -------------------------------------------------- |
| **Route** | `/error-logs`                                      |
| **Page**  | `src/app/error-logs/page.tsx` — **self-contained** |

### Offline Fallback

|           | Path                                            |
| --------- | ----------------------------------------------- |
| **Route** | `/offline`                                      |
| **Page**  | `src/app/offline/page.tsx` — **self-contained** |

### Temp / Debug

|                    | Path                                         |
| ------------------ | -------------------------------------------- |
| **Route**          | `/temp`                                      |
| **Page**           | `src/app/temp/page.tsx`                      |
| **Main component** | `src/components/guest/DeceptionBoxScene.tsx` |

---

## Layout & Navigation (Always Visible)

These components are rendered on every page via the root layout.

| Element                          | File                                           |
| -------------------------------- | ---------------------------------------------- |
| **Root layout**                  | `src/app/layout.tsx`                           |
| **Mobile bottom nav**            | `src/components/layouts/MobileNav.tsx`         |
| **Tab container**                | `src/components/layouts/TabContainer.tsx`      |
| **FAB (floating action button)** | `src/components/navigation/SemiDonutFAB.tsx`   |
| **Header (conditional)**         | `src/components/layouts/ConditionalHeader.tsx` |
| **Expense shell**                | `src/components/layouts/ExpenseShell.tsx`      |
| **AI Chat Assistant**            | `src/components/ai/AIChatAssistant.tsx`        |
| **Sync pill indicator**          | Rendered in `layout.tsx`                       |

---

## Quick Lookup by Module

| Module             | Where the UI lives                                                           |
| ------------------ | ---------------------------------------------------------------------------- |
| Accounts & Balance | Dashboard tab → `ActivityView.tsx`, `EnhancedMobileDashboard.tsx`            |
| Transactions       | Expense tab → `MobileExpenseForm.tsx`; Dashboard → `TransactionListView.tsx` |
| Categories         | Expense tab → `CategoryGrid.tsx`, `SubcategoryGrid.tsx`                      |
| Recurring          | Recurring tab → `src/app/recurring/page.tsx`                                 |
| Items / Reminders  | Reminders tab → `StandaloneRemindersPage.tsx`, `MobileReminderForm.tsx`      |
| Recipes            | `/recipe` → `WebRecipes.tsx`                                                 |
| Catalogue          | `/catalogue` → `WebCatalogue.tsx`                                            |
| Hub Chat           | `/chat` → `HubPage.tsx`                                                      |
| Shopping List      | Hub Chat → `ShoppingListView.tsx`                                            |
| Focus / Routines   | `/focus` → `FocusPage.tsx`                                                   |
| Budget Allocation  | Web view → `WebBudget.tsx`                                                   |
| Debts              | Expense tab → `DebtsDrawer` in `MobileExpenseForm.tsx`                       |
| Future Purchases   | Web view → `WebFuturePurchases.tsx`; Expense tab → `FuturePaymentsDrawer`    |
| Transfers          | Dashboard → `TransferListView.tsx`; Expense tab → `TransferDialog.tsx`       |
| Preferences        | `/settings` → `SettingsPage.tsx`                                             |
| Drafts             | `/expense/drafts` → `DraftsPage.tsx`                                         |
| Statement Import   | Inside expense form — `src/features/statement-import/`                       |
| Analytics          | Dashboard → `src/features/analytics/`                                        |
| Inventory          | Inside catalogue/hub — `src/features/inventory/`                             |
| Guest Portal       | `/g/[tag]` → `guest-portal-client.tsx`                                       |
| Error Logs         | `/error-logs` → self-contained                                               |
