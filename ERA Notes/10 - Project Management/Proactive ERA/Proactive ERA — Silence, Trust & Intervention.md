---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Proactive ERA — Silence, Trust & Intervention

ERA earns permission to be proactive by making most evaluations quiet. It should intervene when permitted evidence supports a useful response **while that response can still improve the situation**. Silence must be distinguishable internally from source failure, missed execution and a known resolution.

This proposed policy accompanies the [Intelligence Model](<Proactive ERA — Intelligence Model.md>) and [Architectural Leverage](<Proactive ERA — Architectural Leverage.md>). Source inspection: 2026-09-06 at `83e44be`; no product policy or behavior changed. The [Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>) and existing [Contradiction Register](<../ASTRA — Contradiction Register.md>) remain binding for execution.

## The decision order

Apply hard eligibility gates before ranking. A high urgency score cannot compensate for missing authorization, unsupported facts or a revoked source.

| Gate | Required judgment | Failure response |
|---|---|---|
| Recipient and purpose | Every necessary input is permitted for this recipient and this use | Withhold derived content; do not leak a private cause through a vague recommendation. |
| Warrant | A typed claim is reproducible, or a proposed interpretation is clearly an assumption | No automatic factual claim from free-text plausibility or model confidence. |
| Necessary freshness and coverage | Required sources, including resolution/suppression, are sufficiently current and complete for the claim | Refresh, hold or ask a pivotal question; never substitute zero. |
| Actionability | At least one useful response remains, including preparation or a meaningful clarification | Remain silent; a true fact alone does not earn an interruption. |
| Novelty | The recipient has not already received/decided this material situation, or an explicit reconsideration boundary is reached | Keep prepared context current; avoid a repeat push. |
| Timing and policy | Delivery class, local time, preferences and available interruption budget allow it | Defer to eligible surface/time only if the response will still be useful. Expire otherwise. |

Only then rank candidates. Prefer the decision with greater credible avoidable cost, an earlier loss of useful options, stronger evidence and lower interruption cost. Cluster multiple concerns that one decision resolves. Do not add their scores as if correlated facts were independent evidence. These are ordinal judgments initially, not calibrated probabilities or a universal utility function.

## Choose the smallest sufficient response

| Response | When it is appropriate | Example / boundary |
|---|---|---|
| Silent refresh/preparation | A situation is relevant but no decision is needed now | Retrieve the selected recipe's explicit prior substitution note. No domain mutation. |
| Quiet ranking | Known preference can reduce repeated friction | Soft-demote a recipe after that person's explicit negative feedback; no notification. |
| Next glance / existing briefing | A useful option exists and can wait for normal attention | A conditional preparation conflict with one proposed alternative. |
| One question | A missing observation changes the feasible action and can be answered in time | Intended mealtime, when that changes the preparation plan. No questions merely to complete a profile. |
| Reviewable proposal | A concrete supported action would help | Existing capability with exact entity/occurrence and current preconditions; human confirms. |
| Push | Waiting for the next natural glance risks losing a valuable option, and all policy gates pass | An eligible time-sensitive review; no urgency exemption invented by a model. |
| Silence and retirement | The situation is resolved, obsolete, declined for this window, unsupported, unauthorized or no longer actionable | A payment already confirmed covered; a meal cancelled; an old preparation window that cannot be recovered. |

A completed preparation can legitimately produce no message. A low-value anomaly can legitimately produce no persisted assessment. A service failure is not an “all clear”: it belongs in existing diagnostics/vitals and may withhold dependent conclusions.

## Existing policy remains binding

Master Plan D5 specifies quiet 21:00–08:00 Beirut, three pushes per day per user, urgent/info/digest classes and digest overflow. D6 includes the partner after five owner-only mornings, with her own toggle/hour. C01/C03 already hold the 07:15 conflict and partner-policy sequencing. This study neither authorizes an exception nor selects a new hour. Live activation waits for those recorded owner decisions.

