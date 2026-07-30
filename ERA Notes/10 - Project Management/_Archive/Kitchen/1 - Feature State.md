---
created: 2026-05-30
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/kitchen
---

# Kitchen · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *honest, no-hype* state of every Kitchen sub-feature — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 2).
>
> **Method & confidence:** a **structural** assessment derived from the modules' vault docs, live route/API surface, and `src/features/`. It is **not** a line-by-line correctness audit. Treat tiers as "how battle-tested," not "bug-free."
>
> **Module identity:** "Kitchen" is a convenience grouping of the household food domain — **Recipes**, **Meal Planning**, **Inventory** (standalone) and **Shopping List** (junction). At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) all four are **🔵 Established** — fully built and shipping, less hammered than the Core finance/schedule modules. The defining trait is that they're **built but loosely connected** — the value is in the bridges, not the pieces.

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Recipes** | 🔵 Established | Recipe book, ingredients, instructions, cooking mode, version compare, page-flip UI. Solid standalone. | Connect to Inventory (gap 2b) — cooking should know what's in stock. |
| **Meal Planning** | 🔵 Established | Weekly planner, drag-drop, recipe→day, web calendar, add-to-shopping. Junction over Recipes + Calendar + Shopping. | Add budget-impact estimate per plan (gap 2c). |
| **Inventory** | 🔵 Established | Stock counts, restock, low-stock, barcode lookup, history, add-to-shopping. | Auto-create shopping items on low stock (gap 2a). |
| **Shopping List** | 🔵 Established | Hub ↔ Recipes ↔ Inventory. Uses the **legacy localStorage queue in `SyncContext`** — this is **intentional** (the one sanctioned legacy-queue path); don't migrate it to IndexedDB casually. | Wire Inventory low-stock auto-add (gap 2a). |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code maps live in the per-module vault docs:

- [Recipes / Overview](<../../02 - Standalone Modules/Recipes/Overview.md>)
- [Inventory / Overview](<../../02 - Standalone Modules/Inventory/Overview.md>)
- [Meal Planning / Overview](<../../03 - Junction Modules/Meal Planning/Overview.md>)
- [Shopping List / Overview](<../../03 - Junction Modules/Shopping List/Overview.md>) (+ `Shopping List.md`)
- Offline note: Shopping List is the **only** feature still on the legacy localStorage queue — see [Sync & Offline / Overview](<../../03 - Junction Modules/Sync & Offline/Overview.md>) and CLAUDE.md ("don't add to it").

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The pieces are built; the bridges are thin.** Recipes, Meal, Inventory each work in isolation, but the chain that makes the domain *smart* — cook a recipe → deplete inventory → low stock → auto-add to shopping → plan next week's meals around what's cheap/in-season — is mostly manual. The value is in closing that loop (file 2).
2. **Inventory → Shopping low-stock auto-add is the missing link** (gap 2a) — the single highest-leverage connection.
3. **Shopping List rides the legacy localStorage queue by design** — a correctness trap if someone "modernizes" it without knowing it's intentional. Documented, but easy to trip.
4. **No tests** across the domain (consistent with all 🔵 Established modules).

→ The growth opportunities are in [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>); the concrete next steps are in [3 · Action Plan](<3 - Action Plan.md>); the checkable list is [4 · Checklist](<4 - Checklist.md>).
