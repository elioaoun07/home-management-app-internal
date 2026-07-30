---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - codebase-audit
---

# Codebase Audit · FABLED 2.3 — Executing the Audit Without a Fifth Checklist

> **FABLED 2:** [_index](<_index.md>) · [1 · Verification](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Adopt the precedence rule for this audit's items

Per [PM FABLED 2.3 · O4](<../../FABLED 2/3 - FABLED 2 — Optimization Plan.md>): each remediation item gets **promoted into the owning campaign's file 4** (with a back-reference `[audit P0]`) and struck through in the audit checklist with the promotion date. The audit checklist becomes a *source ledger*, not a live queue. This prevents the four-checkbox drift that killed the FAR checklist's accuracy by week 3.

## O2 — Sequence the P0s realistically (they are not one sprint)

1. **Un-red the suite** (A1 — prerequisite for every "verify" step; owned by Schedule).
2. **Trips RPC snapshot** (A2 — 30 min, irreversibility beats hygiene).
3. **Console sweep in three slices** — notification crons → finance API routes → auth/AI client surfaces; land the ESLint `no-console` rule after slice 1 with per-file disables for the unswept remainder (mechanical enforcement starts protecting immediately instead of after the last slice).
4. **Fetch classification** — one session to *tag* (allowed GET/probe/SW vs convert-to-safeFetch vs needs-timeoutMs), then convert by module during normal campaign work. Don't attempt a big-bang conversion; the tags make every later touch cheap.
5. **Invalidation audits** — ride each campaign's next mutation-touching session (the cache-invalidation skill auto-invokes there anyway).

## O3 — Make the numbers the progress meter

[File 1](<1 - FABLED 2 — Current Implementation.md>) pinned baselines (594 console / 240 fetch / 93 tests / 4 debug routes / 2 orphan dirs). Each delta pass re-runs the same commands and writes the new numbers next to the old. Movement becomes visible in seconds; "are we actually improving?" stops being a feeling.

## O4 — The two decisions to make once, in writing

1. **`env-check` / `supabase-check`:** keep-behind-auth vs delete (A5) — record in the security file.
2. **Live RLS audit scope:** the audit correctly notes repo-blindness to policies; Schedule's `_verify_schedule_rls.md` is the template — decide which other domains (finance first) get a verification file and when.
