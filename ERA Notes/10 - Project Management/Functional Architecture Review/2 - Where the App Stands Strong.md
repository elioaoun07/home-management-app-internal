---
created: 2026-06-12
type: review
status: living
owner: Elio
tags:
  - pm/far
  - scope/cross-cutting
---

# FAR 2 · Where the App Stands Strong

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · **2 · Strengths** · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · [7 · Synthesis](<7 - Synthesis — The 90-Day Path.md>)
>
> Not flattery — leverage. Each strength ends with **how to press it**. The biggest section is §5: assets you already built that your own roadmap under-counts.

---

## 1. The household graph — your deepest moat

~80 tables spanning money (accounts → transfers → recurring → debts → future purchases → allocations), time (items → recurrence → alerts → flexible schedules → pauses), food (recipes → versions → cooking logs → meal plans → inventory → restock history), home (chores, NFC, catalogue), travel (trips → places → packing → side-effects), and people (households, profiles, guests) — **joined by one `household_links` spine and actually used by two real people daily.**

No consumer product has this breadth in one schema. Mint had money. Cozi has calendar+meals. Todoist has tasks. You have *all of it*, with history tables (`account_daily_summaries`, `account_balance_history`, `cooking_logs`, `inventory_restock_history`, `nfc_state_log`) that most products never keep.

**Press it:** every future feature should be evaluated by one test — *does it exploit the fact that all of this lives in one graph?* A feature that could exist as a standalone app is the wrong feature ([FAR 6 · C2](<6 - Market Lens & Challenge Letter.md>)).

## 2. The interaction model is *correct* — rare

"Hub Chat for high-frequency low-friction actions; precision forms for full field control; assistant lives inside the chat." This is the architecture the industry converged on after years of failures — all-chat apps die from ambiguity, all-form apps die from friction. You wrote it into CLAUDE.md as a design law, and built both layers.

**Press it:** the model is right but unevenly enforced — see the Hub coverage matrix ([FAR 3 · R6](<3 - Enhancement Map — Sharpen What Exists.md>)).

## 3. ERA's extension seam — additive, not invasive

Face registry → intent router → per-face resolvers → formatters → summary widgets (`src/features/era/`). Adding capability = adding an intent + resolver + formatter; the FABLED docs correctly call this the extension point. Most hobby AI layers are a prompt spaghetti; yours is a *system*.

**Press it:** this seam is exactly where the Signals Registry plugs in ([FAR 1 §4](<1 - North Star — The Goal Revisited.md>)) — resolvers already prove the "pure function over the graph" pattern. Watch the scaling trap though ([FAR 6 · C4](<6 - Market Lens & Challenge Letter.md>)).

## 4. The proactive *rails* are already laid

Underneath the missing proactive behavior, the hard infrastructure exists:

- **Web Push pipeline** with subscription health, per-user preferences, timezone-aware multi-slot scheduling (`daily-reminder` is genuinely well-engineered plumbing — it's the *content* that's blind), and `push_event_logs` delivery telemetry.
- **Cron discipline** — `CRON_SECRET` auth, `supabaseAdmin()`, `maxDuration` — codified as Hard Rule 8.
- **RPC bundle pattern** (`get_schedule_bundle`) — the latency floor problem (~200ms/PostgREST call) is *solved and documented*; the briefing bundle just reuses the pattern.
- **Offline-first** — IndexedDB queue, `OfflineSyncEngine`, `safeFetch`, real connectivity probing. Proactive features inherit resilience for free.
- **Undo culture** — Hard Rule 1 (every toast has Undo) is the *trust primitive* an acting assistant needs; you've had it from day one.

**Press it:** frame L3 work as "new content on existing rails," not "new system" — it lowers the perceived risk and the real one.

## 5. The buried treasure — intelligence you already built

This is the strongest and least-celebrated finding of the review. **A large fraction of "Track B — the Intelligence Layer" already exists in code**, just not as proactive signals:

