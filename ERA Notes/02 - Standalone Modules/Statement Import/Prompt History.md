---
title: Statement Import — Prompt History
updated: 2026-08-25
status: reference
---

# Statement Import — Prompt History

Cumulative summary of every prompt the owner sent about the Statement Import (e-statement upload) feature, reconstructed from the local Claude Code transcripts.

**Coverage caveat:** transcripts on this machine start **2026-07-28**. The feature's original build prompts (the module shipped around May 2026 — the earliest imported rows carry `inserted_at 2026-05-28`) are not in the retained history. Everything below is derived from prompts dated 2026-08-04 → 2026-08-25.

---

## Phase 0 — Context (pre-feature-work)

**2026-08-04** — Italy trip planning. Listed multi-currency gaps and noted in passing *"I will be paying via card, so I will be having an e-statement upload (no actions here unless you think of something)"* — plus USD→EUR cash conversion at user-specified rates with a manual round-up override. This is the origin of the FX/exchange requirements that resurfaced three weeks later.

---

## Phase 1 — "The feature is hectic" (2026-08-18)

**The founding complaint.** Called e-statement upload *"the most hectic, erroneous, heavy manual task I have in my whole application"*. Concrete pain from the Italy trip import on the EUR account:

- Wrong auto-grouping of multiple transactions → had to unmatch each one to set its own Category/Subcategory.
- Creating a new Subcategory mid-flow didn't refresh the picker list → had to restart the whole import (refresh / clear cache).
- Merchant→keyword mapping should be persisted on the transaction table (flagged as a *later phase*, not needed then).
- Statement date ≠ actual payment date (the bank holds amounts 1–3+ days).
- Must work for both him and his partner.
- Full user story stated: print per-currency PDFs from the bank app → upload → map every row one by one, guessing forgotten merchants and back-tracking on mistakes.

Asked for a plan, not code: *"Give me a solution that would make my life much easier and way more straightforward."*

---

## Phase 2 — Hardening the data layer (2026-08-19)

- **Account in the dedupe key.** Matching/duplication must include the selected **Account**, not just date + amount + description — otherwise an imported row can falsely match a manually logged one.
- **Rollback.** Every import must be a DB record that can be opened and **reverted wholesale**; bulk inserts must not be able to wreck the database. Praised the existing *resume* feature and asked for "everything related to data support and hygiene and manipulation".
- **Bug:** React hydration mismatch on the Radix `Select` trigger in the import page.
- **Mobile refactor:** *"the still not committed statement-import page is not mobile friendly at all"* — wanted straightforward, intuitive, easy to read, **not cluttered with too much wording and actions**.
- **Trip reconciliation strategy (plan only, do NOT code):** Lebanon purchases get imported from the statement as usual; abroad, every card tap is logged manually in the expense form and the statement is later used *to reconcile*, with amount tolerance for small deltas and **fuzzy matching** when the gap is large (~$100+). Asked for three PM Command Center items only: (a) a reconcile-a-trip import mode, (b) the fuzzy matching logic, (c) alerts for unmatched/missing lines.
- **Q&A:** asked twice what the upload's matching rule is, then clarified: *"what is the hash key?"* — i.e. what identity is stored so a re-upload of the same period is recognised.

---

## Phase 3 — Statement audit + historic data cleanup (2026-08-24, morning)

Sent a screenshot of a real e-statement and asked for a completeness audit:

- Is the logic complete? Does the duplicate key actually work on re-upload of the same statement?
- Should he always import from the start of the month so he never has to remember what was already entered?
- Show the user which rows **matched** during upload.
- **Rename must preserve both:** his meaningful description (`ALFA Prepaid Phone`) as `transactions.description`, and the bank's original token (`PrePaid`) inside the duplicate key.
- **Two different concepts, two tabs:** exact hash duplicates (statement ↔ statement) vs. possible matches against manually logged transactions. The exact key matters most because he won't verify manually.
- Asked whether a **carousel/wizard** (one transaction at a time, grouped by date) is the better mobile pattern.
- Bottom-line question: *should I delete all imported transactions and re-import from scratch?*

Then, in sequence:

