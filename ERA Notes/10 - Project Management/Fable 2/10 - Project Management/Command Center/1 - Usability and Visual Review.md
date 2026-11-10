---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. `node scripts/pm-server.mjs --no-open --no-bridge` in a clean container, screenshots at 1440x900 and 390x844 of Home, Sprints, Delivery, Work, Analytics, Decisions and Activity. No .env, so Delivery status was unavailable and no run or launch page was exercised."
---

# Command Center — usability and visual review

[Fable 2 index](<../../_index.md>) · next: [Functional roadmap](<2 - Functional Roadmap.md>)

## Verdict

The application looks finished and reads well. What it does not do is tell the owner what to do next or let him start doing it in one step. It reports the size of the backlog on every screen and leaves the choice, the launch and the follow-up to him.

## Usability findings

| # | Finding | Evidence | Item |
|---|---|---|---|
| U1 | **Home answers "how much", not "what next".** The first viewport is a headline, four counts (31 Now, 45 Up next, 70 Waiting, 97 Someday) and a grid of spaces. There is no single next action, no "needs you" list and no running-work strip above the fold | Home at both sizes | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| U2 | **"Now" is not a focus list.** 31 items are in Now across 11 campaigns. The convention says "normally up to three outcomes per campaign"; at that size nothing is selected | Home, Analytics; `_Conventions.md` §2 | [Backlog Health](<../Portfolio/Backlog Health.md>) |
| U3 | **The Delivery tab opens on a pairing form** on `127.0.0.1` ("Pair this browser · Get a code: `pnpm pm:pair`") with "Delivery status unavailable" under it. The first thing the owner meets in the tab meant for doing work is a terminal errand | Delivery at both sizes; `scripts/pm/app/BrowserSession.tsx:30-31` | [DLV-151](<../../../Delivery/Delivery — Master Book.md#dlv-151>) |
| U4 | **Sprints is frozen in October.** "Week 1 · Oct 5 – Oct 11" is still "In play" on 10 November with 0/5 delivered; later weeks whose dates have also passed still read "Planned". Nothing closes or rolls forward | Sprints; `_Planning.json` (`sprint-2026-10-05`, `"state": "active"`) | [R87](<../../../PM Tooling/PM Tooling — Master Book.md#r87>) |
| U5 | **Two vocabularies for one queue.** Files and Analytics use Now / Next / Later (34 / 75 / 134). Home and Work use Now / Up next / Waiting / Someday (31 / 45 / 70 / 97). Both add up to 243, but no screen explains how one maps to the other | Home versus Analytics | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| U6 | **What blocks the owner is two taps down.** 21 open decisions and 70 waiting items exist; Decisions lives in the overflow menu with Activity, Inbox and Documents | `scripts/pm/app/PrimaryNavigation.tsx:8-21` | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| U7 | **Analytics looks backwards only.** Two bars in 14 days, "0 last 7 days / 5 previous 7 days". No age of the oldest Now item, no added-versus-shipped rate, no projection | Analytics | Existing R62 |
| U8 | **Headlines cost a quarter of each first screen.** "Your ERA.", "Make it happen.", "Find your next move.", "Over to you.", "Your progress, recorded." This is the owner's own rule against explanatory text (Hard Rule 28) applied to his own tool | Every view | [R86](<../../../PM Tooling/PM Tooling — Master Book.md#r86>) |
| U9 | **Search exists but is hidden.** `Ctrl/Cmd+K` jumps to Work and focuses the filter; nothing on screen says so | `scripts/pm/app/App.tsx` key handler | Fold into R86 |

## Visual findings

| # | Finding | Recommendation |
|---|---|---|
| V1 | The dark theme, type scale, radii and the mobile bottom bar are consistent across all seven views | Keep. Do not restyle |
| V2 | Density is low on desktop: 900 px of height shows four numbers and four space cards | Offer a compact Home: counts in one row, then lists |
| V3 | Space cards differ mainly by hue; the "13 blocked" chip is the smallest text on the page and carries the most important fact | Promote blocked and in-focus counts to the card's main line |
| V4 | The Waiting card is brown where the others are blue, which reads as a warning without saying what the warning is | Label it ("70 blocked on a decision or a dependency") or use the same surface |
| V5 | The raised Delivery pill overlaps the navigation container on desktop | Align it with the other four, keep the accent colour |
| V6 | Each space card ends in one long sentence that truncates differently per card | Show the ID and a short title, as the Delivery list already does |

None of the visual points blocks use. U1, U3 and U4 do.

## Limits of this review

Seen: seven read views on two viewports, rendered from the repository's own PM files. Not seen: the launch screen with live readiness, a running session, plan review, Apply, the UAT wizard, the phone relay (`/pm/live`) and the classic UI. Those need the owner's local stores and sign-ins.
