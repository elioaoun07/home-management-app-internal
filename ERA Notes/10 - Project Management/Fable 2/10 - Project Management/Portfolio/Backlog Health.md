---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Counts read from the running Command Center (Home, Analytics, Sprints) and from the checklists, before the Fable 2 filing added 30 lines."
---

# Portfolio — backlog health

[Fable 2 index](<../../_index.md>) · [Research-to-Queue Leak](<Research-to-Queue Leak.md>)

## The numbers

| Measure | Value |
|---|---|
| Open items | 243 (Now 34, Next 75, Later 134) |
| Blocked or waiting | 70 |
| Open owner decisions | 21 (`_Decisions.md`) |
| Completed records | 290 |
| Cancelled | 17 |
| Shipped records, last 14 days | 5, all in the first week; 0 in the last 7 days |
| Sprint delivery, six elapsed weeks | 2 of 20 planned items |
| Days since a checklist changed | 10 at the cutoff (last: 2026-10-31); the session radar reported 23 days since a checklist's `updated:` stamp |
| Open items per campaign | Hub & ERA 54, Budget 33, Schedule 33, Kitchen 21, Trips 20, PM Tooling 18, Healthcare 18, Delivery 14, Outfits 12, Notifications 12, Native App 8 |

The campaign table in the PM index was also out of date: it listed Hub & ERA at 42 pending while the checklist held 54. It is corrected in this filing.

## Reading

1. **Arrival beats departure.** Analysis sessions add items in batches (the bug sweep reserved 15, this filing adds 30); delivery removes them one at a time, and in the last week removed none. A backlog with that shape only grows.
2. **Now is not a commitment.** 34 items in Now cannot all be next. The convention's "up to three per campaign" has become a ceiling that every campaign fills.
3. **A third of the backlog waits on the owner.** 70 blocked items and 21 open decisions are work only he can release, and the tool keeps them in an overflow menu ([Usability review](<../Command Center/1 - Usability and Visual Review.md>) U6).
4. **Verification items wait on evidence that only exists outside the repo.** 13 of the 34 Now lines begin "Verify", "Witness" or "Confirm". Those that need a migration run, a device check or a production query are owner checks sitting in the Deliver queue, which `_Conventions.md` §2.1 says belong in UAT.
5. **Attention went to the tool.** 32 open items belong to PM Tooling and Delivery, including 5 of the 34 Now items.

## Recommendations

No new checklist items here except where an ID is named; these are owner calls.

| # | Recommendation | Effect |
|---|---|---|
| 1 | **One global Now of five.** Pick five items across all campaigns; everything else in Now moves to Next. The Home "Next up" list in [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) then shows something real | The queue names what happens next |
| 2 | **Promote the four critical sweep items into that five:** HUB-118, BUD-89, BUD-90, HUB-119 | Known data-exposure and money-duplication defects stop waiting |
| 3 | **Move owner-evidence lines out of the queue** into `docs/Delivery-UAT.md` rows with `**Execution:** owner` in the book, as the convention already says | Now shrinks to executable work |
| 4 | **Decide or drop the 21 decisions in one sitting.** For each: choose, or record "keep current behaviour" and close | Releases a share of the 70 waiting items |
| 5 | **Cull Later.** Any Later item untouched for 60 days with no dependency on it goes to `_Archive/Cancelled Log.md` unless the owner keeps it | 134 becomes a list someone can read |
| 6 | **Stop meta work until the Local lane ships one product item.** After [DLV-150](<../../../Delivery/Delivery — Master Book.md#dlv-150>) to DLV-153, the next five sessions are product sessions | Reverses finding 5 |
| 7 | **Measure it.** Added versus shipped per week on Analytics (existing R62) | The owner sees the balance without counting |

## What this filing does to the numbers

It adds 30 open items (15 already-found defects that were missing, 15 new) and raises the total to 273. A second filing the same day added the eight Agentic OS roadmap steps (R92 to R99), for 281. That is the wrong direction for the count and the right one for visibility: the 15 defects existed whether or not the board showed them. Recommendations 1, 3 and 5 are how the total comes back down.
