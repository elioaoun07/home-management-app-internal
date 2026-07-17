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

> Read-only, installable, offline-capable PM Command Center served by the deployed app at `/pm` — the same Preact console as `pnpm pm`, minus editing.

## Files

- **Served page**: `public/pm.html` — generated (gitignored); rebuilt from PM markdown by `pnpm pm:public` (`scripts/build-pm-dashboard.mjs --public`), which runs in `prebuild` on every deploy.
- **HTML builder**: `scripts/pm/ui.mjs` (`buildHtml({ mode: "static", pwa: true })`) — emits the installable head + `/sw.js` registration.
- **UI bundle** (shared with `pnpm pm`): `scripts/pm/src/` (Preact), built by `scripts/pm/build.mjs`.
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

## What it links to

- Everything is internal hash routing within the page (`/pm#/tasks`, `/pm#/checklist`, `/pm#/bugs`, `/pm#/module/...`, `/pm#/doc/...`) — no server navigation.

## Related vault doc

- `ERA Notes/10 - Project Management/PM Dashboard Refactor/` (see file 1 Feature State, R16)

## Screenshots

- `pm-mobile.png`
- `pm-desktop.png`

## Notes

- **Read-only by design.** All mutations, SSE, and the Delivery surface gate on `PM_MODE === "server"`; the hosted page runs `PM_MODE === "static"`, so edit affordances are hidden. Editing checkboxes / moving files happens on the laptop via `pnpm pm`.
- **Freshness = last deploy.** The snapshot is rebuilt from the committed PM markdown during `prebuild`. It cannot be live because the laptop is the only writer — when it's off there is no live source.
- **Distinct PWA identity.** `pm.webmanifest` uses its own `id`/`start_url`/`scope` of `/pm`, so the phone installs it as a separate app from the Budget PWA (`public/manifest.json`).
- **Login-gated.** `src/middleware.ts` is the app's only middleware; its matcher is scoped to `/pm` + `/pm.html` so it never touches other routes. Because the page's data is embedded in the static HTML (not fetched from an authenticated API), this gate is the sole thing preventing public read of all PM docs — do not widen the static exposure without it.
- Do not confuse with the standalone `pnpm pm` server's own PWA head (server mode, `scripts/pm/assets/pm.webmanifest`, localhost only).
