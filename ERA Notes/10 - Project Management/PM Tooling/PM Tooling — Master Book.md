---
created: 2026-09-10
updated: 2026-11-10
type: master-book
status: active
owner: Elio
---

# PM Tooling — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

Item plans follow [the shared execution-plan convention](<../_Conventions.md#9-item-execution-plans>); read only the selected item and its dependencies.

## Purpose & ownership

Keep work identifiable, reviewable and recoverable across PM surfaces. Tooling campaign for desktop, static and mobile PM reading and task controls.

## Current state & evidence

**2026-11-12 — PM restructure (owner commission; tooling and documents only):** `pnpm pm:ship` ships, archives and verifies in one command ([R100](<../_Archive/Shipped/PM Tooling.md#r100>), [R89](<../_Archive/Shipped/PM Tooling.md#r89>)). Master Books went from 1.84 MB to 1.42 MB, with shipped criteria and long receipts in `_Archive/Shipped/`. Checklists are grouped by theme with owner-only rows under **Needs you**; Now is one global sprint slice; `_index.md` carries a generated block. The elapsed 5 October sprint is closed and four weeks are drafted ([R87](<#r87>), data part). [R84](<#r84>) and [R71](<../_Archive/Shipped/PM Tooling.md#r71>) are closed. No product code, database or paid API was touched.

**2026-11-10 — R94 / Agentic OS A2 implemented locally:** `pnpm os:eval <base>..<head>` runs eight versioned detectors over immutable Git blobs and emits verdict/rule/file/line/excerpt evidence. Fail/pass/n/a fixtures gate execution; Git tests cover old debt, removals, renames, dirty files and invalid ranges. PR CI evaluates exact base/head SHAs. This session stops at A2; no recorder, session store or PM.2 UI. Evidence and owner replay are under [R94](<../_Archive/Shipped/PM Tooling.md#r94>).

**2026-11-10 — Agentic OS plan filed (documentation only):** R92 to R99 added with criteria below, one per step of the [Agentic OS roadmap](<../Fable 2/Agentic OS/12 - Roadmap.md>): setup parity, registry and conflict check, rule detectors, flight recorder, scorecards, the PM.2 cockpit, the skill launchpad, Arena and game layer. Owner commission of the same date. Nothing is implemented.

## Vision & Decisions

- Owner-approved Bridge revision 2026-11-14: retain Needs you / Running / Next up in calm mode; make Game mode a chart-led ERA cockpit; place guards/conflicts in Setup and clean streak in Score; show passive Claude/Codex SDK status. Explicit view changes may use a longer 1.8 s enter / 1.0 s exit sequence, with nonblocking controls and reduced motion. *(IMPLEMENTED locally 2026-11-14: [R102](<#r102>); owner visual/device acceptance pending.)*

- Owner commission 2026-11-10: A2 is a local-only commit-range evaluator using eight detector modules and fixtures; no flight recorder or PM.2 UI. *(IMPLEMENTED 2026-11-10: R94.)*

- Owner commission 2026-11-10: A1 adds local-only setup scanning and conflict checks, with errors failing CI; existing setup defects remain reported. A2+ and PM.2 UI are separate work. *(IMPLEMENTED 2026-11-10: R93.)*

- Owner commission 2026-11-10: Agentic OS A0 keeps Codex first-class, generates its hooks and `.agents` skills from Claude sources, and retains committed `settings.local.json` by explicit owner choice. *(IMPLEMENTED 2026-11-10: R92; hook trust remains owner-controlled.)*

- Owner report 2026-10-25: asking for sign-off is unusable without an obvious entry point. Put **Review & sign off** first in Delivery, keep preparation separate from testing, and retain work-ID search on return. *(IMPLEMENTED locally 2026-10-25: R81; owner UAT pending.)*

- Owner report 2026-10-25: work IDs are essential hints on every delivery row; retain access to secondary navigation and make browser pairing recoverable without claiming missing data means idle. *(IMPLEMENTED locally 2026-10-25: R80; actual owner browser/deployed phone acceptance pending.)*

- Owner request 2026-10-24: center Delivery and raise its lightning affordance slightly; use a slow gold/purple glow for observed execution, a steady waiting signal, and static reduced-motion styling. Shared local/phone navigation preserves all destinations and approval boundaries. *(IMPLEMENTED 2026-10-24: R73; isolated browser fixtures, hosted deployment/device acceptance pending.)*

- Owner request 2026-10-03 (with Hub & ERA HUB-85): issues reported from the ERA chat join the weekly sprint as standalone Defects / Hotfixes to deliver now, regardless of the week they were filed in. They import as canonical Hub & ERA Now items (no second inbox, no sprint membership) and Sprints lists them in their own lane. *(IMPLEMENTED 2026-10-03: R72.)*

- Owner request 2026-10-03: weekly shipping is a primary Sprints tab between Home and Work, usable remotely and on desktop, with visible item status, Delivery entry and restrained game-like progress. Recommend one primary module plus a supporting module; retain module-focused weeks as an explicit option. Initial capacity and review estimates are editable planning aids, not measured velocity; drafts remain uncommitted until Start. *(IMPLEMENTED 2026-10-03: R61.)*

- Owner decision 2026-09-26: Home is the entry point for module cards, four work queues and A place to begin; Analytics is a primary destination for focus and progress. Use the existing animated Memory mark, expose work IDs and retain search context across status/layout changes. Delivery may render supplied answer options but this UI session must not change the confirmed execution system. *(IMPLEMENTED 2026-09-26: R69.)* This updates the earlier three-destination and swipeable-Home-card decisions for the shared React app; classic/static reference views remain separate.

- Owner decision 2026-09-15: Delivery is a production application surface. Internal policy vocabulary, recommendation rationales, repeated receipt fields, slogans and reference-tool links do not ship as ambient UI. Plan, verification, activity and final changes form the review sequence; major facts stay visible. *(IMPLEMENTED 2026-09-15: R66.)*

- Owner decision 2026-09-15: Work/Deliver contains actionable implementation only; completed source appears as Done, with UAT pending separately. Owner-only gates leave the backlog and remain in the UAT. Partial scope is split into explicit remaining engineering. *(IMPLEMENTED 2026-09-15: lifecycle reconciliation; PM Tooling R65 owns the app and guards.)*

- Owner request (2026-09-14): Delivery must be comfortable on desktop and follow mobile UI rules on phones; every work item retains visible delivery attempt history across success, cancellation, failure and rollback. Implement the proposed [hotfix](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>) under R64/R55 and linked Delivery owners, with short product copy and full details on demand. R64 implementation is Done; R55 retains explicit remaining history work. Owner UAT is tracked separately; candidate verification alone does not complete an implementation item.

- Adopted 2026-09-11 ([Command Center](<../Plans/Command Center.md>)): keep the React experience and its three destinations, shown as Home/Work/Delivery with existing deep-link aliases. Board/List (R60) and Sprints (R61) are views over the same checklist outcomes; the planned `_Planning.json` holds references and planning facts only. Metric definitions precede new charts (R62). The phone is a core milestone served from the shared views (R63). Duplicate presentation paths retire under R6 once replacements pass. No new campaign, task store or UI architecture. *(IMPLEMENTED 2026-09-11: R60 — Home/Work labels, shared Board/List component, badges-not-lanes. 2026-09-12: R63 in code — `/pm/live` mounts the shared views through the transport seam; phone acceptance outstanding. 2026-09-12: R62 in code — one history parser and metric contract behind `#/dashboard`; sprint charts and delivery comparisons outstanding; nothing retired under R6.)*
- IDs compare normalized, display in source spelling and link to GitHub heading slugs shared with `pnpm pm:check-docs`. Checkbox writes carry a row witness; ordinal-only writes are refused. *(IMPLEMENTED 2026-09-11: R59)*
- PM reuses the personal app's ERA palettes from `src/app/globals.css`; the product reboot does not authorize replacing its visual identity. Old light/dark preferences migrate to Blue. *(IMPLEMENTED 2026-09-11: R58)*

- The primary app is Today → space or discovery → focused outcome → Delivery → recorded result. Desktop uses a compact top navigation and centered pages; phone uses bottom navigation, swipeable covers and bottom sheets. Search absorbs cross-project topic relationships; internal Area/Topic distinctions do not become navigation. Static output remains a useful reference/export, not the primary design constraint. *(IMPLEMENTED 2026-09-10: R57; explicitly replaces R54/R56 visual direction at the owner’s request)*

- Markdown checklists are the only backlog; runtime/session evidence is not another task database. Archived documents are excluded from scans; research has no executable checkboxes.
- Stable campaign paths, IDs and required book headings preserve existing parser/bridge contracts. Share parsing behavior across the three Preact outputs and React mobile UI; static parity is not cache freshness.
- Legacy UI removal stays gated on desktop/390px visual UAT and a fake-driver walkthrough. This refactor does not delete rollback code or certify mobile behavior.
- R51 guards stale ordinal identities and whole-file Undo. R37 is local/static provenance; hosted follow-up stays separate. Five shared parser modules are R36; no grammar/framework expansion.
- The review ritual, 90-day retention and meta-work budget now live only in _Conventions.md. *(IMPLEMENTED 2026-09-10: R35 and R52; radar remainder R34/R38)*
- R54/R56 reference navigation is Project, Work, Delivery, Decisions and Outcomes. Project has Areas and Topics lenses; the old Campaigns route remains an alias. Document browsing, source previews, rollups, search, Inbox and file operations remain supporting tools. Board/List replaces the old task table; planning actions live on an item's stable-ID detail page, with direct Deliver/View run actions on the queue. Capture uses the existing Inbox. *(IMPLEMENTED 2026-09-10: R54; Project exploration refined in R56)*
- The live workspace composes existing state, event, plan, artifact, transcript and usage endpoints. It shows recorded work and the active provider's phase role; it does not imply parallel agents, in-flight tool telemetry or unobserved completion. V2 mode presents setup/readiness instead of offering a V1 launch that would be refused. Its future job UI is held under R55.
- Topics use explainable matches against canonical titles, outcomes and acceptance statements, excluding test gates, code paths and provenance. Overlap is intentional; unmatched work stays visible. Explicit dependency links distinguish open, completed, shipped, cancelled and unresolved references. They do not infer runtime authorization. *(IMPLEMENTED 2026-09-10: R56)*
- Owner-commissioned system refactors are an explicit meta-budget exception; they do not authorize executing the product backlog.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Campaign acceptance

- **D1** `pnpm pm:lint` is clean and `npx vitest run tests/pm-ui/` is green before and after every change.
- **D2** Canonical parsing stays shared across the primary React app and Preact reference/static outputs. Verify both builds after shared changes; visual parity with the primary app is deliberately retired by R57.
- **D3** Every view that renders a checkbox honours hide-completed, verified at 390 px and on the desktop.
- **D4** A filtered board can be reloaded and shared by URL.

## Pain Inventory

🟠 **R117 — Local session loses structured review, Bridge stays yellow, native launch crashes (2026-11-14).** Owner run `local-b52041fb-b6c8-46cd-ab03-8fa669ea6f23` (HUB-118) failed before provider work: `buildSessionOptions` passes Node's special `process.env` into `deepFreeze`, throwing `TypeError: Cannot freeze`. `LocalRun` bypasses the existing session sections, and `local-lane.list` labels every non-UAT phase `review-result`, masking execution and terminal failure as owner attention. Failed attempts also retain a deterministic worktree/branch that prevents a fresh Start. Preserve the failed evidence; repair the causes and verify offline.

🟠 **R116 — Valid Local subscription reported as missing (2026-11-14).** HUB-118 Start screenshot shows Source/Dependencies passed, Sign-in blocked. Read-only credential metadata confirms Claude Pro subscription token/inference scope and no embedded API key. Loading PM's `.env` adds ANTHROPIC_API_KEY and Azure TTS variables; `localSubscription` checks the unsanitized host environment and rejects these before examining the valid login. The native worker already receives `localEnvironment()` without those variables. Align subscription lookup with that environment while preserving custom credential directories and strict credential-file validation.

🟠 **R113 — Deliver hides launch blockers behind disabled Start (2026-11-14).** Owner reports an unchanged Game view, disabled Local Start, confusing Confined executor availability and a separate Check readiness step. Local UI gates on passive readiness (current workspace is dirty); Confined conflates installed SDKs with policy permission and gates Start even though the server collects readiness. Both subscriptions and dependencies pass local passive inspection; installed policy revision 13 permits only Codex in Confined. Keep admission checks, move them behind explicit Start, and give Game Mode its own launch composition.

🟠 **R112 — Setup obscures real repairs and rule coverage (2026-11-14).** Owner reports that Setup, unguarded rules and Conflicts are unclear. Source evidence shows that coverage counts trust declared levels even when guards are missing, all diagnostic severities share one conflict count, and selecting an inventory entry also silently filters the list. The scan additionally treats workstation-only permissions and intentional review requirements as setup failures. Repair real configuration defects, retain accurate scope and evidence, and make the required action visible.

🟠 **R108 — The skill launcher adds steps without delivering work (2026-11-14).** Owner: "i honestly don't see any value in it". R107 improved composition but still requires review/copy/switching into a native agent. Local execution already reads start-task and repository skills automatically. Promote the existing outcome/acceptance/Deliver path and retain forms only as a secondary utility; do not invent another backlog or executor.

🟠 **R107 — Launch obscures free skill use (2026-11-14).** Owner finds Recipes and Item confusing and the page weak. Launch shows only eight form-backed skills, requires a backlog item for add-feature, and presents two saved presets as a separate top-level concept. Replace the default with slash-skill composition, optional module context and clearly optional structure.

🟠 **R101 — Agentic OS UI rejected as unusable (2026-11-14).** Equal-weight content, long initial forms, raw JSON reports and an always-expanded graph hid daily actions. Corrected presentation and expanded-view browser verification are tracked under R101.

🟠 **R92** The agent setup differs per agent and holds dead, duplicate and machine-specific configuration (2026-11-10 inventory). See [acceptance](<../_Archive/Shipped/PM Tooling.md#r92>).

🔴 **R84** Deny Supabase write tools in every tool namespace. Filed 2026-11-10 from [Fable 2 finding F2-12](<../Fable 2/01 - Architecture/Environments and Data Safety.md>) (2026-11-10). See [acceptance](<#r84>).

🟠 **R85** Disposition the ERA research packs into the backlog. Filed 2026-11-10 from [Fable 2 finding F2-11](<../Fable 2/10 - Project Management/Portfolio/Research-to-Queue Leak.md>) (2026-11-10). See [acceptance](<#r85>).

🟠 **R86** Show the next action, what needs the owner and what is running on Home. Filed 2026-11-10 from [Fable 2 usability review U1, U5, U6, U8](<../Fable 2/10 - Project Management/Command Center/1 - Usability and Visual Review.md>) (2026-11-10). See [acceptance](<../_Archive/Shipped/PM Tooling.md#r86>).

🟠 **R87** Close elapsed sprint weeks and roll their work forward. Filed 2026-11-10 from [Fable 2 usability review U4](<../Fable 2/10 - Project Management/Command Center/1 - Usability and Visual Review.md>) (2026-11-10). See [acceptance](<#r87>).

🟠 **R88** Make cited evidence verifiable and run the docs check in CI. Filed 2026-11-10 from [Fable 2 finding F2-20](<../Fable 2/01 - Architecture/Agent Context Economy.md>) (2026-11-10). See [acceptance](<#r88>).

🟡 **R83** Keep one session proxy file or none. Filed 2026-11-10 from [Major Bug Sweep S3](<../Research/Major Bug Sweep.md#s3>) (2026-11-04: evidence, fix, test and UAT). See [acceptance](<#r83>).

🟠 **R89** Hold each Master Book to a size budget. Filed 2026-11-10 from [Fable 2 finding F2-21](<../Fable 2/01 - Architecture/Agent Context Economy.md>) (2026-11-10). See [acceptance](<../_Archive/Shipped/PM Tooling.md#r89>).

🟠 **R90** Cover every service-role route with an authorization contract. Filed 2026-11-10 from [Fable 2 finding F2-14](<../Fable 2/03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>) (2026-11-10). See [acceptance](<#r90>).

🟡 **R91** Make `pnpm typecheck` run in a 15 GB container. Filed 2026-11-10 from [Fable 2 finding F2-19](<../Fable 2/01 - Architecture/Verification Pyramid.md>) (2026-11-10). See [acceptance](<#r91>).

- 🟠 **R82 — Readiness's pass ratio conflated blockers with unrun checks (2026-10-31).** Owner KIT-10 report: Check appeared to leave `4/11`. Initial inspection found expired authorization, missing scope and five unobserved live gates. An authorized local Check through the existing saved owner session renewed authorization, derived KIT-10's prepared scope and isolated `docker-unavailable`. Docker's frontend was alive but its backend and Linux engine pipe were absent. Supported Start said already running; supported Restart failed to stop lingering processes. Stopping only verified Docker frontend processes and launching the installed main executable restored engine 28.5.1. The second Check passed all eleven gates at 16:17:01 UTC (18:17 Beirut), with zero provider turns and confirmed probe cleanup. No delivery Start, bridge restart, policy replacement or Apply. The original browser click's response remains unknown; this direct reproduction establishes the current blocker and recovery, not that historical response. Docker's original backend-exit cause and permanent prevention remain unproven.

- 🟠 **R81 — UAT steps were buried and their readiness was overstated.** Only ready handovers reached Needs you; draft/incomplete instructions were hidden with finished records under collapsed Test records. The local store had no ready handovers. Resolved locally with the visible review area and explicit expected-result repair; build validation and owner acceptance remain separate.

- 🟠 **R80 — Delivery lost item context and gave no usable recovery for browser pairing.** Source-confirmed: `RunLink` rendered status/title without the stored ID; the new UAT query ran before pairing, while protected transport refusals cleared CSRF without refreshing the query's paired state. Delivery home omitted queue errors and inferred idle from missing V2 rows; direct Test links could misreport an access failure as Not found. Secondary routes existed without a consistent menu, and history stopped at 50. Resolved locally 2026-10-25 with the same shared views/authentication; owner UAT remains pending below.

🟡 **2026-10-25 — Delivery owner actions can disappear when queue data is unavailable.** Source review of R75 found that `DeliveryHome.tsx` omits `queue.error`, while `deliveryHomeModel.ts` sends closed runs into history without the queue decision. The existing fallback fixture confirms that classification; no live failure was observed. Preserve known owner actions and expose uncertainty in the [manual UAT follow-up plan](<../Plans/Delivery Manual UAT.md#phase-3--complete-the-delivery-experience>); allocate its bounded follow-up before implementation.

🟡 **R71 — 2026-10-03: The PM Stop hook sends agents to retired PM files.** `.claude/hooks/check-pm-update.sh` blocks with "mark completed work … in the Feature State / Pain Inventory file, check it off in the Execution Plan, and note *(IMPLEMENTED YYYY-MM-DD)* in the Vision/Decisions file" — the pre-consolidation layout. Campaigns have been Master Book + `4 - Checklist.md` since 2026-07-30 (Hard Rule #25), so a blocked agent gets stale directions. Found by the 2026-10-03 Claude setup audit.

🟠 **R66 — 2026-09-15: Delivery exposes internal policy and hides major review facts.** Launch printed scope/fleet verdicts and recommendation rationales; the session hid Risks, Unknowns, verification history, application history and run facts in low-prominence disclosures. Token receipts repeated unknown/reserved/allowance fields, and global footer copy made the application read like a draft. Owner screenshots supplied desktop and mobile evidence.

🟠 **R64 — 2026-09-14: Delivery compresses decisions into small technical rows.** Source CSS uses 9px plan disclosures, 10px check states and 11px check/resource/list text. Plan, cost, evidence and application counters compete without a clear decision hierarchy; owner reports desktop/mobile usability failure. Responsive screenshot/device acceptance is pending. [Hotfix UX contract](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).

🟠 **R55 — 2026-09-14: a real V2 attempt disappears from the item's navigation.** Work's `runFor` uses active V1 sessions only; terminal V2 attempts live behind Delivery history and no item attempt list exists. The run itself remains stored; this is a presentation/navigation omission, not production RLS. Preserve all attempts and their distinct plan/candidate/result/application versions.

🟡 **2026-09-13 — “See what changed” opens the backlog.** Actual-component rendering reproduced `Work.tsx`'s `view=story` / `SpaceView`'s `tab=story` mismatch. Owned once by Delivery [DLV-107](<../_Archive/Shipped/Delivery.md#dlv-107>) as the requested first trial.

🟠 **2026-09-13 — Home/Work omit V2 activity.** `state.tsx:143` fetches only `source.v1Runs`; Home and Work consume that list. A V2 run can appear on Delivery while Home has no active ribbon and Work offers no corresponding Follow delivery link. Retained under [R55](<#r55>), not a duplicate work item.

🟡 **2026-09-12 — HUB-23 names two different outcomes.** Hub & ERA's Shipped Log records **HUB-23** "Ask AI" (2026-08-26) while the open checklist row HUB-23 is "Rank signals using explicit feedback". The dashboard counts it as Reopened, not completed, and a prerequisite on HUB-23 reads the open row. Cause: an ID reused after shipment. Fix is a Hub & ERA rename with an alias record, not a parser change. Found by R62's read-only live-corpus scan.

🔴 **R43** Verify hot-child RLS and read contracts. See [acceptance](<#r43>) for the root cause, evidence and gate.

🟠 **R47** Enforce the client-only console rule. See [acceptance](<#r47>) for the root cause, evidence and gate.

🟠 **R51** Reject stale desktop task actions and unsafe Undo. Dated source diagnosis; cause and witness limits are in [criteria](<#r51>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **R37** Verify local shell and static data provenance. Dated source diagnosis; cause and witness limits are in [criteria](<#r37>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### R117

**Outcome:** Local sessions have a structured review, the Bridge reflects actual execution/failure, and native startup can pass environment construction.

- **Kind:** bug
- **Acceptance:** Local run page retains identity, stages, plan/brief, four host checks with honest unrun/inconclusive states, activity, changes and UAT controls at desktop/390 px Blue/Pink. Observed Local execution remains red and continuously turning even with unrelated owner UAT; failed/interrupted sessions and blocked launches show the grey offset split ring. UAT/approval stays yellow. Claude options accept `process.env` without freezing it or weakening the sandbox. A fresh explicit owner attempt preserves previous runs/worktrees and still enforces admission and one active run per work item.
- **Touches:** `scripts/pm/app/`, `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/adapters/claude.mjs`, `tests/pm-ui/`, `tests/delivery-v2/`
- **Verification:** Offline adapter/local-lane/state/render tests; required PM suite, typecheck, changed-file lint and PM build; credential-free desktop/mobile browser flow. No live provider test, production write, merge or push.
- **Implementation:** done
- **Verified (2026-11-14):** 597 tests pass across all PM UI suites plus Local/executor/launch-receipt suites; 44 adjacent auth/recovery/dynamics checks pass. Repository typecheck, changed-file ESLint, PM React build, docs and PM validation pass. `local-session.browser.mjs` records 28 desktop/390 px Blue/Pink screenshots, live running→failed polling, blocked/interrupted/review states and reduced motion with no writes/runtime errors. A separate read-only browser check on the actual reported run confirms the restored sections and real Bridge failed state. Original failed run/worktree remain intact. Evidence and candidate hashes: `.pm/r117-evidence/`; [owner restart/retest](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r117--local-session-review-bridge-states-and-startup-recovery>). Backend activation/live provider acceptance remain owner-run.
- **Hook regression:** the full pre-commit pass exposed inherited `GIT_INDEX_FILE=.git/index` in the disposable worktree helper (5,025 tests passed, one failed). Reproduced with that variable alone; fixture Git now uses the same scrubbed environment as the Local supervisor, and the UAT changed-head case explicitly covers the hook override. No verification guard is skipped.
- **UAT:** pending

### R116

**Outcome:** A valid Local Claude/Codex subscription is not rejected because the PM host loads the application's API configuration.

**Implementation:** done
**UAT:** pending
**UAT instructions:** [Local sign-in with app API configuration](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r116--local-sign-in-with-app-api-configuration>)

**Kind:** bug
**Touches:** `scripts/delivery-v2/local-guardrails.mjs`, `scripts/delivery-v2/local-lane.mjs`, `tests/delivery-v2/local-lane.test.ts`

- **Acceptance:** Readiness and build credential lookup validate using the existing cleaned worker environment, preserving explicit Claude/Codex credential directories. Subscription file validation still rejects API-key/unknown credentials. Parent environment stays intact; worker credential isolation and all admission gates remain. No inference/real session during verification.
- **Verify:** Regression with synthetic app API/Azure config and valid custom-directory Claude Pro login, unchanged parent values and rejected API-key credential file; Local suite, typecheck, scoped lint and offline real-login metadata check.
- **Evidence (2026-11-14):** 23 Local replay tests, typecheck, scoped lint and PM checks pass. Offline corrected lookup returns Claude subscription pass against existing credentials with PM `.env` loaded; no network/provider call or credential change. Readiness and build share the same cleaned lookup. Owner bridge restart required under Hard Rule 26; real HUB-118 execution remains unstarted.

### R115

**Outcome:** Deliver defaults to its item's declared Tier and effort, and keeps an AI-marked recommendation available after overrides.

**Implementation:** done
**UAT:** pending
**UAT instructions:** [Markdown defaults and AI markers](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r115--markdown-defaults-and-ai-markers>)

**Kind:** feature
**Touches:** `scripts/pm/app/`, `tests/pm-ui/`

- **Acceptance:** Read only the selected item's explicit Tier declaration, resolve aliases through existing setup Model Registry entities, use explicit effort then registry default. Local and Confined preselect supported recommendations without overwriting manual choices after late data arrives. Sparkle marks identify recommended executor/model/effort and a persistent restore button names the recommended model/effort. Missing/unavailable recommendations stay honest; no model substitution, policy bypass, new inference call or backend route.
- **Source:** Owner request, 2026-11-14, following R114.
- **Verify:** Parser tests for precedence, missing/unsupported data and fenced examples; isolated browser defaults/override/restore/late snapshot checks plus desktop/390 px themes, typecheck, build and scoped lint.
- **Evidence (2026-11-14):** 11 focused parser/Local/readiness tests, typecheck, PM build, scoped ESLint, Feature Map/PM checks pass. Synthetic browser suite verifies Local and Confined MD defaults, explicit effort overriding the registry default, manual executor override and restore, option sparkle marker, desktop/390 px Blue/Pink and reduced-motion behavior. No provider call, readiness GET or uncontrolled write; evidence/screenshots in `.pm/delivery-launch-evidence/`. Existing setup snapshot supplies registry mappings; no backend restart required for this UI feature. Owner/device acceptance remains pending.

### R114

**Outcome:** Local Deliver exposes Model and Effort before Start in calm and Game mode.

**Implementation:** done
**UAT:** pending
**UAT instructions:** [Local Model and Effort](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r114--local-model-and-effort>)

**Kind:** bug
**Touches:** `scripts/pm/app/LocalDelivery.tsx`, `scripts/delivery-v2/local-lane.mjs`, `tests/delivery-v2/local-lane.test.ts`, `tests/pm-ui/delivery-launch.browser.mjs`

- **Acceptance:** Catalogue-backed model choices respect disabled models; effort choices respect provider/model support. Executor changes clear model/effort, model changes clear effort. Default remains available. Start sends the chosen settings, the Local supervisor validates against the installation catalogue, and the worker/session record retains them. No Docker requirement or provider inference for verification.
- **Source:** Owner follow-up to R113, 2026-11-14: Local lacks Model/Effort controls.
- **Verify:** Local supervisor replay test including rejected models/efforts and captured native request; browser selects fields and inspects the mocked Start payload at desktop/mobile sizes; typecheck/build/scoped lint.
- **Evidence (2026-11-14):** 25 Local supervisor/UI replay tests pass; typecheck, changed-file ESLint, PM build and PM documentation checks pass. Browser suite verifies selected model/effort in the Local Start payload, reset on executor change and calm/Game 1440/390 px Blue/Pink layouts. Screenshots and synthetic request evidence: `.pm/delivery-launch-evidence/`. Native request/run record values are captured by replay; no inference or live session launched. Existing bridge needs owner restart for backend catalogue validation, under Hard Rule 26.

### R113

**Outcome:** Start performs launch checks and only then reports actionable blockers; Game Mode has a distinct animated Deliver layout.

**Kind:** bug
**Touches:** `scripts/pm/app/`, `scripts/delivery-v2/entry.mjs`, `tests/pm-ui/`, `tests/delivery-v2/`

- **Acceptance:** Local and Confined show an enabled Start once the browser is connected, paired and a selection exists. No separate Check readiness control or initial readiness failure list. Start retains server validation, exact-selection authorization, durable Confined receipts and duplicate-click protection. Confined policy restrictions never masquerade as missing SDKs or bypass qualification. A failed attempt shows its cause; changing selection clears unrelated failure presentation. Game Mode uses animated mission artwork and a separate layout, with mobile/theme/reduced-motion/hidden-view support and no invented progress.
- **Source:** Owner request at `#/deliver/Budget/BUD-89?from=%2Fbridge`, 2026-11-14. BUD-89 remains the selected work example, not this interface change's completion claim.
- **Verify:** Replay-only launch/authorization/regression tests; typecheck, scoped lint, PM build; browser fixture at desktop and 390 px in Blue/Pink, failure/retry, duplicate click and reduced motion. No provider inference or production database write.
**Implementation:** done
**UAT:** pending
**UAT instructions:** [Deliver launch and Game Mode](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r113--deliver-launch-and-game-mode>)

- **Evidence (2026-11-14):** 139 affected backend replay tests and 58 frontend launch/readiness/recovery/build tests pass; final authorization rerun 18/18. Typecheck, PM build, changed-file ESLint, Feature Map and PM checks pass. Both browser suites pass: Local/Confined, calm/Game, desktop/390 px Blue/Pink, duplicate click, refusal/reset, Local success navigation, reduced motion and offscreen pause. Four mocked launch POSTs; zero provider calls, page errors, external requests or readiness GETs. Screenshots/results and candidate manifest are under `.pm/delivery-launch-evidence/`. Full repository lint retains 9,285 existing errors (changed-file lint is clean). UI assets are live at 4317; backend activation needs the owner to restart the existing `--bridge` process because startup writes production relay rows (Hard Rule 26). Native execution, deployment and owner/device acceptance remain unverified. Existing workspace edits and Confined policy restrictions remain real blockers.

### R112

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r112--setup-and-rule-coverage>)

**Outcome:** Setup clearly shows configuration health, actual rule protection, required human reviews and installed agent configuration.
**Kind:** bug
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/os/`, `.claude/`, generated AI mirrors, `scripts/pm/app/Setup.tsx`, `scripts/pm/app/setupAttention.ts`, `scripts/pm/app/setupModel.ts`, `scripts/pm/app/cockpitTypes.ts`, `scripts/pm/app/setup.css`, `tests/os/`, `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`

- **Acceptance:** Audit every current error/warning, repair its cause or represent a verified intentional configuration accurately. Missing, disabled and mismatched guards remain actionable. Whole-tree baseline and runtime enforcement stay explicit when unknown.
- **Acceptance:** Overview prioritizes actual errors and broken guards. Rule coverage distinguishes automated checks, reminders and manual review with inspectable evidence. Conflicts have readable names, severity, source and remediation. Informational inventory findings remain discoverable.
- **Acceptance:** Browsing or selecting a setup entity never silently narrows the inventory. Existing rule/session links and configuration graph remain usable. Desktop and 390 px Blue/Pink browser checks cover real scan data, broken guards and empty/error states.
- **Verify:** Agentic OS scanner/guard tests, focused PM model tests, credential-free browser fixture, typecheck, changed-file lint, PM build and PM/docs checks. No provider or production database calls.
- **Verification (2026-11-14):** 193 Agentic OS tests and 74 PM model/navigation/build tests pass. Typecheck, changed-file ESLint, mirror parity and PM build pass. The final credential-free browser pass covers desktop/390 px Blue/Pink, rule evidence, module links after prior search, independent inventory selection, missing/disabled guards, actionable conflicts, notes and saved/unavailable snapshots. Six UI source hashes match the tested fixture. Existing cockpit regression also passes at 1440/1024/768/390 px. The running local server serves matching JavaScript/CSS and a current scan with zero errors, zero warnings and twelve notes. Evidence is retained in `.pm/setup-evidence/result.json` and `.pm/setup-evidence/served.json`. Runtime hook loading, physical-phone and owner aesthetic acceptance require their own observations.

### R111

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r111--sessions-and-per-item-tests>)

**Outcome:** Sessions answers what is running, waiting, needing a decision or ready for owner testing, with bounded visual cards and direct step-by-step UAT.
**Implementation:** done
**UAT:** pending
**Kind:** feature
**Touches:** `scripts/pm/app/`, `scripts/delivery-v2/uat-item.mjs`, `scripts/delivery-v2/uat-routes.mjs`, `tests/pm-ui/`, `tests/delivery-v2/`, `docs/Delivery-UAT-Agentic-OS-2026-11-14.md`

- **Acceptance:** Replace the R110 backlog/attempt split and nested tabs with one session workspace. State counts name their unit, recorder/run/request bindings do not duplicate the same session, unknown observations never appear live or successful, and closed failures/cancellations remain explicit.
- **Acceptance:** A 71-item UAT queue is navigable by campaign and search with six cards per page. Pending items open their own authored action/expected-result steps directly, not the full Markdown document. Existing handovers reuse the current result/signoff engine; absent test instructions stay explicitly missing.
- **Acceptance:** Existing admission, pairing, stable command identities, source/build bindings, result undo and signoff gates remain; no provider or production-database actions. Desktop/390 px Blue/Pink tests use realistic queue scale, cover all states and UAT steps, and report incomplete source coverage honestly.

### R109

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r109--realign-the-planned-dates>)
**Outcome:** Plan is the primary planning destination; skipped work can move forward with one shared day offset.
**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/PrimaryNavigation.tsx`, `scripts/pm/app/Sprints.tsx`, `scripts/pm/shared/planning.mjs`, `scripts/pm/shared/sprint-realignment.mjs`, `scripts/pm/planning.mjs`, `scripts/pm/realign-sprints.mjs`, `tests/pm-ui/`, `package.json`, `ERA Notes/`, `docs/Skills-and-Agents.md`
- **Acceptance:** Plan opens Sprints; Work remains available through the existing filter. Realign previews a target start for the earliest unfinished sprint and applies the same calendar-day offset to active/draft ranges, preserving order, spacing, membership, estimates, commitment and scope history. Closed sprints stay fixed. Exclusively linked milestone target dates shift too; historical/shared and unrelated milestones stay fixed. Writes use existing paired planning commands, CAS, idempotency, lock, atomic replace and a pre-write backup; UI supports revision-bound Undo. CLI previews by default, applies only with `--apply`, and defaults to today in sprint timezone without pulling future plans backward. Tests cover DST, stale/repeated commands, closed history, unchanged fields, backups and UI desktop/390 px Blue/Pink. No provider or production DB writes.
- **Source:** Owner, 2026-11-14: promote Sprints (Plan) because Work is reachable through filters; push skipped work exactly as planned with a days offset.
- **Boundary:** R87 remains separate: no automatic close, regrouping or pruning completed members. Realign changes planned dates only and retains actual historical event timestamps.
- **Verification (2026-11-14):** 99 focused planning/navigation/model tests, typecheck, changed-file ESLint, PM build and PM/docs checks pass. Isolated Chrome exercised Plan entry, Realign preview, authenticated Apply, inverse Undo and Work access on 1440/390 px Blue/Pink; eight writes were realign/inverse commands to the isolated plan only. Five runtime hashes match the tested fixture. Existing Work/acceptance/Deliver/back-context browser regression also passes. Root inspected phone Blue/Pink previews. Evidence: [browser receipt](<../../../.pm/sprint-realignment-evidence/result.json>). The current real plan preview is +5 calendar days (Nov 9 → Nov 14); actual dates remain untouched.
- **Runtime diagnosis (2026-11-14):** Owner screenshot shows Realign +7-day preview but Apply returns Invalid planning command: Invalid input. Running local bridge/server PID 24924 started at 17:12:12; the statically imported planning command schema was updated at 17:16:47. The hot-built UI sees realign while that process retains the old discriminator. A fresh import accepts the same realign/toDate shape. Restart the existing owner-managed bridge command, then reload; no planning write was attempted during diagnosis. The agent did not restart the live bridge because its startup can trigger production writes.
- **Owner check / limits:** Restart `pnpm pm` for the new planning command, open Plan → Realign and inspect the target date. Apply shifts every nonclosed range together; Undo restores dates unless the plan revision changed. CLI `pnpm pm:realign` previews; `--to YYYY-MM-DD --apply` writes. Original planning bytes are retained in `.pm/planning-backups/`. No provider execution, DB change or deployment. Physical-device and owner acceptance remain pending.

### R108

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r108--work-remains-directly-reachable>)
**Outcome:** Make actual work the primary entry; stop asking the owner to manage skills before starting a task.
**Kind:** maintenance
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/` navigation, Work entry and Local readiness layout; `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** Primary Work opens the existing Explore screen with its filters and task details. Item-specific Deliver keeps current admission/readiness/execution contracts and shows Work active. Bare Launch shows existing Work. Setup exposes Prompt tools as a secondary utility; it has no primary navigation slot. Bridge's action describes its real destination. Existing capture, session/results/review, library and form/copy behavior stay reachable. Desktop and 390 px Blue/Pink checks prove Work → acceptance → Deliver/readiness without starting an agent; no provider or DB writes.
- **Decision:** The generic skill composer has insufficient incremental value over native chat. Skills remain agent procedures and inspectable setup; primary owner choices concern outcomes and acceptance. The narrow deterministic form/dry-run utility remains optional. This is navigation consolidation, not a new execution system or evidence of productivity gains.
- **Source:** Owner requests a first-principles challenge and replacement, 2026-11-14; evidence: `local-lane.mjs` already directs start-task/repository skills, `Work.tsx` already carries acceptance and Deliver, and current Launch ends in clipboard output.
- **Visual repair:** Local readiness reused a three-column icon/name/value grid with only name/value children. Browser text bounds reproduced overlap; a scoped two-column grid preserves readable labels and wrapped statuses without changing Confined readiness.
- **Verification (2026-11-14):** 57 focused navigation, cockpit, Work-filter and Local-delivery tests pass; typecheck, PM build, changed-file ESLint and PM/docs checks pass. Isolated Chrome exercises Work search → acceptance → Deliver/Local readiness → exact return, primary selection, legacy bare/contextual Launch and Setup utility at 1440/390 px Blue/Pink. Readiness overlap regression fails the old grid and passes the scoped fix. Existing cockpit and prompt utility suites pass. All 13 runtime hashes match the tested fixture; root inspected desktop detail and phone readiness screenshots. Evidence: [candidate](<../../../.pm/work-entry-evidence/candidate.json>) and [Work browser receipt](<../../../.pm/work-entry-evidence/work-entry-result.json>).
- **Owner check:** Refresh local PM. Work should open Now, show the existing backlog and retain a selected task's acceptance, Deliver and return context. Setup → Prompt tools retains the optional composer. Judge whether this removes an unnecessary choice; owner product acceptance is pending.
- **Limits:** Browser readiness is explicitly synthetic/unavailable; Start was never clicked. No provider execution, live DB writes or deployment. Navigation proof does not demonstrate a productivity gain. Full-repository lint retains the previously recorded baseline failures; changed-file ESLint is clean. App's tracked CRLF is preserved; the existing compact sections in delivery.css still fail whole-file Prettier, so unrelated formatting was left intact.

### R106

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r106--era-identity-and-softer-motion>)
**Outcome:** The animated Game core reads as ERA's orbital mark, with slightly softer effects.
**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/EraCore.tsx`, `scripts/pm/app/core-motion.css`, `scripts/pm/app/coreParticles.ts`, `scripts/pm/app/useCoreMotion.ts`, `ERA Notes/`
- **Acceptance:** Remove tire-like spokes, tread and the heavy continuous hot rim; preserve the ERA mark and light orbital arcs. Reduce sparks/smoke, heat and local vibration while retaining acceleration, sustained running and natural cooldown. Keep observed state colors, navigation, reduced motion and mobile/theme support. Verify local desktop/mobile Blue/Pink presentation and throttle/coast.
- **Source:** Owner, 2026-11-14: the overload animation is good; retain it, restore ERA identity instead of a tire silhouette, and make it slightly less dramatic. This refines R105's literal wheel treatment.
- **Verification (2026-11-14):** Typecheck, PM build, scoped ESLint and formatting pass; 11 focused core dynamics/state tests pass. An isolated browser check passes desktop/mobile at 1440/390 px in Blue/Pink, original ERA mark presence, open orbital geometry, click feedback, natural coast, sustained running and reduced motion. No horizontal overflow, browser errors, writes or provider calls. Root inspected laptop Blue and phone Pink throttle screenshots. App source hashes match the tested credential-free fixture. Evidence: [browser receipt](<../../../.pm/r106-evidence/browser-result.json>) and [candidate](<../../../.pm/r106-evidence/candidate.json>). These local changes are not deployed.
- **Owner check:** Refresh local PM, enable Game layer and click ERA. Confirm the orbital shape and softer intensity on laptop/phone suit the requested appearance. Physical-device smoothness and aesthetic acceptance remain pending.

### R105

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r105--throttle-and-gradual-cooldown>)
**Outcome:** The Game-layer ERA core feels like a wheel spinning under heavy friction and settles gradually after the throttle ends.
**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/`, `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** A click/keyboard throttle has a visibly stronger acceleration, red/orange heat, outward flame/ember spray, smoke and localized vibration. Running sessions sustain the treatment. Ending a burst or leaving the running state decelerates naturally rather than snapping to idle speed or removing all effects at once. Repeated activation preserves continuous rotation and bounded effects. The observed caption/state, Open sessions link, no-command behavior, theme support, reduced-motion behavior and hidden/offscreen pause remain intact. Verify laptop/mobile and both themes, timed acceleration/cooldown, retrigger, session transitions, accessibility and no layout overflow.
- **Source:** Owner review of R104, 2026-11-14: the core looks fine, but its simulated running effect should feel like an overloaded wheel with heavy friction, flame particles and vibration; stopping should slow naturally. Owner expressly requested implementation and online animation references.
- **Implementation (2026-11-14):** `useCoreMotion.ts` owns one visible-time clock for `coreDynamics.ts` and bounded canvas effects in `coreParticles.ts`. Click/keyboard drive lasts 2.4 s toward 240 rpm; observed running sustains 180 rpm. Acceleration and exponential coast preserve angular phase, while heat, smoke, flame trails, sparks and local vibration follow energy. Repeated activation extends drive without resetting position or accumulating timers. An initially failed core stays stationary; running-to-failed immediately exposes the grey split ring while residual momentum coasts. R104 state/caption semantics remain unchanged.
- **Verification (2026-11-14):** Final typecheck, PM build (1,234,553 B JS / 281,384 B CSS), scoped ESLint, formatting and changed-file hard-rule/whitespace checks pass. All 37 scoped tests are covered successfully: the concurrent eight-file run passed 36 and hit one 5 s cockpit timing timeout while compiler/browser checks ran; the unchanged cockpit file then passed all 10 tests in isolation. Six dynamics tests verify acceleration, gradual release, frame-rate independence, retrigger, sustained sessions, failure and paused/invalid time. The main browser suite passes 24 state/theme/viewport cases at 1440/390 px Blue/Pink, repeated click/keyboard, session success/failure coast, reduced-motion state-color updates, hidden/offscreen pause, calm removal and bounds. Peak throttle was 233.5 rpm; release samples decayed through 131, 65, 27, 9 and 4.57 rpm, with particles ending at zero. A final visual refinement changed hue interpolation to the shortest arc, avoiding a misleading green midpoint between blue and red. The supplemental pass on the final source sampled 503 desktop Blue and 539 mobile Pink frames with no green-band crossings, and verified reduced-motion state hues. Zero browser errors, writes or provider/native calls. Root visually inspected laptop running, phone throttle and the final Pink hue-corrected peak. Both verified isolated fixtures were stopped.
- **Candidate:** Direct local uncommitted source, bound by SHA-256 in [candidate manifest](<../../../.pm/r105-evidence/candidate.json>). No deployment or owner sign-off is implied.
- **Browser evidence:** [Main motion receipt](<../../../.pm/r105-evidence/browser-result.json>) records the full matrix before the final shortest-arc hue correction. [Final hue amendment](<../../../.pm/r105-evidence/hue-amendment.json>) binds the final five application files and updated browser harness. The 13-file candidate manifest includes application/dependency/test sources and both verification references. Original motion frames remain historical; `hue-contact-sheet.png`, `hue-replay.html` and the hue-prefixed screenshots show the final treatment in `.pm/r105-evidence/`.

#### R105 owner scenarios

**Environment/data:** open the local address printed by `pnpm pm`, refresh, choose Bridge and enable Game layer with the Orbit icon in the header. Existing sessions remain read-only; the core click does not start a delivery. Use the supplied state screenshots when current sessions do not include a running/failed state. All results below remain **Pending**.

1. **R105-M1 — Throttle, repeat and cooldown.** On a nonfailed core (or the supplied fixture), click ERA, then try Enter/Space while it has focus. Expect rapid acceleration, a red/orange hot rim, outward sparks and flame trails, smoke and vibration confined to the wheel. The real session label remains unchanged. After the 2.4 s drive, expect several seconds of smoothly decreasing speed, heat and vibration; sparks finish their paths. Click again during cooldown: the same wheel accelerates from its current rotation without jumping back to a starting angle. A failed core retains its grey broken form and responds as a stalled wheel instead of becoming healthy. The adjacent Open sessions link remains separate. **Actual:** Pending.
2. **R105-M2 — Session state and navigation.** Observe an already-running session or the fixture evidence. Expect sustained friction effects. When existing evidence becomes waiting or completed, the caption changes to that real state while the wheel cools gradually. Waiting settles to gentle yellow, explicit success to green, and failure to the grey split ring. Click Open sessions and return to Bridge: normal navigation remains usable. Do not create a live run solely for this test. **Actual:** Pending.
3. **R105-M3 — Phone, theme and motion preference.** Inspect laptop and phone-width layouts in Blue/Pink; sparks must stay within the core card, labels/link must stay readable, and the page must not shake or scroll sideways. Enable system reduced motion: there is no spinning, vibration or particle emission, but state colors remain readable. Restore motion, hide the tab or scroll the core offscreen, then return: motion resumes without a backlog burst. Turn Game layer off: calm Bridge stays still. Restore preferred theme/Game/motion settings. **Actual:** Pending.

**Untested owner limits:** visual intensity preference, physical-device smoothness/comfort and deployed `/pm/live` acceptance remain pending. Automated fixture evidence does not establish owner PASS or a native running-session witness.

### R104

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r104--session-state-on-the-era-core>)
**Outcome:** The Game-layer ERA core rotates and reacts to session state, with a visual throttle action.
**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/`, `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** Game mode permits sustained core rotation. Observed running sessions use red/orange friction, smoke and embers; awaiting delivery approval/action uses gentler yellow motion; explicit successful completion uses green; failed completion uses a grey broken offset ring. The core is a session indicator: standing backlog decisions remain in Needs you but do not mask the latest session result. Click/keyboard activation triggers a bounded visual throttle burst independent of the Open sessions link. Unknown/stale data cannot become a successful outcome, and cancelled/partial sessions do not earn green. Reduced motion disables movement; hidden/offscreen animation pauses. Calm mode remains static. Verify desktop/mobile, both themes, state changes, repeat activation and no command dispatch.
- **Source:** Owner's explicit Game-mode override of the original 400 ms/no-loop doctrine and request for throttle/clutch-kick core animation, 2026-11-14.
- **Verification (2026-11-14):** Frozen implementation, typecheck, PM build, scoped ESLint, 31 tests across seven files, formatting and the exact changed-file whitespace gate pass. The new core browser suite passes all 24 state/theme/viewport combinations plus standing-decision masking, sustained effects, repeated throttle/focus/keyboard, hidden/offscreen pause, reduced motion and calm removal, with zero overflow/errors/writes/native sessions. Existing Bridge browser regression also passes. The isolated fixture was stopped after PID/root verification. Root visually inspected running/attention/failed laptop Blue, running/failed phone Pink and throttle phone Blue. This slice changes local presentation and deterministic state derivation only.
- **Candidate:** Direct local uncommitted source, bound with nine application/verification files by SHA-256 in [candidate manifest](<../../../.pm/r104-evidence/candidate.json>). No deployment or owner sign-off is implied.
- **Browser receipt:** [Synthetic core checks](<../../../.pm/r104-evidence/browser-result.json>); state/theme screenshots in `.pm/r104-evidence/` are fixture evidence. Owner aesthetics, physical-device motion comfort and deployed-phone acceptance remain Pending.

#### R104 owner scenarios

**Environment:** local PM Bridge with existing read-only delivery evidence; no new provider run is required. Screenshot/fixture evidence may be used for states absent from current sessions. All owner results remain **Pending**.

1. **R104-M1 — Game motion and throttle.** On Bridge, turn Game layer on. Expect sustained ERA rotation. Click the ERA core and activate it with Enter/Space; repeat during a burst. Expect a bounded throttle effect, no session launch and no navigation. Open sessions remains a separate link. Turn Game layer off: the animated core is absent and the calm queues remain. **Actual:** Pending.
2. **R104-M2 — Meaningful state.** Inspect current session evidence or the supplied state screenshots. Observed running is red/orange with sustained friction/smoke/embers; awaiting approval/action is gentler yellow; explicit success is green; failure is a grey broken offset ring. A waiting count must not hide simultaneously running work. Unknown/stale, partial or cancelled evidence must not look successful. **Actual:** Pending.
3. **R104-M3 — Laptop, phone and motion preference.** Inspect at laptop and 390 px in Blue/Pink. Expect readable labels, reachable core/link and no page overflow. Enable reduced motion: state remains legible with no rotation/particles. Move the core offscreen or hide the tab: animation pauses, resuming when visible. Restore preferred theme/Game and motion settings. **Actual:** Pending.

### R103

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r103--game-switch-appearance-and-persistence>)
**Outcome:** The header Game layer toggle uses the original Orbit SVG, white when off and shining blue when on, with an obvious rotation.
**Kind:** bug
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/GameLayer.tsx`, `scripts/pm/app/game.css`
- **Acceptance:** Preserve header placement, switch accessibility and persisted mode. Reuse Lucide Orbit instead of the replacement circular-arrow SVG. Off strokes are white; on strokes use a bright blue gradient with glow. Activation visibly turns 45 degrees and deactivation returns to rest. Reduced motion skips rotation. Verify laptop/mobile in Blue/Pink.
- **Source:** Owner's three corrections after reviewing another AI's header-toggle change, 2026-11-14.
- **Cause:** The replacement hand-authored SVG changed icon identity; gray gradient stops and a 14-degree transform weakened the requested appearance.
- **Owner refinement (2026-11-14):** Increase activation to 90 degrees clockwise. Off strokes inherit the same theme ink as neighboring header icons, replacing the earlier pure-white override. This supersedes the original 45-degree/off-white acceptance values above; owner visual UAT remains pending.
- **Refinement verification:** Isolated browser checks at 1440/390 px in Blue/Pink pass: off gradient stops equal the neighboring icon color, intermediate angles are clockwise, the final angle is 90 degrees, and active blue styling, keyboard, reduced motion and page bounds remain correct. Receipt: `.pm/r103-update-evidence/result.json`. PM build and PM documentation checks pass.
- **Verification:** Typecheck and scoped ESLint pass. Isolated browser checks at 1440/390 px in Blue/Pink confirm Orbit identity, white off strokes, intermediate rotation frames, final -45-degree angle, blue gradient/glow, keyboard operation, 40 px controls, reduced motion, and no page overflow/errors/writes. Evidence: `.pm/r103-evidence/result.json` and off/on screenshots. Owner visual acceptance remains pending.

### R102

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r102--bridge-queues-charts-and-sdk-evidence>)
**Outcome:** Bridge keeps daily actions clear with Game layer off and becomes a chart-led ERA cockpit with Game layer on.
**Kind:** feature
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/`, `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** Both modes retain Needs you / Running / Next up and New task. Guard coverage and conflicts live in Setup with a numberless actionable-attention indicator; consecutive clean sessions remain in Score. The Bridge footer reports Claude/Codex SDK installation from passive local evidence and distinguishes unknown/stale or unavailable data. Game mode adds a real-state core and charts derived from recorded outcomes/session evidence, with explicit unknown/empty states and evidence links. The persisted toggle is reachable from Bridge and Settings. Owner-approved cinematic enter/exit transitions exceed the former 400 ms ceiling, never loop or block controls, and disable under reduced motion. Verify laptop and 390 px Blue/Pink, keyboard toggle, persistence, rapid toggles, missing/stale data, and existing queue navigation.
- **Source:** Owner's page-by-page Bridge review and explicit approval of charts, longer infrequent view transitions, Setup/Score placement and SDK footer, 2026-11-14.
- **Implementation (2026-11-14):** Calm Bridge retains its three queues; Game mode adds an ERA core, canonical eight-week outcome bars and non-Arena quality counts. Header/Settings share the persisted mode. The approved 1.8 s enter / 1.0 s exit choreography preserves clickable controls and text scale; reduced motion disables it and reload does not replay it. SDK footer and Setup attention use passive evidence; the timestamp-free relay catalogue remains stale/unknown. Existing Score evidence mirrors remain. No production/provider/native execution or deployment occurred.
- **Verification (2026-11-14):** Final typecheck, PM React build, changed-file ESLint and 31 focused replay tests across seven files pass. `bridge-game.browser.mjs` passes on the frozen candidate at 390/768/1440 px Blue/Pink: keyboard/persistence, action-link parity, one-shot enter/exit durations, pointer-transparent overlay, intermediate text scale, 40 px mobile controls, chart evidence drilldowns, empty/idle/unpaired/read-failure states, delayed UAT uncertainty, pending/saved evidence and missing/unknown SDKs. No page overflow, browser errors, writes or native calls. Existing cockpit usability and game/Arena browser regressions pass. Parent visually inspected settled laptop/phone themes and transition frames. [Browser receipt](<../../../.pm/r102-evidence/result.json>); screenshots and motion frames in `.pm/r102-evidence/`. Full-repository lint remains the separately recorded R101 baseline, not a clean gate for this slice.
- **Owner acceptance:** After implementation, refresh local `pnpm pm`, open Bridge, switch Game layer on and off, and inspect queue links, charts and SDK details at laptop/phone widths. Confirm motion comfort and visual hierarchy. Automated viewport evidence does not claim a physical-phone deployment or owner PASS.

#### R102 owner scenarios

**Candidate:** direct local source delivery on HEAD `78245c60fc19c7f8e47e47c257f92a406c8b41fe` plus the uncommitted R102 changes. [Candidate manifest](<../../../.pm/r102-evidence/candidate.json>) binds 19 application/verification files by SHA-256. This local build is not deployed and has no Delivery run or owner sign-off.

**Environment/data:** the locally built `pnpm pm` interface and its current read-only backlog/session evidence, viewed in Chrome. No new session, provider probe or data seed is required. A missing history is a valid empty-state check. All owner results below remain **Pending**.

1. **R102-M1 — Calm Bridge and placement.** Open the address printed by `pnpm pm` and choose **Bridge**. Turn **Game layer** off if needed. Expect Needs you, Running and Next up, New task, and Claude/Codex SDK status. The former Guarded rules / Setup conflicts / Clean streak tile row is absent. Open **Setup**: guard coverage, conflicts and any missing declared guards remain available; its numberless dot reflects actionable evidence. Open **Score**: consecutive clean sessions remain there, including the existing supporting evidence. Return to Bridge. **Actual:** Pending.
2. **R102-M2 — Cinematic view and chart evidence.** On Bridge, turn **Game layer** on. Expect one 1.8 s transition, an ERA state core, the same three queues, eight-week shipped-outcome bars and a session-quality count chart. Click a weekly bar, then an available work ID: it opens recorded work evidence. Return, select a quality category and open an available session: it opens its record. Zero data shows zero/empty evidence rather than an invented success rate. Use Back or Bridge to return; do not press a Delivery Start or submit an approval. **Actual:** Pending.
3. **R102-M3 — Persistence, motion and screen size.** With Game layer on, refresh. Expect it to remain on without replaying the cinematic sequence. Switch off, then on; try a rapid second toggle. Expect the last selected mode, responsive controls and no stranded overlay. At laptop width and a 390 px viewport, inspect queues, charts and footer in Blue and Pink: no page-level horizontal scroll or covered actions. With browser reduced-motion emulation enabled, toggle again: choreography is disabled. **Actual:** Pending.
4. **R102-M4 — Honest SDK state.** Read both footer labels. Local **SDK installed** means package presence only; it must not say Online or authenticated. If the current environment lacks a package, expect **SDK missing**. A failed/unavailable observation must remain Unknown or Stale, not green. The shared relay view cannot date its catalogue observation and therefore keeps known entries Stale and missing entries Unknown; actual deployed-phone validation remains separate. **Actual:** Pending.

**Reset:** restore the preferred Game layer and theme settings; disable any browser viewport/reduced-motion emulation. These scenarios do not mutate product records. **Untested owner limits:** aesthetic acceptance, physical-device motion comfort and deployed `/pm/live` remain pending; automated checks are recorded separately below.

### R101

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r101--searchable-setup-and-readable-evidence>)
**Outcome:** Refactor the Agentic OS presentation around daily actions and readable evidence.
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/pm/app/`, `scripts/os/forms.mjs`, `tests/pm-ui/`, `tests/os/launchpad.test.ts`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** Bridge separates action queues from supporting metrics; Launch offers skill cards before a compact form; Setup is searchable without navigating the entire graph; session details summarize facts before raw evidence; Score has consistent navigation and readable cohorts. Existing evidence, comparison, clipboard validation and Delivery links remain accessible. Verify desktop and 390 px Blue/Pink, keyboard controls, empty and populated states, typecheck and relevant replay tests.
- **Source:** Owner usability rejection, 2026-11-14; review of Agentic OS product design and local A5–A7 fixture screenshots.
- **Progress (2026-11-14):** Review found equal-weight panels, plain link clusters, raw JSON reports, an always-expanded six-column graph and a long initial Launch form. Presentation-only scope; existing data and launch boundaries retained.
- **Verification (2026-11-14):** Typecheck and changed-file ESLint pass; 39 tests in seven targeted files pass; PM React build, docs:check, pm:lint and pm:check-docs pass. Credential-free Chrome checks cover all five destinations at 390/768/1024/1440 px in Blue/Pink, keyboard skill selection, searchable Setup, expanded graph without page overflow, rule file/line evidence, two-session comparison and empty recorder. Existing Launchpad copy/recipe/stale-preview and game/Arena suites pass. `.pm/r101-evidence/` holds screenshots/results. The empty-slug title default and expanded-map overflow were reproduced and fixed during this pass. Full-repository lint is a separate baseline check.
- **Owner acceptance:** Refresh local `pnpm pm`; compare Bridge, choose a Launch skill, inspect a session failure, and search Setup. Confirm visual hierarchy and density fit daily use. No deployed or physical-phone acceptance is claimed. R98/R99 native execution boundaries remain open.
- **Full lint (2026-11-14):** completed with 9,285 errors / 51,983 warnings, matching the A6 baseline recorded in `docs/Skills-and-Agents.md`. Changed-file lint passes with zero warnings. Full output: `.pm/r101-evidence/lint-full.txt`.

### R98

**Product disposition (2026-11-14, R108):** The owner rejected the generic skill launcher as insufficiently useful. Primary entry is now existing Work; the form/copy utility moves under Setup. Remaining native generic-prompt expansion is HELD, not implied by the retained code. Revisit only for a concrete repeated workflow with value beyond native chat; no provider launch is authorized by this item.

**Outcome:** The owner picks a skill, fills a form generated from the skill's declared inputs, and gets a ready prompt or a launched session with no follow-up questions about inputs.

**Kind:** feature
**Depends on:** R93
**Touches:** `.claude/skills/`, `scripts/`, `tests/`

- **Progress (2026-11-14):** A6 copy-launch slice implemented: all eight form sidecars, strict typed/default/conditional checks, fresh A1 registry + PM picker validation, bounded real new-module dry-run, A4-required attachments, versioned recipes and visible prompt/PowerShell command copying. Complete new-module browser copy launch had zero follow-up input questions; 390 px Blue/Pink, junction, stale-result and recipe flows pass. [Acceptance/evidence](<../../../docs/Skills-and-Agents.md#skill-launchpad-a6--r98>). R98 remains open: Local's item-ID/file start contract has no skill-prompt/values/attachments/fingerprint input. Native worktree launch and binding its genuine A3 flight report require that contract extension; no synthetic session record or provider run was created. This is the owner's requested boundary, with A7 untouched. Full lint still fails across the existing checkout; focused changed-file lint is clean.
- **Verification (2026-11-14):** full typecheck, focused ESLint (zero warnings), 212 tests in 12 files, final Chrome copy-flow/390 px Blue/Pink witness and PM app build pass. `docs:check`, `pm:lint` (0 errors/warnings), `pm:check-docs`, mirror check and scoped whitespace checks pass. Full `pnpm lint` reports 9,285 errors / 51,983 warnings across the existing tree, including generated scratch bundles; this slice does not change the lint configuration.

- **Source:** [Agentic OS skill launchpad](<../Fable 2/Agentic OS/08 - Skill Launchpad.md>) (2026-11-10). Filed 2026-11-10; copy-launch slice implemented 2026-11-14, native boundary open.
- **Acceptance:** A `form.json` sidecar schema with typed fields, defaults, conditional fields, pre-launch checks and an optional dry-run preview. Forms for `new-module`, `era-wire`, `fix-bug`, `add-feature`, `db-migration`, `triage-inbox`, `data-repair` and `wizard`. Pickers read the registry and the PM scan. Copy prompt works without any launcher; launching into a worktree is enabled when DLV-150 exists. The registry reports a skill with an inputs table and no form, form drift, and a model name where a tier alias belongs.
- **Tier:** CLAUDE_MID. Plan: [Agentic OS roadmap](<../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** `new-module` already lists eight inputs and a `--dry-run`. `era-wire` names a model where the Model Registry requires an alias.

### R99

**Outcome:** Two tiers can be run on the same frozen case with a hidden oracle, and PM.2 shows streaks, shields, debt bars and parity as an optional layer over real measurements.

**Kind:** feature
**Depends on:** R96, R97
**Touches:** `scripts/`, `tests/`

- **Source:** [Agentic OS evaluation, Arena](<../Fable 2/Agentic OS/07 - Deterministic Evaluation.md>), [game layer](<../Fable 2/Agentic OS/10 - Visual, Motion and Game Layer.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** Admission gate: R96 scorecards in use and the owner wants tier comparison. Cases are harvested from shipped items (start commit, brief, the item's own test as the hidden oracle). Only the owner starts an Arena run, paced, subscription only. The game layer awards nothing for activity, opens the evidence behind every counter, and can be switched off.
- **Tier:** CLAUDE_HIGH for the Arena. Plan: [Agentic OS roadmap](<../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** Patterns: the ERA Gym replay and `tests/delivery-oracles/`.
- **Progress (2026-11-14, partial):** owner chose a Settings toggle with a futuristic transition and Claude/Codex comparison. Implemented identical-facts calm/game views, a 360 ms reduced-motion-aware scan, frozen shipped KIT-11 case and offline oracle controls (baseline: four expected failures; solution: 12/12), plus six-panel side-by-side rendering from the existing A4 store. 36 affected tests pass; broad suite has nine existing 5-second timeouts. **Blocked before native dispatch:** Local's read boundary cannot keep the oracle hidden; selecting/extending protected execution isolation needs an owner scope decision. No model calls; synthetic UI fixtures are not two real runs. R99 stays open. [Acceptance and evidence](<../../../docs/Skills-and-Agents.md#arena-and-game-layer-a7--r99-partial>).

### R84

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r84--production-write-guards>)

**Outcome:** Hard Rule 26 is enforced by configuration in local and cloud sessions alike.

**Kind:** maintenance
**Touches:** `.claude/settings.json`

- **Source:** [Fable 2 finding F2-12](<../Fable 2/01 - Architecture/Environments and Data Safety.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** The deny list contains both `mcp__claude_ai_Supabase__*` and `mcp__Supabase__*` forms of `execute_sql`, `apply_migration`, `deploy_edge_function`, the branch tools, `create_project`, `pause_project`, `restore_project`. `Database RLS Posture.md` §Agent access lists both. A cloud session's attempt to call a write tool is refused.
- **Tier:** CLAUDE_LOW. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** `.claude/settings.json:8-19` names only the first form. The cloud tool list on 2026-11-10 showed the second.
- **Implementation:** done
- **UAT:** pending
- **Evidence (2026-11-12):** `.claude/settings.json` denies the twelve write tools (`execute_sql`, `apply_migration`, `deploy_edge_function`, the five branch tools, `create_project`, `pause_project`, `restore_project`, `confirm_cost`) under both `mcp__claude_ai_Supabase__` and `mcp__Supabase__`, plus the Supabase CLI and `psql` forms for Bash and PowerShell. [Database RLS Posture](<../../01 - Architecture/Database RLS Posture.md>) §Agent access names both namespaces. `pnpm os:check` no longer reports `NAME-BOUND … Supabase deny coverage missing for mcp__Supabase`. Not observed: a cloud session's refusal.
- **Owner check:** in a cloud session, ask the agent to call `mcp__Supabase__execute_sql` with `select 1`. Expect a permission refusal, not an approval prompt.

### R85

**Outcome:** Every meaningful finding in `docs/era-research/` has one recorded disposition and the packs are linked from the PM index.

**Kind:** investigation
**Touches:** none

- **Source:** [Fable 2 finding F2-11](<../Fable 2/10 - Project Management/Portfolio/Research-to-Queue Leak.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** Starting from `docs/era-research/20-synthesis/`, each finding is marked incorporated into an existing ID, a new ID, a held decision, an unadopted option, disproved or superseded (`_Conventions.md` §8). The PM index links the packs. No implementation is started by this item.
- **Tier:** CLAUDE_HIGH, effort high. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Fourteen folders, 70 files. Use `triage-inbox` rules: preserve wording, search existing IDs first.

### R87

**Outcome:** Sprints never shows a week whose end date has passed as in play or planned.

**Kind:** bug
**Touches:** `scripts/pm/shared/planning.mjs`, `scripts/pm/planning.mjs`, `scripts/pm/app/Sprints.tsx`

- **Source:** [Fable 2 usability review U4](<../Fable 2/10 - Project Management/Command Center/1 - Usability and Visual Review.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** On 2026-11-10 the week of 2026-10-05 reads Closed with its real delivered count, and unfinished members appear in the current week or back in their lane. A fixture test covers a week ending yesterday.
- **Tier:** CLAUDE_MID. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** `_Planning.json` holds `sprint-2026-10-05` with `"state": "active"`.
- **Progress (2026-11-11, data only):** `sprint-2026-10-05` was closed through the planning engine (`writePlanningCommand`, action `close`): delivered R44; carryover SCH-7, SCH-4.2, R34, SCH-5.5. The seven stale drafts (weeks of 12 October to 23 November) were replaced by four current weeks, 9 November to 6 December (planning revision 9). Still open: the code change so an elapsed week never reads as in play, and its fixture test.
- **Progress (2026-11-12, data only):** the weeks of 23 and 30 November were re-drafted after DLV-150 to DLV-153 shipped on 2026-11-11, ahead of their planned week (planning revision 10). A draft still names its members by hand: the engine does not drop a member that ships before its week starts, which is the same defect this item fixes.

### R88

**Outcome:** `pnpm pm:check-docs` passes and runs on every push.

**Kind:** maintenance
**Touches:** `.github/workflows/ci.yml`

- **Source:** [Fable 2 finding F2-20](<../Fable 2/01 - Architecture/Agent Context Economy.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** The 17 broken links (15 in the Delivery book, 2 in `Plans/Delivery Optimization Closeout.md`) are either committed receipts or reworded as local-only evidence with no link. CI runs `pnpm pm:check-docs`. The check also fails when a research or plan document links an ID anchor that does not exist.
- **Tier:** CLAUDE_LOW. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** 58 distinct `.tmp/` paths are cited; `.tmp/` and `.delivery/` are gitignored.

### R83

**Outcome:** The repository has one proxy or middleware file that Next loads, or none that pretends to run.

**Kind:** bug
**Touches:** `proxy.ts`, `src/middleware.ts`

- **Source:** [Major Bug Sweep S3](<../Research/Major Bug Sweep.md#s3>) (2026-11-04: evidence, fix, test and UAT). Filed 2026-11-10; not started.
- **Acceptance:** Either one `src/proxy.ts` carries both the session refresh and the `/pm` gate, or root `proxy.ts` is deleted. The `/pm` gate still works. The owner decides which before work starts.
- **Tier:** CLAUDE_MID; owner decision first. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Next 16 loads only from the parent of the app directory (`src/`).

### R90

**Outcome:** A route that uses the service-role client cannot be added or changed without a declared, tested access rule.

**Kind:** feature
**Touches:** `src/app/api/`

- **Source:** [Fable 2 finding F2-14](<../Fable 2/03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** One table-driven test enumerates every route importing `supabaseAdmin` and fails when one is missing from the table. Each row declares public, owner only, owner or partner, or host of tag, and is exercised as anonymous, unrelated user and partner. First slice: the table plus five rows including the Guest Portal reads.
- **Tier:** CLAUDE_HIGH to design, CLAUDE_MID to fill. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** 43 routes outside `cron/`. Model: `src/features/era/artifacts.contract.test.ts`.

### R91

**Outcome:** The documented typecheck command works in cloud agent sessions.

**Kind:** maintenance
**Touches:** `package.json`

- **Source:** [Fable 2 finding F2-19](<../Fable 2/01 - Architecture/Verification Pyramid.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** `pnpm typecheck` exits 0 on a 4-core, 15 GB Linux container and still passes in CI. `.husky/pre-commit` is committed with the executable bit, so a commit on a Linux clone runs the hook (its `tsc` step needs the same heap setting).
- **Tier:** CLAUDE_LOW. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Plain `tsc` aborted with a heap error; with `--max-old-space-size=10240` it passed in 85 s.

### R82

**Outcome:** Readiness distinguishes setup blockers from checks not yet run.
**Kind:** bug
**Execution:** cli
**Implementation:** complete
**Touches:** `scripts/pm/app/LaunchReadiness.tsx`, `scripts/pm/app/readinessModel.ts`, `tests/pm-ui/launch-readiness.test.ts`, `tests/pm-ui/readiness.test.ts`

- **Acceptance:** Replace the pass ratio with blocker/pending counts. Pending live checks say Waiting for setup while setup blockers exist; request errors remain visible and do not display old checks as success. Docker failure says Start/restart Docker Desktop, because an open frontend does not prove engine health. Preserve server admission and explicit owner renewal.
- **Verification (2026-10-31):** 32 offline tests pass across launch-readiness, readiness, authorization and standing-policy suites; typecheck, scoped ESLint and PM build pass. Regression reproduces two blockers plus five pending checks. Browser inspection failed at Windows sandbox initialization; existing paired local access subsequently reproduced Check successfully. Operational sequence and limits are in the Pain Inventory above. Authorization renewed until 2026-11-01T16:13:15.570Z; scope derived in Kitchen's KIT-10 section. No new delivery or provider turn. Physical-phone/render verification remains untested.

### R81

**Outcome:** The owner finds delivery test steps by work ID directly from Delivery and sees whether they are ready for testing.
**Kind:** bug
**Implementation:** done
**UAT:** pending
**UAT instructions:** [PM-M15 walkthrough](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m15--find-test-steps-and-return-to-the-review-list>).
**Touches:** scripts/pm/app/{DeliveryHome.tsx,uatModel.ts,uat.css}, scripts/delivery-v2/uat-docs.mjs, tests/pm-ui/{delivery-recovery,uat-model}.test.ts, tests/delivery-v2/uat-docs.test.ts, docs/Delivery-UAT-{Legacy-Attempts,PM-Review,Schedule}-2026-10-25.md

- **Acceptance:** Review & sign off appears before delivery actions with To test / Not ready / Feedback / History / All, counts and ID/title/campaign search. Rows retain ID, title, recorded date, state and an action that opens the wizard. Draft/incomplete/stale records cannot masquerade as ready; completed/superseded/no-candidate records remain historical. Search, filter and loaded rows survive Back/reload; every retained record stays reachable beyond 50. Existing scenario imports contain an expected result for every step; refresh remains draft and does not create owner results, bind an unverified build, launch or Apply.
- **Verification (2026-10-25):** 379 tests pass across 46 PM UI/importer files; the six importer tests pass again after adding PM-M15. Typecheck, changed-source/test ESLint, PM lint/check-docs and Feature Index checks pass. Sixteen isolated Edge cases cover 320/390/701/1440 px, Blue/Pink, draft-only and ready records: visible entry, ID search, all 62 fixture records reachable beyond 50, draft result controls disabled, wizard/All steps, return and reload preserving search, zero overflow and zero POST/provider/operational requests. Evidence: `.tmp/pm-uat-discovery-20261025/verification.json` and viewport PNGs. Initial fixture failures were its wrong detail URL and selecting its intentionally incomplete sample; corrected to the real `uat?id=` route and a usable draft/ready sample. CUA could not start (trusted Node process exited), so the original browser and physical phone were not operated. Local JS/CSS assets return 200 and match the current source build. A guarded local draft refresh changed 13 incomplete handovers and added R80/R81, retaining 49 unchanged: all 64 are Draft/Pending, zero sign-offs or results recorded. Owner UAT remains pending.
- **Boundary:** this repairs discovery and draft wording; R79 still owns phone relay and lifecycle projections, DLV-146 owns worker handover generation, and readiness still requires a verified delivered build.

### R80

**Outcome:** Delivery retains work identity, reachable navigation and truthful, recoverable browser-session state.
**Kind:** bug
**Implementation:** done
**UAT:** pending
**UAT instructions:** [PM-M14 owner walkthrough](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m14--restore-delivery-identity-navigation-and-browser-access>).
**Touches:** scripts/pm/app/{App,PrimaryNavigation,BrowserSession,UatWizard,DeliveryHome,DeliveryV2,components,state}.tsx, scripts/pm/app/{transport,localTransport,model,deliveryHomeModel}.ts, scripts/pm/app/{navigation,delivery}.css, tests/pm-ui/{delivery-recovery,delivery-home,local-command-recovery,app-model}.test.ts

- **Acceptance:** Every V1/V2/UAT delivery row retains its canonical work ID when recorded; attempts carry their actual date. Secondary Activity/Decisions/Idea inbox/Documents remain accessible on desktop and phone. An unknown browser session offers Pair with the owner-run code command, without weakening authentication, marking the laptop offline or replaying writes. A late old-session refusal cannot revoke a newly paired session. Unavailable queue/session data never claims Nothing running; confirmed Apply actions stay visible. History is newest-first, reaches records beyond 50 and preserves filter/page/return context. Legacy acceptance does not invent application evidence.
- **Verification (2026-10-25):** 383 tests passed across 46 PM UI/relay files; typecheck and changed-file lint pass. Isolated real-component browser fixture: 32 passes at 320/390/701/1440 px × Blue/Pink × ready/initially-unpaired/revoked-session/queue-error, including one synthetic pairing request where required, zero protected reads before initial pairing, zero command replays, no overflow, 76-record pagination and navigation/filter return. Evidence: `.tmp/pm-delivery-recovery-20261025/verification.json`, source hashes/check summary in `validation.json` and viewport PNGs. Browser test helpers required two corrections (scoped evaluation variables and Boolean wait results) before the successful pass; application assertions were retained. Repo-wide `pnpm lint` failed while scanning generated `.tmp`/`.delivery` trees and existing debt; the task's generated JS/CSS assets were removed after QA and all changed application/test files pass scoped lint. No repository-wide clean claim.
- **Availability/limits:** primary source is updated; no supervisor restart, production mutation, launch, policy change, candidate Apply or deployment was performed. CUA could not start because of Windows sandbox initialization, so the original owner browser and physical phone were not operated. Pair that browser using the visible form and a fresh owner-issued code. R79 continues to own UAT phone transport and broader Done/Shipped projections.

### R79

**Outcome:** The phone relay carries UAT handovers, results and feedback, and Work, Sprints, Analytics and the archive Ship action distinguish engineering Done from owner-accepted Shipped.
**Kind:** feature
**Execution:** delivery
**Depends on:** PM Tooling/R76, PM Tooling/R78
**Touches:** `scripts/pm/bridge.mjs`, `scripts/pm/relay.mjs`, `scripts/pm/relay-shared.mjs`, `src/features/pm-live/relay/transport.ts`, `scripts/pm/shared/metrics.mjs`, `scripts/pm/archive.mjs`, `scripts/pm/app/Work.tsx`, `scripts/pm/app/AnalyticsOverview.tsx`, `scripts/pm/app/Sprints.tsx`

- **Acceptance:** `/pm/live` shows the same UAT read model and records the same commands (command ID = relay row ID) as desktop; any relay schema is an owner-run migration paired with `schema.sql`. Work > Done, Sprints and Analytics label a completed item **UAT unrecorded**, **Testing**, **Needs changes** or **Shipped** from the UAT projection; historical Shipped Logs stay dated engineering receipts and the `## Shipped Log` heading is unchanged. The Ship action and monthly sweep cannot present an item as Shipped without a valid sign-off; retained V1 UAT records are adapted without invented identities.
- **Not started:** spec §3 last paragraph, §6 phone paragraph and §9 *Projection and retention*.

### R78

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r78--uat-in-the-drive-mirror>)

**Outcome:** UAT status and handover documents reach the one-way Drive mirror, and the Delivery tab shows each finished delivery's acceptance state apart from engineering Done.
**Kind:** feature
**Execution:** delivery
**Depends on:** Delivery/DLV-145
**Touches:** `scripts/pm/drive-publish.mjs`, `scripts/pm-server.mjs`, `scripts/pm/app/DeliveryHome.tsx`, `scripts/pm/app/deliveryHomeModel.ts`, `ERA Notes/10 - Project Management/_Conventions.md`, `tests/pm-drive-publish.test.ts`

- **Acceptance:** `02 - Delivery Status/status.json` and `status.md` gain a UAT section (handover state, scenario counts, acceptance, unresolved feedback with its linked work ID, evidence time); each handover is also published as its own document and survives the rolling recent-run summary. Publication stays read-only and fails closed; a Drive edit never signs off or becomes feedback. The Delivery tab's Earlier deliveries rows show **Shipped**, **Testing**, **Needs changes**, **UAT unrecorded** or **No candidate**; a known pending test is never hidden when the queue fails to load. `_Conventions.md` states that Work **Done** is engineering and **Shipped** is owner sign-off.
- **Not claimed:** the phone, Work, Sprints and Analytics labels and Ship gating ([R79](#r79)).
- **Implementation:** done
- **UAT:** pending
- **Verification (2026-10-25):** `tests/pm-drive-publish.test.ts` (+5: UAT section and one retained document per handover without a local path, no rewrite until a record changes, a Drive edit never reaching the records and the edited document overwritten, last good section kept stale when the records cannot be read, drafts after real records and the 120 cap) with the existing 17 still passing, including the import and server-wiring isolation checks; `uat-model.test.ts` for the row labels. The mirror does not check whether a run's candidate has since changed (`candidate: "unchecked"`). Not run: a real publish to the Drive folder.

### R77

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r77--feedback-becomes-one-work-item>)

**Outcome:** A submitted **Needs changes** report becomes one linked, unchecked work item in its owning campaign on the next `pnpm pm`, with no agent started.
**Kind:** feature
**Execution:** delivery
**Depends on:** Delivery/DLV-145
**Touches:** `scripts/pm/uat-feedback.mjs`, `scripts/pm-server.mjs`, `package.json`, `tests/pm-uat-feedback.test.ts`
**Spec:** [Plans/Delivery UAT Sign-off and Feedback.md](<../Plans/Delivery UAT Sign-off and Feedback.md>) §5, §9

- **Acceptance:** at startup, after the corpus is readable, every submitted, unwithdrawn thread whose 2-minute Undo window has ended and which has no committed import is reconciled in thread order. The owning campaign comes from the delivery's work ID prefix; an unresolvable one stays **Import blocked** with its reason. One new ID is allocated above every active, archived and cancelled ID; a bug adds a checklist line (Next by default, Now only when the owner chose it), a `### ID` section carrying `**Source:** UAT feedback <thread>`, the verbatim sanitized observation, scenario/step, expected versus actual, build/device/date and a retest outcome, and a Pain Inventory line. An intent journal and file witnesses make a crash after either write, a second process, a double submit and a repeat startup converge on one item; an amended revision updates the same item; a withdrawn or cancelled mapping is never resurrected. Informational comments and unstarted tests create nothing. The receipt shows **Feedback saved** until the commit, then the work ID with **Open work**.
- **Not claimed:** merging into an existing item by owner direction and Undo of an edited or dispatched generated item (retained, owner resolves).
- **Implementation:** done
- **UAT:** pending
- **Verification (2026-10-25):** `tests/pm-uat-feedback.test.ts` (21: one item with feedback verbatim, Now vs Next, allocation above archived IDs per campaign including hyphenless R numbers and past heading slugs such as `SCH-3.1` vs `SCH-31`, Markdown and secret neutralizing, nothing for comments, withdrawn, resolved or in-window reports, blocked campaign, repeat startup, double submit, amendment, withdrawal after import, lost journal, a crash after the intent, after each file and before `committed`, an edit between planning and writing, a held lock); `lintChecklist` clean on the result. Isolated server: a Change submitted in the wizard became `SCH-31` on the next start (checklist row, book section with marker, journal intent then committed); that run showed the slug collision, now fixed. Not run: against the live corpus, two real PM processes, the monthly archive racing an import.

### R76

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r76--follow-resume-and-record-a-test>)

**Outcome:** The owner opens a delivery's **Test steps**, follows one numbered action at a time with its expected result, records Pass / Fail / Blocked, and signs off or submits **Needs changes** from the same screen.
**Kind:** feature
**Execution:** delivery
**Depends on:** Delivery/DLV-145
**Touches:** `scripts/pm/app/UatWizard.tsx`, `scripts/pm/app/uatModel.ts`, `scripts/pm/app/uat.css`, `scripts/pm/app/OutcomeReview.tsx`, `scripts/pm/app/DeliveryReview.tsx`, `scripts/pm/app/DeliveryHome.tsx`, `scripts/pm/app/deliveryHomeModel.ts`, `scripts/pm/app/App.tsx`, `scripts/pm/app/types.ts`, `scripts/pm/app/transport.ts`, `scripts/pm/app/localTransport.ts`, `scripts/pm/app/state.tsx`, `scripts/pm/app/responsive.css`, `src/features/pm-live/relay/transport.ts`, `tests/pm-ui/uat-model.test.ts`

- **Acceptance:** a finished delivery with a handover appears once under **Needs you** as **Test** with the attempt date; Outcome gains **Test steps** and an acceptance summary. The wizard shows a setup card, then one step at a time (action, expected, Back / Next, **All steps** list), a Pass / Fail / Blocked choice per scenario with one short feedback field for Fail / Blocked, and **Save** for partial progress; the draft survives reload and reads stale after a handover revision change. **Draft** and **Incomplete** handovers are labelled and cannot be signed. **Sign off** enables only when the server's gate has no blockers and lists them otherwise; **Needs changes** captures Bug / Change, pre-fills scenario, step and expected result, keeps screenshots and context under **Details**, and shows **Saving / Saved / Pending sync** with a retryable error and the same command ID on retry. Opening the wizard never launches, applies, calls a provider or changes application data. 390 px has no horizontal scroll; controls are keyboard-operable and labelled.
- **Not claimed:** the phone relay ([R79](#r79)).
- **Implementation:** done
- **UAT:** pending
- **Verification (2026-10-25):** `tests/pm-ui/uat-model.test.ts` (23: labels and grouping, a delivery listed once, step navigation, receipt wording, local drafts and pending commands without storage, the server-rendered wizard in each state, device label) and `delivery-home.test.ts`; typecheck, scoped ESLint and `pm:build-app` clean. Isolated Chrome at desktop and a 390 px iframe: no horizontal overflow in the wizard, All steps, the Fail note, the Needs-changes sheet and the Delivery list; every control at least 43 px. Fixed from that pass: the green chip's text was invisible; Draft handovers offered result buttons. Not exercised: keyboard-only and screen-reader operation (labels and focus order are in the markup only), reduced motion (CSS rule only), two themes, the Outcome-tab row, the phone.

### R69

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m10--navigate-home-search-and-analytics>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**Outcome:** Make Home, Work, Analytics and Delivery questions easier to use on desktop and phone while preserving shipped execution behavior.
**Kind:** feature
**Touches:** `scripts/pm/app/`, `tests/pm-ui/`, `ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md`, `ERA Notes/04 - UI & Design/Page & Feature Atlas/pm-live.md`, `ERA Notes/04 - UI & Design/App Routes and Icons.md`

- **Acceptance:** the header uses `ERAMark`'s Memory face. Home has visible module cards and Now / Up next / Waiting / Someday cards leading into Work, plus A place to begin. Analytics appears in desktop and phone navigation; old `#/dashboard` links still open it. In focus and daily shipped-record counts use the same filtered corpus as the existing detailed metrics, and a selected day exposes its actual receipts without treating records as unique completed items. Work and What's next show source IDs. Search text and applicable filters survive To do / Done and layout changes; completed search can reveal matching history. Delivery options render only from explicit supplied text; marked recommendations appear first, selection fills an editable answer, and Send retains the original revision-bound answer command.
- **Boundary:** no Delivery worker prompt, protocol, contract, job, execution policy, relay schema, approval, verification or Apply behavior changed. No provider run, real answer command, deployment or production write belongs to this implementation.
- **Question limitation / suggestion only:** current Delivery questions retain `text` and `blocking`, not structured choices or a recommendation. Unambiguous option lists in the supplied text can be displayed; freeform/ambiguous questions remain editable text. Guaranteeing two or three AI-supplied choices with a recommendation requires a separately reviewed prompt/protocol change. It is not implemented or authorized by R69.
- **Verification (2026-09-26):** `pnpm exec vitest run tests/pm-ui` passed all 200 tests in 29 files, including React/classic/static builds (esbuild required a permitted sandbox escalation for directory access). Changed-file ESLint and an isolated typecheck of `scripts/pm/app/` passed. Synthetic Chromium exercised 1440/390/320 px in Blue and Pink: 108 checks passed, no runtime errors or page overflow; Home queues/spaces, visible IDs, retained search through status/layout changes, mobile queue-to-Board columns, Analytics campaign/daily-receipt drilldowns and old dashboard links, and recommended-first question selection were verified. Selecting an answer sends nothing; explicit Send retained the existing payload. Browser artifacts: `.tmp/pm-ui-polish/browser-report.json`, `followup-report.json` and screenshots. PM lint, documentation governance and Feature Map checks passed (one existing empty Delivery Next-lane warning). Full `pnpm lint` found one pre-existing error in `.tmp/kit11-checker-candidate/src/app/api/recipes/[id]/cooking-log/route.ts:124` (`no-explicit-any`) plus 928 warnings; the changed production files pass scoped lint. Repository typecheck remains blocked by unrelated Activity Log `TS2737` at `src/features/activity-log/types.ts:16`. Existing Delivery journey tests passed 47 cases (including answer revision/idempotency and build-question continuation), with two unrelated retained-checker-output expectation failures in tests that do not import the UI. No live provider run, delivery mutation, deployment or physical-phone UAT was performed.

### R66

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m1--find-a-delivery-and-read-it-on-both-screens>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**Outcome:** Make Delivery launch and review read as a production application.
**Kind:** bug
**Touches:** `scripts/pm/app/App.tsx`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/DeliveryReview.tsx`, `scripts/pm/app/deliveryReviewModel.ts`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/delivery.css`, `scripts/pm/app/delivery-review.css`, `tests/pm-ui/`

- **Acceptance:** launch shows only executor, lane, model, effort and an actionable blocker when needed; unavailable executor details state one real cause and offer Retry. Review order is Plan → Verification → Activity → Changes. Plan places artifacts beside the plan on desktop and renders Risks/Unknowns as major visible sections. Current/previous verification, application history, token use versus threshold and useful run facts are readable without opening disclosures. No slogan/reference footer or retained-output implementation prose appears. The same hierarchy stacks without horizontal overflow on phone.
- **Verification (2026-09-15):** targeted PM/coordination tests cover tab order, readable verification history, quiet token comparison and executor cause mapping; React bundle, typecheck and changed-file lint passed. Browser connection was unavailable, so visual desktop/phone UAT remains pending in `docs/Delivery-UAT.md`.

### R65

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m9--find-completed-work-without-delivering-it-again>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

- **Verification (2026-09-15):** 800 tests passed across 55 PM/Delivery/relay/V1-route files; four opt-in Docker cases skipped. Typecheck and changed-file ESLint passed. Isolated Chromium used 22 actual campaign documents and synthetic sessions: 28 observations at 320/390/1440 px, Blue/Pink, Done search/detail, UAT-pending badge, actionable Deliver, refused old launch links, excluded owner checks and retained attempt navigation; zero runtime exceptions or horizontal page overflow. Evidence: `.tmp/work-lifecycle/`. No provider dispatch, production DB write or deployment.

**Outcome:** Keep actionable Delivery work separate from Done and owner UAT.
**Kind:** bug
**Touches:** `scripts/pm/`, `scripts/delivery-v2/work-ref.mjs`, `scripts/delivery/server-routes.mjs`, `tests/pm-ui/`, `tests/delivery-v2/`

- **Cause:** acceptance-held checklist rows presented completed implementation as open work; direct launches lacked a lifecycle guard and swept work lost its detail page.
- **Acceptance:** owner-only checks stay in UAT; Work has searchable Done outcomes with scope/receipt/session history; completed/owner/noncanonical sources cannot launch through UI or either backend. Pending engineering remains explicit and reopening does not fabricate acceptance.

### R64

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m1--find-a-delivery-and-read-it-on-both-screens>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Responsive Delivery review workspace implemented and browser-verified at 320 through 1920 px; physical-phone UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

- **2026-09-15 implementation:** shared Delivery review tabs and URL state, responsive cards and typography, compact phone header, plan.md reader/export, latest-check grouping, frozen diff reader and Radix rollback dialog with focus return. `DeliveryReview.tsx`, `deliveryReviewModel.ts`, `delivery-review.css` are the presentation seams. [Request trace](<../../../docs/Delivery-Requests.md>) and [UAT](<../../../docs/Delivery-UAT.md>) preserve the owner's requested evidence. Chromium synthetic walkthrough: 320/390/430/768/1440/1920px, Blue/Pink, 16px body, no page overflow, tab keyboard/reload, 30-step plan and reader/rollback focus. Physical phone relay, mobile OS keyboard and native 200% browser zoom remain owner UAT; 720px reflow was emulated. R64 implementation is Done; those device checks are pending in the UAT and do not create another Delivery task.

**Outcome:** Make Delivery readable and usable on desktop and phone.

**Kind:** feature
**Touches:** `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/delivery.css`, `scripts/pm/app/responsive.css`, `scripts/pm/app/styles.css`, `scripts/pm/app/components.tsx`, `scripts/pm/app/types.ts`, `tests/pm-ui/`

- **Acceptance:** implement [hotfix §4 and packet G](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>): purposeful Plan/Changes/Checks/Activity views, persistent current outcome/usage, readable desktop width and one-column phone behavior; body/input 16px, control text at least 14px, metadata at least 12px and 44px touch actions. Full plan/approval and rollback confirmation remain owned by DLV-116/115; do not duplicate their backend scope. Test 320/390/430/768/1440/1920px, 200% zoom, keyboard/focus, mobile keyboard/safe areas, theme contrast and no page overflow. Logs and engineering rationale remain disclosed, not inline product essays.
- **Evidence boundary:** CSS/source and owner's report establish the problem; no available browser was connected in the planning audit. Capture actual desktop and phone evidence before claiming acceptance.

### R61

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m11--edit-a-sprint-and-keep-its-identity-across-devices>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Outcome:** Plan sprints, deliverables and readiness over the same work.

**Implementation:** done

**UAT:** pending

**Final verification (2026-10-03):** 382 affected tests pass; changed-file lint, typecheck and build pass. Readiness includes dependencies declared in embedded JSON execution plans: 224 open items comprise 52 Ready, 38 Needs input and 134 Blocked. These are planning classifications, not executor qualification. Planning revision 4 has eight draft weeks, 25 references and 42 known points. HUB-43 remains blocked by HUB-38/HUB-42 and is excluded; HUB-59 moves to week 5. HUB-64 in week 8 is conditional on week 5's HUB-47; membership does not make it Ready. Final Chromium fixture verification passes at 1440/820/700/390/320 px in both themes, covering edits/Undo, start, Delivery navigation, live status, scope restoration, close/carryover, replan, overlap refusal, append weeks, Analytics and reduced motion with no overflow or page errors. Physical-phone UAT remains Pending. Repository-wide lint is blocked by one unrelated temporary recipe fixture error; changed-file lint is clean.

**Implemented 2026-10-03:** `Sprints.tsx`, `sprintModel.ts`, the revisioned `_Planning.json` contract and shared metrics provide the accepted weekly flow. Fixtures cover stale plan revisions and acceptance witnesses, idempotent retries, native crash-lock recovery, cancellation versus delivery, removed/re-added scope, missing references, conditional prerequisites, capacity, carryover, CLI observations and frozen close outcomes. Browser fixtures exercised Edit/Undo, Start, Delivery entry, active/review/done states, Close with carryover, alternative forecast selection and Analytics table. Desktop/mobile viewports and both themes pass; actual phone relay/deployment remain owner UAT. Migration `2026-10-03_pm-sprint-planning-relay.sql` is **written, not applied**. Current-source readiness reads the complete ID section; `portfolio.contract` can end at Provenance and must not be treated as the full lifecycle/readiness witness. Observation files live under root `.pm/`, never in GET/buildWorld. Existing September planning instructions below are historical and must not cause this feature to be built again.

- **Acceptance:** Command Center Phase 2. A validated, revisioned `_Planning.json` (references and planning facts, never copied titles, acceptance, checkbox state or lanes) supports draft/start/close sprints, relative and owner-review capacity, deliverables and Ready / Needs input / Blocked readiness. The same item moves on the board, joins a sprint, completes through the CLI and updates every view once; cancellation reduces remaining work without adding delivered work; a criteria edit invalidates its readiness witness; overcapacity and unestimated work are visible; a conditional dependency can be planned but cannot launch early; concurrent stale edits to `_Planning.json` conflict instead of overwriting.
- **Depends on:** [R60](<../_Archive/Shipped/PM Tooling.md#r60>).
- **Delivery Phase 5 note (2026-09-12):** parallel coordination landed before this item ([Delivery/DLV-106](<../Delivery/Delivery — Master Book.md#dlv-106>)). "Can it run now?" should call `scripts/delivery-v2/coordination.mjs` (`itemReasons`, `coordinate`) rather than restate prerequisite and scope rules. Prerequisites and `**Touches:**` are read through `scripts/pm/shared/declarations.mjs`. No sprint view shows parallel verdicts yet.
- **Provenance:** [Command Center Phase 2](<../Plans/Command Center.md#phase-2--add-practical-sprints-deliverables-and-readiness>).
- **Reading guide (updated 2026-10-03):** use the PM Feature Map's weekly-sprint entry. `planning.mjs` owns source facts/authenticated writes/observations; `shared/planning.mjs` owns validation and transitions; `sprintModel.ts` owns forecast and item status; `metrics.mjs#sprintProgress` owns reconciled charts. Planning never authorizes a worker; normal Delivery still decides dispatch. Dates are calendar dates plus an IANA timezone; actual command and observation events are UTC instants.

**Execution plan — 2026-09-26**

**Readiness:** Split first; first slice is the planning data contract.

**Verify:** Add fixtures for stale revision conflict, missing item, cancellation, readiness invalidation and capacity units; reuse tests/pm-ui/metrics.test.ts. Then exercise one item across board, sprint and CLI completion.

```delivery-plan-v1
{
  "outcome": "Add sprint planning over canonical work identities without duplicating backlog state.",
  "acceptance": [
    "Stale planning writes conflict and changed criteria invalidate readiness.",
    "Cancellation reduces remaining work without counting as delivered."
  ],
  "scope": [
    "scripts/pm/shared/",
    "scripts/pm/mutations.mjs",
    "scripts/pm/write-guards.mjs",
    "scripts/pm/app/",
    "scripts/pm-server.mjs",
    "tests/pm-ui/"
  ],
  "steps": [
    "First slice: specify a versioned references-only planning schema and proposed _Planning.json storage with revision-checked writes; extend the approved footprint before creating it.",
    "Second slice: derive readiness through declarations and existing coordination rules; bind witnesses to current criteria.",
    "Third slice: draft/start/close sprints, capacity and deliverable views over the same IDs.",
    "Verify CLI completion, cancellation and moved items update all derived views without copied titles, lanes or checkboxes."
  ],
  "invariants": [
    "Checklists remain the task store.",
    "Planning readiness does not grant dispatch permission."
  ],
  "exclusions": [
    "A second backlog or duplicated dependency evaluator."
  ],
  "checks": [],
  "risks": [
    "One large dispatch would mix persistence, readiness and UI verification."
  ],
  "unknowns": [
    "Exact planning schema and capacity representation require a bounded design slice."
  ],
  "dependencies": [
    "R60; verify its shipped evidence."
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted Command Center contract and existing reading guide reviewed; planned file is explicitly new, not an existing API."
}
```

### R62

**Remaining engineering (2026-10-03):** comparable-run charts once owner trial data exists. R61 delivered sprint scope/progress charts and tables; existing core metrics/history parser are implemented. Do not recreate them.

**Outcome:** Add sprint and comparable-run metrics.

- **Acceptance:** Command Center Phase 6 metric contract: one history parser shared locally and by the relay; open work, completed/cancelled outcomes, bugs by explicit kind, sprint scope and delivery outcomes follow the plan's definitions; chart totals reconcile to their drilldowns; incomplete historical coverage is visible; no project percentage or fabricated dates.
- **Depends on:** [R60](<../_Archive/Shipped/PM Tooling.md#r60>) for current metrics; sprint charts need [R61](<#r61>); delivery comparisons need [Delivery/DLV-102](<../Delivery/Delivery — Master Book.md#dlv-102>) receipts.
- **Implemented (2026-09-12) — Phase 6a current-state metrics:**
  - *One parser:* `scripts/pm/shared/history.mjs`. Records are bullets in a campaign's `## Shipped Log` (✅) or its Cancelled Log section (❌) only; Pain Inventory, session logs, fences and prose are not records, and other lines in those sections are returned as notes. Identity is `exact` (one canonical ID, optionally `: title` or a non-partial `(alias)`), `referenced` (pairs, ranges, partials, follow-ups) or `unidentified`. Dates are `day`, same-month `range` or `unrecorded`. `shared/product.mjs#parseOutcomes` (React app locally and on `/pm/live`, classic build) and `bridge.mjs#createHistorySnapshotBuilder` (legacy phone row) both call it; the legacy row no longer counts Pain Inventory, session-log or table stamps and sets `idChip` only for exact receipts. `shared/portfolio.mjs` treats a prerequisite as shipped only from an exact receipt.
  - *Metric contract:* `scripts/pm/shared/metrics.mjs` — `openWork` (distinct WorkRefs; blocked separate; the Board's lane rule), `workOutcomes` (latest dated receipt per exact ID, repeats kept, an open ID is Reopened, a ticked unswept row is completed without a date), `outcomeSeries` (Monday weeks; buckets + undated + earlier + later = total), `bugs` (declared `**Kind:** bug` only, by severity), `sprintProgress` (unavailable without planning), `deliveryAttempts` (V1 SHIPPED = Accepted with disposition unrecorded; V2 outcome from `closed_outcome`; verified candidate and applied change as reached levels), `resourceRows` (estimate, tokens and settled amount per unit, with known/total), `historyCoverage`. V2 run summaries carry `resources` (`journey.mjs#resourceBrief`), so the relay row has them too.
  - *Dashboard:* `scripts/pm/app/Dashboard.tsx` + `dashboard.css`, route `#/dashboard`, linked from Home. Filters and selection round-trip through the URL (`model.ts#parseDashboardQuery`). Tiles; open work stacked by priority, each segment opening its Board lane; weekly completed/cancelled columns with Undated, Earlier and No exact ID, drilling into the counted records and their source; bugs by severity; V1/V2 attempts as small multiples; resources table; history coverage with notes. Every chart has a Table toggle with totals; captions are for assistive technology only (Hard Rule 28). Colors: a validated one-hue ordinal ramp per theme for priority and a validated categorical pair for completed/cancelled.
  - *Extraction for R6:* `product.js` and `portfolio.js` now live in `scripts/pm/shared/`; the classic `src/lib/` files re-export them, and the React app, bridge and relay no longer import the classic namespace.
- **Verified (2026-09-12):** `tests/pm-ui/metrics.test.ts` (12: identity and date rules, section scoping, dedup/reopened/unswept outcomes, weekly reconciliation with no placed record outside its stated week, Board reconciliation for every campaign and lane, explicit bugs, attempts never changing work outcomes, unit separation and coverage, URL round-trip, identical metrics from a relay-assembled corpus, and a read-only live-corpus reconciliation at 8/16/26/all weeks); updated `tests/pm-bridge.test.ts` history cases. `tests/pm-ui` 145/145 in 24 files including the React, classic and static builds; delivery-v2 and relay suites 565 passed with 4 opt-in skipped; `pnpm typecheck` exit 0; ESLint on every changed file clean. **Live corpus (read-only):** 240 open (28 Now / 86 Next / 126 Later), 83 blocked, no duplicate IDs; 262 history records — 169 exact, 15 referenced, 78 unidentified; 260 dated to a day, 1 range, 1 undated; 3 notes; 167 completed exact IDs, 1 cancelled, 93 records without an exact ID, 1 Reopened (HUB-23, Pain Inventory); `**Kind:**` declared on 0 of 240 open items. **Rendered:** the real bundle over the live corpus and local V1 sessions in headless Edge with device-metric emulation at 1280, 390 and 320 px (Blue) and 390 px (Pink): no horizontal overflow and no control under 24 px; at 390 px the busiest week (Jul 27: 52 completed, 1 cancelled, 5 without an exact ID) drilled into 52, 1 and 5 listed records, and the table footers matched the tiles (240, 167, 1). The V2 panel was rendered only from synthetic runs.
- **Pending:** a sprint scope chart (R61 has no planning file); delivery and resource comparisons from real runs ([Delivery/DLV-102](<../Delivery/Delivery — Master Book.md#dlv-102>): no V2 run exists); a non-empty bug chart needs owner-declared kinds; a live relay read of the Dashboard on a real phone (parity is fixture-level); `next build` was not rerun after adding the dashboard stylesheet import to `CommandCenterLive.tsx`.
- **Provenance:** [Command Center Phase 6](<../Plans/Command Center.md#phase-6--finish-the-dashboard-calibrate-value-and-retire-duplication>).
- **Reading guide:** Current metrics/history are implemented. Reuse `scripts/pm/shared/metrics.mjs`, `history.mjs`, `scripts/pm/app/Dashboard.tsx` and shared relay projections. R61 supplies the missing planning contract for sprint charts; DLV-102/118 must establish comparable trial evidence for run charts. September 26 KIT-11 receipts supersede old statements that no V2 run exists, but run existence alone does not prove a fair comparison. Keep unknown units/coverage visible and reconcile every chart to its drilldown; no project percentage or inferred bug kinds.

**Execution plan — 2026-09-26**

**Readiness:** Split first; add only the remaining sprint/comparison metrics.

**Verify:** Extend tests/pm-ui/metrics.test.ts and portfolio.test.ts: cancelled versus delivered, changing sprint scope, missing estimates, incomparable attempts and unknown usage; totals must reconcile to exact drilldown rows.

```delivery-plan-v1
{
  "outcome": "Extend the implemented metric contract with truthful sprint and comparable-run views.",
  "acceptance": [
    "Charts reconcile to their counted records.",
    "Missing dates, attribution or comparable receipts remain visible gaps."
  ],
  "scope": [
    "scripts/pm/shared/metrics.mjs",
    "scripts/pm/app/Dashboard.tsx",
    "scripts/pm/app/dashboard.css",
    "scripts/pm/relay-shared.mjs",
    "tests/pm-ui/metrics.test.ts",
    "tests/pm-ui/portfolio.test.ts"
  ],
  "steps": [
    "Read current R61 planning schema and DLV-102/118 receipts; do not rebuild the shipped history parser or basic dashboard.",
    "First slice: derive sprint scope/progress from reference-only planning, preserving additions, removals, cancellation and unknown estimates.",
    "Second slice: compare only runs with compatible task/acceptance and explicit usage units; show incomplete evidence as unavailable.",
    "Render drilldowns and tables through the existing metric/transport seam; verify local/relay parity and mobile layouts."
  ],
  "invariants": [
    "Attempts, work outcomes and candidate/application states never share a count.",
    "Cache/reasoning subsets are not added again to token totals."
  ],
  "exclusions": [
    "A project percent-complete score or retrospective invented baseline."
  ],
  "checks": [],
  "risks": [
    "Existing real KIT-11 runs do not automatically form a fair comparison."
  ],
  "unknowns": [
    "R61 planning contract and validated comparable trial receipts."
  ],
  "dependencies": [
    "R60",
    "R61",
    "DLV-102"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Implemented metric contract and dated trial updates reviewed; the old assertion that no V2 run exists is historical."
}
```

### R63

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m7--open-the-same-delivery-on-a-phone-and-recover-connection-state>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Shared Command Center views mounted on the phone relay through the transport seam; owner deployment/device acceptance pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Serve the shared Command Center views on the phone.

- **HELD — Delivery/DLV-97, phone acceptance.**
- **Acceptance:** Command Center Phase 4 presentation: `/pm/live` mounts the primary React views through a transport interface (local server or authenticated relay) instead of a third UI; shared components drop local-only URL and permission assumptions; static export stays read-only. Real 390 px phone/PWA acceptance is owner-observed. Command/cache recovery is [Delivery/DLV-104](<../Delivery/Delivery — Master Book.md#dlv-104>); [R42](<#r42>) keeps its device checks.
- **Implementation landed (2026-09-12); acceptance outstanding.** `scripts/pm/app/transport.ts` defines the seam (snapshot and source reads, V1 runs, dispatch mode, capability flags, V2 session/runs/run/executors, versioned V2 commands, live events, connection state) and `PendingCommand`, so a command without a final receipt renders as `Not acknowledged` / `Acknowledged` / `Outcome unknown` with Check (same id), never as a failure. `localTransport.ts` holds the requests the app always made; `api.ts` and `state.tsx` delegate; `CommandCenter.tsx` is what both shells mount (`main.tsx` locally; `src/app/pm/live/CommandCenterEntry.tsx` → `CommandCenterLive.tsx` on the phone, CSS loaded only with that chunk). Capability gates: Work Organize and Board moves (`planWrites`), V1 launch (`v1Launch`) and V1 session detail (`v1Detail`, which links to the legacy view), pairing (`pairing`), classic links (`referenceTools`), Apply (`apply`). `DeliveryV2.tsx` gains the Apply panel (Apply / Resume / Recheck / Roll back, conflicts, written/not written/changed since, integrated checks) and sends `contract_revision` with plan decisions; `App.tsx` shows the relay strip. PWA shortcuts now open `#/explore?view=board` and `#/delivery`. **Evidence:** pm-ui, relay and delivery suites in the 1961-test finish gate; typecheck, ESLint and `next build` (Turbopack) clean with `/pm/live` compiled; both local builds via `tests/pm-ui`. Synthetic render (headless Edge, same-origin iframes at true 390 and 320 px, relay capabilities, real PM corpus, synthetic V2 run): Home, Delivery, the Run view with the Apply panel, a pending Apply showing `Acknowledged · Check`, and a Work item — no horizontal overflow, relay strip present, no Organize control and no classic links. **Not evidenced:** a real phone or installed PWA, a live relay read or command, swipe/haptics (R42), theme interplay with the household ThemeProvider on the deployed route.
- **Provenance:** [Command Center Phase 4](<../Plans/Command Center.md#phase-4--deliver-the-same-workflow-from-the-phone>).

### R55

**Remaining engineering (2026-09-15):** complete attempt pagination/filter retention, retry ancestry and active V2 activity on Home. Stable Work history and Done-item links exist; do not rebuild them.

**Outcome:** Page and filter Delivery history across Work and Home.

- **2026-09-14 scope:** fixture-backed presentation work is ready under the owner's hotfix commission; further native trials await the resource gates in Delivery DLV-114/119 and existing DLV-97 acceptance. Earlier qualification holds below describe the pre-trial state.
**Kind:** feature
**Touches:** `scripts/pm/app/Work.tsx`, `scripts/pm/app/Home.tsx`, `scripts/pm/app/Delivery.tsx`, `scripts/pm/app/state.tsx`, `scripts/pm/app/model.ts`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/types.ts`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/pm/relay-shared.mjs`, `src/features/pm-live/relay/`, `tests/pm-ui/`, `tests/delivery-v2/`
- **Hotfix acceptance:** [packet G](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>) adds visible permanent history keyed by stable work identity for active, failed, cancelled, verified, applied and rolled-back attempts, including moved/shipped/discarded items. Separate attempt number from plan revision, candidate generation, Result version and application events. Retain explicit retry ancestry, exact deep links and originating filters through Back/Forward/reload/second-tab/offline views. Native observations and application state remain authoritative; no invented successful job or removed runtime history. Verify local/relay parity and retain V1 receipts.
- **Acceptance:** once qualification and dispatch policy are accepted, map the canonical V2 job lifecycle, executor identity, refusal reasons, check evidence and Result disposition into the run and outcome views. Use V2 routes and preserve admission/approval/evidence boundaries; never fall back to V1 or invent a running job after admission. Verify real event shapes with fixture and admitted pilot evidence. Reuse the R54 layout and keep V1 history readable.
- **Command Center mapping (2026-09-11):** Phase 3 connects the canonical V2 list/detail/events/decision/control/result projections to Delivery and Run here, including per-run executor, model and effort.
- **Review delta (2026-09-13):** `scripts/pm/app/state.tsx:143` / `:181` expose only V1 sessions through `useWorld().runs`; `Home.tsx:15`, `model.ts:129` and WorkView's `runFor` consume them. `Delivery.tsx` separately queries V2. Acceptance must also cover Home/attention and Work's Follow delivery action for an active or review-waiting V2 run, locally and over relay, with stable campaign/item identity and no duplicate display beside V1 history. Source-verified gap; no real V2 session exists to provide device evidence.
- **Phase 3 presentation landed (2026-09-12), acceptance still held:** `scripts/pm/app/DeliveryV2.tsx` + `v2model.ts` read `journey.mjs` projections over paired-session routes (`api.ts` `v2Read`/`v2Post` send `x-era-csrf`; command ids minted per intent and reused on retry). Launch in v2 mode offers Claude/Codex with a one-word refusal when unqualified/unpermitted, Focused/Investigate, catalog model and SDK-supported effort; `#/delivery/run/<id>` shows the stage projection, blocking questions and plan Approve/Revise above activity, observed agents only, “Not tested” for zero-test checks, Result obligations, unknown cost as “Unknown”, guidance receipts and Pause/Resume/Stop/Reconcile/Retry writeback. The Delivery list shows V2 runs beside V1 sessions with explicit engine labels (`V1 ·` / `V2 ·`); V1 views are unchanged. Evidence: `tests/pm-ui/delivery-v2-model.test.ts` (8), pm-ui 128/128 incl. both builds, typecheck and ESLint clean; in a real browser against a synthetic fixture server (real bundle, V2 routes and journey; scripted executors), pairing by code loaded the run, and `#/delivery`, both run states and `#/deliver/Budget/BUD-14` had no horizontal overflow or sub-36 px controls at 390 and 320 px (same-origin iframe probe; window resizing had no effect, as in R60). **Not yet evidenced:** real event shapes from an admitted pilot (none can run until DLV-96/97 qualify an executor), phone/PWA. See [Delivery DLV-97](<../Delivery/Delivery — Master Book.md#dlv-97>).
- **Provenance:** R54 product implementation exposed this dependency; dispatch/qualification remain owned by Delivery.
- **Reading guide:** Stable Work history and Done-item links already exist. Start with `scripts/pm/app/Work.tsx`, `Home.tsx`, `Delivery.tsx`, `model.ts` and `state.tsx`; then trace the current V2 list through `journey.mjs`/`store.mjs`. Remaining scope includes paging/filter retention, retry ancestry and active V2 Home attention, not paging alone. Coordinate pagination with DLV-121 and verify identical projections through `relay-shared.mjs` and the phone transport. Use synthetic evidence for implementation; admitted pilot and device acceptance remain separate.

**Execution plan — 2026-09-26**

**Readiness:** Split first; retain the existing history foundation.

**Verify:** `pnpm exec vitest run tests/pm-ui/delivery-v2-model.test.ts tests/pm-ui/session-model.test.ts`; extend with paging, stale/offline navigation, retry ancestry and relay fixtures; desktop and 390px fixture walkthrough.

```delivery-plan-v1
{
  "outcome": "Finish filtered attempt history and active V2 visibility across Work and Home.",
  "acceptance": [
    "History remains reachable for active, shipped and discarded work.",
    "Filters, ancestry and active state agree across local and phone views."
  ],
  "scope": [
    "scripts/pm/app/",
    "scripts/delivery-v2/journey.mjs",
    "scripts/delivery-v2/store.mjs",
    "scripts/pm/relay-shared.mjs",
    "src/features/pm-live/relay/",
    "tests/pm-ui/",
    "tests/delivery-v2/"
  ],
  "steps": [
    "Revalidate existing stable work history and current list projections; pin one shared pagination contract with DLV-121.",
    "First slice: paginated attempts with URL-retained filters and Back/Forward/reload behavior.",
    "Second slice: explicit retry ancestry and active V2 attention on Home, preserving exact work identity after shipping or moving.",
    "Exercise the same fixtures through local and relay transports; retain V1 receipts and unknown runtime states."
  ],
  "invariants": [
    "Attempt number, plan revision, candidate generation and application are distinct.",
    "Only observed runtime facts produce active or successful states."
  ],
  "exclusions": [
    "New dispatch behavior, a second history store or live provider trials."
  ],
  "checks": [],
  "risks": [
    "Large history payloads and stale filters can hide the selected attempt."
  ],
  "unknowns": [
    "Current paging contract after recent PM/Delivery commits."
  ],
  "dependencies": [
    "Coordinate shared pagination with DLV-121."
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Current acceptance reconciled with later shipped foundations; PM/Delivery paths changed extensively since the book baseline."
}
```

### R43

**Outcome:** Verify hot-child RLS and read contracts.

- **Acceptance:** Verify current hot-child RLS and read-path contracts before deciding whether Hard Rule 20 needs any amendment or DB change. schema.sql alone cannot establish the policy state; no guessed denormalization or policy rewrite.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Evidence-gathering, not code. Hard Rule #27 governs the whole item: **`migrations/db-state.json` is the only repo artifact permitted as evidence about RLS** — generated by the owner running `migrations/db-state.sql`, validated by `pnpm db:verify-rls`, and reported on by the SessionStart hook `.claude/hooks/session-brief.sh`. `schema.sql` is tables-only and has actively lied here before. The hot child tables Hard Rule #20 names are `item_alerts`, `item_subtasks`, `reminder_details`, `event_details`, `item_recurrence_rules`, `recurrence_pauses`; the two sanctioned patterns are a SECURITY DEFINER bundle RPC (`get_schedule_bundle`, `get_health_bundle`, `get_household_allergens` are the live examples) or a denormalized `user_id` with a direct policy. Read the bundle read paths in `src/app/api/` that consume them before proposing any amendment. No policy rewrite and no denormalization on a guess.

**Execution plan — 2026-09-26**

**Readiness:** Owner evidence first; read-only investigation.

**Verify:** `pnpm db:verify-rls`; inspect its freshness findings, not only exit status. Compare all six child tables with their actual bundle consumers; record policy bodies and unresolved gaps.

```delivery-plan-v1
{
  "outcome": "Establish the current hot-child access and read contract before proposing changes.",
  "acceptance": [
    "Every named table has dated access-path evidence or an explicit unknown.",
    "No rule amendment relies on schema.sql as policy evidence."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md"
  ],
  "steps": [
    "Request a fresh owner export from migrations/db-state.sql; the committed August 4 snapshot is historical.",
    "Map item_alerts, item_subtasks, reminder_details, event_details, item_recurrence_rules and recurrence_pauses to consuming routes and bundle RPCs.",
    "Compare direct policy predicates, SECURITY DEFINER ownership and caller filtering against Hard Rules 20/21.",
    "Record dated findings and a separately scoped remedy only where current evidence proves a gap."
  ],
  "invariants": [
    "Agents do not query or modify production.",
    "A fast bundle still requires a correct household predicate."
  ],
  "exclusions": [
    "Policy rewrites, denormalization and performance claims without measurements."
  ],
  "checks": [],
  "risks": [
    "Historical policy evidence can misdiagnose correct application code."
  ],
  "unknowns": [
    "Current owner-supplied policy and function export."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Snapshot freshness, validator and session hook inspected; current DB state unverified."
}
```

### R44

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#v2-44--review-the-raw-fetch-guard>) (drafted 2026-10-25; original results retained).

**Outcome:** Guard new client mutations against raw fetch.
**Touches:** `eslint.config.mjs`, `tests/pm-ui/raw-fetch-guard.test.ts`

**2026-10-24 integrated evidence:** owner applied run `r-46688acd1b86`, C1 / Result `res-a20e5a5a072c@1`; application `app-497cee609b88` is terminal Applied at 14:23:46.583Z with both protected checks satisfied. Direct C1 fixture execution then exposed five repeated ESLint-startup timeouts. The separately authorized local post-Apply repair amortizes the same real CLI over the five fixtures without weakening assertions/deadlines; frozen C1 and receipts remain unchanged. Final relevant aggregate: 1,395 passed, eight existing opt-in skips; final fixture 5/5, typecheck/scoped lint/PM build pass. The local test deliberately differs from C1; owner review and physical-phone UAT/sign-off remain pending. [Hashes, original failures, exact identities and acceptance limits](<../../../docs/R44-Delivery-Acceptance-2026-10-24.md#owner-apply-and-final-integrated-validation---2026-10-24>). R44 is not marked accepted by this evidence.

- **Acceptance:** *(hygiene packet **H-02** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>))* Add an eslint guard for Hard Rule 6 so no *new* raw mutating `fetch()` can enter client code — a `no-restricted-syntax` rule scoped to the client directories (components, features, hooks, contexts), warn-level until the existing 98 sites are burned down → `eslint.config.mjs`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Start with `eslint.config.mjs` and its flat-config override pattern; `src/lib/safeFetch.ts` defines the sanctioned mutation behavior. Add a warning scoped to client directories and cover literal mutating methods with actual ESLint fixtures. Correction (2026-09-26): `tests/pm-ui/lint-rules.test.ts` tests PM checklist grammar, not ESLint rules; do not add JavaScript-rule assertions to that unrelated suite. R48 owns replacement and eventual error-level promotion.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; bounded config change.

**Verify:** Use ESLint.lintText fixtures for POST/PATCH/PUT/DELETE versus GET, safeFetch and server routes; check effective warning severity. Existing tests/pm-ui/lint-rules.test.ts tests checklist grammar, not ESLint; add a separate focused fixture.

```delivery-plan-v1
{
  "outcome": "Warn when new client code uses a raw mutating fetch.",
  "acceptance": [
    "Literal client mutations warn; GET and safeFetch do not.",
    "The guard remains warning-only until the R48 cleanup is proven."
  ],
  "scope": [
    "eslint.config.mjs",
    "tests/pm-ui/raw-fetch-guard.test.ts"
  ],
  "steps": [
    "Reuse the existing flat-config override pattern for components, features, hooks and contexts.",
    "Add a warn-level selector for literal mutating methods on fetch calls; document dynamic-method limits rather than claiming exhaustive detection.",
    "Add a focused ESLint fixture for the supported call shapes and excluded server files.",
    "Recount current findings and record the baseline for R48 without changing existing writers."
  ],
  "invariants": [
    "Existing debt allowances are not broadened.",
    "Server routes are outside this client rule."
  ],
  "exclusions": [
    "Bulk fetch replacement and error-level enforcement."
  ],
  "checks": [],
  "risks": [
    "Computed or aliased calls can evade a syntax-only rule."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. eslint.config.mjs and the actual checklist-lint test inspected; no raw-fetch guard is present."
}
```

**2026-10-17 recovery preparation:** Exact publication paths are declared for the proposed single pilot; implementation remains open. Protected oracle `tests/delivery-oracles/r44-fetch-guard.mjs` is prepared under DLV-133 and checks warnings across four client directories, read calls/safeFetch and server exclusions. No application guard, live job or owner-reviewed plan is claimed. The later pilot preserves Codex / gpt-6-luna / low and exact phone plan approval; R48 still owns burn-down.

- **Implementation:** done
- **UAT:** pending
- **Closed 2026-11-11 as already completed:** the guard was applied on 2026-10-24 (run `r-46688acd1b86`, evidence above). `tests/pm-ui/raw-fetch-guard.test.ts` passes 5 tests on 2026-11-11. The row had stayed open while waiting for owner sign-off; that sign-off is the pending UAT, not open engineering. The burn-down of existing raw mutating fetch calls is R48.

### R47

**Outcome:** Enforce the client-only console rule.

- **Acceptance:** *(bundled with R44 into hygiene packet **H-02**)* Scoped `no-console` eslint rule matching Hard Rule 22's corrected client-only wording, warn-level over the client directories (202 sites); server routes stay exempt by design → `eslint.config.mjs`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Same file and same shape as R44: a scoped override block in `eslint.config.mjs` turning `no-console` on for `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/` and `page.tsx` files only. The rule's wording matters — Hard Rule #22 was *corrected* on 2026-08-01 to client-only, and `console.error` under `src/app/api/` is permitted by design (it is the Vercel log stream), so the override must not reach server routes. The stated 202 sites are a historical count, not a target; recount before claiming progress. Warn-level.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; bounded config change.

**Verify:** ESLint.lintText fixtures: console.log/warn/error warn in each client directory and page.tsx; src/app/api route console.error stays allowed. Recount current warnings.

```delivery-plan-v1
{
  "outcome": "Make the corrected client-only console rule executable.",
  "acceptance": [
    "The exact Hard Rule 22 client scope warns.",
    "Server API diagnostics are unaffected."
  ],
  "scope": [
    "eslint.config.mjs",
    "tests/pm-ui/"
  ],
  "steps": [
    "Add a scoped no-console warning for components, features, hooks, contexts and page.tsx.",
    "Preserve server route diagnostics by testing the effective config for route.ts.",
    "Add focused lint fixtures and record the new measured baseline."
  ],
  "invariants": [
    "Warning level preserves the current debt policy."
  ],
  "exclusions": [
    "Deleting existing console calls or suppressing new findings."
  ],
  "checks": [],
  "risks": [
    "A broad src/app glob would accidentally ban permitted server logging."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Current flat config inspected; historical 202-site count not reused."
}
```

### R45

**Outcome:** Resolve the mutation-toast Undo rule.

- **Acceptance:** Held for DEC-07: distinguish confirmation toasts from error/information toasts, then owner changes the global rule and the gap is measured against the agreed scope. This PM refactor does not waive Hard Rule1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-07; the deliverable is a recorded owner decision, not an edit. Hard Rule #1 currently says *all* toasts carry Undo, and the question is whether a pure confirmation or error toast should. Survey before proposing: the toast vocabulary is `ToastIcons` in `src/lib/toastIcons.tsx`, and the best-behaved examples are `src/components/notifications/CriticalAlertGate.tsx` and the optimistic mutations in `src/features/*/hooks.ts`. Record the resolution in `_Decisions.md`; this PM refactor does not waive the rule in the meantime.

**Execution plan — 2026-09-26**

**Readiness:** Decision held: DEC-07.

**Verify:** After an owner choice, `pnpm sync:ai` and `pnpm docs:check`; inspect representative success, error and information toasts against the selected wording.

```delivery-plan-v1
{
  "outcome": "Resolve the Undo rule with one owner decision and a measured follow-up scope.",
  "acceptance": [
    "The owner choice is explicit and every rule copy agrees.",
    "Any remaining implementation work is named rather than implied complete."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md",
    "CLAUDE.md"
  ],
  "steps": [
    "Prepare a small table of mutation-confirming, informational and error toast examples with available inverses.",
    "Ask the owner to retain all-toasts Undo or restrict it to mutation confirmations; keep the current rule until answered.",
    "Record the dated choice, update CLAUDE.md only within that choice and regenerate its mirrors.",
    "Measure remaining violations against the new wording and attach follow-up scope to the existing queue."
  ],
  "invariants": [
    "This plan does not waive Hard Rule 1."
  ],
  "exclusions": [
    "Product toast edits before the decision."
  ],
  "checks": [],
  "risks": [],
  "unknowns": [
    "DEC-07 owner choice."
  ],
  "dependencies": [
    "DEC-07"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Decision register still lists DEC-07 unresolved."
}
```

### R42

**Execution:** owner
**UAT:** cancelled 2026-09-26 — the swipe lives in the V1 session view; V1 is frozen (owner scope decision 2026-09-26)

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes.

- **Acceptance:** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes — the tap path is known-flaky against `scroll-snap-mandatory` + `scrollTo({behavior:"smooth"})` in at least one automated-browser environment; also confirm haptics, safe-area insets, and the new `pm-live.webmanifest` install → `src/components/pm-live/session/SegmentedPanes.tsx`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### R34

**Outcome:** Surface the oldest small hygiene item in session briefs.

- **Acceptance:** The recurring review ritual is defined in _Conventions.md. Remaining work: existing session-brief freshness radar identifies the oldest open S-effort item; use current backlog identity, no new subsystem.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small, and it attaches to something that already exists: `.claude/hooks/session-brief.sh` is the SessionStart hook that injects the freshness brief (it already reports DB-snapshot staleness for Hard Rule #27). Add the oldest open S-effort item to it. Backlog identity comes from the existing parsers — `scripts/pm/shared/tasks.mjs` and `scripts/pm/shared/work-id.mjs` parse `- [ ] **ID** title _(severity - effort)_`, and `scripts/pm/shared/metrics.mjs` `openWork()` already enumerates open work with `SEVERITIES`. "No new subsystem" is the constraint: read the checklists through the existing scanner, do not add a second one.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; resolve age from evidence.

**Verify:** Add small fixtures for no S items, tied dates, mixed campaign IDs, shipped/held rows and unknown creation dates; verify the hook stays fail-silent and concise.

```delivery-plan-v1
{
  "outcome": "Show the oldest eligible small hygiene item in the existing session brief.",
  "acceptance": [
    "The brief identifies a real open small item from the canonical backlog.",
    "No task is duplicated or automatically dispatched."
  ],
  "scope": [
    ".claude/hooks/session-brief.sh",
    "scripts/pm/shared/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Use the existing scanner and work identity parser to enumerate open S-effort items; do not add shell checkbox parsing.",
    "Derive age from the earliest verifiable item appearance; distinguish unknown age from document updated dates.",
    "Add one short item link to the existing radar with deterministic tie-breaking and no automatic lane move.",
    "Keep missing Git/history and parser failure nonblocking; record unresolved age rather than inventing it."
  ],
  "invariants": [
    "Session startup stays fail-silent.",
    "Document maintenance date is not task age."
  ],
  "exclusions": [
    "A new scheduler, queue or mandatory review subsystem."
  ],
  "checks": [],
  "risks": [
    "The current hook covers only eight campaigns and uses document dates; do not copy those assumptions."
  ],
  "unknowns": [
    "Which open hygiene items have recoverable creation evidence."
  ],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Actual session-brief.sh inspected; it has freshness checks but no item-age reader."
}
```

### R51

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m9--find-completed-work-without-delivering-it-again>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Witnessed task mutations and guarded Undo implemented under R59; remaining owner acceptance moved to UAT. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Reject stale desktop task actions and unsafe Undo.

- **Acceptance:** Desktop task mutations reject stale item identity, Undo refuses later edits, and original SSE/rebuild/409 verification passes. Dispatch only after a demonstrated DLV-93 trust blocker is selected or the freeze clears.
- **Progress (2026-09-11, R59):** server witnesses now cover toggle, move, ship and discard from the React, classic and legacy clients; ordinal-only writes (428), a changed row, a mismatched ID and a duplicate ID (409) refuse, with unit fixtures. Remaining: the gate's running-server desktop fixture with screenshot and before/after contents, SSE/rebuild behaviour, stale double toggle, multi-file Undo cases and postponement through a reorder.

**Retained contract — ASTRA-R-1:**

- **Outcome:** A stale desktop action leaves the intended item and later edits intact, and postponement follows the item through a reorder.
- **Money/schedule math?:** No; this edits PM Markdown only.
- **Gate:** `pnpm vitest run tests/pm-ui/ordinal-parity.test.ts tests/pm-ui/archive.test.ts tests/pm-ui/task-move.test.ts tests/pm-ui/shared-parsing.test.ts` → all pass, nonzero tests, no skips added. New cases: prepend/reorder two same-state items; stale Ship/Discard; double toggle; changed first and last file in a multi-file Undo; unchanged Undo restores; reorder preserves intended postponement without transferring it. `pnpm typecheck` and `pnpm pm:lint` → exit 0. Desktop fixture: external insertion before clicked row produces refusal/refresh with zero wrong-row changes. Screenshot plus before/after fixture contents recorded; no production corpus used as the mutation fixture.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### R46

**Outcome:** Warn on API mutation routes without Zod validation.

- **Acceptance:** Add a PostToolUse hook warning when an API route file exporting POST/PATCH/PUT has no Zod import (Hard Rule 12) — 113 of 170 mutating routes currently have none, pattern to follow is `.claude/hooks/check-migration.sh`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A PostToolUse hook, and the acceptance names its template: `.claude/hooks/check-migration.sh`. Read that plus `.claude/hooks/check-pm-update.sh` (which shows the once-per-turn, non-looping discipline) before writing anything; both are registered in `.claude/settings.json`. The check itself is textual: a file under `src/app/api/` exporting `POST`/`PATCH`/`PUT` with no `zod` import violates Hard Rule #12. The canonical compliant route is `src/app/api/accounts/route.ts`; `.claude/skills/api-route/SKILL.md` has the template. The 113-of-170 count is historical — recount when you land it. Warn, do not block.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; advisory hook only.

**Verify:** Fixture hook input for Windows/POSIX paths, POST/PATCH/PUT with/without Zod, GET-only, non-route and malformed input; confirm warning-only exit behavior.

```delivery-plan-v1
{
  "outcome": "Warn when an edited API mutation route lacks a Zod import.",
  "acceptance": [
    "Relevant edited routes emit one useful warning.",
    "Other files and malformed hook inputs do not block editing."
  ],
  "scope": [
    ".claude/hooks/",
    ".claude/settings.json",
    "tests/pm-ui/"
  ],
  "steps": [
    "Reuse check-migration.sh input normalization and registration style for a proposed new warning hook.",
    "Limit detection to edited src/app/api route files exporting POST/PATCH/PUT and lacking a Zod import.",
    "Explain import absence as a review signal; imported shared schemas can be valid, and an import alone does not prove validation.",
    "Register the hook, verify it never blocks and record a fresh scope count."
  ],
  "invariants": [
    "Hard Rule 12 remains broader than this heuristic."
  ],
  "exclusions": [
    "Bulk route rewrites, automatic schema insertion or claims of validated inputs from import presence."
  ],
  "checks": [],
  "risks": [
    "Textual detection has false positives for shared validators."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Existing migration hook inspected; historical 113/170 count not treated as current."
}
```

### R48

**Outcome:** Replace raw client mutation fetch calls.

**Baseline 2026-10-24:** actual ESLint guard evaluation of 692 client files found **96 warn-level findings across 34 files** (components 61, features 27, hooks 8, contexts 0), zero fatal/other errors. The 421 textual matches in the delivery comment are not a validated violation count. Direct literal POST/PATCH/PUT/DELETE calls are covered; dynamic/aliased/computed/window calls remain outside this syntax guard. [Baseline and limitation evidence](<../../../docs/R44-Delivery-Acceptance-2026-10-24.md#actual-r48-baseline-and-limitations>). No R48 writer replacement or error-level promotion was performed.

- **Acceptance:** Recount current raw mutating fetch calls; replace with safeFetch starting with Hub shopping and notification writers. Pass explicit timeoutMs for AI/uploads/external latency; timeout is not offline and must not enqueue duplicates. Flip R44 guard to error only after the current scope reaches zero. Historical counts 98/13/8 are not targets.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The burn-down half of R44, and the acceptance is explicit that the historical 98/13/8 counts are not targets — recount first with a grep for mutating `fetch(` under `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/`. Read `src/lib/safeFetch.ts` before replacing anything: it does a pre-flight online check, defaults to an 8 s timeout, and — the subtle part — treats a timeout as latency, not disconnection, probing `/api/health` before `markOffline()`, so `isOfflineError()` stays false for endpoint timeouts and they cannot enqueue a duplicate mutation. That is why AI calls, uploads and external APIs must pass an explicit `timeoutMs` (Hard Rule #6). Start where the acceptance says: the Hub shopping writers in `src/components/hub/ShoppingListView.tsx` and the notification writers in `src/hooks/useNotifications.ts`. Offline queue background: `ERA Notes/01 - Architecture/Sync and Offline.md`. Flip R44 to error only at zero.

**Execution plan — 2026-09-26**

**Readiness:** Split first; one writer family per slice.

**Verify:** For each slice test success, confirmed offline, timeout with healthy probe, caller abort and retry. Run the R44 detector over the full agreed scope before switching its severity.

```delivery-plan-v1
{
  "outcome": "Replace raw client mutations without changing retry or offline semantics.",
  "acceptance": [
    "Supported mutations use safeFetch and preserve request/response behavior.",
    "Timeout and caller abort never enqueue an offline duplicate."
  ],
  "scope": [
    "src/components/hub/ShoppingListView.tsx",
    "src/hooks/useNotifications.ts",
    "eslint.config.mjs"
  ],
  "steps": [
    "Recount current client mutation sites and read safeFetch/connectivity behavior; use that inventory to freeze later slice footprints.",
    "First slice: Hub shopping writers, preserving the existing legacy queue and unique mutation identity.",
    "Second slice: notification writers; then remaining bounded families, with explicit timeoutMs for external/AI/upload calls.",
    "After every scoped writer is covered and verified, promote R44 to error and record the measured zero."
  ],
  "invariants": [
    "No new offline queue or retry eligibility.",
    "Only confirmed connectivity failure is classified offline."
  ],
  "exclusions": [
    "Mechanical repository-wide replacements in one dispatch."
  ],
  "checks": [],
  "risks": [
    "Timeout recovery can replay a successful write if classification changes."
  ],
  "unknowns": [
    "Current complete inventory and later per-family footprints."
  ],
  "dependencies": [
    "R44"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted cleanup order and current helper contract reviewed; a fresh full writer inventory is deliberately the first execution step."
}
```

### R36

**Outcome:** Type the shared PM parsing core.

- **Acceptance:** JSDoc-type the `shared/` parsing core so typecheck guards the scanner everything else trusts — five files of pure functions, with the `lint.mjs` fix as the template → `scripts/pm/shared/md-scan.mjs`

**Retained contract — ASTRA-R-4:**

- **Outcome:** A wrong parser contract fails validation before it changes the owner's board.
- **Money/schedule math?:** No.
- **Gate:** `pnpm exec tsc --project scripts/pm/tsconfig.shared.json` → exit 0 with no emission; deliberate fixture/probe type error must have exited nonzero before removal, with diagnostic recorded. `pnpm vitest run tests/pm-ui/shared-parsing.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests, same corpus behavior. `pnpm typecheck` and `pnpm pm:lint` → exit 0. CI log includes the dedicated command on the tested commit; merely having a config file is insufficient.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Scope has drifted: the acceptance says "five files of pure functions", but `scripts/pm/shared/` now holds twelve — `md-scan.mjs`, `tasks.mjs`, `text.mjs`, `work-id.mjs`, `work-lifecycle.mjs`, `declarations.mjs`, `frontmatter.mjs`, `history.mjs`, `links.mjs`, `metrics.mjs`, `portfolio.mjs`, `product.mjs` (verified 2026-09-20). Re-scope before starting. The mechanism: `tsconfig.json` already sets `allowJs: true`, and **no file in `scripts/pm/` currently carries `@ts-check`**, including the `lint.mjs` the acceptance calls the template — so check what "the lint.mjs fix" actually refers to rather than assuming it is done. `md-scan.mjs` (`scanCore`, `scanLines`) is the root everything else trusts, so type it first. Existing behavioural cover: `tests/pm-ui/shared-parsing.test.ts`, `work-identity.test.ts`, `ordinal-parity.test.ts`.

**Execution plan — 2026-09-26**

**Readiness:** Split first; freeze the parser boundary before typing it.

**Verify:** Create the proposed scripts/pm/tsconfig.shared.json; run its no-emit compiler with a deliberate failing type probe, remove the probe, then rerun. Run tests/pm-ui/shared-parsing.test.ts and ordinal-parity.test.ts plus the normal typecheck.

```delivery-plan-v1
{
  "outcome": "Make invalid shared-parser contracts fail a dedicated type check without changing parsed work.",
  "acceptance": [
    "A wrong parser return/consumer shape produces a recorded compiler error.",
    "The same corpus yields the same IDs, ordinals and links."
  ],
  "scope": [
    "scripts/pm/shared/",
    "scripts/pm/tsconfig.shared.json",
    "package.json",
    ".github/workflows/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Inventory current shared modules and consumers; the old five-file estimate no longer matches twelve modules. Freeze the scanner and identity contract as the first slice.",
    "Add precise JSDoc and a proposed dedicated allowJs/checkJs/noEmit config; preserve existing JavaScript module boundaries and exports.",
    "Extend the typed closure in bounded slices, covering downstream contract errors instead of silencing them with casts.",
    "Wire the dedicated command into CI and prove one deliberately wrong parser consumer fails while the real corpus and fixtures remain unchanged."
  ],
  "invariants": [
    "No parallel parser or runtime grammar change.",
    "Passing the root TypeScript command alone does not prove JavaScript is checked."
  ],
  "exclusions": [
    "Repository-wide JS conversion and unrelated type debt."
  ],
  "checks": [],
  "risks": [
    "allowJs without checkJs leaves the proposed validation ineffective."
  ],
  "unknowns": [
    "Exact first-slice closure and the historical lint.mjs template claim."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Current shared exports and root allowJs inspected; no @ts-check found in the named shared files. Dedicated config is proposed."
}
```

### R37

**Outcome:** Verify local shell and static data provenance.

- **Acceptance:** Verify local shell/data compatibility and static source provenance with explicit build/cache fixtures; ordinal-parity and static embedding tests alone do not prove cache freshness. Preserve hosted follow-up boundaries.

**Retained contract — ASTRA-R-2:**

- **Outcome:** The desktop identifies its source snapshot and refuses writes when cached shell and data are incompatible.
- **Money/schedule math?:** No.
- **Gate:** `pnpm vitest run tests/pm-ui/static-twin.test.ts tests/pm-ui/build-smoke.test.ts` → all pass, nonzero tests. Same bundle inputs yield same identity; changed JS/CSS changes identity; changed Markdown changes source identity; timestamp alone does not change content identity; mixed format fails writable-mode eligibility; compatible stale payload remains read-only when offline. `pnpm typecheck` and `pnpm pm:lint` → exit 0. Desktop/390px source-copy fixture screenshot: live, compatible offline snapshot, and incompatible shell/data are distinguishable; write control is disabled in the last two. Launch only the copied server under the Execution contract, with `--no-bridge`; include resolved fixture/write paths with UAT evidence.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two separable claims, and the acceptance says the existing tests do not prove them. Read `scripts/pm/app-shell.mjs` first — its opening line is the provenance statement ("The local app fetches canonical Markdown through /api/data; HTML contains no snapshot") — with `appAsset()` and `buildAppShell()`, and `scripts/pm/build.mjs` (`buildBundle`, `createBundleWatcher`) for how the bundle is produced. Existing tests that are *not* sufficient on their own: `tests/pm-ui/static-twin.test.ts`, `ordinal-parity.test.ts`, `build-smoke.test.ts`. What is missing is a build/cache fixture: a stale cached shell against fresh data must refuse writes. The write path to refuse in is `scripts/pm/mutations.mjs` with `scripts/pm/write-guards.mjs` (`assertExpectedCheckbox`, `guardUndo`, `assertRestoreCurrent`). R53 depends on this.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; source compatibility is distinct from cached freshness.

**Verify:** Extend tests/pm-ui/static-twin.test.ts and build-smoke.test.ts with content identities, stale compatible offline data and incompatible shell/data. Exercise copied fixtures at desktop/390px with --no-bridge.

```delivery-plan-v1
{
  "outcome": "Expose truthful shell/data provenance and refuse incompatible writes.",
  "acceptance": [
    "Incompatible shell/data cannot mutate even through a direct request.",
    "The source snapshot remains identifiable in live, offline and static views."
  ],
  "scope": [
    "scripts/pm/app-shell.mjs",
    "scripts/pm/app-build.mjs",
    "scripts/pm/build.mjs",
    "scripts/build-pm-dashboard.mjs",
    "scripts/pm-server.mjs",
    "scripts/pm/app/",
    "scripts/pm/mutations.mjs",
    "scripts/pm/write-guards.mjs",
    "tests/pm-ui/"
  ],
  "steps": [
    "Trace the primary React shell separately from the static/classic build; record where shell, payload and schema identities enter the current transport.",
    "Define deterministic content identities: unchanged bytes stay identical, changed JS/CSS or Markdown changes the relevant identity, timestamps alone do not.",
    "Enforce compatibility at writable admission and display minimal provenance; compatible offline data remains readable without mutation authority.",
    "Run mixed-build/cache fixtures and capture the refused control plus direct write path; keep hosted rollout and phone evidence separate."
  ],
  "invariants": [
    "Static output is read-only.",
    "Fixture servers never start the production bridge."
  ],
  "exclusions": [
    "A new cache or replacement PM frontend."
  ],
  "checks": [],
  "risks": [
    "Disabling a button alone leaves a direct write path open."
  ],
  "unknowns": [
    "Current transport compatibility contract and exact identity ownership."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. app-shell.mjs reads /api/data rather than embedding data; React app-build and static build paths verified."
}
```

### R38

**Outcome:** Surface retained session histories in the freshness radar.

- **Acceptance:** The 90-day closed-history retention convention is implemented. Remaining work: existing freshness radar identifies histories eligible for archival without archiving an open decision, active incident or evidence needed by pending work.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The 90-day convention already exists; add only a compact suggestion to `.claude/hooks/session-brief.sh`, coordinated with R34. The scanner supplies raw documents and `shared/links.mjs` resolves references. `shared/history.mjs` explicitly excludes session prose: a small session-narrative detector is still needed. Establish dated closure and active-evidence markers from actual documents first; ambiguity means retain. `scripts/pm/archive.mjs` sweeps checklist rows, not session prose. Do not invoke it to move histories.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; establish reliable closure markers, then surface candidates without moving history.

**Verify:** Add fixtures for closed history older/newer than 90 days, referenced old evidence, active incidents, open decisions, missing dates and no candidates. Verify one compact nonblocking session brief.

```delivery-plan-v1
{
  "outcome": "Identify retained session narratives eligible for archival without losing active evidence.",
  "acceptance": [
    "Only dated closed unreferenced narratives are suggested.",
    "No history is automatically moved or deleted."
  ],
  "scope": [
    ".claude/hooks/session-brief.sh",
    "scripts/pm/shared/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Inspect real session narratives for dated closure markers and links to pending work, decisions and incidents; a shipped receipt alone does not prove session closure.",
    "Add a small session-narrative detector beside the existing history parser, using scanner documents and resolved references. Require explicit closure evidence; exclude active/referenced evidence and retain ambiguous status/date.",
    "Add a compact candidate count/link to the existing radar, coordinating its shared entry point with R34.",
    "Test the exclusions and fail-silent behavior; leave any later archive move to the existing documented review process."
  ],
  "invariants": [
    "Shipped receipts and active evidence remain discoverable.",
    "Unknown eligibility never becomes permission to archive."
  ],
  "exclusions": [
    "Extending the checklist sweep into an automatic session-history mover."
  ],
  "checks": [],
  "risks": [
    "archive.mjs handles checked task rows, not dated session prose."
  ],
  "unknowns": [
    "Reliable dated closure and active-incident markers in existing session narratives."
  ],
  "dependencies": [
    "Coordinate shared session brief with R34."
  ],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. archive.mjs sweeps checklist items; shared/history.mjs excludes session logs. Session detection remains proposed; the existing hook/parser do not prove eligibility."
}
```

### R8

**Outcome:** Measure index responsiveness on the largest note and on the complete static twin.

- **Acceptance:** Measure index responsiveness on the largest note and on the complete static twin

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Measurement, not a change. The index is the React app under `scripts/pm/app/` (search is `Explore.tsx` with `tests/pm-ui/search.test.ts`); the "complete static twin" is the fixture exercised by `tests/pm-ui/static-twin.test.ts`. Largest note: find it with a size sort over `ERA Notes/` rather than assuming. Record numbers; R9 only unparks if this proves offline load materially slow.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; measurement only.

**Verify:** Record cold/warm/offline load, indexing and search-response timings, corpus bytes/counts, browser/device and exact revision. Repeat a fixed query set on the largest current note and complete static export.

```delivery-plan-v1
{
  "outcome": "Produce a reproducible responsiveness baseline before choosing a performance fix.",
  "acceptance": [
    "Measurements name the source revision, environment and repeatable input.",
    "A static-twin unit test is not a timing witness."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md"
  ],
  "steps": [
    "Find the largest actual note and record the full PM corpus size; include the expanded execution plans rather than an old small fixture.",
    "Measure primary React search and complete static search separately using fixed queries, fresh/warm caches and a documented mobile viewport.",
    "Identify whether indexing, rendering, transfer or font loading dominates; retain raw observations and variability.",
    "Record the bottleneck and a bounded next action; unpark R9 only if font bytes demonstrably cause material offline delay."
  ],
  "invariants": [
    "No production relay starts during measurement.",
    "A slow sample does not establish its cause."
  ],
  "exclusions": [
    "Speculative font changes or rewriting search."
  ],
  "checks": [],
  "risks": [
    "A cached run can conceal cold-load cost."
  ],
  "unknowns": [
    "Actual timing baseline and an owner-meaningful threshold for material delay."
  ],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Existing search/static tests and separate build paths provide starting fixtures; no benchmark run in this planning pass."
}
```

### R9

**Outcome:** Font subsetting.

- **Acceptance:** Font subsetting — only if offline load proves materially slow

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Conditional on R8 proving font-related offline delay. The primary PM styles load Geist Regular/SemiBold in `scripts/pm/app/styles.css`; `scripts/pm/app-build.mjs` embeds woff2 for React, while `scripts/pm/build.mjs` builds the separate classic/static bundle with the same loader kind. Measure the affected bundle and required glyphs before proposing local subsets. Main web-app fonts remain outside this item.

**Execution plan — 2026-09-26**

**Readiness:** Conditional: execute only after R8 proves font-related delay.

**Verify:** Repeat R8 with identical input before/after; inspect both themes and representative names, punctuation and currencies offline. Confirm bundled glyph coverage, fallback and retained font licensing metadata.

```delivery-plan-v1
{
  "outcome": "Reduce PM font transfer only when measured benefit justifies subsetting.",
  "acceptance": [
    "Required glyphs render correctly offline.",
    "The same measurement shows an actual font-related improvement."
  ],
  "scope": [
    "scripts/pm/app/styles.css",
    "scripts/pm/app-build.mjs",
    "scripts/pm/build.mjs",
    "scripts/pm/assets/"
  ],
  "steps": [
    "Read R8 evidence and separate font cost from indexing/render cost; keep this parked if fonts are not the material bottleneck.",
    "Inventory the two current Geist weights and required household text/glyphs; choose the smallest covered subset with a reliable fallback.",
    "Add proposed local subset assets and update only PM bundling references, preserving provenance and licensing metadata.",
    "Repeat the same offline benchmark and visual text matrix; retain the change only with a measured improvement and complete text."
  ],
  "invariants": [
    "Main web-app font behavior is unchanged.",
    "No external font request is introduced."
  ],
  "exclusions": [
    "Unmeasured visual redesign or subsetting on package size alone."
  ],
  "checks": [],
  "risks": [
    "Missing household names or currency glyphs can outweigh a small byte saving."
  ],
  "unknowns": [
    "R8 bottleneck evidence and necessary glyph coverage."
  ],
  "dependencies": [
    "R8"
  ],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. PM styles load Geist Regular/SemiBold; both app-build.mjs and build.mjs embed woff2 as data URLs."
}
```

### R53

**Outcome:** Make phone Inbox capture visible and identifiable.

- **Acceptance:** Command Center mobile read-model gap: a new raw Inbox entry remains visible with stable identity and a receipt after refresh. Preserve owner-bound cache semantics; this is not a prerequisite for the V2 pilot.
- **Depends on:** [R37](<PM Tooling — Master Book.md#r37>).

**Provenance:** [PM Tooling — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/PM Tooling — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on R37 (provenance/cache), and the symptom is a read-model gap, not a write failure — so confirm the capture actually persists before touching the UI. The Inbox file is `ERA Notes/10 - Project Management/0 - Inbox.md`; the readers are `scripts/pm/app/Auxiliary.tsx` (the desktop view), `scripts/pm/check-docs.mjs` and `scripts/pm/bridge.mjs` (the phone relay). Note there is also a legacy `scripts/pm/src/features/inbox/InboxView.jsx` under the old UI — R6 is retiring that surface, so do not fix it there. Stable identity plus a receipt after refresh is the same durability problem the relay solves elsewhere: read `src/features/pm-live/relay/` and the bridge's command journal. Owner-bound cache semantics must be preserved. Filing raw captures is `.claude/skills/triage-inbox/SKILL.md` — this item is about visibility, not triage.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; establish persisted capture and snapshot provenance.

**Verify:** Use isolated Inbox/relay fixtures for capture, same-command retry, refresh, second device, duplicate text, delayed snapshot and account switch. Confirm one logical capture and a stable receipt; no live bridge run.

```delivery-plan-v1
{
  "outcome": "Keep a phone Inbox capture visible and identifiable after refresh.",
  "acceptance": [
    "A successfully persisted entry remains visible with its receipt.",
    "Retry cannot create a second entry or reveal another owner installation."
  ],
  "scope": [
    "scripts/pm/app/Auxiliary.tsx",
    "scripts/pm/shared/",
    "scripts/pm/relay-shared.mjs",
    "scripts/pm/bridge.mjs",
    "src/features/pm-live/relay/",
    "tests/pm-relay.test.ts",
    "tests/pm-ui/"
  ],
  "steps": [
    "Read the owner-supplied DB snapshot first for this visibility symptom; then follow capture receipt to Inbox append and the published model, reproducing disappearance with an isolated fixture.",
    "Reuse command/receipt identity and row witnesses so identical text or reordered lines do not select another capture.",
    "Project untriaged raw entries through the shared reader and owner/installation-bound cache; reconcile delayed snapshots without inventing success.",
    "Verify the identity survives refresh and becomes linked to its eventual triage destination; retain the original captured wording."
  ],
  "invariants": [
    "Canonical Inbox remains the source of raw captures.",
    "Access-shaped findings require current owner DB evidence before a policy diagnosis."
  ],
  "exclusions": [
    "Automatic triage, a second Inbox or fixes only in the rollback UI."
  ],
  "checks": [],
  "risks": [
    "A stale snapshot can look like failed persistence."
  ],
  "unknowns": [
    "Which current hop loses the capture/receipt after refresh."
  ],
  "dependencies": [
    "R37"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted read-model contract and current relay/reader routing reviewed; no production reproduction claimed."
}
```

## Backlog reconciliation

- Existing aliases: open R7 → R51 (historical R7 remains reserved); open CI R49 → HUB-37 (historical R49 remains archive automation).
- 2026-09-10 — R35 governance complete; R34/R38 retain only freshness-radar implementation.

## Shipped Log

- ✅ 2026-10-03 — **R70** Guardrail hooks fire on real payloads: block-ui-dir.sh blocks src/components/ui/ edits and update-atlas.sh rebuilds atlas.json when an… → [record](<../_Archive/Shipped/PM Tooling.md#r70>)

- ✅ 2026-09-26 — **R69** Shared Command Center Memory mark, Home queue/module cards, Analytics navigation and daily receipts, visible work IDs, persistent search… → [record](<../_Archive/Shipped/PM Tooling.md#r69>)

- ✅ 2026-09-26 — **R68** Active highlights readable on /pm/live + Earlier deliveries filter → [record](<../_Archive/Shipped/PM Tooling.md#r68>)

- ✅ 2026-09-22 — **R67** Muted text readable on /pm/live: the Next app's :root[data-theme="blue"] { --muted: #1a2942 } (a surface shade, specificity 0,2,0) beat the… → [record](<../_Archive/Shipped/PM Tooling.md#r67>)

- ✅ 2026-09-15 — **R66** Removed Delivery launch/footer noise and rebuilt review hierarchy around visible plan sections, verification history, run facts and final… → [record](<../_Archive/Shipped/PM Tooling.md#r66>)

- ✅ 2026-09-15 — **R65** Actionable To do, searchable Done, completed scope/session history, separate owner UAT, and shared V1/V2 launch guards → [record](<../_Archive/Shipped/PM Tooling.md#r65>)

- ✅ 2026-09-11 — **R51** Witnessed task mutations and guarded Undo implemented under R59 → [record](<../_Archive/Shipped/PM Tooling.md#r51>)

- ✅ 2026-09-12 — **R63** Shared Command Center views mounted on the phone relay through the transport seam → [record](<../_Archive/Shipped/PM Tooling.md#r63>)

- ✅ 2026-09-15 — **R64** Responsive Delivery review workspace implemented and browser-verified at 320 through 1920 px → [record](<../_Archive/Shipped/PM Tooling.md#r64>)

- ✅ 2026-09-10 — **R57** Replaced the primary dashboard with the React ERA application, focused mobile/desktop journeys and truthful Delivery story — evidence → [record](<../_Archive/Shipped/PM Tooling.md#r57>)

- ✅ 2026-09-10 — **R56** Added whole-project area/topic exploration, contextual work previews, dependencies and continuous Delivery return paths — evidence → [record](<../_Archive/Shipped/PM Tooling.md#r56>)

- ✅ 2026-07-13 — **R-series** the Preact/esbuild Command Center became the default dashboard: hash routes, history, themes, module/document views, backlinks, interactive… → [record](<../_Archive/Shipped/PM Tooling.md#2026-07-13--r-series>)
- ✅ 2026-07-13 — checkbox identity got a constructional guard: one dependency-free scanner serving mutations, Markdown, tasks and tests, with a 358-file parity test against the literal legacy algorithm
- ✅ 2026-07-13 — the portable twin builds from the same bundle with Geist vendored and inlined, and Delivery/edit entry points hidden in static mode
- ✅ 2026-07-17 — the PM Center became an installable PWA with an opt-in LAN mode (house-style icon family, `pm.webmanifest`, DNS-rebinding host guard, 23 new net-guard tests)
- ✅ 2026-07-17 — a dedicated mobile home + bottom nav below 700 px, with a "needs your decision" feed sourced from the existing delivery `awaiting` field
- ✅ 2026-07-17 — Delivery gates, questions, monitoring and the launch wizard made usable one-handed (48 px targets, `?tab=` deep links to Q&A, horizontally scrolling tabs, full-screen modals below 700 px)
- ✅ 2026-07-17 — long checklist items stay readable: a shared `TaskCard` (chips on one line, full text wrapped, never truncated) grouped into collapsible lanes with a campaign filter
- ✅ 2026-07-18 — **R16** the read-only PM Console shipped as a first-class page of the deployed app at /pm — own manifest and icons, installable on a phone, offline… → [record](<../_Archive/Shipped/PM Tooling.md#r16>)
- ✅ 2026-07-18 — **R15** superseded by R16: the phone-offline goal is met by hosting inside the already-HTTPS deployed app, so no self-signed-cert LAN path is needed
- ✅ 2026-07-18 — **R26** `lintChecklist` JSDoc typing fixed — `pnpm typecheck` had been broken repo-wide for five days by an untyped options bag
- ✅ 2026-07-22 — **R27** Idea Inbox: 0 - Inbox.md capture surface (New/Processed), the 💡 topbar quick-capture reusing the existing append mutation with no server… → [record](<../_Archive/Shipped/PM Tooling.md#r27>)
- ✅ 2026-07-25 — **R28** the Delivery launch wizard became a full page (`#/delivery/new`) instead of a 620 px-capped modal, with the flight-check grid replaced by a masonry `columns` layout
- ✅ 2026-07-25 — **R29** /pm/live shipped as the third mobile surface: live checklist + live delivery control fed by an outbound-only Supabase relay, distinct from… → [record](<../_Archive/Shipped/PM Tooling.md#r29>)
- ✅ 2026-07-30 — **R30** hide-completed made real: the document view now partitions each list and collapses completed rows behind a per-list "N completed hidden —… → [record](<../_Archive/Shipped/PM Tooling.md#r30>)
- ✅ 2026-07-30 — **R31** Search and the Idea Inbox became first-class destinations: sidebar entries, mobile tabs… → [record](<../_Archive/Shipped/PM Tooling.md#r31>)
- ✅ 2026-07-30 — **R32** a real board toolbar on Tasks and Checklist: always-visible search, one-tap quick-filter chips (Blockers / Now / Small / Done), native… → [record](<../_Archive/Shipped/PM Tooling.md#r32>)
- ✅ 2026-07-30 — **R33** visual pass: sticky lane headers on both the board and the checklist rollup, tabular-figure count pills, 20% tighter cards, a checkbox… → [record](<../_Archive/Shipped/PM Tooling.md#r33>)
- ✅ 2026-07-30 — memory files refreshed for the new layout (project_pm_command_center, project_fable_handoff, project_agentic_delivery_workspace) and the… → [record](<../_Archive/Shipped/PM Tooling.md#2026-07-30--memory-files-refreshed-for-the-new-layout>)
- ✅ 2026-07-30 — **R7** vault consolidation: every campaign reduced to a Master Book + 4 - Checklist.md, superseded layers moved to Archive/ and made invisible to… → [record](<../_Archive/Shipped/PM Tooling.md#r7>)
- ✅ 2026-07-31 — **R39** /pm/live rebuilt phone-only (owner: "too cluttered, texts are too much, size is too small") — the lg: desktop layout and SideNav are gone,… → [record](<../_Archive/Shipped/PM Tooling.md#r39>)
- ✅ 2026-07-31 — **R40** fixed the display-layer duplication bug: PmTask.text still carries the ID chip and the (severity - effort) suffix because cleanInlineText()… → [record](<../_Archive/Shipped/PM Tooling.md#r40>)
- ✅ 2026-08-01 — **R49** Automate the checklist sweep — Ship / Discard row actions with Undo, a git-dated pnpm pm:archive CLI, and a once-a-month auto-sweep on pnpm… → [record](<../_Archive/Shipped/PM Tooling.md#r49>)
- ✅ 2026-08-03 — **R41** fixed the shared task-text stripping order so every PM consumer receives clean prose instead of duplicated ID/severity metadata (`shared/text.mjs`; parsing regression test)
- ✅ 2026-08-03 — **R50** transformed pnpm pm around real owner workflows: action-led Overview, movable Work Queue with undoable Markdown lane changes, portfolio… → [record](<../_Archive/Shipped/PM Tooling.md#r50>)

- ✅ 2026-09-10 — **R35** Meta-work budget and explicit owner-commission exception established in _Conventions.md.
- ✅ 2026-09-10 — **R52** Refactored the full PM knowledge system: canonical queues/criteria, accepted plans, decision and option disposition, archive provenance,… → [record](<../_Archive/Shipped/PM Tooling.md#r52>)
- ✅ 2026-09-10 — **R54** Refactor the PM product journey through Delivery outcome — evidence → [record](<../_Archive/Shipped/PM Tooling.md#r54>)
- ✅ 2026-09-11 — **R58** Restore ERA's theme and correct PM connectivity detection — evidence → [record](<../_Archive/Shipped/PM Tooling.md#r58>)
- ✅ 2026-09-11 — **R59** Repaired canonical work identity, acceptance lookup and source/history links → [record](<../_Archive/Shipped/PM Tooling.md#r59>)
- ✅ 2026-09-11 — **R60** Completed Home, Work Board/List and module views: badges (not lanes) for blocked/active/review, shareable filtered URLs, checklist-row… → [record](<../_Archive/Shipped/PM Tooling.md#r60>)
- ✅ 2026-09-26 — **R68** Phone content no longer hides behind the fixed bottom nav: .app-main reserves the nav height plus the safe area… → [record](<../_Archive/Shipped/PM Tooling.md#r68>)
- ✅ 2026-10-03 — **R61** Plan sprints, deliverables and readiness over the same work → [record](<../_Archive/Shipped/PM Tooling.md#r61>)
- ✅ 2026-10-03 — **R72** ERA chat reports import into Hub & ERA › Now › ERA reports… → [record](<../_Archive/Shipped/PM Tooling.md#r72>)
- ✅ 2026-10-24 — **R73** Center Delivery navigation and signal running sessions → [record](<../_Archive/Shipped/PM Tooling.md#r73>)
- ✅ 2026-10-25 — **R74** Mirror PM documents and delivery status one-way to Google Drive for ERA Steward → [record](<../_Archive/Shipped/PM Tooling.md#r74>)
- ✅ 2026-10-25 — **R75** Delivery home groups every delivery once by what it asks of the owner → [record](<../_Archive/Shipped/PM Tooling.md#r75>)
- ✅ 2026-10-25 — **R76** Walk the owner through a delivery's test steps and record Pass, Fail or Blocked — [criteria](<PM Tooling — Master Book.md#r76>)
- ✅ 2026-10-25 — **R77** Turn submitted UAT feedback into linked campaign work on the next pnpm pm — [criteria](<PM Tooling — Master Book.md#r77>)
- ✅ 2026-10-25 — **R78** Publish UAT status to Drive and show engineering Done apart from owner-accepted Shipped — [criteria](<PM Tooling — Master Book.md#r78>)
- ✅ 2026-10-25 — **R80** Restore delivery item IDs, navigation access and browser-pairing recovery — [criteria](<PM Tooling — Master Book.md#r80>)
- ✅ 2026-10-25 — **R81** Find UAT steps and sign-off directly from Delivery — [criteria](<PM Tooling — Master Book.md#r81>)
- ✅ 2026-10-31 — **R82** Separate readiness blockers from pending live checks — [criteria](<PM Tooling — Master Book.md#r82>)
- ✅ 2026-11-10 — **R92** Give every agent the same setup and remove the current drift → [record](<../_Archive/Shipped/PM Tooling.md#r92>)
- ✅ 2026-11-10 — **R93** Generate a setup registry and check it for conflicts → [record](<../_Archive/Shipped/PM Tooling.md#r93>)
- ✅ 2026-11-10 — **R94** Decide Hard Rule verdicts for any change with detectors → [record](<../_Archive/Shipped/PM Tooling.md#r94>)
- ✅ 2026-10-24 — **R44** Guard new client mutations against raw fetch → [record](<../_Archive/Shipped/PM Tooling.md#r44>)
- ✅ 2026-11-11 — **R95** Record every agent session as a flight report → [record](<../_Archive/Shipped/PM Tooling.md#r95>)
- ✅ 2026-11-11 — **R96** Score sessions and deliveries from recorded facts → [record](<../_Archive/Shipped/PM Tooling.md#r96>)
- ✅ 2026-11-12 — **R84** Deny Supabase write tools in every tool namespace — [criteria](<PM Tooling — Master Book.md#r84>)
- ✅ 2026-11-12 — **R71** Point the PM Stop hook at the current campaign files → [record](<../_Archive/Shipped/PM Tooling.md#r71>)
- ✅ 2026-11-12 — **R89** Hold each Master Book to a size budget → [record](<../_Archive/Shipped/PM Tooling.md#r89>)
- ✅ 2026-11-12 — **R100** Ship work with one command and keep one navigable front door → [record](<../_Archive/Shipped/PM Tooling.md#r100>)
- ✅ 2026-11-14 — **R6** Verify the replacement PM UI before retiring rollback files → [record](<../_Archive/Shipped/PM Tooling.md#r6>)
- ✅ 2026-11-14 — **R86** Show the next action, what needs the owner and what is running on Home → [record](<../_Archive/Shipped/PM Tooling.md#r86>)
- ✅ 2026-11-14 — **R97** Build the PM.2 cockpit and keep PM.1 as the library → [record](<../_Archive/Shipped/PM Tooling.md#r97>)
- ✅ 2026-11-14 — **R101** Make the Agentic OS cockpit readable and actionable → [record](<../_Archive/Shipped/PM Tooling.md#r101>)
- ✅ 2026-11-14 — **R102** Give Bridge calm and cinematic views with truthful charts → [record](<../_Archive/Shipped/PM Tooling.md#r102>)
- ✅ 2026-11-14 — **R103** Restore the header Game layer icon and visible rotation → [record](<../_Archive/Shipped/PM Tooling.md#r103>)
- ✅ 2026-11-14 — **R104** Animate the Game-layer ERA core from delivery state → [record](<../_Archive/Shipped/PM Tooling.md#r104>)
- ✅ 2026-11-14 — **R105** Give the ERA core overload intensity and gradual cooldown → [record](<../_Archive/Shipped/PM Tooling.md#r105>)
- ✅ 2026-11-14 — **R106** Restore ERA core identity and soften Game motion → [record](<../_Archive/Shipped/PM Tooling.md#r106>)
- ✅ 2026-11-14 — **R107** Compose skill prompts freely with optional module context → [record](<../_Archive/Shipped/PM Tooling.md#r107>)
- ✅ 2026-11-14 — **R108** Replace the redundant skill-launch destination with actual Work → [record](<../_Archive/Shipped/PM Tooling.md#r108>)
- ✅ 2026-11-14 — **R109** Open Plan directly and realign unfinished sprints without reshuffling → [record](<../_Archive/Shipped/PM Tooling.md#r109>)
- ✅ 2026-11-14 — **R110** Make Sessions and Delivery status and item details readable → [record](<../_Archive/Shipped/PM Tooling.md#r110>)
- ✅ 2026-11-14 — **R111** Show actionable session states and per-item UAT without backlog clutter → [record](<../_Archive/Shipped/PM Tooling.md#r111>)
- ✅ 2026-11-14 — **R112** Repair Agentic OS setup diagnostics and clarify rule coverage → [record](<../_Archive/Shipped/PM Tooling.md#r112>)
- ✅ 2026-11-14 — **R113** Simplify Deliver launch and add a distinct Game view → [record](<../_Archive/Shipped/PM Tooling.md#r113>)
- ✅ 2026-11-14 — **R114** Choose model and effort for Local delivery → [record](<../_Archive/Shipped/PM Tooling.md#r114>)
- ✅ 2026-11-14 — **R115** Default delivery settings from the item's Markdown recommendation → [record](<../_Archive/Shipped/PM Tooling.md#r115>)
- ✅ 2026-11-14 — **R116** Validate Local sign-in against its cleaned worker environment → [record](<../_Archive/Shipped/PM Tooling.md#r116>)
- ✅ 2026-11-14 — **R117** Restore Local session review and accurate Bridge execution states → [record](<../_Archive/Shipped/PM Tooling.md#r117>)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

- 2026-10-24 — **R44** V2 run `r-46688acd1b86` · applied; integrated checks passed · codex gpt-6-luna <!-- v2-apply:app-497cee609b88@applied -->
- 2026-10-24 — **R44** V2 run `r-46688acd1b86` · candidate verified; not applied · codex gpt-6-luna <!-- v2:res-a20e5a5a072c@1 -->
- 2026-10-24 — **R44** V2 run `r-69bc10ef3c60` · cancelled · codex gpt-6-luna <!-- v2:res-802d062b976a@1 -->
- 2026-10-19 — **R44** V2 run `r-262a6aee5ed3` · cancelled · codex gpt-6-luna <!-- v2:res-d15d62b4752b@1 -->
## Successor Briefing

**2026-11-14 R117:** repaired the actual HUB-118 Local startup exception by snapshotting the Claude SDK environment before freezing options; Node's `process.env` stays mutable and the sandbox remains fail-if-unavailable. Local review now has evidence-backed stages, work brief, four host checks, activity, changes and UAT controls. Local list metadata distinguishes active work, terminal outcomes and interrupted preparation/build/check phases. Bridge no longer lets old UAT hide active red execution or the latest grey failed/blocked state. Local refused Starts reuse the existing Delivery launch receipts and UUID replay; new explicit attempts preserve older run/worktree evidence with unique branch/path names. 597 relevant tests plus 44 adjacent checks, typecheck/build/scoped lint/docs checks and 28 desktop/mobile Blue/Pink browser screenshots pass. A read-only check against the owner's actual failed run confirms the UI and grey Bridge state. The running `--bridge` backend still needs an owner restart under Hard Rule 26; no live provider retry was executed. [Owner handover](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r117--local-session-review-bridge-states-and-startup-recovery>).

**2026-11-14 R113:** Deliver has a distinct animated Game layout and one explicit Start flow. Local no longer polls/displays readiness before launch; its server performs all three admission checks. Confined removes the manual Check readiness UI and passive gates on Start; explicit owner Start sends `renewAuthorization: true`, renewed once within the durable receipt before existing readiness collection. Restricted Steward credentials cannot renew. Both executor cards can be selected; actual Confined policy permission is reported after Start, with Use Local on loopback. Current dirty source blocks Local; both sign-ins/dependencies pass. Policy revision 13 permits Codex only, unchanged. Replay and desktop/mobile fixture evidence passes; no real delivery was started. The frontend watcher has loaded the changes. Owner must stop the current PM terminal and run `pnpm pm --bridge --no-open` for backend renewal; agent restart is barred by the production relay write effect. UAT and candidate hashes: [R113 handover](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#r113--deliver-launch-and-game-mode>).

**2026-11-14 R112:** Setup now opens scan health and actual hard-rule coverage, with separate Rule coverage, Conflicts and Configuration views. The audit repaired shared Windows permission placement, generated hook recognition, false advisory-strength claims, launch-declaration classification and a literal model reference. Static findings are zero errors and zero warnings, with twelve informational notes. Four judgment rules carry explicit review steps. Missing or invalid declared guards remain actionable. Inventory filters are independent of detail selection, and hard/module rule deep links bypass old search text. Local PM's existing fifteen-second worker refresh loads scanner changes and its app watcher rebuilds the UI. Owner aesthetic and physical-device acceptance remain pending.

**2026-11-14 R111:** replaces the rejected R110 backlog widgets and Item overview / Runs & reviews split with one Sessions workspace: Running / Needs you / To test / Waiting / Finished / Unconfirmed. Counts retain their session/request/item units; only explicit runtime/recorder/request/UAT bindings deduplicate. Large queues open campaign collections and six-card pages with search. Agent evidence remains secondary. `#/uat-item/<campaign>/<id>` opens authored Action/Expect steps directly, and local Start test binds current source through the existing durable UAT command and result/signoff engine. Existing relay handovers work; authored-step import is local-only. All 71 pending canonical items resolve authored instructions; parked native/schema exercises still have explicit owner prerequisites and no invented Pass. Replay and desktop/390 px Blue/Pink evidence is in `.pm/session-workspace-evidence/`; Start test/result/reload ran only in a credential-free disposable fixture. Restart the local PM server for the new handler. Implementation evidence does not establish owner aesthetic or physical-device acceptance; no deployment, production write or provider launch.

**2026-11-14 R110 — rejected, superseded by R111:** the earlier status-widget and nested-tab design failed owner review despite passing its implementation tests. R111 replaces that architecture. Work detail's Later → Next → Now → Done path, visible acceptance and reference cards remain with the original command witnesses and Undo. Historical evidence is in `.pm/delivery-overview-evidence/`; it does not establish product acceptance.

**2026-11-14 R109:** owner promotes Sprints/Plan over R108's Work entry. Primary navigation is Bridge / Plan / Sessions / Setup / Score. Bridge opens Plan; desktop Search work and More > Work retain the backlog (the header shortcut is hidden on mobile, so the More link is required). Sprints adds Realign preview/Apply/revision-bound Undo using the existing planning seam; CLI `pnpm pm:realign [--to YYYY-MM-DD] [--apply]` previews by default. Active/draft dates and exclusively linked milestone targets translate together; members, gaps, duration, scope, lifecycle and closed history remain intact. Backups precede atomic writes. Browser Apply/Undo ran only in a temp fixture, not the owner's real plan; preview shows +5 days for today. R87's automatic elapsed-week lifecycle cleanup remains separate. Restart local PM for the new action handler; remote use needs a matching bridge. Evidence: `.pm/sprint-realignment-evidence/result.json`; owner/device acceptance pending under [R109](<#r109>).

**2026-11-14 R108:** owner rejected the primary skill launcher despite R107's passing usability checks. Primary Work now opens existing Explore → Now and preserves acceptance → Deliver/readiness → Sessions/review. Bridge's Find work shares that destination; contextual launch URLs remain intact. Optional composer lives at Setup → Prompt tools. Native generic-prompt expansion R98 is HELD; do not revive it as a default next step. Local readiness's overlapping two-child/three-column layout is fixed. 57 focused tests, typecheck/build/scoped lint and docs/PM checks pass; desktop/390 px Blue/Pink browser evidence and 13 matching runtime hashes are in `.pm/work-entry-evidence/`. Readiness was synthetic; no execution or deployment was tested. Product acceptance remains pending under [R108](<#r108>).

**2026-11-14 R107 — product rejected, superseded by R108:** the 18-skill composer and eight guided forms remain optional Prompt tools. Original request, module/work context and target paths survive modes; presets stay skill-scoped. Its 50 replay tests and desktop/mobile clipboard evidence remain valid implementation evidence in `.pm/launch-composer-evidence/`, not proof of owner value. Full lint retains 9,285 baseline errors outside clean changed files. Existing local PM servers need a restart for that earlier request-schema change.

**2026-11-14 R106:** the owner accepted R105's animation and requested ERA identity plus slightly softer intensity. The core now has thin open arcs, an elliptical counter-orbit and the existing ERA mark; tire spokes/tread/track and ground-contact particles are removed. Emission is 160/s instead of 225/s at full energy, with lighter smoke, shorter trails and softer vibration/heat/glow. R105 timing, phase continuity, state semantics and cooldown remain. Typecheck/build/scoped lint/11 focused tests and local desktop/mobile Blue/Pink browser checks pass. Evidence is in `.pm/r106-evidence/`; appearance/device UAT remains pending under [R106](<#r106>). No deployment or provider execution.

**2026-11-14 R105:** the core's overload refinement supersedes R104's 1.7 s hard-ended throttle. A 2.4 s drive accelerates toward 240 rpm; real running sustains 180 rpm. One motion clock preserves angle through retrigger and natural coast; bounded canvas sparks/flame/smoke and localized vibration fade with energy. Failed state preserves its split form and only coasts existing momentum. State labels and all command boundaries remain unchanged. Final typecheck/build/scoped lint/format pass; 37 tests are covered with one concurrent cockpit timeout resolved by its isolated 10/10 rerun. The frozen browser suite passes 24 state/theme/viewport combinations and interaction/lifecycle checks; evidence and 13-file candidate hashes are in `.pm/r105-evidence/`. Owner aesthetic/physical-device acceptance remains Pending under [R105](<#r105>). No deployment or native/provider run occurred.

**R105 final hue amendment:** visual review caught blue-to-red interpolation passing through green. The final hook takes the shorter violet/red path; the supplemental `hue-amendment.json` binds current source and checks 1,042 rendered samples across desktop Blue/mobile Pink with no green crossing, plus static reduced-motion state hues. The original full-motion receipt is retained as prior evidence; the candidate manifest and final build checks bind the amended source.

**2026-11-14 R104:** Game-mode ERA now sustains rotation and displays delivery state through red/orange running friction, gentle yellow delivery approval/action, green explicit success and a grey broken offset ring for failure. `EraCore.tsx` / `core-motion.css` own the cosmetic 1.7 s click/keyboard throttle; `coreState.ts` owns honest state precedence and terminal ordering. Standing backlog decisions stay in Needs you and do not mask session results. Hidden/offscreen motion pauses; reduced motion disables movement/particles; calm mode has no animated core. Owner explicitly exempted Game motion from the former 400 ms/no-loop ceiling. Typecheck/build/scoped lint/31 tests and both core/Bridge browser suites pass; nine candidate hashes match. Evidence is in `.pm/r104-evidence/`. Implementation is done; owner aesthetics/physical-device UAT remains Pending under [R104](<#r104>). No deployment, provider call or native session was performed.

**2026-11-14 R102:** Bridge now has calm and chart-led Game views over the same action queues, an ERA state core, canonical outcome/quality charts, passive SDK footer and Setup attention dot. Owner approved the 1.8 s enter / 1.0 s exit exception; reduced motion, persistence, rapid toggles and mobile controls are covered. Frozen-source browser evidence is in `.pm/r102-evidence/`; typecheck/build/31 replay tests and changed-file lint pass. Owner aesthetic/physical-device acceptance remains Pending under [R102](<#r102>). Relay SDK facts cannot prove freshness and stay Stale/Unknown. Score retains its existing evidence mirrors; other pages await the owner's page-by-page review. No deployment or native provider run.

**2026-11-14 R99/A7 partial:** Settings switch and evidence-backed game facts exist; R102 supersedes the initial 360 ms scan. `os:arena case|controls KIT-11` freezes and checks the shipped cooking-count case. Score's Arena subview reads existing A4 session bindings and refuses incompatible comparisons. There is no native dispatch or import path that claims a protected oracle. Current Local adapters do not establish oracle read isolation; the architecture excludes the confined boundary from automatic reuse. Stop at that owner scope decision, then implement real owner-started paced subscription runs and A3 report binding before closing R99. [Evidence/limits](<../../../docs/Skills-and-Agents.md#arena-and-game-layer-a7--r99-partial>).

**2026-11-14 R98/A6:** Eight sidecars and two recipes now feed the existing Launch destination through A1 registry and PM facts. Complete new-module form/dry-run/clipboard flow verified without input questions, including 390 px Blue/Pink. Native worktree launch is deliberately disabled: Local's start contract accepts a tracked item ID/file and no arbitrary skill-prompt/values/attachments/fingerprint. Extend that existing contract and bind a genuine A3 report before closing R98. Copy creates no synthetic flight. No A7/detector-system expansion. [Acceptance and limits](<../../../docs/Skills-and-Agents.md#skill-launchpad-a6--r98>).

**2026-11-14 R97/R6/R86:** PM.2 is the shared local cockpit: Bridge / Launch / Sessions / Setup / Score; Library retains documents and work, Plan is the existing Sprints view. Old local rollback entry points and their three legacy assets are retired after parity/browser/fake-driver gates; static export, V1 execution/recovery/history and the separate legacy phone reader remain. A1–A4 are unchanged inputs. Full read-only session facts ride the existing relay manifest; the publisher coalesces a completed snapshot behind an in-flight startup publish. The OS worker never triggers PM observation or Drive publishing. A6 launchpad and A7 expansion remain open. Historical setup source hashes are unrecorded; physical-phone deployment remains separate from the 390 px/relay-double evidence. [Implementation and validation](<../../../docs/Skills-and-Agents.md#pm2-cockpit-a5--r97>).

**2026-09-15 R65:** keep implemented scope in Done and owner tests in UAT. `work-lifecycle.mjs` governs explicit owner/completed refusal; the source scanner and both launch backends use it. Do not restore acceptance-only checkboxes. Work > Done opens immutable completion evidence plus available attempts.

Command Center Phase 6a is in code (R62): `scripts/pm/shared/history.mjs` and `metrics.mjs`, `scripts/pm/app/Dashboard.tsx`, `tests/pm-ui/metrics.test.ts`; `product`/`portfolio` live in `scripts/pm/shared/` with classic re-exports. A sprint chart plugs into `sprintProgress` once R61 exists; retire paths under R6 only after the DLV-102 trial and R6's UAT. Command Center Phases 0 and 1 are complete (R59, R60). Phase 2 is R61 in `scripts/pm/app/`, depending on R60's Board/List and filter model (`model.ts`, `Board.tsx`); read the phase text in [Command Center](<../Plans/Command Center.md>) and the [PM Feature Map entry](<../../01 - Architecture/Feature Map/cross-cutting/pm-command-center.md>) before editing. R57 supersedes the R54/R56 primary visual architecture; retain their parsers and evidence, not their inspector or navigation as design constraints. Work in `scripts/pm/app/` for the primary local experience. Preact reference/static and React relay remain distinct. R55 is the held V2 job presentation follow-on. R6 governs retirement; R37/R42 retain hosted/real-device evidence, and R51 retains legacy-client/remaining concurrency acceptance. R60's stated limits (no real phone, one representative Checklist/Brief sweep, no persisted per-item session history) are real gaps, not closed — R63 (phone) and R55 (session history) still own them.

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
