---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/standalone
---

# Standalone Modules · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Portfolio](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — The orphan pile is a fixture now

`blink/` (empty), `today/` (empty), `navigation/` (one misfiled prefetch util), `dashboard/` (prefetch-only dir shadowing a real module) — flagged 2026-05-29, re-flagged in the FAR, re-flagged in the audit, verified still present today. Individually trivial; collectively they make every `ls src/features` lie about the portfolio, and empty dirs are exactly the traps agent sessions fall into. One sweep session ([PM FABLED 2.3 · O2](<../../10 - Project Management/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## 🟠 G2 — Unclassified members

- **`memories/`** — hooks + types, one referencer, feeding ERA's brain face *someday*. Promote-or-fold has been pending since May; ERA's E7 (memory-grounded answers) is blocked on it.
- **`receipts`** — an API route + page with no vault doc, no Atlas confirmation, no owner. Fold into Statement Import or document.
- **`era/` + `voice-conversation/` + `hub/` living under "standalone"** — they're junction surfaces per the module model; either the CLAUDE.md table or the dir layout should say so explicitly (the audit's P2 "classify top-level feature directories" is this).

## 🟠 G3 — Eleven modules have no PM home

Catalogue, NFC, Chores, Focus, Dashboard, Guest Portal, Watch, Error Logs, Recycle Bin, Preferences, Analytics-client: no campaign folder, so their pains have nowhere ranked to land (Hard Rule #25 routes fixes to "the relevant module campaign folder" — which doesn't exist for them). They don't each need a folder; they need **one shared home** ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G4 — The 🔵 band's uniform zero-test state

Stable-but-unprotected describes ~12 modules. Not all deserve tests — but three carry money/data weight with pure-function cores that test cheaply: **Preferences** (LBP thousands rule, month-start), **Catalogue** (slug/link logic), **NFC** (slug resolution, tap actions). One test file each, chosen for blast radius.

## 🟡 G5 — Boundary rule unverified

"Standalones must not import from each other" is checked by nobody. Believed-held ≠ held; the 20-line fitness function ([Architecture FABLED 2.4 · E6](<../../01 - Architecture/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) converts belief into fact and keeps it fact.

## ⚪ G6 — This directory lacks its own index

Same as Architecture: 25 module folders, no `_index.md` with a tier/status column. The global Feature State table does the job at PM level; a thin index here would give the vault-side view (and the PM reconciliation script a target).
