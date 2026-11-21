---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-15, working tree over a9ef5bc1 (85 uncommitted paths). Read-only inspection of scripts/delivery-v2, scripts/os, scripts/pm/app; the local supervisor store (.delivery/v2/supervisor.sqlite) and session store (.os/os.db); a replay-only run of tests/pm-ui, tests/os and tests/delivery-v2; pnpm os:check, pm:lint, docs:check, sync:ai:check; the running Command Center at 1358 x 696, DPR 1.65, Blue. No provider turn, no production write, no pnpm pm restart, no code change."
---

# Agentic OS — review and correction plan

[PM home](<../_index.md>) · study: [Agentic OS](<../Fable 2/Agentic OS/_index.md>) · sheets: [Delivery reliability](<Agentic OS Delivery Reliability.md>) · [Game and cockpit corrections](<Agentic OS Game and Cockpit Corrections.md>)

One front door for everything built under the Agentic OS name since 2026-11-10: what exists, what the owner changed, what is broken, and the ordered work that makes it dependable. The two sheets hold the build instructions; this file holds the verdict and the order.

## Verdict

1. **The lane has never delivered.** Seven real Local attempts, all on HUB-118, all failed. Four causes are fixed. One is not: the supervisor gives `git commit` 30 seconds while the repository's commit hook needs more than five minutes, so a candidate with changes cannot be committed today ([DLV-159](<../Delivery/Delivery — Master Book.md#dlv-159>)).
2. **Everything around the lane is ahead of the lane.** Cockpit, scorecards and the Game board were built and verified on fixtures and replays. None has seen a delivery reach owner UAT, so 57 PM Tooling and Delivery items wait for acceptance with nothing real to accept them on.
3. **Seeing and judging work, recording does not.** Setup registry, conflict check and rule detectors run. The flight recorder holds 8 sessions, 7 of them without a verdict, and has flagged itself unavailable. `os:eval` runs only on pull requests, and this repository commits straight to `main`.
4. **The Game board is structurally right and visually undersized.** Solid objects, eleven zones and the attention rail are real. At a normal laptop window the page overflows, labels are unreadable and a failed run has no New attempt button.
5. **The skill page was correctly discarded.** Three parts of its machinery are worth keeping, none as a page (§4).

**Order:** make one delivery go green (sheet 1, DLV-159 first), then correct the board on that real run (sheet 2). Do not add features before the first green delivery.

## 1. Planned, built, changed

| Step | Planned (2026-11-10) | Built | Owner changed | Today |
|---|---|---|---|---|
| A0 · R92 | One setup for every agent | Yes | Kept Codex first-class; kept `settings.local.json` tracked | Works. Mirrors verified: 18 skills, 6 hooks |
| A1 · R93 | `os:scan` registry, `os:check` conflicts | Yes; R112 reworked severities | Asked for real repairs to be separated from notes | `os:check` exits 1: registry stale since 2026-11-14 |
| A2 · R94 | `os:eval` rule verdicts, 8 detectors | Yes; 21 diff detectors after A4 | — | Runs in CI on pull requests only. No pull requests are used |
| A3 · R95 | Flight report per session | Yes | — | 8 sessions stored; `.os/recorder-unavailable` set 2026-11-15 06:39 UTC |
| A4 · R96 | Scorecards | Yes | — | Bridge shows 0 clean, 1 failed, 7 unknown |
| A5 · R97 | PM.2 cockpit | Yes | Rejected first version (R101); Bridge redone (R102); Sessions redone (R111); Setup redone (R112); Work made the entry (R108); Plan promoted (R109) | Usable. Counts disagree between pages |
| A6 · R98 | Skill launchpad | Copy-launch slice | Rejected twice (R107, R108). Demoted to Setup › Prompt tools. Held | Page still reachable; 1,935 lines of code kept |
| A7 · R99 | Arena and game layer | Game switch; one frozen case | Asked for far more game: ERA core (R103–R106), launch bay (R113), live stage (R118, R120, R122, R123) | Arena blocked on oracle isolation. Game layer is the largest part of the product |
| Local lane · DLV-150–153 | Worktree, native session, host checks, ship | Yes | Added model and effort (R114, R115), start without a readiness step (R113) | Never completed a run |
| Lane fixes · R116, R117, R119, DLV-157, DLV-158 | — | Yes | Each filed from a failed owner run | Verified offline; none witnessed on a real run |

