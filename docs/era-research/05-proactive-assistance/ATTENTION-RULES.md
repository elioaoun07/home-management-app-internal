---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 0b0588f (application source identical to 22152c2). Rules are PROPOSED DESIGN; rows marked CURRENT describe code. Examples are fictional."
---

# ERA Attention Rules

[README](README.md) · [Proactive Assistance](PROACTIVE-ASSISTANCE.md) · [Trigger Catalogue](TRIGGER-CATALOGUE.md) · **Attention Rules** · [Evaluation Scenarios](EVALUATION-SCENARIOS.md)

When ERA may take a person's attention, how much, and when it must stay quiet. Rules are numbered `AR-n` and apply to every situation in the [Trigger Catalogue](TRIGGER-CATALOGUE.md). They extend, and do not replace, NOTIF-19 (recipient policy), NOTIF-21 (delivery claim), Top Layer D5/D6 and the memory rules in [04-memory-context CORRECTION-AND-EXPIRY-RULES](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md) (`CE-n`).

## 1. Decision order

Hard gates run before any ranking; a high rank never compensates for a failed gate. Adapted from the archived study "Proactive ERA — Silence, Trust & Intervention" (frozen 2026-09-06).

| Gate | Passes when | If it fails |
|---|---|---|
| 1 Recipient and purpose | Every input is permitted for this recipient and this use (AR-11) | Withhold; never a vague hint that leaks the cause |
| 2 Evidence | Each claim is reproducible from typed source fields read for this evaluation | No claim |
| 3 Freshness and coverage | Required sources are within their freshness limit and complete for the claim (AR-2) | Hold, show a "check" line, or stay silent; never substitute zero |
| 4 Actionability | At least one useful response remains in the window | Silent |
| 5 Novelty | Not already delivered, decided or muted for this key and revision (AR-1, AR-3) | Update the existing card silently, or nothing |
| 6 Timing and policy | Surface, class, quiet hours and budget allow it now (AR-6–AR-8) | Hold until allowed if still useful; otherwise expire |

## 2. Duplicates — AR-1

| # | Rule |
|---|---|
| AR-1a | **One situation per key** (`type : subject : period/occurrence : recipient`). Re-detection updates the evidence as a new *revision*; it never creates a second card or a second push. |
| AR-1b | **One delivery per (key, revision, recipient, surface)**, enforced by a unique claim (NOTIF-21 / F-3). An overlapping cron run, a retry or a second tick gets a conflict and does nothing. Until F-3 exists, ERA-originated push stays off. CURRENT: `item-reminders` inserts, pushes and then stamps `last_fired_at` with no claim (`src/app/api/cron/item-reminders/route.ts:330-392`); the in-app route checks then inserts (`src/app/api/notifications/in-app/route.ts:269-284`). |
| AR-1c | **One producer per fact.** A fact that already has an owner is not re-announced: dose reminders are Schedule items (P-10 never repeats a dose); if the weekly review (P-05) is on, the nightly overdue summary drops the same items that week. |
| AR-1d | **Cluster subjects that share one decision.** Three bills short on Wallet → `Wallet short $65 · 3 bills [Move]`, one card, one key per account and date. |
| AR-1e | **Household duplicates.** A shared subject has one recipient (AR-11); the partner does not get a parallel card for the same meal, chore or trip line. |
| AR-1f | **Device duplicates.** The push `tag` is the situation key, so a later revision replaces the earlier one on the device without a second alert (MDN `showNotification` `tag`/`renotify`). |
| AR-1g | **Action duplicates.** Each card action carries `key + revision` as its idempotency key; a double tap yields one effect (CURRENT precedent: confirmation consumed once, HUB-103). |

## 3. Stale data and late delivery — AR-2

| # | Rule |
|---|---|
| AR-2a | **Every evidence item carries `as_of`.** Limits: account balance `balance_set_at` ≤ 7 days; schedule, meal, shopping, allergen and health reads are taken in the same evaluation; Catalogue due dates in the same evaluation. |
| AR-2b | **Stale required evidence removes the claim.** The card becomes a "check" line on glance (`Wallet balance from 20 Sep [Update]`) or nothing. A money push is never sent from stale facts. |
| AR-2c | **Re-check at delivery.** Evidence is re-read immediately before notifying, because detection and delivery can be hours apart (quiet hours, budget). |
| AR-2d | **Late means expired.** If `now > useful_until`, the situation expires silently. A leave-by push more than 5 minutes late is never sent. This is the opposite of today's 12-hour look-back for user alerts (`item-reminders/route.ts:93-98`), which stays as it is for user-created alerts until the owner decides otherwise (19-business-rules S10). |
| AR-2e | **No evaluation from device caches.** The persisted query cache (up to 7 days, `src/app/providers.tsx:147-165`) and the service-worker cache never feed a situation. Offline glance shows no situation cards rather than cached ones. |

## 4. Ignored, dismissed and resolved — AR-3, AR-4

