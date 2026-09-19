---
slug: pm
title: PM Command Center (hosted)
category: utility
route: /pm
type: page
parent: null
children: []
status: active
tags:
  - tooling/pm-dashboard
  - pwa
---

# PM Command Center (hosted)

> Read-only, installable, offline-capable PM Command Center served by the deployed app at `/pm` — the secondary Preact reference/export experience. The primary local `pnpm pm` application is React (R57).

## Files

**Primary React Work lifecycle (2026-09-15, R65):** `#/explore` shows To do, `#/explore?view=done` searches completed outcomes. Completed item links open a read-only scope/receipt page with retained V1/V2 attempts and explicit UAT-pending metadata. Manual owner checks live in `docs/Delivery-UAT.md`; completed/owner/noncanonical items cannot launch. Classic/hosted export shares the reconciled Markdown and owner-exclusion model; the new Done navigation belongs to the primary React app.

- **Served page**: `public/pm.html` — generated (gitignored); rebuilt from PM markdown by `pnpm pm:public` (`scripts/build-pm-dashboard.mjs --public`), which runs in `prebuild` on every deploy.
- **HTML builder**: `scripts/pm/ui.mjs` (`buildHtml({ mode: "static", pwa: true })`) — emits the installable head + `/sw.js` registration.
- **Reference/export UI bundle** (also available locally via `?ui=classic`): `scripts/pm/src/` (Preact), built by `scripts/pm/build.mjs`.
- **Route rewrite**: `next.config.ts` → `rewrites()` maps `/pm` → `/pm.html`.
- **Auth gate**: `src/middleware.ts` (matcher `['/pm', '/pm.html']`) — Supabase `getUser()`; unauthenticated → `307 /login?redirect=/pm`.
- **Manifest**: `public/pm.webmanifest` (`id`/`start_url`/`scope` = `/pm`).
- **Icons**: `public/pm-192.png`, `public/pm-512.png`, `public/pm-maskable-512.png`, `public/pm-180.png` (apple-touch), `public/pm-icon.svg`.
- **Offline**: reuses the existing app service worker (`public/sw.js`, unchanged) — its nav/image handlers cache `/pm` and the icons on first (online) open; the page registers `/sw.js` itself for cold direct-opens.

## Hooks

- _(none — self-contained static page; data is inlined as `globalThis.PM_DATA`)_

## API routes

- _(none in the deployed app — read-only.)_ The interactive `/api/data`, `/api/toggle`, SSE, etc. exist only on the local `pnpm pm` server (`scripts/pm-server.mjs`).

## DB tables

- _(none — the source of truth is the `ERA Notes/10 - Project Management/` markdown, embedded at build time.)_

## How to get here

- Direct URL: `/pm` on the deployed app (requires being logged in — same Supabase session as the rest of the app; unauthenticated visits redirect to `/login` and back)
- Install: open `/pm` on a phone → Add to Home Screen → "PM Center" icon (separate from the Budget app icon). On iOS, an installed PWA has its own cookie jar, so you log in once inside the PM PWA.

## Primary local application (R57 · 2026-09-10)

- **Delivery review workspace (2026-09-15):** `#/delivery/run/<id>?tab=plan|checks|activity|changes` preserves the selected panel. The review order is Plan → Verification → Activity → Changes, leaving Apply at the conclusion. Plan reads/exports the stored revision, keeps Risks/Unknowns visible and places Artifacts at right on desktop; Verification shows current and previous observations without receipt disclosures; Activity includes useful run facts; Changes opens hash-verified diffs and keeps application history visible. Usage is one total-versus-threshold comparison. Compact phone layout stacks the same hierarchy. Physical phone UAT remains pending; see `docs/Delivery-UAT.md`.

