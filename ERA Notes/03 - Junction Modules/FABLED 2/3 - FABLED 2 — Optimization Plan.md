---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/junction
---

# Junction Modules · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Matrix](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Extract one household-expansion helper (fixes G3)

`src/lib/household/expand.ts`: resolve active partner ids (all links, deduped — the cron fix's hardened shape), apply `ownOnly`, return the id set. Adopt route-by-route on touch; write its unit test once (multi-link, stale-link, no-link cases — the exact matrix the June bug lived in). The canonical copy in `accounts/route.ts:28-52` becomes the first caller.

## O2 — Rehearse the fact-bridge before building the big one (fixes the §2 backlog safely)

Debt → Reminder first ([Budget FABLED 2.4 · E4](<../../10 - Project Management/Budget/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)): one owner (Budget), one projection (Schedule), link id stored for cleanup, settlement completes the reminder. Every design question Recurring↔Schedule will ask, answered at 1/10 the blast radius. Only then E2/E7.

## O3 — Junction smoke tests, one per bridge kind (fixes file 1 §4 cheaply)

Not full integration suites — one table-driven test per *pattern*: message-action → record (created once, replay-safe) · household expansion (O1's test) · draft confirm → record · trip cascade symmetry (post-verification, [Trips FABLED 2.3 · O3](<../../10 - Project Management/Trips/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)'s SQL check). Four tests would have caught three of June's four cross-module bugs.

## O4 — Mark the junction dirs (fixes G4)

The fitness-function allowlist ([Standalone FABLED 2.3 · O5](<../../02 - Standalone Modules/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) + one README line per junction dir ("Junction module — may import standalones; standalones must not import this"). Ten minutes, permanent.

## O5 — The one-line queue tripwire (fixes G6)

Header comment in `useHubPersistence.ts`: "LEGACY localStorage queue — sanctioned for shopping list ONLY (CLAUDE.md); do not migrate, do not extend."

---

### Sequencing

```
O1 (helper + test — the June bug's real fix) → O2 (bridge rehearsal)
  → O3 (smoke tests as each pattern is touched) · O4/O5 in the hygiene sweep
```
