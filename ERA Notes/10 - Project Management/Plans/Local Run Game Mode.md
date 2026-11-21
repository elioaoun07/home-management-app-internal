---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
canonical_id: R120
owner: Elio
evidence_cutoff: "2026-11-15, working tree over 8e9de632. Source read of scripts/pm/app and scripts/delivery-v2/local-*; one read-only view of run local-cac958d7-1f8e-4e65-9cb8-1471c839f796 (HUB-118, failed) at 1568 px, Blue. Nothing here is built; no fixture, browser suite or provider turn was run."
---

# Local Run Game Mode — the Live Stage

Implementation brief for the Game-layer view of a Local delivery run (`#/delivery/run/local-…`). Written to be handed to an implementing agent as is. It replaces nothing that works; it turns the R118 workshop from a diagram into a place where you can watch ERA build.

**The test of success, in one line:** from across the room, sound off, you can tell whether ERA is working, has gone quiet, is waiting for you, or is broken — and when you open a finished run you can press ▶ and watch the whole delivery in twenty seconds.

**Implementation delta (2026-11-15):** slices 1–4 implemented as R120; 600 PM tests, exact-bundle browser pass (99 screenshots) and final motion amendment (37 screenshots) verified under `.pm/r120-evidence/`. Owner UAT is pending; slice 5 is unstarted. The original evidence cutoff below describes the plan as commissioned, before implementation.

## Contract and ownership

- **Commission (owner, 2026-11-15, looking at the HUB-118 run):** "I had in mind the gamified version of delivering here, but I feel it is dull. Move it to literally another level… make this page feel really exciting to look at and feel ERA literally working and advancing my work. If it is stale also hint it. If it is failed or broken, also hint that as well. Let it be 10x better than what it is now."
- **Owning campaign:** PM Tooling. Successor to R118 (implementation done 2026-11-15, UAT pending). Filed as **R120** on 2026-11-15 before code; R119 was already allocated. The interrupted-attempt dead end is filed separately as R121.
- **Surface:** the Game-layer branch of the Local run page only: `scripts/pm/app/LocalRunGame.tsx` + `DeliveryWorkshop.tsx` and their CSS.
- **Out of scope:** Calm view layout; the Confined-lane run page (`Run.tsx`, `LivePulse.tsx`); the Bridge core; the launch page; adapters; any new session command; any change to when Review / Ship / Undo / Cancel are allowed (`LocalActions`); the phone (`local-routes.mjs:11` keeps Local desktop-only).
- **Forbidden while building it:** starting a real Local session to watch it move (Hard Rule 29 — fixtures only), restarting the owner's `pnpm pm`, adding npm dependencies.

## Evidence and constraints

### What is wrong today

Observed on the owner's run (HUB-118, `codex · gpt-6-luna · medium`, failed), 1568 px window.

| # | Defect | Source |
|---|---|---|
| 1 | The stage is 670 px wide in a 1568 px window. Nothing moves unless the station changes, and nothing accumulates: after 11 minutes of work the deck looks the same as at second one. | `local-run-game.css` (`max-width: 900px` block), `DeliveryWorkshop.tsx` |
| 2 | Failure is almost invisible: ERA is parked on Review, smiling; `failed` is a 10 px label. The headline reads "git commit: Checking AI guidance docs..." — the first line of a **109,815-character** pre-commit hook log, raw ANSI codes included. The real cause (failing tests inside the hook) is at the tail. | `localFailureTitle` returns the first line; `run.error` |
| 3 | No staleness signal exists. `active` is derived from the phase alone, so a hung build looks exactly like a busy one. The Confined lane already has last-signal logic; Local has none. | `localRunActivity` (`active`), `LivePulse.tsx` (`QUIET_MS`) |
| 4 | Counters read **0 Explore · 6 Edits · 20 Commands**. Codex reads through PowerShell (`Get-Content`, `rg`), which the model files as Commands at the Forge. Rows show the whole `"C:\\windows\\…\\powershell.exe" -Command '…'` wrapper and absolute worktree paths under the title "Command completed". | `localRunActivityModel.ts` |
| 5 | ERA's own narration (`kind: "message"`) — the most human signal on the page — is rendered as monospace rows between commands. | `LocalRunGame.tsx` feed |
| 6 | Time is UTC wall-clock only. No elapsed, no durations, no gaps. | feed `<time>` |
| 7 | A closed run is still polled every 4 s, re-sending the 110 KB error each time. | `LocalDelivery.tsx` `refetchInterval: 4000` |

