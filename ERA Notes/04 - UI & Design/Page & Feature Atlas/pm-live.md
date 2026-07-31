---
slug: pm-live
title: PM Live (responsive PM dashboard + delivery command surface)
category: utility
route: /pm/live
type: page
parent: null
children: []
status: active
tags:
  - tooling/pm-dashboard
  - tooling/delivery
  - pwa
---

# PM Live (responsive PM dashboard + delivery command surface)

> A third, deliberately narrow PM surface — distinct from `_dashboard.html` (laptop-only `file://` twin) and `/pm` (deployed, read-only, frozen at last deploy). `/pm/live` is a real Next.js route backed by Supabase: five views (Overview / Board / Delivery / Usage / Campaigns) over a **read-only** live checklist whose rows launch delivery sessions, plus a governed delivery command channel (pause/abort-turn/resume/cancel/answer/ask/launch) and an Inbox capture, fed by an **outbound-only** relay bridge on the laptop. The phone cannot mark a checklist item done at all. `pnpm pm`'s own `127.0.0.1` binding is unchanged — see Notes.
>
> **Phone-only (rebuilt 2026-07-31, PM Tooling).** The original tree carried a second, desktop-grade layout in the same components (a `lg`-gated side rail + widget grid), which forced every phone density decision to negotiate with a desktop grid — the owner's complaint was density and clutter, not missing features. That branch is gone: `SideNav` is deleted, every `lg:` class is gone, and a real desktop console already exists at `/pm` (`public/pm.html`), so nothing was lost. Nav is 4 bottom tabs (Home / Board / Delivery / Campaigns) plus a raised centre **Capture** FAB (tap = capture to Inbox, long-press = quick Launch), mirroring `src/components/layouts/MobileNav.tsx`'s own raised-FAB shape. Usage is not a tab — it's pushed from a "Spend" tile on Home, with a back-chevron in `TopBar`. It does **not** replace `pnpm pm` — doc viewing, source preview and checkbox mutation stay on the laptop.

## Files

