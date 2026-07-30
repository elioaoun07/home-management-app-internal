---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - pm/meta
---

# Project Management · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) remains normative for the layer model (command center → campaigns → FABLED → reviews) and the enforcement hooks. This file rewrites the **tooling** picture, which v2 could not have described — it changed almost completely.

## 1. The dashboard became an app (`ca00105` "PM Refactored" → `f0a8e19` "pm manifest")

`scripts/pm/` is now a **7,156-LOC single-page application** with its own architecture:

| Piece | What it is |
|---|---|
| `src/app/` | `App.jsx`, `router.js`, `store.js` (the `inFabled` hide flag lives at store.js:38), `sse.js` (live reload from the server), `shortcuts.js`, `api.js` |
| `src/features/` | 10 feature dirs: home, module, tasks, doc, files, search, nav, rollups, source, **delivery** (the Agentic Delivery Workspace UI) |
| `shared/` | `frontmatter.mjs`, `md-scan.mjs`, `tasks.mjs`, `links.mjs`, `text.mjs` — the pure parsing core shared by server, build, and lint |
| `assets/` | **PWA**: `pm.webmanifest`, `sw.js` service worker, icon set (`pm-*.png`) — the PM board is installable; `next.config.ts` gained rewrites for it (`f0a8e19`) |
| Entry points | `pnpm pm` (live server) · `pm:lint` · `pm:build-ui` · `pm:dashboard` / `pm:public` (static twin `_dashboard.html`) |

## 2. The PM layer has its own test suite now

`tests/pm-ui/` — 7 files: `build-smoke`, `delivery-eligibility`, `lint-rules` (6 tests), `ordinal-parity`, `search`, `shared-parsing`, `static-twin` (asserts the static `_dashboard.html` twin renders the same data as the live app). This is the single biggest reason the global test count moved 93 → 1,048 since FABLED 2. Caveat honestly: these protect the *PM tooling*, not the product app.

## 3. Freshness machinery matured

- Global `2 - Feature State — Current Reality.md`: `status: superseded` 2026-07-15 — the "Updated 2026-05-30" zombie that FABLED 2's Freshness=4 was built on is formally dead, replaced by the live board + campaign files as source of truth.
- New numbered doc `11 - docs` (5636274) and "all fable sessions" (`9a037d8`) added session-history surfaces.
- New campaigns since v2, all uniform-layout: **Healthcare**, **Outfits**, **PM Dashboard Refactor** (prefix R), **Delivery Workspace / Agentic Delivery Workspace** (S1/S2 docs, 6d87d83 cost optimization), **Native App** (6-doc plan, 2026-07-11).

## 4. Enforcement (unchanged, re-verified)

`check-pm-update.sh` (Stop hook), `check-migration.sh`, `docs:check` in pre-commit, `pm:lint` grammar guard per `_Conventions.md` (updated 2026-07-15). The `inFabled` regex hides any `FABLED*` path segment — **generation 3 is auto-hidden with zero tooling change**.

## 5. Size & risk map

Tooling JS/JSX: 7,156 LOC, untyped except JSDoc (lint.mjs typed 2026-07-18 after a week-long typecheck break — see ledger). The bespoke-SPA choice trades framework safety for zero dependencies; the test suite is the compensating control.
