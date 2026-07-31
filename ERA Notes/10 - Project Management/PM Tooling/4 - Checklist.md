---
created: 2026-07-13
updated: 2026-07-31
type: checklist
status: active
owner: Elio
tags: [pm/checklist, tooling/pm]
---

# PM Tooling — Checklist

> **Campaign:** [PM Tooling — Master Book](<PM Tooling — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> Grammar per [_Conventions](<../_Conventions.md>) (prefix `R`, grandfathered). Shipped items live in the Master Book's Shipped Log.

---

## Now

- [ ] **R6** Complete the desktop + 390 px visual UAT and a fake-driver delivery walkthrough, then delete the legacy `client.js` / `styles.css` / `body.html` and the `?ui=old` rollback surface _(blocker - M)_

## Next

- [ ] **R41** Fix the stripping order in `cleanInlineText()` so `_(severity - effort)_` actually matches and strips — swap the emphasis-strip and the meta-strip regex order (or strip the meta suffix first) → `scripts/pm/shared/text.mjs:12` _(friction - S)_
- [ ] **R42** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes — the tap path is known-flaky against `scroll-snap-mandatory` + `scrollTo({behavior:"smooth"})` in at least one automated-browser environment; also confirm haptics, safe-area insets, and the new `pm-live.webmanifest` install → `src/components/pm-live/session/SegmentedPanes.tsx` _(friction - S)_
- [ ] **R34** Make the hygiene sweep a scheduled ritual rather than a generational event — a recurring line here plus the freshness radar printing the oldest open S-effort item every session. No new tooling → `.claude/hooks/session-brief.sh` _(friction - S)_
- [ ] **R35** Meta-work budget rule in the conventions: a session that only touches `ERA Notes/` or `scripts/pm/` must state which product-code item it unblocks, and two consecutive such sessions require a product session between them → [_Conventions](<../_Conventions.md>) _(friction - S)_
- [ ] **R7** Verify SSE data and UI rebuild frames in a browser, including external edits and 409 drift recovery _(friction - S)_

## Later

- [ ] **R36** JSDoc-type the `shared/` parsing core so typecheck guards the scanner everything else trusts — five files of pure functions, with the `lint.mjs` fix as the template → `scripts/pm/shared/md-scan.mjs` _(friction - M)_
- [ ] **R37** Service-worker cache-version assertion — extend the static-twin test to assert the cache key changes when the bundle output changes → `tests/pm-ui/ordinal-parity.test.ts` _(annoyance - S)_
- [ ] **R38** Session-history retention convention (a frontmatter status after N days) plus freshness-radar coverage, so those surfaces don't become the next stale-doc zombies _(annoyance - S)_
- [ ] **R8** Measure index responsiveness on the largest note and on the complete static twin _(annoyance - S)_
- [ ] **R9** Font subsetting — only if offline load proves materially slow _(parked - S)_

## Definition of Done

- **D1** `pnpm pm:lint` is clean and `npx vitest run tests/pm-ui/` is green before and after every change.
- **D2** The static twin stays at parity with the server UI after any bundle change.
- **D3** Every view that renders a checkbox honours hide-completed, verified at 390 px and on the desktop.
- **D4** A filtered board can be reloaded and shared by URL.
