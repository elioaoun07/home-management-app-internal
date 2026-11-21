---
type: implementation-plan
status: proposed
scope: PM Command Center / Local Delivery / Take seat
---

# Plan 1 · A conversation with ERA

**Ask ERA** works anywhere inside the 3D level. Ask one question while standing next to an edit, or take a seat across from the sphere for a longer discussion. The same answer, evidence and selected moment follow you. On a run that ended unexpectedly, the first question might be *Where did it stop?* On a healthy build it might be *Did you finish the first part?* [Plan 2 · Walk inside ERA’s brain](<02 - Watching ERA work.md>) · [Topic sphere atlas](<Delivery sphere atlas.md>)

## Ask from the floor

Press **Q** or tap **Ask ERA**. Stop player movement, clear held keys and release mouse capture. Keep the frozen viewpoint in the background so the owner can still see what prompted their question. An opaque three-choice panel appears within reach. Number keys **1–3**, arrow keys and Enter, or a tap activate choices while the panel has focus. The panel opens on Q key-up so the opening press cannot also submit. **More questions** opens the full list. Escape or **Back to room** dismisses it. Restore the triggering control or viewport focus. Re-enter mouse capture only on a fresh user gesture.

| Where you ask | First suggestions | Evidence scope |
| --- | --- | --- |
| Looking at a specific edit | **What changed here? · Who did this? · Replay this action** | Resolve that exact retained row. An unknown actor reads “Actor not recorded.” Replay is a navigation control and pauses at the selected row. |
| Beside the Verify instrument | **Which checks ran? · What failed? · Open output** | Recorded host starts, returned results and stdout/stderr visible by the selected moment. Empty output states remain accessible. |
| At an empty phase chamber | **Did we reach this phase? · Where did it stop? · Open brief** | Explain the evidence for this named stage. Preserve “unconfirmed” for missing history. Being physically in Ship supplies no evidence of shipping. |
| In the aisle or at the seat | **What’s the status? · Where are we now? · What needs me?** | Use the selected run. On a cancelled run put **Where did it stop?** first. A replay answer names its historical moment. |

Choose the target in this order: explicitly inspected receipt, pointed-at interactable within reach, current chamber, whole run. Snapshot the target and replay mark **when the panel opens**. An incoming row can update Now but cannot change the question under the owner’s finger. Visually distinguish a question from a navigation command such as **Open output**. Each suggested question is also reachable from the ordinary focusable DOM controls.

**Example at the Build tile.** On HUB-118 a local answer can read *“An edit was recorded for `src/app/g/drinks-admin/page.tsx`.”* Under it, **Show action** opens the receipt. **Track in room** lights the path back to that tile. **Discuss at seat** carries the open exchange to the crescent facing ERA. The seated UI restores the question history and allows an optional custom SDK question. **Stand up** restores the previous standing position and facing direction. The HUD keeps the true live state visible while an answer concerns replay.

The delivery topic controls the sphere’s recognizable shape. A Trips compass needle can settle toward a receipt while the answer opens; Budget can align its two nodes. Use the same short response cue for a local lookup in both themes. Reserve waiting feedback for an actual outstanding SDK request. The sphere must never imply that reading a preset woke or resumed the delivery worker.

## Start with the delivery Elio opened

