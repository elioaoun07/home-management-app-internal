---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 0b0588f (2026-11-04; application source identical to 22152c2, the commit only added docs/era-research/04-memory-context). §1–§2 are CURRENT IMPLEMENTATION / DOCUMENTED INTENT; §3–§8 are PROPOSED DESIGN. No automation, cron, notification, schema or data was created or changed."
---

# ERA Proactive Assistance

[README](README.md) · **Proactive Assistance** · [Trigger Catalogue](TRIGGER-CATALOGUE.md) · [Attention Rules](ATTENTION-RULES.md) · [Evaluation Scenarios](EVALUATION-SCENARIOS.md)

How ERA could speak first across the household's modules without becoming noise: what exists today, the four levels of proactivity, how a suggestion lives and ends, and which opportunities can start now versus which need foundations first. The twelve situations are in the [Trigger Catalogue](TRIGGER-CATALOGUE.md); the behavioural rules in [Attention Rules](ATTENTION-RULES.md) (`AR-n`); the test set in [Evaluation Scenarios](EVALUATION-SCENARIOS.md) (`EV-n`).

**Labels.** CURRENT IMPLEMENTATION = read in code at this cutoff. DOCUMENTED INTENT = stated in vault/PM docs. PROPOSED DESIGN = this folder. UNKNOWN = needs the live database, scheduler, device or owner. ⛁ = depends on a migration newer than the 2026-08-04 RLS snapshot.

## 0. Summary

1. **ERA has delivery plumbing but no proactive brain.** Six cron routes, an in-app notification table with lifecycle columns, web push, a type registry and ERA face widgets exist. No signal registry, briefing, recipient policy, delivery claim or scheduler of record exists (§1).
2. **Today's proactive output is user-scheduled alerts plus three fixed nudges** (daily logging, daily due/overdue summaries, chat). Some of them speak when nothing needs doing: the logging push fires even after the person has logged (`src/app/api/cron/daily-reminder/route.ts:237-356`).
3. **Proposed model: four levels with hard ceilings.** *Notice* (ERA records a situation, nobody is told) → *Notify* (a person is told on the least intrusive surface that still works) → *Prepare* (a reviewable card, draft or list) → *Execute* (only reversible, low-effect actions the person authorised in advance). Money movement never goes past Prepare.
4. **Every suggestion has an identity, a useful window and a terminal state:** acted, resolved elsewhere, dismissed, muted, expired, superseded or failed (§5).
5. **Start pull-only.** Five situations can run as ERA glance cards with existing reads and no scheduler, push or migration. Push, briefings and anything time-critical wait for the scheduler, recipient policy and delivery-claim foundations already tracked as HUB-38/39, NOTIF-19 and NOTIF-21 (§6).

## 1. What exists today (CURRENT)

