---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/meta
---

# Project Management · FABLED 2 — Index

> The deep-dive layer for the **PM system itself** — the command center, campaign folders, FABLED layer, reviews, dashboard, and the enforcement machinery around them. No v1 existed at this scope; this is its first X-ray, built to the FABLED 2 standard (verified against the working tree **2026-07-02**).
>
> **Scope note:** module content lives in the campaign FABLED 2 folders ([Budget](<../Budget/FABLED 2/_index.md>) · [Schedule](<../Schedule/FABLED 2/_index.md>) · [Kitchen](<../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../Trips/FABLED 2/_index.md>) · [Notifications & Alerts](<../Notifications & Alerts/FABLED 2/_index.md>)). This folder audits the *machine that manages them*.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want to see the PM system as a system — layers, tooling, enforcement, and what actually works. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the honest list of where the PM machine leaks — staleness, link rot, the execution-slot failure. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the concrete moves to make the PM layer self-maintaining. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the 10× ideas for PM itself — including PM-as-data and the auto-delta report. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Structure & uniformity** | 8 | Uniform campaign layout (1–4 + FABLED), command-center numbered files, cross-cutting reviews — genuinely well-designed. |
| **Enforcement** | 7 | Real hooks: `check-pm-update.sh` (Stop), `check-migration.sh`, `docs:check` in pre-commit — PM traceability is mechanically backed. |
| **Freshness** | 4 | Global Feature State still says "Updated 2026-05-30" with claims June falsified; FABLED v1 links rotted within 9 days of writing. |
| **Execution coupling** | 3 | The system documents brilliantly and schedules poorly: flagged 15-minute fixes (debug routes, dead files) survive for weeks across every layer. |
| **Tooling** | 7 | `pnpm pm` live dashboard server + `scripts/pm/` scanner + `tests/pm-mutations.test.ts` (in-flight) — the PM layer is becoming software. |
| **Overall** | **5.8** | A well-built archive that knows everything and forgets to do the small things. |

## Delta ledger (append-only)

- **2026-07-06:** Move 3 below is **done** — the PM dashboard tooling was committed 2026-07-04 (`6c5bdbb`: `scripts/pm/client.js` +3050, `styles.css` +1803, `pm-server.mjs` +88). Two new mechanical aids for the Freshness=4 dimension shipped this date: a **SessionStart freshness radar** (`.claude/hooks/session-brief.sh` — warns every session when PM files 2/4 go stale) and the vault-wide **[FABLED 2 Master Index](<../../00 - Home/FABLED 2 Master Index.md>)** with the maintenance protocol. The judgment layer above the playbooks now exists too: [Design Doctrine](<../../01 - Architecture/Design Doctrine.md>).

## The next 3 moves

1. **Adopt the delta-ledger convention** everywhere (every status claim carries its verify date + command — the FABLED 2 format).
2. **Create the hygiene sweep ritual** — one recurring 90-minute slot that executes the accumulated 15-minute fixes ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
3. ~~**Finish and commit the PM dashboard tooling**~~ ✅ done 2026-07-04 (`6c5bdbb`) — was uncommitted work-in-progress carrying real value ([file 2 · G6](<2 - FABLED 2 — Gaps & Missing.md>)).
