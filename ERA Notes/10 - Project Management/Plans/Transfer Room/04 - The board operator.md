---
created: 2026-11-21
type: implementation-plan
status: proposed
scope: PM Command Center / Local Delivery / Game Board
---

# 04 · The board operator

R137 supersedes the silhouette proposal below. Preserve the compact visor robot, board materials, planted feet, service crossings and foreground occlusion in subsequent passes. Compare the actual Board and Follow views before changing its proportions. [Current review](<../../../../docs/Delivery-UAT.md#board-robot-era-identity-and-walk--r137>) · [Walking route](../../../../scripts/pm/app/stage/serviceWalk.ts)

> Implement `ERA Notes/10 - Project Management/Plans/Transfer Room/04 - The board operator.md` on the Local Delivery Game Board. Use recorded fixtures to show the same moment before and after. Deliver full-size captures, a short motion sequence, and the results of the checks below.

## Make the work legible

At a glance the owner should be able to point to ERA, identify its station, and tell whether it is reading, working, or waiting. The current sprite has a hexagonal head and torso, a rectangular visor, detached hands and two rectangular eyes. Travel selects a right lean in either direction. Read and Edit share the upright pose. The director already supplies anticipation, travel, contact and release timing. [Actor drawing](../../../../scripts/pm/app/stage/actors/era.ts) · [Pose selection](../../../../scripts/pm/app/stage/renderMotion.ts) · [Director](../../../../scripts/pm/app/stage/director.ts)

1. **Draw the silhouette first.** Give ERA a compact, asymmetrical enamel shell cradling a luminous pearl lens. Cut a crescent opening into the front, hinge one tapered tool underneath, and leave a clear gap between tool and body when extended. Aim the lens from within its socket. Use the board’s top-left key light, a broad shadow plane, and one thin rim where the tool crosses the body. Start inside the existing 110 × 120 logical sprite envelope. Compare a solid silhouette at the actual Overview size before adding highlights. Use the header mark as the lens reference. [Palette](../../../../scripts/pm/app/stage/palette.ts) · [Mark](../../../../src/components/shared/ERAMark.tsx)
2. **Put the tool on the work surface.** During a retained read, incline the lens toward the file and unfold the tool into a scanning pose. For an edit, brace the shell, plant the tip at the tile during Work, then retract it as the existing capsule carries the change. Mirror the body toward its travel destination and settle on arrival. A waiting owner action turns the lens toward its station. Stale folds the tool, cancellation parks it, and signal loss holds the existing ghost treatment. Use already-recorded actions and the existing destination priority. Replay scrubbing resolves the pose immediately. [Movement and destinations](../../../../scripts/pm/app/stage/motion.ts)
3. **Give the operator room.** In Overview, reserve a clear band along the walkway. Separate the operator, the moving capsule and the machine contact point in projection. Put the strongest local contrast on the working surface. Give reached stations a steady engraved edge and keep future stations recognizable in silhouette. Simplify trim, stripes and dust wherever they compete with the operator. Keep the eleven station names, the screen-space facts shelf, owner rail and Overview / Follow / Inspect controls readable in both themes. [Board composition](../../../../scripts/pm/app/stage/board.ts) · [Screen-space facts](../../../../scripts/pm/app/stage/StageReadouts.tsx)
4. **Keep drawing inexpensive.** Bake the body and hinged parts once per palette. Drive their transforms from the board clock on its motion canvas. Preserve static and state layer invalidation, offscreen suspension and the reduced-motion path. Reduced motion shows the resting pose for each recorded action with a readable tool direction.

## Prove it in the running board

- Capture identical read, edit and waiting moments before and after in Blue and Pink. Show full Overview at 1440 × 900 and 390 × 844, plus Follow and Inspect at the edit. Include a greyscale edit frame. At normal zoom the lens, tool tip and contact tile should each be identifiable. The active machine, shelf and open rail must remain readable together.
- Record one retained edit through approach, contact and departure. Scrub backward across it, resume, then enable reduced motion. The capsule, selected row, worker destination and owner action must agree at every stop. Check a terminal run stays at rest. [Recorded fixtures](../../../../tests/pm-ui/local-board-fixtures.ts) · [Readability checks](../../../../tests/pm-ui/r129-readability.browser.mjs)
- Run the commands below in PowerShell. Use the browser harness’s existing Playwright configuration. Compare frame timings with brief 03 under the same viewport, DPR and camera. Continue to **05 · ERA and the phase circuit** with those captures.

```powershell
pnpm exec vitest run tests/pm-ui/stage-board-motion.test.ts tests/pm-ui/r126-lighting.test.ts tests/pm-ui/local-board-render-boundaries.test.ts
$env:ERA_STAGE_ART_EVIDENCE = ".pm/board-operator-evidence"
$env:ERA_STAGE_PHASE = "scenes"
node tests/pm-ui/local-stage-art.browser.mjs
```
