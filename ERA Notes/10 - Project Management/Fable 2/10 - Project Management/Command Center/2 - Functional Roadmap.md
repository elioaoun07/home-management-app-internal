---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Proposals; nothing here is implemented."
---

# Command Center — functional roadmap

[Fable 2 index](<../../_index.md>) · [Usability and visual review](<1 - Usability and Visual Review.md>) · [Delivery Local lane](<../Delivery/2 - Local Lane Design.md>)

The accepted product promise in [Plans/Command Center](<../../../Plans/Command Center.md>) stays: choose an outcome, approve its approach, follow its delivery, return to a recorded result. These changes shorten the distance between the first and the last of those.

## Ordered changes

| Order | Change | Why it is first | Item |
|---|---|---|---|
| 1 | **A "Today" block on Home, above everything else.** Three short lists: *Needs you* (open questions, UAT waiting, decisions blocking a Now item), *Running* (live sessions with their stage), *Next up* (the top three items by lane order across campaigns, each with a Deliver button) | It is the missing answer to "what do I do now" (U1, U6) | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| 2 | **Deliver from any item row in one click**, into the Local lane, with no pairing on loopback | Starting work is currently a tab change, a pairing errand and a readiness panel (U3) | [DLV-150](<../../../Delivery/Delivery — Master Book.md#dlv-150>), [DLV-151](<../../../Delivery/Delivery — Master Book.md#dlv-151>) |
| 3 | **Sprints close themselves.** A week whose end date has passed becomes Closed with its real delivered count; unfinished members roll to the current week or back to their lane | The planning view shows October as the present (U4) | [R87](<../../../PM Tooling/PM Tooling — Master Book.md#r87>) |
| 4 | **One vocabulary.** Use Now / Next / Later everywhere and show Blocked as a filter on top, not as a fourth lane with different totals | Two taxonomies for 243 items (U5) | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| 5 | **A model-tier chip on each item**, read from a declared `**Tier:**` line in its Master Book section | The owner asked for per-model routing; today it lives only in prose. Feeds existing DLV-117 | [Model Tiers](<../../Model Tiers/_Routing.md>) |
| 6 | **Ship and Undo on the session page** once UAT is signed off | Completes the Local lane inside the same screen | [DLV-153](<../../../Delivery/Delivery — Master Book.md#dlv-153>) |
| 7 | **Honest throughput on Analytics:** items added versus shipped per week, age of the oldest Now item, weeks to drain Now at the current rate | A backlog of 243 with 5 shipped records in 14 days needs a number that says so | Existing R62 |
| 8 | **Retire the two older UI generations** after the checks R6 already describes | 11,105 lines of fallback UI are kept in step with the live one | Existing R6 |

## Small fixes worth batching with change 1

- Drop the hero headlines or shrink them to a single line (U8).
- Put Decisions in primary navigation with its count; move Analytics to the overflow menu if five slots must stay five (U6).
- Show the `Ctrl/Cmd+K` hint in the search button's tooltip (U9).
- Label the Waiting card with what it counts (V4).

## What not to build

- No new planning concept. Sprints, lanes, campaigns and decisions are enough.
- No second status engine for the Local lane. Reuse the session record and stages V2 already has.
- No analytics beyond the three numbers in change 7 until those have changed a decision.
- No further readiness diagnostics. Under the Local lane there are three checks.

## Dependencies

Changes 1, 3, 4 and the small fixes touch only `scripts/pm/app/` and `scripts/pm/shared/`. Changes 2 and 6 need the Local lane. Change 5 needs one optional declared line added to the Master Book grammar (`_Conventions.md` §3 lists the existing optional lines: `Kind`, `Depends on`, `Touches`).
