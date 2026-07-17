---
created: 2026-07-13
updated: 2026-07-13
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

🟡 **The service worker caches a last-synced snapshot for offline reading — desktop-only until the LAN is served over HTTPS.** `sw.js` is network-first with a cache fallback for `/` and `/api/data` (precached on `install`, refreshed on every live load); a response header (`x-pm-offline`/`x-pm-cached-at`) lets the client show a banner and block mutations with a clear toast instead of a raw fetch error. **Known gap:** service workers only register in secure contexts (HTTPS or `localhost`) — a phone reaching the server over plain `http://<lan-ip>` (the current `--lan` mode) can never register the worker, so today this only works when the browser itself is at `http://127.0.0.1` (desktop). Making it work on a phone requires serving `--lan` over HTTPS (self-signed cert, one-time trust on the phone) — not yet built, tracked as `R15` below. ✅ (2026-07-17, `scripts/pm/assets/sw.js`, `scripts/pm/src/app/api.js`, `scripts/pm/src/app/store.js`, `scripts/pm/src/app/sse.js`)

🟢 **A dedicated mobile home + bottom nav ships for phone-width viewports.** `MobileHome` (glance stats, a "needs your decision" feed sourced from `/api/delivery/sessions`' existing `awaiting` field, the Now lane, active sessions, quick-nav tiles) renders in place of the desktop `HomeView` below 700px; a fixed `MobileNav` tab bar covers Home/Tasks/Checklist/Delivery. ✅ (2026-07-17, `scripts/pm/src/features/home/MobileHome.jsx`, `scripts/pm/src/features/nav/MobileNav.jsx`, `scripts/pm/src/lib/media.js`)

🟢 **Delivery gates, questions, monitoring, and the launch Wizard are usable one-handed.** Gate decision buttons stack full-width with 48px targets; attention cards and session rows deep-link straight to the Q&A tab via a new `?tab=` param on `SessionDetail`; delivery tabs/stepper scroll horizontally; the Wizard/config/artifact modals go full-screen below 700px. ✅ (2026-07-17, `scripts/pm/src/features/delivery/SessionDetail.jsx`, `DeliveryHome.jsx`, `scripts/pm/src/styles/delivery.css`)

🟢 **Long checklist items stay readable instead of truncating.** `ChecklistRollup` is rebuilt around a shared `TaskCard` (chips on one line, full item text wrapped on its own line, never truncated) grouped into collapsible Now/Next/Later lanes with a campaign filter; `MobileHome`'s Now lane reuses the same card. `.md-task` in-doc rendering got the same wrap treatment. ✅ (2026-07-17, `scripts/pm/src/features/rollups/Rollups.jsx`, `scripts/pm/src/styles/components.css`, `scripts/pm/src/styles/doc.css`)

## Evidence

- Focused suite: 8 files / 31 tests green on 2026-07-13.
- `pnpm pm:build-ui`: minified IIFE and CSS built.
- Live HTTP probe: both roots returned 200; new root included mount + fonts; `/api/data` returned 358 docs and 237 source keys.
- 2026-07-17 PWA/mobile pass: `pnpm vitest run tests/pm-mutations.test.ts tests/pm-server-net.test.ts tests/delivery/server-routes.test.ts` — 23 new net-guard tests + existing suites all green; `pnpm pm:build-ui` bundle OK; manual browser pass on `pnpm pm` confirmed manifest/icons/service-worker registration, the DNS-rebind guard (localhost/LAN allow, arbitrary Host reject), checklist lane rendering, and Delivery's `awaiting` chip against real session data.
