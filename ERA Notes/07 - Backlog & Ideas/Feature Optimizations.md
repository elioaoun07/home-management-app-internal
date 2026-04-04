---
created: 2026-04-04
type: backlog
status: planned
tags:
  - type/backlog
  - scope/cross-cutting
---
# Feature & Functionality Optimizations

A cross-module review identifying underutilized features, missing module connections, and new functionality that would deliver meaningful value.

---

## 1. AI Intelligence Layer — Massively Underutilized

The AI assistant currently functions as a reactive chat. It could be the **brain** of the entire app.

### 1a. Proactive Spending Alerts
- Detect unusual spending patterns (e.g., "You spent 3x more on dining this week than usual")
- Budget threshold warnings before you hit the limit, not after
- Weekend spending predictions based on historical patterns

### 1b. Smart Categorization Learning
- Statement Import already has merchant mapping — feed those patterns back into manual expense entry
- When a user types "Spinneys" in description, auto-suggest "Groceries" category
- Learn from corrections: if user changes a category after entry, remember that for next time

### 1c. AI-Powered Focus Briefing Enrichment
- Current briefing is task-focused. Enrich with:
  - "You have 3 recurring payments due this week totaling $X"
  - "Your grocery budget is 80% spent with 12 days remaining"
  - "Low stock: milk, eggs, bread" (from Inventory)
  - "Upcoming debt settlement: John owes you $50, due Friday"

### 1d. Natural Language Expense Entry Improvements
- Voice entry exists but could support multi-transaction: "I spent $30 at the grocery store and $15 on gas"
- Support relative dates: "yesterday I paid $20 for lunch"
- Learn user's common expense patterns for faster parsing

---

## 2. Cross-Module Connections — Broken Bridges

### 2a. Inventory → Shopping List Auto-Generation
- Inventory tracks stock levels and has low-stock alerts
- But low stock doesn't auto-create shopping list items
- **Optimization**: When an item hits low-stock threshold, auto-add to shopping list (or prompt user)

### 2b. Recipe → Inventory Check
- Recipes have ingredient lists, Inventory tracks what's in stock
- No connection between them
- **Optimization**: When viewing a recipe, show which ingredients you already have vs need to buy
- "Cook this recipe" → auto-add missing ingredients to shopping list

### 2c. Meal Plan → Budget Impact
- Meal planning assigns recipes to days and generates shopping lists
- But no connection to budget — user doesn't know "this week's meal plan will cost approximately $X"
- **Optimization**: Estimate meal plan cost from catalogue prices or historical grocery spending

### 2d. Recurring Payments → Budget Allocation Auto-Sync
- Recurring payments know exactly what's due monthly
- Budget allocation is manual per-category
- **Optimization**: Auto-suggest budget minimums based on recurring payment totals per category

### 2e. Debt → Reminder Integration
- Debts track money lent but no automated follow-up
- **Optimization**: Auto-create reminders for debt collection dates, send nudge notifications

### 2f. Future Purchases → Transaction Tracking
- Future Purchases has savings goals but doesn't track actual progress from transactions
- **Optimization**: When user buys the target item, auto-mark the future purchase as complete and show actual vs planned cost

---

## 3. Prerequisites Engine — Untapped Potential

Four evaluator types are stubs (`weather`, `time_window`, `schedule`, `custom_formula`). Completing these would unlock powerful automation:

### 3a. Time Window Prerequisites
- "Only show 'Take medication' between 7-9 AM"
- "Activate 'Review weekly budget' on Sunday mornings"
- Context-aware task surfacing based on time of day

### 3b. Schedule Prerequisites
- Chain tasks to calendar events: "After gym session, show 'Log workout meal'"
- "Before grocery shopping event, show 'Check inventory list'"

### 3c. Custom Formula Prerequisites
- "When account balance drops below $500, activate 'Review subscriptions' task"
- "When grocery spending exceeds 80% of budget, activate 'Switch to meal prep' reminder"
- Financial condition-based task activation

---

## 4. Analytics & Insights — Surface What Matters

### 4a. Subscription Analysis
- Recurring payments data exists but no analysis view
- **Optimization**: "You spend $X/month on subscriptions" with breakdown
- Identify unused subscriptions (recurring payments with no related transactions)
- Year-over-year subscription cost growth

### 4b. Spending Velocity Indicator
- Show real-time "burn rate" — how fast the user is spending relative to the month
- "At this pace, you'll exceed your budget by $200"
- Visual gauge on dashboard

### 4c. Category Trend Alerts
- "Your dining expenses increased 40% this month compared to last 3-month average"
- Surface only significant deviations, not noise

### 4d. 50/30/20 Analysis (Documented as planned)
- Needs vs Wants vs Savings breakdown
- Requires categories to be tagged as need/want/saving
- Could be auto-suggested by AI based on category names

### 4e. Partner Spending Comparison
- Household sharing exists but no comparative analytics
- "This month: You spent $X, Partner spent $Y" with category breakdown
- Not judgmental — informational for household budget discussions

---

## 5. Focus Mode — Could Be the App's Killer Feature

