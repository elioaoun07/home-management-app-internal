---
created: 2026-11-16
updated: 2026-11-16
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-16 12:10 local, working tree over a9ef5bc1 (190 uncommitted paths). Read of scripts/delivery-v2/local-lane.mjs, process.mjs, failure-lines.mjs, scripts/os/hook.mjs, ingest.mjs, scripts/pm/app/localRunFailure.ts; replay run of tests/delivery-v2, tests/pm-ui and tests/os (2,458 passed, 8 skipped, 0 failed, 180 files); pnpm os:check and pm:lint (both 0 errors); the running Command Center (restarted 11:50) at 1358 x 849, DPR 1.65, Blue: failed run local-cac958d7, Setup, Bridge; the session store and event files read-only. No provider turn, no production write, no pnpm pm restart, no code change."
---

# Agentic OS — v0 review

[PM home](<../_index.md>) · previous verdict: [Agentic OS Review](<Agentic OS Review.md>) · sheets: [Delivery reliability](<Agentic OS Delivery Reliability.md>) · [Game and cockpit corrections](<Agentic OS Game and Cockpit Corrections.md>)

Review of what was built from the 2026-11-15 sheets. Part 2 lists what is still required before the lane can be relied on. Part 3 lists enhancements; none of them is commissioned.

## Verdict

1. **Built as specified.** Six items shipped (DLV-159, DLV-160, R124, R125, R127, R128) and R126 slices 1–3. Each matches its sheet. 2,458 replay tests pass; `os:check` and `pm:lint` are clean; the server was restarted, so the lane fixes are live.
2. **Still unproven.** No delivery has run since the fixes. Witness W1 is the only open step between "verified offline" and "works".
3. **Two gaps come from the 2026-11-15 order, not from the build.** It placed Ship recovery (DLV-161) and interrupted-attempt recovery (R121) after W1. Both can strand W1 itself. Build them first (M1, M2).
4. **The board is now a product, not yet a showpiece.** It fills the window, has a camera and eleven distinct machines. It is still mostly grey, 15 on-board labels render at 7.6 px, and failure is a red dot.
5. **Scoring cannot say "clean" by any route today** (M4).

## Implementation checkpoint — 2026-11-16

The owner's implementation request commissions M1–M5, subject to the explicit
W1/D1 admission gate. The candidate enhancements in part 3 remain uncommissioned.

| Requirement | Current engineering state | Remaining evidence / scope |
|---|---|---|
| M1 / DLV-161 parts 1–2 | Built: candidate PM preflight, owned Ship/Undo rollback, retry controls and dead-owner command-lock recovery | W1 pending. Unknown edits/operations and ambiguous post-commit interruptions are refused. Parts 3–4 remain open under DLV-161 |
| M2 / R121 | Built: supervisor identity, proven-dead taskless cancellation, retained evidence and distinct new attempts; Calm/Game admission aligned | Owner restart/relaunch witness pending. Legacy attempts without supervisor metadata remain inspection-only |
| M3 / R129 | Built: reserved screen-space facts, readable HUD/dock/rail/live labels and collision corrections; all 24 browser profiles pass | 11 px desktop / 10 px phone; minimum contrast 4.72:1. Physical-device/FPS acceptance remains separate |
| M4 / R130 | Built: automatic Codex Stop ingestion, labelled uncommitted evaluation, majority-turn model/tier attribution | Owner `/hooks` approval for native SessionStart/Stop remains pending; historical missing events are not fabricated |
| M5 / DLV-162 | Not started; D1 approved by the owner on 2026-11-16 | The delivery sheet explicitly requires passing W1 first |

Verification: **2,488 replay tests passed, 8 opt-in skips, zero failures across
183 files**; repository typecheck, scoped ESLint, docs/index parity, generated
setup parity and `os:check` pass. The first broad pass exposed a Game Cancel
admission mismatch; it was corrected and the full three-suite rerun passed.
Replay log: `.pm/v0-review-evidence/replay.log`. No provider turn, production
write, actual attempt cleanup or restart of the existing PM server was performed.

