---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/budget
---

# Budget · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/1](<../FABLED/1 - FABLED — Current Implementation.md>)
>
> Verified against the working tree **2026-07-02**. v1's structural map (11 standalone modules, thin `features/` hooks, brains in `src/lib/`, canonical API pattern from `accounts/route.ts`) still holds exactly — it is not repeated here. This file documents what June **added**, because the June additions are now the most load-bearing code in the cluster.

---

## 1 · The canonical spend definition (the June sprint's crown jewel)

Four surfaces used to disagree about "spent this month" by up to $276. The root causes were **five independent divergences**: calendar vs custom billing month, `is_debt_return` counted as spend, drafts counted as spend, soft-deleted + split-child rows counted, hidden accounts included, and partner-private rows dropped from totals. All five are now closed by **one shared rule**:

- `getSpendingTransactions` / `sumSpending` / `spendAmount` in `src/lib/utils/incomeExpense.ts` — expense accounts only · exclude `is_debt_return` · exclude `is_draft` · exclude soft-deleted + split children · custom billing window `[start, end]` · absolute amounts.
- Consumers aligned: dashboard transaction service, `GET /api/budget-allocations` (now takes a Zod-validated explicit window), `GET /api/analytics`, Insight pie, Monthly bars, Categories tab.
- **Privacy model (decided June 27):** partner-private transactions **count everywhere** but are masked server-side — real category kept, `subcategory`/`description`/`receipt_url` redacted, amount force-blurred in every list (`BlurredAmount forceBlur`), excluded from outlier surfacing. The non-owner's browser never receives private content. Accepted trade-off: the private *total* is derivable.

**Why this is the file's most important section:** every future money surface must consume `sumSpending`, not re-derive spend. Re-derivation is exactly how the $276 class of bug was born. (Guard: [file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>).)

## 2 · The outlier engine (quietly one of the smartest components in the app)

`src/lib/utils/anomalyDetection.ts` (+ green test file) evolved through live false-positive reports into a **two-signal median/MAD model**:

- **In-category spikes scored in log space** — tolerates snack→delivery→big-shop tiers inside one category.
- **Rare-but-large vs overall spending** with a per-envelope novelty floor (`max($50, median×0.6)`) so a novel $260 Health charge isn't buried by a $3,000 trip.
- **Bimodal categories** handled via largest-gap splitting (Groceries: snacks + periodic big shop).
- **Recurring-merchant suppression**: `normalizeMerchant` collapses bank ref-code noise; same description ≥4×/≥3 months never flags; the user-confirmed `recurring_payments` table feeds in as authoritative suppression.
- **Graduation semantics**: a new category starts as outlier, becomes normal once it builds a baseline or a monthly cadence (the gym-subscription behavior).

Consumers today: Insight tab outlier toggle + reviewable list, AI budget suggestions (outlier-cleaned history). This engine is the substrate for [file 4](<4 - FABLED 2 — Future Enhancements.md>) E1 (forecast) and E10 (subscription auditor).

## 3 · The AI layer — two production patterns worth copying app-wide

1. **AI budget allocation** (`api/budget-allocations/ai-suggest` + `src/lib/budget/budgetForecast.ts`): Gemini proposal over outlier-cleaned history, **soft-clamped** to typical spend, with a **deterministic statistical fallback** so a suggestion always renders (tested — `budgetForecast.test.ts`, 9 green). Inline per-row Apply/Apply-All; manual always wins. Meta columns on `ai_budget_suggestions` (`summary`, `generation_method`, `excluded_outlier_count` — migration `2026-06-26_budget_ai_suggestion_meta.sql`).
2. **The `AnalysisReport` engine** (`src/lib/ai/analysisReport.ts`): analysis-intent chat messages call Gemini with `responseMimeType: application/json` + `responseSchema` over **precomputed metrics**, validated by tolerant Zod, with `buildFallbackReport` as the deterministic floor. Rendered as markdown (`ChatMarkdown`) + a one-tap **ephemeral recharts dashboard** (`AnalysisDashboard`) that is a pure visual translation — no storage beyond `ai_messages.analysis_report` (migration `2026-06-27`) for replay without re-generation.

