---
created: 2026-11-04
updated: 2026-11-04
type: template
status: draft
owner: Elio
evidence_cutoff: "commit 1c586d0 (2026-11-04)"
---

# ERA Handoff Template

[README](README.md) · [Briefing](ERA-BRIEFING.md) · [Navigation Guide](NAVIGATION-GUIDE.md) · **Handoff Template**

Use this when stopping work another AI (or you, later) will continue: end of a session, a context limit, a model switch, or a task passed between agents. It is a message format, not a new document type.

## 1. Where a handoff goes

Do **not** add a handoff file to the repo for routine work: PM Conventions §3 allows each campaign exactly a Master Book and a checklist, and the Doctrine warns against new documents where an existing one suffices.

| Situation | Put it |
|---|---|
| Work finished and verified | Final reply plus a Shipped Log entry in the owning Master Book (ID, date, evidence). Tick the checklist item (Hard Rule 25) |
| Work paused or partly done | Final reply (this template); open items stay as checklist items; durable lessons go in the Master Book's Successor Briefing |
| A bug found, not fixed | Master Book Pain Inventory with a 🔴/🟠/🟡/⚪ lead |
| A choice only the owner can make | `_Decisions.md` (cross-campaign) or the Master Book decisions; name it in "Unresolved" below |
| Research or documentation task | A short README in the task's output folder, as in `docs/era-research/` |
| A commit or PR | Put §2's Changed files, Validation and Unresolved in the body; add the session link and attribution lines the harness requires |

## 2. The template

Copy everything inside the fence. Delete sections that are truly empty rather than writing "none" in five places, except **Validation**, which is never omitted.

````markdown
# Handoff: <task name or ID> (<YYYY-MM-DD>)

Branch: <name> · Base: <commit> · Head: <commit> · Working tree: clean | dirty (<files>)
Task ID: <SCH-n / BUD-n / HUB-n / none> · Campaign: <name> · Task type: <bug | feature | new-module | api | db | ui | docs/pm | research>

## 1. Objective
GOAL: <what changes for the user, one sentence>
DONE WHEN: <observable behaviour that proves it>
OUT OF SCOPE: <what was deliberately not touched>
Status: done | partly done | blocked | abandoned (<one line why>)

## 2. Scope
- Modules touched: <module (Standalone|Junction)>; read but not touched: <list>
- Domain-risk gate: money <y/n> · recurrence/dates <y/n> · household visibility <y/n> · cached/offline state <y/n>
- Playbooks followed: <skills>
- Boundaries kept: no production write (Rule 26) · no live paid API (Rule 29) · generated mirrors and `src/components/ui/` untouched

## 3. Decisions
| Decision | Made by (owner / agent / existing rule) | Source | Reversible? |
|---|---|---|---|
| <what was chosen over what> | <who> | <Hard Rule N / Doctrine § / owner message date / Master Book §> | <y/n, how> |

Owner decisions still needed are listed in section 7, not here.

## 4. Evidence
Label each claim: CURRENT IMPLEMENTATION (read in code), DOCUMENTED INTENT, PROPOSED DESIGN, UNKNOWN (needs live DB, device, scheduler or owner).
| Claim | Label | Source (path:symbol or path:line, commit or date) |
|---|---|---|
| <claim> | <label> | <source> |

Conflicts found between sources (file once; do not patch elsewhere): <source A says X; code says Y; which I used and why>

## 5. Changed files
Command: `git diff --stat <base>..<head>` (paste or summarise)
| Path | Kind (code / test / migration / schema / doc / PM) | Why |
|---|---|---|
Pairings: migration file ↔ `schema.sql` <ok | n/a> · PM checklist/Master Book updated <ok | n/a, because ...> · Feature Map / vault doc / Atlas updated <ok | n/a>
Not committed or not pushed: <list, or none>

## 6. Validation actually performed
Only list what was run, with the result you saw. "Not run" is a valid, required entry.
| Check | Command or method | Result | Run by me? |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | <pass / N errors / not run: reason> | |
| Lint | `pnpm lint` | | |
| Tests | `pnpm vitest run <path>` | <files/tests passed, skipped> | |
| Docs index | `pnpm docs:check` | | |
| PM lint | `pnpm pm:lint` | | |
| Manual / device | <steps and the screen state seen> | | |
| Production, live RLS, scheduler, paid API | not touched | UNKNOWN | no |
What this validation does **not** show: <for example: runs on replays only; not on a phone; not against RLS>

## 7. Unresolved
| Question | Needs | Blocks | Where recorded |
|---|---|---|---|
| <question> | owner decision / refreshed `db-state.json` / device test / more code reading | <what cannot proceed> | <_Decisions.md / Master Book / this message only> |

## 8. Next action
<One concrete step a cold start can take.> First command: `<command>`. Expected result: <what you should see>. If instead <X>, stop and ask.

Do not: <traps this session found, e.g. "do not trust Feature Map X; it is stale, see ...">

## 9. Refresh before trusting this handoff
- Re-run `git log --oneline <head>..HEAD` and `git status`.
- <facts above that can change: db-state age, cron liveness, a checklist state, a counter>
````

## 3. Rules for filling it in

