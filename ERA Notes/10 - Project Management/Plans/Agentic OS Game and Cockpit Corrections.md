---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-15, working tree over a9ef5bc1 with R123 built. The running Command Center viewed at 1358 x 696, DPR 1.65, Blue: Bridge, Sessions, Setup, Score, Prompt tools, Deliver HUB-118 and the Game view of failed run local-cac958d7-1f8e-4e65-9cb8-1471c839f796. DOM measurements and screenshots only; the automation tab fires no animation frames, so motion and frame rate were not observed. Read of scripts/pm/app/stage/engine.ts, config.ts, hud/FoundryHud.tsx, hud/layout.ts, hud/Telemetry.tsx. Nothing in this sheet is built."
---

# Agentic OS — Game and cockpit corrections

[Review and order](<Agentic OS Review.md>) · previous sheet: [Delivery reliability](<Agentic OS Delivery Reliability.md>) · governing board spec: [Local Run Stage Board and Attention](<Local Run Stage Board and Attention.md>) (R123)

**Later design proposal, 2026-11-21.** A first-person workbench for Local Delivery pairs the existing stage map with an operator’s seat, readable action outputs and a physical replay dial. [The Transfer Room](<Transfer Room/The Transfer Room.md>)

Execution sheet for what the owner looks at. Four items: correct the board (R125), raise it (R126), retire the skill page (R127), make the cockpit's records true (R128). Build from this file; where it disagrees with the R123 spec, this file wins. Everything R123 says that this file does not mention still holds.

## Contract for every item here

- **Truth contract unchanged.** Every lamp, count, name and state shown maps to a recorded row, check or phase. No percentage, no ETA, no invented file. Life (ambient motion) follows vitality; facts never wait for staging.
- **Performance budgets unchanged** from R123: static and state canvases draw only on invalidation; motion p95 ≤ 3 ms; at least 55 frames a second on the owner's machine; `Shift+P` shows the real numbers. A new visual is a baked sprite or a CSS transform, or it is not built.
- **Calm mode is untouched.** `LocalActions` admission stays byte-equal to HEAD.
- **No provider turn, no session command, no `pnpm pm` restart, no dependency.** Fixtures and replay only (`tests/pm-ui/fixtures/local-stage-*.mjs`, `local-session.browser.mjs`).
- **Hard Rule 28.** Labels, numbers, one- or two-word buttons. No sentence appears on the board.
- **Supported window, new:** 1280 × 640 to 2560 × 1440, DPR 1 to 2, plus 390 px wide. R123 tested from 1494 × 934 up; the defects below sit under that.
- **Verify, every item:** `pnpm typecheck`, ESLint on changed files, `pnpm pm:build-app`, `npx vitest run tests/pm-ui` from PowerShell, the browser suite at 1280 × 640, 1358 × 696, 1494 × 934 and 390 px in Blue and Pink. Evidence under `.pm/<id>-evidence/`. Finish with `pnpm pm:ship <ID> --note "<evidence>"`.

---

## R125 — The board fits, reads and offers the right action

**Tier:** `CLAUDE_MID`. **Size:** M. Corrections only; no new art.

Each row was observed on the failed HUB-118 run.

