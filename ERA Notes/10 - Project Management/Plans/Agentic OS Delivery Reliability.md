---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-15, working tree over a9ef5bc1. Read of scripts/delivery-v2/local-lane.mjs, local-process.mjs, local-guardrails.mjs, local-worker.mjs, process.mjs, adapters/claude.mjs and .claude/hooks/pre-commit.sh; seven Local runs read from .delivery/v2/supervisor.sqlite; a no-provider reproduction of the process runner's timeout result. Nothing in this sheet is built."
---

# Agentic OS — delivery reliability

[Review and order](<Agentic OS Review.md>) · next sheet: [Game and cockpit corrections](<Agentic OS Game and Cockpit Corrections.md>) · lane design: [Local Lane Design](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>)

Execution sheet for the Local delivery lane. Goal: an owner-started delivery reaches UAT and ships, and when it does not, it says why and can be retried. Build from this file; each item is one session.

## Contract for every item here

- **No provider turn.** Hard Rule 29. Tests are replay-only; the Local suite injects `run`, `session`, `checks` and `authenticate`. Never start a real Local run to test a change.
- **No production write.** Hard Rule 26. The supervisor store (`.delivery/v2/supervisor.sqlite`) is local; opening it read-only is allowed.
- **Never restart the owner's `pnpm pm`.** Its startup writes relay rows. Every item ends with "owner restart required" in its handover.
- **Do not touch** the seven retained HUB-118 worktrees, their branches or their rows. They are evidence.
- **Not through the lane.** These items change `scripts/delivery-v2/`; run them as ordinary CLI sessions.
- **Read first:** `scripts/delivery-v2/local-lane.mjs` (324 lines, the whole lane), `tests/delivery-v2/local-lane.test.ts` (fixture pattern), then the item.
- **Verify, every item:** `npx vitest run tests/delivery-v2/local-lane.test.ts tests/pm-ui` from PowerShell, `pnpm typecheck`, ESLint on changed files, `pnpm pm:lint`. Finish with `pnpm pm:ship <ID> --note "<evidence>"`.

## The lane today

```text
Start ─ worktree ─ install ─ native session ─ COMMIT ─ host checks ─ handover ─ UAT ─ SHIP ─ push
                                               │                                        │
                                  pre-commit hook: tsc + full tests            same hook again
                                  ≈ 6–8 min, limit 30 s  ✗                     limit 30 s  ✗
```

Phases stored on the run: `preparing`, `building`, `checking`, `uat-ready`, `merging`, `push-pending`, `shipped`, `failed`, `cancelled`, `revert-push-pending`, `reverted`.

---

## DLV-159 — Supervisor Git steps outlive the hook

**Tier:** `CLAUDE_MID`, effort high. **Size:** S. **First.**

**Execution (2026-11-15):** implemented in its earlier CLI session; original real-Git/replay outputs remain in [DLV-159 evidence](<../../../.pm/dlv159-evidence/README.md>). The owner's subsequent commission orders R124 → DLV-159 verification → DLV-160; current evidence is in [the reliability handover](<../../../.pm/reliability-20261115/README.md>). Owner restart and W1 remain pending. DLV-161–163 are held until the owner confirms W1.

**Defect.** `git()` at `local-lane.mjs:37` gives every Git command `timeout: 30_000`. Three of those commands create commits and therefore run `.husky/pre-commit` → `.claude/hooks/pre-commit.sh`: docs check, mirror check, PWA check, `tsc --noEmit`, the full `pnpm test`, ESLint on staged files.

| Call | Line | Runs the hook |
|---|---|---|
| `git commit -m "Build <ID>"` in the worktree | 202 | yes |
| `git commit -m "Ship <ID>"` on `main` | 294 | yes |
| `git revert --no-edit -m 1` on `main` | 311 | yes |
| `git push` | 298, 315 | no hook; network-bound |

