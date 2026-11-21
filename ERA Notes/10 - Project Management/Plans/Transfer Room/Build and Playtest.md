---
created: 2026-11-21
type: plan
status: proposed
---

# Build and playtest

**Implementation, 2026-11-21.** The Local Game offers Seat and Overview, an inline evidence reader for all zones, exact-action jogging and two comparison pins. It uses three compressed art layers, the existing replay clock and the existing attention controls. Choosing **Take seat** remembers the view in that browser. The owner’s comparison and physical-device frame pacing remain part of acceptance. [Fixture results](../../../../.pm/r131-evidence/result.json)

The first playable scene is the moment a cassette crosses the bench. Can Elio tell what ERA just did, reach the evidence, and feel that the near end of the sled belongs to him? Build that minute before furnishing the rest of the room. The setting and control specification are in [The Transfer Room](<The Transfer Room.md>) and [Controls and Replay](<Controls and Replay.md>).

## First playable cut

| Cut | Build | Decide at the bench |
| --- | --- | --- |
| 1. Take the seat | Add a fixture-only view in the Local Game shell. Compose the lip of the desk, a rail between the seats, ERA's hands and one glass cassette using still artwork at three depths. Put the jog wheel within reach. Two authored poses show a recorded edit and a handoff. | Mute the scene and hold each pose. Ask the owner where they sit, who has the cassette and where they would reach to inspect it. If the seats read backwards or the cassette disappears into the bench, change the sightline and material contrast before animating. |
| 2. Read the work | Feed the seat the same recorded snapshot as the board. Wire the step list, action list and output reader first. One wheel detent selects one retained action. A burst can shorten ERA's gestures while every action stays in the list. The near-edge caption reports the latest live receipt even while a gesture finishes. | Jog through two rows with the same timestamp. Open one output, inject a later row, then close the reader. The selected row, focus and scroll position survive. If the wheel misses, retain the Previous / Next buttons and tune its input mapping. |
| 3. Receive the handoff | At a recorded owner handover, the cassette rides to the near stop and settles against a physical catch. Opening it reveals the existing handover evidence. A deliberate live action goes through the existing owner control. Replaying the arrival or moving the sled cannot submit anything. | Run the same moment live on a fixture, paused one row early, and in Full replay. The handover is visible precisely when supported. Every inspection produces zero command requests. Ship admission still matches the current view. |
| 4. Compare and return | Offer two optional comparison stops on the same instrument. Each holds a selected row and its available evidence. Closing comparison returns to the exact row, step and focus that opened it. | Have the owner show which of two edits preceded a check. Keep comparison if it improves that job. If it obscures the live action or confuses the two outputs, ship the single-cursor proof first. |

## Fit it to the current Game

In `scripts/pm/app/LocalRunGame.tsx`, `buildTimeline(run)` and `sceneAt(timeline, time, rowId)` already supply live and historical views. Resolve each comparison stop through that same projection. A path-only edit can show its path. A historical check can show output available at that cursor. Give each result its source label and time. Reading a cassette uses a passive detail view. The existing Review action has command semantics and stays on the explicit live control. [Game shell](../../../../scripts/pm/app/LocalRunGame.tsx) · [Scene projection](../../../../scripts/pm/app/localRunScene.ts)

Mount one active renderer in the Game shell. Reuse its clock, replay publication and visibility handling. Bake the room and bench into the background layer, update recorded cassette markings on fact changes, and draw moving hands, the sled and its contact shadow on the motion layer. Render the accessible action list and selectable text in screen space. The fixed seat needs one composed perspective. A static composition with the same reader and controls is the fallback for reduced motion or an unavailable canvas. [Stage clock](../../../../scripts/pm/app/useStageClock.ts) · [Renderer](../../../../scripts/pm/app/stage/engine.ts) · [Replay publication](../../../../scripts/pm/app/stage/replayPublication.ts)

Use the concept painting as a lighting reference. Export an empty room, separate resting and reaching poses, and a cassette with its shadow. This allows the artist to place a *single* cassette anywhere along the rail without leaving a painted duplicate behind. Reserve the middle of the opening frame for the exchange. Load the reader and the plain step controls first, then decode the room art once on entry to Seat. On a slower machine, remove reflections first, then use held poses with cuts. Keep the handoff silhouette and the source text at every quality level.

## Locate the hiccup

