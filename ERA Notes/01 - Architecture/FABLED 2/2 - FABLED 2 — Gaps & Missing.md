---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/architecture
---

# Architecture · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — The convention/mechanism asymmetry

[File 1 §2's](<1 - FABLED 2 — Current Implementation.md>) table is the finding: hook-backed rules hold perfectly; convention-backed rules are violated by the hundreds. The architecture doesn't need better rules — it needs its two most-violated rules (no-console, safeFetch-for-mutations) moved to the mechanism column. Everything else in the hygiene backlog is downstream of this one structural choice.

## 🔴 G2 — Single-source-of-truth violations, catalogued

| Fact | Copies today | Status |
|---|---|---|
| "When does occurrence X render" | 3 engines | decided target, migration unstarted (Schedule Stage 2) |
| "What counts as spend" | 1 (since 06-27) | ✅ fixed — the model to copy |
| "How is an account created" | 2 (accounts route + Trips RPC) | drifting; June changed one side |
| "Where do AI conversations live" | 3 stores | undocumented ownership |
| "Type → notification destination" | 2 routers (in-app + sw.js) | hand-synced |

One of five fixed. The spend unification is the proof-of-pattern: pure lib function, all consumers converge, contract test pins it. Apply the same recipe four more times.

## 🟠 G3 — No error taxonomy

Routes map `23505 → 409` (Hard Rule 9), but beyond that, validation/auth/missing/transient failures have no standard shape — the audit's P1 "normalize API error responses" is this gap. Client retry/offline logic can't be smart about errors it can't classify.

## 🟡 G4 — The context/provider layer is undocumented load

Seven contexts with Safe variants and mounting subtleties (documented), but no dependency map — which providers assume which, what breaks when a standalone page (NFC, guest) mounts outside them. Hard Rule 16's overlap bugs came from exactly this blind spot. One diagram + table in Common Patterns closes it.

## 🟡 G5 — Realtime is a single-pattern monoculture with no fallback story

Hub realtime rides the browser Supabase singleton; there's no documented degradation (what happens when the websocket dies — polling? silence? stale-forever?). Voice has the same shape ([Hub & ERA FABLED 2.3 · O4](<../../10 - Project Management/Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)). External-dependency degradation paths are an architectural concern, not per-feature polish.

## 🟡 G6 — `src/lib` is becoming a junk drawer at the top level

40+ top-level entries; June's good additions went into subdirs (`budget/`, `schedule/`, `ai/`), but singles keep landing at root (`pushLogger`, `receiptUtils`, `smartTextParser`, both statement parsers…). Not urgent; adopt "domain subdir or justify" for new files before root hits 60.

## ⚪ G7 — This directory doesn't index itself

`01 - Architecture/` has no `_index.md` — eight rulebooks with no reading order or "which doc owns what" table (the PM folders all have one). Cheap fix with outsized agent-legibility value.