| Piece | What it does | Evidence | Limit relevant here |
|---|---|---|---|
| `item-reminders` cron | Fires due `item_alerts` (reminders, events, chores, medication doses as items); per-occurrence suppression; recipient = `responsible_user_id` or creator, or every household member when `notify_all_household` | `src/app/api/cron/item-reminders/route.ts:1-18, 288-316` | 12-hour look-back: a one-time alert up to 12 h late still fires; older ones never fire (`:93-98`; 19-business-rules BR-18, S10). Inserts, pushes, then stamps `last_fired_at`; no claim, so overlapping runs can double-send (NOTIF-21) |
| `daily-reminder` cron | Logging nudge at `preferred_times` in `notification_preferences.timezone` | `daily-reminder/route.ts:1-14` | Pushes even when the person already logged ("Great job logging today!"), counted against the UTC date (`:128, 237-244, 336-356`) |
| `daily-items-reminder` cron | Morning "due today" and evening "overdue" summaries, skipped when empty | `daily-items-reminder/route.ts:1-14` | Same overdue list every evening until items change |
| `chat-notifications` cron | One push per thread with unread messages, `group_key` replace | `chat-notifications/route.ts:1-14, 238, 286` | — |
| `gcal-reconcile`, `purge-recycle-bin` | Maintenance | route headers | — |
| Scheduler | None in repo: no `vercel.json`; D1 says the owner configures pg_cron/pg_net | CLAUDE.md Domain Gotchas; Top Layer D1 | Whether any cron runs is UNKNOWN; no liveness ledger (HUB-38) |
| `notifications` table | `group_key`, `is_read`, `is_dismissed`, `snoozed_until`, `action_completed_at`, `action_taken`, `expires_at`, `priority`, `severity`, `action_url`, `push_status` | `migrations/schema.sql` (`CREATE TABLE public.notifications`) | Good lifecycle columns; no terminal **reason** |
| In-app producer | `POST /api/notifications/in-app` dedupes on `group_key` among **non-dismissed** rows (check, then insert) | `src/app/api/notifications/in-app/route.ts:269-284` | A dismissed situation can be re-created at once; check-then-insert can race |
| Type registry | Classes `system` vs `scheduled`; quick actions incl. snooze 15 m/1 h/tomorrow, confirm, dismiss; route allowlist; `expiresAfterHours` | `src/lib/notifications/registry.tsx:54, 59-76, 92-103, 113-127` | `budget_warning`, `budget_exceeded`, `bill_due`, `bill_overdue`, `goal_milestone`, `weekly_summary` are typed but have no producer (D18) |
| Push sender | VAPID config, 410/404 deactivation, optional `push_status` stamp | `src/lib/pushSender.ts` | No quiet hours, cap or class policy; `quiet_start`/`quiet_end` are stored by the preferences route and read nowhere else (`src/app/api/notifications/preferences/route.ts:17-18, 31-32`; NOTIF-19) |
| Glance surfaces | ERA face widgets: budget, schedule, chef, brain summaries | `src/features/era/widgets/use{Budget,Schedule,Chef,Brain}Summary.ts` | Read-only summaries; no situations |
| Persisted AI briefing | Focus insights, 24 h fresh, served up to 7 days | `src/app/api/focus-insights/route.ts:14-16` | D9: retire when the replacement briefing is ready; staleness judged by item count (04-memory-context G7) |
| Trip cascade | `trip_side_effects` records `chore_skip`, `event_skip`, `recurrence_pause`, `meal_skip`, `item_reassign` with previous values | `schema.sql` `trip_side_effects` | 19-business-rules: today activation creates only the trip account; chores and reminders keep firing during the trip. DEC-04 open |
| Day intent | `day_plans.intent` = `rest` / `balanced` / `productive` | `schema.sql` `day_plans` | Not read by any producer |

## 2. Binding decisions

