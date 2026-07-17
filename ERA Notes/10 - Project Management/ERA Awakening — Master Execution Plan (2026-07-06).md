---
created: 2026-07-06
type: master-plan
status: active
owner: Elio
author: Claude Fable 5
tags:
  - pm/master-plan
  - module/hub-era
  - module/notifications
  - ai/proactive
---

# ERA Awakening — Master Execution Plan

> **Charter.** Close the three gaps that separate this app from its own mission statement: (1) the **proactive layer that has never fired**, (2) the **ERA top-layer brain that is powerful but untested and split in two**, (3) the **wake-word deadlock** — now provably a *double* dead end (see §2.3). Window: **Mon 2026-07-06 → Sun 2026-10-04** (13 weeks). Acceptance: the [FAR "Normal Tuesday"](<Functional Architecture Review/7 - Synthesis — The 90-Day Path.md>) scenario, measured by the gates in §6.
>
> **Position in the command center:** the [FAR 90-Day Path](<Functional Architecture Review/7 - Synthesis — The 90-Day Path.md>) remains the strategic map and the [Final Consultation](<FABLE — Final Consultation (2026-07-06).md>) the strategic *why*; this file is the **execution contract** — decision-complete, session-packetized, self-measuring. Campaign files stay the daily drivers: every Monday, the next packets from §7 are copied into [4 - This Week](<4 - This Week (Action Plan).md>); every shipped packet is ✅-stamped in its campaign folder per Hard Rule 25.
>
> **How any agent consumes this plan:** prompt = *"Execute WP-nn from the ERA Awakening plan."* The agent runs `start-task`, reads the packet row (§7) + its provenance links, invokes the listed skills, ships, proves the evidence gate, runs `finish-task`, ticks the packet here with the date. No packet requires re-planning; ambiguity was spent in §4.

---

## 0 · Why this plan will execute when the previous ones didn't

An honest premise, because it's the only 10× that matters: **this repo does not lack plans — it lacks executed plans.** The evidence is your own: the PM system scored its execution coupling **3/10**; the FAR checklist's week-3 scoreboard recorded plan-vs-reality drift; the intent-fixture task has been "#1 next move" in two consecutive FABLED generations without a line of test written; wake word spent 13 months as "one afternoon away" — and §2.3 now shows the afternoon *could never have worked*. A plan that is merely more detailed would make the archive richer and the app no more proactive — the exact failure mode [Design Doctrine §6](<../01 - Architecture/Design Doctrine.md>) warns about.

So this plan is built as an execution machine, not a document:

1. **Decision-complete.** Every choice that could stall a session is pre-decided in §4 with a default and a decide-by date. A session never stops to deliberate; it stops only for evidence.
2. **Session-packetized.** Every work item is ≤1 Claude Code session (2–4 h), with entry conditions, exact files, the repo skill to invoke, and a binary evidence gate. Packets are the unit of progress; nothing counts until its gate is shown.
3. **WIP-1, enforced by sequence.** One packet in flight, ever. The plan is a queue, not a menu.
4. **Do-or-park dates with pre-written park text** (§12.4). A parked feature is a decision; a perpetually-pending one is a tax. Nothing in this plan may be "pending" past its date.
5. **The plan measures itself.** Its gates are dashboard metrics (§8). If G1 is missed, the plan says so *in writing, here,* per the FABLED protocol — and re-scopes rather than re-inspires.

**The contract in one sentence:** *ERA says one true, unprompted, useful sentence to Elio within 14 days, and everything after compounds on that heartbeat.*

---

## 1 · North Star & the definition of "proactive"

The Doctrine's promise: *recording life must cost near-zero attention, and the system must give that attention back as foresight.* Foresight is the unpaid half. To stop arguing about the word "proactive," this plan uses a ladder — every proactive feature names its level:

| Level | Name | Behavior | Status today |
|---|---|---|---|
| L0 | Answers | Responds when asked | ✅ strong (ERA faces, AnalysisReport) |
| L1 | Reports | Scheduled, static content pushed | 🟠 one precedent (`daily_items_summary`) — **and no scheduler is committed to the repo** |
| L2 | Briefs | Composed, ranked, cross-module, delivered on a policy | ❌ none — the identity gap |
| L3 | Proposes | Attaches a reviewable draft action to the insight | ❌ none proactively (pattern shipped reactively in bulk-convert) |
| L4 | Learns | Adjusts content/timing from 👍/👎 + act/dismiss | ❌ none |

**Target:** L2 by **Jul 19** · L3 by **Sep 13** · first L4 loop by **Oct 4**. AI never acts unreviewed at any level — L3 rides the drafts pattern, per Doctrine standing decision ("proposals over actions") and the Trust Question. The composer is **deterministic-first** (D3): templates over verified signals, LLM phrasing only after trust and quota economics are proven. A wrong briefing at 7:15 AM costs more trust than no briefing — Doctrine Corollary A applied to the flagship.

