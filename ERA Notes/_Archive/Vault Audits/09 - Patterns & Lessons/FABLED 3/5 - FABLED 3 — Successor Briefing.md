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
  - vault/patterns
---

# Patterns & Lessons · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

## Who should read this

You are an AI model about to edit documents in `ERA Notes/09 - Patterns & Lessons/`. Docs work is the safest work in the repo — but these files are load-bearing (agents boot from them), so wrong docs are worse than no docs.

## First 5 minutes

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- "ERA Notes/09 - Patterns & Lessons"
```

Then skim the section's `FABLED 2/_index.md` scoreboard (frozen) and this pack's `_index` ledger.

## Rules of the section

- **Augment, never duplicate** (Documentation Rules): update the existing doc; a parallel doc is a future zombie.
- ⚠️ This section is GITIGNORED — local to this machine only. Nothing here travels with the repo; never cite it as shared truth to another environment.
- Any claim you write about code must carry a verify command or a source path — the FABLED house style applies to all vault docs now.

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Local-only section | citing these docs in repo-tracked files as if shared | gitignored; a fresh clone will not have them |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Still gitignored | `git check-ignore "ERA Notes/09 - Patterns & Lessons" && echo IGNORED` | IGNORED |

## What FABLED 2 got wrong here

Nothing.
