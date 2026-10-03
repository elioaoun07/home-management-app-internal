---
name: pwa-install
description: "Rules for the many installable PWAs on ONE origin (Trips, Chores, Chat, Catalogue, Expense…). Use when adding/renaming an installable app, editing any manifest (public/manifest.json, public/manifests/*.webmanifest, public/pm.webmanifest) or a route's metadata.manifest, or when the owner reports 'This app is already installed' / 'only Create shortcut'. NOT for nav/header styling of standalone pages (ui-guardrails)."
---

# /pwa-install — One Origin, Many Installable Apps

> **Contract:** every installable app owns a **disjoint scope**. No manifest may ever claim `scope: "/"`, and no app's scope may contain another app's `start_url`. `pnpm pwa:check` enforces this and runs in pre-commit; it must pass before you call a manifest change done. If a new app's install fails on the phone and `pwa:check` is green, the cause is **phone state** (an old installed app with a wider scope), not code. Hand the owner the reset steps below; don't edit manifests.

## The verified model

- Chrome/Android decides "already installed" by asking whether the page URL is inside the scope of **any** installed WebAPK. Scope matching is a plain path-prefix test, so `/` matches everything and `/pm` matches `/pm/live`.
- Until 2026-10-03 the root `public/manifest.json` (Budget, id `/budget-app`) had `scope: "/"`. Every app installed **after** it (Chores, for example) showed "This app is already installed" or only "Create shortcut". Apps installed **before** it kept working because the more specific installed scope wins. That's why Trips, Chat and the rest worked and Chores didn't.
- The fix (owner decision 2026-10-03, reversing the July "install-order dance"): Budget's scope is now `/expense`. Trade-off the owner accepted: from the Expense/Budget app, opening `/recurring`, `/settings` or `/statement-import` shows Android's thin URL strip, because those pages aren't their own apps.
- An installed WebAPK keeps its **old** scope until Chrome re-reads its manifest, and the Budget icon can't update (its start page `/expense` links a different manifest id). Phones that still have the old Budget icon need the one-time reset below.
- A service worker is **not** an install requirement (Chrome 108+). Never chase SW changes for this symptom.

## Wiring an installable app (copy Trips/Chores exactly)

| Piece | Path | Rule |
|---|---|---|
| Manifest | `public/manifests/<name>.webmanifest` | `id: "/<name>-app"`, `scope: "/<name>"`, `start_url: "/<name>"`. Shortcuts must stay inside the scope (Chrome drops the others). |
| Link | `src/app/<name>/layout.tsx` → `metadata.manifest` | Same shape as `src/app/trips/layout.tsx`, with `appleWebApp.title` set. |
| Icons | `public/<name>-icon.svg` → `<name>-{180,192,512,maskable-512}.png` | Add an outputs block + call in `scripts/generate-icons.cjs`, then `pnpm icons`. Missing icons = not installable. |
| Chrome | `MobileNav.tsx` `standaloneRoutes`, `ConditionalHeader.tsx` `STANDALONE_APPS`, `AIChatAssistant.tsx` `standaloneRoutes` | Add the route so the Budget nav/header don't render inside it. |
| Guard | `pnpm pwa:check` | Must print `✓`. |

The scope must not prefix another route by accident: `/chat` also matches `/chat-archive`. Name new routes so that no scope is a string prefix of another app's route.

## Known failure modes

| Symptom on phone | Cause | Confirm |
|---|---|---|
| "This app is already installed" / only "Create shortcut" | An installed app's scope contains this URL (old Budget `/`, or PM `/pm` over PM Live) | Phone: open `chrome://webapks` and read each app's **Scope** |
| Install option missing entirely | Manifest icons 404 (Meal Plan had this until 2026-10-03) | `pnpm pwa:check` lists missing icons |
| Installed app opens with the Budget nav bar | Route missing from the `standaloneRoutes` / `STANDALONE_APPS` lists | Grep the three files above |
| Icon installs but opens the wrong app | Two manifests share an `id`, or the page links the wrong manifest | `pnpm pwa:check` (duplicate ids, route outside scope) |

`KNOWN_OVERLAPS` in `scripts/check-pwa-manifests.mjs` lists the accepted overlaps (Budget/Expense share `/expense`; PM `/pm` contains PM Live). Adding a row is an **owner decision**. Never add one just to silence a new app.

## One-time phone reset (owner runs, per phone)

1. Open `chrome://webapks` in Chrome and find any app whose Scope is `https://<domain>/`.
2. Uninstall that icon (long-press → App info → Uninstall).
3. Open the new app's URL (e.g. `/chores`) → ⋮ → **Install app**.
4. Reinstall Expense from `/expense` if you want it. Its scope is now `/expense`, so it no longer blocks anything.

## STOP conditions

- Proposing `scope: "/"`, a scope that contains another app, or a new `KNOWN_OVERLAPS` row: ask the owner first.
- Subdomains per app: the owner rejected them (infra + Supabase cookie work). Only bring them back if the owner reopens it.

## Checklist before leaving

- [ ] `pnpm pwa:check` prints `✓`
- [ ] New app: manifest, layout link, 4 PNG icons and the 3 standalone lists all present
- [ ] `ERA Notes/01 - Architecture/Standalone PWA Apps.md` table updated
- [ ] Owner told whether their phone needs the one-time reset