**The recipe both prove:** strict JSON contract → precomputed inputs → tolerant validation → deterministic fallback → ephemeral render. This is the app's template for every future AI surface ([Hub & ERA FABLED 2.4 · E6](<../../Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

## 4 · Account sharing & transfers (June's other structural change)

- **Public/shared accounts**: `is_public` gates only the expense-form account picker; all read/dashboard paths use household visibility (`useHouseholdAccounts`, `/api/accounts?household=true`). Two follow-up root causes were DB/cache-level: an over-restrictive RLS policy (fixed in `2026-06-26_fix-accounts-rls-household-visibility.sql`) and the **persisted React Query cache** serving stale account lists across hard refreshes (fixed by bumping the persist buster `hm-v2 → hm-v3` in `providers.tsx`). Both are pattern-level lessons, not one-offs — see [file 2 · G10](<2 - FABLED 2 — Gaps & Missing.md>).
- **Transfers**: single-URL template slugs (`salary-deposit`, `refill-wallet`, `savings`), in-modal 3-chip template toggle, NFC tap → multi-transfer sessions (modal stays open, logs each transfer, auto-advances salary-deposit → refill-wallet). Partner NFC taps see owner's public accounts via `useAccounts()`; the owner's own shortcut resolves own-only via `useMyAccounts()` — that distinction was fixed twice in June; treat it as a contract.
- **Balance history**: `change_type` now accepts `transfer_deleted`/`transfer_updated`/`statement_import`; transfer rows carry `transfer_id`; DELETE/PATCH are idempotent against soft-deleted transfers (`2026-06-29` migration).

## 5 · Test reality (run 2026-07-02: `pnpm test` → 93 tests, 92 green, 1 known-stale failure outside this cluster)

| Suite | Covers | Status |
|---|---|---|
| `src/lib/balance-utils.test.ts` | Balance direction (expense/income/saving) | ✅ |
| `src/lib/recurring.test.ts` | Next-due math | ✅ |
| `src/lib/utils/date.test.ts` | Custom month start | ✅ |
| `src/lib/utils/splitBill.test.ts` | Split-bill math | ✅ |
| `src/lib/budget/budgetForecast.test.ts` | Statistical allocation forecast (9 cases) | ✅ new since v1 |
| `src/lib/utils/anomalyDetection.test.ts` | Outlier engine | ✅ new since v1 |

Still zero: route contracts, confirm→transaction flow, transfers double-entry at route level, statement fixtures, and — new since June — the canonical spend definition itself.

## 6 · Size & risk map (LOC re-counted 2026-07-02)

| File | LOC | Δ since v1 | Risk |
|---|---|---|---|
| `src/components/expense/MobileExpenseForm.tsx` | 2,984 | +94 | Still the daily driver; still growing; split on next touch. |
| `src/app/recurring/page.tsx` | 2,772 | = | Unchanged; confirm-flow extraction pending. |
| `src/components/web/WebDashboard.tsx` | 2,593 | +167 | Absorbed June dashboard work. |
| Review v3 tab components | — | new | Experimental surface awaiting merge-back into v2 (campaign file 1). |

## 7 · Cross-module touchpoints (unchanged from v1, plus one)

Hub/Message Actions → transactions · ERA voice → drafts · Trips → direct account inserts (still duplicated, [G6](<2 - FABLED 2 — Gaps & Missing.md>)) · Notifications → spending alerts · Household → every read path. **New:** Budget AI chat (`AIChatAssistant`) is now a fourth entry surface for money questions — its context assembly (`fetchBudgetContext`) is the seam proactive briefings will reuse.
