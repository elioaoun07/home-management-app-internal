---
created: 2026-07-13
updated: 2026-09-06
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

CI execution is owned once by HUB-37/E-01a in [Hub & ERA](<../Hub & ERA/4 - Checklist.md>). The former open R49 alias is absorbed there; shipped R49 remains archive automation and is never reused.
- [ ] **R6** Complete the desktop + 390 px visual UAT and a fake-driver delivery walkthrough, then delete the legacy `client.js` / `styles.css` / `body.html` and the `?ui=old` rollback surface _(blocker - M)_
- [ ] **R43** (ASTRA-CC-C13; owner evidence required) Verify current hot-child RLS and read-path contracts before deciding whether Hard Rule 20 needs any amendment or DB change. schema.sql alone cannot establish the policy state; no guessed denormalization or policy rewrite. → [ASTRA evidence](<ASTRA/PM Tooling — ASTRA Book.md>) _(blocker - M)_
- [ ] **R44** *(hygiene packet **H-02** of the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>))* Add an eslint guard for Hard Rule 6 so no *new* raw mutating `fetch()` can enter client code — a `no-restricted-syntax` rule scoped to the client directories (components, features, hooks, contexts), warn-level until the existing 98 sites are burned down → `eslint.config.mjs` _(blocker - S)_
- [ ] **R45** Rescope Hard Rule 1 to mutation-confirming toasts only ("every toast that confirms a completed mutation carries an Undo"), then measure the real gap against `toast.success(` alone — the current all-toasts wording is unachievable for the 417 `toast.error(` sites and is training everyone to read Hard Rules as advisory _(friction - S)_

## Next

- [ ] **R42** Live-verify `/pm/live`'s mobile rebuild on a real phone: confirm the `SegmentedPanes` swipe (not just the tap) reliably advances panes — the tap path is known-flaky against `scroll-snap-mandatory` + `scrollTo({behavior:"smooth"})` in at least one automated-browser environment; also confirm haptics, safe-area insets, and the new `pm-live.webmanifest` install → `src/components/pm-live/session/SegmentedPanes.tsx` _(friction - S)_
- [ ] **R34** Make the hygiene sweep a scheduled ritual rather than a generational event — a recurring line here plus the freshness radar printing the oldest open S-effort item every session. No new tooling → `.claude/hooks/session-brief.sh` _(friction - S)_
- [ ] **R35** Meta-work budget rule in the conventions: a session that only touches `ERA Notes/` or `scripts/pm/` must state which product-code item it unblocks, and two consecutive such sessions require a product session between them → [_Conventions](<../_Conventions.md>) _(friction - S)_
- [ ] **R51** (ASTRA-R-1; replaces the reused open R7 alias) Desktop task mutations reject stale item identity, Undo refuses later edits, and original SSE/rebuild/409 verification passes. Dispatch only after a demonstrated DLV-93 trust blocker is selected or the freeze clears. → [Execution sheet](<ASTRA/PM Tooling — ASTRA Packets.md>) _(friction - M)_
- [ ] **R46** Add a PostToolUse hook warning when an API route file exporting POST/PATCH/PUT has no Zod import (Hard Rule 12) — 113 of 170 mutating routes currently have none, pattern to follow is `.claude/hooks/check-migration.sh` _(friction - M)_
- [ ] **R47** *(bundled with R44 into hygiene packet **H-02**)* Scoped `no-console` eslint rule matching Hard Rule 22's corrected client-only wording, warn-level over the client directories (202 sites); server routes stay exempt by design → `eslint.config.mjs` _(annoyance - S)_
- [ ] **R48** Burn down the 98 raw client `fetch()` mutation sites to `safeFetch()`, starting with `hub/ShoppingListView.tsx` (13) and `useNotifications.ts` (8); flip R44's eslint rule from warn to error when it reaches zero _(friction - L)_

## Later

**ASTRA wave 1 (2026-09-06)** *(study: [ASTRA Book](<ASTRA/PM Tooling — ASTRA Book.md>); sheets: [ASTRA Packets](<ASTRA/PM Tooling — ASTRA Packets.md>))*

R51 preserves the old open R7 scope under a fresh ID; shipped R7 remains vault consolidation. ASTRA-R-2 refines R37, ASTRA-R-3 refines R6, ASTRA-R-4 refines R36; none creates an extra slot. ASTRA-R-5 remains an unallocated DLV-52 enforcement candidate competing for DLV-93's single validation slot. The former CI alias is merged into HUB-37, not marked shipped here. No parser, framework or parallel-agent expansion is admitted.

- [ ] **R36** JSDoc-type the `shared/` parsing core so typecheck guards the scanner everything else trusts — five files of pure functions, with the `lint.mjs` fix as the template → `scripts/pm/shared/md-scan.mjs` _(friction - M)_
- [ ] **R37** (ASTRA-R-2; HELD by Delivery freeze) Verify local shell/data compatibility and static source provenance with explicit build/cache fixtures; ordinal-parity and static embedding tests alone do not prove cache freshness. Preserve hosted follow-up boundaries. → [Execution sheet](<ASTRA/PM Tooling — ASTRA Packets.md>) _(annoyance - M)_
- [ ] **R38** Session-history retention convention (a frontmatter status after N days) plus freshness-radar coverage, so those surfaces don't become the next stale-doc zombies _(annoyance - S)_
- [ ] **R8** Measure index responsiveness on the largest note and on the complete static twin _(annoyance - S)_
- [ ] **R9** Font subsetting — only if offline load proves materially slow _(parked - S)_

## Definition of Done

- **D1** `pnpm pm:lint` is clean and `npx vitest run tests/pm-ui/` is green before and after every change.
- **D2** The static twin stays at parity with the server UI after any bundle change.
- **D3** Every view that renders a checkbox honours hide-completed, verified at 390 px and on the desktop.
- **D4** A filtered board can be reloaded and shared by URL.