Count one logical recipient push before device fanout. Multiple devices are transport attempts, not multiple attention allowances. An expired overflow item should disappear, not become tomorrow's stale digest. Do not label a case urgent solely to escape policy. Stored quiet fields are present (`schema.sql:755–756`) but enforcement was not found in delivery paths; configuration is not proof of behavior.

Existing `/era` surfaces and concise UI rules remain. Labels/actions can be short; evidence detail belongs behind an existing detail affordance or in internal diagnostics. Internal states in this document are not proposed UI prose. Nothing authorizes a redesign, new bell, new modal system or additional assistant door.

## The evidence needed to stay silent is also evidence

A due-date feed can succeed while completion or suppression fails. That does not establish an unresolved obligation. The existing [item cron](../../../src/app/api/cron/item-reminders/route.ts), lines 258–275, drops errors from occurrence-action and suppression reads and maps null to zero. A future assessment must model those required reads as available/unknown separately.

Conversely, partial data does not prohibit every useful conclusion:

- Two permitted fixed event intervals can prove a **recorded overlap** even if recipe retrieval fails.
- An explicit negative recipe preference can affect that person's ranking without complete taste history.
- “No conflicts,” “all meals covered,” “safe to spend,” or “no allergy issue” needs complete relevant coverage and, in some cases, cannot be established from these records at all.

The detector must specify whether a missing source could reverse its conclusion. Unknown suppressions block interruptive delivery. Optional explanatory enrichment may be omitted. Do not turn every missing source into an attention-demanding warning.

## Receipt semantics and cross-day silence

The [chat notification cron](../../../src/app/api/cron/chat-notifications/route.ts), lines 246–260, already rechecks read state before sending. Reuse that principle with stronger semantics: check what is known about **this recipient and this situation now**.

| Evidence | It can establish | It cannot establish |
|---|---|---|
| Notification row / `group_key` | Logical stored intervention | Push accepted, shown or useful. |
| Push sender `sent > 0` | A push service accepted at least one send | A phone displayed it or a person saw it. |
| Hub “read” receipt | Current app retrieval/read state; useful for avoiding a redundant push | Human understanding. GET marks returned messages read by default. |
| Opened card | Interaction with that artifact | Agreement, intention or completion. |
| Explicit acknowledgement / snooze / dismissal | A decision about receiving this intervention | The underlying obligation is resolved. |
| Authoritative domain outcome | Recorded action applied to the specified entity/occurrence | Guaranteed physical-world completion or proof that ERA caused it. |

Sources: [pushSender.ts](../../../src/lib/pushSender.ts), lines 53–80 and 181–184; [message GET](../../../src/app/api/hub/messages/route.ts), lines 88 and 414–449; [notification actions](../../../src/app/api/notifications/actions/route.ts), lines 106–135.

Deduplicate by stable situation/recipient identity across briefing dates. Updating wording, refreshing a query, changing detector code or restarting must not itself justify another interruption. Source revision is for reproducibility; **material conclusion/option change** controls renewed presentation. A justified escalation at a previously defined useful-action boundary may warrant reconsideration even without a row change, subject to explicit snooze and delivery policy.

An acknowledged “already handled” can suppress the current intervention without falsely closing the domain record. If source evidence later conflicts, ask a bounded clarification only when consequential. Partner resolution of a shared obligation can suppress both recipients' obsolete interventions, but the private reason or supporting private record remains undisclosed.

## Privacy before combination

Construct a recipient/purpose projection before crossing domains. Current patterns are heterogeneous: personal wardrobes, private solo trips, explicitly shared health profiles, minimal household allergens, owner accounts, responsible-person Schedule entries and private Hub threads. Do not infer a universal household permission from a successful service-role query.

A derived statement inherits restrictions from all necessary inputs. “Delay this purchase” may leak a private health cost even without naming it. “Pack this outfit” may disclose personal wardrobe/fit details in a shared trip. Where a public minimal fact is permitted, use that projection rather than privately deriving a suggestion and stripping its explanation afterward.

