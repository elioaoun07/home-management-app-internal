---
created: 2026-07-13
updated: 2026-07-13
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/pm-dashboard]
---

# PM Dashboard Refactor · 4 — Checklist

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Now

- [ ] **R15** Serve `--lan` mode over HTTPS (self-signed cert, one-time phone trust) so the offline-snapshot service worker can actually register on a phone — plain LAN HTTP is not a secure context and service workers refuse to register there. _(friction - M)_
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

