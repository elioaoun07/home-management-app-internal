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
  - scope/vault
  - vault/standalone
---

# Standalone Modules · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

## Who should read this

You are an AI model about to edit documents in `ERA Notes/02 - Standalone Modules/`. Docs work is the safest work in the repo — but these files are load-bearing (agents boot from them), so wrong docs are worse than no docs.

## First 5 minutes

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- "ERA Notes/02 - Standalone Modules"
```

Then skim the section's `FABLED 2/_index.md` scoreboard (frozen) and this pack's `_index` ledger.

## Rules of the section

- **Augment, never duplicate** (Documentation Rules): update the existing doc; a parallel doc is a future zombie.
- Module doc edits are any-model: augment the existing doc, never create a parallel one.
- Any claim you write about code must carry a verify command or a source path — the FABLED house style applies to all vault docs now.

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Outfits has no code | trying to edit src/features/outfits | docs-only campaign; first code ships later — check the campaign checklist |
| Healthcare slug | creating /api/health anything | slug is `healthcare`; `/api/health` is the connectivity probe (Hard Rule 7) |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Healthcare doc exists | `ls "ERA Notes/02 - Standalone Modules/Healthcare/Overview.md"` | exists |

## What FABLED 2 got wrong here

Nothing — its dead-weight list was accurate; two of its items died today, the rest are tracked in campaign FABLED 3 files.
