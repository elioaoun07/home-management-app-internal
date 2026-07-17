---
created: 2026-07-13
updated: 2026-07-18
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/pm-dashboard]
---

# PM Dashboard Refactor · 4 — Checklist

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Now

- [x] **R16** Ship the read-only PM Console as a first-class page of the deployed app at `/pm` — own `pm.webmanifest`/icons, installable on a phone, offline via the app service worker, laptop off. Snapshot rebuilt from PM markdown by `pnpm pm:public` in `prebuild`. Gated behind the app's Supabase login (`src/middleware.ts`, matches `/pm` + `/pm.html`; unauth → `/login?redirect=/pm`). _(friction - M)_ ✅ 2026-07-18
- [x] **R15** ~~Serve `--lan` mode over HTTPS~~ — **superseded by R16.** The phone-offline goal is met by hosting the console inside the already-HTTPS deployed app, so no self-signed-cert LAN path is needed. The local `pnpm pm` server stays HTTP-on-localhost for the interactive editor. _(friction - M)_ ✅ 2026-07-18
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

