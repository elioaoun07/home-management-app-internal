---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 0b0588f (application source identical to 22152c2). 'Today' rows are CURRENT IMPLEMENTATION; everything else is PROPOSED DESIGN. People, amounts and dates are fictional (household: Maya and Sami, zone Asia/Beirut, November 2026)."
---

# ERA Trigger Catalogue

[README](README.md) · [Proactive Assistance](PROACTIVE-ASSISTANCE.md) · **Trigger Catalogue** · [Attention Rules](ATTENTION-RULES.md) · [Evaluation Scenarios](EVALUATION-SCENARIOS.md)

Twelve situations where speaking first has concrete value, each with trigger, evidence, timing, benefit, controls, silence conditions, completion, a positive example and a do-nothing counterexample. Levels, waves and foundations (`F-n`) are defined in [PROACTIVE-ASSISTANCE](PROACTIVE-ASSISTANCE.md#6-initial-scope-recommendation); rule IDs (`AR-n`) in [ATTENTION-RULES](ATTENTION-RULES.md).

## Overview

| ID | Situation | Modules | Ceiling | Wave | Needs |
|---|---|---|---|---|---|
| P-01 | Bill due, paying account short | Recurring, Accounts, Transfers | Prepare | W2 | F-1–F-5 |
| P-02 | Manual recurring payment due, not logged | Recurring, Transactions, Drafts | Prepare | W2 | F-1–F-4, F-8 |
| P-03 | Drafts waiting | Drafts, Transactions | Prepare | **W1** | — |
| P-04 | Envelope running ahead of the period | Budget Allocation, Transactions, Preferences | Notify | W2 | F-1–F-5 |
| P-05 | Overdue pile-up → weekly review | Schedule, Chores | Prepare | **W1** | — |
| P-06 | Leave-by for an event at a saved place | Schedule, Catalogue Places | Notify (time-sensitive) | W3 | F-1–F-3, F-7, F-9 |
| P-07 | Workout slot collides with a new event | Fitness, Schedule | Prepare | W2 | Fitness read adapter, F-4 |
| P-08 | Planned meal missing ingredients | Meal Planning, Recipes, Shopping | Execute (standing rule) | **W1** (Prepare), W3 (Execute) | — / F-10 |
| P-09 | Allergen in a planned meal | Meal Planning, Recipes, Healthcare | Notify + Prepare | **W1** | F-6 for "unchecked" |
| P-10 | Medication course ending, vaccine due | Healthcare | Prepare | W2 | F-1–F-4 |
| P-11 | Trip readiness and what falls inside the trip | Trips, Schedule, Chores, Meal Planning | Prepare (Execute after DEC-04) | W2 | Trip read adapter, F-4, F-11 |
| P-12 | Maintenance or renewal due | Catalogue, Schedule | Prepare | **W1** | — |

Common to all: the recipient is the responsible person for the subject; partner-private sources never appear (AR-11); every card has a resolving destination from the registry allowlist (`src/lib/notifications/registry.tsx:92-103`) or a registered action; text follows Hard Rule 28.

---

### P-01 · Bill due, paying account short

| Field | Definition |
|---|---|
| **Trigger** | Active `recurring_payments` row with `next_due_date` within 3 local days, and the projected balance of its `account_id` on that date (current balance − other active dues on the same account before it) is below `amount` |
| **Evidence** | `recurring_payments` (`amount`, `account_id`, `next_due_date`, `is_active`, `is_private`, `payment_method`); `account_balances.balance` and `balance_set_at` ≤ 7 days old (AR-2); same currency for account and payment (DEC-20); other dues on the account; canonical period/balance semantics (F-5) |
| **Timing** | Briefing on D−3; one push on D−1 at 10:00 only if still short; held through quiet hours; expires at the end of the due date |
| **Benefit** | Avoids a failed or overdrawn payment; the transfer is ready |
| **User controls** | Mute per payment; lead days 1/3/7; glance-only |
| **Silent when** | Balance older than 7 days (glance says `Wallet balance from 20 Sep [Update]` instead, no shortfall claim) · currencies differ · payment private and recipient is not its owner · account is the partner's private account · a transfer into the account since detection covers it · recurring read or balance read unavailable |
| **Completion** | *acted*: transfer confirmed (Artifact) · *resolved*: balance now covers it or `next_due_date` advanced · *dismissed* · *expired* after the due date |
| **Positive** | Wed 4 Nov (D−3): Internet $45 due Sat 7 Nov from Wallet; Wallet $25 (set 3 Nov), Drawer $310. Briefing: `Internet $45 · Sat · Wallet short $20 [Move $20 from Drawer]` → transfer card → Confirm. Still short on Fri 6 Nov → one push at 10:00 |
| **Do nothing** | Same bill, Wallet balance last set 20 Sep → no "short" claim; only the stale-balance line |
| **Today** | `bill_due` type has no producer (D18); no projection; native transfer with Confirm exists |

### P-02 · Manual recurring payment due, not logged

| Field | Definition |
|---|---|
| **Trigger** | `payment_method = 'manual'`, `next_due_date` ≤ local today, `last_processed_date` < `next_due_date` |
| **Evidence** | The recurring row; transactions in [due − 3 days, today] on the same account with the same category and amount ±5 % (candidates); open drafts. No direct transaction↔recurring link exists in `transactions`, so "already logged" is a match, not a fact (F-8) |
| **Timing** | Glance from the evening of the due date; briefing next morning; one follow-up after 2 days; expires when `next_due_date` advances or after 7 days |
| **Benefit** | Balances stay right; prevents the double post the current confirm path allows (M2, 19-business-rules) |
| **User controls** | Mute per payment; switch to auto (existing field) |
| **Silent when** | A candidate transaction exists → ask `Is this Gym? [Yes] [No]` once instead of preparing a second entry · `payment_method = 'auto'` (whether any auto-post runs is UNKNOWN, Q-05) · private and not the owner |
| **Completion** | *acted*: logged through the existing recurring confirm (draft → confirm) · *resolved*: processed elsewhere · *dismissed* with "Paid already" → opens Recurring to mark it |
| **Positive** | Gym $30 due Mon 2 Nov, nothing matching by Wed → `Gym $30 · due Mon [Log] [Paid already]` |
| **Do nothing** | Sami logged "Gym 30" from Wallet on Sun 1 Nov → one "Is this Gym?" question; if unanswered, nothing more; never a second draft |
| **Today** | Recurring confirm exists; the Feature Map's auto-post cron is not among the six cron routes |

### P-03 · Drafts waiting

| Field | Definition |
|---|---|
| **Trigger** | At least one own draft (`transactions.is_draft`, not deleted) older than 48 h, or three or more drafts |
| **Evidence** | `draft.list` registered capability; `inserted_at`; amounts. Own drafts only |
| **Timing** | Glance whenever ERA opens; briefing line in W2; never push |
| **Benefit** | Drafts do not silently stay out of balances |
| **User controls** | Mute; age threshold |
| **Silent when** | Drafts younger than 48 h and fewer than three · draft read unavailable (no "0 drafts") |
| **Completion** | *resolved* when no qualifying drafts remain (reviewed in Drafts) · *dismissed* → returns after a new draft or 7 days |
| **Positive** | 3 drafts, $72, oldest Sat → `3 drafts · $72 · oldest Sat [Review]` |
| **Do nothing** | One voice draft created 10 minutes ago |
| **Today** | Data and capability exist; no card |

### P-04 · Envelope running ahead of the period

| Field | Definition |
|---|---|
| **Trigger** | Category spend in the current custom period ≥ 80 % of its allocation while ≤ 60 % of the period has passed; separately ≥ 100 % |
| **Evidence** | `budget_allocations` (`category_id`, `account_id`, `monthly_budget`, `assigned_to`, `budget_month`); `spend.month` for that category and scope; period from `user_preferences.date_start`. `budget_month` is a `YYYY-MM` text while periods are custom; which allocation applies to a period that spans two months must be defined first (F-5) |
| **Timing** | Once per category per period at 80 %, once at 100 %; briefing/glance; no push by default; 80 % suppressed when fewer than 5 days remain |
| **Benefit** | A mid-period adjustment while it can still change the outcome |
| **User controls** | Mute per category; thresholds |
| **Silent when** | No allocation or zero · period mapping undefined · envelope assigned to the partner (goes to the assignee only) |
| **Completion** | *acted*: Open / Got it · *resolved*: new period · *dismissed* → returns only at 100 % |
| **Positive** | Groceries $400; $344 spent by 4 Nov in the 25 Oct–24 Nov period (11 of 31 days) → `Groceries 86 % · 20 days left [Open]` |
| **Do nothing** | Entertainment $45 of $50 on 22 Nov, two days before the period ends |
| **Today** | `budget_warning`/`budget_exceeded` typed without producer; settings toggle exists for `budget_warning` |

### P-05 · Overdue pile-up → weekly review

| Field | Definition |
|---|---|
| **Trigger** | At the person's review time (default Sun 18:00) or first ERA open after it: five or more own open items overdue by more than 2 days, or any item overdue by more than 14 days |
| **Evidence** | Own open items and occurrences through Schedule's canonical agenda (SCH-8) so recurring occurrences count once; `responsible_user_id`; excluded: dormant prerequisite items, occurrences covered by trip skips |
| **Timing** | Weekly; replaces the nightly overdue push if the owner chooses (PD-6) |
| **Benefit** | A stale list gets cleared in one sitting instead of a nightly reminder of guilt |
| **User controls** | Day/time; threshold; mute |
| **Silent when** | Below threshold · active trip (defer to the day after return) · `day_plans.intent = rest` that day (defer one day) |
| **Completion** | Review list with `[Done] [Tomorrow] [Drop]` per row through Schedule's occurrence contracts with Undo; *acted* when every row is handled; *dismissed* ("Later"); *resolved* when below threshold |
| **Positive** | Sun 8 Nov 18:00, 7 overdue, oldest 19 days → `7 overdue [Review]` |
| **Do nothing** | Four items one day overdue after a busy Friday |
| **Today** | `daily-items-reminder` sends the same evening overdue summary daily; bulk completion exists (`src/features/items/bulkComplete.ts`) |

### P-06 · Leave-by for an event at a saved place

| Field | Definition |
|---|---|
| **Trigger** | Own event with `metadata_json.place_id` (HUB-94) whose place has travel minutes; now = start − travel − 10 min buffer |
| **Evidence** | Event start re-read at send time; occurrence not cancelled/skipped/completed; place travel minutes (F-7); recipient = responsible person |
| **Timing** | One time-sensitive push at the leave time. If the leave time falls in quiet hours, the evening briefing before says `Tomorrow · leave 06:40 · Dentist` instead, unless the person turned on "Leave-by may wake me". If delivery would be more than 5 minutes after the leave time, it expires (AR-2) |
| **Benefit** | Arriving on time without mental arithmetic |
| **User controls** | Travel minutes per place; buffer; mute per place |
| **Silent when** | No place or no travel minutes · event created after its leave time · event moved/cancelled (recompute or close) · the person is on a trip and the place is at home |
| **Completion** | *acted* = delivered (informational) · *resolved* = event moved or cancelled before the leave time |
| **Positive** | Dinner at Parents' house Fri 20:00, travel 35 min → 19:15 `Leave now · Parents' house · 20:00` |
| **Do nothing** | "Call with Joe" with no place; or an event created at 19:20 for 20:00 |
| **Today** | Places and `place_id` exist; travel minutes do not; no geofencing by decision |

### P-07 · Workout slot collides with a new event

| Field | Definition |
|---|---|
| **Trigger** | A new or moved event overlaps by ≥ 15 minutes a slot occurrence of the same person's active fitness plan within the next 7 days |
| **Evidence** | `fitness_plans` active; no `fitness_plan_pauses` covering the date; slot item occurrence (`fitness_plan_slots.item_id`); event times; a Fitness read adapter (none is registered for ERA today) |
| **Timing** | Next glance after the overlap appears; that day's briefing; no push |
| **Benefit** | Keeps the plan without manual juggling |
| **User controls** | Mute; default "skip instead of move" |
| **Silent when** | Plan paused · all-day or flexible event · slot already done or skipped · trip covers the date |
| **Completion** | *acted*: slot moved or skipped through Fitness's own operation with Undo · *resolved*: event moved · *dismissed* |
| **Positive** | Tue 10 Nov 18:00 "Upper body"; Maya adds "Parent meeting 17:30–19:00" → `Upper body clashes with Parent meeting [Wed 18:00] [Skip]` |
| **Do nothing** | The plan is paused this week |
| **Today** | Fitness module shipped 2026-10-12; no ERA reach |

### P-08 · Planned meal missing ingredients

| Field | Definition |
|---|---|
| **Trigger** | `meal_plans` row for tomorrow or the day after with `status = 'planned'`, and recipe ingredients that are not on the household's open shopping rows |
| **Evidence** | Meal plan, the recipe's real ingredients (`recipe.ingredients`), open shopping rows (`shopping.list`), servings. Pantry stock is not subtracted (DEC-17, Archived study exclusions); the card may say "may have some" |
| **Timing** | Day before at 17:00 (glance; briefing in W2); expires at the meal date |
| **Benefit** | Ingredients get bought in the usual shop |
| **User controls** | Lead time; mute per recipe; **"Always add"** standing rule (Execute, W3) |
| **Silent when** | Status `shopping_added`, `cooked` or `skipped` · nothing missing · shopping read unavailable (card says `Can't check list`, never "nothing missing") |
| **Completion** | *acted*: items added (Artifact, Undo) · *resolved*: someone added them or status changed · *expired* after the meal date |
| **Positive** | Fri dinner Mujaddara for 4; lentils, rice and onions missing → Thu 17:00 `Fri · Mujaddara · 3 missing [Add] [Edit]` → `Added 3 [Undo]`. With "Always add": `Added 3 · Fri dinner [Undo]` in the next glance, no question |
| **Do nothing** | Sami added the same three items by hand at 16:50 |
| **Today** | Registered `recipe.ingredients`, `shopping.list`, `shopping.add`, `meal.assign`; `mealPlanGaps` query intent |

### P-09 · Allergen in a planned meal

| Field | Definition |
|---|---|
| **Trigger** | A meal planned within 7 days whose recipe **ingredients** (not title) match an allergen keyword of a household profile from `get_household_allergens()` |
| **Evidence** | Allergen feed with availability (F-6), ingredients, `keywords`, `severity` |
| **Timing** | Next glance after planning; day before if unresolved and severity is severe or anaphylaxis (W2, push held to 08:00) |
| **Benefit** | Safety, at the moment the plan can still change |
| **User controls** | Per meal "substitute used" (recorded reason); severe/anaphylaxis cannot be muted type-wide |
| **Silent when** | No match · meal skipped or cooked · ingredient removed. **Not silent when the feed is unavailable:** glance shows `Allergies unchecked` (no push) |
| **Completion** | *acted*: recipe swapped or ingredient edited · *dismissed* with reason for this meal only · *resolved* |
| **Positive** | Fri Pad Thai; profile Lina, peanuts, severe → `Pad Thai has peanuts · Lina (severe) [Swap] [Edit]` |
| **Do nothing** | "Peanut-free satay" whose ingredients contain no peanuts |
| **Today** | Recipe pages warn (`RecipeAllergenWarning.tsx`, `useHouseholdAllergens.ts`); ERA does not |

### P-10 · Medication course ending, vaccine due

| Field | Definition |
|---|---|
| **Trigger** | `health_medications` with `mode = 'course'` and `ends_at` within 2 days; or `health_vaccines.next_due_on` within 30 days with no Schedule item for it |
| **Evidence** | Medication/vaccine rows, `managing_user_id`, profile. No supply or refill data exists; depletion is not inferred |
| **Timing** | Course: D−2 briefing. Vaccine: D−30 glance, D−7 briefing |
| **Benefit** | No accidental gap in a course that should continue; no missed booster |
| **User controls** | Mute per profile |
| **Silent when** | `as_needed` mode · `ends_at` already extended · recipient is not the managing user (clinical privacy; the partner never sees it) |
| **Completion** | Course: `[Continue]` opens Healthcare edit prefilled; `[Done]` acknowledges → *resolved*; *expired* after `ends_at`. Vaccine: `[Remind me]` creates a reminder (Artifact) → *acted* |
| **Positive** | Profile "Maya", amoxicillin ends Fri → Wed briefing `Amoxicillin ends Fri [Continue] [Done]` |
| **Do nothing** | A PRN painkiller with no end date |
| **Today** | Dose reminders are Schedule items fired by `item-reminders` (`src/app/api/healthcare/medications/route.ts:19, 42`); nothing looks at course end or vaccines |

### P-11 · Trip readiness and what falls inside the trip

| Field | Definition |
|---|---|
| **Trigger** | Trip (not a template, not archived) starting in 3 local days; readiness gaps or own items, chores, meal plans or manual recurring dues inside [start, end] not covered by `trip_side_effects` |
| **Evidence** | `trips` (`scope`, dates, `account_id`); `trip_packing_items` unpacked and assigned to me; `trip_documents.expires_on` before `end_date`; items/chores/meal plans in the window; a trip read adapter (none registered) |
| **Timing** | D−3 briefing; D−1 glance; expires at start |
| **Benefit** | Nothing forgotten; chores and reminders do not fire abroad (19-business-rules: today they do) |
| **User controls** | Mute per trip; lead days |
| **Silent when** | No gaps and nothing in the window (no "all set" push; a glance tick only) · solo trip of the partner · trip without dates |
| **Completion** | Card with lines `[Pack] [Skip] [Reassign]`; each line resolves through its module; card *acted* when all lines are handled, *expired* at departure. Execute only through the trip activation cascade once DEC-04 is decided |
| **Positive** | Lisbon Thu 12–Mon 16 Nov, household. Mon 9 Nov: `Lisbon Thu · 12 unpacked · 2 chores + Gym $30 during trip [Review]` |
| **Do nothing** | A draft trip with no dates; a passport that expires in 2027 |
| **Today** | Data exists; cascade records exist; reversal policy open |

### P-12 · Maintenance or renewal due

| Field | Definition |
|---|---|
| **Trigger** | Own Catalogue item with `next_due_date` within 14 days, active, not completed for this cycle, with no Schedule item for that date |
| **Evidence** | `catalogue_items` (`next_due_date`, `last_completed_at`, `status`, `archived_at`, `deleted_at`, `recurrence_pattern`); private by default |
| **Timing** | D−14 glance; D−3 briefing; expires at due + 7 (then it joins P-05's review) |
| **Benefit** | Insurance, service and renewals with booking lead time |
| **User controls** | Lead time; mute per item |
| **Silent when** | Archived or deleted · a reminder already exists · completed this cycle |
| **Completion** | *acted*: reminder created (Artifact) or marked done in Catalogue · *resolved*: `next_due_date` advanced |
| **Positive** | "Car insurance" due 18 Nov → 4 Nov glance `Car insurance · 18 Nov [Remind me] [Done]` |
| **Do nothing** | "AC filter" archived after the AC was replaced |
| **Today** | Field exists; no consumer in ERA |

---

## Considered and not recommended

These are counterexamples at the situation level: ERA should do nothing.

| Idea | Why not |
|---|---|
| Chase a debtor or flag "debt overdue" | `debts` has no due date or promise; archived ≠ settled; outward contact is excluded |
| Add low-stock items automatically | DEC-03 open; `inventory_stock.estimated_runout_date` is an estimate, not an observation |
| Suggest outfits from the weather | No weather source in the repo; Outfits has no ERA reach |
| Birthday or "haven't seen X" nudges | No birthday field on contacts (ERA Learns Your World §2 is a proposal) |
| Summarise household chat into tasks | Private conversation is not consent to create obligations (Archived study exclusions) |
| "Great job logging today!" push | No decision exists; the current cron sends it (`daily-reminder/route.ts:250-252, 336-356`); PD-5 |
| Anomaly pushes ("you spent more on Tuesday") | Anomaly is not actionability |
| "Safe to spend" figure | Competing claims and unknown funding make it unsupportable (Archived study) |
| "You're home, start the laundry" | Geofencing excluded (D2, Top Layer §6) |
| Tell one partner about the other's spending or health | Privacy; partner-private sources never cross (AR-11) |