### 5a. Smart Daily Planning
- Current: shows today's tasks
- **Optimization**: AI suggests optimal task ordering based on:
  - Task priority and deadlines
  - Time estimates (could add this field to items)
  - Energy level patterns (morning = complex tasks, afternoon = routine)

### 5b. End-of-Day Review
- Quick recap: "Today you completed 5/8 tasks, spent $45, and have 3 items due tomorrow"
- One-tap postpone all incomplete items to tomorrow
- Daily spending summary without opening the full dashboard

### 5c. Weekly Planning Session
- Sunday evening prompt: "Plan your week?"
- Shows upcoming items, recurring payments, meal plan gaps
- Batch-schedule flexible routines across the week

---

## 6. NFC Tags — Beyond Simple Triggers

### 6a. Expense Shortcuts
- Tap NFC tag at coffee shop → pre-filled expense form (amount + category + location)
- Tap tag at gas station → quick fuel expense with recent amount suggestion

### 6b. Inventory Quick Update
- Tap NFC tag on pantry shelf → show inventory items for that area
- One-tap "restock" or "depleted" for each item

### 6c. Context-Aware Dashboards
- Tap kitchen NFC tag → show today's meal plan + recipe + shopping list
- Tap entrance NFC tag → show today's Focus briefing + weather

---

## 7. Notification Intelligence

### 7a. Smart Notification Timing
- Don't send budget alerts at 2 AM
- Learn when user typically opens the app and batch notifications before that time
- Urgent (overdue items) vs informational (weekly summary) priority tiers

### 7b. Weekly Digest
- Sunday evening push: "This week: spent $X of $Y budget, completed N tasks, M items upcoming"
- Single consolidated notification instead of daily noise

### 7c. Proactive Reminders
- "You usually buy groceries on Saturday — want to review your shopping list?"
- "Last month you forgot to pay [recurring payment] — it's due in 2 days"

---

## 8. Hub Chat — Smarter Household Communication

### 8a. Expense Splitting from Chat
- Partner sends "I bought groceries for $80" in chat
- One-tap to create split transaction (auto-detect amount from message)

### 8b. Shopping List Collaboration Improvements
- Show who added each item
- "Partner is at the store" status (could use location or manual toggle)
- Real-time check-off sync with visual indicators

### 8c. Shared Budget Visibility in Chat
- Quick command: "budget status" → bot responds with current month summary
- "How much did we spend on dining?" → instant answer from transaction data

---

## 9. Watch UI — Untapped Wearable Potential

### 9a. Glanceable Information
- Complication/tile showing: daily spend, remaining budget, next task
- No need to open app for basic status

### 9b. Quick Actions Beyond Voice
- Tap presets: "Coffee $5", "Lunch $15", "Gas $40" (user-configured)
- Swipe between expense and reminder creation

### 9c. Smart Prompts
- Watch vibrates at lunch: "Log lunch expense?"
- Evening: "You haven't logged any expenses today"

---

## 10. Guest Portal — More Household Value

### 10a. Shared Shopping Requests
- Guest can add items to household shopping list
- "We're out of towels" → appears in host's shopping list

### 10b. Expense Requests
- Guest can request reimbursement: "I bought supplies for $30"
- Host gets notification to approve and create transaction

---

## 11. Quality-of-Life Improvements

### 11a. Global Search
- No cross-module search exists
- Search across transactions, items, recipes, catalogue, chat messages
- Recent searches and smart suggestions

### 11b. Quick Actions / Command Palette
- Power-user shortcut: Ctrl+K or swipe-down for command palette
- "Add expense", "New reminder", "Check budget", "Search recipes"

### 11c. Bulk Operations
- Select multiple transactions → bulk categorize, bulk delete
- Select multiple items → bulk complete, bulk postpone, bulk reassign

### 11d. Data Export
- Export transactions to CSV/PDF for tax season
- Monthly financial reports (auto-generated)
- Share budget summary with partner

### 11e. Recurring Payment Calendar View
- Visual calendar showing when each recurring payment hits
- Cash flow forecast: "On the 15th, 3 payments totaling $X are due"

---

## Priority Ranking

### High Impact, Moderate Effort
1. **Inventory → Shopping List auto-generation** (2a)
2. **Recipe → Inventory check** (2b)
3. **AI spending alerts** (1a)
4. **Smart categorization learning** (1b)
5. **Focus briefing enrichment** (1c)
6. **Debt → Reminder integration** (2e)

### High Impact, Higher Effort
7. **Global search** (11a)
8. **End-of-day review** (5b)
9. **Weekly digest notification** (7b)
10. **Subscription analysis** (4a)
11. **Time window prerequisites** (3a)
12. **50/30/20 analysis** (4d)

### Medium Impact, Quick Wins
13. **Recurring → Budget auto-suggest** (2d)
14. **NFC expense shortcuts** (6a)
15. **Bulk operations** (11c)
16. **Spending velocity indicator** (4b)
17. **Data export** (11d)

### Longer-Term / Nice-to-Have
18. **Smart daily planning in Focus** (5a)
19. **Watch quick-action presets** (9b)
20. **Custom formula prerequisites** (3c)
21. **Meal plan → Budget impact** (2c)
22. **Command palette** (11b)
23. **Guest shopping requests** (10a)
24. **Partner spending comparison** (4e)
