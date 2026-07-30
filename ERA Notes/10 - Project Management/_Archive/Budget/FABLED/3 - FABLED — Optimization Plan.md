---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/budget
---

# Budget · FABLED 3 — Optimization Plan

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Concrete hardening/perf/code-health moves for code that already works. Not features (file 4), not absences (file 2). Each item says *when* to do it — most are "when next touched," per the cluster's no-gratuitous-refactor rule.

---

## O1 — Test the write paths (do before any money feature)

Extend the green unit baseline upward, cheapest first:

1. **Route contract tests** for `accounts`, `transactions`, `transfers`, `recurring-payments`: feed each route's zod schema valid/invalid payloads; assert 400/409/200 mapping (the `23505→409` rule is exactly the kind of thing that silently regresses). No DB needed for the parse layer.
2. **Confirm→transaction flow** — factor the posting logic out of the route into a pure `src/lib` function (mirroring how next-due already lives in `lib/recurring.ts`) and unit-test it. This also shrinks the route.
3. **Statement-parser fixture corpus** — commit 3–4 anonymized real statements as fixtures; snapshot the parsed output. Catches parser regressions for free forever.

## O2 — Split `MobileExpenseForm.tsx` (when next touched — not before)

2,890 LOC. The natural seams already exist as wizard steps. Extraction order (each is independently shippable):

1. `AmountStep` (incl. calculator + quick-amount chips) — the most self-contained.
2. `CategoryGrid` / `SubcategoryGrid` — already visually distinct units (circular-icon pattern).
3. `ReviewStep` + submission/mutation logic → a `useExpenseSubmit` hook (makes O1's optimistic-update logic testable).

Same prescription for `recurring/page.tsx` (2,772 LOC): pull the auto-post/confirm UI into components, leave the page as composition.

## O3 — Single-RPC the dashboard read path (measure first)

Hard Rule #21: parent + N child reads cost ~170–200 ms *each* in PostgREST overhead. The dashboard/balance surfaces read accounts + balances + recent transactions + recurring as separate queries. **If** profiling shows the floor latency (likely ~600–800 ms), collapse into a `get_budget_bundle()` SECURITY DEFINER RPC modeled on `get_schedule_bundle`. Don't build it on faith — measure with the Network tab first; the per-query caches (`BALANCE=5min`) may already hide it in practice.

## O4 — De-duplicate trip-account creation

Extract the account-creation invariant (insert + defaults + balance seed) into one shared `src/lib` function used by **both** `api/accounts` and the trip-activation path, so G6 can't drift. Small, do alongside any Trips or accounts touch.

## O5 — Console sweep, finance routes first

When the global Hard-Rule-22 sweep happens, start in `src/app/api/` finance routes (the worst offenders): route real failures to the Error Logs module, delete the rest, then the `no-console` ESLint rule locks it.

## O6 — Kill `analytics/debug`

One-file deletion (or wrap in an env/admin guard). Verified still present 2026-06-10. There is no reason this outlives the week it's noticed.

## O7 — Schema-drift awareness for Finance tables

The repo `schema.sql` shows tables only — **no RLS, no functions** (CLAUDE.md caveat, added 2026-06-10). Before any Finance RLS/auth work, re-verify against live Supabase the way Schedule did (`migrations/_verify_schedule_rls.md` pattern). Consider extending that verification file to the Finance domain once, so the next person doesn't re-derive it.

---

### Sequencing rule of thumb

```
O6 (5 min)  →  O1.1 route contracts  →  O1.2 confirm-flow extraction
     ↘ alongside any feature touch: O2 (split forms) · O4 (trip-account dedupe) · O5 (console)
O3 only after measuring · O7 before any RLS work
```
