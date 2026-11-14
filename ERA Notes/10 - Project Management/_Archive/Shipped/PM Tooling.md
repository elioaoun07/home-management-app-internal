---
created: 2026-11-11
updated: 2026-11-14
type: archive
status: superseded
owner: Elio
---

# PM Tooling — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed PM Tooling items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../PM Tooling/PM Tooling — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### R70

- ✅ 2026-10-03 — **R70** Guardrail hooks fire on real payloads: `block-ui-dir.sh` blocks `src/components/ui/` edits and `update-atlas.sh` rebuilds `atlas.json` when an Atlas entry changes. Both had read the wrong payload field, so Hard Rules #11 and #23 were unenforced. (Payload tests; [acceptance and verification](#r70).)

**Implementation:** done

**Outcome:** The UI-folder guard and Atlas rebuild hooks run on real Claude Code payloads.
**Kind:** bug
**Touches:** `.claude/hooks/block-ui-dir.sh`, `.claude/hooks/update-atlas.sh`, `public/atlas/atlas.json`, `CLAUDE.md`

- **Acceptance:** an Edit/Write to `src/components/ui/` is blocked (exit 2) for Windows, forward-slash and relative paths; other paths pass and malformed input fails open. Editing a Page & Feature Atlas entry rebuilds `public/atlas/atlas.json`; source and other vault edits do not.
- **Verification (2026-10-03):** both scripts read `file_path` from the payload's top level, but Claude Code sends `tool_input.file_path` (a backslash path on Windows), so both were silent no-ops: an Edit payload for `src\components\ui\button.tsx` exited 0, and `atlas.json` had not changed since 2026-09-12. Both now read `tool_input.file_path` (legacy fallback kept) and normalize separators, as `check-migration.sh` already did. `update-atlas.sh` also fired on `src/` edits while skipping Atlas entries — the reverse of `scripts/build-atlas.mjs`, whose only inputs are the Atlas entries and screenshots — so it now fires on Atlas entries. Payload tests: three `ui/` path styles blocked; non-`ui/` and malformed input allowed; two Atlas paths rebuild; `src/app` and other vault docs do not. One rebuild takes ~0.46 s. `atlas.json` regenerated (83 nodes); Hard Rule #23 wording updated to the Atlas-entry trigger.

### R69

- ✅ 2026-09-26 — **R69** Shared Command Center Memory mark, Home queue/module cards, Analytics navigation and daily receipts, visible work IDs, persistent search across status/layout changes, and selectable question options from supplied text. Existing Delivery execution and answer commands are preserved; guaranteed AI-generated choices remain a separate suggestion. (Local implementation; [acceptance and verification](<../../PM Tooling/PM Tooling — Master Book.md#r69>); physical-phone UAT pending.)

### R68

- ✅ 2026-09-26 — **R68** Active highlights readable on `/pm/live` + Earlier deliveries filter. Same class as R67: the Next app's `:root[data-theme="blue"]` (and `.dark`) `--accent: #f1f5f9` out-ranked the PM app's bare `:root { --accent }`, so the selected bottom-nav tab, the selected Delivery tab (Outcome/Plan/…) and every accent icon (Spec/Plan rows) rendered light grey. Fix: `styles.css`/`dashboard.css` token blocks now also declare on `[data-pm-live]` (element-level beats any inherited `:root` value), incl. pink. Collision sweep of every PM token vs `src/**/*.css`: only `--accent`, `--chart-2`, `--chart-3` collided — all covered. Earlier deliveries gained an outcome filter (All / To apply / Applied / Cancelled / Other, zero-count chips hidden) via `pastOutcomeV1/V2` in `model.ts`. (`tests/pm-ui/app-model.test.ts` 6/6, typecheck clean; phone check pending.)
- ✅ 2026-09-26 — **R68** Phone content no longer hides behind the fixed bottom nav: `.app-main` reserves the nav height plus the safe area (`scripts/pm/app/responsive.css`); the clearance had lived on `.app-footer`, which the app no longer renders. Verified at 390 px on Home, Work and Delivery (last content above the nav). Reported by the owner on `/pm/live`.

### R67

- ✅ 2026-09-22 — **R67** Muted text readable on `/pm/live`: the Next app's `:root[data-theme="blue"] { --muted: #1a2942 }` (a surface shade, specificity 0,2,0) beat the PM app's `:root { --muted: #94a3b8 }`, so every secondary label — bottom nav included — rendered near-background. Renamed the PM token to `--ink-muted` in all six `scripts/pm/app/*.css` files so it can't collide. (Grep: 0 remaining `--muted` in `scripts/pm/app`; phone check pending.)

### R66

- ✅ 2026-09-15 — **R66** Removed Delivery launch/footer noise and rebuilt review hierarchy around visible plan sections, verification history, run facts and final Changes/Apply; unavailable executors now reveal their actual blocker. (Targeted tests, React bundle, typecheck and lint; browser UAT pending.)

### R65

- ✅ 2026-09-15 — **R65** Actionable To do, searchable Done, completed scope/session history, separate owner UAT, and shared V1/V2 launch guards. Reconciled 11 prior implementations and 11 manual checks; split remaining engineering. (800 passing tests, typecheck/lint, 28 browser observations; [UAT](<../../../../docs/Delivery-UAT.md>).)

### R51

- ✅ 2026-09-11 — **R51** Witnessed task mutations and guarded Undo implemented under R59; remaining owner acceptance moved to UAT. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../../docs/Delivery-UAT.md>).)

### R63

- ✅ 2026-09-12 — **R63** Shared Command Center views mounted on the phone relay through the transport seam; owner deployment/device acceptance pending. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../../docs/Delivery-UAT.md>).)

### R64

- ✅ 2026-09-15 — **R64** Responsive Delivery review workspace implemented and browser-verified at 320 through 1920 px; physical-phone UAT pending. (Reconciled 2026-09-15 from dated implementation/test evidence; [UAT](<../../../../docs/Delivery-UAT.md>).)

### R57