| Asset | Where | State |
|---|---|---|
| **Statistical anomaly detection** — z-score spikes/drops/inactive categories, severity-classed | `src/lib/utils/anomalyDetection.ts` + `AnomalyDetectionWidget` | Built; display-only in Review dashboard |
| **Spending forecasts** — overall, per-budget, per-category | `ForecastWidget`, `BudgetForecastWidget`, `CategoryForecastWidget` (dashboard-v2) | Built; display-only |
| **Monthly review scorecard** | `MonthlyReviewScorecardWidget` | Built; display-only — a ready-made seed for the Weekly Review ritual ([FAR 5 · M7](<5 - Missed & Forgotten — The Blind Spots.md>)) |
| **AI budget suggestions** — weekly envelope suggestions w/ wallet balance | `ai_budget_suggestions` table + `api/budget-allocations/ai-suggest` | Built; reach unclear — verify and surface |
| **AI schedule suggestion** | `api/suggest-schedule` | Built; under-documented |
| **Merchant→category learning** | `merchant_mappings` + import flow | Built; *only* statement import benefits (backlog 1b knows this) |
| **Gamification spine** — logging/under-budget streaks, feed with `budget_alert`/`milestone`/`streak` activity types | `hub_user_stats`, `hub_feed` + `api/hub/stats|feed` (consumed in `features/hub/hooks.ts`) | Half-wired; richer types appear under-emitted ([FAR 6 · C6](<6 - Market Lens & Challenge Letter.md>)) |
| **Briefing text-to-speech** | `src/lib/tts/briefingToSpeech.ts` | Built — a *spoken morning brief* is closer than the roadmap thinks |
| **NL parsing** | `smartTextParser.ts` (items), ERA intent NLP, voice STT | Built and good |
| **Recipe AI import/generation** | `api/recipes/extract-from-url`, `api/recipes/[id]/generate` | Built; absent from PM docs entirely |
| **Conditional trigger engine** | Prerequisites (`src/lib/prerequisites/`) | Built; used for one thing (NFC unlock); 4 evaluators stubbed |
| **Reversible cascade ledger** | `trip_side_effects` + activation/completion RPCs | Built; the seed of a general Modes engine ([FAR 4 · J2](<4 - Junction Leverage — Compound Advantages.md>)) |

**Press it:** before building anything new from Track B, run a **"wake the dormant assets" pass** — most of the intelligence layer is a *delivery* problem, not a *development* problem. ([FAR 3 · R4](<3 - Enhancement Map — Sharpen What Exists.md>))

## 6. Engineering discipline that compounds

25 hard rules that encode *learned* lessons (RLS hot-table rule, RPC bundling, timezone, undo, migrations runbook), hook-enforced (migrations check, atlas sync, AI-mirror sync), a documented vault with per-module Overviews, a PM command center that tells the truth about its own weaknesses, and FABLED deep-dives per domain. **The honesty of file 2 ("the newest work is the least protected") is itself an asset** — most solo projects lie to themselves; yours doesn't.

**Press it:** the same honesty should now be pointed at the *system* level (this folder), not only at modules.

## 7. The Lebanon-shaped moat

LBP-in-thousands rule, dual-currency household reality, Beirut-timezone correctness, statement import where no Plaid exists, NFC for a physical household. Global products will never serve this well; it makes the app *irreplaceable for its actual users* — and points to uniquely valuable features no competitor will build ([FAR 5 · M2/M3/M10](<5 - Missed & Forgotten — The Blind Spots.md>)).

**Press it:** lean in. The "what would the market ask" question has a regional answer that is *yours alone*.

## 8. Velocity with control

413 commits in 9 months, solo, while holding documentation, migrations, and design rules together. The risk register (tests, mega-files, console noise) is *known and written down* — which is half of managing it.

**Press it:** spend the velocity on depth for one quarter ([FAR 6 · C2](<6 - Market Lens & Challenge Letter.md>)).

---

> **Summary:** the foundation (graph), the philosophy (hub + precision tools), the seam (faces/intents), the rails (push/cron/RPC/offline/undo), and a surprising amount of the intelligence are **already strong or already built**. The app's weakness is not capability — it's that the capabilities don't *reach* you unprompted, don't cooperate, and don't learn. That's what the rest of this folder fixes.