**Acceptance scenario** stays the FAR's Normal Tuesday (7:15 brief → 12:40 anomaly card → 18:05 NFC trigger → 21:00 silence → Sunday digest). §6's gates are its measurable decomposition.

---

## 2 · Verified starting position (2026-07-06)

Everything below was verified today or carries its FABLED 2 stamp (2026-07-02). Delta since stamp: `git log --since=2026-07-02` → Recurring first-draft + balance-bug fix (Budget side); **Hub & ERA and Notifications unchanged** — their FABLED 2 files are current truth.

### 2.1 What already exists for the proactive era (assembly, not construction)

| Asset | State | Evidence |
|---|---|---|
| 5 cron routes (`daily-reminder`, `daily-items-reminder`, `item-reminders`, `chat-notifications`, `purge-recycle-bin`) | ✅ code | `src/app/api/cron/` |
| **A scheduler that fires them** | ❌ **not in repo** — no `vercel.json`; liveness unverified | glob run today; [Consultation §3.1](<FABLE — Final Consultation (2026-07-06).md>) |
| Typed notifications + correct deep-link routing | ✅ | `daily_items_summary` fix, migration 2026-06-19 |
| Push infrastructure | ✅ | `src/lib/pushSender.ts`, `push_subscriptions` |
| Signal substrates: schedule bundle, recurring dues, forecast math | ✅ | `get_schedule_bundle`, `lib/recurring`, Budget FABLED 2 E1 substrate |
| Reviewed-proposal UX (the L3 card) | ✅ shipped reactively | `BulkConvertReviewSheet` + draft reminders (06-16) |
| AnalysisReport engine (schema + deterministic fallback) | ✅ | `src/lib/ai/analysisReport.ts` (06-27) |
| Briefing TTS seam | ✅ | `src/lib/tts/briefingToSpeech.ts`, `useBriefingTTS.ts` |
| Delivery policy (quiet hours, push budget, grouping) | ❌ | Notifications FABLED 2 "Intelligence 2/10" |
| Signals registry / composer / `get_briefing_bundle` | ❌ | Hub FABLED 2 G3 |

### 2.2 The ERA brain (Hub & ERA FABLED 2, maturity 4.0)

- **Architecture is good, protection is zero:** 4 faces, intent registry, resolvers/formatters — "adding a capability = adding an intent" — and **zero tests**; `resolveIntent` sits upstream of money actions with no confidence fail-safe (G1/O1).
- **`HubPage.tsx` 5,798 LOC** and compounding (+292 in 3 weeks); every roadmap item lands inside it (G2/O2). Rule stands: decompose only with a feature riding on it.
- **Three conversation stores**, no declared owner (G8/O6). **Two assistants**, no user-facing story (G10/E6).
- Context assembly is trapped inside the ~30 KB `api/ai-chat` route — extracting it is also the composer's input (O3.2, pays twice).

### 2.3 The wake-word truth (new finding — this changes the E3 record)

Both documented paths are dead, one of them *silently*:

1. **Picovoice Porcupine** — requires company-email registration; personal accounts refused. Dead by vendor policy (user-confirmed, and recorded in [Voice Conversation.md](<../03 - Junction Modules/Hub Chat/Voice Conversation.md>) since May).
2. **Azure Custom Keyword (`hey-era.table`)** — the plan-of-record in `azureWake.ts` and FABLED E3 ("one afternoon at speech.microsoft.com"). **Keyword recognition is not supported in the JavaScript/browser Speech SDK** — it exists only in the device/native SDKs. The shipped code betrays it: `(rec as any).startKeywordRecognitionAsync` behind a silent `catch {}` — had the model been trained, the recognizer would have no-op'd and the regex fallback would have carried on, indistinguishably. The task carried for 13 months was **unexecutable as specified**, and no gate existed to reveal it. (Sources: Microsoft Learn SpeechRecognizer JS reference; Speech SDK feature matrix — see §12.)
3. **The one live path:** **openWakeWord** — Apache-2.0, runs fully in-browser via `onnxruntime-web` (proven in public demos), custom "Hey ERA" trainable in a free Colab notebook in under an hour, no vendor account. Full options analysis and spike protocol: §12.
4. **Platform ceiling regardless of engine:** PWA = foreground + screen-on only. Wake word is a *docked-phone / open-app* feature until a Capacitor shell (parked per standing memory; trigger unchanged). This bounds the value honestly: hands-free matters in the kitchen-counter scenario, not the pocket.

**Consequence:** E3's "do or park by end of July" was premised on a 1-hour task that never existed. Re-baselined in §4-D2: one honest, timeboxed spike in Phase 3, hard park date **Aug 31**, park text pre-written.

---

## 3 · The elicitation record

What a senior PM would ask, and where the answer already lives — so no session ever re-derives it.

