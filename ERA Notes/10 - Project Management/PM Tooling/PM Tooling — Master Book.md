---
created: 2026-09-10
updated: 2026-09-15
type: master-book
status: active
owner: Elio
---

# PM Tooling — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Keep work identifiable, reviewable and recoverable across PM surfaces. Tooling campaign for desktop, static and mobile PM reading and task controls.

## Current state & evidence

**2026-09-15 Delivery production-view cleanup (R66):** launch no longer prints recommendation prose or raw coordination/resource codes. Unavailable executors open one owner-facing cause. A blocked run now names its actual blocker rather than presenting a generic “Ready” verdict beside it. Review order is Plan → Verification → Activity → Changes; Changes remains the final Apply surface. Plan has a desktop artifact rail and visible Risks/Unknowns sections; verification, application history, token comparison and run facts no longer depend on collapsed disclosures. The global slogan/reference footer is gone. Component, model, bundle, type and lint evidence is local; no browser was connected for a fresh visual pass, so desktop/phone owner UAT remains pending.

**2026-09-15 lifecycle correction:** the earlier rule kept code-complete work open pending owner acceptance. The checklist now contains remaining executable work; done scopes have exact Shipped Log receipts, and owner-only checks retain their IDs under [UAT](<../../../docs/Delivery-UAT.md>). Done means implemented locally with recorded verification, not deployed or owner-accepted. Historical status narratives below must be read at their evidence dates.

**2026-09-14 Phase 3 history/readability foundation (local, not owner-accepted):** a Work page now discovers V2 attempts by stable campaign/normalized work ID and retains a history shell when the current checklist row no longer exists. Delivery shows recorded profile recommendation/override beside settings. This is a narrow R55/R64 foundation, proven by targeted Delivery/PM fixtures and typecheck; it does not yet provide full historical filters/pagination, relay walkthrough, responsive owner acceptance or completion of R55/R64.

**2026-09-14 first Delivery trial hotfix planning:** the owner tested `r-c1d69bb666cf` / DLV-107 and reported unreadable text, weak review/control and no path back to the attempt. Runtime/journal inspection confirms a plan-approved one-line candidate, repeated inconclusive check Results, successful Apply and successful rollback. Work only follows active V1 runs, while V2 is separately loaded on Delivery. R55 now includes permanent item attempt history; R64 owns desktop/mobile reading and decision hierarchy. [Hotfix specification](<../Plans/Delivery First-Run Hotfix.md>) contains all 13 concerns and evidence. This is documentation only; no UI or runtime change was made. Browser unavailable; no new visual/phone acceptance.

