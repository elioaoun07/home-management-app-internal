---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/vault
---

# Home · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Make Home a router, not a mirror (fixes G3 permanently)

Rewrite `Dashboard.md`/`Module Index.md` down to **pointers with purpose descriptions**: "modules → Feature Map (validated) · status → PM Feature State · what next → PM file 4 · deep dives → FABLED 2 folders." A router can't go stale the way a mirror does, because it duplicates *nothing*. One sitting; delete more than you write. *(These are index files — updating them is within the current docs-freeze exception, but the rewrite is worth its own deliberate pass rather than a drive-by.)*

## O2 — Write the "how this vault works" page (fixes G2)

One `Operating System.md` in Home: the two-index rule, campaign layout, FABLED generations, pain format, escalation ladder, the enforcement map (what's script-checked vs hand-maintained). ~40 lines; every future reader (human or agent) starts here.

## O3 — Put Home in the link-checker's path (fixes G1's recurrence)

When the vault link checker ships ([PM FABLED 2.3 · O3](<../../10 - Project Management/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)), Home's pointers get verified with everything else — the first time anything mechanical watches this folder.
