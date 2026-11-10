---
created: 2026-11-10
updated: 2026-11-10
type: study-index
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Inventory and baseline numbers were measured in this pass; everything else is a plan. Nothing here is implemented."
---

# Agentic OS — from Command Center to PM.2

[Fable 2 index](<../_index.md>) · [PM home](<../../_index.md>)

**Owner commission, 2026-11-10 (second request).** Evolve the PM Command Center into an operating layer for the AI agents working in this repository: see everything the Claude Code and Codex setup contains, evaluate every session deterministically (which Hard Rule failed, which hook contradicts what), launch skills from forms, and get an interactive, animated, gamified dashboard (PM.2) while the existing Command Center stays the place for documents. Plans only.

## The plan in one picture

```text
        SEE                    JUDGE                   RECORD                 ACT
 ┌──────────────┐      ┌───────────────┐      ┌────────────────┐     ┌──────────────┐
 │ Setup        │      │ Rule          │      │ Flight         │     │ Skill        │
 │ registry     │─────►│ detectors     │─────►│ recorder       │◄────│ launchpad    │
 │ + conflicts  │      │ + scorecards  │      │ (per session)  │     │ (forms)      │
 └──────┬───────┘      └───────┬───────┘      └───────┬────────┘     └──────┬───────┘
        └──────────────────────┴───────── PM.2 cockpit ────────────────────┘
                     Bridge · Launch · Sessions · Setup · Score
                              PM.1 stays the Library
```

## What is true today (measured)

- **7 of 29 Hard Rules have any mechanism behind them**; 22 are text. None is fully covered for Codex.
- **Claude gets 18 skills and 8 hook wirings; Codex gets 2 skills (one stale) and hook configuration that points at one machine's absolute path.**
- **13 kinds of setup conflict exist right now**, all found by looking, none by a tool.
- Ordinary Claude Code and Codex sessions leave **no record** in the project; only Delivery V2 runs do.
- Every skill's inputs live in prose. `new-module` alone has eight.

## Documents

| # | Document | Answers |
|---|---|---|
| 01 | [Vision and hype filter](<01 - Vision and Hype Filter.md>) | What an "Agentic OS" is worth here, what to skip, the principles |
| 02 | [Current setup inventory](<02 - Current Setup Inventory.md>) | What the setup contains per agent, today |
| 03 | [Setup registry](<03 - Setup Registry.md>) | The one generated file everything reads; global and per-session setup views |
| 04 | [Rule enforcement matrix](<04 - Rule Enforcement Matrix.md>) | Each of the 29 rules: how it is enforced now, the detector that would decide it |
| 05 | [Conflict and drift detector](<05 - Conflict and Drift Detector.md>) | How "which hook contradicts what" becomes a query; the 13 classes with live cases |
| 06 | [Flight recorder](<06 - Flight Recorder.md>) | What every session leaves behind and where it comes from |
| 07 | [Deterministic evaluation](<07 - Deterministic Evaluation.md>) | Session and delivery scorecards, model comparison, the Arena |
| 08 | [Skill launchpad](<08 - Skill Launchpad.md>) | Forms for skills, with `new-module` worked through |
| 09 | [PM.2 product design](<09 - PM.2 Product Design.md>) | Screens, navigation, and how today's views split between PM.1 and PM.2 |
| 10 | [Visual, motion and game layer](<10 - Visual, Motion and Game Layer.md>) | The visuals, what each animation means, an honest game layer |
| 11 | [Architecture](<11 - Architecture.md>) | Data flow, layout, commands, reuse, contracts, tests |
| 12 | [Roadmap](<12 - Roadmap.md>) | Eight steps, the smallest useful version, stop rules |

## How each thing the owner asked for is covered

| Asked | Where |
|---|---|
| Visuals of everything the Claude Code and Codex setup can do: skills, agents, hooks, `CLAUDE.md`, hard rules | Setup map and rulebook ([09](<09 - PM.2 Product Design.md>), [10](<10 - Visual, Motion and Game Layer.md>)), fed by the registry ([03](<03 - Setup Registry.md>)) |
| A global setup view | [03](<03 - Setup Registry.md>), [02](<02 - Current Setup Inventory.md>) |
| A per-delivery-session setup view | Effective setup and setup diff ([03](<03 - Setup Registry.md>), [06](<06 - Flight Recorder.md>)) |
| Which hard rule failed | Detectors and verdicts ([04](<04 - Rule Enforcement Matrix.md>), [07](<07 - Deterministic Evaluation.md>)) |
| Which hook contradicts another thing | [05](<05 - Conflict and Drift Detector.md>); hook-against-skill in [06](<06 - Flight Recorder.md>) |
| A deterministic way to evaluate AIs and their delivery outcome | [07](<07 - Deterministic Evaluation.md>) |
| A form to fill a skill's variables | [08](<08 - Skill Launchpad.md>) |
| The existing Command Center as a document place, PM.2 as an interactive dashboard | [09](<09 - PM.2 Product Design.md>) |
| Visuals, animations, gamification | [10](<10 - Visual, Motion and Game Layer.md>) |
| Separating real benefit from hype | [01](<01 - Vision and Hype Filter.md>), stop rules in [12](<12 - Roadmap.md>) |

## Items

Filed in PM Tooling on 2026-11-10: R92 in Next, the rest in Later. None is started.

| Step | Item | Outcome |
|---|---|---|
| A0 | [R92](<../../PM Tooling/PM Tooling — Master Book.md#r92>) | One setup for every agent; current drift removed |
| A1 | [R93](<../../PM Tooling/PM Tooling — Master Book.md#r93>) | Setup registry and conflict check |
| A2 | [R94](<../../PM Tooling/PM Tooling — Master Book.md#r94>) | Rule detectors and `os:eval` |
| A3 | [R95](<../../PM Tooling/PM Tooling — Master Book.md#r95>) | Flight recorder |
| A4 | [R96](<../../PM Tooling/PM Tooling — Master Book.md#r96>) | Scorecards |
| A5 | [R97](<../../PM Tooling/PM Tooling — Master Book.md#r97>) | PM.2 cockpit |
| A6 | [R98](<../../PM Tooling/PM Tooling — Master Book.md#r98>) | Skill launchpad |
| A7 | [R99](<../../PM Tooling/PM Tooling — Master Book.md#r99>) | Arena and game layer |

**Start with A0 to A2.** They are scripts, about four sessions, and they already tell you which rule a change broke and which part of the setup contradicts which.

## Read in this order

01 for the stance, 02 for where things stand, 04 and 05 for the two findings that matter most, 12 for what to do. The rest when a step is about to be built.
