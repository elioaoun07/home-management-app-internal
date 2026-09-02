---
created: 2026-09-02
updated: 2026-09-02
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/native
---

# Native App · 4 — Checklist

> **Campaign:** [Native App — Master Book](<Native App — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Native App — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [Native App — Master Book](<Native App — Master Book.md>).
>
> **Registered 2026-09-02** alongside the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>), which schedules this campaign as its Phase 4 (Dec 8–31), with groundwork (N-00) starting async on Sep 15 because account verification takes weeks. Every item here carries its plan packet ID.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.

---

## Now

- [ ] **NAT-1** *(packet **N-00** of the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>), opens 2026-09-15)* Accounts and groundwork: Apple Developer, Play Console, Firebase project (FCM only), `era-mobile` Vercel project with env parity, final mobile domain, Supabase Auth redirect allow-list. Owner-executed, no code, weeks of verification waits — started early precisely because it has no code in it. → [Native App — Master Book](<Native App — Master Book.md>) §"Phase roadmap" Phase 0 _(blocker - S)_

## Next

*(empty — the shell/push/distribution work in Later has weeks of Now-lane account waits ahead of it; nothing here queues until NAT-1 clears)*

## Later

- [ ] **NAT-2** *(packet **N-01**)* Capacitor shell MVP — Android: `capacitor.config.ts` with `server.url`, committed `android/`, icons/splash/status bar, a new src/lib/native/ bridge skeleton, SW platform guards. Prereq: manifest inventory recorded (16 files under `public/`, not the Master Book's stated 9). _(blocker - M)_
- [ ] **NAT-3** *(packet **N-02**)* iOS shell + the `WKAppBoundDomains` × `server.url` spike on a real iPhone (SW offline cold start + bridge injection — never verified together). _(blocker - M)_
- [ ] **NAT-4** *(packet **N-03**)* Native push end-to-end: `native_push.sql` migration, Zod discriminated union on the subscribe route, `pushSender.ts` FCM v1 branch, Android channels, iOS Time Sensitive, tap-through deep links; browser web-push must stay unregressed. Depends on the proactive briefing (E-05 of the Master Plan) existing as the payload worth shipping this for. _(blocker - M)_
- [ ] **NAT-5** *(packet **N-04**, owner-executed)* Distribution: Play Internal Testing + TestFlight internal; partner onboarded; auto-update proven with a trivial binary bump. _(blocker - S)_
- [ ] **NAT-6** *(packet **N-05**; plan sacrifice #5 if a gate is missed)* Native wave 1: App/Universal Links, native NFC read into the existing tag flow, haptics shim for iOS. _(annoyance - M)_

## Definition of Done

- [ ] **D1** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.
- [ ] **D2** A cron-fired push (the 07:15 briefing) lands on both locked phones with correct sound/priority and deep-links to `/era`; the existing browser web-push path is verified unregressed via the test endpoint.
- [ ] **D3** The PWA Non-Interference Contract holds — no code or DB change made for native reasons has altered the existing web/PWA deployment's behavior.
