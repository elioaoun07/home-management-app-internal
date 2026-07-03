---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/performance
---

# Performance · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 1 · The shipped optimization patterns (this directory's docs, verified live)

- **The RPC bundle** — `get_schedule_bundle` collapses 7 PostgREST round-trips (~170–200ms each) into one; canonized as Hard Rules 20/21 after the ~1.3s floor was measured. The RLS anti-pattern rule (no `EXISTS`-subquery policies on hot child tables — ~500ms/table observed) came from the same campaign. These are *measured* optimizations — the directory's gold standard.
- **Query-cache tiering** — `BALANCE=5min · TRANSACTIONS=2min · ACCOUNTS/CATEGORIES=1h · RECURRING=30min` (`queryConfig.ts`), persisted to localStorage (`hm-rq-cache-v3`) with `STABLE_KEYS` + buster versioning; `refetchOnMount: false` for stables. June's incident taught the versioning rule ([Budget FABLED 2.3 · O6](<../../10 - Project Management/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
- **Connectivity engineering** — `safeFetch` pre-flight + timeout; `isReallyOnline()` probing `/api/health` every 30s; the 3s-default / long-`timeoutMs` split (HR 6) exists precisely because slow AI calls falsely tripped the offline detector.
- **Targeted lazy-loading** — the Azure Speech SDK is dynamically imported client-side only; greeting TTS is pre-cached (3 hour-variants); AudioWorklet PCM playback hits ~100ms first-audio.
- **Prefetch layer** — `src/lib/prefetch` (+ the misfiled `features/navigation` util) warms hot routes.

## 2 · What June added

The **outlier engine** runs client-side over 12 months of transactions with median/MAD in log space — cheap enough today, worth watching as history grows. `AnalysisReport` moved AI analysis to **precomputed metrics** (one context assembly instead of raw-data prompting) — a cost *and* latency optimization. Review v3's per-tab recharts render 12-month stacked datasets — unprofiled.

## 3 · The known heavy spots (by construction, not measurement)

| Surface | Why heavy | Measured? |
|---|---|---|
| `HubPage.tsx` 5,798 LOC | parse + render + state in one chunk on the primary surface | ❌ |
| Dashboard read fan-out | accounts + balances + transactions + recurring as separate queries | ❌ (the `get_budget_bundle` candidate — HR 21 says measure first) |
| Review v3 charts | 12-month × category recharts stacks | ❌ |
| 594 prod `console.*` | DevTools overlay drag + serialization cost | ❌ (rule exists for this reason) |
| Perpetual bell animation | style/paint ticks while any unread exists | ❌ |

## 4 · The honest summary

Every optimization in this directory happened **after felt pain, then was measured, then was canonized** — a healthy loop with one missing stage: nothing watches for the *next* pain. There is no measurement standing between "fine today" and "the schedule-bundle moment" for any surface above.
