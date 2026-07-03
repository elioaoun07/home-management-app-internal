---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/standalone
---

# Standalone Modules · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Portfolio](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**
>
> Portfolio-level ideas only — per-module dreams live in their campaign FABLED 2 file 4s.

---

## E1 — Module lifecycle states (making the portfolio honest by construction)

**Impact: Med–High · Effort: S**

Every module declares one of: `active` (campaign-owned) · `stable` (maintained, no roadmap) · `frozen` (untouched until named trigger — the Trips proposal) · `deprecated` (delete path named). Lives in the module manifest ([Architecture FABLED 2.4 · E2](<../../01 - Architecture/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) or the vault doc frontmatter; surfaced on the PM dashboard. Kills the "is anyone supposed to be working on this?" ambiguity that let Trips drift five weeks unowned.
**Kill criterion:** if statuses aren't consulted within a month of existing (check: did any weekly plan reference one?), they're ceremony — drop them.

## E2 — Per-module scorecards, generated

**Impact: Med · Effort: S after the reconciliation script**

The [file 1](<1 - FABLED 2 — Current Implementation.md>) matrices, computed: doc? tests? campaign? LOC hotspots? last-touched? One dashboard table replacing hand-audits like this folder's. The FABLED 2 recon did it manually; the script makes it a button ([PM FABLED 2.4 · E2](<../../10 - Project Management/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

## E3 — The module template gets a "day-2 kit"

**Impact: Med · Effort: S**

`new-module.mjs` scaffolds day-1 structure. Add the day-2 files every mature module eventually grew: a `queryKeys.ts`, one seed test file wired to vitest, a vault-doc stub with the tier table, and a manifest entry. New modules start protected instead of joining the 🔵 zero-test band by default.

## E4 — Standalone graduation reviews

**Impact: Low–Med (rhythm) · Effort: 0 (a calendar habit)**

Twice a quarter, one 🔵 module gets promoted deliberately: doc refreshed, one test added, pains harvested into the small-modules campaign, status set. Over a year the whole stable band cycles through without ever needing a "testing sprint" nobody wants.

---

## Recommended order

```
E3 (template kit — cheap, compounds forever) → E1 (statuses with O4's decisions)
  → E2 (rides the reconciliation script) → E4 (start the rhythm anytime)
```
