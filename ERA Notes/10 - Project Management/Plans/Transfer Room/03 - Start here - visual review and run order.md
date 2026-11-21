---
created: 2026-11-21
type: implementation-plan
status: proposed
scope: PM Command Center / Local Delivery / Game
---

# 03 · Start here — visual review and run order

**The shot to build around is one edit seen from the doorway.** During preparation, a pearl slowly brightens inside three fine circles. Most of the room is dark enough to see through them. An edit arrives. A highlight gathers on the rim facing Build, runs down the plinth, crosses the floor and catches the edge of a split tile. The flash dies. A steady reflection under the Build arch still tells you where to look. You can turn away, turn back and read the same fact. On the Board, ERA’s tool meets that same tile. The owner should recognize the action in either view with the caption covered.

## What the current Game actually looks like

This is the original design baseline. The current implementation and owner review are tracked in [R137](<../../../../docs/Delivery-UAT.md#board-robot-era-identity-and-walk--r137>).

Reviewed on **21 November 2026**, revision **`e2940ced`**. I opened a freshly built Local Game in Chrome with the repository’s disposable fixture, set the Hub & ERA topic, and selected **Edited part-2.ts**. I captured Board and Walk on that exact row, returned to Live, opened Map, strafed, and recentered at 390 px. The desktop PM server timed out during review. The comparison below travels with these briefs. The full-size captures and measurements linked in this section live in the original checkout’s `.pm` folder. [Browser observations](../../../../.pm/transfer-room-design-review-20261121/review.json) · [Source fixture](../../../../tests/pm-ui/fixtures/local-stage-board.mjs)

![Current Walk beside the product’s ERA circles, with detail views of the Board operator, Map and narrow Walk viewport.](<Game visual baseline.webp>)

| Current output | What to correct |
| --- | --- |
| **Board.** In the edit frame, the cyan head overlaps the Build press. The small floating hand stops beside the work surface. The caption does most of the work of showing an edit. | Give the worker an open silhouette around one pearl lens and an articulated tool with a visible point of contact. Reserve dark space around the tool and turn the lens toward its work. [Board at the edit](../../../../.pm/transfer-room-design-review-20261121/board-edit.png) |
| **Walk.** The broad ceiling hoop almost touches the top of the sphere. The little white hoops cross one another in the center. Setup, Build, Verify and Test have similarly lit openings, even with “Building” in the header. | Separate the three contours at the entrance, deepen the topic color around the pearl, and light a continuous path to one bay. Let the ceiling recede. [Walk at the same edit](../../../../.pm/transfer-room-design-review-20261121/walk-edit.png) |
| **Map.** The foreground is a large empty floor arc. Several small worktops on the far wall have similar silhouettes. Plan and Ship lose their surrounding walls in the cutaway. | Keep the clockwise route and its landmarks visible in the cutaway. Give the six openings distinct profiles and a direction of travel visible from spawn. [Map in Build](../../../../.pm/transfer-room-design-review-20261121/map.png) · [Current layout](../../../../scripts/pm/app/brain/layout.ts) |
| **Motion and sharpness.** With Walk stationary in Live Build, the probe counted zero WebGL indexed draws across 2.4 seconds. Keyboard strafe changed the camera pose. At 390 × 844 and device pixel ratio 1.25, the 390 × 597 CSS viewport got a 390 × 597 drawing buffer. | Wake the exterior during evidenced work. Measure movement separately, and compare a ring edge and sign at native resolution. This sample used SwiftShader. Hardware frame pacing and input latency still need a trace. [Narrow viewport](../../../../.pm/transfer-room-design-review-20261121/mobile.png) · [Render loop](../../../../scripts/pm/app/brain/world.ts) |

**The reference for ERA is already in the product.** The comparison uses the current Chat mark and product styles, a 52 px header instance, and the desktop hub’s ring dimensions. The space between the pearl and the outer circles is part of its identity. Keep it when the core becomes bright during Build. [Header component](../../../../src/components/shared/ERAMark.tsx) · [Hub composition](../../../../src/components/era/EraShell.tsx)

## Execute the three briefs

Run from the repository root in one coding session, or give each numbered brief to a successive session. The older plans 01 and 02 document the conversation and walkable room that shipped in R132. Start this pass with the existing Board and Explore 3D entry points.

> Read `ERA Notes/10 - Project Management/Plans/Transfer Room/03 - Start here - visual review and run order.md`. First record the untouched game’s movement route from brief 06. Then implement briefs 04, 05 and 06 in order. Use the same fixture, row and camera for before-and-after evidence. Return the comparison images, a motion clip from preparation through Build to Verify, and measured desktop and mobile results with the device and renderer identified. Record outstanding physical-device checks explicitly.

| Order | Deliverable | Ready to advance when |
| --- | --- | --- |
| 1 · [The board operator](<04 - The board operator.md>) | A clean operator and a readable work surface at Overview and Follow scale. | Paused Read, Edit and Wait poses are distinguishable on the actual board. During Edit the tool visibly meets the tile. |
| 2 · [ERA and the phase circuit](<05 - ERA and the phase circuit.md>) | A recognizable sphere, sustained phase motion and ordered, individually powered rooms. | With the camera untouched, preparation looks calmer than Build. A worker command powers Bench, a host check powers Verify, and unvisited Ship stays dim. Rewind across the result and its stamp disappears. |
| 3 · [Movement and frame pacing](<06 - Movement and frame pacing.md>) | Crisp edges, responsive walk/look and comparable hardware traces. | A walking turn keeps the active bay legible. Two thumbs can translate and turn together. The report gives frame-time percentiles and identifies any remaining hitches. |

## Reproduce the comparison

1. In one PowerShell terminal, run `node tests/pm-ui/fixtures/a5-browser.mjs` from the repository root. It serves the disposable PM fixture on port 4397. In a second terminal, use the same root, installed Chromium and Playwright. If Playwright is installed outside the repo, set `ERA_PLAYWRIGHT_MODULE` to the file URL of that installation’s `index.mjs`. The browser harnesses read it directly. [Fixture server](../../../../tests/pm-ui/fixtures/a5-browser.mjs) · [Room harness](../../../../tests/pm-ui/brain-room.browser.mjs)
2. Capture the before state in a fresh local evidence directory. For the reviewed frame, use `specimen()`, set the topic through campaign `Hub & ERA` and ID `HUB-118`, keep the first eight activity rows, set phase `building`, and clear checks, handover and head. Shift the fixture clock so the last edit is recent. Focus the Replay slider and press **End**. Save Board and Walk at that row. Return to Live for the stationary test. Use the full specimen for the later check and handoff. Keep the existing R132 captures as the reference set.
3. Run the full visual sequence in Blue and Pink, Realistic and Illustrated, then with Low motion. From another bay, identify where the action occurred, open the matching evidence and return to the same position. Try a recording that stops during Setup and one that ends in failure. A walk through an unvisited room must leave that history intact.
4. Compare the before and after at the owner’s usual Chrome size and on a physical phone where available. For the navigation pass, record the same short route with Chrome’s Performance panel and inspect the slowest frames. Save device, viewport, render scale and trace alongside the images. Stop the disposable fixture with Ctrl+C when finished. [Chrome Performance panel](https://developer.chrome.com/docs/devtools/performance/reference/)
