---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. This pass did not re-read the sync engine; it relies on the Major Bug Sweep's cited lines for O1 and O2 and on the Budget and Hub checklists."
---

# Sync & Offline — exactly-once is still open across four campaigns

[Fable 2 index](<../../_index.md>) · items: [HUB-119](<../../../Hub & ERA/Hub & ERA — Master Book.md#hub-119>), [HUB-120](<../../../Hub & ERA/Hub & ERA — Master Book.md#hub-120>), [BUD-90](<../../../Budget/Budget — Master Book.md#bud-90>) · source study: [Major Bug Sweep O1](<../../../Research/Major Bug Sweep.md#o1>), [O2](<../../../Research/Major Bug Sweep.md#o2>)

## The pattern

The same question, "did this write happen once?", is open in separate items owned by separate campaigns, each solving it locally:

| Where | Item | State |
|---|---|---|
| Transfers | BUD-87 | Shipped 2026-11-03: client-generated id, `23505` treated as a replay |
| Transaction create under offline replay | HUB-120 | Filed 2026-11-10 from the sweep |
| Recurring confirm, future-payment confirm, split completion, debt settle | BUD-90 | Filed 2026-11-10 from the sweep |
| Draft confirmation | BUD-64 | Open, Later |
| Recurring coverage per period | BUD-85 | Open, Next |
| Money restore | BUD-24, BUD-92 | Open, Next |
| Balance and history in one transaction | BUD-63 | Open, Next |
| Statement import rows and balances | BUD-65, BUD-71 | Open, Later |
| Item-reminder push | NOTIF-23 | Filed 2026-11-10 from the sweep |
| Offline queue dropping writes | HUB-119 | Filed 2026-11-10 from the sweep |

Twelve items, one idea. BUD-87 already contains the working answer for this codebase: the client mints the row id, the server inserts with it, and a unique-violation means "already done, return the existing row".

## What is missing

A single stated contract that every mutating money and schedule route follows, so the eleven remaining items become applications of a rule instead of eleven designs:

1. Every create carries a client-generated id (or an idempotency key stored with the row).
2. Every state transition is a conditional update that returns the row only to the caller that won; the loser gets 409 and posts nothing.
3. The offline queue stores that id from the moment the operation is created, never drops an operation without the user choosing to, and treats a timeout as "unknown, replay safely" because rule 1 makes replay safe.
4. Balance, history and the row commit together (BUD-63).

This is recorded as a heavyweight study, not a new checklist item, because the work already has owners: see [CLAUDE_HIGH work packets](<../../Model Tiers/CLAUDE_HIGH/Work Packets.md>), study H2. Doing BUD-90 and HUB-120 first, in that order, by the same author, would establish the pattern the rest can copy.

## Not examined

The sync engine's conflict handling, the legacy localStorage queue used by the shopping list, and realtime reconnection were not read in this pass.
