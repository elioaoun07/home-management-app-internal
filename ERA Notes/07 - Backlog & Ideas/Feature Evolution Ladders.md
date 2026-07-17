---
created: 2026-07-17
type: ideas
status: living
owner: Elio (authored by Claude Fable 5)
tags:
  - backlog/ideas
  - scope/vault
---

# Feature Evolution Ladders — every feature's L2, L3, and Ultimate form

> **What this file is:** a growth map organized as **ladders, not lists**. For every feature: where it stands (**Now**), its direct next evolution (**Level 2**), the compounding evolution after that (**Level 3**), and its **Ultimate** form — the version where the feature stops being a tool and becomes part of the household's nervous system. Use it to plan iterations: *one rung per iteration, never skip a rung.*
>
> **How it relates to what already exists:** the campaign `2 - Vision & Roadmap` files hold *committed direction*, the FABLED 2 `4 - Future Enhancements` files hold *scored, kill-criteria'd bets*. This file sits above both: it shows the **trajectory** each feature is on. Where a rung is already planned, it cites the plan (`Budget E1` = Budget FABLED 2 enhancement 1) instead of re-describing it. Rungs with no citation are **new ideas introduced here**.
>
> **The reading rule:** L2 rungs are largely buildable this quarter. L3 rungs assume their L2 shipped. Ultimate rungs are direction-setting — they exist so every L2/L3 decision can be checked against "does this move toward or away from the ultimate form?"

---

## The one-page ladder map

| Feature | Now | L2 (next) | L3 (compounding) | Ultimate |
|---|---|---|---|---|
| **Transactions** | manual ledger | Receipt OCR → drafts | Self-learning categorizer | Zero-entry ledger |
| **Accounts & Balance** | balances + history | Reconciliation assistant | LBP-aware net-worth timeline | Financial digital twin |
| **Recurring** | auto-post + forecast list | Subscription auditor *(Budget E7)* | Price-creep & renewal radar | Commitments autopilot |
| **Budget Allocation** | envelopes | Funding flow *(Budget E10)* | Goal envelopes (sinking funds) | Self-balancing budget |
| **Debts** | list + settle | Debt→Schedule reminder *(Budget E4)* | Household netting engine | Social ledger |
| **Future Purchases** | wishlist | Auto-complete on purchase *(Budget E5)* | Affordability windows | Purchase advisor |
| **Analytics** | historical charts | AnalysisReport everywhere *(Budget E6)* | What-if sandbox | Household simulator |
| **Statement Import** | CSV/PDF + merchant map | Merchant map → all entry lanes | Reconciliation engine | Continuous bank feed |
| **Items & Reminders** | calendar + recurrence | One engine, one action sheet | Week-shape smart placement | Self-organizing calendar |
| **Chores** | list + postpone | Fairness ledger | Rotation & streaks engine | Presence-driven autopilot |
| **Plan My Day** | disrupted-day triage | Hourly timeline canvas | Energy/intent optimizer *(Schedule E9)* | Continuous replanner |
| **Prerequisites** | NFC + item-completed | `time_window` *(Schedule E2)* | Chained automations | Household automation engine |
| **Recipes** | book + cooking mode | Stock-aware cooking *(Kitchen E2)* | Taste-profile learning | — (feeds Kitchen autopilot) |
| **Inventory** | pantry counts | Low-stock → list *(Kitchen E1)* | Consumption-rate prediction | Predictive pantry |
| **Shopping List** | shared list | Store trip mode *(Kitchen E11)* | Price book + basket cost | Procurement agent |
| **Meal Planning** | weekly drag-drop | Meals on time surfaces *(Kitchen E6)* | Budget+pantry-aware planning | Kitchen autopilot |
| **Trips** | cascades fire | Impact panel *(Trips E1)* | Modes engine *(Trips E7)* | Life-context engine |
| **Hub Chat** | parse + act | Quick-capture both lanes (in flight) | Multi-turn flows *(Hub E8)* | The only interface you need |
| **ERA (AI)** | reactive chat + briefing | Briefing reads both spines *(Hub E1)* | Memory-grounded ERA *(Hub E7)* | Household chief-of-staff |
| **Voice** | Azure STT/TTS mode | Graceful degradation | openWakeWord hands-free *(Hub E3)* | Ambient ERA presence |
| **Notifications** | unified table + push | Policy engine *(Notif E1)* | Learning loop *(Notif E3)* | Attention operating system |
| **Household Sharing** | 2-person links | Assignment & visibility polish | Roles: kids, guests, scoped access | Multi-person household OS |
| **Guest Portal** | public slug views | Guest requests → approval inbox | Event mode | Temporary household members |
| **NFC Tags** | tap-to-log + state | More trigger verbs | Presence state machine | Ambient sensor layer |
| **Watch UI** | voice entry face | Glanceable complications | Wrist-first ERA | ERA on every surface |
| **Dashboard** | KPI landing page | V2 widgets (in flight) | Time-of-day adaptive | Dissolves into the briefing |
| **Sync & Offline** | IndexedDB queue | Retire legacy queue | Conflict-resolution UX | Local-first store |