| # | Rule |
|---|---|
| AR-3a | **Ignored is not dismissed.** A card seen with no action gets at most one follow-up, at the type's next reconsideration point (§12), then expires. |
| AR-3b | **Dismissed closes this occurrence.** It returns only on a material change (§12) or a severity step (P-04 80 % → 100 %). |
| AR-3c | **Three dismissals of a type within 30 days** demote that type to glance-only and ask once: `Keep these? [Yes] [Mute]`. |
| AR-3d | **Muted stays muted** until un-muted in Settings; safety types (P-09 severe/anaphylaxis) cannot be muted type-wide, only per meal with a reason. |
| AR-3e | **Snooze** sets `snoozed_until` (CURRENT route `src/app/api/notifications/snooze/route.ts`); at that time the situation is re-evaluated first, so a resolved one never reappears. |
| AR-3f | **The evaluator reads dismissed rows.** CURRENT in-app dedupe ignores dismissed rows (`.eq("is_dismissed", false)`), which would recreate a dismissed card; ERA's evaluator must check every row with the key. |
| AR-4a | **Resolution is re-checked at every evaluation and before delivery.** Resolved by any path or person (Sami added the ingredients) → state *resolved*, card removed. |
| AR-4b | **Delivered pushes are corrected, not followed up.** A resolved or superseded situation replaces its notification silently via the same tag, or closes it; no "never mind" push. |
| AR-4c | **No congratulation pushes.** Resolution is never announced (counterexample: today's "Great job logging today!"). |
| AR-4d | **Unknown resolution** (read unavailable) keeps the card open but blocks escalation and follow-ups. |

## 5. Repeated reminders — AR-5

| # | Rule |
|---|---|
| AR-5a | **The person's own alerts are commitments.** ERA neither suppresses nor repeats user-created `scheduled` alerts (registry class, `src/lib/notifications/registry.tsx:54`), including `repeat_every_minutes` alerts the person configured. |
| AR-5b | **ERA-originated situations get one follow-up at most** per occurrence (P-09 severe: the day-before check). No escalation ladders, no "second reminder" copy. |
| AR-5c | **A recurring situation is a new occurrence each period.** Three consecutive dismissed occurrences trigger AR-3c. |
| AR-5d | **Unchanged summaries are not resent.** A daily summary whose content is identical to the previous day's and has no new item is skipped (applies to the evening overdue summary if kept, PD-6). |

## 6. Quiet hours and interruption budget

| # | Rule |
|---|---|
| AR-6 | **Smallest sufficient surface:** glance < in-thread < briefing < bell < push < time-sensitive push ([PROACTIVE-ASSISTANCE §4](PROACTIVE-ASSISTANCE.md#4-surfaces-from-least-to-most-intrusive)). Push only when a decision is needed before the person is likely to open ERA; with no usage data in the repo, the default is push only for useful windows under 24 h, from W2 on. |
| AR-7a | **Quiet hours 21:00–08:00 Asia/Beirut** (D5/D6), or the recipient's `quiet_start`/`quiet_end` once NOTIF-19 reads them (CURRENT: stored and ignored). Evaluated in the recipient's zone (F-9; until then `notification_preferences.timezone`, else Asia/Beirut), by IANA rules so DST shifts are honoured. |
| AR-7b | **During quiet hours ERA-originated items are held** to the end of quiet hours if still useful, otherwise expire. Time-sensitive ERA items are moved earlier instead (P-06: the evening briefing names tomorrow's early leave time). |
| AR-7c | **User-scheduled alerts fire at the time the person chose** (PD-1 recommendation). |
| AR-8a | **At most three ERA-originated pushes per person per local day** (D5/D6) and at least 2 hours apart; the briefing counts as one. |
| AR-8b | **Overflow goes to the briefing or glance** if still useful, else expires. User-scheduled alerts are outside the budget (PD-2 recommendation). |

## 7. Conflicting priorities — AR-9

| # | Rule |
|---|---|
| AR-9a | **Order after the gates:** (1) safety (P-09, P-10; 04-memory-context CE-3), (2) money loss soon (P-01, P-02), (3) time-critical schedule (P-06), (4) preparation that saves effort (P-08, P-11, P-12, P-07), (5) hygiene (P-03, P-04, P-05). Mirrors Design Doctrine §5: correctness first, foresight later. |
| AR-9b | **Ties go to the earlier loss of an option.** |
| AR-9c | **Recommendations that compete for one resource are shown together.** If P-01 would move $20 from Drawer while P-04 shows Drawer's Groceries envelope at 86 %, the card offers both sources with the envelope noted, and recommends neither silently. |
| AR-9d | **Two pushes due within 2 hours are bundled** into the earlier one if both are still useful then. |
| AR-9e | **Each person's priorities are separate.** One partner's situation never pre-empts the other's budget. |

## 8. Changed circumstances — AR-10

| # | Rule |
|---|---|
| AR-10a | **Circumstance sources:** active or upcoming trip dates (`trips`), `day_plans.intent = rest`, fitness pauses, kept circumstances (04-memory-context Design A), household link changes, account archival. |
| AR-10b | **On change, re-evaluate every open situation for that person**; close those whose premise no longer holds. |
| AR-10c | **During a trip:** home-place leave-by and home-prep situations are silent; P-05 waits until the day after return; money situations (P-01, P-02) still apply; their timing zone follows PD-9. |
| AR-10d | **Rest day:** only safety and money-loss situations may notify; everything else waits a day. |
| AR-10e | **Household unlink:** situations built on partner data close immediately and are never delivered to the former partner. |
| AR-10f | **A kept circumstance expires on its date** (04-memory-context CE-11) and stops affecting attention at once. |

## 9. Recipients and privacy — AR-11

| # | Rule |
|---|---|
| AR-11a | **Recipient = the person responsible for the subject:** item `responsible_user_id` (else creator); meal plan creator or `for_user_id`; recurring payment owner; Healthcare `managing_user_id`; packing line `assigned_to`; chore assignee. Household-wide only where the source says so (`notify_all_household`, CURRENT `item-reminders/route.ts:288-316`). |
| AR-11b | **Private sources never cross.** `is_private` payments and transactions, non-public accounts, unshared health profiles: no content, count or hint reaches the other person. |
| AR-11c | **Partner eligibility** follows D5/D6 (after five owner mornings, their own hour and toggle) unless the owner changes it (PD-7). |

## 10. Levels, effects and receipts — AR-12, AR-13

| # | Rule |
|---|---|
| AR-12a | **Ceilings are fixed per type** ([catalogue overview](TRIGGER-CATALOGUE.md#overview)); ranking, models or feedback never raise them. |
| AR-12b | **Execute needs a standing rule** created by the person's tap, scoped to one type and subject set, revocable, listed in Settings, and recorded like a lexicon default (04-memory-context Design A). |
| AR-12c | **Execute never runs on partial or stale evidence**, never for money movement, recurrence/series edits, deletes, outward messages or partner-owned targets (Top Layer §5; HUB-54). |
| AR-13a | **Every Execute leaves an Artifact and Undo** (owner rule 2026-10-04) and appears in the next glance as a one-line receipt. |
| AR-13b | **Every card has a resolving destination** (registry route allowlist or a registered action) and every toast has Undo (Hard Rule 1). Notification dismiss/snooze Undo (NOTIF-5.6) is required before W2. |

## 11. Learning, failure and expiry — AR-14, AR-15, AR-16

| # | Rule |
|---|---|
| AR-14 | **Learn only from explicit outcomes** (acted, dismissed, muted, 👍/👎 under HUB-43). Opening or viewing is not evidence of value. Ranking by feedback (HUB-23) starts only after HUB-43 exists. |
| AR-15a | **Each evaluator run is recorded** (HUB-38 ledger); a run that failed produces no "all clear" and no notifications. |
| AR-15b | **Partial coverage caps the level** at Notice/glance and says what is missing. A read error is never "nothing found". |
| AR-16 | **Every situation has `useful_until`;** expiry is silent and final for that occurrence. |

## 12. Per-situation attention parameters

| ID | Class | Earliest | Useful until | Follow-ups | After dismissal, returns when | Material change |
|---|---|---|---|---|---|---|
| P-01 | info → urgent on D−1 | D−3 | End of due date | 1 (D−1) | Shortfall grows ≥ 25 % or ≥ $20 | Amount, due date or balance source |
| P-02 | info | Due date evening | Due + 7 d or advance | 1 (+2 d) | Never this occurrence | Candidate transaction appears/disappears |
| P-03 | digest | Draft 48 h old | While drafts remain | 0 | New draft or 7 days | Count or total changes |
| P-04 | info | 80 % threshold | Period end − 5 d (80 %), period end (100 %) | 0 | 100 % reached | Allocation changed |
| P-05 | digest | Review time | Next review time | 0 | Next week | Threshold crossed again |
| P-06 | time-sensitive | Leave time | Leave time + 5 min | 0 | n/a | Start time or place |
| P-07 | info | Overlap appears | Slot start | 0 | Event or slot moves | Overlap changes |
| P-08 | info | D−1 17:00 | Meal date end | 0 | Ingredients change | Recipe or servings |
| P-09 | urgent (severe) / info | Plan time | Meal time | 1 (D−1, severe) | Recipe or ingredients change | Allergen or recipe |
| P-10 | info | D−2 (course), D−30 (vaccine) | `ends_at` / `next_due_on` | 1 (vaccine D−7) | Date changes | Date or mode |
| P-11 | info | D−3 | Departure | 1 (D−1 glance) | New gap appears | Dates, scope, packing list |
| P-12 | digest | D−14 | Due + 7 d | 1 (D−3) | Due date changes | Due date |