**Evidence.** Run `local-cac958d7`: the worker's last row is 06:13:59, the failure row 06:19:24. The hook's own Vitest line reads `Duration 300.91s`. `runProcess` (`process.mjs`) sets `error` to `ETIMEDOUT` at the limit and resolves `status: null`; `git()` throws on either. Reproduced without a provider: a 3 s child under a 1 s limit returns `{status: null, errorCode: "ETIMEDOUT"}`. So a commit whose hook passes still fails, and the message printed is the hook's output, which reads as "Commit hook failed".

**Change.**

1. `git(cwd, ...args)` keeps 30 s. Add `gitSlow(cwd, limitMs, onLine, ...args)` in the same closure.
2. New lane option `limits = { hookMs: 25 * 60_000, pushMs: 5 * 60_000 }`, overridable in `createLocalLane` for tests. Use `hookMs` for the three commit-creating calls and `merge`, `pushMs` for both pushes.
3. `runProcess` gains an optional `onStderrLine(line)` callback. No behaviour change when absent.
4. On timeout, kill the process tree, not the process: on Windows `taskkill /pid <pid> /T /F` (the pattern already in `local-process.mjs:41`), elsewhere the process group. An orphaned hook must not keep running tests in the worktree.
5. A timeout throws `git <verb>: timed out after <n> s`. A non-zero exit keeps today's message. Never print hook output as the cause of a timeout.
6. While the build commit runs, turn the hook's own stage lines into supervisor `status` rows through `event()`. Exact lines printed by `pre-commit.sh`: `Checking AI guidance docs...`, `Checking generated agent setup...`, `Checking PWA manifests...`, `Running TypeScript check...`, `Running unit tests...`, `Running ESLint on staged files...`. Row text: `Hook: docs`, `Hook: mirrors`, `Hook: manifests`, `Hook: typecheck`, `Hook: tests`, `Hook: lint`. One row per stage, in order, no duplicates.
7. `scripts/pm/app/localRunFailure.ts`: a log starting `git commit: timed out` reads **Commit timed out**; keep **Commit hook failed** for the rest.

**Tests** (`tests/delivery-v2/local-lane.test.ts`, real Git fixture, no provider).

- A fixture `pre-commit` hook that sleeps 2 s and exits 0, with `limits.hookMs` 10 s: the run reaches `checking`.
- The same hook with `limits.hookMs` 1 s: the run fails with `git commit: timed out after 1 s`; no process from the hook is alive afterwards; `HEAD` equals base.
- A hook that prints the six stage lines: six `Hook:` rows, in order, between `Committing candidate` and `Host checks started`.
- A hook that exits 2: message unchanged from today.
- `tests/pm-ui/local-supervisor-rows.test.ts`: the six `Hook:` rows are accepted as supervisor rows and are not narration.

**Acceptance.** All of the above; ship and undo use the same limits (assert the limit passed to the injected `run`); existing 30 s calls unchanged.

**Out of scope.** Removing the duplicate checks (DLV-162). Changing the hook.

---

## DLV-160 — Every failure names its real cause

**Tier:** `CLAUDE_MID`. **Size:** S.

**Defect.** Two throws discard what the worker reported.

| Line | Shown to the owner | What was stored on the job |
|---|---|---|
| `local-lane.mjs:194` | "native session did not confirm success" | `observations.error`: "Sandbox required but unavailable: … windows is not supported" (runs 2, 3) |
| `local-lane.mjs:205` | "candidate needs a change" | `observations.finalText`: "the workspace policy is read-only, and command execution was rejected" (runs 4–6) |

**Change.**

1. `build()` records a structured failure beside the text: `d.failure = { code, step, detail }`.

   | `code` | `step` | Thrown when | `detail` |
   |---|---|---|---|
   | `install` | Setup | offline install fails | last 20 lines of stderr |
   | `secrets` | Setup | `assertNoLocalSecrets` throws | its message |
   | `native-error` | Build | status or outcome is not success | `observations.error`, else first 400 characters of `finalText`, else `no reason reported` |
   | `no-change` | Build | `head === base` | first 400 characters of `finalText` |
   | `commit-hook` | Seal | commit exits non-zero | decisive lines (rule 3) |
   | `commit-timeout` | Seal | DLV-159 timeout | the limit |
   | `checks` | Verify | a host check fails | check name plus decisive lines |
   | `handover` | Handover | file missing, unparsable or incomplete | which |
   | `cancelled` | — | abort signal | — |

