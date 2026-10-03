---
name: pwa-install
description: "Rules for the many installable PWAs on ONE origin (Trips, Chores, Chat, Catalogue, Expense…). Use when adding/renaming an installable app, editing any manifest (public/manifest.json, public/manifests/*.webmanifest, public/pm.webmanifest), a route's metadata.manifest or InstallAppPrompt, or when the owner reports 'This app is already installed' / 'Could not open app'. NOT for nav/header styling of standalone pages (ui-guardrails)."
---

# /pwa-install — One Origin, Many Installable Apps

> **Contract:** apps are installed with the **in-app Install button** (`src/components/pwa/InstallAppPrompt.tsx`), never with Chrome's ⋮ menu. Every app owns a **disjoint scope**: no `scope: "/"`, and no scope may contain another app's `start_url`. `pnpm pwa:check` enforces the scopes in pre-commit. Never tell the owner to "uninstall everything and retry". That doesn't fix the menu block, and that advice cost several rounds on 2026-10-03.

## The verified model (Chromium source, checked 2026-10-03)

Chrome on Android has two install paths, and they check different things:

| Path | "Already installed" check | Effect on a second app |
|---|---|---|
| **⋮ menu → Install** (Universal Install sheet, `AppInstallMenuHandler.doUniversalInstall`) | `WebappRegistry.isAppInstalledForUrl` → `hasAtLeastOneWebApkForOrigin`: **any** installed app on the same origin, whatever the scope | **Blocked.** Shows "This app is already installed". Its Open button then finds no app for this URL → "Could not open app" (`doOpenWebApp`). |
| **Page prompt** (`beforeinstallprompt` → `prompt()`, `AppBannerManager`) | `DoesNewWebAppConflictWithExistingInstallation` → `WebappsUtils.IsWebApkInstalled(start_url)`: only apps whose **scope** covers this app's start_url | **Works**, as long as scopes are disjoint. |

So the ⋮ menu can only ever install the **first** app on the origin. That's why it "worked before": older installs were done one at a time, or before Universal Install shipped. The scope rule still matters for the page path: Budget's old `scope: "/"` made *every* start_url conflict. It was narrowed to `/expense` on 2026-10-03 (SCH-22).

- `beforeinstallprompt` fires without an engagement gate and re-fires when the manifest `<link>` changes on client-side navigation (`AppBannerManager::DidUpdateWebManifestURL`).
- A service worker is not required (Chrome 108+).
- Any "fix" via subdomains, manifest ids or a phone reset does **not** address the menu block. Separate origins are the only way to make the menu itself work. The owner rejected subdomains; don't re-pitch them unless the owner reopens it.

## How the Install button works

`InstallAppPrompt` is mounted once in `src/app/layout.tsx`. It captures `beforeinstallprompt` together with the manifest href current at that moment, and shows a small opaque Install pill only while the page still links that same manifest. It hides in standalone mode and on routes listed in `OWN_INSTALL_UI` (`/activity-log` has its own button). Dismissing is **session-only**, because a permanent dismiss would leave no install path. iOS has no `beforeinstallprompt` (Share → Add to Home Screen works per page there).

## Wiring a new installable app (copy Trips/Chores exactly)

| Piece | Path | Rule |
|---|---|---|
| Manifest | `public/manifests/<name>.webmanifest` | `id: "/<name>-app"`, `scope: "/<name>"`, `start_url: "/<name>"`. Shortcuts stay inside the scope. |
| Link | `src/app/<name>/layout.tsx` → `metadata.manifest` | Same shape as `src/app/trips/layout.tsx`. |
| Icons | `public/<name>-icon.svg` → `<name>-{180,192,512,maskable-512}.png` | Add a block in `scripts/generate-icons.cjs`, run `pnpm icons`. Missing icons = no prompt. |
| Chrome | `MobileNav.tsx` `standaloneRoutes`, `ConditionalHeader.tsx` `STANDALONE_APPS`, `AIChatAssistant.tsx` `standaloneRoutes` | Keep the Budget nav/header out of the app. |
| Guard | `pnpm pwa:check` | Must print `✓`. |

A scope is a plain string prefix: `/chat` also matches `/chat-archive`. Name routes so no scope prefixes another app's route.

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| "This app is already installed", then "Could not open app" | User used the ⋮ menu while another app from this origin is installed | Open the app's page and tap the in-app **Install** pill |
| No Install pill on an app page | Already installed; scope overlap (`pnpm pwa:check`); icons 404; dismissed this session; or the page is opened inside an installed app | Check in that order. In Chrome, confirm via DevTools `Page.getInstallabilityErrors` |
| Installed app opens with the Budget nav bar | Route missing from the three standalone lists | Add it |

`KNOWN_OVERLAPS` in `scripts/check-pwa-manifests.mjs` lists accepted overlaps: Budget/Expense share `/expense`, and PM `/pm` contains PM Live. Adding a row is an **owner decision**.

## Verifying on Android without the owner's phone

An S23 Play-image emulator lives at `%LOCALAPPDATA%/Android/Sdk` (`emulator -avd S23`). Use `adb reverse tcp:3000 tcp:3000` for the local dev server and `adb forward tcp:9222 localabstract:chrome_devtools_remote` for DevTools. Its Play Store is signed out, so it makes shortcuts, not real WebAPKs. It proves the prompt fires and the dialog opens, not the final WebAPK. `chrome://webapks` on a phone lists real installs.

## Checklist before leaving

- [ ] `pnpm pwa:check` prints `✓`
- [ ] New app: manifest, layout link, 4 icons and the 3 standalone lists all present
- [ ] `ERA Notes/01 - Architecture/Standalone PWA Apps.md` table updated
- [ ] Owner told to install via the in-app **Install** pill, not the ⋮ menu
