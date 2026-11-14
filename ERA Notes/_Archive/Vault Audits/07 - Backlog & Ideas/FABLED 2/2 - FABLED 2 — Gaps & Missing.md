---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/backlog
---

# Backlog & Ideas · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🟠 G1 — No lifecycle, so no trust

An idea file where everything might be stale teaches readers to skip it — which is why only deliberate reviews (FAR) ever mine this directory. Without `promoted/parked/rejected` marks, the directory can't answer its one query: *"what's here that we haven't already decided about?"*

## 🟠 G2 — The FAR's return-path was never executed

FAR 7's own convention ("adopting an item = mark it here") wasn't applied to this directory's entries. The June review's adoptions (capture upgrade, price book, weekly review, modes engine…) exist in the FAR unmarked at their source. One pass reconciles it — do it before memory of the mapping fades entirely.

## 🟡 G3 — Four capture files, one topic

`Feature Ideas`, `Ideas`, `Innovative Feature Ideas`, `Proactive Life Optimization Ideas` — the split predates the vision volumes and no rule says where a new idea goes. Merge or give each a one-line charter.

## 🟡 G4 — Shipped specs sit unmarked

`Dashboard V2 Instructions` partially shipped (June's Analytics work); the file doesn't say so. A spec that shipped is either archive material or a delta list — unmarked, it reads as pending work.

## ⚪ G5 — `Schema Reminder.sql` is a stray

SQL notes belong next to `migrations/` (or as a dated migration if live). Misfiled curiosities erode the directory's signal.
