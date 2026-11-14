# Owner test steps — current Agentic OS and retained delivery items

Authored 2026-11-14 from the linked item criteria and current source. **All owner results are Pending.** Opening these steps records no result. Start test binds the current source; confirm the actual tested build before sign-off. A missing prerequisite means **Blocked**, not Pass. Desktop viewport checks do not establish a physical-phone or deployed-build pass.

These instructions supersede navigation names in older handovers: **Plan** opens Sprints, **Work** remains in Search work / More, and **Sessions** contains session and owner-test queues. Read-only cases need no new provider run. Mutation, native-run, schema and shipping cases require the owner-controlled environment named in their Setup; the assistant does not execute them.

## R116 — Local sign-in with app API configuration

**Acceptance:** R116
**Environment:** local
**Setup:** Existing Claude/Codex subscription login; PM host may load app API/speech variables. Owner restarts the current bridge with `pnpm pm --bridge --no-open` to activate the helper. Agent does not restart the publishing bridge (Hard Rule 26).
**Source:** `scripts/delivery-v2/local-guardrails.mjs#localWorkerSubscription`, `local-lane.mjs`. Screenshot origin: HUB-118 Local Start, 2026-11-14.

1. Keep the application's `.env` unchanged. Run the offline credential check or inspect Local readiness after the updated server loads. Expect the existing subscription login to pass even with app API/Azure speech configuration present; no provider request is needed.
2. Use the isolated replay credential fixture with only an API key instead of a subscription token. Expect Sign-in to remain blocked; an app key must never replace subscription login.
3. If the owner intends to run HUB-118, open its Local Deliver screen and select Start after activating the fix. Expect the false sign-in blocker to disappear. Other current source/dependency/settings gates may still refuse. This step can launch a real session and is owner-run; it was not executed by the agent.

**Actual:** Pending owner restart/session acceptance. Offline metadata check passes with the existing Claude Pro login and no network call. **Reset:** No real credentials or environment values were changed. **Limits:** Offline shape validation does not establish token freshness/provider entitlement or prove native execution.

## R115 — Markdown defaults and AI markers

**Acceptance:** R115
**Environment:** local
**Setup:** Updated UI and loaded Setup snapshot containing Model Registry tiers. Example BUD-89 declares CLAUDE_MID, effort high. Model Registry resolves its concrete selector. Use the isolated browser fixture for Start payload checks.
**Source:** `launchRecommendationModel.ts`, `LaunchRecommendation.tsx`, `LocalDelivery.tsx`, `DeliveryV2.tsx`.

1. Open `#/deliver/Budget/BUD-89?from=%2Fbridge`. Expect the declared executor/model/high effort to be selected once the registry and catalogue load, and a sparkle-marked recommendation naming the model and effort.
2. Choose a different model or executor. Expect your override to remain selected, with the recommendation still visible. Open the relevant selectors. Expect a sparkle beside the recommended entries; effort is marked for its recommended model.
3. Select **Use Markdown recommendation** (the sparkle recommendation button). Expect all three settings restored. Revisit in Game Mode and at 390 px in Blue/Pink; expect the same behavior without overflow.
4. Open Confined. Expect the same declared recommendation selected if its model/effort are supported. Policy restrictions are still enforced on Start; a recommendation does not grant permission.
5. Use a fixture with no Tier, a missing alias or a disabled/unsupported model. Expect no invented recommendation for absent Tier; unavailable declarations retain their marker and an unavailable label, without an enabled restore action or substituted model. An omitted effort uses the registry default only when one exists.

**Actual:** Pending owner acceptance. **Reset:** Restore preferred theme/Game setting. **Limits:** Registry/catalogue declarations do not establish entitlement; no real inference, deployment or native launch is performed. Existing setup snapshot supplies aliases without a new backend route.

## R114 — Local Model and Effort

**Acceptance:** R114
**Environment:** local
**Setup:** Updated UI; owner restarts the existing bridge with `pnpm pm --bridge --no-open` to load Local catalogue validation. Use the credential-free fixture for launch verification; a ready real Start can launch a provider session.
**Source:** `scripts/pm/app/LocalDelivery.tsx`, `scripts/delivery-v2/local-lane.mjs`.