- **Theme (R58):** ERA Blue navy/cyan/violet by default, with the existing Pink alternate from `src/app/globals.css`. The palette control persists locally; old reboot light/dark preferences migrate to Blue. Shell/manifest and browser chrome use ERA colors.
- **Application:** `scripts/pm/app/` — React 19, TypeScript, TanStack Query, Framer Motion, Radix Dialog, Geist and the shared `ERAMark`. The existing Node server serves a plain shell plus independent `/app/assets/pm.js` and `pm.css`; no embedded backlog or Next server is needed locally.
- **Today:** composed actual work distribution, owner choices, live Delivery, eleven horizontally browsable spaces and fourteen-day dated shipment activity.
- **Explore:** natural search (AI, mobile, offline, household, Catalogue, UX) over the same canonical outcomes; Now, Up next, Waiting and Someday progressively reveal bounded lists.
- **Focus:** `#/space/<campaign>` and `#/work/<campaign>/<ID>` replace permanent inspectors. Return queries preserve discovery/space context. Relationships, full acceptance, history and organizing actions are disclosed on demand.
- **Delivery:** `#/deliver/<campaign>/<ID>` → shape/review → `#/delivery/session/<id>`. Existing scope/preflight/budget acknowledgements remain authoritative. The run tells its recorded story through stages, plan steps, checks, resources, changed files and owner gates; evidence/technical controls are secondary. V2 does not launch V1 implicitly.
- **Delivery V2 (Phase 3 · 2026-09-12):** in v2 mode `#/deliver/<campaign>/<ID>` shows `LaunchV2` — executor, Fast lane/Deep dive, model and effort → Start. Recommendation rationales and raw coordination/resource codes are absent. An unavailable executor remains tappable and opens one owner-facing cause plus Retry from the live refusal. `#/delivery/run/<run_id>` (`RunV2`) keeps runtime stages above the four review tabs and preserves all existing approval, guidance, pause/resume/stop, Apply, rollback and recheck controls. An unpaired browser sees a pairing card first.
- **Delivery V2 queue (Phase 5 · 2026-09-12):** `#/delivery` shows a queue panel whenever a V2 item runs, waits or needs a decision:
  - slot chips — Writers n/2 and Jobs n/3, plus Unknown and Subagents when present;
  - Running rows with alias, title, Writing/Checking/Planning and executor · model · effort;
  - Waiting rows with Ready / Waiting / Scope required and up to two concise reasons;
  - Decisions rows, and a Pairs disclosure.

  `LaunchV2` shows the item's verdict and disables Start for held or dependent work. A waiting run shows Waiting or Paused with its reasons. The Apply panel adds Release when other items wait on the candidate, and labels a failed pre-write recheck "Fails on current source". `/pm/live` shows the same queue from the relayed runs row; the pre-launch verdict is local only.
- **Dashboard (Phase 6 · 2026-09-12):** `#/dashboard`, linked from Home's activity card. Campaign and week filters plus the selected week or set live in the URL (`?campaign=&weeks=&week=|set=`). Tiles (Open, Blocked, Completed, Cancelled, Reopened when present); Open work stacked by Now/Next/Later with each segment opening the Board lane; Completed and cancelled exact IDs by week with Undated / Earlier / No exact ID and a drilldown of the counted records to their source; Bugs by severity (declared kind only); Delivery attempts as V1 and V2 small multiples; Resources table; History coverage disclosure. Every chart has a Table toggle. Metrics come from `scripts/pm/shared/metrics.mjs`.
- **Phone:** three-item bottom navigation, swipeable space covers, compact attention/live status, focused pages and opaque bottom sheets. Desktop uses top navigation and centered content. Motion respects reduced-motion settings.
- **Writes/cache:** actual shared `safeFetch`, feature query keys, SSE and mutation invalidation. `health.mjs` handles uncached HEAD probes at `/api/health` and retains GET; changes to this server handler require restarting `pnpm pm`. Toggle/move/ship/discard carry source witnesses; Undo checks the post-write snapshot before restoring. The local worker caches the React shell/JS/CSS/data and reopens read-only offline.
- **Reference boundary:** `/?ui=classic` retains document/file/rollup tools and the advanced Delivery workspace; `/?ui=old` remains rollback. Hosted `/pm`, portable HTML and authenticated `/pm/live` are intentionally separate surfaces.