- ✅ 2026-09-10 — **R57** Replaced the primary dashboard with the React ERA application, focused mobile/desktop journeys and truthful Delivery story — [evidence](#r57)

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

- ✅ 2026-09-10 — **R56** Added whole-project area/topic exploration, contextual work previews, dependencies and continuous Delivery return paths — [evidence](#r56)

**Outcome:** Make the whole project understandable through continuous area, topic, work and Delivery exploration.

- **Diagnosis:** R54's opening queue obscured the project shape; only four campaigns were visible, cross-area context remained in book prose, and routine exploration required full-page changes.
- **Acceptance:** all eleven canonical areas on the opening map; topic perspectives over the same work; Now, explicit blocking, owner choices and active execution; inline work previews; linked prerequisites/downstream work/decisions; detailed contracts and matching evidence on demand; stable return context through launch, run tabs, decisions and area pages; topic and area outcome history; mobile keyboard and static parity.
- **Evidence (2026-09-10):** 175 PM UI and Delivery-route tests pass, including ten portfolio cases for shorthand/dotted IDs, dependency direction, unresolved/cancelled references, scope-only topic evidence, separate history and route identity. Chromium walkthrough against the actual PM corpus and isolated Delivery fixtures passed at 1536/1280/1024/768/390 px, with light/dark, cross-area selection, dependency preview, launch/cancel/run return, tab retention, live-run filtering, focus containment, Escape and static mode. Typecheck, lint (including explicit JSX), bundle and PM grammar checks complete the finish gates.
- **Read model:** `scripts/pm/src/lib/portfolio.js` derives topics, references and dependency states. No new persisted labels, task database or runtime state. Severity is not a dependency; an open related decision alone is not a blocked dependency. Missing references remain unresolved. Topic assignments are deterministic search perspectives with inspectable source evidence, not an asserted exhaustive ontology.
- **Continuity:** `ProjectExplorer.jsx` owns the map and inspector; `WorkItem.jsx` owns the dedicated work screen and shared relationship display. Existing Delivery APIs, mutation guards and review controls remain authoritative. Project run summaries refresh while visible; actual provider execution, real devices and hosted deployment were not exercised.
- **Deliberate omissions:** no decorative network graph, flip-card interaction, duplicate backlog, generated project-health score, invented progress percentage, metadata editor or new execution engine.
- **Provenance:** owner's 2026-09-10 Second UX Pass commission.

### 2026-07-13 · R-series

- ✅ 2026-07-13 — **R-series** the Preact/esbuild Command Center became the default dashboard: hash routes, history, themes, module/document views, backlinks, interactive checkboxes, task board + table, global search, rollups, file operations, re-skinned Delivery

### R16

- ✅ 2026-07-18 — **R16** the read-only PM Console shipped as a first-class page of the deployed app at `/pm` — own manifest and icons, installable on a phone, offline via the app service worker, laptop off; rebuilt by `pnpm pm:public` in `prebuild`, gated behind the app's Supabase login

### R27

- ✅ 2026-07-22 — **R27** Idea Inbox: `0 - Inbox.md` capture surface (New/Processed), the 💡 topbar quick-capture reusing the existing `append` mutation with no server changes, the `/triage-inbox` skill, and the §7 grammar

### R29

- ✅ 2026-07-25 — **R29** `/pm/live` shipped as the third mobile surface: live checklist + live delivery control fed by an outbound-only Supabase relay, distinct from the frozen `/pm` snapshot and the loopback-only `pnpm pm`

### R30

- ✅ 2026-07-30 — **R30** hide-completed made real: the document view now partitions each list and collapses completed rows behind a per-list "N completed hidden — show" pill (clicking it clears the toggle, so the affordance leads somewhere), and the control moved to the topbar where it is reachable at every width instead of living in the off-canvas sidebar (`scripts/pm/src/features/doc/Markdown.jsx`, `app/App.jsx`)

### R31

- ✅ 2026-07-30 — **R31** Search and the Idea Inbox became first-class destinations: sidebar entries, mobile tabs (Checklist stepped out of the 5-tab bar, being one tap from Home), command-palette actions, a dedicated `#/inbox` route with New/Processed lists and inline capture, and `lane:` / `e:` / `id:` added to the query language — with `idChip` and `effort` promoted to stored fields so the filters can actually read them (`features/inbox/InboxView.jsx`, `features/search/queryLang.js`)

### R32

- ✅ 2026-07-30 — **R32** a real board toolbar on Tasks and Checklist: always-visible search, one-tap quick-filter chips (Blockers / Now / Small / Done), native group-by and sort-by selects, and **filter state in the URL** — `#/tasks?q=…&group=…&sort=…` survives a reload and can be pasted to yourself. Defaults are omitted from the hash so an unfiltered board keeps a clean link. The logic is pure and tested (`boardState.js`, 16 cases); Bugs gained the same search + severity chips (`features/tasks/BoardToolbar.jsx`)

### R33

- ✅ 2026-07-30 — **R33** visual pass: sticky lane headers on both the board and the checklist rollup, tabular-figure count pills, ~20% tighter cards, a checkbox press animation, per-lane "Nothing here." states and a Clear-filters action in the empty state — all behind `prefers-reduced-motion` (`styles/tasks.css`)

### 2026-07-30 · memory files refreshed for the new layout…

- ✅ 2026-07-30 — memory files refreshed for the new layout (`project_pm_command_center`, `project_fable_handoff`, `project_agentic_delivery_workspace`) and the last delivery-script comment paths repointed at the Master Books

### R7

- ✅ 2026-07-30 — **R7** vault consolidation: every campaign reduced to a Master Book + `4 - Checklist.md`, superseded layers moved to `_Archive/` and made invisible to every PM tool (`scan.mjs` skip), the lint campaign map, bridge rollups/history reads and delivery packet-context reads repointed at the books, and CLAUDE.md / skills / `00 - Home` indexes updated

### R39

- ✅ 2026-07-31 — **R39** `/pm/live` rebuilt phone-only (owner: "too cluttered, texts are too much, size is too small") — the `lg:` desktop layout and `SideNav` are gone, nav is 4 tabs + a raised centre Capture FAB (long-press = quick Launch), a 12px content-text floor with `neo-card`-style elevation replaces the old 4%-opacity/10px surface, Board rows and detail sheets stop printing the ID chip and severity/effort twice (see R40), Campaigns is reachable on the phone for the first time (was `desktopOnly`), Usage moved off the tab bar onto a Home "Spend" tile, and `/pm/live` gained its own installable manifest (`public/manifests/pm-live.webmanifest`, distinct from `/pm`'s). All four session panes (Q&A/Chat/Files/Cost) kept, enlarged, with badge counts always visible.

### R40

- ✅ 2026-07-31 — **R40** fixed the display-layer duplication bug: `PmTask.text` still carries the ID chip and the `(severity - effort)` suffix because `cleanInlineText()` in `scripts/pm/shared/text.mjs` strips the underscores the meta-regex needs before that regex runs, so it never matches — every row rendering the ID chip and severity/effort as their own affordances was printing both twice. Added `displayText(task)` in `derive.ts` (display-only; `task.text` stays the raw search corpus) with test coverage in `tests/pm-live-derive.test.ts`. The upstream one-line fix in `text.mjs` was deliberately not taken here — shared by `lint.mjs`, the desktop Preact app and the bridge, wider blast radius than a UI pass — see the `## Next` item below.

### R49

- ✅ 2026-08-01 — **R49** Automate the checklist sweep — Ship / Discard row actions with Undo, a git-dated `pnpm pm:archive` CLI, and a once-a-month auto-sweep on `pnpm pm` boot; discarded items land in `_Archive/Cancelled Log.md` → `scripts/pm/archive.mjs`

### R50

- ✅ 2026-08-03 — **R50** transformed `pnpm pm` around real owner workflows: action-led Overview, movable Work Queue with undoable Markdown lane changes, portfolio Projects, unified Activity/audit history, visible execution lanes, compact preview-aligned light/dark themes, and responsive workspace navigation (`scripts/pm/src/`; 60 PM UI tests + bundle + typecheck)

### R52

- ✅ 2026-09-10 — **R52** Refactored the full PM knowledge system: canonical queues/criteria, accepted plans, decision and option disposition, archive provenance, templates and navigation; validation recorded in the refactor receipt.

### R54

- ✅ 2026-09-10 — **R54** Refactor the PM product journey through Delivery outcome — [evidence](#r54)

**Outcome:** Refactor the PM product journey from overview through Delivery outcome.

- **Acceptance:** canonical campaign cards and work Board/List, stable item details with book acceptance/related decisions, direct guarded launch, live state/plan/activity/files/checks/resources/handoff, recoverable errors, keyboard-operable dialogs, desktop/mobile layouts and static read-only parity.
- **Evidence (2026-09-10):** `tests/pm-ui/product-model.test.ts`, `session-model.test.ts`, `session-races.test.ts`; PM UI plus Delivery server-route suite: 165 tests passed. Browser fixture walkthrough covered scope/plan review, late artifact close, pause/resume, accept/ship, error retry, V2 readiness and static mode. Full typecheck and bundle passed. The repository lint command and explicit `eslint --ext .jsx` checks on every changed JSX component pass; esbuild and browser execution also verify JSX.
- **Architecture:** `scripts/pm/src/lib/product.js` and `app/productStore.js` are derived read models only. `features/delivery/sessionModel.js` projects recorded runtime evidence. No execution engine, SDK, policy or production data change. The sole server payload extension is the explicit read of `_Archive/Cancelled Log.md`, used only for outcome history and never added to scanned files, work, search or dispatch.
- **Preserved:** the portable static build, hosted prebuild pipeline, `--ui=old` rollback, source tools, canonical mutation/Undo APIs, Delivery controls and review gates, and the separate `/pm/live` app. Stable item navigation and launch checks do not claim to fix the remaining ordinal-mutation/Undo work in R51.
- **Provenance:** owner's 2026-09-10 Full Product UI/UX Refactor commission.

### R58

- ✅ 2026-09-11 — **R58** Restore ERA's theme and correct PM connectivity detection — [evidence](#r58)

**Outcome:** Restore ERA's theme and correct PM connectivity detection.

- **Cause:** R57 introduced independent green/cream palettes. Its health route handled GET only, so the shared client's HEAD probe received 404 and marked the app offline despite successful data reads. The earlier preview accepted every method and masked this mismatch.
- **Change:** existing ERA Blue/Pink surface and accent values, dark module covers, themed dialogs and browser chrome; saved light/dark values migrate to Blue. `scripts/pm/health.mjs` serves uncached GET/HEAD and is called by the production server and test fixture. The primary shell includes `mobile-web-app-capable` alongside Apple compatibility metadata.
- **Verification (2026-09-11):** 189 tests across 20 PM UI/Delivery-route files, including actual HTTP HEAD/GET responses, empty HEAD bodies, no-store and unsupported method/path fallthrough. Isolated Chromium exercised initial and periodic real HEAD probes (all 200), genuine service-worker offline reload and reconnect, legacy preference migration, Blue/Pink persistence, desktop/390/320px layouts and opaque capture sheets. No browser errors or online console warnings; no mutation requests. Typecheck passes; lint reports zero errors and 911 pre-existing warnings.
- **Runtime boundary:** the owner's existing server returned HEAD 404 / GET 200 before restart. Browser checks use the same corrected health handler in a read-only isolated preview; normal PM startup, live Delivery and the production bridge were not run by this check. Restart `pnpm pm` and reload to activate the backend fix.
- **Provenance:** owner's two-point theme and false-offline correction request, 2026-09-11.

### R59

- ✅ 2026-09-11 — **R59** Repaired canonical work identity, acceptance lookup and source/history links; checkbox writes refuse stale, duplicate and witness-less targets — [evidence](#r59)

**Outcome:** Repair canonical work identity, acceptance lookup and source links.

- **Cause (reproduced 2026-09-11):** reference parsing had no suffix letters and heading lookup was exact-case, so `SCH-4.3b`, `SCH-1b.4`, `SCH-1c.1` and `SCH-1c.2` projected empty contracts and `SCH-4.3b` references collapsed to a nonexistent `SCH-4`. Work lowercased IDs for anchors (`sch-4.2`) while headings slug to `sch-42`; the shared slug collapsed hyphens that authored links keep; cancelled history linked to a file the reader could not open. Checkbox writes from the classic and legacy clients were ordinal-only, and no write refused a duplicate ID.
- **Change:** `scripts/pm/shared/work-id.mjs` owns chip grammar, normalized comparison, reference extraction and `### <ID>` lookup for the scanner, read models, write guards and V2. `links.mjs` emits GitHub slugs with duplicate suffixes, now also used by `pnpm pm:check-docs`. Work shows the source spelling and opens the exact acceptance heading (or the checklist when none exists); history opens the Shipped Log or the campaign section of the explicitly read Cancelled Log, which stays out of the scan. `write-guards.mjs` requires `expectLine` for toggle, move, ship and discard (428) and refuses a changed row, a mismatched `expectId` or a duplicate ID (409); the React, classic and legacy clients send witnesses.
- **Verification (2026-09-11):** `tests/pm-ui` 113 passed in 20 files, including the React, classic and static builds, `work-identity.test.ts` (Schedule rows, references, duplicate headings, anchors, brief/history paths) and new `write-guards` cases (missing witness, reorder, unknown ordinal, ID mismatch, duplicate ID). Relay suites 91 passed. `pnpm typecheck` exit 0; ESLint on changed files clean; `pnpm pm:lint` 0/0; `pnpm pm:check-docs` passed. Live read-only corpus scan: four Schedule contracts resolve (2,822 / 198 / 231 / 309 characters), zero unresolved references, 234/234 brief anchors exist.
- **Limits:** fixture and scan evidence; the changed links were not walked in a browser at 390/320 px and no phone was used. R51 keeps its remaining acceptance.
- **Provenance:** [Command Center Phase 0](<../../Plans/Command Center.md#phase-0--establish-a-trustworthy-baseline-and-adopt-the-direction>), owner approval 2026-09-11.

### R60

- ✅ 2026-09-11 — **R60** Completed Home, Work Board/List and module views: badges (not lanes) for blocked/active/review, shareable filtered URLs, checklist-row highlighting, distinct Checklist/Brief links and an Open-in-CLI handoff — [evidence](#r60)

**Outcome:** Complete Home, Work Board/List and module views over the canonical backlog.

- **Acceptance:** Command Center Phase 1. All eleven campaigns and the complete open backlog are reachable. Board and List show the same IDs with Now/Next/Later lanes, campaign/kind/status filters and shareable URLs; blocked/active/review are badges or filters, never relocated priority; a move, reload and Undo work at desktop and 390/320 px; a CLI edit refreshes global and module views; Checklist and Brief links open every tested active, completed and cancelled record at the exact ID with the return location kept; core navigation never sends the owner to classic tools. Labels follow Hard Rule 28.
- **Depends on:** [R59](#r59). Keeps the R57/R58 foundation; refines R6/R42 where they overlap.
- **Change:** `scripts/pm/app/Board.tsx` (new) is the shared Board/List component, used unmodified on Work (`Explore.tsx`, promoted from the discovery page via a `view=board|list` toggle that preserves the existing search landing) and on the module page (`SpaceView`, campaign locked, replacing the old bespoke bucket-tab list). Lanes are `work.section` directly (Now/Next/Later only); blocked/active/review render as badges from a new `activityBadges()` and never relocate the row. Filters (status/campaign/kind) and the view mode round-trip through the URL via `parseBoardQuery`/`boardQueryString` (`model.ts`) — `view` is always written, since an absent `view` is what tells Work to render Search instead of Board. Move is a `<select>` (keyboard/tap, always present) plus native HTML5 `draggable` (never mixed with Framer Motion drag per Common Patterns §4); both call the existing guarded `move-task` op and reuse `Work.tsx`'s `UndoNotice`. `work.kind` is new, sourced from an optional `**Kind:** ` line in the Master Book ID section (`portfolio.js#kindOf`) and defaulting to `unclassified` — nothing was guessed from severity or text. `work-id.mjs#checklistAnchors` gives every checklist chip the same anchor slug its brief heading would use, so `model.ts#checklistPath` and the Markdown `li` renderer (`components.tsx`) can open and highlight the exact checklist row; `briefPath`'s no-book fallback now points at that same row instead of a bare file (verified test updated). `Work.tsx` adds distinct Checklist/Brief links (only when they differ) and an "Open in CLI" clipboard handoff (ID, source, outcome, acceptance). `Home.tsx`'s `SpaceShelf` cards gained a blocked-count/active badge row and one next-action link (top Now item, or the space itself). Nav labels renamed Today→Home, Explore→Work (routes/aliases unchanged).
- **Verification (2026-09-11):** `pnpm exec vitest run tests/pm-ui`: 120 passed in 21 files (7 new in `board.test.ts`: checklist anchors, declared-Kind parsing, checklist/brief distinction, lane grouping, badge combinations, filter URL round-trip, filter matching). `pnpm typecheck` and `pnpm exec eslint` on every changed file: exit 0. `pnpm pm:lint` 0/0; `pnpm pm:check-docs` 11 pairs / 241 tasks pass. Live `pnpm pm` walkthrough against the real corpus: all 11 campaigns selectable and the full 241-item backlog reachable from Work; Board and List render the same filtered IDs; a keyboard Move (Budget item, Now→Next) produces a guarded write, an Undo clicked promptly restores the exact prior line, and a stale-toast click is safely a no-op (confirmed by design, not a defect — the guard is `expectLine`, not the toast); reloading a filtered URL (`?view=list&campaigns=Budget`) restores the identical filtered List. A same-origin iframe probe (window resize was unavailable in this sandboxed Chromium) confirmed the compact Now/Next/Later lane switcher and tap-to-change-lane at true 390 px and 320 px, with no horizontal overflow — fixed one found there: `.page-title` needed `flex-wrap` at ≤700 px once a text action (Board/Search instead) sat beside the heading, not just the round Capture button. Checklist and Brief links opened `BUD-39` at its exact row/heading with a visible scroll-and-flash highlight and preserved the return path back through the module page.
- **Limits:** "CLI edit refreshes both views" is verified by construction, not an isolated raw-file-edit probe — every check here (moves, restores) is itself a filesystem write picked up by the same unchanged `fs.watch`→SSE→invalidate pipeline R57 already verified; no separate external-editor test was run. Checklist/Brief distinct-link and highlight behavior was exercised on one representative open item (`BUD-39`), not swept across all 241; done/cancelled records keep their existing `historyPath` (unchanged by this work, since a shipped/cancelled row has no checklist line left to highlight). "Linked sessions" on the item page still shows only the current live run (`runFor`), not a persisted per-item session history — no such read model exists yet. No real phone/PWA install was exercised. Drag-and-drop was wired per Common Patterns §4 but only keyboard/tap Move was interaction-tested end to end; drag is progressive enhancement over the same guarded mutation. A Budget checklist reorder made and undone during testing was manually restored to its original row order as a precaution.
- **Provenance:** [Command Center Phase 1](<../../Plans/Command Center.md#phase-1--complete-the-home-work-and-module-experience>).

### R61

- ✅ 2026-10-03 — **R61** Plan sprints, deliverables and readiness over the same work; corrected Start authentication, optional-estimate commitment and visible disabled reasons — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r61>)

### R72

- ✅ 2026-10-03 — **R72** ERA chat reports import into Hub & ERA › Now › ERA reports (bridge every 5 min, read-only toward the DB, once-only via the Source marker + `.pm/era-issues.jsonl`, undo-journaled writes; `pnpm pm:era-issues` preview / `--apply`) and Sprints shows them as a Hotfixes lane on the current week, never as members. (`tests/pm-era-issues.test.ts`, `sprint-model.test.ts`, bridge tests green, `pnpm pm:build-app`; [acceptance and verification](#r72).)

**Outcome:** Reports filed from the ERA chat become Hub & ERA work and appear on the current sprint as Hotfixes / Defects.
**Kind:** feature
**Touches:** `scripts/pm/era-issues.mjs`, `scripts/pm/bridge.mjs`, `scripts/pm/app/sprintModel.ts`, `scripts/pm/app/Sprints.tsx`, `scripts/pm/app/sprints.css`, `package.json`
**Depends on:** Hub & ERA/HUB-85

- **Acceptance:** with the bridge running, every `issue_report` row older than the 2-minute Undo grace is imported exactly once into `Hub & ERA/4 - Checklist.md` › Now › **ERA reports** (ID above every `HUB-n` in the corpus; `blocker` for Wrong, `friction` for Missed; effort S to re-estimate) with a Pain Inventory line and a `### HUB-n` section carrying `**Kind:** bug`, `**Source:** ERA report <id>`, acceptance, transcript and ERA actions. The DB is only read; idempotence is the corpus marker plus `.pm/era-issues.jsonl`; untrusted text is neutralised and credential-shaped text withheld; writes use the bridge's undo journal. `pnpm pm:era-issues` previews and `--apply` writes. Sprints shows open Now items with the marker as a Hotfixes lane above the week's work — Hotfix (wrong) first, then Defect, oldest first — on any non-closed week and when no sprint exists; they never become members or change planned points; moving one out of Now removes it.
- **Verification (2026-10-03):** `tests/pm-era-issues.test.ts` (6: shape, `lintChecklist` clean, once-only + grace + journal, allocation above archived IDs, Markdown/secret handling, wrong → blocker hotfix); `tests/pm-ui/sprint-model.test.ts` `eraHotfixes` (ordering; done or triaged items drop off); `tests/pm-bridge.test.ts` green; `pnpm pm:build-app` builds. Not run against production — the bridge is owner-run.

### R73

- ✅ 2026-10-24 — **R73** Center Delivery navigation and signal running sessions — [criteria](#r73)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-73--find-delivery-in-the-navigation>) (drafted 2026-10-25; original results retained).

**Outcome:** Delivery is the raised central navigation destination, with a quiet lightning signal for observed running work.

**Kind:** feature
**Touches:** scripts/pm/app/App.tsx, scripts/pm/app/PrimaryNavigation.tsx, scripts/pm/app/navigation.css, scripts/pm/app/responsive.css, tests/pm-ui/primary-navigation.test.ts

- **Acceptance:** desktop and phone order is Home / Sprints / Delivery / Work / Analytics. Delivery projects slightly above the bar, retains its label and direct route, and softly alternates gold/purple while V1/V2 work is running. Waiting sessions remain steady; closed receipts do not animate; offline/stale/error observations do not claim current execution. Reduced motion keeps a static signal. Verify desktop, 390/320 px, two themes and unchanged navigation.
- **Verification (2026-10-24):** all 305 PM UI tests in 39 files passed, including five navigation cases and React/classic/static builds; typecheck/scoped ESLint clean. Final navigation/bundle rerun: 6 passed. Initial sandbox-only build failures were resolved by running the same offline suite with parent-directory access. Chrome fixture at 1280/701/390/320 px confirmed destination order, raised placement, >=44 px targets and no horizontal overflow in Blue/Pink. V2 running glows on Work as well as Delivery; waiting/closed/stale/offline do not animate. The actual reduced-motion CSS rules were matched in an isolated stylesheet and yielded a static gold glow; OS preferences were not changed. Fixture blocks every operational API call and dispatch. The running local desktop picked up the finished navigation, correctly idle; R44's contract section and installed policy are unchanged. PM lint and Feature Index pass; document-link check retains the same 15 missing historical Delivery recovery artifacts. Evidence: `.tmp/r73-nav/verification.json`. Hosted deployment, physical phone and a real running job remain unverified; no delivery was started for this test.

### R74

- ✅ 2026-10-25 — **R74** Mirror PM documents and delivery status one-way to Google Drive for ERA Steward — [criteria](#r74)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-74--read-the-drive-mirror>) (drafted 2026-10-25; original results retained).

**Outcome:** The PM Command Center mirrors selected PM documents and delivery status one-way to Google Drive for ERA Steward.
**Kind:** feature
**Touches:** `scripts/pm/drive-publish.mjs`, `scripts/pm/drive-publish-cli.mjs`, `scripts/pm-server.mjs`, `tests/pm-drive-publish.test.ts`, `package.json`

- **Acceptance:** `G:\My Drive\ERA PM Command Center` (`PM_DRIVE_DIR` overrides, `PM_DRIVE_PUBLISH=0` disables) gets `01 - PM Documentation` (allowlist: `_index`, `_Conventions`, `_Decisions`, `0 - Inbox`, each campaign's Master Book and checklist, `Plans/`, `Research/`, and `docs/Delivery-*`, `ERA-Steward-*`, `R44-*`; credential-shaped files withheld and removed from Drive), `02 - Delivery Status` (`status.json` + `status.md`: run ID, phase, progress, blockers, pending owner actions, request state, evidence IDs and links, campaign roll-ups, timestamps; rewritten only on change plus a 5-minute heartbeat) and `03 - Steward Proposals` (created, never written or read back, except kept copies of Drive edits). The PM server publishes after PM changes, delivery session changes, a 15 s status poll and at start; `pnpm pm:drive` is the manual full pass (`--dry-run` writes nothing). Local is authoritative: nothing is read from Drive into the repository, a Drive edit is kept under `03 - Steward Proposals/Drive edits` and overwritten. A missing folder, I/O error or hang fails closed (no folder is invented), is bounded to 30 s, never overlaps another pass, and retries at 30 s to 5 min. Status uses read-only store methods only (no journey, Start, plan approval, Apply or reconcile); an unreadable store keeps the last data marked stale.
- **Verification (2026-10-25):** `tests/pm-drive-publish.test.ts` (17: allowlist, secret withholding, read-only store Proxy, first/idempotent/incremental/prune passes, one-way and Drive-edit preservation, recreate, change-only status, stale fallback, missing folder then recovery, hung call, write failure, no delivery-mutating imports, server wiring and CLI read-only store). Live dry-run then initial publish of 47 documents plus status to the real Drive folder; second run wrote nothing.

### R75

- ✅ 2026-10-25 — **R75** Delivery home groups every delivery once by what it asks of the owner — [criteria](#r75)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-75--find-each-delivery-once>) (drafted 2026-10-25; original results retained).

**Outcome:** The Delivery tab shows each delivery once, grouped by what it asks of the owner, instead of stacked launch receipts, a queue panel and a history list that repeated the same runs.
**Kind:** feature
**Touches:** `scripts/pm/app/DeliveryHome.tsx`, `scripts/pm/app/deliveryHomeModel.ts`, `scripts/pm/app/Delivery.tsx`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/StewardRequests.tsx`, `scripts/pm/app/delivery.css`, `scripts/pm/app/responsive.css`, `tests/pm-ui/delivery-home.test.ts`

- **Acceptance:** groups, in order, each hidden when empty: **Needs you** (queue decisions such as Apply / Conflict / Review plan, and launch requests that are blocked before a run exists), **In progress**, **Waiting** (queue verdict beside the row), **In focus** (Now-lane outcomes not already being delivered, always shown, with an All link) and **Earlier deliveries** (collapsed; outcome filter; excludes anything still under Needs you). A run is never listed twice. A launch receipt with a run is a tag on that run's row (`Owner` / `ERA Steward` under the status) and keeps its full card on the run and launch pages; a receipt without a run is a row whose Request disclosure holds the same card (UUID, timestamps, stage, evidence, `Status unconfirmed`). Writers/Jobs show once, as plain text with an `i` hint, in the first of In progress / Waiting that has rows, and not at all when idle. Pairs is renamed Overlaps. The Room-for-your-next-idea hero is removed. Every non-link figure is plain text, not a pill. No horizontal overflow at 390 px; the status column stays visible.
- **Verification (2026-10-25):** `tests/pm-ui/delivery-home.test.ts` (8: Apply decision once and not in history, queue-less fallback, progress/waiting split, receipt folded into run row, blocked vs pending vs terminal receipt without a run, V1 split, outcome counts/delivered ids, id-prefix stripping); `steward-requests`, `coordination-model`, `work-lifecycle`, `steward-entry` suites still pass; typecheck, scoped ESLint and `pnpm pm:build-app` clean. Live desktop (4317) showed Needs you 2, In focus 3 (BUD-83 no longer repeated), Earlier deliveries 22 with the three R44 runs as one row each and `ERA Steward` / `Owner` attribution; a 390 px iframe had no overflow. In progress, Waiting and the Capacity line were not exercised: nothing was running or queued, so they are fixture-tested only. The running server served the rebuilt bundle (`pnpm pm:build-app`) with no restart.

### R92

- ✅ 2026-11-10 — **R92** Give every agent the same setup and remove the current drift — [criteria](#r92)

**Outcome:** Codex and other agents get the same skills and guards as Claude from generated copies, and the setup holds no dead, duplicate or machine-specific configuration.

**Kind:** maintenance
**Touches:** `.codex/`, `.agents/`, `.claude/hooks/`, `.husky/pre-commit`, `.claude/skills/start-task/SKILL.md`, `.claude/skills/finish-task/SKILL.md`

- **Source:** [Agentic OS conflict classes](<../../Fable 2/Agentic OS/05 - Conflict and Drift Detector.md>) and [setup inventory](<../../Fable 2/Agentic OS/02 - Current Setup Inventory.md>) (2026-11-10). Filed and implemented locally 2026-11-10.
- **Acceptance:** First confirm by observation which hook file Codex reads and that a hook fires. Then: `.agents/skills/` and the Codex hook scripts are generated from the Claude sources and byte-equal to them; one Codex hook config remains, with relative paths; `.claude/hooks/sync-copilot.sh` is removed or wired; `.husky/pre-commit` is executable; the junction list in `start-task` and the campaign list in `finish-task` match their owners; the name clash between root `CODEX.md` and `ERA Notes/CODEX.md` is resolved. Owner decides first whether Codex stays a first-class agent and whether `settings.local.json` stays committed.
- **Tier:** CLAUDE_MID. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** At the cutoff: 2 of 18 skills mirrored and one is 13 lines stale; all four same-named Codex hooks differ; `.codex/hooks.json` uses an absolute Windows user path and disagrees with `.codex/settings.json`. Pairs with R84 and R91.
- **Implementation:** done
- **Evidence (2026-11-10):** `pnpm sync:ai:check` verifies 3 instruction mirrors, 18 byte-equal skills, 6 byte-equal hook scripts and one derived Codex config. `hooks/list` on Codex CLI 0.145.0 observed `.codex/hooks.json`, not `settings.json`. A credential-free native session using canned loopback Responses blocked an `apply_patch` to `src/components/ui/probe.txt`; the file was absent afterward. Windows wiring must forward `$LASTEXITCODE` or exit 2 becomes a non-blocking hook error. `pnpm vitest run tests/os/setup.test.ts` passes 3 tests, including drift, subdirectory/spaced paths, protected moves, malformed input, Windows status propagation and real Git commits. A fresh fixture clone in a cached Linux container retained mode 100755, invoked every gate, and rejected an injected failed parity check; gate commands were stubs, not a full-suite pass. Typecheck, changed-file ESLint, docs and PM checks pass. No product or DB changes, no paid inference. [Setup maintenance](<../../../../docs/Skills-and-Agents.md>) owns commands and runtime prerequisites.
- **Owner check:** in a fresh repo session, run `pnpm sync:ai:check` (expect verified), then `/hooks` in Codex and review the changed project definitions (expect one `.codex/hooks.json` source). New hook hashes remain untrusted until reviewed; the isolated native probe used the documented one-invocation trust override only for its vetted fixture. `settings.local.json` stays committed by owner reply. R93 onward is untouched.

### R93

- ✅ 2026-11-10 — **R93** Generate a setup registry and check it for conflicts — [criteria](#r93)

**Outcome:** One command lists every rule, skill, hook, permission, mirror and check per agent, and another reports contradictions and drift between them.

**Kind:** feature
**Touches:** `scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`

- **Source:** [Agentic OS setup registry](<../../Fable 2/Agentic OS/03 - Setup Registry.md>), [conflict detector](<../../Fable 2/Agentic OS/05 - Conflict and Drift Detector.md>) (2026-11-10). Filed and implemented locally 2026-11-10.
- **Acceptance:** `pnpm os:scan` writes a versioned registry with a setup fingerprint, with zero dependencies and no network. At the current commit it reproduces the counts in the hand-made inventory. `pnpm os:check` implements the conflict classes as queries, exits non-zero on error-level rows, and runs in CI. An injected mirror drift is reported.
- **Tier:** CLAUDE_MID. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** Reuse `scripts/pm/shared/` parsers and `scripts/pm/scan.mjs` walking. Rule identities `HR-1` to `HR-29` are stable. Add a `# enforces: HR-n` first-line comment to hooks and checks.
- **Implementation:** done
- **Evidence (2026-11-10):** `pnpm os:scan` emits versioned `.os/setup.json` plus `.os/setup.sha256`, without dependencies or network. `pnpm os:check` queries thirteen conflict classes, scans without a saved registry in CI, and rejects error rows, saved-registry drift, invalid versions and corrupt fingerprints. Fixtures independently read `e5f537a` and reproduce 29 Hard Rules, 18 Claude/2 Codex skills, 8 Claude wirings, 7 Claude hook scripts, 22 project/226 local permissions, 7 instruction files and 6 tiers. Current A0 copies are counted separately. Injected mirror drift exits 1 without rewriting the file or saved registry. `BASELINE` stays unknown without A2 detector evidence. Existing portability, namespace and permission-parity errors keep the real checkout's check red; no unrelated setup fix, paid API, product UI, DB or A2 work was performed. Commands and limitations: [Skills and Agents](<../../../../docs/Skills-and-Agents.md#agentic-os-setup-tools-a1--r93>).
- **Verification:** 21 A0+A1 tests pass; typecheck, scoped ESLint, mirror parity, Feature Index, PM lint/docs and whitespace checks pass. The current registry contains 29 global/19 module rules, 36 skills, 16 hook wirings, 248 permissions and 6 tiers; `os:check` exits 1 with 70 existing errors and 14 warnings. Full local `pnpm lint` exits 1 with 9,284 errors/51,999 warnings, concentrated in pre-existing `.tmp/` generated programs; none of its errors are in the A1 files. Local review receipts: `.os/a1-code.diff`, `.os/a1-check.txt`, `.os/a1-lint.log`. Remote CI has not run in this session.

### R94

- ✅ 2026-11-10 — **R94** Decide Hard Rule verdicts for any change with detectors — [criteria](#r94)

**Outcome:** For any commit range, a script reports which Hard Rules the change broke, improved or left alone, with file and line.

**Kind:** feature
**Depends on:** R93
**Touches:** `scripts/`, `tests/`

- **Source:** [Agentic OS rule enforcement matrix](<../../Fable 2/Agentic OS/04 - Rule Enforcement Matrix.md>) (2026-11-10). Filed and implemented locally 2026-11-10.
- **Acceptance:** `pnpm os:eval <base>..<head>` runs the first eight detectors (rules 22, 6, 19, 7, 24, 25, 8, 12) on the diff and prints pass, fail, improved or n/a per rule. Each detector has fail, pass and not-applicable fixtures and a version. Verdicts judge what the change added or removed, never the existing baseline. First slice only; the remaining detectors belong to R96.
- **Tier:** CLAUDE_MID; CLAUDE_LOW for repeats. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** Today 7 of 29 rules have a mechanism. Baselines on `main`: rule 22 at 184 calls, rule 6 at 96, rule 8 failing on 2 of 6 cron routes.
- **Implementation:** done
- **Evidence (2026-11-10):** Eight version-1 detector modules cover HR-22/6/19/7/24/25/8/12. Their 24 fail/pass/n/a fixtures must succeed before evaluation. Source inspection uses the installed TypeScript parser and compares before/after finding multisets, so existing debt and reformatting pass while removals improve. Output includes all locations with explicit base/head side, plus JSON schemas `os/evaluation@1` and `os/verdict@1`. Exit 1 means a new violation; exit 2 means an input/contract error. Exact PR base/head SHAs run in CI independently of setup-check success. A1's registry retains detector versions, rule links and fixture hashes; whole-tree baselines stay unknown.
- **Verification:** `pnpm vitest run tests/os` passes 73 tests across A0–A2, including 24 detector fixtures, unchanged debt, removals, mixed additions/removals, comments/strings, multiline calls, Unicode/spaced paths, renames, dirty files and invalid/empty ranges. Typecheck, scoped ESLint (`scripts/os`, `tests/os`), mirror parity, Feature Index and whitespace checks pass. `pnpm os:eval "bf0ee6ef~1..bf0ee6ef"` exits 1 with HR-22 at `src/components/settings/SettingsDialog.tsx:567`, excerpt `console.error("Failed to set default income account:", error);`; that historical change also fails HR-12. `HEAD..HEAD` exits 0 with eight n/a rows. `os:scan` emits eight detectors; `os:check` still rejects the existing 70 setup errors. No product code, production DB, paid API or flight recorder was touched. Local historical JSON evidence: `.os/a2-known-violation.json`. Remote CI and the full product suite were not run.
- **Owner replay / limits:** [Skills and Agents](<../../../../docs/Skills-and-Agents.md#agentic-os-diff-evaluation-a2--r94>) gives prerequisites, exact commands, expected exits and static-analysis limits. Run the historical range (expect 1 and the named evidence), then `HEAD..HEAD` (expect 0/eight n/a). These are read-only verification steps; owner acceptance/deployment is unrecorded. Static detectors cannot prove inter-file data flow, arbitrary wrapper validation or complete control-flow safety. A3 onward remains out of scope.

### R44

- ✅ 2026-10-24 — **R44** Guard new client mutations against raw fetch — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r44>) (V2 run r-46688acd1b86 applied 2026-10-24; raw-fetch-guard test passes 5/5 on 2026-11-11; owner sign-off pending)

### R95

- ✅ 2026-11-11 — **R95** Record every agent session as a flight report — [criteria](#r95) (A3 only: 82 OS tests pass; hook byte/exit equivalence, failure isolation, durable reimport/rollback and real Claude session export verified. Scoped ESLint and mirror parity pass. Repo typecheck has unrelated ship.test.ts:188,192 errors; existing os:check conflicts retained. No native API launch, A4+ or PM.2 UI.)

**Outcome:** Each Claude session leaves a record of its setup, skills loaded, hooks fired, checks, rule verdicts and cost, readable as Markdown.

**Kind:** feature
**Depends on:** R93
**Touches:** `scripts/`, `tests/`, `.claude/settings.json`, `.gitignore`

- **Source:** [Agentic OS flight recorder](<../../Fable 2/Agentic OS/06 - Flight Recorder.md>) (2026-11-10). Implemented locally 2026-11-11, A3 only.
- **Acceptance:** A runner wraps the existing hooks and logs each firing with exit code and duration; an equivalence test shows hooks receive the same input and return the same output and exit code with and without it. The session transcript is read, never modified, for skills, reads, tool calls and usage. Rows are stored under a gitignored `.os/`; `pnpm os:report <session>` prints the report. If recording fails the session is unaffected. No transcript text beyond short excerpts is stored; key-like values are redacted.
- **Tier:** CLAUDE_HIGH for the hook runner, then CLAUDE_MID. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** The Stop hook already parses the transcript and the hook payload (`transcript_path`, `tool_input.file_path`). SQLite pattern: `scripts/delivery-v2/store.mjs`.
- **Evidence, 2026-11-11:** `scripts/os/hook.mjs` wraps all six existing command hooks; Node subprocess tests verify unchanged stdin/stdout/stderr and exits 0/1/2, the actual UI guard with/without the runner, unavailable logging and automatic Stop ingest. Claude ingest derives successful skill loads, reads, tool/result timing and deduplicated usage; versioned `.os/os.db` rows survive reimport/reopen and roll back failed replacements. `pnpm os:report` exports Markdown without rerunning checks. `pnpm exec vitest run tests/os`: 82 passed; scoped ESLint and generated mirror check pass. Repository typecheck remains blocked only by unrelated `tests/pm-ui/ship.test.ts:188,192` TS2322 errors; `os:check` retains the existing permission/parity conflicts (and a stale snapshot until rescanned).
- **Real-session witness:** imported Claude `4db77e08-0b3e-420d-9434-0458e2dc5e85` (2026-11-03), four skills, two historical hook summaries, 138 tool calls. Explicit range `e053ac9f~1..e053ac9f`: six pass / one improved / one n/a. Export: `.os/reports/R95-real-session.md`; source SHA-256 `1d6235f4fa23f6818127f2b402e8e6a32901d739d63740e339ba9124b3556aa1`, unchanged. A privacy-trimmed real fixture is retained under `tests/os/fixtures/claude-recorded.jsonl`.
- **Limits:** no new native Claude/API session launched. Historical setup, base attribution and hook exit codes remain unknown; the explicit range includes contemporaneous other work. A3 check rows are transcript observations; no supervisor runs, full process scoring, Codex/Delivery adapters or PM.2 UI. Detailed commands/privacy/rollback: [Skills and Agents](<../../../../docs/Skills-and-Agents.md#agentic-os-flight-recorder-a3--r95>).

### R96

- ✅ 2026-11-11 — **R96** Score sessions and deliveries from recorded facts — [criteria](#r96) (A4 only: 161 OS tests pass; six panels, 25 fixture-gated detectors, Codex replay, read-only Delivery, line rework/reverts and CLI evidence verified. Scoped lint/docs/PM checks pass. Existing ship.test.ts type errors and os:check setup conflicts remain; no A5+ UI or live API launch.)

**Outcome:** Every session has a scorecard of rules, checks, process, scope, autonomy and cost, and every item a delivery scorecard, computed without a model.

**Kind:** feature
**Depends on:** R94, R95
**Touches:** `scripts/`, `tests/`

- **Source:** [Agentic OS deterministic evaluation](<../../Fable 2/Agentic OS/07 - Deterministic Evaluation.md>) (2026-11-10). Filed 2026-11-10; implemented locally 2026-11-11 (A4 only).
- **Acceptance:** The process panel uses a path-to-skill `requires` table: a session that edits a money path without loading `money-rules` shows a process failure. The remaining detectors from the matrix are added. Delivery scorecards count sessions, rework, UAT result, escapes within 30 days and reverts. Comparisons group by tier alias, effort and item class, always print n, and draw no ranking under ten sessions. Adapters project Delivery V2 runs and, once its log format is confirmed, Codex sessions.
- **Tier:** CLAUDE_MID. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** No blended score and no model review in the pipeline. Escapes and reverts are the quality signal the other panels predict.

- **Evidence, 2026-11-11:** A4 only: six independent scorecard panels; 21 diff and four transcript detectors with fail/pass/n-a load gates (four UAT judgment rules); path-to-skill process failure proven independently of passing rule verdicts. Codex native/Work rollout adapters, read-only Delivery V2 projection, item/session/cohort CLIs, contiguous line rework and Git revert witnesses. 161 OS tests pass; scoped ESLint, docs:check, pm:lint and pm:check-docs pass. Typecheck retains only pre-existing ship.test.ts:188,192 TS2322 errors. Fresh os:scan registers 25 detectors; existing setup errors remain (os:check: 68 errors, 12 warnings).
- **Real witness:** historical Codex 01a1cc25-6ac7-7743-9313-dd22beb5610f imported without changing its SHA-256; six skill reads, 26 reads, 85 tools. Empty explicit Git range is adapter evidence only, not diff attribution. `.os/reports/R96/real-codex.md`, `money-process.md` (Rules pass / Process fail), `witness.json` and verification logs. [Commands and limits](<../../../../docs/Skills-and-Agents.md#agentic-os-scorecards-a4--r96>).
- **Limits:** R90 behavioral authorization coverage remains separately open; HR-13 is advisory. Missing transcripts, supervisor counts, setup or noncontiguous rework are unknown. Thirty-day escape windows are not claimed complete. No production DB writes, new provider session, paid API test or A5+ UI work.

### R71

- ✅ 2026-11-12 — **R71** Point the PM Stop hook at the current campaign files — [criteria](#r71)

**Outcome:** The PM Stop hook's block message names the current two-file campaign layout.
**Kind:** bug
**Touches:** `.claude/hooks/check-pm-update.sh`

- **Acceptance:** when the hook blocks, its reason directs the agent to tick `4 - Checklist.md` and sweep to the Master Book's Shipped Log (`pnpm pm:archive`), or to add a Pain Inventory entry, and never names Feature State, Execution Plan or Vision/Decisions files. Blocking conditions are unchanged.
- **Implementation:** done
- **Evidence (2026-11-12):** the block reason now directs the agent to `pnpm pm:ship <ID>`, to add an untracked item to `4 - Checklist.md` with `### <ID>` criteria, or to add a Pain Inventory entry, and names no retired file. Only the `reason=` string and a `# enforces: HR-25` header changed; the blocking condition is untouched. `bash -n` passes, a run without a transcript exits 0, and `pnpm sync:ai:check` verifies the Codex copy.

### R89

- ✅ 2026-11-12 — **R89** Hold each Master Book to a size budget — [criteria](#r89)

**Outcome:** Working one item no longer requires loading a book of several hundred kilobytes.

**Kind:** maintenance
**Touches:** none

- **Source:** [Fable 2 finding F2-21](<../../Fable 2/01 - Architecture/Agent Context Economy.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** Each book's state log keeps its last three entries and moves older ones to a dated archive file; criteria for shipped IDs move with them. `CLAUDE.md` tells agents to read the checklist, the one ID section and the Successor Briefing, not the whole book. `pm:lint` and `pm:check-docs` pass; no ID, shipped record or decision is lost.
- **Tier:** CLAUDE_MID. Routing: [Fable 2 model tiers](<../../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Books total 1.78 MB; Delivery is 387 KB. Retention rule already exists in `_Conventions.md` §6. Editing `CLAUDE.md` needs `pnpm sync:ai`.
- **Implementation:** done
- **Evidence (2026-11-12):** `pnpm pm:ship` (`scripts/pm/ship.mjs`; 16 fixture tests in `tests/pm-ui/ship.test.ts`) moves the criteria of shipped IDs, the full text of receipts longer than 200 characters and state-log entries beyond the newest three to `_Archive/Shipped/<Campaign>.md`, and retargets links to moved anchors. First run: the eleven books went from 1.84 MB to 1.42 MB (Delivery 389 → 255 KB, Hub & ERA 333 → 259, Budget 251 → 163, PM Tooling 201 → 145); 54 criteria sections, 280 receipts and 61 state entries were archived. Every Shipped Log still holds one dated line per receipt and the per-campaign record counts are unchanged; 279 open tasks before and after. Sections that declare `UAT: pending` or `Execution: owner` stay in the book. `CLAUDE.md` (Boot Sequence) and `start-task` tell agents to read the checklist row, the one `### <ID>` section and the Successor Briefing, not the whole book. `pm:lint` and `pm:check-docs` pass.
- **Limit:** the criteria of open items (about 0.9 MB) are live plans and were not touched. A book shrinks further only as its items ship or its plans are trimmed.

### R100

- ✅ 2026-11-12 — **R100** Ship work with one command and keep one navigable front door — [criteria](#r100)

**Outcome:** Shipping an item is one command, the PM index shows the week, the owner's actions and every campaign on one page, and no superseded document sits beside a live one.

**Kind:** maintenance
**Touches:** `scripts/pm/ship.mjs`, `scripts/pm/lint.mjs`, `tests/pm-ui/ship.test.ts`, `package.json`, `.claude/`, `CLAUDE.md`

- **Source:** owner commission, 2026-11-11: restructure the agent setup and the vault so work is easy to navigate, understand and acknowledge; archive shipped work and provide a script for it.
- **Acceptance:** `pnpm pm:ship <ID>` ticks, stamps, archives and verifies, and `--undo` restores every touched file. `_index.md` carries a generated block with this week's sprint, the owner's actions, work awaiting acceptance and per-campaign counts. Each checklist groups its lanes under bold labels, with owner-only rows under **Needs you**. No audit-generation folder or completed study sits in an active vault or PM folder. `pm:lint`, `pm:check-docs`, `sync:ai:check` and the PM and setup test suites pass.
- **Implementation:** done
- **Evidence (2026-11-12):** **Script:** `pnpm pm:ship` and `pnpm pm:index` (`scripts/pm/ship.mjs`), 16 fixture tests covering tick, sweep, compaction, link retargeting, idempotence, CRLF files, dry run and undo. **Queue:** all eleven checklists regenerated from a lane and group spec with every ID asserted present (279 before and after); vague titles rewritten; the Delivery checklist's eight queue notes moved into their item sections; Now reduced from 34 rows to the four sprint members plus three ERA reports; 18 owner-only rows grouped under **Needs you**; lint no longer warns on an empty Now. **Sprints:** see R87. **Vault:** 20 FABLED audit folders and their two master indexes moved to `ERA Notes/_Archive/Vault Audits/`; six historical notes to `ERA Notes/_Archive/Historical Notes/`; `Home.md` replaces the stale dashboard; `Vault Setup.md` states where each kind of document goes; Meal Planning's vault folder moved to Standalone to match the code and the Feature Index; the retired Focus page is recorded as retired in the Feature Map and `CLAUDE.md`. **PM folder:** six September Delivery consumption studies and three finished plans moved to `_Archive/`. **Links:** 0 broken relative links across 334 active vault documents (2,443 links). **Agent setup:** two keyword-nudge prompt hooks removed; the session brief now reports the stale DB snapshot (its `generated_at` match never fired on the escaped JSON) and reads every campaign; stale references fixed in five skills; `os:check` warnings 11 → 6 and the `NAME-BOUND` error cleared. **Checks:** `pm:lint` 0 errors 0 warnings, `pm:check-docs` pass, `sync:ai:check` verified, `docs:check` pass, typecheck clean, ESLint clean on changed files, 64 PM and setup test files (748 tests) pass. No product code, database or paid API was touched.
- **Known limits:** `os:check` still reports 68 `PORTABLE` errors from the committed `settings.local.json` (owner's choice) and one Codex `PARITY` error for Hard Rule 26. Ten dead source paths remain in Feature Map files other than Focus. `docs/` at the repository root (32 files) was not reorganized. Vitest must be started from a `C:\` working directory; a lowercase drive letter breaks `vi.mock` in four Delivery UI test files.

### R6

- ✅ 2026-11-14 — **R6** Verify the replacement PM UI before retiring rollback files — [criteria](#r6) (A5 cockpit and Library parity; 741 tests/59 files; typecheck and focused lint clean; PM/docs checks; desktop/390px and fake-driver gates; static/V1 retained. Full lint has existing checkout errors.)

**Outcome:** Verify the replacement PM UI before retiring rollback files.

- **Current owner scope — 2026-11-14:** explicitly included under R97: Library parity plus desktop/390 px and fake-driver gates before retiring the two local UI entry points. This is presentation retirement only; DLV-103's V1 execution/recovery retirement and the separate phone rollback remain held by their own evidence. Document/file controls, pins/recents, contents, checkbox witnesses/Undo, exact reorder Undo and merged/proposal gate controls now have React paths. Synthetic spec → plan → UAT → shipped was observed without provider or production DB calls. Static export and the V1 reader remain covered by regression tests. [Detailed evidence](<../../../../docs/Skills-and-Agents.md#pm2-cockpit-a5--r97>).

- **Acceptance:** Complete the desktop + 390 px visual UAT and a fake-driver delivery walkthrough, then delete the legacy `client.js` / `styles.css` / `body.html` and the `?ui=old` rollback surface
- **Command Center Phase 6 (2026-09-11):** retiring duplicate presentation and control paths happens here after R60 and the Delivery trial (DLV-102); extract shared parser/model dependencies first and keep V1 history readable.
- **Phase 6 status (2026-09-12): dependencies extracted; nothing retired.** `shared/product.mjs`, `portfolio.mjs`, `history.mjs` and `metrics.mjs` now serve the primary app, bridge and relay; `scripts/pm/src/lib/` only re-exports for the classic build. Retirement did not start: the DLV-102 trial has no receipts, and this gate's desktop/390 px UAT of classic-only journeys (document checkboxes, file operations, the fake-driver three-gate walkthrough) was not rerun — the React Reader is still read-only. Candidates once those pass: `?ui=old` (`client.js`, `body.html`, `styles.css`, `buildHtmlLegacy`); `?ui=classic` presentation once its remaining tools have React replacements; `/pm/live?ui=legacy` after R63/R42 phone acceptance. Keep: the static/hosted read-only export and the V1 session reader.

**Retained contract — ASTRA-R-3:**

- **Outcome:** One maintained desktop UI serves the owner and every successor agent.
- **Money/schedule math?:** No.
- **Gate:** `pnpm vitest run tests/pm-ui/build-smoke.test.ts tests/pm-ui/static-twin.test.ts tests/pm-ui/ordinal-parity.test.ts` → all pass, nonzero tests. `rg -n "buildHtmlLegacy|ui=old" scripts/pm/ui.mjs scripts/pm-server.mjs` → no matches, exit 1 expected. `Get-Item -LiteralPath scripts/pm/client.js,scripts/pm/styles.css,scripts/pm/body.html -ErrorAction SilentlyContinue` → no output. UAT evidence at desktop and 390px: Overview, Work Queue filters/reload, document checkboxes, Search, Inbox, fake-driver launch/three gate decisions/final acceptance; static twin offers no mutations. `pnpm typecheck` and `pnpm pm:lint` → exit 0.

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/PM Tooling/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Deletion gated on verification. The files to retire exist and are real: `scripts/pm/client.js`, `scripts/pm/styles.css`, `scripts/pm/body.html`, and the escape hatch is documented in `scripts/pm/ui.mjs` ("`--ui=old` or `?ui=old` keeps the proven legacy surface available during final parity QA") — grep `ui=old` there before deleting anything, because the flag is also plumbed through the server. The replacement is the React app under `scripts/pm/app/` built by `scripts/pm/build.mjs` and served via `scripts/pm/app-shell.mjs`. Existing coverage to lean on: `tests/pm-ui/build-smoke.test.ts`, `react-app-build.test.ts`, `static-twin.test.ts`. The 390 px visual UAT and the fake-driver walkthrough are the two things no test currently proves — do them before the delete, not after.

**Execution plan — 2026-09-26**

**Readiness:** Held for replacement coverage and trial evidence; deletion is last.

**Verify:** `pnpm exec vitest run tests/pm-ui/build-smoke.test.ts tests/pm-ui/static-twin.test.ts tests/pm-ui/ordinal-parity.test.ts`; capture desktop/390px journeys with a fake driver and no bridge before deletion.

```delivery-plan-v1
{
  "outcome": "Retire only rollback presentation paths whose replacement journeys are proven.",
  "acceptance": [
    "Replacement journeys pass before deletion.",
    "Static read-only export and V1 session history remain usable."
  ],
  "scope": [
    "scripts/pm/client.js",
    "scripts/pm/styles.css",
    "scripts/pm/body.html",
    "scripts/pm/ui.mjs",
    "scripts/pm-server.mjs",
    "tests/pm-ui/"
  ],
  "steps": [
    "Inventory old-only document/file actions and check replacement coverage; missing actions are blockers, not permission to drop functionality.",
    "Collect R60 and DLV-102 evidence plus desktop/mobile fake-driver receipts using node scripts/pm-server.mjs --no-bridge.",
    "Remove the three legacy files and ui=old wiring only after the named gate passes.",
    "Run both retained builds and history/static tests; document precisely which rollback surface retired."
  ],
  "invariants": [
    "No agent starts the production relay.",
    "Shared parsers are retained."
  ],
  "exclusions": [
    "Classic or phone-legacy retirement without their separate gates."
  ],
  "checks": [],
  "risks": [
    "React Reader is documented as read-only; parity cannot be assumed."
  ],
  "unknowns": [
    "Current replacement parity and real DLV-102 trial receipt."
  ],
  "dependencies": [
    "R60",
    "DLV-102"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted retirement gates reviewed; no visual or device acceptance performed."
}
```

### R86

- ✅ 2026-11-14 — **R86** Show the next action, what needs the owner and what is running on Home — [criteria](#r86) (A5 cockpit and Library parity; 741 tests/59 files; typecheck and focused lint clean; PM/docs checks; desktop/390px and fake-driver gates; static/V1 retained. Full lint has existing checkout errors.)

**Outcome:** The first screen of the Command Center says what to do next.

**Kind:** feature
**Touches:** `scripts/pm/app/Bridge.tsx`, `scripts/pm/app/PrimaryNavigation.tsx`, `scripts/pm/app/model.ts`

- **Implementation — 2026-11-14:** absorbed by R97's Bridge: Needs you / Running / Next up, first three ready items in Now/Next order, one-click Decisions count, Now / Next / Later with Blocked as a filter. Existing Delivery grouping and guarded launch eligibility remain authoritative; pending/stale Delivery never becomes a confirmed idle count.

- **Source:** [Fable 2 usability review U1, U5, U6, U8](<../../Fable 2/10 - Project Management/Command Center/1 - Usability and Visual Review.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** Above the fold at 1440x900 and 390x844, Home shows three short lists: Needs you, Running, Next up (top three by lane order). One lane vocabulary (Now / Next / Later) is used on Home, Work and Analytics, with Blocked as a filter. Decisions is reachable in one tap with its count. Hero headlines are one line or gone.
- **Tier:** CLAUDE_MID. Routing: [Fable 2 model tiers](<../../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** [Functional roadmap](<../../Fable 2/10 - Project Management/Command Center/2 - Functional Roadmap.md>), changes 1 and 4. Load `ui-guardrails`; tests in `tests/pm-ui/`.

### R97

- ✅ 2026-11-14 — **R97** Build the PM.2 cockpit and keep PM.1 as the library — [criteria](#r97) (A5 cockpit and Library parity; 741 tests/59 files; typecheck and focused lint clean; PM/docs checks; desktop/390px and fake-driver gates; static/V1 retained. Full lint has existing checkout errors.)

**Outcome:** An interactive dashboard shows what to do now, the setup per agent, each session's flight report and scores; the existing Command Center remains the place for documents.

**Kind:** feature
**Depends on:** R93
**Touches:** `scripts/pm/`, `scripts/pm-server.mjs`, `tests/pm-ui/`, `tests/pm-relay.test.ts`

- **Source:** [Agentic OS PM.2 product design](<../../Fable 2/Agentic OS/09 - PM.2 Product Design.md>), [visual and motion language](<../../Fable 2/Agentic OS/10 - Visual, Motion and Game Layer.md>) (2026-11-10). Filed 2026-11-10.
- **Owner scope — 2026-11-14:** deliver the four A5 slices in this pass; include Library parity before gated retirement of the two local rollback UIs, and full read-only Sessions over the existing phone relay. Reuse current Delivery launch; A6/A7 and new detector/schema logic remain excluded.
- **Implementation/evidence — 2026-11-14:** `scripts/pm/cockpit*.mjs` projects A1–A4 on a coalesced worker, with explicit pending/stale states and no new persistence. `Bridge.tsx`, `Setup.tsx`, `Sessions.tsx`, `Score.tsx`, `Library.tsx` and the existing transport/manifest carry the cockpit. Home/Delivery/Analytics aliases preserve filters; Library retains document and file operations/Undo. Local legacy/classic routes and three legacy assets retire after the desktop/390 px and synthetic fake-driver gates; static export, V1 execution/history and separate phone legacy reader remain. Baseline deltas and fingerprint/count comparisons show only recorded facts; absent historical source hashes, dates, UAT and accounting remain unknown. Detailed evidence and limits: [Skills and Agents](<../../../../docs/Skills-and-Agents.md#pm2-cockpit-a5--r97>).
- **Verified — 2026-11-14:** 741 tests / 59 files; full typecheck, focused lint (zero warnings), `docs:check`, `pm:lint`, `pm:check-docs` and `git diff --check` pass. Desktop/390 px checks cover pins/comparison, evidence links, all file operations and Undo, capture Undo across routes, old-route redirects and Setup with `.os/` absent. Three rows per Bridge list end above the phone nav. Real local worker read: 1,852 ms, maximum host timer gap 19 ms, cached snapshot read 0.007 ms. In-flight relay publication regression preserves the completed snapshot; OS-only updates bypass PM/Drive write paths. Full-checkout lint was run and fails on 9,284 existing checkout errors, including generated scratch bundles; changed-file lint is clean. No physical-phone/deployed relay pass, paid API or production DB write is claimed.
- **Acceptance:** Split before dispatch. Slices: Setup (map, rulebook, conflicts) from the registry alone; Sessions from the recorder; Bridge; Score. Home, Delivery and Analytics move into PM.2 and no screen exists in both products; PM.1 keeps documents, checklists, inbox, decisions and history. Every number opens its evidence in one click; motion respects reduced-motion; clearing `.os/` loses no backlog or rule. Arrival retires the two older UI generations (R6).
- **Tier:** CLAUDE_MID; CLAUDE_HIGH for the setup map. Plan: [Agentic OS roadmap](<../../Fable 2/Agentic OS/12 - Roadmap.md>).
- **Reading guide:** Sessions needs R95. Absorbs R86's Today block as the Bridge. Load `ui-guardrails`; Hard Rule 28 applies to PM.2's own text.

### R101

- ✅ 2026-11-14 — **R101** Make the Agentic OS cockpit readable and actionable — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r101>) (Refactored Agentic OS UI and corrected design spec; typecheck, focused lint, 39 targeted tests, build and three credential-free browser suites pass. Desktop/tablet/390px Blue/Pink; owner visual acceptance pending.)

### R102

- ✅ 2026-11-14 — **R102** Give Bridge calm and cinematic views with truthful charts — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r102>) (Calm and chart-led Game Bridge implemented locally. Typecheck, PM build, focused ESLint, 31 replay tests in 7 files and frozen-source 390/768/1440 Blue/Pink browser checks pass; chart drilldowns, SDK uncertainty, motion/reduced-motion, persistence and queue links verified. Evidence .pm/r102-evidence/; owner visual/physical-device UAT pending; not deployed.)

### R103

- ✅ 2026-11-14 — **R103** Restore the header Game layer icon and visible rotation — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r103>) (Restored original Orbit header SVG; white off, shining blue gradient on, 45-degree 380ms rotation. Typecheck/scoped lint/build and 6 Game layer tests pass; isolated 1440/390 Blue/Pink browser checks confirm actual intermediate rotation, keyboard/reduced-motion behavior and no overflow/errors/writes. Owner visual UAT pending; local only.)

### R104

- ✅ 2026-11-14 — **R104** Animate the Game-layer ERA core from delivery state — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r104>) (Implemented sustained Game-mode ERA rotation, delivery-state color/friction and cosmetic keyboard/click throttle. Typecheck, PM build, scoped lint,31 tests7files, formatting and scoped whitespace pass; frozen core browser24 state/theme/viewport combinations plus functional checks and existing Bridge regression pass with zero errors/writes/native calls. Nine candidate hashes match. Owner visual/physical-device UAT pending; local only.)

### R105

- ✅ 2026-11-14 — **R105** Give the ERA core overload intensity and gradual cooldown — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r105>) (Local overload wheel and gradual cooldown complete; final typecheck, PM build, scoped lint/format and 37 scoped tests covered (cockpit timeout resolved by isolated rerun). Frozen browser pass covers 24 state/theme/viewport cases plus throttle, retrigger, session coast, keyboard, hidden/reduced motion; no writes/provider calls. Candidate hashes and owner UAT in .pm/r105-evidence; owner acceptance pending.)

### R106

- ✅ 2026-11-14 — **R106** Restore ERA core identity and soften Game motion — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r106>) (Restored orbital ERA identity and softened heat, sparks, smoke and vibration. Typecheck, PM build, scoped lint/format and 11 core tests pass. Isolated 1440/390 Blue/Pink browser geometry, throttle/coast, running and reduced-motion checks pass with zero overflow/errors/writes/provider calls. Owner appearance/device UAT pending; local only.)

### R107

- ✅ 2026-11-14 — **R107** Compose skill prompts freely with optional module context — [criteria](#r107) (Slash-skill Launch composer with optional Module/work context and Guided forms. 50 replay tests, typecheck, PM build, scoped ESLint, docs checks and source-bound desktop/390px Blue/Pink browser flows pass. Full lint retains 9285 errors; native execution and owner UAT remain separate.)

**Outcome:** Use any registered skill with a free prompt and optional module context; keep guided forms available.
**Kind:** feature
**Implementation:** done
**UAT:** rejected — owner found no incremental product value, 2026-11-14; primary workflow superseded by R108.
**Touches:** `scripts/pm/app/Launchpad.tsx`, `scripts/pm/app/launchpad.css`, `scripts/os/forms.mjs`, `scripts/os/launchpad.mjs`, `tests/os/launchpad.test.ts`, `tests/pm-ui/`, `docs/Skills-and-Agents.md`, `ERA Notes/`
- **Acceptance:** Default slash-skill composer supports all canonical registered skills, preserves prompt text when choosing a skill, and prepares add-feature without a PM task. Module remains visible and optional. Work item is clearly labelled optional context except era-wire's required ERA report. Eight existing guided forms retain strict validation and new-module dry run. Presets are scoped to the chosen skill. Preview/copy retires on edits; module/item/tier/path checks, required guardrails and PowerShell quoting remain. Verify desktop and 390 px Blue/Pink, keyboard selection, failures and clipboard; no native execution or provider calls.
- **Source:** Owner Launch review, 2026-11-14.
- **Boundary:** R98 still owns native launch and genuine report binding. This outcome prepares and copies prompts only.
- **Implementation (2026-11-14):** Free slash composition exposes all 18 current canonical skills; Guided retains eight sidecars. Work item is optional context except era-wire's validated report. Presets are skill-scoped and their overrides reset on skill changes. The original request, module/work context and explicit paths survive Prompt/Guided transitions, including forms without declared context fields. Automatic knowledge skills, current registry/PM checks, PowerShell quoting, guarded dry-run and stale-preview retirement remain.
- **Owner test / candidate:** Restart local `pnpm pm` once to load the updated server request schema, then open Launch. Candidate hashes and browser receipts: [R107 evidence](<../../../../.pm/launch-composer-evidence/candidate.json>). No production data, credentials or native session are needed.
  - Type `/add-feature Let me filter recipes by preparation time`, choose Module → Recipes, then Review prompt → Copy prompt. Expected: original words and module are present; no work item is required. Edit the request: old Copy controls disappear.
  - In Context & settings, choose a current Work item and an existing Target path. Switch to Guided, fill required fields and review. Expected: original Request, Module, work link and path survive. Switch to a skill without a form, such as `/pwa-install`: free composition is available.
  - Choose `/fix-bug`, apply Money bug under Preset, then choose `/wizard`. Expected: wizard uses its default tier and no inherited Money-bug attachments. Check the same flow at phone width in Blue and Pink; actions remain reachable. These manual acceptance results are unrecorded.
- **Limits:** Copy does not execute an agent. Native selector entitlement, physical-phone deployment and owner visual acceptance remain unverified; R98 stays open. Full-repository lint still fails with 9,285 errors / 51,985 warnings; changed-file lint is clean. Full output: `.pm/launch-composer-evidence/lint-full.txt`.
- **Verification (2026-11-14):** 50 focused replay tests pass (Launch, registry and cockpit); typecheck, PM React build, changed-file ESLint, format/whitespace and docs/PM checks pass. Final isolated Chrome suite matches all four runtime source hashes and covers free/no-item composition, skills without forms, keyboard slash completion, shared Request/Module/Work item/Target paths through Guided, presets and reset, stale results, real clipboard, required ERA report, failed preparation/retry, new-module dry-run/junction, and 390 px Blue/Pink. Earlier cockpit regression passes at 390/768/1024/1440 px. Root inspected desktop and phone screenshots. Fixtures were stopped. [Browser receipt](<../../../../.pm/launch-composer-evidence/browser-result.json>).

### R108

- ✅ 2026-11-14 — **R108** Replace the redundant skill-launch destination with actual Work — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r108>) (Replaced primary skill launch with existing Work/Now and retained optional Setup prompt tools; 57 focused tests, typecheck, PM build, scoped lint, docs checks and isolated desktop/390px Blue/Pink navigation flows pass. Fixed reproduced Local readiness text overlap. 13 runtime hashes match fixture; no agent execution or deployment; owner acceptance pending.)

### R109

- ✅ 2026-11-14 — **R109** Open Plan directly and realign unfinished sprints without reshuffling — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r109>) (Plan opens Sprints; Realign preview/Apply/Undo and preview-first CLI shift active/draft ranges together with backups and preserved scope/history. 99 tests, typecheck, build, scoped lint, docs checks and isolated desktop/390px Blue/Pink realignment plus Work navigation pass. Actual plan not shifted; owner UAT pending.)

### R110

- ✅ 2026-11-14 — **R110** Make Sessions and Delivery status and item details readable — [criteria](#r110) (Agent history naming, canonical delivery status dashboard and visible item planning/acceptance/reference panels. Verified 76 focused offline tests, typecheck, PM build, changed-file lint, documentation checks and credential-free desktop1440/mobile390 Blue/Pink browser flows; zero writes/external requests. Owner visual/device acceptance pending.)

**Outcome:** Sessions clearly distinguishes agent history from delivery work; delivery status counts and item details are readable without opening a stack of disclosures.
**Implementation:** done
**UAT:** rejected — superseded by R111

**Owner review (2026-11-14):** rejects the backlog widgets, long lists, Item overview / Runs & reviews split and Markdown UAT redirects. R111 replaces the information architecture; R110's passing fixtures did not establish product acceptance.
**Kind:** feature
**Touches:** `scripts/pm/app/Sessions.tsx`, `scripts/pm/app/DeliveryHome.tsx`, `scripts/pm/app/DeliveryOverview.tsx`, `scripts/pm/app/deliveryOverviewModel.ts`, `scripts/pm/app/delivery-overview.css`, `scripts/pm/app/Work.tsx`, `scripts/pm/app/work-detail.css`, `tests/pm-ui/`

- **Acceptance:** Recorded is named Agent history with a short explanation. Delivery shows filterable counts for Not started, In progress, UAT, Waiting and Completed previously, retaining unknown/stale evidence and canonical item identity. Attempts, cancellations and reopened work cannot inflate completed items.
- **Acceptance:** Item details retain Deliver and Open in CLI, show organization as a visible path, acceptance as readable criteria, and references as visible cards. Existing mutation, Undo and launch boundaries remain.
- **Acceptance:** Desktop and 390 px Blue/Pink browser checks cover filters, drilldowns and visible detail sections; focused model tests, typecheck, build, changed-file lint and PM checks pass. No live provider or production database action.

### R111

- ✅ 2026-11-14 — **R111** Show actionable session states and per-item UAT without backlog clutter — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r111>) (Replaced nested Sessions dashboards with one state workspace, campaign collections and six-card pages; authored per-item Action/Expect wizard with durable source-bound starts and active-revision safeguards. Verified 149 focused replay tests, typecheck, PM build, scoped lint, desktop/390 px Blue/Pink with 71 queued tests, and disposable-fixture Start/result/reload plus revised instructions creating a fresh Pending attempt. Owner visual and physical-device acceptance remains pending; no production writes or provider runs.)

### R112

- ✅ 2026-11-14 — **R112** Repair Agentic OS setup diagnostics and clarify rule coverage — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r112>) (Repaired setup configuration and diagnostics. Fresh scan has zero errors and warnings with 12 informational notes. 193 OS tests and 74 PM tests pass, along with typecheck, scoped lint, mirror parity and PM build. Final desktop and 390px Blue/Pink browser checks pass, and running local server assets match. Owner UAT pending.)

### R113

- ✅ 2026-11-14 — **R113** Simplify Deliver launch and add a distinct Game view — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r113>) (139 backend replay and 31 frontend tests; typecheck, PM build, scoped lint and docs pass; desktop/mobile calm/game browser flows pass. Owner UAT and bridge restart pending; no live session launched.)

### R114

- ✅ 2026-11-14 — **R114** Choose model and effort for Local delivery — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r114>) (Local Model/Effort controls and catalogue validation; 25 replay tests, typecheck, scoped lint, PM build, browser payload/reset/mobile checks pass. Owner bridge restart and UAT pending.)

### R115

- ✅ 2026-11-14 — **R115** Default delivery settings from the item's Markdown recommendation — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r115>) (Markdown tier/effort defaults and sparkle restore markers in Local/Confined; 11 focused tests, typecheck, build, scoped lint and desktop/mobile browser checks pass. No provider calls; owner UAT pending.)

### R116

- ✅ 2026-11-14 — **R116** Validate Local sign-in against its cleaned worker environment — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r116>) (23 Local replay tests, scoped lint and PM checks pass; corrected offline subscription lookup passes existing Claude Pro credentials despite host app API config. Owner restart/UAT pending; no native or provider session started.)

### R117

- ✅ 2026-11-14 — **R117** Restore Local session review and accurate Bridge execution states — [criteria](<../../PM Tooling/PM Tooling — Master Book.md#r117>) (Restored Local session review; corrected active/failed/blocked Bridge states; fixed process.env freeze crash; preserved failed attempts. 597 relevant plus 44 adjacent tests, typecheck/build/scoped lint/docs and 28 desktop/mobile browser screenshots pass; actual run/Bridge read-only verification passes. Owner bridge restart and live retry pending.)

## State log

_Moved from the Master Book on 2026-11-11._

**2026-10-25 — R81 UAT discovery repair:** Delivery opens with **Review & sign off**, visible work IDs, date, readiness and **Start test / Continue / View steps** links. Search spans IDs, titles and campaigns; To test / Not ready / Feedback / History / All retain search, filter and pagination when returning from the wizard. Apply/conflict actions have their own **Delivery actions** section. The initial local store had 62 records (49 draft, 13 incomplete), not 62 owner-ready tests. Nineteen steps lacked explicit expected-result markers, one more used a comma before lowercase expect, and two used lowercase expect after a sentence/semicolon; wording and the parser are repaired without inferring PASS or readiness. Verification and owner steps are recorded under R81.

**2026-10-25 — R80 Delivery identity/navigation/session repair (local source and offline fixtures):** shared legacy rows now show the work ID/campaign and recorded date/time, with older update-only responses labelled Updated. History is newest-first, paginates beyond 50 and retains its outcome filter on return. More restores Activity, Decisions, Idea inbox and Documents. Shared pairing recovery covers Delivery and direct Test links; UAT reads wait for pairing. Unavailable/stale reads cannot claim Nothing running, and a known Apply decision survives a missing queue. V1 Accepted remains distinct from Applied. Typecheck, changed-file lint and 383 PM/relay tests pass; 32 isolated browser scenarios cover 320/390/701/1440 px and Blue/Pink with synthetic pairing only. Existing local health/assets return 200 and serve the recovery code; its V1 response contains all 16 IDs but only update times. No operational pairing, provider, launch, Apply or DB write was performed. [Owner scenarios](<../../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m14--restore-delivery-identity-navigation-and-browser-access>).

**2026-10-25 — novice UAT instructions and sign-off workflow specified (documentation only):** [PM/Delivery walkthroughs](<../../../../docs/Delivery-UAT-PM-Review-2026-10-25.md>) cover the completed review, lifecycle, phone, search, Analytics and sprint scopes awaiting owner acceptance; [current attempts](<../../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md>) include R73/R74/R75. The separate [UAT wizard/sign-off/feedback specification](<../../Plans/Delivery UAT Sign-off and Feedback.md>) defines future UI and deterministic import into the canonical backlog, preserving engineering Done and historical receipts. [Coverage index](<../../../../docs/Delivery-UAT-Scenarios-2026-10-25.md>). No new UI/importer is implemented and no manual result is inferred from drafting.

**2026-10-24 — R73 navigation, local source/fixtures:** shared desktop/phone order is Home / Sprints / Delivery / Work / Analytics. Delivery is raised above the bar; observed execution softly alternates gold/purple, waiting stays steady, and unconfirmed/closed states do not animate. Existing V1/V2 read queries supply the signal. 305 PM UI tests passed; typecheck/scoped lint clean. Isolated Chrome fixtures exercised 1280/701/390/320 px, Blue/Pink, navigation, idle/running/waiting/stale/offline and matched reduced-motion CSS. No provider job, launch, policy change, service restart or deploy; hosted phone acceptance remains pending.

**2026-10-03 weekly delivery (R61):** Home / Sprints / Work / Delivery / Analytics now share the desktop and phone shell. Eight editable draft weeks start October 5 with 25 canonical item references and 42 known points at planning revision 4; weekly capacity remains six provisional points and 90 review minutes. Mixed-module and module-focus previews can replan drafts or append weeks. Start freezes commitment and its criteria witnesses; scope edits and explicit carryover are recorded. Each visit derives To do / Active / Review / Done and blocked/input reasons from the current corpus and V1/V2 receipts. Candidate/run status never fabricates a shipped item. Closed weeks freeze their observed outcome; Analytics uses the same work/history definitions. Named deliverable groups, capacity/unknown estimates, milestone badges and reduced-motion behavior are included. Local writes use existing pairing, revision checks, durable command IDs and an OS-released native mutex. Watcher-only observations record observed UTC time and known source receipt dates without inventing historical occurrence dates. Verification uses copied fixtures and Chromium at 1440/820/700/390/320 px in blue/pink; no production DB access, provider run, deploy or physical-phone acceptance. Phone planning edits need the owner migration and `PM_SPRINT_RELAY=1` in [PM Relay Setup](<../../../06 - Setup & Onboarding/PM Relay Setup.md>).

**2026-09-26 Command Center navigation and question presentation (R69):** the shared local/phone UI now uses the ERA Memory mark, puts Now / Up next / Waiting / Someday and all module cards on Home, and adds Analytics as a fourth destination. `#/analytics` retains `#/dashboard` as an alias and combines the existing detailed metrics with In focus, fourteen daily shipped-record counts and receipt drilldowns. Work cards show their source ID; search survives To do / Done and Board / List navigation. Delivery question options already present in question text become selectable answers, with an explicitly marked recommendation first and editable free text retained. This is presentation work only: no worker instructions, execution contracts, relay commands, approval or Apply behavior changed. Verification and the remaining question-generation limitation are recorded under [R69](<../../PM Tooling/PM Tooling — Master Book.md#r69>); this entry does not claim deployment or physical-phone acceptance.

**2026-09-15 Delivery production-view cleanup (R66):** launch no longer prints recommendation prose or raw coordination/resource codes. Unavailable executors open one owner-facing cause. A blocked run now names its actual blocker rather than presenting a generic “Ready” verdict beside it. Review order is Plan → Verification → Activity → Changes; Changes remains the final Apply surface. Plan has a desktop artifact rail and visible Risks/Unknowns sections; verification, application history, token comparison and run facts no longer depend on collapsed disclosures. The global slogan/reference footer is gone. Component, model, bundle, type and lint evidence is local; no browser was connected for a fresh visual pass, so desktop/phone owner UAT remains pending.

**2026-09-15 lifecycle correction:** the earlier rule kept code-complete work open pending owner acceptance. The checklist now contains remaining executable work; done scopes have exact Shipped Log receipts, and owner-only checks retain their IDs under [UAT](<../../../../docs/Delivery-UAT.md>). Done means implemented locally with recorded verification, not deployed or owner-accepted. Historical status narratives below must be read at their evidence dates.

**2026-09-14 Phase 3 history/readability foundation (local, not owner-accepted):** a Work page now discovers V2 attempts by stable campaign/normalized work ID and retains a history shell when the current checklist row no longer exists. Delivery shows recorded profile recommendation/override beside settings. This is a narrow R55/R64 foundation, proven by targeted Delivery/PM fixtures and typecheck; it does not yet provide full historical filters/pagination, relay walkthrough, responsive owner acceptance or completion of R55/R64.

**2026-09-14 first Delivery trial hotfix planning:** the owner tested `r-c1d69bb666cf` / DLV-107 and reported unreadable text, weak review/control and no path back to the attempt. Runtime/journal inspection confirms a plan-approved one-line candidate, repeated inconclusive check Results, successful Apply and successful rollback. Work only follows active V1 runs, while V2 is separately loaded on Delivery. R55 now includes permanent item attempt history; R64 owns desktop/mobile reading and decision hierarchy. [Hotfix specification](<../Plans/Delivery First-Run Hotfix (2026-09-14).md>) contains all 13 concerns and evidence. This is documentation only; no UI or runtime change was made. Browser unavailable; no new visual/phone acceptance.

**2026-09-13 owner-requested review:** six targeted PM suites passed 46 tests; typecheck passed; ESLint completed with no errors (repository warning debt remains). A rendered navigation defect is filed as Delivery [DLV-107](<Delivery.md#dlv-107>) at the owner's request and prepared as the first small Focused/FAST trial. It remains unfixed. The shared Home/Work V2 activity omission is now explicit under R55. No available browser was connected, so this adds source/fixture evidence, not mobile/device acceptance.

**2026-09-12 Command Center Phase 6a (R62, dashboard in code; sprint and delivery comparisons outstanding):** `#/dashboard`, opened from Home, reads one history parser and one metric contract, locally and on `/pm/live`: open work by campaign and priority, completed and cancelled exact IDs by week with undated records and records lacking an exact ID shown apart, declared bugs, delivery attempts and dispositions apart from work, known usage per unit, and history coverage. Each chart has a table and a drilldown; totals reconcile on the live corpus. Sprint charts wait for R61 and value comparisons for real Delivery receipts. No presentation path was retired (R6) — see [R62](<../../PM Tooling/PM Tooling — Master Book.md#r62>).

**2026-09-12 Command Center Phase 4 presentation (R63, code landed; phone acceptance outstanding):** `/pm/live` now mounts the same React views as `pnpm pm` through a transport seam — local server or authenticated relay — instead of a separate phone app; the earlier view stays at `?ui=legacy` as the rollback. Views ask the transport's capabilities: on the relay, checklist writes, V1 launch/detail and classic links are absent, capture and every V2 command are relayed, and a status strip keeps laptop reachability, the last receipt and worker availability apart. Recovery and Apply are Delivery's ([DLV-104](<../../Delivery/Delivery — Master Book.md#dlv-104>), [DLV-105](<../../Delivery/Delivery — Master Book.md#dlv-105>)). Evidence is fixture, build and synthetic-render only; no real phone — see [R63](<../../PM Tooling/PM Tooling — Master Book.md#r63>).

**2026-09-11 Command Center Phase 1 (R60):** the primary React app's Work page and every module page now share one Board/List component over the canonical backlog — Now/Next/Later lanes, campaign/kind/status filters and view mode round-trip through the URL, blocked/active/review are badges rather than a relocated priority, and moves stay keyboard/tap-operable with the existing guarded Undo. Checklist rows get the same anchor slug as their brief heading, so Work items open and highlight the exact checklist line, distinct from the Master Book acceptance heading. Verified against 120 passing `pm-ui` tests and a live walkthrough (desktop plus a same-origin-iframe 390/320 px probe, since this sandbox's window resize had no effect); no real phone and no exhaustive Checklist/Brief sweep — see [R60](#r60) for the full evidence and limits.

**2026-09-11 Command Center adoption and Phase 0 (R59):** the owner approved [Command Center](<../../Plans/Command Center.md>). Phase 0 repaired canonical IDs, acceptance lookup and source/history anchors, and checkbox writes from the React, classic and legacy clients now refuse witness-less, reordered, mismatched and duplicate-ID targets. A read-only scan of the live corpus afterwards: 234 open outcomes in 11 campaigns (28 Now / 85 Next / 121 Later), zero empty contracts, zero unresolved references, every brief anchor present. Fixture and scan evidence only; no browser walkthrough, provider run or phone.

**2026-09-11 theme/connectivity correction (R58):** the local React app uses ERA's existing Blue palette (navy, cyan, violet) and Pink alternate. The health handler now accepts the shared connectivity manager's uncached `HEAD` probes as well as `GET`. The owner's running pre-fix process reproduced `HEAD 404` / `GET 200`; a server restart is required to load this backend change.

**2026-09-10 product experience reboot (R57):** `pnpm pm` now opens a standalone React 19 + TypeScript application with TanStack Query, Framer Motion, Radix sheets and the shared ERA mark. Today, Explore and Delivery replace the dashboard navigation and permanent inspector. The local Node server still owns Markdown and execution; the personal app remains Next.js 16. The Preact interface is an explicit `?ui=classic` reference fallback, and static/hosted exports remain secondary snapshots. R54/R56 read models and Delivery contracts are retained; their primary visual architecture is superseded.

**2026-09-10 comprehension pass (R56):** Project is the opening screen: all eleven areas, cross-area topics, Now/Blocked/Needs you/Delivering perspectives, live run summaries and dated changes. Selection and work previews stay beside the project on desktop and open in a keyboard-operable phone dialog. Area ownership remains canonical; perspectives are read-only projections.

**2026-09-10 product refactor (R54):** the local Preact app now follows Overview → Campaign → Work → Delivery setup → live execution → outcome. Campaigns derive only from canonical checklists and their Master Books; open decisions come from `_Decisions.md`. Shipped and cancelled numbers count dated log records, not a fabricated percent-complete denominator. The static Preact twin shares the product views, while `/pm/live` remains its separate React/relay application.

**Verification boundary:** desktop 1536 px and mobile 390 px Chromium fixtures exercised planning screens, the launch/approval/pause/accept/ship flow, artifact keyboard focus, retry and static read-only mode. Launch previews and preflight were generated by the actual Delivery route handlers against copied fixture documents; execution states and mutations in the browser walkthrough were simulated. No real provider session, production DB write or phone/PWA installation was exercised. R6, R37, R42 and R51 retain their broader acceptance.

The local React application, Preact reference/static outputs and separate React relay share parsing contracts. There is no claim of one visual bundle everywhere. Browser offline/Undo evidence for the new app is under R57; broader legacy-client, hosted provenance and real-device acceptance remain separate.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../2026-09-10 PM Refactor/Before/PM Tooling/PM Tooling — Master Book.md>) preserves detailed older narratives and receipts.

**2026-10-03 sprint start correction (R61):** A paired local browser could read the sprint and show Start, then receive `local-session-required`. The browser cookie is scoped to `/api/delivery/v2`, while the new planning POST went to `/api/planning`; that request therefore had no cookie. Sprint writes now use `/api/delivery/v2/planning` under the existing paired-session and CSRF checks. The phone relay still uses its bridge credential. A local browser fixture with a real scoped cookie and the targeted auth/relay suite verify the correction; physical-phone UAT remains pending.

**2026-10-03 disabled Start correction (R61):** The owner's revision-6 replan exposed a second defect: forecasts leave review estimates unknown, but Start disabled itself and the transition refused unknown estimates. Estimates are now optional planning aids, retained as null in the frozen commitment; over-capacity remains visible without preventing Start. Unsplit L work still needs an explicit point estimate. Unknown totals display a dash, partial totals a plus; active weeks no longer offer the draft-only estimate editor. Disabled Start gives a short reason and links to Delivery pairing or the active week where applicable. Regression coverage includes unknown/over-capacity commitment, persistence and close; copied-plan browser verification covers the real paired-cookie path and a second active-week refusal. The owner's plan stays unchanged.

_Moved from the Master Book on 2026-11-12._

**2026-11-10 — Fable 2 filing (documentation only):** R84, R85, R86, R87, R88, R83, R89, R90, R91 added to the checklist with criteria below. Sources are the 2026-11-04 Major Bug Sweep, whose IDs had not been filed, and the [Fable 2 analysis](<../../Fable 2/_index.md>) at commit `8da80ae`. Nothing is implemented, applied or verified by this entry.
