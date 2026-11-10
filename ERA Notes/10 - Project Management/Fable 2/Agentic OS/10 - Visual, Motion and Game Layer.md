---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design. Baseline numbers used as examples are this pass's measurements."
---

# Agentic OS — visual, motion and game layer

[Agentic OS index](<_index.md>) · [PM.2 product design](<09 - PM.2 Product Design.md>) · next: [Architecture](<11 - Architecture.md>) · items: [R97](<../../PM Tooling/PM Tooling — Master Book.md#r97>), [R99](<../../PM Tooling/PM Tooling — Master Book.md#r99>)

The current Command Center already has a coherent dark theme, good type and a clean phone bar ([visual review](<../10 - Project Management/Command Center/1 - Usability and Visual Review.md>)). PM.2 keeps that language and adds a small set of visuals that each show one true thing.

## Signature visuals

| Visual | Shows | Built from |
|---|---|---|
| **Setup map** | Six columns of nodes with lines for "enforces" and "mirrors". A rule with no line is visibly alone | [Registry](<03 - Setup Registry.md>) |
| **Rule shield** | Five fill states: outline (written), half (reminded), three quarters (checked), full (blocked), eye (judgment). One per rule, 29 in a grid | [Rule matrix](<04 - Rule Enforcement Matrix.md>) |
| **Verdict strip** | 29 small ticks per session: green pass, red fail, blue improved, grey n/a. Sessions stack into a heat map where a column of red is a rule that keeps failing | Detectors |
| **Flight path** | A session as a horizontal line with stations: prompt, skills, reading, edits, hooks, checks, verdicts, UAT, ship | [Flight recorder](<06 - Flight Recorder.md>) |
| **Debt bar** | A bar per rule with existing violations, shrinking as sessions remove them: rule 22 starts at 184, rule 6 at 96 | Detector counts on `main` |
| **Fingerprint glyph** | A small symmetric pattern derived from the setup hash. Same rules, same glyph | Setup fingerprint |
| **Parity meter** | Two arcs, Claude and Codex, filled by how much of the setup each really has | Registry `applies-to` |
| **Tier card** | One per model tier: sessions, clean rate, tokens per shipped item, escapes, with n printed | Scorecards |
| **Runway** | Weeks until Now is empty at the current shipping rate | Checklists, shipped log |

## Motion

Each animation exists because it tells the owner something happened.

| Moment | Motion | Meaning |
|---|---|---|
| A hook fires during a live session | A pulse travels the line from the hook node to its rule | The guard just ran |
| A hook blocks | The pulse stops at the hook and the node flashes once | Something was prevented |
| A detector verdict arrives | The tick drops into its slot in the strip, one after another | The evaluation is running, in order |
| A rule gains a detector | Its shield fills to the next level | Coverage improved |
| A session ends clean | The streak counter increments with a short spark | One more clean run |
| A debt bar loses violations | The bar shortens and the removed amount floats off as a number | Debt was paid, by how much |
| The setup changes | The fingerprint glyph morphs to the new pattern | Rules are no longer the same as before |
| A conflict is resolved | Its row folds away and the conflict count ticks down | One less contradiction |

Rules for motion: under 400 ms, never looping, never blocking input, and all of it off under the system's reduced-motion setting (the existing app already reads it). No sound.

## The game layer

A game is only worth adding if winning it is the same as doing the right work. Each mechanic below is a real measurement with a goal.

| Mechanic | What it measures | How it advances | Why it is honest |
|---|---|---|---|
| **Clean streak** | Consecutive sessions with no new rule violation and green checks | +1 per clean session; resets on a fail | Cannot be raised by volume, only by clean work |
| **Shield wall** | Rules guarded, out of 29 (today 7) | A rule levels up when a detector or blocking hook lands | Each level is a commit that exists |
| **Debt bosses** | Each rule with baseline violations is a boss whose health is the count | Health drops when a session removes violations; a boss is defeated at zero and the rule can then be promoted to Blocked | The number is a grep anyone can rerun |
| **Parity quest** | Codex and Copilot coverage against Claude | Completes when the parity meter is full | Ends when a query returns no rows |
| **Zero conflicts** | `os:check` errors and warnings | A badge held only while the count is zero | Lost the moment drift returns |
| **Weekly five** | The global Now of five from [backlog health](<../10 - Project Management/Portfolio/Backlog Health.md>) | A ring with five segments, filled by items shipped after UAT | Shipped means the owner signed off |
| **Net burn** | Shipped minus added, per week | A week is "won" when it is positive | Punishes filing without delivering, including by analysis sessions like this one |
| **First flights** | One-time badges: first Local-lane ship, first Arena case, first rule promoted to Blocked, first week with zero escapes | Awarded once | Marks milestones in the [roadmap](<12 - Roadmap.md>) |
| **Tier cards** | The models as collectible cards with real statistics | Stats update with every evaluated session | Makes the routing decision visible and a little fun |

### What the game must never do

- **No points for activity.** Sessions run, tokens used, lines written and items filed earn nothing.
- **No hidden numbers.** Every counter opens the list of sessions, files or rows behind it.
- **No shame mechanics.** A broken streak shows what failed and where, once. It does not nag.
- **No rewards for the tool itself.** Building PM.2 earns no badge. Only product items count toward the weekly five.
- **A calm switch.** One setting turns the game layer off and leaves the same facts as plain numbers.

## A first-screen sketch with the layer on

```text
 era · PM.2                                   ◈ setup 91ab   ✦ streak 3   ◐ 7/29

 NEEDS YOU 3        RUNNING 1                 NEXT UP
 UAT BUD-95         HUB-118 ▓▓▓▓░ checks      BUD-89 ▸   BUD-90 ▸   HUB-119 ▸

 WEEKLY FIVE  ◔ 1/5        NET BURN  −38 this week        RUNWAY  — (no shipping rate yet)

 BOSSES   console ████████████████ 184    raw fetch █████████ 96    cron secret ▌ 2
 PARITY   Claude ●●●●●●●●●●   Codex ●●○○○○○○○○
```

The numbers in the sketch are the real baseline where one exists (184, 96, 2, 7 of 29, and this filing's effect on net burn); the rest are placeholders.
