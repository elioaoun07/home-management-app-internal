---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 6beed34, 2026-11-10. History is from the six docs/ERA-Steward-*.md files, the Delivery Master Book and scripts/delivery-v2/steward-*.mjs. The contract is a design; nothing in it is built. No product capability of Dot or of any future supervisor is assumed beyond the floor stated in §5."
---

# ERA Steward — the supervisor contract

[Fable 2 index](<../../_index.md>) · [Diagnosis](<1 - Diagnosis.md>) · [Local lane design](<2 - Local Lane Design.md>) · [Gate disposition](<3 - Gate Disposition.md>) · [Migration](<4 - Migration and Retirement.md>) · item: [DLV-156](<../../../Delivery/Delivery — Master Book.md#dlv-156>)

This document closes the question of how an assistant (OpenAI's Dot today, Claude Duet or anything else later) supervises and orchestrates delivery. Every choice is made here. Section 10 lists them; the owner changes one by editing that table, not by reopening the design.

## 1. Why it never shipped end to end

From the repository's own record:

| # | Cause | Evidence |
|---|---|---|
| 1 | **The supervisor was put on top of the confined path, so supervising meant repairing an environment.** Docker pipe access, dependency volumes, compiler snapshots, checker heap, image assembly, a worker client that did not advertise the chosen model, readiness that expired in two minutes | `docs/ERA-Steward-Setup-Summary.md`: two installs of 9 and 10 minutes, three full preparation attempts consumed, an approval at each new boundary |
| 2 | **It acted through a screen made for a person.** "Open the page, press Start once, wait, read the blocker word for word" | `docs/ERA-Steward-Runbook.md`, "Steward — Run delivery for item" |
| 3 | **The typed route needs five links to all work:** Dot → private plugin → tunnel client → stdio server → Command Center. Four of its six setup phases are still pending | `docs/ERA-Steward-Dot-Connection-Setup-2026-10-25.md`, phases 3 to 6 |
| 4 | **It had no authority, so it gave no leverage.** Plan approval, renewals, Apply and every diagnosis came back to the owner, who also relayed messages between agents | Setup summary, "Approvals, retries, and phone confusion" |
| 5 | **Its own work was invisible.** Status questions were answered by spending model turns that Delivery did not count | Delivery book, Pain Inventory, 2026-10-24 |
| 6 | **Sign-off asked for a proof that cannot exist:** that the assistant will never use its other coding tools. Its vendor documents such rules as fallible | Runbook, step 6 of the connection; UAT scenario M1 |
| 7 | **Nothing defined the finish line for a supervisor.** The furthest a Steward-started run reached was a plan waiting for approval (`r-262a6aee5ed3`, 2026-10-19). The one applied run (`r-46688acd1b86`, 2026-10-24) was started and applied by the owner, and `docs/Delivery-UAT.md` records no sign-off | Setup summary; `docs/R44-Delivery-Acceptance-2026-10-24.md` |

One sentence: the supervisor was asked to operate a machine that was itself not operable, through an interface not meant for it, with no power to finish anything.

## 2. The decision

1. **Delivery is run by a conductor: a deterministic script with a fixed state machine.** It needs no assistant. The owner can drive it alone from a terminal or the Command Center.
2. **A supervisor is an optional voice on top of the conductor.** It issues a small set of verbs and reads structured answers. It adds what only language adds: choosing within a mandate, drafting, summarising, chasing.
3. **The supervisor works on the Local lane only** ([design](<2 - Local Lane Design.md>)): a branch in a worktree, host checks, the owner's merge. There is no environment for it to diagnose.
4. **Authority is fixed by which verbs exist, not by instructions the supervisor is trusted to follow.**

So end-to-end shipping is proven first **without** any supervisor. Connecting Dot, or Duet later, then cannot break delivery and cannot be the reason it does not ship.

## 3. Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| **Owner** | Elio | Sets the mandate, reviews risk-domain diffs, runs UAT, ships, undoes | n/a |
| **Conductor** | Scripts in this repo | Runs the state machine, creates the worktree, launches the worker, runs checks, computes the scorecard, writes the PM trace on ship | Decides anything that is not in §4 |
| **Worker** | One Claude Code or Codex session per run | Plans, edits, tests and commits inside its worktree, with the repo's rules, skills and hooks loaded | Pushes, merges, leaves its worktree |
| **Steward** | Dot, Duet, or nobody | Calls the eight verbs in §6 | Writes code, approves a review, ships, edits rules or the mandate |

"ERA Steward" is the name of the role. Which product fills it is a setting.

## 4. The state machine

One run is always in exactly one state. Every transition is made by the conductor.

| State | Entered when | Who acts next | Leaves when | Time limit | On failure |
|---|---|---|---|---|---|
| `queued` | `start` accepted | Conductor | Preflight begins | 1 min | `failed: conductor` |
| `preflight` | Always first | Conductor | The three checks pass: base branch known and tree clean; subscription CLI signed in and no API key present; dependencies match the lockfile | 2 min | `needs-owner` with the one failing check and its fix |
| `building` | Worktree and branch exist, worker launched with the brief | Worker | The worker stops with at least one commit | 60 min, and stalled after 20 min without an event | `failed: stalled` or `failed: no-change` |
| `question` | The worker asks something | Steward or owner (§7) | An answer is recorded | 24 h | `needs-owner` |
| `checking` | Worker stopped | Conductor | Typecheck, lint and tests finish on the host, plus the rule detectors once they exist | 15 min | `failed: checks-could-not-run` |
| `repairing` | A check or a rule failed | Worker, same session, given the failing output | Worker stops again | Two rounds at most | `returned: checks-red` |
| `review-hold` | The diff touches a risk domain | Owner | The owner approves or returns it | none | Stays; reported daily |
| `uat-ready` | Checks green and no hold, or hold approved; handover written | Owner | The owner records pass or needs-changes | none | Stays; reported daily |
| `returned` | Needs-changes, review returned, or checks red after two rounds | Owner or Steward | A new `start` continues on the same branch with the feedback as the brief | n/a | n/a |
| `signed-off` | UAT pass recorded on the current branch head | Owner | `ship` | none | n/a |
| `shipped` | Merge and push done, Shipped Log written, checklist line swept | none | Terminal | n/a | n/a |
| `abandoned` | `stop`, or the owner discards | none | Terminal; worktree removed, branch kept 30 days | n/a | n/a |
| `needs-owner` | Any row above says so | Owner | The owner fixes and calls `start` again | none | n/a |
| `failed` | Any row above says so | Steward once (`start` again), then owner | Retried or abandoned | n/a | Second failure → `needs-owner` |

Rules that make it deterministic:

- **Idempotent start.** An item has at most one run that is not terminal. `start` on an item whose run is in progress returns that run unchanged; on a run that is `failed`, `returned` or `needs-owner` it resumes the same run as a new attempt.
- **State is a file.** `.delivery/local/<run>/state.json` holds the state, its entry time, the last event, who acts next and the exact next action. Reading it costs no model turn.
- **Every transition is appended to a log** with time, cause and caller. Nothing is edited in place.
- **Unknown is a state.** If the conductor cannot tell what happened, the run becomes `needs-owner` with the raw evidence. It never guesses and never retries blind.
- **A foreign commit returns the run.** If the branch holds a commit that the run's worker session did not make, the run becomes `returned: foreign-commit`.

## 5. What a supervisor must be able to do

Exactly two things: **run one command (or call one tool) with text arguments, and read text back.** Nothing else about the product matters to this design.

| The supervisor can… | Connect it by | Extra setup |
|---|---|---|
| Run a shell command on the laptop | `pnpm pm:run <verb> …` | None |
| Call MCP tools from a host running on the laptop | The existing stdio server `scripts/delivery-v2/steward-mcp.mjs`, re-pointed at the verbs | Register the server once |
| Call MCP tools only from the vendor's cloud | The same server behind the vendor's tunnel | The tunnel and plugin steps already written in the connection checklist |
| Neither | It cannot be the Steward. It can still read the daily report from the Drive mirror | None |

The verbs, their JSON and their exit codes are identical on all three routes. Moving from Dot to Duet is a change of route, not of contract.

## 6. The verbs

### Steward verbs (eight)

| Verb | Does | Returns |
|---|---|---|
| `next` | Lists the items the mandate allows right now, in order | IDs, titles, tier, whether a risk hold will apply |
| `start <ID>` | Starts or resumes the item's run | Run id, state |
| `status <run>` | Reads the state file | State, since, next actor, next action, links, scorecard when present |
| `wait <run>` | Blocks until the state changes, 60 s at most | Same as `status`, marked stale if the conductor is unreachable |
| `answer <run> <question> <text>` | Records an answer to a worker question | Accepted, or refused with the reason (§7) |
| `handover <run>` | Asks for the UAT handover to be rebuilt and the owner notified | Handover link |
| `stop <run>` | Cancels | `abandoned` |
| `report` | The brief: shipped, waiting on the owner and for how long, failures with reasons, runs today against the mandate | Text and JSON |

### Owner verbs (five), not reachable with the Steward's credential

`mandate` (edit the standing permission) · `review <run> approve|return` · `signoff <run> pass|needs-changes` · `ship <run>` · `undo <run>`.

The same thirteen actions are buttons in the Command Center. The command line and the screen call one implementation.

### Exit codes

`0` done · `10` nothing to do · `20` waiting on the owner · `30` refused by the mandate · `40` failed, retry allowed · `50` failed, owner needed. A supervisor branches on the code and never has to interpret prose.

## 7. The mandate

One small file the owner edits and the Steward cannot: `.delivery/local/mandate.json`.

| Setting | Decided value |
|---|---|
| Lanes it may start from | Now only |
| Concurrent runs | 1 |
| Starts per day | 3 |
| Tier | The item's declared tier; `CLAUDE_MID` when none is declared |
| Risk-domain items | May be started; the review hold always applies |
| Worker questions | The Steward answers when the item is outside every risk domain. Inside one, the owner answers and the Steward attaches a draft |
| Repair rounds | 2, automatic, no supervisor involved |
| Retry after `failed` | Once per run |
| Circuit breaker | Two consecutive runs ending `failed` or `returned` → no further starts until the owner calls `mandate resume` |
| Hours | Starts only between 08:00 and 22:00 Asia/Beirut; reports any time |
| Spend | Subscription only. A missing sign-in is `needs-owner`, never a fallback |

`start` checks the mandate before anything else and refuses with code 30 and the row that refused.

## 8. Escalation: every situation has one response

| Situation | Steward does | Owner sees |
|---|---|---|
| `preflight` fails | Reports the one failing check and its fix: commit or stash changes; sign in to the CLI; run `pnpm install` | One line |
| Worker asks a question, non-risk item | Answers from the item's criteria section, quoting it | The answer in the run log |
| Worker asks a question, risk item | Drafts an answer, sets `question` to the owner | The question and the draft, accept or edit |
| Checks red after two repair rounds | Nothing; the run is `returned` | Scorecard with the failing check or rule and its line |
| Review hold | Sends the diff link and a three-line summary | Approve or return |
| `uat-ready` | Sends the handover; repeats in the daily report | Scenarios to walk |
| The run is `failed: stalled` (no event for 20 minutes while building) | Calls `start` once | A note that a stall was retried |
| Second failure on the same run | Stops | `needs-owner` with both failure records |
| Circuit breaker trips | Stops starting; keeps reporting | The two runs that tripped it |
| `status` unreachable | Reports the last confirmed state as stale; does nothing else | "Conductor unreachable since …" |
| Anything not in this table | Stops nothing and starts nothing; reports the state file verbatim | The raw state |

The last row is the rule that prevents improvisation: an unlisted situation is reported, never handled.

## 9. What makes the old blockers impossible

| Old blocker | Now |
|---|---|
| Docker, images, checker environment, compiler pins, qualification | Not part of the Local lane |
| Readiness that expires before Start | Preflight runs inside `start`; nothing is observed in advance |
| Policy and authorization expiry | One mandate file with no expiry |
| "Outcome unknown" after pressing Start | `start` is idempotent and the state is a file |
| Pairing a browser, pages asking to pair | The Steward uses no browser. On the laptop its credential is the operating-system user; over MCP it is the existing restricted credential, limited to the eight verbs |
| Proving the assistant will not write code itself | Not needed. Whatever it writes outside a run reaches nothing: `main` accepts only `ship`, a foreign commit returns the run, and production keys are not in the repository directory ([R84](<../../../PM Tooling/PM Tooling — Master Book.md#r84>), [DLV-152](<../../../Delivery/Delivery — Master Book.md#dlv-152>)) |
| Supervision that spends uncounted model turns | Status is a file read. Each verb call is logged with its caller; the delivery scorecard shows how many verbs the Steward used. Its own token use is recorded as "unreported" unless the product reports it |
| The owner relaying messages between agents | Worker, conductor and Steward meet only through the run's state and log |
| Phone confusion | The phone shows `status` and the daily report, and takes `signoff`. It starts nothing |
| The supervisor disappearing mid-run | The conductor finishes the run without it. A new session calls `status` and continues |

## 10. Decisions, all closed

| # | Question | Decision |
|---|---|---|
| 1 | Does delivery depend on a supervisor? | No. The conductor is complete alone |
| 2 | Which path does the Steward use? | The Local lane only. It never touches the confined V2 path |
| 3 | How does it act? | Thirteen verbs, eight of them its own; one implementation behind CLI, MCP and buttons |
| 4 | Browser-driving procedure in the runbook | Retired when DLV-156 ships |
| 5 | Tunnel and private plugin | Optional transport, needed only for a cloud-hosted supervisor. Phases 3 to 6 of the connection checklist are not prerequisites for anything |
| 6 | Sign-off scenario M1 (tools-only proof) | Dropped as unprovable and unnecessary (§9) |
| 7 | May the Steward approve plans or reviews? | No. Non-risk items need no approval; risk items are the owner's |
| 8 | May it ship? | No |
| 9 | May it answer worker questions? | Yes outside risk domains; drafts only inside |
| 10 | How many runs at once? | One |
| 11 | What ends a run? | Exactly one of `shipped`, `abandoned`; `returned` and `needs-owner` wait, they do not end |
| 12 | Dot now, Duet later | Same contract. Qualification is the two capabilities in §5 and the proof in §11, nothing else |
| 13 | Existing Steward code | Kept: the stdio server, intent receipts, last-known state and status templates. Re-pointed from Command Center launch routes to the verbs |
| 14 | Existing Steward documents | `docs/ERA-Steward-*.md` stay as history. This document is the only current one |

## 11. Proof that closes the subject

Four exercises, in order. When all four pass, there is nothing left to set up.

| # | Exercise | Passes when |
|---|---|---|
| E1 | **No supervisor.** The owner runs `start` on a small non-risk item (KIT-28 is the suggested one: one file, low tier), then UAT, `signoff`, `ship` | The item is merged, its Shipped Log line exists, the checklist line is gone, and the run's log shows every state in order |
| E2 | **With a supervisor.** The Steward is told "run the next item". It calls `next`, `start`, `wait` until `uat-ready`, sends the handover | The owner did nothing between the instruction and the handover; `report` shows the run; the verb log names the Steward |
| E3 | **Risk hold.** BUD-95 (one line on a money read path) | The run stops at `review-hold`; `ship` is refused until the owner approves; nothing the Steward can call moves it |
| E4 | **Failure drills.** Dirty tree at start; worker killed mid-build; a deliberately failing test; `start` called twice; Steward session closed during `building` and a new one opened | In order: `needs-owner` with the fix; `failed: stalled` then one retry; `returned: checks-red` after two rounds; the same run id twice; the new session reads `status` and continues with no duplicate run |

E1 is the gate. Until E1 passes, no supervisor is connected.

## 12. Build order

| Step | Item | Gives |
|---|---|---|
| 1 | [DLV-150](<../../../Delivery/Delivery — Master Book.md#dlv-150>) | Worktree, worker launch with the repo's setup, host checks |
| 2 | [DLV-152](<../../../Delivery/Delivery — Master Book.md#dlv-152>) | Scrubbed environment, risk classifier, review hold |
| 3 | [DLV-153](<../../../Delivery/Delivery — Master Book.md#dlv-153>) | Ship and Undo by merge, PM trace |
| 4 | [DLV-156](<../../../Delivery/Delivery — Master Book.md#dlv-156>) | The state file and log, the thirteen verbs with exit codes, the mandate, the escalation table as code, the MCP server re-pointed, exercises E1 to E4 as tests where they can be and as a UAT sheet where they cannot |
| 5 | Connect a supervisor | Route from §5; run E2 |

Steps 1 to 3 already exist as items. Step 4 is the only new one. Evaluation of each run (which rule failed, scorecards) comes from the [Agentic OS](<../../Agentic OS/_index.md>) detectors when they exist; until then the checks are typecheck, lint and tests.

## 13. The Steward's brief

The whole instruction a supervisor needs. It is the same for any product.

```text
You are ERA Steward. You supervise delivery through thirteen verbs; eight are yours.
You never write code, approve a review, ship, or change rules or the mandate.

To work: call `next`. If it returns an item, call `start <ID>`, then `wait <run>` in a
loop. Branch on the exit code:
  0   done: report in one line.
  10  nothing to do: say so and stop.
  20  waiting on the owner: send what `status` says the owner must do, once, then stop.
  30  refused by the mandate: report the row that refused. Do not try another way.
  40  failed, retry allowed: call `start <ID>` once more.
  50  failed, owner needed: report the state file as it is.
If the worker asks a question and `answer` accepts it, answer by quoting the item's
criteria. If `answer` refuses, draft an answer for the owner.
Every morning call `report` and send it.
If a situation is not described here, report the output of `status` and do nothing else.
```

It fits on one screen because the judgment lives in the conductor.