**TRIP-33 · Attach a saved document snapshot to a trip.** The retained local supervisor record contains a frozen brief and two activity rows on November 21. At 09:23:29 UTC it recorded dependency installation. At 09:24:15 UTC it recorded cancellation. There is no recorded cause, edit, host check, candidate or handoff. Today the seat’s cassette button falls back to Build on this run. That sends the owner to an empty reader at exactly the moment the product could explain what happened. The timings below describe recorded events, not an observed live playthrough. [Open TRIP-33](http://127.0.0.1:4317/#/delivery/run/local-c7059ebf-f657-470c-9f6c-bc80ae3672a9) · [Current seat and fallback](../../../../scripts/pm/app/TransferRoom.tsx)

**The first thirty seconds, as they should play**

1. Select **Take seat**. The ERA circles you were following stay in sight as the viewpoint settles. The run title and Live or Replay indicator stay put. On this closed run the seat offers **Where did it stop?** and **Open brief**.
2. Select the question. The answer is immediately readable. *“The run was cancelled during setup. The last recorded work was installing dependencies.”* Under it are two evidence links, **Installing dependencies** and **Cancelled**. Display times in the same convention as the recorder.
3. Select **Why was it cancelled?** The reply is *“The recording gives no reason for the cancellation.”* Select the installation receipt to inspect the earlier moment. The answer for that moment reads *“Installing dependencies. No later outcome is visible here.”*
4. Return to the conversation. The previous answer, scroll position and selected question are still there. Choose **Overview** to see the same moment at the same station. Choose **Live** to return to the latest state.

## What sits in front of you

Borrow the choreography of ERA’s top layer. Its mark stays mounted and rises to make room for a conversation. At the seat, the person looks toward that same presence across an open reading surface. The current answer occupies the best reading area. Two or three short questions sit within thumb reach. **More questions** reveals the full list. Use the existing PM type, theme and opaque surfaces. Keep code and check output selectable. A real handoff can bring the existing cassette or evidence object within reach. On TRIP-33 the surface holds the brief and the two receipts. [ERA shell](../../../../src/components/era/EraShell.tsx) · [Conversation layout](../../../../src/components/era/EraConversation.tsx) · [PM theme](../../../../scripts/pm/app/styles.css)

The phase strip stays available in Map, Walk and Seat. **Plan** opens the frozen brief directly. **Setup, Build, Verify, Test, Ship** open their zones, then actions and recorded outputs. **All actions** includes uncategorized rows. **Go to station** explicitly changes the player position; opening an output leaves the player in place. Keep the jog control, Full/Recap and A/B comparison within the existing replay drawer. Provide one visible playback control wherever those controls would otherwise repeat. On a narrow viewport prioritize the mark, latest status, answer and suggested questions. Evidence opens as an opaque sheet and returns focus to its source link.

## Questions the recording can answer

Implement these as local functions over an immutable selection. Choosing a suggestion requires no SDK, provider connection or network round trip once the recording is loaded. Suggested wording may vary by run state. Keep the question ID and evidence rule stable.

| Question | Rule for the answer | What the owner can inspect |
| --- | --- | --- |
| What is the status? | Give the supervisor phase/outcome, plus any recorded need for the owner. Keep connectivity and time since the last signal separate. A disconnected active run gets “Last seen building” and its observation time. | Phase receipt or last observed state |
| Where are we now? | Give the latest observed action, its station, and the actor and path only when known. In Replay, answer “At this moment…” using the selected row. A separate small **Now** stays live. | Exact recorded action |
| What went wrong? | Prefer the recorded failure detail or a failed/inconclusive host check. On cancellation, state the last known action and say whether a cause was recorded. When there is no recorded issue, say that. | Diagnostic excerpt, check output or terminal receipt |
| Did you finish phase 1? | If the frozen plan uniquely names a numbered milestone, quote its title and look for explicit completion evidence tied to it. If the question could mean a delivery stage or a step in the brief, offer those choices. If the plan has no numbered milestone, say so and offer the named stages. | Brief section and completion receipt, or the brief alone |
| What changed? | Count recorded edits in the available window. A named file can open its action. A frozen candidate can open its own patch. Preserve the distinction between an edit, a tool request and the final candidate diff. | File action or candidate in **Changes** |
| What needs me? | Surface the real open worker question, review request or owner test through the existing attention model. In Replay show the historical request and offer **Go live** for an outstanding action. | Original question, review or test steps |

Use **Finished**, **In progress**, **Skipped**, or **Completion unconfirmed** only when the corresponding evidence warrants it. A brief proves a brief exists. A command that invoked a test proves it was invoked. A passing host check proves the outcome of that check. A numbered station, an agent saying “implemented,” and the board’s count of completed *or skipped* zones cannot establish plan completion. For an incomplete recording use *“No edit in the retained recording.”* [Zone model](../../../../scripts/pm/app/stage/zoneModel.ts) · [Recorded failure](../../../../scripts/pm/app/localRunFailure.ts)

## Three exchanges with different effects

| Control | What happens | Availability |
| --- | --- | --- |
| **Ask about run** | Choose a preset. Show the answer immediately with its evidence and observation time. Keep the short question history local to this run and tab. | Live, Replay, terminal, or last loaded evidence while disconnected |
| **Ask agent** · optional later slice | Deliberately send a custom question to an SDK consultation with a bounded snapshot of this run. Mark the reply as an **Agent explanation**, keep its citations clickable, distinguish interpretation from recorded facts. | Only after the local consultation is configured and available. Replay uses the frozen selection. |
| **Reply to agent** / **Message agent** | Use the existing live worker controls. A reply can unblock execution. The existing message ledger shows queued/delivered status. | Exactly where the existing Local supervisor admits them. From Replay first return to Live. |

Keep a pending worker question apparent while the owner reads. Opening its card, asking a preset or selecting a cited row must never submit an answer. Free text sent to the existing worker can steer or resume the run, including a parked question. A dedicated consultation therefore needs its own request path. [Local chat UI](../../../../scripts/pm/app/LocalChat.tsx) · [Local command routes](../../../../scripts/delivery-v2/local-routes.mjs) · [Worker message and resume behavior](../../../../scripts/delivery-v2/local-lane.mjs)

## Build order and refactor

1. **Define one answer input.** At the existing game shell, derive a small read model from the run ID, exact selected mark, observed phase, retained rows, eligible check results, brief and attention as of that mark. Use `buildTimeline`, `sceneAt` and `resolveMark`. Whitelist fields explicitly. Some current-run fields survive the projection, and some ledger timestamps cannot order two records within one instant. Omit an ambiguous detail. Each result carries its question ID, answer text, evidence references and scope (live observation or replay row). Use a stable ID plus recorded time/summary to detect an expired selection. [Shell](../../../../scripts/pm/app/LocalRunGame.tsx) · [Timeline](../../../../scripts/pm/app/localRunScene.ts) · [Mark resolution](../../../../scripts/pm/app/transferRoomModel.ts)
2. **Ship the smallest useful conversation.** Start with TRIP-33, one prompt, two receipts and a return to the exact row. Add the other prompts as pure selectors alongside the room model. Keep new polls from rewriting an answer being read. Offer **Refresh answer** when newer evidence arrives. A missing or expired receipt says *“This action is no longer retained.”* Opening a receipt pauses replay at its exact row. Closing it restores the conversation and focus.
3. **Compose the seat.** Extract the existing reader and transport only where shared. Keep one owner of replay state, pins, selected zone, scroll position and attention. Preserve per-run isolation on route changes and the existing view preference across visits. Connect the ordinary live question rail and the UAT tool. Check keyboard, touch, reduced motion, muted audio and a growing conversation at 390 px.
4. **Add freeform consultation independently.** Proposed local browser-authenticated, loopback-only handler, explicit Send, CSRF protection, single in-flight question, request ID for deduplication, bounded time/tokens and usage receipt. The server reconstructs the selected projection and sends only permitted redacted excerpts. Treat logs as quoted data. Give the SDK no worker session, resume handle, shell, file or delivery command tools. Validate cited receipt IDs against the supplied set. Hold an unsupported factual reply back and offer its source list instead. Show queued, reply, cancel, unavailable and timeout states. Opening the seat, replaying, reconnecting and retrying a read never authorize model usage. Verify with a recorded or mock adapter; any paid pass follows the owner's existing procedure. [Support usage ledger](../../../../scripts/delivery-v2/support-ledger.mjs)

## Owner playtest

| Try this | Accept when |
| --- | --- |
| Hold W while approaching a Build tile, open Q, read the cited row, then move the same exchange to the seat. Repeat with touch and keyboard-only navigation. | The player stops on Q, remains in place while reading, and sees the same exchange at the seat. Stand up restores position and yaw. Typing and dismissal trigger neither walking nor a worker message. |
| Ask the first three questions on TRIP-33, then jog back one row. | The latest answer distinguishes setup, cancellation and unknown cause. The earlier answer cannot reveal the later cancellation. Zero delivery commands and zero provider requests for presets. |
| Ask about failure on HUB-118. | Six recorded edits and the agent’s “Implemented HUB-118” message can be examined. The terminal failure remains visible. A typecheck invocation cannot become a verified pass. [Open HUB-118](http://127.0.0.1:4317/#/delivery/run/local-cac958d7-1f8e-4e65-9cb8-1471c839f796) |
| On the handoff fixture, pin an edit and a later check with the same timestamp. Enter the seat, ask about checks, open a receipt, return to Overview. | Each answer and pin reflects its own row. The owner can still reach test steps and the live question separately. Nothing submits while inspecting. [Existing fixture](../../../../tests/pm-ui/transfer-room.browser.mjs) |
| Read an earlier answer as a new live question arrives. Repeat with the keyboard and reduced motion. | Reading position, focus and selection hold. **Now** announces the live need once. The owner can tell which button reads and which replies before selecting either. |

Finish the first slice when the owner can describe why TRIP-33 stopped as far as the record allows, point to the source, and return to the work unaided. The seat is already useful at that point, even if the optional SDK is never installed.
