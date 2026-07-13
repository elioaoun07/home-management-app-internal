---
created: 2026-07-13
updated: 2026-07-13
type: status
status: living
owner: Elio
tags: [pm/status, tooling/pm-dashboard]
---

# PM Dashboard Refactor · 1 — Feature State

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current reality

🟢 **The new Preact Command Center is the default live dashboard.** It has hash routes, browser history, ERA blue/frost themes, module/document views, backlinks, canonical interactive checkboxes, a JIRA-style task board/table, global search, rollups, file operations, and a re-skinned Delivery surface.

🟢 **Checkbox identity has a constructional safety guard.** One dependency-free scanner serves mutations, Markdown, tasks, and tests; parity compares it with the literal legacy algorithm across all 358 real PM files. ✅ (2026-07-13, `scripts/pm/shared/md-scan.mjs`, `tests/pm-ui/ordinal-parity.test.ts`)

🟢 **The portable twin uses the same bundle.** Geist is vendored/inlined; no Google Fonts dependency exists; Delivery/edit entry points are hidden in static mode. ✅ (2026-07-13, `scripts/pm/build.mjs`, `scripts/build-pm-dashboard.mjs`)

🟢 **Delivery remains single-source.** The UI imports the registry/classifier directly, appends cursor-based event tails, and retains server-authoritative gates/errors. ✅ (2026-07-13, `scripts/pm/src/features/delivery/`)

🟡 **Final visual parity is pending.** Compilation/tests and live HTTP assembly pass, but the in-app browser was unavailable, so desktop/mobile click-through, the fake-driver walkthrough, and final legacy-file deletion remain the cutover gate. The new UI is default; `--ui=old` / `?ui=old` is a temporary rollback surface.

## Evidence

- Focused suite: 8 files / 31 tests green on 2026-07-13.
- `pnpm pm:build-ui`: minified IIFE and CSS built.
- Live HTTP probe: both roots returned 200; new root included mount + fonts; `/api/data` returned 358 docs and 237 source keys.