### 3.1 Answered from the vault

| Question | Answer | Source |
|---|---|---|
| Ultimate goal? | Reactive + proactive household OS for two people + one AI; capture ≈ free, attention returned as foresight | Doctrine §1 |
| Primary interface? | Hub Chat top layer; forms are precision tools; ERA lives in Hub | CLAUDE.md header |
| Who are the users? | Elio + partner (two-viewer architecture is load-bearing); partner adoption is the unproven half of the thesis | Doctrine Q1; Consultation §3.6 |
| AI trust model? | AI proposes → human confirms (drafts) → Undo; never direct writes to money/schedule | Doctrine standing decision |
| What may proactive content contain? | Only verified signals; deterministic fallback mandatory for AI-composed content | AnalysisReport precedent |
| Delivery constraints? | Quiet hours + daily push budget required before scaling volume; regret must be measured | FAR 2.5; Notifications FABLED 2 |
| Time semantics? | UTC storage; Beirut display; custom billing month for money windows | timezone-handling skill; `startOfCustomMonth` |
| Cron security? | `Bearer CRON_SECRET`, `supabaseAdmin()`, `maxDuration=60`, and now: a run ledger (zombie-schedule law) | Hard Rule 8; Doctrine §3 |
| Unit economics? | Gemini free tier (quota engineering exists, consumption unmeasured); Azure TTS ~$16/1M chars; $0 appetite for new vendors | Consultation §3.5; Voice doc |
| Test doctrine? | Money/routing logic ships with tests; route contract-test template exists (07-04) | money-rules; Consultation §3.3 |
| What NOT to build? | New modules before October; open banking; 2-way calendar sync; new gamification; Capacitor (until trigger); any second engine for an existing concept | FAR anti-roadmap; Doctrine §4 |
| Why did past plans stall? | Meta-work gravity well — knowing outran doing; incentives, not willpower | Consultation §3.2; PM FABLED 2 |

### 3.2 Constraints ledger

- **Platform:** Next.js on Vercel + Supabase; PWA (no background execution, no background mic, iOS autoplay/gesture rules); crons currently unscheduled *in-repo*.
- **People:** one builder + AI agents; realistic cadence ~2 packets/week; partner is a user, not an operator (yet).
- **Money:** free tiers are load-bearing → deterministic-first composer, quota gauge before AI-composed briefings scale.
- **Reality:** Lebanese connectivity physics (3 s timeout, offline queue) apply to every new surface — briefing card must render from cache offline.

### 3.3 Open questions only Elio can answer (feed §4; defaults apply if unanswered)

1. **Q-VERCEL** — Which Vercel plan is the app on? (Hobby caps cron jobs at 2/day with loose timing → D1 default flips to pg_cron.) *Needed by WP-00, Jul 7.*
2. **Q-WAKE** — After two dead vendors: is hands-free wake still wanted enough to spend 2 timeboxed sessions in August, or park now and keep tap-to-talk? *(Default: spike per D2.)*
3. **Q-PARTNER** — Which single flow does the partner most want ERA to handle for her (her words)? Gates WP-12's content and honors Consultation §3.6. *Needed by Aug 1.*
4. **Q-QUIET** — Confirm quiet hours 21:00–08:00 Beirut and 3 pushes/day/user cap (D5 defaults).
5. **Q-TTS** — Should the morning brief auto-speak on first app-open (greeting-cache pattern), or speak only on tap? *(Default: on tap in v0.5; auto-speak is a v1 toggle.)*
6. **Q-WIP** — The working tree carries an uncommitted Recurring first-draft. Ship it or shelve it *before* WP-01; this plan starts on a clean WIP-1 slate. *Needed Jul 7.*

---

## 4 · Decision register (defaults are binding until overridden)