### What a poll actually carries

Everything below is already in `GET /api/delivery/v2/local/run`. The design uses nothing else until slice 5.

| Field | Honest use |
|---|---|
| `phase`, `interrupted`, `error` | State. |
| `activity[]` — newest 200 rows: `at`, `kind` (status, message, tool, edit, command, search), `summary` (≤ 400 chars), `seq`, `job_id`, `agent_json` (role main or subagent, id, executor, model) | Every motion on the stage. `job_id:seq` is the stable identity for "new row". |
| `checks[]` — `name`, `started_at`, `finished_at`, `exit`, `error`, output; appended as each one **finishes** | The four seals. |
| `head`, `branch`, `workspace`, `risk.flagged[]`, `handover.acceptance.state`, `settings`, `work.brief` | Candidate, retained work, owner turn, HUD. |
| `usage` | Only after the native session ends — debrief only, never a live meter. |

**Two executors, two levels of detail.** Codex rows carry paths and full commands. Claude rows carry the tool name only (`claude.mjs:675`) but do carry real subagent identity. Every element must look right with both: named for Codex, anonymous for Claude. Never invent a filename.

**Blind spots — stretches where the supervisor emits no rows:** dependency install (≤ 10 min, `local-lane.mjs:143`), the supervisor's `git commit` including repo hooks (in this run: 5 m 25 s of silence, 06:13:59 → 06:19:24), each host check while it runs (≤ 15 min each, `local-process.mjs:22`), the handover freeze. Staleness must be worded as a fact ("No signal"), never as a verdict ("stuck"), because these silences are legitimate.

### Laws

Inherited from R118 and the code's own comments. They are what make the spectacle worth trusting.

