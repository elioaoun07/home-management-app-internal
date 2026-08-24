---
created: 2026-06-20
updated: 2026-08-19
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/budget
---

# Budget · 4 — Checklist

> **Campaign:** [Budget — Master Book](<Budget — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Budget — every open actionable item as one checkbox under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). Completed items are swept into the Master Book's Shipped Log and the line deleted — git history is the rest of the archive.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** X2a→BUD-1, X2b→BUD-2, L1–L8→BUD-3–BUD-10.

---

## Now

- [ ] **BUD-31** Purge the phantom FX transactions written by pre-BUD-30 imports — every own-account exchange imported before 2026-08-24 exists as a real income/expense pair inflating both sides of analytics (balances are fine; the legs cancel). Needs a `data-repair` runbook for the owner to run: inspect + count rows whose `description` matches the own-account patterns and `statement_hash IS NOT NULL`, back up, then remove via **batch Revert** per affected import (a plain delete leaves the hash occupied — see BUD-32). Verification query after. _(blocker - M)_
- [ ] **BUD-34** Give the probable-duplicate tier the same one-to-one guarantee as matching — `reconcileStatementRows` pass 1 uses `candidates.find()`, so two identical rows on one day both resolve to the same already-imported transaction and the second is silently dropped as a duplicate when it is actually new. Bites hardest on pre-2026-08-18 (v1-hash) rows, which always fall through to this tier. Reuse the greedy one-to-one assignment BUD-19 added for same-account matching. → `src/lib/statement-reconcile.ts` _(friction - S)_
- [ ] **BUD-32** Free the statement fingerprint when an imported transaction is deleted — `DELETE /api/transactions/[id]` sets `deleted_at` but leaves `statement_hash`, so the partial unique index still holds it: re-importing reports `skipped_duplicate`, the row never returns, and reconcile (which filters `deleted_at IS NULL`) shows it as unmatched so Commit silently reports 0 created. Either null the hash on soft-delete, or make reconcile see soft-deleted hash-bearing rows and say "deleted — restore instead". → `src/app/api/transactions/[id]/route.ts` + `src/app/api/statement-import/reconcile/route.ts` _(friction - S)_

## Next

- [ ] **BUD-24** Recycle Bin restore must re-apply balances for **transfers** — BUD-23 fixed the transactions half (`api/recycle-bin/restore/route.ts`); restoring a deleted transfer still leaves both accounts short because delete reverses the deltas and restore never re-applies them. Audit every balance-moving module in `src/lib/recycleBin/registry.ts` for the same shape. _(friction - M)_
- [ ] **BUD-1** Merchant-match → Voice Draft Transactions — when a spoken message contains a known merchant, run it through `matchMerchantMapping()` so the draft pre-selects Category/Subcategory from the merchant map (on top of existing NLP category matching). → `src/lib/nlp/` + drafts review UI _(annoyance - M)_
- [ ] **BUD-2** Merchant-match → Hub Budget Chat "Add as Transaction" — when converting a chat message to a transaction (Message Actions), run the text through the merchant map to pre-select Category/Subcategory in the action sheet. Junction work — coordinate with [Hub & ERA · 4 · Checklist](<../Hub & ERA/4 - Checklist.md>) (HUB-10). _(annoyance - M)_

**Post-trip statement reconciliation** *(workflow decision 2026-08-19)* — Lebanon statements keep their current job: the upload **inserts** the transactions, because local merchants are recognizable and volume is low. Trips invert that: every card tap is logged manually in the moment (foreign statement descriptors are unreadable weeks later), and the statement is uploaded **after** returning purely to **audit** that log. Same parser, same review UI, opposite intent — so the reconcile-only path is a mode on the existing feature, not a second importer. Entry point + trip scoping live in [Trips · 4 · Checklist](<../Trips/4 - Checklist.md>) (TRIP-28).

- [ ] **BUD-26** Reconcile-only ("audit") mode for statement import — a run that matches parsed rows against already-logged transactions and **creates nothing**: no `create` entries, no balance deltas, no merchant learning writes, only a verdict per row. The matcher (`/api/statement-import/reconcile`) is already balance-neutral; what's missing is a session mode that stops before commit and a result surface that reads as a report instead of a work queue. Mode must be chosen at upload and be visible on the review screen, so an audit run can never be mistaken for an insert run. → `src/features/statement-import/sessionModel.ts` + `src/app/statement-import/page.tsx` _(friction - M)_
- [ ] **BUD-27** Trip-aware matching — the current matcher is single-account, single-currency, −7/+1 days, tolerance `max($1, 10%)` (`AMOUNT_TOLERANCE_MIN`/`_PCT`), which is right for Lebanon and wrong abroad on three counts: (1) **FX** — the bank posts a converted amount in the card's currency while the manual log is in the trip currency, so raw amount comparison fails outright; compare via an **implied rate** (`statement_amount / logged_amount`) clustered across the trip, accept rows near the cluster median and flag the outliers, instead of widening the flat tolerance; (2) **posting lag** — foreign settlement plus weekends routinely exceeds 7 days, so the window needs a trip profile; (3) **account scope** — candidates are hard-filtered to the statement's `account_id`, but trip spend may be logged against the trip account created by `activate_trip` (in the trip's currency), so the candidate pool must span the card account **and** the trip's account. → `src/lib/statement-reconcile.ts` _(friction - L)_
- [ ] **BUD-28** Reconciliation exception report — the output of an audit run, ranked, in **both** directions: statement rows with no logged transaction (a tap never logged) and logged transactions with no statement row (double-logged, cash-not-card, or not yet posted). Lead with the arithmetic that triggers the whole exercise — total statement vs total logged for the period, with the gap stated in one number — then the ranked exceptions, `probable`/`ambiguous` pairs first with a one-tap confirm/reject that resolves the pair without inserting anything. Small gaps within tolerance close silently; a large gap (owner's threshold ~$100) is the alert. → `src/components/statement-import/` _(friction - M)_

## Later

- [ ] **BUD-3** Recurring → Schedule due-date unify — coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(friction - L)_
- [ ] **BUD-4** Cashflow forecast → ERA briefing — project balances forward; scope after core tests exist. _(friction - L)_
- [ ] **BUD-5** 50/30/20 budgeting templates + Dashboard V2 widgets. _(annoyance - M)_
- [ ] **BUD-6** Allocation auto-suggest from recurring commitments. Fold into the allocation workflow redesign if it becomes part of that. _(annoyance - M)_
- [ ] **BUD-7** Future Purchase → Transaction auto-complete on linked purchase. _(annoyance - M)_
- [ ] **BUD-8** Debt → Schedule auto-reminder on collection date. _(annoyance - M)_
- [ ] **BUD-9** Split the expense + recurring mega-forms into testable units (only when next touched). _(parked - M)_
- [ ] **BUD-10** Statement Import → Inventory/Catalogue price pre-fill. _(parked - M)_
