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
  - vault/junction
---

# Junction Modules · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

## Who should read this

You are an AI model about to edit documents in `ERA Notes/03 - Junction Modules/`. Docs work is the safest work in the repo — but these files are load-bearing (agents boot from them), so wrong docs are worse than no docs.

## First 5 minutes

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- "ERA Notes/03 - Junction Modules"
```

Then skim the section's `FABLED 2/_index.md` scoreboard (frozen) and this pack's `_index` ledger.

## Rules of the section

- **Augment, never duplicate** (Documentation Rules): update the existing doc; a parallel doc is a future zombie.
- Doc edits any-model; but junction docs describe cascades — verify against code before recording a claimed behavior.
- Any claim you write about code must carry a verify command or a source path — the FABLED house style applies to all vault docs now.

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Junction docs must trace all ends | documenting one side of a bridge | list every connected standalone and its contract; the allergen bridge is the newest example |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Private Chats doc exists | `ls "ERA Notes/03 - Junction Modules/Hub Chat/Private Chats.md"` | exists |

## What FABLED 2 got wrong here

Nothing; its 3.5 was the vault's most honest low score and remains earned.
