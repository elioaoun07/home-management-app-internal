---
created: 2026-05-30
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/kitchen
---

# Kitchen · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* for Kitchen — the strategic call and the candidate work as narrative. The flat, checkable version of this plan is [4 · Checklist](<4 - Checklist.md>); tick the boxes there.

---

## 📌 The call

**This period: close the loop, one link at a time.**

Kitchen's four pieces are all 🔵 Established and stable — so the danger isn't missing features, it's that they're **loosely connected** and the user does the reconciliation by hand (cook, then manually mark inventory, then manually add to the list). The payoff is the loop, not more polish. Start with the single highest-leverage link — Inventory low-stock → Shopping List auto-add — then make cooking deduct inventory.

This mirrors the global theme ("Stabilize, then Connect") — here the pieces are already stable, so it's almost all **Connect**.

---

## 🎯 Candidate work (from [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>))

| Candidate | Track | Impact | Effort | Keystone? |
|---|---|---|---|---|
| Inventory low-stock → Shopping auto-add | B | High | M | ✅ yes (gap 2a) |
| Recipe → Inventory deduction | B | High | M | — (gap 2b) |
| Meal plan budget estimate | B | High | M | — (gap 2c) |
| Pantry-aware recipe suggestions | A | High | M | — |
| Smarter low-stock thresholds | A | Med | S–M | — |
| Meal Planning → Schedule surfacing | B | Med | M | — |
| Barcode → catalogue price | A | Med | M | — |
| Kitchen → ERA food nudges | B | High | M | — |

---

## 🗺️ The sequence (narrative)

**Now — The keystone link.** Inventory low-stock → Shopping List auto-add (gap 2a): when stock drops below threshold, the item appears on the shopping list. ⚠️ Shopping List rides the **legacy localStorage queue** by design — respect that path (see [Sync & Offline](<../../03 - Junction Modules/Sync & Offline/Overview.md>)); don't migrate it as a side-effect.

**Next — Second link.** Recipe → Inventory deduction (gap 2b): cooking a recipe deducts its ingredients, which then feeds the low-stock trigger. Together these make the loop half-automatic.

**Later — Budget- and AI-aware.** Meal plan budget estimate (gap 2c — coordinate with [Budget · 3 · Action Plan](<../Budget/3 - Action Plan.md>)) and Kitchen → ERA nudges ("low on staples, nothing planned Thursday").

→ Every item above as a checkable line: [4 · Checklist](<4 - Checklist.md>).

---

## 🚫 Not now

- ❌ Don't migrate Shopping List off the legacy localStorage queue — it's intentional; touching it risks the one sanctioned legacy path.
- ❌ Don't polish a single tool in isolation (e.g. recipe UI) while the loop stays open — the value is the connections.
- ❌ Don't start barcode→catalogue pricing before the inventory→shopping link works.

---

## ⏭️ Later / backlog

- Pantry-aware recipe suggestions ("what can I make with what I have").
- Smarter per-item low-stock thresholds + restock cadence from usage history.
- Meal Planning → Schedule (planned meals on the calendar/today views).
- Barcode → catalogue price for cost tracking.
- Trips → Kitchen cascade visibility (meal/packing side-effects).
