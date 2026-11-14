---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/standalone
---

# Standalone Modules · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Portfolio](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — The sweep (fixes G1; inside the PM hygiene ritual)

Delete `blink/` + `today/` · move `navigation/`'s util to `src/lib/prefetch/` · merge `dashboard/`'s prefetch into the real Dashboard module's structure (or `src/lib`). Update the CLAUDE.md orphan table + global Feature State ⚫ section in the same session (Hard Rule #25).

## O2 — One "Modules (Small)" campaign folder (fixes G3)

A single PM folder with the uniform 4-file layout whose Feature State is a **table of the eleven homeless modules** (tier, pains, next step each). Pains from any of them land there, ranked together. If one module's section outgrows the shared file — that's the signal it earned its own campaign folder. Zero new process; one folder.

## O3 — Three cheap test files by blast radius (fixes G4)

1. `preferences`: LBP thousands conversion + custom month-start round-trips (this logic multiplies every displayed amount).
2. `catalogue`: slug matching + link resolution (cross-user slug matching is a module Hard Rule — pin it).
3. `nfc`: tag-slug → action resolution (it operates in the physical world where debugging is worst).

## O4 — Decide `memories/` and `receipts` (fixes G2; two decisions, one hour)

`memories`: promote (give it the module treatment: doc, owner, roadmap) **or** fold its hooks into `era/` and delete the dir. `receipts`: fold into Statement Import's doc + Feature Map entry **or** document as its own thin module. Either answer beats the current undecided state — both are blocking downstream items (ERA E7; audit P2).

## O5 — Mechanize the boundary (fixes G5)

The cross-import fitness function, run in pre-commit next to `docs:check`. 20 lines against `src/features/*/` import statements with a junction allowlist (`hub`, `era`, `trips`, `voice-conversation`, `memories` pending O4).

---

### Sequencing

```
O1 (sweep slot #1) → O4 (two decisions) → O2 (one folder) → O5 (one script) → O3 (one file per idle hour)
```
