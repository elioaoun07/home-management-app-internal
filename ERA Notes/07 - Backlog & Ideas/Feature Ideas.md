# Feature Ideas

**Last updated:** 2026-05-02

This document consolidates new feature ideas and prioritizes items from the existing backlog. Mix of brand-new ideas and previously discussed concepts marked with ★.

---

## Legend

- ★ = Already in backlog / previously discussed
- → = New idea
- **High** = High user value, relatively low effort or addresses clear pain points
- **Medium** = Good value, moderate effort
- **Low** = Nice to have, complex, or niche

---

## High Priority

| # | Idea | Topic | Module | Type |
|---|------|--------|--------|------|
| 1 | **Global Search** — search transactions, items, recipes, chat in one place (Ctrl+K) ★ | UX | Shared `src/components/` | Junction |
| 2 | **Receipt Scanner** — AI vision to auto-fill expense form from a photo → | AI | Transactions + AI | Junction |
| 3 | **Financial Goals** — named savings targets (vacation fund, emergency fund) with progress bars → | Finance | New Standalone | Standalone |
| 4 | **Expense Limits with Alerts** — soft per-category monthly limits that fire a push notification when crossed ★ | Finance | Budget + Notifications | Junction |
| 5 | **Subscription Analysis** — identify unused, track YoY growth, estimated annual total ★ | Finance | Recurring | Standalone |
| 6 | **Recurring Payment Calendar** — visual calendar of all upcoming payment due dates ★ | Finance | Recurring | Standalone |
| 7 | **Smart Categorization Learning** — AI maps merchants to categories and learns corrections ★ | AI | Transactions + AI | Junction |
| 8 | **Inventory → Shopping List Auto-gen** — auto-add items below restock threshold ★ | Cross-module | Inventory + Shopping | Junction |
| 9 | **Net Worth Widget** — total assets minus liabilities across all accounts + debts → | Finance | Dashboard | Junction |
| 10 | **Quick Expense Presets** — save full presets (amount + category + account), tap to log instantly → | UX | Transactions | Standalone |

---

## Medium Priority

| # | Idea | Topic | Module | Type |
|---|------|--------|--------|------|
| 11 | **Annual / Year-in-Review** — December report: total spent, top categories, biggest purchases → | Analytics | Analytics | Standalone |
| 12 | **Bulk Operations** — multi-select transactions or items for mass edit/delete/categorize ★ | UX | Transactions, Items | Shared |
| 13 | **Partner Activity Feed** — real-time feed of household partner's transactions and actions → | Social | Household Sharing | Junction |
| 14 | **Spending Velocity Gauge** — burn rate: "You've spent X% of budget in Y% of the month" ★ | Analytics | Dashboard | Standalone |
| 15 | **Weekly Digest Notification** — consolidated Sunday evening summary of spending + tasks ★ | Notifications | Notifications | Junction |
| 16 | **Meal Plan → Budget Impact** — show estimated weekly meal cost based on recipe pricing ★ | Cross-module | Meal Plan + Budget | Junction |
| 17 | **Debt → Reminder Integration** — auto-create reminder when a debt collection date is set ★ | Cross-module | Debts + Items | Junction |
| 18 | **Barcode Scanner for Inventory** — scan product barcodes to add/update inventory items → | Hardware | Inventory | Standalone |
| 19 | **Future Purchase → Transaction Auto-match** — mark future purchase complete when a matching transaction is logged ★ | Cross-module | Future Purchases + Transactions | Junction |
| 20 | **Expense Photo Attachments** — attach receipt photos to any transaction → | UX | Transactions | Standalone |
| 21 | **50/30/20 Dashboard Analysis** — needs/wants/savings split visualization ★ | Analytics | Analytics | Standalone |
| 22 | **Partner Spending Comparison** — side-by-side charts: you vs partner by category ★ | Analytics | Analytics | Junction |
| 23 | **Merchant History View** — tap a merchant name to see all past transactions there → | Analytics | Transactions | Standalone |
| 24 | **Household Challenge** — monthly spending challenge between partners (e.g. "both spend <$200 on dining") → | Social | Household Sharing | Junction |
| 25 | **Time-window Prerequisites** *(stub already exists)* — unlock tasks only during specific hours ★ | Items | Prerequisites Engine | Junction |
| 26 | **NFC → Expense Shortcut** — tap NFC tag at a location to open pre-filled expense form ★ | Hardware | NFC + Transactions | Junction |
| 27 | **Wishlist Sharing** — mark future purchases as gift suggestions, share link with partner/family → | Social | Future Purchases | Standalone |

---

## Lower Priority / Exploratory

| # | Idea | Topic | Module | Type |
|---|------|--------|--------|------|
| 28 | **CSV / PDF Export** — tax-ready export of transactions by date range and category ★ | Utility | Transactions | Standalone |
| 29 | **Multi-Currency Support** — log expenses in foreign currency, auto-convert to LBP/home currency → | Finance | Transactions | Standalone |
| 30 | **Financial Health Score** — composite score: savings rate + debt-to-income + budget adherence → | AI | Dashboard | Junction |
| 31 | **Calorie / Nutrition Tracking** — add macros to recipes, track daily intake in meal plan → | Health | Recipes + Meal Plan | Junction |
| 32 | **Habitual Expense Detection** — AI notices "you always buy coffee Monday mornings" → suggest recurring ★ | AI | AI + Recurring | Junction |
| 33 | **Smart Daily Planning** — AI-ordered task list for Focus mode by priority, time, and energy ★ | Items | Items + AI | Junction |
| 34 | **Guest Shopping Requests** — guests add items to household shopping list via NFC portal ★ | Social | Guest Portal + Shopping | Junction |
| 35 | **Recurring Item Templates** — library of common recurring task sets (weekly cleaning, monthly maintenance) → | Items | Items | Standalone |
| 36 | **Context-Aware NFC Dashboards** — kitchen tag shows meal plan, entrance tag shows morning briefing ★ | Hardware | NFC + Dashboard | Junction |
| 37 | **Income Dashboard** — dedicated view for salary tracking, freelance income, income trends over time → | Finance | Transactions | Standalone |
| 38 | **Budget Gamification** — streak/badge when you stay under budget for N consecutive months → | UX | Budget | Standalone |

---

## Next Steps / Top Picks

**Suggested starting points** (highest impact + lowest friction):

1. **#1 Global Search** — touches every module, highest daily utility
2. **#3 Financial Goals** — natural missing piece in budget ecosystem, self-contained standalone
3. **#2 Receipt Scanner** — removes biggest friction point in expense logging

---

## Notes

- All cross-module features (Junction) should check `ERA Notes/03 - Junction Modules/` for connected module requirements
- Standalone ideas (#3, #5, #9, #10, #11, etc.) can be prototyped independently
- AI features (#2, #7, #32, #33) require AI Assistant module review and token budgeting
- Hardware features (#18, #26, #36) scope depends on whether Capacitor shell is viable
- **See also:** `Feature Optimizations.md` for detailed 40+ optimization items (same backlog, different view)