1. Open `#/deliver/Budget/BUD-89?from=%2Fbridge`. Expect Executor, Model and Effort before Start in both calm and Game Mode.
2. Choose a listed model and effort. Expect disabled models unavailable and effort choices limited to that model/provider's declared support. Default remains available.
3. Change Model. Expect Effort to return to Default. Change Executor. Expect both Model and Effort to return to Default with the new provider's options.
4. In the isolated fixture choose its model and medium effort, then Start. Expect exactly those values in the request. Replay tests also capture those values in the native request and retained run, while unknown/disabled models and unsupported efforts are refused before a session launches.
5. Repeat at 390 px in Blue/Pink. Expect reachable fields and Start without horizontal overflow.

**Actual:** Pending owner acceptance. **Reset:** Restore preferred selections/theme. **Limits:** No real provider inference or phone deployment; catalogue declarations do not prove provider entitlement. Backend changes require owner restart under Hard Rule 26.

## R113 — Deliver launch and Game Mode

**Acceptance:** R113
**Environment:** local
**Setup:** Updated Command Center at `http://127.0.0.1:4317/`. The UI rebuilds automatically. Stop the existing PM terminal and run `pnpm pm --bridge --no-open` to load the backend change. This restart is owner-run because bridge startup writes to Supabase (Hard Rule 26). Use the credential-free browser fixture for Start/refusal/retry checks; clicking Start on a ready real item can begin a real session.
**Source:** `scripts/pm/app/DeliveryMission.tsx`, `LocalDelivery.tsx`, `DeliveryV2.tsx`, `scripts/delivery-v2/entry.mjs`. Candidate hashes and screenshots: `.pm/delivery-launch-evidence/`.

1. Open `#/deliver/Budget/BUD-89?from=%2Fbridge`. Expect the selected item, Executor and Start, without initial readiness errors or a Check readiness button. Local Start becomes available after pairing/connectivity resolve.
2. Return to Bridge and toggle the orbital **Game layer** switch on; reopen the same Deliver link. Expect an animated orbital launch bay, separate controls deck and uncompleted Setup / Build / Review / Ship path. Toggle off and return. Expect the compact form with the same work and launch actions.
3. In the isolated Local refusal fixture, select Start twice quickly. Expect one request, Checking… while pending, then Start blocked with Commit or stash pending changes. Open Check details to inspect retained facts. Change Executor. Expect the unrelated failure to clear.
4. Select Confined in the isolated fixture. Expect compact settings and Start. Open Settings and choose Claude, then Start. Expect the actual policy refusal and Use Local; an installed SDK never implies permission. Choose Codex and Start. Expect one server command with automatic readiness and authorization renewal; no separate check request.
5. In a frozen refused/unknown request fixture, reload the page. Expect a retained refusal or Check status for the original request; an unresolved request must never become a second launch. A blocked attempt may be retried after fixing its cause.
6. Repeat the visual checks at 390 px in Blue/Pink, then enable system reduced motion. Expect readable controls, no horizontal overflow, reachable Start and still artwork. Scroll the scene fully offscreen or hide the tab. Expect motion to pause.

**Automated verification (2026-11-14):** 197 replay tests pass (139 backend, 58 frontend), plus typecheck, PM build, changed-file ESLint, Feature Map/PM checks and both browser suites. Exact live JS/CSS match the rebuilt candidate. `candidate.json` binds 15 source/test hashes; `result.json` records synthetic command and motion evidence. Full `pnpm lint` reports the existing 9,285 errors and 51,984 warnings across the repository; changed-file lint is clean. Full output is retained in `.pm/delivery-launch-evidence/full-lint.txt`.

**Actual:** Pending owner appearance/device acceptance. Automated browser cases use synthetic responses; no real native session was launched.
**Reset:** Restore preferred theme and Game layer setting. Fixture data is disposable; do not discard or stash real work merely to test Start.
**Limits:** The live workspace currently has uncommitted edits, which correctly block Local admission. Installed Confined policy revision 13 permits Codex only; Claude sign-in and SDK installation are present, but policy/qualification were not changed. A live successful session and phone deployment remain untested.

## R112 — Setup and rule coverage

**Acceptance:** R112
**Environment:** local
**Setup:** Current local Command Center and refreshed setup snapshot.
**Source:** `scripts/pm/app/Setup.tsx`, `setupModel.ts`, `scripts/os/check.mjs`.

