---
created: 2026-11-21
type: implementation-plan
status: proposed
scope: PM Command Center / Local Delivery / Explore 3D
---

# 06 · Movement and frame pacing

The executable wide-screen comparison is `tests/pm-ui/brain-room-performance.browser.mjs` with `ERA_ROOM_BENCH_PROFILE=wide-trips`. It captures the same Trips camera on both builds and records the drawing buffer during each walking segment and after stopping. `ERA_ROOM_BENCH_SOFTWARE=1` selects SwiftShader. The following brief describes the original control and performance targets. [Current Walk verification](<../../../../docs/Delivery-UAT.md#trips-walk-at-full-window-size--r138>)

Run this after [05 · ERA and the phase circuit](<05 - ERA and the phase circuit.md>). The finished room should hold a fine ring in focus while you strafe, turn immediately under the mouse, and let two thumbs walk and look together.

**Paste into a coding session opened at the repository root**

> Execute `ERA Notes/10 - Project Management/Plans/Transfer Room/06 - Movement and frame pacing.md`. Profile the same route before and after each tuning pass. Implement the controls and rendering changes supported by those traces. Return the comparison, a pair of native-size crops and the verification results. Identify the device used for each result and any hardware check still open.

## Establish a comparable baseline

Use the local synthetic recording in the [browser fixture](../../../../tests/pm-ui/brain-room.browser.mjs). For the hardware pass, launch headed Chrome with its normal GPU configuration and keep the fixture’s intercepted data routes. A physical phone can use a locally served copy of the same fixture. Capture the current candidate before tuning. Keep an earlier pre-redesign trace as a third reference if available. Record revision, browser, GPU or software renderer, refresh rate, OS scaling, viewport, CSS and drawing-buffer dimensions, finish and motion setting. Use the same settings and exact event IDs on both passes.

1. Time cold entry from **Explore 3D** to the first rendered, interactive frame with a fresh browser profile. Repeat three times. Warm shaders before timing movement.
2. At 1280 × 720, hold at spawn for 10 seconds. Then record a 30-second movement route. Strafe past the seat, approach Build, reverse the camera through 180°, and cross a recorded edit and host check. Replay the identical inputs and durations three times. Repeat at 390 × 844 on touch hardware. Include the owner's usual desktop size if available.
3. Timestamp frame entry and both sides of each real render call. Collect rendered-frame interval p50/p95/p99, frames over 50 ms, CPU update/submission time, draw calls and triangles. Record GPU elapsed time separately when asynchronous timer queries are supported and valid. Keep timings per segment. An independent animation callback can tick while the scene is frozen. Save the worst frame's trace and the same cropped sphere rim and station sign at native pixels.

## Make the camera respond to the hand

Today's renderer accepts one pointer for either movement or look. It applies movement at 2.4 m/s, truncates elapsed time at 50 ms and writes a formatted pose string to the DOM every painted frame. A station jump sets the arrival pose immediately. Inspect these paths and their collision boundary first. [World and input](../../../../scripts/pm/app/brain/world.ts) · [Walkable floor](../../../../scripts/pm/app/brain/layout.ts)

Track one touch ID per side. Releasing either thumb must leave the other active. Accumulate mouse deltas and apply them on the next camera frame. Ease walking velocity briefly on start and release, normalize diagonals, and integrate foreground movement in small collision-tested steps. Reset elapsed time on refocus. Keep the direct station shortcut, with a brief fade for long jumps and an immediate cut in low motion. A receipt never turns the observer's head.

Use change-only or fixture-only pose sampling. Test wall sliding, wheel-free keyboard travel, pointer cancellation, loss of lock with W held, focus restoration, and seat/stand return. A two-second straight run on clear floor at simulated 30/60/120 Hz should finish within 0.1 m across profiles. Test a brief foreground hitch and a ten-second background interval separately.

## Spend pixels where the player looks

The current pixel-ratio cap is 1 below 670 CSS pixels and 1.5 above it. Signs are perspective-mapped textures. Start from the measured render scale. Batch fixed geometry by material, pool the electrical traces and reduce translucent overlap before lowering resolution. Keep the core rim and station name clear at walking distance. Retain the accessible DOM name. Compare identical 100% crops on the same device. If adaptive scale is needed, use sustained timing windows and separate down/up thresholds to prevent oscillation. [Renderer](../../../../scripts/pm/app/brain/world.ts) · [Materials and signs](../../../../scripts/pm/app/brain/art.ts)

## Accept the pass

On a hardware-accelerated 60 Hz desktop, aim for 60 fps during travel with p95 frame interval ≤20 ms. On the low mobile profile aim for 30 fps and p95 ≤36 ms. Target ≤1 frame over 50 ms per warmed 30-second route. Record misses and the responsible segment. Compare script p95 against the existing 3 ms guideline. Confirm hidden/offscreen rendering sleeps, a settled reduced-motion view redraws on change, and three view switches retain a single canvas. [Stage budgets](../../../../scripts/pm/app/stage/config.ts)

Run `pnpm exec vitest run tests/pm-ui/brain-room.test.ts`. The existing room browser script writes into the original R132 image directory. During implementation, give it an evidence-directory override with that directory as its default. With the disposable fixture started as described in brief 03, run the following in PowerShell. Retain software Chromium coverage for controls, replay, context loss and zero writes. Report physical frame pacing from the hardware pass. [Fixture setup](../../../../tests/pm-ui/fixtures/local-stage-board.mjs)

```powershell
$env:ERA_BRAIN_EVIDENCE = ".pm/phase-room-navigation-candidate"
node tests/pm-ui/brain-room.browser.mjs
```