2. `d.error` stays for old readers. New text for the two lines: `native session failed: <detail>` and `candidate needs a change: <detail>`.
3. **Decisive lines**, one pure function `decisiveLines(text)` in a new `scripts/delivery-v2/failure-lines.mjs`, ANSI stripped, at most 12 lines: Vitest ` FAIL ` lines with the following `AssertionError`/`Error` line and the `Test Files`/`Tests` totals; `error TS\d+` lines; ESLint `error` lines with their file line; `fatal:` lines. Fallback: the last 12 non-empty lines.
4. `localRunFailure.ts` reads `run.failure.code` first and falls back to today's text matching for the seven stored runs. Titles: Setup failed · Agent ended early · No changes made · Commit hook failed · Commit timed out · Check failed: `<name>` · Handover incomplete.
5. The Game rail and Calm failure card show `detail` before the raw log. The raw log stays behind **Error details**.

**Tests.** One unit test per code with a stubbed `session`/`run`. `decisiveLines` against the stored run-7 error text shape (copy a trimmed fixture into `tests/delivery-v2/fixtures/`): returns the ten `FAIL` lines and the totals. `tests/pm-ui/local-run-failure.test.ts`: each code maps to its title; a run without `failure` still decodes.

**Acceptance.** No failure path ends with a sentence that hides a stored reason.

---

## R124 — Gates fail only for real defects

**Tier:** `CLAUDE_MID`. **Size:** S.

**Defect 1, scratch files.** `pnpm lint` in the main checkout reports 9,285 errors. All are in ignored scratch folders: `.tmp/` 9,284, `.os/` 1 (counted from `.pm/r101-evidence/lint-full.txt`). Tracked source has none. Every agent that runs the gate sees a red baseline and learns to ignore it. Add `.tmp/**`, `.os/**`, `.pm/**` and `.delivery/**` to the `ignores` block of `eslint.config.mjs`. Acceptance: `pnpm lint` exits 0 in the main checkout.

**Defect 2, load.** `tests/pm-ui/raw-fetch-guard.test.ts` builds an ESLint instance in `beforeAll` (line 49). It took 5.4 s alone and exceeded the 10 s hook limit inside a 167-file run on 2026-11-15. Earlier records show the same class: a 5 s cockpit timing timeout (R105), nine 5 s timeouts in a broad run (R99). The delivery lane runs the whole suite twice per delivery, beside whatever the owner is doing, so one such timeout fails a delivery that is correct.

**Change.**

1. List every test or hook in `tests/` that starts a compiler, ESLint, a browser, a child process or a real Git repository. For each, set an explicit timeout of at least 60 s at the call site. Do not raise the global default.
2. `raw-fetch-guard`: pass `60_000` to `beforeAll`.
3. Add `tests/README.md` § Timing: the rule in two sentences.

**Acceptance.** Three consecutive full `pnpm test` runs pass while `pnpm typecheck` runs in a second terminal. Record the three totals.

**Out of scope.** Retries. A retry hides the defect this item removes.

---

## DLV-161 — Ship, Undo and locks recover; closed runs clean up

**Tier:** `CLAUDE_HIGH`. **Size:** M. **After DLV-159.**

Four defects, one theme: a stopped step must leave the repository and the store in a state the next click understands.

**1. A failed ship strands `main`.** `ship()` saves `phase: "merging"` (line 282), merges without committing, edits PM files, then commits. Any throw after line 283 leaves an uncommitted merge on `main`. The next Ship computes `canShip` with `d.phase === "uat-ready"` (line 134), which is now false, and refuses forever.

