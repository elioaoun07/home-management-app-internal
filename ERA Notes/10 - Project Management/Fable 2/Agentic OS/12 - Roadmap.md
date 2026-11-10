---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed sequence. Session counts are estimates, not measurements."
---

# Agentic OS — roadmap

[Agentic OS index](<_index.md>) · [Architecture](<11 - Architecture.md>) · tiers: [Model tier routing](<../Model Tiers/_Routing.md>)

Eight steps. The first three need no interface and already answer the owner's main questions. Each step ends with something usable, so stopping after any of them leaves working tools, not half a product.

## Steps

| Step | Outcome | Item | Depends on | Tier | Estimate |
|---|---|---|---|---|---|
| A0 | The setup is the same for every agent: Codex and `.agents` copies generated from the Claude sources, dead and duplicate config removed, paths portable, pre-commit executable, stale lists corrected | [R92](<../../PM Tooling/PM Tooling — Master Book.md#r92>) | none (pairs with R84) | CLAUDE_MID | 1 session |
| A1 | `pnpm os:scan` writes the registry; `pnpm os:check` lists conflicts and runs in CI | [R93](<../../PM Tooling/PM Tooling — Master Book.md#r93>) | none | CLAUDE_MID | 1–2 sessions |
| A2 | `pnpm os:eval <base>..<head>` prints rule verdicts for any change, from eight detectors with fixtures | [R94](<../../PM Tooling/PM Tooling — Master Book.md#r94>) | R93 | CLAUDE_MID, CLAUDE_LOW for repeats | 2 sessions |
| A3 | Every Claude session leaves a flight report: hook runner, transcript ingest, store, Markdown export | [R95](<../../PM Tooling/PM Tooling — Master Book.md#r95>) | R93 | CLAUDE_HIGH for the runner, then CLAUDE_MID | 2–3 sessions |
| A4 | Full scorecards: process panel from the `requires` table, delivery scorecard, remaining detectors, Codex and Delivery adapters | [R96](<../../PM Tooling/PM Tooling — Master Book.md#r96>) | R94, R95 | CLAUDE_MID | 2 sessions |
| A5 | PM.2: Setup (map, rulebook, conflicts), Sessions, Bridge, Score; Home, Delivery and Analytics move into it; older UIs retired | [R97](<../../PM Tooling/PM Tooling — Master Book.md#r97>) | R93 for Setup; R95 for Sessions | CLAUDE_MID, with CLAUDE_HIGH for the map | 4–6 sessions, split before dispatch |
| A6 | Launchpad: forms for eight skills, recipes, copy prompt; launch into a worktree once the Local lane exists | [R98](<../../PM Tooling/PM Tooling — Master Book.md#r98>) | R93; DLV-150 for launching | CLAUDE_MID | 2–3 sessions |
| A7 | Arena cases harvested from shipped items; the game layer | [R99](<../../PM Tooling/PM Tooling — Master Book.md#r99>) | R96, R97 | CLAUDE_HIGH for the Arena | open |

## The smallest version worth having

**A0 + A1 + A2**, about four sessions, no interface:

- `os:check` tells you which part of the setup contradicts which.
- `os:eval` tells you which Hard Rule a change broke, with file and line, for Claude, Codex or your own commit.
- CI runs both, so the answer does not depend on remembering to ask.

If that is all that ever gets built, it is still the deterministic evaluation the owner asked for. Everything after it is recording, comparing and showing.

## Order against the other work

1. **R84** first (the production deny list). It is the same kind of fix as A0 and it is urgent.
2. **A0**, then **A1** and **A2**.
3. **The Local lane** (DLV-150 to DLV-153). `os:eval` becomes the supervisor's check in that lane, so the two meet here: a local delivery ends with a scorecard.
4. **A3** and **A4**, once there are sessions worth recording.
5. **A5** and **A6**, when the command-line reports have been used for a few weeks and it is clear which numbers matter.
6. **A7** last.

`_Conventions.md` §6 limits consecutive tooling sessions. This roadmap is all tooling, so it is meant to be interleaved: at most two of these sessions, then a product item from the global Now ([backlog health](<../10 - Project Management/Portfolio/Backlog Health.md>)).

## Stop rules

| After | Stop or change course if |
|---|---|
| A2 | Ten evaluated changes produce no verdict that changed what was shipped. Then the detectors are measuring the wrong things; fix them before recording more |
| A4 | Process facts never disagree with outcomes. Then drop the process panel and keep rules and checks |
| A5 | The Bridge is not the first screen opened in a normal week. Then PM.2 has not earned replacing Home; keep it as a Setup viewer only |
| A6 | Forms are used for fewer than half of skill launches after a month. Then keep copy-prompt and stop |
| A7 | Any time: the Arena spends subscription usage the owner would rather give to product work |

## Exit evidence per step

| Step | Evidence |
|---|---|
| A0 | `diff` between each generated copy and its source is empty; a Codex session is observed being blocked from editing `src/components/ui/`; a commit on a Linux clone runs the pre-commit hook |
| A1 | The registry at the then-current commit reproduces the hand inventory's counts; `os:check` reports the thirteen conflict classes' remaining rows and exits non-zero on an injected mirror drift |
| A2 | Each detector's three fixtures pass; `os:eval` on the commit that introduced a known violation reports it |
| A3 | A real session's report shows its skills, hooks and verdicts; removing the runner leaves hooks working |
| A4 | A session that edits a money path without loading `money-rules` shows a process failure |
| A5 | Fresh browser: Setup renders from the registry with no sessions recorded; the old Home route redirects to Bridge |
| A6 | `new-module` launched from its form with zero follow-up questions about inputs |
| A7 | One case run on two tiers with both scorecards side by side |

## What the owner decides along the way

1. Whether Codex stays a first-class agent in this repository. If yes, A0 generates its setup; if no, A0 removes `.codex/` and `.agents/` and parity stops being a goal.
2. Whether `settings.local.json` should stay committed.
3. Where PM.2 lives in the navigation when it replaces Home.
4. Whether the game layer is on by default.
