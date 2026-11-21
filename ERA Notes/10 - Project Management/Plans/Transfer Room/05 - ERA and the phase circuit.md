---
created: 2026-11-21
type: implementation-plan
status: proposed
scope: PM Command Center / Local Delivery / Explore 3D
---

# 05 · ERA and the phase circuit

At the entrance, ERA should look like the familiar header mark suspended inside the desktop hub’s three circles. In early preparation, you can watch the pearl breathe. During a recorded edit, the inner rim tightens, a filament crosses the floor, and the Build instrument catches it. After the flash, you can still tell where the work is. Begin after [the board operator](<04 - The board operator.md>).

## Give ERA the first sightline

Build a front reference from the actual components. The desktop hub’s three circles measure **500, 448 and 392 px** in diameter around a **240 px** mark. Within that mark, the fine ring spans 80% and the pearl 30%. The header uses the same mark at **52 px**. On mobile, the hub places a **160 px** mark inside a **208 px** ring. These are projected proportions. Match them from the entrance, then walk around the object to check its depth. [Desktop and mobile hub](../../../../src/components/era/EraShell.tsx) · [Header](../../../../src/components/layouts/ConditionalHeader.tsx) · [Mark layers and breathing](../../../../src/app/globals.css)

Rework `makeSphere` around a common center, shallow depth and clear space between the three rims. A near-white pearl recedes through topic color into a soft edge. Give each band a visible back. At a quarter turn the near band should pass across the far motif. From the opposite aisle the silhouette should still belong to ERA. Put the brightest room reflection beneath the pearl. Lower the luminance of distant ceiling ribs until they recede behind it. [Sphere, room and fixtures](../../../../scripts/pm/app/brain/art.ts)

Keep the existing topic resolver. Trips gets its compass needle, Budget its rising stroke with two endpoints, and PM Tooling its indexed wheel. Render General as bare rings and pearl. Realistic uses grazing light on ceramic and satin metal. Illustrated uses the same geometry with broader painted edges. Show both at 52 px and at walk scale with the effects muted before tuning motion. [Header motifs](../../../../src/components/shared/ERAMark.tsx) · [Topic resolver](../../../../scripts/pm/app/brain/topics.ts) · [Sphere atlas](<Delivery sphere atlas.md>)

## Make the perimeter readable from the entrance

The six bays already run clockwise. Preserve that geography. At the south entrance place an inlaid arrow turning left toward **Plan**, then continue **Setup → Build → Verify → Test → Ship**. Give each opening one legible inward-facing name and a distinct silhouette. Under the wide Build lintel, place Explore, Comms, Build, Bench and Seal in walking order. Give Handover a receiving dock on the approach to Test. Carry the same sequence through Map, direct travel, collision-safe arrivals and the keyboard-accessible station list. Build activities may revisit any workstation in recorded order. [Bay geometry](../../../../scripts/pm/app/brain/layout.ts) · [Reader groups](../../../../scripts/pm/app/transferRoomModel.ts)

Run a recessed conduit from the well to each bay arch, then branch to its actual instrument. One active branch illuminates the floor edge, the arch underside and a contact patch on the tool. Reached stations retain a small steady witness mark. An unreached station keeps only ambient light for navigation. A known skipped station gets an open notch. Keep the destination identifiable in grayscale and from across the room. On Map, retain the floor inlay and a low sill when the front wall cuts away. Keep Plan’s frozen brief in its authored order. Station names describe the delivery lifecycle. The recorded rows determine the order in which the light actually travels, including a return from Bench to Build.

## Score the light against the recording

Use the cursor-filtered scene, canonical zone evidence and liveness in a single projection for the room. Feed the stable state and any one-shot accent to the existing world instance. The current outer-room loop sleeps between inputs and short flights. The scheduler must also wake for visible steady work. Separate room illumination from the flight so its destination stays readable after contact. [Scene and cursor](../../../../scripts/pm/app/localRunScene.ts) · [Zone evidence](../../../../scripts/pm/app/stage/zoneModel.ts) · [Current stamps](../../../../scripts/pm/app/BrainRoom.tsx) · [Renderer](../../../../scripts/pm/app/brain/world.ts)

During an active Build, let a narrow highlight circulate on the inner rim about once every four seconds, with a softer counter-travelling highlight on the outer rim every seven. Accelerate smoothly from preparation’s single slow breath. Let only the bright segment facing the working instrument spill onto the conduit. Each real edit briefly pushes that segment outward and makes the bench catch its color. Keep the pearl bright and its colored shoulder visible throughout. Tune this standing motion on a ten-second shot with the mouse still. Rapid full-field changes obscure both the ring spacing and the destination.

| Recorded state | Core, connection and destination |
| --- | --- |
| Brief and preparation | On fresh entry, reveal the pearl over 800 ms. Use its 4.2 s breath. Give an available brief a steady mark. During preparation power Setup gently. “Scoping” describes this visual mood. The Local recorder calls its early phase `preparing`. |
| Building | Ease into greater rim intensity over 700 ms. A confirmed read draws inward from Explore. An edit gathers for 100 ms, throws up to two small branches outward over 220 ms, then seats the tool over 180 ms. Build stays brighter between nearby edits. Narration lights Comms. A worker command lights Bench. |
| Seal and Verify | The commit closes the Seal collar. A host check start moves the circuit to Verify. Show a separate shaped stamp for each returned pass, failure or inconclusive result. A worker’s `pnpm typecheck` command remains at Bench. |
| Owner turn | A recorded handoff travels through the Handover dock to the seat over 650 ms. An open question puts a steady thread at the seat. Owner Test completion follows the existing acceptance and required-review evidence. |
| Pending or terminal | Keep the Ship seam open for pending push, close it on recorded shipment, and reopen it on recorded revert. Failure leaves a broken contour at the evidenced station. Cancellation, silence or link loss lets the work light settle. Keep the last observed cue and its readable status. |

Use elapsed time for interpolation and stable row identity for each impulse. Coalesce burst effects while retaining every readable row. On seek, install the selected row’s settled pose immediately. Paused replay, an open reader, Low motion and system reduced motion keep static endpoints. Hidden views release their frame callbacks. Returning to a settled terminal run displays its final state on the first frame. [Signal mapping](../../../../scripts/pm/app/brain/questions.ts) · [Liveness](../../../../scripts/pm/app/localRunLiveness.ts)

## Execute and verify

> Implement `ERA Notes/10 - Project Management/Plans/Transfer Room/05 - ERA and the phase circuit.md` on the existing Explore 3D route. Deliver the reference-matched ERA, six legible phase bays and evidence-driven lighting in both finishes. Use the synthetic fixture. Return a header-to-room comparison, a fixed-camera preparation-to-Build clip and the checks below.

1. Capture entrance, quarter-turn, rear and Map views. In grayscale, find ERA, the active tool and the next bay. Repeat at 390 px. Compare the entrance crop with the real header at equal size.
2. At fixed camera, record two full preparation breaths, an edit, a worker command, a host check start, its result and a handoff. Seek backward across equal timestamps. Each destination and result must match the selected row. Compare paired frames for visible normal-motion change and a steady reduced-motion image.
3. Extend the existing room and zone tests with a truncated recording, open question, quiet Build and link loss. Run `pnpm exec vitest run tests/pm-ui/brain-room.test.ts tests/pm-ui/local-zone-model.test.ts tests/pm-ui/local-board-replay.test.ts`. Preserve zero command requests during exploration. Then continue to [movement and frame pacing](<06 - Movement and frame pacing.md>). [Browser fixture](../../../../tests/pm-ui/brain-room.browser.mjs)
