---
created: 2026-03-23
updated: 2026-08-24
type: overview
module: statement-import
module-type: standalone
tags:
  - type/overview
  - module/statement-import
---

# Statement Import

> **Source:** `src/features/statement-import/`, `src/app/statement-import/`, `src/components/statement-import/`, `src/lib/statement-reconcile.ts`
> **Type:** Standalone

## Docs in This Module

- [[Statement Import Guide]]

## Key Concepts

- **The statement is an audit, not an entry path.** The owner logs card taps as they happen (Hub chat, voice, expense form); uploading the statement afterwards *reconciles* it against those logged transactions. Rows that match need no work — only the leftovers get categorized. This is the module's north star; every design decision below follows from it.
- **Posting lag is the matcher's job, not the user's.** Banks post a tap 1–3+ days after it happens, so matching uses a date window (logged date ∈ [posting − 7d, posting + 1d]) plus amount and merchant-text signals, never date equality.
- **Stamping is balance-neutral.** A matched row only writes `statement_hash` onto the existing transaction. Creating, confirming a draft, or accepting the bank's amount are the only paths that move money — see the invariants in `src/app/api/statement-import/commit/route.ts`.
- Review work is persisted to IndexedDB (`src/lib/statementImportSession.ts`) and resumable; nothing is lost by navigating away.
- **Every commit is a revertible batch.** A bulk write the user cannot walk back is the real hazard with statements, so the commit route opens a `statement_imports` record and writes one `statement_import_entries` row per transaction it touches — carrying both the state it found and the state it wrote — *before* any balance moves. If either cannot be written it returns 503 having changed nothing. `POST /api/statement-import/imports/[id]/revert` replays that ledger backwards: created rows are soft-deleted (Recycle Bin) with their hash freed so the statement stays re-importable, stamps are un-stamped, confirmed drafts go back to draft, merchant mappings are restored to their pre-import value, and balances move back. The rules live in `src/lib/statement-revert.ts` — deltas are always computed from **live** row state (so an amount edited after the import still nets to zero), and a newer human edit is never overwritten.
- **The account is part of the dedupe key.** Hash v2 is `v2|account|date|description|moneyOut|moneyIn`; reconciliation only considers candidates from the same account; and creates always land in the account the statement was uploaded against — never a merchant mapping's account, or the fingerprint would guard a different account than the row it describes.
- **Own-account moves are never money.** Rows whose description names an internal transfer or an own-account FX leg ("Own Account Exchange: USD to EUR at 0.852 - from 501400630004", "Transfer from Own Account …") classify as `transfer` and produce no commit action — money-rules Invariant 4. Until 2026-08-24 only `/transfer\s+(from|to)/` was recognised, so every FX leg imported as a real debit or credit; the two legs cancelled on the balance, which is why the damage showed up only as phantom income and phantom spend in analytics. The pattern list (`OWN_ACCOUNT_PATTERNS` in `src/lib/statement-reconcile.ts`) is deliberately conservative and anchored to an explicit "account"/"transfer" word — a false positive silently drops a *real* expense, which is the worse failure, so bare `/exchange/` is not enough ("Currency Exchange Hamra" is a merchant).
- **The exact-hash check runs before the transfer check**, so a row already written to the ledger reports "imported before" rather than hiding in the skipped bucket. That is what makes pre-fix phantom transfer transactions discoverable on a re-import.
- **Renaming preserves the dedupe key.** `RowDecision.description` changes only what is stored on the transaction; the fingerprint is computed once at parse time from the bank's raw text and never recomputed. So "PrePaid" → "ALFA Prepaid Phone" is safe: next month's statement still matches on the bank's wording.
- **One statement → one account, with a per-row escape hatch.** The account is chosen deliberately before upload (no default — it used to pre-select `is_default`, which meant the target of a bulk money write could be chosen by not noticing it) and is shown in the review header for the whole session. `RowDecision.account_id` re-targets individual rows for the real exception: bank fees riding along on a salary statement are a charge against the expenses account, not salary income. Overriding clears the row's category, since categories are account-scoped.
- **The fingerprint is keyed to the statement's account, never the row's destination.** That is what makes the override safe: a re-targeted row keeps the hash of the statement it came from, so next month's import still recognises it. The consequence is that **reconciliation looks hashes up across every account**, not just the statement's.
- **`other_account` — same money, different account.** A row whose exact date, amount and direction match a transaction in a *different* account is flagged, never auto-skipped: it is either a deliberate past override or a mis-filing worth moving, and only the owner can tell. Description is deliberately **not** a gate (a mis-filed transaction is usually hand-typed, so its wording is the owner's, not the bank's) — it ranks which twin to show, and both descriptions go on screen.
- Merchant mappings are learned from rows the user categorizes, keyed on the normalized merchant string. A rename is **not** learned — it stays a per-row manual act by design. Neither is an account override: auto-applying a learned account is the BUD-23 bug shape.
- `merchant_mappings` is also read by Transactions' manual-entry auto-suggest via a shared hook (`src/hooks/useMerchantMappings.ts`) — see [Feature Map/standalone/statement-import.md](<../../01 - Architecture/Feature Map/standalone/statement-import.md>).
