---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/templates
---

# Templates · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — Scaffolders over templates (the Atlas lesson, generalized)

The vault's only universally-used template is the one a script instantiates. Extend the pattern: `scripts/new-campaign.mjs <module>` and `scripts/new-fabled.mjs <scope>` generating the folders from O1's forms with names/links/frontmatter pre-filled — the same craft as `new-module.mjs`. A template that types itself gets used every time.
**Kill criterion:** these fire a few times a year — if O1's copy-paste forms prove frictionless enough in practice, scripts are over-engineering; skip without guilt.

## E2 — Frontmatter contracts as the real template

When PM-as-data lands ([PM FABLED 2.4 · E1](<../../10 - Project Management/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)), the binding part of each template becomes its **frontmatter schema** (required keys per doc type, validated by the scanner). The prose sections stay suggestions; the metadata becomes contract — which is the split that actually matters for tooling.

## E3 — Templates for the machine's documents

The generated artifacts (reconciliation report, weekly git-delta, scorecards) will need output shapes too. Defining them here — one MD stub each — keeps human-written and machine-written vault documents in one visual family, which is what makes a generated dashboard feel like part of the vault instead of a bolt-on.