| Decision | Source | Effect |
|---|---|---|
| D1 scheduler: owner configures pg_cron/pg_net to call the deployment with the cron secret; agents write runbooks only | Top Layer §10 | No agent creates or enables a schedule (this folder creates none) |
| D3 composer: deterministic templates over typed signals; model phrasing waits for truthful attribution | Top Layer §10 | Briefing text is template-built; no model on the proactive path in early waves |
| D5/D6 recipients: quiet 21:00–08:00 Beirut, three pushes/day/person, urgent/info/digest classes, overflow to digest; partner eligible after five owner mornings with their own hour/toggle | Top Layer §10 | Inputs to [ATTENTION-RULES §6](ATTENTION-RULES.md#6-quiet-hours-and-interruption-budget) |
| DEC-01: briefing hour vs quiet hours (07:15 promised, quiet ends 08:00) | `_Decisions.md` | Briefing cannot activate until decided |
| DEC-03: low-stock threshold and automatic shopping addition | `_Decisions.md` | No automatic shopping from stock |
| DEC-04: trip reversal policy | `_Decisions.md` | Trip cascades are not executed by ERA |
| D9 retire Focus insights; D18 produce or retire dormant types | Top Layer §10 | Reuse `bill_due` etc. or retire them; no competing briefing engine |
| Effect policy and Confirm rules | Top Layer §5; DEC-24 | Money movement Confirm always; model-interpreted reminder writes Confirm |
| Non-goals: no geofencing, no wake word, no new offline queue, no model training | Top Layer §6; ERA Learns Your World | Timing is clock-based only |
| HUB-54: signal card actions are draft-only, never a direct write | Hub & ERA Master Book | Prepare, not Execute, for money |
| Doctrine Corollary A: foresight gained by sacrificing trust is a downgrade | Design Doctrine §5 | No auto-posting, auto-paying or silent rescheduling |
| Hard Rules 1, 3, 14, 26, 28, 29 | CLAUDE.md | Undo on toasts; no red rows; person colours; no production writes; minimal text; no live paid-API tests |

## 3. The four levels (PROPOSED)

| Level | What ERA does | Writes allowed | Who sees it | Consent | Example | Never |
|---|---|---|---|---|---|---|
| **Notice** | Evaluates a trigger, records a *situation* with evidence, coverage and a useful window | Only its own situation record | Nobody, until a surface pulls it | None | "Groceries envelope at 86 %, 12 days left" recorded | Notice is not a notification; no badge, no count |
| **Notify** | Shows the situation on one surface (glance, thread, briefing, bell, push) | Delivery record | The responsible person | Surface and class policy (AR-6) | Briefing line `Internet $45 due Sat · Wallet short $20` | No push for something that can wait for the next glance |
| **Prepare** | Builds reviewable work: confirm card, draft, prefilled form, review list | Drafts and cards that change no facts (a draft transaction is the existing "capture as draft" class, Act + Undo) | The responsible person | Confirm or Open to proceed | `Add 6 items for Fri dinner [Add] [Edit]` | Prepare never moves money or edits recurrence |
| **Execute** | Performs an action the person authorised in advance for exactly this kind of situation, or confirmed now | Source write through the registered adapter, with Artifact and Undo | Receipt to the person | Standing rule ("Always") or Confirm | Ingredients added under `Always add missing ingredients` · `Added 6 · Fri dinner [Undo]` | Money movement, recurrence/series edits, outward messages, partner-owned targets, deletes |

A situation's **level ceiling** is fixed in the catalogue; signals, ranking or a model can never raise it. A person can lower it (mute, glance-only) at any time.

## 4. Surfaces, from least to most intrusive

| Surface | Today | When it fits | Native mapping (D8) |
|---|---|---|---|
| Glance card in ERA (face widget / hub) | Widgets exist; no situation cards | Anything that can wait until the person opens ERA | — |
| In-thread line | ERA conversation exists | The person is already talking to ERA about that module | — |
| Daily briefing | Not built (HUB-42, DEC-01) | Day-ahead items with a decision today | Apple *passive*/*active*; Android low/default channel |
| Bell (in-app notification, no push) | Built | Needs a record but not an interruption | — |
| Push, normal | Built (no policy) | A decision is needed before the next likely glance | Apple *active*; Android default |
| Push, time-sensitive | Built (no class) | Loses value within the hour (leave-by, dose) | Apple *time sensitive*; Android high |

Apple reserves *time sensitive* for information that needs attention now or within an hour; Android fixes a channel's importance once created ([§9](#9-external-research)). ERA's class per situation should be chosen once with that in mind, not per message.

## 5. A suggestion's life

### 5.1 Identity

`situation_key = type : subject IDs : period or occurrence : recipient`. Examples: `bill_short:rp_internet:2026-11-06:maya`, `meal_missing:mp_7f…:2026-11-06:maya`. The key, not the text, decides duplicates (AR-1). A **material change** (shortfall grows by ≥25 % or ≥$20, due date moves, the subject changes owner, coverage goes from partial to complete) creates a new revision of the same key, not a new situation.

### 5.2 States

```
            ┌──────── suppressed (gate failed: stale, unavailable, muted, quiet+expired)
detected ───┤
            └──► eligible ──► delivered ──► seen ──┬─► acted          (completed through the card)
                    │              │                ├─► resolved       (condition cleared anywhere)
                    │              │                ├─► dismissed      ("Not now" / swipe)
                    │              │                ├─► muted          ("Don't suggest this")
                    │              │                ├─► snoozed ──► eligible at T (unless resolved)
                    │              │                └─► failed/uncertain (action error; stays open as "Check")
                    └── held (quiet hours / budget) ─► delivered | expired
   any non-terminal state ──► expired (useful window passed) | superseded (material change)
```

| Terminal state | How it is reached | What the person sees | May it return? |
|---|---|---|---|
| **acted** | The card's action succeeded and left an Artifact (or Open led to the source change) | One-line receipt with Undo (Hard Rule 1) | Only as a new period/occurrence |
| **resolved** | Re-evaluation finds the condition gone (bill paid, item done, meal shopped) by any path, any person | Card disappears; a delivered push is replaced silently via its tag (AR-4) | New period only |
| **dismissed** | "Not now" or swipe | Gone | After a material change, or at the type's reconsideration point (AR-3) |
| **muted** | "Don't suggest this" (per type, optionally per subject) | `Muted · [Undo]` | Never, until un-muted in Settings |
| **expired** | `useful_until` passed without action | Nothing | No |
| **superseded** | A material change created a newer revision | Newer card replaces it | The newer one follows its own lifecycle |
| **failed / uncertain** | The prepared action errored or its outcome is unknown | "Didn't go through · [Retry]" or "Check · [Open]"; never an automatic retry of a write | Stays open until acted, resolved or dismissed |

Every terminal state stores a reason and a time, so evaluation can tell silence from failure (Archived study "Silence, Trust & Intervention": "silence must be distinguishable … from source failure").

## 6. Initial scope (recommendation)

### 6.1 Foundations

| ID | Foundation | Owning work | Needed by |
|---|---|---|---|
| F-1 | Scheduler of record and cron liveness | D1, HUB-38, HUB-39 (owner config) | Any push or briefing |
| F-2 | Recipient policy at `sendPushToUser` (quiet hours, cap, classes, digest) | NOTIF-19, DEC-01 | Any ERA-originated push |
| F-3 | Durable delivery claim and idempotent recovery | NOTIF-21 | Any push |
| F-4 | Situation record with key, revisions and terminal reasons | HUB-41 (signals with provenance) | Dismiss/mute memory beyond a session |
| F-5 | Canonical money facts (custom period, balance age) | BUD-66, HUB-45 | P-01, P-04 trusted |
| F-6 | Allergen-feed availability | HLTH-21 | P-09 trusted |
| F-7 | Travel minutes on Places | ERA Learns Your World "Leave-by alert" | P-06 |
| F-8 | "Already logged" link between a recurring payment's due date and a transaction | M2, Q-05 (19-business-rules) | P-02 |
| F-9 | Stored per-person time zone | 08-shared-data §2.1; 04-memory-context OD-5 | Travel-time correctness for all timed situations |
| F-10 | Explicit feedback and ranking | HUB-43, HUB-23 | Learning which types help |
| F-11 | Trip side-effect policy | DEC-04, TRIP items | P-11 Execute |

### 6.2 Waves

| Wave | Scope | Situations | Needs | Why first |
|---|---|---|---|---|
| **W1 Pull-only glance** | Computed when the person opens ERA; no cron, push or migration. Dismiss/snooze stored as an in-app `notifications` row with the situation key as `group_key` and `is_dismissed`/`snoozed_until` set, created only by the person's tap; the evaluator reads dismissed rows too (AR-3) | P-03 drafts waiting, P-05 overdue review, P-08 meal ingredients, P-09 allergen conflict (shown as "unchecked" when the feed fails), P-12 maintenance due | Existing reads and capabilities (`draft.list`, `reminder.find`, `recipe.ingredients`, `shopping.add`, `get_household_allergens`, Catalogue `next_due_date`) | Zero interruption risk; measures usefulness before spending push budget |
| **W2 Briefing + policed push** | One stored briefing per eligible recipient day (HUB-42); pushes only through F-2/F-3 | P-01, P-04, P-07, P-10, P-11, and day-before P-08/P-09 | F-1, F-2, F-3, F-4; F-5 for money lines; DEC-01 | Earns "speaks first" (D3/D5) with policy in place |
| **W3 Time-critical + Execute** | Time-sensitive pushes; standing-rule execution | P-06 leave-by; P-08 "Always add" execute; P-11 trip cascade execute | F-6, F-7, F-9, F-11; W2 feedback (F-10) shows low dismissal | Highest interruption cost and effect; needs evidence from W1/W2 |

**Not in any wave:** P-02 automatic posting (Prepare only, after F-8), any money Execute.

### 6.3 Why pull-only first

- It is the only option with no dependency on UNKNOWN deployment facts (scheduler, applied migrations).
- It tests *evidence and silence* — the hard part — without interruption cost.
- It reuses the notifications table's lifecycle columns instead of adding a store; F-4 is built only if W1 shows the table cannot carry revisions and reasons.
- Its limit: nothing happens if the person never opens ERA. That is acceptable for the five W1 situations, whose useful windows are days, not minutes.

## 7. Owner decisions

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| PD-1 | Do user-scheduled alerts (their own reminders at 22:00) obey quiet hours? | Obey · always fire · per item | Always fire: the person chose the time. Quiet hours govern ERA-originated (`system`) notifications. NOTIF-19's acceptance currently applies quiet hours to all producers, so this narrows it and needs the owner's choice |
| PD-2 | Do user-scheduled alerts count against the 3-push budget? | Count · exempt | Exempt; the budget limits ERA's own initiative |
| PD-3 | Briefing hour vs quiet hours | = DEC-01 | 08:00 default, per-recipient choice |
| PD-4 | Situation storage | Reuse `notifications` (W1) · new `era_situations` (`era_*`, D4) | Reuse first; decide after W1 |
| PD-5 | Fix the logging nudge that pushes after the person logged | Keep · skip push when logged · retire into briefing | Skip when logged now; fold into the briefing in W2 |
| PD-6 | Replace the nightly overdue push with the weekly review (P-05) | Keep both · weekly only · person chooses | Person chooses; default weekly |
| PD-7 | Partner proactive eligibility | D5/D6 five owner mornings · independent opt-in | Keep D5/D6; partner opts in with their own hour |
| PD-8 | Which situations may ever reach Execute | P-08 only · P-08 + P-11 · none | P-08 first; P-11 after DEC-04 |
| PD-9 | Home zone vs traveller zone for timed situations during trips | Home · device · per type | = Q-15 / F-9; doses home zone, leave-by device zone |

## 8. Not proposed

Geofenced or location-based triggers; a model watching household chat for tasks; automatic paying, posting, transferring or trip activation; pantry depletion guesses; debt chasing; "safe to spend" figures; anomaly pushes without a decision; summaries of the partner's private activity; any live automation from this folder. (Archived study "Opportunity Portfolio", Deliberate exclusions, reached the same exclusions; it is historical and frozen.)

## 9. External research

Located through the session's web search on **2026-11-04**; page bodies were not opened (direct fetches are blocked for several hosts in this session, see [04-memory-context MEMORY-DESIGN §6](../04-memory-context/MEMORY-DESIGN.md#6-external-research)). Re-read before implementing.

| Source | Point used |
|---|---|
| [MDN, `ServiceWorkerRegistration.showNotification()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) | A notification with the same `tag` replaces the previous one; with `renotify` false (default) the replacement does not alert again. `renotify` is marked experimental. Basis for silent replacement on resolve/supersede (AR-4) |
| [Apple HIG, "Managing notifications"](https://developer.apple.com/design/human-interface-guidelines/managing-notifications) | Interruption levels passive, active, time sensitive, critical; time sensitive only for what needs attention now or within an hour; never for marketing |
| [Android developers, "Create and manage notification channels"](https://developer.android.com/training/notify-user/channels) | Every notification belongs to a channel; importance is set per channel and cannot be changed by the app afterwards; users control channels in settings |

Gaps: no primary research on interruption cost or notification fatigue was read; no data on this household's notification habits exists in the repo.
