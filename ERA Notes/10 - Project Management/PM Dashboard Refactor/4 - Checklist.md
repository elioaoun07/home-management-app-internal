---
created: 2026-07-13
updated: 2026-07-25
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/pm-dashboard]
---

# PM Dashboard Refactor · 4 — Checklist

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Now

- [x] **R29** `/pm/live` — a third, checklist-only mobile surface, distinct from `_dashboard.html` (laptop-only) and the deployed `/pm` (frozen at last deploy). Fed by an outbound-only Supabase relay (`pnpm pm --bridge`) publishing parsed checklist tasks (~40-80 KB, no doc bodies) + distilled delivery-session state. The checklist is **read-only on the phone** — tapping a row opens the delivery flight check for that item, never a checkbox toggle (see Delivery 10x DLV-23; `tick` was removed the same day it shipped). `pnpm pm`'s `127.0.0.1` binding is unchanged — see `scripts/pm/net.mjs` and the Delivery 10x amendment in [6 · Design Debates](<../Delivery 10x/6 - Design Debates & Rejected Ideas.md>). Done 2026-07-25. → `` `scripts/pm/bridge.mjs` ``, `` `src/app/pm/live/page.tsx` ``, `` `migrations/2026-07-25_pm-mobile-relay.sql` `` _(friction - M)_
- [x] **R28** Delivery launch Wizard → full page instead of a modal (`#/delivery/new`, sidebar stays reachable); flight-check step's 2-col grid replaced with a `columns` masonry layout to kill dead whitespace and stop long mono paths overflowing off wide screens. Done 2026-07-25. → `` `scripts/pm/src/features/delivery/DeliveryHome.jsx` ``, `` `scripts/pm/src/styles/delivery.css` `` _(friction - S)_
- [x] **R27** Idea Inbox — `0 - Inbox.md` capture surface (New/Processed), 💡 topbar quick-capture in the dashboard (`QuickCapture.jsx`, reuses the `append` mutation, no server changes), `/triage-inbox` skill to elaborate/file entries, `_Conventions.md` §7 grammar. Done 2026-07-22. → `` `scripts/pm/src/features/inbox/QuickCapture.jsx` `` _(friction - S)_
- [x] **R26** Fix `lintChecklist` JSDoc typing in `` `scripts/pm/lint.mjs` `` — `campaign` + resolver return types were uninferable, breaking `pnpm typecheck` for 5 days; `tests/pm-ui/lint-rules.test.ts` 6/6 green after. Done 2026-07-18 (FABLED 3 handoff session). _(friction - S)_
- [x] **R16** Ship the read-only PM Console as a first-class page of the deployed app at `/pm` — own `pm.webmanifest`/icons, installable on a phone, offline via the app service worker, laptop off. Snapshot rebuilt from PM markdown by `pnpm pm:public` in `prebuild`. Gated behind the app's Supabase login (`src/middleware.ts`, matches `/pm` + `/pm.html`; unauth → `/login?redirect=/pm`). Done 2026-07-18. _(friction - M)_
- [x] **R15** ~~Serve `--lan` mode over HTTPS~~ — **superseded by R16.** The phone-offline goal is met by hosting the console inside the already-HTTPS deployed app, so no self-signed-cert LAN path is needed. The local `pnpm pm` server stays HTTP-on-localhost for the interactive editor. Done 2026-07-18. _(friction - M)_
- [ ] **R6** Complete desktop + 390 px visual UAT, fake-driver walkthrough, then delete the temporary legacy rollback branch/files. _(blocker - M)_
- [ ] **R10** Canonical item grammar spec + templates — `_Conventions.md` + `_Templates/`, one `- [ ] **PREFIX-n** … _(severity - effort)_` shape under Now/Next/Later. → `[_Conventions.md](<../_Conventions.md>)` _(friction - S)_
- [ ] **R11** Parser extensions + FABLED+/archived hide + parser tests — hyphenated/lettered IDs, one hidden-layer flag. → `` `scripts/pm/shared/tasks.mjs` ``, `` `scripts/delivery/packet.mjs` ``, `` `scripts/pm/src/app/store.js` `` _(friction - M)_
- [ ] **R13** Migrate the six campaign checklists to the canonical grammar (Now/Next/Later lanes, prefixed IDs). _(friction - M)_

## Next

- [ ] **R7** Verify SSE data/UI rebuild frames in a browser, including external edits and 409 drift recovery. _(friction - S)_
- [ ] **R8** Measure index responsiveness on the largest note and complete static twin. _(annoyance - S)_
- [ ] **R12** `pm:lint` script + rule tests — enforce grammar/lanes/IDs/links on the living checklists. → `` `scripts/pm/lint.mjs` `` _(friction - M)_
- [ ] **R14** Router `_index.md` rewrite + archival banners + guidance (CLAUDE.md HR25, finish-task Gate E, session-brief). _(friction - M)_

## Later

- [ ] **R9** Consider font subsetting only if offline load is materially slow. _(parked - S)_

