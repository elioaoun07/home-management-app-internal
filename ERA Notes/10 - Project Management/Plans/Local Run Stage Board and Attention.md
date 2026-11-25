---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-11-15, working tree over a9ef5bc1 with R120 and R122 uncommitted. Read of scripts/pm/app/stage (engine.ts, iso.ts, palette.ts, quality.ts, entities, hud) and useStageClock.ts; live view and Full replay of run local-cac958d7-1f8e-4e65-9cb8-1471c839f796 (HUB-118, failed) at 1494 × 934, DPR 1.5, Blue, with an in-page frame profile. Nothing in this document is built."
---

# Local Run Stage — Solid Board, Attention and Performance

**Implementation status (2026-11-15):** All eight planned slices are implemented and machine-verified. Typecheck, scoped lint, PM build and documentation gates pass; 2,066 unique replay-only regressions pass, with eight existing Docker-only skips. Source-bound art/layout, 102-capture legacy and final 14-check wrapper/pulse/camera browser evidence are linked in [the walkthrough](<../../../.pm/r123-evidence/README.md>). Headed DPR-1.5 fixtures measured about 60 FPS, at most 0.5 ms phase p95, 33 rest/76 beat calls, 51 particles and 1.3 ms bake; these do not establish owner actual-specimen acceptance. The owner approved the narrow narrated-milestone/failure provenance fix. Genuine Installing-start compatibility preserves existing game awards/rank. Owner UAT/FPS and the owner restart for future supervisor rows remain Pending; no backend restart or history backfill occurred.

The last brief for the Game-layer view of a Local delivery run. It is self-sufficient: build from this file. [Local Run Game Mode](<Local Run Game Mode.md>) (R120) and [Local Run Stage Art and Motion](<Local Run Stage Art and Motion.md>) (R122) are background; where they disagree with this file, this file wins.

**What this pass does, in five words each:**

1. **Solid** — objects are lit shapes, not outlines.
2. **Calm** — one board, eleven zones, nothing overlapping.
3. **Fits** — the whole board is always visible.
4. **Fast** — 60 frames a second on the owner's machine.
5. **Yours** — anything that needs the owner is impossible to miss.

## Contract and ownership

