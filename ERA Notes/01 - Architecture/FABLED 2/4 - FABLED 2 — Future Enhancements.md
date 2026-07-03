---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/architecture
---

# Architecture · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**
>
> Architectural bets that make the next year cheaper. Each with its kill criterion — architecture speculation is the most expensive kind.

---

## E1 — The signals layer ⭐ (the FAR's nervous system, given its architectural home)

**Impact: Highest · Effort: M (assembly — the parts exist, [FAR FABLED 2.3](<../../10 - Project Management/Functional Architecture Review/FABLED 2/3 - FABLED 2 — Optimization Plan.md>))**

Per-module pure `get*Signals()` functions → one composer → policy-gated delivery ([Notifications FABLED 2.4 · E1](<../../10 - Project Management/Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)). Architecturally: signals are **read-models, never new writers** — the same discipline as `getMealsForRange` and `getWeekShape`. Defer the insights *schema* until two producers run in production.
**Kill criterion:** none on the concept; on the schema — if function-first works for 3 producers, maybe it keeps working; add the store only when cross-run memory (dedup, feedback) actually demands it.

## E2 — Module manifests (the Feature Map, machine-readable)

**Impact: Med–High · Effort: S–M**

One `manifest.json` (or frontmatter block) per module: owner dirs, tables, query keys, cron dependencies, doc links. Consumers: the PM reconciliation script, `docs:check` (deeper validation), agent routing, and dead-code detection (files owned by no manifest = candidates). This is the architecture becoming introspectable.
**Kill criterion:** if maintaining manifests takes more than the drift they catch, collapse back to the Feature Map alone — the signal is honest either way.

## E3 — Contract-test layer between client and routes

**Impact: High (the missing middle of the test pyramid) · Effort: M**

Zod schemas already define every route's contract. Generate/write table-driven tests: schema-valid/invalid payloads → status mapping, per route — no DB needed for the parse layer, service-role test DB for the few write-path assertions. Start with finance + items routes (the money paths). This is the app-wide harness the per-campaign route-test items all assume; build it once.

## E4 — Event log over direct side-effects (the long bet)

**Impact: High eventually · Effort: H — not yet**

Today cross-module effects are direct writes (message action → transaction; trip activation → pauses; future: signals → notifications). A thin append-only `events` table (actor, verb, subject, payload) written *alongside* (not instead of) direct effects would give: the household daily log ([Hub & ERA FABLED 2.4 · E10](<../../10 - Project Management/Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) for free, audit trails (reassignment history — a named Schedule gap), anomaly context, and eventually the substrate for undo-anything.
**Kill criterion:** do not start before two concrete consumers are scheduled; an event log with one reader is a diary.

## E5 — Per-module data export/import (household data sovereignty)

**Impact: Med (trust + migration insurance) · Effort: M**

One `GET /api/export` per domain (JSON, RLS-scoped). Motivations: backup independence from Supabase, the Songbook-style side-project pattern (data reuse), and the day a second household wants in. Cheap to do domain-by-domain riding other work.
**Kill criterion:** if Supabase PITR backups get verified + documented first, drop to Low priority — sovereignty is the point, redundancy is not.

## E6 — Architecture fitness functions (the self-checking ruleset)

**Impact: Med · Effort: S each**

Tiny scripts asserting structural rules, run in CI: no `features/*` cross-imports (the standalone rule — currently convention), no component imports from `app/api`, every `api/*/route.ts` contains a zod parse, every mutation hook file imports `safeFetch` or is allowlisted. Each is ~20 lines with the repo's existing script culture ([`scripts/pm/scan.mjs`](<../../10 - Project Management/FABLED 2/1 - FABLED 2 — Current Implementation.md>) proves the pattern). The standalone-import rule alone has silently broken in other codebases for months before detection — cheap insurance here.

---

## Recommended order

```
E3 (the missing test middle — enables everything) → E1 (the nervous system, assembly-style)
  → E6 (fitness functions, one per idle hour) → E2 (manifests, when reconciliation ships)
  → E5 (opportunistic) → E4 (only with two named consumers)
```
