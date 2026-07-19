---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - pm/meta
---

# Project Management · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to edit PM documents or PM tooling. The docs side is the safest place in the repo for any model — grammar is machine-checked. The tooling side (`scripts/pm/`) is bespoke untyped JS — respect it.

## First 10 minutes in this cluster

```bash
pnpm pm:lint                                     # must be clean before AND after your edits
npx vitest run tests/pm-ui/                      # 7 files, all green expected
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- scripts/pm "ERA Notes/10 - Project Management"
```

Then read: `../_Conventions.md` (the grammar — updated 2026-07-15) → `scripts/pm/shared/md-scan.mjs` (how docs become data) → [3.1](<1 - FABLED 3 — Current Implementation.md>) §1 (the SPA map).

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| Checklist/Feature-State/Roadmap edits, done-stamps, new campaign items | **any-model** | follow `_Conventions.md` grammar exactly; validate with `pnpm pm:lint` |
| Appending a FABLED 3 delta-ledger line | **any-model** | date + commit hash + what shipped + which score dimension moves; never edit old lines |
| New campaign folder scaffold | **any-model** | copy an existing campaign's 4-file layout verbatim (Healthcare is the newest clean example) |
| Dashboard UI changes (`scripts/pm/src/`) | **mid-tier+** | untyped JSX; run `pnpm pm:build-ui` + `npx vitest run tests/pm-ui/` after every change; keep static twin parity |
| Parser/lint core (`shared/*.mjs`, `lint.mjs`, `scan.mjs`) | **mid-tier+** | everything downstream trusts these; extend `tests/pm-ui/` FIRST, then change |
| Creating a new FABLED generation or changing generation rules | **human-first** | generational events are owner decisions — see Master Index 3 for the FABLED 4 criteria |

**Out-of-depth tells — stop if:** `pnpm pm:lint` fails and you're about to edit the *linter* instead of your document; you're renaming a campaign folder (breaks `CAMPAIGNS` prefix map in lint.mjs + every relative link); you're about to write a new "status report" doc instead of updating file 1 of a campaign (that's how zombies are born).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| The `inFabled` hide regex | your new doc vanishes from `pnpm pm` | any path containing `FABLED*` or frontmatter status superseded/baseline-frozen/template is auto-hidden — this is intended for audit layers, wrong for active docs |
| Checklist grammar is exact | lint E3/E4 errors | `- [ ] **PREFIX-n** outcome _(severity - effort)_` under `## Now/Next/Later` — no emoji severity, no `S-M` ranges, no nesting |
| Postpone is view-state only | "postponed" tasks reappear | localStorage, keyed by task text; editing the line resets it — by design |
| Static twin drift | `_dashboard.html` shows different data than `pnpm pm` | regenerate via `pnpm pm:dashboard`; `static-twin.test.ts` is the guard |
| Frontmatter `status` is load-bearing | doc hidden or lint-skipped unexpectedly | superseded/baseline-frozen/template all hide; check before assigning |
| PWA service worker | board looks current but is cached | hard-reload / bump SW cache when testing dashboard changes (Gap #4 until O4 ships) |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| PM lint clean | `pnpm pm:lint` | exit 0 |
| PM tooling tests green | `npx vitest run tests/pm-ui/` | 7 files pass |
| Gen-3 auto-hidden | `grep -n "inFabled" scripts/pm/src/app/store.js` | regex `FABLED[^/]*` present |
| Tooling size claim | `find scripts/pm -name "*.mjs" -o -name "*.js" -o -name "*.jsx" \| xargs wc -l \| tail -1` | ≈7,150 |
| Old Feature State is dead | `head -8 "ERA Notes/10 - Project Management/2 - Feature State — Current Reality.md"` | `status: superseded` |

## What FABLED 2 got wrong here

Its Freshness=4 evidence ("Updated 2026-05-30" zombie) was fixed by *supersession*, which v2 didn't anticipate as a valid resolution — it assumed updating was the only cure. Killing a doc honestly counts. Its Tooling=7 underestimated how fast the dashboard would become a real app; the cost it failed to predict was type-safety debt, which broke typecheck for five days in July.
