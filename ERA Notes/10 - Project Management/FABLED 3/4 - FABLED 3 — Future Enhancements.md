---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/4 - FABLED 2 — Future Enhancements.md
tags:
  - pm/fabled3
  - pm/meta
---

# Project Management · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2's PM-as-data and auto-delta-report ideas largely **shipped** (the SPA parses conventions into data; the static twin is generated). This list is the gen-3 ladder.

- **E1 — `pnpm fabled:verify` ⭐ (the generation-3 payoff)** · Impact high · Effort M · Seam: every campaign's FABLED 3 file 5 carries a machine-parseable *verification manifest* (claim → command → expected). A runner that executes them and prints per-campaign drift would turn the audit layer from "trust the stamp date" into "run the stamps." Reuses `shared/md-scan.mjs` table parsing. **Kill criterion: do not build until the manifests have existed for 30 days and a human has manually run at least three of them — if nobody runs them by hand, automating them automates neglect.**
- **E2 — Handoff-readiness on the board** ⭐ · Impact medium · Effort S · Seam: `store.js` already parses FABLED frontmatter for `inFabled`; surface each campaign's Handoff-readiness score as a chip on module cards, so "what can I safely delegate to a smaller model" is visible at a glance. Kill: if agent-delegated sessions aren't actually happening within 60 days, remove the chip.
- **E3 — Ledger-append helper** ⭐ · Impact medium · Effort S · Seam: `mutations.mjs` already writes checklist toggles; a "append delta line to campaign FABLED 3 _index" mutation (date + commit + text) makes Hard Rule 25's ledger half one click. Kill: if ledgers are being appended by hand without friction complaints, skip.
- **E4 — Radar v2: oldest-open-S-item nag** (carried, sharpened) · Impact high · Effort S · Seam: `session-brief.sh` already scans checklists; print the single oldest open `_(… - S)_` item vault-wide each session start. This operationalizes O1 with zero new state. Kill: none — this is the cluster's cheapest high-leverage move.