---

# Cluster ladders — the detail

## 1 · Budget & Money — from ledger to household CFO

**The cluster's arc:** Now = a ledger you review → L2 = a ledger that fills itself → L3 = a money graph that forecasts → **Ultimate = a household CFO that manages, not just reports.**

### Transactions
**Now:** strong manual entry (form, voice, NFC shortcuts, drafts), merchant-map glow shipped 2026-07-11.
- **L2 — Receipt OCR → drafts.** Photo of a receipt → Gemini parses amount/merchant/date/line-items → lands as a draft (the AI-proposes-human-confirms pattern already exists). Closes the biggest remaining manual-entry gap and reuses the drafts spine wholesale. *(named in archived Track C6 — never laddered; the line-item detail is new: parsed grocery lines can feed Inventory & the price book, see Kitchen L3.)*
- **L3 — Self-learning categorizer.** Every manual correction becomes training signal: the merchant map stops being import-only and becomes a per-household model that pre-fills category, account, *and* typical amount, with confidence chips the user can tap to fix. New capability on top: **anomaly flags at entry** — "you usually pay ~200k at this pharmacy; this says 2M — typo?" (decimal errors are the silent killer of money data).
- **Ultimate — Zero-entry ledger.** Entry stops being an act and becomes a confirmation: bank feed (when regionally possible) + receipt OCR + NFC + voice cover capture; the human's only job is swiping ✓/✗ on a morning drafts queue. The expense form survives purely as the precision tool — exactly the CLAUDE.md interaction model, completed.

### Accounts & Balance
**Now:** accounts, balance card, history drawer; balance math unit-tested since 2026-07-03.
- **L2 — Reconciliation assistant.** A monthly "does the app match reality?" ritual: enter the real bank/wallet balance, the app shows the delta, walks likely culprits (uncategorized, duplicates, missed transfers), and posts an adjustment with an audit trail. Trust in the numbers is the foundation every other money rung stands on.
- **L3 — LBP-aware net-worth timeline** *(extends Budget E9)*. Net worth over time with each account valued in its own currency **and** the currency-mix risk made visible: "your savings are 60% LBP — a 10% devaluation costs you X." No imported app can do this; it is the app's most defensible money feature.
- **Ultimate — Financial digital twin.** One live model of the household's money: every account, obligation, debt, and goal, projected forward (rides Budget E1's cashflow engine). Any question — "can we afford the Turkey trip in October?" — is answered from the twin, in chat, with the assumptions shown.

### Recurring Payments
**Now:** auto-post, forecast list, commitments console (2026-07-03).
- **L2 — Subscription auditor** *(Budget E7)*: surface total subscription burn, flag commitments with no matching transactions (zombie subscriptions), one-tap cancel-reminder.
- **L3 — Price-creep & renewal radar.** Track each commitment's amount over time; alert on increases ("internet went from 500k → 650k over 6 months") and create pre-renewal decision points ("insurance renews in 3 weeks — last year you said 'shop around'"). The note-to-future-self mechanic is new and cheap: a text field on the commitment that resurfaces at the next renewal.
- **Ultimate — Commitments autopilot.** ERA owns the recurring layer: it knows what's due, warns what will overdraw (cashflow engine), proposes skips/pauses during tight months, drafts the cancellations you approved — the human sets policy, ERA executes inside the drafts pattern.

