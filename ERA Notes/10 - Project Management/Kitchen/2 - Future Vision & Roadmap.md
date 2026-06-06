---
created: 2026-05-30
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/kitchen
---

# Kitchen · 2 — Future Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the *ambitious* Kitchen file — where the food domain could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State — Current Reality.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Kitchen is the household's **food loop** — recipes describe what you make, inventory tracks what you have, meal planning schedules what you'll eat, shopping closes the gap. Today each piece works but the loop is **open**: you cook without inventory updating, you plan without knowing the budget, you run out without the list knowing. Its untapped value is one idea:

1. **Close the loop and the domain becomes self-driving.** Cook a recipe → deplete inventory → low stock → auto-add to shopping → buy → restock → plan next week around what you have. Each link already half-exists; wiring them turns four tools into one assistant.

**The vision in one line:** *Turn Kitchen from four separate tools into one closed loop — what you cook, have, plan, and buy stay in sync without you reconciling them by hand.*

---

## Track A — Internal enhancements (within the domain)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Recipe → Inventory awareness** | Recipes list ingredients; cooking mode is standalone | Cooking mode shows what's in stock vs missing; cooking deducts inventory | M |
| **Meal plan budget estimate** | Plan a week of meals; no cost signal | Each plan shows an estimated grocery cost from catalogue/inventory prices (gap 2c) | M |
| **Pantry-aware recipe suggestions** | Browse recipes manually | "You have these 6 ingredients → here's what you can make" | M |
| **Smarter low-stock thresholds** | Fixed low-stock flag | Per-item thresholds + restock cadence from usage history | S–M |
| **Barcode → catalogue price** | Barcode lookup populates inventory | Tie scanned items to catalogue product prices for cost tracking | M |

---

## Track B — Bridges out of Kitchen (cross-module)

Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Inventory low-stock → Shopping List auto-add.** The keystone link: when stock drops below threshold, the item appears on the shopping list automatically. *(gap 2a — highest leverage)*
- **Recipe → Inventory.** Cooking a recipe deducts its ingredients from inventory. *(gap 2b)*
- **Meal Planning → Budget.** Surface estimated grocery cost per plan so meals are budget-aware. *(gap 2c → Budget bridge)*
- **Meal Planning → Schedule.** A planned meal is a dated event — surface it on the calendar/today views.
- **Kitchen → ERA briefing.** "You're low on 3 staples and have nothing planned for Thursday" — proactive food nudges. *(global Track B · briefing enrichment)*
- **Trips → Kitchen.** A trip's meal/packing side already touches Meal + Catalogue — make the cascade legible from the Kitchen side. *(global Trips row)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Inventory→Shopping auto-add (B)  Pantry-aware suggestions (A)
   │  Recipe→Inventory deduct (B)      Meal→Budget estimate (B/A)
   │                                   Kitchen→ERA nudges (B)
   ├──────────────────────────────────────────────────────────
M  │  Smarter low-stock thresholds(A)  Barcode→catalogue price (A)
   │  Meal→Schedule surfacing (B)
   │
   ├──────────────────────────────────────────────────────────
L  │  (—)                              Trips→Kitchen visibility (B)
   │
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Kitchen:

1. **Bet 1 — Inventory low-stock → Shopping List auto-add.** The keystone (gap 2a): it's the single link that makes the loop start to close, and it's the most-felt daily win.
2. **Bet 2 — Recipe → Inventory deduction.** The second link: cooking actually changes what you have. Together with Bet 1 the loop is half-automatic.
3. **Bet 3 — Meal plan budget estimate.** Bridges Kitchen ↔ Budget and makes meal planning a money decision, not just a food one. *(coordinate with [Budget · 2](<../Budget/2 - Future Vision & Roadmap.md>))*

> The domain's payoff is the **loop**, not any single tool. Resist polishing one piece in isolation — every bet above is a link between two pieces.

→ This period's concrete actions: [3 · Current Action Plan](<3 - Current — Action Plan.md>).
