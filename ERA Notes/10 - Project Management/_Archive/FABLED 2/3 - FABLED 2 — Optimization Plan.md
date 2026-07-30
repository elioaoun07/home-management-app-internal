---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/meta
---

# Project Management · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Refresh the two authority files (1 hour; fixes G2's acute case)

Global [Feature State](<../2 - Feature State — Current Reality.md>) + [Codebase & AI Setup Audit](<../1 - Codebase & AI Setup Audit.md>): update the falsified claims (test baseline now 93 tests/9 suites; all module Overview docs exist; evaluator files exist as stubs; orphan list current), stamp each section with its verify date. Don't rewrite — patch and date, the way the campaign files already do.

## O2 — The hygiene sweep ritual (fixes G1 — the system's highest-leverage change)

A recurring **90-minute slot** (first session of each week, or the 1st of the month) that executes *only* items from the standing sweep list — never features. Seed list (all verified open today): delete `MobileItemForm.tsx` · delete `sttCapture.ts`/`vadGate.ts` · delete `blink/`/`today/` dirs · remove/guard the 4 debug routes · snapshot Trips RPCs · fix the failing placement guard test. That single slot, run twice, clears **every** item in G1's table. The ritual matters more than the list: micro-debt needs a *time home*, not better documentation.

## O3 — Link checker on the existing scanner (fixes G3; ~1 hour of code)

`scripts/pm/scan.mjs` already walks every MD file. Add: extract relative links → resolve → report dead ones; wire into `pnpm docs:check` (already in pre-commit). From then on, a rename that breaks 40 links fails the commit that caused it, not the reader three weeks later.

## O4 — Declare checklist precedence (fixes G5; one paragraph)

Rule proposal: **campaign file 4 is authoritative** for module work; the FAR/audit checklists are *sources* that get promoted into campaign checklists (with a back-reference) and struck through at the source when promoted. The weekly plan references campaign items, never re-states them. Write it into the PM `_index` usage section.

## O5 — Commit the PM tooling (fixes G6; 15 minutes)

`git add scripts/pm-server.mjs scripts/pm/ tests/` + the `package.json` script entries, one commit. Iterate committed.

## O6 — FABLED lifecycle rule (prevents FABLED 2 from rotting like v1's links)

Convention going forward: FABLED generations are **frozen at write** (v1 stays as-is); the *current* generation gets one **delta pass per campaign end** (not per session — Hard Rule #25 keeps the campaign files current between passes). When FABLED 3 is ever written, FABLED 2 freezes. Add one line to each campaign `_index` saying which generation is current — that's the entire mechanism.

---

### Sequencing

```
O5 (15 min, protects real work) → O1 (authority refresh) → O2 (book the ritual, run sweep #1)
  → O3 (link checker) → O4 + O6 (conventions, one sitting)
```