### Budget Allocation (envelopes)
**Now:** per-category envelopes, AI-proposed allocation from outlier-cleaned history (2026-06-26).
- **L2 — Envelope funding flow** *(Budget E10)*: account funding → Wallet → recurring minimums → envelopes reads as one flow.
- **L3 — Goal envelopes (sinking funds).** Envelopes with a target amount *and date* — "€800 for Christmas by Dec 1" — that auto-compute the monthly set-aside and link to Future Purchases (a wishlist item can *become* a sinking fund). Progress feeds the briefing.
- **Ultimate — Self-balancing budget.** Allocations become a policy, not a spreadsheet: ERA rebalances envelopes monthly from the forecast (income due, commitments due, goals' required pace), proposes the delta, and one tap applies it. Budgeting time drops to one confirmation per month.

### Debts
**Now:** owed-to/owed-by list with settlement.
- **L2 — Debt→Schedule reminder** *(Budget E4)*: collection date auto-creates a reminder; settling closes it.
- **L3 — Household netting engine.** When multiple debts cross between the same people ("I owe Samir 50, he owes us 30"), propose the net settlement. Add debt *aging* — "this has been open 4 months" — as a briefing signal.
- **Ultimate — Social ledger.** Splitwise-class shared expenses inside the Hub: split a bill conversationally *(Hub E2)*, guests can request reimbursement via the Guest Portal, every IOU lives in one place with its history — the app becomes the household's ledger *with the outside world*, not just inside it.

### Future Purchases
**Now:** wishlist with target dates.
- **L2 — Auto-complete on purchase** *(Budget E5)*: a matching transaction closes the wishlist item, showing planned vs actual.
- **L3 — Affordability windows.** Each wishlist item gets a forecast-computed answer to "when can I buy this without breaking anything?" — "safe after Mar 3, tight before." Turns the wishlist from a list of wishes into a queue with dates.
- **Ultimate — Purchase advisor.** For big-ticket items: price history you log (or paste), a "wait vs buy" read from the forecast, and post-purchase closure into the Documents vault (warranty, receipt). The wishlist becomes where purchase *decisions* happen.

### Analytics / Statement Import / Drafts
- **Analytics L2:** `AnalysisReport` as the app-wide AI contract *(Budget E6)* — every module can answer "analyze this" with KPIs + insights + a dashboard render. **L3 — What-if sandbox:** fork the forecast, change an assumption ("rent +15%", "drop the gym"), diff the outcomes. **Ultimate — Household simulator:** model life events (car, move, baby) as scenario bundles over the digital twin.
- **Statement Import L2:** merchant map feeding voice drafts + Hub actions (in flight, X2a/X2b). **L3 — Reconciliation engine:** imported statements dedupe against manually-logged transactions instead of coexisting — import becomes *verification* of the ledger, not a second source. **Ultimate:** absorbed by the bank feed; the import UI survives for statement-only banks.
- **Drafts** is the cluster's load-bearing pattern, not a feature to grow — every ultimate rung above routes through it. Its one ladder rung: **a unified "needs your decision" inbox** (drafts + proposals + approvals from all modules) — see Notifications E4, which already points there.

---

## 2 · Schedule & Time — from calendar to self-organizing time

**The cluster's arc:** Now = a calendar you read → L2 = one trustworthy engine → L3 = a time graph that places things for you → **Ultimate = a calendar that organizes itself around your energy and intent.**

### Items & Reminders (the core)
**Now:** rich but split — three expansion engines, two action UIs (Stage 1 fixed 2026-06-19; Stages 2–3 open).
- **L2 — One engine, one sheet.** Finish recurrence Stages 2–3: every surface reads `expandOccurrences.ts`, one shared occurrence-action sheet. Not glamorous — but every rung above this one *multiplies* whatever bugs live here. This is the gate for the whole cluster.
- **L3 — Week-shape smart placement.** `getWeekShape()` *(Schedule E1)* + auto-placement: flexible items propose their own slots based on the week's density, and the overdue triage rolls missed items forward intelligently *(Schedule E4)*. NL capture trust chips *(Schedule E8)* make one-line entry the default.
- **Ultimate — Self-organizing calendar.** You declare intents ("gym 3× a week", "call mom weekly", "deep-work mornings"); ERA places, protects, and reshuffles them around fixed events, partner load, and trips — and *renegotiates* when a day breaks instead of leaving a graveyard of overdue items. The schedule pressure index *(Schedule E10)* becomes its sensor.

### Chores
**Now:** list, postpone, grouping, "up next" hero; trips pause them.
- **L2 — Fairness ledger.** Who actually did what, over time — not for blame, for visibility: a weekly "household load" split by person in the briefing. Data already exists in completions; this is a read.
- **L3 — Rotation & streaks engine.** Chores can be assigned by rotation rule ("alternate weekly"), streaks reward consistency, and a missed rotation offers a swap instead of silently piling up.
- **Ultimate — Presence-driven autopilot.** Chores dispatch themselves: NFC arrive-home + time windows + fairness balance decide who gets nudged for what, when they can actually do it. Nobody assigns chores; the household just stays run.

### Plan My Day
**Now:** disrupted-day triage with push-off/prepone, `day_plans` persisted.
- **L2 — Hourly timeline canvas** (already named in Schedule Track A): drag items into time slots.
- **L3 — Energy/intent optimizer** *(Schedule E9)*: `day_plans.intent` ("rest" vs "productive") actually changes what gets proposed — a rest day auto-defers the deferrable.
- **Ultimate — Continuous replanner.** Plan My Day stops being a page you visit after disruption and becomes a background process: when the day's shape breaks (a new event lands, a task overruns its estimate), ERA proposes the re-plan proactively. The page becomes the *review* of the re-plan, not the tool that makes it.

### Prerequisites
**Now:** engine live for `nfc_state_change` + `item_completed`; three evaluators stubbed.
- **L2 — `time_window`** *(Schedule E2)*: "show meds 7–9am" — smallest evaluator, proves conditional automation.
- **L3 — Chained automations.** `schedule` + `custom_formula` evaluators, and prerequisites that *compose*: "after gym AND at home AND before 9pm → log meal." The picker grows a simple chain builder.
- **Ultimate — Household automation engine.** The IFTTT of the household graph: any signal (NFC state, balance threshold, low stock, calendar shape, trip mode) can trigger any action (surface item, create draft, send nudge) — always through the drafts/proposal pattern, never writing money or schedule state directly. This is where Prerequisites, NFC, and Notifications' policy engine converge into one rule surface.

---

## 3 · Kitchen — from four tools to a self-driving food loop

**The cluster's arc (already crisply stated in Kitchen's vision):** close the loop. The ladder below is the *order* the loop closes in, plus two rungs beyond it.

