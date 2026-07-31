---
created: 2026-07-13
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "PM Dashboard Refactor (_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan) + the root FABLED 2 / FABLED 3 audits of the PM machine itself (originals in ../_Archive/)"
tags:
  - pm/master-book
  - tooling/pm
---

# PM Tooling — Master Book

> **Campaign:** PM Tooling · prefix `R` (grandfathered) · working queue → [4 · Checklist](<4 - Checklist.md>)
> **What this file is:** the consolidated record for the PM machine itself — the Command Center dashboard, the parsing/lint core, the conventions enforcement, and the generational audit of how well the PM system is doing its job.

## Identity & North Star

The PM system is the owner's command centre: a markdown corpus under `ERA Notes/10 - Project Management/` plus the tooling that turns it into an application. Four surfaces share one Preact bundle and one parsing core:

| Surface | Built by | Mode | Interactive? |
|---|---|---|---|
| `pnpm pm` → `http://127.0.0.1:4317` | `scripts/pm-server.mjs` | `server` | **Yes** — edits the markdown, runs Delivery |
| `_dashboard.html` (opened from disk) | `pnpm pm:dashboard` | `static` | No — a read-only snapshot |
| `/pm` in the deployed app | `pnpm pm:public` (runs in `prebuild`) | `static` | No — auth-gated, installable, offline |
| `/pm/live` | the Next.js app + the Supabase relay | — | Yes, limited — the phone surface (see the Delivery campaign) |

**North star:** the markdown stays the source of truth and the tooling stays a lens over it — but the lens should feel like a real application, not a rendered document.

**Source:** `scripts/pm/` (`scan.mjs`, `lint.mjs`, `mutations.mjs`, `bridge.mjs`, `shared/*.mjs`, `src/` = the Preact SPA), `scripts/pm-server.mjs`, `scripts/build-pm-dashboard.mjs`, `tests/pm-ui/`.

### Scope contract

- Markdown semantics and the seven existing mutation operations stay unchanged.
- `scripts/delivery/*` remains the authoritative Delivery implementation; the dashboard imports its registry/classifier directly rather than re-implementing them.
- The static `_dashboard.html` twin stays offline and read-only.
- **Git writes remain permanently out of scope.**

## Current State (verified)

**Maturity 6.6 / 10 as of 2026-07-18 (FABLED 3 audit of the PM machine), +0.8 vs 2026-07-02.** *The archive became software; execution discipline is the last laggard.*

| Dimension | Score | Evidence |
|---|---|---|
| Structure & uniformity | 8 | every campaign follows one layout |
| Enforcement | 7 | `check-pm-update.sh` (Stop hook), `check-migration.sh`, `docs:check`; `pm:lint` is itself test-covered |
| Freshness | 6 (+2) | the stale global Feature State was formally superseded rather than left rotting; the freshness radar is live; delta ledgers are actively used |
| Execution coupling | 4 (+1) | movement is real but still audit-driven rather than ritual-driven |
| Tooling | 8 (+1) | a full SPA (10 feature dirs, SSE, router, store), PWA manifest + service worker, static-twin parity test, 7 pm-ui test files. Cost: velocity briefly broke typecheck |
| Handoff readiness | 6 | doc edits are any-model (grammar is linted and tested); tooling edits are mid-tier (bespoke untyped JS, but test-guarded) |

**Dashboard reality:** the Preact Command Center is the default live dashboard — hash routes with browser history, ERA themes, module/document views, backlinks, canonical interactive checkboxes, a JIRA-style task board and table, MiniSearch global search with a Ctrl+K palette, rollups, file operations, and a re-skinned Delivery surface. Checkbox identity has a *constructional* safety guard: one dependency-free scanner serves mutations, Markdown, tasks and tests, with a parity test comparing it against the literal legacy algorithm across all 358 real PM files. The portable twin uses the same bundle with Geist vendored and inlined. A dedicated mobile home and bottom nav render below 700 px, and the Delivery gates, questions, monitoring and launch wizard are usable one-handed.

## Pain Inventory

