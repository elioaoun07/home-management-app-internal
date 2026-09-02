---
created: 2026-06-20
updated: 2026-09-02
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/hub-era
---

# Hub & ERA · 4 — Checklist

> **Campaign:** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Hub & ERA — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>). Completed items are swept into the Master Book's Shipped Log and the line deleted — git history is the rest of the archive.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N2→HUB-1–HUB-2, X1–X2→HUB-3–HUB-4, L1–L6→HUB-5–HUB-10.
> **2026-09-02:** working queue re-sequenced against the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>), which supersedes the Awakening plan and Top View study. New items carry their plan packet ID (`E-nn`) in the body; absorbed items point at the packet that now owns them instead of duplicating.

---

## Now

- [ ] **HUB-37** *(E-01)* Commit the working tree (HUB-35/36) + a CI workflow that actually runs `typecheck`/`test`/`lint` on push — today only a docs-diff workflow exists. Includes the ERA-offline-honesty rider: replace the two raw `fetch()` in `useEraConversation.ts` with `safeFetch`, delete the false offline-queue comment, and make an offline write intent reply with a form door instead of "Something went wrong." → `.github/workflows/ci.yml`, `src/features/era/useEraConversation.ts`, `src/features/era/useEraTurn.ts` _(blocker - M)_
- [ ] **HUB-38** *(E-02)* Cron run ledger (`cron_runs`) + wrap all six `/api/cron/*` routes + per-job liveness in `/api/health`; strip the `console.*` still in three cron routes. Add the Applied-migrations table to `migrations/README.md`. _(blocker - M)_
- [ ] **HUB-39** *(E-03)* Scheduler of record: Supabase `pg_cron` + `pg_net` (Hobby tier, per owner 2026-09-02) firing the six cron routes with a commented `era-briefing` slot for HUB-41 to activate. _(blocker - S)_
- [ ] **HUB-40** *(M-00)* Truth sweep: score Awakening's G0/G1/G2 as missed in its own §14 *(done 2026-09-02)*, mark both Awakening and Top View superseded *(done 2026-09-02)*, write "which assistant for what" into the AI Assistant Overview, delete dead ERA code (`face-widgets/`, `recipeOfferGenerate`, `stubIntentRouter`, `useEraHousehold`, unreachable `MODULE_COLORS`, `Face.route`), fix the Native book's manifest count (14, not 9) and this book's `HubPage.tsx` LOC (6,275). → [AI Assistant Overview](<../../03 - Junction Modules/AI Assistant/Overview.md>) _(blocker - M)_

## Next

- [ ] **HUB-41** *(E-04)* Signals v0 (new file: src/lib/briefing/signals.ts): today's schedule, recurring dues next 7 days (including the cheap overdraw check — absorbs **HUB-4**), yesterday + MTD spend vs plan. Pure, tested, provenance on every signal. _(friction - M)_
- [ ] **HUB-42** *(E-05)* Briefing v0.5: compose deterministically, store, push at 07:15 Beirut via the new `era-briefing` cron, exactly-once by `group_key`. Retires the dead `focus_insights` feature in the same migration. **First real proactive delivery — the identity gap closes here.** _(blocker - M)_
- [ ] **HUB-43** *(E-06)* Briefing feedback (👍/👎) + the "ERA vital signs" tile block (SFR₇, precision, cron liveness) in the Activity view. _(friction - M)_
- [ ] **HUB-44** *(E-07)* AI quota gauge + degradation matrix + `AI_MODEL`/`AI_FALLBACK_MODEL` pin/kill-switch env vars. Must ship before any new Gemini consumer (HUB-45). _(friction - S)_
- [ ] **HUB-45** *(E-08)* Reactive reads: `balanceQuery`, `mealPlanRead`, and AI context for the Chef/Brain faces (currently zero — Ask AI on those faces sees only the capability catalog). _(friction - M)_
- [ ] **HUB-46** *(E-09)* Reactive writes through a real offline choke point: income draft, event creation, and `draftTransaction`/`draftReminder` moved onto `enqueueCapabilityAction()` (reuses the existing `transaction`/`item` queue features — no new queue key). _(friction - M)_
- [ ] **HUB-47** *(E-11)* ERA correctness bundle: `era_conversations.updated_at` trigger, `capabilityAction` stops bumping a failed template's match count, `logEraCapabilityAction` covers every registry entity (not just `reminder.*`), the dead `/era?face=` deep-link gets a handler. _(friction - S)_

## Later