- **L2 — The loop's first two links.** Low-stock → shopping list auto-add *(Kitchen E1)* + cooking deducts inventory *(Kitchen E2)* + meals appear on Today/calendar *(Kitchen E6 — the cheapest visible win in the app)*.
- **L3 — The loop learns.** Three compounding reads on top of a closed loop:
  - **Consumption-rate prediction** — restock cadence from usage history *(extends Kitchen "smarter thresholds")*: "milk runs out ~Thursday" beats "milk is low."
  - **Price book** — every purchase (receipt OCR line-items, statement lines, manual) feeds per-item price history → basket cost estimates on the list and true budget-aware meal planning *(Kitchen E4)*.
  - **Taste-profile learning** — cooked-history + ratings → "you loved this and haven't made it in 6 weeks"; pantry-aware suggestions *(Kitchen E3)* become *personal*.
- **Ultimate — Kitchen autopilot.** Sunday: ERA proposes the week's meals from pantry contents, budget envelope, taste profile, and the calendar's shape (busy Thursday → 15-minute recipe), generates the gap shopping list with estimated cost, and after each cooked meal the loop updates itself. You veto and swap; you never reconcile. Waste tracking *(Kitchen E5)* becomes the autopilot's error signal.

---

## 4 · Trips — from cascades to a life-context engine