- **Page**: `src/app/pm/live/page.tsx` — thin route wrapper.
- **Layout**: `src/app/pm/live/layout.tsx` — standalone shell (same pattern as `src/app/nfc/[tag]/layout.tsx`), not hooked into `ThemeContext`; sets `data-pm-live`. Carries its own `manifest: "/manifests/pm-live.webmanifest"` + `appleWebApp` metadata — a distinct installable identity from `/pm`'s `pm.webmanifest` (narrower `scope: "/pm/live"`, shortcuts to Board and Delivery).
- **Tokens**: `src/app/pm/live/pm-live.css` — `[data-pm-live]`-scoped variable block (`--pm-bg`, `--pm-surface`, `--pm-panel`, `--pm-fg-*`, `--pm-accent`, `--pm-sev-*`, plus a `--pm-t-*` type scale with a 12px content floor and `.pm-card`'s neo-card-style gradient+ring+glow elevation) plus the `pm-card` / `pm-panel` / `pm-chip` / `pm-btn` / `pm-input` primitives. Scoped, so it cannot leak into the themed app.
- **Data layer**: `src/features/pm-live/` — `store.ts` (Zustand snapshot store + selectors), `usePmLive.ts` (realtime mount + command dispatch), `derive.ts` (React-free filtering/grouping/KPI/velocity/`displayText` logic), `selectors.ts` (memoized hooks over it), `query.ts` (filter mini-language), `viewState.ts` (view/query/group/sort + URL sync), `cache.ts` (offline snapshot cache), `chartTheme.ts`, `types.ts`.
- **Components**: `src/components/pm-live/` — `PmLiveApp.tsx` (shell — plain ternary view switch, no wrapping animation library), `shell/` (TopBar, BottomNav, UndoStrip, navItems — `SideNav` deleted 2026-07-31), `views/` (Overview, Board, Delivery, Usage, Campaigns), `session/` (`SessionDetailView.tsx`, `SegmentedPanes.tsx`, `panes.tsx`), `board/` (BoardToolbar, TaskRow), `widgets/` (WidgetCard, StatTile, SeverityBar, BarList, TrendArea, ChartTooltip), `Sheet.tsx`, `CaptureSheet.tsx`, `LaunchSheet.tsx`, `TaskDetailSheet.tsx`, `BridgeStatusChip.tsx`.
- **PWA manifest**: `public/manifests/pm-live.webmanifest` — reuses the `/pm-*` icon set; `id: "/pm-live-app"`, `scope: "/pm/live"`.
- **Laptop bridge**: `scripts/pm/bridge.mjs` — started via `pnpm pm --bridge` (or `PM_BRIDGE=1`). Pure cores (`createTasksSnapshotBuilder`, `createRollupsSnapshotBuilder`, `createHistorySnapshotBuilder`, `buildSessionExtras`, `capSessionSnapshot`, `createCommandExecutor`) plus Supabase publish/drain wiring; unit-tested in `tests/pm-bridge.test.ts` without any network dependency.
- **Push endpoint**: `src/app/api/pm/notify/route.ts` — `CRON_SECRET`-authenticated, calls the existing `sendPushToUser()`.
- **DB migrations**: `migrations/2026-07-25_pm-mobile-relay.sql`, then `migrations/2026-07-25_pm-commands-drop-tick.sql` (both mirrored into `migrations/schema.sql`). The 2026-07-25 dashboard refactor added **no** migration — new row kinds ride the existing `(id, kind, payload jsonb)` shape.
- **Tests**: `tests/pm-bridge.test.ts` (bridge cores incl. rollups/history parsing), `tests/pm-live-query.test.ts` (filter grammar + parity with the desktop board's `queryLang.js`), `tests/pm-live-derive.test.ts` (grouping, KPIs, velocity, attention ranking).

## Hooks

- _(none of the repo's Claude Code hooks touch this route — it's app code, covered by the normal `update-atlas.sh` / `check-pm-update.sh` rules like any other page.)_

## API routes

- `POST /api/pm/notify` — the only API route this feature adds. Bearer-auth (`CRON_SECRET`), called by the laptop bridge, not by the page itself. The page talks to Supabase directly (`pm_live` read, `pm_commands` write), the same pattern as Hub Chat's realtime.

## DB tables

- `pm_live` — laptop-published snapshot rows. Six kinds: `tasks`, `rollups` (per-campaign lane/severity/effort counts, pain bullets, lint health), `history` (✅ done-stamp completions + per-day aggregate), `fleet` (sessions, spend-by-day, lane envelope defaults), `bridge` (heartbeat + undo offer), `session:<id>`. Flat `user_id = auth.uid()` RLS (Hard Rule 20).
- `pm_commands` — phone-issued command queue (`pending → claimed → done|failed`), drained by the bridge. `user_id DEFAULT auth.uid()` so the browser client never needs to know its own id to insert.

## Views

| View | What it answers |
|---|---|
| **Overview** (Home tab) | Paced, not stacked: a one-line status sentence, top-3 "Needs you" cards (open gates, session errors, Now-lane blockers — `See all N →` beyond that), 2 pulse tiles (Open/Blockers), a live-delivery snap-scroll strip of active sessions (only when any are running), a Spend tile that pushes to Usage, the delivery trend, top-3 campaigns (`All →` to the full view), and a conditional lint card. |
| **Board** | The working queue — full-text + `m:`/`s:`/`is:`/`f:`/`lane:`/`e:` filtering (search + an inline Now/Next/Later/All segmented control + a "Filters" sheet for the rest), group by campaign/lane/severity/effort, sort by lane/severity/effort/campaign/file, virtualized rows, tap for a detail sheet, swipe left for Deliver. |
| **Delivery** | Fleet control — session cards with budget burn, gate hints, the agent's actual question text (kept inline, never behind a sheet), and one contextual primary action (Pause, or Resume when the runner died); Stop-turn/Guidance/Cancel move into a "More actions" sheet. Tapping a card opens the **session detail**. |
| **Session detail** (`?session=<id>`) | One session in full, behind a sticky segmented pill bar over snap-scrolling panes — short tab labels so all four fit at 360px: **Q&A** (the gate question plus the whole ledger, each answerable inline), **Chat** (the last ~40 turns, role-coloured, with an excerpt on the most recent 12), **Files** (spec / plan / finish summary / remaining work / recovery, excerpted), **Cost** (envelope burn, spend by phase and by model, context-window occupancy). |
| **Usage** (pushed, not a tab) | Where the money went — spend by day, cost per session, token mix, envelope burn against each active cap. Reached from Home's Spend tile or the TopBar overflow menu; back-chevron returns to Home. |
| **Campaigns** | Single-column phone cards (was a `md:`/`xl:` grid) — per-campaign lane distribution, severity mix, unswept count, pain bullets, lint status, doc staleness. |

View, query, grouping, sort, open session and pane are mirrored into the URL (`?view=&q=&group=&sort=&session=&pane=`), so a filtered board — or one session's Cost pane — is a shareable link, written with `history.replaceState` rather than the App Router to avoid re-running the route on every keystroke. A `session` param forces `view=delivery`, because the push notification that produced the link was about that session.

## How to get here

- Direct URL: `/pm/live` on the deployed app (requires being logged in — same Supabase session as the rest of the app).
- Install: open `/pm/live` on a phone → Add to Home Screen → its own icon, separate from both the Budget PWA and `/pm`.
- Requires the laptop bridge running: `pnpm pm --bridge`. Without it, the page loads (from the last cached `localStorage` snapshot if offline) but shows "Laptop offline" in the header and commands time out after ~20-60s with an explanatory message.

## What it links to

- Nothing outside itself — no server navigation. The bottom bar (phone) or side rail (desktop) switches views client-side; KPI tiles and campaign bars cross-link into a pre-filtered Board.

## Related vault doc

- `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md` (Shipped Log, R29)
- `ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md` — DLV-20…DLV-23 in the Shipped Log; its Vision & Decisions section carries the "Remote decision controls" amendment this feature threads and the "Mobile checkbox ticking" rejection.

## Notes

- **Outbound-only, by construction.** The bridge (`scripts/pm/bridge.mjs`) never opens a listening socket. It publishes to Supabase and polls/subscribes for commands; nothing inbound ever reaches `pm-server`. `scripts/pm/net.mjs`'s `hostAllowed()` guard and the `127.0.0.1` default are completely untouched — this is strictly safer than the already-sanctioned `--lan` widening, not a variant of it.
- **Every delivery command is a thin wrapper around `routeDelivery()`** — the exact same function `scripts/pm-server.mjs` calls for the desktop UI. No delivery business logic is duplicated. Every server-side guard (flight-check review, mandatory budget envelope, `buildItemIdentity` drift check, build lock, dirty-tree/red-baseline typed acknowledgments) applies for free.
- **Authority is tiered, not uniform.** Revoke-only commands (`pause`, `abort-turn`, `cancel`) are always reachable — worst case under a compromised phone/channel, a session stops. Grant commands are narrower: `launch` requires an explicit envelope with no default and is refused outright on a dirty tree or red baseline (mobile never forwards the typed `DIRTY TREE` / `RED BASELINE` ack); `answer` only works when the session is *currently* awaiting the `question` gate, checked server-side. `set-budget`, `set-config`, `rotate`, `fork`, and any decision on the `spec`/`plan`/`uat`/`blocked` gate are **never** exposed to mobile — those stay laptop-only.
- **A budget-parked session cannot be revived from mobile, only cancelled.** `raiseBudgetEnvelope()` is raise-only by construction; there is no lower-envelope primitive, so "decrease the envelope from the phone" was considered and dropped as both unimplementable and unnecessary (Pause/Cancel already stop the burn). The Delivery tab surfaces this as "Raise envelope on laptop."
- **Session detail reads from the cache, not the bridge.** Every pane renders from the published `session:<id>` row, which the store persists to `localStorage` — so the whole view works with the laptop shut. Only *sending* an answer needs a live bridge, and the composer is disabled with the reason shown rather than hidden.
- **Two kinds of answer, one command type.** With a `questionId` the bridge routes to the ledger `answer` control (advisory, non-blocking, safe at any time — the same path the desktop Q&A card uses); without one it re-verifies the `question` gate server-side and posts a gate decision. No new `pm_commands` type was needed, so no CHECK-constraint migration.
- **The session payload has a size cap with a stated degrade ladder.** `capSessionSnapshot` trims to ~200 KB by dropping turn excerpts → older turns → answered questions → older events → artifact excerpts, and records what it dropped in `truncated[]` so the header can say so. A silently short detail view is worse than a labelled one.
- **Checklist payload is parsed tasks only** — no doc bodies, no embedded source (unlike `_dashboard.html`'s 7 MB). A synthetic-board regression test in `tests/pm-bridge.test.ts` asserts the serialized snapshot stays under 250 KB.
- **The checklist is read-only, and tapping a row now opens detail rather than launching.** There is no checkbox and never will be. `tick` was removed from the command channel entirely on 2026-07-25 (DLV-23) after one stray tap silently marked a real PM item done: the bridge refuses the type server-side (`REFUSED_TYPES`) rather than merely hiding the affordance, because an installed PWA can still be running a cached bundle. Marking work done is the *outcome* of a delivery session, or a laptop edit. The dashboard refactor also moved the row's single tap from *launch* to *open detail* (Hard Rule 2), with Deliver as an explicit button — a tap on a phone is too cheap to spend a budget envelope on. The flight check itself is unchanged: envelope still mandatory, still refused on a dirty tree or red baseline.
- **Every bridge write is journaled and revertible.** `writeWithUndo()` copies a full pre-image into `.delivery/pm-undo/` (gitignored — a tracked backup would dirty the tree and block launches) and appends to an append-only `journal.ndjson`. The newest un-undone write rides on the bridge heartbeat as `undoable`, so the phone shows an Undo strip under the header; `undo` restores the pre-image, and **refuses** if the file changed on the laptop in the meantime rather than clobbering that edit. The only journaled writer is `capture` (inbox); the mechanism is the guard for anything added later. Deliberately not a sonner toast (Hard Rule 1 governs toasts, not the choice to use one): the journal survives a reload and a reopened app, so a 4-second toast would under-promise what's actually revertible.
- **Rollups and history are derived on the laptop, never in the browser.** `severityItems()` / `sumSeverity()` / `lintChecklist()` from the existing `scripts/pm/shared/` + `lint.mjs` do the work at publish time; the phone receives ~18 KB of finished aggregates. Lint runs *without* the E5 filesystem resolvers, so no directory walk happens per publish — broken-link auditing stays a `pnpm pm:lint` job.
- **The delivery trend is honest-but-sparse.** `✅ YYYY-MM-DD` stamps in each `1 - Feature State.md` are the only dated record of completed work anywhere in the PM corpus (checklist items carry no date), and sweep discipline varies by campaign — several have never swept. The widget is labelled as a floor, not a full record, and renders an empty state rather than a misleading flat line when nothing is dated.
- **Severity colour is an ordinal status ramp, not a categorical palette.** `#fbbf24 → #d97706 → #94a3b8 → #64748b` (blocker → parked), validated on the `#0a1628` surface: CVD separation and normal-vision floor both pass (worst adjacent ΔE 15.5/15.6), all four clear 3:1 contrast. The categorical "lightness band" and "chroma floor" checks are intentionally unmet — high severity *must* read hotter and brighter, low severity *must* recede to neutral. Severity is never encoded by colour alone; every use carries a label or count. Hard Rule 3 holds: no red anywhere in the ramp.
- **The store exists for a measured reason.** The bridge heartbeats every 10 s. With the original single-hook shape each beat re-rendered the page and every tab, ~480 task rows included, to update a "last seen" chip. Selector subscriptions confine a heartbeat to `BridgeStatusChip`.
- **Writes land on disk like any laptop edit.** The desktop dashboard's existing `fs.watch` picks them up, so a laptop session left open sees mobile-issued changes live too.
- Do not confuse with `/pm` (`pm.md` — deployed, read-only, frozen-at-deploy snapshot with Delivery hard-gated off) or the local `pnpm pm` server (interactive, loopback-only editor).
- **`PmTask.text` still carries the ID chip and the `(severity - effort)` suffix — use `displayText(task)`, never `task.text`, anywhere both are also rendered as their own chips.** `cleanInlineText()` in `scripts/pm/shared/text.mjs` strips `` ` * _ ~ `` on one line, then tries to strip `_(severity - effort)_` on the next — but the underscores it needs to match are already gone, so the strip never fires. `derive.ts`'s `displayText()` is the display-layer fix (strips a leading `IDCHIP ` and a trailing `(severity - effort)` from the string for rendering only; `task.text` itself stays untouched since `query.ts`'s free-text search matches against it). The upstream one-line fix in `text.mjs` is a separate PM item (`R`-prefixed, PM Tooling) — it wasn't taken here because that file is shared by `lint.mjs`, the desktop Preact app, and the bridge, a wider blast radius than this UI-only pass.
- **Do not wrap the view switch in `AnimatePresence mode="wait"`.** The 2026-07-31 rebuild briefly did (a cross-fade between Home/Board/Delivery/Campaigns keyed on `view`), and it froze navigation completely: the Zustand store and the URL sync both updated correctly on every tab tap, but the rendered content never advanced past the first view shown after mount — confirmed with a full dev-server restart (ruling out HMR staleness) and direct DOM/fiber inspection (the mounted `PresenceChild` never advanced past `key="overview"`). The exit animation for the previous key never resolves, so `mode="wait"` never releases the next child. `PmLiveApp.tsx` now renders the view ternary directly, no animation wrapper. If a transition is wanted again, prove first — on a real phone, not just this dev environment — that the exit actually completes.
- **The session-detail `SegmentedPanes` swipe uses CSS `scroll-snap-mandatory` deliberately over a JS tab library, but a *tap* on the pill relies on a programmatic `scrollTo({behavior:"smooth"})` against that same snap container, and that combination is a known Chromium quirk: the snap logic can silently cancel the smooth scroll before it completes, leaving the pill's active state and the URL's `pane=` param correctly updated while the visible pane never advances.** Confirmed via raw `element.scrollTo(...)` outside React entirely — `behavior:"instant"` reliably lands on the target pane, `behavior:"smooth"` does not. Not touched in the 2026-07-31 pass (out of scope, and the component's actual primary interaction is a real touch swipe, which drives the scroll natively rather than through this JS path) — flagged here so a future session doesn't waste time re-diagnosing it, and so it gets a real-device check rather than an automated-browser one before anyone "fixes" it based on this environment's behavior alone.