- ✅ ~~**"Hide completed" is effectively broken.**~~ *(FIXED 2026-07-30, R30.)* The `hideCompleted` signal is consumed by exactly two of seven views (`TasksView`, `Rollups`). The **document view** — where checklists are actually read — renders every completed row regardless, and the toggle itself lives only in the sidebar, which is off-canvas below 900 px. On a checklist with 61 done items the toggle appears to do nothing at all.
- ✅ ~~**The dashboard reads as a rendered document, not an application.**~~ *(ADDRESSED 2026-07-30, R32/R33 — toolbar with chips, group-by, sort and URL state on Tasks, Checklist and Bugs, plus the visual pass. The Overview, Module and Document views remain read surfaces by design.)*
- ✅ ~~**Search is buried.**~~ *(FIXED 2026-07-30, R31 — sidebar link, mobile tab, palette action, and `lane:`/`e:`/`id:` filters.)* A MiniSearch index over docs, headings, tasks and bugs exists and works, but `#/search` has no sidebar link and no mobile tab — it is reachable only via Ctrl+K, a topbar button, or typing the hash. The query language supports only `m:`, `t:`, `s:`, `is:` and `f:`.
- ✅ ~~**The Idea Inbox has no front door.**~~ *(FIXED 2026-07-30, R31 — `#/inbox` with New/Processed and inline capture.)* `0 - Inbox.md` is absorbed into a pseudo-campaign called "Command Center" alongside `_Conventions.md` and the archived root docs; reaching it takes three navigations. The 💡 quick-capture button exists but only in server mode.
- 🟠 **The execution-slot failure survived three generations** — small flagged fixes only get executed when a session is *dedicated* to killing them. The only two flagged-fix executions in six weeks happened inside audit sessions.
- 🟠 **Meta-work outweighed product work in the audit window** — of 21 commits, ~12 were PM/docs/tooling. The PM machine improving itself faster than the product it manages is exactly the failure mode this layer exists to catch; it caught itself.
- 🟡 **~7,150 LOC of untyped bespoke JS is load-bearing.** The `lint.mjs` typecheck break (five days in July) was the first tax payment; JSDoc typing exists on essentially one function.
- 🟡 **PWA/service-worker cache staleness** — `sw.js` caches the board, and a stale worker serving an old board that *looks* current is a freshness regression dressed as a feature. No cache-version assertion exists.
- 🟡 **The legacy strangler UI is still on disk** — `scripts/pm/client.js`, `styles.css` and `body.html` are only reachable via `?ui=old`, but they still contain a working-looking `body.hide-completed` implementation that is not in the build, which will mislead anyone who greps for it.
- ⚪ Session-history surfaces have no retention or index convention and will become the next stale-doc zombies.
- 🟠 **`cleanInlineText()` strips markdown emphasis before the meta-suffix regex runs, so the regex never matches** → `scripts/pm/shared/text.mjs:12-13`. `PmTask.text` (and every other consumer of `fileTasks`/`checklistItems`: `lint.mjs`, the desktop Preact board, the bridge) still carries the raw `IDCHIP … (severity - effort)` text instead of the clean prose the field name implies. Mitigated at the display layer in `/pm/live` only (`derive.ts`'s `displayText()`, 2026-07-31, R40) — the desktop Preact board and any other future consumer still get the unstripped string until the one-line ordering fix lands in `text.mjs` itself.
- 🟡 **`SegmentedPanes`' tap-to-select can silently fail to scroll on the Chromium `scroll-snap-mandatory` + JS `scrollTo({behavior:"smooth"})` combination** — the pill's active state and the `pane=` URL param update correctly, but the visible content can stay on the previous pane. Confirmed via raw `element.scrollTo()` outside React (`behavior:"instant"` works, `"smooth"` silently no-ops against the snap container) during the 2026-07-31 mobile rebuild's verification pass; not something that pass changed, and the primary interaction (a real touch swipe) drives the scroll natively rather than through this path, so it may be an automated-browser-only symptom — needs a real-device check before anyone touches it.

## Shipped Log

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

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Where the dashboard is going

The Command Center should behave like an application the owner opens daily, not a document viewer. Concretely, in priority order:

1. **The basics have to actually work.** Hide-completed must apply everywhere a checkbox renders — especially the document view — and the control must be reachable at every width.
2. **Search and the Inbox are first-class destinations**, with sidebar and mobile-nav entries, not hidden behind a keyboard shortcut and a three-step navigation.
3. **Filtering is a toolbar, not a checkbox.** One-tap chips (blockers / now / small / done), group-by and sort selects, and filter state carried in the URL so a filtered board survives a reload and can be shared. `/pm/live`'s board toolbar is the reference implementation to copy — it already solves this, on the smaller screen.
4. **Then polish:** sticky lane headers, count pills, tightened density, motion on state change, real empty states.

### Standing decisions

- **The markdown is the source of truth.** No PM state lives anywhere else; postpone is deliberately view-state-only (localStorage keyed by task text, reset when the line is edited).
- **Four surfaces, one bundle, one parser.** Any parsing change goes through `shared/` and must keep the static twin at parity.
- **`_Archive/` is never scanned** by any PM tool — the skip lives in `scripts/pm/scan.mjs` so every consumer (server, static build, bridge, lint) inherits it.
- **Git writes stay permanently out of scope.**
- **Cutover gate for the legacy UI:** delete `client.js` / `styles.css` / `body.html` only after a desktop + 390 px visual pass and a fake-driver delivery walkthrough. The new UI is already the default; `?ui=old` is a temporary rollback surface.

### The ranked moves from the PM-system audit

1. **Make the hygiene sweep a scheduled ritual, not a generational event** — a recurring "Now" line plus the freshness radar printing the oldest open S-effort item every session. No new tooling.
2. **A meta-work budget rule** — a session that only touches `ERA Notes/` or `scripts/pm/` must state which product-code item it unblocks; two consecutive such sessions require a product session between them.
3. **JSDoc-type the `shared/` parsing core** — five files of pure functions, with the `lint.mjs` fix as the exact template, so typecheck guards the scanner everything else trusts.
4. **A service-worker cache-version assertion** — extend the existing static-twin test to assert the cache key changes when the bundle output changes.
5. **A session-history retention convention** so those surfaces don't become the next stale-doc zombies.

## Acceptance Criteria Index

### R30
- **Acceptance:** with the toggle on, opening any checklist document shows zero completed rows and a "N completed hidden" affordance in their place; the toggle is reachable at 390 px width; no view silently ignores it.

### R31
- **Acceptance:** Search and Inbox each have a sidebar entry and a mobile tab; `#/inbox` lists New and Processed entries with capture available in server mode; `id:`, `lane:` and `e:` narrow results.

### R32
- **Acceptance:** `#/tasks?q=s%3Ablocker&group=lane` survives a reload with the filter intact; chips toggle their filter on and off; group-by renders labelled sections with counts.

## Successor Briefing

**Who should read this:** you are about to edit PM documents or PM tooling. The docs side is the safest place in the repo for any model — the grammar is machine-checked. The tooling side is bespoke untyped JS; respect it.

**First 10 minutes:**

```bash
pnpm pm:lint                                     # must be clean before AND after your edits
npx vitest run tests/pm-ui/                      # all green expected
git log --format="%h %ad %s" --date=short --since=2026-07-30 -- scripts/pm "ERA Notes/10 - Project Management"
```

Then read `../_Conventions.md` (the grammar) → `scripts/pm/shared/md-scan.mjs` (how docs become data) → `scripts/pm/src/app/store.js` (how data becomes the app).

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| Checklist / Master Book edits, done-stamps, new campaign items | any-model | follow the grammar exactly; validate with `pnpm pm:lint` |
| New campaign folder scaffold | any-model | copy `_Templates/` — a Master Book + a checklist, nothing else |
| Dashboard UI changes (`scripts/pm/src/`) | mid-tier+ | untyped JSX; run `pnpm pm:build-ui` + `npx vitest run tests/pm-ui/` after every change; keep static-twin parity |
| Parser / lint core (`shared/*.mjs`, `lint.mjs`, `scan.mjs`) | mid-tier+ | everything downstream trusts these; extend `tests/pm-ui/` FIRST, then change |
| Renaming a campaign folder | mid-tier+ | breaks the `CAMPAIGNS` prefix map **and** every relative link — do both in one pass |
| Changing generation rules or the archive policy | human-first | owner decisions |

**Out-of-depth tells — stop if:** `pnpm pm:lint` fails and you're about to edit the *linter* instead of your document; you're writing a new "status report" doc instead of updating a campaign's Master Book (that is how stale-doc zombies are born); you're adding PM state anywhere other than the markdown.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| The archived-hide rule | your new doc vanishes from `pnpm pm` | frontmatter `status: superseded \| baseline-frozen \| template` hides a doc, and `_Archive/` is not scanned at all |
| Checklist grammar is exact | lint E3/E4 errors | `- [ ] **PREFIX-n** outcome _(severity - effort)_` under `## Now/Next/Later` — no emoji severity, no `S-M` ranges, no nesting |
| Postpone is view-state only | "postponed" tasks reappear | localStorage keyed by task text; editing the line resets it — by design |
| Static twin drift | `_dashboard.html` differs from `pnpm pm` | regenerate via `pnpm pm:dashboard`; the parity test is the guard |
| Windows line endings | frontmatter silently fails to parse (`status` reads as empty) | write PM files with `\n`; a CRLF frontmatter block breaks lint E1 |
| PWA service worker | the board looks current but is cached | hard-reload or bump the SW cache when testing dashboard changes |
| The legacy UI still on disk | you find a working-looking implementation that never runs | `client.js` / `styles.css` / `body.html` are only reachable via `?ui=old` |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| PM lint clean | `pnpm pm:lint` | exit 0 |
| PM tooling tests green | `npx vitest run tests/pm-ui/` | all pass |
| `_Archive` is invisible to the tools | `grep -n "_Archive" scripts/pm/scan.mjs` | present in `SKIP_DIR` |
| Tooling size claim | `find scripts/pm -name "*.mjs" -o -name "*.js" -o -name "*.jsx" \| xargs wc -l \| tail -1` | ≈7,150 |
| Campaign map matches the folders | `node -e "import('./scripts/pm/lint.mjs').then(m=>console.log(Object.keys(m.CAMPAIGNS)))"` | matches the campaign folders on disk |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- The phone surface and its relay are owned by the [Delivery campaign](<../Delivery/Delivery — Master Book.md>)
- Pre-consolidation originals (the dashboard-refactor campaign files and the root FABLED 2 / FABLED 3 audits of the PM machine): `../_Archive/{PM Dashboard Refactor,FABLED 2,FABLED 3}/`
