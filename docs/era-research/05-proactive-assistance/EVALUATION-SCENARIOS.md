---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 0b0588f (application source identical to 22152c2). PROPOSED evaluation set; nothing here was executed. All people, records, amounts and dates are fictional (Maya and Sami, Asia/Beirut, autumn 2026)."
---

# ERA Proactive Evaluation Scenarios

[README](README.md) · [Proactive Assistance](PROACTIVE-ASSISTANCE.md) · [Trigger Catalogue](TRIGGER-CATALOGUE.md) · [Attention Rules](ATTENTION-RULES.md) · **Evaluation Scenarios**

A scenario set for judging any proactive implementation before it reaches a phone. A third of the scenarios expect **silence**; an evaluator that passes the positive cases and fails those is not acceptable.

## 1. How to run without live automations

- **Pure evaluator.** `evaluate(sourceSnapshot, situationRecords, clock, recipient) → { situations, deliveries }`, a function with no I/O. Fixtures are JSON snapshots of the tables named in each scenario.
- **Simulated clock** in `Asia/Beirut`, with explicit instants; DST cases use IANA rules (Beirut moved from UTC+3 to UTC+2 on 25 Oct 2026).
- **Dry-run sink.** Deliveries are captured as records `{surface, class, key, revision, text, at}`; nothing is sent, no cron is registered, no `notifications` row is written.
- **No paid model.** D3 templates are deterministic, so no model call is needed; if model phrasing is ever added, it runs on replay only (Hard Rule 29).
- **Owner UAT later.** After W1 is built, the owner repeats the W1 scenarios on both phones with disposable data; results are recorded with the owning PM item, never inferred from this file.

## 2. Pass metrics

| Metric | Target | Measured on |
|---|---|---|
| Silence correctness | 100 % of "silence" scenarios produce zero deliveries | EV marked **S** |
| Duplicate deliveries | 0 per (key, revision, recipient, surface) | AR-1 scenarios |
| Stale claims | 0 claims built on evidence older than its limit | AR-2 scenarios |
| Late deliveries | 0 after `useful_until` | AR-2d, AR-16 |
| Quiet-hour and budget violations | 0 | AR-7, AR-8 |
| Privacy leaks | 0 partner-private facts in another person's deliveries | AR-11 |
| Terminal state | Every situation ends in exactly one terminal state with a reason | Lifecycle scenarios |
| Precision (owner-labelled, UAT only) | Reported per type; no target until W1 data exists | UAT |

## 3. Scenarios

**S** = silence expected. Rule IDs point to [ATTENTION-RULES](ATTENTION-RULES.md); P-IDs to the [Trigger Catalogue](TRIGGER-CATALOGUE.md).

### 3.1 Positive behaviour