R126 measured 58.228 FPS and a 0.6 ms p95 animation callback in headed Full Follow fixture replay. Those measurements describe a particular recording and machine. They leave Elio's present-day hiccups unexplained. Two places worth profiling are the 100 ms fact pass, which derives zone evidence and game facts, and the canvas allocations around size or zoom changes. Record the browser's input, script, paint and composite tracks before changing either. [Measured baseline](../../../../.pm/r126-evidence/README.md) · [Current timing and budgets](../../../../scripts/pm/app/stage/config.ts)

Compare three 30-second passes of each view on the same device, trace, viewport and DPR. Include a warm replay, a cold first handoff and a burst while opening the reader. Record browser version, build, sample count, median and worst pass. Keep idle sleep separate from animation samples.

| Proposed acceptance | How to measure |
| --- | --- |
| At least 55 FPS active on the owner's 60 Hz desktop and stage callback p95 ≤3 ms | Use the existing headed probe and Shift+P. Also report p95/p99 presented-frame intervals and counts over 50 ms. Investigate each repeatable stall even when average FPS passes. |
| Jog or open to first readable change ≤100 ms p95 | Measure 30 discrete inputs. Separately time a new fixture receipt reaching the live caption. Exclude transport latency and include the next paint. |
| Bounded drawing | Keep current caps of 60 rest calls, 150 beat calls, 150 particles, static DPR 2 and motion DPR 1.5. Static and fact layers redraw on invalidation. A settled terminal, hidden or reduced-motion scene schedules zero motion callbacks. |
| Readable in both themes | Test 1280 × 640, 1494 × 934 at DPR 1.5, 2560 × 1440 at DPR 2, and 390 × 844. Repeat with keyboard, touch, reduced motion and audio off. Check visible focus, text selection, drawer clearance and a labeled button for each wheel gesture. |

Classify what the owner felt as well as when it happened. If the live caption is already current while the hands are several actions behind, shorten or discard queued gestures on a burst or tab return. If the caption and wheel both freeze during a resize, inspect the allocation and paint trace. If frame times hold while the reader jumps to the newest row, repair focus and scroll anchoring. Those three defects can feel like the same hitch at the bench.

## Replay it locally

From the repository root run the existing cursor and publication checks first.

```powershell
pnpm exec vitest run tests/pm-ui/local-board-replay.test.ts tests/pm-ui/local-board-publication.test.ts tests/pm-ui/local-board-render-boundaries.test.ts
```

For browser comparison, use the disposable A5 fixture in a checkout with installed project dependencies. Launch `node tests/pm-ui/fixtures/a5-browser.mjs` in one terminal with port 4397 free. In the proposed room harness, reuse `fixtureAssets`, `routeFixture` and `specimen` to intercept requests and serve the same recorded inputs to both views. Save new captures under a fresh evidence directory. Close the fixture with Ctrl+C. The specimen contains tied setup rows, twelve edits, a long recorded gap, four host checks and a handover. Add branches for a failed hook, an unavailable output, an interrupted observation link, and a Local Claude question arriving while reading. Assert the final row and selected evidence at every seek, plus zero unexpected writes. [Fixture and specimen](../../../../tests/pm-ui/fixtures/local-stage-board.mjs) · [Readability harness](../../../../tests/pm-ui/r129-readability.browser.mjs)

## Owner playtest

Show Board then Room on one trace and reverse the order on a second. On each, ask Elio to find an edit's output, identify the agent's last observed action, rewind to just before a result, then locate what needs his decision. Capture wrong answers, time to evidence and any moment he loses his place. After a minute of quiet work, ask “Where did you feel you were?” and “Which moment made you want to stay, or leave?”

**Advance** when all four tasks are accurate, time to evidence holds against the Board, comfort and pacing pass on the owner's screen, and Elio chooses the Room for his next long session. **Iterate** on the first missed cue or uncomfortable motion and repeat that scene. A beautiful room that costs him his place still needs another pass.

## From the prototype to Local Game

After the handoff works, connect the other zones in delivery order. Ship the map-to-seat round trip with each station’s reader, then add distinct poses for lost signal, interruption and failure, and the recorded Ship and Revert endings. Finish with the edge-on cassette recap, optional sound and the narrow-window composition. Keep both views reachable from the same run during evaluation. Switching back to Overview must retain the selected row and any open output.

The proposal concerns the local desktop Game surface. The narrow-window case exercises its responsive layout. The existing four host checks are sufficient for the prototype. Extra declared gates depend on their own delivery work. R126’s later gate and results slices have separate acceptance. The current cuts can be evaluated on retained data. [Current board scope and pending work](<../Agentic OS Game and Cockpit Corrections.md#r126--mission-layout-follow-camera-zone-identity-failure-scene>)
