---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Notifications & Alerts — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Notifications & Alerts — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Book delta

Master Book read end to end; its own Shipped Log has a Sep2 routing correction newer than frontmatter. Git delta since Jul30 over notification/cron/UI/registry/sw paths: `95864ef 2026-08-01 red baseline`, `1f604a8 2026-07-30 delivery sessions`.

Daily items already use `daily_items_summary` and /reminders (registry145–148; sw528/780). The bell is also already finite: `NotificationBell.tsx:39–68,92–96` detects count increases and times out; `globals.css:3712` is one iteration, with reduced-motion suppression at3743. Theme/urgency and accessible unread labels are present (`NotificationBell.tsx:86–89,120`). Old perpetual-ring/route pains and NOTIF-2.1–2.4 need evidence reconciliation, not another implementation. Device behavior remains **UNVERIFIED**; owner390×844 arrival/rest/reduced-motion captures settle it.

Cron server logging is allowed by current Hard Rule22. NOTIF-5.4 and locked decision5 conflict with the amended scope; recommend retiring the blanket stripping task, preserving useful server failure evidence. No existing file changed here.

## Re-scored maturity

Same six dimensions; provisional, no push sent or tests run.

| Dimension | Book | ASTRA | Evidence |
|---|---:|---:|---|
| Data model | 8 | 7 | Unified identity exists; occurrence provenance differs by transport |
| Delivery correctness | 8 | 4 | F1/2; no current scheduler/device witness |
| UX calm | 4 | 6 | Finite animation/reduced-motion code already landed |
| Intelligence | 4 | 4 | E-19 policy still planned |
| Hygiene | 5 | 6 | Server logging is not the old violation; metadata contracts need work |
| Handoff | 6 | 5 | Registry useful; quick actions bypass domain semantics |
| **Mean** | **5.8** | **5.3** | Semantic trust lowered despite UI progress |

## Ranked findings

### F1 — In-app Done can complete the series and dismiss its failed action

`notifications/actions/route.ts:106–135` marks notification acted/dismissed **first**, then updates the parent item to completed without checking that update's result. No recurrence/occurrence dispatch exists. Registry item reminder/due/overdue entries expose complete_task (`registry.tsx:241,256,271`); NotificationModal195 and CriticalAlertGate111 call it. Ownership of a notification is not proof of permission to mutate its linked item.

Push takes another path: `sw.js:1269–1285` calls the item completion endpoint, supplies occurrence_date or today's UTC date and defaults is_recurring false. The endpoint trusts that flag (`items/[id]/complete/route.ts:114`) and its household fallback authorizes any linked partner (`:92–107`), broader than the stated creator/responsible/public policy. Its nonrecurring writes are also separate (`:159–195`). These are source contracts, not live authorization observations.

ASTRA-NOTIF-1 removes the unsafe **notification shortcut** and opens the existing item tool for resolution until a shared, authorized occurrence transition is ready. It does not certify the existing form/endpoint atomicity. This costs one tap and prevents a separate incomplete mutation dialect from claiming success.

### F2 — The stored notification loses the occurrence identity the push carries

`item-reminders/route.ts:337–341` stores item_id/alert_id/item_type; payload369–375 separately adds occurrence_date/is_recurring. An old in-app alert cannot safely infer its original occurrence from the alert's current trigger after recurrence advancement. Record immutable origin identity when producing the notification before re-enabling one-tap actions. Do not default old notifications to today or reconstruct a historical date from mutable alert state.

### F3 — Delivery status is a transport observation, not the household outcome

`pushSender.ts:59–80` returns sent0/failed0/allFailedfalse for missing VAPID, query errors or no subscriptions. `:181–191` marks sent when any subscription accepts, not when each phone displays. `item-reminders/route.ts:386–387` increments counters only from sent/allFailed, so some no-send states contribute to neither counter. This is the same identity/claim/outcome boundary accepted in Top Layer E-05a; extend its types into shared delivery instead of a parallel campaign ledger.

**UNVERIFIED:** external cron schedule, daily last-run evidence, credentials and actual device receipt. Owner supplies scheduler invocation/response trace and two-device notification evidence, with Google last_synced_at progression under NOTIF-6.6. No agent sends tests to the household.

### F4 — Policy must measure recipient events before subscription fanout

E-19/NOTIF-19 sets three pushes per user/day; `sendPushToUser` fans one event to all subscriptions (`pushSender.ts:98`). Counting endpoints would spend two budget units for one alert on two devices. Reserve one recipient-event identity before fanout, retain per-device attempts, and distinguish unknown from failure before retries. Source-level group keys/browser tags are not a durable send claim. Top Layer already owns the 07:15 versus quiet-hours conflict; [Architecture C01](<../../Top Layer/Top Layer — ASTRA Architecture.md>) remains authoritative.

## Ranked enhancement catalog

| Rank | Sheet / proposal | Size / severity | Mapping |
|---|---|---|---|
| 1 | ASTRA-NOTIF-1: open item instead of unsafe Done shortcut | S / blocker | NEW; existing cosmetic/Undo tasks do not cover parent completion |
| 2 | Shared occurrence action with immutable origin | Held, split after Schedule contract | EXTENDS → NOTIF-3.2/3.3; DOCKS → E-11 |
| 3 | Delivery outcome/claim + policy integration | Existing accepted work | DOCKS → E-05/E-19; EXTENDS → NOTIF-19 |
| Existing | Calm bell verification, concise drawer, Google witness | Existing queue | EXTENDS → NOTIF-2.1–2.5/3.1/6.6; credit existing source |

## What ERA needs

Notification identity, source event/occurrence identity, recipient, urgency, eligibility, attempt/accepted/unknown states and resolving route. An Activity success belongs to the domain result, not to a dismissed alert. Reuse the registry's type/route policy for composition while serializing only the minimal safe data required by service-worker/native consumers.

## Do not do

Do not infer task due state from push time, complete a recurring parent from a notification flag, create another notification store/centre, add per-producer quiet-hour logic, re-fix shipped daily routing, or remove server diagnostics indiscriminately. Do not build notification UX inside HubPage except a sanctioned Top Layer rider.

## Coverage note

Junction owner for registry, in-app, push, policy and attention behavior. Schedule owns item semantics/Google mapping; Native owns platform transport; Top Layer owns briefing identity/composition. [Coverage appendix](<../../ASTRA — Coverage & Orphans.md>).

## ASTRA 10× Findings

- **Leverage:** Keep one immutable occurrence identity through every channel; it prevents the wrong task/day being resolved (F2).
- **Leverage:** Budget recipient events once before device fanout, using accepted E-05/E-19 contracts (F3/F4).
- **Simplification:** Remove the independent in-app parent-completion path; delegate to the existing resolving tool until its action contract is safe (F1).
- **Frontier:** None found with sufficient evidence beyond the accepted proactive delivery plan.
- **Uncomfortable:** Delivery correctness was scored8 while in-app Done ignores the domain write result and can end a recurring series (F1).