| ID | Situation | Setup and clock | Expected | Rules |
|---|---|---|---|---|
| EV-01 | P-01 | Internet $45 due Sat 7 Nov from Wallet; Wallet $25 set 3 Nov; Drawer $310. Clock Wed 4 Nov 08:00 | Briefing line `Internet $45 · Sat · Wallet short $20 [Move $20 from Drawer]`; the action opens a transfer card that needs Confirm | Gates 1–6, AR-12c |
| EV-02 | P-01 follow-up | EV-01 unanswered; Fri 6 Nov 10:00, still short | One push, same key, revision 1; text says `Internet $45 tomorrow · Wallet short $20` | AR-3a, AR-5b |
| EV-03 | P-03 | 3 drafts $72, oldest Sat 31 Oct; Maya opens ERA Wed 4 Nov | Glance `3 drafts · $72 · oldest Sat [Review]`; no push | AR-6 |
| EV-04 | P-05 | Sun 8 Nov 18:00; 7 overdue, oldest 19 days | Glance/briefing `7 overdue [Review]`; review rows act through Schedule contracts with Undo | AR-13 |
| EV-05 | P-08 | Fri 6 Nov dinner Mujaddara for 4 (`planned`); lentils, rice, onions not on list. Thu 5 Nov 17:00 | `Fri · Mujaddara · 3 missing [Add] [Edit]`; Add → `Added 3 [Undo]`, Artifact recorded | AR-13a |
| EV-06 | P-08 Execute | As EV-05 with Maya's "Always add" rule | Items added without a question; next glance `Added 3 · Fri dinner [Undo]` | AR-12b |
| EV-07 | P-09 | Fri Pad Thai planned; profile Lina, peanuts, severe | Glance `Pad Thai has peanuts · Lina (severe) [Swap] [Edit]`; day-before check if unresolved | AR-9a |
| EV-08 | P-10 | Profile Maya, amoxicillin course ends Fri 6 Nov; Wed 4 Nov briefing | `Amoxicillin ends Fri [Continue] [Done]` to Maya only | AR-11b |
| EV-09 | P-11 | Lisbon Thu 12–Mon 16 Nov, household; 12 unpacked; two chores and Gym $30 inside the window; Mon 9 Nov | `Lisbon Thu · 12 unpacked · 2 chores + Gym $30 during trip [Review]` | AR-10c |
| EV-10 | P-12 | "Car insurance" `next_due_date` Wed 18 Nov; Wed 4 Nov | Glance `Car insurance · 18 Nov [Remind me] [Done]` | — |
| EV-11 | P-06 | Dinner at Parents' house Fri 6 Nov 20:00, travel 35 min | 19:15 time-sensitive push `Leave now · Parents' house · 20:00` | AR-6 |
| EV-12 | P-07 | Tue 10 Nov 18:00 "Upper body"; Maya adds "Parent meeting 17:30–19:00" | `Upper body clashes with Parent meeting [Wed 18:00] [Skip]` | — |

### 3.2 Duplicates and repeated events

| ID | Situation | Setup and clock | Expected | Rules |
|---|---|---|---|---|
| EV-13 | Overlapping runs | Two evaluator runs at 10:00:00 and 10:00:20 both see EV-02 | Exactly one push; the second run hits the claim conflict | AR-1b |
| EV-14 **S** | Re-detection | EV-01 delivered; the 13:00 evaluation sees the same shortfall | No new delivery; revision unchanged | AR-1a |
| EV-15 | Material change | After EV-01, a $40 phone bill is added to Wallet due Sat | One card replaces EV-01: `Wallet short $60 · 2 bills [Move]`; push tag replaced, no second alert | AR-1d, AR-1f |
| EV-16 | Double tap | Maya taps Add twice on EV-05 | One shopping write, one Artifact | AR-1g |
| EV-17 **S** | One producer per fact | P-10 sees today's 08:00 dose item for the same medication | P-10 does not mention the dose; the Schedule alert stays the only dose notice | AR-1c |
| EV-18 **S** | Unchanged summary | Evening overdue summary identical to yesterday's | Not sent | AR-5d |

### 3.3 Stale, resolved, ignored and dismissed

| ID | Situation | Setup and clock | Expected | Rules |
|---|---|---|---|---|
| EV-19 | Stale balance | EV-01 but Wallet `balance_set_at` 20 Sep | No shortfall claim; glance `Wallet balance from 20 Sep [Update]` only | AR-2b |
| EV-20 **S** | Late delivery | Scheduler down 18:00–19:30 Fri; EV-11's leave time was 19:15 | At 19:30 the leave-by expires; nothing is sent | AR-2d |
| EV-21 **S** | Resolved before delivery | EV-05 detected 16:30; Sami adds the three items at 16:50; delivery due 17:00 | Re-check at delivery → *resolved*; nothing shown | AR-2c, AR-4a |
| EV-22 | Resolved after delivery | EV-02 pushed; Maya pays and logs at 11:00 | The device notification is replaced silently/closed; card gone; no "paid" push | AR-4b, AR-4c |
| EV-23 | Ignored | EV-04 seen Sun, no action | Nothing until next Sunday's evaluation; no mid-week nag | AR-3a |
| EV-24 | Dismissed then worse | P-04 Groceries 86 % dismissed Wed; reaches 102 % Sat | One 100 % notice Sat; nothing between | AR-3b |
| EV-25 | Repeated dismissals | P-03 dismissed Oct 12, Oct 20, Oct 28 | On the next occurrence: `Keep these? [Yes] [Mute]` once; type moves to glance-only | AR-3c |
| EV-26 **S** | Snooze resolved | P-12 snoozed to Mon; Maya marks it done in Catalogue Sat | Mon: re-evaluated first → resolved; nothing reappears | AR-3e |
| EV-27 **S** | Dismissed row recreated | EV-10 dismissed; next evaluation | No new card even though the in-app route's dedupe ignores dismissed rows | AR-3f |

### 3.4 Quiet hours, budget and priorities

| ID | Situation | Setup and clock | Expected | Rules |
|---|---|---|---|---|
| EV-28 | Quiet hours hold | P-09 severe detected Thu 22:40 for Fri lunch | Held; delivered Fri 08:00 local | AR-7b |
| EV-29 | DST | ERA item held from Sat 24 Oct 22:30 (UTC+3) | Delivered Sun 25 Oct 08:00 local = 06:00Z, not 05:00Z | AR-7a |
| EV-30 | Early leave-by | Dentist Fri 07:30, travel 40 min → leave 06:40 (quiet) | No 06:40 push; Thu evening briefing `Tomorrow · leave 06:40 · Dentist` | AR-7b |
| EV-31 | User alert in quiet hours | Maya's own reminder at 22:00 | Fires at 22:00 (PD-1 recommendation); not counted in the budget | AR-7c, AR-8b |
| EV-32 | Budget overflow | Four ERA pushes qualify for Maya on Fri | Three sent ≥ 2 h apart; the fourth goes to the next glance or expires | AR-8a |
| EV-33 | Competing resource | EV-01 and Groceries at 86 % on Drawer | One card offering Drawer or Savings with `Groceries 86 %` beside Drawer | AR-9c |
| EV-34 | Bundling | P-01 push due 10:00, P-09 day-before at 11:00 | One push at 10:00 carrying both lines, safety first | AR-9a, AR-9d |

### 3.5 Changed circumstances, privacy, failure

| ID | Situation | Setup and clock | Expected | Rules |
|---|---|---|---|---|
| EV-35 **S** | Trip | Maya in Lisbon 12–16 Nov; home event at Parents' house on Sat 14 | No leave-by; P-05 waits until Tue 17 | AR-10c |
| EV-36 **S** | Rest day | `day_plans.intent = rest` Sat; P-12 and P-03 qualify | Nothing that day; both evaluate Sun | AR-10d |
| EV-37 | Rest day, safety | Same Saturday, P-09 severe for Sat dinner | Delivered (safety passes the rest-day rule) | AR-10d |
| EV-38 **S** | Unlink | Household link deactivated Tue; P-08 for a shared meal planned by Sami | Maya receives nothing about Sami's meal | AR-10e, AR-11 |
| EV-39 **S** (for Maya) | Private payment | Sami's `is_private` subscription would leave Sami's Wallet short on Sat | Maya receives nothing (no content, count or hint); Sami receives P-01 as in EV-01 | AR-11b |
| EV-40 **S** | Partner health | Maya's medication course ending | Sami receives nothing, not even a count | AR-11b |
| EV-41 | Allergen feed down | `get_household_allergens()` times out; P-09 candidate | Glance `Allergies unchecked`; no push; never "safe" | AR-15b |
| EV-42 **S** | Evaluator failed | Run errored half-way | No deliveries; ledger records failure; no "all clear" | AR-15a |
| EV-43 | Partial plan action | P-11 review: skip chore succeeds, reassign reminder fails | Chore line *acted* with Undo; reminder line `Didn't go through [Retry]`; card stays open | PROACTIVE-ASSISTANCE §5.2 (failed) |
| EV-44 | Unknown outcome | P-08 Add times out | Line shows `Check [Open]`; no automatic retry | PROACTIVE-ASSISTANCE §5.2 (uncertain) |
| EV-45a | Notice only (W1) | P-12 qualifies Mon; Maya does not open ERA until Thu | Situation recorded Mon with no delivery; shown on Thu's glance if still useful | PROACTIVE-ASSISTANCE §3 |
| EV-45b | Standing rule revoked | EV-06's "Always add" revoked Wed; a qualifying meal Thu | Back to Prepare: `[Add] [Edit]` card, nothing added | AR-12b |

### 3.6 Counterexamples (ERA should do nothing)

| ID | Situation | Why silence is right |
|---|---|---|
| EV-45 **S** | Maya logged two spends by 09:00; 18:00 logging slot | Nothing to do (today's cron would push "Great job logging today!") |
| EV-46 **S** | Entertainment $45 of $50 on Sun 22 Nov, period ends Tue 24 | No decision left that changes the outcome |
| EV-47 **S** | "Call with Joe" at 15:00, no place | No travel; nothing to prepare |
| EV-48 **S** | Gym $30 logged a day early; P-02 asked "Is this Gym?" once, no answer | No second question, no draft |
| EV-49 **S** | Debt "Rami $40" open 60 days | No due date exists; no chasing |
| EV-50 **S** | Low-stock estimate says rice runs out Fri | DEC-03 open; no automatic addition, no push |
| EV-51 **S** | "Peanut-free satay" planned | Ingredients contain no peanuts; title words are ignored |
| EV-52 **S** | Draft created by voice 10 minutes ago | Below threshold |

## 4. Fixture notes

- Each fixture lists the tables it snapshots, the clock, the recipient and the expected deliveries (empty list for **S**).
- Fixtures must not contain real names, amounts or dates from the household.
