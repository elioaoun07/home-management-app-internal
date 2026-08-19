---
created: 2026-03-23
updated: 2026-08-19
type: guide
module: statement-import
tags:
  - type/guide
  - module/statement-import
---

# Statement Import Guide

> Rewritten 2026-08-19 for the reconcile model (BUD-18…22). The previous version
> described a Settings-nested dialog that no longer exists, claimed a per-row
> category control the old UI never had, and listed ~30 built-in merchants that
> were never in the code. Treat any older copy as fiction.

## The model

Uploading a statement is an **audit**, not data entry.

The expensive part of bookkeeping is remembering *what a charge was for*, and
that knowledge only exists at the moment of the tap. Weeks later, `VIA ROMA 4421
MILANO` is unrecoverable — it could be parking, a toll, or a gelato. So the app
asks for that meaning when it is free (log the tap in 5 seconds via Hub chat,
voice, or the expense form) and uses the statement to *verify* rather than to
recall:

1. Rows matching something already logged → **no work at all**.
2. Rows the bank has that the app doesn't → the only ones needing a category.
3. Rows already imported previously → skipped, so re-uploading is safe.

If nothing was logged, the flow still works — everything simply lands in bucket
2 and gets categorized, with learned merchant mappings doing what they can.

## The flow

`/statement-import` (linked from Settings → Statement Import).

1. **Pick the account first.** It determines the currency amounts are read in and
   is part of each row's fingerprint.
2. **Upload** a PDF or CSV. Parsing is server-side (`parse/route.ts`); only the
   Lebanese 5-column `DATE | TRANSACTIONS | MONEY OUT | MONEY IN | BALANCE`
   layout with `DD/MM/YYYY` dates is supported.
3. **Reconcile** runs automatically (`reconcile/route.ts`) and sorts rows into
   three buckets.
4. **Review** the *Needs review* bucket.
5. **Commit** (`commit/route.ts`) writes everything and shows a receipt.

## The three buckets

| Bucket | Contains | What you do |
|---|---|---|
| **Matched** | Exact matches to logged transactions or drafts, plus rows already imported | Nothing. Tap *Not a match* on any that are wrong. |
| **Review** | Unmatched rows, near-matches (`probable`), and ties (`ambiguous`) | Give a category; confirm or pick a match |
| **Skipped** | Transfers, and rows you set aside | Nothing; restore if you change your mind |

## Matching rules (`src/lib/statement-reconcile.ts`)

- **Window:** logged date ∈ [posting − 7 days, posting + 1 day].
- **Amount:** exact (±0.005) → `matched`; within `max($1, 10%)` → `probable`,
  needing one tap to confirm (covers tips added after the tap, FX rounding).
- **Ranking:** tier → date proximity → merchant-token overlap (`normalizeMerchant`) → recency.
- **One-to-one:** a logged transaction can be claimed by only one row, so two
  identical £12 taps never both match the same entry.
- **Direction must agree:** a credit row only matches a money-back row.
- **Ambiguity is surfaced, not guessed:** genuinely indistinguishable candidates
  are shown for the user to pick from.

## Grouping in review

Rows group by the **full normalized merchant** (`normalizeMerchant`), so
`LE GRAY` and `LE MALL` are separate groups. A group's category is a **default
for rows that have none** — a row given its own category keeps it. This is the
inverse of the old behaviour, where one group choice overwrote every member.

### The review loop is two taps per merchant

This screen is used on a phone, so the review list shows **merchants, not rows**:
one card per merchant with its total and either a category chip or a bright
*Choose category* pill, which makes remaining work scannable without reading.

Tapping a card opens the merchant sheet (`GroupSheet`), whose primary control is
a 3-across grid of category tiles — the same shape the expense form uses. One tap
assigns the merchant and closes the sheet; if the category has subcategories you
get a subcategory step first. **Do not put per-row controls back in the list** —
inline date inputs, icon buttons and paired dropdowns per row are what made this
screen unusable on a phone. They live inside the sheet's collapsed *N rows*
disclosure: per-row category override, date edit, skip, and the group −1/−2/−3d
posting-lag shift. Categories and subcategories can be created inline from the
grid's **+ New** tile.

Rows the matcher only *probably* matched never appear as "categorize me" cards —
they are hoisted into a **Might already be logged** section above the merchant
list. Categorizing one would create a second transaction for money that is
already logged; answering *Not a match* sets `resolution: "create"` and drops the
row down into the merchant groups.

## Money invariants

Encoded in `src/app/api/statement-import/commit/route.test.ts`:

| Action | Balance effect |
|---|---|
| `create` (debit) | −amount on an expense account |
| `create` (credit — refund/reversal) | **+amount**; stored positive with `is_debt_return = true` |
| `stamp` (matched) | **zero** — the money was already counted when logged |
| `stamp` with accepted bank amount | reverse the old amount, apply the new one |
| `confirm_draft` | −amount once (drafts were never counted) |

**Retrying a commit is balance-neutral.** Creates collide with the
`statement_hash` unique index, stamps require `statement_hash IS NULL`, and
draft confirms require `is_draft = true`.

