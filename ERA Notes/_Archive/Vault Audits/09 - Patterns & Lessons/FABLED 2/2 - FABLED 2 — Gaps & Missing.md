---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/patterns
---

# Patterns & Lessons · FABLED 2.2 — June's Unwritten Patterns

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The gap *is* the missing patterns. Each entry below is ready to be written up with the `Templates/Pattern.md` form — evidence already exists in the campaign logs.

---

## P1 — The canonical-definition recipe 🔴 (June's most important lesson)

*When N surfaces disagree about a derived number, don't fix the surfaces — extract one pure lib function, converge every consumer, pin it with a contract test.* Evidence: the $276 spend reconciliation (`sumSpending`, 5 divergences, 4 surfaces → one number). Generalizes to: account creation, notification routing, expansion engines ([Architecture FABLED 2.2 · G2](<../../01 - Architecture/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)).

## P2 — The AI answer contract 🔴

*Schema-constrained JSON over precomputed inputs, tolerant validation, deterministic fallback, ephemeral render.* Evidence: `AnalysisReport` + `buildFallbackReport` + `AnalysisDashboard`; second evidence: AI budget suggestions' statistical fallback. Adoption queue already forming (Kitchen pantry report). This is the house style for AI features — unwritten.

## P3 — Idempotent replay via natural-key upsert 🟠

*Every mutation an offline queue may replay must be an upsert on its natural identity, never a plain insert.* Evidence: the occurrence-action 500-retry-loop fix (`onConflict: item_id,occurrence_date,action_type`). Generalization target: all junction writers ([Junction FABLED 2.2 · G5](<../../03 - Junction Modules/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)).

## P4 — The persisted-cache buster rule 🟠

*Change the shape or visibility semantics of a `STABLE_KEYS` query → bump the persist buster in the same commit.* Evidence: the three-fix partner-accounts bug. Candidate for the cache-invalidation skill's checklist ([Budget FABLED 2.3 · O6](<../../../../10 - Project Management/_Archive/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## P5 — Server-side masking, never client blur 🟡

*Privacy redaction happens in the service layer (the browser never receives the secret); UI blur is presentation on top, with `forceBlur` for non-owner amounts.* Evidence: the partner-private masking design (06-27), including the tooltip leak found after the first pass — which is itself the lesson (every render path must be enumerated: tooltips, axes, focus panels).

## P6 — Household resolution must tolerate multiple active links 🟡

*Never `.maybeSingle()` on `household_links`; collect all active links, dedupe ids, include the creator.* Evidence: the both-phones cron fix; prior art in `accounts/route.ts`'s hardened lookup. Becomes moot if the shared helper ships ([Junction FABLED 2.3 · O1](<../../03 - Junction Modules/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) — the helper *is* this pattern, mechanized.

## Meta-gap — the guard-test lesson

The failing placement guard (source-regex asserting on refactored code) teaches: *behavioral guards outlive refactors; textual guards die with them.* Worth one paragraph when P1–P6 get written.
