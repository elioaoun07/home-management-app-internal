---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/vault
---

# Home · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 1 · The doors into the vault, ranked by actual traffic

| Door | Who uses it | State |
|---|---|---|
| **Feature Map** (`01 - Architecture/Feature Map/`) | every AI session (mandatory checklist step 1) | actively maintained, `docs:check`-validated — the true front door |
| **PM Command Center** (`10 - Project Management/_index.md`) | planning sessions, "what next" | living, freshly stamped |
| **PM dashboard** (`_dashboard.html` / `pnpm pm`) | visual overview | new tooling, in flight |
| **`00 - Home/Dashboard.md` + `Module Index.md`** | Obsidian-first human browsing | exists; freshness unverified; not referenced by any workflow |
| **CLAUDE.md Feature Index** | agents needing vault-doc routing | validated against the Feature Map by script |

The design insight: this vault's navigation *evolved away from* its Home folder — the working doors are the ones with enforcement (scripts, hooks, checklists) attached. Home remains the only door whose accuracy nothing checks.

## 2 · What Home still uniquely offers

A *human* overview for Obsidian reading sessions: graph-adjacent browsing, a curated "start here" for a future second reader (partner, collaborator), and the one place the vault's *purpose* can be stated in prose rather than tables. That's a real job — smaller than the file believes, but real.