- Before `git merge`: read the checklist as the candidate has it (`git show <head>:<PM>/<file>`) and require `tickById(...).state === "ticked"`. Otherwise throw `candidate-edits-pm-row` with `main` untouched.
- Wrap lines 283–294 in `try`. On any throw: `git merge --abort`, then `git status --porcelain` must be empty, then save `phase: "uat-ready"` with `ship_error`, then rethrow. If the abort fails, keep `merging`, save `ship_error: "merge-abort-failed"`.
- A run found in `merging` with no command in progress (process died): Ship first checks `MERGE_HEAD`. Equal to `d.head` → abort as above and continue the normal ship. Absent and `main` clean at `d.base` → back to `uat-ready` and continue. Anything else → `ship-interrupted; inspect main`.
- Same shape for Undo: on throw, `git revert --abort`; phase stays `shipped`.

**2. A dead process leaves the lock.** `locked()` (lines 44–49) creates the directory `.delivery/local-command.lock` and removes it in `finally`. A killed server never reaches `finally`; every later Start, Ship and Undo throws `local-command-busy`.

- Write `owner.json` inside the lock: `{ pid, action, run_id, at }`.
- On `EEXIST`: read it. Process not alive (`process.kill(pid, 0)` throws `ESRCH`) → remove the lock, append a `status` row `Recovered stale lock` to that run, take the lock. Alive → today's error, now naming the action and run.

**3. Credential copies outlive the run.** `build()` copies the subscription login to `.delivery/local/<id>/home/` (line 155) and never deletes it. Seven copies exist.

- In `build()`'s `finally`: remove `.delivery/local/<id>/home` recursively. Keep `hooks/`.
- One-time, in the same change: a `cleanupClosedHomes()` called at lane creation that removes `home/` for every run whose lifecycle is `CLOSED`. Log the count.

**4. Closed attempts keep full worktrees.** Seven worktrees with installed dependencies sit beside the repository.

- New owner command `discard` (route action and `local-cli` verb), allowed only when lifecycle is `CLOSED` and phase is `failed`, `cancelled` or `reverted`: `git worktree remove --force`, delete the branch, save `workspace_removed_at`. The run row, activity and error stay.
- `detail()` already tolerates a missing worktree (line 123).
- UI: **Discard files** in the failure card's overflow, Calm and Game. One word, no prose.

**Tests.** Real-Git fixtures: ship with a candidate that ticked its own row → refused before merge, `main` clean; ship whose commit fails → merge aborted, phase `uat-ready`, second Ship succeeds; run saved as `merging` with `MERGE_HEAD` present → recovered; stale lock with a dead pid → recovered with a row; live pid → refused; `home/` gone after success, failure and cancel; `discard` refused on an active run, removes worktree and branch on a failed one.

**Acceptance.** No sequence of a failure followed by a click needs a terminal.

