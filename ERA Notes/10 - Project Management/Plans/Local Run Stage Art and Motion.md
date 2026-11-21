---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: active
owner: Elio
evidence_cutoff: "Historical planning observation, 2026-11-15: working tree over a9ef5bc1 with R120 uncommitted. Read of the R120 stage source (DeliveryWorkshop.tsx, useStageClock.ts, stageFx.ts, localRunScene.ts, LocalRunGame.tsx, localRunActivityModel.ts) and one live view plus replay of run local-cac958d7-1f8e-4e65-9cb8-1471c839f796 (HUB-118, failed) at 2560 × 1271, Blue. Nothing specified here had been built at that observation cutoff; this is not the current implementation status."
---

# Local Run Stage — Art, Motion and Game Layer

**Execution override (owner, 2026-11-15):** "regardless what it actually says, i want a full delivery of the plan, so keep going". The intermediate stop after A is waived. Build and verify all slices 0/A–H; retain the entity-by-entity visual reviews and every quality bar. Filed as R122 before code.

**Current implementation (2026-11-15):** R122 implements all authorized slices 0/A-H. Typecheck, scoped lint, build, 673 PM tests, 163 settled art captures, 20 transition captures and 100 session-regression captures pass. Final amended profiling is 4.2 ms p95 / 252 peak particles; the art pass measures 55.516% / 55.517% actual world ink in Blue/Pink. The exact served assets and 149 app-source hashes are retained under `.pm/r122-evidence/`; [R122 criteria](<../PM Tooling/PM Tooling — Master Book.md#r122>) owns the detailed receipt. [Owner scenarios](<../../../docs/Delivery-UAT.md#local-run-foundry-world--r122>) remain Pending. The initial observation and R120 comparison table below are historical planning evidence. Keep both plans active until owner acceptance, then follow Retirement.

The second brief for the Game-layer view of a Local delivery run. [Local Run Game Mode](<Local Run Game Mode.md>) (R120) made the page truthful: liveness, failure decoding, replay, presence. This one makes it a **world**. It keeps R120's models and replaces how the stage looks, moves and plays.

**Why the first build reads as a blueprint:** the first brief specified behaviour and left the art to the builder, who drew it as thin outlines. This brief is an art and motion bible with numbers, and it ends in a measurable quality bar that a wireframe cannot pass.

**The test of success:** freeze any frame and it looks like a screenshot from a game, not a diagram. Watch for a minute with nothing being recorded and it is still obviously alive — until the session really goes quiet, and then you can see it wind down.

## Contract and ownership

- **Commission (owner, 2026-11-15, after building R120):** "It feels a primitive blueprint of what I would expect. I would like a better, more detailed, advanced, cooler, more animations, futuristic, more gamified approach. Maybe slower transitions as well… I would need to see a gamified version of how someone would imagine AI thinking, working, showing off busy, realistic and gamified."
- **Owning campaign:** PM Tooling. Successor to R120 (implementation done, UAT pending). Filed as **R122 before code**; the [Filing](#filing) block retains the original task contract.
- **Kept from R120, unchanged:** `localRunScene.ts`, `localRunLiveness.ts`, `localRunFailure.ts`, `localRunActivityModel.ts` (plus the two fixes below), `FlightRecorder`, `StagePresence`, `PocketEra`, `tabPresence`, the content of `BlackBox` and `Debrief`, the six-tab console, `LocalActions`.
- **Replaced:** the SVG world inside `DeliveryWorkshop.tsx`, `stageFx.ts`, and the visual half of `useStageClock.ts`.
- **Out of scope:** Calm view; Confined lane; Bridge; adapters; server; any session command; phone.
- **Forbidden while building it:** a real Local session (Hard Rule 29 — fixtures and replay only), restarting the owner's `pnpm pm`, new npm dependencies.

## Evidence and constraints

### What R120 delivered, and what is missing

Working on the specimen run: `Commit hook failed` with the test summary, the state lamp and elapsed clock, replay with scrubbing, tab title, six plates on the core.

| Aspect | R120 today (measured) | This brief |
|---|---|---|
| Mass | Every machine, the core and ERA are 1 px outlines with no fill | Lit solids: three-tone faces, emissive edges, bloom |
| Scale | ERA ≈ 50 px, machines ≈ 100 px, core = a row of six small cubes, on a 1440 × 620 stage; most of it is empty | ERA ≥ 120 px, machines ≥ 190 px, core ≥ 220 px |
| Life | With no row arriving, only a hover bob and one orbit ring move | At least 14 things moving while the session is alive |
| A row | One dot crossing in 0.65 s plus 16 radial dots; ERA settles in about 0.75 s | A scene of about 4.4 s in six stages |
| Depth | One plane, 5° pointer tilt | Five parallax layers, shadows, reflection, a camera |
| Character | A hexagon with a text glyph for a face (`>_`, `◎`, `✦`) | A character with eyes, hands, tools and behaviour |
| Mind | None | The Cortex |
| Game | Four counters | Quest log, level map, flow combo, badges, gauntlet, rank |
| Failure | Whole stage greyscale — reads as disabled; the card covers the core | A wounded, living scene; ERA presents the black box beside the core |
| Frame cost | 0.4 ms p95 of a 4 ms budget, 123 particles peak | Spend it: 6 ms p95, 600 particles |

### Defects found while checking R120 — fix first (slice 0)

1. **A truncated row becomes a fake file.** Codex caps summaries at 240 characters (`codex.mjs:412`). The cut-off path `…\ERA No` is counted as a sixth file and gets its own constellation cluster. When a summary's length equals the cap (240, or the store's 400), drop the trailing fragment.
2. **Explore is still undercounted** — 3 reads / 14 commands on the specimen, where 9 of those 14 are reads. The same cap removes the closing quote, so `unwrapLocalCommand` leaves a leading `"` or `'` and `readCommand` misses `"Get-Content …`, `"rg -n …`, `"git diff …`. Strip an unbalanced leading quote after unwrapping.
3. **Tab title and favicon follow the replay cursor** (`● HUB-118` while replaying a failed run). Presence must always describe the real run.
4. **The black box covers the Build Core** and has two nested scrollbars. Fixed by §8.
5. Not fixed here: the run detail takes about 9 s to load on this run ("Loading session…", R118 residual). The boot sequence in §8 covers the wait.

### Truth contract, version 2

The owner now asks for visible thinking and busyness. R118 and R120 forbade invented motion. Both hold if the stage is split into three layers with different rules.

| Layer | What belongs to it | Rule |
|---|---|---|
| **Facts** | Anything with a name, a number, a word or a countable object: files, plates, seals, memory beads, labels, counters, clocks, badges, rank | Evidence only, exactly as R120. Shown in the HUD the moment it is recorded. |
| **Staging** | How a recorded fact is acted out | A row may be played as a longer scene after it is recorded. The scene may trail reality by at most 12 s, then must catch up. |
| **Life** | Anything with no name: glow, hum, dust, cable flow, Cortex cascades, ERA's idle behaviour | Free — but its amount is `vitality`, computed from liveness. It never shows text and never mimes a specific tool action. |

**Never, in any layer:** invented text (code, thoughts, filenames), a percentage, an ETA, a progress bar inside a step, a success that was not recorded.

**Amendments to earlier wording** (accepted by the owner, 2026-11-15):

1. R120 "All motion maps to recorded rows" → all *facts* do; life is governed by vitality.
2. R118 "never… an invented thinking trace" → the Cortex is allowed because it is abstract and text-free, and runs only while the agent session is actually running (`building`, liveness `live` or `thinking`).
3. R120 "No… score" → combo, badges and rank are allowed because each is computed from recorded facts by a rule published in §9. Still no percentage, no ETA.
4. The R120 text budget is extended by [Text budget](#text-budget) only.
5. The stage gains three semantic colours (§2).

**Vitality** — one number, 0 to 1, that every ambient animation multiplies by. This is what keeps the stale hint honest: the busyness is real because it stops.

| Liveness | Vitality | Reached over |
|---|---|---|
| live | 1.0 | 1.5 s |
| thinking | 0.85 | 3 s |
| quiet | 0.35 | 6 s |
| stale | 0.08 | 20 s |
| your turn / push pending | 0.3 / 0.4 | 3 s |
| shipped | 0.5, then 0.25 after the ceremony | — |
| failed | 0.2 (wounded loop) | after the failure sequence |
| cancelled / reverted | 0.1 | 3 s |
| signal lost | 0 (glitch loop only) | immediate |
| link down | 0 (hard freeze) | immediate |

**Real strings available for busy surfaces** — use these instead of inventing any: the unwrapped command, file paths, ERA's messages, acceptance bullets from `work.brief`, check names / exit codes / durations, branch, base and head hashes, executor · model · effort, `usage` at the end.

## Design

### 1. The Foundry

Three actors and four machines.

- **The Mind** — the Cortex, a holographic neural lattice above the bay. It thinks.
- **The Worker** — ERA, a character tethered to the Cortex. It acts.
- **The Work** — the Build Core, a tower on a turntable. It grows.

Every recorded row plays the same loop: **Think → Decide → Travel → Work → Deliver → Remember.**

```
              ═══●═══════●════════ MAIN ════════════════○═══   trunk: base … merge
                                                        ║ launch rail
     ARCHIVE                     ✺ CORTEX               ║          FORGE
     slab vault                 mind + memory ring      ║          fabricator
        ╲                            ┊ tether                         ╱
         ●━━━━━━━━━━━━━━━━━━   ⬢ BUILD CORE   ━━━━━━━━━━━━━━━━━━━━━●
        ╱                      on the turntable                       ╲
     DOCK               ERA ◉                                        LAB
     dais + beacon                    ▲ GATE                       four gates
```

```
┌ SETUP ━ BUILD ━ VERIFY ━ TEST ━ SHIP                       ● BUILDING  11:09  ⧉ ⛶ ♪ ┐
│ ┌ MISSION ──────┐                                           ┌ TERMINAL ───────────┐ │
│ │ HUB-118       │                                           │ > rg -n "signInWi…  │ │
│ │ ◇ objective 1 │                  the world                │ > Get-Content src/… │ │
│ │ ◇ objective 2 │                                           │ ✓ pnpm typecheck    │ │
│ └───────────────┘                                           └─────────────────────┘ │
│ ┌ COMMS ───────────────────────────────────┐  FLOW ×7 ▰▰▰▰▱   5 files · 6 edits …   │
│ │ (ERA) The data exposure is confirmed: …  │  ▁▂▁▁▃▁▁▂▁ pulse          [Review][Ship]│
└─┴──────────────────────────────────────────┴────────────────────────────────────────┘
```

Stage size: `min(1440px, 100vw − 48px)` wide, `clamp(560px, 64vh, 760px)` tall.

### 2. Art direction — the anti-blueprint rules

**Renderer.** One procedural isometric scene on Canvas 2D; the HUD stays DOM. Machines are *built from a primitive kit*, never hand-authored SVG paths — that is what makes them detailed, animatable part by part, and rotatable.

- **Projection:** 2:1 isometric, `project(x, y, z) → (sx, sy)`, painter-sorted by `x + y`, then `z`.
- **Primitive kit** (`iso.ts`): box, hex prism, cylinder, ring band, dome, holo panel, cable. Every solid draws three faces.
- **Material ramp**, derived from theme tokens and recomputed on theme change:

| Role | Value |
|---|---|
| Top face | `--surface` + 14 % light |
| Left face | `--surface` − 8 % |
| Right face | `--surface` − 22 % |
| Edge | `--accent` at 55 % |
| Emissive | `--accent` |
| Glass / hologram | `--accent` at 12 % fill, 70 % edge |
| Contact shadow | black at 35 %, soft ellipse |
| `--stage-ok` / `--stage-warn` / `--stage-bad` | `#34d399` / `var(--warning-ink)` / `#f87171` — lamps, seals and FX only, never feed rows |

- **Line weights:** silhouette 2.5 px, structure 1.5, detail 1, hairline 0.5 at 40 %. Uniform 1 px line work is the blueprint look and is not allowed.
- **Light:** one key light from the top-left. Everything emissive is also drawn into a quarter-resolution buffer that is scaled back up with smoothing and composited `lighter` — a cheap, filter-free bloom. On the High tier a second, eighth-resolution pass widens it.
- **Atmosphere, back to front:** deep gradient; three parallax dust and star layers; the trunk and rail; the world; a 12 % mirrored floor reflection; foreground motes; vignette; a 4 % scanline overlay.
- **Density.** Every machine has at least eight parts, port LEDs, a plate with a three-letter code, and a cable to the deck. The deck has three tiers, inlaid circuit traces, edge ticks and hazard chevrons round the bay.
- **No glyphs as art.** `✦ ✧ ◇ >_ • •` do not appear on the stage.

### 3. Entities

Sizes are on-screen at camera zoom 1.0 on a 1440 px stage. Each entity is one file exposing a pure `draw(ctx, state, t)`.

**Build Core — the hero (≥ 220 px tall at 12 plates)**

| Part | Meaning | Behaviour |
|---|---|---|
| Turntable | — | Rotates the whole tower, one turn per 90 s × vitality |
| Hex tower, six slots per ring, up to four rings | One **solid plate** per distinct edited file | Plate snaps in with a ring flash; a re-edit adds a tally mark to its plate |
| Outer scaffold ring | One **ghost plate** per file read but not edited | Wireframe; solidifies and moves in if the file is later edited |
| Energy column inside | Heat | Brightness follows `heat` |
| Four clamp bands | The four host checks | Open brackets → locked `ok` → broken `bad` → hollow `warn` (inconclusive) |
| Sockets in the base | Acceptance bullets | Dark → blinking `warn` at your turn → lit when accepted |
| Fracture | Failure | Emissive crack from the fault height, halves offset 6 px, embers rising |

Runs with no paths (Claude) get the same tower from unlabelled plates, one per row. Beyond 24 plates the rings compress and a count shows.

**ERA — the worker (≥ 120 px)**

| Part | Detail |
|---|---|
| Head | Rounded-hex helmet with a wide emissive visor |
| Eyes | Two capsules that blink every 3–6 s and look at whatever ERA is working on — the camera when speaking, the Cortex when thinking |
| Expressions | focused (narrow), pleased (arcs), surprised (round), tired (half-lids), off (dark), glitch (static) |
| Antenna | Tip blinks on every recorded row; unfolds into a sweeping dish when stale |
| Chest ring | The flow meter (§9) |
| Hands | Two floating hands holding the current tool: scanner, welder, slate, probe |
| Thruster | Glow cone and exhaust that scale with speed |
| Halo, shadow | Halo spins with vitality; the shadow shrinks as it rises |
| Tether | A light thread to the Cortex; command chips travel down it, result sparks up |

Movement is spring-damped along the conduits: a 150 ms dip before leaving, a lean into the turn, hands and halo trailing by 150 ms, a 4 % overshoot on arrival. Idle behaviour — look around, stretch, spin the halo, glance up at the Cortex — is generic by rule and never mimes reading, editing or running.

**The Cortex — the mind**

| Part | Meaning | Behaviour |
|---|---|---|
| Lattice | The agent session | 3D point cloud, slowly rotating, edges to nearest neighbours. Node count follows the real effort setting: low 40, medium 64, high 90, above 120 |
| Cascades | Life | Activation waves spread along edges like firing synapses; rate = vitality × (0.5 + heat). **Only in `building`** — during checks the agent is not running, so the Cortex dims to a slow standby breath |
| Output node | A decision | On each row a wave converges on the bottom node, which emits a **command chip** carrying the real label |
| Memory ring | Rows recorded | One bead per recorded row, tinted by kind, filling clockwise (cap 200 = the retained window, `+` beyond). Experience visibly accumulating, without a percentage |
| Plate | Identity | `executor · model · effort`, as recorded |
| Satellites | Subagents | One mini-lattice per distinct subagent id, with its own drone |

**The four machines (≥ 190 px each)**

| Machine | Parts | Idle | Work | Fault |
|---|---|---|---|---|
| **Archive** `SRC` | Tiered plinth; vault of 4 × 8 slabs; gantry with a reader head; rotating index disc; cable trunk | Disc turns, LEDs twinkle | Gantry travels to the slab assigned to that path (stable hash), pulls it, scans it. Slabs stay lit afterwards — read = edge glow, edited = filled — so the vault becomes a heat map of the repo | Disc stops, lamp `bad` |
| **Forge** `FRG` | Plinth; print bed; gantry with a laser head; crucible; two pistons; vents; conveyor arm | Crucible breathes with heat | Laser rasters a plate in five passes, sparks, pistons pump, vents puff | Crucible dark, smoke column |
| **Lab** `LAB` | Plinth; side bench; conveyor through four upright rings engraved `TYPE` `LINT` `TEST` `PM`; a readout per ring | Rings at rest, readouts dark | The running ring spins with a stopwatch; pass clamps shut, fail shatters | Shards stay on the deck |
| **Dock** `DCK` | Dais with cradle clamps; three shield pylons; beacon mast | Beacon dark | Clamps close, dome rises, beacon lights and beams upward | Beacon dark |

Plus the **Gate** (front, where ERA arrives and Setup happens), the **launch rail** (back) and the **main trunk** along the top, with a node for the recorded base and a hollow node waiting for the merge.

### 4. Motion — slower, weighted

All staged durations multiply by `--stage-tempo`. A HUD control offers 0.75× / 1× / 1.5×; 1× is already far slower than R120.

| Motion | R120 | Now (tempo 1×) |
|---|---|---|
| HUD number change | instant | 700 ms roll, with a `+1` floating up from the machine that earned it |
| ERA travel | ≈ 0.75 s lerp | 1.4–1.9 s spring, plus anticipation and settle |
| Machine work | — | 450 ms spin-up, 1.4–2.2 s loop |
| Delivery to the core | 0.65 s straight line | 0.8 s arc along the conduit |
| Camera move | — | 1.8 s to settle |
| Type-on | 12 ms / char | 28 ms / char, 220 ms pause at sentence ends |
| Stage card | 0.9 s | 2.4 s (0.5 in, 1.4 hold, 0.5 out) |
| Live → quiet | instant | 6 s cross-fade |
| → stale | 20 s frost | 20 s, whole scene (§8) |
| Ceremonies | — | Boot 2.5 s · failure 5 s · handover 6 s · launch 8 s |

**Principles.** Ease out on arrivals (`cubic-bezier(.22, 1, .36, 1)`); springs for the character; linear only for flows. Anticipation, overlap (the machine spins up 300 ms before ERA arrives), follow-through, settle. Nothing teleports and nothing snaps.

**Camera.** A critically damped spring over `{x, y, zoom}`: wide 1.0 at rest, 1.15 pushed toward the machine during Work, 1.25 on failure, 1.3 for ceremonies. Parallax factors 0.05 / 0.15 / 0.5 / 1.0 / 1.3. The owner can drag to pan, wheel to zoom (1–1.8) and double-click a machine to hold on it; `0` resets, `A` returns to auto.

### 5. The beat — one recorded row, about 4.4 s

| Stage | ms | What happens |
|---|---|---|
| Think | 0–500 | Cortex waves converge on the output node; ERA looks up |
| Decide | 500–900 | A command chip forms — kind icon and the **real label** — and drops down the tether |
| Travel | 900–2300 | ERA flies to the machine (a 350 ms turn if already there) while the machine spins up |
| Work | 2300–3700 | The machine's scene for that kind |
| Deliver | 3700–4200 | The product arcs to the core, or the result spark climbs the tether |
| Remember | 4200–4400 | A bead joins the memory ring; the counter rolls; the flow meter steps; the pulse line spikes |

The HUD shows the fact immediately; the scene acts it out. A command, then its execution.

| Row | Work scene |
|---|---|
| **Read**, path known | Gantry to the slab → slab slides out → scan sweep → a holo page shows the real basename → it folds into a cube in ERA's hand → ERA carries it to the scaffold, where it becomes a ghost plate |
| **Read**, no path | The same with the next unlabelled slab |
| **Search** | A scan plane sweeps the whole vault; a holo strip shows the real pattern. No slab is singled out — the row does not say which files matched |
| **Edit** | ERA plugs into the Forge → the laser rasters the plate, sparks fly → the basename is etched → the plate arcs to the tower and snaps in, with a ring flash and a 3 px camera kick. Same file again: a beam re-etches the existing plate and adds a tally mark |
| **Command** | ERA opens its slate; the Terminal panel types the real unwrapped command; the prompt returns |
| **Agent's own check** | ERA flies a probe to the Lab bench; the bench scans it; a neutral pulse. No pass or fail is claimed — the row carries no exit code |
| **Message** | ERA turns to the camera; the Comms panel opens with its portrait and types the message; the Cortex pulses with the typing |
| **Subagent row** | Played by that subagent's drone |

**Supervisor rows are ceremonies, not beats.**

| Recorded | Ceremony |
|---|---|
| `Native session started` | ERA powers on at the Gate; the Cortex lattice draws itself in; card `BUILD` |
| `Host checks started` | The Cortex dims to standby; a crane lifts the core onto the gauntlet conveyor; card `VERIFY` |
| A check is running | Its ring spins with a stopwatch counting from the previous finish. Which check is running is known because the supervisor runs them in a fixed order (`local-process.mjs:20`) |
| `<check>: 0` | The ring clamps; a band flies onto the core; the readout prints the exit code and duration; a badge pops |
| `<check>` non-zero or null | The ring shatters, or stays hollow `warn`; the readout prints the exit code |
| `Ready for owner UAT` | Handover (§8) |
| `Owner opened diff review` | The dome turns to glass and an inspection ring passes down the core |
| `Owner shipped merge` | Launch (§8) |

**When rows arrive faster than beats play**

| Queue | Policy |
|---|---|
| 0–1 | Full beat |
| 2–3 | 1.5× |
| 4–6 | 2.5×, skip Think |
| More than 6, or more than 12 s behind | **Montage:** ERA holds at the core and conducts; each row fires at its machine for 350 ms; a `×N` tag shows the burst. Every fact still lands |

**Replay** gets two modes: `Recap` (the existing 20 s, as montage) and `Full` (every row a full beat; each silence compressed to 2 s with a tag showing the real gap, e.g. `5:25`).

**The specimen run, as it would play**

| Recorded (UTC) | Row | On stage |
|---|---|---|
| 06:08:15 | `Get-Item migrations/db-state.json…` | Chip `READ db-state.json`; ERA to the Archive; a slab lights; first ghost plate; badge *First contact* |
| 06:08:31 | `rg -n 'db:verify-rls…'` | Chip `SEARCH`; the vault sweep; the strip reads `db:verify-rls` |
| 06:08:36 | message | ERA turns to you: "The checked-in RLS snapshot is stale…" types in Comms |
| 06:08:40 | read ×3 | Three slabs, three ghost plates; flow reaches ×5 |
| 06:10:02 | edit `allergies/route.ts`, `drinks/route.ts` | Two plates forged and snapped in; badge *First cut* |
| 06:13:59 | message | "Implemented HUB-118…" |
| 06:14–06:19 | nothing recorded (commit hook) | 20 s: thinking. 90 s: quiet, lights at 70 %. 4 min: **stale** — frost, ERA lands, the dish sweeps, `No signal 4:00` |
| 06:19:24 | failure | The Forge → Lab conveyor snaps; the failure sequence; ERA projects `Commit hook failed` |

### 6. Life — what moves when nothing is recorded

Each item scales with vitality. At vitality 1 at least 14 are visibly moving; at link-down, none.

1. Cortex cascades (building only) and lattice rotation
2. Tether shimmer
3. ERA hover, blink, look-at, idle behaviour
4. Thruster exhaust
5. Halo spin
6. Turntable rotation
7. Core energy column flicker
8. Cable flow dashes on every conduit
9. Machine LEDs twinkling; index disc; crucible breath
10. Duty meters — five LEDs per machine showing its share of the rows in the last two minutes (a fact, drawn as life)
11. Dust motes on three parallax layers
12. A light sweep across the deck every 8 s
13. Hologram scan flicker on the panels
14. Beacon and trunk glow
15. Camera drift of ±6 px over 40 s

### 7. HUD

DOM, styled as holograms: corner brackets, tick rulers, monospace micro-labels, a scanline fill. All real text stays selectable and reachable by keyboard.

| Panel | Content | Notes |
|---|---|---|
| **Level map** (top-left) | `SETUP ━ BUILD ━ VERIFY ━ TEST ━ SHIP` — the existing five stages from `localRunStages` | Current node pulses, done nodes fill, a failure marks the exact node or the link between two. Keeps the `Delivery stages` nav |
| **Mission** (left) | Work id and the acceptance bullets, 60 characters each, expandable | Locked → awaiting test → accepted. The owner's own words, not UI prose |
| **Terminal** (right) | The last four real commands, typed in | Monospace. Hidden when the run has no command rows |
| **Comms** (bottom-left) | ERA's portrait — a live miniature of its face — and its latest message, typed | A game dialogue box. Replaces the transmission bar under the stage |
| **Telemetry** (bottom) | Flow meter, counters, pulse line, since-last-signal, actions | `LocalActions` unchanged inside `.run-game-commandbar` |
| **Top-right** | State lamp, caption, clock, tempo, Pocket ERA, theater, sound, notify | Existing controls |

At 390 px: Mission and Terminal collapse to two buttons; Comms becomes one line.

### 8. States and ceremonies

**Boot** (on mount, and while the run detail loads). Circuit traces draw across the deck, machines rise out of it one by one, ERA drops in at the Gate. If the data is slow it holds on a standby hum. When the data arrives the existing plates fly in over at most 2 s — no historic beats are replayed.

**Quiet.** Key light to 70 %, cascades at a third, ERA hovers low with half-lidded eyes.

**Stale** (over 20 s). Key light to 35 %. Frost grows inward from the deck edges. Cable flow stops. Machines drop to a slow `warn` standby blink. ERA lands and sits, thruster off; the antenna unfolds into a dish and sweeps; every 4 s a sonar ring leaves it. `No signal m:ss`. **Recovery:** on the next row the frost shatters outward in 600 ms, the lights surge and ERA springs up — as visible as the stall.

**Signal lost.** The last frame holds under a glitch pass: tear bands, a 2 px colour split. ERA is a flickering wireframe ghost where it last stood; the tether is cut and its end sparks. A tag shows the real time of the last row.

**Link down.** A hard freeze — no loop at all, because nothing is known. Diagonal hatch, Retry.

**Failed** — 5 s, then a steady wounded loop. *No global greyscale.*

1. Impact flash at the fault point and a 6 px camera kick.
2. Two `bad` alarm arcs sweep the deck.
3. Power-down cascade: machine lights go out one by one, moving away from the fault.
4. The core cracks at the fault height; embers start.
5. ERA is knocked back, recovers, flies to the core and switches on a projector.
6. The **black box unfolds from that projector, docked in the right third — never over the core** — with a single scroll area.
7. The camera settles at 1.25 on the core and the panel.

Steady state: embers, a smoke column from the fault, a flickering fault lamp, a dim Cortex with a scar, saturation down 35 %. ERA stays beside the panel, looking between it and you.

The fault point comes from `localRunFailure`: the Gate (setup), the Forge (agent), **the Forge → Lab conveyor, which snaps** (commit hook, as on the specimen), the failed ring (verify), the Dock (handover).

**Cancelled.** ERA salutes, returns to the Gate and powers to standby; machines shut down in order; the core stays, unlit. Card `STOPPED`.

**Your turn** — 6 s. The core rides from the Lab to the Dock, the clamps close, the dome rises, the beacon lights and sends a `warn` beam upward; ERA turns and presents. Steady state: a slowly rotating beam and the waiting age. When the handover is accepted the sockets light in sequence.

**Push pending.** The core at the top of the rail, clamps flashing `warn`.

**Shipped** — 8 s. Clamps release, the core rises up the rail on a column of exhaust, a shockwave ring crosses the deck, the core enters the trunk and becomes a new node labelled with the real merge hash. ERA celebrates. Then the results screen (§9). Steady state: a slowly turning hologram of the core over the empty bay.

**Reverted.** The trunk node dims and a counter-node appears beside it.

### 9. The game layer

Every element is a recorded fact run through a published rule.

**Flow (combo).** `combo` = the length of the trailing chain of rows whose gaps are 20 s or less — the same 20 s at which liveness leaves `live`, so the combo is alive exactly while the session is. Shown as `FLOW ×7` and as the charge in ERA's chest ring. Tiers at ×3 `WARM`, ×6 `FLOW`, ×10 `OVERDRIVE` raise bloom, trail length and cascade rate. From 15 s of silence the meter visibly drains, so you watch a combo about to break.

**Badges.** They pop inside the stage — not through the app's toast system — then sit on a shelf.

| Badge | Rule |
|---|---|
| First contact | First row recorded |
| Scout / Cartographer | 5 / 15 read rows |
| First cut | First edit row |
| Builder / Architect | 5 / 10 edit rows |
| Warm / Flow / Overdrive | Combo ×3 / ×6 / ×10 reached |
| Gate: typecheck, lint, test, pm:lint | That host check passed |
| Full seal | 4 / 4 |
| Handover | Reached your turn |
| Accepted | Handover accepted |
| Shipped | Shipped |
| First try | On the first attempt (branch has no suffix, `local-lane.mjs:239`) |
| Sprint | Your turn within 10 minutes of the first row |

**Gauntlet.** Verify is four gates with real names, real exit codes and real durations (§5).

**Rank.** Shown on the results screen; the rubric shows on focus.

| Rank | Rule |
|---|---|
| S | Shipped, first attempt, 4 / 4, never stale |
| A | Shipped |
| B | Ready for test |
| — | Failed, stopped or lost: no letter |

**Results screen.** One format for every ending: `MISSION COMPLETE`, `READY FOR TEST`, `MISSION FAILED`, `STOPPED`. Numbers count up to their real values — duration, files, edits, commands, gates, peak flow, tokens when recorded — then the rank stamps, the badges line up, and one primary button follows: `Test steps`, `New attempt`, or nothing. It reuses `Debrief` and `BlackBox` content. On failure the black box sits where the rank would.

**Streak insignia.** ERA's shoulder shows the existing clean-streak count from `gameFacts`; a clean ship plays `+1`. No new scoring.

### 10. Sound

Extends `stageSound.ts`; still off until toggled. Adds a quiet pad whose filter follows vitality, one extra layer per flow tier, a clamp for each gate, a low impact for failure, and silence at link-down.

### 11. Build notes

**Files** (new folder `scripts/pm/app/stage/`)

| File | Role |
|---|---|
| `iso.ts`, `palette.ts` | Projection, primitive kit, theme ramp |
| `engine.ts`, `camera.ts` | Layers, painter sort, bloom, sprite cache, quality tiers, pause; camera spring |
| `entities/` — `deck`, `archive`, `forge`, `lab`, `dock`, `rail`, `core`, `era`, `cortex`, `cables`, `ambient` | One entity each, pure `draw(ctx, state, t)` |
| `director.ts` (pure) | `planBeats(rows, queue)` → staged commands; backlog policy; ceremonies |
| `vitality.ts`, `game.ts` (pure) | Vitality; combo, badges, rank |
| `fx.ts` | Sparks, embers, smoke, shards, frost, trails |
| `hud/` | Level map, Mission, Terminal, Comms, Telemetry, results screen |

`DeliveryWorkshop.tsx` keeps its root element, attributes and the four station buttons, which become transparent hit areas positioned from projected coordinates through refs.

**Hooks that must survive.** Read `tests/pm-ui/local-session.browser.mjs` in full first. It asserts on `.delivery-workshop` and its `data-station`, `data-active`, `data-motion`, `data-liveness`, `data-heat`, `data-plates`, `data-seals`, `data-replay`, `data-particles`, `data-frame-ms`; on `.stage-fx`, `.stage-announcement`, `.workshop-presence`, `.stage-black-box`, `.black-box-excerpt`, `.run-game-commandbar` (with `data-stale`), `.run-game-console`, `.run-game-patch`, `.run-game-tag`, `.run-game-events`; on the favicon link; and on the R118 names and strings listed in the R120 plan. Each one either survives or its assertion is rewritten in the same change and listed in the evidence.

**New hooks:** `data-vitality`, `data-combo`, `data-beat`, `data-backlog`, `data-quality`, `data-camera`, `data-tempo`.

**Performance**

- Budget: 6 ms p95 scripting per frame at 1440 px; canvas DPR capped at 1.5; at most 600 particles.
- Static geometry is cached per machine in an offscreen sprite and redrawn only when zoom changes by more than 2 % or the theme changes.
- Three tiers chosen automatically from a 2 s rolling frame average: **High** (two bloom passes, 600 particles, 120-node Cortex), **Medium** (one pass, 300), **Low** (no bloom, 120, 24-node Cortex, no camera moves). 390 px starts on Low.
- Pauses off-screen and in a hidden tab, as today.

**Reduced motion and Calm.** Reduced motion renders one composed frame of the current state, applies facts instantly and jumps ceremonies to their end frame. Calm mode is untouched.

**Not used:** three.js, WebGL, asset packs, new dependencies.

### 12. The quality bar

The work is not done until every line holds, at 1440 px, in Blue and in Pink, with a screenshot as evidence.

| # | Bar |
|---|---|
| 1 | ERA ≥ 120 px tall, each machine ≥ 190 px, the core ≥ 220 px at 12 plates; world art covers at least 55 % of the stage |
| 2 | No solid is drawn as an outline only: three shaded faces everywhere, and the four line weights are all present |
| 3 | Bloom is visible on the High tier: emissive edges carry a halo of at least 6 px |
| 4 | At least five parallax layers; contact shadows under ERA, the core and every machine |
| 5 | Each machine has at least eight parts and three distinct motions |
| 6 | In `live` with no rows arriving, at least 14 elements are moving; in link-down, zero |
| 7 | A full beat lasts at least 3.2 s at tempo 1× and shows all six stages |
| 8 | Every liveness state is identifiable from a 320 px greyscale thumbnail by silhouette alone: stale = ERA seated under a dish; failed = cracked core and smoke column; your turn = the beam |
| 9 | No glyph characters as art |
| 10 | Frame p95 ≤ 6 ms; at most 600 particles; the tier is reported in `data-quality` |
| 11 | Every name and number on the stage traces to a recorded row, check or setting |

### Text budget

Additions to the R120 list. Nothing else.

- **Level map:** `SETUP`, `BUILD`, `VERIFY`, `TEST`, `SHIP` (existing stage labels).
- **Panels:** `MISSION`, `TERMINAL`, `COMMS`.
- **Chips:** `READ`, `SEARCH`, `EDIT`, `RUN`, `CHECK`, `SAY`.
- **Machine plates** (decorative, hidden from assistive tech): `SRC`, `FRG`, `LAB`, `DCK`; gates `TYPE`, `LINT`, `TEST`, `PM`.
- **Flow:** `FLOW ×n`, `WARM`, `FLOW`, `OVERDRIVE`.
- **Badges:** the names in §9.
- **Results:** `MISSION COMPLETE`, `READY FOR TEST`, `MISSION FAILED`, `STOPPED`; rank `S`, `A`, `B`.
- **Controls** (accessible names): `Tempo`, `Recap`, `Full`, `Auto camera`, `Rank` (the required owner-toggle for rank letters).

## Disposition and dependencies

**Original process gate — superseded by the owner execution override above:** build one corner to final quality, then stop for visual approval. The owner has waived that intermediate stop and authorized the full 0/A–H delivery. Entity-by-entity visual review and every quality bar still apply; final owner acceptance remains separate from implementation.

| Slice | Contents | Tier, effort | Done when |
|---|---|---|---|
| 0 — Truth fixes | Defects 1–3 | `CLAUDE_MID`, medium | Specimen fixture reads 5 files, and its `Get-Content` / `rg` / `git diff` rows count as Explore; presence ignores replay |
| **A — Golden corner** | Engine, kit, palette, bloom, camera; deck, Forge, ERA, Build Core; the Edit beat end to end, played by replaying the specimen | `CLAUDE_HIGH`, xhigh | Quality bars 1–5, 7 and 9 hold for these entities. Intermediate owner stop waived 2026-11-15; continue through B–H. |
| B — World | Archive, Lab, Dock, Gate, rail, trunk, cables; every beat; backlog policy; Recap and Full replay | `CLAUDE_HIGH`, high | Every row kind in §5 has a browser scene |
| C — Mind and life | Cortex, memory ring, tether, vitality, the §6 list, idle behaviour | `CLAUDE_HIGH`, high | Bar 6; cascades stop outside `building` |
| D — States | Boot, quiet, stale and recovery, signal lost, link down, failure sequence with the docked black box, cancelled | `CLAUDE_HIGH`, high | Bar 8 |
| E — Ceremonies | Handover, review, push pending, launch, reverted, results screen | `CLAUDE_HIGH`, high | Each ending has a scene |
| F — Game | Level map, Mission, flow, badges, gauntlet readouts, rank, streak insignia | `CLAUDE_MID`, high | `game.ts` unit-tested against the specimen timeline |
| G — HUD and sound | Comms with portrait, Terminal, tempo, manual camera, sound bed | `CLAUDE_MID`, high | Keyboard reachable; silent until toggled |
| H — Finish | Tiers, 390 px, reduced motion, Pocket ERA portrait, evidence | `CLAUDE_MID`, high | Bars 10–11; all R118 / R120 hooks pass |

**How the builder must work**

- Build the primitive kit first. Machines are assembled from it, never drawn as hand-written paths.
- Add an **entity gallery** to the fixture harness: each entity alone, in each of its states. It is where the art is judged and where screenshots come from.
- After each entity: screenshot at 1440 px in Blue and Pink, compare with §12, iterate, keep the before and after.
- Verification as R120: `pnpm typecheck`, scoped ESLint, `pnpm pm:build-app`, the `tests/pm-ui` Vitest files from PowerShell, the credential-free browser suite; evidence under `.pm/r122-evidence/`. No provider turn, no session command, no backend restart.
- The owner can review at any point by replaying the specimen run in `Full` mode in the running `pnpm pm` — the UI bundle rebuilds on save, and replay is read-only.

**Owner decisions (2026-11-15)**

| Question | Decision |
|---|---|
| Visible thinking — the Cortex, gated to `building` and scaled by vitality? | **Yes.** Shows no text. Amendment 2 accepted. |
| Rank letters? | **Yes, on.** Hidden on failed, stopped and lost runs, with a switch to turn it off. |
| Three semantic colours on the stage? | **Yes.** Lamps, seals and effects only. |
| Default tempo? | **1× by default**, with 0.75× available. |
| Sound bed? | **Build it, off until toggled.** |

### Filing

```md
### R122

**Outcome:** The Local delivery Game stage is a living world: a mind, a worker and a build that grows, where every recorded row plays as a scene and the session's health is readable from its motion.
**Kind:** feature
**Source:** Owner commission 2026-11-15 after R120: "It feels a primitive blueprint… more detailed, advanced, cooler, more animations, futuristic, more gamified… slower transitions… how someone would imagine AI thinking, working, showing off busy, realistic and gamified." Spec: [Local Run Stage Art and Motion](<../Plans/Local Run Stage Art and Motion.md>).
**Touches:** `scripts/pm/app/stage/` (new), `DeliveryWorkshop.tsx`, `LocalRunGame.tsx`, `useStageClock.ts`, `localRunActivityModel.ts`, `StagePresence.tsx`, `BlackBox.tsx`, `Debrief.tsx`, `stageSound.ts`, their CSS, `tests/pm-ui/`

- **Acceptance:** The stage passes all eleven lines of the plan's quality bar at 1440 px in Blue and Pink, with screenshots.
- **Acceptance:** Every recorded row plays the six-stage beat; bursts follow the backlog policy and never trail reality by more than 12 s; replay offers Recap and Full.
- **Acceptance:** Ambient life scales with vitality: at least 14 elements move while live, the scene winds down through quiet to stale, recovers visibly, and freezes at link-down. Cortex cascades run only while the agent session is building.
- **Acceptance:** Every name and number on the stage traces to a recorded row, check or setting; no invented text, percentage or ETA. A truncated row never creates a file, and shell-wrapped reads count as Explore.
- **Acceptance:** Failure plays its sequence with the black box docked beside the core; stale, signal lost, cancelled, your turn, push pending, shipped and reverted each have their scene.
- **Acceptance:** Flow, badges and rank follow the published rules and are unit-tested against the specimen timeline.
- **Acceptance:** Calm, reduced motion, keyboard, 390 px and desktop, Blue and Pink hold; R118 and R120 hooks pass or are consciously rewritten; `LocalActions` admission is unchanged; frame p95 ≤ 6 ms.

**Reading guide:** this plan; `Plans/Local Run Game Mode.md` (liveness, failure, text budget); `localRunScene.ts`; `useStageClock.ts`; `coreParticles.ts`.
**Verify:** Typecheck, scoped lint, PM app build, PM Vitest, credential-free browser scenes and the entity gallery. No provider turn or backend restart.
**Implementation:** pending
**UAT:** pending
```

## Retirement

When the filed ID ships and the owner accepts it, move the surviving rules — truth contract v2, the vitality table, the game rules and both text budgets — into `ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md` and the PM Tooling Master Book, then move this file and `Local Run Game Mode.md` to `_Archive/Plans/` together. If slice A's look is rejected, revise §2–§3 here before any further slice.
