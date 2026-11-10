---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design; no scorecard has been computed."
---

# Agentic OS — deterministic evaluation

[Agentic OS index](<_index.md>) · [Flight recorder](<06 - Flight Recorder.md>) · next: [Skill launchpad](<08 - Skill Launchpad.md>) · items: [R96](<../../PM Tooling/PM Tooling — Master Book.md#r96>), [R99](<../../PM Tooling/PM Tooling — Master Book.md#r99>)

The aim is to answer "did this session do good work, and which model does it best" with numbers a script produced, so the answer is the same tomorrow and does not depend on asking a model.

## Two things are evaluated

| Unit | What it is | Question |
|---|---|---|
| **Session** | One agent run that ends in a diff | Was this run clean? |
| **Delivery** | Everything done for one item, from first session to shipped or abandoned | Did the item land, and what did it cost in sessions, rework and owner time? |

## The session scorecard

Six panels. Each is a set of facts, not a blended score.

| Panel | Facts | From |
|---|---|---|
| **Rules** | Per rule: pass, fail, improved, n/a. Count of new violations; count removed | [Detectors](<04 - Rule Enforcement Matrix.md>) on the diff and transcript |
| **Checks** | Typecheck result; lint warnings added and removed per rule; tests passed, failed, added; `pm:lint`; `docs:check`; `os:check` | Supervisor run |
| **Process** | Was `start-task` loaded; were the skills the changed paths require loaded; was `finish-task` loaded; was the PM trace written; was the right document read first | Transcript against the `requires` table below |
| **Scope** | Files changed against declared `Touches`; files outside the item's module; diff size | git, Master Book section |
| **Autonomy** | Questions asked, approvals needed, hook blocks hit, retries after a failed check | Transcript, hook log |
| **Cost** | Tokens by class, wall time, turns | Transcript, store |

### The `requires` table (already implied by `start-task`)

| If the diff touches | The session must have loaded |
|---|---|
| Money paths (the [risk-domain list](<../10 - Project Management/Delivery/2 - Local Lane Design.md>)) | `money-rules` |
| Recurrence paths, `rrule` imports | `recurrence-safety` |
| `src/app/api/` | `api-route` |
| `migrations/` | `db-migration` |
| Components, pages, styles | `ui-guardrails` |
| Files with `useMutation` or `invalidateQueries` | `cache-invalidation` |
| Date utilities, ISO strings in mutations | `timezone-handling` |
| Any `src/` or `migrations/` path | `start-task` first, `finish-task` last |

This turns the domain-risk gate from an instruction into a measurement. A session that edited `src/lib/balance.ts` without `money-rules` in its transcript shows a process failure even if every test passes.

## The delivery scorecard

| Fact | Meaning |
|---|---|
| Sessions to ship | How many runs the item took |
| Rework | Lines changed again within the same item after the first "done" |
| Owner minutes | Time between a session stopping and the owner's next action, summed (approximate; from timestamps) |
| UAT result | Pass, fail, blocked, per scenario |
| Escapes | Bug items filed later whose criteria cite this item, within 30 days |
| Reverted | Yes or no |
| Total cost | Tokens and wall time across all sessions |

**Escapes and reverts are the only true quality signal.** Everything in the session scorecard predicts them; over months the data shows which predictors matter, and the detectors that never correlate with an escape can be demoted.

## Comparing models and tiers

- Group by **tier alias and effort** from the Model Registry, and by **item class**: kind (bug, feature), risk domain (yes or no), effort (S, M), largest file touched.
- Show, per group: number of sessions, clean rate (no rule failure and all checks green), process-complete rate, median tokens per shipped item, escapes.
- **Always show n.** With a handful of sessions per group, show the raw rows instead of a rate. No ranking is drawn below ten sessions in a group.
- **Never a single score.** A model that is cheap and clean on small UI items and poor on money items should look exactly like that.
- **Setup fingerprint is a column.** Comparisons across a rule change are marked.

The first real output of this is a check on the [tier routing table](<../Model Tiers/_Routing.md>), which today is judgment.

## The Arena: a delivery gym (later)

The repository already has the pattern twice: the ERA Gym replays recorded model responses against fixed cases, and `tests/delivery-oracles/kit11-cooking-count.mjs` is a protected behavioural test for one delivery item. Generalised:

1. A **case** is a frozen starting commit, an item brief, and a hidden oracle (tests the agent never sees).
2. A **run** launches a chosen tier on the case in a worktree, under a recorded setup fingerprint.
3. The **result** is the oracle's pass or fail plus the ordinary scorecard.
4. Cases are harvested from real shipped items: the item's own acceptance test becomes the oracle, the commit before it becomes the start.

This is the only place where two models can be compared on identical work. It spends subscription usage, so, like live API passes under Hard Rule 29, **only the owner starts an Arena run**, and it is paced.

## What is deliberately not in the score

| Excluded | Why |
|---|---|
| A model's review of the diff | Not reproducible. Offered as a separate, labelled "second opinion" ([Codex packet C1](<../Model Tiers/CODEX/Work Packets.md>)) |
| Lines of code, sessions per day, tokens used as "productivity" | Volume is cost |
| Self-reported status ("all tests pass") | The supervisor's run is the record |
| Style preferences | Lint owns style |

## Honest limits

- A detector measures what it was written to see. A clean scorecard means "no known rule was broken", not "the change is correct". UAT stays.
- Process facts depend on transcripts. Sessions without one (Codex until its adapter exists, manual commits) get the Rules, Checks and Scope panels only.
- Small numbers. One owner, one repository: expect tens of sessions a month. The value is in catching the specific failure today, and in trends over a quarter, not in statistics.
