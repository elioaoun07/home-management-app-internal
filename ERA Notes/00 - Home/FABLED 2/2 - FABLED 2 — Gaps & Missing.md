---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/vault
---

# Home · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🟠 G1 — Unverified accuracy with front-door authority

`Module Index.md` predates the June reorganizations (Schedule PM restructure, new Overview docs, FABLED 2 generation). A newcomer — or an agent that wanders in — gets last month's map presented as current. Nothing flags its age; that's the whole gap.

## 🟡 G2 — No "how this vault works" page

The vault has sophisticated conventions (two indexes with different jobs, campaign uniform layout, FABLED generations, pain-inventory format, hard-rule escalation) — documented across CLAUDE.md and PM files, never in one reader-facing page. `Vault Setup.md` covers *structure*, not *operating system*. The first non-Elio reader (or any future re-onboarding) pays the assembly cost.

## 🟡 G3 — Duplicate maintenance surface

Dashboard.md + Module Index.md overlap each other *and* the PM index *and* the CLAUDE.md Feature Index. Three of those four have enforcement; Home's two have none — meaning Home can only ever be the stalest copy. A hand-maintained duplicate of a script-checked index is a liability by construction.
