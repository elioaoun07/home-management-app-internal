---
created: 2026-05-29
type: roadmap
status: superseded
superseded: 2026-07-15
owner: Elio
tags:
  - pm/roadmap
  - scope/cross-cutting
---

# 3 · Future Vision & Roadmap

> ⚠️ **ARCHIVED IN PLACE (2026-07-15)** — historical layer; do not update, do not treat as current. Current truth: the FABLED 2 layer (per-campaign `FABLED 2/_index.md`; whole-app [FABLED 2 Master Index](<../00 - Home/FABLED 2 Master Index.md>)). Execution: the campaign `4 - Checklist.md` lanes. View: `pnpm pm`. Router: [_index](<_index.md>).

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>)
>
> **What this file is:** the *ambitious* file — where ERA could go. Enhancements to what exists **and** entirely new territory. This is allowed to dream; file 2 is the sober reality. Builds directly on your own backlog (`07 - Backlog & Ideas/Feature Optimizations.md`, `Dashboard V2`).

---

## The strategic thesis

You've built ~40 modules. **More modules is not the moat.** Anyone can add a feature. Your two genuine advantages are:

1. **The household graph** — one shared data layer (`household_links`) spanning money, tasks, food, chores, trips, inventory. Almost no consumer app has *all* of this for *one household* in *one place*.
2. **ERA, the proactive AI** — positioned in CLAUDE.md as the "top-layer primary interface," but today it's mostly a *reactive* chat.

**The vision in one line:** *Turn ERA from a chat box into the household's chief-of-staff — an assistant that reads the whole graph and acts before you ask.* Everything below ladders up to that.

---

## Track A — Connect the islands (highest ROI, lowest risk)

Your modules are strong but **siloed**. The biggest near-term wins are *bridges*, not new buildings. (Most of these are already named in your backlog — listed here with the product upside.)

| Bridge | Today | The dream | From backlog |
|---|---|---|---|
| **Inventory → Shopping List** | Low-stock alerts are dead-ends | Hit threshold → auto-draft shopping item | 2a |
| **Recipe ↔ Inventory** | No link | "You have 6/8 ingredients — add the 2 missing?" | 2b |
| **Meal Plan → Budget** | No cost signal | "This week's plan ≈ $74 in groceries" | 2c |
| **Recurring → Budget Allocation** | Manual envelopes | Auto-suggest category minimums from recurring totals | 2d |
| **Debt → Reminders** | Passive list | Auto-reminder + nudge on collection date | 2e |
| **Future Purchase → Transactions** | Goal only | Detect the actual purchase → auto-complete, show planned vs actual | 2f |
| **Statement merchant map → manual entry** | Import-only | Type "Spinneys" → auto-suggest "Groceries"; learn from corrections | 1b |

> **Why this track first:** each bridge is a few days, reuses existing data, and makes *every* module feel smarter. This is how you get a "10× better app" without a single new table.

---

## Track B — The Intelligence Layer (the actual moat)

Make ERA proactive. Each of these turns passive data into an *unprompted* action.

- **Proactive spending alerts** — "Dining is 3× your weekly norm." "Grocery budget 80% spent, 12 days left." Burn-rate gauge on the dashboard. *(backlog 1a, 4b, 4c)*
- **Briefing enrichment** — Focus/ERA briefing pulls from *all* modules: recurring due this week, low stock, debt due Friday, budget pace. *(1c)*
- **Natural-language everything** — multi-transaction ("$30 groceries and $15 gas"), relative dates ("yesterday I paid $20 lunch"), and a chat command "budget status" that answers from live data. *(1d, 8c)*
- **Smart categorization that learns** — remember every correction; converge on your personal merchant→category map. *(1b)*
- **Finish the Prerequisites engine** — ship the 4 stubbed evaluators. `time_window` ("show meds 7–9am"), `schedule` ("after gym → log meal"), `custom_formula` ("balance < $500 → surface 'review subscriptions'"). This is *conditional automation* — rare and powerful. *(3a–3c)*
- **Weekly digest, not daily noise** — one Sunday push: spent X of Y, N tasks done, M upcoming. Quiet hours (no 2am budget alerts). *(7a, 7b)*

---

## Track C — New territory (net-new modules)

