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

- **Delivery repair (2026-10-25, R80):** earlier rows retain work ID/campaign and recorded date/time, newest first across V1/V2 (older V1 responses expose update time, labelled Updated). Load more passes 50 and the outcome/page state survives reopening. V1 Accepted does not imply V2 Applied. Missing/revoked local browser pairing exposes **Pair this browser** with `pnpm pm:pair`, including direct Test links; UAT list/detail reads wait for pairing. Protected read/command refusals refresh session state without reissuing a write. Queue/session/read failures show unavailable or last-known status, and retain a run's already-confirmed Apply action. The header's **More** menu opens Activity, Decisions, Idea inbox and Documents through the existing sheet, plus local-only Reference tools. The five primary destinations remain available. Offline fixtures passed at 320/390/701/1440 px in Blue/Pink; actual owner-browser pairing and deployed/physical-phone acceptance remain pending.

- **Test steps and sign-off (2026-10-25, R76/R77/R78, DLV-145):** `#/delivery/test/<handover id>` is the owner's wizard for one delivery: a setup card, one numbered action at a time with its expected result (Back / Next, **All steps**), Pass / Fail / Blocked per scenario, **Save**, **Sign off** and **Needs changes** (Bug / Change / Comment). **Review & sign off** (R81) exposes ready tests, drafts, incomplete instructions, feedback and history with work-ID search and direct wizard links; Earlier deliveries rows carry Shipped / Testing / Needs changes / UAT unrecorded / No candidate; Outcome has a **Test steps** row. A **Draft** (loaded from `docs/Delivery-UAT-*` by `pnpm pm:uat import-docs --apply`) reads step by step but records nothing until **Mark ready** binds it to the run's candidate or the current checkout. Sign off needs a ready, current handover, a current PASS for every required scenario, a confirmed build and no open feedback; Apply, green checks and the laptop test gate's Proceed never count. Submitted Needs changes becomes one linked, unchecked campaign item on the next `pnpm pm` (**Feedback saved** until then, then **Work <ID>** with **Open work**). Desktop only: `/pm/live` and hosted `/pm` do not carry it yet (R79). Records live in `.delivery/v2/uat/`; Drive gets a read-only `02 - Delivery Status/UAT/` mirror. Source: `scripts/delivery-v2/uat*.mjs`, `scripts/pm/uat-feedback.mjs`, `scripts/pm/app/UatWizard.tsx`, `uatModel.ts`, `uat.css`; tests `tests/delivery-v2/uat*.test.ts`, `tests/pm-uat-feedback.test.ts`, `tests/pm-ui/uat-model.test.ts`. Owner UAT pending.
- **Support usage (2026-10-24, DLV-144):** the desktop run page shows **Support** beside the delivery's own tokens only when an owner-authorized support job is linked to the run: tokens, job count, cost (or "cost unknown") and an "N unknown" flag. Nothing renders when there were none. Authorization and settlement are owner CLI actions (`pnpm pm:support`), never UI buttons; the phone relay does not carry this card. Source: `scripts/pm/app/DeliveryReview.tsx#SupportUsage`; regression `tests/pm-ui/support-usage.test.ts`. See `docs/ERA-Steward-Runbook.md`.
- **Readiness authorization (2026-10-24, DLV-142):** owner Check readiness explicitly renews the exact saved policy's finite time window for at least 24 hours and shows its separate authorization expiry. The shared desktop/phone action uses the authenticated control command; passive reads and Start never renew. Budgets, scope, concurrency, plan review and Apply remain as configured. Source/isolated Chrome verification only; bridge restart and updated phone deployment are owner activation steps. See `docs/ERA-Steward-Runbook.md`.

- **Central Delivery (2026-10-24, R73):** desktop and phone use Home / Sprints / Delivery / Work / Analytics. The raised Delivery lightning softly alternates gold/purple during observed V1/V2 execution, stays steady for waiting sessions and does not animate from closed or unconfirmed data. Reduced motion keeps a static glow. Source: `scripts/pm/app/PrimaryNavigation.tsx`, `navigation.css`, `App.tsx`; isolated Chrome verified 1280/701/390/320 px and Blue/Pink. `/pm/live` shares the implementation; deployed/physical-phone acceptance remains pending.

