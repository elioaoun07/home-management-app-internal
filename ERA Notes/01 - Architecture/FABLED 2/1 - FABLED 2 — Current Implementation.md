---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/architecture
---

# Architecture · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The architecture as it stands 2026-07-02 — what's load-bearing, and with what kind of fastener (mechanism vs convention).

---

## 1 · The layering (holding well)

```
src/features/<module>/   thin TanStack hooks + queryKeys (per-module)
src/components/          the UI (shared + per-domain dirs; ui/ is hook-protected)
src/app/<route>/         pages · src/app/api/<route>/ API (auth → zod → op → error map)
src/lib/                 the actual business logic (this is where the brains are)
src/contexts/            7 contexts, Safe variants for out-of-provider mounts
```

Verified June additions all respected it: new logic landed in `src/lib/` (`budgetForecast`, `anomalyDetection`, `analysisReport`, `incomeExpense`), not in components. The layering is culturally established — the strongest kind of established.

## 2 · The invariant inventory (what kind of fastener holds each rule)

| Invariant | Fastener | State |
|---|---|---|
| Never edit `src/components/ui/` | **Hook** (PreToolUse block) | ✅ holds |
| DB change ⇒ migration file + schema.sql | **Hook** (`check-migration.sh`) | ✅ holds — 10 dated migrations since 06-16 |
| PM trace per code change | **Hook** (Stop) | ✅ holds — campaign logs prove it |
| Feature Index ↔ Feature Map | **Script** (`docs:check`, pre-commit) | ✅ passes today |
| Atlas current | **Hook** (PostToolUse regen) | ✅ holds |
| No `console.*` (HR 22) | Convention | ❌ 594 occurrences / 162 files |
| `safeFetch` for mutations (HR 6) | Convention | ❌ 240 raw `fetch(`, ~99 mutation-shaped |
| Toast ⇒ Undo (HR 1) | Convention | ◐ unaudited app-wide |
| Invalidation completeness (HR 17) | Convention + skill | ◐ audit P0 names hot gaps |
| One expansion engine per fact | Convention | ❌ three schedule engines ([Schedule FABLED 2.1 §2](<../../10 - Project Management/Schedule/FABLED 2/1 - FABLED 2 — Current Implementation.md>)) |
| One spend definition | **Lib function** (since 06-27) | ✅ new — `sumSpending` et al. |

The pattern is unmistakable: **every hook-backed rule holds; every convention-backed rule leaks.** That asymmetry is the architecture's single most actionable fact.

## 3 · Data access & performance patterns (mature)

- Supabase client separation (browser singleton / server / admin) — respected; the June RLS fix went through a proper migration.
- **The RPC bundle pattern** (Hard Rules 20/21) — `get_schedule_bundle` remains the canonical one-round-trip read; its body is now *in the repo* (schema.sql, 13 policies alongside). No RLS `EXISTS`-subquery policies on hot child tables — the rule that came from real 500ms-per-table pain.
- Query discipline: `qk.*` keys, documented TTLs (`BALANCE=5min` … `RECURRING=30min`), **persisted cache with buster versioning** (`hm-rq-cache-v3`) — the June incident added the missing rule: schema-shaped changes require a buster bump ([Budget FABLED 2.3 · O6](<../../10 - Project Management/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
- Offline: IndexedDB queue (`offlineQueue.ts` + `offlineSyncEngine.ts`) everywhere except the sanctioned shopping-list legacy queue; `isReallyOnline()` probes `/api/health`; June's idempotent-upsert fix made offline replay safe for occurrence actions — a pattern worth generalizing ([file 3 · O4](<3 - FABLED 2 — Optimization Plan.md>)).

## 4 · The AI architecture (newly real)

Two production patterns emerged in June that this directory doesn't document yet: the **`AnalysisReport` contract** (schema-constrained JSON, tolerant Zod, deterministic fallback, ephemeral render) and the **face/intent registry** (ERA's per-face resolver/formatter seam). Both are architecture, not features — they belong in Common Patterns with the same authority as optimistic-mutation rules ([file 3 · O5](<3 - FABLED 2 — Optimization Plan.md>)).

## 5 · What the Feature Map layer has become

`Feature Map/_index.md` + per-module files is the **intent router** for humans and agents, validated by `docs:check`, consumed by every session's mandatory checklist, and now feeding the PM dashboard scanner. It is quietly the most successful piece of process architecture in the repo — the model other meta-layers (decisions, runbooks) should copy.