Genuinely new surfaces that fit the household graph. Ranked roughly by fit.

1. **Cashflow Forecast Calendar** — a forward-looking calendar merging recurring payments, known income, and scheduled debts: *"On the 15th, 3 payments totaling $X hit; projected low balance June 22."* Your single most-requested-shaped idea (recurring calendar + forecasting). *(4-series, Dashboard V2 iii)*
2. **Subscriptions Manager** — recurring payments already hold the data; surface "$X/mo on subscriptions," flag ones with no matching transactions (unused), track YoY creep, one-tap cancel-reminder. *(4a)*
3. **Documents Vault** — you already touched "ID documents" (commit May 16). Generalize: passports, IDs, warranties, insurance, with expiry reminders feeding Notifications. High household value, low module complexity. *(IMPLEMENTED 2026-06-29: Catalogue Documents now stores Arabic equivalents with English/Arabizi suggestions, usual cost, prerequisites, copy/original requirement, and issuing location metadata. Remaining: expiry reminder wiring.)*
4. **Vehicle / Maintenance** — service intervals, registration/insurance expiry, fuel log (ties to NFC gas-station shortcut), cost-per-km. A natural NFC + recurring + reminders junction.
5. **Health & Habits** — medication windows (perfect `time_window` prerequisite demo), habit streaks, appointments. Reuses Items + Notifications + Focus.
6. **Receipts OCR** — photo → parsed transaction (amount, merchant, date) → draft. Closes the loop with Statement Import + Drafts. *(long-requested)*
7. **Global Search + Command Palette** — one ⌘K across transactions, items, recipes, catalogue, chat. The single biggest "feels like a real product" upgrade. *(11a, 11b)*
8. **Open Banking / bank-feed import** — the eventual endgame for Statement Import; removes manual entry entirely. High effort, high payoff, region-dependent.

---

## Track D — Platform & polish (make it feel premium)

- **Data export** — CSV/PDF for tax season, monthly auto-reports, partner-shareable summary. *(11d)*
- **Bulk operations** — multi-select categorize/delete/postpone. *(11c)*
- **Partner spending comparison** — informational, non-judgmental household view. *(4e)*
- **Watch glanceables** — complication tiles (daily spend, next task), quick-action presets. *(9)*
- **Native shell (Capacitor)** — per your memory, revisit *only when NFC becomes a daily habit* (~2-day effort). Don't pre-build it.
- **Guest portal → household value** — guest can request a shopping add or reimbursement that lands as an approval in your hub. *(10)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Briefing enrichment (B)      Cashflow Forecast (C1)
   │  Inventory→Shopping (A/2a)    Intelligence alerts (B/1a)
   │  Recipe↔Inventory (A/2b)      Global Search (C7)
   │  Smart categorization (B/1b)  Finish Prerequisites (B/3)
   ├───────────────────────────────────────────────────────
M  │  Recurring→Budget (A/2d)      Subscriptions Mgr (C2)
   │  Debt→Reminder (A/2e)         Documents Vault (C3)
   │  Weekly digest (B/7b)         Receipts OCR (C6)
   ├───────────────────────────────────────────────────────
L  │  Bulk ops (D)                 Open Banking (C8)
   │  Watch tiles (D/9)            Native shell (D)
   └───────────────────────────────────────────────────────►
        LOW EFFORT            MED EFFORT            HIGH EFFORT
```

---

## 🎯 The three bets (my recommendation)

If you asked me where to point the next two months *after* this week's hardening sprint:

1. **Bet 1 — "Connect the islands" (Track A).** 6–8 bridges over ~3 weeks. Lowest risk, compounding payoff, makes the whole app feel intelligent. **Start here.**
2. **Bet 2 — "ERA gets proactive" (Track B).** Briefing enrichment + spending alerts + finish Prerequisites. This is the moat; it's what no competitor has.
3. **Bet 3 — One flagship new module: Cashflow Forecast Calendar (C1).** It's the natural synthesis of recurring + income + debts + analytics, and it's the kind of thing that makes the app *indispensable* for real financial decisions.

> Resist the urge to start all three. Land Bet 1 fully before opening Bet 2. Velocity without depth is how you got 6 undocumented, untested modules.

→ This week's concrete actions: [4 · This Week](<4 - This Week (Action Plan).md>).
