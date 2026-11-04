---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit cacf59d (2026-11-04). Outcomes are derived by reading code; the billing-period figures in S01 come from re-running the repo's logic in a scratch script (TZ=Asia/Beirut). No scenario was executed in the app, on a device or against data."
---

# ERA Scenario Catalogue

[README](README.md) · [Business Rules](BUSINESS-RULES.md) · **Scenario Catalogue** · [Open Decisions](OPEN-DECISIONS.md)

Twelve concrete situations that cross module boundaries or sit on a boundary of a rule. All people, amounts and items are fictional: **Rami** (blue theme) and **Lina** (pink theme) share one household in Beirut. Beirut is UTC+2 from 25 Oct 2026 and UTC+3 from 28 Mar 2027 (container tz database).

Each scenario gives the setup, what the code does today with references, what the person would reasonably expect or what documents say, and the acceptance check a test or owner walkthrough would need. **Expected** is never taken from the code: where the right answer is a business choice, the scenario points to [OPEN-DECISIONS.md](OPEN-DECISIONS.md).

| # | Scenario | Themes | Rules | Verdict |
|---|---|---|---|---|
| S01 | "This month" on the 30th with a start day of 31 | boundary, duplicated logic | BR-07, BR-08 | Contradiction |
| S02 | A spend just after midnight on the first day of a billing month | time zone, missing information | BR-14, BR-02 | Contradiction |
| S03 | The same money recorded twice | duplicated records, interrupted operation | BR-10, BR-12 | Defect (tracked) + gap |
| S04 | Settling more than is owed | missing validation | BR-11, BR-01 | Open question |
| S05 | What Lina sees of Rami's private account | household visibility | BR-04, BR-13 | Open question |
| S06 | A split dinner deleted and restored | cross-module, inverse | BR-05, BR-29 | Defect (tracked) |
| S07 | Paying dollars, getting LBP change | calculation | BR-06 | Contradiction |
| S08 | A household trip, a weekly chore and a late completion | cross-module, recurrence | BR-22, BR-19, BR-21 | Open question (feature off) |
| S09 | A medication course across daylight saving and a trip | time-zone change, cross-module | BR-25, BR-18 | Contradiction |
| S10 | The reminder scheduler stops for 13 hours | stale data, interruption | BR-18, BR-17 | Gap |
| S11 | A weekend without signal | interrupted operations, offline | BR-30 | Defect (tracked) |
| S12 | Both phones change the same thing | conflicting updates | BR-10, BR-27, BR-28 | Mixed |

---

## S01 — "This month" on the 30th with a start day of 31

**Setup.** Billing month starts on day 31. Rent $500 (monthly, due 30 Nov 2026) confirmed on 30 Nov. Groceries $60 on 15 Nov. Today is Mon 30 Nov 2026.

| Surface | Period it uses today | Includes $60 groceries? |
|---|---|---|
| Dashboard default range (`DashboardClientPage.tsx:107-125`, `:160-167`) | 31 Oct → 30 Dec | yes |
| ERA "how much did we spend this month" (`getDefaultDateRange()`, `budget.ts:73`) | 30 Nov → 30 Dec | no |
| Recurring console (`getCustomBillingPeriod()`) | 30 Nov → 30 Dec; Rent "Covered 2026-11-30" | — |
| Legacy AI chat (`src/lib/ai/context.ts:31-36`) | 1 Nov → 30 Nov | yes |

**Expected.** One answer to "this month". The clamped period (30 Nov → 30 Dec in November, because November has 30 days) is what two of four implementations already use; which one is right is Q-04.

**Acceptance.** With start day 29, 30 and 31 and today on the 1st, 15th, 28th–31st of a 28/30/31-day month: dashboard total, ERA answer and recurring status all use the same start and end dates.

## S02 — A spend just after midnight on the first day of a billing month

**Setup.** Start day 1. Sun 1 Nov 2026 00:40 in Beirut = Sat 31 Oct 22:40 UTC. Rami logs "Taxi 6" in the expense form, Lina sends Rami $50 from the Transfer dialog, and Rami records Sami's $20 debt return.

