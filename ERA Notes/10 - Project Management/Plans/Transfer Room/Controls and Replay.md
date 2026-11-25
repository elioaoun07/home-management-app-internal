---
created: 2026-11-21
type: design-proposal
status: proposed
---

# Controls and Replay

From your seat, ERA works across the bench. The wheel is on your left, the cassette is on the centre track and the reader opens to your right. Touch **Build** on the desk edge to read an edit while ERA carries on across the glass. **Now** stays on the desk edge, visible with the reader open. [The Transfer Room](<The Transfer Room.md>) · [Build and Playtest](<Build and Playtest.md>)

## Find a step and read its output

In **Explore 3D**, a ring on the floor and a downward pointer mark the current workstation in both the AI room and the Owner room. They pulse during Live and playing Replay. **Low motion**, the system’s reduced-motion preference and a paused replay hold the markers still. Opening a different station keeps the markers on the workflow step.

ERA’s collector turns while you observe a healthy recording, including when the replay slider rests on one event. The activity and station power still follow that event. **Low motion** holds the collector still. At a failed frame the glass cracks and the mechanism powers down. When the run identifies the failed step, **Inspect break** takes you to its torn cable. Rewind before the failure to restore the clear globe and intact cable.

**Native detail** locks walking to the same resolution as the stationary view. Walk enables it by default with hardware graphics. On software graphics, turning it on also keeps identical edge smoothing through starts and stops. Larger windows take longer to draw at that setting. Walk remembers the choice on this browser.

In **Explore 3D → Walk**, click inside the room to capture the mouse. Use WASD to walk, hold **Shift** to sprint and press **Esc** to release. **E** interacts with the station in reach, and **Q** opens its questions. Drag and the arrow keys also turn the view. On touch, hold the left side to move and drag the right side to look. **Low motion** keeps the camera level. The existing Game **Sound** setting controls the deck footsteps and plasma hum.

Choose a phase on the bench edge, then a zone. The reader lists that zone’s actions in recorder order. Choose an action to open its **Output**, with the actor, time and recorded summary at the top. **Replay here** parks the wheel on that exact action. Back returns to the same row, scroll position and keyboard focus. A phase or zone with just one recorded output opens it directly. **Plan** is a direct shortcut to Brief, including during Plan & build. The six existing tools remain available, including Worktree and Host limits.

| Delivery phase | Zones on the bench | What opens |
| --- | --- | --- |
| Setup | Brief, Setup | The frozen work brief and recorded preparation milestones. The brief stays readable even when its creation time is unknown. |
| Plan & build | Explore, Think, Build, Bench, Seal | Read or search details, ERA’s recorded updates, edits, agent commands, then supervisor commit and hook records. Think presents the words ERA shared. The brief supplies the plan when Local ran planning and building in one session. |
| Verify | Verify | Supervisor check starts and results. A completed check opens its recorded stdout, stderr and error. An agent running a test at Bench stays a command there. |
| Test | Handover, Test | Handover evidence, the available owner scenarios, review and recorded acceptance. A freeze can appear at Handover while the supervisor phase still reads Verify. |
| Ship | Ship | Recorded merge, push-pending, ship or revert state and the available receipt. A pending push stays legible after the merge. |

**All actions** includes unclassified observations and every row still retained, including those beyond the current feed’s first 30. A tool request keeps its recorded verb. A missing path leaves the path field empty. If a command has only a summary, show that summary and *No output recorded*. An edit may name a file. The **Changes** tool can show a candidate patch when the existing projection exposes its head and the patch is available. The patch belongs to that candidate as a whole.

## Keep your place when the run moves

| What you are doing | What moves |
| --- | --- |
| Watching Live | Now updates on the next observed poll. A burst updates the facts immediately and can shorten ERA’s movement. |
| Inspecting an output | Now continues updating. The cassette, focus, text selection and scroll position stay put. Close the reader to follow ERA again. |
| Playing or jogging Replay | The room, selected row, check drawer and results all use the same recorded cursor. The separate Now display can signal a live owner request. **Live** returns in one action, including from a finished run. |

A live question lights the owner’s side of the desk. Opening it from Replay returns to Live and focuses the existing question card. A recommended choice may be selected already. Only an explicit submission answers. Review, Ship, Undo and Cancel keep their existing availability and handlers in Live. In Replay, a recorded answer can be read once its time is reached. Looking at an old review, answer or shipment only opens its evidence.

Where the run supports owner messages, keep its live composer within reach. A sent message stays **Queued** until the recorded delivery time. It can then read **Delivered**. A message or answer opens as read-only evidence in history. During a lost observation link, hold the last observed frame and show **Link down**. An interrupted run gets its own **Signal lost** state. Silence alone supplies neither verdict.

The jog wheel advances by recorder identity within the run. Reuse the existing timeline, exact-row cursor and scene projection for every view. Recap can compress a gap and label its elapsed time. Full retains each available action. On a known cut-off, label *Earlier activity unavailable*. At the 200-row limit with an unknown start, say *Retained activity* and show the earliest observed time. If a selected row ages out, identify the missing row and offer the earliest available action. For legacy rows with ambiguous identity after refresh, ask for a fresh selection.

## Compare two moments

Pause on an action and choose **Pin A**. Jog to another action in the same retained run and choose **Pin B**. Two narrow panes show the named actions, their outputs and the set of recorded checks at each cursor. On a small screen, switch between A and B. **Swap** exchanges the panes. Closing comparison restores the previous selection. Each pane reads its own historical projection. A missing pin stays unavailable, and moving a pin has no effect on delivery.

## Try the wheel on a tied timestamp

Use a synthetic trace. Job `demo` is building. A recorded candidate and a `test` check with stdout `12 passed` belong to the verification that follows. Give all three rows the same time, **10:15:02**.

| Row | Recorded summary | Expected Output at this detent |
| --- | --- | --- |
| `demo:41` · edit | `src/panel.ts` | Build shows the path. Candidate pending. Zero passed checks. |
| `demo:42` · supervisor | `Host checks started` | Verify opens. The candidate head is available. The test result and stdout are still unavailable. |
| `demo:43` · supervisor | `test: 0` | Verify shows one passed check. Opening **test** reveals exactly `12 passed`. |

Pin 41 and 43. A shows the edit and zero passed checks. B shows the result and one passed check. Step backward twice and the selected action is 41 again, even though the clock face never moved. Returning Live neither repeats the check nor changes its receipt.

## Operate it with the screen still

Tab reaches the steps, reader, wheel and Live button. Enter opens an output. On the focused recorder, ← and → step one row, Home and End reach the retained ends, Space toggles playback, and L returns Live. Escape closes the topmost comparison or reader and restores focus. Shortcuts yield to typing in the question card. Touch has labeled Previous and Next buttons alongside scrubbing. With reduced motion the cassette cuts to place and ERA’s status changes in text. Calm keeps the same factual outputs and eligible owner actions. A muted, stationary session must pass the same three-row exercise.

The existing sources for the interaction are the [zone configuration](<../../../../scripts/pm/app/stage/config.ts>), [shared scene projection](<../../../../scripts/pm/app/localRunScene.ts>), [flight recorder](<../../../../scripts/pm/app/FlightRecorder.tsx>) and [output reader](<../../../../scripts/pm/app/LocalRunConsole.tsx>).
