---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/architecture
---

# Architecture · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Mechanize the two leaking rules (fixes G1; the highest-leverage architecture change available)

1. **`no-console`** ESLint rule now, with per-file disables for the 162 unswept files (each disable is a visible TODO; new files are protected immediately). Sweep slices remove disables over time.
2. **Raw-fetch ratchet:** a script (pre-commit or CI) that counts `\bfetch\(` outside an allowlist and fails if the count *rises* above the recorded baseline (240). Conversion proceeds by campaign; regression becomes impossible. (Ratchet design: [Audit FABLED 2.4 · E3](<../../10 - Project Management/Codebase Audit 2026-07-01/FABLED 2/4 - FABLED 2 — Future Enhancements.md>).)

## O2 — Run the single-source recipe on the remaining four facts (fixes G2)

The proven sequence from spend unification: *pure lib function → converge consumers → contract test.* Apply to: account creation (`src/lib/accounts/create.ts`, both callers), notification routing (one table, two consumers — [Notifications FABLED 2.3 · O2](<../../10 - Project Management/Notifications & Alerts/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)), conversation-store ownership (decision + doc, [Hub & ERA FABLED 2.3 · O6](<../../10 - Project Management/Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)), occurrence expansion (the big one, [Schedule FABLED 2.3 · O3](<../../10 - Project Management/Schedule/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## O3 — The repo-fidelity rule (one sentence, then one execution)

Rule: **every live-DB object (function, policy, trigger) exists as a dated migration + its `schema.sql` reflection.** Schedule complies; Trips is the last known offender ([Trips FABLED 2.3 · O1](<../../10 - Project Management/Trips/FABLED 2/3 - FABLED 2 — Optimization Plan.md>) — 30 min). Add the sentence to this directory's DB doc / CLAUDE.md database section so the rule outlives the cleanup.

## O4 — Generalize the idempotent-replay pattern (from June's fix)

The occurrence-action `.upsert(onConflict)` fix is the correct general answer for **every offline-queued mutation**: natural-key upserts (or idempotency keys) so replays and double-taps can't 500 or duplicate. Audit the offline queue's replay targets against this; document as the standard in `Sync and Offline.md`.

## O5 — Document the two new AI patterns as architecture (fixes file 1 §4)

`AnalysisReport` contract + face/intent registry → Common Patterns entries (or a new `AI Patterns.md` here), each with: when to use, the invariants (deterministic fallback mandatory; precomputed inputs only; `timeoutMs` per Hard Rule 6), and a pointer to the reference implementation. Do it before the second adopter copies the first divergently ([Kitchen FABLED 2.4 · E9](<../../10 - Project Management/Kitchen/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) is queued).

## O6 — Error taxonomy (fixes G3; one type + one helper)

`ApiError = { code: "validation" | "auth" | "conflict" | "not_found" | "transient" | "internal", message, details? }` + a route helper mapping zod/Supabase errors into it. Adopt in new/touched routes only — no big-bang. The offline engine's retry logic gets smarter for free (`transient` retries; `validation` never does).

## O7 — Directory index + context map (fixes G7 + G4; one sitting)

`_index.md` for this directory (docs table + reading order) and a provider-dependency table in Common Patterns. Pure agent-legibility, an hour total.

---

### Sequencing

```
O1 (the asymmetry fix — this week) → O3 rule + Trips snapshot → O2 recipe, easiest first
  (account creation → notification routing → conversation stores → expansion last)
O4/O5/O6 each ride their next natural touch · O7 one idle hour
```