| # | Decision | Options considered | **Default (binding)** | Decide by | Rationale |
|---|---|---|---|---|---|
| D1 | Scheduler of record | Vercel crons · Supabase `pg_cron`+`pg_net` · GitHub Actions · cron-job.org | **Vercel `vercel.json` if plan ≥ Pro, else `pg_cron`** | Jul 8 | Versioned-in-repo beats dashboards; pg_cron is free, minute-precise, observable via SQL, no new vendor. GH Actions jitter (±15 min) is wrong for a 7:15 brief. |
| D2 | Wake-word path | openWakeWord spike · keep regex wake · park · Capacitor-native | **Timeboxed openWakeWord spike in Phase 3 (2 sessions); hard park Aug 31**; Porcupine + Azure-JS declared dead in the vault **now** (WP-13) | Aug 31 | §2.3. The only path that is free, account-less, and browser-real. Presence ranks below trust (Doctrine §5) → Phase 3, not sooner. |
| D3 | Composer v0.5 engine | LLM-composed · deterministic templates | **Deterministic templates over typed signals; LLM phrasing earliest Phase 4, behind quota gauge** | — (set) | Trust + quota + latency. A briefing must never hallucinate a due date. |
| D4 | Conversation stores | merge all · owner-per-purpose | **Inventory then declare one owner per purpose, in the AI Assistant vault doc; PR checklist line "which store?"** | Aug 2 (WP-09) | O6. ERA conversational state and Budget analysis history may legitimately differ — but in writing. |
| D5 | Delivery policy defaults | — | **Quiet 21:00–08:00 Beirut · 3 pushes/day/user · severity classes urgent/info/digest · overflow → daily digest** | Jul 25 | FAR 2.5; Notifications FABLED 2 E1. Policy before volume. |
| D6 | Partner inclusion | day 1 · after tuning | **Elio-only for ≥5 briefings, then partner with her own prefs + her chosen content (Q-PARTNER)** | Aug 1 | Tune on yourself; her first proactive experience must land (§3.6). |
| D7 | `features/memories/` fate | promote · fold | **Fold, unless a Phase 2–3 briefing packet concretely needs a memory read** (E7 kill criterion) | Sep 13 | No resolver has needed it in a month of designs. |
| D8 | Daily log (E10) | now · Phase 4 · never | **Phase 4, grouped read only; kill if it demands denormalization** | Sep 14 | Cheap, but behind the moat items. |
| D9 | WIP discipline | — | **WIP-1; Recurring draft resolved before WP-01; no new analysis docs while any flagged <30-min fix is open** | Jul 7 | Consultation §3.2; Doctrine §6. |
| D10 | Briefing surface order | push-only · push+card | **v0.5 = push + notification row (deep-link to Hub). Rich in-Hub card lands with WP-11** | — (set) | Ship the heartbeat before the furniture. |

---

## 5 · Strategy — three programs and a governor

**Program A · HEARTBEAT (the proactive nervous system).** One spine built once: *scheduler → cron ledger → signals registry → deterministic composer → delivery policy → push/card/TTS → feedback.* Modules then merely contribute signals. This is FAR Phase 2 executed with the Consultation's P1+P4 welded together: **observability ships before the first briefing**, so a silent failure is impossible by construction (zombie-schedule law).

**Program B · BRAIN (one trustworthy ERA).** Tests before capabilities (O1/O7) because a confidently-wrong money assistant erodes the trust everything else spends. Then the two decompositions that pay twice (O3.2 context → composer input; O2.2 `useEraActions` → briefing-card substrate), then the one-brain unification (E6) and the first multi-turn money conversation (E2). Order is Doctrine §5 verbatim: correctness → trust → capture → coherence → foresight.

**Program C · PRESENCE (voice, honestly bounded).** Tell the truth in the vault first (both dead paths — WP-13), keep tap-to-talk excellent (degradation states, runbook), run exactly one spike on the only live engine, then ship-or-park *in writing*. Presence is delight, not identity — it never blocks Programs A/B.

**GOVERNOR.** The metrics of §8 on the dashboard, the cadence of §10, WIP-1, and the do-or-park registry. The governor is what previous plans lacked; it is not optional this time.

---

## 6 · Phase plan & exit gates

| Phase | Window | Theme | Exit gate (binary, evidence-linked) |
|---|---|---|---|
| **0 · Ignition** | Jul 6–8 | Scheduler truth + run ledger | **G0:** every cron answers "how do I know it ran" with a `cron_runs` row; scheduler config committed or documented; `/api/health` reports per-job liveness |
| **1 · First Words** | Jul 9–19 | Briefing v0.5 to Elio | **G1:** ≥5 consecutive mornings delivered · SFR₇ ≥ 5/7 · deep-link opens Hub correctly · zero duplicate briefings (exactly-once argument written) |
| **2 · A Brain You Can Trust** | Jul 20 – Aug 16 | Tests, fail-safe, card, policy, partner | **G2:** ≥40 routing fixtures + fail-safe green in CI · AnalysisReport tests green · in-Hub briefing card live · partner receiving her briefing · regret < 20% · store decision written |
| **3 · Presence & One Brain** | Aug 17 – Sep 13 | Voice truth + spike; E6 unification; E2 money conversation | **G3:** wake **shipped behind flag or formally parked** (either is a pass; silence is the only fail) · one multi-turn money flow E2E on the tested router · "which assistant for what" written and true |
| **4 · The Loop Learns** | Sep 14 – Oct 4 | Anomaly→proposal, feedback learning, quota gauge, census | **G4:** Proactive Hit Rate ≥ 5/wk at ≥ 80% 👍 · one loop runs end-to-end without Elio · AI quota sparkline live · estate census scheduled |

Gate protocol: on each gate date, score it **here**, in a dated delta line — pass, or miss + one-sentence cause + re-scope. Two consecutive missed gates ⇒ stop, shrink the plan (drop Phase 4 before diluting Phase 1–2), never stretch dates silently.

