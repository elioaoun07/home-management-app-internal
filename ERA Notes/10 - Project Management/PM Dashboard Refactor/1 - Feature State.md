---
created: 2026-07-13
updated: 2026-07-18
type: status
status: living
owner: Elio
tags: [pm/status, tooling/pm-dashboard]
---

# PM Dashboard Refactor · 1 — Feature State

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current reality

🟢 **The new Preact Command Center is the default live dashboard.** It has hash routes, browser history, ERA blue/frost themes, module/document views, backlinks, canonical interactive checkboxes, a JIRA-style task board/table, global search, rollups, file operations, and a re-skinned Delivery surface.

🟢 **Checkbox identity has a constructional safety guard.** One dependency-free scanner serves mutations, Markdown, tasks, and tests; parity compares it with the literal legacy algorithm across all 358 real PM files. ✅ (2026-07-13, `scripts/pm/shared/md-scan.mjs`, `tests/pm-ui/ordinal-parity.test.ts`)

🟢 **The portable twin uses the same bundle.** Geist is vendored/inlined; no Google Fonts dependency exists; Delivery/edit entry points are hidden in static mode. ✅ (2026-07-13, `scripts/pm/build.mjs`, `scripts/build-pm-dashboard.mjs`)

🟢 **Delivery remains single-source.** The UI imports the registry/classifier directly, appends cursor-based event tails, and retains server-authoritative gates/errors. ✅ (2026-07-13, `scripts/pm/src/features/delivery/`)

🟡 **Final visual parity is pending.** Compilation/tests and live HTTP assembly pass, but the in-app browser was unavailable, so desktop/mobile click-through, the fake-driver walkthrough, and final legacy-file deletion remain the cutover gate. The new UI is default; `--ui=old` / `?ui=old` is a temporary rollback surface.

🟢 **The PM Center is an installable PWA with an opt-in LAN mode.** House-style icon family (`scripts/pm/assets/pm-icon.svg` → 180/192/512/maskable PNGs via `pnpm pm:icons`) and `pm.webmanifest` are served from `scripts/pm-server.mjs` in server mode only (static `_dashboard.html` is untouched). `pnpm pm --lan` opts into binding `0.0.0.0` for phone access over Wi-Fi; the DNS-rebinding host guard (`scripts/pm/net.mjs`) allows RFC1918 ranges only when LAN mode is on, and still rejects everything else. ✅ (2026-07-17, `scripts/pm-server.mjs`, `scripts/pm/net.mjs`, `scripts/pm/assets/`)

