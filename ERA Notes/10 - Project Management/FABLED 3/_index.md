---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - pm/meta
---

# Project Management · FABLED 3 — Index

> Third-generation audit of the **PM system itself** — the machine that manages the campaigns. Created 2026-07-18 as part of a **model-generation handoff**. Verified against `f0a8e19`. This cluster had the heaviest churn of any scope since 07-02 (362 files, +24,950/−3,773 in `scripts/pm` + `tests/pm-ui` + the PM folder): the dashboard became a real installable app, the PM layer grew its own test suite, and the stale global Feature State was formally superseded instead of left rotting. The gravity-well critique (Execution coupling 3) finally moved — barely.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | you want the PM machine as it exists now — SPA, tests, enforcement |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | where the machine still leaks |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | ranked moves |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | bigger ideas with kill criteria |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to touch PM docs or tooling — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-02 | Evidence |
|---|---|---|---|
| Structure & uniformity | 8 | = | New campaigns (Healthcare, Outfits, PM Dashboard Refactor, Delivery Workspace) all follow the uniform 4-file layout |
| Enforcement | 7 | = | Same hooks (`check-pm-update.sh` Stop, `check-migration.sh`, `docs:check`); `pm:lint` now itself test-covered (`tests/pm-ui/lint-rules.test.ts`) |
| Freshness | 6 | +2 | Stale global Feature State formally `status: superseded` 2026-07-15 (not silently rotting); freshness radar live; delta ledgers actively used (Budget 07-06, Notif 07-10) |
| Execution coupling | 4 | +1 | Debug routes deleted + lint typing fixed **2026-07-18 — by the audit session itself**, after 6 weeks flagged. Movement is real but still audit-driven, not ritual-driven; Trips O1 (30 min) remains open across 3 generations |
| Tooling | 8 | +1 | Full SPA (`scripts/pm/src/` — 10 feature dirs, SSE, router, store), PWA manifest + SW (`f0a8e19`), static-twin parity test, 7 pm-ui test files. Cost: velocity briefly broke typecheck (fixed 07-18) |
| **Overall** | **6.6** | **+0.8** | The archive became software; execution discipline is the last laggard |
| **Handoff readiness** | **6** | new | Doc edits: any-model (grammar linted + tested). Tooling edits: mid-tier (untyped bespoke JS, but test-guarded). Conventions are machine-checked, which is exactly what lower-tier successors need |

## Delta ledger — inherited from FABLED 2 (verbatim)

- **2026-07-10:** **"Next Up" layer shipped** in the PM dashboard (`scripts/pm/client.js` + `styles.css`, shared by static `_dashboard.html` and `pnpm pm`). Every module page now opens with a **Next Up hero** — the single next open task from the module's `4 - Checklist.md` (queue of record; ordering Now → Next → Later → other → Definition of Done, document order within), with Done (server mode) / Postpone / Open-checklist actions plus the next 4 queued. Checklist files render as an **interactive checklist app view** by default (sections with progress, open tasks first, NEXT highlight, per-row postpone, completed collapsed) with a Checklist/Document toggle. **Postpone is view-state only** — localStorage keyed by task text, the markdown is never modified, survives regeneration, falls off if the task line is edited. Home "Do Now / Next" respects postpones and carries per-row postpone buttons. A "N more open checkboxes live elsewhere" indicator guards Checklist-file drift. Task-ID (`**N4**`) + severity/effort (`_(annoyance - S)_`) conventions are parsed into chips; checkbox ordinals verified identical to `scanCheckboxes` against the live Budget checklist (61/61).
- **2026-07-06:** Move 3 below is **done** — the PM dashboard tooling was committed 2026-07-04 (`6c5bdbb`: `scripts/pm/client.js` +3050, `styles.css` +1803, `pm-server.mjs` +88). Two new mechanical aids for the Freshness=4 dimension shipped this date: a **SessionStart freshness radar** (`.claude/hooks/session-brief.sh`) and the vault-wide **FABLED 2 Master Index** with the maintenance protocol. The judgment layer above the playbooks now exists too: Design Doctrine.

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): PM SPA + PWA audited (`ca00105`→`f0a8e19`); `scripts/pm/lint.mjs` JSDoc typing fixed (typecheck green again); debug routes (`env-check`, `supabase-check`, empty `debug/`) deleted — Consultation §3.2's flagship rotting fix finally executed. Evidence cutoff `f0a8e19`.

## The next 3 moves

1. **O2 (v2, still open): the hygiene sweep ritual.** The 07-18 deletions prove the point: flagged 15-minute fixes only die when a session is *dedicated* to killing them. Make it recurring, not generational.
2. **Type the PM tooling boundary** — `scripts/pm/shared/*.mjs` gets JSDoc typedefs (the lint.mjs fix is the template) so typecheck guards the scanner/lint core.
3. **Wire the FABLED 3 verification manifests** (file 5s, all campaigns) into a future `pnpm fabled:verify` — see [file 4 · E1](<4 - FABLED 3 — Future Enhancements.md>) for the kill criterion before building.

**Siblings:** [Budget](<../Budget/FABLED 3/_index.md>) · [Schedule](<../Schedule/FABLED 3/_index.md>) · [Kitchen](<../Kitchen/FABLED 3/_index.md>) · [Trips](<../Trips/FABLED 3/_index.md>) · [Hub & ERA](<../Hub & ERA/FABLED 3/_index.md>) · [Notifications](<../Notifications & Alerts/FABLED 3/_index.md>) · [Healthcare](<../Healthcare/FABLED 3/_index.md>)