| # | Defect | Cause | Correction | Check |
|---|---|---|---|---|
| 1 | Page is 908 px tall in a 696 px window. Board bottom, Flow panel and rail buttons are cut | `stage/config.ts:196` sets `stage: { min: 520, offset: 230, max: 780 }`; the stage starts at y = 207, so 520 ends at 727. The detail tabs sit below it | Stage height = viewport height minus the stage's measured top (a `ResizeObserver` writes `--board-top`). Minimum 360. Nothing renders below the stage in Game mode: the six detail tabs open as a drawer inside it | `document.documentElement.scrollHeight === innerHeight` at all four desktop sizes |
| 2 | The wheel over the board never scrolls the page | `stage/engine.ts:143-148` calls `preventDefault` on every wheel event in `.board-region` | Plain wheel zooms only when the page cannot scroll. Otherwise zoom needs Ctrl or ⌘. Pinch keeps working | At 390 px the wheel scrolls the page; with Ctrl it zooms |
| 3 | Title reads "HUB-118 HUB-118 Require host sign-in … — criteria" | `hud/FoundryHud.tsx:160` passes `run.work.title` raw. Calm cleans it at `LocalRunReview.tsx:54` | One `displayTitle(run)` in `localRunModel.ts`; use it in the Game top bar, Calm header, `LocalDelivery.tsx:261` and the tab title | Unit test with the stored title; no second ID, no "— criteria" |
| 4 | Zone names are about 7 px, dark grey on dark blue | Drawn in the canvas in board units | Zone names are DOM chips placed from `onPlacements`: number and name, at least 11 px, contrast at least 4.5:1, `--ink-muted` at rest and `--ink` when active. Remove the canvas text | Every one of the 11 names passes the size and contrast check at 1280 × 640 |
| 5 | Zones 07–09 sit under the Flow panel; zone 07 touches the bottom edge | Camera fit uses the whole region, not the area left by the HUD | Fit to the free rectangle: region minus the measured HUD insets. Under 720 px of height the Flow panel collapses to one line | No zone pad intersects a HUD rectangle at any supported size |
| 6 | A failed run offers Review diff and Ship, not New attempt | The rail's action set ignores the closed-failed case. `BlackBox.tsx:48` still has the button | Closed with `failed` or `cancelled`: **New attempt** is the primary action. Review diff and Ship render only when the run has a candidate head | Fixture: failed without head → one primary, New attempt; `uat-ready` → unchanged |
| 7 | "STOPPED AT" breaks as "STOPPE / D AT" | Label column narrower than the word | Label column `min-content`, `white-space: nowrap` | Screenshot at 1280 × 640 |
| 8 | A run closed yesterday shows a signal timer at 9:52:47 and rising | `hud/Telemetry.tsx:65` renders `now − last signal` regardless of phase | Terminal phases show no signal timer. The top bar's final duration is the only clock | Fixture: closed run renders no `<time>` in telemetry |
| 9 | Flow says "15+ files", the rail says "4 files" | Two facts, one word: files read, files kept | Telemetry: `read`. Rail: `kept` | Text snapshot |
| 10 | The rail's log shows the end of the output, not the failing test | Raw tail | After [DLV-160](<Agentic OS Delivery Reliability.md#dlv-160--every-failure-names-its-real-cause>): show `failure.detail` first, raw log behind Error details. Before it: unchanged | Fixture with a `failure` object |

**Acceptance.** All ten checks, both themes, plus reduced motion and keyboard. No change to scene, liveness, attention or game models.

---

## R126 — Mission layout, follow camera, zone identity, failure scene

