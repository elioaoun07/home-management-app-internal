---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/budget
---

# Budget · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/2](<../FABLED/2 - FABLED — Gaps & Missing.md>)
>
> Re-ranked against the working tree 2026-07-02. Each carried-over gap names its v1 id so the lineage is auditable.

---

## Delta ledger — what happened to v1's gaps

| v1 | Verdict 2026-07-02 | Evidence |
|---|---|---|
| G1 no tests above unit layer | **Open, sharper** — June added many read-path rules protected by nothing | → G1 below |
| G2 `analytics/debug` shipped | **Open, 5 weeks** — and the debug surface is *wider* than v1 knew | → G2 below |
| G3 merchant map import-only | **Open, untouched** | → G3 |
| G4 money↔time bridges absent | **Open, untouched** | → G4 |
| G5 analytics purely historical | **Half-closed** — outliers + forecast substrate shipped; projection surface still absent | → G5 |
| G6 trip account duplication | **Open** — no June session touched it | → G6 |
| G7 finance `console.*` | **Open** — 594 occurrences in 162 files app-wide (`grep -rE "console\.(log|warn|error)" src | wc -l`) | → G7 |
| G8 allocation ↔ recurring disconnect | **Open, reframed** — the campaign now names the bigger shape (X1 funding flow) | → G8 |
| G9 receipts scope unclear | **Open** — `api/receipts` + `/receipts` route still undocumented | → G9 |
| G10 stale PM claims | **Closed** — and FABLED 2 institutionalizes the delta ledger you're reading |

## 🔴 G1 — June's math is law, but unwritten law (carried v1-G1, sharpened)

The five spend-definition rules, the masking redactions, the outlier suppressions, the idempotent transfer reversal — all now exist **only as code**. No contract test asserts any of them. The specific new risk class: someone adds a spend consumer that queries transactions directly (exactly how all four pre-June surfaces were born) and the penny-reconciliation silently re-forks. Wrong money remains the app's worst bug class, and the cluster's most valuable June output is its least protected.

## 🔴 G2 — The debug surface grew while flagged for deletion (carried v1-G2)

Verified shipped today: `api/analytics/debug`, **plus** `api/debug/supabase`, `api/env-check`, `api/supabase-check`. Four diagnostic routes on the prod surface, at least one exposing environment/infra state. v1 called this "a one-file deletion that shouldn't outlive the week it's noticed" — it has now outlived five weeks and multiplied. This is no longer hygiene; it's a hard-to-defend security posture ([Codebase Audit 01](<../../Codebase Audit 2026-07-01/01 - Security Vulnerabilities.md>)).

## 🟠 G3 — Merchant map still import-only (carried v1-G3)

Unchanged. Still the smallest high-value win in the cluster — and June made it *more* valuable: `normalizeMerchant` now exists, so the lookup can be fuzzy-correct instead of exact-match.

## 🟠 G4 — Money facts still recorded twice (carried v1-G4)

Recurring due-dates, debt collection dates, future-purchase targets — still no Schedule bridges. Note the coordination window: Schedule is mid-way through its occurrence-engine unification ([Schedule FABLED 2.2](<../../Schedule/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)); build the bridges **after** that lands or they'll target a moving engine.

## 🟠 G5 — Forecast surface still absent, but the excuse expired (carried v1-G5, reframed)

v1 scoped this as a big build. Today `budgetForecast.ts` (tested) already does per-category statistical projection and `anomalyDetection.ts` (tested) already cleans history. What's missing is only: a daily projected-balance series folding recurring next-dues onto current balances, and two render surfaces. The gap is now **one pure lib file wide** — see [file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>).

## 🟡 G6 — Trip account creation still bypasses the accounts API (carried v1-G6)

Unchanged; the June RLS/visibility changes to accounts made the duplication *riskier* (two places must now agree on `is_public`/`visible` semantics). Fix lives on whichever side is touched first ([Trips FABLED 2.3 · O4](<../../Trips/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G7 — Console hygiene (carried v1-G7)

594 occurrences / 162 files app-wide; finance API routes remain the densest block. Now P0 in the [2026-07-01 Codebase Audit](<../../Codebase Audit 2026-07-01/00 - Executive Summary.md>) — sweep + mechanical enforcement.

## 🟡 G8 — The funding flow is disconnected end-to-end (carried v1-G8, widened by the campaign)

The campaign's X1: Salary → Wallet funding, account balances, and category envelopes are three surfaces with no connecting flow. June's transfer templates solved the *mechanical* hop; the *semantic* link (this transfer funds these envelopes; envelopes know their floor from recurring commitments) is still absent.

## 🟡 G10 — Persisted-cache staleness is a bug *class*, not an incident (new)

The June partner-accounts bug survived two correct fixes because `hm-rq-cache-v3` + `refetchOnMount: false` kept serving a stale account list across hard refreshes. The fix (manual buster bump) is a footgun: nothing forces the next schema-shaped client change to remember it. Needs a rule — [file 3 · O6](<3 - FABLED 2 — Optimization Plan.md>).

## ⚪ G9 — Receipts module scope (carried v1-G9)

`api/receipts` + `/receipts` page still shipped, still undocumented in Feature Map/Atlas terms. Decide: fold into Statement Import or document as a module.

## ⚪ G11 — Private-total derivability (new, accepted)

The masking model lets a partner derive the private *total* (documented trade-off, 2026-06-27). Recorded here so a future privacy pass revisits it deliberately rather than rediscovering it.