Before delivery and confirmation, revalidate recipient membership, current source access and target ownership. Retract cached proposals on the next connected validation after revocation; bounded owner-scoped caches and expiry limit retention. Already-displayed push content or content on an offline device cannot be instantly recalled, so minimize sensitive push payloads. Withhold sensitive derived suggestions while current scope cannot be verified; do not promise immediate remote deletion from an offline phone. A retained historical receipt can preserve minimal audit identity without retaining newly forbidden content. Live RLS/function proof remains owner-supplied; this study makes no production privacy certification.

## Failure and recovery contract

| Event | Required proposed behavior |
|---|---|
| One required source unavailable | Hold the dependent claim, preserve the last result as stale if permitted, never mark it resolved. Retry within the useful window. |
| Legacy/defaulted value appears as “actual” | Exclude it from measured-history inference; use as an explicit estimate only if appropriate. |
| No subscription/configuration | Record unavailable delivery capability; use existing in-app surface if permitted. `allFailed=false` is not success. |
| Notification inserted, first send fails | Recover that same recipient notification if still relevant; an existing row must not suppress retry unconditionally. |
| Crash after transport acceptance | Outcome unknown; reuse identity/tag with bounded recovery and device dedupe. Never replay the domain action. |
| Source alert advances to next occurrence | Preserve the old recipient attempt independently until delivered, expired or resolved. Source advancement is not delivery. |
| Source edited, deleted or rescheduled | Invalidate affected assessment; retain original occurrence identity when applicable, refresh evidence before proposal confirmation. |
| Underlying recipe changes while meal row stays unchanged | Invalidate prepared plan by recipe content/version dependency, not only meal timestamp. |
| User handled it offline | Server state may lag; avoid blame. Reconcile after sync; current device can suppress its surface locally without claiming server acknowledgement. |
| Offline proposal confirmation | Follow current domain eligibility. Do not promise durable acceptance while E-09 prerequisites remain unproved; no new queue. |
| Restart with pending local feedback | Restore only what is durably stored; a session-only dismissal is not cross-device policy. |
| AI invalid/failed/quota unavailable | Omit enrichment; preserve justified deterministic core. No unvalidated fallback prose in an automatic intervention. |
| Domain action commits but telemetry fails | Preserve domain success, repair/link telemetry later; do not invite a duplicate action. |
| No useful action remains | Expire that intervention. A separate recovery option needs its own warrant, not a late copy of the old warning. |

The first-send and source-advancement failures are concrete source risks: [chat cron](../../../src/app/api/cron/chat-notifications/route.ts), lines 231–244 and 267–302, skips an existing row regardless of failed transport; [item cron](../../../src/app/api/cron/item-reminders/route.ts), lines 352–357 and 390–395, can mark fired/advance after all recipient inserts fail. These are recorded PM findings, not claimed live incidents or repairs.

## Learning without confusing activity with value

Keep language learning, preference learning, timing and outcome usefulness separate. The current taught-template path increments match count even when the result fails and drops `ok` ([resolveIntent](../../../src/features/era/intents/resolveIntent.ts), lines 131–133). E-11's fix is prerequisite to trustworthy action learning; even after that fix, successful execution does not imply that an unsolicited intervention was welcome.

For two users, explicit preferences and occasional reviewed episodes are more defensible than a high-dimensional engagement ranker. No response is missing feedback. Dismissal can mean irrelevant, already handled, bad timing or unwanted help. Accepting a proposed action is stronger evidence of actionability but remains confounded by prior intention. Never infer mental health, diligence or interpersonal responsibility from app-use patterns.

Measure useful lead time, avoidable rework, unnecessary interruptions, factual corrections, repeated already-handled prompts and owner-rated decision benefit. Include missed useful situations in the denominator. Transport success and click-through remain diagnostics, not the product objective. [Experiments](<Proactive ERA — Experiments.md>) defines small nonclinical, nonfinancial-advice trials that can disprove the design before implementation expands.
