---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/junction
---

# Junction Modules · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Matrix](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**
>
> Layer-level bets. Module-specific bridges live in campaign file 4s; these are the junctions *between* junctions.

---

## E1 — The spine ⭐ (signals → composer → policy → delivery)

The layer's defining build; ordering and staging at [FAR FABLED 2.3](<../../10 - Project Management/Functional Architecture Review/FABLED 2/3 - FABLED 2 — Optimization Plan.md>); receiving surfaces at [Hub & ERA FABLED 2.4 · E1](<../../10 - Project Management/Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) and [Notifications FABLED 2.4 · E1](<../../10 - Project Management/Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>). Listed here because it *is* the junction layer's next chapter — one spine every module lights up.

## E2 — The proposal grammar (one UX for every machine suggestion)

**Impact: High coherence · Effort: S (a doc + discipline), M (a shared component)**

Bulk-convert review sheet, drafts drawer, future low-stock proposals, briefing action cards — all are "machine proposes, human disposes." Standardize the grammar: provenance line ("why am I seeing this") · accept / edit / dismiss · undo after accept · never silent. First as a written pattern ([09 - Patterns FABLED 2](<../../09 - Patterns & Lessons/FABLED 2/_index.md>)), then as a shared `ProposalCard` when the third producer ships. This is the trust interface of the whole proactive era — worth designing once, well.

## E3 — The modes engine (Trips generalized)

The reversal-ledger machinery as a generic context-switch engine (sick / guest / crunch modes) — owned at [Trips FABLED 2.4 · E7](<../../10 - Project Management/Trips/FABLED 2/4 - FABLED 2 — Future Enhancements.md>), gated hard on verification + real-trip mileage. The junction layer's most elegant future idea, and the easiest to build too early.

## E4 — Cross-module undo (the ledger pattern, everywhere)

**Impact: High trust · Effort: H — horizon item**

Hard Rule #1 gives per-mutation undo; junction actions (message→transaction, trip activation, future proposal-accepts) create *clusters* of effects. The `trip_side_effects` pattern generalizes: junction writers log effect groups; undo walks the group. Prerequisite: the event log ([Architecture FABLED 2.4 · E4](<../../01 - Architecture/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) or per-junction ledgers. **Kill criterion:** wait for two real "I wish I could undo that whole thing" incidents; don't build reversal infrastructure on hypothesis.

## E5 — Junction analytics: which bridges earn their keep

**Impact: Low–Med · Effort: S once events exist**

Bridge usage counts (message-actions/week, drafts confirmed vs discarded, proposals accepted vs dismissed) on the dashboard. Bridges are bets; usage data retires the losers. The act/dismiss recording ([Notifications FABLED 2.3 · O4](<../../10 - Project Management/Notifications & Alerts/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) is the first tributary.

---

## Recommended order

```
E2 pattern doc (cheap, shapes everything) → E1 spine (policy-first staging)
  → E5 when data accrues → E3 gated on Trips trust → E4 horizon
```
