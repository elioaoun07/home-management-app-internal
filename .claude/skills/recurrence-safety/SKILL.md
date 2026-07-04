---
name: recurrence-safety
description: "Safety rules for BOTH recurrence systems — recurring payments (budget commitments) and item/schedule recurrence (rrule occurrences, exceptions, pauses). MANDATORY before editing due dates, occurrence expansion, skip/postpone/confirm actions, auto-posting, or anything that generates future instances. Duplicate generation is the historical failure mode here."
---

# /recurrence-safety — Recurrence & Commitments

> **Contract:** this app has **two separate recurrence systems**. Identify which one you're in before editing — mixing their concepts is how bugs start. The historical failure mode is **duplicates** (an occurrence or payment materializing twice) and its mirror (one silently skipped). Every change here must answer: "what guarantees this fires exactly once per due period?"

## System map — know which one you're touching

| | Recurring **Payments** (money) | Item/Schedule **Recurrence** (time) |
|---|---|---|
| Module | Budget — `src/features/recurring/`, `src/app/recurring/`, `src/app/api/recurring-payments/` | Items — `src/features/items/`, reminders/schedule surfaces |
| DB | `recurring_payments` | `items` + `item_recurrence_rules`, `item_recurrence_exceptions`, `recurrence_pauses` |
| Engine | RRULE patterns + due-date advancement; shared logic in `src/features/recurring/commitments.ts` | RRULE expansion + exceptions/pauses (multiple expansion code paths exist — see warning below) |
| Vault doc | `ERA Notes/02 - Standalone Modules/Recurring Payments/Overview.md` (+ Recurrence Exceptions Guide) | `ERA Notes/02 - Standalone Modules/Items & Reminders/` |
| Money impact | YES → also run `money-rules` | Only via linked payments/reminders |

## ⚠️ Read the PM docs first — this area is mid-redesign

Before ANY change to occurrence actions (skip/postpone/edit-one/delete-one) or expansion logic, read `ERA Notes/10 - Project Management/Schedule/1 - Feature State.md` and `2 - Vision & Roadmap.md`. Documented history you must not re-learn the hard way:

- "Skip" was once wired to *postpone-next-occurrence* → produced **duplicates**. Skip and postpone are different operations: skip = this occurrence never happens; postpone = this occurrence moves.
- Item recurrence has **diverging expansion engines** (the same rule expanded in more than one code path can disagree). **Never add another expansion path** — find and reuse the one the surface you're editing already uses; if two paths disagree, that's the bug, and unifying beats patching one side.
- The target model is Google/Outlook-style occurrence semantics (documented in the Schedule PM roadmap, not fully built). Don't "fix" toward a third model.

## Invariants — recurring payments (verified against Overview.md, updated 2026-07-03)

1. **Exactly-once coverage per period.** A commitment is covered either by **confirm** (creates a transaction) or by **mark-covered** (`POST /api/recurring-payments/[id]/mark-covered` — reconciles an *existing* non-draft, non-deleted transaction by updating `last_processed_date` + `next_due_date`, creating **no new spend**). Both paths must remain idempotent: confirming or covering twice must not double-post.
2. **Stale due dates advance repeatedly** until `next_due_date` is after the paid date — a payment confirmed late must not leave a past-due ghost, and must not skip a genuinely unpaid period either. Preserve this loop when touching due-date math.
3. **The grace window is the custom billing month** (`startOfCustomMonth`): inside the current billing period a Monthly Cash/Manual commitment is "due this period"; it becomes **missed** only when the period closes uncovered. Never use calendar months here.
4. **Wallet-after-unpaid and period status labels** derive from commitments state — if you change covered/unpaid logic, re-verify the Plan/Recurring tab metrics and the wallet projection.
5. Auto-posting/draft generation must check for an existing instance for that due period before creating one (dedupe key: payment id + due period, conceptually).

## Invariants — item recurrence

1. An occurrence's state comes from: rule → exceptions (`item_recurrence_exceptions`) → pauses (`recurrence_pauses`), applied in that order. An action on ONE occurrence writes an exception; it never mutates the base rule.
2. Skip ≠ postpone ≠ edit-one ≠ delete-series — map the user action to the right primitive explicitly; never implement one in terms of another.
3. DST/timezone: all DTSTART/UTC/wall-clock handling goes through the `timezone-handling` skill utilities (`buildFullRRuleString`, `adjustOccurrenceToWallClock`, `localToISO`). Hand-rolled date strings here WILL shift occurrences by an hour twice a year.
4. Hot reads of items + recurrence child tables go through the bundle RPC (`get_schedule_bundle`) — don't add per-table fetches (Hard Rule 21).

## Mandatory test scenarios for any recurrence change

Walk these on paper (worked example) and in tests where the logic is in `src/lib`/pure functions:

- [ ] Confirm/cover the same period **twice** → one transaction, one advancement
- [ ] Payment confirmed **late** (2 periods stale) → due date lands after paid date, no ghost, no skipped-unpaid masked
- [ ] Due date on billing-month boundary (user's `monthStartDay`, e.g. 25th) → correct period assignment
- [ ] Monthly rule anchored on the 29/30/31st → February and 30-day months behave (no drift to a new day-of-month)
- [ ] Occurrence on a DST transition day → wall-clock time preserved
- [ ] Skip one occurrence → the next one is untouched; the series end date is untouched
- [ ] Undo of confirm/cover → balance AND due dates return to the pre-action state (pair with `money-rules`)

## Checklist before leaving this skill

- [ ] Identified which of the two systems you're in; PM Schedule docs read if occurrence actions touched
- [ ] No new expansion path introduced; reused the existing engine for that surface
- [ ] Exactly-once argument written down (what dedupes, what's idempotent)
- [ ] Relevant scenarios from the list above verified; money impact routed through `money-rules`