🟢 **The read-only PM Console is now a first-class page of the deployed app at `/pm` — installable on a phone, offline, with the laptop off.** This resolves the phone-access goal without the LAN/HTTPS detour: `pnpm pm:public` (wired into `prebuild`, so it reruns on every Vercel deploy) renders the same static Preact bundle + a fresh PM-markdown snapshot into `public/pm.html`, with an installable head (`/pm.webmanifest`, `/pm-*.png` icons, `/pm-icon.svg`, apple-touch tags) and a `/sw.js` registration for cold direct-opens. A `next.config.ts` rewrite serves it at the clean `/pm` URL (so the manifest `scope: "/pm"` matches). Offline reuses the **existing** app service worker (`public/sw.js`, unchanged) with no forced version bump: its navigation + image handlers already cache `/pm` and the icons stale-while-revalidate on the first (necessarily online) open, and the hosted page registers `/sw.js` itself so a cold direct-open from the installed icon still installs the worker. Precaching `/pm` into the shared SW was considered and rejected — a 7 MB precache for every household user on a forced bump buys nothing, since `/pm` can't be opened offline before its install-time online open caches it anyway. The page is inherently read-only (all mutations/SSE/Delivery gate on `PM_MODE === "server"`) and shows the snapshot as of the last deploy — the only possible model when the laptop (sole writer) is off. The interactive editor stays at `pnpm pm` on localhost. **Access is gated behind the app's existing Supabase login** via a new `src/middleware.ts` scoped to `/pm` + `/pm.html` (the raw static file is matched too, else it'd be an open bypass): unauthenticated requests 307 → `/login?redirect=/pm`, and the login action already honors `redirect`. The data is embedded in the HTML, so this gate is what stops the URL from leaking every PM doc publicly. `/pm.webmanifest` + icons stay public (non-sensitive). Offline is unaffected — the service worker serves the last authenticated cached load and middleware never runs. ✅ (2026-07-18, `scripts/build-pm-dashboard.mjs`, `scripts/pm/ui.mjs`, `src/middleware.ts`, `next.config.ts`, `public/pm.webmanifest`, `public/pm-*.png`)

🟡 **The local `pnpm pm` server's own offline snapshot stays desktop-only.** `scripts/pm/assets/sw.js` is network-first with a cache fallback for `/` and `/api/data` (precached on `install`, refreshed on every live load); a response header (`x-pm-offline`/`x-pm-cached-at`) lets the client show a banner and block mutations with a clear toast. This worker still only registers in a secure context, so it only helps when the desktop browser is at `http://127.0.0.1`. That's now a non-issue for phone use — phone access is served by the deployed `/pm` route above (R16), which supersedes the old HTTPS-LAN plan (R15). ✅ (2026-07-17, `scripts/pm/assets/sw.js`, `scripts/pm/src/app/api.js`, `scripts/pm/src/app/store.js`, `scripts/pm/src/app/sse.js`)

🟢 **A dedicated mobile home + bottom nav ships for phone-width viewports.** `MobileHome` (glance stats, a "needs your decision" feed sourced from `/api/delivery/sessions`' existing `awaiting` field, the Now lane, active sessions, quick-nav tiles) renders in place of the desktop `HomeView` below 700px; a fixed `MobileNav` tab bar covers Home/Tasks/Checklist/Delivery. ✅ (2026-07-17, `scripts/pm/src/features/home/MobileHome.jsx`, `scripts/pm/src/features/nav/MobileNav.jsx`, `scripts/pm/src/lib/media.js`)

🟢 **Delivery gates, questions, monitoring, and the launch Wizard are usable one-handed.** Gate decision buttons stack full-width with 48px targets; attention cards and session rows deep-link straight to the Q&A tab via a new `?tab=` param on `SessionDetail`; delivery tabs/stepper scroll horizontally; the Wizard/config/artifact modals go full-screen below 700px. ✅ (2026-07-17, `scripts/pm/src/features/delivery/SessionDetail.jsx`, `DeliveryHome.jsx`, `scripts/pm/src/styles/delivery.css`)

🟢 **Long checklist items stay readable instead of truncating.** `ChecklistRollup` is rebuilt around a shared `TaskCard` (chips on one line, full item text wrapped on its own line, never truncated) grouped into collapsible Now/Next/Later lanes with a campaign filter; `MobileHome`'s Now lane reuses the same card. `.md-task` in-doc rendering got the same wrap treatment. ✅ (2026-07-17, `scripts/pm/src/features/rollups/Rollups.jsx`, `scripts/pm/src/styles/components.css`, `scripts/pm/src/styles/doc.css`)

## Evidence

- Focused suite: 8 files / 31 tests green on 2026-07-13.
- `pnpm pm:build-ui`: minified IIFE and CSS built.
- Live HTTP probe: both roots returned 200; new root included mount + fonts; `/api/data` returned 358 docs and 237 source keys.
- 2026-07-17 PWA/mobile pass: `pnpm vitest run tests/pm-mutations.test.ts tests/pm-server-net.test.ts tests/delivery/server-routes.test.ts` — 23 new net-guard tests + existing suites all green; `pnpm pm:build-ui` bundle OK; manual browser pass on `pnpm pm` confirmed manifest/icons/service-worker registration, the DNS-rebind guard (localhost/LAN allow, arbitrary Host reject), checklist lane rendering, and Delivery's `awaiting` chip against real session data.
- 2026-07-18 (R26): `lintChecklist` JSDoc typing fixed in `scripts/pm/lint.mjs` — `pnpm typecheck` green again repo-wide (was broken since ~07-13 by the untyped options bag); `npx vitest run tests/pm-ui/lint-rules.test.ts` 6/6 green.
