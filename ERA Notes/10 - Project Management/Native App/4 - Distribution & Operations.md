# 4 — Distribution & Operations

**Stamped:** 2026-07-11 · Covers plan sections: Android process (10), iOS process (11), dev workflow (12), deployment & rollback (19). Store-policy facts verified July 2026.

---

## 1. Android — install, signing, testing, updates (Elio's phone)

### One-time setup

1. **Play Console personal account** — $25 one-time; identity verification takes days → **start in Phase 0**.
2. **Play App Signing** (default): Google escrows the release signing key; you keep only an **upload keystore**. Generate it in Android Studio, store the `.jks` + passwords in the password manager, back it up — losing it is recoverable (Google support flow) but painful.
3. Create the app entry (internal-only; store listing fields minimal), fill the **Data safety form** honestly: collects email + financial data, not shared with third parties, encrypted in transit, account deletion via in-app. Low risk — internal testing has no pre-launch content review.

### Policy position (verified July 2026)

- The **12-testers/14-days closed-testing rule applies only to production access** for personal accounts created after Nov 2023. **Internal Testing is immediate** (up to 100 testers) — and production is never needed for private use. This is the "no review blocker" guarantee on Android.

### Build & release runbook (per binary update)

```
# Windows, repo root
pnpm build-web-if-needed        # web deploy is independent — usually nothing to do
pnpm cap:sync android           # sync plugin/config changes
# Android Studio: Build → Generate Signed App Bundle (upload keystore) → .aab
# Play Console → Internal testing → Create release → upload .aab → rollout
```

Phone installs via the internal-testing opt-in link once; afterwards **updates auto-install like any Play app**. Binary updates are needed only for: plugin additions, icon/splash/config changes, Capacitor upgrades, and Play's **yearly target-API ratchet** (~1 forced rebuild/yr — calendar reminder).

Dev fallback: direct APK sideload (`gradlew assembleDebug`) for day-to-day device testing without Play round-trips.

## 2. iOS — install, signing, testing, review, updates (partner's iPhone)

### One-time setup

1. **Apple Developer Program** — $99/yr, identity verification 1–2 days → **start in Phase 0**.
2. On the Mac: Xcode + **automatic signing** (Xcode manages certificates/profiles against the developer account). No manual certificate juggling needed at this scale.
3. App Store Connect: create the app record (bundle id from `capacitor.config.ts`).
4. **Partner onboarding:** App Store Connect → Users & Access → invite her Apple ID (minimal role, e.g. Customer Support) → add to the **TestFlight internal group**. She installs the TestFlight app once, accepts the invite, installs ERA.

### Policy position (verified July 2026)

- **TestFlight internal testing has no App Review** — builds are live for internal testers within minutes of upload. This is the "no review blocker" guarantee on iOS.
- **Builds expire 90 days after upload.** The quarterly ritual (below) is the entire recurring cost of this channel.

### Build & release runbook (per binary update, on the Mac)

```
git pull && pnpm install
pnpm cap:sync ios
# Xcode: bump build number → Product → Archive → Distribute → App Store Connect (TestFlight)
# App Store Connect: build appears → internal group gets it automatically
```

~30 minutes end-to-end. **Quarterly expiry ritual:** calendar reminder every ~80 days → rebuild + upload (no code changes required). TestFlight auto-updates internal testers' installs. Optional later: a scheduled GitHub Actions macOS workflow automates this (App Store Connect API key + fastlane; free-tier minutes suffice at quarterly cadence) — documented as an option, not a dependency, since the Mac makes the manual path cheap.

### Unlisted App Store graduation (Stage 2 — only if the 90-day ritual annoys)

Requirements gathered up front so nothing surprises later:

1. **Stage-2 bundled build** (doc 2) — a remote-URL webview risks guideline **4.2 (minimum functionality)** rejection; bundled assets + native features (push, NFC, haptics, alarms) put the app comfortably in line with the thousands of approved Capacitor apps.
2. App Privacy **nutrition labels** + `PrivacyInfo.xcprivacy` privacy manifests (required-reason APIs declared; also required for any third-party SDKs — Capacitor plugins ship theirs).
3. **Demo account** credentials in App Review notes (reviewer must be able to log in), support URL, screenshots.
4. Submit for review with **Unlisted distribution** requested (developer.apple.com form; requests are declined if the app is in a beta state — submit as final).
5. Outcome: permanent private install link, normal App Store auto-updates. Each subsequent **binary** goes through review (~24h typical) — the point where Capgo OTA (deferred decision) becomes worth revisiting so JS-level changes skip review legitimately (WebKit-executed content updates are policy-compliant).

## 3. Development workflow — Windows + macOS

| Activity | Machine | Frequency |
|---|---|---|
| All web/feature development, deploys | Windows (unchanged) | Daily |
| Android build/test (emulator + device), Play uploads | Windows (Android Studio) | On binary changes only |
| Initial `ios/` platform add, iOS config changes | Mac | Rare |
| iOS archive + TestFlight upload | Mac | Quarterly + on binary changes |

- Repo sync via git; the Mac needs Node 20+, pnpm, Xcode, CocoaPods. Pin `engines` in `package.json` when native tooling lands.
- **Because Stage 1 is a remote shell, web deploys never involve either native toolchain** — feature work ships to both phones the moment the `era-mobile` project deploys (same push, auto by default). Binary work is the exception, not the routine.
- **Env-change ritual:** any new/changed env var is applied to **both** Vercel projects in the same sitting (parity rule, doc 3 §8) — the one recurring operational cost of the isolation split.
- Live-reload during native debugging: `server.url` can point at the Windows dev machine's LAN address (`next dev` + phone on same Wi-Fi) — same mechanism, no extra tooling.

## 4. Deployment & rollback

| Layer | Deploy | Rollback |
|---|---|---|
| Web PWA (`era-web` project) | Existing Vercel flow — **untouched by this plan** | Existing instant rollback, fully independent of mobile |
| Native UI/logic (`era-mobile` project, Stage 1) | Auto-deploys the same `main` pushes (optional dial: manual promotion during risky phases — doc 2 topology) | **Independent instant rollback / pinning — rolls back both phones without touching the web PWA.** This is the headline operational property of the isolated remote shell |
| Android binary | Play internal release | Re-promote the previous internal build |
| iOS binary | TestFlight upload | Previous build remains installable until its 90-day expiry |
| DB | Existing migration runbook (Hard Rule 24) | The native-push migration is **additive and backward-compatible** (web rows keep `platform='web'` default; nullable columns don't affect existing readers) |
| Total failure of a shell | — | Phones fall back to the installed PWA instantly (served by the untouched `era-web` project); fix at leisure |
| Cron | External scheduler → **`era-web` only, always** | Never point it at `era-mobile` — double execution duplicates notifications/auto-posts |

Release hygiene: binaries versioned `major.minor.patch` + build number; a one-line changelog per binary in this folder's checklist file (created at implementation); `data.type` payload-contract changes must ship server + `sw.js` + native mapping in the same deploy (single source of truth in `pushSender.ts` per doc 3 §4.3).