1. **Evidence beats narrative.** A claim without a path and commit is an opinion. Cite `path:symbol`, not "the balance code".
2. **Validation is what you ran.** Never write "tests pass" from reading code, from a previous session, or from a hook that did not fire. If the environment had no `node_modules`, say so.
3. **Link, do not copy.** Refer to Hard Rules by number, skills by name, tasks by ID, research by section ([Navigation Guide §6](NAVIGATION-GUIDE.md#6-one-fact-one-home)). A handoff that restates a rule creates a second version that will disagree later.
4. **Separate the four labels.** Findings (current behaviour) must not be mixed with proposals; unknowns must not be rounded to "probably".
5. **Name what you did not do.** Scope you skipped and checks you could not run are the most valuable lines.
6. **One next action,** not a plan. If the plan matters, it belongs in the Master Book's execution plan for the item.
7. **Mark dated claims.** Anything that depends on the live database, scheduler or a device states the date it was last observed, or says UNKNOWN.
8. **Keep it to a page or two.** If the handoff needs more, the detail belongs in a Master Book section, a research folder README, or a commit message, and the handoff links to it.

## 4. Receiving a handoff

Before acting on one:

1. Read `CLAUDE.md` and run the [start-task](../../../.claude/skills/start-task/SKILL.md) protocol yourself; a handoff does not replace it.
2. `git status`, then `git log --oneline <head>..HEAD`. If the branch moved, assume the handoff's evidence may be stale.
3. Spot-check two claims from section 4 against the code. If either fails, treat the whole handoff as DOCUMENTED INTENT.
4. Treat section 6 as what *was* run, not what is true now; re-run the cheap checks.
5. Do the **Next action**, or state why you are not.

## 5. Worked example (fictional)

The task, names, amounts, commits and test are invented to show the format. The Feature Map auto-post disagreement is real and is cited from the atlas. Do not rely on the rest.

````markdown
# Handoff: Gym membership shows due twice (2026-11-04)

Branch: claude/example-branch · Base: aaaa111 · Head: bbbb222 · Working tree: clean
Task ID: none (new Pain Inventory row proposed) · Campaign: Budget · Task type: bug

## 1. Objective
GOAL: A monthly recurring payment, "Gym membership" (fictional, 40 USD), appears once in the due list.
DONE WHEN: with the payment due on 31 and a billing month starting on 31, the list shows one row in every month.
OUT OF SCOPE: auto-posting; billing-month setting UI.
Status: partly done (cause found, fix not applied)

## 2. Scope
- Modules touched: Recurring Payments (Standalone); read: Preferences, Dashboard
- Domain-risk gate: money y · recurrence/dates y · household visibility n · cached/offline state n
- Playbooks followed: fix-bug, recurrence-safety, timezone-handling
- Boundaries kept: no production write · no live paid API · mirrors and ui/ untouched

## 3. Decisions
| Decision | Made by | Source | Reversible? |
|---|---|---|---|
| Treat the commitments engine as the only recurring-payment expander | existing rule | Doctrine §4 "one engine per concept" | n/a |

## 4. Evidence
| Claim | Label | Source |
|---|---|---|
| The due list is built from the commitments module | CURRENT IMPLEMENTATION | src/features/recurring/commitments.ts, symbol for due-date matching, bbbb222 |
| The Feature Map says a cron posts due payments | DOCUMENTED INTENT | Feature Map recurring-payments.md; code has no such cron |
| Whether the duplicate also occurs in production | UNKNOWN | needs the owner to look at the live list |
Conflicts found: Feature Map vs code on auto-posting; used the code. Already recorded in 01-atlas §8.4, not re-filed.

## 5. Changed files
`git diff --stat aaaa111..bbbb222`: 1 file
| Path | Kind | Why |
|---|---|---|
| src/features/recurring/commitments.test.ts | test | failing case for day-31 billing month (fictional) |
Pairings: migration ↔ schema n/a · PM Pain Inventory row drafted but not added, see section 7 · Feature Map n/a
Not committed or not pushed: none

## 6. Validation actually performed
| Check | Command | Result | Run by me? |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | not run: no node_modules in this environment | no |
| Tests | `pnpm vitest run src/features/recurring` | not run, same reason | no |
| Manual reasoning | traced the 31 Oct and 30 Nov cases through the code | duplicate row predicted, not observed | yes |
| Production, live RLS, scheduler, paid API | not touched | UNKNOWN | no |
What this does not show: that the duplicate occurs on a device or in production.

## 7. Unresolved
| Question | Needs | Blocks | Where recorded |
|---|---|---|---|
| Which period is correct for day 31 | owner decision | the fix | to be added to Budget Master Book decisions |
| Add the Pain Inventory row | next session with PM access | Hard Rule 25 compliance | this message only |

## 8. Next action
Install dependencies, run `pnpm vitest run src/features/recurring`, expect the new test to fail with two rows; then wait for the owner's decision before changing code. If it passes, stop and re-read the trace.
Do not: edit the Feature Map's auto-post line here; it is filed in the atlas.

## 9. Refresh before trusting this handoff
- `git log --oneline bbbb222..HEAD`; check whether the Budget Master Book gained a decision on day-31 periods.
````