---

## 7 · Work-packet catalog (the execution contract)

Format: **ID · name · size** (1 = one session) **· prereq → skills → evidence gate**. Provenance in §13. Tick packets here with dates as they ship; PM-trace each in its campaign folder (Hub & ERA or Notifications & Alerts file 1 + 4).

### Phase 0 — Ignition

- [ ] **WP-00 · Scheduler audit · 0.25 (Elio, no code).** Vercel dashboard → note plan tier + any configured crons; answer Q-VERCEL + Q-WIP. → *Gate:* D1 resolved; findings appended here.
- [ ] **WP-01 · Cron run ledger + health · 1.** Migration `cron_runs` (job, started/finished, status, detail JSONB) — `db-migration`; each of the 5 cron routes writes start/finish — `api-route` cron template; `/api/health` returns per-job last-run + offline-queue depth. → *Gate:* hit each route with Bearer locally; 5 rows; health JSON shows them.
- [ ] **WP-02 · Commit the heartbeat · 0.5.** Per D1: `vercel.json` (6 jobs incl. the future `era-briefing`) **or** `pg_cron` migration calling routes via `pg_net` with the secret; document in `docs/ENV.md` either way — `db-migration` + `timezone-handling` (UTC schedules, Beirut intent noted). → *Gate:* next calendar day, `cron_runs` shows scheduled fires without manual triggering.

### Phase 1 — First Words

- [ ] **WP-03 · Signals v0 · 1.** `src/lib/briefing/signals.ts` — three server-side, typed, **pure** signal builders: today's schedule (via `get_schedule_bundle`), recurring dues next 7 days, yesterday's spend vs plan (custom-month aware). Unit tests on fixtures — `money-rules` (display math counts). → *Gate:* tests green; each signal returns provenance fields (source rows/ids).
- [ ] **WP-04 · Briefing v0.5 — compose, store, push · 1.** `composeBriefing()` deterministic template (D3) → notification row typed `era_briefing` (migration for the type CHECK — `db-migration`) → push via `pushSender` to Elio only → new `api/cron/era-briefing` (Bearer, `supabaseAdmin`, `maxDuration=60`, writes `cron_runs`), scheduled 07:15 Beirut / 04:15 UTC — `api-route`, `recurrence-safety` mindset for the **exactly-once argument** (dedupe key: user+date). → *Gate:* real push on the phone next morning; tapping it lands in Hub; second manual fire same day is a no-op.
- [ ] **WP-05 · SFR metric + feedback rail · 1.** `briefing_feedback` (👍/👎, acted, dismissed_at) migration; Speaks-First Ratio tile on the dashboard (`dataviz`-grade tile, house theme rules — `ui-guardrails`). → *Gate:* tile shows SFR₇ > 0 after first scheduled fire; a 👎 writes a row.

### Phase 2 — A Brain You Can Trust

- [ ] **WP-06 · Routing fixture table · 1.** ~40 real utterances → expected `(face, intent)` through `resolveIntent`; CI-registered. The single highest value-per-hour test file in the app. → *Gate:* green in CI; a deliberately misrouted fixture fails the suite.
- [ ] **WP-07 · Confidence fail-safe · 1.** Below-threshold → ERA asks a clarifying question, never acts; threshold itself under test. Blocking precondition for every future money intent. → *Gate:* fixture proves "ambiguous money utterance → question, zero mutations."
- [ ] **WP-08 · AnalysisReport engine tests · 0.5.** Junk model output → fallback (never throw); `buildFallbackReport` correctness; duplicate-category-label merge pinned. → *Gate:* green; engine safe to copy.
- [ ] **WP-09 · Conversation-store verdict · 0.5.** Inventory the three stores → declare owner-per-purpose in the AI Assistant vault doc + "which store?" line in the new-surface checklist (D4). → *Gate:* doc section exists; G8 marked decided in Hub FABLED 2 delta.
- [ ] **WP-10 · Context assembler extraction · 1.** `api/ai-chat` context assembly → `src/lib/ai/context.ts` with unit tests; consumed by chat **and** exposed for the composer (pays twice). → *Gate:* chat behavior unchanged (fixtures); composer can import it server-side.
- [ ] **WP-11 · Briefing card + `useEraActions` extraction · 2.** The one decomposition with a rider (O2.2): extract conversation-engine callbacks from `HubPage.tsx` *as* the substrate, then render the morning brief as an in-Hub card (proposal-card pattern from `BulkConvertReviewSheet`; offline-renders from cache; `ui-guardrails` + `cache-invalidation`). → *Gate:* HubPage LOC strictly decreases; push deep-links to the card; card actions produce drafts, never direct writes.
- [ ] **WP-12 · Delivery policy v1 + partner · 1.** Quiet hours, 3-push/day budget, severity classes, `group_key` grouping in the drawer (Notifications O3); partner receives her briefing per D6/Q-PARTNER with her own toggle. → *Gate:* forced 4th push is suppressed into digest (test); partner's phone receives at her hour; regret metric wired.