1. Open **Setup**. Expect scan health, the hard-rule coverage counts and agent configuration links.
2. Open **Rule coverage**, select **Human review** and open HR-4's **Checks & evidence**. Expect the rule text, specific review steps and its source.
3. Select **Automated checks** and search for HR-22. Expect the actual guard source, fixture count and recorded evidence under its disclosure.
4. Open **Configuration**, search for start-task, then select the entry. Expect the matching list to remain available. Change category and agent filters. Expect each filter to act independently of the selected detail.
5. Open **Conflicts**. Expect error and warning totals separately, with informational findings under **Setup notes**. Expand a note to see its source and explanation.
6. Repeat at phone width in Blue and Pink. Expect readable labels, reachable controls and a page that fits the viewport.

**Reset:** Restore the preferred theme. **Limits:** Hook runtime loading and physical-device acceptance need separate observations.

## R111 — Sessions and per-item tests

**Acceptance:** R111
**Environment:** local
**Setup:** Updated local PM server, paired owner browser, retained pending items. Use a prepared isolated fixture for missing-state or command-retry cases. Physical-phone results are separate.
**Source:** `scripts/pm/app/Sessions.tsx`, `sessionBoardModel.ts`, `ItemUatWizard.tsx`, `UatWizard.tsx`.

1. Open the existing Command Center bookmark and select **Sessions**. Expect one workspace with state counts and session cards, without a separate Recorded tab or nested delivery backlog.
2. Select **To test** and choose a campaign with more than twelve pending items. Expect no more than six item cards on the page, a visible total and pagination that reaches the third page.
3. Open the third page, then search for an item ID from that page. Expect only matching items and a valid first page; clearing the search restores access to the remaining campaign items.
4. Open a pending item with test instructions. Expect Step 1 with one action, its expected result and Next/Previous controls; a full Markdown reader does not replace the wizard.
5. Select **Next**, then **Previous**, then the page's **Back** link. Expect the step text to change and return correctly, followed by the same Sessions filter/search context.
6. In an isolated ready test handover, choose **Fail**, enter a short observation, and record it; reload the same handover. Expect the recorded failure and note, no sign-off eligibility, and no new provider run.
7. Inspect the isolated missing/stale/offline evidence cases at desktop and 390 px in Blue/Pink. Expect unknown evidence to stay unknown, readable six-card pages and no horizontal page overflow; missing observations never become a green success.

**Reset:** Restore the preferred theme and clear fixture-only observations through the fixture's reset process. **Limits:** Steps 6–7 are Blocked without the isolated fixture; do not substitute live state changes just to manufacture them.

## R109 — Realign the planned dates

**Acceptance:** R109
**Environment:** local
**Setup:** Updated local PM server. Use an isolated copy of the planning file for Apply/Undo unless the owner intends to move the real plan.
**Source:** `scripts/pm/app/Sprints.tsx`, `scripts/pm/shared/sprint-realignment.mjs`.

1. Select **Plan** in the main navigation. Expect the weekly Sprints view; Search work or More → Work still opens the backlog.
2. Select **Realign**, set the target start, and inspect the preview. Expect one calendar-day offset applied to every active/draft range, with closed sprints unchanged.
3. In the isolated plan, select **Apply** once. Expect all shown ranges to move by that offset while members, order, duration and spacing stay unchanged.
4. Select **Undo** before making another plan change. Expect the original dates to return; a later changed revision must refuse a stale Undo instead of overwriting it.
5. Close the editor and reopen it at a phone width. Expect readable dates and reachable Apply/Cancel controls without a horizontal page scroll.

**Reset:** Undo the isolated realignment. **Limits:** An old server that replies Invalid planning command must be restarted by the owner before retry; starting the bridge can have other configured side effects.

## R108 — Work remains directly reachable

**Acceptance:** R108
**Environment:** local
**Setup:** Current navigation includes R109's Plan refinement; the older primary Work label is superseded.
**Source:** `PrimaryNavigation.tsx`, `Explore.tsx`, `Work.tsx`, `LocalDelivery.tsx`, `Setup.tsx` under `scripts/pm/app/`.

1. Use desktop **Search work**, or on a phone open **More navigation** then **Work**. Expect the existing searchable backlog with item IDs and filters.
2. Search for a known open item and open its card. Expect the item's acceptance, Deliver and Open in CLI without first selecting a skill.
3. Select **Deliver** and read Local readiness without pressing Start. Expect Source, Sign-in and Dependencies values to wrap clearly beside their labels, with the selected item retained.
4. Use Back to return to the item and backlog. Expect the original item and search/filter context.
5. Open **Setup → Prompt tools**. Expect the optional composer to remain available without taking a primary-navigation slot.