The user's own date is kept on a matched row; the bank's posting date is noise.

## Duplicate protection (hash v2)

`sha256("v2|account|date|description|moneyOut|moneyIn")`, plus `#n` for the nth
identical row in one file. `balance` was deliberately dropped — a re-issued
statement with recomputed balances used to hash differently and import twice.
Rows imported under v1 are still recognized by the reconciler's
probable-duplicate tier, so no backfill was needed.

**The account is load-bearing in that key, so it has to be load-bearing
everywhere else too.** Three places enforce it together:

- the hash itself (`bank-statement-parser.ts`) — the same CSV imported into two
  accounts is two distinct money events, not a duplicate;
- reconciliation, which only considers candidates from the same account, so a
  statement row can never match something logged elsewhere;
- the commit action, which always creates into the **session** account. It used
  to take the account from the row's merchant mapping and skip the row when
  there wasn't one — which silently dropped every create on a first import, and
  could otherwise have written a transaction to account B under a fingerprint
  hashed for account A.

A merchant mapping learned on another account also stops supplying a category
at parse time: `user_categories.account_id` is `NOT NULL`, so that category is
inapplicable here and would fail per-row at commit.

## Session persistence

Everything is written to IndexedDB (`statement-import-sessions`) after each
change, keyed by the file's fingerprint. Navigating away, reloading, or creating
a category no longer destroys the review — a Resume banner brings it back. The
three newest sessions are kept.

## Rollback — every import is a record you can walk back

A statement writes dozens of rows in one tap, so the safety net is not care but
reversibility. This is the hygiene layer around the bulk write.

### What a commit records

Before any money moves, `commit/route.ts`:

1. Opens a **`statement_imports`** record (`processing`) carrying the account,
   the file fingerprint and the file name.
2. Writes one **`statement_import_entries`** row per transaction it touches,
   each holding the state it **found** (`previous`) and the state it **wrote**
   (`applied`), plus the signed `applied_delta`.
3. *Then* applies balances, learns merchant mappings (snapshotting whatever
   stood there before), and closes the record as `completed` with its counts.

If step 1 or 2 fails the route returns **503 having changed nothing**. An
unrevertible bulk write is the failure this whole feature exists to prevent, so
it is treated as fatal rather than warned about. Run
`migrations/2026-08-19_statement-import-rollback.sql` before using the module.

### What a revert does

`POST /api/statement-import/imports/[id]/revert` replays the ledger backwards.
The rules are pure and tested in `src/lib/statement-revert.ts`:

| Action | Reverted to | Balance |
|---|---|---|
| `create` | soft-deleted (Recycle Bin), `statement_hash` cleared | gives back what the row currently holds |
| `stamp` | `statement_hash` cleared, user's own amount restored if the import took the bank's | **zero**, unless the amount was changed |
| `confirm_draft` | back to `is_draft = true` with its original category and amount | takes today's amount back out |
| merchant mappings | restored to their pre-import value, or deleted if the import invented them | — |

**Worked example** — the inverse of the commit route's own: an expense account
went $1,000.00 → $961.75 (create 45.50, stamp 80.00, credit 20.00, confirm draft
12.75 → net −38.25). Reverting: +45.50, 0, −20.00, +12.75 → **net +38.25 →
$1,000.00**. Running it twice moves nothing.

### Two rules that decide every edge case

1. **Balance deltas come from live row state, never from the stored
   `applied_delta`.** If the user edited a transaction after importing it, the
   balance already reflects that edit — reversing the *original* amount would
   leave the account permanently off.
2. **A newer human edit outranks the import.** Where reverting would overwrite
   a value the user changed afterwards, their value is kept and the entry is
   flagged instead. The exception is a row the import **created**: it exists
   only because of the import, so it goes anyway — and the receipt reports how
   many such rows there were.

Rows another import has since claimed (`drifted`) or that were purged from the
Recycle Bin (`gone`) are reported and left alone, which is what makes the status
`partially_reverted` rather than a silent half-job.

### Why a reverted create frees its hash

Soft-deleting keeps the row recoverable, but leaving `statement_hash` on it
would make every row of that statement read as "already imported" forever — the
revert would lock you out of re-importing the file you just reverted. Clearing
it is safe because the reconciler still matches a restored row on amount + date
window, so restoring one from the Recycle Bin and re-importing stamps it rather
than duplicating it.

### Where it appears

The **Recent imports** list on the `/statement-import` upload screen
(`src/components/statement-import/ImportHistory.tsx`). Each card expands to the
per-row ledger with a live "edited since" badge, then a confirm step that
states exactly what will happen before anything moves.

## Known limits

- One bank format; scanned/image PDFs are rejected.
- Currency is only claimed when the statement explicitly labels it
  (`Currency: EUR`). A bare code in the header is ignored — this bank prints
  "Fresh USD" as a product name, which produced false mismatch warnings.
- **Transfers are skipped, not imported as transfers** — deliberately deferred
  (PM inbox item, 2026-07-31).
- Import is own-accounts-only; each household member imports their own
  statements under their own login (enforced server-side).