### Phase 3 — Presence & One Brain

- [ ] **WP-13 · Voice truth + hygiene · 0.5.** Delete dead `sttCapture.ts` + `vadGate.ts`; rewrite the wake section of [Voice Conversation.md](<../03 - Junction Modules/Hub Chat/Voice Conversation.md>) per §2.3 (both vendors dead, why, sources); mark `azureWake.ts` deprecated-pending-D2; write the voice runbook (env rotation, new device). → *Gate:* zero importers confirmed; vault no longer promises an impossible afternoon.
- [ ] **WP-14 · openWakeWord spike · 2 (hard timebox).** Train "Hey ERA" (free Colab, ~1 h) → ONNX in `public/voice/`; browser worker via `onnxruntime-web` (melspec → embedding → wake model); wire to `engine.triggerWake()` behind `NEXT_PUBLIC_WAKE_MODEL_ENABLED`; keep regex fallback. Kitchen protocol: 20 trials × {quiet, music, 3 m distance}; count false wakes over one docked evening. → *Gate (Aug 31, binary):* ≥90% wake rate and ≤2 false wakes/evening ⇒ ship behind flag; else **park with §12.4 text verbatim**. Either outcome passes G3.
- [ ] **WP-15 · Voice degradation states · 1.** Token-mint fail, SDK fail, worklet fail, mid-stream drop → each a defined orb state + text fallback (O4.1). → *Gate:* each state reproducible via forced failure and visibly distinct.
- [ ] **WP-16 · One brain (E6 step 1) · 1.5.** AnalysisReport becomes an ERA budget-face capability: `mode:"analysis"` intent → shared context (WP-10) → same report renderer in Hub threads; floating `AIChatAssistant` becomes a scoped shell. Write the "which assistant for what" paragraph (G10). → *Gate:* same money question in Hub and in the floating chat yields the same report component; fixture added.
- [ ] **WP-17 · Expense-split conversation (E2) · 2.** First multi-turn money flow on the now-tested router; reuse `BulkConvertReviewSheet` proposal semantics + `useSplitBill` math — `money-rules` (worked before/after example + test mandatory). → *Gate:* full conversation fixture (utterance → clarify → confirm card → draft → confirm → balances correct → Undo restores).

### Phase 4 — The Loop Learns

- [ ] **WP-18 · Anomaly → intervention · 1.** Server-side anomaly check on new transactions → signal → policy-gated push with provenance (FAR 3.1); L3: attaches a recategorize/split proposal. → *Gate:* seeded anomalous transaction produces exactly one gated, explainable card.
- [ ] **WP-19 · Feedback-weighted composer · 1.** Composer reads `briefing_feedback` + act/dismiss; two consecutive 👎 on a signal type halves its rank; visible "why am I seeing this" provenance line (L4 seed, no ML). → *Gate:* fixture — 👎 history demotes a signal deterministically.
- [ ] **WP-20 · Kitchen + Trips signals · 1.** Low-stock → shopping proposal; trip re-entry briefing — both as `getBriefingSignals()` contributors (staged E1). → *Gate:* each appears in the brief only when its condition is real (fixtures).
- [ ] **WP-21 · Household daily log (E10) · 1.** Per-day grouped digest over `hub_messages` + actions + system events; briefing links "yesterday's log." Kill per D8 if it demands denormalization. → *Gate:* today's log renders in <1 s from existing tables.
- [ ] **WP-22 · AI quota gauge · 0.5.** Counter per AI call (tokens, model, feature) → table + dashboard sparkline + written degradation matrix (which AI feature dies first at quota, and what it says when dead). → *Gate:* sparkline moves after one chat; matrix in vault.
- [ ] **WP-23 · Estate instrumentation · 0.5.** Per-module touch counter (local aggregate, daily sync); first estate census dated +4 weeks in the PM index. → *Gate:* counts visibly accrue; census date exists.

**Capacity check:** ~21 sessions across 13 weeks ≈ 1.6/week — inside the §3.2 cadence with slack for life. Phase 4 is the designated sacrifice if reality bites (per §6 gate protocol).

---

## 8 · Instrumentation & KPI definitions (the governor's gauges)

