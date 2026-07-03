---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/junction
---

# Junction Modules · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Matrix](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — One unverified heavy cascade (Trips)

The layer's only irreversibility risk, five weeks old, environment moving under it. Fully argued at [Trips FABLED 2.2 · G1/G2](<../../10 - Project Management/Trips/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>) — listed here because it's a *layer* risk: it can corrupt three other modules' data in one call.

## 🔴 G2 — The spine doesn't exist

No signals, no composer, no policy, no feedback ([file 1 §3](<1 - FABLED 2 — Current Implementation.md>)). The app's identity claim (proactive assistant) lives or dies here, and after three FAR weeks it hasn't started. The July-corrected build order exists ([FAR FABLED 2.3](<../../10 - Project Management/Functional Architecture Review/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)); what's missing is the first session.

## 🟠 G3 — Household expansion: pervasive, hand-rolled, untested

Hard Rule 13's pattern (`household_links` + `ownOnly`) is re-implemented per route by hand. The June cron bug (`.maybeSingle()` on multi-row links dropping the partner) shows the failure mode: each hand-rolled copy is one subtle Supabase behavior away from silently excluding a household member. No shared helper, no test, no inventory of which routes expand correctly.

## 🟠 G4 — The junction dirs are architecturally mislabeled

`hub/`, `era/`, `voice-conversation/`, `trips/`, `memories/` sit in `src/features/` beside standalones with no marker that different import rules apply to them. The model lives only in CLAUDE.md tables. The classify-and-mark item (audit P2, [Standalone FABLED 2.3 · O5](<../../02 - Standalone Modules/FABLED 2/3 - FABLED 2 — Optimization Plan.md>) allowlist) fixes it mechanically.

## 🟡 G5 — Offline replay across junctions is untested

A queued message-action that creates a transaction, replayed after reconnect: does it double-create? The idempotency pattern exists (Schedule's upserts) but hasn't been audited across the junction writers ([Architecture FABLED 2.3 · O4](<../../01 - Architecture/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G6 — Shopping List's queue exception is one doc-line from a footgun

Sanctioned legacy localStorage queue, documented in CLAUDE.md + Kitchen docs — but not marked *in the code* near where a well-meaning migration would start (`useHubPersistence.ts`). One header comment closes the last hole.

## ⚪ G7 — Prerequisites is a junction with one working edge

NFC→item works; the other evaluator edges are scaffolded stubs. Fine as a staged build — the gap is that its junction table row says "trigger engine" while 4/5 trigger types are inert; keep the claim honest in docs until `time_window` ships ([Schedule FABLED 2.4 · E2](<../../10 - Project Management/Schedule/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).
