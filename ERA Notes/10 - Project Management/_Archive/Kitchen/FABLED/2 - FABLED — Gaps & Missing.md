---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/kitchen
---

# Kitchen · FABLED 2 — Gaps & Missing

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Ranked. The loop-link table in [file 1 §4](<1 - FABLED — Current Implementation.md>) is the master list; this file adds the *why* and what's beyond the loop.

---

## 🔴 G1 — The keystone link is one trigger away (gap 2a)

Low-stock **detection** exists (`api/inventory/low-stock`), shopping **add** exists (`api/inventory/add-to-shopping`) — nothing connects them. The auto-add is a wiring decision, not a build:

- **Where the trigger lives:** server-side on stock mutation (`stock/[itemId]` + `restock` routes check threshold after write) is more reliable than client-side; a cron sweep is the fallback for missed events.
- **Idempotency is the real design problem:** dropping below threshold twice must not create duplicates; restocking should (optionally) clear the auto-added item. Decide these two rules first; the code is small.
- **Respect the legacy-queue rule** (file 1 §5).

## 🔴 G2 — Cooking doesn't change reality (gap 2b)

Cooking mode logs the event (`cooking-log`) but inventory stays untouched — the user reconciles by hand, which is precisely what the domain promises to remove. Needs: ingredient↔inventory-item matching (the hard 20%), quantity-unit mapping, and an "adjust before commit" confirmation in cooking mode (never silently deduct).

## 🟠 G3 — No price layer, so no budget awareness (gap 2c)

Meal plans can't estimate cost because **nothing in the domain stores prices**. The price source decision blocks this: catalogue product prices, statement-import grocery lines (Budget FABLED E9), or manual entry on inventory items. Pick one seed source; don't build all three.

## 🟠 G4 — Planned meals are invisible to time surfaces

A planned dinner is a dated fact, but it doesn't show on the calendar, today view, or in ERA's morning shape. Cheapest cross-module visibility win in the app (read-only projection — no new tables).

## 🟡 G5 — Inventory has no front door

Inventory UI mounts inside Catalogue only; there's no `/inventory` route and no nav entry of its own. Fine if intentional (it *is* catalogue-adjacent) — but it makes the restock/low-stock workflow invisible to a partner who doesn't know where it hides. Decide deliberately; if intentional, document it in the Inventory vault doc.

## 🟡 G6 — The AI recipe surface is unprotected

`extract-from-url` (21 KB of parsing + AI), `optimize`, `substitute`, `scale` have no fixtures or tests — a Gemini prompt/response drift silently breaks import, and there's no recorded sample corpus to detect it. Also verify they all pass long `timeoutMs` and ride `lib/ai/rateLimit.ts`.

## 🟡 G7 — Check-off → restock is manual

Buying something on the list doesn't move stock; the loop's last link. Defer until G1/G2 prove the matching model (it reuses the same item-matching).

## ⚪ G8 — Zero tests domain-wide

Consistent with all 🔵 Established modules, but the pure surfaces (scale ratios, threshold logic) are cheap wins — see [file 3 · O1](<3 - FABLED — Optimization Plan.md>).