| Metric | Definition (exact) | Source | Target |
|---|---|---|---|
| **Cron liveness** | jobs with `cron_runs.finished_at` inside their expected window ÷ scheduled jobs | `cron_runs` | 100% visible, always |
| **Speaks-First Ratio (SFR₇)** | days in trailing 7 with ≥1 delivered proactive notification (`type='era_briefing'` or proactive class) ÷ 7 | `notifications` | ≥ 5/7 by Jul 19; 7/7 by Aug 16 |
| **Briefing precision** | 👍 ÷ (👍+👎), trailing 14 d | `briefing_feedback` | ≥ 80% by Sep 13 |
| **Notification regret** | dismissed <5 s after open ÷ delivered, trailing 14 d | feedback + notification events | < 20% |
| **Proactive Hit Rate** | proactive cards acted on (tap-through or proposal accepted) per week | feedback | ≥ 5/wk by Oct 4 |
| **Wake success / false wakes** | kitchen protocol (WP-14) | manual protocol sheet | ≥90% · ≤2/evening, or park |
| **Router safety** | fixtures green; % ambiguous money utterances answered with a question, not an action | CI + fixtures | 100% of below-threshold |
| **Quota headroom** | daily Gemini calls & tokens vs known caps, per feature | quota table | gauge exists; no feature dies mysteriously |
| **Capture share** | % of new transactions originating Hub/voice vs forms, monthly | transactions origin field/heuristic | trend up — the "top layer" claim, measured |

Dashboard placement: one "ERA vital signs" group — SFR tile, precision, cron liveness, quota sparkline. The mission's own health, seen daily (Consultation P1's "metric where you look").

---

## 9 · Risk register

| # | Risk | L×I | Early signal | Mitigation |
|---|---|---|---|---|
| R1 | **Meta-work gravity well** — this plan becomes another artifact | H×H | A new analysis doc appears before G1 | D9 rule; WIP-1; gates scored in writing; Phase-4-first descoping |
| R2 | Scheduler platform limits (Hobby: 2 jobs, loose timing) | M×H | WP-00 finds Hobby | D1 flips to pg_cron — decision pre-made |
| R3 | Untested router misfires money | M×H | any bulk/voice money action pre-WP-06 | No new money intents before WP-06/07 (hard sequence) |
| R4 | Briefing fatigue / trust burn | M×H | regret >20%, 👎 streak | Delivery policy before partner inclusion; deterministic content; feedback rail from day 1 |
| R5 | Wake-word rabbit hole (third vendor chase) | M×M | spike exceeds 2 sessions | Hard timebox + pre-written park text + G3 passes either way |
| R6 | Duplicate briefings (retry/replayed cron) | M×H | two pushes same morning | Exactly-once dedupe key user+date, written argument (WP-04 gate) |
| R7 | HubPage decomposition spirals | M×M | extraction PR without a feature rider | O2 rule: only WP-11's rider-scoped extraction |
| R8 | Gemini quota exhaustion as UX mystery | M×M | unexplained AI failures | D3 (no LLM in composer); WP-22 gauge + degradation matrix |
| R9 | iOS PWA push/audio quirks eat Phase 1 | L×M | briefing push silent on iOS | v0.5 targets Elio's device first; TTS on-tap only (Q-TTS default) |
| R10 | Partner's first proactive experience misses | M×H | her 👎 or silence | D6: tuned on Elio first; her content chosen by her (Q-PARTNER) |

---

## 10 · Governance & cadence

- **Monday (15 min):** pull the next 2–3 packets into [4 - This Week](<4 - This Week (Action Plan).md>); nothing else enters the week. *(First act of Jul 7: redraft file 4 from Phase 0 — it is 35 days stale and the radar knows.)*
- **Friday (10 min):** ✅-stamp shipped packets here + campaign files (Hard Rule 25); one delta line in the touched FABLED 2 `_index`.
- **Weekly 90-minute hygiene slot** (already prescribed by PM FABLED O2): burns flagged <30-min fixes; D9 forbids new analysis docs while any are open.
- **Gate days** (Jul 8 · Jul 19 · Aug 16 · Sep 13 · Oct 4): score the gate in §6, in writing, pass or miss. Two misses ⇒ shrink scope, Phase 4 first.
- **Do-or-park registry:** WP-14 wake (Aug 31) · D7 memories (Sep 13) · D8 daily log (kill-on-denormalization). Parking is recorded with the pre-written text — a parked item exits every future list.
- **Agent handoff contract:** each packet is self-sufficient given this file + its provenance links; agents run `start-task` → packet → `finish-task`; evidence gate output (test run, screenshot, `cron_runs` row) is pasted or referenced in the campaign file with the ✅.
- **Plan maintenance:** this file is living; delta lines under §14. If >40% needs rewriting, freeze and supersede per FABLED generational protocol — don't patch a corpse.

## 11 · The anti-plan (refusals, inherited + new)

No new standalone modules before October · no open-banking · no two-way calendar sync · no Capacitor until its trigger fires · no new gamification · **no LLM-composed briefings before the quota gauge exists** · no fourth conversation store, second toast system, third recurrence engine, or second assistant brain · no wake-word vendor #3 · no HubPage extraction without a feature rider · **no new plan or audit documents until G1 is scored** — this plan included; the next artifact this repo owes itself is a push notification at 07:15.

---

## 12 · Annex — the wake-word decision file

