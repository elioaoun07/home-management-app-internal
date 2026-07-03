---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/backlog
---

# Backlog & Ideas · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — The quarterly idea review (the ritual that keeps O1 done)

Twenty minutes, once a quarter, ideally feeding the FAR-cadence review: skim `status: raw` entries, promote/park/reject in batch. Pairs with the PM dashboard listing raw-idea counts so the backlog's untriaged mass is visible ([PM FABLED 2.4 · E1](<../../10 - Project Management/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) frontmatter makes it queryable).

## E2 — Capture from the Hub (ideas are household chat too)

"ERA, idea: fridge camera that tracks expiry" → a message action ("Save as idea") appending to `Ideas.md` with the lifecycle header pre-filled. The app already turns chat into transactions and reminders; ideas are the third obvious record type — and the cheapest (append-only, no schema).
**Kill criterion:** if fewer than ~2 ideas/month arrive by voice/chat in practice, the manual file was enough — delete the action.

## E3 — Idea ↔ enhancement cross-index, generated

When PM frontmatter exists, a script section on the dashboard: raw ideas vs FABLED 2 enhancements with fuzzy-matched candidates ("Vol. 3's 'price memory' ≈ Budget E3 stage 3 — mark superseded?"). Turns future triage passes from archaeology into review.

## E4 — The graveyard with reasons

Rejected ideas keep their why ("rejected 2026-07: open-banking replaced by SMS capture — see FAR C9"). A year of reasons becomes the project's taste, written down — the most reread file this directory could produce, and the cheapest to maintain (it's O1's ❌ tags, collected).