- **"Several major issues"** — suspected the hash key had silently changed, and there was **no way to choose the target Account** (Salary statement → Salary account, Debit Card → Debit Card, Debit Card abroad → Italy Trip).
- **"My imported transactions are a mess"** — offered to share samples; asked for diagnostic SQL to decide between mass delete + re-import vs. data correction. Noted that a single statement mixes income (Salary account) with bank fees (Debit Card expense account).
- Pasted answers into `2026-08-24_diagnose-imported-transactions.sql`. Demanded a **perfect historic cleanup**, plus future confidence that re-uploading a whole month — or a whole year — duplicates nothing. Asked whether the hash can be **retro-fitted** to the fixed formula, and set a standing rule: *any future change to the statement structure must ship with a historic data correction*.
- Ran `2026-08-24_verify-hash-reconstruction.sql`, then `2026-08-24_recount-transfers.sql`; endorsed the **month-by-month re-upload that backfills blank hashes**.
- Asked for the delete-duplicates script (all duplicates were in *Debit Card - NEO*, a temporarily wrong balance was acceptable), and **pushed back on deleting FX rows** — *"those are actual expenses, actual cost reduced from my bank balance."* Then parked FX as too complex (it returned on 08-25).
- Ran the repair migration, then imported his first real month to confirm rows were logged and hashes backfilled.
- Reported an August-2025 import showing something unexpected (*"WHY?!"*), pasted a real income row with its `statement_hash`, and asked exactly what a re-upload would do to it.
- Asked why Salary rows land under **Imported** but Debit Card rows land under **Logged** (0 vs 89).

---

## Phase 4 — UI polish and the "too many texts" rule (2026-08-24, midday)

*"Now I feel the statement import to be very powerful! So I pushed to production with confidence"* — followed by:

