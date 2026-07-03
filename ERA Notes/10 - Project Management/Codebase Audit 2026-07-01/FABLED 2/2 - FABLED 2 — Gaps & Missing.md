---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - codebase-audit
---

# Codebase Audit · FABLED 2.2 — What the Frame Leaves Out

> **FABLED 2:** [_index](<_index.md>) · [1 · Verification](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Not criticism of the audit — additions from the FABLED 2 recon that its repository-wide frame under-weights, so the remediation cycle sees the whole board.

---

## 🔴 A1 — The red test suite is a meta-P0

The audit prescribes `pnpm test` as a verification step; the suite fails today for a known-stale reason ([file 1](<1 - FABLED 2 — Current Implementation.md>)). Every remediation PR that "runs the tests" either ignores the red (training the habit the audit exists to prevent) or wastes time rediscovering it. **Un-red the suite before starting the P0 loop.**

## 🔴 A2 — Unrecoverable logic outranks logging hygiene

The audit's P0s are hygiene-heavy (console, fetch, invalidation). The single largest *irreversibility* risk in the codebase is different in kind: `activate_trip`/`complete_trip` exist **only in the live database** ([Trips FABLED 2.2 · G2](<../../Trips/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)). A DB mishap loses core product logic with no diff trail. 30 minutes. It belongs on the P0 list of any risk-ranked view.

## 🟠 A3 — Dead code with gravity isn't "maintainability"

`MobileItemForm.tsx` (1,363 lines, zero importers) has already redirected one full refactor onto the wrong file — its cost class is *misdirection of future work* (human and AI), not tidiness. Same for `sttCapture.ts`/`vadGate.ts`. A repo audit that weights by blast radius should list traps-for-agents as functional risk, especially in a codebase steered by AI sessions.

## 🟠 A4 — The persisted-cache staleness class

The June partner-accounts incident (stale `hm-rq-cache-v3` surviving hard refreshes, masked by `refetchOnMount: false`) is a *class* the audit's invalidation section doesn't cover: server-side fixes that clients never see until a buster bump. Rule proposal lives at [Budget FABLED 2.3 · O6](<../../Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>); it belongs in the audit's cache-invalidation P0 scope.

## 🟡 A5 — Env/infra probe routes are their own severity

`env-check` and `supabase-check` aren't debug leftovers like `analytics/debug` — they are *probe endpoints for infrastructure state*. Even if currently harmless, they deserve an explicit auth/keep/delete decision recorded in the security file, not a bundled deletion.

## ⚪ A6 — The audit has no owner-mapping

Its remediation checklist is a flat list; every item also exists (or now exists) in a campaign FABLED 2 with an owner and sequence. Without mapping, the lists double-count and drift — the checklist-precedence problem ([PM FABLED 2.2 · G5](<../../FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)). [File 3](<3 - FABLED 2 — Optimization Plan.md>) does the mapping.