### 12.1 Post-mortem of a 13-month pending item
Porcupine died of vendor policy (company-email registration). Its replacement, Azure Custom Keyword, was scaffolded (`azureWake.ts`) and carried in every plan since May as "one afternoon" — but keyword recognition **does not exist in the browser JS Speech SDK** (device/native SDKs only), and the code's `as any` cast + silent `catch` meant even a trained model would have failed invisibly. Lesson, now Doctrine-adjacent: **an external-dependency task may not be carried in any plan without a proven hello-world of the critical path.** (This plan applies it: WP-14's first hour is the raw browser demo, before any integration.)

### 12.2 Options table (2026-07-06)

| Option | Cost | Account? | Browser-real? | Verdict |
|---|---|---|---|---|
| Picovoice Porcupine | free tier | ❌ company email | yes | **Dead** (policy) |
| Azure Custom Keyword | — | has account | **no — JS SDK unsupported** | **Dead** (platform) |
| **openWakeWord + onnxruntime-web** | $0, Apache-2.0 | none | yes — public browser demos; Colab custom training <1 h | **The spike (WP-14)** |
| Vosk WASM keyword grammar | $0 | none | yes, ~50 MB model | Fallback if oWW accuracy fails — heavy, note only |
| Status quo (Azure STT transcript regex) | STT minutes while armed | — | shipped today | Baseline; remains the fallback path |
| Park + tap-to-talk + future House API/Siri | $0 | — | — | The honorable exit (§12.4) |

### 12.3 Spike protocol (WP-14, timebox 2 sessions)
Session 1: raw demo — pretrained oWW model detecting in-browser via `onnxruntime-web`, standalone page, phone mic. **If this fails, stop; park.** Then train "Hey ERA" in Colab, swap model. Session 2: integrate behind the flag (worker → `engine.triggerWake()`), run the kitchen protocol, decide by numbers (§8).

### 12.4 Pre-written park text (paste into Hub & ERA file 1 + FABLED 2 delta if the gate fails)
> **Hands-free wake: PARKED (2026-08-31).** Two vendor paths proved dead (Picovoice policy; Azure keyword absent from the browser SDK) and the open-source spike missed the accuracy gate on real kitchen conditions. Voice remains tap-to-talk, which the household actually uses. Revisit only if (a) a Capacitor shell ships for other reasons, or (b) openWakeWord's browser story materially improves. This entry closes E3; it must not reappear in plans as "one afternoon."

Sources: [Microsoft Learn — SpeechRecognizer (JS)](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognizer?view=azure-node-latest) · [Azure Speech SDK overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-sdk) · [openWakeWord (GitHub)](https://github.com/dscripka/openWakeWord) · [openWakeWord in the browser — Deep Core Labs](https://deepcorelabs.com/open-wake-word-on-the-web/) · [Colab training notebook](https://github.com/dscripka/openWakeWord/blob/main/notebooks/training_models.ipynb)

---

## 13 · Traceability (nothing here is invented)

| Packets | Provenance |
|---|---|
| WP-00–02 | Consultation §3.1 + P4; Doctrine zombie-schedule law; CLAUDE.md cron gotcha |
| WP-03–05 | Hub FABLED 2 E1 + G3; FAR 2.2/2.4; Consultation §6 wk-1/2; Notifications FABLED 2.1 precedent |
| WP-06–08 | Hub FABLED 2 O1/O7 + G1; FAR 1.1 |
| WP-09–10 | Hub FABLED 2 O6/G8 + O3.2; FAR 2.3 |
| WP-11 | Hub FABLED 2 O2.2 + E1 card; FAR 2.6 |
| WP-12 | Notifications FABLED 2 O1/O3/E1; FAR 2.5; Consultation §3.6 |
| WP-13–15 | Hub FABLED 2 O4/G4/G5/G6 + §2.3 research (this file) |
| WP-16 | Hub FABLED 2 E6/G10 |
| WP-17 | Hub FABLED 2 E2; money-rules |
| WP-18–20 | FAR 3.1/3.4; Hub FABLED 2 E1 staged |
| WP-21 | Hub FABLED 2 E10 |
| WP-22 | Consultation §3.5 / P-quota |
| WP-23 | Consultation §3.4 / P3 |

## 14 · Delta ledger (append-only)

- **2026-07-06** — Plan created. Wake-word double-dead-end verified (Azure JS SDK gap — §2.3). Awaiting WP-00 answers: Q-VERCEL, Q-WIP.
- **2026-07-17** — [ERA Top View — Design Study](<ERA Top View — Design Study (2026-07-17).md>) created on owner request as a *companion* consumer of this plan's signal engine (pull mouth of the same brain). Its packets WP-T1..T5 slot behind WP-03/04/11; heartbeat priority unchanged — if a session must choose, WP-04 wins. No WP ticked as of this date.