**Reset:** Close readiness without Start. **Limits:** This verifies navigation, not successful provider execution or productivity gains.

## R106 — ERA identity and softer motion

**Acceptance:** R106
**Environment:** local
**Source:** `EraCore.tsx`, `core-motion.css`, `coreParticles.ts` under `scripts/pm/app/`; R106 candidate manifest and screenshots in `.pm/r106-evidence/`.

1. Open **Bridge** and enable the header **Game layer** switch. Expect the ERA mark surrounded by light open orbital arcs, without the former tire spokes or tread.
2. Click the ERA core once and wait for it to settle. Expect a short acceleration followed by gradual cooling, with lighter sparks/smoke and local vibration rather than movement of the entire page.
3. Repeat at laptop and phone widths in Blue and Pink. Expect the mark, state label and Open sessions link to remain readable throughout the effect.
4. Enable the system's reduced-motion preference and reload. Expect readable state colors with no rotation, particles or vibration.

**Reset:** Restore preferred Game, theme and motion settings. **Limits:** Aesthetic approval and real-device comfort belong to the owner; fixture screenshots are comparison evidence only.

## R105 — Throttle and gradual cooldown

**Acceptance:** R105
**Environment:** local
**Setup:** Bridge with Game layer enabled. R106's orbital shape and softer effects supersede the old wheel appearance; R105 timing remains.
**Source:** `useCoreMotion.ts`, `coreDynamics.ts`, `coreParticles.ts`; the R105 owner scenarios in the PM Tooling Master Book.

1. Focus the ERA core and activate it with Enter or Space. Expect visible acceleration and red/orange heat while its actual session caption remains unchanged.
2. Stop activating it and watch after the short burst. Expect speed, heat and particles to fade gradually rather than snap off.
3. Activate the core again during cooldown. Expect acceleration from the current rotation without a jump to a starting angle or accumulating effects.
4. Open **Open sessions**, return to Bridge, then hide and restore the browser tab. Expect normal navigation and resumed motion without a backlog burst.
5. Inspect the supplied running and failed-state fixture evidence when those states are absent from current sessions. Expect sustained running motion, and a failed grey broken core that never turns into a successful green result merely because it was clicked.

**Reset:** Restore preferred Game setting. **Limits:** Fixture review does not establish a real native-running witness; do not launch a provider solely to populate a state.

## R104 — Session state on the ERA core

**Acceptance:** R104
**Environment:** local
**Setup:** Existing session evidence or the isolated state fixtures in `.pm/r104-evidence/`; no new live run is required.
**Source:** `coreState.ts`, `EraCore.tsx`, `BridgeVisuals.tsx`.

1. Open Bridge with Game layer on and compare its caption with the underlying session in **Open sessions**. Expect both to describe the same observed state.
2. Inspect running, waiting, successful and failed fixtures. Expect red/orange running, gentle yellow owner action, green explicit success and a grey broken failed core respectively.
3. Inspect unknown, stale, cancelled and partial fixtures. Expect none to be represented as successful completion; standing backlog decisions must not conceal a running session.
4. Turn Game layer off, then enable reduced motion and turn it on again. Expect calm queues without the animated core when off, and still readable state without rotation/particles under reduced motion.

**Reset:** Restore settings. **Limits:** Missing state fixtures make those subcases Blocked; screenshots and current real sessions are different evidence.

## R103 — Game switch appearance and persistence

**Acceptance:** R103
**Environment:** local
**Source:** `scripts/pm/app/GameLayer.tsx`, `game.css`; the owner's 90-degree refinement in R103.

1. On Bridge, turn **Game layer** off and compare the Orbit icon with neighboring header icons. Expect the original Orbit shape and matching theme ink.
2. Turn it on and watch the transition. Expect a visible 90-degree clockwise rotation ending in a bright blue gradient/glow.
3. Refresh, then use Tab and Space to switch it off. Expect persisted On after refresh and keyboard-operated Off returning to the resting angle.
4. Repeat in Blue/Pink at phone width with reduced motion enabled. Expect usable controls and state styling while rotation is skipped.

**Reset:** Restore preferred theme/Game/motion settings.

## R102 — Bridge queues, charts and SDK evidence

**Acceptance:** R102
**Environment:** local
**Source:** `Bridge.tsx`, `BridgeVisuals.tsx`, `ProviderStatus.tsx`; R102 owner scenarios in the PM Tooling Master Book.