- **Delivery V2 safety (Phase 1, 2026-09-14):** local rollback now opens a read-only exact-inverse preview; `Cancel` is the default action, while `Roll back` submits the preview digest and application revision for a fresh server-side check. Token totals use input plus output, with cache/reasoning counters retained as raw subsets. A strict cap is unavailable unless the executor has a qualified whole-job bound; live in-job token stopping remains unqualified.
- **Delivery V2 Phase 3 foundation (2026-09-14):** launch advice is deterministic from recorded work facts and appears beside the owner’s selected settings; the run records whether it was overridden. Focused now uses a bounded one-plan/one-build/no-auto-repair contract. Work pages link to matching V2 attempts and retain a history shell when a checklist row has moved. Desktop/mobile owner acceptance remains pending.

## Retained Preact reference/export navigation (R54/R56)


- Project (`#/`, legacy `#/projects`) shows all eleven canonical areas, plus cross-area topic exploration. Query parameters `lens`, `select`, `state` and `item` preserve the selected perspective and preview on reload/back/share.
- Areas retain campaign ownership. `#/module/<campaign>` offers the complete Work, Decisions, Outcomes and Brief views. Desktop exploration uses a docked inspector; compact layouts use a focus-contained dialog.
- Topics derive from titles, outcomes and acceptance statements. They overlap without duplicating tasks; matching evidence is inspectable and generic verification/provenance text is excluded. Topic history remains separate from open work.
- Project state perspectives are All work, Now, Blocked, Needs you and local Delivering. Blocked derives from recorded holds and explicit prerequisites, not severity. Missing and cancelled references remain distinct from completed/shipped ones. Owner choices remain visible even when no task ID is linked.
- Work (`#/work`, `#/work/table`) remains a filterable Board/List. `#/work/item/<campaign>/<ID>` shows outcome, topic links, prerequisites, downstream work and related choices; acceptance/source detail is expandable.
- Decisions (`#/decisions?id=DEC-01`) reads the canonical register. Outcomes (`#/activity`) reads dated book shipments and the explicit Cancelled Log projection.
- Local server only: `#/delivery`, `#/delivery/new`, `#/delivery/session/<id>?tab=overview`. The `from` query retains the originating selection through launch, run tabs and return navigation. Existing APIs supply real state/phase roles, plans, events, checks, files, resources and handoff; V2 readiness remains gated by its execution capabilities.
- Search, Inbox, source documents, rollups, pins/recents and file operations remain supporting tools. Static mode shares the explorer without live controls; the React `/pm/live` surface is unchanged.

## What it links to

- Everything is internal hash routing within the page (`/pm#/work`, `/pm#/projects`, `/pm#/decisions`, `/pm#/activity`, `/pm#/module/...`, `/pm#/doc/...`; old `#/tasks` links remain supported) — no server navigation.

## Related vault doc

- `ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md` (Shipped Log, R16)

## Screenshots

- `pm-mobile.png`
- `pm-desktop.png`

## Notes

- **Read-only by design.** All mutations, SSE, and the Delivery surface gate on `PM_MODE === "server"`; the hosted page runs `PM_MODE === "static"`, so edit affordances are hidden. Editing checkboxes / moving files happens on the laptop via `pnpm pm`.
- **Freshness = last deploy.** The snapshot is rebuilt from the committed PM markdown during `prebuild`. It cannot be live because the laptop is the only writer — when it's off there is no live source.
- **Distinct PWA identity.** `pm.webmanifest` uses its own `id`/`start_url`/`scope` of `/pm`, so the phone installs it as a separate app from the Budget PWA (`public/manifest.json`).
- **Login-gated.** `src/middleware.ts` is the app's only middleware; its matcher is scoped to `/pm` + `/pm.html` so it never touches other routes. Because the page's data is embedded in the static HTML (not fetched from an authenticated API), this gate is the sole thing preventing public read of all PM docs — do not widen the static exposure without it.
- Do not confuse with the standalone `pnpm pm` server's own PWA head (server mode, `scripts/pm/assets/pm.webmanifest`, localhost only).