[Owner test steps and limits](<../../../docs/Delivery-UAT.md#agentic-os-v0-corrections--dlv-161-parts-12--r121--r129--r130>).
The original dated review below remains the evidence for why these corrections
were commissioned; this checkpoint does not claim W1 or owner acceptance.

## 1. Shipped against the request

| Item | State | As requested | Seen on the live run |
|---|---|---|---|
| DLV-159 commit limits | Shipped | Yes. 25 min hook, 5 min push, tree kill, six `Hook:` rows | Not exercised; needs W1 |
| DLV-160 failure causes | Shipped | Yes, nine codes. Three throws stay uncoded: sign-in, `git add`/`status`, "candidate changed during host checks" | The seven stored runs have no code, so the rail still shows the log tail |
| R124 gates | Shipped | Yes. Scratch folders ignored, explicit timeouts | Suite ran green beside a browser session |
| R125 board corrections | Shipped | Yes for the ten rows | Fits (849 / 849), title clean, New attempt primary, 11 zone chips readable |
| R126 slices 1–3 | Built, open | Yes. Bar, dock, rail, drawer, three camera shots, silhouettes | Layout and drawer work. Motion and frame rate not observable here |
| R126 slices 4–5 | Not built | Held as planned (gate lane needs DLV-162; failure scene) | Failure = one red dot on zone 07 |
| R127 skill page | Shipped | Yes. Page and routes gone, D3 kept the forms | `#/skill-tools` opens Work |
| R128 registry, recorder, counts | Shipped | Yes in code | Setup: checks clear, Rescan present. Recorder marker still set; it clears at the next Claude session end. Bridge: 26 of 27 sessions Unknown |
| DLV-161, DLV-162, DLV-163, R121 | Not built | Held for W1 as ordered | Seven credential copies and seven worktrees remain |

## 2. Required before relying on the lane

| # | Requirement | Evidence | Item | When |
|---|---|---|---|---|
| M1 | **Ship and Undo recover.** A failed ship commit leaves an uncommitted merge on `main` and the run in `merging`; Ship then refuses forever | `local-lane.mjs:342-354`, `:151` (`canShip` needs `uat-ready`). W1 step 5 runs this path with a 6–8 minute hook | [DLV-161](<../Delivery/Delivery — Master Book.md#dlv-161>) parts 1–2 | **Before W1** |
| M2 | **An interrupted attempt can be closed.** A server restart during a run leaves it `Interrupted`; Start then returns that same run, so the item can never be delivered again | `local-lane.mjs:291-292`, `:382` | [R121](<../PM Tooling/PM Tooling — Master Book.md#r121>) | **Before W1** |
| M3 | **Every board label is readable.** 15 labels render at 7.6 px: `MAIN`, the commit hash, `RETRY`, four counts, four check names and states. The check chips overlap `04 THINK` and hide `LINT`. Dock counters are 8 px, tab labels 9 px, badges 7 px | Measured at 1358 × 849. `stage/StageReadouts.tsx`, `local-run-mission.css:26,45,46` | [R129](<../PM Tooling/PM Tooling — Master Book.md#r129>) | After W1 |
| M4 | **A session can be scored.** Codex did the work on 15–16 November (75 transcripts) and left no event and no session. Claude sessions end with `base = head` and a dirty tree, so their verdict range is empty: 7 of 8 stored sessions. This session (Fable) is stored as Haiku, `CLAUDE_LOW` | `.os/events/` (one file after 2026-11-15 06:42 UTC), `.os/os.db`, `hook.mjs:144` | [R130](<../PM Tooling/PM Tooling — Master Book.md#r130>) | After W1 |
| M5 | **A Local run earns a rule verdict and runs each gate once** | Already filed | [DLV-162](<../Delivery/Delivery — Master Book.md#dlv-162>), needs D1 | After W1 |

**Corrected order:** DLV-161 parts 1–2 → R121 → **W1** → R129 → DLV-162 → R130 → DLV-163 → R126 slices 4–5.

### W1 pre-flight

- `main` must be clean. 190 paths are uncommitted; commit them first.
- During the run, do nothing in the main checkout. Start pins the base commit; Ship requires `HEAD` to equal it. A commit on `main` mid-run ends in `main-advanced; rebuild and repeat UAT`. If `main` is dirty at Ship, stash, do not commit.
- Do not restart `pnpm pm` during the run (M2).

## 3. Enhancements

Candidates only. File one when it is chosen.

### Look

| # | Enhancement | Why |
|---|---|---|
| L1 | **Failure scene and results** (R126 slice 5) | The most-seen state so far is failure, and it is a 4 px dot |
| L2 | **Gate lane** (R126 slice 4) | The two longest phases, hook and checks, are where the board must move |
| L3 | **Colour and material pass.** Tint each zone's base in its group colour, light windows and screens, keep the failed zone lit on a closed run | The board reads about 80 % grey. Only emissive parts carry colour |
| L4 | **Phone framing.** Open in Follow, or lay the eleven zones out in two columns | At 390 px the board uses about a third of its 688 px area |
| L5 | **Ship phase on the board.** Pass the hook lines on the ship and revert commits too, and drive zone 11 from them | `local-lane.mjs:354`, `:371` pass no line handler; Ship stands still for 6–8 minutes |
| L6 | **Attempt history.** `Attempt 7 of 7` in the bar; earlier attempts as dim capsules where each stopped | HUB-118 has seven attempts and the board shows one |
| L7 | **Dock clean-up.** One tempo control (there are two `1×`), a labelled scrubber | Seen in the dock at 1358 px |
| L8 | **ERA reacts to gates.** One short pose per check passed or failed, from the recorded row | ERA idles through Verify |

### Function

| # | Enhancement | Why |
|---|---|---|
| F1 | **Reseal instead of rebuild.** When the failure is `commit-hook`, `commit-timeout` or `checks` and the worktree is kept, offer **Reseal**: rerun commit and checks without a new agent session | Run 7 did the work in 12 minutes and 2.4 M tokens, then failed on gates. New attempt repeats all of it |
| F2 | **Route before launch** | [DLV-163](<../Delivery/Delivery — Master Book.md#dlv-163>), filed |
| F3 | **Ship after `main` moved.** Rebase the candidate, rerun checks, keep the UAT when the diff is unchanged | Today any commit on `main` voids the run |
| F4 | **Start from a dirty `main`** (decision D2) | The owner's tree is rarely clean |
| F5 | **Tell the owner when it is their turn.** A desktop notification on `uat-ready` and `failed` | A delivery takes 15–25 minutes; the tab title is the only signal |
| F6 | **Decode stored failures.** Run the decisive-lines filter in the browser for runs without a `failure` object | Seven stored runs show a log tail |
| F7 | **Code the three uncoded throws** (sign-in, Git staging, candidate changed) | Section 1, DLV-160 row |
| F8 | **Discard files** on closed attempts | DLV-161 part 4, filed |
| F9 | **Clear Needs you.** Bulk-accept items whose only open evidence is a real run (decision D4) | Bridge shows 29: 4 sessions, 4 requests, 21 decisions |
| F10 | **Queue.** Start the next item when one ships | After five clean deliveries |

## Retirement

Archive with the Agentic OS Review and its two sheets when their items are shipped or cancelled.