1. Open Bridge with Game layer off. Expect Needs you, Running and Next up plus the current Plan action and Claude/Codex SDK status.
2. Turn Game layer on. Expect the same action queues plus the ERA core, weekly outcome bars and session-quality chart after one transition.
3. Select an available weekly bar or quality category, then its evidence link. Expect recorded work/session evidence, not invented numbers; empty history remains empty.
4. Refresh while Game layer is on, then toggle it off/on quickly. Expect the saved mode without replay on reload, responsive controls and no stranded overlay.
5. Read the SDK footer, open Setup, then Score. Expect SDK installed to mean package presence only, actionable setup evidence in Setup, and clean-session evidence in Score; unavailable/stale observations stay labelled.

**Reset:** Restore preferred Game/theme settings. **Limits:** Local package presence does not establish authentication, provider availability or a physical-phone deployment.

## R101 — Searchable setup and readable evidence

**Acceptance:** R101
**Environment:** local
**Setup:** R108/R109 replace the former primary Launch destination; Prompt tools is now in Setup.
**Source:** `Setup.tsx`, `Sessions.tsx`, `CockpitUI.tsx`, `Score.tsx`, `Launchpad.tsx` under `scripts/pm/app/`.

1. Open **Setup**, use **Search setup** for `start-task`, and open the matching entry. Expect one inspectable skill entry before choosing to expand its connection map.
2. Open Sessions and an available recorded session. Expect readable summary/evidence sections before raw JSON; a rule finding opens its recorded file/line evidence.
3. Return to Sessions and compare two recorded sessions when available. Expect the selected pair and its actual evidence, with missing values left unknown.
4. Open Setup → Prompt tools, then Score. Expect the optional composer and readable score navigation to remain reachable.
5. Repeat the navigation at 390 px in both themes using keyboard focus where applicable. Expect no horizontally clipped page or inaccessible primary action.

**Reset:** Clear search and restore theme. **Limits:** Rule failure/comparison subcases are Blocked when no suitable recorded evidence exists.

## R84 — Production-write guards

**Acceptance:** R84
**Environment:** local
**Setup:** Read-only inspection of local configuration and any already retained cloud refusal evidence. Do not request or run a production database tool as part of this wizard.
**Source:** `.claude/settings.json`, `ERA Notes/01 - Architecture/Database RLS Posture.md`, R84's retained owner check.

1. Open `.claude/settings.json` in the editor and locate the deny list. Expect both `mcp__claude_ai_Supabase__` and `mcp__Supabase__` variants of SQL, migration, function deployment, branch and project mutations, plus Supabase CLI and psql restrictions.
2. Open Database RLS Posture → Agent access and compare the named tool variants. Expect the documented denied forms to match the configuration.
3. Review an existing owner-controlled cloud refusal trace for the same configured environment. Expect a permission refusal before tool execution; if no trace exists, record Blocked for the cloud-runtime witness rather than treating configuration alone as a pass.

**Limits:** This wizard performs no production call and cannot establish runtime enforcement without retained owner evidence.

## R78 — UAT in the Drive mirror

**Acceptance:** R78
**Environment:** local
**Setup:** Owner's already published Drive mirror and one known handover; do not initiate publication just by opening this test.
**Source:** `scripts/pm/drive-publish.mjs`, `tests/pm-drive-publish.test.ts`.

1. Open the existing mirror's **02 - Delivery Status/status.md** and find the known item. Expect a UAT state, scenario counts, evidence time and any linked feedback work ID separate from engineering Done.
2. Open that handover's individual mirror document. Expect its retained test instructions and result evidence even if its run is outside the recent-run summary.
3. Compare the mirror with the same handover in Command Center. Expect identical recorded facts at the mirror's stated evidence time; a stale mirror does not certify current candidate state.
4. In a disposable mirror fixture only, edit the published document and refresh the publisher fixture. Expect local UAT receipts/sign-off to remain unchanged and the one-way publication to restore source content.

**Reset:** Let the fixture restore its own mirrored document. **Limits:** Missing publication makes steps 1–3 Blocked; step 4 needs a disposable mirror and never edits the owner's live acceptance record.

## R77 — Feedback becomes one work item

**Acceptance:** R77
**Environment:** local
**Setup:** Isolated Command Center corpus with a ready sample handover; no live feedback is submitted for a synthetic defect.
**Source:** `scripts/pm/uat-feedback.mjs`, `UatWizard.tsx`, `tests/pm-uat-feedback.test.ts`.

