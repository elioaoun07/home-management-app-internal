---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/budget
---

# Budget · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/3](<../FABLED/3 - FABLED — Optimization Plan.md>)
>
> Hardening for code that already works. v1's rule stands: most items fire "when next touched" — except O1 and O3, which are overdue debts to June's own work.

---

## O1 — The spend-definition contract test ⭐ (new; do before any money feature)

One fixture set of ~20 transactions engineered to trip every June rule: a debt return, a draft, a soft-deleted row, a split parent+children, a hidden-account spend, a partner-private row, an uncategorized spend, rows straddling the custom-month boundary. Assert:

1. `sumSpending` / `getSpendingTransactions` produce the known-correct total.
2. **Every consumer agrees** — call the pure aggregation used by budget-allocations, analytics, and the dashboard service against the same fixtures and assert one number.
3. Masking: the redaction function keeps real `category`, strips `subcategory`/`description`/`receipt_url`, preserves amount.

This one file converts the June sprint from "fixed" to "can't silently unfix." Cheapest insurance in the cluster.

## O2 — Route contract tests (carried v1-O1, unchanged priority)

`accounts`, `transactions`, `transfers`, `recurring-payments`, `budget-allocations`: valid/invalid zod payloads → 400/409/200 mapping; household expansion on/off via `ownOnly`; `23505 → 409`. The parse layer needs no DB. Then extract the confirm→transaction posting into `src/lib` and unit-test it (v1-O1.2, still the right move).

## O3 — Kill the debug quartet (carried v1-O6, escalated)

`api/analytics/debug`, `api/debug/supabase`, `api/env-check`, `api/supabase-check` — delete or wrap in an admin/env guard. 15 minutes total. Do it *this week*; it has been flagged since May 29 and each re-audit re-pays the discovery cost.

## O4 — Split `MobileExpenseForm.tsx` on next touch (carried v1-O2)

Now 2,984 LOC (+94 since v1 — the trend is wrong). Same extraction order: `AmountStep` (calculator + chips) → category/subcategory grids → `useExpenseSubmit` hook. Same for `recurring/page.tsx` (2,772). Unchanged rule: no gratuitous refactor; ride the next feature.

## O5 — Statement-parser fixture corpus (carried v1-O1.3)

3–4 anonymized statements as fixtures, snapshot the parse. Unchanged, still cheap, still not done.

## O6 — Persisted-cache versioning rule (new, from the June incident)

Write the rule into `Common Patterns.md` and enforce by convention: **any change to the shape or visibility semantics of a `STABLE_KEYS` query result requires a persist-buster bump in `providers.tsx`** (`hm-v3 → hm-v4`, …) in the same commit. Add a one-line checklist item to the cache-invalidation skill. Without this, the next `is_public`-style change reproduces a bug that took three fixes to kill.

## O7 — Console sweep, finance first (carried v1-O5)

Unchanged: route real failures to Error Logs, delete the rest, then the `no-console` ESLint rule. Now backed by the [audit's P0](<../../Codebase Audit 2026-07-01/07 - Remediation Checklist.md>).

## O8 — Review v3 → v2 merge-back decision (new)

Review v3 shipped as an experimental parallel dashboard (campaign file 1, 2026-06-26). Two dashboards rendering the same money with shared-but-forked tab components is a divergence engine — exactly the pattern O1 exists to prevent. Set a 2-week validation window, then either merge v3 into v2 or delete v2. Don't let "experimental" become "permanent dual surface."

---

### Sequencing

```
O3 (15 min, overdue)  →  O1 (the contract test)  →  O2 route contracts
   ↘ alongside any feature touch: O4 (form split) · O5 (fixtures) · O7 (console)
O6 = one paragraph in Common Patterns now · O8 = calendar a decision date
```

Kill criteria: if a route-test harness doesn't exist app-wide yet, don't build a bespoke one here — O1's pure-function contract test carries 80% of the value at 20% of the setup.