**Not here.** Closing an interrupted attempt is [R121](<../PM Tooling/PM Tooling — Master Book.md#r121>); build it in the same week.

---

## DLV-162 — Each gate runs once, visibly, with rule verdicts

**Tier:** `CLAUDE_HIGH`. **Size:** M. **After witness W1. Needs owner decision D1.**

**Today.** The build commit runs the hook (docs, mirrors, manifests, typecheck, tests, staged lint). Then `hostChecks` (`local-process.mjs:20`) runs `typecheck`, `lint`, `test`, `pm:lint`. Typecheck and the 5-minute suite run twice. `os:eval` never runs, so a Local run has no rule verdict and Score cannot call it clean.

**D1 = yes (recommended).**

1. The build commit runs with hooks disabled: `git -c core.hooksPath=<empty directory under .delivery/local/<id>> commit …` for that one call. Nothing else changes about the commit.
2. `hostChecks` becomes a declared list in `local-process.mjs`:

   | Order | Name | Command | Shown as |
   |---|---|---|---|
   | 1 | `docs` | `pnpm docs:check` | Docs |
   | 2 | `mirrors` | `pnpm sync:ai:check` | Mirrors |
   | 3 | `manifests` | `pnpm -s pwa:check` | Manifests |
   | 4 | `typecheck` | `pnpm typecheck` | Types |
   | 5 | `lint` | `pnpm lint` | Lint |
   | 6 | `test` | `pnpm test` | Tests |
   | 7 | `pm:lint` | `pnpm pm:lint` | PM |
   | 8 | `rules` | `pnpm os:eval <base>..<head> --json` | Rules |

   `os:eval` exits 1 on a `fail` verdict and 2 on an error (`scripts/os/eval.mjs:250-253`). Store its parsed JSON as `d.verdicts`.
3. Replace `results.length !== 4` (line 213) with a comparison against the declared list.
4. Stream progress for `test`: parse Vitest's periodic lines into at most one `status` row every 20 s, `Tests: <passed> passed`. No percentages.
5. The ship commit also runs with hooks disabled, followed by `pm:lint`, `pm:check-docs` and `docs:check` on `main`. The merged tree equals the checked candidate because Ship requires `HEAD === base`.
6. A parity test reads `.claude/hooks/pre-commit.sh` and fails when it runs a command that the declared list does not. The hook stays the contract; the list cannot drift from it.
7. UI: the Verification panel and the board's gate row render from the declared list. Check [R126](<Agentic OS Game and Cockpit Corrections.md#r126--mission-layout-follow-camera-zone-identity-failure-scene>) § Gate lane before changing the board.
8. Score: a Local run with all eight passed and no `fail` verdict is a clean session. Remove the "four host seals" truth limit recorded under R122.

**D1 = no.** Keep hooks on. Remove `typecheck` and `test` from `hostChecks` when the build commit's hook passed in the same run; add `docs`, `mirrors`, `rules`. Skip step 5. Everything else stands.

**Tests.** Declared list drives count and order; `rules` failure fails the run with code `checks`; parity test fails on an injected extra hook command; fixture run records eight checks.

**Acceptance.** One delivery runs each command once. Seal-to-UAT time on a no-op change drops by at least the hook's duration, measured on the owner's machine and recorded.

---

## DLV-163 — Deliver routes the item before launch

**Tier:** `CLAUDE_MID`. **Size:** M. **After witness W1.**

**Why.** The worker instruction (`local-lane.mjs:186`) says "Read CLAUDE.md and start-task; use the repository skills". Run 7 then spent 100 seconds and six commands working out what the launch could have told it: this is a bug, it touches `src/app/api/guest-portal/`, so `fix-bug`, `api-route` and Hard Rule 27 apply.

**Change.**

1. New pure module `scripts/delivery-v2/route.mjs`: `routeFor({ kind, touches, title })` → `{ playbook, skills[], rules[], featureMap, tier }`.
   - `playbook`: `Kind: bug` → `fix-bug`; `feature` → `add-feature`; a HUB item under **ERA reports** → `era-wire`; `maintenance` → `start-task` only.
   - `skills`: from the `requires` table in `scripts/os/process.mjs`, matched against `Touches` paths. Import the table; do not copy it.
   - `rules`: Hard Rule 27 when the title or outcome matches the "X can't see Y" shape; the rules the `requires` rows name.
   - `featureMap`: the module file under `ERA Notes/01 - Architecture/Feature Map/` whose paths cover the first `Touches` entry, or null.
   - `tier`: the section's `**Tier:**` line when present (R115 already parses it).
2. `selected()` returns `route`. `build()` appends a `## Route` block to the instruction: playbook, skills, rules, Feature Map file, each as a path to read. The sentence "Read CLAUDE.md and start-task" stays.
3. Deliver page: one row of chips under the title, playbook first. No sentences. A missing `Touches` shows no chips.
4. Process scorecard: a routed skill that the session never read is the existing "required skill not loaded" fact. No new detector.

**Tests.** `route.mjs` table tests: HUB-118's section → `fix-bug`, `api-route`, Hard Rule 27, Guest Portal map; a money path → `money-rules`; an item with no `Touches` → playbook only. Instruction snapshot contains the block. Browser fixture: chips render at 1440 and 390 px.

**Acceptance.** For the same item, the routed worker's first source-file read comes earlier than run 7's (06:08:40, 101 s after start). Compare on the next real run; record both numbers.

---

## After the sheet

When DLV-159, DLV-160 and R124 are shipped, hand the owner [witness W1](<Agentic OS Review.md#7-owner-witness-w1>). Do not start DLV-162 or DLV-163 before it passes.