1. In the sample test wizard select **Needs changes**, choose **Bug**, enter a distinctive fixture observation and Submit once. Expect Saved/Feedback saved with the scenario/step context retained.
2. After the two-minute Undo window, restart only that isolated fixture's PM server and open the feedback again. Expect one linked work ID and Open work, with no agent started.
3. Open the linked item and inspect its criteria. Expect the original observation, expected/actual result, build/device and UAT feedback source identity.
4. Restart the same fixture again and re-open the feedback. Expect the same work ID rather than a duplicate checklist item.
5. In a separate fixture thread submit a Comment, or withdraw a report within its Undo window. Expect no new engineering item for that thread.

**Reset:** Dispose of the isolated corpus using its fixture cleanup. **Limits:** Production startup/import and multi-process races are not established by this manual fixture pass.

## R76 — Follow, resume and record a test

**Acceptance:** R76
**Environment:** local
**Setup:** Isolated ready handover with at least two steps, plus draft/incomplete samples for the gate cases.
**Source:** `scripts/pm/app/UatWizard.tsx`, `uatModel.ts`.

1. Open the sample's Test steps and select Next, Back and All steps. Expect one action/expected pair in step mode and the complete numbered list in All steps.
2. Move to a later step, type an observation and select Save; reload the same URL. Expect the saved position and text to remain on the same handover revision.
3. Choose Fail and try to record without a note, then add a short note and Record. Expect the empty note to be refused and the recorded failure to remain after reload.
4. Open the draft/incomplete samples. Expect no sign-off or result controls that imply those samples are ready to accept.
5. Return to the ready fixture, record Pass for every required scenario and confirm its actual build availability. Expect Sign off to remain disabled until every existing gate is satisfied; choosing Sign off records an explicit owner receipt, and Retract reopens acceptance.

**Reset:** Retract the fixture-only sign-off and use fixture cleanup. **Limits:** Never sign off a real item merely to test this control.

## DLV-145 — Bound results and sign-off

**Acceptance:** DLV-145
**Environment:** local
**Setup:** Isolated UAT store with ready, draft, incomplete and replacement-candidate samples.
**Source:** `scripts/delivery-v2/uat.mjs`, `uat-routes.mjs`, existing DLV-145 handover evidence.

1. Open the ready sample and note its revision and source/candidate identity. Expect every displayed result to belong to that exact revision.
2. Record Pass on its required scenarios but leave build availability unconfirmed. Expect Sign off to remain disabled with an availability blocker.
3. Confirm the fixture build, sign off, then Retract. Expect a sign-off receipt followed by a separate retraction; earlier observations remain readable.
4. Open the replacement-candidate fixture. Expect fresh Pending results and stale/superseded labels for the earlier binding, rather than inherited acceptance.
5. Review a fixture that lost a result reply and retry it. Expect Pending sync before recovery and exactly one result receipt after the original command is recovered.

**Reset:** Use isolated fixture cleanup. **Limits:** No provider execution, live application data or production store is needed.

## DLV-150 — Native session and host checks

