---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/kitchen
---

# Kitchen · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/2](<../FABLED/2 - FABLED — Gaps & Missing.md>)
>
> Every v1 gap is still open — the ledger is one row: *no change*. So this file's job is different: keep the ranking honest and add what changed in the app around each gap.

---

## 🔴 G1 — The keystone: low-stock → auto-add (carried v1-G1, 3+ months on the books)

Detection exists, add exists, nothing connects them. v1 settled the design questions; June settled the remaining two *patterns*:

- **Idempotency:** the Schedule precedent (`onConflict` upsert keyed on a natural identity — here `inventory_item_id + open-list`) answers "dropping below threshold twice must not duplicate."
- **UX shape:** the Hub draft/proposal pattern answers "never add silently" — auto-added rows arrive as proposals with provenance ("low stock: milk 0.5 < 1"), one tap to keep or dismiss.

There is no remaining design blocker. What's missing is a scheduled slot — the same execution-slot failure flagged in [Schedule FABLED 2.2 · G3](<../../Schedule/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>).

## 🔴 G2 — Cooking doesn't change reality (carried v1-G2)

Unchanged. The matching layer (ingredient ↔ inventory item) is still the hard 20% and still the most reusable artifact in the domain (E2/E3/E1-stage-2 all consume it). Never silently deduct — confirmation card, pre-checked matches.

## 🟠 G3 — No price layer (carried v1-G3, now cheaper)

Still blocks budget-aware planning — but Budget's June work built `normalizeMerchant` and statement line-item parsing, so the "statement-import grocery lines" seed option went from speculative to half-built. Recommended seed stays manual-price-on-staples (ships in a day); statement observations upgrade it later.

## 🟠 G4 — Planned meals invisible to time surfaces (carried v1-G4, now embarrassing)

The cheapest cross-module win in the app got cheaper: `WebDayPlanner` is *the* selected-day surface now, and it renders injected non-rrule rows by design (the flexible pattern). A read-only `getMealsForRange()` projection has an obvious one-file consumer. Three weeks of planner usage without tonight's dinner on it is the gap made visible daily.

## 🟡 G5 — Inventory has no front door (carried v1-G5)

Unchanged, still undocumented as intentional. One paragraph in the Inventory vault doc closes it as a *decision*; silence keeps it a *gap*.

## 🟡 G6 — The AI recipe surface is unprotected (carried v1-G6)

Unchanged: no fixtures for `extract-from-url`, no structured-error guarantee on optimize/scale/substitute, `timeoutMs` compliance unaudited. Budget's `AnalysisReport` shows the target shape: schema-constrained JSON + tolerant Zod + deterministic fallback. Porting that contract to recipe extraction is now imitation, not invention.

## 🟡 G7 — Check-off → restock manual (carried v1-G7)

Unchanged; still correctly deferred until G1/G2 prove the matching model.

## ⚪ G8 — Zero tests domain-wide (carried v1-G8, escalated one notch)

Kitchen is now the **only** campaign domain with zero tests — Budget has 6 suites, Schedule 3. The two pure candidates (scale ratios, threshold boundary) remain sub-hour wins. The threshold test is not optional before G1: an off-by-one at the boundary *is* the duplicate-proposals bug.