1. **Evidence only.** Every motion maps to a recorded row, check or phase. No progress percentage, no ETA, no invented thinking, no points or XP. ("Prose never proves a tool ran" — `localRunActivityModel.ts`.)
2. **Silence is shown.** The scene's energy is a function of how recently something was recorded. When nothing arrives, it cools on its own.
3. **Words are a cost** (Hard Rule 28). State is carried by motion, colour and shape. The complete string list is in [Text budget](#text-budget); add nothing to it.
4. **Calm twin.** Calm mode and reduced motion show the same facts, statically.
5. **One clock.** A single `requestAnimationFrame` loop writes refs and CSS variables; React never re-renders per frame (pattern: `useCoreMotion.ts`).
6. **Theme tokens only** — `--accent`, `--theme-bg`, `--surface`, `--ink`, `--ink-muted`, `--line`, `--warning-ink`; Blue and Pink. Failure is desaturation plus fracture (Bridge precedent: `--core-sat: 0%`, `.core-split-ring`). Amber means "look here". Red appears only on the failure container.
7. **Controls are untouched.** `LocalActions` and its admission conditions move position, never behaviour.

## Design

### 1. The idea — the Build Core

The work item becomes a physical object in the middle of the deck: the **Build Core**. ERA assembles it in front of you. Everything recorded adds to it, and its condition *is* the session's condition. Keep the owner's metaphor — the isometric deck, the four stations, ERA travelling between them — and give it a subject.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HUB-118 · LOCAL · codex luna medium                  ● BUILDING     11:09  │
│                                                                            │
│   [01 SOURCE]· · · · · · · ·╲              ╱· · · · · · · [02 FORGE]       │
│      drawer ▤                ╲   ◇◆◆◇     ╱                  ▣ sparks      │
│                               ◆  BUILD  ◆          ✦ src/app/api   ●●○     │
│                (ERA)═══▶      ◆  CORE   ◆          ✦ src/app/g     ●       │
│                               ╱  ◇◆◆◇   ╲          ✦ ERA Notes     ○○      │
│   [04 REVIEW]· · · · · · · ·╱   ①②③④    ╲· · · · · · · [03 LAB]           │
│      pad ⬡                       seals                     ◎ rings         │
│                                                                            │
│ ▁▁▂▁▁▁▃▁▁▁▁▂▁▁▁▁▁▁▁▃▂▁▁▁▂▁▁▁▁▁▁▁▁▁▂▁▁▃▁   pulse · last 5 min       0:04    │
├────────────────────────────────────────────────────────────────────────────┤
│ ERA ▸ The data exposure is confirmed: both bulk GET branches use the…      │
├────────────────────────────────────────────────────────────────────────────┤
│ ▶  SETUP ▏BUILD ┆┆┆ ┆ ┆┆┆┆┆  ┆ ┆┆ ┆       ▏VERIFY ✓ ✓ ✕ ·  ▏HANDOVER  LIVE │
└────────────────────────────────────────────────────────────────────────────┘
```

**Stage anatomy**

| Element | What it is | Driven by |
|---|---|---|
| **Build Core** | Isometric lattice at deck centre (replaces the empty ring at 450,240). Reads leave **wireframe nodes**; edits fill them with solid **plates**. "Explored but untouched" and "changed" are legible at a glance. Cap 24 plates; beyond that plates thicken and a count shows. | Distinct paths in read / edit rows. Claude rows with no path add anonymous nodes and plates, one per row. |
| **Seals** | Four rings round the core's equator, in order: typecheck, lint, test, pm:lint. | `run.checks` only. The agent running its own `pnpm typecheck` never earns a seal. |
| **Objective pips** | One unlit pip on the core's base per `- **Acceptance:**` bullet in `work.brief`. They blink amber at `uat-ready` and light together only when `handover.acceptance.state` is `accepted`. No per-criterion claims. | `work.brief`, `handover` |
| **Constellation** | A faint star map of where ERA has been: one cluster per two-level area (`src/app/api`, `ERA Notes`), one star per file — hollow = read, solid = edited, pulsing = touched in the last 10 s. Focus shows the path; click filters the feed to that file. Cap 40 stars, then cluster counts. Hidden when no row carries a path. | Paths in rows, made repo-relative. |
| **ERA** | The bot, now with poses: scanning, forging, running a command, facing you, idle, searching, powered down, ghost, done. It travels along the conduits with easing and a trail, and its visor shows the glyph of the current action. The cargo chip carries the file's basename when known. | Latest row + liveness |
| **Drones** | One small satellite per distinct subagent id, orbiting ERA while that subagent's rows arrive. | `agent_json.role === "subagent"` |
| **Conduits** | Light packets travel station → core for each row. | Row kind |
| **Pulse line** | Full-width heartbeat along the stage's bottom edge, last 5 minutes, one spike per row, tinted by kind. Reuse `tracePath` from `LivePulse.tsx`. Since-last-signal counter at its right end, shown after 20 s. | Row timestamps |
| **HUD** | Top-left: id, lane, executor · model · effort. Top-right: state lamp and elapsed clock (first retained row → now, or → last row when closed; suffix `+` when the 200-row window is full). Bottom-left: files · edits · commands · checks n/4, as numbers that roll. | Derived |

**Layout.** The stage breaks out of the 900 px column: `min(1440px, 100vw − 48px)` wide, `clamp(420px, 52vh, 620px)` tall, HUD inside it. Under it: transmission bar, flight recorder, then the existing six-tab console. `LocalActions` docks at the stage's bottom-right inside the existing `.run-game-commandbar`. At 390 px: stage 300 px tall, HUD reduced to lamp + clock, constellation and parallax off, recorder swipeable.

### 2. What every recorded row does

| Recorded | ERA | Station | Core | Effect |
|---|---|---|---|---|
| Read / search | Glides to Source, visor = lens | Drawer slides, a file lifts | Wireframe node appears | Packet Source → Core |
| Edit | To Forge | Cube drops, anvil flash | New file: plate locks on. Same file again: plate brightens | Sparks, packet Forge → Core |
| Command (other) | Stays; terminal ring turns once | — | — | Ring pulse |
| Agent's own check command | To Lab | Rings sweep once | — | Scan line |
| Message | Turns to face you | — | — | Transmission types on |
| `Host checks started` | Carries the core to the Lab | Scanner arms | Enters the rings | Stage card |
| `<check>: 0` | — | Ring locks | Seal on | Ring flash |
| `<check>` non-zero or null | — | Ring cracks / goes hollow amber | Seal broken / hollow | Shard |
| `Ready for owner UAT` | Docks the core on the Review pad | Shield rises | Amber beacon | Stage card |
| `Owner shipped merge` | Visor ✓ | — | Launches up a light rail | Debrief |
| Failure row | Powers down | Fault lamp on the failing station | Fractures; plates stay | Desaturate over 600 ms |

**Stage cards.** A 900 ms one-word sweep when the phase changes *while you are watching*: `BUILD`, `VERIFY`, `YOUR TURN`, `SHIPPED`, `FAILED`, `STOPPED`. Never on page load.

**Heat — how a 4-second poll feels live.**

- New rows (unseen `job_id:seq`) go into a cue queue and play in recorded order, spaced by their real gaps clamped to 120–600 ms, compressed so a batch never exceeds 2.5 s. A poll that brings nine rows becomes nine beats, not one flash.
- Each cue adds 0.25 to `heat` (cap 1). Heat decays with a 12 s half-life and drives `--stage-heat`: conduit brightness, grid shimmer, core glow, ERA's orbit speed. A run of rows inside 10 s visibly puts the deck "in flow". That is the game feel, and it cannot be faked — no rows, no heat.
- On first load the scene initialises at its final state. The only entrance is a 600 ms assembly of the plates that already exist.
- Pointer parallax (deck tilt ≤ 2.5°) and a slight camera lean toward the active station. Off on touch and reduced motion.

### 3. Liveness — quiet, stale, lost, broken

One pure function, `liveness(run, now, poll)`, in a new `localRunLiveness.ts`. Precedence top to bottom.

| State | Condition |
|---|---|
| `link-down` | The poll is failing, or the last good response is older than 12 s (three missed polls). *The page cannot see ERA* — different from ERA being silent. |
| `signal-lost` | `run.interrupted` (phase is active but no supervisor task owns it). |
| terminal | `failed`, `cancelled`, `shipped`, `reverted`. |
| owner turn | `uat-ready`, `push-pending`, `revert-push-pending` (`merging` is a brief busy state). |
| `live` | Active phase, last signal < 20 s ago. |
| `thinking` | 20 s – 90 s. |
| `quiet` | 90 s – stale threshold (same 90 s as `LivePulse`). |
| `stale` | Past the phase's threshold. |

```ts
export const LIVENESS = {
  thinkingAfter: 20_000,
  quietAfter: 90_000,
  staleAfter: { preparing: 300_000, building: 240_000, checking: 600_000 },
  linkDownAfter: 12_000,
};
```

Last signal = the newest of `activity[].at` and `checks[].finished_at`. The server and browser share one machine, so the client clock is sound. In `preparing` with no rows there is no baseline: show the state with no counter rather than invent one (slice 5 adds `started_at`). At `uat-ready`, count from the `Ready for owner UAT` row to show how long the run has waited for the owner.

**What each state looks like**

| State | Deck | Build Core | ERA | Pulse line | Caption | Tab title |
|---|---|---|---|---|---|---|
| live | Accent, shimmer follows heat | Plates arriving | Moving, visor glyph | Spikes | `Building` | `● HUB-118` |
| thinking | Heat fading | Steady | Idle hover, looks up | Flat, accent | `Building · 0:34` | `● HUB-118` |
| quiet | Drifts toward slate | Dims | Slow breath | Flat, muted | `Quiet 1:52` | `○ HUB-118` |
| **stale** | Amber rim; frost creeps in from the deck edges | Cold, frosted | Antenna sends a sonar ping every 4 s | Flat, amber | `No signal 6:12` — Cancel gets an amber ring | `▲ HUB-118` |
| **signal lost** | Scanline static, half opacity | Ghosted in place | Hollow outline at its last station, tether cut | Dashed, then ends | `Signal lost` | `▲ HUB-118` |
| **link down** | Frozen frame — no cooling, because nothing is known | Frozen | Frozen | Hatched | `Link down` + Retry | `▲ HUB-118` |
| **failed** | Desaturated; one fault lamp on the failing station; the conduit beyond it is severed and sparks once | Fractured along the failing stage; plates remain (the work is kept) | Powered down, visor dark | Ends in a break | `Failed` + black box | `✕ HUB-118` |
| cancelled | Neutral grey | Intact, unlit | Parked | Ends, neutral | `Stopped` | `■ HUB-118` |
| your turn | Calm accent; amber beacon on the Review pad | Docked, 4/4 seals | Faces you, presenting the core | Resting | `Your turn`, later `Waiting 3h` | `◆ HUB-118` |
| push pending | Amber on the launch rail | On the rail | — | — | `Push pending` | `◆ HUB-118` |
| shipped | Accent bloom, then calm | Gone up the rail; a trace remains | Visor ✓ | Resting | `Shipped` | `✓ HUB-118` |
| reverted | Neutral | Back on the pad, unlit | — | — | `Reverted` | `↩ HUB-118` |

Stale adds `--stage-frost` 0 → 1 over 20 s; any new row clears it within one beat, so recovery is as visible as the stall.

### 4. Failure — the black box

A new pure `localRunFailure.ts` turns `run.error` into `{ stage, station, title, excerpt, kept }`. The classes come from the supervisor's own throw sites in `local-lane.mjs`.

| `run.error` starts with | Stopped at | Fault lamp | Title |
|---|---|---|---|
| `worktree dependencies unavailable` | Setup | Deck entry | `Dependency setup failed` (existing) |
| `worktree contains` | Setup or Build | Deck entry | `Secret guard stopped it` |
| `native session exited` | Build | Forge | `Agent could not start` (existing — keep verbatim) |
| `native session did not confirm success` | Build | Forge | `Agent ended early` |
| `candidate needs a change` | Build | Forge | `No changes made` |
| `git commit:` | Between Build and Verify | Forge → Lab conduit | `Commit hook failed` |
| `git ` (any other verb) | Between Build and Verify | Forge → Lab conduit | `Git step failed` |
| `host checks failed` | Verify | Lab | `<first failing check> failed` |
| `candidate changed during host checks` | Verify | Lab | `Candidate changed` |
| `handover incomplete`, or an error naming `.delivery-handover.json` | Handover | Review | `Handover missing` |
| anything else | From phase evidence (as `localRunStages` does today) | — | First line, as today |

**Excerpt rule.** Strip ANSI (`/\u001b\[[0-9;]*m/g`), drop blank lines, keep the **last** 12 lines, and lift the last line matching a summary pattern (`Test Files`, `Tests`, `error TS`, `ELIFECYCLE`, `FAIL`, `Error:`) to the top. The full log stays behind the existing `Error details` disclosure, ANSI-stripped, showing the last 20 KB with a control for the rest.

**The card.** Anchored to the fractured core, replacing the block that sits above the stage today. Three facts and two actions: where it stopped, the excerpt, what was kept (`6 files · delivery/HUB-118-cac958d7…`), then `New attempt` and `Copy`. The heading keeps `role="alert"`.

For the specimen run this turns "git commit: Checking AI guidance docs..." into **Commit hook failed** — stopped between Build and Verify — with the failing test summary on the first line.

### 5. The story layer

**Transmission.** The latest `message` row, in ERA's voice: proportional type, sentence case, typed on when it arrives, cut at 220 characters with the rest one click away. Between messages it shows the current action in plain words — `Reading route.ts`, `Editing drinks-admin/page.tsx`, `Running pnpm typecheck`. Nothing here is authored by the UI except the verb.

**Flight recorder.** A ribbon under the stage mapping the retained window onto real time: phase bands (the existing `Delivery stages` nav becomes the band header), one tick per row tinted by kind, check markers with their result, the failure marker at the end. Silences are visible as gaps — the 5 m 25 s commit hook in the specimen run is a wide empty band, which is exactly the truth.

**Replay.** Scrubbing the ribbon puts the stage into the state it had at that moment; ▶ replays the whole session in about 20 s (1× / 4×). A `Replay` chip shows in the HUD and `Live` returns. Closed runs open on their final frame with ▶ ready. This works because the scene is a pure function, `sceneAt(timeline, t)`; live mode is just `t = now`. `role="slider"`, value text `06:13:11 · Edited page.tsx`; ← → step one row, Home / End, Space plays, `L` goes live.

**Debrief (shipped).** After the launch: duration · files · edits · checks 4/4 · tokens (when `usage` exists) · merge hash. Up to three evidence chips, each showing its fact on focus: `First attempt` (branch is `delivery/<ID>` with no suffix — `local-lane.mjs:239`), `Under 10 min`, `≤ 3 files`. No points; link to the existing Score page for the clean streak.

### 6. Presence beyond the page

| Feature | What it does | Rule |
|---|---|---|
| **Tab presence** | `document.title` and a canvas-drawn favicon mirror the state table above, so the run is readable from another tab. | Restore both on unmount. |
| **Pocket ERA** | Document Picture-in-Picture: a 320 × 200 always-on-top window with ERA, the pulse line, the caption and the clock — ERA stays in the corner of the screen while the owner works in the editor. | Chromium desktop only; hide the button when `documentPictureInPicture` is absent. Open from a click; portal a second root into it and copy the stylesheets; close on `pagehide`. |
| **Theater** | `requestFullscreen()` on the stage (`F`), HUD kept. | Esc exits. |
| **Sound** | Synthesised with Web Audio, no assets: a soft tick per row pitched by kind, two rising notes per seal, three at `uat-ready`, a low falling tone on failure, a single sonar ping when stale begins. | **Off by default.** Speaker toggle in the HUD, remembered in `localStorage["pm-game-sound"]`; the `AudioContext` is created on that click. At most 8 voices a second. |
| **Notify** | A system notification when the tab is hidden and the run becomes your turn, fails or goes stale. | Only after the owner turns on a bell toggle; fire once per transition. |

**Not used:** three.js / WebGL (the PM app ships as one unsplit bundle from `app-build.mjs`, the browser suite is headless, and Canvas 2D is enough), asset packs, Lottie, new dependencies. `framer-motion` is already bundled and is fine for cards and chips entering and leaving; never for per-frame scene motion.

### 7. Truth layer — fix the words before the lights

Extend `localRunActivityModel.ts`; the existing honesty tests must stay green.

- **Unwrap** shell wrappers: `"…powershell.exe" -Command '…'`, `/bin/sh -lc`, `bash -lc`, `cmd /c`.
- **Classify** the unwrapped command by its leading verb: `Get-Content`, `gc`, `cat`, `type`, `rg`, `grep`, `Select-String`, `ls`, `dir`, `Get-ChildItem`, `Get-Item`, `sed -n`, `head`, `tail`, `find`, `git diff`, `git status`, `git log`, `git show` → **read** at Source. The existing check-command rule (plus `eslint`, `tsc`, `vitest`) → Lab. Everything else → command.
- **Relativise** paths against `run.workspace` (both slash styles); label by basename, keep the directory as detail; split comma-joined edit rows into files.
- **Labels:** `Read route.ts`, `Searched guest_portal_tags`, `Edited page.tsx`, `Ran pnpm typecheck`. Claude rows with no path keep today's wording.
- **Stop polling** `failed`, `cancelled` and `reverted` runs; poll `shipped` every 15 s.

On the specimen run this alone changes the counters from 0 / 6 / 20 to a truthful split and makes the feed readable.

### 8. Build notes

**New and changed files** (all under `scripts/pm/app/`)

| File | Role |
|---|---|
| `localRunScene.ts` (new, pure) | `buildTimeline(run)`, `sceneAt(timeline, t)` → station, pose, plates, nodes, seals, counts, caption, band; `cuesBetween(prev, next)`. |
| `localRunLiveness.ts` (new, pure) | `LIVENESS`, `liveness(run, now, poll)`. |
| `localRunFailure.ts` (new, pure) | Decode table, ANSI strip, excerpt. |
| `localRunActivityModel.ts` | Unwrap, classify, relativise, labels. |
| `useStageClock.ts` (new) | The one rAF loop: heat, frost, cue queue, canvas; writes `data-*`. |
| `stageFx.ts` (new) | Canvas 2D packets, sparks, shards, frost — sprite-based and capped like `coreParticles.ts`. |
| `DeliveryWorkshop.tsx`, `delivery-workshop.css` | Build Core, seals, pips, constellation, poses, drones, HUD slots, FX canvas. |
| `FlightRecorder.tsx`, `BlackBox.tsx`, `Debrief.tsx`, `PocketEra.tsx`, `tabPresence.ts`, `stageSound.ts` (new) | As named. |
| `LocalRunGame.tsx`, `local-run-game.css` | Composition and layout. |
| `LocalDelivery.tsx` | Pass poll health (`dataUpdatedAt`, `isError`) to the game view; `refetchInterval` by phase. |

**Hooks the browser suite depends on — keep every one** (`tests/pm-ui/local-session.browser.mjs`)

- Exactly one `.delivery-workshop`, with `data-station` (source, forge, lab, review, launch), `data-active`, and `data-motion` = `paused` under reduced motion, off-screen or in a hidden tab.
- Station buttons named `Open activity`, `Open changes`, `Open verification`, `Open brief`; `Open verification` selects the Verification tab.
- Tabs named exactly Activity, Brief, Verification, Changes, Worktree, Host limits, with arrow / Home / End roving. No top-level Plan / Verification / Changes regions until their tab is open.
- Strings: `Agent could not start` and `Session interrupted` (in a `role="alert"`), `Error details`, `New attempt` (link to `#/deliver/<campaign>/<id>?from=…`), `Not run` × 4, `Candidate pending`, `Inconclusive`, `Passed`, `Test steps`, `Cancel`, `Ship`, and the host-limits sentence.
- Classes `.run-game-commandbar`, `.run-game-console`, `.run-game-patch`, `.run-game-tag`; `key={run.run_id}` so one run never shows another's diff.
- No horizontal overflow at 390 and 1440, Blue and Pink. Calm mode still renders the Plan, Verification, Activity and Changes regions once each.

**New hooks to add for tests:** `data-liveness`, `data-heat`, `data-plates`, `data-seals`, `data-replay` on `.delivery-workshop`.

**Budgets**

- ≤ 4 ms scripting per frame on the stage; transform and opacity only; ≤ 220 particles; canvas DPR capped at 1.75.
- Everything pauses off-screen, in a hidden tab and under reduced motion (then: final state, static pulse line, no type-on, no cards — liveness still shown by colour, caption and counter).
- `role="status"` announcements at most once per 5 s; liveness changes are announced in words ("No signal for 4 minutes").
- Report bundle size before and after from the `pnpm pm:build-app` output line; target growth ≤ 45 KB JS, ≤ 25 KB CSS minified.

### Text budget

The complete set of new strings. ERA's recorded messages are the only sentences on the stage.

- **Captions:** `Preparing`, `Building`, `Verifying`, `Quiet m:ss`, `No signal m:ss`, `Signal lost`, `Link down`, `Failed`, `Stopped`, `Your turn`, `Waiting Nh`, `Push pending`, `Shipped`, `Reverted`, `Replay`, `Live`.
- **Stage cards:** `BUILD`, `VERIFY`, `YOUR TURN`, `SHIPPED`, `FAILED`, `STOPPED`.
- **Black box:** the titles in the failure table, `Stopped at`, `Kept`, `New attempt`, `Copy`, `Error details`.
- **Debrief / HUD:** numbers with one-word labels; `First attempt`, `Under 10 min`, `≤ 3 files`.
- **Controls:** icon buttons with accessible names `Play`, `Pause`, `Pocket ERA`, `Theater`, `Sound`, `Notify`, `Retry`.

## Disposition and dependencies

Slices are ordered; each leaves the page working and is independently shippable. Tier aliases per `ERA Notes/Model-Registry.md`.

| Slice | Contents | Owner / ID | Tier, effort | Done when |
|---|---|---|---|---|
| 1 — Truth | §7 translation, `localRunLiveness`, `localRunFailure`, elapsed clock, phase-aware polling; captions and black box in plain form | R120 | `CLAUDE_MID`, high | Specimen fixture reads Commit hook failed with the test summary; counters split; a silent building fixture reports quiet then stale; unit tests for all three models. |
| 2 — Stage | §1–§3: full-width stage, Build Core, seals, pips, poses, conduits, heat, pulse line, HUD, every state's look | Same ID | `CLAUDE_HIGH`, high | Each row of the state table has a browser scene and screenshot in Blue and Pink at 390 and 1440; existing hooks pass. |
| 3 — Story | §4 card on the stage, §5 transmission, flight recorder, replay, debrief | Same ID | `CLAUDE_HIGH`, high | `sceneAt` unit-tested against a recorded timeline; keyboard scrub and replay scenes pass. |
| 4 — Presence | §6 tab presence, Pocket ERA, theater, sound, notify | Same ID, may split | `CLAUDE_MID`, medium | Title and favicon follow state; PiP hidden where unsupported; sound silent until toggled. |
| 5 — Telemetry (server, optional) | Additive read-only fields on the run detail: `observed_at`, `started_at`; supervisor rows at the blind spots (`Installing dependencies`, `Committing candidate`, `<check> started`, `Freezing handover`); error tail-truncated in the poll with the full log on demand | Separate ID; needs the owner's decision and a `pnpm pm` restart by the owner | `CLAUDE_MID`, high | With `<check> started` rows the Lab shows a running stopwatch and `checking` goes stale only at the supervisor's own 15-minute limit. |

**Verification for every slice:** `pnpm typecheck`, scoped ESLint, `pnpm pm:build-app`, the `tests/pm-ui` Vitest files (run from PowerShell), and the credential-free browser suite `tests/pm-ui/local-session.browser.mjs` extended with scenes `stale`, `signal-lost`, `link-down`, `failed-hook`, `replay`; evidence under `.pm/r119-evidence/`. A trimmed, read-only capture of the specimen run (error cut to head 2 KB + tail 4 KB) may be added under `tests/pm-ui/fixtures/`. No provider turn, no session command, no backend restart.

**Findings that are not this work**

| Finding | Disposition |
|---|---|
| An interrupted Local run is a dead end: `cancel` throws `session-not-running-in-this-process`, and `start` returns the same open run instead of a new attempt (`local-lane.mjs:228`, `:319`). | File in the PM Tooling Pain Inventory. This plan only shows the state truthfully as `Signal lost`. |
| Claude rows carry no file path, so Claude runs get an anonymous core. Adding the basename in the adapter would also change the Confined lane. | Unadopted option; raise separately if the owner wants it. |
| R118's residual ("run detail stays pending") — on 2026-11-15 the specimen run's detail loaded and rendered in a normal browser session. | Note for whoever closes that residual; the 110 KB error in every poll is the likely weight. |

**Owner decisions, with the default this plan assumes**

| Question | Default |
|---|---|
| Stale thresholds (4 min building, 5 min preparing, 10 min verifying)? | As listed; one constant to tune. |
| Sound? | Built, off until toggled. |
| Slice 5? | Not started without a yes. |

**Implementation clarification (owner, 2026-11-15):** intentionally stopped or slowed terminal polling keeps the final state. Only an actual failed request makes a terminal run `Link down`; the 12-second response-age rule applies to active/owner-waiting polls. This resolves the conflict between the liveness precedence and phase-aware polling.

**Evidence location:** `.pm/r120-evidence/` follows the allocated ID; the proposed `.pm/r119-evidence/` name below is superseded. Slices 1–4 are the commissioned scope. Slice 5 remains unstarted. This plan stays active until owner acceptance.

### Filing

File this first, in PM Tooling (`4 - Checklist.md` row + this section in the Master Book), then finish with `pnpm pm:ship`.

```md
### R120

**Outcome:** The Local delivery Game view is a live stage: ERA visibly builds the work from recorded evidence, and a quiet, stale, lost or failed session is recognisable at a glance.
**Kind:** feature
**Source:** Owner commission 2026-11-15 on run `local-cac958d7-1f8e-4e65-9cb8-1471c839f796`: "I feel it is dull… feel ERA literally working and advancing my work. If it is stale also hint it. If it is failed or broken, also hint that as well." Spec: `Plans/Local Run Game Mode.md`.
**Touches:** `scripts/pm/app/LocalRunGame.tsx`, `DeliveryWorkshop.tsx`, `localRunActivityModel.ts`, `LocalDelivery.tsx`, new `localRunScene.ts`, `localRunLiveness.ts`, `localRunFailure.ts`, `useStageClock.ts`, `stageFx.ts`, `FlightRecorder.tsx`, `BlackBox.tsx`, `Debrief.tsx`, `PocketEra.tsx`, their CSS, `tests/pm-ui/`

- **Acceptance:** Every motion on the stage maps to a recorded row, check or phase; the Build Core grows with distinct files read and edited and earns seals only from host checks. No percentage, ETA or score is shown.
- **Acceptance:** An active session with no recorded signal becomes Quiet at 90 s and No signal at its phase threshold, with a visible counter; interrupted, link-down, failed, cancelled, owner-turn and shipped states are each visually distinct and named in three words or fewer.
- **Acceptance:** A failed run names where it stopped and shows the tail of the cause with ANSI removed; the specimen run reads "Commit hook failed".
- **Acceptance:** A closed run can be replayed and scrubbed from its recorded rows; live and replay use the same scene function.
- **Acceptance:** Shell-wrapped reads count as Explore, paths are repo-relative, and ERA's messages read as narration.
- **Acceptance:** Calm mode, reduced motion, keyboard use, 390 px and desktop, Blue and Pink all hold; R118's browser hooks still pass; Review, Ship, Undo and Cancel admit exactly as before.

**Reading guide:** `Plans/Local Run Game Mode.md`; `local-lane.mjs` (phases, throw sites); `useCoreMotion.ts` and `coreParticles.ts` (motion pattern); `LivePulse.tsx` (trace).
**Verify:** Typecheck, scoped lint, PM app build, model unit tests, credential-free browser scenes. No provider turn or backend restart.
**Implementation:** pending
**UAT:** pending
```

## Retirement

When the filed ID ships and the owner accepts it, move the surviving constraints — the laws, `LIVENESS`, the failure table and the text budget — into `ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md` and the PM Tooling Master Book, then move this file to `_Archive/Plans/`. If the owner rejects the direction, archive it unimplemented with that note.
