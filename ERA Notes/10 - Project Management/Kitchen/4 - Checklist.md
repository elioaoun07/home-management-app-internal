---
created: 2026-06-20
updated: 2026-07-13
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/kitchen
---

# Kitchen · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Kitchen — every open actionable item as one checkbox, grouped **Now / Next / Later**. Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. Point at a line (e.g. _N1_), a group, or a phase.

---

## ▶️ Now — The keystone link

- [ ] **N1** Inventory low-stock → Shopping List auto-add (gap 2a) — when stock drops below threshold, the item appears on the shopping list. ⚠️ Respect the **legacy localStorage queue** (Shopping List rides it by design — see [Sync & Offline](<../../03 - Junction Modules/Sync & Offline/Overview.md>)); don't migrate it as a side-effect. _(🟠 · M)_

## ⏭️ Next — Second link

- [ ] **X1** Recipe → Inventory deduction (gap 2b) — cooking a recipe deducts its ingredients from inventory, which then feeds N1's low-stock trigger. _(🟠 · M)_

## 🔜 Later — Budget- and AI-aware

- [ ] **L1** Meal plan budget estimate (gap 2c) — show estimated grocery cost per plan. Coordinate with [Budget · 3 · Action Plan](<../Budget/3 - Action Plan.md>). _(🟡 · M)_
- [ ] **L2** Kitchen → ERA nudges — "low on staples, nothing planned Thursday." _(🟡 · M)_
- [ ] **L3** Pantry-aware recipe suggestions ("what can I make with what I have"). _(🟡 · M)_
- [ ] **L4** Smarter per-item low-stock thresholds + restock cadence from usage history. _(🟡 · S–M)_
- [ ] **L5** Meal Planning → Schedule (planned meals on the calendar/today views). _(🟡 · M)_
- [ ] **L6** Barcode → catalogue price for cost tracking. _(⚪ · M)_
- [ ] **L7** Trips → Kitchen cascade visibility (meal/packing side-effects). _(⚪ · M)_

---

## ✅ Definition of done — this period

- [ ] **D1** Dropping an inventory item below threshold puts it on the shopping list automatically (without breaking the legacy queue).
- [ ] **D2** Completing a recipe in cooking mode deducts its ingredients from inventory.
- [ ] **D3** [1 · Feature State](<1 - Feature State.md>) updated to mark gap 2a / 2b closed.
