---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Packets are proposals for how to hand work to a session; the checklists own priority."
---

# CLAUDE_HIGH — work packets and heavyweight studies

[Routing rules](<../_Routing.md>) · [Fable 2 index](<../../_index.md>)

Use this tier when a wrong answer would look right. Give each session one packet, the item's criteria section, and the named playbooks. Do not hand it the whole Master Book ([why](<../../01 - Architecture/Agent Context Economy.md>)).

## Implementation packets

| Packet | Items, in order | Playbooks to load | Stop and ask when |
|---|---|---|---|
| P1 Exactly-once money | BUD-90, then BUD-92 | `money-rules`, `recurrence-safety`, `api-route` | A flow needs a schema change beyond a conditional update |
| P2 Offline correctness | HUB-119, then HUB-120 | `cache-invalidation`, `api-route`, Sync and Offline doc | A queued operation would have to be dropped to make a test pass |
| P3 Household resolver | HUB-121 | `api-route` §household, `db-migration` | The RLS snapshot is older than 90 days: ask the owner to refresh it first (Hard Rule 27) |
| P4 Local lane | DLV-150, DLV-152, DLV-153 | `Fable 2` Delivery docs 2 and 3 | Any step would give the agent process a production key |
| P5 Authorization contract | R90 (design and first five rows) | `api-route` | A route's intended access rule is not written anywhere |
| P6 Development database | DLV-154 (design and runbook only) | `db-migration`, `wizard` | Anything requires an action on the production project |
| P7 Research disposition | R85 | `triage-inbox`, `_Conventions.md` §8 | A finding implies a product decision the owner has not made |

P1 and P2 share one idea; the same author should do both ([Exactly-once](<../../03 - Junction Modules/Sync & Offline/Exactly-Once Remains Open.md>)).

## Heavyweight studies (proposed, not filed)

These are the areas this pass measured but did not open, or opened only far enough to see that they need a deeper read than an item-level fix. Each should end, like any study, with a disposition per finding. They are recorded in [Research options](<../../../Research/Options.md#fable-2-heavyweight-studies>).

| Study | Question it must answer | Why this tier | Examined in this pass |
|---|---|---|---|
| H1 Balance invariant | Is `stored balance = checkpoint + sum of deltas since the checkpoint` true for every write path, and what read-only reconciler would prove it from data? | 22 balance-adjust calls in 12 files, two-step writes (existing BUD-63), three account types, cross-currency transfers | Model read; paths not traced |
| H2 Exactly-once contract | One written contract for idempotent creates and claim-first transitions, applied to the eleven open items | Spans Budget, Hub, Notifications and the offline queue | Pattern identified from BUD-87 |
| H3 Household visibility model | For each shared table: who may read and write, enforced where (RLS, RPC, route), tested how | 43 service-role routes, five helpers, a 97-day-old RLS snapshot | Eight routes read |
| H4 Two recurrence engines | Can any path create a duplicate occurrence or payment across DST, pause, skip and catch-up? | The codebase names duplicate generation as its historical failure | Not examined |
| H5 AI data egress | Which household and health data classes reach which provider in which prompt, and what is the retention on each side? | Two providers, context injection from money and health modules | Not examined |
| H6 Local lane red team | Before guardrails ship: list every way a worktree agent could reach production data or `main`, and which guardrail stops it | It is the argument for removing the container | Design written, not attacked |

## What this tier should not be spent on

Link fixes, single-header changes, lint cleanups, repeating a fix across similar files after the first one is reviewed. Those are in the [low](<../CLAUDE_LOW/Work Packets.md>) and [mid](<../CLAUDE_MID/Work Packets.md>) packets.