- **Commission (owner, 2026-11-15, after building R122):** "It looks very promising, but still doesn't feel solid… everything is drawn as lines and outlines, it is hard to see them as solid objects, layering and planes; everything looks cluttered. I don't want a laggy system. Every step in a usual delivery has its own area or zone. The whole thing should display what needs my attention: a plan to review, a question that requires my decision, a file output I need to see." This is the final iteration; later fixes are the owner's.
- **Owning campaign:** PM Tooling. Successor to R122. Filed as **R123** before code; [criteria](<../PM Tooling/PM Tooling — Master Book.md#r123>). The filing block below remains the original acceptance template.
- **Kept:** `localRunScene.ts`, `localRunLiveness.ts`, `localRunFailure.ts`, `localRunActivityModel.ts`, `stage/director.ts`, `stage/vitality.ts`, `stage/game.ts` (it gains only §7), `FlightRecorder`, `StagePresence`, `PocketEra`, `tabPresence`, `stageSound`, the content of `BlackBox` and `Debrief`, the six-tab console, `LocalActions` and its admission rules.
- **Replaced:** `stage/engine.ts`, `stage/iso.ts`, `stage/palette.ts`, `stage/quality.ts`, `stage/camera.ts`, `stage/stateFx.ts`, everything in `stage/entities/`, `stage/hud/FoundryHud.tsx` and its CSS, `stage/FoundryStandby.tsx`, and the drawing half of `useStageClock.ts`.
- **Out of scope:** Calm view; Confined lane; Bridge; adapters; phone. The only server change is the optional slice 8.
- **Forbidden while building it:** a real Local session (Hard Rule 29 — fixtures and replay only), restarting the owner's `pnpm pm`, new npm dependencies.

## Evidence and constraints

### What R122 got right

Keep all of it: ERA as a character with eyes; the six-stage beat; vitality; flow, badges and rank; Recap and Full replay; `Commit hook failed` decoding; the truth contract.

### What is wrong, measured on the owner's screen

| Problem | Measurement | Cause |
|---|---|---|
| **Lag** | 18–20 frames a second, in every state, including a finished run doing nothing. 22–24 ms of script and about 27 ms of raster per frame. The quality governor is already on `low` and it does not help. | Each frame issues about 424 strokes, 433 fills, 229 rectangles and 131 ellipses, then copies the full 2144 × 895 world twice (image + fake reflection). Only five things are cached. |
| **Outlines** | Every face of every solid is stroked in the accent colour, and the three face tones are all dark navy. | `iso.ts` strokes each polygon; `palette.ts` sets `edge` to accent at 55 % and the faces to `--surface` ±. This came from the R122 brief and was wrong. |
| **Clutter** | Wireframe lattice, transparent rings, ghost plates, tall gantry frames and cables cross in front of the machines. | Too many transparent and thin parts; no rule against things crossing a neighbour. |
| **Does not fit** | Machines are cut off at every edge; the stage starts 366 px down the page and its bottom is below the fold. | The R122 minimum sizes (ERA 120, machines 190, core 220) cannot fit eleven things in 1431 × 598. |
| **Panels cover the world** | Mission, Terminal, Comms and the results panel sit on top of the machines; Mission and Terminal show scrollbars. | Floating panels with no reserved space. |
| **Nothing says "your move"** | A finished or waiting run shows two small buttons at the bottom right. | No attention model. |
| **Test code in the render loop** | `engine.ts` carries pixel read-back, alpha-bounds measurement, a gallery mode and a `Proxy` that redraws everything for bloom. | The R122 quality bar could only be proven by measuring pixels. That was also wrong. |
| **Verified performance was not real** | R122 recorded 4.2 ms p95. | Measured headless at DPR 1, script time only. |

Two smaller defects: the loading screen says `Preparing`, which is a phase name; and a one-second timer re-renders the whole page, feed included.

### Rules that stay

- **Truth contract.** Anything with a name, number or countable object is evidence only. A recorded row may be acted out after it is recorded (at most 12 s behind). Ambient life has no names and scales with vitality. Never: invented text, percentage, ETA, a success that was not recorded.
- **Words are a cost** (Hard Rule 28). The complete list of new strings is in [Text budget](#text-budget).
- **Calm mode and reduced motion** show the same facts, statically.
- **Blue and Pink** both work; colours come from theme tokens plus the fixed zone hues in §3.

## Design

### 1. Page and stage frame

The stage is the page. It must fit the window without scrolling.

- **Header.** In Game mode the title block above the stage is removed. The work id, title and settings move into the stage's top bar. Keep an `<h1>` and `.run-game-tag` in the DOM.
- **Stage size.** Full width of the page column; height `clamp(520px, calc(100dvh - 230px), 780px)`.
- **Regions.** Nothing may be placed outside its region, and no region overlaps the board.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR 48px:  zone track · HUB-118 title            ERA'S TURN ● 11:09   ⚙  ⛶      │
├───────────────────────────────────────────────────────────────┬──────────────────────┤
│  MAIN ●─●─○                               ┌ COMMS ─────────┐  │ NEEDS YOU · 2        │
│   ▲                                       │ (ERA) message… │  │ ┌──────────────────┐ │
│   │   01     02     03     04     05     06 └──────────────┘  │ │ Test steps       │ │
│   │  BRIEF  SETUP EXPLORE THINK  BUILD  BENCH                 │ │ 4 scenarios [Test]│ │
│   │  ═══════ outbound belt ══════▣═══════════╗                │ ├──────────────────┤ │
│   │            ERA ◉  (walkway)              ║                │ │ Review diff      │ │
│   │  ═══════ return belt ════════════════════╝                │ │ 2 files · money  │ │
│   11     10      09        08          07                     │ └──────────────────┘ │
│  SHIP   TEST  HANDOVER   VERIFY       SEAL                    │                      │
│ ┌ TELEMETRY ────────────┐                                     │ [Review diff] [Ship] │
│ │ FLOW ×7  counters  ▁▂▁│                                     │                      │
└─┴───────────────────────┴─────────────────────────────────────┴──────────────────────┘
```

| Region | Size | Holds |
|---|---|---|
| Top bar | 48 px, full width | Zone track, id and title, turn indicator, state caption, clock, one settings menu, theater |
| Board | Everything left of the rail, below the bar | The world only |
| Comms | 360 × 96, top-right corner of the board region | ERA's portrait and latest message. The corner is empty floor, so it covers nothing |
| Telemetry | 380 × 110, bottom-left corner of the board region | Flow, four counters, pulse line, badge count |
| MAIN | Top-left corner of the board region | The trunk: base node, merge node |
| Rail | 300 px, right side, full height below the bar | `NEEDS YOU` cards, results, and `LocalActions`. Collapses to a 40 px tab when it has nothing; the board then centres in the wider space |

**Removed:** the floating Mission and Terminal panels, the bottom stats bar, the transmission strip under the stage, the floating badge shelf, the floating results panel. Their content moves into zones, the rail and the tabs (§5, §6).

Below 900 px wide the rail drops under the stage. No horizontal overflow at any width.

### 2. The board

One isometric board, two terraces and an aisle. ERA's work happens on the back terrace; the hand-off to the owner happens on the front terrace, nearest the viewer. A belt carries the build out along the back and home along the front.

**Projection:** unchanged — `project(x, y, z) = (x − y, (x + y) / 2 − z)`.

**Geometry** (world units; 1 unit = 1 px at scale 1). Put these in `stage/config.ts`.

| Constant | Value |
|---|---|
| Column width | 128; columns 0–5 along x |
| Back terrace | y 0–100; pads 112 × 92, raised 6 |
| Aisle | y 100–220: outbound belt y = 130, walkway y = 160, return belt y = 190 |
| Front terrace | y 220–320; pads 112 × 92, raised 6 |
| Belt turn | x 768–792 |
| Slab | 12 beyond the outer pads, 14 thick |
| Height limits | Back machines ≤ 100. Front fixtures ≤ 56, so they never hide ERA or the belt behind them. SHIP ≤ 110 (nothing is behind it) |
| Footprint limit | Machine ≤ 72 × 64; nothing may extend past its own pad |
| ERA | 92 tall, moves only on the walkway |

**Fit.** The board's screen box is about 1150 × 650. Scale it uniformly to fit the board region with 16 px of margin — about 0.96 on the owner's window. **The whole board is always visible. The camera never zooms in by itself.** The owner may wheel-zoom and drag; `0` returns to fit. A ceremony may ease in by at most 6 %.

**The eleven zones, in delivery order**

| # | Zone | Stage group | Column, terrace | Machine at | Build stops at | ERA stands at |
|---|---|---|---|---|---|---|
| 01 | `BRIEF` | Setup | 0, back | (64, 50) | (64, 130) | (104, 160) |
| 02 | `SETUP` | Setup | 1, back | (192, 50) | (192, 130) | (232, 160) |
| 03 | `EXPLORE` | Build | 2, back | (320, 50) | — | (320, 152) |
| 04 | `THINK` | Build | 3, back | (448, 50) | — | (448, 152) |
| 05 | `BUILD` | Build | 4, back | (576, 50) | (576, 130) | (616, 160) |
| 06 | `BENCH` | Build | 5, back | (704, 50) | — | (704, 152) |
| 07 | `SEAL` | Build | 5, front | Press over the return belt at (704, 190); console (704, 268) | (704, 190) | — |
| 08 | `VERIFY` | Verify | 3–4, front (double pad) | Four hoops over the return belt at x = 608, 560, 512, 464; console (512, 268) | Each hoop in turn | — |
| 09 | `HANDOVER` | Test | 2, front | Clamp ring at (320, 190); console (320, 268) | (320, 190) | (360, 160) |
| 10 | `TEST` | Test | 1, front | The owner's desk (192, 266) | On the desk | (232, 160) |
| 11 | `SHIP` | Ship | 0, front | Launch pad (64, 266) | On the pad | — |

Each pad carries its number and name once, in the DOM, positioned on resize — never per frame.

These coordinates are starting values. Nudge them in `config.ts` until ERA is at least four-fifths visible at every stand point and no fixture hides the build at its stop.

**What lights each zone** — evidence only.

| Zone | Active when | Done when | Fault when |
|---|---|---|---|
| BRIEF | — | The run has a brief | — |
| SETUP | Phase `preparing` | `Native session started` is recorded | Dependency or secret-guard failure |
| EXPLORE | The row being staged is a read or search | Building has ended and it had at least one row | — |
| THINK | The row being staged is a message; and during the Think stage of every beat | As EXPLORE | — |
| BUILD | The row being staged is an edit | As EXPLORE | Agent could not start, ended early, or made no change |
| BENCH | The row being staged is a command or the agent's own check | As EXPLORE | — |
| SEAL | `Committing candidate` is recorded (slice 8 only); otherwise never shown active | A candidate head is recorded | The error starts with `git ` — where the specimen run stopped |
| VERIFY | Phase `checking` | Four of four passed | A check failed, or the candidate changed |
| HANDOVER | — | `Ready for owner UAT` is recorded | Handover missing |
| TEST | Phase `uat-ready` — this is the owner's zone | Handover accepted, and the diff reviewed when review is required | — |
| SHIP | `merging` | `shipped` | — (`push-pending` is a waiting state) |

A zone the run has not reached stays unlit. A work zone that had no rows when building ended is marked **skipped** — a hollow dot, never a green lamp. The four work zones (EXPLORE, THINK, BUILD, BENCH) each show one live count chip: reads, notes, edits, commands.

**Where the build is**

| Phase | The build sits at |
|---|---|
| `preparing` | SETUP |
| `building` | BUILD, for the whole phase |
| Candidate recorded | Passes through SEAL (the press stamps it once) |
| `checking` | The hoop of the check that is running, known from the supervisor's fixed order |
| `uat-ready` | Passes HANDOVER, then rests on the TEST desk — it comes to the owner's side |
| `merging`, `push-pending` | SHIP pad |
| `shipped` | Rises to MAIN and becomes the merge node |
| `failed` | Stays at the fault zone |

### 3. Solid art

The look is a lit miniature: light, matte objects on a dark board. Form comes from fills. This section replaces R122 §2 entirely.

**The seven rules**

1. **No outlines.** No solid is stroked. Delete the `edge` option from every primitive.
2. **Objects are lighter than the floor.** Three clearly different face tones, from the table below.
3. **Everything sits on something.** Each part has a dark contact patch under it and casts one flat shadow toward the bottom-right.
4. **Opaque.** No wireframes, no transparent structure, no glass panels. The only see-through things are light effects.
5. **Chunky.** At most 12 parts per machine. No part thinner than 6 px except an antenna. Big shapes first.
6. **Accent is rare.** Glowing accent covers less than a tenth of any machine: one screen, one lamp, one energy part.
7. **Nothing crosses a neighbour.** No cables in the air, no beams between zones. Conduits are flat lines inlaid in the floor.

**Materials** — computed once from theme tokens.

| Material | Top | Left face | Right face |
|---|---|---|---|
| Hull (machine bodies, ERA) | `--ink` 58 % over `--surface` | 42 % | 26 % |
| Trim (bases, belt, joints) | `--surface` + 10 % light | `--surface` | `--surface` − 20 % |
| Pad | `--surface-soft` | − 25 % | − 40 % |
| Board | `--surface` 60 % over `--theme-bg` | − 30 % | − 45 % |
| Zone colour (one feature part per machine, the pad stripe, the sign) | the hue | − 18 % | − 36 % |

In Blue the hull comes out near `#89939e` / `#68727f` / `#465260` — a readable slate solid against a navy floor.

- **Depth cues, all baked:** side faces darken 18 % toward the floor; a flat shadow at 28 % black offset by 0.35 × height; an optional 1 px lighter line on the two upper-left edges of top faces wider than 24 px.
- **Zone hues** (fixed in both themes): Setup `#818cf8`, Build = theme `--accent`, Verify `#a78bfa`, Test `#fbbf24`, Ship `#34d399`.
- **Status lamps** (one lamp post per pad): off, accent pulse (active), `#34d399` (done), `#fbbf24` (needs you), `#f87171` (fault). Amber always means the owner.
- **Glow** is a small pre-rendered radial sprite drawn additively at a lamp, screen or spark. There is no bloom pass.

**The machines** — one silhouette each, so they are told apart by shape.

| Zone | Silhouette | Parts | Its one moving part | What it shows |
|---|---|---|---|---|
| BRIEF | A slanted console with a large tablet | Base, desk wedge, tablet, blueprint tube | Tablet glow | One lit square per acceptance bullet |
| SETUP | A square jig beside three stacked crates | Four short posts, two clamp arms, three crates, a small crane | Crane lowers a crate (loops while preparing) | — |
| EXPLORE | A solid cabinet with a 4 × 6 grid of drawer fronts | Cabinet, drawers, scanner head on a short arm | A drawer slides out; a light bar sweeps for a search | Read drawers stay lit; edited ones fill with accent — a heat map of the repo |
| THINK | A pedestal holding a solid glowing orb inside a ring of beads | Pedestal, orb, bead rail | The orb pulses; three sparks circle it | One bead per recorded row, tinted by kind (60 shown, then a lap count) |
| BUILD | A low gantry over a cradle, with a furnace block | Two posts, crossbeam, laser head, furnace, cradle | The head slides; sparks | Furnace brightness = heat |
| BENCH | A desk with a big angled monitor and a probe arm | Desk, monitor, probe | A new line appears on the monitor; the probe taps | The last three commands as bars; the real text is in the zone chip |
| SEAL | A squat press straddling the belt | Base, two columns, press head, lamp | The head drops and rises once | A band on the build after it is sealed |
| VERIFY | Four solid hoops in a row over the belt | Four hoops, each with a lamp and a plate (`TYPE` `LINT` `TEST` `PM`); a console with four lamps | A scan bar in the running hoop | Lamp per check; a stopwatch on the running one; exit code and duration when done |
| HANDOVER | A clamp ring with a standing tablet | Ring, three clamps, tablet | Clamps close | Scenario count on the tablet |
| TEST | A low desk with a beacon post and task tokens | Desk, beacon, one token per open task | The beacon turns; tokens bob | Tokens: clipboard (test), magnifier (review), cylinder (SQL). Done tokens turn green |
| SHIP | A pad with a short tower and gantry arm | Pad, tower, arm, cradle | The arm retracts; exhaust | Amber while a push is pending |

**ERA.** Keep the R122 character and its eyes. Re-skin in hull material with an accent visor; no outline, no wire halo. Baked as sprites: body (upright, leaning left, leaning right, seated, down), two hands, thruster glow. Eyes are two small rectangles drawn live for blink and gaze.

**The build.** A carrier puck with chunky blocks stacked 2 × 2 — one block per distinct edited file, tinted by its top-level area, up to six layers; then a count. A band when sealed. Four studs on the puck front, one per host check. Runs with no paths get one untinted block per edit row. Read-only files are not on the build; they are the lit drawers in EXPLORE. This removes the ghost scaffold.

**Removed from R122:** the transparent Cortex lattice and its tether, ghost plates, the turntable rotation, the reflection, scanlines drawn per frame, bloom, the gantry frames, airborne cables, automatic zoom.

### 4. Motion

The beat, backlog policy, replay modes and tempo control stay exactly as `director.ts` implements them. Only the staging changes.

| Row | Zone | Work scene |
|---|---|---|
| Read | EXPLORE | A drawer (stable hash of the path) slides out and lights; a data chip rides the floor conduit to THINK |
| Search | EXPLORE | The light bar sweeps the cabinet; the zone chip shows the real pattern. No drawer is singled out |
| Message | THINK | The orb brightens, a note card rises from it; Comms types the message |
| Edit | BUILD | The laser head works, sparks fly, one block lands on the build. Same file again: the block flashes |
| Command | BENCH | A new line on the monitor; the zone chip shows the real unwrapped command |
| Agent's own check | BENCH | The probe taps; a neutral pulse. No pass or fail is claimed |

- **Think stage of every beat:** the THINK orb pulses and one light dot runs along the floor conduit to ERA. That dot is the decision.
- The current station has a lit front edge on its pad. ERA, the cargo and the machines can pass in front of that edge. The command for the active beat (e.g. `READ route.ts`) appears in the readout below the board.
- **Belt:** baked chevrons. A light pulse runs only along the segment the build is travelling.

**Ambient life** — few, and cheap. All of it stops at link-down.

1. ERA hover, blink, gaze
2. The active zone's lamp pulse
3. The active machine's idle loop (one part)
4. The THINK orb's slow pulse — `building` only
5. Eight drifting dust glows
6. The TEST beacon, while the owner is needed

**Whole-stage states are CSS overlays** (opacity and transform only) — never canvas work, never a CSS `filter`.

| State | Overlay | On the board |
|---|---|---|
| quiet | Dark overlay to 30 % | ERA hovers low, half-lidded |
| stale | Dark overlay to 65 % plus a pre-rendered frost vignette, faded in over 20 s | ERA sits; antenna dish sweeps; a sonar ring every 4 s. A new row clears it in 0.6 s |
| signal lost | Animated stripe overlay | ERA is a flickering ghost sprite; a tag shows the real time of the last row |
| link down | Static hatch | Everything frozen |
| failed | None — the board keeps its colour | The fault zone's lamp turns red, its machine shows its broken pose, up to 12 smoke puffs; the belt stops; ERA flies there and points at the rail |
| cancelled | Dark overlay to 30 % | ERA returns to BRIEF and powers down |

**Ceremonies** keep their R122 durations: boot, verify, each gate, handover, launch, failure. Boot covers the slow load and its caption reads `Loading`.

### 5. Needs you

One model, three surfaces. If the owner has to act, the page says so in the rail, on the board and in the tab — at the same moment.

**Model** — a new pure `scripts/pm/app/localRunAttention.ts`, unit-tested.

```ts
type AttentionKind =
  | "plan" | "question" | "summary" | "test" | "review" | "changes" | "sql"
  | "retry" | "failed" | "silent" | "lost";
interface AttentionItem {
  id: string;                    // `${run_id}:${kind}:${key}` — stable
  kind: AttentionKind;
  level: "act" | "look";         // act = waiting on the owner; look = worth the owner's eyes
  zone: ZoneId;                  // where it arises on the board
  title: string;                 // from the Text budget
  detail?: string;               // real data only: a path, a count, a domain list
  action: { label: string; run: string; href?: string };
  state: "open" | "done";
  since: number | null;          // recorded time it opened
}
export function localRunAttention(run: LocalRunView, seen: Set<string>, now: number): AttentionItem[];
```

**What the Local lane raises today** — every row is real data.

| Card | Kind, level | Opens when | Done when | Zone | Button |
|---|---|---|---|---|---|
| `Brief` | plan, look | The run has a brief | The owner has opened it (remembered per run in `localStorage`) | BRIEF | `Open` → Brief tab |
| `Summary` | summary, look | The last message row before the candidate exists | Opened | THINK | `Open` → the message in full |
| `Changes` | changes, look | A candidate head is recorded. Detail: `N files` when paths are known | Diff reviewed | BUILD | `Review` → existing review action |
| `Test steps` | test, **act** | Phase `uat-ready`. Detail: scenario count | `handover.acceptance.state` is `accepted` | TEST | `Test` → `#/delivery/test/<handover_id>` |
| `Review diff` | review, **act** | `uat-ready` and `risk.required`. Detail: file count and domains (`2 files · money, schema`) | `reviewed_head` equals `head` | TEST | `Review` → existing review action |
| `Run SQL` | sql, **act** | A changed or flagged path is `migrations/*.sql`; one card per file, three then `+N` | The owner ticks `Done` (remembered locally — the page cannot know) | TEST | `Copy path`, `Done` |
| `Retry push` | retry, **act** | `push-pending` or `revert-push-pending` | Shipped or reverted | SHIP | `Retry` → existing action |
| Failure title | failed, **act** | Phase `failed`. Detail: stopped-at and the excerpt, as today's black box | — | The fault zone | `New attempt`, `Copy` |
| `No signal` | silent, **act** | Liveness `stale`. Detail: the counter | A new row | Where ERA is | `Cancel` → existing action |
| `Signal lost` | lost, look | `interrupted` | — | Last zone | — |

**What the Local lane cannot raise.** A Local session runs unattended: it has no plan-approval gate and no way to stop and ask. So `plan` appears only as the brief, and `question` never fires on this lane. Both kinds are built and fixture-tested so the rail is ready for a lane that has them:

| Future source | Maps to |
|---|---|
| A plan awaiting approval (`V2Plan.status`) | `plan`, act, zone THINK, button `Open` |
| An open question (`V2Question`, with `questionPresentation` for its choices) | `question`, act, zone = where ERA is, button `Answer`; `blocking` questions sort first |

**Surface 1 — the rail.**

- Header `NEEDS YOU · n`, where n counts open `act` cards.
- Order: open act cards (oldest first), open look cards, then done cards collapsed to one ticked line.
- A card is an icon, the title, one line of detail, the waiting age (`12m`) and one primary button. Act cards have an amber edge; look cards a plain one.
- When the run has ended, the results card sits on top: the R122 results screen (title, counted numbers, rank, badges). On failure the failure card replaces it.
- `LocalActions` lives at the foot of the rail inside `.run-game-commandbar` — the only place the Review, Test, Ship, Undo and Cancel buttons appear.
- The rail opens by itself when the first act card appears. `N` focuses it.

**Surface 2 — the board.**

- The item's zone lights its lamp amber and its pad stripe pulses.
- Act items that belong to TEST stand on the desk as tokens. A done token turns green.
- Look items show a small accent marker on their zone: the BRIEF tablet glows, a note card stands on THINK.
- When an act card opens, ERA flies to that zone, turns to the viewer and points toward the rail. No text is invented.
- Clicking a zone opens its tab and highlights its card.

**Surface 3 — everywhere else.**

- **Turn indicator** in the top bar: `ERA'S TURN` while a phase is active and no act card is open; `YOUR TURN` whenever one is. It replaces the plain state lamp.
- Tab title `◆ 2 · HUB-118`; favicon amber.
- The existing notification and sound toggles fire once per new act card.

### 6. HUD details

- **Zone track** (top bar, left): eleven dots in five labelled groups — `SETUP`, `BUILD`, `VERIFY`, `TEST`, `SHIP`. Filled = done, hollow = skipped, pulsing = active, amber = needs you, red = fault. It keeps the `Delivery stages` nav role. Beside it: `LINE 7/11`, the count of zones done.
- **Settings menu** (one button): tempo, rank, sound, notify, Pocket ERA. Opaque and portaled.
- **Comms:** appears when a message row is staged, types at 28 ms a character, then shrinks to one line after 12 s. Click to expand.
- **Telemetry:** `FLOW ×n` meter, the four counters, the pulse line with the since-last-signal time, and a badge count that opens the shelf.
- **Badge pop:** a new badge appears top-centre for 2.5 s, then goes to the shelf.
- **Mission objectives** are the lit squares on the BRIEF tablet; their text is in the Brief tab and the `Brief` card.
- **Commands** are on the BENCH monitor and in the Activity tab.
- **The one-second tick** may re-render only the clock and the counters. Memoise the rail, the tabs and the feed.

### 7. Game layer

Flow, badges, rank, the results screen and the streak stay as `game.ts` implements them. Four additions, each a recorded fact:

| Addition | Rule |
|---|---|
| **Line** | `LINE n/11` — zones done or skipped, by the evidence table in §2. Progress without a percentage |
| **Turn** | `ERA'S TURN` / `YOUR TURN`, from the attention model |
| **Splits** | Time spent in each stage group, from the timeline bands, listed on the results card |
| **Retry plate** | A small `RETRY` plate on the BRIEF console when the branch name carries an attempt suffix |

One new badge: `Clean desk` — every act card done.

### 8. Performance — the architecture

The R122 engine redraws the world every frame. This one draws it once.

**Three canvases and a wrapper**

| Layer | Redrawn | Contents |
|---|---|---|
| Background | Never (CSS) | Gradient, stars |
| `static` canvas | On mount, resize (debounced 150 ms) and theme change | Slab, pads, belt, conduits, every machine's fixed body, shadows |
| `state` canvas | Only when a fact changes — a few times a minute | Lamps, lit drawers, beads, blocks on a resting build, hoop results, tokens, zone markers |
| `motion` canvas | Every frame, while something is animating | ERA, a travelling build, the active machine's moving part, light pulses, sparks, smoke |
| HUD | React | Everything with text |

The three canvases share one wrapper. **The camera is a CSS transform on that wrapper** — fit, pan and zoom cost nothing and never re-rasterise.

**The loop**

- One `requestAnimationFrame` loop draws only the `motion` canvas.
- Moving parts are sprites baked at mount. A frame is mostly `drawImage` calls.
- When no beat or ceremony is playing and vitality is at or below 0.1, the loop sleeps and wakes on the next fact.
- Off-screen, hidden tab and reduced motion stop it, as today.
- If the rolling average exceeds 8 ms for 30 frames, halve the particle cap; if it still does, draw every other frame. Nothing else changes with load — delete the three-tier quality system.

**Budgets**

| Measure | Limit |
|---|---|
| Canvas calls per frame on `motion` | ≤ 60 at rest, ≤ 150 during a beat or ceremony |
| Canvas calls per frame on `static` and `state` | 0 |
| Particles | ≤ 150 |
| Script per frame | ≤ 3 ms p95 |
| Frame rate on the owner's machine (1494 × 934, DPR 1.5) | ≥ 55 during Full replay; loop asleep on a finished run |
| Bake | ≤ 150 ms |
| Backing store | `static` and `state` at DPR up to 2; `motion` at DPR up to 1.5 |

**Banned in the frame path**

- `stroke()` on anything but at most 20 short light lines
- `createLinearGradient`, `createRadialGradient`, `shadowBlur`, `ctx.filter`
- `getImageData`, a `Proxy` around a context, a full-canvas `drawImage`
- `JSON.stringify`, writing `dataset` or attributes, `style.setProperty` on the stage root
- Layout reads (`getBoundingClientRect`, `offsetWidth`), React state updates
- Any CSS `filter` or `backdrop-filter` on an ancestor of the canvases

Facts attributes (`data-liveness`, `data-zone`, `data-station`, `data-plates`, `data-seals`, `data-replay`, `data-combo`, `data-attention`) are written **only when their value changes**. Per-frame numbers (`data-heat`, `data-particles`, `data-frame-ms`, camera) are written only when the root has `data-debug="true"`, which tests set.

**Remove from the product:** `alphaBounds`, `measureBuffer`, `pixelWitness`, `bloomWitness`, `entityBounds`, the gallery mode, `emissiveContext`. A test that needs to inspect art imports the bake functions into its own harness.

**Perf meter.** `Shift+P` shows frames per second, frame time (average and p95 over 2 s), canvas calls per frame and particle count. Call counting is on only while the meter or `data-debug` is on. This is how the owner checks for lag.

**How to verify — the R122 number was wrong because it was measured headless at DPR 1.**

1. Deterministic, anywhere: a browser test at 1494 × 934 with `deviceScaleFactor: 1.5` asserts the call budgets above during a Full replay of the specimen fixture.
2. Real: the owner opens the specimen run, presses `Shift+P`, plays Full replay and reads ≥ 55.

### 9. Code plan

```
scripts/pm/app/stage/
  config.ts          every tunable number: geometry, sizes, hues, timings, budgets
  iso.ts             project(); solid primitives, fills only
  palette.ts         material ramps from tokens; zone hues
  board.ts           bakeStatic(), drawState()
  zones/<id>.ts      eleven files: parts table, bake(), state(), motion()
  actors/era.ts      sprite sheet + eyes
  actors/build.ts    puck, blocks, band, studs
  motion.ts          the frame loop, sprites, governor, sleep
  fx.ts              glow sprites, particles
  camera.ts          fit + CSS transform
  perfMeter.ts
  director.ts game.ts vitality.ts        kept
  hud/TopBar.tsx AttentionRail.tsx Comms.tsx Telemetry.tsx ZoneChip.tsx Results.tsx
scripts/pm/app/localRunAttention.ts      new, pure
```

- `config.ts` is the owner's tuning file: every coordinate, size, colour and duration in this document lives there and nowhere else.
- No file over 400 lines; a zone file under 150. Write CSS one declaration per line.
- `DeliveryWorkshop.tsx` keeps its root element and attributes. It gains eleven zone hit areas with `data-zone`. Four keep the legacy accessible names the tests use: BRIEF `Open brief`, EXPLORE `Open activity`, BUILD `Open changes`, VERIFY `Open verification`. The legacy `data-station` value is derived: EXPLORE → `source`, BUILD → `forge`, VERIFY → `lab`, HANDOVER and TEST → `review`, the rest → `launch`.
- Tests: keep every model test. Rewrite `tests/pm-ui/local-stage-art.browser.mjs` for the board. Read `local-session.browser.mjs` in full first; each asserted hook either survives or its assertion is rewritten in the same change and listed in the evidence.

### 10. Acceptance

Done means every line is true at 1494 × 934 (DPR 1.5) and 2560 × 1271 (DPR 1), in Blue and Pink.

| # | Check |
|---|---|
| 1 | The stage fits the window without scrolling; the whole board is visible with a margin; nothing is cropped |
| 2 | No solid has a stroked outline; top, left and right faces are visibly three different tones |
| 3 | Every machine casts a shadow and stays inside its pad; no part crosses a neighbouring zone |
| 4 | No HUD region overlaps a zone; no panel shows a scrollbar |
| 5 | Eleven numbered, named zones in delivery order; the build visibly travels the belt through them |
| 6 | Each zone's lamp follows the evidence table; an unevidenced zone stays unlit |
| 7 | Every row kind plays its beat in the right zone; the zone chip shows the real label |
| 8 | At `uat-ready` the rail opens with `Test steps` (and `Review diff` when required), tokens stand on the TEST desk, the top bar reads `YOUR TURN`, the tab shows the count |
| 9 | On the specimen run the rail shows `Commit hook failed` with the excerpt and `New attempt`; SEAL's lamp is red; the board keeps its colour |
| 10 | A `migrations/*.sql` path raises `Run SQL`; `plan` and `question` fixtures render and sort correctly |
| 11 | Canvas-call budgets hold in the DPR 1.5 browser test; `static` and `state` draw nothing between fact changes |
| 12 | The stage code contains no `getImageData`, `Proxy`, gradient creation or attribute writes in the frame path |
| 13 | `Shift+P` works; the owner reads ≥ 55 frames a second during Full replay and a sleeping loop on a finished run |
| 14 | Calm mode, reduced motion, keyboard, no horizontal overflow from 390 px up; `LocalActions` admits exactly as before |
| 15 | Every name and number on the stage traces to a recorded row, check, setting or the brief |

### Text budget

Additions only. Everything in the R120 and R122 budgets stays.

- **Zones:** `BRIEF`, `SETUP`, `EXPLORE`, `THINK`, `BUILD`, `BENCH`, `SEAL`, `VERIFY`, `HANDOVER`, `TEST`, `SHIP`, `MAIN`.
- **Rail:** `NEEDS YOU`; cards `Brief`, `Summary`, `Changes`, `Test steps`, `Review diff`, `Run SQL`, `Retry push`, `No signal`, `Signal lost`, `Plan`, `Question`; buttons `Open`, `Test`, `Review`, `Copy path`, `Done`, `Retry`, `Cancel`, `New attempt`, `Copy`, `Answer`.
- **Top bar:** `ERA'S TURN`, `YOUR TURN`, `LINE n/11`.
- **Game:** `RETRY`, `Clean desk`.
- **Other:** `Loading`.

## Disposition and dependencies

Build in this order. Each slice leaves the page working. Tier aliases per `ERA Notes/Model-Registry.md`.

| Slice | Contents | Tier, effort | Done when |
|---|---|---|---|
| 1 — Frame and speed | §1 page and regions; §8 three canvases, CSS camera, loop, bans, perf meter; delete the instrumentation. Use flat placeholder boxes for zones | `CLAUDE_HIGH`, high | Acceptance 1, 11, 12, 13 hold with placeholders |
| 2 — Board | §2 geometry, pads, belt, labels, fit; `config.ts` | `CLAUDE_HIGH`, high | Acceptance 5 |
| 3 — Solid art | §3 kit, materials, shadows, the eleven machines, ERA, the build | `CLAUDE_HIGH`, xhigh | Acceptance 2, 3. Screenshot each zone alone and the full board |
| 4 — Motion | §4 beats per zone, zone chip, belt travel, ambient list, state overlays, ceremonies | `CLAUDE_HIGH`, high | Acceptance 6, 7 |
| 5 — Needs you | §5 model, rail, beacons, tokens, turn indicator, presence | `CLAUDE_HIGH`, high | Acceptance 8, 9, 10 |
| 6 — HUD and game | §6 top bar, Comms, telemetry, settings menu; §7 line, splits, plate, badges | `CLAUDE_MID`, high | Acceptance 4 |
| 7 — Finish | Reduced motion, Calm check, 390 px, both themes, hooks, evidence under `.pm/r123-evidence/` | `CLAUDE_MID`, high | Acceptance 14, 15 |
| 8 — Supervisor rows (optional, server) | Four additive rows in `local-lane.mjs`: `Installing dependencies` before the install, `Committing candidate` before the commit, `<check> started` from a new `onStart` in `hostChecks`, `Freezing handover` before the freeze; map them in `localRunActivityModel.ts` | `CLAUDE_MID`, high | SETUP, SEAL and the running hoop light while their work happens, instead of the stage reading `No signal`. Needs the owner to restart `pnpm pm` |

Slice 8 is the one thing that makes the specimen's five silent minutes read as "sealing" instead of "stalled". Skip it if any `tests/delivery-v2` change goes beyond updating expected row lists.

**Verification for every slice:** `pnpm typecheck`, scoped ESLint, `pnpm pm:build-app`, the `tests/pm-ui` Vitest files from PowerShell, the credential-free browser suite. No provider turn, no session command, no backend restart.

**Owner decisions, with the default this plan assumes**

| Question | Default |
|---|---|
| Plan review and questions on the Local lane? | Not possible today; the rail is ready for them. Raising them needs engine work that is not in this plan |
| Slice 8? | Build it last; it needs one `pnpm pm` restart by the owner |
| Remove the title block above the stage in Game mode? | Yes |

### Filing

```md
### R123

**Outcome:** The Local delivery Game stage is a solid, uncluttered board of eleven zones that fits the window, runs at 60 frames a second, and makes anything needing the owner impossible to miss.
**Kind:** feature
**Source:** Owner commission 2026-11-15 after R122: "still doesn't feel solid… everything is drawn as lines and outlines… cluttered… I don't want a laggy system… every step in a usual delivery has its own area… displaying easily stuff that needs my attention." Spec: [Local Run Stage Board and Attention](<../Plans/Local Run Stage Board and Attention.md>).
**Touches:** `scripts/pm/app/stage/`, `DeliveryWorkshop.tsx`, `LocalRunGame.tsx`, `useStageClock.ts`, new `localRunAttention.ts`, `tests/pm-ui/`; optional `scripts/delivery-v2/local-lane.mjs`, `local-process.mjs`

- **Acceptance:** The fifteen checks in the plan's Acceptance table hold at 1494 × 934 (DPR 1.5) and 2560 × 1271, in Blue and Pink.
- **Acceptance:** The frame path meets the canvas-call budgets and contains none of the banned operations; the owner reads at least 55 frames a second during Full replay.
- **Acceptance:** `localRunAttention` is unit-tested for every card in the plan, including `plan` and `question` fixtures.
- **Acceptance:** R120 and R122 model tests pass unchanged; `LocalActions` admission is unchanged.

**Reading guide:** this plan only; `stage/director.ts`, `stage/game.ts`, `localRunScene.ts`, `localRunFailure.ts` for the kept models.
**Verify:** Typecheck, scoped lint, PM app build, PM Vitest, credential-free browser scenes at DPR 1.5. No provider turn or backend restart.
**Implementation:** pending
**UAT:** pending
```

## Retirement

When the filed ID ships and the owner accepts it, move the surviving rules — the truth contract, the zone evidence table, the attention sources, the performance bans and the three text budgets — into `ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md` and the PM Tooling Master Book, then move this file and the two earlier Local Run plans to `_Archive/Plans/` together.