| Record | Day stored today | Why |
|---|---|---|
| Taxi transaction | 1 Nov | form sends the local date (`MobileExpenseForm.tsx:897`) |
| Taxi balance-history row | **31 Oct** | `effective_date` defaults to the UTC day (`src/lib/balance.ts:126`) |
| Transfer | **31 Oct** when the client sends no date | server UTC default (`transfers/route.ts`, T1) |
| Debt return transaction | **31 Oct** | always the UTC day (`debts/[id]/route.ts:147`) |

**Effect.** The transfer and the debt return land in October's totals; the balance drawer shows the taxi under the 31st.

**Expected.** Records made at 00:40 belong to 1 Nov for the person who made them (Hard Rule 18 stores instants in UTC; it does not say the *day* is UTC's). Missing date handling is Q-07.

**Acceptance.** With the clock at 2026-10-31T22:40Z and the device in Asia/Beirut, every record above is dated 2026-11-01, and the balance drawer groups the taxi under 1 Nov.

## S03 — The same money recorded twice

**A. Double confirm.** Internet $45, due 5 Nov, on a slow connection. Rami taps **Confirm**, sees nothing, taps again.

- Today: both requests read `next_due_date = 2026-11-05`, both insert a $45 transaction, both write `2026-12-05` (no compare-and-set, M2; `recurring-payments/[id]/route.ts:216-279`). React Query also re-sends a failed mutation once (`providers.tsx:131-134`, Audit #1). Wallet −$90.
- Expected: one transaction, Wallet −$45, due 5 Dec (Major Bug Sweep M2 fix).

**B. Re-importing after a manual delete.** Rami imports October's statement; one row ("SPINNEYS 27.90") was wrongly created. Rami deletes it from the transaction list, fixes the category, and re-imports to get it back.

- Today: delete sets `deleted_at` but keeps `statement_hash`; the partial unique index still holds the fingerprint, so the re-import reports `skipped_duplicate` and reconcile ignores deleted rows; the row never comes back (Feature Map `statement-import.md` gotcha). Only batch Revert frees it.
- Expected: the person can get the row back; Revert-only is a defensible rule but nothing on screen says so.

**Acceptance.** A: two confirms within one second → one transaction, one balance move, 409 for the second. B: after a manual delete, re-import either offers the row again or tells the person to use Revert.

## S04 — Settling more than is owed

**Setup.** Sami owes Rami $100, recorded from a $100 transaction on Wallet (expense account). Rami types 150 instead of 50 in Settle.

- Today: a "Debt return from Sami (settled)" transaction of **+$150** is posted on Wallet; `returned_amount = min(0 + 150, 100) = 100`; status `closed` (`debts/[id]/route.ts:141-215`). The cap exists only in the modal (`DebtSettlementModal.tsx:58`, M5), so ERA, the offline queue or a crafted request reach the server path.
- Variant: a standalone debt (no linked transaction) records the return but posts no money.
- Expected: Q-06 — refuse, cap the posted amount, or record the extra $50 separately.

**Acceptance.** Settle 150 on a $100 debt → the chosen rule applies, and Wallet moves by the same amount the debt records as returned.

## S05 — What Lina sees of Rami's private account

**Setup.** Rami has a private account "Personal" (`is_public = false`) with "Gift for Lina $120" marked private and "Barber $15" not marked private. The household trip "Rome" is tagged on the gift.

| Lina's view | Today | Evidence |
|---|---|---|
| Expense-form account picker | "Personal" hidden | `accounts/route.ts:53-56` |
| Dashboard list and totals | Barber shown in full; gift shown as a $120 row with no description or category, **counted in household totals** | `transaction.service.ts:195-230`, `:270` |
| Transfer destinations | "Personal" listed (`?household=true`) | `accounts/route.ts:44-58` |
| Rome trip total | includes $120, row opaque | `src/lib/tripSpend.ts` |

**Expected.** Unresolved (Q-02). A surprise gift's amount reaching the partner's dashboard and trip total defeats the surprise; showing nothing changes the shared totals. Documents point both ways (BUSINESS-RULES C-02).

**Acceptance.** For each combination of account visibility × row privacy, a table of what the partner sees (row, amount, description, totals) agreed by the owner and checked on both phones.

## S06 — A split dinner deleted and restored

**Setup.** Rami pays $40 dinner from Wallet and requests a split; Lina completes $15 from her own Wallet. Rami then deletes the dinner by mistake and restores it from the Recycle Bin.

- Today: delete reverses both legs (Rami +40, Lina +15); restore re-applies only Rami's −40 (`recycle-bin/restore/route.ts:99-124`, M4/BUD-92). Lina's Wallet is $15 too high with no history row explaining it. If Lina had double-tapped "complete", she would have paid twice (M2).
- Expected: restore is the exact inverse of delete.

**Acceptance.** Delete then restore → both wallets equal their post-split values; Lina's double submit moves her wallet once.

## S07 — Paying dollars, getting LBP change

**Setup.** Rate 90 (= 90,000 LBP per USD). Lina pays a $20 bill for groceries and receives 360 (= 360,000 LBP) in change.

- Today: transaction amount $20, Wallet −$20, `lbp_change_received = 360`; the form shows "actual value" $16 (20 − 360 ÷ 90). Groceries category, envelopes and analytics count **$20** (BR-06). The LBP cash is not added anywhere unless Lina records it in an LBP account.
- Expected per the LBP doc: the actual cost is $16. Which number is "spent" is Q-03.

**Acceptance.** The owner chooses; then groceries spend for the month, the envelope and ERA's month total all show the same figure for this purchase.

## S08 — A household trip, a weekly chore and a late completion

**Setup.** Household trip 18–25 Nov 2026. "Water plants" is a weekly flexible chore placed Thu 19 Nov 18:00. A one-time "Dentist Sat 21 Nov 10:00" has one alert, plus an older alert that had already been deactivated. Lina's neighbour waters the plants on Fri 20 Nov and Lina ticks it at 09:10.

- **Today (cascade off):** activation creates only the trip account; the chore and the dentist reminder stay active and their pushes fire during the trip. Lina's tick stores `occurrence_date = 20 Nov 07:10Z` with the plan in metadata (BR-19).
- **If TRIP-39 re-enables the snapshot RPCs:** one skip row at 18 Nov for the chore, so the Thursday slot stays active; the dentist item is cancelled and alerts deactivated; on completion every alert of that item is reactivated, including the one that was off before the trip (01-atlas F-U6).
- **Expected:** a decision about what a household trip should do to routines (Q-11), and one meaning of the occurrence time (Q-16).

**Acceptance.** Re-enabling the cascade is accepted only when: no chore occurrence inside the trip is due; returning from the trip restores exactly the alerts the trip switched off; meal plans outside this household are untouched.

## S09 — A medication course across daylight saving and a trip

**Setup.** Rami starts "Amoxi-test" on Mon 22 Mar 2027 for 14 days, 08:00 and 20:00, created on a phone in Beirut (zone stored as Asia/Beirut, `MedicationsSection.tsx:66`). Beirut moves to UTC+3 on Sun 28 Mar 2027. On Wed 31 Mar Rami flies to Paris for three days.

| Clock | Before 28 Mar | After 28 Mar (in Beirut) | Source |
|---|---|---|---|
| Healthcare checklist slot | 08:00 local (06:00Z) | 08:00 local (05:00Z) | slots in the medication's zone (`medicationSchedule.ts`) |
| Schedule screen | 08:00 | 08:00 | wall-clock adjustment (`dayOccurrences.ts:64`) |
| Push | 08:00 | **09:00** (06:00Z) | cron advances the alert in UTC (`item-reminders/route.ts:425-445`) |

In Paris, the checklist keeps Beirut's 08:00 (07:00 Paris); Schedule screens adjust in the phone's zone; pushes keep their UTC instants. Ticking the 09:00 push still logs the 08:00 dose because the mirror picks the nearest slot within ±1 day (`migrations/2026-09-26_healthcare-medications.sql:528-535`).

- **Contradiction:** the medication helper says the checklist and server reminders "agree even when the phone travels"; `Timezone Handling.md` says no server-side conversion is needed.
- **Expected:** a dose reminder at the dose time. Whether doses follow the home zone or the traveller is Q-15; whether pushes keep local wall-clock time across DST is Q-09.

**Acceptance.** On 29 Mar 2027 the push, the checklist and the Schedule screen all show the same dose time; with the phone in Paris they still agree with each other, in whichever zone the owner chose.

## S10 — The reminder scheduler stops for 13 hours

**Setup.** One-time "Pay school fees" alert at 09:00 Mon 16 Nov 2026; recurring "Take vitamins" daily at 09:00. The scheduler does not call `cron/item-reminders` between 08:00 and 22:30.

- Today at 22:30: "Pay school fees" is 13.5 h old, outside the 12 h look-back → never sent, no record of the miss. "Take vitamins" is more than 1 h stale → moved to tomorrow 09:00 without sending (`item-reminders/route.ts:92-104`). Two scheduler calls overlapping at 22:30 could send other alerts twice (N1). Nothing in the app shows the scheduler stopped (Design Doctrine §3, "zombie schedule").
- Expected: the person learns a reminder was missed (Q-09).

**Acceptance.** After an outage of 13 h, each missed alert is either sent once marked late or listed in a single "missed while away" notice; nothing is silently dropped; a last-run time is visible.

## S11 — A weekend without signal

**Setup.** Lina is in the mountains from Fri 20 Nov 18:00 to Sun 22 Nov 20:00. She logs "Fuel $35" (Fri 19:00), completes the chore "Feed cat" (Sat 10:00), adds "Bread" to the shopping list (Sat 12:00), ticks "Milk" (Sat 12:05) and logs a workout (Sat 17:00).

| Change | Today on reconnect Sun 20:00 | Evidence |
|---|---|---|
| Fuel $35 (49 h old) | **deleted from the queue, no notice** | `offlineQueue.ts:422-435` (O1) |
| Feed cat (34 h) | deleted | same |
| Bread (32 h) | deleted | same |
| Milk tick | failed at the time, never queued | raw `fetch` PATCH (01-atlas F-U9) |
| Workout | sent (fitness is never aged out) | `offlineQueue.ts:429` |
| Any change if the session expired | 401 → deleted | O1 |

- Expected: nothing the person saw as saved disappears (Q-13; Major Bug Sweep O1 proposes review instead of deletion).

**Acceptance.** After 50 h offline, every queued change is sent or shown for review; the Milk tick is either queued or refused at the time with a message.

## S12 — Both phones change the same thing

**Setup.** At 10:00 Rami and Lina both have the shared "Electricity $80, due 10 Nov" open and both tap Confirm; both tick "Eggs" on the shopping list; both edit the Catalogue item "Water filter" (next change date). Rami had generated a new household invite code last week without unlinking.

| Thing | Today | Evidence |
|---|---|---|
| Electricity | two transactions, two balance moves | M2 |
| Eggs | each request flips the stored state; two flips can leave it unticked | Audit #8 |
| Water filter | second save gets 409 with the current value | `catalogue_items.revision`, KIT-20 (`tests/catalogue-patch.test.ts`) |
| Seeing each other's data | routes using `.maybeSingle()` on `household_links` may treat them as unlinked (empty lists, 403) | H1 |

- Expected: the Catalogue behaviour (detect, refuse, show the newer value) is the model; money and shopping writes should state the intended end state and refuse a lost claim.

**Acceptance.** Two simultaneous confirms → one transaction; two simultaneous "tick" requests → ticked; a stale invite row does not hide either person's shared data.
