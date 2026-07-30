---
created: 2026-05-30
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3 (originals in ../_Archive/Budget/)"
tags:
  - pm/master-book
  - scope/module
  - module/budget
---

# Budget — Master Book

> **Campaign:** Budget · prefix `BUD` · working queue → [4 · Checklist](<4 - Checklist.md>)
> **What this file is:** the single consolidated record for the Budget (finance) cluster — state, shipped history, pains, vision, acceptance criteria, and the successor briefing. The only other file in this folder is the checklist.

## Identity & North Star

"Budget" is the user-facing name for the **finance cluster** — architecturally independent standalone modules (accounts, transactions, categories, recurring, transfers, allocation, statement import, analytics, debts, future purchases, drafts) that together form the money side of the app.

Budget is the household's **money graph**. Today it is a strong *reactive* ledger: you record money in and out, it shows balances and analytics. Its untapped value is twofold — it is the second spine ERA should read from (the first being Schedule's time graph), and money and time are the same fact recorded twice (a recurring payment's due-date, a debt's collection date, a future purchase's target date are all Schedule facts).

**Vision in one line:** *turn Budget from a ledger you review into a money graph that forecasts — telling you what's affordable, what's due, and what's drifting, before you ask.*

**Source:** `src/features/{accounts,transactions,categories,recurring,balance,budget,transfers,statement-import,analytics,debts,future-purchases,drafts}/`, `src/app/expense/`, `src/app/recurring/`. Schema: `migrations/schema.sql` (Finance domain). Balance direction: `src/lib/balance-utils.ts`. Canonical spend: `src/lib/utils/incomeExpense.ts`.

## Current State (verified)

**Maturity 5.8 / 10 as of 2026-07-18 (FABLED 3, evidence cutoff `f0a8e19`), +0.4 vs 2026-07-02.**

| Dimension | Score | Evidence |
|---|---|---|
| Data correctness | 8 | canonical `sumSpending` single-sourced; drawer-balance repair executed as a proper runbook migration |
| Test protection | 6 (+2) | 39 tests green across 6 money files: `commitments`, `balance-utils`, `balance`, `recurring`, `incomeExpense`, + 2 recurring route tests |
| Cross-module bridges | 3 | merchant mappings API shipped but import-scoped; recurring/debts still don't touch Schedule |
| Code health | 5 | debug routes finally deleted, but `recurring/page.tsx` is a 3,083-LOC blob and `MobileExpenseForm` grew to 3,099 |
| AI leverage | 7 | AI allocations + AnalysisReport engine; merchant learning adds a small real loop |
| Handoff readiness | 5 | `money-rules` + real tests make scoped money work mid-tier-safe; balance-semantics changes stay human-gated |

**Sub-feature reality** (tier: 🟢 Core = daily, battle-tested · 🔵 Established = built and stable · 🟡 New/Thin · 🟠 Stub/Partial):

| Sub-feature | Tier | Reality | Next step |
|---|---|---|---|
| Accounts & Balance | 🟢 | multi-account, dynamic balance, balance history, default account, reconcile; account types drive balance direction; calculation layer unit-tested | broaden route contract tests (O1) |
| Transactions | 🟢 | full CRUD, drafts, private, split-bill, category grid, voice entry; `MobileExpenseForm` **3,099 LOC** change-risk hotspot | split when next touched, never "just because" |
| Categories | 🟢 | hierarchical, icons/colors, DnD reorder, cross-user slug matching (module Hard Rule) | — stable |
| Recurring Payments | 🟢 | schedule, auto next-due, confirm→transaction, exceptions; **commitments engine** (`commitments.ts`, 343 lines, pure, tested) classifies each payment into covered/matched/due_this_period/missed/upcoming/monitor and reconciles against real transactions; `recurring/page.tsx` **3,083 LOC** | split the page (O2); document matching constants (O3) |
| Budget Allocation | 🔵 | envelope allocations per category with an inline AI proposal layer (manual always wins), outlier-cleaned history, deterministic statistical fallback, per-row Apply + Apply-All | connect Wallet funding ↔ account balances ↔ envelopes into one flow |
| Transfers | 🔵 | between-account transfers with correct balance direction; template slugs (`salary-deposit`, `refill-wallet`, `savings`, `transfer`) + in-modal 3-chip toggle | — stable |
| Statement Import | 🔵 | CSV/PDF parse, merchant→category mapping, persisted merchant learning from import confirmations | close the loop into manual entry (O4) |
| Analytics | 🔵 | net worth, mini-charts, world spend map, Dashboard V2 + experimental Review v3 (Insight tab), two-signal median/MAD outlier engine with log-space spike scoring, cadence detection and recurring-merchant suppression | validate Review v3 then merge into v2 |
| Debts | 🔵 | owed-to / owed-by, settlement, standalone debts | auto-reminder on collection date (BUD-8) |
| Future Purchases | 🔵 | wishlist, target amount/date, allocation, spending analysis | link actual purchase → auto-complete (BUD-7) |
| Drafts | 🔵 | drafts drawer/badge/dialog for pending (voice) transactions | — stable |

**Authoritative code maps** live in the vault docs, not here: [Accounts & Balance](<../../02 - Standalone Modules/Accounts & Balance/Overview.md>) · [Transactions](<../../02 - Standalone Modules/Transactions/Overview.md>) · [Categories](<../../02 - Standalone Modules/Categories/Overview.md>) · [Recurring Payments](<../../02 - Standalone Modules/Recurring Payments/Overview.md>) · [Budget Allocation](<../../02 - Standalone Modules/Budget Allocation/>) · [Transfers](<../../02 - Standalone Modules/Transfers/>) · [Statement Import](<../../02 - Standalone Modules/Statement Import/>) · [Analytics](<../../02 - Standalone Modules/Analytics/>) · [Debts](<../../02 - Standalone Modules/Debts/>) · [Future Purchases](<../../02 - Standalone Modules/Future Purchases/>) · [Drafts](<../../02 - Standalone Modules/Drafts/>).

## Pain Inventory

- 🟠 Two 3,000-line blobs are the change-risk ceiling — `MobileExpenseForm.tsx` (3,099) and `src/app/recurring/page.tsx` (3,083). Both mix data orchestration with presentation; both are where the next regression hides. The commitments engine's clean extraction proves the cure works.
- 🟠 Commitments matching is heuristic and silent — `matched` depends on amount/account/date-window rules in `commitments.ts`; a false match shows a commitment as handled when it isn't (*wrong-but-plausible display*). The ladder is tested but the window/tolerance constants have no worked-example table.
- 🟠 Transactions and accounts routes have **zero** contract tests, and they carry the household-linking logic (Hard Rule 13) that changed most in June. Recurring proved the pattern.
- 🟡 Merchant mappings stop at import — the API exists and manual entry now glows a matched card, but voice drafts and Hub "Add as Transaction" still don't consult it; the learning loop is half-closed.
- 🟡 Bridges out of Budget are one-directional — recurring due-dates, debt collection dates and future-purchase completions are facts that also belong in Schedule.
- 🟡 `console.*` hotspots remain in finance routes (Hard Rule 22) — recurring `[id]` route carries 7.

## Shipped Log

- ✅ 2026-06-10 — `balance-utils` unit-tested (balance direction)
- ✅ 2026-06-10 — recurring next-due math unit-tested
- ✅ 2026-06-16 — Reconciliation checkpoint: "last checked" date (reuses `balance_set_at`) glows red past 7 days; one-tap "Balance matches" / "Doesn't match — correct it" in `BalanceHistoryDrawer`, with Undo
- ✅ 2026-06-25 — Transfers: `/expense?transfer=salary-wallet` opens a small transfer amount prompt
- ✅ 2026-06-25 — Dashboard V2 Monthly Savings reads the flat `Our Savings` balance and adds `Expected Savings` (Income − Expense) with metric toggles
- ✅ 2026-06-26 — AI proposal layer for allocations woven inline on the Allocate surface (manual always wins): outlier-cleaned history via `anomalyDetection.ts`, deterministic statistical fallback, per-row Apply + Apply-All, separate read-only Review surface
- ✅ 2026-06-26 — Review v3 experimental dashboard view (Insight tab: category-stacked monthly spend, runtime outlier toggle, budget reference line, Income/Expense/Expected-Savings pie)
- ✅ 2026-06-26 — Outlier detection upgraded to a two-signal median/MAD model (in-category spikes + rare-but-large transactions) with a reviewable list grouped by month
- ✅ 2026-06-26 — Bimodal categories handled via largest-gap splitting + a recurring-merchant signal (same description ≥4×/≥3 months never flags)
- ✅ 2026-06-26 — Multi-tier/rhythmic overhaul: log-space spike scoring, `normalizeMerchant` collapses bank ref-code noise, date-based cadence detection, `recurring_payments` fed in as authoritative suppression
- ✅ 2026-06-26 — Per-envelope rare-category floor: materiality is now a fraction of the median everyday transaction (`max($50, median×0.6)`) so a new envelope is judged on its own and graduates once it builds a baseline
- ✅ 2026-06-26 — Insight tab made interactive (`InsightFocusPanel`, removable chips, tap-to-drill) with two-step zoom (month → category → out)
- ✅ 2026-06-26 — Dashboard FilterBar UX: date presets and category filter moved out of the panel into always-visible chip rows; panel reduced to group toggle + custom range + journal filters
- ✅ 2026-06-26 — Insight pie follows the global date filter; global filters persist across tab switches (removed the `setTwelveMonthRange` force-reset)
- ✅ 2026-06-27 — Transfers: single-URL template slugs replace the `from`+`to` param pair; in-modal 3-chip template toggle pre-fills accounts and description (legacy slugs still work)
- ✅ 2026-06-27 — `NfcWalletTransferPrompt` partner account picker fixed — uses `useAccounts()` so the partner sees the owner's public accounts
- ✅ 2026-06-27 — Budget AI structured spending analysis (`AnalysisReport`: KPIs, insights, anomalies, recommendations) renders as a chat answer **and** a dashboard; duplicate model category labels merged before render; `analysis_report` persisted on `ai_messages` so historical answers reopen without another AI call → [Spending Analysis Report](<../../03 - Junction Modules/AI Assistant/Spending Analysis Report.md>)
- ✅ 2026-07-03 — balance computation/adjustment unit-tested (`src/lib/balance.test.ts`)
- ✅ 2026-07-03 — canonical income/expense/spending totals unit-tested (`src/lib/utils/incomeExpense.test.ts`)
- ✅ 2026-07-03 — recurring confirm→transaction posting unit-tested (`src/app/api/recurring-payments/[id]/route.test.ts`): owner confirm, partner confirm, private-payment blocking, transaction payload, balance adjustment, date updates
- ✅ 2026-07-03 — recurring commitments console + manual transaction reconciliation
- ✅ 2026-07-04 — drawer-balance bug fixed via a proper data-repair runbook (`migrations/2026-07-04_repair-drawer-account-balance.sql`)
- ✅ 2026-07-11 — merchant map feeds manual entry: typing a merchant on the Category/Subcategory steps makes the mapped card glow; works cross-user and cross-account, silent skip when absent
- ✅ 2026-07-11 — merchant-mappings API (`0a39c4e`) persists merchant→category mappings learned from import confirmations
- ✅ 2026-07-11 — `analytics/debug` route removed from the prod surface
- ✅ 2026-07-18 — **BUD-12** deleted the remaining debug/diagnostic routes (`env-check`, `supabase-check` — the latter an unauthenticated `listUsers` probe); zero callers verified, typecheck green
- ✅ 2026-07-21 — **BUD-13** household transfers authorize a visible private partner account only as the destination of an explicit household transfer; ordinary partner writes stay public-only (`src/lib/accountAccess.test.ts`)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-07-30 — **BUD-11** delivery session `s-20260715-214421-hvfk` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-203135-cv12` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-205308-8sgn` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-221533-wous` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-225601-whdv` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260729-121840-pdhx` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260730-104900-9mfu` ended **cancelled** at CANCELLED. 0 file(s) changed. · finish package: `.delivery/sessions/s-20260730-104900-9mfu/artifacts/finish/summary.md`

## Vision & Decisions

### Track A — internal enhancements

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Test the financial core | calculation layer unit-tested *(IMPLEMENTED 2026-07-03)* | broader route/contract coverage for API error mapping (O1) | M |
| Cashflow forecast | analytics is historical | project balances forward from recurring + allocations: "you'll dip below X on the 24th" | L |
| 50/30/20 + Dashboard V2 widgets | Monthly Savings + Expected Savings shipped *(IMPLEMENTED 2026-06-25/26)* | guided budgeting templates, richer KPIs, month-by-month savings transfer attribution | M |
| Merchant-map → entry | card-glow on manual entry, cross-user/account *(IMPLEMENTED 2026-07-11)* | extend to Voice Draft Transactions (BUD-1) and Hub "Add as Transaction" (BUD-2) | S–M |
| Allocation workflow across accounts | AI-proposed allocation + inline Allocate/Review *(IMPLEMENTED 2026-06-26)*; recurring commitments console *(IMPLEMENTED 2026-07-03)* | account funding, Wallet balance, recurring minimums and envelopes read as one flow | M |
| Split the mega-forms | 3,099 + 3,083 LOC | decompose into testable units when next touched | M |
| Household transfer authorization | — | *(IMPLEMENTED 2026-07-21)* | S |

### Track B — bridges out of Budget

- **Recurring → Schedule (due-dated payments)** — a due-date and a Schedule reminder are the same intent; unify so confirming a payment closes the reminder (BUD-3).
- **Debt → Schedule** — auto-create a reminder on a debt's collection date (BUD-8).
- **Future Purchase → Transaction** — linking the actual purchase auto-completes the wishlist item (BUD-7).
- **Budget → ERA briefing** — feed cashflow + overspend signals into the proactive briefing (BUD-4). The structured signals now exist (AnalysisReport); wiring them into the *proactive* briefing is the remaining step.
- **Statement Import → Inventory/Catalogue** — parsed grocery lines could pre-fill inventory or catalogue prices (BUD-10, longer reach).

### The bets, in order

1. **Lock the foundation** — the calculation layer is tested; finish with route contract tests for transactions + accounts (O1). Wrong money is the worst bug.
2. **Unify Recurring ↔ Schedule due-dates** — the highest-leverage bridge; money and time stop being recorded twice. Coordinate from both sides with Schedule.
3. **Cashflow forecast → ERA** — the biggest *felt* upgrade. **Resist building it before the core tests exist** — a silent balance bug would hide exactly there, and a forecast amplifies it.

### Not now (standing decisions)

- Do **not** refactor `MobileExpenseForm` or `recurring/page.tsx` for its own sake — only when next touched for a feature.
- Do **not** widen commitment matching tolerances to make data look better; fix the constants documentation first.
- Do **not** let AI output write directly to transactions — the drafts pattern exists precisely to forbid it.

### Candidate enhancements with kill criteria (FABLED 3 gen)

- **E11 — commitment-aware briefing line** (impact high, effort S): `commitments.ts` is pure, so the ERA briefing can call it server-side and say "2 commitments look missed this period." Read-only. *Kill: park until the Awakening briefing renders somewhere.*
- **E12 — `missed` → draft proposal** (impact high, effort M): when a commitment is missed and a near-match transaction exists just outside tolerance, propose a draft link (human confirms). *Kill: if false-match complaints appear at current tolerances, fix the constants first.*
- **E13 — matching-tolerance self-report** (impact low-med, effort S): count `matched` decisions per month with amount deltas. *Kill: skip if E12 isn't pursued — observability for an unused path is meta-work.*

## Acceptance Criteria Index

### BUD-1
- **Acceptance:** a spoken draft whose text contains a known merchant pre-selects that merchant's Category/Subcategory in the drafts review UI, on top of existing NLP category matching.

### BUD-3
- **Acceptance:** confirming a recurring payment closes the corresponding Schedule reminder, and no duplicate occurrence is generated (see `recurrence-safety`).

### BUD-4
- **Acceptance:** the briefing states a forward-looking balance dip with a date, derived from recurring + allocations, and is backed by a test with a worked before/after example.

## Successor Briefing

**Who should read this:** you are about to change money code. This cluster displays and moves real family money. The rules protecting it are strict, mechanical and mostly enforced by skills and tests — follow them and you are safe at any capability tier; improvise and you will corrupt balances silently.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/accounts src/features/transactions src/features/recurring src/features/balance src/lib/balance-utils.ts
npx vitest run src/features/recurring/commitments.test.ts src/lib/balance-utils.test.ts src/lib/recurring.test.ts src/lib/utils/incomeExpense.test.ts   # expect all green
```

Then read `.claude/skills/money-rules/SKILL.md` (**mandatory**) → `src/lib/utils/incomeExpense.ts` (the canonical spend definition).

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| UI/layout on budget pages, toasts, category pickers | any-model | `ui-guardrails`; Undo on every toast (Hard Rule 1); LBP in thousands |
| New read-only display of existing amounts | any-model | consume `sumSpending`/existing hooks; NEVER re-derive spend math locally |
| CRUD field additions (non-amount, non-balance) | any-model | `add-feature` + `api-route`; household linking per Hard Rule 13 |
| Creating/editing/deleting amounts, transfers, recurring, debts | mid-tier+ | `money-rules` open; worked before/after balance example **written down**; test for changed math — no exceptions |
| Changing balance semantics, account-type direction, `sumSpending` | human-first | propose with the worked example; Elio verifies against real data |
| Commitments matching constants (window/tolerance) | human-first | silent false-match risk |

**Out-of-depth tells — stop if:** you can't write the before/after balance example for your change; you're computing spending anywhere other than `incomeExpense.ts`; you're letting AI output write directly to transactions; you're editing `MobileExpenseForm.tsx` or `recurring/page.tsx` without a scoped plan.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Account types flip balance direction | expense/income/saving sign confusion | `src/lib/balance-utils.ts` + schema CHECK constraints are the law |
| Custom month start ≠ calendar month | totals "wrong" near month boundaries | always `startOfCustomMonth()` from `src/lib/utils/date.ts` |
| Household linking on reads | partner data missing or duplicated | Hard Rule 13; `accounts/route.ts:28-52` is canonical |
| `matched` is a heuristic | commitment shows handled, money not actually paid | constants in `commitments.ts`; never widen tolerances to make data look better |
| `safeFetch` 3 s default | AI/import calls falsely mark the app offline | pass `timeoutMs` on anything >3 s (Hard Rule 6) |
| Recurring is NOT item recurrence | editing the wrong engine | two systems (`recurrence-safety`); `recurring_payments` is money, rrule items are schedule |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| Money tests green | `npx vitest run src/lib/balance-utils.test.ts src/lib/recurring.test.ts src/features/recurring/commitments.test.ts` | all pass |
| Canonical spend single-sourced | `grep -rln "sumSpending" src \| wc -l` | small, stable set — if it grew, someone re-derived |
| Debug routes stay dead | `ls src/app/api/env-check src/app/api/supabase-check 2>/dev/null` | nothing |
| Recurring route tests exist | `ls src/app/api/recurring-payments/[id]/*.test.ts` | 2 files |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault module docs: [`02 - Standalone Modules/`](<../../02 - Standalone Modules/>) (authoritative code maps)
- Pre-consolidation originals (`_index`, files 1–3, FABLED, FABLED 2, FABLED 3): `../_Archive/Budget/`
- Skills: `money-rules` (mandatory for money edits), `recurrence-safety`, `api-route`, `db-migration`
