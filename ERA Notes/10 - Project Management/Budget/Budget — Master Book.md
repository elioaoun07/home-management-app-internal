---
created: 2026-05-30
updated: 2026-08-19
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
| Statement Import | 🔵 | Reconcile model: parse → match against already-logged transactions (posting-lag window, one-to-one, ambiguity surfaced) → review only the remainder on a full-screen page with resumable IndexedDB sessions; balance-neutral stamping, idempotent commit, merchant learning. Every commit is a **revertible batch** (per-row ledger + one-tap rollback of rows, balances and merchant mappings). Matcher + session model + commit money math + revert planner all unit-tested | establish the log-at-tap habit; then bank-SMS auto-drafts (Native App campaign) |
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
- 🟡 Statement import depends on a habit that isn't established yet — the reconcile model pays off only if card taps get logged near purchase time (Hub/voice/expense form). Until that habit sticks, most rows still land in "needs review" and get categorized from memory. The next lever is a zero-effort capture channel (bank SMS → draft via the Capacitor shell), not more import UI. *(Everything else in the 2026-08-18 audit — first-word grouping, no ungroup, group-overwrites-row, no per-row category, zero session persistence, no date editing, currency blindness — shipped fixed as BUD-18…22 on 2026-08-19.)*
- 🟡 Statement parsing is still single-format and text-only — one Lebanese 5-column layout, `DD/MM/YYYY` only, scanned PDFs rejected. Format drift would degrade silently (rows simply not found); there is no coverage check that the parsed rows reconcile to the statement's own totals.
- 🟠 Recycle Bin **restore** does not re-apply balances for transfers — the transactions half was fixed with BUD-23, but `transfers` (and any other balance-moving module in the bin registry) still restore without touching `account_balances`, so restoring a deleted transfer silently leaves both accounts wrong. Same root shape as the transactions bug: delete reverses, restore forgets.
- 🟡 Import rollback cannot undo a *category* the import wrote onto a pre-existing row — `stamp` only ever writes `statement_hash` so there is nothing to restore, but `confirm_draft` restores category from the ledger while an ordinary post-import edit by the user is deliberately preserved. The asymmetry is correct but undocumented anywhere the user can see it.
- 🟡 Transfer rows are detected and skipped, never imported as transfers (owner-deferred, PM inbox 2026-07-31). ~~The detection is a `transfer from|to` regex, so bank-specific phrasings like "Own Account Exchange" fall through to the review bucket instead of being recognized.~~ **Detection fixed 2026-08-24 (BUD-30)** — and the old note *understated* the damage: an unrecognized own-account leg did not merely "fall through to the review bucket", it was categorized and **created as a real transaction**, so every internal FX move minted phantom income on one leg and phantom spend on the other. Importing transfers *as* transfers remains deferred.
- 🔴 **Phantom FX transactions from pre-BUD-30 imports are still in the ledger.** Every own-account exchange imported before 2026-08-24 exists as a real income/expense pair. Balances are unaffected (the legs cancel) but analytics, category totals and any period summary are inflated on both sides. Evidence: `isTransferDescription` matched only `/transfer\s+(from|to)/` before that date, and the owner's statements use `"Own Account Exchange: …"`. Cleanup is owner-run and not yet done — re-importing an affected statement now flags the rows as "imported before", which is how to find them; the safe removal path is **batch Revert** in Import History, never a plain delete (see the next item).
- 🟠 **A plain transaction delete does not free the statement fingerprint.** `DELETE /api/transactions/[id]` sets `deleted_at` only, and `transactions_statement_hash_uniq` is partial on `statement_hash IS NOT NULL`, so a deleted imported row still occupies its hash. Re-importing that statement then returns `skipped_duplicate` and the transactions **never come back** — and reconcile filters `deleted_at IS NULL`, so it does not even warn: the row shows as unmatched, the owner categorizes it, and Commit reports 0 created. Batch Revert (which nulls the hash) is currently the only correct undo, and nothing in the UI says so. *(Silent-failure class: wrong-but-plausible success report.)*

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
- ✅ 2026-08-01 — **BUD-14** [TEST] Mobile expense form quick-amount chip: replace the $25 preset with $20 → `src/components/expense/MobileExpenseForm.tsx:1144`
- ✅ 2026-08-04 — **BUD-15** Multi-currency accounts + frozen per-transaction exchange rates + cross-currency conversion transfers (built for the Italy trip's EUR cash account). `accounts.currency`/`accounts.exchange_rate` (current rate), `transactions.exchange_rate` stamped by a `SECURITY DEFINER` DB trigger (`stamp_transaction_exchange_rate`, BEFORE INSERT/UPDATE OF account_id) so historical USD dashboard totals stay frozen at the rate in effect when logged, even after the account's rate is later edited. `transfers.to_amount`/`exchange_rate` support asymmetric cross-currency transfers (`getTransferDeltas` in `src/lib/balance-utils.ts` gained an optional `toAmount` param) with a user-overridable destination amount for cash-exchange rounding. Analytics route and `WebDashboard` both convert to USD via the frozen rate (`toUsd()` helper); net worth converts via each account's *current* rate. New `AccountCurrencyDialog` lets an existing account's currency/rate be edited from the account wiggle-mode. Migration `migrations/2026-08-04_multi-currency.sql` pending owner run. Tests: `src/lib/balance-utils.test.ts` (+6 cases, conversion deltas + delete-reversal + toUsd).
- ✅ 2026-08-04 — **BUD-16** Account long-press edit mode now springs into a clearer alternating wiggle, with non-overlapping in-card visibility and labeled currency controls sized for mobile touch.
- ✅ 2026-08-06 — **BUD-17** Expense form (and everything reachable from it for a single account) now renders that *account's own currency* instead of always `$`. New `src/lib/currency.ts` (`getCurrencySymbol`, `getQuickAmounts`) maps each of the 6 `AccountCurrencyDialog` codes to a display symbol and real banknote denominations. First pass only covered the amount input + quick chips; a follow-up pass (same day, after the owner caught the balance card still showing `$`) swept every other single-account-scoped `$` in the expense flow: `AccountBalance.tsx` (balance + outstanding-debt line), `BalanceHistoryDrawer.tsx` (`formatCurrency` threaded a `currency` prop through `DayCard`/`ActivityEntry`/`ArchiveCard`), `FuturePaymentsDrawer.tsx` (+ `PaymentCard`), `TransferDialog.tsx` (from-account leg: amount input, returned/fee, household summary — the self-transfer leg already showed currency codes correctly), `ExpenseTagsBar.tsx`, and `MobileExpenseForm.tsx`/`ExpenseForm.tsx` toast descriptions. Drafts are cross-account (global drawer), so `DraftsDrawer.tsx`/`DraftTransactionsDialog.tsx` resolve *per-draft* currency via a new `accounts!...(name, currency)` select in `/api/drafts`; `OfflinePendingDrawer.tsx` similarly resolves per-op currency from `op.body.account_id` since the offline queue spans accounts too. Deliberately left USD/unconverted: `DebtsDrawer`/`DebtSettlementModal` (debts have no `currency` column — derived from an arbitrary origin transaction, real fix needs a schema change), `SplitBillModal`/`SplitBillHandler` (the payer picks their own account, which can differ in currency from the partner's original leg — no reliable single currency), `NfcWalletTransferPrompt` (NFC Tags module, same from/to ambiguity as TransferDialog, not picked up this pass). Dashboard/analytics untouched — already USD via `toUsd()`. Verified live in-browser after fixing an unrelated tab HTTP-cache trap (hard-reload needed to see the fix): Trip - Italy 2026 (EUR) shows `€` everywhere in the flow including Balance History; Wallet (USD) still shows `$`.
- ✅ 2026-08-18 — **BUD-18** Statement import Phase 0 correctness batch (first slice of the reconcile overhaul, plan `~/.claude/plans/the-e-statement-upload-feature-stateless-karp.md`): **(1) money bug** — credits (refunds/reversals, encoded negative by the dialog) were `Math.abs()`ed into positive expenses AND summed into the deduction total, so a €20 refund *lowered* the balance by 20; route rewritten with Zod validation + per-row signed deltas (`is_debt_return: true` on credits → `getBalanceDelta` adds the money back; worked example −50+20 → net −30 encoded in `src/app/api/statement-import/import/route.test.ts`, 7 tests). **(2)** server-side account-ownership gate (403) + category↔account/subcategory-parent validation with per-row `errors[]` reporting — the silent `continue` that vanished rows is gone; dead `use_count` block removed. **(3)** Settings "+ Add" category 500 fixed — `/api/categories/manage` inserted a phantom `icon` column (`user_categories` has none; only `default_categories` does); stripped from create + bulk_update. **(4)** "new subcategory never appears" fixed — creators now call `refreshCategoryCaches()` (`src/lib/queryInvalidation.ts`): refetch active category queries + drop inactive/persisted entries, because `invalidateQueries` (refetchType "active") never reached unmounted consumers running `refetchOnMount:false` against the localStorage-persisted cache. **(5)** trip activation copies `trip.currency` onto the auto-created account (EUR trip no longer creates a USD-labeled account). **(6)** `LEBANESE_MERCHANTS` no longer injected into parse mappings — they set `matched: true` with a null category, showing a green "Matched" badge invisible to the Needs-Category filter. Drift migration `migrations/2026-08-18_statement-import-phase0-drift.sql` (documents the two live unique indexes; schema.sql paired) — **pending owner run, expected no-op**.
- ✅ 2026-08-19 — **BUD-19** Statement reconcile engine. New pure matcher `src/lib/statement-reconcile.ts` (16 tests): candidate window is logged-date ∈ [posting − 7d, posting + 1d] so the bank's posting lag stops being the user's problem; exact-amount tier → `matched`, within `max($1, 10%)` → `probable` (tips/FX); ranking is tier → date proximity → `normalizeMerchant` token overlap → recency; **one-to-one greedy assignment** so two identical taps never claim the same logged row; direction must agree (a credit only matches a money-back row); genuinely tied candidates return `ambiguous` for the user to pick rather than a silent guess; prior-import rows are recognized by exact hash *and* by a probable-duplicate tier (amount + window against any hash-bearing row) which is what makes the hash-formula change safe without a backfill. `POST /api/statement-import/reconcile` (5 tests) does ownership-gated candidate fetch in one query over the union window. Parse route now requires `account_id` (chosen before upload), returns `statement_id` (sha256 of the file text) + strict currency detection, adds `normalized_key` per row, and drops its private duplicate matcher for the shared `matchMerchantMapping`. Migration `migrations/2026-08-18_statement-reconcile-index.sql` (`idx_transactions_account_date`, partial on `deleted_at IS NULL`) — **pending owner run**.
- ✅ 2026-08-19 — **BUD-20** Statement commit endpoint + hash v2. `POST /api/statement-import/commit` replaces the old import route with three explicit actions and per-row results (no more silent `continue` swallowing rows): `create` (batch insert, per-row retry to isolate duplicates), `stamp` (**balance-neutral** — tags an already-logged transaction with the fingerprint and keeps the user's own date, since the posting date is noise), `confirm_draft` (draft → real, balance applied once). Credits are stored positive with `is_debt_return`, so a refund raises the balance. Every write is guarded (`statement_hash IS NULL`, `is_draft = true`, hash uniqueness) so **re-committing is a no-op** — proven in `commit/route.test.ts` (10 tests) alongside the worked example: $1,000 → create 45.50, stamp 80.00, credit 20.00, confirm draft 12.75 → net −38.25 → **$961.75**, and a retry moves nothing. Hash v2 = `sha256("v2|account|date|desc|out|in")` + `#n` for identical rows in one file: `balance` dropped (re-issued statements used to re-import wholesale), `account_id` added. Merchant mappings are learned only from rows that actually landed, stored under the normalized merchant with a friendly display name.
- ✅ 2026-08-19 — **BUD-21** `/statement-import` full-screen page replaces the Settings-nested dialog (1,659 lines deleted along with the old import route, `useImportTransactions`, and the split-transaction hack). Three buckets (Matched / Needs review / Skipped) mirror the reconciler. Grouping is by **full normalized merchant** — "le gray" and "le mall" are finally separate — and a group category is a *default for rows that have none*, inverting the old behavior where one group choice overwrote every member; any row can be detached (✂) into its own group. Per row: category/subcategory with **inline creation** (`refetchQueries`, the only thing that beats the persisted 1 h cache — this is the "I created a subcategory and had to start over" bug, dead), date edit, group-level −1/−2/−3d shift for posting lag, skip/restore. Review state persists to IndexedDB after every change (`src/lib/statementImportSession.ts`) with a Resume banner and Undo-able discard, so navigating away no longer destroys the work. Pure decision logic lives in `src/features/statement-import/sessionModel.ts` (17 tests) — buckets, category resolution, and decision → commit-action mapping, deliberately conservative (a row writes nothing until its intent is unambiguous). Registered in `STANDALONE_APPS` + `MobileNav.standaloneRoutes` (own sticky commit bar). Verified in-browser against the owner's real 71-row Italy EUR statement.
- ✅ 2026-08-19 — **BUD-22** Statement import cleanup + docs. Deleted dead `src/lib/statement-parser.ts` (never imported) and the 111-line `LEBANESE_MERCHANTS` table whose `suggestedCategory` fields were never read. Fixed a false currency warning found during in-browser verification: the sniff returned the first currency code found anywhere in the header, so the Italy EUR statement was reported as USD ("Fresh USD" is this bank's product name) and advised importing elsewhere — detection now requires an explicit `Currency: XXX` label, and the hint is transient rather than persisted so a stale wrong value can't survive in a saved session. Vault guide rewritten to the audit model (the old one described a dialog that no longer exists, a per-row control the old UI never had, and ~30 merchants that were never in the code); Feature Map rewritten (its `src/app/api/statement-import/route.ts` pointer never existed); Atlas page + feature entries filled in; `App Routes and Icons` row added.
- ✅ 2026-08-19 — **BUD-23** Statement import rollback + account-scoped dedupe. **(1) Silent data-loss blocker** — `buildCommitActions` took the create account from the row's *merchant mapping* (`decision?.account_id || row.account_id`) and `continue`d when it was null. On a first import nothing has been learned yet, so EVERY create action was dropped and Commit reported "0 created" with no error at any layer; it also meant a mapping could route a row to account B under a fingerprint hashed for account A. Creates now always land in the session account (`sessionModel.ts`), the parser stamps that same account onto each row, and the parse route no longer lets a mapping learned on another account supply a category (`user_categories.account_id` is NOT NULL, so it would fail per-row at commit). Two regression tests in `sessionModel.test.ts`. **(2) Rollback** — a commit is now a durable, reversible batch: the route opens a `statement_imports` record and writes one `statement_import_entries` row per transaction (both the state it found and the state it wrote, plus the signed delta) *before* any balance moves, returning **503 having changed nothing** if either write fails. `POST /api/statement-import/imports/[id]/revert` replays it backwards — created rows soft-deleted to the Recycle Bin with `statement_hash` freed so the file stays re-importable, stamps un-stamped, confirmed drafts re-drafted with their original category/amount, merchant mappings restored to their pre-import value (or deleted if the import invented them), one balance write per account. Rules are pure and tested in `src/lib/statement-revert.ts` (19 tests) with the inverse worked example: $961.75 → **$1,000.00**, and a second pass moves nothing. Two invariants decide every edge case — deltas come from **live** row state (an amount edited after the import still nets to zero) and a newer human edit is never overwritten (except on rows the import itself created, which go anyway and are counted in the receipt). Rows another import has claimed, or purged from the bin, are reported → `partially_reverted`. **(3)** History UI on the `/statement-import` upload screen (`ImportHistory.tsx`): expandable per-row ledger with a live "edited since" badge and a confirm step that states exactly what will happen. **(4)** Fixed a pre-existing app-wide bug found while tracing this: Recycle Bin **restore never re-applied a transaction's balance** (delete reverses it, restore didn't), so every restore left the account permanently short — `api/recycle-bin/restore/route.ts` now re-applies the delta for non-draft transactions. Migration `migrations/2026-08-19_statement-import-rollback.sql` (extends `statement_imports`, new `statement_import_entries` with denormalized `user_id` RLS per Hard Rule 20, and the **missing UPDATE policy on `statement_imports`** — it had SELECT+INSERT only, so marking an import reverted would have silently affected 0 rows) — **pending owner run**. Tests: 1,659 pass, typecheck + lint clean.
- ✅ 2026-08-21 — **BUD-29** Mobile expense form: fixed a false-positive long-press in `useLongPress` (`MobileExpenseForm.tsx:191`) that flipped Account/Category/Subcategory into drag-reorder edit mode mid-swipe. Root cause was two gaps in the hook — no `onTouchCancel` handler, so a swipe-back gesture handed off to the browser/OS (which fires `touchcancel`, not `touchend`) left the 500ms timer running and it fired anyway; and no `onTouchMove` movement check, so even an uncancelled swipe taking ≥500ms still triggered edit mode mid-gesture. Added `onTouchCancel: clear` and an `onTouchMove` handler that cancels the pending timer once the touch has moved >10px from its start point. Also moved `MerchantNoteInput` (merchant/note free-text field) from directly under the step header to directly below the tile grid/reorder list, on both the Category and Subcategory steps (all three render branches, including the "no subcategories yet" branch where it now sits below the "Add subcategory" button).
- ✅ 2026-08-19 — **BUD-25** `/statement-import` rebuilt for the phone — the screen it is actually used on. The review list stacked a group category picker, a date-shift row, and every statement row expanded inline with its own date input, two ~28px icon buttons and **two side-by-side `Select` dropdowns**; at 400px those triggers show truncated text and one merchant costs a scroll plus three taps through a native listbox. Now the list is a flat list of **merchants** — one tap target each, two lines: merchant + amount, then either a colored category chip or a bright “Choose category” pill, so unfinished work is scannable without reading. Tapping one opens `GroupSheet` (vaul drawer, phone-width even on desktop), whose primary control is the **same 3-across category tile grid the expense form uses** (`CategoryPicker` rewritten from selects to tiles, inline creation kept incl. the `refetchQueries`-beats-persisted-cache trick): tap a category → subcategory step if it has any, otherwise the sheet closes itself. **Two taps per merchant** is the whole loop. Everything rare — a different category for one row, a date fix, skip, the −1/−2/−3d posting-lag shift — moved behind a collapsed “N rows” disclosure inside that sheet; the ✂ detach control was dropped as redundant with the per-row category (the model still honors `detached_from_group`). Filters became a full-width segmented control over a progress bar (`34/71 done`), the commit bar a single primary `Save N · M left` with Discard demoted to an icon, the receipt three big numbers, and past imports collapsed behind a toggle instead of burying the upload button. **Two bugs found while verifying in-browser:** (1) both sticky bars painted `background-color: var(--theme-bg)` — that variable is **never set on this page** (`getComputedStyle` → empty), so the header and the commit bar were transparent and the cards scrolled straight through them; both now use `tc.bgPage`, which is what Hard Rule 15 prescribes. (2) A row the matcher only *probably* matched could be re-categorized as a new transaction — i.e. **double-writing money already logged** — and, once you answered “not a match”, the old single-row branch kept showing the match card forever with no way to categorize it. Those rows are now hoisted into their own “Might already be logged” section above the merchant list, and answering “not a match” drops the row into the merchant groups. Also fixed: the sheet showed nothing selected while the list card read “Travel” (a learned merchant mapping resolves through `resolveRowCategory`, not `group_categories`) — the grid now reflects the effective category, or nothing when rows disagree. No change to `sessionModel.ts`, the hooks, or any API route — presentation only; 19 session-model tests, typecheck and lint clean. Verified in-browser against the owner’s real 71-row Italy EUR statement.

- ✅ 2026-08-24 — **BUD-30** Statement import: own-account FX rows stopped being written as money, renames decoupled from the dedupe key, and the review screen split by trust level. **(1) Money bug (the reason for the batch).** `isTransferDescription()` only recognised `/transfer\s+(from|to)/`, so the owner's bank's own-account FX legs — `"Own Account Exchange: USD to EUR at 0.852 - from 501400630004"` — fell through as ordinary debits/credits and were **created as real income and expense**. The two legs cancel on the balance, which is exactly why it stayed invisible: the account total was right while analytics accrued phantom income and phantom spend on every internal transfer (money-rules Invariant 4). Replaced with a named `OWN_ACCOUNT_PATTERNS` list (own account / account exchange / internal transfer / between own accounts), deliberately conservative and anchored to an explicit "account"/"transfer" word — a false positive silently drops a *real* expense, the worse failure, so bare `/exchange/` is rejected and pinned by a test using "Currency Exchange Hamra" and "The Exchange Bookshop". `getTransactionType()` in `bank-statement-parser.ts` mirrors the rule (and the 2-amount fallback now reads `- from 5014…` as money **in**, where it previously defaulted every own-account leg to money out). Worked example — the owner's 07/08 statement page, 4 FX rows (150.00 in, 150.00 out, 0.85 in, 0.85 out): **before** = 4 transactions created, balance delta 0, analytics +150.85 phantom income and −150.85 phantom spend; **after** = 0 transactions, 0 delta, 0 phantom. **(2) Exact-hash now beats the transfer rule** in reconcile pass 1, so FX rows written by the pre-fix importer report "imported before" instead of hiding in Skipped — the only signal that points at the phantom rows already in the ledger. **(3) Rename with a preserved key.** New `RowDecision.description`; `buildCommitActions` stores it while `statement_hash` stays the parse-time fingerprint of the **raw** bank text, so "PrePaid" → "ALFA Prepaid Phone" is safe and re-importing the same statement still dedupes. Blank/whitespace falls back to the bank text. Renames are per-row and manual by design — deliberately *not* learned into `merchant_mappings`. Editable in `GroupSheet`'s per-row controls (bank text stays on screen above the input) and in the new stepper. **(4) `already_imported` split out of `matched`.** New `imported` bucket: "Imported" (fingerprint hit — machine-certain, unactionable, rendered as a compact date-grouped receipt) is now a separate tab from "Logged" (the matcher's judgement that a bank row is one of your manual entries — needs an eye). One tab used to hold both, burying a handful of guesses inside a pile of certainties. `MatchedRowCard` now leads with a labelled **Bank** vs **You** wording comparison instead of a trailing `you logged "…"` clause. **(5) `ReviewStepper.tsx`** — opt-in one-row-at-a-time drawer over `undecidedRows()`, offered from the Review tab past 2 outstanding rows: progress bar, rename input, category grid that auto-advances, Skip, Back/Next. The queue is **snapshot on open**, because answering a row removes it from the live undecided list and would renumber the steps under the owner's thumb. A carousel over the *whole* statement was considered and rejected — one interaction per row even for rows needing nothing, no overview, and it fights the page's own scroll. 1,747 tests pass (7 new), typecheck + lint clean. **No DB change, no migration.**

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-07-30 — **BUD-11** delivery session `s-20260715-214421-hvfk` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-203135-cv12` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-205308-8sgn` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-221533-wous` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-11** delivery session `s-20260722-225601-whdv` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260729-121840-pdhx` ended **cancelled** at CANCELLED. 0 file(s) changed.
- 2026-07-30 — **BUD-14** delivery session `s-20260730-104900-9mfu` ended **cancelled** at CANCELLED. 0 file(s) changed. · finish package: `.delivery/sessions/s-20260730-104900-9mfu/artifacts/finish/summary.md`
- 2026-08-01 — **BUD-14** delivery session `s-20260801-094951-jx8o` ended **paused — needs a decision** at NEEDS_DECISION. 1 file(s) changed · ACs 0/3 satisfied. · finish package: `.delivery/sessions/s-20260801-094951-jx8o/artifacts/finish/summary.md`

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
| Account edit-mode polish | edge-pinned visibility/currency badges overlapped between rows | in-flow mobile action rail + clearer spring/wiggle motion *(IMPLEMENTED 2026-08-04)* | S |
| Post-trip statement reconciliation | one upload path that always **inserts**; the matcher is single-account, single-currency, −7/+1 days | two intents on one feature: Lebanon statements insert (recognizable merchants, low volume), trip statements **audit** a manual log that was captured tap-by-tap abroad — reconcile-only mode + FX/trip-aware matching + a two-sided exception report (BUD-26/27/28, entry point TRIP-28) | M–L |

**Decision 2026-08-19 — where transactions come from, per geography.** Inside Lebanon the e-statement upload stays the *source* of transactions: merchants are recognizable, card volume is low, and typing them twice is waste. Abroad the order inverts — foreign statement descriptors are unreadable weeks after the fact, so each tap is logged manually at the moment of spend and the statement, uploaded after returning, is only the *auditor*. This is a workflow decision, not a feature request: it means statement import needs a second **mode**, not a second importer, and that the matcher must survive FX conversion and a longer posting lag (BUD-26/27/28). Trip-side entry point: Trips TRIP-28.

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

### BUD-26
- **Acceptance:** an audit-mode statement run produces a per-row verdict and, on completion, `statement_import_entries` gained **zero** rows, no `balance_deltas` were written and no merchant mapping was learned — provable by comparing account balances before/after; the mode is visible on the review screen at all times.

### BUD-27
- **Acceptance:** a foreign-currency trip statement matches the manually logged trip transactions without widening `AMOUNT_TOLERANCE_PCT` — matching succeeds through an implied-rate cluster, spans both the card account and `trips.account_id`, and a unit test in `src/lib/statement-reconcile.test.ts` covers a worked EUR-logged / USD-posted example plus a rate-outlier that must be flagged, not silently matched.

### BUD-28
- **Acceptance:** the report opens with total statement vs total logged and one gap number, then lists exceptions in both directions (statement row with no log, logged transaction with no statement row); confirming or rejecting a `probable`/`ambiguous` pair resolves it and still writes no transaction.

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