**2026-09-13 owner-requested review:** six targeted PM suites passed 46 tests; typecheck passed; ESLint completed with no errors (repository warning debt remains). A rendered navigation defect is filed as Delivery [DLV-107](<../Delivery/Delivery — Master Book.md#dlv-107>) at the owner's request and prepared as the first small Focused/FAST trial. It remains unfixed. The shared Home/Work V2 activity omission is now explicit under R55. No available browser was connected, so this adds source/fixture evidence, not mobile/device acceptance.

**2026-09-12 Command Center Phase 6a (R62, dashboard in code; sprint and delivery comparisons outstanding):** `#/dashboard`, opened from Home, reads one history parser and one metric contract, locally and on `/pm/live`: open work by campaign and priority, completed and cancelled exact IDs by week with undated records and records lacking an exact ID shown apart, declared bugs, delivery attempts and dispositions apart from work, known usage per unit, and history coverage. Each chart has a table and a drilldown; totals reconcile on the live corpus. Sprint charts wait for R61 and value comparisons for real Delivery receipts. No presentation path was retired (R6) — see [R62](<#r62>).

**2026-09-12 Command Center Phase 4 presentation (R63, code landed; phone acceptance outstanding):** `/pm/live` now mounts the same React views as `pnpm pm` through a transport seam — local server or authenticated relay — instead of a separate phone app; the earlier view stays at `?ui=legacy` as the rollback. Views ask the transport's capabilities: on the relay, checklist writes, V1 launch/detail and classic links are absent, capture and every V2 command are relayed, and a status strip keeps laptop reachability, the last receipt and worker availability apart. Recovery and Apply are Delivery's ([DLV-104](<../Delivery/Delivery — Master Book.md#dlv-104>), [DLV-105](<../Delivery/Delivery — Master Book.md#dlv-105>)). Evidence is fixture, build and synthetic-render only; no real phone — see [R63](<#r63>).

**2026-09-11 Command Center Phase 1 (R60):** the primary React app's Work page and every module page now share one Board/List component over the canonical backlog — Now/Next/Later lanes, campaign/kind/status filters and view mode round-trip through the URL, blocked/active/review are badges rather than a relocated priority, and moves stay keyboard/tap-operable with the existing guarded Undo. Checklist rows get the same anchor slug as their brief heading, so Work items open and highlight the exact checklist line, distinct from the Master Book acceptance heading. Verified against 120 passing `pm-ui` tests and a live walkthrough (desktop plus a same-origin-iframe 390/320 px probe, since this sandbox's window resize had no effect); no real phone and no exhaustive Checklist/Brief sweep — see [R60](<#r60>) for the full evidence and limits.

**2026-09-11 Command Center adoption and Phase 0 (R59):** the owner approved [Command Center](<../Plans/Command Center.md>). Phase 0 repaired canonical IDs, acceptance lookup and source/history anchors, and checkbox writes from the React, classic and legacy clients now refuse witness-less, reordered, mismatched and duplicate-ID targets. A read-only scan of the live corpus afterwards: 234 open outcomes in 11 campaigns (28 Now / 85 Next / 121 Later), zero empty contracts, zero unresolved references, every brief anchor present. Fixture and scan evidence only; no browser walkthrough, provider run or phone.

**2026-09-11 theme/connectivity correction (R58):** the local React app uses ERA's existing Blue palette (navy, cyan, violet) and Pink alternate. The health handler now accepts the shared connectivity manager's uncached `HEAD` probes as well as `GET`. The owner's running pre-fix process reproduced `HEAD 404` / `GET 200`; a server restart is required to load this backend change.

**2026-09-10 product experience reboot (R57):** `pnpm pm` now opens a standalone React 19 + TypeScript application with TanStack Query, Framer Motion, Radix sheets and the shared ERA mark. Today, Explore and Delivery replace the dashboard navigation and permanent inspector. The local Node server still owns Markdown and execution; the personal app remains Next.js 16. The Preact interface is an explicit `?ui=classic` reference fallback, and static/hosted exports remain secondary snapshots. R54/R56 read models and Delivery contracts are retained; their primary visual architecture is superseded.

**2026-09-10 comprehension pass (R56):** Project is the opening screen: all eleven areas, cross-area topics, Now/Blocked/Needs you/Delivering perspectives, live run summaries and dated changes. Selection and work previews stay beside the project on desktop and open in a keyboard-operable phone dialog. Area ownership remains canonical; perspectives are read-only projections.

**2026-09-10 product refactor (R54):** the local Preact app now follows Overview → Campaign → Work → Delivery setup → live execution → outcome. Campaigns derive only from canonical checklists and their Master Books; open decisions come from `_Decisions.md`. Shipped and cancelled numbers count dated log records, not a fabricated percent-complete denominator. The static Preact twin shares the product views, while `/pm/live` remains its separate React/relay application.

**Verification boundary:** desktop 1536 px and mobile 390 px Chromium fixtures exercised planning screens, the launch/approval/pause/accept/ship flow, artifact keyboard focus, retry and static read-only mode. Launch previews and preflight were generated by the actual Delivery route handlers against copied fixture documents; execution states and mutations in the browser walkthrough were simulated. No real provider session, production DB write or phone/PWA installation was exercised. R6, R37, R42 and R51 retain their broader acceptance.


The local React application, Preact reference/static outputs and separate React relay share parsing contracts. There is no claim of one visual bundle everywhere. Browser offline/Undo evidence for the new app is under R57; broader legacy-client, hosted provenance and real-device acceptance remain separate.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/PM Tooling — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Owner decision 2026-09-15: Delivery is a production application surface. Internal policy vocabulary, recommendation rationales, repeated receipt fields, slogans and reference-tool links do not ship as ambient UI. Plan, verification, activity and final changes form the review sequence; major facts stay visible. *(IMPLEMENTED 2026-09-15: R66.)*

- Owner decision 2026-09-15: Work/Deliver contains actionable implementation only; completed source appears as Done, with UAT pending separately. Owner-only gates leave the backlog and remain in the UAT. Partial scope is split into explicit remaining engineering. *(IMPLEMENTED 2026-09-15: lifecycle reconciliation; PM Tooling R65 owns the app and guards.)*

- Owner request (2026-09-14): Delivery must be comfortable on desktop and follow mobile UI rules on phones; every work item retains visible delivery attempt history across success, cancellation, failure and rollback. Implement the proposed [hotfix](<../Plans/Delivery First-Run Hotfix.md>) under R64/R55 and linked Delivery owners, with short product copy and full details on demand. R64 implementation is Done; R55 retains explicit remaining history work. Owner UAT is tracked separately; candidate verification alone does not complete an implementation item.

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

🟠 **R66 — 2026-09-15: Delivery exposes internal policy and hides major review facts.** Launch printed scope/fleet verdicts and recommendation rationales; the session hid Risks, Unknowns, verification history, application history and run facts in low-prominence disclosures. Token receipts repeated unknown/reserved/allowance fields, and global footer copy made the application read like a draft. Owner screenshots supplied desktop and mobile evidence.

🟠 **R64 — 2026-09-14: Delivery compresses decisions into small technical rows.** Source CSS uses 9px plan disclosures, 10px check states and 11px check/resource/list text. Plan, cost, evidence and application counters compete without a clear decision hierarchy; owner reports desktop/mobile usability failure. Responsive screenshot/device acceptance is pending. [Hotfix UX contract](<../Plans/Delivery First-Run Hotfix.md>).

🟠 **R55 — 2026-09-14: a real V2 attempt disappears from the item's navigation.** Work's `runFor` uses active V1 sessions only; terminal V2 attempts live behind Delivery history and no item attempt list exists. The run itself remains stored; this is a presentation/navigation omission, not production RLS. Preserve all attempts and their distinct plan/candidate/result/application versions.

🟡 **2026-09-13 — “See what changed” opens the backlog.** Actual-component rendering reproduced `Work.tsx`'s `view=story` / `SpaceView`'s `tab=story` mismatch. Owned once by Delivery [DLV-107](<../Delivery/Delivery — Master Book.md#dlv-107>) as the requested first trial.

🟠 **2026-09-13 — Home/Work omit V2 activity.** `state.tsx:143` fetches only `source.v1Runs`; Home and Work consume that list. A V2 run can appear on Delivery while Home has no active ribbon and Work offers no corresponding Follow delivery link. Retained under [R55](<#r55>), not a duplicate work item.

🟡 **2026-09-12 — HUB-23 names two different outcomes.** Hub & ERA's Shipped Log records **HUB-23** "Ask AI" (2026-08-26) while the open checklist row HUB-23 is "Rank signals using explicit feedback". The dashboard counts it as Reopened, not completed, and a prerequisite on HUB-23 reads the open row. Cause: an ID reused after shipment. Fix is a Hub & ERA rename with an alias record, not a parser change. Found by R62's read-only live-corpus scan.

🔴 **R43** Verify hot-child RLS and read contracts. See [acceptance](<#r43>) for the root cause, evidence and gate.

🔴 **R44** Guard new client mutations against raw fetch. See [acceptance](<#r44>) for the root cause, evidence and gate.

🟠 **R47** Enforce the client-only console rule. See [acceptance](<#r47>) for the root cause, evidence and gate.

🟠 **R51** Reject stale desktop task actions and unsafe Undo. Dated source diagnosis; cause and witness limits are in [criteria](<#r51>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **R37** Verify local shell and static data provenance. Dated source diagnosis; cause and witness limits are in [criteria](<#r37>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### R66

**Implementation:** done
**UAT:** pending

**Outcome:** Make Delivery launch and review read as a production application.
**Kind:** bug
**Touches:** `scripts/pm/app/App.tsx`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/DeliveryReview.tsx`, `scripts/pm/app/deliveryReviewModel.ts`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/delivery.css`, `scripts/pm/app/delivery-review.css`, `tests/pm-ui/`

- **Acceptance:** launch shows only executor, lane, model, effort and an actionable blocker when needed; unavailable executor details state one real cause and offer Retry. Review order is Plan → Verification → Activity → Changes. Plan places artifacts beside the plan on desktop and renders Risks/Unknowns as major visible sections. Current/previous verification, application history, token use versus threshold and useful run facts are readable without opening disclosures. No slogan/reference footer or retained-output implementation prose appears. The same hierarchy stacks without horizontal overflow on phone.
- **Verification (2026-09-15):** targeted PM/coordination tests cover tab order, readable verification history, quiet token comparison and executor cause mapping; React bundle, typecheck and changed-file lint passed. Browser connection was unavailable, so visual desktop/phone UAT remains pending in `docs/Delivery-UAT.md`.

### R65

**Implementation:** done
**UAT:** pending

- **Verification (2026-09-15):** 800 tests passed across 55 PM/Delivery/relay/V1-route files; four opt-in Docker cases skipped. Typecheck and changed-file ESLint passed. Isolated Chromium used 22 actual campaign documents and synthetic sessions: 28 observations at 320/390/1440 px, Blue/Pink, Done search/detail, UAT-pending badge, actionable Deliver, refused old launch links, excluded owner checks and retained attempt navigation; zero runtime exceptions or horizontal page overflow. Evidence: `.tmp/work-lifecycle/`. No provider dispatch, production DB write or deployment.

**Outcome:** Keep actionable Delivery work separate from Done and owner UAT.
**Kind:** bug
**Touches:** `scripts/pm/`, `scripts/delivery-v2/work-ref.mjs`, `scripts/delivery/server-routes.mjs`, `tests/pm-ui/`, `tests/delivery-v2/`

- **Cause:** acceptance-held checklist rows presented completed implementation as open work; direct launches lacked a lifecycle guard and swept work lost its detail page.
- **Acceptance:** owner-only checks stay in UAT; Work has searchable Done outcomes with scope/receipt/session history; completed/owner/noncanonical sources cannot launch through UI or either backend. Pending engineering remains explicit and reopening does not fabricate acceptance.

### R64

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Responsive Delivery review workspace implemented and browser-verified at 320 through 1920 px; physical-phone UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

- **2026-09-15 implementation:** shared Delivery review tabs and URL state, responsive cards and typography, compact phone header, plan.md reader/export, latest-check grouping, frozen diff reader and Radix rollback dialog with focus return. `DeliveryReview.tsx`, `deliveryReviewModel.ts`, `delivery-review.css` are the presentation seams. [Request trace](<../../../docs/Delivery-Requests.md>) and [UAT](<../../../docs/Delivery-UAT.md>) preserve the owner's requested evidence. Chromium synthetic walkthrough: 320/390/430/768/1440/1920px, Blue/Pink, 16px body, no page overflow, tab keyboard/reload, 30-step plan and reader/rollback focus. Physical phone relay, mobile OS keyboard and native 200% browser zoom remain owner UAT; 720px reflow was emulated. R64 implementation is Done; those device checks are pending in the UAT and do not create another Delivery task.

**Outcome:** Make Delivery readable and usable on desktop and phone.

**Kind:** feature
**Touches:** `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/delivery.css`, `scripts/pm/app/responsive.css`, `scripts/pm/app/styles.css`, `scripts/pm/app/components.tsx`, `scripts/pm/app/types.ts`, `tests/pm-ui/`

- **Acceptance:** implement [hotfix §4 and packet G](<../Plans/Delivery First-Run Hotfix.md>): purposeful Plan/Changes/Checks/Activity views, persistent current outcome/usage, readable desktop width and one-column phone behavior; body/input 16px, control text at least 14px, metadata at least 12px and 44px touch actions. Full plan/approval and rollback confirmation remain owned by DLV-116/115; do not duplicate their backend scope. Test 320/390/430/768/1440/1920px, 200% zoom, keyboard/focus, mobile keyboard/safe areas, theme contrast and no page overflow. Logs and engineering rationale remain disclosed, not inline product essays.
- **Evidence boundary:** CSS/source and owner's report establish the problem; no available browser was connected in the planning audit. Capture actual desktop and phone evidence before claiming acceptance.

### R59

**Outcome:** Repair canonical work identity, acceptance lookup and source links.

- **Cause (reproduced 2026-09-11):** reference parsing had no suffix letters and heading lookup was exact-case, so `SCH-4.3b`, `SCH-1b.4`, `SCH-1c.1` and `SCH-1c.2` projected empty contracts and `SCH-4.3b` references collapsed to a nonexistent `SCH-4`. Work lowercased IDs for anchors (`sch-4.2`) while headings slug to `sch-42`; the shared slug collapsed hyphens that authored links keep; cancelled history linked to a file the reader could not open. Checkbox writes from the classic and legacy clients were ordinal-only, and no write refused a duplicate ID.
- **Change:** `scripts/pm/shared/work-id.mjs` owns chip grammar, normalized comparison, reference extraction and `### <ID>` lookup for the scanner, read models, write guards and V2. `links.mjs` emits GitHub slugs with duplicate suffixes, now also used by `pnpm pm:check-docs`. Work shows the source spelling and opens the exact acceptance heading (or the checklist when none exists); history opens the Shipped Log or the campaign section of the explicitly read Cancelled Log, which stays out of the scan. `write-guards.mjs` requires `expectLine` for toggle, move, ship and discard (428) and refuses a changed row, a mismatched `expectId` or a duplicate ID (409); the React, classic and legacy clients send witnesses.
- **Verification (2026-09-11):** `tests/pm-ui` 113 passed in 20 files, including the React, classic and static builds, `work-identity.test.ts` (Schedule rows, references, duplicate headings, anchors, brief/history paths) and new `write-guards` cases (missing witness, reorder, unknown ordinal, ID mismatch, duplicate ID). Relay suites 91 passed. `pnpm typecheck` exit 0; ESLint on changed files clean; `pnpm pm:lint` 0/0; `pnpm pm:check-docs` passed. Live read-only corpus scan: four Schedule contracts resolve (2,822 / 198 / 231 / 309 characters), zero unresolved references, 234/234 brief anchors exist.
- **Limits:** fixture and scan evidence; the changed links were not walked in a browser at 390/320 px and no phone was used. R51 keeps its remaining acceptance.
- **Provenance:** [Command Center Phase 0](<../Plans/Command Center.md#phase-0--establish-a-trustworthy-baseline-and-adopt-the-direction>), owner approval 2026-09-11.

### R60

**Outcome:** Complete Home, Work Board/List and module views over the canonical backlog.

- **Acceptance:** Command Center Phase 1. All eleven campaigns and the complete open backlog are reachable. Board and List show the same IDs with Now/Next/Later lanes, campaign/kind/status filters and shareable URLs; blocked/active/review are badges or filters, never relocated priority; a move, reload and Undo work at desktop and 390/320 px; a CLI edit refreshes global and module views; Checklist and Brief links open every tested active, completed and cancelled record at the exact ID with the return location kept; core navigation never sends the owner to classic tools. Labels follow Hard Rule 28.
- **Depends on:** [R59](<#r59>). Keeps the R57/R58 foundation; refines R6/R42 where they overlap.
- **Change:** `scripts/pm/app/Board.tsx` (new) is the shared Board/List component, used unmodified on Work (`Explore.tsx`, promoted from the discovery page via a `view=board|list` toggle that preserves the existing search landing) and on the module page (`SpaceView`, campaign locked, replacing the old bespoke bucket-tab list). Lanes are `work.section` directly (Now/Next/Later only); blocked/active/review render as badges from a new `activityBadges()` and never relocate the row. Filters (status/campaign/kind) and the view mode round-trip through the URL via `parseBoardQuery`/`boardQueryString` (`model.ts`) — `view` is always written, since an absent `view` is what tells Work to render Search instead of Board. Move is a `<select>` (keyboard/tap, always present) plus native HTML5 `draggable` (never mixed with Framer Motion drag per Common Patterns §4); both call the existing guarded `move-task` op and reuse `Work.tsx`'s `UndoNotice`. `work.kind` is new, sourced from an optional `**Kind:** ` line in the Master Book ID section (`portfolio.js#kindOf`) and defaulting to `unclassified` — nothing was guessed from severity or text. `work-id.mjs#checklistAnchors` gives every checklist chip the same anchor slug its brief heading would use, so `model.ts#checklistPath` and the Markdown `li` renderer (`components.tsx`) can open and highlight the exact checklist row; `briefPath`'s no-book fallback now points at that same row instead of a bare file (verified test updated). `Work.tsx` adds distinct Checklist/Brief links (only when they differ) and an "Open in CLI" clipboard handoff (ID, source, outcome, acceptance). `Home.tsx`'s `SpaceShelf` cards gained a blocked-count/active badge row and one next-action link (top Now item, or the space itself). Nav labels renamed Today→Home, Explore→Work (routes/aliases unchanged).
- **Verification (2026-09-11):** `pnpm exec vitest run tests/pm-ui`: 120 passed in 21 files (7 new in `board.test.ts`: checklist anchors, declared-Kind parsing, checklist/brief distinction, lane grouping, badge combinations, filter URL round-trip, filter matching). `pnpm typecheck` and `pnpm exec eslint` on every changed file: exit 0. `pnpm pm:lint` 0/0; `pnpm pm:check-docs` 11 pairs / 241 tasks pass. Live `pnpm pm` walkthrough against the real corpus: all 11 campaigns selectable and the full 241-item backlog reachable from Work; Board and List render the same filtered IDs; a keyboard Move (Budget item, Now→Next) produces a guarded write, an Undo clicked promptly restores the exact prior line, and a stale-toast click is safely a no-op (confirmed by design, not a defect — the guard is `expectLine`, not the toast); reloading a filtered URL (`?view=list&campaigns=Budget`) restores the identical filtered List. A same-origin iframe probe (window resize was unavailable in this sandboxed Chromium) confirmed the compact Now/Next/Later lane switcher and tap-to-change-lane at true 390 px and 320 px, with no horizontal overflow — fixed one found there: `.page-title` needed `flex-wrap` at ≤700 px once a text action (Board/Search instead) sat beside the heading, not just the round Capture button. Checklist and Brief links opened `BUD-39` at its exact row/heading with a visible scroll-and-flash highlight and preserved the return path back through the module page.
- **Limits:** "CLI edit refreshes both views" is verified by construction, not an isolated raw-file-edit probe — every check here (moves, restores) is itself a filesystem write picked up by the same unchanged `fs.watch`→SSE→invalidate pipeline R57 already verified; no separate external-editor test was run. Checklist/Brief distinct-link and highlight behavior was exercised on one representative open item (`BUD-39`), not swept across all 241; done/cancelled records keep their existing `historyPath` (unchanged by this work, since a shipped/cancelled row has no checklist line left to highlight). "Linked sessions" on the item page still shows only the current live run (`runFor`), not a persisted per-item session history — no such read model exists yet. No real phone/PWA install was exercised. Drag-and-drop was wired per Common Patterns §4 but only keyboard/tap Move was interaction-tested end to end; drag is progressive enhancement over the same guarded mutation. A Budget checklist reorder made and undone during testing was manually restored to its original row order as a precaution.
- **Provenance:** [Command Center Phase 1](<../Plans/Command Center.md#phase-1--complete-the-home-work-and-module-experience>).

### R61

**Outcome:** Plan sprints, deliverables and readiness over the same work.

- **Acceptance:** Command Center Phase 2. A validated, revisioned `_Planning.json` (references and planning facts, never copied titles, acceptance, checkbox state or lanes) supports draft/start/close sprints, relative and owner-review capacity, deliverables and Ready / Needs input / Blocked readiness. The same item moves on the board, joins a sprint, completes through the CLI and updates every view once; cancellation reduces remaining work without adding delivered work; a criteria edit invalidates its readiness witness; overcapacity and unestimated work are visible; a conditional dependency can be planned but cannot launch early; concurrent stale edits to `_Planning.json` conflict instead of overwriting.
- **Depends on:** [R60](<#r60>).
- **Delivery Phase 5 note (2026-09-12):** parallel coordination landed before this item ([Delivery/DLV-106](<../Delivery/Delivery — Master Book.md#dlv-106>)). "Can it run now?" should call `scripts/delivery-v2/coordination.mjs` (`itemReasons`, `coordinate`) rather than restate prerequisite and scope rules. Prerequisites and `**Touches:**` are read through `scripts/pm/shared/declarations.mjs`. No sprint view shows parallel verdicts yet.
- **Provenance:** [Command Center Phase 2](<../Plans/Command Center.md#phase-2--add-practical-sprints-deliverables-and-readiness>).
- **Reading guide:** Large, unstarted, and the file it is named after does not exist — verified 2026-09-20, there is no `ERA Notes/10 - Project Management/_Planning.json` and nothing in `scripts/pm/` references one. Read three things before designing it. (1) `scripts/pm/shared/metrics.mjs` already has `sprintProgress(planning)` expecting a planning object, plus `openWork()`, `workOutcomes()`, `PRIORITIES`, `SEVERITIES` — that is the contract to satisfy. (2) Readiness must not restate prerequisite rules: call `scripts/delivery-v2/coordination.mjs` (`itemReasons`, `coordinate`, `dependencyState`), which already answers "can it run now?", and read declarations through `scripts/pm/shared/declarations.mjs` (`Depends on`, `Touches`). (3) The no-copying constraint is the design crux — `_Planning.json` holds references only, so the checklist stays the single source of truth for titles, acceptance and lanes. Concurrent-edit conflict means a revision check on write; the write discipline is in `scripts/pm/write-guards.mjs` and `scripts/pm/mutations.mjs`. Depends on R60.

### R62

**Remaining engineering (2026-09-15):** sprint metrics after R61 and comparable-run charts once owner trial data exists. Existing core metrics/history parser are implemented; do not recreate them.

**Outcome:** Add sprint and comparable-run metrics.

- **Acceptance:** Command Center Phase 6 metric contract: one history parser shared locally and by the relay; open work, completed/cancelled outcomes, bugs by explicit kind, sprint scope and delivery outcomes follow the plan's definitions; chart totals reconcile to their drilldowns; incomplete historical coverage is visible; no project percentage or fabricated dates.
- **Depends on:** [R60](<#r60>) for current metrics; sprint charts need [R61](<#r61>); delivery comparisons need [Delivery/DLV-102](<../Delivery/Delivery — Master Book.md#dlv-102>) receipts.
- **Implemented (2026-09-12) — Phase 6a current-state metrics:**
  - *One parser:* `scripts/pm/shared/history.mjs`. Records are bullets in a campaign's `## Shipped Log` (✅) or its Cancelled Log section (❌) only; Pain Inventory, session logs, fences and prose are not records, and other lines in those sections are returned as notes. Identity is `exact` (one canonical ID, optionally `: title` or a non-partial `(alias)`), `referenced` (pairs, ranges, partials, follow-ups) or `unidentified`. Dates are `day`, same-month `range` or `unrecorded`. `shared/product.mjs#parseOutcomes` (React app locally and on `/pm/live`, classic build) and `bridge.mjs#createHistorySnapshotBuilder` (legacy phone row) both call it; the legacy row no longer counts Pain Inventory, session-log or table stamps and sets `idChip` only for exact receipts. `shared/portfolio.mjs` treats a prerequisite as shipped only from an exact receipt.
  - *Metric contract:* `scripts/pm/shared/metrics.mjs` — `openWork` (distinct WorkRefs; blocked separate; the Board's lane rule), `workOutcomes` (latest dated receipt per exact ID, repeats kept, an open ID is Reopened, a ticked unswept row is completed without a date), `outcomeSeries` (Monday weeks; buckets + undated + earlier + later = total), `bugs` (declared `**Kind:** bug` only, by severity), `sprintProgress` (unavailable without planning), `deliveryAttempts` (V1 SHIPPED = Accepted with disposition unrecorded; V2 outcome from `closed_outcome`; verified candidate and applied change as reached levels), `resourceRows` (estimate, tokens and settled amount per unit, with known/total), `historyCoverage`. V2 run summaries carry `resources` (`journey.mjs#resourceBrief`), so the relay row has them too.
  - *Dashboard:* `scripts/pm/app/Dashboard.tsx` + `dashboard.css`, route `#/dashboard`, linked from Home. Filters and selection round-trip through the URL (`model.ts#parseDashboardQuery`). Tiles; open work stacked by priority, each segment opening its Board lane; weekly completed/cancelled columns with Undated, Earlier and No exact ID, drilling into the counted records and their source; bugs by severity; V1/V2 attempts as small multiples; resources table; history coverage with notes. Every chart has a Table toggle with totals; captions are for assistive technology only (Hard Rule 28). Colors: a validated one-hue ordinal ramp per theme for priority and a validated categorical pair for completed/cancelled.
  - *Extraction for R6:* `product.js` and `portfolio.js` now live in `scripts/pm/shared/`; the classic `src/lib/` files re-export them, and the React app, bridge and relay no longer import the classic namespace.
- **Verified (2026-09-12):** `tests/pm-ui/metrics.test.ts` (12: identity and date rules, section scoping, dedup/reopened/unswept outcomes, weekly reconciliation with no placed record outside its stated week, Board reconciliation for every campaign and lane, explicit bugs, attempts never changing work outcomes, unit separation and coverage, URL round-trip, identical metrics from a relay-assembled corpus, and a read-only live-corpus reconciliation at 8/16/26/all weeks); updated `tests/pm-bridge.test.ts` history cases. `tests/pm-ui` 145/145 in 24 files including the React, classic and static builds; delivery-v2 and relay suites 565 passed with 4 opt-in skipped; `pnpm typecheck` exit 0; ESLint on every changed file clean. **Live corpus (read-only):** 240 open (28 Now / 86 Next / 126 Later), 83 blocked, no duplicate IDs; 262 history records — 169 exact, 15 referenced, 78 unidentified; 260 dated to a day, 1 range, 1 undated; 3 notes; 167 completed exact IDs, 1 cancelled, 93 records without an exact ID, 1 Reopened (HUB-23, Pain Inventory); `**Kind:**` declared on 0 of 240 open items. **Rendered:** the real bundle over the live corpus and local V1 sessions in headless Edge with device-metric emulation at 1280, 390 and 320 px (Blue) and 390 px (Pink): no horizontal overflow and no control under 24 px; at 390 px the busiest week (Jul 27: 52 completed, 1 cancelled, 5 without an exact ID) drilled into 52, 1 and 5 listed records, and the table footers matched the tiles (240, 167, 1). The V2 panel was rendered only from synthetic runs.
- **Pending:** a sprint scope chart (R61 has no planning file); delivery and resource comparisons from real runs ([Delivery/DLV-102](<../Delivery/Delivery — Master Book.md#dlv-102>): no V2 run exists); a non-empty bug chart needs owner-declared kinds; a live relay read of the Dashboard on a real phone (parity is fixture-level); `next build` was not rerun after adding the dashboard stylesheet import to `CommandCenterLive.tsx`.
- **Provenance:** [Command Center Phase 6](<../Plans/Command Center.md#phase-6--finish-the-dashboard-calibrate-value-and-retire-duplication>).
- **Reading guide:** Phase 6, and it depends on R60 for current metrics, R61 for sprint charts and Delivery's DLV-102 for comparable-run receipts — none of which are all in place, so read the dependency states before scoping. The shared parser already exists and is the contract: `scripts/pm/shared/metrics.mjs` — `HISTORY_CATEGORIES`, `ATTEMPT_OUTCOMES`, `openWork()`, `workOutcomes()`, `bugs()`, `outcomeSeries()`, `weekOf()`/`localDayKey()`, `sprintProgress()`, `v1Outcome()`/`v2Outcome()`/`v2Disposition()` — fed by `scripts/pm/shared/history.mjs`. "Shared locally and by the relay" means `scripts/pm/relay-shared.mjs` and `src/features/pm-live/relay/` import the same module, not a copy. Bug kind must come from the explicit `**Kind:**` declaration (`scripts/pm/shared/declarations.mjs`), never from title keywords — `work-lifecycle.mjs` says so in its first line. Charts follow the `dataviz` skill. Two prohibitions to keep: no project percentage, no fabricated dates; incomplete coverage must be visible rather than smoothed. Tests: `tests/pm-ui/metrics.test.ts`, `portfolio.test.ts`.

### R63

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Shared Command Center views mounted on the phone relay through the transport seam; owner deployment/device acceptance pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Serve the shared Command Center views on the phone.

- **HELD — Delivery/DLV-97, phone acceptance.**
- **Acceptance:** Command Center Phase 4 presentation: `/pm/live` mounts the primary React views through a transport interface (local server or authenticated relay) instead of a third UI; shared components drop local-only URL and permission assumptions; static export stays read-only. Real 390 px phone/PWA acceptance is owner-observed. Command/cache recovery is [Delivery/DLV-104](<../Delivery/Delivery — Master Book.md#dlv-104>); [R42](<#r42>) keeps its device checks.
- **Implementation landed (2026-09-12); acceptance outstanding.** `scripts/pm/app/transport.ts` defines the seam (snapshot and source reads, V1 runs, dispatch mode, capability flags, V2 session/runs/run/executors, versioned V2 commands, live events, connection state) and `PendingCommand`, so a command without a final receipt renders as `Not acknowledged` / `Acknowledged` / `Outcome unknown` with Check (same id), never as a failure. `localTransport.ts` holds the requests the app always made; `api.ts` and `state.tsx` delegate; `CommandCenter.tsx` is what both shells mount (`main.tsx` locally; `src/app/pm/live/CommandCenterEntry.tsx` → `CommandCenterLive.tsx` on the phone, CSS loaded only with that chunk). Capability gates: Work Organize and Board moves (`planWrites`), V1 launch (`v1Launch`) and V1 session detail (`v1Detail`, which links to the legacy view), pairing (`pairing`), classic links (`referenceTools`), Apply (`apply`). `DeliveryV2.tsx` gains the Apply panel (Apply / Resume / Recheck / Roll back, conflicts, written/not written/changed since, integrated checks) and sends `contract_revision` with plan decisions; `App.tsx` shows the relay strip. PWA shortcuts now open `#/explore?view=board` and `#/delivery`. **Evidence:** pm-ui, relay and delivery suites in the 1961-test finish gate; typecheck, ESLint and `next build` (Turbopack) clean with `/pm/live` compiled; both local builds via `tests/pm-ui`. Synthetic render (headless Edge, same-origin iframes at true 390 and 320 px, relay capabilities, real PM corpus, synthetic V2 run): Home, Delivery, the Run view with the Apply panel, a pending Apply showing `Acknowledged · Check`, and a Work item — no horizontal overflow, relay strip present, no Organize control and no classic links. **Not evidenced:** a real phone or installed PWA, a live relay read or command, swipe/haptics (R42), theme interplay with the household ThemeProvider on the deployed route.
- **Provenance:** [Command Center Phase 4](<../Plans/Command Center.md#phase-4--deliver-the-same-workflow-from-the-phone>).

### R58

**Outcome:** Restore ERA's theme and correct PM connectivity detection.

- **Cause:** R57 introduced independent green/cream palettes. Its health route handled GET only, so the shared client's HEAD probe received 404 and marked the app offline despite successful data reads. The earlier preview accepted every method and masked this mismatch.
- **Change:** existing ERA Blue/Pink surface and accent values, dark module covers, themed dialogs and browser chrome; saved light/dark values migrate to Blue. `scripts/pm/health.mjs` serves uncached GET/HEAD and is called by the production server and test fixture. The primary shell includes `mobile-web-app-capable` alongside Apple compatibility metadata.
- **Verification (2026-09-11):** 189 tests across 20 PM UI/Delivery-route files, including actual HTTP HEAD/GET responses, empty HEAD bodies, no-store and unsupported method/path fallthrough. Isolated Chromium exercised initial and periodic real HEAD probes (all 200), genuine service-worker offline reload and reconnect, legacy preference migration, Blue/Pink persistence, desktop/390/320px layouts and opaque capture sheets. No browser errors or online console warnings; no mutation requests. Typecheck passes; lint reports zero errors and 911 pre-existing warnings.
- **Runtime boundary:** the owner's existing server returned HEAD 404 / GET 200 before restart. Browser checks use the same corrected health handler in a read-only isolated preview; normal PM startup, live Delivery and the production bridge were not run by this check. Restart `pnpm pm` and reload to activate the backend fix.
- **Provenance:** owner's two-point theme and false-offline correction request, 2026-09-11.

### R57

**Outcome:** Reboot PM as a focused, enjoyable application for running ERA.

- **Diagnosis:** the owner rejected R54/R56’s dashboard composition, permanent inspector, explicit Area/Topic distinction and desktop-derived phone layout. Their data models remained useful.
- **Acceptance:** visual Today briefing with actual priority counts, all eleven swipeable spaces, attention and active Delivery; dedicated space/outcome journeys; natural global discovery; four progressively opened backlog collections; two-step launch with secondary technical settings; real run stages, plan steps, checks, resources, changed files, reviews and evidence; keyboard sheets, responsive layouts, reduced motion, offline reading and guarded planning Undo.
- **Architecture:** `scripts/pm/app/` is the typed React app. `app-build.mjs` emits separate ESM JavaScript and CSS, and `app-shell.mjs` is a data-free bootstrap. Existing `pm-server.mjs` serves these assets, `/api/data`, SSE and existing Delivery routes. Shared `safeFetch` and connectivity probing protect writes; feature query keys and post-mutation invalidation keep views current. The server adds `/api/health`, optional expected-line checks for toggle/ship/discard and guarded post-write Undo snapshots. The whole restore batch is checked before any write.
- **Data boundary:** Markdown remains the only backlog. Read models, dependency direction, exact IDs, cancelled/shipped separation and recorded runtime projections are reused. Canonical CRLF checkbox scanning now preserves Windows rows and ordinal witnesses. Search excludes verification/provenance boilerplate; visual counts describe recorded open work and dated shipments, not project percent-complete.
- **Verification (2026-09-10):** 186 tests across 19 PM UI/Delivery-route files pass, including the new application build, canonical discovery/identity/history and stale-file/whole-batch Undo cases. Isolated Chromium walkthroughs cover 1440px desktop and 390/320px phones, light/dark, module/search return, bounded lists, launch witnesses and dirty-tree acknowledgement, scope/plan gates, artifact focus/Escape, recorded steps, pause/resume, guidance, transcript, dead-runner restart, accept/ship, failed-read retry and held V2 setup. A separate real service-worker check reopens cached shell/JS/CSS/data offline, disables mutations and reconnects. In-memory document tests exercise complete, move, discard, capture and Undo with query refresh.
- **Retained secondary tools:** `?ui=classic` serves source browsing, file operations, rollups and advanced Delivery context/configuration; `?ui=old` remains the older rollback. Portable HTML and hosted `/pm` keep the Preact read-only experience. `/pm/live` remains the independent authenticated relay. V2 qualification/dispatch is still held under R55/DLV-96/DLV-97.
- **Verification limits:** no live provider run, production data mutation, real phone installation or hosted deployment. The UI tests use copied/in-memory documents and simulated execution; normal server boot writebacks/monthly sweep were not executed. R6/R37/R42/R51 keep their remaining acceptance; this commission does not authorize executing project backlog items.
- **Provenance:** owner’s Product Experience Reboot commission on 2026-09-10.


### R56

**Outcome:** Make the whole project understandable through continuous area, topic, work and Delivery exploration.

- **Diagnosis:** R54's opening queue obscured the project shape; only four campaigns were visible, cross-area context remained in book prose, and routine exploration required full-page changes.
- **Acceptance:** all eleven canonical areas on the opening map; topic perspectives over the same work; Now, explicit blocking, owner choices and active execution; inline work previews; linked prerequisites/downstream work/decisions; detailed contracts and matching evidence on demand; stable return context through launch, run tabs, decisions and area pages; topic and area outcome history; mobile keyboard and static parity.
- **Evidence (2026-09-10):** 175 PM UI and Delivery-route tests pass, including ten portfolio cases for shorthand/dotted IDs, dependency direction, unresolved/cancelled references, scope-only topic evidence, separate history and route identity. Chromium walkthrough against the actual PM corpus and isolated Delivery fixtures passed at 1536/1280/1024/768/390 px, with light/dark, cross-area selection, dependency preview, launch/cancel/run return, tab retention, live-run filtering, focus containment, Escape and static mode. Typecheck, lint (including explicit JSX), bundle and PM grammar checks complete the finish gates.
- **Read model:** `scripts/pm/src/lib/portfolio.js` derives topics, references and dependency states. No new persisted labels, task database or runtime state. Severity is not a dependency; an open related decision alone is not a blocked dependency. Missing references remain unresolved. Topic assignments are deterministic search perspectives with inspectable source evidence, not an asserted exhaustive ontology.
- **Continuity:** `ProjectExplorer.jsx` owns the map and inspector; `WorkItem.jsx` owns the dedicated work screen and shared relationship display. Existing Delivery APIs, mutation guards and review controls remain authoritative. Project run summaries refresh while visible; actual provider execution, real devices and hosted deployment were not exercised.
- **Deliberate omissions:** no decorative network graph, flip-card interaction, duplicate backlog, generated project-health score, invented progress percentage, metadata editor or new execution engine.
- **Provenance:** owner's 2026-09-10 Second UX Pass commission.

### R54

**Outcome:** Refactor the PM product journey from overview through Delivery outcome.

- **Acceptance:** canonical campaign cards and work Board/List, stable item details with book acceptance/related decisions, direct guarded launch, live state/plan/activity/files/checks/resources/handoff, recoverable errors, keyboard-operable dialogs, desktop/mobile layouts and static read-only parity.
- **Evidence (2026-09-10):** `tests/pm-ui/product-model.test.ts`, `session-model.test.ts`, `session-races.test.ts`; PM UI plus Delivery server-route suite: 165 tests passed. Browser fixture walkthrough covered scope/plan review, late artifact close, pause/resume, accept/ship, error retry, V2 readiness and static mode. Full typecheck and bundle passed. The repository lint command and explicit `eslint --ext .jsx` checks on every changed JSX component pass; esbuild and browser execution also verify JSX.
- **Architecture:** `scripts/pm/src/lib/product.js` and `app/productStore.js` are derived read models only. `features/delivery/sessionModel.js` projects recorded runtime evidence. No execution engine, SDK, policy or production data change. The sole server payload extension is the explicit read of `_Archive/Cancelled Log.md`, used only for outcome history and never added to scanned files, work, search or dispatch.
- **Preserved:** the portable static build, hosted prebuild pipeline, `--ui=old` rollback, source tools, canonical mutation/Undo APIs, Delivery controls and review gates, and the separate `/pm/live` app. Stable item navigation and launch checks do not claim to fix the remaining ordinal-mutation/Undo work in R51.
- **Provenance:** owner's 2026-09-10 Full Product UI/UX Refactor commission.

### R55

**Remaining engineering (2026-09-15):** complete attempt pagination/filter retention, retry ancestry and active V2 activity on Home. Stable Work history and Done-item links exist; do not rebuild them.

**Outcome:** Page and filter Delivery history across Work and Home.

- **2026-09-14 scope:** fixture-backed presentation work is ready under the owner's hotfix commission; further native trials await the resource gates in Delivery DLV-114/119 and existing DLV-97 acceptance. Earlier qualification holds below describe the pre-trial state.
**Kind:** feature
**Touches:** `scripts/pm/app/Work.tsx`, `scripts/pm/app/Home.tsx`, `scripts/pm/app/Delivery.tsx`, `scripts/pm/app/state.tsx`, `scripts/pm/app/model.ts`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/types.ts`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/pm/relay-shared.mjs`, `src/features/pm-live/relay/`, `tests/pm-ui/`, `tests/delivery-v2/`
- **Hotfix acceptance:** [packet G](<../Plans/Delivery First-Run Hotfix.md>) adds visible permanent history keyed by stable work identity for active, failed, cancelled, verified, applied and rolled-back attempts, including moved/shipped/discarded items. Separate attempt number from plan revision, candidate generation, Result version and application events. Retain explicit retry ancestry, exact deep links and originating filters through Back/Forward/reload/second-tab/offline views. Native observations and application state remain authoritative; no invented successful job or removed runtime history. Verify local/relay parity and retain V1 receipts.
- **Acceptance:** once qualification and dispatch policy are accepted, map the canonical V2 job lifecycle, executor identity, refusal reasons, check evidence and Result disposition into the run and outcome views. Use V2 routes and preserve admission/approval/evidence boundaries; never fall back to V1 or invent a running job after admission. Verify real event shapes with fixture and admitted pilot evidence. Reuse the R54 layout and keep V1 history readable.
- **Command Center mapping (2026-09-11):** Phase 3 connects the canonical V2 list/detail/events/decision/control/result projections to Delivery and Run here, including per-run executor, model and effort.
- **Review delta (2026-09-13):** `scripts/pm/app/state.tsx:143` / `:181` expose only V1 sessions through `useWorld().runs`; `Home.tsx:15`, `model.ts:129` and WorkView's `runFor` consume them. `Delivery.tsx` separately queries V2. Acceptance must also cover Home/attention and Work's Follow delivery action for an active or review-waiting V2 run, locally and over relay, with stable campaign/item identity and no duplicate display beside V1 history. Source-verified gap; no real V2 session exists to provide device evidence.
- **Phase 3 presentation landed (2026-09-12), acceptance still held:** `scripts/pm/app/DeliveryV2.tsx` + `v2model.ts` read `journey.mjs` projections over paired-session routes (`api.ts` `v2Read`/`v2Post` send `x-era-csrf`; command ids minted per intent and reused on retry). Launch in v2 mode offers Claude/Codex with a one-word refusal when unqualified/unpermitted, Focused/Investigate, catalog model and SDK-supported effort; `#/delivery/run/<id>` shows the stage projection, blocking questions and plan Approve/Revise above activity, observed agents only, “Not tested” for zero-test checks, Result obligations, unknown cost as “Unknown”, guidance receipts and Pause/Resume/Stop/Reconcile/Retry writeback. The Delivery list shows V2 runs beside V1 sessions with explicit engine labels (`V1 ·` / `V2 ·`); V1 views are unchanged. Evidence: `tests/pm-ui/delivery-v2-model.test.ts` (8), pm-ui 128/128 incl. both builds, typecheck and ESLint clean; in a real browser against a synthetic fixture server (real bundle, V2 routes and journey; scripted executors), pairing by code loaded the run, and `#/delivery`, both run states and `#/deliver/Budget/BUD-14` had no horizontal overflow or sub-36 px controls at 390 and 320 px (same-origin iframe probe; window resizing had no effect, as in R60). **Not yet evidenced:** real event shapes from an admitted pilot (none can run until DLV-96/97 qualify an executor), phone/PWA. See [Delivery DLV-97](<../Delivery/Delivery — Master Book.md#dlv-97>).
- **Provenance:** R54 product implementation exposed this dependency; dispatch/qualification remain owned by Delivery.
- **Reading guide:** Presentation landed 2026-09-12; only paging and filtering remain, and the acceptance is held on an admitted pilot that cannot run until DLV-96/97. The views are `scripts/pm/app/Work.tsx` (`WorkView`, `selectionFromRoute`), `scripts/pm/app/Home.tsx` (`Home`) and `scripts/pm/app/Delivery.tsx`, over `scripts/pm/app/model.ts` / `v2model.ts` / `types.ts` and query keys in `state.tsx`. V2 history comes from `journey.mjs list()`/`detail()`/`events()` and the row readers in `scripts/delivery-v2/store.mjs`; V1 history comes from `scripts/pm/shared/history.mjs`. Relay parity means the same shapes through `scripts/pm/relay-shared.mjs` and `src/features/pm-live/relay/`. Reuse the R54 layout, keep V1 readable, and never invent a running job after admission. Delivery's DLV-121 is the same paging problem on candidate artifacts — check it before designing a second scheme. Tests: `tests/pm-ui/delivery-v2-model.test.ts`, `session-model.test.ts`.

### R43

**Outcome:** Verify hot-child RLS and read contracts.

- **Acceptance:** Verify current hot-child RLS and read-path contracts before deciding whether Hard Rule 20 needs any amendment or DB change. schema.sql alone cannot establish the policy state; no guessed denormalization or policy rewrite.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Evidence-gathering, not code. Hard Rule #27 governs the whole item: **`migrations/db-state.json` is the only repo artifact permitted as evidence about RLS** — generated by the owner running `migrations/db-state.sql`, validated by `pnpm db:verify-rls`, and reported on by the SessionStart hook `.claude/hooks/session-brief.sh`. `schema.sql` is tables-only and has actively lied here before. The hot child tables Hard Rule #20 names are `item_alerts`, `item_subtasks`, `reminder_details`, `event_details`, `item_recurrence_rules`, `recurrence_pauses`; the two sanctioned patterns are a SECURITY DEFINER bundle RPC (`get_schedule_bundle`, `get_health_bundle`, `get_household_allergens` are the live examples) or a denormalized `user_id` with a direct policy. Read the bundle read paths in `src/app/api/` that consume them before proposing any amendment. No policy rewrite and no denormalization on a guess.

### R44

**Outcome:** Guard new client mutations against raw fetch.

- **Acceptance:** *(hygiene packet **H-02** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>))* Add an eslint guard for Hard Rule 6 so no *new* raw mutating `fetch()` can enter client code — a `no-restricted-syntax` rule scoped to the client directories (components, features, hooks, contexts), warn-level until the existing 98 sites are burned down → `eslint.config.mjs`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small and precisely located: `eslint.config.mjs`. It already has the scoped-override shape you need — there is a `files: [...] / rules: {...}` block near the end scoping `react-hooks/exhaustive-deps` to the client directories, and another scoping `@typescript-eslint/no-explicit-any`. Copy that structure for a `no-restricted-syntax` rule over `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/`. What it must catch is `fetch()` with a mutating method, per Hard Rule #6; the sanctioned replacement is `safeFetch()` from `src/lib/safeFetch.ts` — read its header for why a timeout is not an offline signal. Warn-level only until R48 reaches zero. `tests/pm-ui/lint-rules.test.ts` is where PM-side lint expectations are asserted.

### R47

**Outcome:** Enforce the client-only console rule.

- **Acceptance:** *(bundled with R44 into hygiene packet **H-02**)* Scoped `no-console` eslint rule matching Hard Rule 22's corrected client-only wording, warn-level over the client directories (202 sites); server routes stay exempt by design → `eslint.config.mjs`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Same file and same shape as R44: a scoped override block in `eslint.config.mjs` turning `no-console` on for `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/` and `page.tsx` files only. The rule's wording matters — Hard Rule #22 was *corrected* on 2026-08-01 to client-only, and `console.error` under `src/app/api/` is permitted by design (it is the Vercel log stream), so the override must not reach server routes. The stated 202 sites are a historical count, not a target; recount before claiming progress. Warn-level.

### R6

**Outcome:** Verify the replacement PM UI before retiring rollback files.

- **Acceptance:** Complete the desktop + 390 px visual UAT and a fake-driver delivery walkthrough, then delete the legacy `client.js` / `styles.css` / `body.html` and the `?ui=old` rollback surface
- **Command Center Phase 6 (2026-09-11):** retiring duplicate presentation and control paths happens here after R60 and the Delivery trial (DLV-102); extract shared parser/model dependencies first and keep V1 history readable.
- **Phase 6 status (2026-09-12): dependencies extracted; nothing retired.** `shared/product.mjs`, `portfolio.mjs`, `history.mjs` and `metrics.mjs` now serve the primary app, bridge and relay; `scripts/pm/src/lib/` only re-exports for the classic build. Retirement did not start: the DLV-102 trial has no receipts, and this gate's desktop/390 px UAT of classic-only journeys (document checkboxes, file operations, the fake-driver three-gate walkthrough) was not rerun — the React Reader is still read-only. Candidates once those pass: `?ui=old` (`client.js`, `body.html`, `styles.css`, `buildHtmlLegacy`); `?ui=classic` presentation once its remaining tools have React replacements; `/pm/live?ui=legacy` after R63/R42 phone acceptance. Keep: the static/hosted read-only export and the V1 session reader.

**Retained contract — ASTRA-R-3:**

- **Outcome:** One maintained desktop UI serves the owner and every successor agent.
- **Money/schedule math?:** No.
- **Gate:** `pnpm vitest run tests/pm-ui/build-smoke.test.ts tests/pm-ui/static-twin.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests. `rg -n "buildHtmlLegacy|ui=old" scripts/pm/ui.mjs scripts/pm-server.mjs` → no matches, exit 1 expected. `Get-Item -LiteralPath scripts/pm/client.js,scripts/pm/styles.css,scripts/pm/body.html -ErrorAction SilentlyContinue` → no output. UAT evidence at desktop and 390px: Overview, Work Queue filters/reload, document checkboxes, Search, Inbox, fake-driver launch/three gate decisions/final acceptance; static twin offers no mutations. `pnpm typecheck` and `pnpm pm:lint` → exit 0.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Deletion gated on verification. The files to retire exist and are real: `scripts/pm/client.js`, `scripts/pm/styles.css`, `scripts/pm/body.html`, and the escape hatch is documented in `scripts/pm/ui.mjs` ("`--ui=old` or `?ui=old` keeps the proven legacy surface available during final parity QA") — grep `ui=old` there before deleting anything, because the flag is also plumbed through the server. The replacement is the React app under `scripts/pm/app/` built by `scripts/pm/build.mjs` and served via `scripts/pm/app-shell.mjs`. Existing coverage to lean on: `tests/pm-ui/build-smoke.test.ts`, `react-app-build.test.ts`, `static-twin.test.ts`. The 390 px visual UAT and the fake-driver walkthrough are the two things no test currently proves — do them before the delete, not after.

### R45

**Outcome:** Resolve the mutation-toast Undo rule.

- **Acceptance:** Held for DEC-07: distinguish confirmation toasts from error/information toasts, then owner changes the global rule and the gap is measured against the agreed scope. This PM refactor does not waive Hard Rule1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-07; the deliverable is a recorded owner decision, not an edit. Hard Rule #1 currently says *all* toasts carry Undo, and the question is whether a pure confirmation or error toast should. Survey before proposing: the toast vocabulary is `ToastIcons` in `src/lib/toastIcons.tsx`, and the best-behaved examples are `src/components/notifications/CriticalAlertGate.tsx` and the optimistic mutations in `src/features/*/hooks.ts`. Record the resolution in `_Decisions.md`; this PM refactor does not waive the rule in the meantime.

### R42

**Execution:** owner
**UAT:** pending

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes.

- **Acceptance:** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes — the tap path is known-flaky against `scroll-snap-mandatory` + `scrollTo({behavior:"smooth"})` in at least one automated-browser environment; also confirm haptics, safe-area insets, and the new `pm-live.webmanifest` install → `src/components/pm-live/session/SegmentedPanes.tsx`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### R34

**Outcome:** Surface the oldest small hygiene item in session briefs.

- **Acceptance:** The recurring review ritual is defined in _Conventions.md. Remaining work: existing session-brief freshness radar identifies the oldest open S-effort item; use current backlog identity, no new subsystem.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small, and it attaches to something that already exists: `.claude/hooks/session-brief.sh` is the SessionStart hook that injects the freshness brief (it already reports DB-snapshot staleness for Hard Rule #27). Add the oldest open S-effort item to it. Backlog identity comes from the existing parsers — `scripts/pm/shared/tasks.mjs` and `scripts/pm/shared/work-id.mjs` parse `- [ ] **ID** title _(severity - effort)_`, and `scripts/pm/shared/metrics.mjs` `openWork()` already enumerates open work with `SEVERITIES`. "No new subsystem" is the constraint: read the checklists through the existing scanner, do not add a second one.

### R51

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

### R48

**Outcome:** Replace raw client mutation fetch calls.

- **Acceptance:** Recount current raw mutating fetch calls; replace with safeFetch starting with Hub shopping and notification writers. Pass explicit timeoutMs for AI/uploads/external latency; timeout is not offline and must not enqueue duplicates. Flip R44 guard to error only after the current scope reaches zero. Historical counts 98/13/8 are not targets.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The burn-down half of R44, and the acceptance is explicit that the historical 98/13/8 counts are not targets — recount first with a grep for mutating `fetch(` under `src/components/`, `src/features/`, `src/hooks/`, `src/contexts/`. Read `src/lib/safeFetch.ts` before replacing anything: it does a pre-flight online check, defaults to an 8 s timeout, and — the subtle part — treats a timeout as latency, not disconnection, probing `/api/health` before `markOffline()`, so `isOfflineError()` stays false for endpoint timeouts and they cannot enqueue a duplicate mutation. That is why AI calls, uploads and external APIs must pass an explicit `timeoutMs` (Hard Rule #6). Start where the acceptance says: the Hub shopping writers in `src/components/hub/ShoppingListView.tsx` and the notification writers in `src/hooks/useNotifications.ts`. Offline queue background: `ERA Notes/01 - Architecture/Sync and Offline.md`. Flip R44 to error only at zero.

### R36

**Outcome:** Type the shared PM parsing core.

- **Acceptance:** JSDoc-type the `shared/` parsing core so typecheck guards the scanner everything else trusts — five files of pure functions, with the `lint.mjs` fix as the template → `scripts/pm/shared/md-scan.mjs`

**Retained contract — ASTRA-R-4:**

- **Outcome:** A wrong parser contract fails validation before it changes the owner's board.
- **Money/schedule math?:** No.
- **Gate:** `pnpm exec tsc --project scripts/pm/tsconfig.shared.json` → exit 0 with no emission; deliberate fixture/probe type error must have exited nonzero before removal, with diagnostic recorded. `pnpm vitest run tests/pm-ui/shared-parsing.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests, same corpus behavior. `pnpm typecheck` and `pnpm pm:lint` → exit 0. CI log includes the dedicated command on the tested commit; merely having a config file is insufficient.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Scope has drifted: the acceptance says "five files of pure functions", but `scripts/pm/shared/` now holds twelve — `md-scan.mjs`, `tasks.mjs`, `text.mjs`, `work-id.mjs`, `work-lifecycle.mjs`, `declarations.mjs`, `frontmatter.mjs`, `history.mjs`, `links.mjs`, `metrics.mjs`, `portfolio.mjs`, `product.mjs` (verified 2026-09-20). Re-scope before starting. The mechanism: `tsconfig.json` already sets `allowJs: true`, and **no file in `scripts/pm/` currently carries `@ts-check`**, including the `lint.mjs` the acceptance calls the template — so check what "the lint.mjs fix" actually refers to rather than assuming it is done. `md-scan.mjs` (`scanCore`, `scanLines`) is the root everything else trusts, so type it first. Existing behavioural cover: `tests/pm-ui/shared-parsing.test.ts`, `work-identity.test.ts`, `ordinal-parity.test.ts`.

### R37

**Outcome:** Verify local shell and static data provenance.

- **Acceptance:** Verify local shell/data compatibility and static source provenance with explicit build/cache fixtures; ordinal-parity and static embedding tests alone do not prove cache freshness. Preserve hosted follow-up boundaries.

**Retained contract — ASTRA-R-2:**

- **Outcome:** The desktop identifies its source snapshot and refuses writes when cached shell and data are incompatible.
- **Money/schedule math?:** No.
- **Gate:** `pnpm vitest run tests/pm-ui/static-twin.test.ts tests/pm-ui/build-smoke.test.ts` → all pass, nonzero tests. Same bundle inputs yield same identity; changed JS/CSS changes identity; changed Markdown changes source identity; timestamp alone does not change content identity; mixed format fails writable-mode eligibility; compatible stale payload remains read-only when offline. `pnpm typecheck` and `pnpm pm:lint` → exit 0. Desktop/390px source-copy fixture screenshot: live, compatible offline snapshot, and incompatible shell/data are distinguishable; write control is disabled in the last two. Launch only the copied server under the Execution contract, with `--no-bridge`; include resolved fixture/write paths with UAT evidence.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two separable claims, and the acceptance says the existing tests do not prove them. Read `scripts/pm/app-shell.mjs` first — its opening line is the provenance statement ("The local app fetches canonical Markdown through /api/data; HTML contains no snapshot") — with `appAsset()` and `buildAppShell()`, and `scripts/pm/build.mjs` (`buildBundle`, `createBundleWatcher`) for how the bundle is produced. Existing tests that are *not* sufficient on their own: `tests/pm-ui/static-twin.test.ts`, `ordinal-parity.test.ts`, `build-smoke.test.ts`. What is missing is a build/cache fixture: a stale cached shell against fresh data must refuse writes. The write path to refuse in is `scripts/pm/mutations.mjs` with `scripts/pm/write-guards.mjs` (`assertExpectedCheckbox`, `guardUndo`, `assertRestoreCurrent`). R53 depends on this.

### R38

**Outcome:** Surface retained session histories in the freshness radar.

- **Acceptance:** The 90-day closed-history retention convention is implemented. Remaining work: existing freshness radar identifies histories eligible for archival without archiving an open decision, active incident or evidence needed by pending work.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The retention convention is written; the radar work is not. The brief is `.claude/hooks/session-brief.sh` (shared with R34 — do both in one pass if you touch it). Closed session histories are parsed by `scripts/pm/shared/history.mjs`, and `scripts/pm/archive.mjs` is the existing archival mechanism (`pnpm pm:archive`, with `--undo`). The safety clause is the real work: eligible-for-archival must exclude an open decision, an active incident, or evidence a pending item still cites — `scripts/pm/shared/links.mjs` is how cross-references are resolved, and `_Archive/` is invisible to every PM tool, so archiving something still referenced makes it unreadable.

### R8

**Outcome:** Measure index responsiveness on the largest note and on the complete static twin.

- **Acceptance:** Measure index responsiveness on the largest note and on the complete static twin

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Measurement, not a change. The index is the React app under `scripts/pm/app/` (search is `Explore.tsx` with `tests/pm-ui/search.test.ts`); the "complete static twin" is the fixture exercised by `tests/pm-ui/static-twin.test.ts`. Largest note: find it with a size sort over `ERA Notes/` rather than assuming. Record numbers; R9 only unparks if this proves offline load materially slow.

### R9

**Outcome:** Font subsetting.

- **Acceptance:** Font subsetting — only if offline load proves materially slow

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked and conditional on R8 — do not start it without that measurement. Fonts are loaded in the PM app's own stylesheets (`scripts/pm/app/styles.css`, `brand.css`) and the bundle is built by `scripts/pm/build.mjs`; the main web app's fonts are separate and out of scope here.

### R53

**Outcome:** Make phone Inbox capture visible and identifiable.

- **Acceptance:** Command Center mobile read-model gap: a new raw Inbox entry remains visible with stable identity and a receipt after refresh. Preserve owner-bound cache semantics; this is not a prerequisite for the V2 pilot.
- **Depends on:** [R37](<PM Tooling — Master Book.md#r37>).

**Provenance:** [PM Tooling — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/PM Tooling/PM Tooling — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on R37 (provenance/cache), and the symptom is a read-model gap, not a write failure — so confirm the capture actually persists before touching the UI. The Inbox file is `ERA Notes/10 - Project Management/0 - Inbox.md`; the readers are `scripts/pm/app/Auxiliary.tsx` (the desktop view), `scripts/pm/check-docs.mjs` and `scripts/pm/bridge.mjs` (the phone relay). Note there is also a legacy `scripts/pm/src/features/inbox/InboxView.jsx` under the old UI — R6 is retiring that surface, so do not fix it there. Stable identity plus a receipt after refresh is the same durability problem the relay solves elsewhere: read `src/features/pm-live/relay/` and the bridge's command journal. Owner-bound cache semantics must be preserved. Filing raw captures is `.claude/skills/triage-inbox/SKILL.md` — this item is about visibility, not triage.

## Backlog reconciliation

- Existing aliases: open R7 → R51 (historical R7 remains reserved); open CI R49 → HUB-37 (historical R49 remains archive automation).
- 2026-09-10 — R35 governance complete; R34/R38 retain only freshness-radar implementation.

## Shipped Log

- ✅ 2026-09-15 — **R66** Removed Delivery launch/footer noise and rebuilt review hierarchy around visible plan sections, verification history, run facts and final Changes/Apply; unavailable executors now reveal their actual blocker. (Targeted tests, React bundle, typecheck and lint; browser UAT pending.)

- ✅ 2026-09-15 — **R65** Actionable To do, searchable Done, completed scope/session history, separate owner UAT, and shared V1/V2 launch guards. Reconciled 11 prior implementations and 11 manual checks; split remaining engineering. (800 passing tests, typecheck/lint, 28 browser observations; [UAT](<../../../docs/Delivery-UAT.md>).)

- ✅ 2026-09-11 — **R51** Witnessed task mutations and guarded Undo implemented under R59; remaining owner acceptance moved to UAT. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../docs/Delivery-UAT.md>).)

- ✅ 2026-09-12 — **R63** Shared Command Center views mounted on the phone relay through the transport seam; owner deployment/device acceptance pending. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../docs/Delivery-UAT.md>).)

- ✅ 2026-09-15 — **R64** Responsive Delivery review workspace implemented and browser-verified at 320 through 1920 px; physical-phone UAT pending. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../docs/Delivery-UAT.md>).)

- ✅ 2026-09-10 — **R57** Replaced the primary dashboard with the React ERA application, focused mobile/desktop journeys and truthful Delivery story — [evidence](<PM Tooling — Master Book.md#r57>)

- ✅ 2026-09-10 — **R56** Added whole-project area/topic exploration, contextual work previews, dependencies and continuous Delivery return paths — [evidence](<PM Tooling — Master Book.md#r56>)

- ✅ 2026-07-13 — **R-series** the Preact/esbuild Command Center became the default dashboard: hash routes, history, themes, module/document views, backlinks, interactive checkboxes, task board + table, global search, rollups, file operations, re-skinned Delivery
- ✅ 2026-07-13 — checkbox identity got a constructional guard: one dependency-free scanner serving mutations, Markdown, tasks and tests, with a 358-file parity test against the literal legacy algorithm
- ✅ 2026-07-13 — the portable twin builds from the same bundle with Geist vendored and inlined, and Delivery/edit entry points hidden in static mode
- ✅ 2026-07-17 — the PM Center became an installable PWA with an opt-in LAN mode (house-style icon family, `pm.webmanifest`, DNS-rebinding host guard, 23 new net-guard tests)
- ✅ 2026-07-17 — a dedicated mobile home + bottom nav below 700 px, with a "needs your decision" feed sourced from the existing delivery `awaiting` field
- ✅ 2026-07-17 — Delivery gates, questions, monitoring and the launch wizard made usable one-handed (48 px targets, `?tab=` deep links to Q&A, horizontally scrolling tabs, full-screen modals below 700 px)
- ✅ 2026-07-17 — long checklist items stay readable: a shared `TaskCard` (chips on one line, full text wrapped, never truncated) grouped into collapsible lanes with a campaign filter
- ✅ 2026-07-18 — **R16** the read-only PM Console shipped as a first-class page of the deployed app at `/pm` — own manifest and icons, installable on a phone, offline via the app service worker, laptop off; rebuilt by `pnpm pm:public` in `prebuild`, gated behind the app's Supabase login
- ✅ 2026-07-18 — **R15** superseded by R16: the phone-offline goal is met by hosting inside the already-HTTPS deployed app, so no self-signed-cert LAN path is needed
- ✅ 2026-07-18 — **R26** `lintChecklist` JSDoc typing fixed — `pnpm typecheck` had been broken repo-wide for five days by an untyped options bag
- ✅ 2026-07-22 — **R27** Idea Inbox: `0 - Inbox.md` capture surface (New/Processed), the 💡 topbar quick-capture reusing the existing `append` mutation with no server changes, the `/triage-inbox` skill, and the §7 grammar
- ✅ 2026-07-25 — **R28** the Delivery launch wizard became a full page (`#/delivery/new`) instead of a 620 px-capped modal, with the flight-check grid replaced by a masonry `columns` layout
- ✅ 2026-07-25 — **R29** `/pm/live` shipped as the third mobile surface: live checklist + live delivery control fed by an outbound-only Supabase relay, distinct from the frozen `/pm` snapshot and the loopback-only `pnpm pm`
- ✅ 2026-07-30 — **R30** hide-completed made real: the document view now partitions each list and collapses completed rows behind a per-list "N completed hidden — show" pill (clicking it clears the toggle, so the affordance leads somewhere), and the control moved to the topbar where it is reachable at every width instead of living in the off-canvas sidebar (`scripts/pm/src/features/doc/Markdown.jsx`, `app/App.jsx`)
- ✅ 2026-07-30 — **R31** Search and the Idea Inbox became first-class destinations: sidebar entries, mobile tabs (Checklist stepped out of the 5-tab bar, being one tap from Home), command-palette actions, a dedicated `#/inbox` route with New/Processed lists and inline capture, and `lane:` / `e:` / `id:` added to the query language — with `idChip` and `effort` promoted to stored fields so the filters can actually read them (`features/inbox/InboxView.jsx`, `features/search/queryLang.js`)
- ✅ 2026-07-30 — **R32** a real board toolbar on Tasks and Checklist: always-visible search, one-tap quick-filter chips (Blockers / Now / Small / Done), native group-by and sort-by selects, and **filter state in the URL** — `#/tasks?q=…&group=…&sort=…` survives a reload and can be pasted to yourself. Defaults are omitted from the hash so an unfiltered board keeps a clean link. The logic is pure and tested (`boardState.js`, 16 cases); Bugs gained the same search + severity chips (`features/tasks/BoardToolbar.jsx`)
- ✅ 2026-07-30 — **R33** visual pass: sticky lane headers on both the board and the checklist rollup, tabular-figure count pills, ~20% tighter cards, a checkbox press animation, per-lane "Nothing here." states and a Clear-filters action in the empty state — all behind `prefers-reduced-motion` (`styles/tasks.css`)
- ✅ 2026-07-30 — memory files refreshed for the new layout (`project_pm_command_center`, `project_fable_handoff`, `project_agentic_delivery_workspace`) and the last delivery-script comment paths repointed at the Master Books
- ✅ 2026-07-30 — **R7** vault consolidation: every campaign reduced to a Master Book + `4 - Checklist.md`, superseded layers moved to `_Archive/` and made invisible to every PM tool (`scan.mjs` skip), the lint campaign map, bridge rollups/history reads and delivery packet-context reads repointed at the books, and CLAUDE.md / skills / `00 - Home` indexes updated
- ✅ 2026-07-31 — **R39** `/pm/live` rebuilt phone-only (owner: "too cluttered, texts are too much, size is too small") — the `lg:` desktop layout and `SideNav` are gone, nav is 4 tabs + a raised centre Capture FAB (long-press = quick Launch), a 12px content-text floor with `neo-card`-style elevation replaces the old 4%-opacity/10px surface, Board rows and detail sheets stop printing the ID chip and severity/effort twice (see R40), Campaigns is reachable on the phone for the first time (was `desktopOnly`), Usage moved off the tab bar onto a Home "Spend" tile, and `/pm/live` gained its own installable manifest (`public/manifests/pm-live.webmanifest`, distinct from `/pm`'s). All four session panes (Q&A/Chat/Files/Cost) kept, enlarged, with badge counts always visible.
- ✅ 2026-07-31 — **R40** fixed the display-layer duplication bug: `PmTask.text` still carries the ID chip and the `(severity - effort)` suffix because `cleanInlineText()` in `scripts/pm/shared/text.mjs` strips the underscores the meta-regex needs before that regex runs, so it never matches — every row rendering the ID chip and severity/effort as their own affordances was printing both twice. Added `displayText(task)` in `derive.ts` (display-only; `task.text` stays the raw search corpus) with test coverage in `tests/pm-live-derive.test.ts`. The upstream one-line fix in `text.mjs` was deliberately not taken here — shared by `lint.mjs`, the desktop Preact app and the bridge, wider blast radius than a UI pass — see the `## Next` item below.
- ✅ 2026-08-01 — **R49** Automate the checklist sweep — Ship / Discard row actions with Undo, a git-dated `pnpm pm:archive` CLI, and a once-a-month auto-sweep on `pnpm pm` boot; discarded items land in `_Archive/Cancelled Log.md` → `scripts/pm/archive.mjs`
- ✅ 2026-08-03 — **R41** fixed the shared task-text stripping order so every PM consumer receives clean prose instead of duplicated ID/severity metadata (`shared/text.mjs`; parsing regression test)
- ✅ 2026-08-03 — **R50** transformed `pnpm pm` around real owner workflows: action-led Overview, movable Work Queue with undoable Markdown lane changes, portfolio Projects, unified Activity/audit history, visible execution lanes, compact preview-aligned light/dark themes, and responsive workspace navigation (`scripts/pm/src/`; 60 PM UI tests + bundle + typecheck)

- ✅ 2026-09-10 — **R35** Meta-work budget and explicit owner-commission exception established in _Conventions.md.
- ✅ 2026-09-10 — **R52** Refactored the full PM knowledge system: canonical queues/criteria, accepted plans, decision and option disposition, archive provenance, templates and navigation; validation recorded in the refactor receipt.
- ✅ 2026-09-10 — **R54** Refactor the PM product journey through Delivery outcome — [evidence](<PM Tooling — Master Book.md#r54>)
- ✅ 2026-09-11 — **R58** Restore ERA's theme and correct PM connectivity detection — [evidence](<PM Tooling — Master Book.md#r58>)
- ✅ 2026-09-11 — **R59** Repaired canonical work identity, acceptance lookup and source/history links; checkbox writes refuse stale, duplicate and witness-less targets — [evidence](<PM Tooling — Master Book.md#r59>)
- ✅ 2026-09-11 — **R60** Completed Home, Work Board/List and module views: badges (not lanes) for blocked/active/review, shareable filtered URLs, checklist-row highlighting, distinct Checklist/Brief links and an Open-in-CLI handoff — [evidence](<PM Tooling — Master Book.md#r60>)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

**2026-09-15 R65:** keep implemented scope in Done and owner tests in UAT. `work-lifecycle.mjs` governs explicit owner/completed refusal; the source scanner and both launch backends use it. Do not restore acceptance-only checkboxes. Work > Done opens immutable completion evidence plus available attempts.

Command Center Phase 6a is in code (R62): `scripts/pm/shared/history.mjs` and `metrics.mjs`, `scripts/pm/app/Dashboard.tsx`, `tests/pm-ui/metrics.test.ts`; `product`/`portfolio` live in `scripts/pm/shared/` with classic re-exports. A sprint chart plugs into `sprintProgress` once R61 exists; retire paths under R6 only after the DLV-102 trial and R6's UAT. Command Center Phases 0 and 1 are complete (R59, R60). Phase 2 is R61 in `scripts/pm/app/`, depending on R60's Board/List and filter model (`model.ts`, `Board.tsx`); read the phase text in [Command Center](<../Plans/Command Center.md>) and the [PM Feature Map entry](<../../01 - Architecture/Feature Map/cross-cutting/pm-command-center.md>) before editing. R57 supersedes the R54/R56 primary visual architecture; retain their parsers and evidence, not their inspector or navigation as design constraints. Work in `scripts/pm/app/` for the primary local experience. Preact reference/static and React relay remain distinct. R55 is the held V2 job presentation follow-on. R6 governs retirement; R37/R42 retain hosted/real-device evidence, and R51 retains legacy-client/remaining concurrency acceptance. R60's stated limits (no real phone, one representative Checklist/Brief sweep, no persisted per-item session history) are real gaps, not closed — R63 (phone) and R55 (session history) still own them.


Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