- **Clear launch (2026-10-24, DLV-141):** V2 opens with a compact Settings summary, readiness card and one Start action. Only blockers are expanded; gate diagnostics live under Check details. Check readiness shows pending, completion time or error, including when the same blockers remain. Existing requests instead offer Open/Resume; cancelled requests offer New delivery plus Open, preserving old receipts. Desktop and `/pm/live` reuse the component. Offline browser fixtures covered desktop/390/320 px and Blue/Pink; physical-phone/deployed acceptance remains pending. This supersedes the expanded controls/chip layout below.

- **One-step Start (2026-10-20, DLV-139):** `#/deliver/<ID>` (ID alone, e.g. `#/deliver/R44`) opens `LaunchV2` and preselects the executor when the policy permits exactly one. Readiness shows one chip per gate (✓, 🕒 checked at Start, ✗) plus one short fix per problem, such as "Start Docker Desktop". Start is enabled once the passive gates pass, collects the live gates itself and waits up to 3 minutes. This supersedes "keeps Start disabled" below. Hand-off procedure: `docs/ERA-Steward-Runbook.md`.
- **Delivery readiness/recovery (2026-10-18, DLV-137/138):** the selected work/executor/model/effort/lane has one service-owned readiness projection shared with CLI and relay. Passive reads do not contact providers or prepare dependencies; **Check readiness** explicitly refreshes bounded observations. Missing/stale native model, subscription, environment or qualification evidence keeps Start disabled. A persisted launch intent offers Resume request / Open delivery after a lost response or reload, using the same command identity. Desktop and a 390 px viewport were inspected. The owner confirmed physical-phone reconnection and the same Applied KIT-11 run after the 08:01 UTC restart. The later 08:26 UTC reload reconciled two idle instances into one and preserved paired desktop access; the owner confirmed phone reconnection and the same Applied KIT-11 run. The corrected 0.156.1 image and fourth preparation now pass cold/warm verification and fresh worker/checker qualification; exact gpt-6-luna/low is advertised with included subscription usage. R44-only policy revision 8 was activated and one bridge reloaded at 10:37 UTC, preserving pairing/journals/source. Actual phone confirmation after this reload, service readiness parity, real Dot initiation, phone plan approval and the candidate remain unproved.

- **Delivery review workspace (2026-09-15):** `#/delivery/run/<id>?tab=plan|checks|activity|changes` preserves the selected panel. The review order is Plan → Verification → Activity → Changes, leaving Apply at the conclusion. Plan reads/exports the stored revision, keeps Risks/Unknowns visible and places Artifacts at right on desktop; Verification shows current and previous observations without receipt disclosures; Activity includes useful run facts; Changes opens hash-verified diffs and keeps application history visible. Usage is one total-versus-threshold comparison. Compact phone layout stacks the same hierarchy. Physical phone UAT remains pending; see `docs/Delivery-UAT.md`.

- **Theme (R58):** ERA Blue navy/cyan/violet by default, with the existing Pink alternate from `src/app/globals.css`. The palette control persists locally; old reboot light/dark preferences migrate to Blue. Shell/manifest and browser chrome use ERA colors.
- **Application:** `scripts/pm/app/` — React 19, TypeScript, TanStack Query, Framer Motion, Radix Dialog, Geist and the shared `ERAMark`. The existing Node server serves a plain shell plus independent `/app/assets/pm.js` and `pm.css`; no embedded backlog or Next server is needed locally.
- **Today:** composed actual work distribution, owner choices, live Delivery, eleven horizontally browsable spaces and fourteen-day dated shipment activity.
- **Explore:** natural search (AI, mobile, offline, household, Catalogue, UX) over the same canonical outcomes; Now, Up next, Waiting and Someday progressively reveal bounded lists.
- **Focus:** `#/space/<campaign>` and `#/work/<campaign>/<ID>` replace permanent inspectors. Return queries preserve discovery/space context. Relationships, full acceptance, history and organizing actions are disclosed on demand.
- **Delivery:** `#/deliver/<campaign>/<ID>` → shape/review → `#/delivery/session/<id>`. Existing scope/preflight/budget acknowledgements remain authoritative. The run tells its recorded story through stages, plan steps, checks, resources, changed files and owner gates; evidence/technical controls are secondary. V2 does not launch V1 implicitly.
- **Delivery V2 (Phase 3 · 2026-09-12):** in v2 mode `#/deliver/<campaign>/<ID>` shows `LaunchV2` — executor, Fast lane/Deep dive, model and effort → Start. Recommendation rationales and raw coordination/resource codes are absent. An unavailable executor remains tappable and opens one owner-facing cause plus Retry from the live refusal. `#/delivery/run/<run_id>` (`RunV2`) keeps runtime stages above the four review tabs and preserves all existing approval, guidance, pause/resume/stop, Apply, rollback and recheck controls. An unpaired browser sees a pairing card first.
- **Delivery home (R75 · 2026-10-25; queue from Phase 5, 2026-09-12):** `#/delivery` lists each delivery once, in groups hidden when empty:
  - **Review & sign off** (R81) — always visible on the local UAT-capable transport, before the execution groups; ID/title/campaign search, To test / Not ready / Feedback / History / All, counts, direct Start test / Continue / View steps links, and retained filter/search/pagination on return. Draft/incomplete/stale instructions remain separate from owner-ready tests;
  - **Delivery actions** — queue decisions (Apply, Conflict, Review plan …) and launch requests blocked before a run exists;
  - **In progress** — alias, title, Writing/Checking/Planning or the owner action, executor · model · effort;
  - **Waiting** — Ready / Waiting / Scope required with up to two concise reasons;
  - **In focus** — up to three Now-lane outcomes not already being delivered, with an All link;
  - **Earlier deliveries** — collapsed, outcome filter, excludes anything still under Delivery actions or awaiting UAT in Review & sign off.

  Writers n/max and Jobs n/max (plus Unknown and Subagents when present) show once, as plain text with an `i` hint, in the first of In progress / Waiting that has rows. Overlaps (pairs) is a disclosure under the groups. A launch receipt with a run is the `Owner` / `ERA Steward` tag on that run's row; one without a run is a row with a Request disclosure holding the full receipt card. The same card still opens on the run and launch pages.

  `LaunchV2` shows the item's verdict and disables Start for held or dependent work. A waiting run shows Waiting or Paused with its reasons. The Apply panel adds Release when other items wait on the candidate, and labels a failed pre-write recheck "Fails on current source". `/pm/live` shows the same queue from the relayed runs row; the pre-launch verdict is local only.