**Tier:** `CLAUDE_HIGH`. **Size:** L; build in the five slices below, in order, each shippable. **After R125. Slice 4 after [DLV-162](<Agentic OS Delivery Reliability.md#dlv-162--each-gate-runs-once-visibly-with-rule-verdicts>). Design against the recording from witness W1, not only fixtures.**

**The problem in one line.** The board is correct and small: a diorama in the middle of a page. It has to be the page.

### Slice 1 — Mission layout

```text
┌──────────────────────────────────────────────────────────────┬──────────────┐
│ ‹  HUB-118  Require host sign-in…     LINE 6/11   12:24  ⚙ ⛶ │ NEEDS YOU 1  │  44 px
├──────────────────────────────────────────────────────────────┤              │
│                                                              │  card        │
│                         BOARD                                │  card        │
│                    (fills everything)                        │              │
│                                                              │──────────────│
│                                                              │  New attempt │
├──────────────────────────────────────────────────────────────┴──────────────┤
│ FLOW ×0 ▮▮▮▯  read 15  edits 6  cmds 5  checks 0/4 │ ◀ Recap Full ▶ 1× │ tabs │  56 px
└─────────────────────────────────────────────────────────────────────────────┘
```

- On the run route in Game mode the app header and the Back row are replaced by the board's own 44 px bar: back chevron, ID, title, line, clock, settings, theater. The Game switch stays reachable in settings.
- Rail: 340 px, collapsible to a 44 px strip showing the count. Under 1100 px wide it starts collapsed.
- Dock: 56 px. Left: flow and counts. Centre: Live · Recap · Full · Play · tempo. Right: the six detail tabs as icons with labels; each opens a drawer over the board's lower 45 %.
- 390 px: bar, board (min 300 px high), dock as two rows, rail as a bottom sheet.

### Slice 2 — Camera

| Shot | When | Framing |
|---|---|---|
| **Overview** | Default; run closed; 20 s without a row; key `0` | Whole board in the free rectangle |
| **Follow** | A beat is staged on a zone; key `F` toggles | Active zone pad is 28 % of the region's width, centred; 900 ms ease on zone change |
| **Inspect** | Click a zone | That zone at 2.2×; its detail tab opens in the drawer; `Esc` returns |

- The camera is a CSS transform on the stage wrapper (`stage/camera.ts`). Canvas layers re-bake at three zoom buckets, 1×, 1.5× and 2.2×, 150 ms after the camera settles, so sprites stay sharp. Bake time stays under 4 ms per bucket.
- Follow never moves while the owner is dragging or within 5 s of a manual pan.
- Reduced motion: cuts, no eases.

### Slice 3 — Zone identity and light

Every machine gets three things: a silhouette nameable without its label, one emissive part in its group colour, one moving part while active. ERA is drawn 1.6× its present size and is the most saturated object on the board.

| # | Zone | Silhouette | Emissive | Moves while active | Driven by |
|---|---|---|---|---|---|
| 01 | Brief | Slanted console with a standing card | The card | Scan line down the card | Run created |
| 02 | Setup | Cargo tower, stacked crates | Top lamp | Crates lower one by one | `Installing dependencies` → `Native session started` |
| 03 | Explore | Archive wall of drawers | Open drawer | One drawer per read row | Read rows; count = files read |
| 04 | Think | Orb on a pedestal, one ring | The orb | Ring spins; pulse per message | Message rows |
| 05 | Build | Press under a gantry | Press head | One stamp per edit row; plates stack | Edit rows; plates = distinct files |
| 06 | Bench | Bench with a wide screen | The screen | Screen lines scroll per command | Command rows |
| 07 | Seal | Stamping arm over the capsule, six small lamps | The lamps | Lamps light in order | `Committing candidate`, then `Hook:` rows ([DLV-159](<Agentic OS Delivery Reliability.md#dlv-159--supervisor-git-steps-outlive-the-hook>)) |
| 08 | Verify | Row of arches, one per check | Arch lintel | Scanner sweeps the running arch | Check start and exit rows |
| 09 | Handover | Lectern with a document | Document edge | Document rolls and seals | `Freezing handover` → handover ID |
| 10 | Test | The owner's desk, in the owner's amber | Desk lamp | Lamp breathes while it is the owner's turn | `uat-ready`; scenarios signed n/m |
| 11 | Ship | Launch gantry holding the capsule | Pad ring | Capsule lifts on shipped; returns on reverted | `merging`, `push-pending`, `shipped`, `reverted` |

Light, all baked or CSS:

- Active pad: a pool of its group colour, opacity 0.5–0.8 at 0.5 Hz.
- Done zones: one steady strip in the group colour. Zones not reached: 35 % less saturation.
- One key light, top-left, for every face. No strokes.

### Slice 4 — Gate lane

- Zone 08 draws one arch per entry in the declared check list: four today, eight after DLV-162. The capsule passes each arch as its check ends.
- Each arch has a DOM chip: name, state, duration (`Types ✓ 1:42`). The running Tests arch shows the streamed count (`3,120 passed`).
- Zone 07's six lamps follow the `Hook:` rows. With DLV-162 and hooks off, zone 07 shows the single stamp and the lamps are not drawn.

### Slice 5 — Failure scene and results

**Failure**, played once over 2.4 s, then held:

1. The belt stops. The capsule settles on the failed zone's pad.
2. The pad switches to hazard stripes; the machine's emissive part turns the failure colour already used by the board's failure dot.
3. ERA walks to the zone and looks at it.
4. A DOM card rises from the machine: the failure title from `failure.code`, nothing else. Clicking it selects the rail's failure card.
5. Camera: Follow frames the zone and holds.

Reduced motion shows the final frame. Signal lost and Link down keep R120's frozen treatment; this scene is for `failed` only.

**Results**, on `uat-ready`, `shipped`, `cancelled`, `reverted` (extend `hud/Results.tsx`):

- Time per zone, from the first to the last recorded row in each zone. Zones without rows show a dash.
- Rank and badges under the existing rules; rank stays hidden on failed, stopped and lost runs.
- One primary action matching the state: **Test** · **Ship** · **New attempt**.

**Closed runs.** The dock's Play is the primary control. No autoplay.

### Acceptance

1. The board's bounding box covers at least 85 % of the free rectangle's limiting dimension in Overview, at every supported size.
2. No page scroll in Game mode on desktop sizes; the app header is absent on the run route.
3. Follow frames each of the 11 zones within 900 ms of its first staged beat; manual pan suspends it for 5 s.
4. Each zone is identified by silhouette alone by an unlabeled-screenshot check recorded in the evidence: 11 crops, 11 names, owner or reviewer.
5. Every emissive and moving part in the table is driven by the listed evidence in a unit test; none moves on a closed run.
6. Arch count equals the declared check count; chips show state and duration from the run record.
7. The failure scene plays once per failed run per page load and never on replay scrub.
8. Results show zone times that sum to no more than the run's duration.
9. Budgets hold: `Shift+P` at 1494 × 934, DPR 1.5 shows motion p95 ≤ 3 ms and ≥ 55 frames a second on the owner's machine during a Full replay of the W1 run.
10. Blue and Pink, reduced motion, keyboard, 390 px.

---

## R127 — Retire the Prompt tools page; show skill use in Setup

**Tier:** `CLAUDE_LOW`. **Size:** S. **Needs owner decision D3 for step 3 only.**

1. **Remove the page.** Delete `scripts/pm/app/Launchpad.tsx`, `launchpad.css`, `scripts/pm/launchpad-route.mjs` and its registration in the PM server, `.claude/recipes/`, `tests/pm-ui/launchpad.browser.mjs`. Remove the `skill-tools` case in `App.tsx` and the **Prompt tools** button in `Setup.tsx`. `#/skill-tools` and bare `#/launch` open Work. Delete `scripts/os/launchpad.mjs` and `launch-settings.mjs` if nothing else imports them; check with a search first.
2. **Show skill use.** Setup › Configuration › Skills gains two columns from recorded sessions: **Last used** (date or a dash) and **Sessions** (count). A skill with zero sessions over at least 20 recorded sessions is tagged **Unused**. Source: the session facts already in `.os/os.db`, through `scripts/pm/cockpit-reader.mjs`. Until [R128](<#r128--registry-recorder-and-counts-tell-the-truth>) repairs the recorder, the columns show a dash and the tag is not drawn.
3. **Sidecars.** D3 = keep: leave `scripts/os/forms.mjs`, the eight `form.json` files and `tests/os/launchpad.test.ts`. D3 = drop: delete them and the `FORM-MISSING` / `FORM-DRIFT` conflict classes in `scripts/os/check.mjs`.
4. **Records.** Cancel R98 under `_Conventions.md`. Update the header note of `Fable 2/Agentic OS/08 - Skill Launchpad.md`, the Launchpad section of `docs/Skills-and-Agents.md`, the Atlas entry `pm.md` and the Feature Map file `cross-cutting/pm-command-center.md`.

**Acceptance.** No route, button or bundle chunk for the page; `pnpm os:check` has no new finding; Setup shows the two columns from a fixture store; `pnpm sync:ai:check` and `pnpm docs:check` pass.

---

## R128 — Registry, recorder and counts tell the truth

**Tier:** `CLAUDE_MID`. **Size:** M.

| # | Defect | Evidence | Correction |
|---|---|---|---|
| 1 | The setup registry is stale and nothing refreshes it | `pnpm os:check` exits 1: `DRIFT .os/setup.json Registry is stale`. File dated 2026-11-14 18:37. Setup shows "1 errors" for it | When Setup loads and the fingerprint differs, the cockpit worker rescans (`.os/setup.json` is generated and ignored by Git) and Setup shows the fresh result. Add a **Rescan** button. `os:check` keeps failing on drift in CI |
| 2 | The recorder has flagged itself unavailable | `.os/recorder-unavailable` holds `2026-11-15T06:39:25.775Z`; written at `scripts/os/hook.mjs:179` when ingest fails; read at `ingest.mjs:52` and `report.mjs:183`. `.os/os.db` holds 8 sessions since 2026-11-11 | Find the failing ingest from `.os/events/*.jsonl` (`event: "unavailable"`), reproduce it in `tests/os/recorder.test.ts`, fix it. The marker clears on the next successful ingest. Setup shows **Recording** or **Unavailable since `<time>`** |
| 3 | 7 of 8 recorded sessions have no verdict | Bridge › Session quality: Clean 0, Failed 1, Unknown 7 | For each unknown session, name the missing fact (no base commit, no diff, transcript not ingested) in the session detail. Fix the largest class. Local runs must appear through the Delivery projection: check that run `local-cac958d7` is listed |
| 4 | Rule verdicts never run on the owner's commits | `.github/workflows/ci.yml:40` evaluates on `pull_request` only | Add a `push` step for `main`: `pnpm os:eval "${{ github.event.before }}..${{ github.sha }}"` |
| 5 | Two pages, two numbers for one thing | Bridge "Needs you · 28", Sessions "Needs you 8". Setup "Conflicts · 1", Score "Setup conflicts 13" | One selector per number in `cockpitModel.ts`, used by both pages. Bridge's total names its parts (`7 sessions · 21 decisions`). Score's tile uses Setup's count of errors and warnings; notes are not conflicts |
| 6 | Bridge paints a smaller number first | First paint: "Delivery status unconfirmed", "Needs you · 21"; three seconds later "28" | Until the delivery query settles, the Needs you and Running cards show a skeleton. On failure they show the known part and **Unconfirmed** |

**Tests.** Stale fixture registry → rescan; marker cleared after a good ingest; selector tests proving Bridge and Sessions, and Setup and Score, read the same value; Bridge browser fixture with a delayed delivery response.

**Acceptance.** `pnpm os:check` exits 0 on a fresh scan of the current setup; a Claude session started and ended in the repository appears in Sessions with a verdict or a named reason; the four numbers match across pages.