**Now:** the boldest junction — activation/completion cascades across Budget, Schedule, Chores, Meals — but unverified (maturity 2.8).
- **L2 — Trust.** Verify the cascades end-to-end + the trip impact panel *(Trips E1)*: what this trip paused/created/reassigned, and what completion will reverse. *(Gate: nothing above this rung until it lands — per the campaign's own warning.)*
- **L3 — The modes engine** *(Trips E7)*. Generalize the machinery: a **mode** = a named context with enter/exit cascades and per-cascade opt-outs *(Trips E2)*. Trips becomes the first mode; "Sick," "Guests staying," "Ramadan," "Exam week" are configs, not code.
- **Ultimate — Life-context engine.** Modes activate from signals, not taps: a calendar event tagged travel arms Travel mode; three sick-day markers propose Sick mode; December proposes Holiday mode. Every module reshapes (budgets flex, chores redistribute, meal planning pauses, notification policy switches) — and everything restores, visibly and reversibly. This is the single strongest proof of the one-graph thesis.

---

## 5 · Hub & ERA — from chat box to chief-of-staff

**The cluster's arc:** the moat. Everything in every other ladder feeds this one.

### Hub Chat
**Now:** excellent reactive surface — parse, act, faces, widgets.
- **L2 — Both capture lanes complete** (in flight per Schedule reconciliation): rule-based NL in the form, Gemini in the Hub; message → item/transaction/list-entry all round-trip reliably. Plus: intent-router test coverage *(Hub Bet 1 — the trust gate)*.
- **L3 — Multi-turn task flows** *(Hub E8)* + **capability registry** *(Hub E6)*: "plan Samir's birthday" holds context across turns — budget check, calendar slot, shopping items — and every ERA capability is declared in one registry so chat, voice, and briefing stay in sync.
- **Ultimate — The only interface you need.** 90% of daily interactions happen conversationally; module pages are precision tools you visit weekly. The Hub's message history becomes the **household daily log** *(Hub E10)* — the searchable record of everything the household decided and did.

### ERA (the assistant)
**Now:** reactive chat + a briefing that reads a slice of Schedule.
- **L2 — The briefing reads both spines** *(Hub E1 + Schedule/Budget bridge pairs)*: week shape + cashflow + overdue + low stock, composed into one morning briefing that is *right*.
- **L3 — Memory-grounded ERA** *(Hub E7)*: durable household memory (preferences, corrections, decisions — "we don't eat pork", "Elio hates 8am anything") injected into every context. Add **explainability**: every proactive suggestion carries "why am I seeing this?"
- **Ultimate — Household chief-of-staff.** ERA reads the whole graph, speaks first at the right moments (policy-engine-timed), acts through drafts, remembers everything, and can be *delegated to*: "handle the groceries this week" is a valid instruction. The measure of ultimate: **days where the app helped without being opened.**

### Voice
- **L2 — Graceful degradation** (Hub Bet 1's other half): Azure down ≠ voice dead. **L3 — openWakeWord hands-free** *(Hub E3; the one viable vendor path per the Awakening plan)*. **Ultimate — Ambient presence:** ERA answerable from the kitchen counter (old tablet as a wall display / kiosk mode), the wrist, and the phone — same session, same memory.

---

## 6 · Notifications — from pipes to an attention OS

**Now:** technically complete and newly calm (registry, unified alerts page, calendar backup, takeover gate — 2026-07-10).
- **L2 — The delivery policy engine** *(Notif E1)*: one arbiter deciding channel, timing, and bundling per notification class; quiet hours; the Sunday digest *(Notif E2)*.
- **L3 — The learning loop** *(Notif E3)*: which nudges you act on vs swipe away tunes timing, channel, and frequency per type — the attention budget spends itself where it demonstrably works. Household-aware delivery *(Notif E5)*: route to whoever can act, not both phones.
- **Ultimate — Attention operating system.** Every interruption in the household's life — push, badge, briefing line, calendar alarm, watch tap, full-screen takeover, ERA speaking — flows through one policy brain with one budget. The app never interrupts twice for one fact, never interrupts for what can wait, and never misses what can't. Notification → conversation *(Notif E6)* makes every interrupt answerable.

---

## 7 · Household & Sharing — from couple to household OS

### Household Sharing
**Now:** robust 2-person layer (links, co-ownership, reassignment, color identity).
- **L2 — Visibility polish.** Assigned-out/assigned-to-me everywhere, partner-activity feed ("what changed since I last looked"), and the fairness ledger (Chores L2) as its first analytic.
- **L3 — Roles & members.** Kids and live-in family as first-class members with scoped access: a child sees their chores and allowance envelope, not the household finances. Allowance = a real envelope + their own completion streaks. Guests get time-boxed membership.
- **Ultimate — Multi-person household OS.** N members, roles, shared goals with per-member contributions, family calendar negotiation, and a household memory that outlives any device. The `household_links` pair becomes a genuine graph.

### Guest Portal
- **L2 — Requests → approval inbox:** a guest can request a shopping-list add or a reimbursement; it lands as a draft in the Hub *(archived Track D, never built)*. **L3 — Event mode:** a party/gathering gets a portal — RSVPs, who-brings-what, shared costs that settle into Debts. **Ultimate — Temporary household members:** a visiting parent for a month gets scoped, expiring access to exactly the modules they need.

---

## 8 · Platform & Ambient — the surfaces the OS runs on

- **NFC Tags — L2:** more verbs per tag (long-press = different action; tag + time-of-day = different action). **L3 — Presence state machine:** arrive/leave events maintain a per-person home/away state that Prerequisites, Chores autopilot, and the policy engine all read. **Ultimate — Ambient sensor layer:** NFC + time + device-usage patterns give ERA context without asking; the Capacitor shell decision (already triggered 2026-07-11) is this ladder's enabler.
- **Watch UI — L2:** complication tiles (today's spend, next item). **L3:** wrist-first ERA — one-line voice capture + briefing glances. **Ultimate:** folded into "ERA on every surface."
- **Dashboard — L2:** V2 widgets (in flight). **L3 — Adaptive dashboard:** morning shows the briefing + day shape; evening shows spend + tomorrow; Sunday shows the review. **Ultimate:** the dashboard dissolves into the briefing — it becomes the *rendered form* of what ERA would tell you.
- **Sync & Offline — L2:** retire the legacy localStorage queue; unify on IndexedDB. **L3:** visible conflict resolution (two offline edits to one item → a human-readable merge card). **Ultimate:** local-first store where the server is a sync peer — the app is instant and whole offline, always.
- **Documents (Catalogue) — L2:** expiry reminders wired (the one remaining piece from 2026-06-29). **L3:** renewal runbooks — each document type knows its renewal steps, cost, and lead time (the Arabic-equivalents + prerequisites metadata already anticipates this). **Ultimate:** the household's paperwork never surprises it — every expiry surfaces with its runbook, cost forecast, and calendar block, unprompted.

---

# The synthesis — what all ultimates add up to

Every ladder converges on the same three-plane architecture:

1. **The graph** (data plane) — money, time, food, people, things, places, documents: one household graph, already 80% built. The remaining work is *edges* (the bridges), not nodes.
2. **The intelligence** (decision plane) — forecast engines (cashflow, week shape, consumption rates), the automation engine (prerequisites generalized), the policy engine (attention), and ERA's memory. Everything proposes through **drafts**; the human stays the approver.
3. **The presence** (interaction plane) — Hub chat, voice, briefing, watch, wall display, NFC. The interfaces where ERA meets the household.

**ERA OS in one line:** *a household that runs itself to the exact degree you've told it to — and can show you why, undo anything, and hand back control at any rung.*

---

# The iteration playbook

**Rules for using this file:**

1. **One rung per iteration, per ladder.** A rung is a shippable slice with a felt result. Never build L3 on an unshipped L2.
2. **Respect the gates.** Four foundations are prerequisites for entire ladders — they are the *only* rungs worth doing under pressure:
   - Recurrence Stages 2–3 (gates all of Schedule's upper rungs)
   - Trip cascade verification (gates the entire Trips/modes ladder)
   - Intent-router tests + voice degradation (gates ERA's proactive rungs — a confidently-wrong assistant burns trust faster than any feature earns it)
   - Money-core test coverage beyond calc layer (gates forecast/twin rungs — a forecast amplifies any silent balance bug)
3. **Pair bridge ends.** Cross-module rungs (Recurring↔Schedule, Kitchen→Budget) ship both ends in one iteration or not at all — half a bridge reads as a bug.
4. **Check against the ultimate.** Before building any rung, ask: does this move its ladder toward the ultimate form, or sideways? Sideways features are how 40 modules happened.
5. **Kill criteria carry over.** Where a rung cites a FABLED 2 enhancement, that enhancement's kill criterion still applies — this file adds trajectory, it does not remove discipline.

**A suggested three-iteration opening** (if starting from today, 2026-07-17):

| Iteration | Theme | Rungs |
|---|---|---|
| **1 — Trust** | the gates | Recurrence Stage 2 · trip cascade verification · intent-router tests |
| **2 — The loop + the spine** | first felt wins | Kitchen L2 (all three links) · briefing reads both spines (ERA L2) |
| **3 — The first autopilot** | proof of the thesis | Notifications policy engine + digest · subscription auditor · fairness ledger |

After iteration 3, the app has one closed loop (Kitchen), one smart briefing (ERA), one calm attention layer — and every ladder above is unblocked.

---

*Related idea archives this file supersedes in **frame** (not content): the five `ERA - Future Vision` volumes explore the same destination narratively; `Innovative Feature Ideas.md` and `Proactive Life Optimization Ideas.md` hold additional unranked seeds — mine them when a ladder needs a rung filled.*