## 2. The seven real attempts

Read from the local supervisor store. All are HUB-118.

| # | When (UTC) | Executor | Ran | Ended with | Real cause | Fixed by |
|---|---|---|---|---|---|---|
| 1 | 11-14 18:22 | Claude, Haiku | 1 s | `Cannot freeze` | Options froze `process.env` | R117 |
| 2 | 11-14 18:56 | Claude, Haiku | 3 s | "native session did not confirm success" | SDK: sandbox required, Windows unsupported. The reason was stored and never shown | DLV-157, unwitnessed |
| 3 | 11-14 19:49 | Claude, Haiku | 2 s | same | same | same |
| 4 | 11-14 22:35 | Codex, Luna | 20 s | "candidate needs a change" | Codex reported a read-only workspace. Its message was stored and never shown | DLV-157 |
| 5 | 11-14 22:39 | Codex, Luna | 18 s | same | same | same |
| 6 | 11-15 05:45 | Codex, Luna | 20 s | same | same | same |
| 7 | 11-15 06:06 | Codex, Luna | 12 m 25 s | "Commit hook failed" | Hook ran tests with Git's own variables set: 10 failures. The hook also ran 5 m 25 s against a 30 s limit | R119 for the first; **open** for the second |

Run 7 is the only one that worked on the item: 35 recorded rows, 6 edits, a handover file, lint and typecheck by the worker, 2.43 M input tokens (2.34 M cached). Its files are preserved under `.pm/r119-preserved-HUB-118/`.

Two patterns matter more than any single cause:

- **Failures hide their reason.** Three of seven showed a generic sentence while the store held the exact cause ([DLV-160](<../Delivery/Delivery — Master Book.md#dlv-160>)).
- **Every fix was verified without the thing it fixes.** Hard Rule 29 forbids agents from running providers, so only the owner can witness a run. The plan below gives that witness a fixed, short script (§7).

## 3. What works and what does not

**Works, verified in this pass**

- 2,254 replay tests pass across `tests/pm-ui`, `tests/os`, `tests/delivery-v2`. `pm:lint`, `docs:check` and `sync:ai:check` are clean.
- `pnpm lint` has zero errors in tracked files. The recorded 9,285 errors are all in ignored scratch folders (`.tmp/` 9,284, `.os/` 1). A fresh worktree does not contain them, so the lint gate can pass in a delivery.
- Codex on Windows can read, edit and run commands in the worktree (run 7).
- The solid board renders the real run: 11 zones, `LINE 6/11`, attention count in the tab title, failure in the rail.

**Broken or missing**

| # | Finding | Evidence | Item |
|---|---|---|---|
| 1 | Supervisor commit, merge commit and revert time out at 30 s | `local-lane.mjs:37`; run 7 timing; runner returns `ETIMEDOUT` with `status: null` | DLV-159 |
| 2 | The native failure reason is discarded | `local-lane.mjs:194`, `:205`; runs 2–6 | DLV-160 |
| 3 | A failed ship leaves an uncommitted merge on `main` and a run stuck in `merging`; a dead process leaves a lock that blocks every command | `local-lane.mjs:44-49`, `:282-295` | DLV-161 |
| 4 | Subscription credential copies stay on disk after a run closes: 7 today | `.delivery/local/<id>/home/` | DLV-161 |
| 5 | Each delivery runs typecheck and the 5-minute test suite twice, and shows nothing while it does | Hook plus host checks | DLV-162 |
| 6 | A Local run earns no rule verdict, so Score can never call it clean | Host checks omit `os:eval`, `docs:check` | DLV-162 |
| 7 | One test times out under load and passes alone; `pnpm lint` is red in the main checkout from scratch folders only | `tests/pm-ui/raw-fetch-guard.test.ts`, 10 s hook; `.tmp/` 9,284 errors | R124 |
| 8 | The board overflows the window; the wheel is trapped | 908 px page in a 696 px window; `stage/engine.ts:143-148` | R125 |
| 9 | Game title reads "HUB-118 HUB-118 … — criteria" | `FoundryHud.tsx:160`; Calm strips it at `LocalRunReview.tsx:54` | R125 |
| 10 | A failed run in Game mode has no New attempt | Rail offers Review diff and Ship only | R125 |
| 11 | Registry stale, recorder flagged unavailable, page counts disagree | `os:check`; `.os/recorder-unavailable`; Bridge 28 vs Sessions 8; Setup 1 vs Score 13 | R128 |
| 12 | An interrupted attempt cannot be closed | Already filed | R121 |

Claude on Windows remains unwitnessed after DLV-157. It runs without a shell, so it edits files and the supervisor checks them.

## 4. The skill page

**Verdict: remove the page.** A form that ends in "copy this prompt" adds a step in front of a chat that already accepts the same sentence. The lane cannot launch a free prompt, and should not: it delivers tracked items with acceptance.

**Three benefits survive, none as a page.**

| Keep | Why it is worth it | Where it goes | Item |
|---|---|---|---|
| **Route before launch** | Run 7 spent its first 100 seconds and six commands rediscovering which playbook, risk skills and module files applied. The launch already knows the item's Kind and Touches, and the A4 `requires` table already maps paths to skills. Resolve them once, put them in the brief, show them on Deliver | Deliver page and the worker instruction | [DLV-163](<../Delivery/Delivery — Master Book.md#dlv-163>) |
| **Skill use, measured** | The recorder knows which skills a session loaded. A never-loaded skill is dead weight in every session's context; an expected-but-skipped skill is a process failure | Setup › Configuration, read-only | [R127](<../PM Tooling/PM Tooling — Master Book.md#r127>) |
| **Typed item intake** | The lane's real bottleneck is a well-formed item: outcome, acceptance, touches. The form validators and pickers could write that row and section directly | Bridge › New task. **Owner decision D3**; not filed | — |

Delete with the page: `Launchpad.tsx`, `launchpad.css`, `launchpad-route.mjs`, the two recipes and the page's browser test. Keep `forms.mjs` and the eight `form.json` sidecars only if D3 is accepted; otherwise delete them and their drift checks in the same change.

## 5. The Game board

Seen on the failed HUB-118 run at 1358 × 696. Motion could not be measured here: the automation tab does not fire animation frames.

**Right:** solid lit objects; one board; eleven numbered zones in delivery order; the rail states the problem first; counts are evidence-bound; a closed run sleeps.

**Wrong:**

- The board is a miniature. It uses about half its region; ERA is about 40 px tall; zone labels are about 7 px, dark grey on dark blue.
- Most machines are grey slabs. Only Explore, Think and Ship have a silhouette you can name.
- The app header and Back row keep 205 px. The page is 212 px taller than the window, and the wheel zooms the board instead of scrolling to the buttons below.
- Failure is a 4 px red dot on zone 07 and a wrapped log tail. The tail shows the end of the log, not the failing test.
- A closed run still counts "time since last signal" (9 h 52 m and rising).
- The two longest real phases, commit hook and host checks, produce one row each. A live board would stand still for ten minutes.

Corrections are [R125](<../PM Tooling/PM Tooling — Master Book.md#r125>); the layout, camera, identity and failure scene are [R126](<../PM Tooling/PM Tooling — Master Book.md#r126>). Both are in [sheet 2](<Agentic OS Game and Cockpit Corrections.md>).

## 6. Order of work

**Corrected 2026-11-16:** build DLV-161 parts 1–2 and R121 before witness W1. See [v0 review](<Agentic OS v0 Review.md#2-required-before-relying-on-the-lane>).

| # | Item | Outcome | Tier | Sheet | Needs |
|---|---|---|---|---|---|
| 1 | DLV-159 | Supervisor Git steps outlive the hook | `CLAUDE_MID`, effort high | 1 | — |
| 2 | DLV-160 | Every failure names its real cause | `CLAUDE_MID` | 1 | — |
| 3 | R124 | Gates fail only for real defects | `CLAUDE_MID` | 1 | — |
| — | **Owner witness W1** | One delivery reaches UAT and ships (§7) | owner | — | 1–3, `pnpm pm` restart |
| 4 | DLV-161 | Ship, Undo and locks recover; closed runs clean up | `CLAUDE_HIGH` | 1 | 1 |
| 5 | R121 | Interrupted attempts close | `CLAUDE_MID` | 1 | — |
| 6 | R125 | Board fits, reads and offers the right action | `CLAUDE_MID` | 2 | — |
| 7 | R128 | Registry, recorder and counts tell the truth | `CLAUDE_MID` | 2 | — |
| 8 | DLV-162 | Each gate runs once, visibly, with rule verdicts | `CLAUDE_HIGH` | 1 | W1, D1 |
| 9 | DLV-163 | Deliver routes the item to its playbook and skills | `CLAUDE_MID` | 1 | W1 |
| 10 | R127 | Prompt tools page retired; skill use shown in Setup | `CLAUDE_LOW` | 2 | D3 |
| 11 | R126 | Mission layout, follow camera, zone identity, failure scene | `CLAUDE_HIGH` | 2 | 6, 8 |

Items 1–5 change `scripts/delivery-v2/`. They cannot be delivered by the lane they repair: run them as ordinary CLI sessions. Each needs one owner restart of `pnpm pm` to take effect.

## 7. Owner witness W1

The only step no agent may take. Once, after items 1–3.

1. Commit or stash the working tree. Start requires `main`, clean.
2. Restart `pnpm pm`. Run `pnpm os:scan`.
3. Deliver **BUD-95** (one response header) with Codex, default model. It touches a money route, so Review diff is part of the witness.
4. Watch the Game view. Expect 6–8 minutes at Seal while the hook runs, then four host checks.
5. On **Ready for UAT**: open Review diff, run the handover steps, sign off, Ship. Ship runs the hook again: allow another 6–8 minutes.
6. Record in BUD-95's section: run ID, minutes per phase, anything that looked wrong.

Pass means the lane works end to end. It also gives R125 and R126 their first real recording to design against. Then repeat with Claude to witness DLV-157.

## 8. Owner decisions

| # | Decision | Recommended |
|---|---|---|
| D1 | May the supervisor commit with hooks off when it then runs the same gates itself, once each (DLV-162)? | **Owner decided 2026-11-16: YES.** Supervisor runs every gate once. Same commands, none skipped, each visible. W1 admission still applies |
| D2 | May Start run from a dirty `main`? The worktree is cut from the last commit either way | Yes, with the changed paths listed before Start. Ship still requires clean |
| D3 | Keep the form machinery for typed item intake? | **Owner decided 2026-11-15: KEEP** the forms, eight sidecars and validation tests. Typed item intake is not commissioned |
| D4 | Accept the 57 waiting Agentic OS and Delivery items in bulk on W1, instead of one by one | Yes for items whose only open evidence is "a real run" |
| D5 | Arena (R99): continue or park | Park. It spends subscription on comparison before delivery works |

## 9. Not verified in this pass

- Frame rate and motion of the board (hidden automation tab).
- Theater mode and Pocket ERA (need a real user gesture).
- Claude executor after DLV-157; any run past the commit step; Ship; Undo.
- Whether the Stop hook's PM reminder makes a worker tick its own checklist row. DLV-161 guards the consequence either way.
- 390 px and Pink for the pages reviewed here.

## Retirement

Archive this file and both sheets to `_Archive/Plans/` when items 1–11 are shipped or cancelled. The three Local Run plans (Game Mode, Stage Art and Motion, Stage Board and Attention) are built; archive them when R120, R122 and R123 are accepted.
