---
created: 2026-07-11
type: enhancement-study-index
status: current
owner: Elio
evidence_cutoff: 2026-07-11
baseline: FABLED 2 (2026-07-02) plus git delta through 0f33396
tags:
  - pm/fabled-plus
  - scope/whole-app
  - study/closed-loop
---

# FABLED+ Enhancement Study — Index

> A complementary study over the current repository, not a replacement for FABLED 2. FABLED 2 remains the verified maturity baseline; FABLED+ asks a different question: **how does each feature turn household reality into a safe decision, a completed outcome, and useful learning?**

## Why this layer exists

The existing audits are strong at implementation truth, missing capability, optimization, and future ideas. This pass preserves that work and adds five lenses that cut across every feature:

1. **Outcome loop:** observe → interpret → propose → commit → verify → learn.
2. **Truth envelope:** every derived fact should expose source, confidence, freshness, and effective time.
3. **Bounded agency:** new automation progresses through shadow → suggest → assist → automate-with-undo, never by a single leap.
4. **Household negotiation:** two people need consent, handoff, conflict, and privacy semantics—not only shared visibility.
5. **Attention return:** success is avoided decisions, prevented surprises, and recovered attention—not feature engagement.

This is why the layer is named **FABLED+**, not FABLED 3. The July 2 generation is only nine days old and has not crossed its own supersession threshold. FABLED+ is an additive decision lens with a separate shelf life.

## Standard pack

Every global or feature folder uses the same FABLED-inspired anatomy:

| # | File | Purpose |
|---|---|---|
| 1 | `1 - Feature State.md` | Verified implementation footprint, distinctive assets, and the feature's current outcome-loop coverage. |
| 2 | `2 - Vision & Roadmap.md` | Product feedback, enhancement thesis, business value, and a staged future that complements existing roadmaps. |
| 3 | `3 - Action Plan.md` | A sequenced path from smallest proof to hardened capability, with gates and explicit non-goals. |
| 4 | `4 - Checklist.md` | Checkable Now / Next / Later work, including the new 10× bets, success measures, kill criteria, and definition of done. |
| — | `_index.md` | Verdict, loop-readiness score, evidence boundary, and links. |

## Scoring model

Each feature receives six scores from 0–5. These are **loop-readiness**, not maturity, so they must not be compared directly with FABLED 2's 0–10 scoreboard.

| Dimension | Question |
|---|---|
| **Truth** | Can a user tell what is known, inferred, stale, or unverified? |
| **Capture** | Can reality enter with near-zero friction and survive offline conditions? |
| **Decision** | Does the feature turn facts into a clear next decision without inventing certainty? |
| **Action safety** | Are commit, idempotency, visibility, and Undo explicit? |
| **Learning** | Does the feature observe whether its suggestion or action actually helped? |
| **Partnership** | Are both people's ownership, consent, privacy, and conflict semantics designed? |

`Loop readiness = sum / 30`. A low score is not a defect verdict. Some precision tools should remain intentionally narrow; their strategy can be to expose a clean signal or capability rather than become autonomous.

## Evidence boundary

- Source graph: **807 code files** plus **70 current strategy/audit documents**, 3,656 nodes and 4,338 edges.
- Repository inventory: **809 TypeScript/JavaScript source files**, **248,367 LOC**, **187 API routes**, **38 pages**, **87 schema tables**.
- Protection inventory: **15 test files**; baseline run on 2026-07-11 = **126 passing / 1 failing** (the existing flexible-occurrence view guard).
- Static checks: `npm run typecheck` passed; `npm run docs:check` passed; full lint exceeded the 120-second audit window and is recorded as unmeasured, not green.
- Delta window: `git log --oneline --since=2026-07-02` through `0f33396` (Recurring redesign, Alerts/Notifications, Google Calendar sync, Hub Chat changes).
- Live database caveat: repository schema is authoritative for table shape, but not a complete snapshot of live RLS policies or function bodies.

## Evidence discipline

- A statement labeled **verified** cites a current source path and line or a command run on 2026-07-11.
- A statement labeled **inference** is a design conclusion from two or more verified observations.
- A proposal is never phrased as shipped capability.
- Existing FABLED/FAR ideas are excluded from the 10× files unless a proposal changes their mechanism materially; overlaps are named rather than disguised.
- Counts are snapshots, not permanent truths. Re-run the command before implementation.

## Navigation

- [Global study](<Global/_index.md>)
- [Standalone features](<Features/Standalone/_index.md>)
- [Junction features](<Features/Junction/_index.md>)
- [Cross-cutting systems](<Features/Cross-Cutting/_index.md>)

## How to use the study

1. Read the feature's file 1 to verify the starting position.
2. Pick one leverage gap from file 2, not every gap.
3. Run file 3's smallest proof and stop at its evidence gate.
4. Promote a file 4 bet only when its dependency and appetite gates are true.
5. When implementation ships, update the normal campaign PM files and FABLED 2 delta ledger; FABLED+ remains a study, not a second execution queue.

## Freshness rule

Re-audit a pack when one of these triggers fires: its main route or data model changes; a new cross-module bridge ships; its loop-readiness score would move by at least 4/30; or 90 days pass. Do not rewrite all packs on a calendar merely to refresh dates.