**Acceptance:** DLV-150
**Environment:** local
**Setup:** Owner-approved small non-risk item, clean base, matching dependencies and signed-in subscription CLI. This live witness runs a native provider only when the owner explicitly elects to perform it. Otherwise record Blocked.
**Source:** [Existing Local handover](Delivery-UAT.md#local-lane--dlv-150153), `scripts/delivery-v2/local-cli.mjs`, `local-lane.mjs`.

1. From the project terminal run `node scripts/delivery-v2/local-cli.mjs readiness codex` (or the chosen `claude`). Expect Source, Sign-in and Dependencies to identify any blocking prerequisite.
2. Only for the approved item, run `node scripts/delivery-v2/local-cli.mjs start <ID> "<Campaign>/4 - Checklist.md" codex` with its real ID/file and chosen executor. Expect one local run and a sibling `delivery/<ID>` worktree; an existing branch is retained instead of overwritten.
3. When that owner-started worker finishes, open the same run in Sessions and inspect Checks/Activity. Expect separately recorded typecheck, lint, tests and pm:lint results from host checks.
4. Inspect the retained worker setup evidence without printing secret values. Expect the repository instructions/skills/hooks and no copied `.env` or production/provider API key in its allowed environment.

**Limits:** Passing replay checks is not a native-provider witness. No Ship or production database action is required.

## DLV-151 — Fresh Local entry

**Acceptance:** DLV-151
**Environment:** local
**Setup:** Updated local server and the separately approved DLV-150 test item; start authorization is distinct from viewing readiness.
**Source:** [Existing Local handover](Delivery-UAT.md#local-lane--dlv-150153), `LocalDelivery.tsx`, `local-auth.mjs`.

1. Open the printed `http://127.0.0.1:<port>` in a fresh browser profile, find the approved item and select Deliver. Expect Executor and Start with no initial readiness report and no Pair form on loopback (R113).
2. In an isolated blocked fixture, select Start. Expect source/authentication/dependency blockers after the attempted launch, with advisory facts inside Check details. No separate Check readiness step is required.
3. Select Confined without starting it, then return to Local. Expect the existing confined gates to remain separate from Local's three blockers.
4. Only within the approved native witness, press Start once and reopen the item. Expect the original run identity rather than a second run; without that authorization, record this step Blocked.
5. View the same server through the owner-authorized LAN access path. Expect pairing there and Local operations to remain desktop-only.

**Reset:** Close the fresh browser profile. **Limits:** Dirty source, missing sign-in or LAN setup are explicit prerequisites, not evidence of a failed feature.

## DLV-152 — Risk review belongs to the checked head

**Acceptance:** DLV-152
**Environment:** local
**Setup:** Isolated Local candidate with a classified risky diff and owner-controlled sample UAT; no production credentials or live financial records.
**Source:** [Existing Local handover](Delivery-UAT.md#local-lane--dlv-150153), `local-guardrails.mjs`, `LocalDelivery.tsx`.

1. Open the isolated candidate and complete its own sample Test steps/sign-off. Expect Ship to remain disabled until the required diff review is opened.
2. Select Review diff and compare the shown commit and paths with the candidate's checked head. Expect the actual frozen patch and its classified risk paths.
3. In the isolated fixture replace the checked head with its prepared newer candidate. Expect prior review and UAT to stop authorizing Ship for the new bytes.
4. Inspect the environment/refusal fixtures and one classifier case per money, recurrence, auth/household, migration, rules and admin-import domain. Expect every named risk to be flagged and production/provider credentials refused.

**Limits:** Local environment scrubbing protects against accidents; it does not establish container isolation or protection against a determined host process.

## DLV-153 — Ship and Undo the approved test item

**Acceptance:** DLV-153
**Environment:** local
**Setup:** Disposable repository/remote, a checked Local candidate, its genuine owner test sign-off and required review. Do not push the real main branch merely to test these buttons.
**Source:** [Existing Local handover](Delivery-UAT.md#local-lane--dlv-150153), `LocalDelivery.tsx`, `local-lane.mjs`.

1. Open the isolated Local run before all test/review gates are satisfied. Expect Ship disabled for the unaccepted head.
2. Complete that candidate's required owner tests and review, then select Ship once. Expect one merge/push to the disposable main branch and the selected item's PM receipt/checklist update.
3. Select Undo on the same fixture run. Expect one revert of the merge, a push, and restoration of the item's code and PM state.
4. Use the prepared failed-push fixture and select Retry push. Expect reuse of the retained commit, not a second merge.
5. Use the prepared advanced-main/stale-head fixture. Expect a refusal requiring rebuilt/retested source, rather than applying the old sign-off to new bytes.

**Reset:** Use disposable repository cleanup. **Limits:** Interrupted merges require inspection; never retry blindly. This guide does not authorize a real production branch push.

## BUD-87 — Transfer and Undo exactly once

**Acceptance:** BUD-87
**Environment:** hosted
**Setup:** Owner-controlled test accounts in USD with known balances and no concurrent activity; the owner performs the transfer. Worked example: source 100, destination 50; transfer 1 gives 99 and 51, total 150; Undo restores 100 and 50. The assistant performs no database write.
**Source:** BUD-87's four owner steps, `src/components/expense/TransferDialog.tsx`, `src/features/transfers/hooks.ts`.

1. Open Transfer Between Accounts, select the test From Account and To Account, enter 1 and select Transfer once. Expect the dialog to close, one transfer row, source 99 and destination 51 in the worked example.
2. Select the toast's Undo. Expect both balances to return to 100 and 50 and the created transfer to be reversed once.
3. Turn the test device offline and submit the same 1 transfer again. Expect Offline — transfer not sent, without silently recording a successful transfer.
4. Restore connectivity and select Retry once. Expect exactly one new 1 transfer, one pair of balance changes and no second row after refresh.
5. Open Activity → Transfers and delete that test transfer once. Expect both balances to return; a stale repeated deletion must not reverse them a second time.

**Reset:** Remove only the test transfer through the app and confirm the starting balances. **Limits:** The two-account operation is not yet a single database transaction (BUD-63); this test does not repair the historical incident.

## BUD-88 — Balance history constraint verification

**Acceptance:** BUD-88
**Environment:** hosted
**Setup:** Owner has reviewed `migrations/2026-11-03_balance-history-change-types.sql` and elects to apply it manually in Supabase SQL Editor. Until then, record Blocked. The assistant must not run SQL.
**Source:** The named migration's final verification SELECT and BUD-88's acceptance.

1. The owner opens the named migration and reads its WHAT/WHY/RUN and verification sections before applying it manually. Expect the runbook to widen the CHECK without recreating historical missing rows.
2. After the owner's manual run, inspect the final verification result. Expect exactly one `abh_change_type_check` row listing `transfer_deleted`, `transfer_updated`, `transaction_moved`, `split_deleted` and `statement_import_revert` among the allowed values.
3. After an owner-authorized relevant test operation, open Error Logs and inspect new entries from that observation time. Expect no new Account balance history log failed event with SQLSTATE 23514 for the operation; if no relevant operation was observed, record this step Blocked.

**Limits:** This does not reconstruct dropped historical history, and a schema-only result does not prove every write flow was exercised.

## DLV-77 — Relay prerequisite evidence

**Acceptance:** DLV-77
**Environment:** local
**Setup:** Owner-supplied current relay constraint output and the current PM Relay Setup document; no agent database call.
**Source:** PM-M13 in [retained PM review](Delivery-UAT-PM-Review-2026-10-25.md#pm-m13--keep-owner-prerequisites-and-deferred-witnesses-explicit).

1. Open `ERA Notes/06 - Setup & Onboarding/PM Relay Setup.md` and locate its required command schema. Expect the documented current command types and owner-run setup requirements.
2. Compare that list with the owner's untruncated current constraint output. Expect the required types to be present; missing output leaves this case Blocked.
3. Only after those prerequisites, inspect the owner-authorized phone command witness and its retained receipt. Expect the same command identity to reach the intended installation without a duplicate effect.

**Limits:** Missing historical migration text alone does not establish a production failure. This is not permission for an assistant to query or mutate production.

## DLV-100 — Real-boundary recovery witness

**Acceptance:** DLV-100
**Environment:** local
**Setup:** Separately owner-approved isolated S2.1 boundary case, exact interruption limits and recovery record from Delivery V2's failure matrix. Without it, the case is Blocked.
**Source:** PM-M13 and `ERA Notes/10 - Project Management/Plans/Delivery V2.md`, S2.1.

1. Open the approved S2.1 exercise record and compare its chosen case, run identity and limits with the failure matrix. Expect one bounded authorized case, not an unrestricted disruption test.
2. Perform only that recorded owner exercise and inspect its interruption/denial trace. Expect the selected boundary to be evidenced with the original run identity.
3. Follow the exercise's recorded recovery action and inspect the retained result. Expect recovered identity and effects to agree with its oracle; offline fixture success alone is insufficient.

**Limits:** This parked enhancement has no new run authorization from the wizard. Missing case/oracle data must remain Blocked.

## DLV-101 — Deep-dive resume witness

**Acceptance:** DLV-101
**Environment:** local
**Setup:** Completed DLV-100 prerequisite and separately approved S2.2 Deep dive exercise with a selected run and pinned context. Otherwise Blocked.
**Source:** PM-M13 and `ERA Notes/10 - Project Management/Plans/Delivery V2.md`, S2.2.

1. Open the selected Deep dive run and its S2.2 exercise record. Expect its exact run, pinned context and permitted interruption/recovery action.
2. Perform only that approved interruption/resume sequence. Expect retained receipts to continue the selected run rather than create a second unrelated execution.
3. Compare the resumed context and result with the exercise's original pinned values and oracle. Expect preserved context identity and the required recovery result; missing evidence remains Blocked.

**Limits:** This parked enhancement is not accepted by reading the plan or by observing a different run. No native run is started by opening these steps.