- [ ] **HUB-2** Voice graceful degradation + setup docs *(now packet **E-17**, Phase 2)* — one `speak()` seam with a `speechSynthesis` fallback promoted from `useEraReplyTTS`, distinct orb states for token-mint/SDK/worklet/mid-stream failures. Wake-word setup itself is out of scope per owner decision 2026-09-02 (D2) — voice degradation is about the TTS/STT pipeline, not wake. _(blocker - M)_
- [ ] **HUB-48** *(E-10)* Status line + in-hub briefing card (additive, doesn't move the orb/widgets/nav) + `analysis.report` capability so the floating `AIChatAssistant` can be retired once the report is reachable from ERA. _(friction - M)_
- [ ] **HUB-16** `/chat` voice reminders lose the time and don't save *(now packet **E-13**, the one sanctioned `HubPage.tsx` rider)* — gives HubPage's voice engine `runTurn`, deletes `intentClassifier.ts` and the five legacy callbacks. _(friction - M)_
- [ ] **HUB-49** *(E-14)* `get_era_topview_bundle()` RPC — collapses the four widget hooks' ~7 round trips into 1 *(absorbs **HUB-7**'s "fresh cache" half)*. _(friction - M)_
- [ ] **HUB-50** *(E-15)* Vitals strip on mobile, rendered even while asleep — "data is always awake; only the conversational layer sleeps." _(friction - M)_
- [ ] **HUB-51** *(E-16)* Partner: person-absolute colors (`personColor()`, currently unimplemented despite Hard Rule 14), her own briefing hour/toggle from day 6, her chosen flow (Q-PARTNER). _(friction - M)_
- [ ] **HUB-52** *(E-18)* ERA sessions picker + reopen + deterministic titles (no LLM). *(Inbox 2026-08-27; plan sacrifice #1 if a gate is missed.)* _(annoyance - M)_
- [ ] **HUB-53** *(E-19)* Delivery policy v1: quiet hours + 3-push/day budget + digest overflow, consulted inside `pushSender` so every producer inherits it *(absorbs **HUB-8**)*. _(friction - M)_
- [ ] **HUB-54** *(E-20)* Signal stack + card actions (draft-only, never a direct write) + doors from every tile. _(friction - M)_
- [ ] **HUB-55** *(E-21)* Anomaly → proposal: outlier transaction gets exactly one policy-gated card with a "why" line. _(friction - M)_
- [ ] **HUB-56** *(E-22)* Module signals from Kitchen/Trips/Healthcare *(absorbs **HUB-9**)*. _(friction - M)_
- [ ] **HUB-23** *(E-23)* Feedback-weighted ranker — 👎 history halves a signal type's rank. *(Plan sacrifice #4 if a gate is missed.)* _(annoyance - M)_
- [ ] **HUB-5** Decompose `HubPage.tsx` — no standalone extraction packet; per D10 it only shrinks as a rider on a real feature (E-13/HUB-16 is the sanctioned one this window). _(friction - L)_
- [ ] **HUB-6** Expense-split from chat (gap 8a) — untouched by this plan; still Later. _(annoyance - M)_
- [ ] **HUB-10** Merchant-match in "Add as Transaction" — untouched by this plan; still Later. Counterpart of [Budget · 4 · Checklist](<../Budget/4 - Checklist.md>) BUD-2. _(annoyance - M)_
- [ ] **HUB-21** Live-verify Slices 2/3/4/5 against a running dev server — superseded by **HUB-37**'s CI (a stale-build class of bug can't recur once CI runs the real build). Close once HUB-37 ships; the two harmless test reminders ("Water the plants", "Feed the cat") still need manual deletion. _(friction - S)_
- [ ] **HUB-22** Slice 2 stretch capabilities not built: debt settlement via ERA, expense-split from chat (HUB-6), recurring-payment add/skip via ERA — untouched by this plan. _(annoyance - M)_

## Definition of Done

- [x] **D1** Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] **D2** Voice degrades gracefully with no Azure connection, and the setup is documented. *(→ HUB-2/E-17)*
- [ ] **D3** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*
- [x] **D4** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) updated to drop the "no tests" / "fragile" notes this work closes. *(intent-routing notes dropped 2026-08-22; voice "fragile" note stays open for HUB-2/E-17)*
- [ ] **D5** *(new 2026-09-02)* ERA has spoken first for 5 consecutive mornings (Speaks-First Ratio ≥ 5/7) — the plan's own G1 gate, Oct 12.