1. **Store the bank description** in its own column (his own wording is inconsistent; the bank's is systematic) — asked whether that's needed for reporting or could be reverse-engineered from the hash.
2. Review page should show **Category *and* Subcategory chips in a parent/child UI**, with the previous selection **pre-selected** when reopened.
3. Show the **amount per row** (like the date) in the Choose Category sheet.
4. **Skip All** for everything under Review.
5. Re-importing with 0 review rows disabled the "Save 0 rows" button — which blocked backfilling the description column.
6. **Previously skipped** rows should persist so he doesn't re-skip them every time.
7. Sub-navigation under Review to switch between "already in another account" and the review list.
8. Missing income sign per row (suspected regression).
9. **Hard Rule #28 was born here:** *"you are adding on production, on the UI, way too many texts… it is getting too frustrating"* — explicitly asked for it to be written into CLAUDE.md as a hard rule; help belongs behind an `i` icon, not inline.
10. Rows in every list should be **clickable to view details** (date, amount, …), like the Choose Category sheet.

---

## Phase 5 — Transfers (2026-08-24, afternoon)

- **Own-account transfers** should be skipped; transfers **to/from other people** must be imported. Transfer-from = positive (preselect the Salary/income account), transfer-to = negative (preselect an expense account), using the per-row account override.
- **Partner transfers are true transfers, not transactions.** `Transfer to/from RACHA SAMIR TOUMA` / `ELIO ANTOINE AOUN` must be logged as transfers with no category; the partner then categorises her own spend. A transfer from him should **match as a duplicate** when she imports her own statement.
- Discovered `profiles` was empty (names came from the Supabase auth users table) — asked what to do; then asked whether `profiles.full_name` = *"Racha Touma"* can match the bank's *"RACHA SAMIR TOUMA"*.
- Side request: Hub Chat's shopping conversation should show `profiles.full_name` instead of the email local-part.
- Bugs: partner transfers weren't appearing at all (asked whether the parser drops them); requested a **standalone Transfers navigation**; after clearing cache the Transfers tab still wasn't there; then *"all transfers aren't under Transfers"*. Final ask: highlight partner transfers in the **partner's theme color**.

---

## Phase 6 — "Lots of gaps" (2026-08-25, morning)

*"Why haven't you noticed them before?"* — five detailed gaps:

1. **Restore from Skipped goes nowhere visible** — a restored row must land in Review / Transfers / Imported / Logged (or a new tab, if he's told why), never just bump "Save X rows" with no tab count changing.
2. **Withdrawals** are either a transfer (cash → wallet) or a transaction (a voucher sent = a real payment).
3. Transfers **Received vs Sent** must be visually distinguishable; the description must be editable while keeping the bank description; a transfer must be **promotable to a transaction** with category/subcategory. Rule stated: *only partner transfers are real transfers*; everything else is income (to an income account, "Transfers" subcategory) or an expense. **The parser is dropping the quoted memo** — `Transfer to ELIE JOSEPH AZAR via Mobile - 'link bowling - mkalles - for 2'` — which is exactly what identifies the expense.
4. Counts and labels are confusing: *"Review 14 one at a time"* was actually reviewing transfers; Review showed 20 when it was 6.
5. A toggle in **Skipped** to show/hide "Transfer from Own" noise.

*"Make sure you don't miss any single detail… IT IS VERY CRUCIAL THAT YOU DO IT ALL!"*

---

## Phase 7 — Staging UX + FX (2026-08-25, midday)

- **"To wallet" + account dropdown is confusing** — replace with a **Transfer / Spent toggle**: transfer → pick an account, spend → pick a category.
- **Staging, not instant commit:** selecting something must not make the row disappear as if saved; edited rows stay visible, or get a "pending" tab.
- The tab bar is **truncated with unreadable counts** — make it draggable, with **faded edges** signalling that it scrolls.
- The partner "to account" dropdown lists the wrong accounts and renders **behind the button**; he explicitly warned **it is not RLS** (accounts work everywhere else) — it's logic or UI.
- Stated DoD: *"the statement import is so powerful and straightforward that I could count on the application's parsing, logic, grouping to know each row in my statement what action should be done for it."*
- **Second escalation the same day:** *"Statement-Import feature is horrible!"* — Skipped needs sub-navigation grouping **by skip reason**; "Previously skipped" needs its own sub-tab; **Ready** must read as a final stage (why are some rows tagged *Log* and some *Restore*?); and — *"AGAIN"* — choosing a category or destination account in Transfers **must not make the row vanish**: *"THIS IS THE WORST USER EXPERIENCE I EVER SAW!"*
- **Exchange rows** must be their own case: `Money out 200.00` with rate `0.852` in the description = a transfer from the Salary account to the EUR/Trip account that credits **170.40 EUR** — the rate must be applied to the target balance. Follow-up: *"didn't work — Exchange is still showing in Skipped, not Transfers."*

---

## Phase 8 — Transfer hashes and the Imported regression (2026-08-25, afternoon)

- **"Do transfers from e-statements have their hash key?"** — if not, add one and dedupe transfers on it, exactly like transactions. *(→ `migrations/2026-08-25_transfer-statement-hash.sql`.)*
- **Regression report:** *"no idea what you did, but now 'Imported' navigation under statement import is null — shows 0 records."* Importing two full years of statements with many salary income rows, and none appear under Imported; only Exchange transfers do. *"This is extremely bad!"*

---

## Standing themes across every prompt

| Theme | What the owner keeps asking for |
|---|---|
| **Identity / dedupe** | One unambiguous hash per statement row — account-scoped, stable across renames, applied to **transfers too** — so a whole month (or year) can be re-uploaded with zero duplicates and no manual checking. |
| **Data safety** | Reversible imports, resume, diagnostic + repair SQL, and a historic backfill shipped with **any** change to the hash or structure. |
| **Row classification** | Every statement line must be auto-routed: own-transfer (skip), partner transfer, withdrawal, exchange/FX, income, expense — with the reason visible when it lands in Skipped. |
| **Staging over auto-commit** | Editing a row must never make it disappear; there must be a visible pending/ready stage before saving. |
| **Preserve the bank's words** | The bank description stored alongside his own wording (including the quoted memo on mobile transfers) — for identity *and* reporting. |
| **Minimal UI text** | Repeatedly, then as a hard rule: labels and verbs only, no explanatory prose; help behind an `i` affordance. |
| **Mobile-first** | The page is used frequently on a phone: readable counts, scrollable tabs, tappable rows with date and amount visible. |
