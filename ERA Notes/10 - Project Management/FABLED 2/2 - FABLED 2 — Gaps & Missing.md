---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/meta
---

# Project Management · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — The execution-slot failure (the PM system's one real disease)

The machine documents superbly and *schedules* poorly for one class of work: the flagged 15-minute fix. Evidence across every layer, all verified today:

| Item | First flagged | Status 2026-07-02 |
|---|---|---|
| `analytics/debug` route | 2026-05-29 | shipped (+3 sibling debug routes) |
| `MobileItemForm.tsx` dead code | ≤2026-06-10 | on disk (1,363 lines) |
| `sttCapture.ts`/`vadGate.ts` dead voice code | ≤2026-06-10 | on disk |
| `blink/`, `today/` empty feature dirs | 2026-05-29 | on disk |
| Trips RPC snapshot (30 min) | 2026-06-10 | not run |
| Wake-word training (1 hour) | May 2026 | not run |

None of these lacks documentation — each is flagged in 2–4 places. What they lack is an **execution slot**: the weekly plan allocates to campaigns and features; nothing allocates to accumulated micro-debt. The fix is a ritual, not more writing ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).

## 🔴 G2 — Staleness with authority

The global [Feature State](<../2 - Feature State — Current Reality.md>) — the file agents and plans read first — still carries "_(Updated 2026-05-30)_" weak-link claims that June falsified: "financial core untested" (6 finance suites now green), "5 shipping modules have no Overview doc" (all five exist now, verified today), Prerequisites evaluator status (files exist since the June restructuring). A stale *backlog* wastes time; a stale *authority file* actively misroutes planning. The campaign files are fresh; the global layer lags them by a month.

## 🟠 G3 — Link rot has no detector

FABLED v1's links to campaign files broke within days (June PM uniformization renamed its targets); the Schedule FABLED still points at "Pain Inventory & Plan/" paths marked ⚠️ BROKEN by hand. Nothing scans `ERA Notes/` for dead relative links, so rot is discovered by humans mid-task — the most expensive possible time. The new `scripts/pm/scan.mjs` walks every MD file already; a link checker is one function away ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟠 G4 — The reviews don't feed back

FAR (06-12) prescribed a 13-week path with exit gates; the Codebase Audit (07-01) prescribed P0s. Neither has a status column anyone updates — the FAR checklist's week-3 reality (Phase 1 items skipped while an unplanned Budget analytics sprint happened) is visible only by cross-reading five files. Point-in-time reviews need a *delta mechanism* or they decay into good intentions. (FABLED 2 adds delta files to each review folder as the first instance — [Codebase Audit delta](<../Codebase Audit 2026-07-01/FABLED 2/_index.md>), [FAR checklist delta](<../FAR Execution Checklist/FABLED 2/_index.md>), [FAR delta](<../Functional Architecture Review/FABLED 2/_index.md>).)

## 🟡 G5 — Checklist duplication drift

The same item can live in a campaign file 4, the FAR master checklist, the audit remediation list, and the weekly plan — four checkboxes, no linkage. Checking one leaves three stale, and nobody knows which is authoritative. Needs a declared precedence rule ([file 3 · O4](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G6 — The PM tooling is uncommitted

`pm-server.mjs`, `scripts/pm/`, `tests/pm-mutations.test.ts` — real, tested software sitting untracked in git status (07-02). One crash or careless clean loses it. Commit early, iterate committed.

## ⚪ G7 — The dashboard measures documents, not truth

`_dashboard.html` (and the live server) render what the markdown *says*. Nothing reconciles claims against the repo (test counts, LOC, route existence) — the drift G2 describes is invisible to the dashboard that exists to surface state. The bridge is [file 4 · E2](<4 - FABLED 2 — Future Enhancements.md>).