- **Dashboard (Phase 6 · 2026-09-12):** `#/dashboard`, linked from Home's activity card. Campaign and week filters plus the selected week or set live in the URL (`?campaign=&weeks=&week=|set=`). Tiles (Open, Blocked, Completed, Cancelled, Reopened when present); Open work stacked by Now/Next/Later with each segment opening the Board lane; Completed and cancelled exact IDs by week with Undated / Earlier / No exact ID and a drilldown of the counted records to their source; Bugs by severity (declared kind only); Delivery attempts as V1 and V2 small multiples; Resources table; History coverage disclosure. Every chart has a Table toggle. Metrics come from `scripts/pm/shared/metrics.mjs`.
- **Phone:** five-item bottom navigation with central raised Delivery, swipeable space covers, compact attention/live status, focused pages and opaque bottom sheets. Desktop uses top navigation and centered content. Motion respects reduced-motion settings.
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

- **Steward initiation (DLV-140):** `#/deliver/<ID>?initiator=era-steward` (also **Steward** on launch) uses existing Start and stores a coordination receipt before readiness/run creation. Delivery, launch and run views on desktop and `/pm/live` show attribution, request UUID, accepted/start/last-confirmed times, stage, job state, blocker/evidence and run link. Each device derives **Status unconfirmed** after the service-configured silence interval; job/terminal truth is separate. No automatic retry. Source/fixture verification only; browser and physical-phone acceptance remain untested for this slice. [Implementation report](<../../../docs/ERA-Steward-Observability-Implementation.md>).

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


**Live readiness timing correction (2026-10-18, 10:49 UTC reload):** The qualified 0.156.1 environment and R44-only policy remain unchanged. Current-walk hash reuse and independent observation ages prevent redundant blocking reads without extending freshness. Desktop and service CLI demonstrated Ready for the exact same R44 selection; the selected executor badge uses that same projection. One bridge (PID 27284) reloaded with pairing/journals preserved. Physical-phone confirmation after this reload and the real Dot/mobile-plan pilot remain pending. Final verification: 316 affected recovery tests plus 9 existing UI/recovery tests, zero skipped; typecheck/scoped lint pass.

**Responsive readiness closure (2026-10-18):** Passive compiler inspection now uses a bounded worker thread so the unchanged health deadline remains responsive. Final 327 recovery/UI tests pass, zero skipped; typecheck/scoped lint pass. Exact R44 CLI Ready and 12 concurrent health probes passed after the single idle reload at 2026-10-18T11:02:37.2361757Z. Policy 8, pairing and history preserved. Actual-phone confirmation and the Dot/mobile-approved candidate remain pending.
